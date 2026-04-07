import { useMemo } from 'react';
import { useKLineChart } from '../hooks/useKLineChart';
import type { KLineData, KLineTheme, IndicatorTemplate, IndicatorResult } from '../types';
import { MA, EMA, BOLL, MACD, RSI, KDJ, VOL } from '../indicators';

interface KLineChartProps {
  data: KLineData[];
  theme: KLineTheme;
  indicators?: string[];
  className?: string;
  style?: React.CSSProperties;
}

const indicatorMap: Record<string, IndicatorTemplate> = {
  MA, EMA, BOLL, MACD, RSI, KDJ, VOL,
};

export function KLineChart({
  data,
  theme,
  indicators = ['MA', 'VOL', 'MACD'],
  className,
  style,
}: KLineChartProps) {
  // Calculate indicator results
  const indicatorData = useMemo(() => {
    return indicators.map(name => {
      const template = indicatorMap[name];
      if (!template) return null;
      return {
        template,
        results: template.calc(data),
      };
    }).filter(Boolean) as Array<{ template: IndicatorTemplate; results: IndicatorResult }>;
  }, [data, indicators]);

  const { canvasRef, containerRef, handlers } = useKLineChart({
    theme,
    data,
    indicators: indicatorData,
  });

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%', overflow: 'hidden', ...style }}
      onWheel={handlers.onWheel}
      onMouseDown={handlers.onMouseDown}
      onMouseMove={handlers.onMouseMove}
      onMouseUp={handlers.onMouseUp}
      onMouseLeave={handlers.onMouseLeave}
    >
      <canvas ref={canvasRef} style={{ display: 'block', cursor: 'crosshair' }} />
    </div>
  );
}
