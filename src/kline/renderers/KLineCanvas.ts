import type {
  KLineData,
  KLineTheme,
  CrosshairState,
  ViewRange,
  PaneInfo,
  IndicatorTemplate,
  IndicatorResult,
} from '../types';
import { getTrend, formatPrice, formatVolume, formatDateTime, calcYAxisTicks } from '../utils/format';

/** K线Canvas渲染引擎 */
export class KLineCanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = window.devicePixelRatio || 1;
  private data: KLineData[] = [];
  private theme: KLineTheme;
  private viewRange: ViewRange = { startIndex: 0, endIndex: 60 };
  private crosshair: CrosshairState = { x: null, y: null, dataIndex: null };
  private panes: PaneInfo[] = [];
  private pricePrecision = 2;

  // Layout constants
  private readonly INFO_BAR_HEIGHT = 22;
  private readonly Y_AXIS_WIDTH = 80;
  private readonly X_AXIS_HEIGHT = 24;
  private readonly CANDLE_GAP = 0.25;
  private readonly MIN_CANDLE_WIDTH = 3;

  // Indicator data cache
  private indicatorResults: Map<string, IndicatorResult> = new Map();
  private indicatorTemplates: Map<string, IndicatorTemplate> = new Map();

  constructor(canvas: HTMLCanvasElement, theme: KLineTheme) {
    this.ctx = canvas.getContext('2d')!;
    this.theme = theme;
  }

  setTheme(theme: KLineTheme) {
    this.theme = theme;
    this.render();
  }

  setData(data: KLineData[]) {
    this.data = data;
    if (data.length > 0) {
      const prices = data.flatMap(d => [d.high, d.low]);
      this.pricePrecision = prices.some(p => p < 1) ? 6 : 2;
    }
    // Set initial view to last N candles
    const visibleCount = Math.min(80, data.length);
    this.viewRange = {
      startIndex: Math.max(0, data.length - visibleCount),
      endIndex: data.length - 1,
    };
    this.render();
  }

  setIndicator(name: string, template: IndicatorTemplate, results: IndicatorResult) {
    this.indicatorTemplates.set(name, template);
    this.indicatorResults.set(name, results);
  }

  removeIndicator(name: string) {
    this.indicatorTemplates.delete(name);
    this.indicatorResults.delete(name);
  }

  setViewRange(range: ViewRange) {
    this.viewRange = range;
    this.render();
  }

  setCrosshair(state: CrosshairState) {
    this.crosshair = state;
    this.render();
  }

  getViewRange() { return this.viewRange; }
  getData() { return this.data; }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    const canvas = this.ctx.canvas;
    canvas.width = width * this.dpr;
    canvas.height = height * this.dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    this.ctx.scale(this.dpr, this.dpr);
    this.render();
  }

  /** Get candle width in pixels */
  getCandleWidth(): number {
    const visibleCount = this.viewRange.endIndex - this.viewRange.startIndex + 1;
    const chartWidth = this.width - this.Y_AXIS_WIDTH;
    return Math.max(this.MIN_CANDLE_WIDTH, chartWidth / visibleCount);
  }

  /** Get visible data */
  getVisibleData(): KLineData[] {
    return this.data.slice(this.viewRange.startIndex, this.viewRange.endIndex + 1);
  }

  /** Convert data index to x pixel position */
  indexToX(index: number): number {
    const candleWidth = this.getCandleWidth();
    const offset = index - this.viewRange.startIndex;
    return offset * candleWidth + candleWidth / 2;
  }

  /** Convert x pixel to data index */
  xToIndex(x: number): number {
    const candleWidth = this.getCandleWidth();
    return Math.round(x / candleWidth - 0.5) + this.viewRange.startIndex;
  }

  // ========== Main Render ==========

  render() {
    if (!this.width || !this.height || this.data.length === 0) return;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Background
    ctx.fillStyle = this.theme.background;
    ctx.fillRect(0, 0, this.width, this.height);

    // Top info bar (always shows latest candle)
    this.renderInfoBar(this.viewRange.endIndex);

    // Calculate pane layout (below info bar)
    this.calculatePanes();

    // Render each pane
    for (const pane of this.panes) {
      this.renderPane(pane);
    }

    // X axis (shared)
    this.renderXAxis();

    // Crosshair + detail panel (on top of everything)
    if (this.crosshair.x !== null) {
      this.renderCrosshairLines();
      this.renderCrosshairPriceTag();
      this.renderDetailPanel();
    }
  }

  // ========== Pane Layout ==========

  private calculatePanes() {
    this.panes = [];
    const topOffset = this.INFO_BAR_HEIGHT;
    const chartHeight = this.height - this.X_AXIS_HEIGHT - topOffset;

    // Main pane takes ~55%, volume ~15%, each indicator ~25%
    let remainingHeight = chartHeight;
    let currentY = topOffset;

    // Main pane
    const mainHeight = Math.floor(chartHeight * 0.55);
    this.panes.push({ y: currentY, height: mainHeight, type: 'main' });
    currentY += mainHeight;
    remainingHeight -= mainHeight;

    // Volume pane
    const volHeight = Math.floor(chartHeight * 0.15);
    this.panes.push({ y: currentY, height: volHeight, type: 'volume' });
    currentY += volHeight;
    remainingHeight -= volHeight;

    // Indicator panes
    const normalIndicators = Array.from(this.indicatorTemplates.entries())
      .filter(([, t]) => t.series === 'normal');
    const indicatorCount = normalIndicators.length;
    if (indicatorCount > 0) {
      const indHeight = Math.floor(remainingHeight / indicatorCount);
      for (let i = 0; i < normalIndicators.length; i++) {
        const [name] = normalIndicators[i];
        const isLast = i === indicatorCount - 1;
        const h = isLast ? remainingHeight : indHeight;
        this.panes.push({ y: currentY, height: h, type: 'indicator', indicatorName: name });
        currentY += h;
        remainingHeight -= h;
      }
    }
  }

  // ========== Render Individual Pane ==========

  private renderPane(pane: PaneInfo) {
    const ctx = this.ctx;
    const { y, height, type } = pane;
    const chartWidth = this.width - this.Y_AXIS_WIDTH;

    // Pane border
    ctx.strokeStyle = this.theme.gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + height);
    ctx.lineTo(this.width, y + height);
    ctx.stroke();

    // Grid lines
    ctx.strokeStyle = this.theme.gridColor;
    ctx.setLineDash([2, 2]);
    for (let i = 1; i < 4; i++) {
      const gy = y + (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(chartWidth, gy);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    if (type === 'main') {
      this.renderCandlesticks(pane);
      this.renderPriceIndicators(pane);
      this.renderYAxisPrice(pane);
    } else if (type === 'volume') {
      this.renderVolume(pane);
      this.renderYAxisVolume(pane);
    } else if (type === 'indicator' && pane.indicatorName) {
      this.renderIndicatorPane(pane);
    }
  }

  // ========== Candlestick Rendering ==========

  private renderCandlesticks(pane: PaneInfo) {
    const ctx = this.ctx;
    const { y, height } = pane;
    const visible = this.getVisibleData();
    if (visible.length === 0) return;

    const candleWidth = this.getCandleWidth();
    const bodyWidth = candleWidth * (1 - this.CANDLE_GAP);
    const wickWidth = Math.max(1, bodyWidth * 0.15);

    // Price range
    let minPrice = Infinity, maxPrice = -Infinity;
    for (const d of visible) {
      minPrice = Math.min(minPrice, d.low);
      maxPrice = Math.max(maxPrice, d.high);
    }
    // Add padding
    const range = maxPrice - minPrice || 1;
    minPrice -= range * 0.05;
    maxPrice += range * 0.05;

    const priceToY = (price: number) => y + (1 - (price - minPrice) / (maxPrice - minPrice)) * height;

    for (let i = 0; i < visible.length; i++) {
      const d = visible[i];
      const cx = this.indexToX(this.viewRange.startIndex + i);
      const trend = getTrend(d);

      const color = trend === 'up' ? this.theme.upColor : trend === 'down' ? this.theme.downColor : this.theme.textColor;
      const wickColor = trend === 'up' ? this.theme.upWickColor : trend === 'down' ? this.theme.downWickColor : this.theme.textColor;

      // Wick
      ctx.strokeStyle = wickColor;
      ctx.lineWidth = wickWidth;
      ctx.beginPath();
      ctx.moveTo(cx, priceToY(d.high));
      ctx.lineTo(cx, priceToY(d.low));
      ctx.stroke();

      // Body
      const openY = priceToY(d.open);
      const closeY = priceToY(d.close);
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(1, Math.abs(closeY - openY));

      ctx.fillStyle = color;
      if (trend === 'up') {
        // Hollow or filled - we use filled for dark theme
        ctx.fillRect(cx - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
      } else {
        ctx.fillRect(cx - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
      }
    }
  }

  // ========== Price Overlay Indicators (MA, EMA, BOLL) ==========

  private renderPriceIndicators(pane: PaneInfo) {
    const ctx = this.ctx;
    const { y, height } = pane;
    const visible = this.getVisibleData();
    if (visible.length === 0) return;

    let minPrice = Infinity, maxPrice = -Infinity;
    for (const d of visible) {
      minPrice = Math.min(minPrice, d.low);
      maxPrice = Math.max(maxPrice, d.high);
    }
    const range = maxPrice - minPrice || 1;
    minPrice -= range * 0.05;
    maxPrice += range * 0.05;

    const priceToY = (price: number) => y + (1 - (price - minPrice) / (maxPrice - minPrice)) * height;

    // Draw price indicators
    const priceIndicators = Array.from(this.indicatorTemplates.entries())
      .filter(([, t]) => t.series === 'price');

    for (const [name, template] of priceIndicators) {
      const results = this.indicatorResults.get(name);
      if (!results) continue;

      const colors = this.getIndicatorColors(name, template);

      for (let fi = 0; fi < template.figures.length; fi++) {
        const figure = template.figures[fi];
        if (figure.type !== 'line') continue;

        ctx.strokeStyle = colors[fi] || this.theme.textColor;
        ctx.lineWidth = 1;
        ctx.beginPath();

        let started = false;
        for (let i = 0; i < visible.length; i++) {
          const d = visible[i];
          const r = results[d.timestamp];
          if (!r) continue;

          const value = r[figure.key];
          if (value === undefined || value === 0) continue;

          const px = this.indexToX(this.viewRange.startIndex + i);
          const py = priceToY(value);

          if (!started) {
            ctx.moveTo(px, py);
            started = true;
          } else {
            ctx.lineTo(px, py);
          }
        }
        ctx.stroke();
      }
    }
  }

  // ========== Volume Rendering ==========

  private renderVolume(pane: PaneInfo) {
    const ctx = this.ctx;
    const { y, height } = pane;
    const visible = this.getVisibleData();
    if (visible.length === 0) return;

    const candleWidth = this.getCandleWidth();
    const bodyWidth = candleWidth * (1 - this.CANDLE_GAP);

    let maxVol = 0;
    for (const d of visible) {
      if (d.volume) maxVol = Math.max(maxVol, d.volume);
    }
    maxVol *= 1.1;

    const volToY = (vol: number) => y + height - (vol / maxVol) * height;

    // Draw volume bars
    for (let i = 0; i < visible.length; i++) {
      const d = visible[i];
      if (!d.volume) continue;

      const cx = this.indexToX(this.viewRange.startIndex + i);
      const trend = getTrend(d);
      const color = trend === 'up' ? this.theme.upColor : this.theme.downColor;

      const barTop = volToY(d.volume);
      const barHeight = y + height - barTop;

      ctx.fillStyle = color;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(cx - bodyWidth / 2, barTop, bodyWidth, barHeight);
      ctx.globalAlpha = 1;
    }

    // Draw volume MA lines
    const volResults = this.indicatorResults.get('VOL');
    const volTemplate = this.indicatorTemplates.get('VOL');
    if (volResults && volTemplate) {
      const colors = this.theme.volMaColors;
      for (let fi = 0; fi < volTemplate.figures.length; fi++) {
        const figure = volTemplate.figures[fi];
        if (figure.type !== 'line') continue;

        ctx.strokeStyle = colors[fi] || this.theme.textColor;
        ctx.lineWidth = 1;
        ctx.beginPath();

        let started = false;
        for (let i = 0; i < visible.length; i++) {
          const d = visible[i];
          const r = volResults[d.timestamp];
          if (!r) continue;

          const value = r[figure.key];
          if (value === undefined || value === 0) continue;

          const px = this.indexToX(this.viewRange.startIndex + i);
          const py = volToY(value);

          if (!started) {
            ctx.moveTo(px, py);
            started = true;
          } else {
            ctx.lineTo(px, py);
          }
        }
        ctx.stroke();
      }
    }
  }

  // ========== Indicator Pane Rendering ==========

  private renderIndicatorPane(pane: PaneInfo) {
    const ctx = this.ctx;
    const { y, height, indicatorName } = pane;
    const visible = this.getVisibleData();
    if (!visible.length || !indicatorName) return;

    const template = this.indicatorTemplates.get(indicatorName);
    const results = this.indicatorResults.get(indicatorName);
    if (!template || !results) return;

    // Find value range
    let minVal = Infinity, maxVal = -Infinity;
    for (const d of visible) {
      const r = results[d.timestamp];
      if (!r) continue;
      for (const figure of template.figures) {
        const v = r[figure.key];
        if (v !== undefined && v !== 0) {
          minVal = Math.min(minVal, v);
          maxVal = Math.max(maxVal, v);
        }
      }
    }
    if (!isFinite(minVal) || !isFinite(maxVal)) return;

    const range = maxVal - minVal || 1;
    minVal -= range * 0.05;
    maxVal += range * 0.05;

    const valToY = (val: number) => y + (1 - (val - minVal) / (maxVal - minVal)) * height;

    // Indicator name label
    ctx.fillStyle = this.theme.textColor;
    ctx.font = this.theme.textFont;
    ctx.fillText(template.shortName, 6, y + 14);

    const colors = this.getIndicatorColors(indicatorName, template);

    for (let fi = 0; fi < template.figures.length; fi++) {
      const figure = template.figures[fi];
      ctx.strokeStyle = colors[fi] || this.theme.textColor;
      ctx.lineWidth = figure.type === 'bar' ? 0 : 1;

      if (figure.type === 'bar') {
        // Draw bars (e.g. MACD histogram)
        const candleWidth = this.getCandleWidth();
        const bodyWidth = candleWidth * (1 - this.CANDLE_GAP);
        const baseY = valToY(figure.baseValue ?? 0);

        for (let i = 0; i < visible.length; i++) {
          const d = visible[i];
          const r = results[d.timestamp];
          if (!r) continue;
          const v = r[figure.key];
          if (v === undefined) continue;

          const cx = this.indexToX(this.viewRange.startIndex + i);
          const barY = valToY(v);

          ctx.fillStyle = v >= 0 ? (this.theme.macdBarUpColor) : (this.theme.macdBarDownColor);
          ctx.globalAlpha = 0.8;
          ctx.fillRect(cx - bodyWidth / 2, Math.min(barY, baseY), bodyWidth, Math.abs(barY - baseY));
          ctx.globalAlpha = 1;
        }
      } else {
        // Draw lines
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < visible.length; i++) {
          const d = visible[i];
          const r = results[d.timestamp];
          if (!r) continue;
          const v = r[figure.key];
          if (v === undefined || v === 0) continue;

          const px = this.indexToX(this.viewRange.startIndex + i);
          const py = valToY(v);

          if (!started) {
            ctx.moveTo(px, py);
            started = true;
          } else {
            ctx.lineTo(px, py);
          }
        }
        ctx.stroke();
      }
    }

    // Y axis for indicator
    this.renderYAxisGeneric(pane, minVal, maxVal, template.precision);
  }

  // ========== Y Axis ==========

  private renderYAxisPrice(pane: PaneInfo) {
    const visible = this.getVisibleData();
    if (!visible.length) return;

    let minPrice = Infinity, maxPrice = -Infinity;
    for (const d of visible) {
      minPrice = Math.min(minPrice, d.low);
      maxPrice = Math.max(maxPrice, d.high);
    }
    const range = maxPrice - minPrice || 1;
    minPrice -= range * 0.05;
    maxPrice += range * 0.05;

    this.renderYAxisGeneric(pane, minPrice, maxPrice, this.pricePrecision);
  }

  private renderYAxisVolume(pane: PaneInfo) {
    const visible = this.getVisibleData();
    if (!visible.length) return;

    let maxVol = 0;
    for (const d of visible) {
      if (d.volume) maxVol = Math.max(maxVol, d.volume);
    }
    maxVol *= 1.1;

    this.renderYAxisGeneric(pane, 0, maxVol, 0, formatVolume);
  }

  private renderYAxisGeneric(
    pane: PaneInfo,
    min: number,
    max: number,
    precision: number,
    formatter?: (v: number) => string
  ) {
    const ctx = this.ctx;
    const { y, height } = pane;
    const chartWidth = this.width - this.Y_AXIS_WIDTH;
    const valToY = (val: number) => y + (1 - (val - min) / (max - min)) * height;

    const ticks = calcYAxisTicks(min, max, precision);
    ctx.fillStyle = this.theme.textColor;
    ctx.font = this.theme.textFont;
    ctx.textAlign = 'left';

    for (const tick of ticks) {
      const ty = valToY(tick);
      if (ty < y || ty > y + height) continue;

      const text = formatter ? formatter(tick) : formatPrice(tick, precision);
      ctx.fillText(text, chartWidth + 6, ty + 4);

      // Grid line
      ctx.strokeStyle = this.theme.gridColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(0, ty);
      ctx.lineTo(chartWidth, ty);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // ========== X Axis ==========

  private renderXAxis() {
    const ctx = this.ctx;
    const y = this.height - this.X_AXIS_HEIGHT;
    const visible = this.getVisibleData();
    if (!visible.length) return;

    // Determine time label interval
    const candleWidth = this.getCandleWidth();
    const minLabelGap = 80; // minimum pixels between labels
    const step = Math.max(1, Math.ceil(minLabelGap / candleWidth));

    ctx.fillStyle = this.theme.textColor;
    ctx.font = this.theme.textFont;
    ctx.textAlign = 'center';

    for (let i = 0; i < visible.length; i += step) {
      const d = visible[i];
      const px = this.indexToX(this.viewRange.startIndex + i);
      const date = new Date(d.timestamp);
      const pad = (n: number) => n.toString().padStart(2, '0');
      const label = `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;

      ctx.fillText(label, px, y + 16);
    }
  }

  // ========== Top Info Bar (always visible) ==========

  private renderInfoBar(dataIndex: number) {
    const ctx = this.ctx;
    const y = 0;
    const height = this.INFO_BAR_HEIGHT;

    // Background
    ctx.fillStyle = this.theme.background;
    ctx.fillRect(0, y, this.width, height);

    // Bottom border
    ctx.strokeStyle = this.theme.gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + height);
    ctx.lineTo(this.width, y + height);
    ctx.stroke();

    if (dataIndex < 0 || dataIndex >= this.data.length) return;
    const d = this.data[dataIndex];
    const trend = getTrend(d);

    ctx.font = this.theme.textFont;
    ctx.textBaseline = 'middle';
    const cy = y + height / 2;
    let lx = 8;

    // Timestamp
    ctx.fillStyle = this.theme.textColor;
    const timeText = formatDateTime(d.timestamp);
    ctx.fillText(timeText, lx, cy);
    lx += ctx.measureText(timeText).width + 16;

    // OHLCV
    const ohlcvItems = [
      { label: '开', value: formatPrice(d.open, this.pricePrecision) },
      { label: '高', value: formatPrice(d.high, this.pricePrecision) },
      { label: '低', value: formatPrice(d.low, this.pricePrecision) },
      { label: '收', value: formatPrice(d.close, this.pricePrecision) },
    ];
    const priceColor = trend === 'up' ? this.theme.upColor : this.theme.downColor;
    for (const item of ohlcvItems) {
      ctx.fillStyle = this.theme.textColor;
      ctx.fillText(item.label, lx, cy);
      lx += ctx.measureText(item.label).width + 2;
      ctx.fillStyle = priceColor;
      ctx.fillText(item.value, lx, cy);
      lx += ctx.measureText(item.value).width + 12;
    }

    // Change %
    const change = d.close - d.open;
    const changePercent = ((change / d.open) * 100).toFixed(2);
    const arrow = change >= 0 ? '▲' : '▼';
    ctx.fillStyle = priceColor;
    ctx.fillText(`${arrow}${changePercent}%`, lx, cy);
    lx += ctx.measureText(`${arrow}${changePercent}%`).width + 16;

    // Volume
    if (d.volume !== undefined) {
      ctx.fillStyle = this.theme.textColor;
      ctx.fillText('量', lx, cy);
      lx += ctx.measureText('量').width + 2;
      ctx.fillStyle = priceColor;
      ctx.fillText(formatVolume(d.volume), lx, cy);
      lx += ctx.measureText(formatVolume(d.volume)).width + 16;
    }

    // Indicator values (inline, colored)
    for (const [name, template] of this.indicatorTemplates) {
      const results = this.indicatorResults.get(name);
      if (!results) continue;
      const r = results[d.timestamp];
      if (!r) continue;

      const colors = this.getIndicatorColors(name, template);
      for (let fi = 0; fi < template.figures.length; fi++) {
        const figure = template.figures[fi];
        const v = r[figure.key];
        if (v === undefined) continue;

        ctx.fillStyle = this.theme.textColor;
        ctx.fillText(figure.key, lx, cy);
        lx += ctx.measureText(figure.key).width + 2;

        ctx.fillStyle = colors[fi] || this.theme.textColor;
        const valText = v.toFixed(template.precision);
        ctx.fillText(valText, lx, cy);
        lx += ctx.measureText(valText).width + 12;
      }
    }

    ctx.textBaseline = 'alphabetic';
  }

  // ========== Crosshair ==========

  private renderCrosshairLines() {
    const ctx = this.ctx;
    const { x, y } = this.crosshair;
    if (x === null || y === null) return;

    const chartWidth = this.width - this.Y_AXIS_WIDTH;
    const topOffset = this.INFO_BAR_HEIGHT;

    // Vertical line
    ctx.strokeStyle = this.theme.crosshairColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 2]);
    ctx.beginPath();
    ctx.moveTo(x, topOffset);
    ctx.lineTo(x, this.height - this.X_AXIS_HEIGHT);
    ctx.stroke();

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(chartWidth, y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Time label at bottom
    const { dataIndex } = this.crosshair;
    if (dataIndex !== null && dataIndex >= 0 && dataIndex < this.data.length) {
      const d = this.data[dataIndex];
      const date = new Date(d.timestamp);
      const pad = (n: number) => n.toString().padStart(2, '0');
      const timeLabel = `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;

      ctx.font = this.theme.textFont;
      const tw = ctx.measureText(timeLabel).width + 12;
      const tx = Math.max(0, Math.min(x - tw / 2, chartWidth - tw));

      ctx.fillStyle = this.theme.crosshairTextBg;
      ctx.fillRect(tx, this.height - this.X_AXIS_HEIGHT, tw, this.X_AXIS_HEIGHT);
      ctx.fillStyle = this.theme.crosshairTextColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(timeLabel, tx + tw / 2, this.height - this.X_AXIS_HEIGHT / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  }

  private renderCrosshairPriceTag() {
    const ctx = this.ctx;
    const { y, dataIndex } = this.crosshair;
    if (y === null || dataIndex === null) return;

    const chartWidth = this.width - this.Y_AXIS_WIDTH;
    const mainPane = this.panes.find(p => p.type === 'main');
    if (!mainPane) return;

    // Only show price tag when hovering in main pane area
    if (y < mainPane.y || y > mainPane.y + mainPane.height) return;

    const price = this.yToPrice(y);
    if (price === null) return;

    const priceText = formatPrice(price, this.pricePrecision);
    ctx.font = this.theme.textFont;
    const tagWidth = ctx.measureText(priceText).width + 10;
    const tagHeight = 18;

    const tagY = y - tagHeight / 2;

    ctx.fillStyle = this.theme.crosshairTextBg;
    ctx.fillRect(chartWidth, tagY, tagWidth, tagHeight);

    const d = this.data[dataIndex];
    const trend = d ? getTrend(d) : 'flat';
    ctx.fillStyle = trend === 'up' ? this.theme.upColor : this.theme.downColor;
    ctx.textBaseline = 'middle';
    ctx.fillText(priceText, chartWidth + 5, y);
    ctx.textBaseline = 'alphabetic';
  }

  // ========== Detail Panel (right-side popup on hover) ==========

  private renderDetailPanel() {
    const ctx = this.ctx;
    const { x, y, dataIndex } = this.crosshair;
    if (x === null || y === null || dataIndex === null) return;
    if (dataIndex < 0 || dataIndex >= this.data.length) return;

    const d = this.data[dataIndex];
    const trend = getTrend(d);
    const priceColor = trend === 'up' ? this.theme.upColor : this.theme.downColor;
    const change = d.close - d.open;
    const changePercent = ((change / d.open) * 100).toFixed(2);
    const arrow = change >= 0 ? '▲' : '▼';

    ctx.font = this.theme.textFont;
    const lineH = 18;
    const padX = 10;
    const padY = 8;

    // Collect all rows
    const rows: Array<{ color: string; text: string }> = [];

    // Timestamp
    rows.push({ color: this.theme.textColor, text: formatDateTime(d.timestamp) });
    rows.push({ color: this.theme.textColor, text: '' }); // spacer

    // OHLCV
    rows.push({ color: priceColor, text: `开  ${formatPrice(d.open, this.pricePrecision)}` });
    rows.push({ color: priceColor, text: `高  ${formatPrice(d.high, this.pricePrecision)}` });
    rows.push({ color: priceColor, text: `低  ${formatPrice(d.low, this.pricePrecision)}` });
    rows.push({ color: priceColor, text: `收  ${formatPrice(d.close, this.pricePrecision)}` });
    rows.push({ color: priceColor, text: `${arrow}  ${changePercent}%` });

    if (d.volume !== undefined) {
      rows.push({ color: priceColor, text: `量  ${formatVolume(d.volume)}` });
    }
    if (d.turnover !== undefined) {
      rows.push({ color: priceColor, text: `额  ${formatVolume(d.turnover)}` });
    }

    // Indicator values
    for (const [name, template] of this.indicatorTemplates) {
      const results = this.indicatorResults.get(name);
      if (!results) continue;
      const r = results[d.timestamp];
      if (!r) continue;

      rows.push({ color: this.theme.textColor, text: '' }); // spacer

      const colors = this.getIndicatorColors(name, template);
      for (let fi = 0; fi < template.figures.length; fi++) {
        const figure = template.figures[fi];
        const v = r[figure.key];
        if (v === undefined) continue;
        rows.push({
          color: colors[fi] || this.theme.textColor,
          text: `${template.shortName} ${figure.key}: ${v.toFixed(template.precision)}`,
        });
      }
    }

    // Measure panel size
    let maxTextWidth = 0;
    for (const row of rows) {
      const w = ctx.measureText(row.text).width;
      if (w > maxTextWidth) maxTextWidth = w;
    }

    const panelW = maxTextWidth + padX * 2;
    const panelH = rows.length * lineH + padY * 2;

    // Position: right side of crosshair, clamped to viewport
    const chartWidth = this.width - this.Y_AXIS_WIDTH;
    let px = x + 16;
    let py = y - panelH / 2;

    // If panel overflows right, flip to left side
    if (px + panelW > chartWidth) {
      px = x - panelW - 16;
    }
    // Clamp vertical
    if (py < this.INFO_BAR_HEIGHT) py = this.INFO_BAR_HEIGHT;
    if (py + panelH > this.height - this.X_AXIS_HEIGHT) {
      py = this.height - this.X_AXIS_HEIGHT - panelH;
    }
    // Don't let panel go negative
    if (px < 0) px = 4;

    // Draw panel background with border
    ctx.fillStyle = this.theme.crosshairTextBg;
    const radius = 4;
    ctx.beginPath();
    ctx.moveTo(px + radius, py);
    ctx.lineTo(px + panelW - radius, py);
    ctx.arcTo(px + panelW, py, px + panelW, py + radius, radius);
    ctx.lineTo(px + panelW, py + panelH - radius);
    ctx.arcTo(px + panelW, py + panelH, px + panelW - radius, py + panelH, radius);
    ctx.lineTo(px + radius, py + panelH);
    ctx.arcTo(px, py + panelH, px, py + panelH - radius, radius);
    ctx.lineTo(px, py + radius);
    ctx.arcTo(px, py, px + radius, py, radius);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = this.theme.gridColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw text rows
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (let i = 0; i < rows.length; i++) {
      ctx.fillStyle = rows[i].color;
      ctx.fillText(rows[i].text, px + padX, py + padY + i * lineH);
    }
    ctx.textBaseline = 'alphabetic';
  }

  // ========== Helpers ==========

  private getIndicatorColors(name: string, template: IndicatorTemplate): string[] {
    const t = this.theme;
    switch (name) {
      case 'MA': return t.maColors;
      case 'EMA': return t.maColors;
      case 'BOLL': return t.bollColors;
      case 'MACD': return [t.macdDifColor, t.macdDeaColor, t.macdBarUpColor];
      case 'RSI': return t.rsiColors;
      case 'KDJ': return t.kdjColors;
      case 'VOL': return t.volMaColors;
      default: return template.figures.map(() => t.textColor);
    }
  }

  /** Find which pane a y coordinate belongs to */
  hitTestPane(y: number): PaneInfo | undefined {
    return this.panes.find(p => y >= p.y && y < p.y + p.height);
  }

  /** Get price at a y coordinate in the main pane */
  yToPrice(y: number): number | null {
    const mainPane = this.panes.find(p => p.type === 'main');
    if (!mainPane) return null;

    const visible = this.getVisibleData();
    if (!visible.length) return null;

    let minPrice = Infinity, maxPrice = -Infinity;
    for (const d of visible) {
      minPrice = Math.min(minPrice, d.low);
      maxPrice = Math.max(maxPrice, d.high);
    }
    const range = maxPrice - minPrice || 1;
    minPrice -= range * 0.05;
    maxPrice += range * 0.05;

    const ratio = 1 - (y - mainPane.y) / mainPane.height;
    return minPrice + ratio * (maxPrice - minPrice);
  }
}
