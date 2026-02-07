/**
 * DQN 学習・テストを別スレッドで実行する Web Worker。
 * メインスレッドから受け取ったコマンドに応じて
 * runTraining / runTests を実行し、結果を postMessage で返す。
 */
import * as tf from '@tensorflow/tfjs';
import { DQNAgent } from './agent';
import { MazeEnv } from './env';
import { runTraining } from './trainer';
import { runTests, runPlayground } from './tester';
import type { MazeConfig, HyperParams, WsServerMessage } from '../types';

// Worker には DOM がないので CPU バックエンドを明示的に使用
tf.setBackend('cpu');

let agent: DQNAgent | null = null;
let abortController: AbortController | null = null;

/** メインスレッドに WsServerMessage を送信 */
function send(msg: WsServerMessage): void {
  self.postMessage(msg);
}

interface StartTrainCommand {
  type: 'start_train';
  mazes: MazeConfig[];
  hp: HyperParams;
}

interface StartTestCommand {
  type: 'start_test';
  numRows: number;
  numCols: number;
  numTests: number;
}

interface PlayCommand {
  type: 'play';
  maze: MazeConfig;
}

interface StopCommand {
  type: 'stop';
}

interface ResetCommand {
  type: 'reset';
}

type WorkerCommand = StartTrainCommand | StartTestCommand | PlayCommand | StopCommand | ResetCommand;

self.onmessage = async (e: MessageEvent<WorkerCommand>) => {
  const cmd = e.data;

  switch (cmd.type) {
    case 'start_train': {
      // エージェント作成（追加学習対応: 既存なら再利用）
      if (!agent) {
        agent = new DQNAgent({
          obsDim: MazeEnv.OBS_DIM,
          lr: cmd.hp.lr,
          gamma: cmd.hp.gamma,
          epsilonEnd: cmd.hp.epsilonEnd,
          epsilonDecayEpisodes: cmd.hp.epsilonDecayEpisodes,
        });
      }

      abortController = new AbortController();

      // MazeConfig[] を直接渡す（trainer 内で並列環境を生成）
      await runTraining(agent, cmd.mazes, send, {
        maxEpisodes: cmd.hp.maxEpisodes,
        revisitPenalty: cmd.hp.revisitPenalty,
        abortSignal: abortController.signal,
      });
      break;
    }

    case 'start_test': {
      if (!agent) {
        send({ type: 'error', message: '先に学習を実行してください' });
        return;
      }

      abortController = new AbortController();

      await runTests(
        agent,
        cmd.numRows,
        cmd.numCols,
        cmd.numTests,
        send,
        abortController.signal,
      );
      break;
    }

    case 'play': {
      if (!agent) {
        send({ type: 'error', message: '先に学習を実行してください' });
        return;
      }

      abortController = new AbortController();

      await runPlayground(
        agent,
        cmd.maze,
        send,
        abortController.signal,
      );
      break;
    }

    case 'stop':
      abortController?.abort();
      break;

    case 'reset':
      abortController?.abort();
      if (agent) {
        agent.dispose();
        agent = null;
      }
      break;
  }
};
