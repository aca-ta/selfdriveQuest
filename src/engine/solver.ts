import type { MazeConfig } from '../types';

const DELTAS: [number, number][] = [[-1, 0], [0, 1], [1, 0], [0, -1]];

function neighbors(r: number, c: number, numRows: number, numCols: number): [number, number][] {
  const result: [number, number][] = [];
  for (const [dr, dc] of DELTAS) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < numRows && nc >= 0 && nc < numCols) {
      result.push([nr, nc]);
    }
  }
  return result;
}

function key(r: number, c: number): string {
  return `${r},${c}`;
}

export function bfsShortestPath(
  numRows: number,
  numCols: number,
  walls: Set<string>,
  start: [number, number] = [0, 0],
  goal?: [number, number],
): { length: number | null; path: [number, number][] | null } {
  const g: [number, number] = goal ?? [numRows - 1, numCols - 1];

  if (walls.has(key(start[0], start[1])) || walls.has(key(g[0], g[1]))) {
    return { length: null, path: null };
  }

  const queue: { pos: [number, number]; path: [number, number][] }[] = [
    { pos: start, path: [start] },
  ];
  const visited = new Set<string>([key(start[0], start[1])]);
  let head = 0;

  while (head < queue.length) {
    const { pos: [r, c], path } = queue[head++];
    if (r === g[0] && c === g[1]) {
      return { length: path.length - 1, path };
    }
    for (const [nr, nc] of neighbors(r, c, numRows, numCols)) {
      const k = key(nr, nc);
      if (!walls.has(k) && !visited.has(k)) {
        visited.add(k);
        queue.push({ pos: [nr, nc], path: [...path, [nr, nc]] });
      }
    }
  }

  return { length: null, path: null };
}

function countRoadNeighbors(
  r: number, c: number, roads: Set<string>, numRows: number, numCols: number,
): number {
  let count = 0;
  for (const [nr, nc] of neighbors(r, c, numRows, numCols)) {
    if (roads.has(key(nr, nc))) count++;
  }
  return count;
}

function isIntersection(
  r: number, c: number, roads: Set<string>, numRows: number, numCols: number,
): boolean {
  return countRoadNeighbors(r, c, roads, numRows, numCols) >= 3;
}

function hasAdjacentIntersections(
  roads: Set<string>, numRows: number, numCols: number,
): boolean {
  const intersections = new Set<string>();
  for (const k of roads) {
    const [r, c] = k.split(',').map(Number);
    if (isIntersection(r, c, roads, numRows, numCols)) {
      intersections.add(k);
    }
  }
  for (const k of intersections) {
    const [r, c] = k.split(',').map(Number);
    for (const [nr, nc] of neighbors(r, c, numRows, numCols)) {
      if (intersections.has(key(nr, nc))) return true;
    }
  }
  return false;
}

function wouldCreate2x2Block(r: number, c: number, roads: Set<string>): boolean {
  const offsets: [number, number][] = [[-1, -1], [-1, 0], [0, -1], [0, 0]];
  for (const [dr, dc] of offsets) {
    let allRoad = true;
    for (let rr = 0; rr < 2; rr++) {
      for (let cc = 0; cc < 2; cc++) {
        const br = r + dr + rr;
        const bc = c + dc + cc;
        if (br === r && bc === c) continue;
        if (!roads.has(key(br, bc))) {
          allRoad = false;
          break;
        }
      }
      if (!allRoad) break;
    }
    if (allRoad) return true;
  }
  return false;
}

function wouldCreateAdjacentIntersections(
  r: number, c: number, roads: Set<string>, numRows: number, numCols: number,
): boolean {
  const testRoads = new Set(roads);
  testRoads.add(key(r, c));

  const cellsToCheck: [number, number][] = [[r, c]];
  for (const [nr, nc] of neighbors(r, c, numRows, numCols)) {
    if (testRoads.has(key(nr, nc))) cellsToCheck.push([nr, nc]);
  }

  for (const [cr, cc] of cellsToCheck) {
    if (isIntersection(cr, cc, testRoads, numRows, numCols)) {
      for (const [nr, nc] of neighbors(cr, cc, numRows, numCols)) {
        if (!(nr === cr && nc === cc) && testRoads.has(key(nr, nc)) &&
            isIntersection(nr, nc, testRoads, numRows, numCols)) {
          return true;
        }
      }
    }
  }
  return false;
}

