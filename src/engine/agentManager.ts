import type { DQNAgent } from './agent';

/**
 * 学習開始時の agent 解決ロジック。
 * - fresh=true かつ既存 agent あり → dispose して新規作成
 * - それ以外で既存 agent あり → 再利用（追加学習）
 * - agent なし → 新規作成
 */
export function resolveAgent(
  current: DQNAgent | null,
  fresh: boolean | undefined,
  createFn: () => DQNAgent,
): DQNAgent {
  if (fresh && current) {
    current.dispose();
    current = null;
  }
  return current ?? createFn();
}
