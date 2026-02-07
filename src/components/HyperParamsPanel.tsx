import { useMemo, useState } from 'react';
import type { HyperParams } from '../types';

interface HyperParamsPanelProps {
  value: HyperParams;
  onChange: (hp: HyperParams) => void;
  disabled: boolean;
}

interface Preset {
  name: string;
  icon: string;
  params: HyperParams;
}

const PRESETS: Preset[] = [
  {
    name: '少し学習',
    icon: '🚗',
    params: { maxEpisodes: 100, lr: 0.0005, gamma: 0.9, epsilonEnd: 0.15, epsilonDecayEpisodes: 80, revisitPenalty: 0.05 },
  },
  {
    name: 'バランス型',
    icon: '⚖️',
    params: { maxEpisodes: 300, lr: 0.001, gamma: 0.95, epsilonEnd: 0.1, epsilonDecayEpisodes: 250, revisitPenalty: 0.05 },
  },
  {
    name: 'じっくり学習',
    icon: '🏎️',
    params: { maxEpisodes: 500, lr: 0.003, gamma: 0.99, epsilonEnd: 0.05, epsilonDecayEpisodes: 400, revisitPenalty: 0.05 },
  },
];

export const DEFAULT_HYPER_PARAMS: HyperParams = PRESETS[1].params;

interface SliderDef {
  label: string;
  key: keyof HyperParams;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  infoKids: string;
  infoTech: string;
}

const SLIDERS: SliderDef[] = [
  { label: '練習回数', key: 'maxEpisodes', min: 50, max: 500, step: 50, format: v => `${v}回`,
    infoKids: '何回コースを走って練習するか。多いほど上手になるけど時間がかかるよ',
    infoTech: 'max_episodes: 学習エピソード数。早期停止（直近30ep全成功 & stdev<2）で途中終了あり' },
  { label: '学習のコツ', key: 'lr', min: 0.0001, max: 0.01, step: 0.0001, format: v => v.toFixed(4),
    infoKids: '1回の経験からどれだけ学ぶか。大きいと速く覚えるけど不安定、小さいとじっくり安定して学ぶよ',
    infoTech: 'learning_rate (Adam): 勾配降下の更新幅。大きすぎると発散、小さすぎると収束が遅い' },
  { label: '先のことを考える力', key: 'gamma', min: 0.9, max: 0.999, step: 0.001, format: v => v.toFixed(3),
    infoKids: '目の前のことだけ考えるか、先のゴールまで見通すか。大きいほど遠くのゴールを意識するよ',
    infoTech: 'discount factor (γ): 将来報酬の割引率。1に近いほど長期的報酬を重視。Q(s,a) = r + γ max Q(s\',a\')' },
  { label: 'チャレンジ精神', key: 'epsilonEnd', min: 0.01, max: 0.2, step: 0.01, format: v => `${(v * 100).toFixed(0)}%`,
    infoKids: 'どれくらい冒険するか。大きいと新しい道を試すけど失敗も増える、小さいと安全な道ばかり選ぶよ',
    infoTech: 'ε-greedy の最終ε値。1.0からこの値まで線形減衰。exploration-exploitation トレードオフ' },
  { label: '新しい道を探す力', key: 'revisitPenalty', min: 0.01, max: 0.3, step: 0.01, format: v => v.toFixed(2),
    infoKids: '一度通った道をもう一度通るのをどれくらいいやがるか。大きいほど新しい道を探すけど、遠回りしやすくなるよ',
    infoTech: 'revisit_penalty: 再訪問セルへの負の報酬。高いと探索的だがQ値が不安定になりうる。壁衝突(-0.6)>逆走(-0.2)>この値' },
];

function matchesPreset(hp: HyperParams, preset: HyperParams): boolean {
  return (
    hp.maxEpisodes === preset.maxEpisodes &&
    hp.lr === preset.lr &&
    hp.gamma === preset.gamma &&
    hp.epsilonEnd === preset.epsilonEnd &&
    hp.epsilonDecayEpisodes === preset.epsilonDecayEpisodes &&
    hp.revisitPenalty === preset.revisitPenalty
  );
}

// epsilonDecayEpisodes を maxEpisodes の 2/3 に自動連動
function withDecay(hp: HyperParams): HyperParams {
  return { ...hp, epsilonDecayEpisodes: Math.round(hp.maxEpisodes * 2 / 3) };
}

function SliderList({ sliders, value, disabled, onChange }: {
  sliders: SliderDef[];
  value: HyperParams;
  disabled: boolean;
  onChange: (hp: HyperParams) => void;
}) {
  const [openInfo, setOpenInfo] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {sliders.map(s => (
        <div key={s.key}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              {s.label}
            </span>
            <span
              onClick={() => setOpenInfo(openInfo === s.key ? null : s.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 14,
                height: 14,
                borderRadius: '50%',
                backgroundColor: openInfo === s.key ? 'var(--color-primary)' : 'var(--color-neutral)',
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
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text)' }}>
              {s.format(value[s.key])}
            </span>
          </div>
          <input
            type="range"
            min={s.min}
            max={s.max}
            step={s.step}
            value={value[s.key]}
            disabled={disabled}
            onChange={e => {
              const updated = { ...value, [s.key]: parseFloat(e.target.value) };
              onChange(s.key === 'maxEpisodes' ? withDecay(updated) : updated);
            }}
            style={{ width: '100%' }}
          />
          {openInfo === s.key && (
            <div style={{
              fontSize: 11,
              backgroundColor: 'var(--color-neutral-light)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 8px',
              marginTop: 4,
              lineHeight: 1.6,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}>
              <div style={{ color: 'var(--color-text)' }}>{s.infoKids}</div>
              <div style={{ color: 'var(--color-neutral)', fontFamily: 'monospace', fontSize: 10 }}>{s.infoTech}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function HyperParamsPanel({ value, onChange, disabled }: HyperParamsPanelProps) {
  const activePreset = useMemo(
    () => PRESETS.findIndex(p => matchesPreset(value, p.params)),
    [value],
  );

  return (
    <div style={{ fontSize: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8 }}>学習パラメータ</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {PRESETS.map((p, i) => (
          <button
            key={p.name}
            onClick={() => onChange(p.params)}
            disabled={disabled}
            className={`btn-chip${activePreset === i ? ' active' : ''}`}
            style={{ padding: '3px 10px', fontSize: 12 }}
          >
            {p.icon} {p.name}
          </button>
        ))}
        {activePreset === -1 && (
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 12, alignSelf: 'center' }}>
            カスタム
          </span>
        )}
      </div>
      <SliderList sliders={SLIDERS} value={value} disabled={disabled} onChange={onChange} />
    </div>
  );
}
