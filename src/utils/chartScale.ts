export function computeChartScale(rawMax: number): {
  step: number;
  yMax: number;
  precision: number;
} {
  // NaN, Infinity or negative input would otherwise produce a NaN axis.
  const maxValue = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : 0;
  const step =
    maxValue <= 0.1
      ? 0.02
      : maxValue <= 0.5
        ? 0.1
        : maxValue <= 1
          ? 0.2
          : maxValue <= 2
            ? 0.5
            : maxValue <= 5
              ? 1
              : maxValue <= 20
                ? 2
                : maxValue <= 50
                  ? 5
                  : maxValue <= 100
                    ? 10
                    : maxValue <= 200
                      ? 20
                      : maxValue <= 500
                        ? 50
                        : 100;
  const yMax = Math.max(step, Math.ceil(maxValue / step) * step);
  const precision = maxValue < 1 ? 2 : maxValue < 10 ? 1 : 0;
  return { step, yMax, precision };
}