function weightedRandomChoice<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRoadNetwork(
  numRows: number,
  numCols: number,
  start: [number, number] = [0, 0],
  goal?: [number, number],
): Set<string> | null {
  const g: [number, number] = goal ?? [numRows - 1, numCols - 1];
  const roads = new Set<string>([key(start[0], start[1]), key(g[0], g[1])]);

  // 1. メイン道路
  let pos: [number, number] = start;
  const visitedMain = new Set<string>([key(start[0], start[1])]);
  const maxMainSteps = numRows * numCols * 3;

  for (let i = 0; i < maxMainSteps; i++) {
    if (pos[0] === g[0] && pos[1] === g[1]) break;

    const candidates: [number, number][] = [];
    for (const [nr, nc] of neighbors(pos[0], pos[1], numRows, numCols)) {
      if (!visitedMain.has(key(nr, nc)) &&
          !wouldCreateAdjacentIntersections(nr, nc, roads, numRows, numCols) &&
          !wouldCreate2x2Block(nr, nc, roads)) {
        candidates.push([nr, nc]);
      }
    }

    if (candidates.length === 0) {
      const restartCandidates: [number, number][] = [];
      for (const k of roads) {
        const [rr, rc] = k.split(',').map(Number);
        for (const [nr, nc] of neighbors(rr, rc, numRows, numCols)) {
          if (!visitedMain.has(key(nr, nc)) &&
              !wouldCreateAdjacentIntersections(nr, nc, roads, numRows, numCols) &&
              !wouldCreate2x2Block(nr, nc, roads)) {
            restartCandidates.push([nr, nc]);
          }
        }
      }
      if (restartCandidates.length === 0) break;
      pos = randomChoice(restartCandidates);
      roads.add(key(pos[0], pos[1]));
      visitedMain.add(key(pos[0], pos[1]));
      continue;
    }

    // ゴール方向バイアス
    const weights = candidates.map(([nr, nc]) => {
      const dist = Math.abs(nr - g[0]) + Math.abs(nc - g[1]);
      return 1.0 / (dist + 1);
    });

    pos = weightedRandomChoice(candidates, weights);
    roads.add(key(pos[0], pos[1]));
    visitedMain.add(key(pos[0], pos[1]));
  }

  // ゴールに到達できるか確認
  const wallsCheck = new Set<string>();
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      if (!roads.has(key(r, c))) wallsCheck.add(key(r, c));
    }
  }
  const { length } = bfsShortestPath(numRows, numCols, wallsCheck, start, g);
  if (length === null) return null;

  // 2. 分岐道路 (2~4本)
  const numBranches = randomInt(2, 4);
  const roadList: [number, number][] = [];
  for (const k of roads) {
    const [r, c] = k.split(',').map(Number);
    if (!(r === start[0] && c === start[1]) && !(r === g[0] && c === g[1])) {
      roadList.push([r, c]);
    }
  }

  for (let b = 0; b < numBranches; b++) {
    if (roadList.length === 0) break;
    const branchStart = randomChoice(roadList);
    const branchLen = randomInt(2, Math.max(3, numRows - 2));
    let bPos: [number, number] = branchStart;

    for (let s = 0; s < branchLen; s++) {
      const cands: [number, number][] = [];
      for (const [nr, nc] of neighbors(bPos[0], bPos[1], numRows, numCols)) {
        if (!roads.has(key(nr, nc)) &&
            !wouldCreateAdjacentIntersections(nr, nc, roads, numRows, numCols) &&
            !wouldCreate2x2Block(nr, nc, roads)) {
          cands.push([nr, nc]);
        }
      }
      if (cands.length === 0) break;
      bPos = randomChoice(cands);
      roads.add(key(bPos[0], bPos[1]));
      roadList.push(bPos);
    }
  }

  return roads;
}

