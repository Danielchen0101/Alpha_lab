import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import Turnstile, { BoundTurnstileObject } from 'react-turnstile';

export type AuthTurnstileIssue = 'error' | 'timeout' | 'unsupported';

export interface AuthTurnstileCopy {
  developmentBypass: string;
  missingConfiguration: string;
  loadFailed: string;
  timedOut: string;
  unsupported: string;
  retry: string;
  reload: string;
}

export interface AuthTurnstileHandle {
  reset: () => void;
}

interface AuthTurnstileProps {
  siteKey?: string;
  development: boolean;
  theme: 'light' | 'dark';
  language: 'en-US' | 'zh-CN';
  compact: boolean;
  copy: AuthTurnstileCopy;
  onTokenChange: (token: string) => void;
}

const AuthTurnstile = forwardRef<AuthTurnstileHandle, AuthTurnstileProps>(({
  siteKey,
  development,
  theme,
  language,
  compact,
  copy,
  onTokenChange,
}, forwardedRef) => {
  const [attempt, setAttempt] = useState(0);
  const [issue, setIssue] = useState<AuthTurnstileIssue | null>(null);
  const boundRef = useRef<BoundTurnstileObject | null>(null);
  const appearanceRef = useRef(`${theme}:${language}`);

  const clearToken = () => onTokenChange('');

  const setFailure = (nextIssue: AuthTurnstileIssue) => {
    clearToken();
    setIssue(nextIssue);
  };

  const reset = () => {
    clearToken();
    setIssue(null);
    try {
      boundRef.current?.reset();
    } catch {
      // Remounting below provides a clean recovery path when the widget no
      // longer accepts commands after a network or browser-level failure.
    }
    boundRef.current = null;
    setAttempt((current) => current + 1);
  };

  useImperativeHandle(forwardedRef, () => ({ reset }));

  useEffect(() => {
    const nextAppearance = `${theme}:${language}`;
    if (appearanceRef.current === nextAppearance) return;
    appearanceRef.current = nextAppearance;
    boundRef.current = null;
    clearToken();
    setIssue(null);
    setAttempt((current) => current + 1);
    // onTokenChange deliberately does not participate in this appearance
    // lifecycle. Callers pass React state setters, and a freshly created
    // callback must not repeatedly invalidate a valid challenge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, language]);

  if (!siteKey) {
    return development ? (
      <div className="auth-captcha-placeholder" role="status">{copy.developmentBypass}</div>
    ) : (
      <div className="auth-captcha-placeholder error" role="alert">{copy.missingConfiguration}</div>
    );
  }

  const issueMessage = issue === 'timeout'
    ? copy.timedOut
    : issue === 'unsupported'
      ? copy.unsupported
      : copy.loadFailed;

  return (
    <div className="auth-turnstile-control">
      <Turnstile
        key={attempt}
        sitekey={siteKey}
        className="auth-turnstile"
        size={compact ? 'compact' : 'flexible'}
        fixedSize
        onLoad={(_widgetId, bound) => {
          boundRef.current = bound;
          setIssue(null);
        }}
        onVerify={(token) => {
          setIssue(null);
          onTokenChange(token);
        }}
        onError={() => setFailure('error')}
        onExpire={clearToken}
        onTimeout={() => setFailure('timeout')}
        onUnsupported={() => setFailure('unsupported')}
        theme={theme}
        language={language === 'zh-CN' ? 'zh-cn' : 'en'}
      />
      {issue && (
        <div className="auth-captcha-feedback" role="alert" aria-live="assertive">
          <span>{issueMessage}</span>
          <div>
            <button type="button" onClick={reset}>{copy.retry}</button>
            {!boundRef.current && (
              <button type="button" onClick={() => window.location.reload()}>{copy.reload}</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

AuthTurnstile.displayName = 'AuthTurnstile';

export default AuthTurnstile;
