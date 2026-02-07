import * as tf from '@tensorflow/tfjs';
import { MazeEnv } from './env';

function createQNetwork(obsDim: number, nActions: number): tf.Sequential {
  return tf.sequential({
    layers: [
      tf.layers.dense({ units: 128, activation: 'relu', inputShape: [obsDim] }),
      tf.layers.dense({ units: 128, activation: 'relu' }),
      tf.layers.dense({ units: nActions }),
    ],
  });
}

class ReplayBuffer {
  private buffer: { obs: Float32Array; action: number; reward: number; nextObs: Float32Array; done: boolean }[];
  private capacity: number;
  private pos: number = 0;
  private full: boolean = false;

  constructor(capacity: number = 10_000) {
    this.capacity = capacity;
    this.buffer = [];
  }

  push(obs: Float32Array, action: number, reward: number, nextObs: Float32Array, done: boolean): void {
    const entry = { obs: new Float32Array(obs), action, reward, nextObs: new Float32Array(nextObs), done };
    if (!this.full) {
      this.buffer.push(entry);
      if (this.buffer.length === this.capacity) this.full = true;
    } else {
      this.buffer[this.pos] = entry;
    }
    this.pos = (this.pos + 1) % this.capacity;
  }

  /** バッチを連結済みの型付き配列として返す (テンソル作成を高速化) */
  sampleFlat(batchSize: number, obsDim: number): {
    obs: Float32Array; actions: Int32Array; rewards: Float32Array;
    nextObs: Float32Array; dones: Float32Array;
  } {
    const len = this.size;
    const obs = new Float32Array(batchSize * obsDim);
    const nextObs = new Float32Array(batchSize * obsDim);
    const actions = new Int32Array(batchSize);
    const rewards = new Float32Array(batchSize);
    const dones = new Float32Array(batchSize);

    for (let i = 0; i < batchSize; i++) {
      const idx = Math.floor(Math.random() * len);
      const e = this.buffer[idx];
      obs.set(e.obs, i * obsDim);
      nextObs.set(e.nextObs, i * obsDim);
      actions[i] = e.action;
      rewards[i] = e.reward;
      dones[i] = e.done ? 1.0 : 0.0;
    }
    return { obs, actions, rewards, nextObs, dones };
  }

  get size(): number {
    return this.full ? this.capacity : this.buffer.length;
  }
}

export class DQNAgent {
  private policyNet: tf.Sequential;
  private targetNet: tf.Sequential;
  private optimizer: tf.AdamOptimizer;
  private replayBuffer: ReplayBuffer;

  readonly nActions: number;
  private obsDim: number;
  private gamma: number;
  epsilon: number;
  private epsilonStart: number;
  private epsilonEnd: number;
  private epsilonDecayEpisodes: number;
  private batchSize: number;
  private tau: number;
  private episodeCount: number = 0;

  constructor(params: {
    obsDim?: number;
    nActions?: number;
    lr?: number;
    gamma?: number;
    epsilonStart?: number;
    epsilonEnd?: number;
    epsilonDecayEpisodes?: number;
    bufferSize?: number;
    batchSize?: number;
    tau?: number;
  } = {}) {
    this.obsDim = params.obsDim ?? 77;
    this.nActions = params.nActions ?? 4;
    const lr = params.lr ?? 0.001;
    this.gamma = params.gamma ?? 0.99;
    this.epsilon = params.epsilonStart ?? 1.0;
    this.epsilonStart = params.epsilonStart ?? 1.0;
    this.epsilonEnd = params.epsilonEnd ?? 0.05;
    this.epsilonDecayEpisodes = params.epsilonDecayEpisodes ?? 200;
    this.batchSize = params.batchSize ?? 64;
    this.tau = params.tau ?? 0.01;

    this.policyNet = createQNetwork(this.obsDim, this.nActions);
    this.targetNet = createQNetwork(this.obsDim, this.nActions);
    this.targetNet.setWeights(this.policyNet.getWeights().map(w => w.clone()));

    this.optimizer = tf.train.adam(lr);
    this.replayBuffer = new ReplayBuffer(params.bufferSize ?? 10_000);
  }

  chooseAction(obs: Float32Array): number {
    if (Math.random() < this.epsilon) {
      return Math.floor(Math.random() * this.nActions);
    }
    return tf.tidy(() => {
      const input = tf.tensor2d(obs, [1, this.obsDim]);
      const qVals = this.policyNet.predict(input) as tf.Tensor;
      return qVals.argMax(1).dataSync()[0];
    });
  }