function pickRandomEndpoints(
  numRows: number, numCols: number,
): { start: [number, number]; goal: [number, number] } {
  const perimeter: [number, number][] = [];
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      if (r === 0 || r === numRows - 1 || c === 0 || c === numCols - 1) {
        perimeter.push([r, c]);
      }
    }
  }
  const minDist = Math.floor(Math.max(numRows, numCols) / 2);
  for (let i = 0; i < 200; i++) {
    const s = randomChoice(perimeter);
    const g = randomChoice(perimeter);
    if (!(s[0] === g[0] && s[1] === g[1]) &&
        Math.abs(s[0] - g[0]) + Math.abs(s[1] - g[1]) >= minDist) {
      return { start: s, goal: g };
    }
  }
  return { start: [0, 0], goal: [numRows - 1, numCols - 1] };
}

export function generateRandomMaze(
  numRows: number,
  numCols: number,
  options?: { randomEndpoints?: boolean; maxAttempts?: number },
): { walls: [number, number][]; start: [number, number]; goal: [number, number] } {
  const maxAttempts = options?.maxAttempts ?? 30;
  const randomEndpoints = options?.randomEndpoints ?? false;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let start: [number, number];
    let goal: [number, number];
    if (randomEndpoints) {
      ({ start, goal } = pickRandomEndpoints(numRows, numCols));
    } else {
      start = [0, 0];
      goal = [numRows - 1, numCols - 1];
    }

    const roads = generateRoadNetwork(numRows, numCols, start, goal);
    if (roads === null) continue;

    // 検証: 交差点隣接なし
    if (hasAdjacentIntersections(roads, numRows, numCols)) continue;

    // 2×2ブロックなし
    let has2x2 = false;
    for (const k of roads) {
      const [r, c] = k.split(',').map(Number);
      const without = new Set(roads);
      without.delete(k);
      if (wouldCreate2x2Block(r, c, without)) {
        has2x2 = true;
        break;
      }
    }
    if (has2x2) continue;

    // 全道路が隣接道路あり
    let allConnected = true;
    for (const k of roads) {
      const [r, c] = k.split(',').map(Number);
      if (countRoadNeighbors(r, c, roads, numRows, numCols) < 1) {
        allConnected = false;
        break;
      }
    }
    if (!allConnected) continue;

    const walls: [number, number][] = [];
    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        if (!roads.has(key(r, c))) walls.push([r, c]);
      }
    }

    // BFS最終確認
    const wallSet = new Set(walls.map(([r, c]) => key(r, c)));
    const { length } = bfsShortestPath(numRows, numCols, wallSet, start, goal);
    if (length !== null) {
      return { walls, start, goal };
    }
  }

  // フォールバック: L字型
  const start: [number, number] = [0, 0];
  const goal: [number, number] = [numRows - 1, numCols - 1];
  const roadsFb = new Set<string>();
  for (let c = 0; c < numCols; c++) roadsFb.add(key(0, c));
  for (let r = 0; r < numRows; r++) roadsFb.add(key(r, numCols - 1));
  const walls: [number, number][] = [];
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      if (!roadsFb.has(key(r, c))) walls.push([r, c]);
    }
  }
  return { walls, start, goal };
}

export function validateMaze(
  maze: MazeConfig,
): { valid: boolean; message: string; shortestPathLength: number | null } {
  const wallSet = new Set(maze.walls.map(([r, c]) => key(r, c)));
  const start = maze.start;
  const goal = maze.goal ?? [maze.num_rows - 1, maze.num_cols - 1] as [number, number];

  if (wallSet.has(key(start[0], start[1]))) {
    return { valid: false, message: 'スタート地点に壁があります', shortestPathLength: null };
  }
  if (wallSet.has(key(goal[0], goal[1]))) {
    return { valid: false, message: 'ゴール地点に壁があります', shortestPathLength: null };
  }

  const { length } = bfsShortestPath(maze.num_rows, maze.num_cols, wallSet, start, goal);
  if (length === null) {
    return { valid: false, message: 'ゴールまでの道がありません！道路を増やしてみてね', shortestPathLength: null };
  }

  return { valid: true, message: `OK！最短${length}ステップでゴールできるコースです`, shortestPathLength: length };
}
