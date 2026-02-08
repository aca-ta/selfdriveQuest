import type { MazeData } from '../types';

// 座標から決定的な擬似乱数 (0-1)
function seededRandom(row: number, col: number): number {
  let h = (row * 374761 + col * 668265) ^ 0x5bf03635;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 0xffffffff;
}

const TERRAIN_COLORS = ['#3a7d1e', '#2e6b16', '#48891f', '#256212', '#358a1a'];

interface MazeListPanelProps {
  mazes: MazeData[];
  activeMazeIdx: number;
  rows: number;
  cols: number;
  disabled: boolean;
  onSelect: (idx: number) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
}

export function MiniGrid({
  roads,
  start,
  goal,
  rows,
  cols,
  isActive,
}: {
  roads: Set<string>;
  start: [number, number];
  goal: [number, number];
  rows: number;
  cols: number;
  isActive: boolean;
}) {
  const cellSize = 8;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
        gap: 1,
        padding: 4,
        backgroundColor: isActive ? 'var(--color-primary)' : '#2d5a0e',
        borderRadius: 4,
      }}
    >
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const key = `${r},${c}`;
          const ti = Math.floor(seededRandom(r, c) * TERRAIN_COLORS.length);
          let bg = TERRAIN_COLORS[ti]; // terrain
          if (r === start[0] && c === start[1]) bg = '#00a2ff'; // start
          else if (r === goal[0] && c === goal[1]) bg = '#e04040'; // goal
          else if (roads.has(key)) bg = '#555'; // road
          return (
            <div
              key={key}
              style={{
                width: cellSize,
                height: cellSize,
                backgroundColor: bg,
                borderRadius: 1,
              }}
            />
          );
        })
      )}
    </div>
  );
}

export function MazeListPanel({
  mazes,
  activeMazeIdx,
  rows,
  cols,
  disabled,
  onSelect,
  onAdd,
  onRemove,
}: MazeListPanelProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 480, overflowY: 'auto', alignItems: 'center' }}>
      <div style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-card)', zIndex: 1, paddingBottom: 4, display: 'flex', flexDirection: 'column', gap: 6, alignSelf: 'stretch' }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-secondary)' }}>
          コース ({mazes.length})
        </div>
        {!disabled && (
          <button
            onClick={onAdd}
            style={{
              padding: '6px 8px',
              border: '2px dashed var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              fontSize: 12,
              color: 'var(--color-text-secondary)',
              transition: 'border-color 0.15s',
            }}
          >
            + 追加
          </button>
        )}
      </div>
      {mazes.map((maze, idx) => (
        <div
          key={maze.id}
          onClick={() => onSelect(idx)}
          style={{
            cursor: 'pointer',
            position: 'relative',
            opacity: activeMazeIdx === idx ? 1 : 0.6,
          }}
        >
          <MiniGrid roads={maze.roads} start={maze.start} goal={maze.goal} rows={rows} cols={cols} isActive={activeMazeIdx === idx} />
          {!disabled && mazes.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(idx);
              }}
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                width: 16,
                height: 16,
                borderRadius: '50%',
                border: 'none',
                backgroundColor: 'var(--color-danger)',
                color: 'white',
                fontSize: 10,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              x
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
