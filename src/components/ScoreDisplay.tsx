import type { ScoreData } from '../types';

interface ScoreDisplayProps {
  score: ScoreData | null;
}

function getRankMessage(rate: number): string {
  if (rate >= 0.9) return 'すごいコース！自動運転がとても上手になった！';
  if (rate >= 0.7) return 'いいコースだね！車が賢くなったよ！';
  if (rate >= 0.4) return 'まあまあ！もっと工夫してみよう！';
  return 'もっとコースを追加して鍛えよう！';
}

export function ScoreDisplay({ score }: ScoreDisplayProps) {
  if (!score) return null;

  const successPercent = Math.round(score.success_rate * 100);

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 48, fontWeight: 'bold', color: 'var(--color-success)' }}>
        {successPercent}%
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>到着率</div>
      <div style={{ fontSize: 18, marginTop: 8, fontWeight: 700, color: 'var(--color-text)' }}>
        {getRankMessage(score.success_rate)}
      </div>
    </div>
  );
}
