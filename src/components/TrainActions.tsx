/**
 * 学習開始ボタン群。
 * modelReady に応じて「追加学習 / 0から学習」の2択 or 「学習する」1つを表示する。
 */
export function TrainActions({ modelReady, disabled, onContinueTrain, onFreshTrain }: {
  modelReady: boolean;
  disabled: boolean;
  onContinueTrain: () => void;
  onFreshTrain: () => void;
}) {
  if (modelReady) {
    return (
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn btn-success btn-lg" style={{ flex: 1 }} onClick={onContinueTrain} disabled={disabled}>
          追加学習する
        </button>
        <button className="btn btn-lg" style={{ flex: 1, background: 'var(--color-neutral)', color: '#fff' }} onClick={onFreshTrain} disabled={disabled}>
          0から学習する
        </button>
      </div>
    );
  }
  return (
    <button className="btn btn-success btn-lg" style={{ width: '100%', marginTop: 16 }} onClick={onFreshTrain} disabled={disabled}>
      学習する
    </button>
  );
}
