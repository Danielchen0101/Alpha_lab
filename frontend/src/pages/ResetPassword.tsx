import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Typography, Alert } from 'antd';
import { LockOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { supabase } from '../lib/supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';

const { Title, Text } = Typography;

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const isCN = language === 'zh-CN';
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [formValid, setFormValid] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace('#', '?'));
    const hashErr = params.get('error') || params.get('error_code') || params.get('error_description');
    const urlParams = new URLSearchParams(window.location.search);
    const searchErr = urlParams.get('error') || urlParams.get('error_code') || urlParams.get('error_description');

    if (hashErr || searchErr) {
      setLinkInvalid(true);
      setError(t.auth.resetLinkInvalid);
      return;
    }

    // Check if user has a valid recovery session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // No active session — check hash for type=recovery
        const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
        const type = hashParams.get('type');
        if (type !== 'recovery') {
          setLinkInvalid(true);
          setError(t.auth.resetLinkInvalid);
        }
      }
    });
  }, [t.auth.resetLinkInvalid]);

  const onValuesChange = () => {
    const vals = form.getFieldsValue();
    setFormValid(!!vals.password && !!vals.confirmPassword && vals.password === vals.confirmPassword && vals.password.length >= 8);
  };

  const handleUpdate = async (values: { password: string; confirmPassword: string }) => {
    if (values.password !== values.confirmPassword) {
      setError(t.auth.passwordsDoNotMatchError);
      return;
    }
    if (values.password.length < 8) {
      setError(t.auth.passwordMinLength);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: values.password,
      });
      if (updateError) {
        const errMsg = updateError.message?.toLowerCase() || '';
        if (errMsg.includes('otp_expired') || errMsg.includes('invalid') || errMsg.includes('expired')) {
          setError(t.auth.resetLinkInvalid);
        } else {
          setError(updateError.message);
        }
        setSubmitting(false);
        return;
      }
      setUpdated(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Password update failed';
      setError(msg);
    }
    setSubmitting(false);
  };

  if (linkInvalid) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#020611',
          color: '#e2e8f0',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '10%', left: '15%', width: '60vw', height: '60vw',
            maxWidth: 800, maxHeight: 800,
            background: 'radial-gradient(circle, rgba(24,144,255,0.1) 0%, rgba(3,8,22,0) 70%)',
            filter: 'blur(80px)', zIndex: 0, pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'relative', zIndex: 1, width: '100%', maxWidth: 460,
            background: 'rgba(17,25,40,0.65)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24,
            backdropFilter: 'blur(24px)',
            boxShadow: '0 30px 60px -12px rgba(0,0,0,0.8), 0 0 40px rgba(24,144,255,0.05)',
            padding: '48px 40px', textAlign: 'center',
          }}
        >
          <img src="/brand/alphalab-logo.png" alt="AlphaLab" style={{ height: 40, marginBottom: 32, cursor: 'pointer' }} onClick={() => navigate('/')} />
          <Alert message={error} type="error" showIcon style={{ marginBottom: 24, borderRadius: 8, color: '#fca5a5', background: 'rgba(255,77,79,0.08)', border: '1px solid rgba(255,77,79,0.25)' }} />
          <Link to="/forgot-password" style={{ color: '#60a5fa', fontWeight: 600, fontSize: '0.95rem' }}>
            {t.auth.requestNewResetLink}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#020611',
        color: '#e2e8f0',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: '10%', left: '15%', width: '60vw', height: '60vw',
        maxWidth: 800, maxHeight: 800,
        background: 'radial-gradient(circle, rgba(24,144,255,0.1) 0%, rgba(3,8,22,0) 70%)',
        filter: 'blur(80px)', zIndex: 0, pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '10%', right: '15%', width: '50vw', height: '50vw',
        maxWidth: 700, maxHeight: 700,
        background: 'radial-gradient(circle, rgba(114,46,209,0.08) 0%, rgba(3,8,22,0) 70%)',
        filter: 'blur(80px)', zIndex: 0, pointerEvents: 'none',
      }} />

      <div style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth: 460,
        background: 'rgba(17,25,40,0.65)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24,
        backdropFilter: 'blur(24px)',
        boxShadow: '0 30px 60px -12px rgba(0,0,0,0.8), 0 0 40px rgba(24,144,255,0.05)',
        padding: '48px 40px',
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <img src="/brand/alphalab-logo.png" alt="AlphaLab" style={{ height: 40, width: 'auto', objectFit: 'contain', cursor: 'pointer' }} onClick={() => navigate('/')} />
        </div>

        {updated ? (
          <>
            <Alert
              message={t.auth.passwordUpdated}
              type="success"
              showIcon
              style={{
                marginBottom: 24, borderRadius: 8,
                background: 'rgba(82, 196, 26, 0.1)',
                border: '1px solid rgba(82, 196, 26, 0.25)',
                color: '#86efac',
              }}
            />
            <Button
              type="primary" block size="large"
              onClick={() => navigate('/signin')}
              style={{
                height: 48, borderRadius: 12, fontSize: '1rem', fontWeight: 600,
                background: 'linear-gradient(135deg, #1890ff 0%, #2f54eb 100%)',
                border: 'none', color: '#fff',
                boxShadow: '0 8px 24px rgba(24,144,255,0.3)',
              }}
            >
              {t.auth.backToSignIn}
            </Button>
          </>
        ) : (
          <>
            <Title level={2} style={{
              color: '#fff', marginBottom: 12, fontWeight: 700, fontSize: '1.6rem',
              textAlign: 'center', letterSpacing: '-0.02em',
            }}>
              {t.auth.resetPasswordTitle}
            </Title>
            <Text style={{
              color: '#cbd5e1', fontSize: '0.95rem', lineHeight: 1.6,
              display: 'block', textAlign: 'center', marginBottom: 32,
            }}>
              {t.auth.resetPasswordDesc}
            </Text>

            {error && (
              <Alert message={error} type="error" showIcon closable onClose={() => setError('')}
                style={{ marginBottom: 20, borderRadius: 8, color: '#fca5a5', background: 'rgba(255,77,79,0.08)', border: '1px solid rgba(255,77,79,0.25)' }} />
            )}

            <Form
              form={form}
              layout="vertical"
              onFinish={handleUpdate}
              onValuesChange={onValuesChange}
              autoComplete="off"
            >
              {/* New password */}
              <Form.Item
                name="password"
                label={<span style={{ color: '#cbd5e1', fontWeight: 500 }}>{t.auth.newPassword}</span>}
                rules={[
                  { required: true, message: t.auth.passwordMinLength },
                  { min: 8, message: t.auth.passwordMinLength },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#94A3B8' }} />}
                  placeholder={t.auth.newPassword}
                  size="large"
                  style={{
                    height: 48, borderRadius: 12, background: 'rgba(0,0,0,0.35)',
                    border: '1px solid rgba(255,255,255,0.10)', color: '#F8FAFC',
                  }}
                />
              </Form.Item>

              {/* Confirm password */}
              <Form.Item
                name="confirmPassword"
                label={<span style={{ color: '#cbd5e1', fontWeight: 500 }}>{t.auth.confirmNewPassword}</span>}
                rules={[
                  { required: true, message: t.auth.passwordsDoNotMatch },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) return Promise.resolve();
                      return Promise.reject(new Error(t.auth.passwordsDoNotMatch));
                    },
                  }),
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#94A3B8' }} />}
                  placeholder={t.auth.confirmNewPassword}
                  size="large"
                  style={{
                    height: 48, borderRadius: 12, background: 'rgba(0,0,0,0.35)',
                    border: '1px solid rgba(255,255,255,0.10)', color: '#F8FAFC',
                  }}
                />
              </Form.Item>

              {/* Submit */}
              <Form.Item style={{ marginBottom: 16 }}>
                <Button
                  type="primary" htmlType="submit"
                  loading={submitting}
                  disabled={!formValid || submitting}
                  block size="large"
                  style={{
                    height: 48, borderRadius: 12, fontSize: '1rem', fontWeight: 600,
                    background: 'linear-gradient(135deg, #1890ff 0%, #2f54eb 100%)',
                    border: 'none', color: '#fff',
                    boxShadow: '0 8px 24px rgba(24,144,255,0.3)',
                  }}
                >
                  {submitting ? (isCN ? '更新中...' : 'Updating...') : t.auth.updatePassword}
                </Button>
              </Form.Item>
            </Form>
          </>
        )}

        {/* Back to Sign In */}
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Link to="/signin" style={{
            color: '#60a5fa', fontSize: '0.9rem', textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'color 0.2s',
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#93c5fd'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#60a5fa'; }}
          >
            <ArrowLeftOutlined /> {t.auth.backToSignIn}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
