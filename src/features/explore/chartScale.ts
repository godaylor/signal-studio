/** A shared signed domain keeps chart geometry and axis labels on the same scale. */
export function createChartScale(values: readonly number[]) {
  const finite = values.filter(Number.isFinite);
  const min = Math.min(0, ...finite);
  const observedMax = Math.max(0, ...finite);
  const max = observedMax === min ? min + 1 : observedMax;
  const position = (value: number) =>
    ((Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0)) - min) / (max - min)) * 100;
  const zero = position(0);
  const ticks = [...new Set([max, (max + min) / 2, 0, min])].sort((a, b) => b - a);
  return {
    min,
    max,
    zero,
    ticks,
    lineY: (value: number) => 92 - position(value) * 0.78,
    bar: (value: number) => {
      const end = position(value);
      return { left: Math.min(zero, end), width: Math.abs(end - zero) };
    },
  };
}
