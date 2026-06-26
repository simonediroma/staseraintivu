import { describe, it, expect } from 'vitest';
import { tonightWindow } from './prime-time';

describe('tonightWindow (smoke — modulo portato)', () => {
  it('ritorna { from, to } con date valide e from < to', () => {
    const w = tonightWindow('2026-06-26', 'Europe/Rome');
    expect(w.from).toBeInstanceOf(Date);
    expect(w.to).toBeInstanceOf(Date);
    expect(Number.isNaN(w.from.getTime())).toBe(false);
    expect(Number.isNaN(w.to.getTime())).toBe(false);
    expect(w.from.getTime()).toBeLessThan(w.to.getTime());
  });

  it('mappa la prima serata estiva (Rome +2): 20:30 → 18:30 UTC', () => {
    const w = tonightWindow('2026-06-26', 'Europe/Rome');
    expect(w.from.toISOString()).toBe('2026-06-26T18:30:00.000Z');
    expect(w.to.toISOString()).toBe('2026-06-27T00:00:00.000Z');
  });
});
