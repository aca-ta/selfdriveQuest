import { useState, useCallback } from 'react';
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
  const [dragMode, setDragMode] = useState<DragMode>(null);

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

  const handleMouseDown = (row: number, col: number) => {
    if (isStart(row, col)) {
      setDragMode('drag-start');
      return;
    }
    if (isGoal(row, col)) {
      setDragMode('drag-goal');
      return;
    }
    // road paint
    const isRoad = roads.has(`${row},${col}`);
    setDragMode(isRoad ? 'erase' : 'road');
    onToggleRoad(row, col);
  };

  const handleMouseEnter = (row: number, col: number) => {
    if (!dragMode) return;
    if (dragMode === 'drag-start') {
      if (!isGoal(row, col)) onSetStart?.(row, col);
      return;
    }
    if (dragMode === 'drag-goal') {
      if (!isStart(row, col)) onSetGoal?.(row, col);
      return;
    }
    // road/erase: skip start/goal cells
    if (isStart(row, col) || isGoal(row, col)) return;
    onSetRoad(row, col, dragMode === 'road');
  };

  const handleMouseUp = () => setDragMode(null);

  return (
    <div
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
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
              showDecorations={showDecorations}
              roadConn={getRoadConn(r, c)}
              onMouseDown={() => handleMouseDown(r, c)}
              onMouseEnter={() => handleMouseEnter(r, c)}
              disabled={disabled}
              draggable={!disabled && (cellType === 'start' || cellType === 'goal')}
            />
          );
        })
      )}
    </div>
  );
}
