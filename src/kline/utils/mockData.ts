import type { KLineData } from '../types';

/**
 * 生成 BTC/USDT 模拟 K 线数据
 * 使用随机游走模型 + 趋势模拟真实行情
 */
export function generateMockKLineData(count: number = 500): KLineData[] {
  const data: KLineData[] = [];
  const interval = 15 * 60 * 1000; // 15分钟
  const now = Date.now();
  let baseTime = now - count * interval;

  // 初始价格 ~67000 USDT
  let price = 67000;
  let trend = 0;
  let volatility = 0.003;

  for (let i = 0; i < count; i++) {
    // 随机切换趋势 (模拟市场情绪变化)
    if (Math.random() < 0.05) {
      trend = (Math.random() - 0.5) * 0.008;
      volatility = 0.002 + Math.random() * 0.004;
    }

    const change = trend + (Math.random() - 0.5) * volatility;
    price *= 1 + change;

    const open = price;
    const close = open * (1 + (Math.random() - 0.48) * volatility * 0.8);
    const highExtra = Math.random() * volatility * 0.5;
    const lowExtra = Math.random() * volatility * 0.5;
    const high = Math.max(open, close) * (1 + highExtra);
    const low = Math.min(open, close) * (1 - lowExtra);

    // 成交量与波动率正相关
    const baseVolume = 100 + Math.random() * 900;
    const volumeMultiplier = Math.abs(change) / volatility + 0.5;
    const volume = parseFloat((baseVolume * volumeMultiplier).toFixed(4));
    const turnover = parseFloat(((high + low) / 2 * volume).toFixed(2));

    data.push({
      timestamp: baseTime,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume,
      turnover,
    });

    price = close;
    baseTime += interval;
  }

  return data;
}
