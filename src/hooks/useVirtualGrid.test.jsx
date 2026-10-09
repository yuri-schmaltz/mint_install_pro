import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { useVirtualGrid } from './useVirtualGrid';

function Harness({ count = 1800, resetKey = 'all' }) {
  const grid = useVirtualGrid(count, resetKey);
  return <div data-testid="viewport" ref={grid.containerRef} onScroll={grid.onScroll}>
    <div ref={grid.gridRef} data-testid="grid" style={{ paddingTop: grid.paddingTop, paddingBottom: grid.paddingBottom }}>
      {Array.from({ length: grid.endIndex - grid.startIndex }, (_, index) =>
        <div className="gtk-card" key={grid.startIndex + index}>{grid.startIndex + index}</div>)}
    </div>
  </div>;
}

let frames;
let observers;
beforeEach(() => {
  frames = new Map();
  observers = [];
  let sequence = 0;
  vi.stubGlobal('requestAnimationFrame', vi.fn(callback => { frames.set(++sequence, callback); return sequence; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn(id => frames.delete(id)));
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback) { this.callback = callback; this.disconnect = vi.fn(); observers.push(this); }
    observe() {}
  });
  vi.spyOn(globalThis, 'getComputedStyle').mockReturnValue({ gridTemplateColumns: '390px 390px 390px', rowGap: '10px' });
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockReturnValue(50);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ height: 74 });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function flushFrames() {
  act(() => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach(callback => callback());
  });
}
function scroll(container, top) {
  container.scrollTop = top;
  fireEvent.scroll(container);
  flushFrames();
}

describe('virtual grid lifecycle and large lists', () => {
  it('bounds the DOM at the beginning, middle and end without losing the last item', () => {
    const { getByTestId } = render(<Harness />);
    const viewport = getByTestId('viewport');
    const grid = getByTestId('grid');
    expect(grid.children.length).toBeLessThan(90);
    expect(grid.firstChild.textContent).toBe('0');
    scroll(viewport, 25000);
    expect(grid.children.length).toBeLessThan(90);
    expect(Number(grid.firstChild.textContent)).toBeGreaterThan(500);
    scroll(viewport, 50000);
    expect(grid.children.length).toBeLessThan(90);
    expect(grid.lastChild.textContent).toBe('1799');
    scroll(viewport, 0);
    expect(grid.firstChild.textContent).toBe('0');
  });

  it('coalesces scroll events and cancels the pending frame and observers on unmount', () => {
    const { getByTestId, unmount } = render(<Harness />);
    const viewport = getByTestId('viewport');
    for (let event = 0; event < 10; event++) fireEvent.scroll(viewport);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(1);
    unmount();
    expect(frames.size).toBe(0);
    expect(observers[0].disconnect).toHaveBeenCalledOnce();
  });

  it('does not mount the entire catalog when GTK reports an oversized provisional layout', () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(151334);
    const { getByTestId } = render(<Harness />);
    expect(getByTestId('grid').children.length).toBeLessThan(90);
  });

  it('resets for a new filter, preserves the position on inventory updates and handles empty results', () => {
    const { getByTestId, rerender } = render(<Harness />);
    const viewport = getByTestId('viewport');
    scroll(viewport, 25000);
    rerender(<Harness count={1797} />);
    expect(viewport.scrollTop).toBe(25000);
    rerender(<Harness count={3} resetKey="search" />);
    expect(viewport.scrollTop).toBe(0);
    expect(getByTestId('grid').children.length).toBe(3);
    rerender(<Harness count={0} resetKey="empty" />);
    expect(getByTestId('grid').children.length).toBe(0);
    rerender(<Harness count={1800} resetKey="all" />);
    expect(getByTestId('grid').firstChild.textContent).toBe('0');
  });

  it('supports a WebView without ResizeObserver and recalculates columns on window resize', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const { getByTestId } = render(<Harness />);
    const viewport = getByTestId('viewport');
    scroll(viewport, 12000);
    getComputedStyle.mockReturnValue({ gridTemplateColumns: '350px', rowGap: '10px' });
    fireEvent(window, new Event('resize'));
    expect(getByTestId('grid').children.length).toBeLessThan(30);
    expect(viewport.scrollTop).toBe(12000);
    expect(Number(getByTestId('grid').firstChild.textContent)).toBeGreaterThan(100);
  });
});
