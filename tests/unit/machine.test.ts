import { describe, expect, it } from 'vitest';
import { canTransition, transition } from '../../src/state/machine';

describe('狀態機', () => {
  it('完整流程', () => {
    let s = transition('input', 'SUBMIT_WANTED');
    expect(s).toBe('paint');
    s = transition(s, 'START_DUEL');
    expect(s).toBe('prep');
    s = transition(s, 'BEGIN_BATTLE');
    expect(s).toBe('battle');
    expect(transition(s, 'PAUSE')).toBe('paused');
    expect(transition('paused', 'RESUME')).toBe('battle');
    s = transition(s, 'END_ROUND');
    expect(s).toBe('apology');
    s = transition(s, 'APOLOGY_DONE');
    expect(transition(s, 'REMATCH')).toBe('prep');
    expect(transition(s, 'NEW_JERK')).toBe('input');
  });
  it('回上一步', () => {
    expect(transition('paint', 'BACK')).toBe('input');
    expect(transition('prep', 'BACK')).toBe('paint');
  });
  it('不合法的事件不改變狀態', () => {
    expect(transition('input', 'END_ROUND')).toBe('input');
    expect(canTransition('apology', 'PAUSE')).toBe(false);
  });
});
