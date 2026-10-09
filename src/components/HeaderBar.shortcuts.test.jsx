import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HeaderBar from './HeaderBar';

const renderHeader = () => render(<HeaderBar searchQuery="texto de pesquisa"
  setSearchQuery={() => {}} canGoBack={false} onBack={() => {}} onOpenSettings={() => {}} />);

describe('Pesquisa por teclado', () => {
  it.each([
    { key: 'f', ctrlKey: true }, { key: 'F', ctrlKey: true, shiftKey: true },
    { key: 'f', metaKey: true }, { key: 'F', metaKey: true, shiftKey: true },
    { key: 'f', ctrlKey: true, metaKey: true }
  ])('foca e seleciona todo o texto com %j', shortcut => {
    renderHeader();
    const input = screen.getByRole('textbox', { name: 'Pesquisar aplicativos' });
    screen.getByTitle('Menu do aplicativo').focus();
    const event = new KeyboardEvent('keydown', { ...shortcut, bubbles: true, cancelable: true });
    fireEvent(window, event);
    expect(event.defaultPrevented).toBe(true);
    expect(input).toHaveFocus();
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  it.each([
    { key: 'f' }, { key: 'F', shiftKey: true }, { key: 'f', altKey: true },
    { key: 'f', ctrlKey: true, altKey: true }, { key: 'f', metaKey: true, altKey: true },
    { key: 'g', ctrlKey: true }, { key: 'Escape' }
  ])('preserva outros comandos com %j', shortcut => {
    renderHeader();
    const button = screen.getByTitle('Menu do aplicativo');
    button.focus();
    const event = new KeyboardEvent('keydown', { ...shortcut, bubbles: true, cancelable: true });
    fireEvent(window, event);
    expect(event.defaultPrevented).toBe(false);
    expect(button).toHaveFocus();
  });

  it('remove o atalho ao desmontar e não acumula listeners ao remontar', () => {
    const { unmount } = renderHeader();
    unmount();
    const event = new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, cancelable: true });
    fireEvent(window, event);
    expect(event.defaultPrevented).toBe(false);
    renderHeader();
    const input = screen.getByRole('textbox', { name: 'Pesquisar aplicativos' });
    const select = vi.spyOn(input, 'select');
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    expect(select).toHaveBeenCalledOnce();
  });
});
