import React from 'react';
import { Button, Progress, Table, Tag, Tooltip } from 'antd';
import {
  ArrowDownOutlined,
  ArrowRightOutlined,
  ArrowUpOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';

type ScannerView = 'all' | 'priorityA' | 'advance' | 'watch' | 'event';

interface ProgressStep {
  key: string;
  label: string;
}

interface MarketScannerWorkbenchProps {
  results: any[];
  displayedResults: any[];
  detailedStatus: any;
  totalSymbols: number;
  progressPercent: number;
  stageIndex: number;
  stageCount: number;
  stageLabel: string;
  stageDetail: string;
  etaLabel: string;
  progressSteps: ProgressStep[];
  viewFilter: ScannerView;
  onViewFilterChange: (value: ScannerView) => void;
  expandedRows: string[];
  onToggleRow: (symbol: string) => void;
  renderDetail: (record: any) => React.ReactNode;
}

const trendTone: Record<string, string> = {
  'Strong Bullish': '#16a34a',
  Bullish: '#22c55e',
  Neutral: '#d97706',
  Bearish: '#ef4444',
  'Strong Bearish': '#dc2626',
};

const scannerCopy = {
  en: {
    candidate: 'Candidate', usEquity: 'US equity', unknownCompany: 'Company name unavailable', priceUnavailable: 'Price unavailable',
    researchPriority: 'Research priority', reliability: 'Reliability', agreement: 'agreement', directionalSignal: 'Directional signal',
    direction: 'Direction', spyRelative: 'SPY relative', investability: 'Investability', tierUnavailable: 'Tier N/A', costUnavailable: 'cost N/A',
    capacity: 'Capacity', eventRisk: 'Event / risk', noEventSignal: 'No event signal', earnings: 'Earnings', days: 'd', noNearEarnings: 'No near-term earnings',
    volatility: 'Vol', finraFlow: 'FINRA short-sale flow', notShortInterest: 'not short interest', aiChallenge: 'AI challenge', rulesOnly: 'Rules only',
    defaultRationale: 'Deterministic ranking complete; AI review pending.', defaultNext: 'Continue to Fine Scan for setup and execution validation.',
    pipeline: 'Cross-sectional research pipeline', institutional: 'Institutional v5', stage: 'Stage', universeProcessed: 'Universe processed',
    universeNote: 'liquidity-preselected daily bars', rankedCandidates: 'Ranked candidates', rankedNote: 'risk-adjusted shortlist', priorityA: 'Priority A',
    priorityNote: 'highest research priority', evidenceComplete: 'Evidence complete', evidenceNote: 'reliability at least 90%', aiReviewed: 'AI reviewed',
    challenged: 'challenged', advance: 'advance', eventReview: 'Event review', eventNote: 'earnings, news, options', board: 'Candidate priority board',
    boardNote: 'Research rank is separate from directional signal. AI reviews conflicts and missing checks; it does not own the score.', all: 'All',
    aiAdvance: 'AI advance', totalSuffix: ' candidates', collapse: 'Collapse candidate detail', expand: 'Expand candidate detail', emptyTitle: 'No ranked candidates yet',
    emptyBody: 'Run Market Scanner to build a risk-adjusted, investability-filtered research shortlist.',
  },
  zh: {
    candidate: '候选标的', usEquity: '美股', unknownCompany: '暂无公司名称', priceUnavailable: '暂无价格',
    researchPriority: '研究优先级', reliability: '可靠性', agreement: '一致度', directionalSignal: '方向信号', direction: '方向评分',
    spyRelative: '相对 SPY', investability: '可投资性', tierUnavailable: '暂无层级', costUnavailable: '暂无成本', capacity: '容量评分',
    eventRisk: '事件与风险', noEventSignal: '暂无事件信号', earnings: '财报还有', days: '天', noNearEarnings: '近期无财报',
    volatility: '波动率', finraFlow: 'FINRA 卖空成交占比', notShortInterest: '并非空头持仓', aiChallenge: 'AI 质疑', rulesOnly: '仅规则',
    defaultRationale: '确定性排名已完成，等待 AI 审核。', defaultNext: '进入精细扫描，继续验证形态与执行条件。',
    pipeline: '横截面研究流程', institutional: '机构版 v5', stage: '阶段', universeProcessed: '已处理标的', universeNote: '通过流动性预筛的日线数据',
    rankedCandidates: '排名候选', rankedNote: '风险调整后的候选清单', priorityA: 'A 级优先', priorityNote: '最高研究优先级',
    evidenceComplete: '证据完整', evidenceNote: '可靠性不低于 90%', aiReviewed: 'AI 已审核', challenged: '个被质疑', advance: '个推进',
    eventReview: '事件复核', eventNote: '财报、新闻与期权', board: '候选优先级看板',
    boardNote: '研究排名与方向信号分别展示；AI 负责检查冲突和缺项，不会覆盖确定性评分。', all: '全部', aiAdvance: 'AI 推进',
    totalSuffix: ' 个候选', collapse: '收起候选详情', expand: '展开候选详情', emptyTitle: '暂无排名候选',
    emptyBody: '运行市场扫描器后，这里将显示经过可投资性过滤和风险调整的研究候选。',
  },
};

function localizedTrend(label: string | undefined, isZh: boolean): string {
  if (!isZh) return label || 'Neutral';
  return ({ 'Strong Bullish': '强势看多', Bullish: '看多', Neutral: '中性', Bearish: '看空', 'Strong Bearish': '强势看空' } as Record<string, string>)[label || 'Neutral'] || label || '中性';
}

function localizedPriority(label: string, isZh: boolean): string {
  if (!isZh) return label;
  return ({ 'Priority A': 'A 级优先', 'Priority B': 'B 级优先', 'Priority C': 'C 级优先', Monitor: '观察' } as Record<string, string>)[label] || label;
}

function localizedDecision(label: string | undefined, isZh: boolean): string {
  if (!label || !isZh) return label || '';
  return ({ Advance: '推进', Watch: '观察', Avoid: '回避' } as Record<string, string>)[label] || label;
}

function compactMoney(value: any): string {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 'N/A';
  if (amount >= 1_000_000_000) return '$' + (amount / 1_000_000_000).toFixed(1) + 'B';
  if (amount >= 1_000_000) return '$' + (amount / 1_000_000).toFixed(1) + 'M';
  return '$' + amount.toFixed(0);
}

function signedPct(value: any, digits = 1): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'N/A';
  return (amount >= 0 ? '+' : '') + amount.toFixed(digits) + '%';
}

