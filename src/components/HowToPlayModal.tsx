import { useState } from 'react';

interface HowToPlayModalProps {
  onClose: () => void;
}

const steps = [
  {
    emoji: '🛣️',
    title: 'コースを作ろう',
    desc: 'マス目をクリック（タップ）すると道路になるよ。ドラッグでまとめて描ける！',
    tip: '🚗 と 🏁 はドラッグで動かせるよ',
  },
  {
    emoji: '🧠',
    title: 'AIに学習させよう',
    desc: '「学習する」を押すと、AIの車が何回もコースを走って道を覚えるよ。',
    tip: 'コースを2〜3個作ると、いろんな道に対応できるようになるよ',
  },
  {
    emoji: '🏆',
    title: '実力を試そう',
    desc: '「実力を試す」を押すと、AIが見たことないコースで走るよ。最短ルートに近いほど高得点！',
    tip: 'うまくいかなかったら、コースを変えてもう一回学習しよう',
  },
  {
    emoji: '💪',
    title: 'もっと強くしよう',
    desc: 'コースの形を変えたり、数を増やしたりして追加トレーニング！パラメータも調整してみよう。',
    tip: 'モデルは3つまで保存できるよ。いろんな作戦を試そう！',
  },
];

const techItems: [string, string][] = [
  ['エージェント', 'DQN (Dense 128→128→4). Policy + Target network、ソフト更新 (τ=0.01)'],
  ['観測空間', '5×5 視野 × 3ch (壁, ゴール, 訪問済) + ゴール方向 = 77次元'],
  ['報酬設計', 'ゴール +1.0 / 壁衝突 -0.6 / Uターン -0.2 / 再訪問 -0.05 / 1歩 -0.01'],
  ['学習方式', '2フェーズ: 逐次実行 (最初2ep、可視化付) → 並列実行 (8環境同時)。直近30ep全成功で早期終了'],
  ['経験リプレイ', 'バッファ 50k–150k (自動調整)、バッチサイズ 64'],
  ['テスト評価', 'シード付きランダム迷路10問。BFS最短経路との比較でスコア算出'],
  ['アーキテクチャ', 'React 19 + TensorFlow.js。ML処理はすべてWeb Worker (CPUバックエンド) で実行'],
  ['データ保存', 'IndexedDB にモデル重み＋メタデータを保存。3スロット'],
];

function TechSection() {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginTop: 16 }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          fontSize: 12, color: 'var(--color-text-secondary)',
          padding: '6px 0', userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 10, transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'none' }}>
          ▶
        </span>
        <span style={{ fontWeight: 600 }}>技術詳細</span>
      </div>
      {open && (
        <div style={{
          fontSize: 11, lineHeight: 1.7,
          backgroundColor: 'var(--color-neutral-light)',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 12px',
          color: 'var(--color-text-secondary)',
        }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              {techItems.map(([label, val]) => (
                <tr key={label}>
                  <td style={{ padding: '3px 8px 3px 0', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                    {label}
                  </td>
                  <td style={{ padding: '3px 0', fontFamily: 'monospace', fontSize: 10 }}>
                    {val}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--color-neutral)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>src/engine/ — フレームワーク非依存のMLエンジン (Worker) / src/components/ — React UI</span>
            <a
              href="https://github.com/aca-ta/selfdriveQuest"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap', marginLeft: 12 }}
            >
              GitHub ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export function HowToPlayModal({ onClose }: HowToPlayModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 600, textAlign: 'left' }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 12, right: 12,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 20, color: 'var(--color-text-secondary)', lineHeight: 1,
          }}
          aria-label="閉じる"
        >
          &times;
        </button>

        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 32, marginBottom: 4 }}>🚗</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)' }}>
            遊び方
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
            AIの車に道を覚えさせて、賢い自動運転を作ろう！
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {steps.map((step, i) => (
            <div key={i} className="how-to-play-step">
              <div className="how-to-play-number">{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 22 }}>{step.emoji}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text)' }}>
                    {step.title}
                  </span>
                </div>
                <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                  {step.desc}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-accent)', marginTop: 4 }}>
                  💡 {step.tip}
                </div>
              </div>
            </div>
          ))}
        </div>

        <TechSection />

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button className="btn btn-primary btn-lg" onClick={onClose}>
            さっそく始める！
          </button>
        </div>
      </div>
    </div>
  );
}
