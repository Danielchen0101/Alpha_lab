import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Empty, Skeleton, Tag } from 'antd';
import {
  CalendarOutlined,
  BulbOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  GlobalOutlined,
  ReloadOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { getMarketRiskSnapshot, type MarketRiskConstituent, type MarketRiskSnapshotResponse } from '../services/marketDataService';
import {
  getMarketIntelligenceCalendar,
  getMarketIntelligenceNews,
  normalizeEconomicEvents,
  type MarketCalendarResponse,
  type MarketNewsArticle,
  type MarketNewsResponse,
} from '../services/marketIntelligenceService';
import { marketSymbolPath, rememberMarketSymbol } from '../routes/marketRoutes';
import './MarketIntelligence.css';

type IntelligenceView = 'pulse' | 'themes' | 'news' | 'calendar';

const viewFromPath = (pathname: string): IntelligenceView => {
  if (pathname.endsWith('/themes')) return 'themes';
  if (pathname.endsWith('/news')) return 'news';
  if (pathname.endsWith('/calendar')) return 'calendar';
  return 'pulse';
};

const signedPercent = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${value >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`;
};

const compactNumber = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value));
};

export const marketIntelligenceRefreshTimestamp = (
  view: IntelligenceView,
  pulse: MarketRiskSnapshotResponse | null,
  news: MarketNewsResponse | null,
  calendar: MarketCalendarResponse | null,
) => {
  if (view === 'pulse' || view === 'themes') return pulse?.generatedAt;
  if (view === 'news') return news?.generatedAt;
  return calendar?.generatedAt;
};

const formatTimestamp = (value: string | undefined, locale: string, dateOnly = false) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return dateOnly
    ? parsed.toLocaleString(locale)
    : parsed.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
};

const MarketIntelligence: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isZh = language === 'zh-CN';
  const view = viewFromPath(location.pathname);
  const [pulse, setPulse] = useState<MarketRiskSnapshotResponse | null>(null);
  const [news, setNews] = useState<MarketNewsResponse | null>(null);
  const [calendar, setCalendar] = useState<MarketCalendarResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);

  const copy = isZh ? {
    eyebrow: '股票交易 · 基本面情报', title: '市场分析', subtitle: '把大盘广度、主题轮动、新闻冲击与关键事件放在同一条决策链上。',
    pulse: '宏观脉搏', themes: '主题涨跌', news: '新闻影响', calendar: '事件日历', refresh: '刷新', refreshing: '正在刷新', lastUpdated: '上次更新',
    risk: '市场风险', regime: '市场状态', breadth: '上涨 / 下跌', median: '中位涨跌', coverage: '有效覆盖',
    benchmarks: '主要指数', sectors: '行业 ETF', gainers: '涨幅领先', losers: '跌幅领先',
    themeBreadth: '主题广度', themeHelp: '按当日涨跌计算，每个主题显示上涨、下跌和平均涨跌幅。',
    up: '上涨', down: '下跌', flat: '持平', leaders: '领先标的',
    newsTitle: '今日重要新闻', newsHelp: '影响分数综合宏观关键词、事件类型和关联股票数量；这是研究排序，不是交易建议。',
    affected: '可能受影响', marketImpact: '市场影响', noNews: '今天暂时没有可显示的市场新闻。', openSource: '查看原文',
    affectedFallback: '大盘 / 相关板块', inferred: '按主题推断', showAll: '显示全部', collapse: '收起',
    calendarTitle: '未来 30 天事件日历', earningsTitle: 'Watchlist 财报', earnings: '财报', economic: '公共宏观事件', before: '盘前', after: '盘后', unknown: '时间待定',
    estimate: '预期 EPS', revenue: '预期营收', calendarPending: '官方宏观日历暂时不可用，系统会使用缓存并自动重试。', macroPartial: '部分官方来源暂时不可用，当前事件来自其余可用来源；系统会自动重试。',
    macroEvents: '项宏观事件', actual: '实际值', forecast: '预期值', previous: '前值', importance: '影响', high: '高', medium: '中', low: '低',
    watchlistSummary: '只显示 Watchlist 中股票的财报', watchlistStocks: '只股票', manageWatchlist: '管理 Watchlist', emptyWatchlist: 'Watchlist 还是空的，请先添加股票。',
    unavailable: '数据暂不可用', retry: '重新加载', source: '数据源', asOf: '截至', noEarnings: 'Watchlist 中的股票未来 30 天暂无已知财报。',
    aiBrief: 'AI 市场简报', aiDrivers: '主要驱动', aiWatch: '重点观察', aiPending: 'AI 正在后台生成简报，完成后会自动进入缓存。', aiNotConfigured: '配置 AI 后可生成双语市场简报。', aiConfidence: 'AI 置信度',
    moverScope: '仅限 SPY 与 QQQ 成分股', autoRefresh: '新闻每 5 分钟自动刷新', aiAnalysis: 'AI 双语分析', impactType: '影响类型', horizon: '影响周期', nextCatalyst: '下一个高影响事件',
    aiWorking: 'AI 正在逐条分析这条新闻，完成后页面会自动更新。', aiFailed: '本轮 AI 分析失败，系统会自动重试。', aiReady: 'AI 分析已完成',
    allEvents: '按日期排列的全部事件', scheduled: '数据源日程', actualPending: '待公布', noConsensus: '暂无共识', noPrevious: '暂无数据',
    earningsCoverage: '财报覆盖', noDateInWindow: '其余股票在当前窗口内暂无数据源日程', valuesPlanRequired: '当前 Finnhub 套餐不包含宏观一致预期；日期仍以官方机构日程为准。',
  } : {
    eyebrow: 'Stock trading · Fundamental intelligence', title: 'Market intelligence', subtitle: 'Connect market breadth, theme rotation, news impact, and key events in one decision surface.',
    pulse: 'Macro pulse', themes: 'Theme breadth', news: 'News impact', calendar: 'Event calendar', refresh: 'Refresh', refreshing: 'Refreshing', lastUpdated: 'Last updated',
    risk: 'Market risk', regime: 'Regime', breadth: 'Advancing / declining', median: 'Median move', coverage: 'Valid coverage',
    benchmarks: 'Major indices', sectors: 'Sector ETFs', gainers: 'Top gainers', losers: 'Top losers',
    themeBreadth: 'Theme breadth', themeHelp: 'Daily breadth showing advancing, declining, and average return for each theme.',
    up: 'Up', down: 'Down', flat: 'Flat', leaders: 'Leaders',
    newsTitle: 'Important news today', newsHelp: 'Impact ranking combines macro terms, event type, and affected ticker count. It is research context, not trading advice.',
    affected: 'Potentially affected', marketImpact: 'Market impact', noNews: 'No market news is available for this window.', openSource: 'Open source',
    affectedFallback: 'Broad market / sector peers', inferred: 'topic inference', showAll: 'Show all', collapse: 'Collapse',
    calendarTitle: 'Next 30 days · Event calendar', earningsTitle: 'Watchlist earnings', earnings: 'Earnings', economic: 'Public macro events', before: 'Before open', after: 'After close', unknown: 'Time TBD',
    estimate: 'EPS est.', revenue: 'Revenue est.', calendarPending: 'Official macro calendars are temporarily unavailable. Cached data will be used and sources will retry automatically.', macroPartial: 'Some official sources are temporarily unavailable. Current events come from the remaining sources and retries are automatic.',
    macroEvents: 'macro events', actual: 'Actual', forecast: 'Forecast', previous: 'Previous', importance: 'Impact', high: 'High', medium: 'Medium', low: 'Low',
    watchlistSummary: 'Only earnings for Watchlist symbols', watchlistStocks: 'stocks', manageWatchlist: 'Manage Watchlist', emptyWatchlist: 'Your Watchlist is empty. Add stocks to see their earnings dates.',
    unavailable: 'Data unavailable', retry: 'Retry', source: 'Sources', asOf: 'As of', noEarnings: 'No known earnings are scheduled for your Watchlist in the next 30 days.',
    aiBrief: 'AI market brief', aiDrivers: 'Primary drivers', aiWatch: 'Watchpoints', aiPending: 'The AI brief is being generated in the background and will be cached.', aiNotConfigured: 'Configure an AI provider to generate the bilingual market brief.', aiConfidence: 'AI confidence',
    moverScope: 'SPY & QQQ constituents only', autoRefresh: 'News refreshes every 5 minutes', aiAnalysis: 'Bilingual AI analysis', impactType: 'Impact type', horizon: 'Horizon', nextCatalyst: 'Next high-impact event',
    aiWorking: 'AI is analyzing this article individually. The page will update automatically.', aiFailed: 'This AI attempt failed and will retry automatically.', aiReady: 'AI analysis ready',
    allEvents: 'All events grouped by date', scheduled: 'Provider schedule', actualPending: 'Pending', noConsensus: 'No consensus', noPrevious: 'Unavailable',
    earningsCoverage: 'Earnings coverage', noDateInWindow: 'Other stocks have no provider-scheduled event in this window', valuesPlanRequired: 'Your Finnhub plan does not include macro consensus values; official agency calendars remain authoritative for dates.',
  };

  const load = useCallback(async (force = false) => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError('');
    try {
      let result: MarketRiskSnapshotResponse | MarketNewsResponse | MarketCalendarResponse;
      if (view === 'pulse' || view === 'themes') {
        result = await getMarketRiskSnapshot(force);
      } else if (view === 'news') {
        result = await getMarketIntelligenceNews(1, force);
      } else {
        result = await getMarketIntelligenceCalendar(30, force);
      }
      if (requestId !== requestSequence.current) return;
      if (view === 'pulse' || view === 'themes') setPulse(result as MarketRiskSnapshotResponse);
      else if (view === 'news') setNews(result as MarketNewsResponse);
      else setCalendar(result as MarketCalendarResponse);
    } catch (requestError: any) {
      if (requestId !== requestSequence.current) return;
      setError(requestError?.response?.data?.error || requestError?.message || copy.unavailable);
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [copy.unavailable, view]);

  useEffect(() => { void load(false); }, [load]);

  useEffect(() => {
    if (view !== 'news') return undefined;
    const timer = window.setInterval(() => { void load(false); }, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [load, view]);

  useEffect(() => {
    if (view !== 'news' || !news?.ai?.pendingCount) return undefined;
    const timer = window.setTimeout(
      () => { void load(false); },
      Math.max(4, Number(news.ai.pollAfterSeconds || 6)) * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [load, news?.ai?.pendingCount, news?.ai?.pollAfterSeconds, view]);

  const openSymbol = (symbol: string) => {
    rememberMarketSymbol(symbol);
    navigate(marketSymbolPath(symbol));
  };

  const tabs = [
    { key: 'pulse', label: copy.pulse, path: '/market/intelligence', icon: <GlobalOutlined /> },
    { key: 'themes', label: copy.themes, path: '/market/intelligence/themes', icon: <RiseOutlined /> },
    { key: 'news', label: copy.news, path: '/market/intelligence/news', icon: <FileTextOutlined /> },
    { key: 'calendar', label: copy.calendar, path: '/market/intelligence/calendar', icon: <CalendarOutlined /> },
  ];

  const refreshedAt = marketIntelligenceRefreshTimestamp(view, pulse, news, calendar);
  const activeData = view === 'pulse' || view === 'themes' ? pulse : view === 'news' ? news : calendar;
  const dataAsOf = view === 'pulse' || view === 'themes' ? pulse?.asOf : refreshedAt;
  const activeSources = view === 'news'
    ? (news?.sources || [])
    : view === 'calendar'
      ? (calendar?.sources || [])
      : [pulse?.snapshot.source].filter(Boolean) as string[];

  return (
    <main className="market-intelligence-page">
      <header className="mi-header">
        <div>
          <p>{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <span>{copy.subtitle}</span>
        </div>
        <div className="mi-refresh-control">
          <small>{copy.lastUpdated}<b>{formatTimestamp(refreshedAt, isZh ? 'zh-CN' : 'en-US')}</b></small>
          <Button className="mi-refresh-button" icon={<ReloadOutlined />} loading={loading} disabled={loading} onClick={() => void load(true)}>{loading ? copy.refreshing : copy.refresh}</Button>
        </div>
      </header>

      <nav className="mi-tabs" aria-label={copy.title}>
        {tabs.map(tab => (
          <Link key={tab.key} to={tab.path} className={view === tab.key ? 'is-active' : ''}>
            {tab.icon}<span>{tab.label}</span>
          </Link>
        ))}
      </nav>

      {error && <Alert type="warning" showIcon message={copy.unavailable} description={error} action={<Button onClick={() => void load(true)}>{copy.retry}</Button>} />}
      {loading && !activeData ? <Skeleton active paragraph={{ rows: 10 }} /> : null}

      {view === 'pulse' && pulse && <PulseView data={pulse} copy={copy} onSymbol={openSymbol} />}
      {view === 'themes' && pulse && <ThemesView data={pulse} copy={copy} onSymbol={openSymbol} />}
      {view === 'news' && news && <NewsView data={news} copy={copy} isZh={isZh} />}
      {view === 'calendar' && calendar && <CalendarView data={calendar} copy={copy} isZh={isZh} onSymbol={openSymbol} />}

      {dataAsOf && <footer className="mi-source-line">{copy.asOf} {formatTimestamp(dataAsOf, isZh ? 'zh-CN' : 'en-US', true)} · {copy.source}: {activeSources.join(' · ')}</footer>}
    </main>
  );
};

const Movers: React.FC<{ title: string; rows: MarketRiskConstituent[]; onSymbol: (symbol: string) => void }> = ({ title, rows, onSymbol }) => (
  <section className="mi-panel mi-movers">
    <h2>{title}</h2>
    <div>
      {rows.slice(0, 8).map(row => (
        <button key={row.symbol} onClick={() => onSymbol(row.symbol)}>
          <span><b>{row.symbol}</b><small>{row.name}</small></span>
          <strong className={row.changePct >= 0 ? 'is-up' : 'is-down'}>{signedPercent(row.changePct)}</strong>
        </button>
      ))}
    </div>
  </section>
);

const PulseView: React.FC<{ data: MarketRiskSnapshotResponse; copy: any; onSymbol: (symbol: string) => void }> = ({ data, copy, onSymbol }) => {
  const snapshot = data.snapshot;
  const brief = data.aiBrief;
  return <div className="mi-view">
    <section className="mi-ledger">
      <article><span>{copy.risk}</span><strong>{snapshot.riskScore.toFixed(0)}<i>/100</i></strong><small>{snapshot.riskLevel}</small></article>
      <article><span>{copy.regime}</span><strong className={snapshot.regime.includes('risk_off') ? 'is-down' : 'is-up'}>{snapshot.regime.replace(/_/g, ' ')}</strong><small>{snapshot.method}</small></article>
      <article><span>{copy.breadth}</span><strong><b className="is-up">{snapshot.advancing}</b> / <b className="is-down">{snapshot.declining}</b></strong><small>{snapshot.advanceDeclineRatio.toFixed(2)} A/D</small></article>
      <article><span>{copy.median}</span><strong className={snapshot.medianChangePct >= 0 ? 'is-up' : 'is-down'}>{signedPercent(snapshot.medianChangePct)}</strong><small>{signedPercent(snapshot.equalWeightChangePct)} equal weight</small></article>
      <article><span>{copy.coverage}</span><strong>{snapshot.validCount.toLocaleString()}</strong><small>{snapshot.coveragePct.toFixed(1)}% / {snapshot.universeCount.toLocaleString()}</small></article>
    </section>
    <section className="mi-ai-brief">
      <header>
        <span><BulbOutlined /> {copy.aiBrief}</span>
        {brief?.status === 'ready' && <Tag color="geekblue">{copy.aiConfidence} {brief.confidence ?? '—'}%</Tag>}
      </header>
      {brief?.status === 'ready' ? <div className="mi-ai-brief-grid">
        <div className="mi-ai-summary"><strong>{copy.regime}</strong><h2>{copy.aiBrief === 'AI 市场简报' ? brief.regimeZh : brief.regimeEn}</h2><p>{copy.aiBrief === 'AI 市场简报' ? brief.summaryZh : brief.summaryEn}</p><small>{brief.provider} · {brief.model}</small></div>
        <div><strong>{copy.aiDrivers}</strong><ul>{((copy.aiBrief === 'AI 市场简报' ? brief.driversZh : brief.driversEn) || []).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div>
        <div><strong>{copy.aiWatch}</strong><ul>{((copy.aiBrief === 'AI 市场简报' ? brief.watchpointsZh : brief.watchpointsEn) || []).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div>
      </div> : <p className="mi-ai-empty">{brief?.status === 'not_configured' ? copy.aiNotConfigured : copy.aiPending}</p>}
    </section>
    <div className="mi-two-column">
      <MoverStrip title={copy.benchmarks} rows={data.benchmarks} onSymbol={onSymbol} />
      <MoverStrip title={copy.sectors} rows={data.sectorEtfs} onSymbol={onSymbol} />
    </div>
    <div className="mi-two-column">
      <Movers title={`${copy.gainers} · ${copy.moverScope}`} rows={data.gainers || [...data.movers].sort((a, b) => b.changePct - a.changePct)} onSymbol={onSymbol} />
      <Movers title={`${copy.losers} · ${copy.moverScope}`} rows={data.losers || [...data.movers].sort((a, b) => a.changePct - b.changePct)} onSymbol={onSymbol} />
    </div>
  </div>;
};

const MoverStrip: React.FC<{ title: string; rows: MarketRiskConstituent[]; onSymbol: (symbol: string) => void }> = ({ title, rows, onSymbol }) => (
  <section className="mi-panel">
    <h2>{title}</h2>
    <div className="mi-strip">
      {rows.map(row => <button key={row.symbol} onClick={() => onSymbol(row.symbol)}><b>{row.symbol}</b><strong className={row.changePct >= 0 ? 'is-up' : 'is-down'}>{signedPercent(row.changePct)}</strong></button>)}
    </div>
  </section>
);

const ThemesView: React.FC<{ data: MarketRiskSnapshotResponse; copy: any; onSymbol: (symbol: string) => void }> = ({ data, copy, onSymbol }) => (
  <div className="mi-view">
    <div className="mi-section-heading"><div><h2>{copy.themeBreadth}</h2><p>{copy.themeHelp}</p></div></div>
    <section className="mi-theme-grid">
      {(data.themeBreadth || []).map(theme => {
        const upPct = theme.total ? theme.advancing / theme.total * 100 : 0;
        const downPct = theme.total ? theme.declining / theme.total * 100 : 0;
        const flatPct = Math.max(0, 100 - upPct - downPct);
        return <article key={theme.key} className="mi-theme-card">
          <header><div><h3>{localizedTheme(theme.key, theme.label, copy.up === '上涨')}</h3><span>{theme.total} {copy.up === '上涨' ? '只股票' : 'stocks'}</span></div><strong className={theme.averageChangePct >= 0 ? 'is-up' : 'is-down'}>{signedPercent(theme.averageChangePct)}</strong></header>
          <div className="mi-breadth-bar" role="img" aria-label={`${copy.up} ${theme.advancing}, ${copy.down} ${theme.declining}, ${copy.flat} ${theme.unchanged}`}>
            <i style={{ width: `${upPct}%` }} />
            <b style={{ width: `${downPct}%` }} />
            <em style={{ width: `${flatPct}%` }} />
          </div>
          <div className="mi-theme-counts"><span className="is-up">{copy.up} {theme.advancing}</span><span className="is-down">{copy.down} {theme.declining}</span><span>{copy.flat} {theme.unchanged}</span></div>
          <div className="mi-leaders"><small>{copy.leaders}</small>{theme.leaders.map(row => <button key={row.symbol} onClick={() => onSymbol(row.symbol)}>{row.symbol} <b className={row.changePct >= 0 ? 'is-up' : 'is-down'}>{signedPercent(row.changePct)}</b></button>)}</div>
        </article>;
      })}
    </section>
  </div>
);

const localizedTheme = (key: string, fallback: string, isZh: boolean) => {
  if (!isZh) return fallback;
  const labels: Record<string, string> = {
    storage_memory: '存储与内存', space: '太空经济', technology: '科技股', ai_semiconductors: 'AI 与半导体',
    cloud_software: '云计算与软件', cybersecurity: '网络安全', fintech: '金融科技', clean_energy: '清洁能源', biotech: '生物科技',
  };
  return labels[key] || fallback;
};

const localizedTopic = (topic: string, isZh: boolean) => {
  if (!isZh) return topic;
  const labels: Record<string, string> = {
    'Monetary policy': '货币政策', 'Economy & labor': '经济与就业', 'Geopolitics & trade': '地缘政治与贸易',
    'Earnings & guidance': '财报与指引', 'M&A': '并购', 'Regulation & legal': '监管与法律', Technology: '科技',
    'Energy & commodities': '能源与大宗商品', 'Analyst action': '分析师评级', 'Company & market': '公司与市场',
  };
  return labels[topic] || topic;
};

const localizedMarketImpact = (article: MarketNewsArticle, isZh: boolean) => {
  if (!isZh) return article.marketImpact;
  if (['Monetary policy', 'Economy & labor', 'Geopolitics & trade'].includes(article.topic)) {
    return '可能影响主要指数、利率与市场波动率，需观察跨资产反应。';
  }
  if (article.symbols?.length) return '影响更可能集中在列出的股票及其同行业公司。';
  return '属于市场背景信息，目前尚不能确认直接受影响的股票。';
};

const NewsView: React.FC<{ data: MarketNewsResponse; copy: any; isZh: boolean }> = ({ data, copy, isZh }) => (
  <div className="mi-view">
    <div className="mi-section-heading"><div><h2>{copy.newsTitle}</h2><p>{copy.newsHelp}</p><small className="mi-live-note"><ClockCircleOutlined /> {copy.autoRefresh} · AI {data.ai?.analyzedCount || 0}/{data.ai?.eligibleCount || 0}{data.ai?.pendingCount ? ` · ${data.ai.pendingCount} pending` : ''}</small></div><Tag>{data.count}</Tag></div>
    {!data.articles.length ? <Empty description={copy.noNews} /> : <section className="mi-news-list">
      {data.articles.map((article: MarketNewsArticle, index) => {
        const ai = article.aiAnalysis;
        const displayedHeadline = isZh && ai?.headlineZh ? ai.headlineZh : article.headline;
        const displayedAnalysis = isZh ? ai?.analysisZh : ai?.analysisEn;
        const displayedImpact = isZh ? ai?.marketImpactZh : ai?.marketImpactEn;
        return <article key={article.id || `${article.headline}-${index}`} className={`mi-news-card is-${article.marketDirection}`}>
        <div className="mi-impact-score"><strong>{article.impactScore}</strong><span>{article.impactLevel}</span></div>
        <div className="mi-news-body">
          <div className="mi-news-tags"><Tag color={article.impactLevel === 'Critical' ? 'red' : article.impactLevel === 'High' ? 'orange' : 'blue'}>{article.impactLevel}</Tag><Tag>{localizedTopic(article.topic, isZh)}</Tag><Tag color={article.marketDirection === 'positive' ? 'green' : article.marketDirection === 'negative' ? 'red' : 'default'}>{article.sentiment}</Tag></div>
          <h3>{displayedHeadline}</h3>
          {isZh && ai?.headlineZh && <small className="mi-original-headline">{article.headline}</small>}
          {article.summary && <p>{article.summary}</p>}
          {ai?.status === 'ready' && <section className="mi-news-ai">
            <header><span><BulbOutlined /> {copy.aiAnalysis}</span><span><Tag color="green">{copy.aiReady}</Tag><Tag>{ai.confidence ?? '—'}%</Tag></span></header>
            {displayedAnalysis && <p>{displayedAnalysis}</p>}
            {displayedImpact && <blockquote>{displayedImpact}</blockquote>}
            {!!ai.affectedStocks?.length && <div className="mi-affected-grid">{ai.affectedStocks.map(stock => <button type="button" key={stock.symbol}>
              <b>{stock.symbol}</b><span className={`is-${stock.direction}`}>{stock.direction}</span><small>{copy.impactType}: {stock.impactType} · {copy.horizon}: {stock.horizon.replace('_', ' ')}</small><p>{isZh ? stock.whyZh : stock.whyEn}</p>
            </button>)}</div>}
          </section>}
          {ai?.status === 'pending' && <section className="mi-news-ai mi-news-ai-pending"><ReloadOutlined spin /><div><strong>{copy.aiAnalysis}</strong><p>{copy.aiWorking}</p></div></section>}
          {ai?.status === 'error' && <section className="mi-news-ai mi-news-ai-error"><BulbOutlined /><div><strong>{copy.aiAnalysis}</strong><p>{copy.aiFailed}</p></div></section>}
          <dl><div><dt>{copy.affected}</dt><dd>{article.symbols?.length ? article.symbols.slice(0, 12).join(' · ') : copy.affectedFallback}{article.symbolImpactSource === 'topic_inference' ? ` · ${copy.inferred}` : ''}</dd></div><div><dt>{copy.marketImpact}</dt><dd>{displayedImpact || localizedMarketImpact(article, isZh)}</dd></div></dl>
          <footer><span>{article.source}{article.createdAt ? ` · ${new Date(article.createdAt).toLocaleString()}` : ''}</span>{article.url && <a href={article.url} target="_blank" rel="noreferrer">{copy.openSource}</a>}</footer>
        </div>
      </article>;})}
    </section>}
  </div>
);

export const CalendarView: React.FC<{ data: MarketCalendarResponse; copy: any; isZh: boolean; onSymbol: (symbol: string) => void }> = ({ data, copy, isZh, onSymbol }) => {
  const economicEvents = normalizeEconomicEvents(data.economicEvents);
  type TimelineItem =
    | { kind: 'economic'; dateKey: string; sortKey: string; event: (typeof economicEvents)[number] }
    | { kind: 'earnings'; dateKey: string; sortKey: string; event: MarketCalendarResponse['earnings'][number] };
  const timeline: TimelineItem[] = [
    ...economicEvents.map(event => ({ kind: 'economic' as const, dateKey: event.dateKey, sortKey: event.time || '99:99', event })),
    ...data.earnings.map(event => ({
      kind: 'earnings' as const,
      dateKey: event.date || 'TBD',
      sortKey: event.hour === 'bmo' ? '08:00' : event.hour === 'amc' ? '16:15' : '12:00',
      event,
    })),
  ].sort((left, right) => left.dateKey.localeCompare(right.dateKey) || left.sortKey.localeCompare(right.sortKey));
  const groupedTimeline = timeline.reduce<Record<string, TimelineItem[]>>((acc, item) => {
    (acc[item.dateKey] ||= []).push(item);
    return acc;
  }, {});
  const nextHighImpact = economicEvents.find(event => String(event.importance || '').toLowerCase() === 'high');
  const hourLabel = (hour?: string) => hour === 'bmo' ? copy.before : hour === 'amc' ? copy.after : copy.unknown;
  const eventValue = (value: string | number | null | undefined, missing: string, unit?: string | null) => (
    value === null || value === undefined || value === '' ? missing : `${String(value)}${unit || ''}`
  );
  const dateLabel = (date: string) => date === 'TBD'
    ? copy.unknown
    : new Date(`${date}T12:00:00`).toLocaleDateString(isZh ? 'zh-CN' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const emptyDescription = data.watchlistStatus === 'empty'
    ? copy.emptyWatchlist
    : data.watchlistStatus === 'unavailable'
      ? copy.unavailable
      : copy.noEarnings;
  return <div className="mi-view">
    <div className="mi-section-heading"><div><h2>{copy.calendarTitle}</h2><p>{data.windowDays || 30} {isZh ? '天窗口' : 'day window'}</p></div></div>
    {nextHighImpact && <section className="mi-next-catalyst"><CalendarOutlined /><div><span>{copy.nextCatalyst}</span><h3>{nextHighImpact.title}</h3><p>{dateLabel(nextHighImpact.dateKey)} · {nextHighImpact.time || copy.unknown} · {nextHighImpact.source}</p></div><Tag color="red">{copy.high}</Tag></section>}
    <section className="mi-calendar-summary">
      <div><strong>{copy.economic}</strong><b>{economicEvents.length}</b><small>{copy.macroEvents}</small></div>
      <div><strong>{copy.earningsCoverage}</strong><b>{data.earningsCoverage?.symbolsWithEvents?.length || 0}/{data.watchlistCount || 0}</b><small>{copy.watchlistStocks}</small></div>
      <div><strong>{copy.earnings}</strong><b>{data.earningsCount}</b><small>{copy.scheduled}</small></div>
      <Link to="/watchlist">{copy.manageWatchlist}</Link>
    </section>
    {data.economicCalendar.status === 'partial' && <Alert type="warning" showIcon message={copy.economic} description={copy.macroPartial} />}
    {data.economicCalendar.values?.status === 'plan_required' && <Alert type="info" showIcon message={copy.forecast} description={copy.valuesPlanRequired} />}
    {data.watchlistStatus === 'unavailable' && <Alert type="warning" showIcon message={copy.unavailable} description={data.errors?.[0]} />}
    {data.watchlistStatus === 'ready' && !data.earnings.length && <Alert type="info" showIcon message={copy.earningsTitle} description={copy.noEarnings} />}
    {!!data.earningsCoverage?.symbolsWithoutEvents?.length && <Alert type="info" showIcon message={`${copy.earningsCoverage}: ${data.earningsCoverage.symbolsWithEvents.length}/${data.watchlistCount}`} description={`${copy.noDateInWindow}: ${data.earningsCoverage.symbolsWithoutEvents.join(' · ')}`} />}
    {!timeline.length ? <Empty description={emptyDescription}>{data.watchlistStatus === 'empty' && <Link to="/watchlist"><Button type="primary">{copy.manageWatchlist}</Button></Link>}</Empty> : <section className="mi-calendar-section" aria-labelledby="all-events-title">
      <div className="mi-section-heading"><div><h2 id="all-events-title">{copy.allEvents}</h2><p>{copy.watchlistSummary} · {copy.economic}</p></div></div>
      <div className="mi-economic-list mi-unified-calendar">
        {Object.entries(groupedTimeline).map(([date, items]) => <article key={date}>
          <header><strong>{dateLabel(date)}</strong><span>{items.length} {isZh ? '项事件' : 'events'}</span></header>
          <div>{items.map((item, index) => {
            if (item.kind === 'earnings') {
              const event = item.event;
              return <button type="button" className="mi-unified-earnings" key={`earnings-${event.symbol}-${event.hour || ''}-${index}`} onClick={() => onSymbol(event.symbol)}>
                <span><Tag color="blue">{copy.earnings}</Tag><b>{hourLabel(event.hour)}</b></span>
                <span><b>{event.symbol}</b><small>{copy.scheduled} · {event.source || 'Finnhub'}</small></span>
                <span><small>{copy.estimate}</small><strong>{event.epsEstimate == null ? copy.noConsensus : Number(event.epsEstimate).toFixed(2)}</strong></span>
                <span><small>{copy.revenue}</small><strong>{event.revenueEstimate == null ? copy.noConsensus : compactNumber(event.revenueEstimate)}</strong></span>
                <span><small>{copy.actual}</small><strong>{event.epsActual == null ? copy.actualPending : Number(event.epsActual).toFixed(2)}</strong></span>
                <span><small>{copy.importance}</small><Tag color="blue">{copy.medium}</Tag></span>
              </button>;
            }
            const event = item.event;
            const importance = String(event.importance || '').toLowerCase();
            return <div className="mi-economic-event" key={`economic-${event.title}-${event.time || ''}-${index}`}>
              <span><Tag color={importance === 'high' ? 'red' : importance === 'medium' ? 'orange' : 'default'}>{copy.economic}</Tag><b>{event.time || copy.unknown}</b></span>
              <span><b>{event.title}</b><small>{event.source || copy.economic}{event.period ? ` · ${event.period}` : ''}</small></span>
              <span><small>{copy.actual}</small><strong>{eventValue(event.actual, copy.actualPending, event.unit)}</strong></span>
              <span><small>{copy.forecast}</small><strong>{eventValue(event.forecast, copy.noConsensus, event.unit)}</strong></span>
              <span><small>{copy.previous}</small><strong>{eventValue(event.previous, copy.noPrevious, event.unit)}</strong></span>
              <span><small>{copy.importance}</small><Tag color={importance === 'high' ? 'red' : importance === 'medium' ? 'orange' : 'default'}>{copy[importance] || event.importance || '—'}</Tag></span>
            </div>;
          })}</div>
        </article>)}
      </div>
    </section>}
  </div>;
};

export default MarketIntelligence;
