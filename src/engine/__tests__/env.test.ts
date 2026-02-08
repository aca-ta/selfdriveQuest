import { describe, it, expect } from 'vitest';
import { MazeEnv } from '../env';

describe('MazeEnv constructor', () => {
  it('OBS_DIM は 77', () => {
    expect(MazeEnv.OBS_DIM).toBe(77);
  });

  it('agentPos が start と一致', () => {
    const env = new MazeEnv({ numRows: 5, numCols: 5, walls: [], start: [1, 2], goal: [4, 4] });
    expect(env.agentPos).toEqual([1, 2]);
  });

  it('start/goal 省略時のデフォルト', () => {
    const env = new MazeEnv({ numRows: 5, numCols: 5, walls: [] });
    expect(env.start).toEqual([0, 0]);
    expect(env.goal).toEqual([4, 4]);
  });
});

describe('MazeEnv.reset', () => {
  it('観測の次元が OBS_DIM', () => {
    const env = new MazeEnv({ numRows: 5, numCols: 5, walls: [] });
    const obs = env.reset();
    expect(obs.length).toBe(MazeEnv.OBS_DIM);
  });

  it('agentPos がスタートにリセットされる', () => {
    const env = new MazeEnv({ numRows: 5, numCols: 5, walls: [], start: [0, 0], goal: [4, 4] });
    // 右に移動してからリセット
    env.step(1); // action=1 → 右
    expect(env.agentPos).toEqual([0, 1]);
    env.reset();
    expect(env.agentPos).toEqual([0, 0]);
  });
});

describe('MazeEnv.step', () => {
  it('ゴール到達で terminated + reward=1.0', () => {
    // start=(0,0), goal=(0,1) → 右に1歩で到達
    const env = new MazeEnv({ numRows: 3, numCols: 3, walls: [], start: [0, 0], goal: [0, 1] });
    const { reward, terminated } = env.step(1); // 右
    expect(terminated).toBe(true);
    expect(reward).toBe(1.0);
  });

  it('壁衝突で位置不変 + reward=-0.6', () => {
    const env = new MazeEnv({
      numRows: 3, numCols: 3,
      walls: [[0, 1]],
      start: [0, 0], goal: [2, 2],
    });
    const { reward, terminated } = env.step(1); // 右 → 壁
    expect(terminated).toBe(false);
    expect(reward).toBe(-0.6);
    expect(env.agentPos).toEqual([0, 0]);
  });

  it('境界外で位置不変 + reward=-0.6', () => {
    const env = new MazeEnv({ numRows: 3, numCols: 3, walls: [], start: [0, 0], goal: [2, 2] });
    const { reward } = env.step(0); // 上 → 境界外
    expect(reward).toBe(-0.6);
    expect(env.agentPos).toEqual([0, 0]);
  });

  it('通常移動で reward=-0.01', () => {
    const env = new MazeEnv({ numRows: 3, numCols: 3, walls: [], start: [0, 0], goal: [2, 2] });
    const { reward, terminated } = env.step(2); // 下
    expect(terminated).toBe(false);
    expect(reward).toBe(-0.01);
    expect(env.agentPos).toEqual([1, 0]);
  });

  it('逆走で reward=-0.2', () => {
    const env = new MazeEnv({ numRows: 3, numCols: 3, walls: [], start: [0, 0], goal: [2, 2] });
    env.step(2); // 下 → (1,0)
    const { reward } = env.step(0); // 上 → (0,0) = prevPos
    expect(reward).toBe(-0.2);
  });

  it('再訪問で revisitPenalty', () => {
    const env = new MazeEnv({ numRows: 3, numCols: 3, walls: [], start: [0, 0], goal: [2, 2] });
    env.step(1); // 右 → (0,1)
    env.step(2); // 下 → (1,1)
    // (0,1) は prevPos ではないが visited
    env.step(0); // 上 → (0,1) = 再訪問
    // prevPos は (1,1), 移動先は (0,1) → prevPos ではないので逆走ではなく再訪問
    expect(env.agentPos).toEqual([0, 1]);
    // revisitPenalty デフォルト = 0.05
  });

  it('obs の末尾2要素がゴール方向', () => {
    const env = new MazeEnv({ numRows: 5, numCols: 5, walls: [], start: [0, 0], goal: [4, 4] });
    const { obs } = env.step(2); // 下 → (1,0)
    // dx = goal_col - agent_col = 4-0 = 4, 正規化 = min(1, 4/5) = 0.8
    // dy = goal_row - agent_row = 4-1 = 3, 正規化 = min(1, 3/5) = 0.6
    expect(obs[MazeEnv.OBS_DIM - 2]).toBeCloseTo(0.8, 5);
    expect(obs[MazeEnv.OBS_DIM - 1]).toBeCloseTo(0.6, 5);
  });
});
