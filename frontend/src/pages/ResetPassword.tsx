import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Form, Input, Typography } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import {
  clearPersistedSupabaseAuthSession,
  supabase,
} from '../lib/supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import {
  classifyAuthCallbackError,
  parseAuthCallback,
  scheduleAuthCallbackRedemption,
} from '../lib/authCallback';
import type { AuthCallbackErrorKind } from '../lib/authCallback';
import AuthPageNav from '../components/AuthPageNav';
import '../styles/Auth.css';

const { Title, Text } = Typography;
const PASSWORD_MIN_LENGTH = 8;

export const satisfiesResetPasswordPolicy = (password: string) => (
  password.length >= PASSWORD_MIN_LENGTH
  && /[a-z]/.test(password)
  && /[A-Z]/.test(password)
  && /[0-9]/.test(password)
);

const ResetPassword: React.FC = () => {
  const { t, language } = useLanguage();
  const [form] = Form.useForm();
  const [checking, setChecking] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [error, setError] = useState('');
  const [recoveryErrorKind, setRecoveryErrorKind] = useState<AuthCallbackErrorKind | null>(null);
  const [formValid, setFormValid] = useState(false);
  const initialCallbackRef = useRef<ReturnType<typeof parseAuthCallback> | null>(null);
  if (initialCallbackRef.current === null) {
    initialCallbackRef.current = parseAuthCallback(window.location.search, window.location.hash);
  }

  useEffect(() => {
    window.scrollTo(0, 0);
    let active = true;
    let settled = false;
    const callback = initialCallbackRef.current!;
    window.history.replaceState({}, document.title, '/reset-password');

    const finishReady = () => {
      if (!active || settled) return;
      settled = true;
      setError('');
      setRecoveryErrorKind(null);
      setRecoveryReady(true);
      setChecking(false);
    };

    const finishInvalid = (kind: AuthCallbackErrorKind = 'invalid') => {
      if (!active || settled) return;
      settled = true;
      setRecoveryErrorKind(kind);
      setRecoveryReady(false);
      setChecking(false);
    };

    const timeout = window.setTimeout(() => finishInvalid('network'), 15000);

    const discardCancelledSession = async (sessionAvailable: boolean) => {
      if (!sessionAvailable || (active && !settled)) return false;
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // Persisted storage is cleared below and the timeout path hard reloads.
      } finally {
        clearPersistedSupabaseAuthSession();
      }
      if (active && settled) {
        window.location.replace(
          '/reset-password?error=timeout&error_description=Recovery+verification+timed+out',
        );
      } else if (!active) {
        window.location.replace('/signin');
      }
      return true;
    };

    const verifyRecovery = async () => {
      try {
        if (callback.kind === 'provider_error') {
          const kind = classifyAuthCallbackError(`${callback.code} ${callback.description}`);
          finishInvalid(kind);
          return;
        }

        if (callback.kind === 'token_hash') {
          if (callback.otpType !== 'recovery') {
            finishInvalid();
            return;
          }
          const { data, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: callback.tokenHash,
            type: 'recovery',
          });
          if (verifyError || !data.session) {
            finishInvalid(classifyAuthCallbackError(
              verifyError?.message || 'invalid recovery response',
            ));
            return;
          }
          if (await discardCancelledSession(Boolean(data.session))) return;
          finishReady();
          return;
        }

        if (callback.kind === 'code') {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(callback.code);
          const redirectType = (data as typeof data & { redirectType?: string | null }).redirectType;
          if (await discardCancelledSession(Boolean(data.session))) return;
          if (exchangeError || !data.session || redirectType !== 'recovery') {
            if (data.session) await supabase.auth.signOut({ scope: 'local' });
            finishInvalid(classifyAuthCallbackError(
              exchangeError?.message || 'unexpected recovery flow',
            ));
            return;
          }
          finishReady();
          return;
        }

        if (callback.kind === 'implicit') {
          if (callback.flowType !== 'recovery') {
            finishInvalid();
            return;
          }
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: callback.accessToken,
            refresh_token: callback.refreshToken,
          });
          if (sessionError || !data.session) {
            finishInvalid(classifyAuthCallbackError(
              sessionError?.message || 'invalid recovery session',
            ));
            return;
          }
          if (await discardCancelledSession(Boolean(data.session))) return;
          finishReady();
          return;
        }

        // Never treat an unrelated browser session as proof that this page was
        // opened from a valid password-recovery message.
        finishInvalid();
      } catch (verifyError: unknown) {
        finishInvalid(classifyAuthCallbackError(
          verifyError instanceof Error ? verifyError.message : 'invalid recovery callback',
        ));
      } finally {
        window.clearTimeout(timeout);
      }
    };

    const cancelRedemption = scheduleAuthCallbackRedemption(() => void verifyRecovery());
    return () => {
      active = false;
      cancelRedemption();
      window.clearTimeout(timeout);
    };
  }, []);

  const handleUpdate = async ({ password, confirmPassword }: { password: string; confirmPassword: string }) => {
    if (!satisfiesResetPasswordPolicy(password)) {
      setError(t.auth.passwordPolicyError);
      return;
    }
    if (password !== confirmPassword) {
      setError(t.auth.passwordsDoNotMatchError);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        const updateMessage = updateError.message.toLowerCase();
        setError(
          updateMessage.includes('weak')
          || updateMessage.includes('should contain')
          || updateMessage.includes('password strength')
            ? t.auth.errorWeakPassword
            : t.auth.passwordUpdateFailed || t.auth.errorUnexpected,
        );
        return;
      }
      // A recovery flow is security-sensitive: revoke refresh tokens for every
      // session, not only the temporary recovery session in this browser.
      try {
        const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
        if (signOutError) {
          clearPersistedSupabaseAuthSession();
          window.location.replace('/signin?passwordUpdated=1&sessionWarning=1');
          return;
        }
      } catch {
        clearPersistedSupabaseAuthSession();
        window.location.replace('/signin?passwordUpdated=1&sessionWarning=1');
        return;
      }
      setUpdated(true);
      setRecoveryReady(false);
      window.history.replaceState({}, document.title, '/reset-password');
    } catch {
      setError(t.auth.passwordUpdateFailed || t.auth.errorUnexpected);
    } finally {
      setSubmitting(false);
    }
  };

  const invalid = !checking && !recoveryReady && !updated;
  const recoveryErrorMessage = recoveryErrorKind === 'network'
    ? t.auth.errorNetworkIssue
    : t.auth.resetLinkInvalid;
  return (
    <main className="auth-shell">
      <AuthPageNav backLabel={t.auth.backToHome} />
      <div className="auth-card-container"><section className="auth-card signup auth-card--compact"><header className="auth-card-header"><Link to="/" className="auth-brand-logo-text">Alpha<span className="accent">Lab</span></Link><span className="auth-card-eyebrow">{language === 'zh-CN' ? '账户恢复 / 02' : 'ACCOUNT RECOVERY / 02'}</span><Title level={1} className="auth-title">{updated ? t.auth.passwordUpdatedTitle : t.auth.resetPasswordTitle}</Title><Text className="auth-subtitle">{updated ? t.auth.passwordUpdatedDesc : t.auth.resetPasswordDesc}</Text></header><div className="auth-form-content">
        {checking ? <div className="auth-status-panel" role="status" aria-live="polite"><span className="spinner is-dark" /><Text>{language === 'zh-CN' ? '正在验证恢复链接…' : 'Verifying recovery link…'}</Text></div> : updated ? <div className="auth-status-panel" role="status" aria-live="polite"><div className="auth-status-mark is-success" aria-hidden="true">✓</div><Link to="/signin" className="auth-link-forgot">{t.auth.backToSignIn}</Link></div> : invalid ? <div className="auth-status-panel" role="alert"><div className="auth-status-mark is-error" aria-hidden="true">!</div><Alert message={recoveryErrorMessage} description={recoveryErrorKind === 'network' ? undefined : t.auth.errorResetLinkExpired} type="error" showIcon /><Link to="/forgot-password" className="auth-link-forgot">{t.auth.requestNewResetLink}</Link></div> : <>
          {error && <Alert message={error} type="error" showIcon closable onClose={() => setError('')} style={{ marginBottom: 18 }} />}
          <Form
            form={form}
            layout="vertical"
            onFinish={handleUpdate}
            autoComplete="on"
            aria-busy={submitting}
            onValuesChange={(_, values) => setFormValid(
              satisfiesResetPasswordPolicy(values.password || '')
              && values.password === values.confirmPassword,
            )}
          >
            <Form.Item
              name="password"
              label={t.auth.newPassword}
              rules={[
                { required: true, message: t.auth.passwordPolicyError },
                {
                  validator: (_, value) => (
                    !value || satisfiesResetPasswordPolicy(value)
                      ? Promise.resolve()
                      : Promise.reject(new Error(t.auth.passwordPolicyError))
                  ),
                },
              ]}
            >
              <Input.Password className="auth-input" autoComplete="new-password" prefix={<LockOutlined aria-hidden="true" />} placeholder={t.auth.passwordPlaceholder} />
            </Form.Item>
            <Form.Item name="confirmPassword" label={t.auth.confirmPassword} dependencies={['password']} rules={[{ required: true, message: t.auth.passwordsDoNotMatch }, ({ getFieldValue }) => ({ validator(_, value) { return !value || value === getFieldValue('password') ? Promise.resolve() : Promise.reject(new Error(t.auth.passwordsDoNotMatch)); } })]}><Input.Password className="auth-input" autoComplete="new-password" prefix={<LockOutlined aria-hidden="true" />} /></Form.Item>
            <div className="auth-password-rules" aria-live="polite">
              {[
                { test: (value: string) => value.length >= PASSWORD_MIN_LENGTH, label: t.auth.passwordRuleLength },
                { test: (value: string) => /[a-z]/.test(value), label: t.auth.passwordRuleLower },
                { test: (value: string) => /[A-Z]/.test(value), label: t.auth.passwordRuleUpper },
                { test: (value: string) => /[0-9]/.test(value), label: t.auth.passwordRuleNumber },
                { test: (value: string) => value === form.getFieldValue('confirmPassword') && value.length > 0, label: t.auth.passwordRuleMatch },
              ].map((rule) => {
                const password = form.getFieldValue('password') || '';
                const met = !!password && rule.test(password);
                return (
                  <div key={rule.label} className={`auth-password-rule ${met ? 'is-met' : ''}`}>
                    <span aria-hidden="true" className="auth-password-rule-mark">{met ? '✓' : '○'}</span>
                    {rule.label}
                  </div>
                );
              })}
            </div>
            <Button htmlType="submit" type="primary" block className="auth-btn" loading={submitting} disabled={!formValid || submitting}>{t.auth.updatePassword}</Button>
          </Form>
        </>}
      </div></section></div>
    </main>
  );
};
export default ResetPassword;
