import React from 'react';
import { Row, Col, Typography, Badge, Divider } from 'antd';
import { TrophyOutlined, ThunderboltOutlined, PercentageOutlined, RiseOutlined, FallOutlined, AimOutlined, BarChartOutlined } from '@ant-design/icons';
import { OptimizationResult } from './OptimizationHeatmap';
import { useLanguage } from '../../contexts/LanguageContext';

const { Text, Title } = Typography;

interface OptimizationSummaryProps {
  results: OptimizationResult[];
  totalCombinations?: number;
  validCombinations?: number;
  strategy?: string;
}

const OptimizationSummary: React.FC<OptimizationSummaryProps> = ({ 
  results, 
  totalCombinations, 
  validCombinations,
  strategy = 'moving_average'
}) => {
  const { t } = useLanguage();
  // Calculate statistics
  const stats = {
    totalCombinations: totalCombinations || results.length,
    validCombinations: validCombinations || results.length,
    bestReturn: results.length > 0 ? Math.max(...results.map(r => r.totalReturn)) : 0,
    worstReturn: results.length > 0 ? Math.min(...results.map(r => r.totalReturn)) : 0,
    avgReturn: results.length > 0 ? results.reduce((sum, r) => sum + r.totalReturn, 0) / results.length : 0,
    bestSharpeRatio: results.length > 0 ? Math.max(...results.map(r => r.sharpeRatio)) : 0,
    bestMaxDrawdown: results.length > 0 ? Math.min(...results.map(r => r.maxDrawdown)) : 0,
    bestCombinationBySharpe: results.length > 0 ? 
      results.reduce((best, current) => 
        (current.sharpeRatio > best.sharpeRatio) ? current : best
      ) : null,
    bestCombinationByReturn: results.length > 0 ? 
      results.reduce((best, current) => 
        (current.totalReturn > best.totalReturn) ? current : best
      ) : null
  };

  const safeToFixed = (value: any, digits: number = 2): string => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A';
    return Number(value).toFixed(digits);
  };

  const safePercent = (value: any): string => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "N/A";
    if (value === 0) return "0.00%";
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  };

  const getStrategyConfig = () => {
    switch (strategy) {
      case 'rsi':
        return {
          params: [
            { key: 'rsi_period', label: t.optimization.labelRsiPeriod },
            { key: 'oversold', label: t.optimization.labelOversold },
            { key: 'overbought', label: t.optimization.labelOverbought }
          ],
          isSingleParam: false
        };
      case 'macd':
        return {
          params: [
            { key: 'fast', label: t.optimization.labelFastMa },
            { key: 'slow', label: t.optimization.labelSlowMa },
            { key: 'signal', label: t.optimization.labelSignalMa }
          ],
          isSingleParam: false
        };
      case 'bollinger':
        return {
          params: [
            { key: 'period', label: t.optimization.labelPeriod },
            { key: 'std_dev', label: t.optimization.labelStdDev, format: (v: any) => safeToFixed(v, 1) }
          ],
          isSingleParam: false
        };
      case 'momentum':
        return {
          params: [{ key: 'momentum_period', label: t.optimization.labelMomentumPeriod }],
          isSingleParam: true
        };
      default:
        return {
          params: [
            { key: 'short_ma', label: t.optimization.labelShortMa },
            { key: 'long_ma', label: t.optimization.labelLongMa }
          ],
          isSingleParam: false
        };
    }
  };

  const strategyConfig = getStrategyConfig();

  const MetricCard = ({ title, value, color, icon, suffix = "" }: { title: string, value: string | number, color?: string, icon: React.ReactNode, suffix?: string }) => (
    <div style={{ 
      textAlign: 'center', 
      padding: '20px 16px', 
      background: '#fff', 
      borderRadius: '12px', 
      border: '1px solid #f0f0f0',
      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
      height: '100%',
      transition: 'all 0.3s'
    }} className="metric-card-hover">
      <div style={{ color: '#8c8c8c', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
        {icon} {title}
      </div>
      <div style={{ fontSize: '24px', fontWeight: 800, color: color || '#262626', lineHeight: 1 }}>
        {value}<span style={{ fontSize: '14px', marginLeft: '2px' }}>{suffix}</span>
      </div>
    </div>
  );

  return (
    <div style={{ marginBottom: '24px' }}>
      <style>{`
        .metric-card-hover:hover { transform: translateY(-4px); box-shadow: 0 6px 16px rgba(0,0,0,0.06); border-color: #d9d9d9; }
        .best-combination-card { background: #fff; border: 1px solid #b7eb8f; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(82, 196, 26, 0.05); }
        .best-combination-header { background: linear-gradient(90deg, #f6ffed 0%, #e6ffd9 100%); padding: 16px 24px; border-bottom: 1px solid #b7eb8f; display: flex; justify-content: space-between; align-items: center; }
        .param-tile { background: #f8f9fa; padding: 12px; border-radius: 8px; border: 1px solid #eef2f6; text-align: center; }
        .metric-tile { text-align: center; padding: 8px; }
        `}</style>

        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <BarChartOutlined style={{ fontSize: '20px', color: '#722ed1' }} />
        <Title level={4} style={{ margin: 0 }}>{t.optimization.summaryTitle}</Title>
        </div>

        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col span={4}><MetricCard title={t.optimization.combinations} value={stats.totalCombinations} icon={<ThunderboltOutlined />} color="#1890ff" /></Col>
        <Col span={4}><MetricCard title={t.optimization.validResults} value={stats.validCombinations} icon={<AimOutlined />} color="#52c41a" /></Col>
        <Col span={4}><MetricCard title={t.optimization.bestReturnCard} value={safePercent(stats.bestReturn).replace('%', '')} suffix="%" icon={<RiseOutlined />} color="#3f8600" /></Col>
        <Col span={4}><MetricCard title={t.optimization.worstReturnCard} value={safePercent(stats.worstReturn).replace('%', '')} suffix="%" icon={<FallOutlined />} color="#cf1322" /></Col>
        <Col span={4}><MetricCard title={t.optimization.avgReturn} value={safePercent(stats.avgReturn).replace('%', '')} suffix="%" icon={<PercentageOutlined />} color="#fa8c16" /></Col>
        <Col span={4}><MetricCard title={t.optimization.bestSharpeCard} value={safeToFixed(stats.bestSharpeRatio, 2)} icon={<TrophyOutlined />} color="#722ed1" /></Col>
        </Row>

        {stats.bestCombinationBySharpe && (
        <div className="best-combination-card">
          <div className="best-combination-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#52c41a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <TrophyOutlined />
              </div>
              <div>
                <Text strong style={{ fontSize: '16px', color: '#1b4d0e' }}>{t.optimization.bestCombinationTitle}</Text>
                <div style={{ fontSize: '12px', color: '#52c41a', fontWeight: 600 }}>{t.optimization.optimizedBySharpe}</div>
              </div>
            </div>
            <Badge count={t.optimization.recommended} style={{ backgroundColor: '#52c41a', fontWeight: 700, padding: '0 10px', height: '24px', lineHeight: '24px', borderRadius: '6px', marginLeft: '16px' }} />
          </div>          
          <div style={{ padding: '24px' }}>
            <Row gutter={48}>
              <Col span={10}>
                <Text type="secondary" style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '16px' }}>{t.optimization.paramConfiguration}</Text>
                <Row gutter={12}>
                  {strategyConfig.params.map((p, idx) => (
                    <Col key={p.key} span={24 / Math.min(strategyConfig.params.length, 3)}>
                      <div className="param-tile">
                        <div style={{ fontSize: '20px', fontWeight: 800, color: '#1890ff' }}>
                          {p.format ? p.format(stats.bestCombinationBySharpe?.[p.key]) : safeToFixed(stats.bestCombinationBySharpe?.[p.key], 0)}
                        </div>
                        <Text type="secondary" style={{ fontSize: '11px', fontWeight: 600 }}>{p.label}</Text>
                      </div>
                    </Col>
                  ))}
                </Row>
              </Col>
              
              <Col span={1}>
                <Divider type="vertical" style={{ height: '100%', margin: 0 }} />
              </Col>
              
              <Col span={13}>
                <Text type="secondary" style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '16px' }}>{t.optimization.perfMetrics}</Text>
                <Row gutter={16}>
                  <Col span={6}>
                    <div className="metric-tile">
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#722ed1' }}>{safeToFixed(stats.bestCombinationBySharpe?.sharpeRatio, 2)}</div>
                      <Text type="secondary" style={{ fontSize: '11px' }}>{t.optimization.labelSharpeRatio}</Text>
                    </div>
                  </Col>
                  <Col span={6}>
                    <div className="metric-tile">
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#3f8600' }}>{safePercent(stats.bestCombinationBySharpe?.totalReturn)}</div>
                      <Text type="secondary" style={{ fontSize: '11px' }}>{t.optimization.labelTotalReturn}</Text>
                    </div>
                  </Col>
                  <Col span={6}>
                    <div className="metric-tile">
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#cf1322' }}>{safeToFixed(stats.bestCombinationBySharpe?.maxDrawdown, 2)}%</div>
                      <Text type="secondary" style={{ fontSize: '11px' }}>{t.optimization.labelMaxDrawdown}</Text>
                    </div>
                  </Col>
                  <Col span={6}>
                    <div className="metric-tile">
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#fa8c16' }}>{safeToFixed(stats.bestCombinationBySharpe?.winRate, 1)}%</div>
                      <Text type="secondary" style={{ fontSize: '11px' }}>{t.optimization.labelWinRate}</Text>
                    </div>
                  </Col>
                </Row>
              </Col>
            </Row>
          </div>
        </div>
      )}
    </div>
  );
};

export default OptimizationSummary;
