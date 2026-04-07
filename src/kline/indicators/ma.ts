import type { KLineData, IndicatorTemplate } from '../types';

// ========== MA (Simple Moving Average) ==========

interface MaResult { ma1: number; ma2: number; ma3: number; ma4: number }

export const MA: IndicatorTemplate<MaResult> = {
  name: 'MA',
  shortName: 'MA',
  series: 'price',
  calcParams: [5, 10, 30, 60],
  precision: 2,
  figures: [
    { key: 'ma1', type: 'line' },
    { key: 'ma2', type: 'line' },
    { key: 'ma3', type: 'line' },
    { key: 'ma4', type: 'line' },
  ],
  calc(dataList: KLineData[]): Record<number, MaResult> {
    const result: Record<number, MaResult> = {};
    const params = this.calcParams;

    for (let i = 0; i < dataList.length; i++) {
      const values: (number | undefined)[] = [];
      for (const period of params) {
        if (i < period - 1) {
          values.push(undefined);
        } else {
          let sum = 0;
          for (let j = i - period + 1; j <= i; j++) {
            sum += dataList[j].close;
          }
          values.push(parseFloat((sum / period).toFixed(this.precision)));
        }
      }
      result[dataList[i].timestamp] = {
        ma1: values[0]!,
        ma2: values[1]!,
        ma3: values[2]!,
        ma4: values[3]!,
      };
    }
    return result;
  },
};

// ========== EMA (Exponential Moving Average) ==========

interface EmaResult { ema1: number; ema2: number; ema3: number }

export const EMA: IndicatorTemplate<EmaResult> = {
  name: 'EMA',
  shortName: 'EMA',
  series: 'price',
  calcParams: [6, 12, 20],
  precision: 2,
  figures: [
    { key: 'ema1', type: 'line' },
    { key: 'ema2', type: 'line' },
    { key: 'ema3', type: 'line' },
  ],
  calc(dataList: KLineData[]): Record<number, EmaResult> {
    const result: Record<number, EmaResult> = {};
    const params = this.calcParams;
    const emas: number[][] = params.map(() => []);

    for (let i = 0; i < dataList.length; i++) {
      const close = dataList[i].close;
      for (let p = 0; p < params.length; p++) {
        const period = params[p];
        if (i < period - 1) {
          emas[p].push(close);
        } else if (i === period - 1) {
          let sum = 0;
          for (let j = 0; j < period; j++) sum += dataList[j].close;
          emas[p].push(sum / period);
        } else {
          const multiplier = 2 / (period + 1);
          emas[p].push((close - emas[p][i - 1]) * multiplier + emas[p][i - 1]);
        }
      }
      result[dataList[i].timestamp] = {
        ema1: parseFloat(emas[0][i].toFixed(this.precision)),
        ema2: parseFloat(emas[1][i].toFixed(this.precision)),
        ema3: parseFloat(emas[2][i].toFixed(this.precision)),
      };
    }
    return result;
  },
};

// ========== BOLL (Bollinger Bands) ==========

interface BollResult { up: number; mid: number; dn: number }

export const BOLL: IndicatorTemplate<BollResult> = {
  name: 'BOLL',
  shortName: 'BOLL',
  series: 'price',
  calcParams: [20, 2],
  precision: 2,
  figures: [
    { key: 'up', type: 'line' },
    { key: 'mid', type: 'line' },
    { key: 'dn', type: 'line' },
  ],
  calc(dataList: KLineData[]): Record<number, BollResult> {
    const result: Record<number, BollResult> = {};
    const [period, multiplier] = this.calcParams;

    for (let i = 0; i < dataList.length; i++) {
      if (i < period - 1) {
        result[dataList[i].timestamp] = { up: 0, mid: 0, dn: 0 };
        continue;
      }

      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += dataList[j].close;
      const mid = sum / period;

      let variance = 0;
      for (let j = i - period + 1; j <= i; j++) {
        variance += (dataList[j].close - mid) ** 2;
      }
      const std = Math.sqrt(variance / period);

      result[dataList[i].timestamp] = {
        up: parseFloat((mid + multiplier * std).toFixed(this.precision)),
        mid: parseFloat(mid.toFixed(this.precision)),
        dn: parseFloat((mid - multiplier * std).toFixed(this.precision)),
      };
    }
    return result;
  },
};
