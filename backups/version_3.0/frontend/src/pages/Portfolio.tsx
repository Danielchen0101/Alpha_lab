import React from 'react';
import { Card, Typography, Space, Statistic, Row, Col } from 'antd';
import { DollarOutlined, LineChartOutlined, PieChartOutlined, BarChartOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const Portfolio: React.FC = () => {
  return (
    <div>
      <Title level={2}>Portfolio</Title>
      <Text type="secondary">Your investment portfolio overview and analysis</Text>
      
      <div style={{ marginTop: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Total Value"
                value={125430.75}
                precision={2}
                prefix="$"
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Today's Change"
                value={+2345.67}
                precision={2}
                prefix="$"
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Today's % Change"
                value={1.87}
                precision={2}
                suffix="%"
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Total Return"
                value={+15.42}
                precision={2}
                suffix="%"
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
        </Row>
      </div>
      
      <div style={{ marginTop: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={16}>
            <Card 
              title="Portfolio Allocation" 
              extra={<PieChartOutlined />}
            >
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Text type="secondary">Portfolio allocation chart will be displayed here</Text>
              </div>
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card 
              title="Top Holdings" 
              extra={<BarChartOutlined />}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>AAPL</Text>
                  <Text strong>$45,230.50</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>MSFT</Text>
                  <Text strong>$32,150.25</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>GOOGL</Text>
                  <Text strong>$28,450.75</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>AMZN</Text>
                  <Text strong>$19,870.30</Text>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>
      </div>
      
      <div style={{ marginTop: 24 }}>
        <Card 
          title="Performance Overview" 
          extra={<LineChartOutlined />}
        >
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Text type="secondary">Performance chart will be displayed here</Text>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Portfolio;