import type { MazeConfig, WsServerMessage } from '../types';
import type { DQNAgent } from './agent';
import { MazeEnv } from './env';

export type TrainCallback = (msg: WsServerMessage) => void;

/** 学習頻度: N ステップに1回 learn() を呼ぶ (標準DQNと同様) */
const LEARN_EVERY = 4;

/** Phase 2 で並列に走らせる環境数 */
const NUM_PARALLEL = 8;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function stdev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

function createEnv(cfg: MazeConfig, revisitPenalty: number): MazeEnv {
  return new MazeEnv({
    numRows: cfg.num_rows,
    numCols: cfg.num_cols,
    walls: cfg.walls,
    start: cfg.start,
    goal: cfg.goal,
    revisitPenalty,
  });
}

export async function runTraining(
  agent: DQNAgent,
  mazeConfigs: MazeConfig[],
  callback: TrainCallback,
  options: {
    maxEpisodes: number;
    revisitPenalty?: number;
    earlyStopWindow?: number;
    abortSignal?: AbortSignal;
  },
): Promise<void> {
  const maxEpisodes = options.maxEpisodes;
  const revisitPenalty = options.revisitPenalty ?? 0.05;
  const earlyStopWindow = options.earlyStopWindow ?? 30;
  const abortSignal = options.abortSignal;
  const obsDim = MazeEnv.OBS_DIM;

  const firstCfg = mazeConfigs[0];
  const maxStepsPerEpisode = firstCfg.num_rows * firstCfg.num_cols * 4;

  const recentGoals: boolean[] = [];
  const recentLengths: number[] = [];
  let episodesDone = 0;
  let globalStep = 0;
  let converged = false;

  function pickRandomEnvIdx(): number {
    return Math.floor(Math.random() * mazeConfigs.length);
  }

  function checkEarlyStop(reachedGoal: boolean, totalSteps: number): boolean {
    recentGoals.push(reachedGoal);
    if (recentGoals.length > earlyStopWindow) recentGoals.shift();
    if (reachedGoal) {
      recentLengths.push(totalSteps);
      if (recentLengths.length > earlyStopWindow) recentLengths.shift();
    }
    if (
      recentGoals.length === earlyStopWindow &&
      recentGoals.every(Boolean) &&
      recentLengths.length >= earlyStopWindow
    ) {
      if (stdev(recentLengths) < 2) return true;
    }
    return false;
  }

  // === Phase 1: Sequential (最初の2エピソード、ステップ可視化あり) ===
  const seqEpisodes = Math.min(2, maxEpisodes);

  for (let ep = 0; ep < seqEpisodes; ep++) {
    if (abortSignal?.aborted) return;

    const envIdx = pickRandomEnvIdx();
    const env = createEnv(mazeConfigs[envIdx], revisitPenalty);

    let obs = env.reset();
    let totalSteps = 0;
    let reachedGoal = false;
    let totalLoss = 0;
    let lossCount = 0;

    while (totalSteps < maxStepsPerEpisode) {
      if (abortSignal?.aborted) return;

      const action = agent.chooseAction(obs);
      const result = env.step(action);
      agent.storeTransition(obs, action, result.reward, result.obs, result.terminated);

      globalStep++;
      if (globalStep % LEARN_EVERY === 0) {
        const loss = agent.learn();
        if (loss !== null) { totalLoss += loss; lossCount++; }
      }

      totalSteps++;

      callback({
        type: 'step',
        episode: ep,
        maze_index: envIdx,
        step: totalSteps,
        position: env.agentPos,
        action,
        reward: Math.round(result.reward * 1000) / 1000,
      });
      await sleep(20);

      obs = result.obs;
      if (result.terminated) { reachedGoal = true; break; }
    }

    agent.decayEpsilon();
    agent.softUpdate();

    const avgLoss = lossCount > 0 ? Math.round((totalLoss / lossCount) * 10000) / 10000 : 0;
    callback({
      type: 'episode_end',
      episode: ep,
      maze_index: envIdx,
      total_steps: totalSteps,
      reached_goal: reachedGoal,
      epsilon: Math.round(agent.epsilon * 10000) / 10000,
      avg_loss: avgLoss,
    });

    episodesDone++;
    if (checkEarlyStop(reachedGoal, totalSteps)) { converged = true; break; }
  }

  // === Phase 2: Parallel (残りのエピソードを並列環境で高速実行) ===
  if (!converged && episodesDone < maxEpisodes) {
    const numParallel = Math.min(NUM_PARALLEL, maxEpisodes - episodesDone);

    interface Slot {
      env: MazeEnv;
      envIdx: number;
      obs: Float32Array;
      steps: number;
    }

    const slots: Slot[] = Array.from({ length: numParallel }, () => {
      const idx = pickRandomEnvIdx();
      const env = createEnv(mazeConfigs[idx], revisitPenalty);
      return { env, envIdx: idx, obs: env.reset(), steps: 0 };
    });

    const obsBatch = new Float32Array(numParallel * obsDim);
    let runningLoss = 0;
    let runningLossCount = 0;

    outer:
    while (episodesDone < maxEpisodes) {
      if (abortSignal?.aborted) return;

      // バッチ観測を組み立て
      for (let i = 0; i < numParallel; i++) {
        obsBatch.set(slots[i].obs, i * obsDim);
      }

      // バッチ推論 → 全環境ステップ
      const actions = agent.chooseActionBatch(obsBatch, numParallel);

      for (let i = 0; i < numParallel; i++) {
        const slot = slots[i];
        const result = slot.env.step(actions[i]);
        agent.storeTransition(slot.obs, actions[i], result.reward, result.obs, result.terminated);
        slot.obs = result.obs;
        slot.steps++;

        const done = result.terminated || slot.steps >= maxStepsPerEpisode;
        if (done) {
          agent.decayEpsilon();
          agent.softUpdate();

          const avgLoss = runningLossCount > 0
            ? Math.round((runningLoss / runningLossCount) * 10000) / 10000
            : 0;
          callback({
            type: 'episode_end',
            episode: episodesDone,
            maze_index: slot.envIdx,
            total_steps: slot.steps,
            reached_goal: result.terminated,
            epsilon: Math.round(agent.epsilon * 10000) / 10000,
            avg_loss: avgLoss,
          });

          runningLoss = 0;
          runningLossCount = 0;

          episodesDone++;
          if (checkEarlyStop(result.terminated, slot.steps)) { converged = true; break outer; }
          if (episodesDone >= maxEpisodes) break outer;

          // スロットをリセットして新しいエピソード開始
          const newIdx = pickRandomEnvIdx();
          slot.env = createEnv(mazeConfigs[newIdx], revisitPenalty);
          slot.envIdx = newIdx;
          slot.obs = slot.env.reset();
          slot.steps = 0;
        }
      }

      // 学習 (バッチステップごとに1回)
      globalStep++;
      if (globalStep % LEARN_EVERY === 0) {
        const loss = agent.learn();
        if (loss !== null) {
          runningLoss += loss;
          runningLossCount++;
        }
      }

      // UIに制御を返す + エージェント位置を送信 (適度な頻度で)
      if (globalStep % 50 === 0) {
        const slot0 = slots[0];
        callback({
          type: 'step',
          episode: episodesDone,
          maze_index: slot0.envIdx,
          step: slot0.steps,
          position: slot0.env.agentPos,
          action: 0,
          reward: 0,
        });
        await sleep(0);
      }
    }
  }

  // 各学習迷路での最適経路を取得
  const finalPaths: [number, number][][] = [];
  for (const cfg of mazeConfigs) {
    const env = createEnv(cfg, revisitPenalty);
    finalPaths.push(agent.greedyPath(env));
  }

  callback({
    type: 'training_done',
    total_episodes: episodesDone,
    final_paths: finalPaths,
    converged,
  });
}
