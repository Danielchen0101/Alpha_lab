import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Typography, Alert, Checkbox } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleFinish = async (values: { fullName: string; email: string; password: string; confirmPassword: string; terms?: boolean }) => {
    setError('');
    if (values.password !== values.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    const result = await signUp(values.email, values.password);
    setSubmitting(false);
    if (result.success) {
      setConfirmMessage(result.message || '');
      setSubmitted(true);
    } else {
      setError(result.message || 'Registration failed');
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
        position: 'absolute', top: '10%', right: '15%', width: '60vw', height: '60vw',
        maxWidth: 800, maxHeight: 800,
        background: 'radial-gradient(circle, rgba(114,46,209,0.08) 0%, rgba(3,8,22,0) 70%)',
        filter: 'blur(80px)', zIndex: 0, pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '10%', left: '15%', width: '50vw', height: '50vw',
        maxWidth: 700, maxHeight: 700,
        background: 'radial-gradient(circle, rgba(24,144,255,0.06) 0%, rgba(3,8,22,0) 70%)',
        filter: 'blur(80px)', zIndex: 0, pointerEvents: 'none',
      }} />

      <div style={{
        display: 'flex', width: '100%', maxWidth: 1000, minHeight: 660,
        background: 'rgba(17,25,40,0.6)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 24, overflow: 'hidden',
        backdropFilter: 'blur(24px)',
        boxShadow: '0 30px 60px -12px rgba(0,0,0,0.8), 0 0 40px rgba(114,46,209,0.05)',
        position: 'relative', zIndex: 1,
      }}>
        {/* Left panel — features showcase */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: '60px 48px',
          background: 'linear-gradient(160deg, rgba(114,46,209,0.04) 0%, rgba(24,144,255,0.04) 100%)',
          borderRight: '1px solid rgba(255,255,255,0.05)',
          position: 'relative'
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'radial-gradient(circle at bottom left, rgba(114,46,209,0.1), transparent 70%)', pointerEvents: 'none' }} />
          
          <div style={{ maxWidth: 360, position: 'relative', zIndex: 1 }}>
            <h3 style={{ color: '#fff', marginBottom: 40, fontWeight: 700, fontSize: '1.8rem', letterSpacing: '-0.02em' }}>
              Build your trading edge
            </h3>
            {[
              { title: 'AI-Powered Analysis', desc: 'Deep market insights driven by multi-provider AI.' },
              { title: 'Strategy Backtesting', desc: 'Validate before you trade with historical simulation.' },
              { title: 'Risk-Aware Trading', desc: 'Built-in position sizing and stop-loss calculations.' },
              { title: 'Paper & Live Trading', desc: 'Test with paper, deploy with confidence via Alpaca.' },
            ].map((item, i) => (
              <div key={i} style={{ marginBottom: 32 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#722ed1', boxShadow: '0 0 12px rgba(114,46,209,0.6)',
                  }} />
                  <Text style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 600 }}>{item.title}</Text>
                </div>
                <Text style={{ color: '#94a3b8', fontSize: '0.95rem', paddingLeft: 20, lineHeight: 1.5, display: 'block' }}>{item.desc}</Text>
              </div>
            ))}
            <div style={{
              marginTop: 40, padding: '16px 20px', borderRadius: 12,
              background: 'rgba(24,144,255,0.05)', border: '1px solid rgba(24,144,255,0.15)',
            }}>
              <Text style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.5 }}>
                AI provider setup (DeepSeek, OpenAI, Claude) and broker API keys can be securely configured after sign up in Settings.
              </Text>
            </div>
          </div>
        </div>

        {/* Right panel — form */}
        <div style={{ flex: 1, padding: '60px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ marginBottom: 32 }}>
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
            <Title level={2} style={{ color: '#fff', marginBottom: 12, fontWeight: 700, fontSize: '2rem', letterSpacing: '-0.02em' }}>Create account</Title>
            <Text style={{ color: '#94a3b8', fontSize: '1.1rem' }}>
              Start building your AI-powered quantitative workflow.
            </Text>
          </div>

          {submitted ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%', margin: '0 auto 32px',
                background: 'rgba(24,144,255,0.1)', border: '2px solid #1890ff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 36, color: '#1890ff', boxShadow: '0 0 30px rgba(24,144,255,0.2)'
              }}>✓</div>
              <Title level={3} style={{ color: '#fff', marginBottom: 16, fontSize: '1.8rem', fontWeight: 700 }}>Account created</Title>
              <Text style={{ color: '#94a3b8', fontSize: '1.1rem', display: 'block', marginBottom: 40, lineHeight: 1.6 }}>
                {confirmMessage || 'Your account has been created successfully.'}
              </Text>
              <Button
                type="primary"
                size="large"
                onClick={() => navigate('/signin')}
                style={{
                  height: 52, borderRadius: 12, fontSize: '1.1rem', fontWeight: 600,
                  background: 'linear-gradient(135deg, #1890ff 0%, #2f54eb 100%)', border: 'none',
                  paddingInline: 48, boxShadow: '0 8px 24px rgba(24,144,255,0.3)'
                }}
              >
                Go to Sign In
              </Button>
            </div>
          ) : (
            <>
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

              <Form layout="vertical" onFinish={handleFinish} autoComplete="off" style={{ maxWidth: 420 }}>
                <Form.Item name="fullName" rules={[{ required: true, message: 'Please enter your name' }]}>
                  <Input
                    prefix={<UserOutlined style={{ color: '#64748b' }} />}
                    placeholder="Full name"
                    size="large"
                    style={{
                      background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff', borderRadius: 12, height: 52, fontSize: '1rem'
                    }}
                  />
                </Form.Item>
                <Form.Item name="email" rules={[{ required: true, message: 'Please enter your email' }, { type: 'email', message: 'Please enter a valid email' }]}>
                  <Input
                    prefix={<MailOutlined style={{ color: '#64748b' }} />}
                    placeholder="Email address"
                    size="large"
                    style={{
                      background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff', borderRadius: 12, height: 52, fontSize: '1rem'
                    }}
                  />
                </Form.Item>
                <Form.Item name="password" rules={[{ required: true, message: 'Please enter a password' }, { min: 6, message: 'Password must be at least 6 characters' }]}>
                  <Input.Password
                    prefix={<LockOutlined style={{ color: '#64748b' }} />}
                    placeholder="Password"
                    size="large"
                    style={{
                      background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff', borderRadius: 12, height: 52, fontSize: '1rem'
                    }}
                  />
                </Form.Item>
                <Form.Item
                  name="confirmPassword"
                  dependencies={['password']}
                  rules={[
                    { required: true, message: 'Please confirm your password' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('password') === value) return Promise.resolve();
                        return Promise.reject(new Error('Passwords do not match'));
                      },
                    }),
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined style={{ color: '#64748b' }} />}
                    placeholder="Confirm password"
                    size="large"
                    style={{
                      background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff', borderRadius: 12, height: 52, fontSize: '1rem'
                    }}
                  />
                </Form.Item>
                <Form.Item name="terms" valuePropName="checked" rules={[{
                  validator: (_, value) => value ? Promise.resolve() : Promise.reject(new Error('You must accept the terms')),
                }]}>
                  <Checkbox style={{ color: '#94a3b8' }}>
                    I agree to the{' '}
                    <a href="#" style={{ color: '#1890ff' }} onClick={(e) => e.preventDefault()}>Terms of Service</a>
                    {' '}and{' '}
                    <a href="#" style={{ color: '#1890ff' }} onClick={(e) => e.preventDefault()}>Privacy Policy</a>
                  </Checkbox>
                </Form.Item>
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
                    Create Account
                  </Button>
                </Form.Item>
              </Form>

              <div style={{ marginTop: 8 }}>
                <Text style={{ color: '#94a3b8', fontSize: '1rem' }}>
                  Already have an account?{' '}
                  <Link to="/signin" style={{ color: '#1890ff', fontWeight: 600 }}>Sign in</Link>
                </Text>
              </div>
              <div style={{ marginTop: 24 }}>
                <Link to="/" style={{ color: '#64748b', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ArrowLeftOutlined /> Back to home
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignUp;
