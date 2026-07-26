import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import AuthTurnstile, { AuthTurnstileCopy } from './AuthTurnstile';

let mockTurnstileProps: Record<string, unknown>;

jest.mock('react-turnstile', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockTurnstileProps = props;
    return null;
  },
}));

const copy: AuthTurnstileCopy = {
  developmentBypass: 'Development bypass',
  missingConfiguration: 'Missing configuration',
  loadFailed: 'Challenge failed to load',
  timedOut: 'Challenge timed out',
  unsupported: 'Browser is unsupported',
  retry: 'Retry challenge',
  reload: 'Reload page',
};

describe('AuthTurnstile', () => {
  let container: HTMLDivElement;
  let root: Root;
  let onTokenChange: jest.Mock;
  const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };

  const renderWidget = () => {
    // Rendering a concurrent root must be flushed before invoking the mocked
    // widget callbacks below.
    // eslint-disable-next-line testing-library/no-unnecessary-act
    act(() => {
      root.render(
        <AuthTurnstile
          siteKey="site-key"
          development={false}
          theme="light"
          language="en-US"
          compact={false}
          copy={copy}
          onTokenChange={onTokenChange}
        />,
      );
    });
  };

  beforeAll(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    onTokenChange = jest.fn();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it.each([
    ['onError', copy.loadFailed],
    ['onTimeout', copy.timedOut],
    ['onUnsupported', copy.unsupported],
  ])('shows a visible and recoverable message for %s', (callback, message) => {
    renderWidget();
    act(() => {
      (mockTurnstileProps[callback] as () => void)();
    });

    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain(message);
    expect(alert?.textContent).toContain(copy.retry);
    expect(alert?.textContent).toContain(copy.reload);
    expect(onTokenChange).toHaveBeenLastCalledWith('');
  });

  it('resets a loaded widget and clears the visible issue when retried', () => {
    renderWidget();
    const reset = jest.fn();
    act(() => {
      (mockTurnstileProps.onLoad as (
        widgetId: string,
        bound: { reset: () => void },
      ) => void)('widget-id', { reset });
      (mockTurnstileProps.onTimeout as () => void)();
    });

    const retry = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === copy.retry);
    expect(retry).toBeDefined();
    act(() => retry?.click());

    expect(reset).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
