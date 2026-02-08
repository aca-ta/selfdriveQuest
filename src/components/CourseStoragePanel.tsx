import { useState } from 'react';
import type { SavedCourseSet } from '../types';

interface CourseStoragePanelProps {
  currentMazeCount: number;
  savedSets: SavedCourseSet[];
  onSave: (name: string) => void;
  onLoad: (courseSet: SavedCourseSet) => void;
  onDelete: (id: string) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function CourseStoragePanel({
  currentMazeCount,
  savedSets,
  onSave,
  onLoad,
  onDelete,
}: CourseStoragePanelProps) {
  const [name, setName] = useState('');

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setName('');
  };

  return (
    <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-secondary)' }}>
        コースセット
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
          disabled={!name.trim() || currentMazeCount === 0 || savedSets.length >= 20}
        >
          保存
        </button>
      </div>

      {savedSets.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
          {savedSets.map(s => (
            <div
              key={s.id}
              style={{
                padding: '5px 6px',
                backgroundColor: 'var(--color-neutral-light)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.name}
              </div>
              <div style={{ color: 'var(--color-text-secondary)', fontSize: 10 }}>
                {s.gridSize.rows}x{s.gridSize.cols} / {s.mazes.length}コース / {formatDate(s.savedAt)}
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 10, padding: '1px 6px' }}
                  onClick={() => {
                    if (confirm('現在のコースは置き換えられます。よろしいですか？')) {
                      onLoad(s);
                    }
                  }}
                >
                  読込
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 10, padding: '1px 6px', color: 'var(--color-danger)' }}
                  onClick={() => {
                    if (confirm('このコースセットを削除しますか？')) {
                      onDelete(s.id);
                    }
                  }}
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
