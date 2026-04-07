import type { KLineData, Trend } from '../types';

/** 判断涨跌 */
export function getTrend(data: KLineData): Trend {
  if (data.close > data.open) return 'up';
  if (data.close < data.open) return 'down';
  return 'flat';
}

/** 格式化价格 */
export function formatPrice(price: number, precision = 2): string {
  return price.toFixed(precision);
}

/** 格式化成交量 */
export function formatVolume(vol: number): string {
  if (vol >= 1e9) return (vol / 1e9).toFixed(2) + 'B';
  if (vol >= 1e6) return (vol / 1e6).toFixed(2) + 'M';
  if (vol >= 1e3) return (vol / 1e3).toFixed(2) + 'K';
  return vol.toFixed(2);
}

/** 格式化时间戳 */
export function formatTime(timestamp: number, period: string): string {
  const d = new Date(timestamp);
  const pad = (n: number) => n.toString().padStart(2, '0');

  if (['1d', '1w', '1M'].includes(period)) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  if (period.endsWith('h') || period.endsWith('H')) {
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 格式化完整日期时间 */
export function formatDateTime(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 计算合适的小数精度 */
export function calcPricePrecision(prices: number[]): number {
  let maxDecimals = 2;
  for (const p of prices) {
    const s = p.toString();
    const dot = s.indexOf('.');
    if (dot !== -1) {
      maxDecimals = Math.max(maxDecimals, s.length - dot - 1);
    }
  }
  return Math.min(maxDecimals, 8);
}

/** 计算 Y 轴刻度 */
export function calcYAxisTicks(
  min: number,
  max: number,
  precision: number,
  tickCount = 5
): number[] {
  const range = max - min;
  if (range === 0) return [min];
  const rawStep = range / tickCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;

  let niceStep: number;
  if (residual <= 1.5) niceStep = magnitude;
  else if (residual <= 3.5) niceStep = 2 * magnitude;
  else if (residual <= 7.5) niceStep = 5 * magnitude;
  else niceStep = 10 * magnitude;

  const ticks: number[] = [];
  let tick = Math.ceil(min / niceStep) * niceStep;
  while (tick <= max) {
    ticks.push(parseFloat(tick.toFixed(precision)));
    tick += niceStep;
  }
  return ticks;
}
