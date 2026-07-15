import React from 'react';
import { Row, Col, Typography, Divider, Tag } from 'antd';
import { TrophyOutlined, ThunderboltOutlined, PercentageOutlined, RiseOutlined, FallOutlined, AimOutlined, BarChartOutlined } from '@ant-design/icons';
import { OptimizationResult } from './OptimizationHeatmap';
import { useLanguage } from '../../contexts/LanguageContext';

const { Text, Title } = Typography;

interface OptimizationSummaryProps {
  results: OptimizationResult[];
  totalCombinations?: number | null;
  validCombinations?: number | null;
  strategy?: string;
}

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const isSuccessfulResult = (result: OptimizationResult): boolean => {
  if (!result || result.error) return false;
  const status = String(result.status || '').toLowerCase();
  return !['failed', 'error', 'invalid'].includes(status);
};

const getFiniteValues = (results: OptimizationResult[], key: keyof OptimizationResult): number[] => (
  results
    .map((result) => toFiniteNumber(result[key]))
    .filter((value): value is number => value !== null)
);

const OptimizationSummary: React.FC<OptimizationSummaryProps> = ({
  results,
  totalCombinations,
  validCombinations,
  strategy = 'moving_average'
}) => {
  const { t } = useLanguage();
  const successfulResults = results.filter(isSuccessfulResult);
  const completeResults = successfulResults.filter((result) => (
    toFiniteNumber(result.totalReturn) !== null
    && toFiniteNumber(result.sharpeRatio) !== null
    && toFiniteNumber(result.maxDrawdown) !== null
  ));
  const returnValues = getFiniteValues(completeResults, 'totalReturn');
  const sharpeValues = getFiniteValues(completeResults, 'sharpeRatio');
  const bestCombinationBySharpe = completeResults
    .reduce<OptimizationResult | null>((best, current) => {
      if (!best) return current;
      return (toFiniteNumber(current.sharpeRatio) as number) > (toFiniteNumber(best.sharpeRatio) as number)
        ? current
        : best;
    }, null);

  const stats = {
    totalCombinations: totalCombinations ?? results.length,
    validCombinations: validCombinations ?? completeResults.length,
    bestReturn: returnValues.length > 0 ? Math.max(...returnValues) : null,
    worstReturn: returnValues.length > 0 ? Math.min(...returnValues) : null,
    avgReturn: returnValues.length > 0
      ? returnValues.reduce((sum, value) => sum + value, 0) / returnValues.length
      : null,
    bestSharpeRatio: sharpeValues.length > 0 ? Math.max(...sharpeValues) : null,
    bestCombinationBySharpe,
  };

  const safeToFixed = (value: unknown, digits: number = 2): string => {
    const numericValue = toFiniteNumber(value);
    return numericValue === null ? 'N/A' : numericValue.toFixed(digits);
  };

  const safePercent = (value: unknown, digits: number = 2): string => {
    const numericValue = toFiniteNumber(value);
    if (numericValue === null) return 'N/A';
    const sign = numericValue > 0 ? '+' : '';
    return `${sign}${numericValue.toFixed(digits)}%`;
  };

  const safeDrawdown = (value: unknown, digits: number = 2): string => {
    const numericValue = toFiniteNumber(value);
    if (numericValue === null) return 'N/A';
    const magnitude = Math.abs(numericValue).toFixed(digits);
    return numericValue === 0 ? `${magnitude}%` : `-${magnitude}%`;
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
      case 'mean_reversion':
        return {
          params: [
            { key: 'lookback', label: t.optimization.lookbackBlock },
            { key: 'entry_z', label: t.optimization.entryZScoreBlock, format: (v: unknown) => safeToFixed(v, 2) },
            { key: 'exit_z', label: t.optimization.exitZScoreBlock, format: (v: unknown) => safeToFixed(v, 2) }
          ],
          isSingleParam: false
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
      background: 'var(--app-card-bg)',
      borderRadius: '16px',
      border: '1px solid var(--app-border-soft)',
      boxShadow: 'var(--app-card-shadow)',
      height: '100%',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    }} className="metric-card-hover">
      <div style={{ color: 'var(--app-text-muted)', fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
        {icon} {title}
      </div>
      <div style={{ fontSize: '26px', fontWeight: 800, color: color || 'var(--app-text-strong)', lineHeight: 1 }}>
        {value}<span style={{ fontSize: '15px', marginLeft: '2px', color: 'var(--app-text-muted)', fontWeight: 600 }}>{suffix}</span>
      </div>
    </div>
  );

  return (
    <div style={{ marginBottom: '24px' }}>
      <style>{`
        .metric-card-hover:hover { transform: translateY(-3px); box-shadow: var(--app-shadow); border-color: color-mix(in srgb, var(--op-blue, var(--app-blue-text)) 28%, transparent); }
        .best-combination-card {
          background: var(--app-card-bg);
          border: 1px solid var(--app-border-soft);
          border-radius: 18px;
          overflow: hidden;
          box-shadow: var(--app-card-shadow);
        }
        .best-combination-header {
          background: linear-gradient(90deg, color-mix(in srgb, var(--op-green, #10b981) 12%, transparent) 0%, transparent 100%);
          padding: 18px 24px;
          border-bottom: 1px solid var(--app-border-soft);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .param-tile {
          background: var(--app-card-bg-soft);
          padding: 14px;
          border-radius: 12px;
          border: 1px solid var(--app-border-soft);
          text-align: center;
          transition: all 0.2s ease;
        }
        .param-tile:hover {
          border-color: color-mix(in srgb, var(--op-blue, var(--app-blue-text)) 28%, transparent);
          background: var(--app-card-bg);
        }
        .metric-tile { text-align: center; padding: 8px; }
        @media (max-width: 991px) {
          .perf-metrics-col { margin-top: 24px; }
        }
        `}</style>

        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BarChartOutlined style={{ fontSize: '20px', color: 'var(--op-blue, var(--app-blue-text))' }} />
          <Title level={4} style={{ margin: 0, fontWeight: 800, color: 'var(--app-text-strong)' }}>{t.optimization.summaryTitle}</Title>
        </div>

        <Row gutter={[20, 20]} style={{ marginBottom: '24px' }}>
          <Col xs={12} sm={8} lg={4}><MetricCard title={t.optimization.combinations} value={stats.totalCombinations} icon={<ThunderboltOutlined />} color="var(--op-blue, var(--app-blue-text))" /></Col>
          <Col xs={12} sm={8} lg={4}><MetricCard title={t.optimization.validResults} value={stats.validCombinations} icon={<AimOutlined />} color="var(--op-green, #10b981)" /></Col>
          <Col xs={12} sm={8} lg={4}><MetricCard title={t.optimization.bestReturnCard} value={safePercent(stats.bestReturn)} icon={<RiseOutlined />} color="var(--op-green, #10b981)" /></Col>
          <Col xs={12} sm={8} lg={4}><MetricCard title={t.optimization.worstReturnCard} value={safePercent(stats.worstReturn)} icon={<FallOutlined />} color="var(--op-red, #ef4444)" /></Col>
          <Col xs={12} sm={8} lg={4}><MetricCard title={t.optimization.avgReturn} value={safePercent(stats.avgReturn)} icon={<PercentageOutlined />} color="var(--op-gold, var(--op-blue, var(--app-blue-text)))" /></Col>
          <Col xs={12} sm={8} lg={4}><MetricCard title={t.optimization.bestSharpeCard} value={safeToFixed(stats.bestSharpeRatio, 2)} icon={<TrophyOutlined />} color="var(--op-blue, var(--app-blue-text))" /></Col>
        </Row>

        {stats.bestCombinationBySharpe && (
        <div className="best-combination-card">
          <div className="best-combination-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--op-green, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--op-surface, #fff)', boxShadow: '0 4px 10px color-mix(in srgb, var(--op-green, #10b981) 24%, transparent)' }}>
                <TrophyOutlined />
              </div>
              <div>
                <Text strong style={{ fontSize: '16px', color: 'var(--op-green, #10b981)' }}>{t.optimization.bestCombinationTitle}</Text>
                <div style={{ fontSize: '12px', color: 'var(--op-green, #10b981)', fontWeight: 700, letterSpacing: '0.4px' }}>{t.optimization.optimizedBySharpe.toUpperCase()}</div>
              </div>
            </div>
            <Tag color="success" style={{ fontWeight: 800, borderRadius: '6px', padding: '2px 12px', border: 'none', background: 'var(--op-green, #10b981)', color: 'var(--op-surface, #fff)' }}>{t.optimization.recommended.toUpperCase()}</Tag>
          </div>
          <div style={{ padding: '28px 32px' }}>
            <Row gutter={48} align="middle">
              <Col xs={24} lg={10}>
                <Text style={{ fontSize: '11px', fontWeight: 800, color: 'var(--app-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '20px' }}>{t.optimization.paramConfiguration}</Text>
                <Row gutter={[12, 12]}>
                  {strategyConfig.params.map((p) => (
                    <Col key={p.key} span={strategyConfig.isSingleParam ? 24 : Math.floor(24 / strategyConfig.params.length)}>
                      <div className="param-tile">
                        <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--app-text-strong)' }}>
                          {p.format ? p.format(stats.bestCombinationBySharpe?.[p.key]) : safeToFixed(stats.bestCombinationBySharpe?.[p.key], 0)}
                        </div>
                        <Text style={{ fontSize: '11px', fontWeight: 700, color: 'var(--app-text-muted)' }}>{p.label}</Text>
                      </div>
                    </Col>
                  ))}
                </Row>
              </Col>

              <Col xs={0} lg={1}>
                <Divider type="vertical" style={{ height: '80px', margin: '0 auto', borderColor: 'var(--app-border-soft)' }} />
              </Col>

              <Col xs={24} lg={13} className="perf-metrics-col">
                <Text style={{ fontSize: '11px', fontWeight: 800, color: 'var(--app-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '20px' }}>{t.optimization.perfMetrics}</Text>
                <Row gutter={16}>
                  <Col span={6}>
                    <div className="metric-tile">
                      <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--op-blue, var(--app-blue-text))' }}>{safeToFixed(stats.bestCombinationBySharpe?.sharpeRatio, 2)}</div>
                      <Text style={{ fontSize: '11px', fontWeight: 700, color: 'var(--app-text-muted)' }}>{t.optimization.labelSharpeRatio}</Text>
                    </div>
                  </Col>
                  <Col span={6}>
                    <div className="metric-tile">
                      <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--op-green, #10b981)' }}>{safePercent(stats.bestCombinationBySharpe?.totalReturn)}</div>
                      <Text style={{ fontSize: '11px', fontWeight: 700, color: 'var(--app-text-muted)' }}>{t.optimization.labelTotalReturn}</Text>
                    </div>
                  </Col>
                  <Col span={6}>
                    <div className="metric-tile">
                      <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--op-red, #ef4444)' }}>
                        {safeDrawdown(stats.bestCombinationBySharpe?.maxDrawdown, 2)}
                      </div>
                      <Text style={{ fontSize: '11px', fontWeight: 700, color: 'var(--app-text-muted)' }}>{t.optimization.labelMaxDrawdown}</Text>
                    </div>
                  </Col>
                  <Col span={6}>
                    <div className="metric-tile">
                      <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--op-gold, var(--op-blue, var(--app-blue-text)))' }}>
                        {toFiniteNumber(stats.bestCombinationBySharpe?.winRate) === null
                          ? 'N/A'
                          : `${safeToFixed(stats.bestCombinationBySharpe?.winRate, 1)}%`}
                      </div>
                      <Text style={{ fontSize: '11px', fontWeight: 700, color: 'var(--app-text-muted)' }}>{t.optimization.labelWinRate}</Text>
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
