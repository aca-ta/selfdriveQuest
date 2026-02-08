import { useState } from 'react';

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ fontSize: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: open ? 8 : 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
          {title}
        </span>
        <span
          onClick={() => setOpen(!open)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 14,
            height: 14,
            borderRadius: '50%',
            backgroundColor: open ? 'var(--color-primary)' : 'var(--color-neutral)',
            color: 'white',
            fontSize: 9,
            fontWeight: 'bold',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background-color 0.15s',
          }}
        >
          ?
        </span>
      </div>
      {open && (
        <div style={{
          fontSize: 11,
          backgroundColor: 'var(--color-neutral-light)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px 10px',
          lineHeight: 1.7,
          color: 'var(--color-text-secondary)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

export function AgentInfoPanel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <InfoSection title="エージェント仕様">
        <section>
          <div style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: 2 }}>入力 (観測)</div>
          <div>車の周囲 5x5 マスの視界 x 3ch</div>
          <ul style={{ margin: '2px 0', paddingLeft: 18 }}>
            <li>ch1: 壁・境界</li>
            <li>ch2: ゴール</li>
            <li>ch3: 訪問済み</li>
          </ul>
          <div>+ ゴールへの方向 (dx, dy)</div>
          <div style={{ color: 'var(--color-neutral)', fontFamily: 'monospace', fontSize: 10 }}>合計 77 次元</div>
        </section>

        <section>
          <div style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: 2 }}>出力 (行動)</div>
          <div>4方向: 上 / 右 / 下 / 左</div>
        </section>

        <section>
          <div style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: 2 }}>報酬</div>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              {[
                ['ゴール到達', '+1.0', 'var(--color-success)'],
                ['通常の移動', '-0.01', 'var(--color-text-secondary)'],
                ['再訪問', '-0.05', 'var(--color-warning)'],
                ['逆走 (Uターン)', '-0.2', 'var(--color-warning)'],
                ['壁・境界に衝突', '-0.6', 'var(--color-danger)'],
              ].map(([label, val, color]) => (
                <tr key={label}>
                  <td style={{ padding: '1px 0' }}>{label}</td>
                  <td style={{ padding: '1px 0', textAlign: 'right', fontFamily: 'monospace', color }}>{val}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </InfoSection>

      <InfoSection title="学習エンジン">
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {[
              ['アルゴリズム', 'DQN (Deep Q-Network)'],
              ['リプレイバッファ', '50k〜150k (自動)'],
              ['バッチサイズ', '64'],
              ['ターゲット更新', 'Soft (τ=0.01)'],
              ['追加学習時ε初期値', '0.2'],
            ].map(([label, val]) => (
              <tr key={label}>
                <td style={{ padding: '1px 0' }}>{label}</td>
                <td style={{ padding: '1px 0', textAlign: 'right', fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>{val}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </InfoSection>
    </div>
  );
}
