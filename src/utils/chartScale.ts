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

/**
 * Evenly spaced, round axis ticks from 0 to the scale's maximum, at most
 * `maxTicks` of them, with as many decimals as the step needs ("4", not "4.0").
 */
export function chartTicks(
  rawMax: number,
  maxTicks = 6,
): { ticks: number[]; yMax: number; decimals: number } {
  const { step: baseStep, yMax: baseMax } = computeChartScale(rawMax);
  let step = baseStep;
  while (baseMax / step + 1 > maxTicks) step *= 2;
  const yMax = Math.ceil(baseMax / step - 1e-9) * step;
  const decimals = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  // Sub-integer steps like 0.25 or 0.02 need one more digit than log10 suggests.
  const needed =
    Number(step.toFixed(decimals)) === step ? decimals : decimals + 1;
  const ticks: number[] = [];
  for (let i = 0; i * step <= yMax + 1e-9; i++) {
    ticks.push(Number((i * step).toFixed(needed + 2)));
  }
  return { ticks, yMax, decimals: needed };
}