function TrendBadge({ label, isZh }: { label?: string; isZh: boolean }) {
  const safeLabel = label || 'Neutral';
  const color = trendTone[safeLabel] || '#64748b';
  return (
    <span
      className="scanner-badge-base"
      style={{ color, borderColor: color, background: color + '14' }}
    >
      {localizedTrend(safeLabel, isZh)}
    </span>
  );
}

export default function MarketScannerWorkbench({
  results,
  displayedResults,
  detailedStatus,
  totalSymbols,
  progressPercent,
  stageIndex,
  stageCount,
  stageLabel,
  stageDetail,
  etaLabel,
  progressSteps,
  viewFilter,
  onViewFilterChange,
  expandedRows,
  onToggleRow,
  renderDetail,
}: MarketScannerWorkbenchProps) {
  const { language } = useLanguage();
  const isZh = language === 'zh-CN';
  const c = isZh ? scannerCopy.zh : scannerCopy.en;
  const priorityA = results.filter(row => row.selectionLabel === 'Priority A').length;
  const evidenceComplete = results.filter(row => Number(row.scoreReliability || 0) >= 90).length;
  const aiReviewed = results.filter(row => row.aiCalled && row.aiSuccess !== false).length;
  const aiChallenged = results.filter(row =>
    row.aiChallenged || row.aiTraderDecision === 'Watch' || row.aiTraderDecision === 'Avoid'
  ).length;
  const aiAdvance = results.filter(row => row.aiTraderDecision === 'Advance').length;
  const eventReview = results.filter(row =>
    row.eventRisk === 'High' ||
    (row.daysToEarnings != null && Number(row.daysToEarnings) >= 0 && Number(row.daysToEarnings) <= 10) ||
    (row.optionIvSkew != null && Math.abs(Number(row.optionIvSkew)) >= 20)
  ).length;

  const columns: any[] = [
    {
      title: c.candidate,
      dataIndex: 'symbol',
      key: 'symbol',
      fixed: 'left',
      width: 215,
      render: (symbol: string, record: any) => {
        const price = Number(record.price);
        const change = Number(record.changePct ?? record.changePercent);
        return (
          <div className="scanner-candidate-cell">
            <div>
              <b>{symbol}</b>
              <span>{record.exchangeName || record.exchange || c.usEquity}</span>
            </div>
            <strong>{record.companyName || record.name || c.unknownCompany}</strong>
            <small>
              {Number.isFinite(price) && price > 0 ? '$' + price.toFixed(2) : c.priceUnavailable}
              {Number.isFinite(change) && (
                <em className={change >= 0 ? 'positive' : 'negative'}>
                  {change >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                  {Math.abs(change).toFixed(2)}%
                </em>
              )}
            </small>
          </div>
        );
      },
    },
    {
      title: c.researchPriority,
      key: 'priority',
      width: 190,
      sorter: (a: any, b: any) =>
        Number(a.selectionScore ?? a.overallScore ?? 0) -
        Number(b.selectionScore ?? b.overallScore ?? 0),
      render: (_: any, record: any) => {
        const score = Number(record.selectionScore ?? record.overallScore ?? record.trendScore ?? 0);
        const reliability = Number(record.scoreReliability);
        const priority = record.selectionLabel ||
          (score >= 80 ? 'Priority A' : score >= 65 ? 'Priority B' : score >= 50 ? 'Priority C' : 'Monitor');
        const color = priority === 'Priority A' ? '#16a34a' : priority === 'Priority B' ? '#2563eb' : '#d97706';
        return (
          <div className="scanner-priority-cell">
            <div>
              <Tag color={priority === 'Priority A' ? 'success' : priority === 'Priority B' ? 'blue' : 'gold'}>
                {localizedPriority(priority, isZh)}
              </Tag>
              <b style={{ color }}>{Math.round(score)}</b>
            </div>
            <Progress percent={score} strokeColor={color} showInfo={false} size={['100%', 6]} />
            <small>
              {c.reliability} {Number.isFinite(reliability) ? Math.round(reliability) + '%' : 'N/A'}
              {' · '}{c.agreement} {record.factorAgreementPct != null ? Math.round(Number(record.factorAgreementPct)) + '%' : 'N/A'}
            </small>
          </div>
        );
      },
    },
    {
      title: c.directionalSignal,
      key: 'signal',
      width: 190,
      render: (_: any, record: any) => (
        <div className="scanner-signal-cell">
          <TrendBadge label={record.trendLabel} isZh={isZh} />
          <small>
            {c.direction} {record.directionScore != null ? Math.round(Number(record.directionScore)) : 'N/A'}/100
          </small>
          <span>3M {signedPct(record.momentum3m)} · 6M {signedPct(record.momentum6m)}</span>
          <span>{c.spyRelative} {signedPct(record.relativeStrength3m)}</span>
        </div>
      ),
    },
    {
      title: c.investability,
      key: 'investability',
      width: 190,
      render: (_: any, record: any) => {
        const cost = Number(record.estimatedRoundTripCostBps);
        const capacity = Number(record.capacityScore);
        return (
          <div className="scanner-investability-cell">
            <b>{compactMoney(record.avgDollarVolume20)} ADV</b>
            <span>
              {record.liquidityTier || c.tierUnavailable}
              {' · '}
              {Number.isFinite(cost) ? cost.toFixed(1) + ' bps' : c.costUnavailable}
            </span>
            <small>
              {c.capacity} {Number.isFinite(capacity) ? Math.round(capacity) + '/100' : 'N/A'}
              {' · '}10% ADV {compactMoney(record.participation10pctDollar)}
            </small>
          </div>
        );
      },
    },
    {
      title: c.eventRisk,
      key: 'event',
      width: 180,
      render: (_: any, record: any) => {
        const eventColor = record.eventRisk === 'High'
          ? 'error'
          : record.eventRisk === 'Medium'
            ? 'warning'
            : 'default';
        return (
          <div className="scanner-event-cell">
            <Tag color={eventColor}>
              {record.eventRisk && record.eventRisk !== 'Unknown'
                ? `${isZh ? ({ High: '高', Medium: '中', Low: '低' } as Record<string, string>)[record.eventRisk] || record.eventRisk : record.eventRisk} ${isZh ? '事件风险' : 'event risk'}`
                : c.noEventSignal}
            </Tag>
            <span>{record.daysToEarnings != null && Number(record.daysToEarnings) >= 0 ? `${c.earnings} ${record.daysToEarnings}${c.days}` : c.noNearEarnings}</span>
            <small>
              ATR {record.atrPercent != null ? Number(record.atrPercent).toFixed(1) + '%' : 'N/A'}
              {' · '}{c.volatility} {record.realizedVol20 != null ? Number(record.realizedVol20).toFixed(1) + '%' : 'N/A'}
            </small>
            {record.shortVolumeRatio != null && <small>{c.finraFlow} {Number(record.shortVolumeRatio).toFixed(1)}% · {c.notShortInterest}</small>}
          </div>
        );
      },
    },
    {
      title: c.aiChallenge,
      key: 'ai',
      width: 300,
      render: (_: any, record: any) => {
        const decision = record.aiTraderDecision;
        const rationale = record.aiTraderRationale || record.scannerReason ||
          c.defaultRationale;
        const nextStep = record.aiNextStep || record.nextStep ||
          c.defaultNext;
        return (
          <div className="scanner-ai-cell">
            <div>
              <Tag color={decision === 'Advance' ? 'success' : decision === 'Avoid' ? 'error' : decision === 'Watch' ? 'warning' : 'default'}>
                {decision ? `AI ${localizedDecision(decision, isZh)}` : c.rulesOnly}
              </Tag>
              {record.aiTraderConfidence != null && <span>{Math.round(Number(record.aiTraderConfidence))}%</span>}
            </div>
            <Tooltip title={rationale}><p>{rationale}</p></Tooltip>
            <small>{nextStep}</small>
          </div>
        );
      },
    },
  ];

  return (
    <div className="market-scanner-workbench">
      {detailedStatus.currentStatus !== 'idle' && (
        <div className="market-scanner-progress-panel market-scanner-progress-panel-v5">
          <div className="market-scanner-progress-header">
            <div>
              <div className="market-scanner-progress-kicker">{c.pipeline}</div>
              <div className="market-scanner-progress-stage">
                <span>{stageLabel}</span>
                <Tag
                  color={
                    detailedStatus.currentStatus === 'completed' ? 'success' :
                    detailedStatus.currentStatus === 'error' ? 'error' :
                    detailedStatus.currentStatus === 'stopped' ? 'warning' : 'processing'
                  }
                >
                  {detailedStatus.currentStatus === 'completed'
                    ? c.institutional
                    : c.stage + ' ' + (stageIndex || 0) + '/' + (stageCount || progressSteps.length)}
                </Tag>
              </div>
              <div className="market-scanner-progress-detail">{stageDetail}</div>
            </div>
            <div className="market-scanner-progress-percent">
              <b>{progressPercent}</b><span>%</span>
              {etaLabel && <em>{etaLabel}</em>}
            </div>
          </div>
          <Progress
            percent={progressPercent}
            showInfo={false}
            size={['100%', 8]}
            status={
              detailedStatus.currentStatus === 'scanning' ? 'active' :
              detailedStatus.currentStatus === 'completed' ? 'success' :
              detailedStatus.currentStatus === 'error' || detailedStatus.currentStatus === 'stopped' ? 'exception' : 'normal'
            }
          />
          <div className="market-scanner-stage-rail">
            {progressSteps.map((step, index) => {
              const stepNo = index + 1;
              const isDone = detailedStatus.currentStatus === 'completed' || stepNo < stageIndex;
              const isActive = stepNo === stageIndex && detailedStatus.currentStatus === 'scanning';
              const classes = [
                'market-scanner-stage',
                isDone ? 'market-scanner-stage-done' : '',
                isActive ? 'market-scanner-stage-active' : '',
              ].filter(Boolean).join(' ');
              return (
                <div key={step.key} className={classes}>
                  <span>{stepNo}</span>
                  <b>{step.label}</b>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {results.length > 0 ? (
        <>
          <div className="market-scanner-summary-v5">
            <div><span>{c.universeProcessed}</span><b>{totalSymbols.toLocaleString()}</b><small>{c.universeNote}</small></div>
            <div><span>{c.rankedCandidates}</span><b>{results.length.toLocaleString()}</b><small>{c.rankedNote}</small></div>
            <div><span>{c.priorityA}</span><b className="positive">{priorityA.toLocaleString()}</b><small>{c.priorityNote}</small></div>
            <div><span>{c.evidenceComplete}</span><b>{evidenceComplete.toLocaleString()}/{results.length.toLocaleString()}</b><small>{c.evidenceNote}</small></div>
            <div><span>{c.aiReviewed}</span><b>{aiReviewed.toLocaleString()}/{results.length.toLocaleString()}</b><small>{aiChallenged} {c.challenged} · {aiAdvance} {c.advance}</small></div>
            <div><span>{c.eventReview}</span><b className={eventReview > 0 ? 'warning' : ''}>{eventReview.toLocaleString()}</b><small>{c.eventNote}</small></div>
          </div>

          <div className="market-scanner-board-head">
            <div>
              <h3>{c.board}</h3>
              <p>{c.boardNote}</p>
            </div>
            <div className="market-scanner-view-tabs">
              {[
                { value: 'all' as ScannerView, label: c.all },
                { value: 'priorityA' as ScannerView, label: c.priorityA },
                { value: 'advance' as ScannerView, label: c.aiAdvance },
                { value: 'watch' as ScannerView, label: c.aiChallenge },
                { value: 'event' as ScannerView, label: c.eventReview },
              ].map(tab => (
                <button
                  type="button"
                  key={tab.value}
                  className={viewFilter === tab.value ? 'active' : ''}
                  onClick={() => onViewFilterChange(tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="scanner-table-container scanner-table-v5">
            <Table
              columns={columns}
              dataSource={displayedResults}
              rowKey="symbol"
              size="middle"
              pagination={{
                pageSize: 10,
                size: 'default',
                showSizeChanger: false,
                showTotal: total => total.toLocaleString() + c.totalSuffix,
              }}
              scroll={{ x: 1280 }}
              onRow={(record: any) => ({
                className: expandedRows.includes(record.symbol) ? 'scanner-row-expanded' : '',
                onClick: () => onToggleRow(record.symbol),
              })}
              expandable={{
                expandedRowRender: (record: any) => renderDetail(record),
                rowExpandable: () => true,
                expandedRowKeys: expandedRows,
                showExpandColumn: true,
                expandRowByClick: false,
                expandIcon: ({ expanded, onExpand, record }: any) => (
                  <Button
                    type="text"
                    size="small"
                    aria-label={expanded ? c.collapse : c.expand}
                    icon={expanded ? <ArrowDownOutlined /> : <ArrowRightOutlined />}
                    onClick={event => {
                      event.stopPropagation();
                      onExpand(record, event);
                    }}
                  />
                ),
              }}
            />
          </div>
        </>
      ) : detailedStatus.currentStatus !== 'scanning' ? (
        <div className="market-scanner-empty">
          <LineChartOutlined />
          <b>{c.emptyTitle}</b>
          <span>{c.emptyBody}</span>
        </div>
      ) : null}
    </div>
  );
}
