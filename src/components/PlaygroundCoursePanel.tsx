import { useState } from 'react';
import type { MazeConfig, SavedCourseSet } from '../types';

interface PlaygroundCoursePanelProps {
  savedSets: SavedCourseSet[];
  onSave: (name: string) => void;
  onLoad: (config: MazeConfig) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface FlatCourse {
  config: MazeConfig;
  setName: string;
  index: number;
  total: number;
  savedAt: string;
}

export function PlaygroundCoursePanel({
  savedSets,
  onSave,
  onLoad,
}: PlaygroundCoursePanelProps) {
  const [name, setName] = useState('');

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setName('');
  };

  // 全コースセットから個別コースをフラットに展開
  const flatCourses: FlatCourse[] = [];
  for (const s of savedSets) {
    for (let i = 0; i < s.mazes.length; i++) {
      flatCourses.push({
        config: s.mazes[i],
        setName: s.name,
        index: i,
        total: s.mazes.length,
        savedAt: s.savedAt,
      });
    }
  }

  return (
    <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-secondary)' }}>
        コース保存
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
          placeholder="名前"
          style={{
            flex: 1,
            minWidth: 0,
            padding: '3px 6px',
            fontSize: 11,
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-neutral-light)',
            color: 'var(--color-text)',
            outline: 'none',
          }}
        />
        <button
          className="btn btn-primary btn-sm"
          style={{ fontSize: 11, padding: '3px 8px', flexShrink: 0 }}
          onClick={handleSave}
          disabled={!name.trim()}
        >
          保存
        </button>
      </div>

      {flatCourses.length > 0 && (
        <>
          <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>
            保存済みコース ({flatCourses.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 240, overflowY: 'auto' }}>
            {flatCourses.map((c, i) => (
              <div
                key={`${c.setName}-${c.index}-${i}`}
                style={{
                  padding: '4px 6px',
                  backgroundColor: 'var(--color-neutral-light)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
                onClick={() => onLoad(c.config)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>
                    {c.setName}{c.total > 1 && ` #${c.index + 1}`}
                  </div>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: 10 }}>
                    {c.config.num_rows}x{c.config.num_cols} / {formatDate(c.savedAt)}
                  </div>
                </div>
                <span style={{ fontSize: 10, color: 'var(--color-primary)', flexShrink: 0 }}>読込</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
