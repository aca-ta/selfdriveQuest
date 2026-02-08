import { useState, useCallback, useEffect } from 'react';
import type { MazeData, MazeConfig, SavedCourseSet } from '../types';
import { generateRandomMaze } from '../engine/solver';

const COURSE_STORAGE_KEY = 'selfdrive-quest-courses';

export function loadAllCourseSets(): SavedCourseSet[] {
  try {
    const raw = localStorage.getItem(COURSE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveCourseSetsToStorage(sets: SavedCourseSet[]) {
  localStorage.setItem(COURSE_STORAGE_KEY, JSON.stringify(sets));
}

let nextId = 1;

function createEmptyMaze(
  start: [number, number] = [0, 0],
  goal: [number, number] = [0, 0],
): MazeData {
  return { id: nextId++, roads: new Set(), start, goal };
}

function wallsToRoads(
  walls: [number, number][],
  rows: number,
  cols: number,
  start: [number, number] = [0, 0],
  goal: [number, number] | null = null,
): Set<string> {
  const g = goal ?? [rows - 1, cols - 1];
  const wallSet = new Set(walls.map(([r, c]) => `${r},${c}`));
  const roads = new Set<string>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === start[0] && c === start[1]) continue;
      if (r === g[0] && c === g[1]) continue;
      if (!wallSet.has(`${r},${c}`)) {
        roads.add(`${r},${c}`);
      }
    }
  }
  return roads;
}

