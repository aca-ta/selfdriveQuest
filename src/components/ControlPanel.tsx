import type { GamePhase } from '../types';

interface ControlPanelProps {
  phase: GamePhase;
  currentEpisode: number;
  error: string | null;
  modelName?: string | null;
  onStop: () => void;
  onStopTest?: () => void;
  onReset: () => void;
  onClearRoads: () => void;
  onRegenerate: () => void;
  onBackToEdit: () => void;
  onTest?: () => void;
  onAddFailedCourses?: () => void;
  onShowScore?: () => void;
  onRunPlayground?: () => void;
  onEnterPlayground?: () => void;
  playRunning?: boolean;
  failedCount?: number;
}

export function ControlPanel({
  phase,
  currentEpisode,
  error,
  modelName,
  onStop,
  onStopTest,
  onReset,
  onClearRoads,
  onRegenerate,
  onBackToEdit,
  onTest,
  onAddFailedCourses,
  onShowScore,
  onRunPlayground,
  onEnterPlayground,
  playRunning,
  failedCount,
}: ControlPanelProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {phase === 'train' && (
          <>
            {modelName && (
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-info)' }}>
                [{modelName}]
              </span>
            )}
            <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
              学習中... Episode {currentEpisode}
            </span>
            <button className="btn btn-danger btn-sm" onClick={onStop}>
              Stop
            </button>
          </>
        )}

        {phase === 'test' && (
          <>
            {modelName && (
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-info)' }}>
                [{modelName}]
              </span>
            )}
            <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
              テスト走行中...
            </span>
            <button className="btn btn-danger btn-sm" onClick={onStopTest}>
              Stop
            </button>
          </>
        )}

        {phase === 'result' && (
          <>
            {onShowScore && (
              <button className="btn btn-accent btn-sm" onClick={onShowScore}>
                スコアを見る
              </button>
            )}
            {onAddFailedCourses && failedCount && failedCount > 0 && (
              <button className="btn btn-danger" onClick={onAddFailedCourses}>
                失敗コースを追加して再学習（{failedCount}件）
              </button>
            )}
            {onEnterPlayground && (
              <button className="btn btn-success" onClick={onEnterPlayground}>
                自分のコースで走らせる
              </button>
            )}
            <button className="btn btn-info" onClick={onBackToEdit}>
              もっと鍛える
            </button>
            <button className="btn btn-ghost" onClick={onReset}>
              新しいモデルを作る
            </button>
          </>
        )}

        {phase === 'play' && (
          <div className="card" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '10px 16px' }}>
            <button className="btn btn-accent btn-sm" onClick={onRegenerate}>
              コースを変える
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClearRoads}>
              道路リセット
            </button>
            <div style={{ flex: 1 }} />
            {onRunPlayground && (
              <button className="btn btn-success btn-lg" onClick={onRunPlayground} disabled={playRunning}>
                {playRunning ? '走行中...' : '走らせる'}
              </button>
            )}
            {onTest && (
              <button className="btn btn-accent btn-sm" onClick={onTest}>
                実力を試す
              </button>
            )}
            <button className="btn btn-primary btn-sm" onClick={onBackToEdit}>
              もっと鍛える
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onReset}>
              リセット
            </button>
          </div>
        )}
      </div>

      {error && (
        <div style={{ color: 'var(--color-danger)', fontSize: 14, padding: '4px 0' }}>
          {error}
        </div>
      )}
    </div>
  );
}
