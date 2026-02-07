import type { TestResultData } from '../types';

// 座標から決定的な擬似乱数 (0-1)
function seededRandom(row: number, col: number): number {
  let h = (row * 374761 + col * 668265) ^ 0x5bf03635;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 0xffffffff;
}

const TERRAIN_COLORS = ['#3a7d1e', '#2e6b16', '#48891f', '#256212', '#358a1a'];

interface TestViewProps {
  results: TestResultData[];
  rows: number;
  cols: number;
  activeIndex?: number;
  onSelect?: (testIndex: number) => void;
}

export function TestView({ results, rows, cols, activeIndex, onSelect }: TestViewProps) {
  if (results.length === 0) return null;

  const cellSize = cols <= 5 ? 12 : cols <= 10 ? 8 : 6;

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
        テスト走行結果
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', overflowX: 'auto' }}>
        {results.map((r) => {
          // walls from API → compute roads for display
          const wallSet = new Set(r.walls.map(([wr, wc]) => `${wr},${wc}`));
          return (
            <div
              key={r.test_index}
              onClick={() => onSelect?.(r.test_index)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                cursor: onSelect ? 'pointer' : 'default',
                outline: activeIndex === r.test_index ? '3px solid var(--color-primary)' : '3px solid transparent',
                borderRadius: 'var(--radius-sm)',
                padding: 2,
                transition: 'outline-color 0.15s',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
                  gap: 1,
                  padding: 2,
                  backgroundColor: r.reached_goal ? 'var(--color-success)' : 'var(--color-danger)',
                  borderRadius: 4,
                }}
              >
                {Array.from({ length: rows }, (_, row) =>
                  Array.from({ length: cols }, (_, col) => {
                    const isWall = wallSet.has(`${row},${col}`);
                    const isOnPath = r.path.some(([pr, pc]) => pr === row && pc === col);
                    const ti = Math.floor(seededRandom(row, col) * TERRAIN_COLORS.length);
                    let bg = TERRAIN_COLORS[ti]; // terrain
                    if (row === r.start[0] && col === r.start[1]) bg = '#00a2ff';
                    else if (row === r.goal[0] && col === r.goal[1]) bg = '#e04040';
                    else if (!isWall && isOnPath) bg = '#ffeb3b'; // path on road
                    else if (!isWall) bg = '#555'; // road
                    // wall cells stay as terrain (green)
                    return (
                      <div
                        key={`${row},${col}`}
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
              <div style={{ fontSize: 11, textAlign: 'center', color: 'var(--color-text)' }}>
                {r.reached_goal ? `${r.steps}km` : 'x'}
                {r.bfs_shortest != null && r.reached_goal && (
                  <span style={{ color: 'var(--color-text-secondary)' }}> (最短{r.bfs_shortest})</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
