# kline-component

高性能 React K 线（蜡烛图）组件，基于 Canvas 渲染，适用于加密货币/股票/期货等金融行情展示。

零外部图表库依赖，纯 Canvas 2D 实现，支持 7 种技术指标、暗色/亮色双主题、滚轮缩放、拖拽平移、十字光标等交互。

## 特性

- **Canvas 高性能渲染** — 分区布局：主图（K线 + 叠加指标）、成交量、副图指标
- **7 种技术指标** — MA、EMA、BOLL（叠加主图），MACD、RSI、KDJ（独立副图），VOL（均量线）
- **双主题** — 暗色/亮色一键切换，专业交易平台风格
- **丰富交互** — 滚轮缩放、拖拽平移、十字光标、悬停详情面板
- **零依赖** — 除 React 外无任何外部图表库
- **TypeScript** — 完整类型定义
- **Tree-shakeable** — ESM 输出，支持按需引入

## 安装

```bash
npm install kline-component
```

## 快速开始

```tsx
import { KLineChart, darkTheme, generateMockKLineData } from 'kline-component';

function App() {
  const data = generateMockKLineData(500);

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <KLineChart
        data={data}
        theme={darkTheme}
        indicators={['MA', 'VOL', 'MACD']}
      />
    </div>
  );
}
```

## Props

| 属性 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `data` | `KLineData[]` | 是 | — | K 线数据数组 |
| `theme` | `KLineTheme` | 是 | — | 主题对象，使用 `darkTheme` 或 `lightTheme` |
| `indicators` | `string[]` | 否 | `['MA', 'VOL', 'MACD']` | 要显示的指标名称数组 |
| `className` | `string` | 否 | — | 容器 CSS 类名 |
| `style` | `React.CSSProperties` | 否 | — | 容器内联样式 |

> **注意**：容器需要有明确的宽高（`width` + `height`），组件会自动填满父容器。

## 数据格式

`KLineData` 接口定义：

```typescript
interface KLineData {
  timestamp: number;   // 毫秒级时间戳
  open: number;        // 开盘价
  high: number;        // 最高价
  low: number;         // 最低价
  close: number;       // 收盘价
  volume?: number;     // 成交量（可选）
  turnover?: number;   // 成交额（可选）
}
```

数据需按 `timestamp` 升序排列。

### Mock 数据

包内提供模拟数据生成器，方便开发调试：

```tsx
import { generateMockKLineData } from 'kline-component';

// 生成 500 根 BTC/USDT 15 分钟 K 线
const data = generateMockKLineData(500);
```

## 指标

内置 7 种技术指标，通过 `indicators` 属性控制显示：

| 名称 | 类型 | 参数 | 说明 |
| --- | --- | --- | --- |
| `MA` | 叠加主图 | [5, 10, 30, 60] | 简单移动平均线 |
| `EMA` | 叠加主图 | [6, 12, 20] | 指数移动平均线 |
| `BOLL` | 叠加主图 | [20, 2] | 布林带 |
| `MACD` | 独立副图 | [12, 26, 9] | 异同移动平均线 |
| `RSI` | 独立副图 | [6, 12, 24] | 相对强弱指数 |
| `KDJ` | 独立副图 | [9, 3, 3] | 随机指标 |
| `VOL` | 成交量区 | [5, 10, 20] | 成交量 + 均量线 |

```tsx
// 只显示 MA + BOLL
<KLineChart data={data} theme={darkTheme} indicators={['MA', 'BOLL', 'VOL']} />
```

## 主题

内置暗色和亮色两套主题：

```tsx
import { darkTheme, lightTheme } from 'kline-component';

// 暗色主题（推荐，交易平台标配）
<KLineChart data={data} theme={darkTheme} indicators={['MA', 'VOL', 'MACD']} />

// 亮色主题
<KLineChart data={data} theme={lightTheme} indicators={['MA', 'VOL', 'MACD']} />
```

也支持自定义主题，通过实现 `KLineTheme` 接口：

```typescript
import type { KLineTheme } from 'kline-component';

const customTheme: KLineTheme = {
  background: '#0d1117',
  textColor: '#8b949e',
  textFont: '12px -apple-system, sans-serif',
  gridColor: 'rgba(255,255,255,0.04)',
  crosshairColor: 'rgba(255,255,255,0.3)',
  crosshairTextColor: '#e0e0e0',
  crosshairTextBg: 'rgba(30,30,50,0.9)',
  upColor: '#26a69a',
  downColor: '#ef5350',
  upWickColor: '#26a69a',
  downWickColor: '#ef5350',
  maColors: ['#f5c842', '#e86f52', '#636efa', '#00d4aa'],
  bollColors: ['#636efa', '#f5c842', '#636efa'],
  macdDifColor: '#f5c842',
  macdDeaColor: '#e86f52',
  macdBarUpColor: '#26a69a',
  macdBarDownColor: '#ef5350',
  rsiColors: ['#f5c842', '#e86f52', '#636efa'],
  kdjColors: ['#f5c842', '#e86f52', '#636efa'],
  volMaColors: ['#f5c842', '#e86f52', '#636efa'],
};
```

## 交互

组件内置以下交互能力，无需额外配置：

- **滚轮缩放** — 鼠标滚轮缩放 K 线，以光标位置为中心
- **拖拽平移** — 鼠标左键按住拖拽查看历史数据
- **十字光标** — 鼠标悬停显示十字准线和价格标签
- **详情面板** — 悬停时在光标附近弹出 OHLCV + 指标值详情

## 本地开发

```bash
# 克隆项目
git clone <repo-url>
cd kline-component

# 安装依赖
npm install

# 构建库
npm run build

# 运行示例
npm run dev
```

## 技术栈

- React 18+
- TypeScript
- Canvas 2D
- Vite

## License

MIT
