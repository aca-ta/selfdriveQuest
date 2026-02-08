import { useMemo } from 'react';
import type { EpisodeResult } from '../types';

interface EpisodeChartProps {
  episodes: EpisodeResult[];
  sessionBoundaries?: number[];
}

export function EpisodeChart({ episodes, sessionBoundaries = [] }: EpisodeChartProps) {
  if (episodes.length === 0) return null;

  const maxSteps = Math.max(...episodes.map(e => e.steps), 1);
  const barWidth = Math.max(2, Math.min(8, 400 / episodes.length));
  const chartHeight = 120;

  // Show last 100 episodes max
  const visibleStart = Math.max(0, episodes.length - 100);
  const visible = episodes.slice(visibleStart);

  // セッション境界を表示範囲内のインデックスに変換
  const visibleBoundaries = useMemo(() =>
    sessionBoundaries
      .filter(b => b > visibleStart && b < episodes.length)
      .map(b => b - visibleStart),
    [sessionBoundaries, visibleStart, episodes.length],
  );

  return (
    <div className="card" style={{ padding: '12px 16px', overflow: 'hidden' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
        ステップ数の推移 (Episode {episodes.length})
      </div>
      <div style={{ overflowX: 'auto' as const }}>
        <svg
        width={Math.max(visible.length * (barWidth + 1), 200)}
        height={chartHeight + 20}
        style={{ backgroundColor: 'var(--color-neutral-light)', borderRadius: 'var(--radius-sm)' }}
      >
        {visible.map((ep, i) => {
          const h = (ep.steps / maxSteps) * chartHeight;
          return (
            <rect
              key={i}
              x={i * (barWidth + 1) + 1}
              y={chartHeight - h}
              width={barWidth}
              height={h}
              fill={ep.reached_goal ? 'var(--color-success)' : 'var(--color-danger)'}
              opacity={0.8}
            />
          );
        })}
        {/* セッション境界線 */}
        {visibleBoundaries.map((bi, i) => {
          const x = bi * (barWidth + 1);
          return (
            <line
              key={`boundary-${i}`}
              x1={x}
              y1={0}
              x2={x}
              y2={chartHeight}
              stroke="var(--color-info)"
              strokeWidth={2}
              strokeDasharray="4 3"
              opacity={0.7}
            />
          );
        })}
        {/* X axis line */}
        <line
          x1={0}
          y1={chartHeight}
          x2={visible.length * (barWidth + 1)}
          y2={chartHeight}
          stroke="var(--color-neutral)"
          strokeWidth={1}
        />
        </svg>
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>
        <span style={{ color: 'var(--color-success)' }}>{'\u25a0'} ゴール到達</span>
        {' '}
        <span style={{ color: 'var(--color-danger)' }}>{'\u25a0'} 未到達</span>
        {sessionBoundaries.length > 0 && (
          <>
            {' '}
            <span style={{ color: 'var(--color-info)' }}>{'┆'} コース変更</span>
          </>
        )}
      </div>
    </div>
  );
}
