import React from 'react';
import './AppErrorBoundary.css';

type RecoveryLanguage = 'en-US' | 'zh-CN';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  incidentId: string;
}

const LANGUAGE_STORAGE_KEY = 'quant-platform-language';

const recoveryCopy = {
  'en-US': {
    eyebrow: 'WORKSPACE RECOVERY',
    title: 'This page could not be displayed.',
    description: 'Your account and saved settings are unchanged. Reload the workspace to try again.',
    reload: 'Reload workspace',
    home: 'Return to home',
    reference: 'Reference',
  },
  'zh-CN': {
    eyebrow: '工作区恢复',
    title: '这个页面暂时无法显示。',
    description: '你的账户和已保存设置没有受到影响。请重新加载工作区后再试。',
    reload: '重新加载工作区',
    home: '返回首页',
    reference: '问题编号',
  },
} as const;

const makeIncidentId = () => {
  const time = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `UI-${time}-${random}`;
};

export const resolveRecoveryLanguage = (): RecoveryLanguage => {
  if (typeof document !== 'undefined' && document.documentElement.lang.toLowerCase().startsWith('zh')) {
    return 'zh-CN';
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'zh-CN') {
      return 'zh-CN';
    }
  } catch {
    // Storage can be unavailable in hardened/private browser contexts.
  }

  return 'en-US';
};

/**
 * Last-resort UI boundary for render failures. It intentionally reports only a
 * short incident id, error type and pathname to the browser event hook; query
 * parameters, account data and error text are never included.
 */
class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    incidentId: '',
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return {
      hasError: true,
      incidentId: makeIncidentId(),
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.props.onError?.(error, info);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('alphalab:app-error', {
        detail: {
          incidentId: this.state.incidentId,
          errorType: error.name || 'Error',
          pathname: window.location.pathname,
        },
      }));
    }

    if (process.env.NODE_ENV === 'development') {
      // Keep complete diagnostic details local to the developer console.
      console.error('AlphaLab render failure', error, info);
    }
  }

  private reloadWorkspace = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const language = resolveRecoveryLanguage();
    const copy = recoveryCopy[language];

    return (
      <main className="app-error-boundary" lang={language === 'zh-CN' ? 'zh' : 'en'}>
        <section className="app-error-boundary__card" role="alert" aria-labelledby="app-error-title">
          <span className="app-error-boundary__eyebrow">{copy.eyebrow}</span>
          <div className="app-error-boundary__mark" aria-hidden="true">!</div>
          <h1 id="app-error-title">{copy.title}</h1>
          <p>{copy.description}</p>
          <div className="app-error-boundary__actions">
            <button type="button" onClick={this.reloadWorkspace}>{copy.reload}</button>
            <a href="/">{copy.home}</a>
          </div>
          <small>{copy.reference}: <code>{this.state.incidentId}</code></small>
        </section>
      </main>
    );
  }
}

export default AppErrorBoundary;
