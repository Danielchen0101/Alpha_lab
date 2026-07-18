import React, { useMemo } from 'react';
import { Button, Empty, Progress, Space, Tooltip } from 'antd';
import {
  DownloadOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import type { TradingAccountResponse, TradingPosition } from '../services/api';
import { exportJsonReport, exportRowsAsCsv, timestampedFilename } from '../utils/exportReport';
import { formatNumericValue, resolveDataFreshness } from '../utils/dataPresentation';
import './PortfolioInsights.css';

type HistoryPoint = {
  timestamp: number;
  equity: number;
  profitLoss: number;
  profitLossPct: number;
};

type Props = {
  account: TradingAccountResponse | null;
  positions: TradingPosition[];
  history: HistoryPoint[];
  mode: 'paper' | 'real';
  source?: string;
  updatedAt?: string;
  language: string;
  stale?: boolean;
};

const number = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const money = (value: unknown, locale = 'en-US') => {
  const parsed = number(value);
  if (parsed === null) return '—';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(parsed);
};

const percent = (value: unknown, locale: 'en-US' | 'zh-CN' = 'en-US') => {
  const parsed = number(value);
  if (parsed === null) return '—';
  return `${formatNumericValue(parsed, {
    locale,
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
};

const PortfolioInsights: React.FC<Props> = ({
  account,
  positions,
  history,
  mode,
  source,
  updatedAt,
  language,
  stale = false,
}) => {
  const zh = language === 'zh-CN';
  const copy = zh ? {
    kicker: '05 / 组合诊断',
    title: '敞口与归因',
    subtitle: '把持仓集中度、资金使用与历史回撤放在同一个风险视图中。',
    concentration: '最大持仓占比',
    cashWeight: '现金占比',
    drawdown: '区间最大回撤',
    unrealized: '未实现盈亏',
    winners: '盈利持仓',
    losers: '亏损持仓',
    grossExposure: '总敞口',
    source: '证据来源',
    sourceHint: '组合诊断仅使用当前账户快照和已验证的 Alpaca 历史净值。',
    empty: '当前没有可分析的持仓。',
    exportCsv: '导出持仓 CSV',
    exportJson: '导出审计 JSON',
    largest: '最大持仓',
    diversification: '持仓分布',
    noTimestamp: '未提供更新时间',
    freshness: { fresh: '实时', delayed: '稍有延迟', stale: '数据已过期', unavailable: '时间未知' },
  } : {
    kicker: '05 / PORTFOLIO DIAGNOSTICS',
    title: 'Exposure & attribution',
    subtitle: 'Concentration, capital usage, and historical drawdown in one risk view.',
    concentration: 'Largest position weight',
    cashWeight: 'Cash weight',
    drawdown: 'Period max drawdown',
    unrealized: 'Unrealized P/L',
    winners: 'Winning positions',
    losers: 'Losing positions',
    grossExposure: 'Gross exposure',
    source: 'Evidence source',
    sourceHint: 'Diagnostics use only the current account snapshot and verified Alpaca equity history.',
    empty: 'There are no positions to analyze.',
    exportCsv: 'Export holdings CSV',
    exportJson: 'Export audit JSON',
    largest: 'Largest holding',
    diversification: 'Position distribution',
    noTimestamp: 'Update timestamp unavailable',
    freshness: { fresh: 'Live', delayed: 'Delayed', stale: 'Stale', unavailable: 'Time unknown' },
  };
  const locale: 'zh-CN' | 'en-US' = zh ? 'zh-CN' : 'en-US';
  const freshness = stale
    ? { status: 'stale' as const }
    : resolveDataFreshness(updatedAt, Date.now(), 90, 300);

  const metrics = useMemo(() => {
    const equity = number(account?.equity ?? account?.portfolioValue);
    const cash = number(account?.cash);
    const absoluteMarketValue = positions.reduce((sum, position) => sum + Math.abs(number(position.marketValue) ?? 0), 0);
    const ranked = [...positions].sort((left, right) => Math.abs(number(right.marketValue) ?? 0) - Math.abs(number(left.marketValue) ?? 0));
    const largest = ranked[0];
    const largestWeight = equity !== null && equity > 0 ? (Math.abs(number(largest?.marketValue) ?? 0) / equity) * 100 : null;
    const grossExposure = equity !== null && equity > 0 ? (absoluteMarketValue / equity) * 100 : null;
    const cashWeight = equity !== null && equity > 0 && cash !== null ? (cash / equity) * 100 : null;
    const unrealized = positions.reduce((sum, position) => sum + (number(position.unrealizedPL) ?? 0), 0);
    const winners = positions.filter((position) => (number(position.unrealizedPL) ?? 0) > 0).length;
    const losers = positions.filter((position) => (number(position.unrealizedPL) ?? 0) < 0).length;

    let maxDrawdown: number | null = null;
    if (history.length >= 2) {
      let highWater = 0;
      maxDrawdown = 0;
      history.forEach((point) => {
        const pointEquity = number(point.equity) ?? 0;
        highWater = Math.max(highWater, pointEquity);
        if (highWater > 0) maxDrawdown = Math.min(maxDrawdown ?? 0, ((pointEquity - highWater) / highWater) * 100);
      });
    }

    return {
      equity,
      cash,
      largest,
      largestWeight,
      grossExposure,
      cashWeight,
      unrealized,
      winners,
      losers,
      maxDrawdown,
      ranked,
    };
  }, [account, history, positions]);

  const exportCsv = () => exportRowsAsCsv(
    timestampedFilename(`alphalab-${mode}-holdings`, 'csv'),
    positions as Array<TradingPosition & Record<string, any>>,
    [
      { key: 'symbol', label: 'Symbol' },
      { key: 'qty', label: 'Quantity' },
      { key: 'side', label: 'Side' },
      { key: 'avgEntryPrice', label: 'Average entry' },
      { key: 'currentPrice', label: 'Current price' },
      { key: 'marketValue', label: 'Market value' },
      { key: 'costBasis', label: 'Cost basis' },
      { key: 'unrealizedPL', label: 'Unrealized P/L' },
      { key: 'unrealizedPLPercent', label: 'Unrealized P/L %' },
      { key: 'changeToday', label: 'Today change' },
      { key: 'assetClass', label: 'Asset class' },
      { key: 'exchange', label: 'Exchange' },
      { key: 'lastUpdated', label: 'Last updated' },
    ],
  );

  const exportAudit = () => exportJsonReport(
    timestampedFilename(`alphalab-${mode}-portfolio-audit`, 'json'),
    {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      mode,
      source: source || null,
      sourceUpdatedAt: updatedAt || null,
      account,
      diagnostics: metrics,
      positions,
      equityHistory: history,
    },
  );

  return (
    <section className="portfolio-insights" aria-labelledby="portfolio-insights-title">
      <header className="portfolio-insights__header">
        <div>
          <span>{copy.kicker}</span>
          <h2 id="portfolio-insights-title">{copy.title}</h2>
          <p>{copy.subtitle}</p>
        </div>
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={exportCsv} disabled={!positions.length}>{copy.exportCsv}</Button>
          <Button icon={<FileTextOutlined />} onClick={exportAudit} disabled={!account}>{copy.exportJson}</Button>
        </Space>
      </header>

      {!positions.length ? (
        <Empty description={copy.empty} />
      ) : (
        <>
          <div className="portfolio-insights__metrics">
            <article><span>{copy.concentration}</span><strong>{percent(metrics.largestWeight, locale)}</strong><small>{metrics.largest?.symbol || '-'}</small></article>
            <article><span>{copy.grossExposure}</span><strong>{percent(metrics.grossExposure, locale)}</strong><small>{money(positions.reduce((sum, item) => sum + Math.abs(number(item.marketValue) ?? 0), 0), locale)}</small></article>
            <article><span>{copy.cashWeight}</span><strong>{percent(metrics.cashWeight, locale)}</strong><small>{money(metrics.cash, locale)}</small></article>
            <article><span>{copy.drawdown}</span><strong className={metrics.maxDrawdown !== null && metrics.maxDrawdown < 0 ? 'is-negative' : ''}>{percent(metrics.maxDrawdown, locale)}</strong><small>{history.length} points</small></article>
            <article><span>{copy.unrealized}</span><strong className={metrics.unrealized < 0 ? 'is-negative' : metrics.unrealized > 0 ? 'is-positive' : ''}>{money(metrics.unrealized, locale)}</strong><small>{copy.winners} {metrics.winners} · {copy.losers} {metrics.losers}</small></article>
          </div>

          <div className="portfolio-insights__distribution">
            <div className="portfolio-insights__distribution-title">
              <strong>{copy.diversification}</strong>
              <span>{copy.largest}: {metrics.largest?.symbol} · {percent(metrics.largestWeight, locale)}</span>
            </div>
            {metrics.ranked.slice(0, 8).map((position) => {
              const weight = metrics.equity !== null && metrics.equity > 0 ? (Math.abs(number(position.marketValue) ?? 0) / metrics.equity) * 100 : null;
              return (
                <div className="portfolio-insights__holding" key={position.symbol}>
                  <span>{position.symbol}</span>
                  <Progress percent={Math.min(weight ?? 0, 100)} showInfo={false} strokeColor="#2d64a9" trailColor="var(--app-border-soft)" />
                  <strong>{percent(weight, locale)}</strong>
                </div>
              );
            })}
          </div>
        </>
      )}

      <footer>
        <SafetyCertificateOutlined />
        <span>{copy.source}: {source || '-'} · <b className={`is-${freshness.status}`}>{copy.freshness[freshness.status]}</b> · {updatedAt ? new Date(updatedAt).toLocaleString(locale) : copy.noTimestamp}</span>
        <Tooltip title={copy.sourceHint}><InfoCircleOutlined aria-label={copy.sourceHint} /></Tooltip>
      </footer>
    </section>
  );
};

export default PortfolioInsights;
