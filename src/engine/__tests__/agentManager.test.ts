import { describe, it, expect, vi } from 'vitest';
import { resolveAgent } from '../agentManager';
import type { DQNAgent } from '../agent';

function mockAgent(): DQNAgent {
  return { dispose: vi.fn() } as unknown as DQNAgent;
}

describe('resolveAgent', () => {
  it('fresh=true + 既存agent → dispose して新規作成', () => {
    const old = mockAgent();
    const created = mockAgent();
    const createFn = vi.fn(() => created);

    const result = resolveAgent(old, true, createFn);

    expect(old.dispose).toHaveBeenCalledOnce();
    expect(createFn).toHaveBeenCalledOnce();
    expect(result).toBe(created);
  });

  it('fresh=undefined + 既存agent → 既存を再利用', () => {
    const old = mockAgent();
    const createFn = vi.fn();

    const result = resolveAgent(old, undefined, createFn);

    expect(old.dispose).not.toHaveBeenCalled();
    expect(createFn).not.toHaveBeenCalled();
    expect(result).toBe(old);
  });

  it('fresh=false + 既存agent → 既存を再利用', () => {
    const old = mockAgent();
    const createFn = vi.fn();

    const result = resolveAgent(old, false, createFn);

    expect(old.dispose).not.toHaveBeenCalled();
    expect(createFn).not.toHaveBeenCalled();
    expect(result).toBe(old);
  });

  it('agent=null → 新規作成', () => {
    const created = mockAgent();
    const createFn = vi.fn(() => created);

    const result = resolveAgent(null, undefined, createFn);

    expect(createFn).toHaveBeenCalledOnce();
    expect(result).toBe(created);
  });

  it('agent=null + fresh=true → 新規作成（dispose は呼ばれない）', () => {
    const created = mockAgent();
    const createFn = vi.fn(() => created);

    const result = resolveAgent(null, true, createFn);

    expect(createFn).toHaveBeenCalledOnce();
    expect(result).toBe(created);
  });
});
