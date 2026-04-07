import type { KLineData, IndicatorTemplate } from '../types';

// ========== MACD ==========

interface MacdResult { dif: number; dea: number; macd: number }

export const MACD: IndicatorTemplate<MacdResult> = {
  name: 'MACD',
  shortName: 'MACD',
  series: 'normal',
  calcParams: [12, 26, 9],
  precision: 4,
  figures: [
    { key: 'dif', type: 'line' },
    { key: 'dea', type: 'line' },
    { key: 'macd', type: 'bar', baseValue: 0 as number },
  ],
  calc(dataList: KLineData[]): Record<number, MacdResult> {
    const result: Record<number, MacdResult> = {};
    const [fast, slow, signal] = this.calcParams;

    // Calculate EMAs
    const emaFast: number[] = [];
    const emaSlow: number[] = [];
    const deas: number[] = [];

    for (let i = 0; i < dataList.length; i++) {
      const close = dataList[i].close;

      // EMA fast
      if (i === 0) {
        emaFast.push(close);
      } else {
        emaFast.push(close * (2 / (fast + 1)) + emaFast[i - 1] * (1 - 2 / (fast + 1)));
      }

      // EMA slow
      if (i === 0) {
        emaSlow.push(close);
      } else {
        emaSlow.push(close * (2 / (slow + 1)) + emaSlow[i - 1] * (1 - 2 / (slow + 1)));
      }

      const dif = emaFast[i] - emaSlow[i];

      // DEA (signal line of DIF)
      if (i === 0) {
        deas.push(dif);
      } else {
        deas.push(dif * (2 / (signal + 1)) + deas[i - 1] * (1 - 2 / (signal + 1)));
      }

      const macd = (dif - deas[i]) * 2;

      result[dataList[i].timestamp] = {
        dif: parseFloat(dif.toFixed(this.precision)),
        dea: parseFloat(deas[i].toFixed(this.precision)),
        macd: parseFloat(macd.toFixed(this.precision)),
      };
    }
    return result;
  },
};

// ========== RSI (Relative Strength Index) ==========

interface RsiResult { rsi1: number; rsi2: number; rsi3: number }

export const RSI: IndicatorTemplate<RsiResult> = {
  name: 'RSI',
  shortName: 'RSI',
  series: 'normal',
  calcParams: [6, 12, 24],
  precision: 2,
  figures: [
    { key: 'rsi1', type: 'line' },
    { key: 'rsi2', type: 'line' },
    { key: 'rsi3', type: 'line' },
  ],
  calc(dataList: KLineData[]): Record<number, RsiResult> {
    const result: Record<number, RsiResult> = {};
    const params = this.calcParams;

    for (const period of params) {
      let gainSum = 0;
      let lossSum = 0;
      let avgGain = 0;
      let avgLoss = 0;

      for (let i = 0; i < dataList.length; i++) {
        const prevClose = dataList[i - 1] !== undefined ? dataList[i - 1].close : 0;
        const change = dataList[i].close - prevClose;
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;

        if (i === 0) {
          continue;
        } else if (i < period) {
          gainSum += gain;
          lossSum += loss;
        } else if (i === period) {
          gainSum += gain;
          lossSum += loss;
          avgGain = gainSum / period;
          avgLoss = lossSum / period;
        } else {
          avgGain = (avgGain * (period - 1) + gain) / period;
          avgLoss = (avgLoss * (period - 1) + loss) / period;
        }

        if (i >= period) {
          const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
          const rsi = 100 - 100 / (1 + rs);
          const key = `rsi${params.indexOf(period) + 1}` as keyof RsiResult;
          if (!result[dataList[i].timestamp]) {
            result[dataList[i].timestamp] = { rsi1: 0, rsi2: 0, rsi3: 0 };
          }
          result[dataList[i].timestamp][key] = parseFloat(rsi.toFixed(this.precision));
        }
      }
    }
    return result;
  },
};

// ========== KDJ (Stochastic Oscillator) ==========

interface KdjResult { k: number; d: number; j: number }

export const KDJ: IndicatorTemplate<KdjResult> = {
  name: 'KDJ',
  shortName: 'KDJ',
  series: 'normal',
  calcParams: [9, 3, 3],
  precision: 2,
  figures: [
    { key: 'k', type: 'line' },
    { key: 'd', type: 'line' },
    { key: 'j', type: 'line' },
  ],
  calc(dataList: KLineData[]): Record<number, KdjResult> {
    const result: Record<number, KdjResult> = {};
    const [period] = this.calcParams;

    let prevK = 50;
    let prevD = 50;

    for (let i = 0; i < dataList.length; i++) {
      if (i < period - 1) {
        result[dataList[i].timestamp] = { k: 50, d: 50, j: 50 };
        continue;
      }

      let highest = -Infinity;
      let lowest = Infinity;
      for (let j = i - period + 1; j <= i; j++) {
        highest = Math.max(highest, dataList[j].high);
        lowest = Math.min(lowest, dataList[j].low);
      }

      const rsv = highest === lowest ? 50 : ((dataList[i].close - lowest) / (highest - lowest)) * 100;
      const k = (2 / 3) * prevK + (1 / 3) * rsv;
      const d = (2 / 3) * prevD + (1 / 3) * k;
      const j = 3 * k - 2 * d;

      prevK = k;
      prevD = d;

      result[dataList[i].timestamp] = {
        k: parseFloat(k.toFixed(this.precision)),
        d: parseFloat(d.toFixed(this.precision)),
        j: parseFloat(j.toFixed(this.precision)),
      };
    }
    return result;
  },
};
