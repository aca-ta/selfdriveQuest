/**
 * MazeEnv: 壁ベースのGridWorld環境。
 * エージェントは局所5×5の観測とゴールへの相対方向を受け取る。
 * gymnasium非依存の純TypeScript実装。
 */
export class MazeEnv {
  static readonly OBS_VIEW_SIZE = 5;
  static readonly OBS_CHANNELS = 3;
  static readonly OBS_DIM = MazeEnv.OBS_VIEW_SIZE * MazeEnv.OBS_VIEW_SIZE * MazeEnv.OBS_CHANNELS + 2; // 77

  readonly numRows: number;
  readonly numCols: number;
  readonly walls: Set<string>;
  readonly start: [number, number];
  readonly goal: [number, number];
  readonly revisitPenalty: number;

  private _agentPos: [number, number];
  private _prevPos: [number, number] | null = null;
  private _visited: Set<string>;

  // 行動: 0=上, 1=右, 2=下, 3=左
  private static readonly DELTAS: [number, number][] = [[-1, 0], [0, 1], [1, 0], [0, -1]];

  constructor(config: {
    numRows: number;
    numCols: number;
    walls: [number, number][];
    start?: [number, number];
    goal?: [number, number];
    revisitPenalty?: number;
  }) {
    this.numRows = config.numRows;
    this.numCols = config.numCols;
    this.walls = new Set(config.walls.map(([r, c]) => `${r},${c}`));
    this.start = config.start ?? [0, 0];
    this.goal = config.goal ?? [config.numRows - 1, config.numCols - 1];
    this.revisitPenalty = config.revisitPenalty ?? 0.05;
    this._agentPos = [...this.start];
    this._visited = new Set([`${this.start[0]},${this.start[1]}`]);
  }

  private _getObs(): Float32Array {
    const [r, c] = this._agentPos;
    const half = Math.floor(MazeEnv.OBS_VIEW_SIZE / 2); // 2
    const view = new Float32Array(MazeEnv.OBS_VIEW_SIZE * MazeEnv.OBS_VIEW_SIZE * MazeEnv.OBS_CHANNELS);

    for (let dr = -half; dr <= half; dr++) {
      for (let dc = -half; dc <= half; dc++) {
        const vr = dr + half;
        const vc = dc + half;
        const gr = r + dr;
        const gc = c + dc;

        const baseIdx = (vr * MazeEnv.OBS_VIEW_SIZE + vc) * MazeEnv.OBS_CHANNELS;

        // ch0: 壁/境界外
        if (gr < 0 || gr >= this.numRows || gc < 0 || gc >= this.numCols) {
          view[baseIdx] = 1.0;
        } else if (this.walls.has(`${gr},${gc}`)) {
          view[baseIdx] = 1.0;
        }

        // ch1: ゴール
        if (gr === this.goal[0] && gc === this.goal[1]) {
          view[baseIdx + 1] = 1.0;
        }

        // ch2: 訪問済み
        if (this._visited.has(`${gr},${gc}`)) {
          view[baseIdx + 2] = 1.0;
        }
      }
    }

    // ゴールへの正規化相対方向
    const dx = Math.max(-1, Math.min(1, (this.goal[1] - c) / Math.max(this.numCols, 1)));
    const dy = Math.max(-1, Math.min(1, (this.goal[0] - r) / Math.max(this.numRows, 1)));

    const obs = new Float32Array(MazeEnv.OBS_DIM);
    obs.set(view);
    obs[MazeEnv.OBS_DIM - 2] = dx;
    obs[MazeEnv.OBS_DIM - 1] = dy;
    return obs;
  }

  reset(): Float32Array {
    this._agentPos = [...this.start];
    this._prevPos = null;
    this._visited = new Set([`${this.start[0]},${this.start[1]}`]);
    return this._getObs();
  }

  step(action: number): { obs: Float32Array; reward: number; terminated: boolean } {
    const [r, c] = this._agentPos;
    const [dr, dc] = MazeEnv.DELTAS[action];
    let newR = r + dr;
    let newC = c + dc;

    // 境界チェック
    if (newR < 0 || newR >= this.numRows || newC < 0 || newC >= this.numCols) {
      newR = r;
      newC = c;
    }

    // 壁チェック
    if (this.walls.has(`${newR},${newC}`)) {
      newR = r;
      newC = c;
    }

    const newPos: [number, number] = [newR, newC];
    const oldPos: [number, number] = [this._agentPos[0], this._agentPos[1]];
    this._agentPos = newPos;

    // 報酬計算
    // 壁衝突(-0.6) > 逆走(-0.2) にすることで「動けないより引き返す」を学習させる
    const terminated = newPos[0] === this.goal[0] && newPos[1] === this.goal[1];
    let reward: number;
    if (terminated) {
      reward = 1.0;
    } else if (newPos[0] === oldPos[0] && newPos[1] === oldPos[1]) {
      reward = -0.6; // 壁/境界衝突（停滞を強く罰す）
    } else if (this._prevPos && newPos[0] === this._prevPos[0] && newPos[1] === this._prevPos[1]) {
      reward = -0.2; // 逆走（引き返しを許容する）
    } else if (this._visited.has(`${newPos[0]},${newPos[1]}`)) {
      reward = -this.revisitPenalty; // 再訪問
    } else {
      reward = -0.01; // 通常歩行
    }

    this._prevPos = oldPos;
    this._visited.add(`${newPos[0]},${newPos[1]}`);

    return { obs: this._getObs(), reward, terminated };
  }

  get agentPos(): [number, number] {
    return [this._agentPos[0], this._agentPos[1]];
  }
}
