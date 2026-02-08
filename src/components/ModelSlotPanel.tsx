import { useState } from 'react';
import type { SaveSlotInfo, MazeConfig } from '../types';
import { MiniGrid } from './MazeListPanel';

interface ModelSlotPanelProps {
  slots: SaveSlotInfo[];
  canSave: boolean;
  activeSlot?: number | null;
  modelName?: string | null;
  onModelNameChange?: (name: string) => void;
  onSave: (slot: number, name: string) => void;
  onLoad: (slot: number) => void;
  onSelect?: (slot: number) => void;
  onCopy?: (fromSlot: number, toSlot: number) => void;
  onDelete?: (slot: number) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${mi}`;
}

/** MazeConfig の walls 配列から MiniGrid 用の roads Set を生成 */
function mazeConfigToRoads(cfg: MazeConfig): Set<string> {
  const wallSet = new Set(cfg.walls.map(([r, c]) => `${r},${c}`));
  const roads = new Set<string>();
  for (let r = 0; r < cfg.num_rows; r++) {
    for (let c = 0; c < cfg.num_cols; c++) {
      if (r === cfg.start[0] && c === cfg.start[1]) continue;
      if (r === cfg.goal[0] && c === cfg.goal[1]) continue;
      if (!wallSet.has(`${r},${c}`)) {
        roads.add(`${r},${c}`);
      }
    }
  }
  return roads;
}

const HP_LABELS: { key: string; label: string; format: (v: number) => string }[] = [
  { key: 'maxEpisodes', label: '練習回数', format: v => `${v}回` },
  { key: 'lr', label: '学習率', format: v => v.toFixed(4) },
  { key: 'gamma', label: '割引率', format: v => v.toFixed(3) },
  { key: 'epsilonEnd', label: 'ε最終値', format: v => `${(v * 100).toFixed(0)}%` },
  { key: 'revisitPenalty', label: '再訪ペナルティ', format: v => v.toFixed(2) },
  { key: 'hiddenSize', label: '隠れ層サイズ', format: v => `${v}` },
];

function SlotDetail({ info, onClose }: { info: SaveSlotInfo; onClose: () => void }) {
  const hp = info.hyperParams;
  const ep = info.episodes;
  const boundaries = info.sessionBoundaries ?? [];
  const history = info.mazeHistory ?? [];
  const successCount = ep ? ep.filter(e => e.reached_goal).length : 0;
  const totalEp = ep?.length ?? 0;
  const sessionCount = boundaries.length + 1;

  // セッションごとのコース一覧: [...過去セッション, 現在のコース]
  const allSessionMazes: MazeConfig[][] = [];
  for (let i = 0; i < history.length; i++) {
    allSessionMazes.push(history[i]);
  }
  if (info.mazes && info.mazes.length > 0) {
    allSessionMazes.push(info.mazes);
  }

  return (
    <div style={{
      backgroundColor: 'var(--color-neutral-light)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-sm)',
      padding: '12px 14px',
      fontSize: 12,
      color: 'var(--color-text-secondary)',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      maxHeight: 400,
      overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: 13 }}>
          {info.name ? `"${info.name}" の詳細` : `スロット ${info.slot + 1} の詳細`}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 18, color: 'var(--color-text-secondary)', lineHeight: 1, padding: '0 2px',
          }}
          aria-label="閉じる"
        >
          &times;
        </button>
      </div>

      {/* 学習コース */}
      {allSessionMazes.length > 0 && (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>学習コース</div>
          {allSessionMazes.length === 1 ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {allSessionMazes[0].map((m, i) => (
                <MiniGrid
                  key={i}
                  roads={mazeConfigToRoads(m)}
                  start={m.start}
                  goal={m.goal}
                  rows={m.num_rows}
                  cols={m.num_cols}
                  isActive={false}
                />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {allSessionMazes.map((mazes, si) => (
                <div key={si}>
                  <div style={{ fontSize: 11, color: 'var(--color-info)', marginBottom: 2 }}>
                    セッション {si + 1}{si === allSessionMazes.length - 1 ? '（最新）' : ''}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {mazes.map((m, i) => (
                      <MiniGrid
                        key={i}
                        roads={mazeConfigToRoads(m)}
                        start={m.start}
                        goal={m.goal}
                        rows={m.num_rows}
                        cols={m.num_cols}
                        isActive={false}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* パラメータ */}
      {hp && (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>パラメータ</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {HP_LABELS.map(h => {
              const val = hp[h.key as keyof typeof hp];
              if (val == null) return null;
              return (
                <span key={h.key} style={{ whiteSpace: 'nowrap' }}>
                  {h.label}: <span style={{ color: 'var(--color-text)' }}>{h.format(val as number)}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* 収束ログ */}
      {ep && ep.length > 0 && (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            学習ログ
            {sessionCount > 1 && (
              <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--color-info)', marginLeft: 6 }}>
                ({sessionCount}セッション)
              </span>
            )}
          </div>
          <div>
            エピソード数: <span style={{ color: 'var(--color-text)' }}>{totalEp}</span>
            {' / '}
            ゴール到達: <span style={{ color: successCount > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{successCount}/{totalEp}</span>
          </div>
          {/* 簡易チャート: 直近のエピソードをバーで表示 */}
          <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end', height: 32, marginTop: 6, position: 'relative' }}>
            {(() => {
              const maxBars = 60;
              const stride = Math.max(1, Math.floor(ep.length / maxBars));
              const sampled = ep.filter((_, i) => i % stride === 0);
              const maxSteps = Math.max(...sampled.map(e => e.steps), 1);
              const totalBars = sampled.length;
              // 境界位置をサンプリング後のインデックスに変換
              const boundaryPositions = boundaries
                .map(b => Math.floor(b / stride))
                .filter(b => b > 0 && b < totalBars);
              return (
                <>
                  {sampled.map((e, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        maxWidth: 4,
                        height: `${Math.max(2, (e.steps / maxSteps) * 100)}%`,
                        backgroundColor: e.reached_goal ? 'var(--color-success)' : 'var(--color-danger)',
                        borderRadius: 1,
                        opacity: 0.8,
                      }}
                    />
                  ))}
                  {/* セッション境界線 */}
                  {boundaryPositions.map((pos, i) => (
                    <div
                      key={`b-${i}`}
                      style={{
                        position: 'absolute',
                        left: `${(pos / totalBars) * 100}%`,
                        top: 0,
                        bottom: 0,
                        width: 2,
                        backgroundColor: 'var(--color-info)',
                        opacity: 0.6,
                      }}
                    />
                  ))}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* テスト結果 */}
      {info.testSummary && (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>テスト結果</div>
          <span style={{
            color: info.testSummary.success === info.testSummary.total ? 'var(--color-success)' : 'var(--color-accent)',
            fontWeight: 700,
          }}>
            {info.testSummary.success}/{info.testSummary.total} 成功
          </span>
          {info.score && (
            <span style={{ marginLeft: 8 }}>
              スコア: <span style={{ color: 'var(--color-text)', fontWeight: 700 }}>{info.score.total_score.toFixed(0)}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function ModelSlotPanel({ slots, canSave, activeSlot, modelName, onModelNameChange, onSave, onLoad, onSelect, onCopy, onDelete }: ModelSlotPanelProps) {
  const slotMap = new Map(slots.map(s => [s.slot, s]));
  const [detailSlot, setDetailSlot] = useState<number | null>(null);
  const [copyingFrom, setCopyingFrom] = useState<number | null>(null);

  const currentName = modelName ?? '';
  const editable = !!onModelNameChange;

  return (
    <div className="model-slots">
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--color-text-secondary)' }}>
        モデル保存
      </div>

      {/* モデル名（スロット選択時に常時表示、editフェーズのみ編集可） */}
      {activeSlot != null && (
        <div style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          marginBottom: 8,
        }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
            モデル名:
          </span>
          {editable ? (
            <input
              type="text"
              value={currentName}
              onChange={e => onModelNameChange(e.target.value)}
              placeholder="例: じっくり学習v2"
              maxLength={20}
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: 13,
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-card)',
                color: 'var(--color-text)',
                outline: 'none',
                minWidth: 0,
              }}
            />
          ) : (
            <span style={{ fontSize: 13, color: 'var(--color-text)', fontWeight: 600 }}>
              {currentName || '—'}
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {[0, 1, 2].map(slot => {
          const info = slotMap.get(slot);
          const handleClick = info
            ? () => onLoad(slot)
            : onSelect
              ? () => onSelect(slot)
              : undefined;
          return (
            <div
              key={slot}
              className={`model-slot${info ? ' model-slot-filled' : ''}${!info && onSelect ? ' model-slot-selectable' : ''}${activeSlot === slot ? ' model-slot-active' : ''}`}
              onClick={handleClick}
            >
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                スロット {slot + 1}
              </div>
              {info ? (
                <>
                  {info.name && (
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-info)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {info.name}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 2 }}>
                    {formatDate(info.savedAt)}
                  </div>
                  {info.episodes && (
                    <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
                      {info.episodes.length}EP
                      {info.mazes && ` / ${info.mazes[0]?.num_rows}x${info.mazes[0]?.num_cols}`}
                    </div>
                  )}
                  {info.testSummary && (
                    <div style={{ fontSize: 10, color: info.testSummary.success === info.testSummary.total ? 'var(--color-success)' : 'var(--color-accent)' }}>
                      テスト {info.testSummary.success}/{info.testSummary.total}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 11, padding: '3px 8px' }}
                      onClick={() => setDetailSlot(detailSlot === slot ? null : slot)}
                    >
                      {detailSlot === slot ? '閉じる' : '情報'}
                    </button>
                    {canSave && (
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => onSave(slot, currentName)} disabled={!currentName.trim()}>
                        上書き
                      </button>
                    )}
                    {onCopy && (
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => setCopyingFrom(copyingFrom === slot ? null : slot)}>
                        {copyingFrom === slot ? 'キャンセル' : 'コピー'}
                      </button>
                    )}
                    {onDelete && (
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '3px 8px', color: 'var(--color-danger)' }} onClick={() => { if (confirm('このモデルを削除しますか？')) onDelete(slot); }}>
                        削除
                      </button>
                    )}
                  </div>
                  {copyingFrom === slot && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>コピー先:</span>
                      {[0, 1, 2].filter(s => s !== slot).map(target => (
                        <button
                          key={target}
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: 10, padding: '2px 8px' }}
                          onClick={() => {
                            const targetInfo = slotMap.get(target);
                            if (targetInfo && !confirm(`スロット${target + 1}を上書きしますか？`)) return;
                            onCopy!(slot, target);
                            setCopyingFrom(null);
                          }}
                        >
                          スロット {target + 1}{slotMap.has(target) ? '' : '(空)'}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {activeSlot === slot ? (
                    <div style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 700, marginBottom: 6 }}>
                      選択中
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 6 }}>
                      -- 空き --
                    </div>
                  )}
                  {canSave && activeSlot === slot && (
                    <button className="btn btn-primary btn-sm" style={{ fontSize: 11, padding: '3px 8px' }} onClick={e => { e.stopPropagation(); onSave(slot, currentName); }} disabled={!currentName.trim()}>
                      保存
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* 詳細パネル */}
      {detailSlot != null && slotMap.has(detailSlot) && (
        <div style={{ marginTop: 8 }}>
          <SlotDetail info={slotMap.get(detailSlot)!} onClose={() => setDetailSlot(null)} />
        </div>
      )}
    </div>
  );
}
