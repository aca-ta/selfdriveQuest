import { useEffect, useRef, useState, useCallback } from 'react';

interface AgentLogProps {
  lines: string[];
}

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return mobile;
}

export function AgentLog({ lines }: AgentLogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  const toggle = useCallback(() => setCollapsed(c => !c), []);

  if (lines.length === 0) return null;

  const lastLine = lines[lines.length - 1];

  if (isMobile && collapsed) {
    return (
      <div
        onClick={toggle}
        style={{
          backgroundColor: '#1e1e1e',
          color: '#d4d4d4',
          fontFamily: 'monospace',
          fontSize: 12,
          padding: '8px 12px',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--color-border)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lastLine}
        </span>
        <span style={{ fontSize: 10, color: '#808080', flexShrink: 0 }}>▼ ログ</span>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {isMobile && (
        <div
          onClick={toggle}
          style={{
            position: 'absolute', top: 6, right: 8, zIndex: 1,
            fontSize: 10, color: '#808080', cursor: 'pointer',
            background: '#1e1e1e', padding: '2px 6px', borderRadius: 4,
          }}
        >
          ▲ たたむ
        </div>
      )}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          minWidth: 0,
          maxHeight: isMobile ? 200 : 560,
          overflowY: 'auto',
          backgroundColor: '#1e1e1e',
          color: '#d4d4d4',
          fontFamily: 'monospace',
          fontSize: 12,
          padding: '8px 12px',
          borderRadius: 'var(--radius-md)',
          lineHeight: 1.6,
          alignSelf: 'stretch',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--color-border)',
        }}
      >
        {lines.map((line, i) => {
          const isHeader = line.startsWith('---');
          const isResult = line.startsWith('→');
          const isEpisode = line.startsWith('[EP');
          const isGoal = isEpisode && line.includes('] o ');
          const isFail = isEpisode && line.includes('] x ');
          let color = '#d4d4d4';
          if (isHeader) color = '#569cd6';
          else if (isResult) color = '#dcdcaa';
          else if (isGoal) color = '#6a9955';
          else if (isFail) color = '#ce9178';
          else if (line.startsWith('  #')) color = '#808080';
          return (
            <div
              key={i}
              style={{
                color,
                fontWeight: isHeader || isResult ? 'bold' : 'normal',
              }}
            >
              {line}
            </div>
          );
        })}
      </div>
    </div>
  );
}
