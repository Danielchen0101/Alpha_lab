import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import AppErrorBoundary, { resolveRecoveryLanguage } from './AppErrorBoundary';

const CrashingChild = () => {
  throw new Error('test render failure');
};

describe('AppErrorBoundary', () => {
  let container: HTMLDivElement;
  let root: Root;
  const originalConsoleError = console.error;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    console.error = jest.fn();
    document.documentElement.lang = 'en';
    localStorage.clear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    console.error = originalConsoleError;
  });

  it('replaces a render failure with an accessible recovery screen', () => {
    // Rendering itself triggers the boundary, so React requires this act scope.
    // eslint-disable-next-line testing-library/no-unnecessary-act
    act(() => {
      root.render(
        <AppErrorBoundary>
          <CrashingChild />
        </AppErrorBoundary>,
      );
    });

    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).toContain('This page could not be displayed.');
    expect(container.querySelector('button')?.textContent).toBe('Reload workspace');
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/');
  });

  it('uses the saved Chinese preference when the app fails before language initialization', () => {
    localStorage.setItem('quant-platform-language', 'zh-CN');
    expect(resolveRecoveryLanguage()).toBe('zh-CN');
  });

  it('prefers the active document language over stale storage', () => {
    localStorage.setItem('quant-platform-language', 'en-US');
    document.documentElement.lang = 'zh';
    expect(resolveRecoveryLanguage()).toBe('zh-CN');
  });
});
