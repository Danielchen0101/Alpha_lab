import React from 'react';
import { Card, Row, Col, Typography, List, Tag, Button } from 'antd';
import { LineChartOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;

const Analytics: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '600', marginBottom: '8px' }}>
            <LineChartOutlined /> AlphaLab — Analytics
          </h1>
          <div style={{ color: '#666', fontSize: '16px' }}>
            Portfolio-level analytics and backtest performance insights
          </div>
        </div>
        <Button 
          type="default" 
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/')}
          style={{ marginTop: '8px' }}
        >
          Back to Dashboard
        </Button>
      </div>

      {/* Overview Metrics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} lg={6}>
          <Card title="Total Return" size="small">
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 34, fontWeight: '800', color: '#389e0d', lineHeight: '1.1' }}>
                +24.5%
              </div>
              <div style={{ fontSize: 14, color: '#595959', marginTop: '12px', fontWeight: '500' }}>
                Across all backtests
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={6}>
          <Card title="Sharpe Ratio" size="small">
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 34, fontWeight: '800', color: '#096dd9', lineHeight: '1.1' }}>
                1.82
              </div>
              <div style={{ fontSize: 14, color: '#595959', marginTop: '12px', fontWeight: '500' }}>
                Risk-adjusted return
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={6}>
          <Card title="Max Drawdown" size="small">
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 34, fontWeight: '800', color: '#cf1322', lineHeight: '1.1' }}>
                -15.3%
              </div>
              <div style={{ fontSize: 14, color: '#595959', marginTop: '12px', fontWeight: '500' }}>
                Worst peak-to-trough
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={6}>
          <Card title="Win Rate" size="small">
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 34, fontWeight: '800', color: '#d46b08', lineHeight: '1.1' }}>
                58.7%
              </div>
              <div style={{ fontSize: 14, color: '#595959', marginTop: '12px', fontWeight: '500' }}>
                Profitable trades
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Performance & Risk Summary */}
      <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
        <Col xs={24} lg={12}>
          <Card title="Performance Summary" size="small">
            <List
              dataSource={[
                { label: 'Total Backtests', value: '47', color: '#096dd9' },
                { label: 'Avg Return', value: '+12.8%', color: '#389e0d' },
                { label: 'Best Strategy', value: 'Moving Average', color: '#d46b08' },
                { label: 'Recent Activity', value: '3 today', color: '#722ed1' },
              ]}
              renderItem={(item) => (
                <List.Item style={{ padding: '12px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <Text style={{ color: '#595959', fontSize: '14px', fontWeight: '500' }}>{item.label}</Text>
                    <Text strong style={{ color: item.color, fontSize: '18px', fontWeight: '700' }}>{item.value}</Text>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Risk Summary" size="small">
            <List
              dataSource={[
                { label: 'Volatility', value: '14.2%', status: 'medium' },
                { label: 'Exposure', value: '82%', status: 'high' },
                { label: 'Profit Factor', value: '1.65', status: 'good' },
                { label: 'Expectancy', value: '$245', status: 'good' },
              ]}
              renderItem={(item) => (
                <List.Item style={{ padding: '12px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <Text style={{ color: '#595959', fontSize: '14px', fontWeight: '500' }}>{item.label}</Text>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Text strong style={{ 
                        color: item.status === 'good' ? '#389e0d' : 
                               item.status === 'medium' ? '#d46b08' : '#cf1322',
                        fontSize: '18px',
                        fontWeight: '700'
                      }}>{item.value}</Text>
                      <Tag color={
                        item.status === 'good' ? 'success' : 
                        item.status === 'medium' ? 'warning' : 'error'
                      } style={{ fontSize: '12px', padding: '2px 8px', margin: 0 }}>
                        {item.status === 'good' ? 'Good' : item.status === 'medium' ? 'Medium' : 'High'}
                      </Tag>
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* Global Equity Curve */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24}>
          <Card title="Portfolio Equity Curve (All Backtests)" size="small">
            <div style={{ padding: '16px', backgroundColor: '#fafafa', borderRadius: '8px', height: '320px' }}>
              {/* Chart container */}
              <div style={{ 
                width: '100%', 
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}>
                {/* Chart area with Y-axis */}
                <div style={{ 
                  flex: 1,
                  display: 'flex'
                }}>
                  {/* Left Y-axis - dynamic range */}
                  <div style={{ 
                    width: '50px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    paddingRight: '8px',
                    fontSize: '11px',
                    color: '#595959',
                    fontWeight: '500'
                  }}>
                    <span>$121k</span>
                    <span>$110k</span>
                    <span>$100k</span>
                    <span>$90k</span>
                    <span>$86k</span>
                  </div>
                  
                  {/* Main chart area */}
                  <div style={{ 
                    flex: 1,
                    position: 'relative',
                    backgroundColor: '#ffffff',
                    border: '1px solid #f0f0f0',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    {/* Grid lines */}
                  <div style={{
                    position: 'absolute',
                    top: '0%',
                    left: '0',
                    width: '100%',
                    height: '1px',
                    backgroundColor: '#f5f5f5'
                  }}></div>
                  <div style={{
                    position: 'absolute',
                    top: '25%',
                    left: '0',
                    width: '100%',
                    height: '1px',
                    backgroundColor: '#f5f5f5'
                  }}></div>
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '0',
                    width: '100%',
                    height: '1px',
                    backgroundColor: '#f0f0f0'
                  }}></div>
                  <div style={{
                    position: 'absolute',
                    top: '75%',
                    left: '0',
                    width: '100%',
                    height: '1px',
                    backgroundColor: '#f5f5f5'
                  }}></div>
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: '0',
                    width: '100%',
                    height: '1px',
                    backgroundColor: '#f5f5f5'
                  }}></div>
                  
                  {/* Vertical grid lines - monthly spacing */}
                  <div style={{
                    position: 'absolute',
                    top: '0',
                    left: '8.33%',
                    width: '1px',
                    height: '100%',
                    backgroundColor: '#f5f5f5'
                  }}></div>
                  <div style={{
                    position: 'absolute',
                    top: '0',
                    left: '16.67%',
                    width: '1px',
                    height: '100%',
                    backgroundColor: '#f5f5f5'
                  }}></div>
                  <div style={{
                    position: 'absolute',
                    top: '0',
                    left: '25%',
                    width: '1px',
                    height: '100%',
                    backgroundColor: '#f5f5f5'
                  }}></div>
                  <div style={{
                    position: 'absolute',
                    top: '0',
                    left: '33.33%',
                    width: '1px',
                    height: '100%',
                    backgroundColor: '#f5f5f5'
                  }}></div>
                  <div style={{
                    position: 'absolute',
                    top: '0',
                    left: '41.67%',
                    width: '1px',
                    height: '100%',
                    backgroundColor: '#f5f5f5'
                  }}></div>
                  <div style={{
                    position: 'absolute',
                    top: '0',
                    left: '50%',
                    width: '1px',
                    height: '100%',
                    backgroundColor: '#f5f5f5'
                  }}></div>
                  <div style={{
                    position: 'absolute',
                    top: '0',
                    left: '58.33%',
                    width: '1px',
                    height: '100%',
                    backgroundColor: '#f5f5f5'
                  }}></div>
                  <div style={{
                    position: 'absolute',
                    top: '0',
                    left: '66.67%',
                    width: '1px',
                    height: '100%',
                    backgroundColor: '#f5f5f5'
                  }}></div>
                  <div style={{
                    position: 'absolute',
                    top: '0',
                    left: '75%',
                    width: '1px',
                    height: '100%',
                    backgroundColor: '#f5f5f5'
                  }}></div>
                  <div style={{
                    position: 'absolute',
                    top: '0',
                    left: '83.33%',
                    width: '1px',
                    height: '100%',
                    backgroundColor: '#f5f5f5'
                  }}></div>
                  <div style={{
                    position: 'absolute',
                    top: '0',
                    left: '91.67%',
                    width: '1px',
                    height: '100%',
                    backgroundColor: '#f5f5f5'
                  }}></div>
                  
                  {/* Equity curve line - true continuous line chart with monthly data */}
                  <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
                    {/* Light blue fill under the line */}
                    <path
                      d="M0,100% L0,60% C1.5%,59% 3%,58% 4.5%,57% C6%,56% 7.5%,55% 9%,54% C10.5%,53% 12%,52% 13.5%,51% C15%,50% 16.5%,49% 18%,48% C19.5%,47% 21%,46% 22.5%,45% C24%,44% 25.5%,43% 27%,42% C28.5%,41% 30%,40% 31.5%,39% C33%,38% 34.5%,37% 36%,36% C37.5%,35% 39%,34% 40.5%,33% C42%,32% 43.5%,31% 45%,30% C46.5%,29% 48%,28% 49.5%,27% C51%,26% 52.5%,25% 54%,24% C55.5%,23% 57%,22% 58.5%,21% C60%,20% 61.5%,19% 63%,18% C64.5%,17% 66%,16% 67.5%,15% C69%,14% 70.5%,13% 72%,12% C73.5%,11% 75%,10% 76.5%,9% C78%,8% 79.5%,7% 81%,6% C82.5%,5% 84%,4% 85.5%,3% C87%,2% 88.5%,1% 90%,0% L100%,0% L100%,100% Z"
                      fill="rgba(22, 119, 255, 0.08)"
                      stroke="none"
                    />
                    
                    {/* Main equity curve line - prominent continuous line (visual focus) */}
                    <path
                      d="M0,60% C1.5%,59% 3%,58% 4.5%,57% C6%,56% 7.5%,55% 9%,54% C10.5%,53% 12%,52% 13.5%,51% C15%,50% 16.5%,49% 18%,48% C19.5%,47% 21%,46% 22.5%,45% C24%,44% 25.5%,43% 27%,42% C28.5%,41% 30%,40% 31.5%,39% C33%,38% 34.5%,37% 36%,36% C37.5%,35% 39%,34% 40.5%,33% C42%,32% 43.5%,31% 45%,30% C46.5%,29% 48%,28% 49.5%,27% C51%,26% 52.5%,25% 54%,24% C55.5%,23% 57%,22% 58.5%,21% C60%,20% 61.5%,19% 63%,18% C64.5%,17% 66%,16% 67.5%,15% C69%,14% 70.5%,13% 72%,12% C73.5%,11% 75%,10% 76.5%,9% C78%,8% 79.5%,7% 81%,6% C82.5%,5% 84%,4% 85.5%,3% C87%,2% 88.5%,1% 90%,0%"
                      fill="none"
                      stroke="#1677ff"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    
                    {/* Very subtle data points (barely visible, line is the focus) */}
                    <circle cx="0%" cy="60%" r="1.5" fill="#1677ff" stroke="none" />
                    <circle cx="25%" cy="48%" r="1" fill="#1677ff" stroke="none" />
                    <circle cx="50%" cy="36%" r="1" fill="#1677ff" stroke="none" />
                    <circle cx="75%" cy="18%" r="1" fill="#1677ff" stroke="none" />
                    <circle cx="100%" cy="0%" r="1.5" fill="#1677ff" stroke="none" />
                  </svg>
                  
                  {/* Initial capital marker */}
                  <div style={{
                    position: 'absolute',
                    top: '60%',
                    left: '0%',
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: '#ffffff',
                    border: '1px solid #1677ff',
                    borderRadius: '3px',
                    padding: '2px 6px',
                    fontSize: '10px',
                    color: '#1677ff',
                    fontWeight: '500',
                    whiteSpace: 'nowrap'
                  }}>
                    $100k
                  </div>
                  
                  {/* Final value marker */}
                  <div style={{
                    position: 'absolute',
                    top: '0%',
                    left: '100%',
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: '#ffffff',
                    border: '1px solid #1677ff',
                    borderRadius: '3px',
                    padding: '2px 6px',
                    fontSize: '10px',
                    color: '#1677ff',
                    fontWeight: '500',
                    whiteSpace: 'nowrap'
                  }}>
                    $115k
                  </div>
                </div>
                </div>
                
                {/* X-axis labels - monthly granularity */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  height: '20px',
                  marginTop: '8px',
                  marginLeft: '50px',
                  fontSize: '10px',
                  color: '#595959',
                  fontWeight: '500'
                }}>
                  <span>Jan</span>
                  <span>Feb</span>
                  <span>Mar</span>
                  <span>Apr</span>
                  <span>May</span>
                  <span>Jun</span>
                  <span>Jul</span>
                  <span>Aug</span>
                  <span>Sep</span>
                  <span>Oct</span>
                  <span>Nov</span>
                  <span>Dec</span>
                </div>
                
                {/* Chart summary */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '12px',
                  paddingTop: '12px',
                  borderTop: '1px solid #f0f0f0',
                  marginLeft: '50px',
                  fontSize: '12px',
                  color: '#595959'
                }}>
                  <div>
                    <span style={{ fontWeight: '500' }}>Initial Capital:</span> $100,000
                  </div>
                  <div>
                    <span style={{ fontWeight: '500' }}>Final Value:</span> $115,000
                  </div>
                  <div style={{ color: '#389e0d', fontWeight: '600' }}>
                    Total Return: +15.0%
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Strategy Analytics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} lg={12}>
          <Card title="Strategy Performance Comparison" size="small">
            <div style={{ padding: '16px', backgroundColor: '#fafafa', borderRadius: '8px', height: '260px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100%',
                color: '#8c8c8c',
                fontSize: '14px'
              }}>
                <div style={{ textAlign: 'center', width: '100%' }}>
                  <div style={{ fontSize: '16px', marginBottom: '8px', color: '#262626', fontWeight: '500' }}>Strategy Performance</div>
                  <div style={{ fontSize: '12px', marginBottom: '20px', color: '#595959' }}>Average return by strategy type</div>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-end',
                    height: '140px',
                    padding: '0 20px'
                  }}>
                    {/* Moving Average bar */}
                    <div style={{ textAlign: 'center', width: '22%' }}>
                      <div style={{ 
                        height: '100px', 
                        backgroundColor: '#389e0d',
                        borderRadius: '4px 4px 0 0'
                      }}></div>
                      <div style={{ fontSize: '12px', marginTop: '8px', color: '#262626', fontWeight: '500' }}>MA</div>
                      <div style={{ fontSize: '11px', color: '#595959' }}>+18.5%</div>
                    </div>
                    {/* RSI bar */}
                    <div style={{ textAlign: 'center', width: '22%' }}>
                      <div style={{ 
                        height: '70px', 
                        backgroundColor: '#096dd9',
                        borderRadius: '4px 4px 0 0'
                      }}></div>
                      <div style={{ fontSize: '12px', marginTop: '8px', color: '#262626', fontWeight: '500' }}>RSI</div>
                      <div style={{ fontSize: '11px', color: '#595959' }}>+12.8%</div>
                    </div>
                    {/* MACD bar */}
                    <div style={{ textAlign: 'center', width: '22%' }}>
                      <div style={{ 
                        height: '60px', 
                        backgroundColor: '#d46b08',
                        borderRadius: '4px 4px 0 0'
                      }}></div>
                      <div style={{ fontSize: '12px', marginTop: '8px', color: '#262626', fontWeight: '500' }}>MACD</div>
                      <div style={{ fontSize: '11px', color: '#595959' }}>+9.7%</div>
                    </div>
                    {/* Bollinger Bands bar */}
                    <div style={{ textAlign: 'center', width: '22%' }}>
                      <div style={{ 
                        height: '40px', 
                        backgroundColor: '#722ed1',
                        borderRadius: '4px 4px 0 0'
                      }}></div>
                      <div style={{ fontSize: '12px', marginTop: '8px', color: '#262626', fontWeight: '500' }}>BB</div>
                      <div style={{ fontSize: '11px', color: '#595959' }}>+6.3%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Return Distribution" size="small">
            <div style={{ padding: '16px', backgroundColor: '#fafafa', borderRadius: '8px', height: '260px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100%',
                color: '#8c8c8c',
                fontSize: '14px'
              }}>
                <div style={{ textAlign: 'center', width: '100%' }}>
                  <div style={{ fontSize: '16px', marginBottom: '8px', color: '#262626', fontWeight: '500' }}>Return Distribution</div>
                  <div style={{ fontSize: '12px', marginBottom: '20px', color: '#595959' }}>Frequency of backtest returns</div>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-end',
                    height: '140px',
                    padding: '0 20px'
                  }}>
                    {/* Histogram bars */}
                    <div style={{ textAlign: 'center', width: '14%' }}>
                      <div style={{ 
                        height: '30px', 
                        backgroundColor: '#cf1322',
                        borderRadius: '4px 4px 0 0'
                      }}></div>
                      <div style={{ fontSize: '10px', marginTop: '6px', color: '#595959' }}>-20%</div>
                    </div>
                    <div style={{ textAlign: 'center', width: '14%' }}>
                      <div style={{ 
                        height: '50px', 
                        backgroundColor: '#d46b08',
                        borderRadius: '4px 4px 0 0'
                      }}></div>
                      <div style={{ fontSize: '10px', marginTop: '6px', color: '#595959' }}>-10%</div>
                    </div>
                    <div style={{ textAlign: 'center', width: '14%' }}>
                      <div style={{ 
                        height: '90px', 
                        backgroundColor: '#faad14',
                        borderRadius: '4px 4px 0 0'
                      }}></div>
                      <div style={{ fontSize: '10px', marginTop: '6px', color: '#595959' }}>0%</div>
                    </div>
                    <div style={{ textAlign: 'center', width: '14%' }}>
                      <div style={{ 
                        height: '120px', 
                        backgroundColor: '#389e0d',
                        borderRadius: '4px 4px 0 0'
                      }}></div>
                      <div style={{ fontSize: '10px', marginTop: '6px', color: '#595959' }}>+10%</div>
                    </div>
                    <div style={{ textAlign: 'center', width: '14%' }}>
                      <div style={{ 
                        height: '80px', 
                        backgroundColor: '#389e0d',
                        borderRadius: '4px 4px 0 0'
                      }}></div>
                      <div style={{ fontSize: '10px', marginTop: '6px', color: '#595959' }}>+20%</div>
                    </div>
                    <div style={{ textAlign: 'center', width: '14%' }}>
                      <div style={{ 
                        height: '40px', 
                        backgroundColor: '#389e0d',
                        borderRadius: '4px 4px 0 0'
                      }}></div>
                      <div style={{ fontSize: '10px', marginTop: '6px', color: '#595959' }}>+30%</div>
                    </div>
                    <div style={{ textAlign: 'center', width: '14%' }}>
                      <div style={{ 
                        height: '20px', 
                        backgroundColor: '#389e0d',
                        borderRadius: '4px 4px 0 0'
                      }}></div>
                      <div style={{ fontSize: '10px', marginTop: '6px', color: '#595959' }}>+40%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Latest Backtest Summary */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24}>
          <Card title="Latest Backtest Summary" size="small">
            <div style={{ padding: '20px', backgroundColor: '#fafafa', borderRadius: '8px' }}>
              {/* 第一层：主要信息 */}
              <Row gutter={[20, 20]}>
                <Col xs={24} md={8}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', color: '#595959', marginBottom: '8px', fontWeight: '500', letterSpacing: '0.5px' }}>STRATEGY</div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#262626', lineHeight: '1.2' }}>Moving Average</div>
                  </div>
                </Col>
                <Col xs={24} md={8}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', color: '#595959', marginBottom: '8px', fontWeight: '500', letterSpacing: '0.5px' }}>SYMBOL</div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#096dd9', lineHeight: '1.2' }}>AAPL</div>
                  </div>
                </Col>
                <Col xs={24} md={8}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', color: '#595959', marginBottom: '8px', fontWeight: '500', letterSpacing: '0.5px' }}>RESULT</div>
                    <div style={{ fontSize: '28px', fontWeight: '800', color: '#389e0d', lineHeight: '1.2' }}>+18.4%</div>
                  </div>
                </Col>
              </Row>
              {/* 分隔线 */}
              <div style={{ margin: '24px 0', borderTop: '1px solid #f0f0f0' }}></div>
              
              {/* 第二层：指标 */}
              <Row gutter={[16, 16]}>
                <Col xs={24} md={6}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', color: '#595959', marginBottom: '8px', fontWeight: '500', letterSpacing: '0.3px' }}>SHARPE</div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#096dd9', lineHeight: '1.2' }}>1.92</div>
                  </div>
                </Col>
                <Col xs={24} md={6}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', color: '#595959', marginBottom: '8px', fontWeight: '500', letterSpacing: '0.3px' }}>MAX DD</div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#cf1322', lineHeight: '1.2' }}>-12.7%</div>
                  </div>
                </Col>
                <Col xs={24} md={6}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', color: '#595959', marginBottom: '8px', fontWeight: '500', letterSpacing: '0.3px' }}>WIN RATE</div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#d46b08', lineHeight: '1.2' }}>61.3%</div>
                  </div>
                </Col>
                <Col xs={24} md={6}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', color: '#595959', marginBottom: '8px', fontWeight: '500', letterSpacing: '0.3px' }}>TRADES</div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#722ed1', lineHeight: '1.2' }}>24</div>
                  </div>
                </Col>
              </Row>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Recent Backtests */}
      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Card title="Recent Backtests" size="small">
            <List
              dataSource={[
                { strategy: 'Moving Average', symbol: 'AAPL', return: '+18.4%', sharpe: 1.92, drawdown: '-12.7%', winRate: '61.3%', trades: 24 },
                { strategy: 'RSI', symbol: 'GOOGL', return: '+12.8%', sharpe: 1.45, drawdown: '-15.2%', winRate: '58.2%', trades: 18 },
                { strategy: 'MACD', symbol: 'MSFT', return: '+9.7%', sharpe: 1.23, drawdown: '-18.4%', winRate: '55.6%', trades: 22 },
                { strategy: 'Moving Average', symbol: 'NVDA', return: '+24.6%', sharpe: 2.15, drawdown: '-14.8%', winRate: '63.8%', trades: 19 },
                { strategy: 'Bollinger Bands', symbol: 'TSLA', return: '+6.3%', sharpe: 0.87, drawdown: '-22.1%', winRate: '52.1%', trades: 21 },
              ]}
              renderItem={(item) => (
                <List.Item 
                  style={{ 
                    padding: '16px 0',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    borderRadius: '4px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f5f5f5';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  title={`Strategy: ${item.strategy}\nSymbol: ${item.symbol}\nTrades: ${item.trades}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div>
                      <Text strong style={{ fontSize: '17px', fontWeight: '600' }}>{item.strategy}</Text>
                      <div style={{ fontSize: '15px', color: '#595959', marginTop: '4px', fontWeight: '500' }}>{item.symbol}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
                      <div style={{ textAlign: 'center', minWidth: '75px' }}>
                        <div style={{ fontSize: '13px', color: '#595959', marginBottom: '6px', fontWeight: '500' }}>Return</div>
                        <Text strong style={{ 
                          color: item.return.startsWith('+') ? '#389e0d' : '#cf1322',
                          fontSize: '16px',
                          fontWeight: '700'
                        }}>
                          {item.return}
                        </Text>
                      </div>
                      <div style={{ textAlign: 'center', minWidth: '75px' }}>
                        <div style={{ fontSize: '13px', color: '#595959', marginBottom: '6px', fontWeight: '500' }}>Sharpe</div>
                        <Text strong style={{ 
                          color: '#096dd9',
                          fontSize: '16px',
                          fontWeight: '700'
                        }}>
                          {item.sharpe.toFixed(2)}
                        </Text>
                      </div>
                      <div style={{ textAlign: 'center', minWidth: '75px' }}>
                        <div style={{ fontSize: '13px', color: '#595959', marginBottom: '6px', fontWeight: '500' }}>Max DD</div>
                        <Text strong style={{ 
                          color: '#cf1322',
                          fontSize: '16px',
                          fontWeight: '700'
                        }}>
                          {item.drawdown}
                        </Text>
                      </div>
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Analytics;