import { useEffect, useRef } from 'react';

interface AgentLogProps {
  lines: string[];
}

export function AgentLog({ lines }: AgentLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines.length]);

  if (lines.length === 0) return null;

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        maxHeight: 560,
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
      <div ref={bottomRef} />
    </div>
  );
}
