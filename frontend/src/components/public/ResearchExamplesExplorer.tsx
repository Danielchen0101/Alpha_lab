import React, { useMemo, useState } from 'react';
import { MiniSparkline } from './PublicPrimitives';
import { PublicTabList, publicTabIds } from './PublicExperience';
import './ResearchExamplesExplorer.css';

type StrategyId = 'momentum' | 'reversion' | 'quality';
type RangeId = '1Y' | '3Y' | 'MAX';

interface ResearchExamplesExplorerProps {
  locale: string;
  compact?: boolean;
}

const ResearchExamplesExplorer: React.FC<ResearchExamplesExplorerProps> = ({ locale, compact = false }) => {
  const isZh = locale === 'zh-CN';
  const [strategyId, setStrategyId] = useState<StrategyId>('momentum');
  const [range, setRange] = useState<RangeId>('3Y');

  const strategies = useMemo(() => ({
    momentum: {
      name: isZh ? '波动收缩动量' : 'Volatility Contraction Momentum',
      tag: isZh ? '趋势 · 中期' : 'TREND · MEDIUM HORIZON',
      thesis: isZh ? '只在流动性、相对强度和趋势结构共同通过时测试突破延续。' : 'Test breakout persistence only when liquidity, relative strength, and trend structure pass together.',
      benchmark: 'SPY',
      values: {
        '1Y': [24, 28, 31, 29, 38, 42, 47, 44, 53, 59, 63, 70],
        '3Y': [18, 22, 27, 25, 34, 39, 45, 42, 54, 61, 58, 73, 79, 84],
        MAX: [12, 16, 20, 18, 27, 31, 38, 36, 48, 55, 52, 66, 73, 78, 86],
      },
      metrics: {
        '1Y': [[isZh ? '样本外收益' : 'OOS RETURN', '+13.6%'], [isZh ? '夏普比率' : 'SHARPE', '1.92'], [isZh ? '最大回撤' : 'MAX DD', '-3.2%'], [isZh ? '换手率' : 'TURNOVER', '1.6×']],
        '3Y': [[isZh ? '样本外收益' : 'OOS RETURN', '+28.4%'], [isZh ? '夏普比率' : 'SHARPE', '2.45'], [isZh ? '最大回撤' : 'MAX DD', '-4.1%'], [isZh ? '换手率' : 'TURNOVER', '1.8×']],
        MAX: [[isZh ? '样本外收益' : 'OOS RETURN', '+54.7%'], [isZh ? '夏普比率' : 'SHARPE', '2.18'], [isZh ? '最大回撤' : 'MAX DD', '-7.6%'], [isZh ? '换手率' : 'TURNOVER', '1.7×']],
      },
      benchmarkReturns: { '1Y': 12.8, '3Y': 20.4, MAX: 46.1 },
      evidence: [isZh ? '5/5 滚动窗口通过' : '5/5 walk-forward folds passed', isZh ? '成本模型：12 bps' : 'Cost model: 12 bps', isZh ? '参数稳定性：0.82' : 'Parameter stability: 0.82'],
    },
    reversion: {
      name: isZh ? '流动性均值回归' : 'Liquidity Mean Reversion',
      tag: isZh ? '反转 · 短期' : 'REVERSION · SHORT HORIZON',
      thesis: isZh ? '在异常成交量与短期偏离同时出现时，测试回归到流动性中枢的速度。' : 'When abnormal volume and short-term displacement coincide, test the speed of reversion toward the liquidity center.',
      benchmark: 'QQQ',
      values: {
        '1Y': [31, 28, 33, 35, 32, 38, 36, 42, 45, 43, 50, 54],
        '3Y': [21, 25, 23, 30, 28, 35, 33, 41, 39, 48, 45, 54, 58, 61],
        MAX: [16, 20, 18, 25, 23, 31, 29, 38, 36, 45, 43, 51, 56, 59, 64],
      },
      metrics: {
        '1Y': [[isZh ? '样本外收益' : 'OOS RETURN', '+9.4%'], [isZh ? '夏普比率' : 'SHARPE', '1.54'], [isZh ? '最大回撤' : 'MAX DD', '-2.8%'], [isZh ? '换手率' : 'TURNOVER', '4.6×']],
        '3Y': [[isZh ? '样本外收益' : 'OOS RETURN', '+17.2%'], [isZh ? '夏普比率' : 'SHARPE', '1.88'], [isZh ? '最大回撤' : 'MAX DD', '-3.6%'], [isZh ? '换手率' : 'TURNOVER', '4.2×']],
        MAX: [[isZh ? '样本外收益' : 'OOS RETURN', '+28.8%'], [isZh ? '夏普比率' : 'SHARPE', '1.63'], [isZh ? '最大回撤' : 'MAX DD', '-6.9%'], [isZh ? '换手率' : 'TURNOVER', '4.0×']],
      },
      benchmarkReturns: { '1Y': 13.1, '3Y': 31.5, MAX: 59.4 },
      evidence: [isZh ? '4/5 滚动窗口通过' : '4/5 walk-forward folds passed', isZh ? '财报窗口已排除' : 'Earnings windows excluded', isZh ? '滑点敏感度：中等' : 'Slippage sensitivity: medium'],
    },
    quality: {
      name: isZh ? '质量与趋势复合' : 'Quality + Trend Composite',
      tag: isZh ? '多因子 · 长期' : 'MULTI-FACTOR · LONG HORIZON',
      thesis: isZh ? '将盈利质量作为结构门槛，再用长期趋势与风险预算决定持有。' : 'Use earnings quality as a structural gate, then let long-term trend and risk budget govern holding.',
      benchmark: 'SPY',
      values: {
        '1Y': [20, 23, 26, 30, 29, 35, 39, 43, 47, 52, 56, 60],
        '3Y': [14, 19, 23, 27, 31, 36, 40, 45, 50, 54, 60, 65, 70, 76],
        MAX: [10, 14, 18, 23, 27, 32, 37, 43, 48, 54, 59, 65, 71, 78, 84],
      },
      metrics: {
        '1Y': [[isZh ? '样本外收益' : 'OOS RETURN', '+10.8%'], [isZh ? '夏普比率' : 'SHARPE', '1.76'], [isZh ? '最大回撤' : 'MAX DD', '-3.8%'], [isZh ? '换手率' : 'TURNOVER', '0.6×']],
        '3Y': [[isZh ? '样本外收益' : 'OOS RETURN', '+21.7%'], [isZh ? '夏普比率' : 'SHARPE', '2.11'], [isZh ? '最大回撤' : 'MAX DD', '-5.3%'], [isZh ? '换手率' : 'TURNOVER', '0.7×']],
        MAX: [[isZh ? '样本外收益' : 'OOS RETURN', '+48.2%'], [isZh ? '夏普比率' : 'SHARPE', '1.97'], [isZh ? '最大回撤' : 'MAX DD', '-8.1%'], [isZh ? '换手率' : 'TURNOVER', '0.7×']],
      },
      benchmarkReturns: { '1Y': 12.8, '3Y': 20.4, MAX: 46.1 },
      evidence: [isZh ? '5/5 滚动窗口通过' : '5/5 walk-forward folds passed', isZh ? '行业中性约束开启' : 'Sector neutrality enabled', isZh ? '换手率低于 1×' : 'Turnover below 1×'],
    },
  }), [isZh]);
  const strategy = strategies[strategyId];
  const selectedMetrics = strategy.metrics[range];
  const targetReturn = Number(selectedMetrics[0][1].replace(/[+%]/g, ''));
  const rawSeries = strategy.values[range];
  const rawStart = rawSeries[0];
  const rawRange = Math.max(1, rawSeries[rawSeries.length - 1] - rawStart);
  const indexedSeries = rawSeries.map(value => 100 + ((value - rawStart) / rawRange) * targetReturn);
  const benchmarkReturn = strategy.benchmarkReturns[range];
  const benchmarkSeries = rawSeries.map((_, index) => {
    const progress = index / Math.max(1, rawSeries.length - 1);
    const texture = index === 0 || index === rawSeries.length - 1 ? 0 : Math.sin(index * 1.65) * benchmarkReturn * .035;
    return 100 + benchmarkReturn * progress + texture;
  });
  const strategyPanelIds = publicTabIds('example-strategies', strategyId);

  return (
    <div className={`research-explorer ${compact ? 'is-compact' : ''}`}>
      <div className="research-explorer-toolbar">
        <PublicTabList id="example-strategies" items={(Object.keys(strategies) as StrategyId[]).map(id => ({ id, label: strategies[id].name }))} activeId={strategyId} onChange={id => setStrategyId(id as StrategyId)} ariaLabel={isZh ? '研究案例' : 'Research examples'} />
        <div aria-label={isZh ? '时间范围' : 'Time range'}>
          {(['1Y', '3Y', 'MAX'] as RangeId[]).map(id => <button type="button" aria-pressed={range === id} className={range === id ? 'is-active' : ''} key={id} onClick={() => setRange(id)}>{isZh ? ({ '1Y': '1年', '3Y': '3年', MAX: '全部' } as const)[id] : id}</button>)}
        </div>
      </div>
      <div key={strategyId} className="research-explorer-grid public-panel-swap" role="tabpanel" id={strategyPanelIds.panelId} aria-labelledby={strategyPanelIds.tabId}>
        <div className="research-explorer-main">
          <div className="research-explorer-title"><div><span>{strategy.tag}</span><h3>{strategy.name}</h3></div><b>{isZh ? '模拟研究样本' : 'SIMULATED EXAMPLE'}</b></div>
          <p>{strategy.thesis}</p>
          <div className="research-explorer-chart-legend" aria-hidden="true">
            <span><i />{isZh ? '策略' : 'Strategy'}</span>
            <span><i className="is-benchmark" />{strategy.benchmark}</span>
            <b>{isZh ? '指数化表现 · 起点 100' : 'INDEXED PERFORMANCE · START = 100'}</b>
          </div>
          <MiniSparkline
            key={`${strategyId}-${range}`}
            values={indexedSeries}
            secondaryValues={benchmarkSeries}
            secondaryLabel={strategy.benchmark}
            label={`${strategy.name} ${isZh ? ({ '1Y': '1年', '3Y': '3年', MAX: '全部区间' } as const)[range] : range}`}
            size="featured"
            baseline="first"
            bands={range === '3Y' ? 5 : 0}
            startLabel={range === '1Y' ? (isZh ? '12 个月前' : '12M AGO') : range === '3Y' ? (isZh ? '36 个月前' : '36M AGO') : (isZh ? '全部区间' : 'MAX')}
            endLabel={isZh ? '现在' : 'NOW'}
          />
        </div>
        <aside className="research-explorer-metrics">
          <p>{isZh ? '样本外结果' : 'OUT-OF-SAMPLE RESULTS'}</p>
          <dl>{selectedMetrics.map(([label, value], index) => <div key={label}><dt>{label}</dt><dd className={index === 2 ? 'is-risk' : index === 0 ? 'is-primary' : ''}>{value}</dd></div>)}</dl>
        </aside>
      </div>
      <div key={`${strategyId}-evidence`} className="research-explorer-evidence public-panel-swap">
        <span>{isZh ? '证据摘要' : 'EVIDENCE SUMMARY'}</span>
        {strategy.evidence.map((item, index) => <p key={item}><i aria-hidden="true">0{index + 1}</i>{item}</p>)}
        <small>{isZh ? '仅为界面演示，不构成投资建议。' : 'Illustrative interface sample only. Not investment advice.'}</small>
      </div>
    </div>
  );
};

export default ResearchExamplesExplorer;