export function useMaze(initialRows = 5, initialCols = 5) {
  const [gridSize, setGridSize] = useState({ rows: initialRows, cols: initialCols });
  const defaultGoal: [number, number] = [initialRows - 1, initialCols - 1];
  const INITIAL_COURSE_COUNT = 3;
  const [mazes, setMazes] = useState<MazeData[]>(
    Array.from({ length: INITIAL_COURSE_COUNT }, () => createEmptyMaze([0, 0], defaultGoal)),
  );
  const [activeMazeIdx, setActiveMazeIdx] = useState(0);

  // 指定コースをランダムコースに差し替え
  const loadRandomMaze = useCallback((rows: number, cols: number, idx: number) => {
    const data = generateRandomMaze(rows, cols, { randomEndpoints: true });
    const roads = wallsToRoads(data.walls, rows, cols, data.start, data.goal);
    const start: [number, number] = data.start ?? [0, 0];
    const goal: [number, number] = data.goal ?? [rows - 1, cols - 1];
    setMazes(prev => {
      const updated = [...prev];
      if (updated[idx]) {
        updated[idx] = { ...updated[idx], roads, start, goal };
      }
      return updated;
    });
  }, []);

  // 初回読み込み時に全コースをランダム生成
  useEffect(() => {
    for (let i = 0; i < INITIAL_COURSE_COUNT; i++) {
      loadRandomMaze(initialRows, initialCols, i);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeMaze = mazes[activeMazeIdx] ?? mazes[0];

  const toggleRoad = useCallback((row: number, col: number) => {
    setMazes(prev => {
      const updated = [...prev];
      const maze = { ...updated[activeMazeIdx ?? 0], roads: new Set(updated[activeMazeIdx ?? 0].roads) };
      const key = `${row},${col}`;
      if (maze.roads.has(key)) {
        maze.roads.delete(key);
      } else {
        maze.roads.add(key);
      }
      updated[activeMazeIdx ?? 0] = maze;
      return updated;
    });
  }, [activeMazeIdx]);

  const setRoad = useCallback((row: number, col: number, isRoad: boolean) => {
    setMazes(prev => {
      const updated = [...prev];
      const maze = { ...updated[activeMazeIdx ?? 0], roads: new Set(updated[activeMazeIdx ?? 0].roads) };
      const key = `${row},${col}`;
      if (isRoad) {
        maze.roads.add(key);
      } else {
        maze.roads.delete(key);
      }
      updated[activeMazeIdx ?? 0] = maze;
      return updated;
    });
  }, [activeMazeIdx]);

  const regenerateActiveMaze = useCallback(() => {
    loadRandomMaze(gridSize.rows, gridSize.cols, activeMazeIdx);
  }, [gridSize, activeMazeIdx, loadRandomMaze]);

  const addMaze = useCallback(() => {
    const newIdx = mazes.length;
    const goal: [number, number] = [gridSize.rows - 1, gridSize.cols - 1];
    setMazes(prev => [...prev, createEmptyMaze([0, 0], goal)]);
    setActiveMazeIdx(newIdx);
    loadRandomMaze(gridSize.rows, gridSize.cols, newIdx);
  }, [mazes.length, gridSize, loadRandomMaze]);

  const addEmptyMaze = useCallback(() => {
    const newIdx = mazes.length;
    const goal: [number, number] = [gridSize.rows - 1, gridSize.cols - 1];
    setMazes(prev => [...prev, createEmptyMaze([0, 0], goal)]);
    setActiveMazeIdx(newIdx);
  }, [mazes.length, gridSize]);

  const removeMaze = useCallback((idx: number) => {
    if (mazes.length <= 1) return;
    setMazes(prev => prev.filter((_, i) => i !== idx));
    setActiveMazeIdx(prev => Math.min(prev, mazes.length - 2));
  }, [mazes.length]);

  const removeLastMaze = useCallback(() => {
    if (mazes.length <= 1) return;
    setMazes(prev => prev.slice(0, -1));
    setActiveMazeIdx(prev => Math.min(prev, mazes.length - 2));
  }, [mazes.length]);

  const removeAllMazes = useCallback(() => {
    const goal: [number, number] = [gridSize.rows - 1, gridSize.cols - 1];
    setMazes([createEmptyMaze([0, 0], goal)]);
    setActiveMazeIdx(0);
    loadRandomMaze(gridSize.rows, gridSize.cols, 0);
  }, [gridSize, loadRandomMaze]);

  const setStart = useCallback((row: number, col: number) => {
    setMazes(prev => {
      const updated = [...prev];
      updated[activeMazeIdx] = { ...updated[activeMazeIdx], start: [row, col] };
      return updated;
    });
  }, [activeMazeIdx]);

  const setGoal = useCallback((row: number, col: number) => {
    setMazes(prev => {
      const updated = [...prev];
      updated[activeMazeIdx] = { ...updated[activeMazeIdx], goal: [row, col] };
      return updated;
    });
  }, [activeMazeIdx]);

  const clearRoads = useCallback(() => {
    setMazes(prev => {
      const updated = [...prev];
      updated[activeMazeIdx] = { ...updated[activeMazeIdx], roads: new Set() };
      return updated;
    });
  }, [activeMazeIdx]);

  const changeGridSize = useCallback((rows: number, cols: number) => {
    setGridSize({ rows, cols });
    const goal: [number, number] = [rows - 1, cols - 1];
    setMazes(Array.from({ length: INITIAL_COURSE_COUNT }, () => createEmptyMaze([0, 0], goal)));
    setActiveMazeIdx(0);
    for (let i = 0; i < INITIAL_COURSE_COUNT; i++) {
      loadRandomMaze(rows, cols, i);
    }
  }, [loadRandomMaze]);

  const loadMazesFromConfigs = useCallback((configs: MazeConfig[], newGridSize: { rows: number; cols: number }) => {
    setGridSize(newGridSize);
    setMazes(configs.map(cfg => ({
      id: nextId++,
      roads: wallsToRoads(cfg.walls, cfg.num_rows, cfg.num_cols, cfg.start, cfg.goal),
      start: cfg.start,
      goal: cfg.goal,
    })));
    setActiveMazeIdx(0);
  }, []);

  // roads → walls 変換: 道路でもstart/goalでもないセルが全て壁
  const getMazeConfigs = useCallback((): MazeConfig[] => {
    const { rows, cols } = gridSize;
    return mazes.map(m => {
      const walls: [number, number][] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (r === m.start[0] && c === m.start[1]) continue;
          if (r === m.goal[0] && c === m.goal[1]) continue;
          if (!m.roads.has(`${r},${c}`)) {
            walls.push([r, c]);
          }
        }
      }
      return { num_rows: rows, num_cols: cols, walls, start: m.start, goal: m.goal };
    });
  }, [mazes, gridSize]);

  const getActiveMazeConfig = useCallback((): MazeConfig => {
    const { rows, cols } = gridSize;
    const m = activeMaze;
    const walls: [number, number][] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (r === m.start[0] && c === m.start[1]) continue;
        if (r === m.goal[0] && c === m.goal[1]) continue;
        if (!m.roads.has(`${r},${c}`)) {
          walls.push([r, c]);
        }
      }
    }
    return { num_rows: rows, num_cols: cols, walls, start: m.start, goal: m.goal };
  }, [activeMaze, gridSize]);

  const loadSingleMazeConfig = useCallback((cfg: MazeConfig) => {
    const newGridSize = { rows: cfg.num_rows, cols: cfg.num_cols };
    setGridSize(newGridSize);
    setMazes([{
      id: nextId++,
      roads: wallsToRoads(cfg.walls, cfg.num_rows, cfg.num_cols, cfg.start, cfg.goal),
      start: cfg.start,
      goal: cfg.goal,
    }]);
    setActiveMazeIdx(0);
  }, []);

  return {
    gridSize,
    mazes,
    activeMaze,
    activeMazeIdx,
    setActiveMazeIdx,
    toggleRoad,
    setRoad,
    setStart,
    setGoal,
    regenerateActiveMaze,
    addMaze,
    addEmptyMaze,
    removeMaze,
    removeLastMaze,
    removeAllMazes,
    clearRoads,
    changeGridSize,
    getMazeConfigs,
    getActiveMazeConfig,
    loadMazesFromConfigs,
    loadSingleMazeConfig,
  };
}
