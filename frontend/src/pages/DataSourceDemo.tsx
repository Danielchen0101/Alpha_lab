import React from 'react';
import { Card, Row, Col, Typography, Space, Divider } from 'antd';
import DataSourceBadge from '../components/DataSourceBadge';

const { Title, Text } = Typography;

const DataSourceDemo: React.FC = () => {
  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>数据来源标注演示</Title>
      <Text type="secondary">
        在每个页面的左下角显示数据来源，明确区分市场数据和交易数据。
      </Text>
      
      <Divider />
      
      <Row gutter={[24, 24]}>
        <Col span={12}>
          <Card title="市场数据页面" size="small">
            <div style={{ height: '200px', position: 'relative', border: '1px dashed #f0f0f0', borderRadius: '8px' }}>
              <div style={{ padding: '16px' }}>
                <Text strong>示例：Market 页面</Text>
                <br />
                <Text type="secondary">显示股票列表、实时价格、市值等</Text>
              </div>
              
              {/* 模拟数据来源标注 */}
              <div style={{ 
                position: 'absolute', 
                bottom: 8, 
                left: 8,
                opacity: 0.8
              }}>
                <DataSourceBadge 
                  source="Finnhub" 
                  position="bottom-left"
                  compact={true}
                />
              </div>
            </div>
            
            <div style={{ marginTop: '16px' }}>
              <Text type="secondary">标注位置：左下角</Text>
              <br />
              <Text type="secondary">数据来源：Finnhub</Text>
              <br />
              <Text type="secondary">用途：实时市场数据</Text>
            </div>
          </Card>
        </Col>
        
        <Col span={12}>
          <Card title="交易执行页面" size="small">
            <div style={{ height: '200px', position: 'relative', border: '1px dashed #f0f0f0', borderRadius: '8px' }}>
              <div style={{ padding: '16px' }}>
                <Text strong>示例：交易订单页面</Text>
                <br />
                <Text type="secondary">显示账户余额、持仓、订单状态等</Text>
              </div>
              
              {/* 模拟数据来源标注 */}
              <div style={{ 
                position: 'absolute', 
                bottom: 8, 
                left: 8,
                opacity: 0.8
              }}>
                <DataSourceBadge 
                  source="Alpaca Markets" 
                  position="bottom-left"
                  compact={true}
                />
              </div>
            </div>
            
            <div style={{ marginTop: '16px' }}>
              <Text type="secondary">标注位置：左下角</Text>
              <br />
              <Text type="secondary">数据来源：Alpaca Markets</Text>
              <br />
              <Text type="secondary">用途：交易执行和账户管理</Text>
            </div>
          </Card>
        </Col>
        
        <Col span={12}>
          <Card title="分析页面" size="small">
            <div style={{ height: '200px', position: 'relative', border: '1px dashed #f0f0f0', borderRadius: '8px' }}>
              <div style={{ padding: '16px' }}>
                <Text strong>示例：Symbol Analysis 页面</Text>
                <br />
                <Text type="secondary">显示股票分析、历史图表、技术指标</Text>
              </div>
              
              {/* 模拟数据来源标注 */}
              <div style={{ 
                position: 'absolute', 
                bottom: 8, 
                left: 8,
                opacity: 0.8
              }}>
                <DataSourceBadge 
                  source="Finnhub" 
                  position="bottom-left"
                  compact={true}
                />
              </div>
            </div>
            
            <div style={{ marginTop: '16px' }}>
              <Text type="secondary">标注位置：左下角</Text>
              <br />
              <Text type="secondary">数据来源：Finnhub</Text>
              <br />
              <Text type="secondary">用途：历史数据和技术分析</Text>
            </div>
          </Card>
        </Col>
        
        <Col span={12}>
          <Card title="仪表板页面" size="small">
            <div style={{ height: '200px', position: 'relative', border: '1px dashed #f0f0f0', borderRadius: '8px' }}>
              <div style={{ padding: '16px' }}>
                <Text strong>示例：Dashboard 页面</Text>
                <br />
                <Text type="secondary">显示市场概览、系统状态、回测结果</Text>
              </div>
              
              {/* 模拟多个数据来源标注 */}
              <div style={{ 
                position: 'absolute', 
                bottom: 8, 
                left: 8,
                opacity: 0.8
              }}>
                <DataSourceBadge 
                  source="Finnhub" 
                  position="bottom-left"
                  compact={true}
                />
              </div>
              <div style={{ 
                position: 'absolute', 
                bottom: 8, 
                right: 8,
                opacity: 0.8
              }}>
                <DataSourceBadge 
                  source="System Metrics" 
                  position="bottom-right"
                  compact={true}
                />
              </div>
            </div>
            
            <div style={{ marginTop: '16px' }}>
              <Text type="secondary">标注位置：左下角 + 右下角</Text>
              <br />
              <Text type="secondary">数据来源：Finnhub + 系统指标</Text>
              <br />
              <Text type="secondary">用途：混合数据展示</Text>
            </div>
          </Card>
        </Col>
      </Row>
      
      <Divider />
      
      <Card title="数据来源标注规则" size="small">
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <div>
              <Text strong>Finnhub</Text>
              <br />
              <Text type="secondary">颜色：蓝色</Text>
              <br />
              <Text type="secondary">图标：📊</Text>
              <br />
              <Text type="secondary">用于：所有市场数据</Text>
            </div>
          </Col>
          
          <Col span={8}>
            <div>
              <Text strong>Alpaca Markets</Text>
              <br />
              <Text type="secondary">颜色：绿色</Text>
              <br />
              <Text type="secondary">图标：💰</Text>
              <br />
              <Text type="secondary">用于：所有交易执行</Text>
            </div>
          </Col>
          
          <Col span={8}>
            <div>
              <Text strong>系统指标</Text>
              <br />
              <Text type="secondary">颜色：灰色</Text>
              <br />
              <Text type="secondary">图标：⚙️</Text>
              <br />
              <Text type="secondary">用于：本地系统数据</Text>
            </div>
          </Col>
        </Row>
        
        <Divider />
        
        <div>
          <Text strong>实现方式：</Text>
          <br />
          <Text type="secondary">1. 导入 DataSourceBadge 组件</Text>
          <br />
          <Text type="secondary">2. 在页面返回语句中添加标注</Text>
          <br />
          <Text type="secondary">3. 根据页面类型选择合适的数据源</Text>
          <br />
          <Text type="secondary">4. 设置标注位置（默认左下角）</Text>
        </div>
      </Card>
      
      <Divider />
      
      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <Text type="secondary">
          已更新页面：Market.tsx, Dashboard.tsx, Backtest.tsx, SymbolAnalysis_new.tsx
        </Text>
      </div>
    </div>
  );
};

export default DataSourceDemo;