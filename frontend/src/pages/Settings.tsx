import React from 'react';
import { Card, Typography, Button, Row, Col } from 'antd';
import { SettingOutlined, ApiOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const Settings: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4 }}>
          <SettingOutlined style={{ marginRight: 8 }} />
          Settings
        </Title>
        <Text type="secondary">Manage platform configuration and API connections.</Text>
      </div>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card
            hoverable
            onClick={() => navigate('/settings/configuration')}
            style={{ cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <ApiOutlined style={{ fontSize: 28, color: '#1890ff' }} />
                <div>
                  <Text strong style={{ fontSize: 15, display: 'block' }}>Configuration</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Manage Alpaca, Finnhub, and AI provider API settings.
                  </Text>
                </div>
              </div>
              <Button type="primary" icon={<SettingOutlined />}>
                Open Configuration
              </Button>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Settings;
