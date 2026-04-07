import type { KLineData, IndicatorTemplate } from '../types';

// ========== VOL (Volume) ==========

interface VolResult {
  volume: number;
  ma1: number;
  ma2: number;
  ma3: number;
  isUp: boolean;
}

export const VOL: IndicatorTemplate<VolResult> = {
  name: 'VOL',
  shortName: 'VOL',
  series: 'volume',
  calcParams: [5, 10, 20],
  precision: 2,
  figures: [
    { key: 'ma1', type: 'line' },
    { key: 'ma2', type: 'line' },
    { key: 'ma3', type: 'line' },
  ],
  calc(dataList: KLineData[]): Record<number, VolResult> {
    const result: Record<number, VolResult> = {};
    const params = this.calcParams;

    for (let i = 0; i < dataList.length; i++) {
      const volume = dataList[i].volume ?? 0;
      const isUp = dataList[i].close >= dataList[i].open;

      const mas: (number | undefined)[] = [];
      for (const period of params) {
        if (i < period - 1) {
          mas.push(undefined);
        } else {
          let sum = 0;
          for (let j = i - period + 1; j <= i; j++) {
            sum += dataList[j].volume ?? 0;
          }
          mas.push(parseFloat((sum / period).toFixed(this.precision)));
        }
      }

      result[dataList[i].timestamp] = {
        volume,
        ma1: mas[0]!,
        ma2: mas[1]!,
        ma3: mas[2]!,
        isUp,
      };
    }
    return result;
  },
};

