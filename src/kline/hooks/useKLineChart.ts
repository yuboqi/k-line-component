import { useRef, useEffect, useCallback, useState } from 'react';
import { KLineCanvasRenderer } from '../renderers/KLineCanvas';
import type { KLineData, KLineTheme, ViewRange, IndicatorTemplate, IndicatorResult } from '../types';

interface UseKLineChartOptions {
  theme: KLineTheme;
  data: KLineData[];
  indicators?: Array<{ template: IndicatorTemplate; results: IndicatorResult }>;
}

export function useKLineChart({ theme, data, indicators = [] }: UseKLineChartOptions) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<KLineCanvasRenderer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewRange, setViewRange] = useState<ViewRange>({ startIndex: 0, endIndex: 60 });

  // Initialize renderer
  useEffect(() => {
    if (!canvasRef.current) return;
    const renderer = new KLineCanvasRenderer(canvasRef.current, theme);
    rendererRef.current = renderer;
    return () => {
      rendererRef.current = null;
    };
  }, [theme]);

  // Update theme
  useEffect(() => {
    rendererRef.current?.setTheme(theme);
  }, [theme]);

  // Update data
  useEffect(() => {
    rendererRef.current?.setData(data);
  }, [data]);

  // Update indicators
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    // Clear ALL old indicators first, then set the new ones
    const allNames = ['MA', 'EMA', 'BOLL', 'MACD', 'RSI', 'KDJ', 'VOL'];
    for (const name of allNames) {
      renderer.removeIndicator(name);
    }

    for (const { template, results } of indicators) {
      renderer.setIndicator(template.name, template, results);
    }

    renderer.render();
  }, [indicators]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        rendererRef.current?.resize(width, height);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ========== Interaction Handlers ==========

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    e.preventDefault();

    const current = renderer.getViewRange();
    const visibleCount = current.endIndex - current.startIndex + 1;
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
    let newCount = Math.round(visibleCount * zoomFactor);
    newCount = Math.max(10, Math.min(newCount, renderer.getData().length));

    // Zoom centered on mouse position
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const chartWidth = renderer.getData().length > 0
      ? rect.width - 70 : rect.width;
    const ratio = mouseX / chartWidth;

    const anchorIndex = Math.round(current.startIndex + ratio * visibleCount);
    let newStart = Math.round(anchorIndex - ratio * newCount);
    let newEnd = newStart + newCount - 1;

    // Clamp
    if (newStart < 0) {
      newStart = 0;
      newEnd = newCount - 1;
    }
    if (newEnd >= renderer.getData().length) {
      newEnd = renderer.getData().length - 1;
      newStart = Math.max(0, newEnd - newCount + 1);
    }

    renderer.setViewRange({ startIndex: newStart, endIndex: newEnd });
    setViewRange({ startIndex: newStart, endIndex: newEnd });
  }, []);

  // Drag state
  const dragRef = useRef<{ isDragging: boolean; startX: number; startRange: ViewRange }>({
    isDragging: false,
    startX: 0,
    startRange: { startIndex: 0, endIndex: 0 },
  });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startRange: rendererRef.current?.getViewRange() ?? { startIndex: 0, endIndex: 0 },
    };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (dragRef.current.isDragging) {
      const dx = e.clientX - dragRef.current.startX;
      const candleWidth = renderer.getCandleWidth();
      const indexShift = Math.round(dx / candleWidth);

      const total = renderer.getData().length;
      let newStart = dragRef.current.startRange.startIndex - indexShift;
      let newEnd = dragRef.current.startRange.endIndex - indexShift;
      const visibleCount = newEnd - newStart + 1;

      if (newStart < 0) { newStart = 0; newEnd = visibleCount - 1; }
      if (newEnd >= total) { newEnd = total - 1; newStart = Math.max(0, newEnd - visibleCount + 1); }

      renderer.setViewRange({ startIndex: newStart, endIndex: newEnd });
      setViewRange({ startIndex: newStart, endIndex: newEnd });
    }

    // Crosshair
    const chartWidth = rect.width - 80;
    const topOffset = 22; // INFO_BAR_HEIGHT
    const chartHeight = rect.height - 24 - topOffset;
    if (x >= 0 && x <= chartWidth && y >= topOffset && y <= topOffset + chartHeight) {
      const dataIndex = renderer.xToIndex(x);
      renderer.setCrosshair({ x, y, dataIndex });
    } else {
      renderer.setCrosshair({ x: null, y: null, dataIndex: null });
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    dragRef.current.isDragging = false;
    rendererRef.current?.setCrosshair({ x: null, y: null, dataIndex: null });
  }, []);

  const handleMouseUp = useCallback(() => {
    dragRef.current.isDragging = false;
  }, []);

  return {
    canvasRef,
    containerRef,
    viewRange,
    handlers: {
      onWheel: handleWheel,
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseLeave: handleMouseLeave,
      onMouseUp: handleMouseUp,
    },
  };
}