  /** N個の観測をバッチ推論して epsilon-greedy で行動を返す */
  chooseActionBatch(obsBatch: Float32Array, n: number): Int32Array {
    const greedyActions = tf.tidy(() => {
      const input = tf.tensor2d(obsBatch, [n, this.obsDim]);
      const qVals = this.policyNet.predict(input) as tf.Tensor;
      return qVals.argMax(1).dataSync();
    });

    const result = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      result[i] = Math.random() < this.epsilon
        ? Math.floor(Math.random() * this.nActions)
        : greedyActions[i];
    }
    return result;
  }

  greedyAction(obs: Float32Array): number {
    return tf.tidy(() => {
      const input = tf.tensor2d(obs, [1, this.obsDim]);
      const qVals = this.policyNet.predict(input) as tf.Tensor;
      return qVals.argMax(1).dataSync()[0];
    });
  }

  greedyActionWithQ(obs: Float32Array): { action: number; qValues: number[] } {
    return tf.tidy(() => {
      const input = tf.tensor2d(obs, [1, this.obsDim]);
      const qVals = this.policyNet.predict(input) as tf.Tensor;
      const data = qVals.dataSync();
      let bestIdx = 0;
      for (let i = 1; i < data.length; i++) {
        if (data[i] > data[bestIdx]) bestIdx = i;
      }
      return { action: bestIdx, qValues: Array.from(data) };
    });
  }

  storeTransition(obs: Float32Array, action: number, reward: number, nextObs: Float32Array, done: boolean): void {
    this.replayBuffer.push(obs, action, reward, nextObs, done);
  }

  /** バッチ学習。soft update は含まない (呼び出し元で明示的に呼ぶ) */
  learn(): number | null {
    if (this.replayBuffer.size < this.batchSize) return null;

    const batch = this.replayBuffer.sampleFlat(this.batchSize, this.obsDim);

    // Float32Array から直接テンソル作成 (Array.from 不要)
    const obsTensor = tf.tensor2d(batch.obs, [this.batchSize, this.obsDim]);
    const nextObsTensor = tf.tensor2d(batch.nextObs, [this.batchSize, this.obsDim]);
    const actionsTensor = tf.tensor1d(batch.actions, 'int32');
    const rewardsTensor = tf.tensor1d(batch.rewards);
    const donesTensor = tf.tensor1d(batch.dones);

    const targetQ = tf.tidy(() => {
      const nextQ = this.targetNet.predict(nextObsTensor) as tf.Tensor;
      const maxNextQ = nextQ.max(1);
      return rewardsTensor.add(
        maxNextQ.mul(tf.scalar(1.0).sub(donesTensor)).mul(tf.scalar(this.gamma))
      );
    });

    const lossValue = this.optimizer.minimize(() => {
      const q = this.policyNet.apply(obsTensor) as tf.Tensor2D;
      const oneHot = tf.oneHot(actionsTensor, this.nActions);
      const actionQ = q.mul(oneHot).sum(1);
      return tf.losses.meanSquaredError(targetQ, actionQ) as tf.Scalar;
    }, true) as tf.Scalar;

    const loss = lossValue.dataSync()[0];

    obsTensor.dispose();
    nextObsTensor.dispose();
    actionsTensor.dispose();
    rewardsTensor.dispose();
    donesTensor.dispose();
    targetQ.dispose();
    lossValue.dispose();

    return loss;
  }

  /** Target networkの soft update。エピソード終了時に呼ぶ。 */
  softUpdate(): void {
    const policyWeights = this.policyNet.getWeights();
    const targetWeights = this.targetNet.getWeights();
    const tau = this.tau;
    const updated = policyWeights.map((pw, i) => {
      const tw = targetWeights[i];
      const newW = tf.tidy(() => pw.mul(tau).add(tw.mul(1 - tau)));
      return newW;
    });
    this.targetNet.setWeights(updated);
    // setWeights は内部でコピーするので、ここで dispose
    updated.forEach(t => t.dispose());
  }

  decayEpsilon(): void {
    this.episodeCount++;
    const fraction = Math.min(this.episodeCount / this.epsilonDecayEpisodes, 1.0);
    this.epsilon = this.epsilonStart + fraction * (this.epsilonEnd - this.epsilonStart);
  }

  greedyPath(env: MazeEnv): [number, number][] {
    let obs = env.reset();
    const path: [number, number][] = [env.agentPos];
    const maxSteps = env.numRows * env.numCols * 2;
    const visitCounts = new Map<string, number>();
    visitCounts.set(`${env.agentPos[0]},${env.agentPos[1]}`, 1);

    for (let i = 0; i < maxSteps; i++) {
      const action = this.greedyAction(obs);
      const result = env.step(action);
      obs = result.obs;
      const pos = env.agentPos;
      path.push(pos);

      const key = `${pos[0]},${pos[1]}`;
      const count = (visitCounts.get(key) ?? 0) + 1;
      visitCounts.set(key, count);

      if (result.terminated || count >= 10) break;
    }
    return path;
  }

  dispose(): void {
    this.policyNet.dispose();
    this.targetNet.dispose();
  }
}
