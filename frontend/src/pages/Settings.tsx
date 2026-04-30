import React from 'react';
import { Typography, Card, Button, Space } from 'antd';
import { SettingOutlined, ApiOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const Settings: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Title level={2}>
        <SettingOutlined style={{ marginRight: 12 }} />
        Settings
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 32 }}>
        Manage platform API connections, trading credentials, and AI provider settings.
      </Text>

      <Card
        hoverable
        style={{ marginBottom: 16 }}
        onClick={() => navigate('/settings/configuration')}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space direction="vertical" size={4}>
            <Title level={4} style={{ margin: 0 }}>
              <ApiOutlined style={{ marginRight: 8 }} />
              Configuration
            </Title>
            <Text type="secondary">
              Configure Alpaca, Finnhub, and AI provider connections.
            </Text>
          </Space>
          <Button type="primary" icon={<ArrowRightOutlined />}>
            Open Configuration
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Settings;
