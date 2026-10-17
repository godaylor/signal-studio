import { describe, expect, test } from 'vitest';
import { createChartScale } from './chartScale';

describe('Signed metric chart scale', () => {
  test('positive counts keep a zero baseline and original line proportions', () => {
    const scale = createChartScale([0, 25, 100]);
    expect([scale.min, scale.max, scale.zero]).toEqual([0, 100, 0]);
    expect(scale.bar(25)).toEqual({ left: 0, width: 25 });
    expect([scale.lineY(0), scale.lineY(100)]).toEqual([92, 14]);
  });
  test('refund-only periods extend left from zero and remain inside the line plot', () => {
    const scale = createChartScale([-100, -25]);
    expect([scale.min, scale.max, scale.zero]).toEqual([-100, 0, 100]);
    expect(scale.bar(-25)).toEqual({ left: 75, width: 25 });
    expect([scale.lineY(-100), scale.lineY(0)]).toEqual([92, 14]);
  });
  test('mixed current and comparison values share one proportional zero baseline', () => {
    const scale = createChartScale([-30, 70, -10, 50]);
    expect(scale.zero).toBe(30);
    expect(scale.bar(-30)).toEqual({ left: 0, width: 30 });
    expect(scale.bar(70)).toEqual({ left: 30, width: 70 });
    expect(scale.bar(0)).toEqual({ left: 30, width: 0 });
    expect(scale.ticks).toContain(0);
  });
  test('all-zero and empty results have a finite scale and no invented bars', () => {
    for (const values of [[], [0, 0]]) {
      const scale = createChartScale(values);
      expect([scale.min, scale.max, scale.zero]).toEqual([0, 1, 0]);
      expect(scale.bar(0)).toEqual({ left: 0, width: 0 });
      expect(scale.lineY(0)).toBe(92);
    }
  });
});
