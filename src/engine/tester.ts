import type { MazeConfig, WsServerMessage, ScoreData } from '../types';
import type { DQNAgent } from './agent';
import { MazeEnv } from './env';
import { generateRandomMaze, bfsShortestPath } from './solver';

export type TestCallback = (msg: WsServerMessage) => void;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** シード付き擬似乱数 (mulberry32) */
function seededRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

/** Math.random を一時的にシード付きRNGに差し替えて fn を実行 */
function withSeededRandom<T>(seed: number, fn: () => T): T {
  const original = Math.random;
  Math.random = seededRng(seed);
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

const ACTION_NAMES = ['↑', '→', '↓', '←'];
const STUCK_LIMIT = 10;

export async function runTests(
  agent: DQNAgent,
  numRows: number,
  numCols: number,
  numTests: number,
  callback: TestCallback,
  abortSignal?: AbortSignal,
): Promise<void> {
  interface ResultEntry {
    test_index: number;
    reached_goal: boolean;
    steps: number;
    path: [number, number][];
    bfs_shortest: number | null;
    walls: [number, number][];
    start: [number, number];
    goal: [number, number];
  }

  const results: ResultEntry[] = [];

  for (let i = 0; i < numTests; i++) {
    if (abortSignal?.aborted) return;

    // 固定シードでテストコースを生成（同じサイズ・同じインデックスなら毎回同じコース）
    const seed = numRows * 10000 + numCols * 100 + i + 1;
    const mazeResult = withSeededRandom(seed, () =>
      generateRandomMaze(numRows, numCols, { randomEndpoints: true }),
    );
    const walls = mazeResult.walls;
    const testStart = mazeResult.start;
    const testGoal = mazeResult.goal;

    // BFS最短経路
    const wallSet = new Set(walls.map(([r, c]) => `${r},${c}`));
    const { length: bfsLen } = bfsShortestPath(numRows, numCols, wallSet, testStart, testGoal);

    // テスト迷路を通知
    callback({
      type: 'test_maze',
      test_index: i,
      walls,
      start: testStart,
      goal: testGoal,
      bfs_shortest: bfsLen,
    });

    // テスト実行
    const env = new MazeEnv({
      numRows, numCols, walls, start: testStart, goal: testGoal,
    });
    let obs = env.reset();
    const path: [number, number][] = [env.agentPos];
    const maxSteps = numRows * numCols * 4;
    let reachedGoal = false;
    const visitCounts = new Map<string, number>();
    visitCounts.set(`${env.agentPos[0]},${env.agentPos[1]}`, 1);
    for (let step = 0; step < maxSteps; step++) {
      if (abortSignal?.aborted) return;

      const { action, qValues } = agent.greedyActionWithQ(obs);
      const result = env.step(action);
      obs = result.obs;
      const curPos = env.agentPos;
      path.push(curPos);

      const key = `${curPos[0]},${curPos[1]}`;
      const count = (visitCounts.get(key) ?? 0) + 1;
      visitCounts.set(key, count);

      callback({
        type: 'test_step',
        test_index: i,
        step: step + 1,
        position: curPos,
        action,
        action_name: ACTION_NAMES[action],
        q_values: Object.fromEntries(
          ACTION_NAMES.map((name, idx) => [name, Math.round(qValues[idx] * 1000) / 1000])
        ),
      });
      await sleep(30);

      if (result.terminated) {
        reachedGoal = true;
        break;
      }
      if (count >= STUCK_LIMIT) break;
    }

    const resultEntry: ResultEntry = {
      test_index: i,
      reached_goal: reachedGoal,
      steps: path.length - 1,
      path,
      bfs_shortest: bfsLen,
      walls,
      start: testStart,
      goal: testGoal,
    };
    results.push(resultEntry);

    callback({
      type: 'test_result',
      test_index: i,
      reached_goal: reachedGoal,
      steps: path.length - 1,
      path,
    });
  }

  // スコア計算
  const score = computeScore(results);
  callback({
    type: 'test_done',
    results: results.map(r => ({
      type: 'test_result' as const,
      test_index: r.test_index,
      reached_goal: r.reached_goal,
      steps: r.steps,
      path: r.path,
    })),
    ...score,
  });
}

/** ユーザー設計の1コースでエージェントを走らせる（プレイグラウンド用） */
export async function runPlayground(
  agent: DQNAgent,
  maze: MazeConfig,
  callback: TestCallback,
  abortSignal?: AbortSignal,
): Promise<void> {
  const { num_rows: numRows, num_cols: numCols, walls, start, goal } = maze;

  const wallSet = new Set(walls.map(([r, c]) => `${r},${c}`));
  const { length: bfsLen } = bfsShortestPath(numRows, numCols, wallSet, start, goal);

  callback({
    type: 'test_maze',
    test_index: 0,
    walls,
    start,
    goal,
    bfs_shortest: bfsLen,
  });

  const env = new MazeEnv({ numRows, numCols, walls, start, goal });
  let obs = env.reset();
  const path: [number, number][] = [env.agentPos];
  const maxSteps = numRows * numCols * 4;
  let reachedGoal = false;
  const visitCounts = new Map<string, number>();
  visitCounts.set(`${env.agentPos[0]},${env.agentPos[1]}`, 1);

  for (let step = 0; step < maxSteps; step++) {
    if (abortSignal?.aborted) return;

    const { action, qValues } = agent.greedyActionWithQ(obs);
    const result = env.step(action);
    obs = result.obs;
    const curPos = env.agentPos;
    path.push(curPos);

    const key = `${curPos[0]},${curPos[1]}`;
    const count = (visitCounts.get(key) ?? 0) + 1;
    visitCounts.set(key, count);

    callback({
      type: 'test_step',
      test_index: 0,
      step: step + 1,
      position: curPos,
      action,
      action_name: ACTION_NAMES[action],
      q_values: Object.fromEntries(
        ACTION_NAMES.map((name, idx) => [name, Math.round(qValues[idx] * 1000) / 1000])
      ),
    });
    await sleep(30);

    if (result.terminated) {
      reachedGoal = true;
      break;
    }
    if (count >= STUCK_LIMIT) break;
  }

  callback({
    type: 'test_result',
    test_index: 0,
    reached_goal: reachedGoal,
    steps: path.length - 1,
    path,
  });

  const score = computeScore([{
    reached_goal: reachedGoal,
    steps: path.length - 1,
    bfs_shortest: bfsLen,
  }]);

  callback({
    type: 'test_done',
    results: [{
      type: 'test_result',
      test_index: 0,
      reached_goal: reachedGoal,
      steps: path.length - 1,
      path,
    }],
    ...score,
  });
}

interface ScoreInput {
  reached_goal: boolean;
  steps: number;
  bfs_shortest: number | null;
}

function computeScore(results: ScoreInput[]): ScoreData {
  if (results.length === 0) {
    return { success_rate: 0, avg_efficiency: 0, total_score: 0 };
  }

  const successes = results.filter(r => r.reached_goal);
  const successRate = successes.length / results.length;

  const efficiencies: number[] = [];
  for (const r of successes) {
    if (r.bfs_shortest && r.bfs_shortest > 0 && r.steps > 0) {
      efficiencies.push(Math.min(r.bfs_shortest / r.steps, 1.0));
    }
  }

  const avgEfficiency = efficiencies.length > 0
    ? efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length
    : 0;

  const totalScore = Math.round(successRate * 100 * (1 + avgEfficiency));

  return {
    success_rate: Math.round(successRate * 100) / 100,
    avg_efficiency: Math.round(avgEfficiency * 100) / 100,
    total_score: totalScore,
  };
}
