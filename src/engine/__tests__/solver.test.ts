import { describe, it, expect } from 'vitest';
import { bfsShortestPath, validateMaze, generateRandomMaze } from '../solver';

describe('bfsShortestPath', () => {
  it('壁なしの3x3でゴールに到達できる', () => {
    const result = bfsShortestPath(3, 3, new Set(), [0, 0], [2, 2]);
    expect(result.length).toBe(4); // Manhattan distance
    expect(result.path).not.toBeNull();
    expect(result.path![0]).toEqual([0, 0]);
    expect(result.path![result.path!.length - 1]).toEqual([2, 2]);
  });

  it('壁で完全にブロックされると到達不能', () => {
    // 1行目を壁で塞ぐ
    const walls = new Set(['1,0', '1,1', '1,2']);
    const result = bfsShortestPath(3, 3, walls, [0, 0], [2, 2]);
    expect(result.length).toBeNull();
    expect(result.path).toBeNull();
  });

  it('start === goal の場合 length=0', () => {
    const result = bfsShortestPath(3, 3, new Set(), [1, 1], [1, 1]);
    expect(result.length).toBe(0);
    expect(result.path).toEqual([[1, 1]]);
  });

  it('startが壁上にあると到達不能', () => {
    const walls = new Set(['0,0']);
    const result = bfsShortestPath(3, 3, walls, [0, 0], [2, 2]);
    expect(result.length).toBeNull();
  });

  it('goalが壁上にあると到達不能', () => {
    const walls = new Set(['2,2']);
    const result = bfsShortestPath(3, 3, walls, [0, 0], [2, 2]);
    expect(result.length).toBeNull();
  });

  it('迂回路がある場合に最短経路を返す', () => {
    // 中央を壁で塞ぎ、迂回させる
    const walls = new Set(['1,1']);
    const result = bfsShortestPath(3, 3, walls, [0, 0], [2, 2]);
    expect(result.length).toBe(4);
    expect(result.path).not.toBeNull();
  });
});

describe('validateMaze', () => {
  it('正常な迷路はvalid', () => {
    const result = validateMaze({
      num_rows: 3,
      num_cols: 3,
      walls: [],
      start: [0, 0],
      goal: [2, 2],
    });
    expect(result.valid).toBe(true);
    expect(result.shortestPathLength).toBe(4);
  });

  it('到達不能な迷路はinvalid', () => {
    const result = validateMaze({
      num_rows: 3,
      num_cols: 3,
      walls: [[1, 0], [1, 1], [1, 2]],
      start: [0, 0],
      goal: [2, 2],
    });
    expect(result.valid).toBe(false);
  });

  it('startに壁があるとinvalid', () => {
    const result = validateMaze({
      num_rows: 3,
      num_cols: 3,
      walls: [[0, 0]],
      start: [0, 0],
      goal: [2, 2],
    });
    expect(result.valid).toBe(false);
    expect(result.message).toContain('スタート');
  });

  it('goalに壁があるとinvalid', () => {
    const result = validateMaze({
      num_rows: 3,
      num_cols: 3,
      walls: [[2, 2]],
      start: [0, 0],
      goal: [2, 2],
    });
    expect(result.valid).toBe(false);
    expect(result.message).toContain('ゴール');
  });
});

describe('generateRandomMaze', () => {
  for (const size of [5, 10, 15]) {
    it(`${size}x${size}の迷路を生成しBFSで到達可能`, () => {
      const maze = generateRandomMaze(size, size);
      const wallSet = new Set(maze.walls.map(([r, c]) => `${r},${c}`));
      const result = bfsShortestPath(size, size, wallSet, maze.start, maze.goal);
      expect(result.length).not.toBeNull();
    });
  }

  it('ランダムエンドポイントでも到達可能', () => {
    const maze = generateRandomMaze(10, 10, { randomEndpoints: true });
    const wallSet = new Set(maze.walls.map(([r, c]) => `${r},${c}`));
    const result = bfsShortestPath(10, 10, wallSet, maze.start, maze.goal);
    expect(result.length).not.toBeNull();
  });
});
