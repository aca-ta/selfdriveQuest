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
import { resolveAgent } from './agentManager';
import type { MazeConfig, HyperParams, WsServerMessage, SaveSlotInfo } from '../types';

// Worker には DOM がないので CPU バックエンドを明示的に使用
tf.setBackend('cpu');

let agent: DQNAgent | null = null;
let abortController: AbortController | null = null;

/** メインスレッドに WsServerMessage を送信 */
function send(msg: WsServerMessage): void {
  self.postMessage(msg);
}

// ─── IndexedDB メタ情報ヘルパー ───

const META_DB_NAME = 'selfdrive-quest-meta';
const META_STORE = 'slots';

function openMetaDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(META_DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(META_STORE, { keyPath: 'slot' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveMeta(info: SaveSlotInfo): Promise<void> {
  const db = await openMetaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite');
    tx.objectStore(META_STORE).put(info);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function loadAllMeta(): Promise<SaveSlotInfo[]> {
  const db = await openMetaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readonly');
    const req = tx.objectStore(META_STORE).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result as SaveSlotInfo[]); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function loadMeta(slot: number): Promise<SaveSlotInfo | null> {
  const db = await openMetaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readonly');
    const req = tx.objectStore(META_STORE).get(slot);
    req.onsuccess = () => { db.close(); resolve(req.result as SaveSlotInfo | null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function deleteMeta(slot: number): Promise<void> {
  const db = await openMetaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite');
    tx.objectStore(META_STORE).delete(slot);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

function modelKey(slot: number): string {
  return `selfdrive-quest-slot-${slot}`;
}

// ─── コマンド定義 ───

interface StartTrainCommand {
  type: 'start_train';
  mazes: MazeConfig[];
  hp: HyperParams;
  fresh?: boolean;
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

interface SaveModelCommand {
  type: 'save_model';
  slot: number;
  log?: Omit<import('../types').SaveSlotInfo, 'slot' | 'savedAt'>;
}

interface LoadModelCommand {
  type: 'load_model';
  slot: number;
}

interface DeleteModelCommand {
  type: 'delete_model';
  slot: number;
}

interface CopyModelCommand {
  type: 'copy_model';
  fromSlot: number;
  toSlot: number;
}

interface ListModelsCommand {
  type: 'list_models';
}

type WorkerCommand = StartTrainCommand | StartTestCommand | PlayCommand | StopCommand | ResetCommand | SaveModelCommand | LoadModelCommand | DeleteModelCommand | CopyModelCommand | ListModelsCommand;

self.onmessage = async (e: MessageEvent<WorkerCommand>) => {
  const cmd = e.data;

  switch (cmd.type) {
    case 'start_train': {
      const isAdditional = !cmd.fresh && agent !== null;
      const gridArea = cmd.mazes[0].num_rows * cmd.mazes[0].num_cols;
      const bufferSize = Math.max(50_000, Math.min(gridArea * 1000, 150_000));
      agent = resolveAgent(agent, cmd.fresh, () => new DQNAgent({
        obsDim: MazeEnv.OBS_DIM,
        lr: cmd.hp.lr,
        gamma: cmd.hp.gamma,
        epsilonEnd: cmd.hp.epsilonEnd,
        epsilonDecayEpisodes: cmd.hp.epsilonDecayEpisodes,
        bufferSize,
        hiddenSize: cmd.hp.hiddenSize,
      }));

      // 追加学習時はepsilonを中間値から再スタート（新コースでの探索を促進）
      if (isAdditional) {
        agent.resetExploration(0.4);
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

    case 'save_model': {
      if (!agent) {
        send({ type: 'error', message: '保存するモデルがありません' });
        return;
      }
      try {
        const key = modelKey(cmd.slot);
        await agent.saveModel(key);
        const savedAt = new Date().toISOString();
        const slotInfo: SaveSlotInfo = {
          slot: cmd.slot,
          savedAt,
          ...cmd.log,
        };
        await saveMeta(slotInfo);
        send({ type: 'model_saved', slotInfo });
      } catch (err) {
        send({ type: 'error', message: `保存に失敗しました: ${err}` });
      }
      break;
    }

    case 'load_model': {
      try {
        const key = modelKey(cmd.slot);
        const meta = await loadMeta(cmd.slot);
        const hiddenSize = meta?.hyperParams?.hiddenSize ?? 128;
        // hiddenSizeが異なる場合は再生成が必要
        if (agent) { agent.dispose(); agent = null; }
        agent = new DQNAgent({ obsDim: MazeEnv.OBS_DIM, hiddenSize });
        await agent.loadModel(key);
        send({ type: 'model_loaded', slot: cmd.slot, log: meta ?? undefined });
      } catch (err) {
        send({ type: 'error', message: `読み込みに失敗しました: ${err}` });
      }
      break;
    }

    case 'delete_model': {
      try {
        await tf.io.removeModel(`indexeddb://${modelKey(cmd.slot)}`);
      } catch { /* モデルが存在しなくても無視 */ }
      try {
        await deleteMeta(cmd.slot);
      } catch { /* ignore */ }
      send({ type: 'model_deleted', slot: cmd.slot });
      break;
    }

    case 'copy_model': {
      try {
        const srcKey = modelKey(cmd.fromSlot);
        const dstKey = modelKey(cmd.toSlot);
        // TF.js モデルウェイトをコピー
        await tf.io.copyModel(`indexeddb://${srcKey}`, `indexeddb://${dstKey}`);
        // メタデータをコピー（スロット番号と保存日時を更新）
        const srcMeta = await loadMeta(cmd.fromSlot);
        if (srcMeta) {
          const newMeta: SaveSlotInfo = {
            ...srcMeta,
            slot: cmd.toSlot,
            savedAt: new Date().toISOString(),
          };
          await saveMeta(newMeta);
          send({ type: 'model_saved', slotInfo: newMeta });
        }
      } catch (err) {
        send({ type: 'error', message: `コピーに失敗しました: ${err}` });
      }
      break;
    }

    case 'list_models': {
      try {
        const slots = await loadAllMeta();
        send({ type: 'model_list', slots });
      } catch {
        send({ type: 'model_list', slots: [] });
      }
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
