import { useMemo } from 'react';
import type { CellType } from '../types';

// 4方向の隣接道路情報
interface RoadConnections {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

interface GridCellProps {
  row: number;
  col: number;
  cellType: CellType;
  isAgent: boolean;
  isOnPath: boolean;
  showDecorations: boolean;
  roadConn: RoadConnections;
  onMouseDown: () => void;
  onMouseEnter: () => void;
  disabled: boolean;
  draggable?: boolean;
}

const CELL_COLORS: Record<CellType, string> = {
  terrain: '#3a7d1e', // 芝生 (Roblox風)
  road: '#4a4a4a',    // アスファルト
  start: '#00a2ff',   // スタート（ブルー）
  goal: '#e04040',    // ゴール（レッド）
};

const CELL_LABELS: Partial<Record<CellType, string>> = {
  start: 'P',   // Parking / 出発
  goal: '\u2691', // Flag
};

// 地形デコレーション: [emoji, 出現確率の重み]
const TERRAIN_ITEMS: [string, number][] = [
  ['🌳', 5],
  ['🌲', 3],
  ['🏠', 2],
  ['🏢', 1],
  ['🏪', 1],
];

// 座標から決定的な擬似乱数 (0-1) を返す
function seededRandom(row: number, col: number): number {
  let h = (row * 374761 + col * 668265) ^ 0x5bf03635;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 0xffffffff;
}

function pickTerrainItem(row: number, col: number): string | null {
  const r = seededRandom(row, col);
  // 40% の確率でなにも置かない（芝生のまま）
  if (r < 0.4) return null;

  const totalWeight = TERRAIN_ITEMS.reduce((s, [, w]) => s + w, 0);
  const r2 = seededRandom(row + 100, col + 100);
  let acc = 0;
  for (const [emoji, weight] of TERRAIN_ITEMS) {
    acc += weight / totalWeight;
    if (r2 < acc) return emoji;
  }
  return TERRAIN_ITEMS[0][0];
}

export function GridCell({
  row,
  col,
  cellType,
  isAgent,
  isOnPath,
  showDecorations,
  roadConn,
  onMouseDown,
  onMouseEnter,
  disabled,
  draggable,
}: GridCellProps) {
  const bgColor = CELL_COLORS[cellType];
  const isRoadLike = cellType === 'road' || cellType === 'start' || cellType === 'goal';

  const terrainEmoji = useMemo(
    () => (showDecorations && cellType === 'terrain' ? pickTerrainItem(row, col) : null),
    [showDecorations, cellType, row, col],
  );

  return (
    <div
      onMouseDown={disabled ? undefined : onMouseDown}
      onMouseEnter={disabled ? undefined : onMouseEnter}
      style={{
        aspectRatio: '1',
        backgroundColor: bgColor,
        borderRadius: isRoadLike ? 2 : 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'default' : draggable ? 'grab' : 'pointer',
        position: 'relative',
        transition: 'background-color 0.1s',
        fontSize: '1rem',
        fontWeight: 'bold',
        color: 'white',
        userSelect: 'none',
        overflow: 'hidden',
        containerType: 'inline-size' as never,
        boxShadow: isOnPath ? 'inset 0 0 0 3px rgba(255, 235, 59, 0.7)' : undefined,
      }}
    >
      {/* 地形デコレーション — セルいっぱいに表示 */}
      {terrainEmoji && (
        <span style={{ fontSize: '90cqmin', lineHeight: 1 }}>
          {terrainEmoji}
        </span>
      )}
      {/* 道路のセンターライン（接続方向ごとに中心→端の半線） */}
      {cellType === 'road' && !isAgent && (
        <>
          {roadConn.up && (
            <div style={{ position: 'absolute', width: 4, height: '50%', top: 0, left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(255,255,255,0.3)' }} />
          )}
          {roadConn.down && (
            <div style={{ position: 'absolute', width: 4, height: '50%', bottom: 0, left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(255,255,255,0.3)' }} />
          )}
          {roadConn.left && (
            <div style={{ position: 'absolute', height: 4, width: '50%', left: 0, top: '50%', transform: 'translateY(-50%)', backgroundColor: 'rgba(255,255,255,0.3)' }} />
          )}
          {roadConn.right && (
            <div style={{ position: 'absolute', height: 4, width: '50%', right: 0, top: '50%', transform: 'translateY(-50%)', backgroundColor: 'rgba(255,255,255,0.3)' }} />
          )}
        </>
      )}
      {CELL_LABELS[cellType] && (
        <span style={{ fontSize: '60cqmin', lineHeight: 1 }}>
          {CELL_LABELS[cellType]}
        </span>
      )}
      {isAgent && (
        <span
          style={{
            position: 'absolute',
            fontSize: '90cqmin',
            lineHeight: 1,
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
            transition: 'all 0.05s ease-in-out',
          }}
        >
          {'\uD83D\uDE97'}
        </span>
      )}
    </div>
  );
}
