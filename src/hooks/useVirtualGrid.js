import { useCallback, useLayoutEffect, useRef, useState } from 'react';

const OVERSCAN_ROWS = 6;
const WINDOW_STEP_ROWS = 4;
const INITIAL_GEOMETRY = { columns: 1, height: 600, offset: 0, rowHeight: 74, gap: 10 };

// Keep a small buffer around the viewport. The padding represents all other
// rows, so scrolling never grows the DOM or changes the scrollbar's length.
export function useVirtualGrid(itemCount, resetKey) {
  const containerRef = useRef(null);
  const gridRef = useRef(null);
  const geometryRef = useRef(INITIAL_GEOMETRY);
  const frameRef = useRef(null);
  const previousResetKey = useRef(resetKey);
  const [window, setWindow] = useState({ start: 0, end: 18, ...INITIAL_GEOMETRY });

  const updateWindow = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const geometry = geometryRef.current;
    const { columns, height, offset, rowHeight, gap } = geometry;
    const stride = rowHeight + gap;
    const rows = Math.ceil(itemCount / columns);
    const firstVisible = Math.floor(Math.max(0, container.scrollTop - offset) / stride);
    // Move the buffered window in small blocks, avoiding a React commit for
    // each individual row crossed during a wheel or touchpad gesture.
    const firstBuffered = Math.max(0, firstVisible - OVERSCAN_ROWS);
    const start = Math.max(0, Math.min(rows - 1,
      Math.floor(firstBuffered / WINDOW_STEP_ROWS) * WINDOW_STEP_ROWS));
    const end = Math.min(rows, Math.max(start + 1,
      Math.ceil((Math.ceil(Math.max(0, container.scrollTop + height - offset) / stride) +
        OVERSCAN_ROWS) / WINDOW_STEP_ROWS) * WINDOW_STEP_ROWS));
    setWindow(previous => previous.start === start && previous.end === end &&
      previous.columns === columns && previous.rowHeight === rowHeight && previous.gap === gap
      ? previous : { start, end, ...geometry });
  }, [itemCount]);

  const scheduleUpdate = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      updateWindow();
    });
  }, [updateWindow]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const grid = gridRef.current;
    if (!container || !grid) return undefined;
    const measure = () => {
      const style = getComputedStyle(grid);
      const template = style.gridTemplateColumns;
      const columns = template && template !== 'none' ? template.split(' ').filter(Boolean).length : 1;
      geometryRef.current = {
        columns,
        // GTK can briefly report the unstyled content height before allocating
        // the WebView. Never treat that provisional height as the viewport.
        height: Math.min(container.clientHeight || INITIAL_GEOMETRY.height,
          globalThis.window.innerHeight || INITIAL_GEOMETRY.height),
        offset: grid.offsetTop,
        rowHeight: grid.querySelector('.gtk-card')?.getBoundingClientRect().height || INITIAL_GEOMETRY.rowHeight,
        gap: parseFloat(style.rowGap) || INITIAL_GEOMETRY.gap
      };
      updateWindow();
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(container);
    observer?.observe(grid);
    globalThis.window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      globalThis.window.removeEventListener('resize', measure);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [updateWindow, resetKey]);

  useLayoutEffect(() => {
    if (previousResetKey.current !== resetKey && containerRef.current) {
      containerRef.current.scrollTop = 0;
      previousResetKey.current = resetKey;
    }
    updateWindow();
  }, [resetKey, updateWindow]);

  const rows = Math.ceil(itemCount / window.columns);
  const end = Math.min(rows, window.end);
  const start = Math.min(window.start, Math.max(0, end - 1));
  return {
    containerRef, gridRef, onScroll: scheduleUpdate, onFocus: scheduleUpdate,
    startIndex: start * window.columns,
    endIndex: Math.min(itemCount, end * window.columns),
    paddingTop: start * (window.rowHeight + window.gap),
    paddingBottom: Math.max(0, rows - end) * (window.rowHeight + window.gap)
  };
}
