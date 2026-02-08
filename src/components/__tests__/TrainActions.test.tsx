// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrainActions } from '../TrainActions';

describe('TrainActions', () => {
  const onContinueTrain = vi.fn();
  const onFreshTrain = vi.fn();

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('modelReady=false（モデル未ロード）', () => {
    it('「学習する」ボタンが1つだけ表示される', () => {
      render(
        <TrainActions modelReady={false} disabled={false} onContinueTrain={onContinueTrain} onFreshTrain={onFreshTrain} />,
      );

      expect(screen.getByRole('button', { name: '学習する' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '追加学習する' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '0から学習する' })).not.toBeInTheDocument();
    });

    it('「学習する」クリックで onFreshTrain が呼ばれる（0から学習）', async () => {
      render(
        <TrainActions modelReady={false} disabled={false} onContinueTrain={onContinueTrain} onFreshTrain={onFreshTrain} />,
      );

      await userEvent.click(screen.getByRole('button', { name: '学習する' }));

      expect(onFreshTrain).toHaveBeenCalledOnce();
      expect(onContinueTrain).not.toHaveBeenCalled();
    });
  });

  describe('modelReady=true（モデルロード済み）', () => {
    it('「追加学習する」と「0から学習する」の2つが表示される', () => {
      render(
        <TrainActions modelReady={true} disabled={false} onContinueTrain={onContinueTrain} onFreshTrain={onFreshTrain} />,
      );

      expect(screen.getByRole('button', { name: '追加学習する' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '0から学習する' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '学習する' })).not.toBeInTheDocument();
    });

    it('「追加学習する」クリックで onContinueTrain が呼ばれる', async () => {
      render(
        <TrainActions modelReady={true} disabled={false} onContinueTrain={onContinueTrain} onFreshTrain={onFreshTrain} />,
      );

      await userEvent.click(screen.getByRole('button', { name: '追加学習する' }));

      expect(onContinueTrain).toHaveBeenCalledOnce();
      expect(onFreshTrain).not.toHaveBeenCalled();
    });

    it('「0から学習する」クリックで onFreshTrain が呼ばれる', async () => {
      render(
        <TrainActions modelReady={true} disabled={false} onContinueTrain={onContinueTrain} onFreshTrain={onFreshTrain} />,
      );

      await userEvent.click(screen.getByRole('button', { name: '0から学習する' }));

      expect(onFreshTrain).toHaveBeenCalledOnce();
      expect(onContinueTrain).not.toHaveBeenCalled();
    });
  });

  describe('disabled 状態', () => {
    it('disabled=true のとき全ボタンが無効化される', () => {
      const { rerender } = render(
        <TrainActions modelReady={false} disabled={true} onContinueTrain={onContinueTrain} onFreshTrain={onFreshTrain} />,
      );

      expect(screen.getByRole('button', { name: '学習する' })).toBeDisabled();

      rerender(
        <TrainActions modelReady={true} disabled={true} onContinueTrain={onContinueTrain} onFreshTrain={onFreshTrain} />,
      );

      expect(screen.getByRole('button', { name: '追加学習する' })).toBeDisabled();
      expect(screen.getByRole('button', { name: '0から学習する' })).toBeDisabled();
    });
  });
});
