import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, Alert } from 'antd';
import { UserOutlined, LockOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, loading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (loading) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleLogin = async (values: { email: string; password: string }) => {
    setSubmitting(true);
    setError('');
    const result = await login(values.email, values.password);
    setSubmitting(false);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.message || 'Login failed');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a1628', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Card style={{ width: 400, borderRadius: 8 }} bodyStyle={{ padding: 40 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2} style={{ marginBottom: 4 }}>AlphaLab</Title>
          <Text type="secondary">Sign in to your account</Text>
        </div>

        {error && <Alert message={error} type="error" showIcon closable onClose={() => setError('')} style={{ marginBottom: 24 }} />}

        <Form layout="vertical" onFinish={handleLogin} autoComplete="off">
          <Form.Item name="email" rules={[{ required: true, message: 'Please enter your email' }]}>
            <Input prefix={<UserOutlined />} placeholder="Email" size="large" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: 'Please enter your password' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting} block size="large">Login</Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center' }}>
          <button onClick={() => navigate('/')} style={{ color: '#1890ff', cursor: 'pointer', background: 'none', border: 'none', padding: 0, font: 'inherit' }}>
            <ArrowLeftOutlined /> Back to Home
          </button>
        </div>
      </Card>
    </div>
  );
};

export default Login;
