import { describe, expect, it } from 'vitest';
import { ago } from '../notifications';

const now = new Date('2026-11-04T12:00:00Z').getTime();

describe('ago', () => {
  it('formate le temps écoulé', () => {
    expect(ago('2026-11-04T11:59:40Z', now)).toBe('à l’instant');
    expect(ago('2026-11-04T11:55:00Z', now)).toBe('il y a 5 min');
    expect(ago('2026-11-04T09:00:00Z', now)).toBe('il y a 3 h');
    expect(ago('2026-11-03T09:00:00Z', now)).toBe('hier');
  });
});
