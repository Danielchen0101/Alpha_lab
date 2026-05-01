import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { Form, Input, Button, Typography, Alert, Checkbox } from 'antd';
import { UserOutlined, LockOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

const REMEMBER_EMAIL_KEY = 'alpha_lab_remember_email';

const SignIn: React.FC = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, loading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form] = Form.useForm();

  useEffect(() => {
    window.scrollTo(0, 0);
    // Prefill email from remember me
    const savedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY);
    if (savedEmail) {
      form.setFieldsValue({ email: savedEmail, remember: true });
    }
  }, [form]);

  if (loading) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleLogin = async (values: { email: string; password: string; remember?: boolean }) => {
    setSubmitting(true);
    setError('');
    const result = await login(values.email, values.password);
    setSubmitting(false);
    if (result.success) {
      if (values.remember) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, values.email);
      } else {
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
      navigate('/dashboard');
    } else {
      setError(result.message || 'Login failed');
    }
  };

  return (
    <div style={{
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
    }}>
      {/* Background glow effects matching MarketingLayout */}
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
        display: 'flex', width: '100%', maxWidth: 1000, minHeight: 600,
        background: 'rgba(17,25,40,0.6)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 24, overflow: 'hidden',
        backdropFilter: 'blur(24px)',
        boxShadow: '0 30px 60px -12px rgba(0,0,0,0.8), 0 0 40px rgba(24,144,255,0.05)',
        position: 'relative', zIndex: 1,
      }}>
        {/* Left panel — form */}
        <div style={{ flex: 1, padding: '60px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ marginBottom: 40 }}>
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: 32, 
                cursor: 'pointer',
                background: 'transparent'
              }}
              onClick={() => navigate('/')}
            >
              <img 
                src="/brand/alphalab-logo.png" 
                alt="AlphaLab" 
                style={{ 
                  height: '40px', 
                  width: 'auto', 
                  objectFit: 'contain', 
                  background: 'transparent',
                  display: 'block'
                }} 
              />
            </div>
            <Title level={2} style={{ color: '#fff', marginBottom: 12, fontWeight: 700, fontSize: '2rem', letterSpacing: '-0.02em' }}>Welcome back</Title>
            <Text style={{ color: '#94a3b8', fontSize: '1.1rem' }}>
              Sign in to continue to your quantitative dashboard.
            </Text>
          </div>

          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              closable
              onClose={() => setError('')}
              style={{ marginBottom: 24, background: 'rgba(255,77,79,0.1)', border: '1px solid rgba(255,77,79,0.3)', color: '#ff4d4f', borderRadius: 8 }}
            />
          )}

          <Form form={form} layout="vertical" onFinish={handleLogin} autoComplete="off" style={{ maxWidth: 420 }}>
            <Form.Item name="email" rules={[{ required: true, message: 'Please enter your email' }]}>
              <Input
                prefix={<UserOutlined style={{ color: '#64748b' }} />}
                placeholder="Email address"
                size="large"
                style={{
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff', borderRadius: 12, height: 52, fontSize: '1rem'
                }}
              />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: 'Please enter your password' }]}>
              <Input.Password
                prefix={<LockOutlined style={{ color: '#64748b' }} />}
                placeholder="Password"
                size="large"
                autoComplete="current-password"
                style={{
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff', borderRadius: 12, height: 52, fontSize: '1rem'
                }}
              />
            </Form.Item>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
              <Form.Item name="remember" valuePropName="checked" noStyle>
                <Checkbox style={{ color: '#94a3b8' }}>Remember my email</Checkbox>
              </Form.Item>
              <a href="#" style={{ color: '#1890ff', fontSize: 14, fontWeight: 500 }} onClick={(e) => e.preventDefault()}>
                Forgot password?
              </a>
            </div>
            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
                block
                size="large"
                style={{
                  height: 52, borderRadius: 12, fontSize: '1.1rem', fontWeight: 600,
                  background: 'linear-gradient(135deg, #1890ff 0%, #2f54eb 100%)',
                  border: 'none',
                  boxShadow: '0 8px 24px rgba(24,144,255,0.3)'
                }}
              >
                Sign In
              </Button>
            </Form.Item>
          </Form>

          <div style={{ marginTop: 16 }}>
            <Text style={{ color: '#94a3b8', fontSize: '1rem' }}>
              Don't have an account?{' '}
              <Link to="/signup" style={{ color: '#1890ff', fontWeight: 600 }}>Create account</Link>
            </Text>
          </div>
          <div style={{ marginTop: 24 }}>
            <Link to="/" style={{ color: '#64748b', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ArrowLeftOutlined /> Back to home
            </Link>
          </div>
        </div>

        {/* Right panel — features showcase */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: '60px 48px',
          background: 'linear-gradient(145deg, rgba(24,144,255,0.03) 0%, rgba(114,46,209,0.05) 100%)',
          borderLeft: '1px solid rgba(255,255,255,0.05)',
          position: 'relative'
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'radial-gradient(circle at top right, rgba(24,144,255,0.1), transparent 70%)', pointerEvents: 'none' }} />
          
          <div style={{ maxWidth: 360, position: 'relative', zIndex: 1 }}>
            <h3 style={{ color: '#fff', marginBottom: 40, fontWeight: 700, fontSize: '1.8rem', letterSpacing: '-0.02em' }}>
              Your AI Trading Edge
            </h3>
            {[
              { title: 'AI Market Scanner', desc: 'Multi-stock screening with intelligent trend detection.' },
              { title: 'Backtesting Engine', desc: 'Validate strategies against historical tick data.' },
              { title: 'Risk-Aware Plans', desc: 'Deterministic entry, stop-loss, and target calculation.' },
              { title: 'Live Execution', desc: 'Seamlessly switch from paper to live Alpaca trading.' },
            ].map((item, i) => (
              <div key={i} style={{ marginBottom: 32 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#1890ff', boxShadow: '0 0 12px rgba(24,144,255,0.6)',
                  }} />
                  <Text style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 600 }}>{item.title}</Text>
                </div>
                <Text style={{ color: '#94a3b8', fontSize: '0.95rem', paddingLeft: 20, lineHeight: 1.5, display: 'block' }}>{item.desc}</Text>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
