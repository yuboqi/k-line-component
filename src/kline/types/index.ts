// ========== Core Data Types ==========

/** K线数据 (OHLCV) */
export interface KLineData {
  timestamp: number;   // 毫秒级时间戳
  open: number;        // 开盘价
  high: number;        // 最高价
  low: number;         // 最低价
  close: number;       // 收盘价
  volume?: number;     // 成交量
  turnover?: number;   // 成交额
}

/** 涨跌方向 */
export type Trend = 'up' | 'down' | 'flat';

/** 时间周期类型 */
export type PeriodType = 'minute' | 'hour' | 'day' | 'week' | 'month';

/** 时间周期 */
export interface Period {
  type: PeriodType;
  span: number; // e.g. 15 for 15m, 4 for 4h
}

// ========== Indicator Types ==========

/** 指标系列类型 - 决定渲染位置 */
export type IndicatorSeries = 'price' | 'volume' | 'normal';

/** 指图图形类型 */
export type FigureType = 'line' | 'bar' | 'circle';

/** 指标图形定义 */
export interface IndicatorFigure {
  key: string;
  type: FigureType;
  color?: string;
  baseValue?: number; // for bar type (e.g. MACD histogram)
}

/** 指标结果 - key 为 timestamp */
export type IndicatorResult<T = Record<string, number>> = Record<number, T>;

/** 指标模板 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface IndicatorTemplate<T = any, C = number[], F = IndicatorFigure> {
  name: string;
  shortName: string;
  series: IndicatorSeries;
  calcParams: C;
  precision: number;
  figures: F[];
  calc: (dataList: KLineData[]) => IndicatorResult<T>;
}

// ========== Theme Types ==========

export interface KLineTheme {
  background: string;
  textColor: string;
  textFont: string;
  gridColor: string;
  crosshairColor: string;
  crosshairTextColor: string;
  crosshairTextBg: string;
  upColor: string;
  downColor: string;
  upWickColor: string;
  downWickColor: string;
  maColors: string[];
  bollColors: string[];
  macdDifColor: string;
  macdDeaColor: string;
  macdBarUpColor: string;
  macdBarDownColor: string;
  rsiColors: string[];
  kdjColors: string[];
  volMaColors: string[];
}

// ========== Chart State Types ==========

export interface ViewRange {
  startIndex: number;
  endIndex: number;
}

export interface CrosshairState {
  x: number | null;
  y: number | null;
  dataIndex: number | null;
}

export interface PaneInfo {
  y: number;
  height: number;
  type: 'main' | 'volume' | 'indicator';
  indicatorName?: string;
}
