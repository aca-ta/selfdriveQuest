import { useCallback, useMemo, useRef } from 'react';
import { GridCell } from './GridCell';
import type { CellType } from '../types';

type DragMode = 'road' | 'erase' | 'drag-start' | 'drag-goal' | null;

interface GridEditorProps {
  rows: number;
  cols: number;
  roads: Set<string>;
  start: [number, number];
  goal: [number, number];
  agentPosition: [number, number] | null;
  pathCells: Set<string>;
  disabled: boolean;
  showDecorations: boolean;
  onToggleRoad: (row: number, col: number) => void;
  onSetRoad: (row: number, col: number, isRoad: boolean) => void;
  onSetStart?: (row: number, col: number) => void;
  onSetGoal?: (row: number, col: number) => void;
}

export function GridEditor({
  rows,
  cols,
  roads,
  start,
  goal,
  agentPosition,
  pathCells,
  disabled,
  showDecorations,
  onToggleRoad,
  onSetRoad,
  onSetStart,
  onSetGoal,
}: GridEditorProps) {
  const dragModeRef = useRef<DragMode>(null);
  const lastTouchCell = useRef<string | null>(null);

  const getCellType = useCallback(
    (row: number, col: number): CellType => {
      if (row === start[0] && col === start[1]) return 'start';
      if (row === goal[0] && col === goal[1]) return 'goal';
      if (roads.has(`${row},${col}`)) return 'road';
      return 'terrain';
    },
    [start, goal, roads]
  );

  const isRoadLike = useCallback(
    (row: number, col: number): boolean => {
      if (row === start[0] && col === start[1]) return true;
      if (row === goal[0] && col === goal[1]) return true;
      return roads.has(`${row},${col}`);
    },
    [start, goal, roads]
  );

  const getRoadConn = useCallback(
    (row: number, col: number) => ({
      up: row > 0 && isRoadLike(row - 1, col),
      down: row < rows - 1 && isRoadLike(row + 1, col),
      left: col > 0 && isRoadLike(row, col - 1),
      right: col < cols - 1 && isRoadLike(row, col + 1),
    }),
    [rows, cols, isRoadLike]
  );

  const isStart = (row: number, col: number) =>
    row === start[0] && col === start[1];
  const isGoal = (row: number, col: number) =>
    row === goal[0] && col === goal[1];

  const handleCellDown = useCallback((row: number, col: number) => {
    let mode: DragMode;
    if (isStart(row, col)) {
      mode = 'drag-start';
    } else if (isGoal(row, col)) {
      mode = 'drag-goal';
    } else {
      const isRoad = roads.has(`${row},${col}`);
      mode = isRoad ? 'erase' : 'road';
      onToggleRoad(row, col);
    }
    dragModeRef.current = mode;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, goal, roads, onToggleRoad]);

  const handleCellMove = useCallback((row: number, col: number) => {
    const mode = dragModeRef.current;
    if (!mode) return;
    if (mode === 'drag-start') {
      if (!isGoal(row, col)) onSetStart?.(row, col);
      return;
    }
    if (mode === 'drag-goal') {
      if (!isStart(row, col)) onSetGoal?.(row, col);
      return;
    }
    if (isStart(row, col) || isGoal(row, col)) return;
    onSetRoad(row, col, mode === 'road');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, goal, onSetStart, onSetGoal, onSetRoad]);

  const handleDragEnd = useCallback(() => {
    dragModeRef.current = null;
    lastTouchCell.current = null;
  }, []);

  // Touch: resolve cell from touch coordinates
  const getCellFromTouch = useCallback((touch: { clientX: number; clientY: number }): [number, number] | null => {
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return null;
    const cellEl = (el as HTMLElement).closest('[data-row]') as HTMLElement | null;
    if (!cellEl) return null;
    const r = parseInt(cellEl.dataset.row!, 10);
    const c = parseInt(cellEl.dataset.col!, 10);
    if (isNaN(r) || isNaN(c)) return null;
    return [r, c];
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    const touch = e.touches[0];
    if (!touch) return;
    const cell = getCellFromTouch(touch);
    if (!cell) return;
    e.preventDefault();
    lastTouchCell.current = `${cell[0]},${cell[1]}`;
    handleCellDown(cell[0], cell[1]);
  }, [disabled, getCellFromTouch, handleCellDown]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled || !dragModeRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    const cell = getCellFromTouch(touch);
    if (!cell) return;
    e.preventDefault();
    const key = `${cell[0]},${cell[1]}`;
    if (key === lastTouchCell.current) return;
    lastTouchCell.current = key;
    handleCellMove(cell[0], cell[1]);
  }, [disabled, getCellFromTouch, handleCellMove]);

  const fovHalf = 2; // OBS_VIEW_SIZE=5 → half=2
  const fovCells = useMemo(() => {
    if (!agentPosition) return null;
    const set = new Set<string>();
    const [ar, ac] = agentPosition;
    for (let dr = -fovHalf; dr <= fovHalf; dr++) {
      for (let dc = -fovHalf; dc <= fovHalf; dc++) {
        const r = ar + dr;
        const c = ac + dc;
        if (r >= 0 && r < rows && c >= 0 && c < cols) {
          set.add(`${r},${c}`);
        }
      }
    }
    return set;
  }, [agentPosition, rows, cols]);

  return (
    <div
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleDragEnd}
      onTouchCancel={handleDragEnd}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 2,
        padding: 8,
        backgroundColor: '#2d5a0e',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-md)',
        width: '100%',
        flexShrink: 0,
        touchAction: disabled ? 'auto' : 'none',
      }}
    >
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const key = `${r},${c}`;
          const cellType = getCellType(r, c);
          return (
            <GridCell
              key={key}
              row={r}
              col={c}
              cellType={cellType}
              isAgent={
                agentPosition !== null &&
                agentPosition[0] === r &&
                agentPosition[1] === c
              }
              isOnPath={pathCells.has(key)}
              inFov={fovCells !== null && fovCells.has(key)}
              showDecorations={showDecorations}
              roadConn={getRoadConn(r, c)}
              onMouseDown={() => handleCellDown(r, c)}
              onMouseEnter={() => handleCellMove(r, c)}
              disabled={disabled}
              draggable={!disabled && (cellType === 'start' || cellType === 'goal')}
            />
          );
        })
      )}
    </div>
  );
}
