import React, { useMemo, useState } from 'react';
import { Button, Progress, Table, Tag, Tooltip } from 'antd';
import {
  ArrowDownOutlined,
  ArrowRightOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';

type FineView = 'all' | 'continue' | 'watch' | 'reject' | 'needData' | 'aiChallenge';

interface FineScanWorkbenchProps {
  results: any[];
  status: string;
  progress: number;
  currentStep: string;
  message: string;
  expandedRows: string[];
  onToggleRow: (symbol: string) => void;
}

const decisionMeta: Record<string, { label: string; color: string; tag: string }> = {
  Continue: { label: 'CONTINUE', color: '#16a34a', tag: 'success' },
  Watch: { label: 'WATCH', color: '#d97706', tag: 'warning' },
  Reject: { label: 'REJECT', color: '#dc2626', tag: 'error' },
  NeedMoreData: { label: 'NEED DATA', color: '#ea580c', tag: 'orange' },
};

const dual = (isZh: boolean, en: string, zh: string): string => isZh ? zh : en;

function money(value: any): string {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 'N/A';
  if (amount >= 1_000_000_000) return '$' + (amount / 1_000_000_000).toFixed(1) + 'B';
  if (amount >= 1_000_000) return '$' + (amount / 1_000_000).toFixed(1) + 'M';
  return '$' + amount.toFixed(0);
}

function price(value: any): string {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? '$' + amount.toFixed(2) : 'N/A';
}

function bps(value: any): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(1) + ' bps' : 'N/A';
}

function pct(value: any, signed = false): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'N/A';
  return (signed && amount >= 0 ? '+' : '') + amount.toFixed(1) + '%';
}

function age(value: any): string {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return 'N/A';
  if (seconds < 90) return Math.round(seconds) + 's';
  if (seconds < 7200) return Math.round(seconds / 60) + 'm';
  return (seconds / 3600).toFixed(1) + 'h';
}

function zone(plan: any): string {
  return plan?.entryLow != null && plan?.entryHigh != null
    ? price(plan.entryLow) + ' – ' + price(plan.entryHigh)
    : 'N/A';
}

function safeScore(value: any): number {
  const score = Number(value);
  return Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
}

function GateTag({ gate, isZh }: { gate?: string; isZh: boolean }) {
  const value = gate || 'REVIEW';
  const label = isZh ? ({ PASS: '闸门通过', BLOCK: '闸门阻断', REVIEW: '需要复核' } as Record<string, string>)[value] || value : value;
  return <Tag color={value === 'PASS' ? 'success' : value === 'BLOCK' ? 'error' : 'warning'}>{label}</Tag>;
}

function DecisionTag({ decision, isZh }: { decision?: string; isZh: boolean }) {
  const meta = decisionMeta[decision || 'Watch'] || decisionMeta.Watch;
  const label = isZh ? ({ Continue: '继续', Watch: '观察', Reject: '拒绝', NeedMoreData: '缺少数据' } as Record<string, string>)[decision || 'Watch'] || meta.label : meta.label;
  return <Tag color={meta.tag}>{label}</Tag>;
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="fine-v4-metric"><span>{label}</span><b>{value}</b></div>;
}

function FactorBar({ label, value }: { label: string; value: any }) {
  const score = safeScore(value);
  const color = score >= 72 ? '#16a34a' : score >= 48 ? '#d97706' : '#dc2626';
  return (
    <div className="fine-v4-factor">
      <div><span>{label}</span><b>{Math.round(score)}</b></div>
      <Progress percent={score} showInfo={false} size={['100%', 5]} strokeColor={color} />
    </div>
  );
}

function FineScanDetail({ record, isZh }: { record: any; isZh: boolean }) {
  const plan = record.entryPlanFine || record.entryDetails?.entry_plan || {};
  const factors = record.fineScanFactorScores || {};
  const micro = record.microstructureDetails || {};
  const blockers = record.decisionBlockers || [];
  const warnings = record.decisionWarnings || [];
  const missing = record.requiredEvidenceMissing || [];
  const strategies = record.strategyStack || record.matchedStrategies || [];
  const contradictions = record.aiContradictionsFine || record.aiDecisionDetail?.contradictions || [];
  const missingChecks = record.aiMissingChecksFine || record.aiDecisionDetail?.missingChecks || [];
  const aiRationale = record.aiTraderRationaleFine;

  return (
    <div className="fine-v4-detail">
      <div className="fine-v4-detail-head">
        <div>
          <div><strong>{record.symbol}</strong><b>{record.companyName || record.name || dual(isZh, 'Company name unavailable', '暂无公司名称')}</b></div>
          <span>{record.setup || dual(isZh, 'Quality Watch', '质量观察')} · {strategies.length ? strategies.join(' / ') : dual(isZh, 'strategy routing pending', '等待策略路由')}</span>
        </div>
        <div><DecisionTag decision={record.decision} isZh={isZh} /><GateTag gate={record.riskGateStatus} isZh={isZh} /><Tag color={record.aiUsed ? 'cyan' : 'default'}>{record.aiUsed ? dual(isZh, 'AI REVIEWED', 'AI 已审核') : dual(isZh, 'RULES', '规则')}</Tag></div>
      </div>

      <div className="fine-v4-decision-strip">
        <Metric label={dual(isZh, 'Fine score', '精细评分')} value={Math.round(safeScore(record.fineScanScore)) + '/100'} />
        <Metric label={dual(isZh, 'Evidence reliability', '证据可靠性')} value={record.fineScoreReliability != null ? Math.round(Number(record.fineScoreReliability)) + '%' : 'N/A'} />
        <Metric label={dual(isZh, 'Entry readiness', '入场准备度')} value={record.entryReadiness || plan.readiness || dual(isZh, 'Review', '复核')} />
        <Metric label={dual(isZh, 'Execution score', '执行评分')} value={record.executionReadinessScore != null ? Math.round(Number(record.executionReadinessScore)) + '/100' : 'N/A'} />
      </div>

      <div className="fine-v4-detail-grid">
        <section>
          <h4>{dual(isZh, 'Setup evidence', '形态证据')}</h4>
          <FactorBar label={dual(isZh, 'Setup', '形态')} value={factors.setup ?? record.setupQualityScore} />
          <FactorBar label={dual(isZh, 'Entry', '入场')} value={factors.entry ?? record.entryScore} />
          <FactorBar label={dual(isZh, 'Execution', '执行')} value={factors.execution ?? record.executionReadinessScore} />
          <FactorBar label={dual(isZh, 'Risk', '风险')} value={factors.risk ?? record.riskScore} />
          <div className="fine-v4-compact-line">
            <span>{dual(isZh, 'Confirmations', '确认条件')}</span>
            <b>{record.confirmationCount ?? 0}/{record.confirmationAvailableCount ?? 0} {dual(isZh, 'available', '可用')}</b>
          </div>
          <div className="fine-v4-compact-line">
            <span>{dual(isZh, 'Market agreement', '市场一致度')}</span>
            <b>{record.factorAgreementPct != null ? Math.round(Number(record.factorAgreementPct)) + '%' : 'N/A'}</b>
          </div>
        </section>

        <section>
          <h4>{dual(isZh, 'Entry geometry', '入场结构')}</h4>
          <div className="fine-v4-metric-grid">
            <Metric label={dual(isZh, 'Current', '当前价格')} value={price(record.price ?? record.lastPrice)} />
            <Metric label={dual(isZh, 'Entry zone', '入场区间')} value={zone(plan)} />
            <Metric label={dual(isZh, 'Stop', '止损')} value={price(plan.stopLoss)} />
            <Metric label={dual(isZh, 'Target 1', '目标一')} value={price(plan.target1)} />
            <Metric label={dual(isZh, 'Reward / risk', '盈亏比')} value={plan.rewardRiskRatio != null ? Number(plan.rewardRiskRatio).toFixed(2) + 'x' : 'N/A'} />
            <Metric label={dual(isZh, 'Entry distance', '入场距离')} value={plan.entryDistancePct != null ? pct(plan.entryDistancePct) : 'N/A'} />
            <Metric label={dual(isZh, 'Support', '支撑')} value={price(plan.supportLevel)} />
            <Metric label={dual(isZh, 'Resistance', '阻力')} value={price(plan.resistanceLevel)} />
          </div>
          <div className="fine-v4-footnote">{plan.basis || dual(isZh, 'VWAP / day range / ATR geometry', 'VWAP / 日内区间 / ATR 入场结构')}</div>
        </section>

        <section>
          <h4>{dual(isZh, 'Execution controls', '执行控制')}</h4>
          <div className="fine-v4-metric-grid">
            <Metric label="ADV20" value={money(record.avgDollarVolume20)} />
            <Metric label="10% ADV" value={money(record.participation10pctDollar)} />
            <Metric label={dual(isZh, 'Spread', '点差')} value={bps(micro.spreadBps ?? record.spreadBps)} />
            <Metric label={dual(isZh, 'Round trip', '双边成本')} value={bps(record.estimatedRoundTripCostBps)} />
            <Metric label={dual(isZh, 'Completed-day volume', '完整交易日量比')} value={micro.comparableVolumeRatio != null ? Number(micro.comparableVolumeRatio).toFixed(2) + 'x' : 'N/A'} />
            <Metric label={dual(isZh, 'Intraday volume', '盘中量比')} value={micro.intradayVolumeRatioRaw != null ? Number(micro.intradayVolumeRatioRaw).toFixed(2) + 'x' : 'N/A'} />
            <Metric label={dual(isZh, 'VWAP distance', '距 VWAP')} value={pct(micro.priceVsVwapPct, true)} />
            <Metric label={dual(isZh, 'Day position', '日内位置')} value={pct(micro.dayRangePositionPct)} />
            <Metric label={dual(isZh, 'L1 imbalance', '一级盘口失衡')} value={pct(micro.quoteImbalancePct, true)} />
            <Metric label={dual(isZh, 'Quote age', '报价延迟')} value={age(micro.quoteAgeSeconds)} />
          </div>
          <div className="fine-v4-footnote">
            {micro.quoteIsStale ? dual(isZh, 'Stale quote · ADV cost fallback · live spread deferred', '报价已过期 · 使用 ADV 成本回退 · 暂不采用实时点差') : record.liquidityDetails?.costEstimateSource || dual(isZh, 'Fresh Alpaca quote and ADV impact model', 'Alpaca 最新报价与 ADV 冲击模型')}
            {micro.volumeRatioSource ? ' · ' + dual(isZh, 'volume comparison: ', '成交量对照：') + micro.volumeRatioSource : ''}
          </div>
        </section>
      </div>

      <div className="fine-v4-review-grid">
        <section>
          <h4>{dual(isZh, 'Deterministic gates', '确定性闸门')}</h4>
          <div className="fine-v4-flag-list">
            {missing.map((item: string) => <span className="missing" key={'m-' + item}>{item}</span>)}
            {blockers.map((item: string) => <span className="block" key={'b-' + item}>{item}</span>)}
            {warnings.map((item: string) => <span className="warning" key={'w-' + item}>{item}</span>)}
            {!missing.length && !blockers.length && !warnings.length && <span className="pass">{dual(isZh, 'No active gate flags', '当前没有风控标记')}</span>}
          </div>
          <p>{record.decisionReason || record.finalReason || dual(isZh, 'Deterministic review complete.', '确定性复核已完成。')}</p>
        </section>
        <section>
          <h4>{dual(isZh, 'AI challenge', 'AI 质疑')}</h4>
          {record.aiUsed ? (
            <>
              <div className="fine-v4-ai-line">
                <DecisionTag decision={record.aiTraderDecisionFine} isZh={isZh} />
                <b>{record.aiTraderConfidenceFine != null ? Math.round(Number(record.aiTraderConfidenceFine)) + dual(isZh, '% confidence', '% 置信度') : dual(isZh, 'confidence N/A', '暂无置信度')}</b>
                <span>{record.aiUrgencyFine || dual(isZh, 'Low', '低')}</span>
              </div>
              <p>{aiRationale || dual(isZh, 'AI reviewed the deterministic packet.', 'AI 已复核确定性证据包。')}</p>
              <div className="fine-v4-flag-list">
                {contradictions.map((item: string) => <span className="warning" key={'c-' + item}>{item}</span>)}
                {missingChecks.map((item: string) => <span key={'c-' + item}>{item}</span>)}
              </div>
            </>
          ) : <p>{dual(isZh, 'AI review unavailable; deterministic scores and gates remain active.', 'AI 审核不可用；确定性评分与闸门仍然有效。')}</p>}
          <div className="fine-v4-next"><span>{dual(isZh, 'Next', '下一步')}</span><b>{record.nextStep || dual(isZh, 'Hold for the next pipeline decision.', '等待下一阶段流程决策。')}</b></div>
        </section>
      </div>

      <div className="fine-v4-source-line">
        <span>{dual(isZh, 'Market', '市场数据')}</span><b>{dual(isZh, 'Alpaca snapshots + bars', 'Alpaca 快照与 K 线')}</b>
        <span>{dual(isZh, 'Cost', '成本')}</span><b>{record.liquidityDetails?.costEstimateSource || dual(isZh, 'ADV model', 'ADV 模型')}</b>
        <span>{dual(isZh, 'Optional context', '可选上下文')}</span><b>{(record.optionalEvidenceMissing || []).length ? dual(isZh, 'Missing: ', '缺少：') + record.optionalEvidenceMissing.join(', ') : dual(isZh, 'Available', '可用')}</b>
        <span>{dual(isZh, 'Decision', '决策')}</span><b>{record.provenance?.decision || record.decisionSource || dual(isZh, 'Institutional rules', '机构规则')}</b>
      </div>
    </div>
  );
}

export default function FineScanWorkbench({
  results,
  status,
  progress,
  currentStep,
  message,
  expandedRows,
  onToggleRow,
}: FineScanWorkbenchProps) {
  const { language } = useLanguage();
  const isZh = language === 'zh-CN';
  const [view, setView] = useState<FineView>('all');
  const counts = useMemo(() => ({
    Continue: results.filter(row => row.decision === 'Continue').length,
    Watch: results.filter(row => row.decision === 'Watch').length,
    Reject: results.filter(row => row.decision === 'Reject').length,
    NeedMoreData: results.filter(row => row.decision === 'NeedMoreData').length,
  }), [results]);
  const displayed = useMemo(() => results.filter(row => {
    if (view === 'all') return true;
    if (view === 'continue') return row.decision === 'Continue';
    if (view === 'watch') return row.decision === 'Watch';
    if (view === 'reject') return row.decision === 'Reject';
    if (view === 'needData') return row.decision === 'NeedMoreData';
    return row.aiChallengedFine || row.aiTraderDecisionFine === 'Watch' || row.aiTraderDecisionFine === 'Reject';
  }), [results, view]);

  const aiReviewed = results.filter(row => row.aiUsed).length;
  const aiChallenged = results.filter(row => row.aiChallengedFine).length;
  const setupQualified = results.filter(row => Number(row.setupQualityScore || 0) >= 70).length;
  const entryReady = results.filter(row => ['Ready', 'BreakoutConfirm'].includes(row.entryReadiness)).length;
  const executionFeasible = results.filter(row => Number(row.executionReadinessScore || 0) >= 62 && row.riskGateStatus !== 'BLOCK').length;
  const evidenceComplete = results.filter(row => Number(row.fineScoreReliability || 0) >= 80 && !(row.requiredEvidenceMissing || []).length).length;

  const columns: any[] = [
    {
      title: dual(isZh, 'Candidate', '候选标的'), key: 'candidate', width: 190, fixed: 'left',
      render: (_: any, record: any) => (
        <div className="fine-v4-candidate">
          <div><b>{record.symbol}</b><span>{record.exchangeName || record.exchange || dual(isZh, 'US equity', '美股')}</span></div>
          <strong>{record.companyName || record.name || dual(isZh, 'Company name unavailable', '暂无公司名称')}</strong>
          <small>{price(record.price ?? record.lastPrice)} · {pct(record.changePercent, true)}</small>
        </div>
      ),
    },
    {
      title: dual(isZh, 'Desk decision', '研究台决策'), key: 'decision', width: 185,
      sorter: (a: any, b: any) => safeScore(a.fineScanScore) - safeScore(b.fineScanScore),
      render: (_: any, record: any) => {
        const meta = decisionMeta[record.decision] || decisionMeta.Watch;
        const score = safeScore(record.fineScanScore);
        return (
          <div className="fine-v4-decision">
            <div><DecisionTag decision={record.decision} isZh={isZh} /><b style={{ color: meta.color }}>{Math.round(score)}</b></div>
            <Progress percent={score} showInfo={false} size={['100%', 5]} strokeColor={meta.color} />
            <small>{dual(isZh, 'Reliability', '可靠性')} {record.fineScoreReliability != null ? Math.round(Number(record.fineScoreReliability)) + '%' : 'N/A'} · {record.deterministicDecision || record.decision}</small>
          </div>
        );
      },
    },
    {
      title: dual(isZh, 'Setup / entry', '形态 / 入场'), key: 'setup', width: 250,
      render: (_: any, record: any) => {
        const plan = record.entryPlanFine || {};
        return (
          <div className="fine-v4-setup">
            <b>{record.setup || dual(isZh, 'Quality Watch', '质量观察')}</b>
            <span>{(record.strategyStack || []).join(' / ') || dual(isZh, 'strategy routing pending', '等待策略路由')}</span>
            <small>{record.entryReadiness || plan.readiness || dual(isZh, 'Review', '复核')} · {zone(plan)}</small>
            <small>{dual(isZh, 'R/R', '盈亏比')} {plan.rewardRiskRatio != null ? Number(plan.rewardRiskRatio).toFixed(2) + 'x' : 'N/A'} · {dual(isZh, 'distance', '距离')} {plan.entryDistancePct != null ? pct(plan.entryDistancePct) : 'N/A'}</small>
          </div>
        );
      },
    },
    {
      title: dual(isZh, 'Execution', '执行'), key: 'execution', width: 205,
      render: (_: any, record: any) => {
        const micro = record.microstructureDetails || {};
        return (
          <div className="fine-v4-execution">
            <div><span>{dual(isZh, 'Score', '评分')}</span><b>{record.executionReadinessScore != null ? Math.round(Number(record.executionReadinessScore)) : 'N/A'}</b></div>
            <div><span>ADV20</span><b>{money(record.avgDollarVolume20)}</b></div>
            <div><span>{dual(isZh, 'Spread', '点差')}</span><b>{bps(micro.spreadBps ?? record.spreadBps)}</b></div>
            <div><span>{dual(isZh, 'Cost', '成本')}</span><b>{bps(record.estimatedRoundTripCostBps)}</b></div>
          </div>
        );
      },
    },
    {
      title: dual(isZh, 'Risk gate', '风险闸门'), key: 'risk', width: 175,
      render: (_: any, record: any) => {
        const blockers = record.decisionBlockers || [];
        const warnings = record.decisionWarnings || [];
        const missing = record.requiredEvidenceMissing || [];
        return (
          <div className="fine-v4-risk">
            <GateTag gate={record.riskGateStatus} isZh={isZh} />
            <b>{blockers.length} {dual(isZh, 'block', '项阻断')} · {warnings.length} {dual(isZh, 'review', '项复核')}</b>
            <span>{record.eventRisk || dual(isZh, 'Low', '低')} {dual(isZh, 'event risk', '事件风险')}</span>
            <small>{missing.length ? missing.length + dual(isZh, ' required data gaps', ' 项必需数据缺口') : dual(isZh, 'Required evidence complete', '必需证据完整')}</small>
          </div>
        );
      },
    },
    {
      title: dual(isZh, 'AI challenge', 'AI 质疑'), key: 'ai', width: 250,
      render: (_: any, record: any) => (
        <div className="fine-v4-ai">
          {record.aiUsed ? (
            <>
              <div><DecisionTag decision={record.aiTraderDecisionFine} isZh={isZh} /><span>{record.aiTraderConfidenceFine != null ? Math.round(Number(record.aiTraderConfidenceFine)) + '%' : 'N/A'}</span></div>
              <Tooltip title={record.aiTraderRationaleFine}><b>{record.aiTraderRationaleFine || dual(isZh, 'AI review complete', 'AI 审核完成')}</b></Tooltip>
              <small>{record.aiNextStepFine || record.nextStep || dual(isZh, 'No additional challenge', '没有额外质疑')}</small>
            </>
          ) : (
            <><Tag>{dual(isZh, 'RULES', '规则')}</Tag><b>{dual(isZh, 'AI review unavailable', 'AI 审核不可用')}</b><small>{dual(isZh, 'Deterministic decision remains active', '确定性决策仍然有效')}</small></>
          )}
        </div>
      ),
    },
  ];

  const steps = [
    [dual(isZh, 'Intake', '候选接收'), 8], [dual(isZh, 'Snapshot', '市场快照'), 24], [dual(isZh, 'Setup & entry', '形态与入场'), 48], [dual(isZh, 'Execution gates', '执行闸门'), 68], [dual(isZh, 'AI challenge', 'AI 质疑'), 82], [dual(isZh, 'Finalize', '完成'), 96],
  ];

  return (
    <div className="fine-scan-workbench-v4">
      {status === 'running' && (
        <div className="fine-v4-progress">
          <div className="fine-v4-progress-head">
            <div><span>{dual(isZh, 'Current operation', '当前操作')}</span><b>{currentStep || dual(isZh, 'Fine Scan', '精细扫描')}</b><small>{message}</small></div>
            <strong>{Math.round(progress)}%</strong>
          </div>
          <Progress percent={progress} showInfo={false} size={['100%', 7]} />
          <div className="fine-v4-progress-steps">
            {steps.map(([label, threshold], index) => (
              <span className={progress >= Number(threshold) ? 'active' : ''} key={String(label)}><i>{index + 1}</i>{label}</span>
            ))}
          </div>
        </div>
      )}

      {results.length > 0 ? (
        <>
          <div className="fine-v4-summary">
            <div><span>{dual(isZh, 'Candidate input', '输入候选')}</span><b>{results.length.toLocaleString()}</b><small>{dual(isZh, 'Market Scanner shortlist', '市场扫描器候选清单')}</small></div>
            <div><span>{dual(isZh, 'Setup qualified', '形态合格')}</span><b>{setupQualified.toLocaleString()}</b><small>{dual(isZh, 'setup score at least 70', '形态评分不低于 70')}</small></div>
            <div><span>{dual(isZh, 'Entry ready', '入场就绪')}</span><b>{entryReady.toLocaleString()}</b><small>{dual(isZh, 'ready or breakout confirm', '就绪或等待突破确认')}</small></div>
            <div><span>{dual(isZh, 'Execution feasible', '可执行')}</span><b>{executionFeasible.toLocaleString()}</b><small>{dual(isZh, 'score and hard-gate check', '评分与硬性闸门检查')}</small></div>
            <div><span>{dual(isZh, 'Evidence complete', '证据完整')}</span><b>{evidenceComplete.toLocaleString()}</b><small>{dual(isZh, 'required coverage and reliability', '必需覆盖率与可靠性')}</small></div>
            <div><span>{dual(isZh, 'AI reviewed', 'AI 已审核')}</span><b>{aiReviewed.toLocaleString()}/{results.length.toLocaleString()}</b><small>{aiChallenged.toLocaleString()} {dual(isZh, 'challenged', '个被质疑')}</small></div>
          </div>

          <div className="fine-v4-board-head">
            <div><h3>{dual(isZh, 'Setup & execution board', '形态与执行看板')}</h3><p>{dual(isZh, 'Continue', '继续')} {counts.Continue} · {dual(isZh, 'Watch', '观察')} {counts.Watch} · {dual(isZh, 'Reject', '拒绝')} {counts.Reject} · {dual(isZh, 'Need data', '缺少数据')} {counts.NeedMoreData}</p></div>
            <div className="fine-v4-tabs">
              {[
                ['all', dual(isZh, 'All', '全部')], ['continue', dual(isZh, 'Continue', '继续')], ['watch', dual(isZh, 'Watch', '观察')], ['reject', dual(isZh, 'Reject', '拒绝')], ['needData', dual(isZh, 'Need data', '缺少数据')], ['aiChallenge', dual(isZh, 'AI challenge', 'AI 质疑')],
              ].map(([value, label]) => <button type="button" className={view === value ? 'active' : ''} onClick={() => setView(value as FineView)} key={value}>{label}</button>)}
            </div>
          </div>

          <Table
            className="fine-v4-table"
            columns={columns}
            dataSource={displayed}
            rowKey="symbol"
            size="middle"
            scroll={{ x: 1260 }}
            pagination={{ pageSize: 10, showSizeChanger: false, showTotal: total => total.toLocaleString() + dual(isZh, ' candidates', ' 个候选') }}
            onRow={(record: any) => ({ onClick: () => onToggleRow(record.symbol) })}
            expandable={{
              expandedRowRender: (record: any) => <FineScanDetail record={record} isZh={isZh} />,
              expandedRowKeys: expandedRows,
              showExpandColumn: true,
              expandRowByClick: false,
              expandIcon: ({ expanded, onExpand, record }: any) => (
                <Button
                  type="text"
                  size="small"
                  aria-label={expanded ? dual(isZh, 'Collapse Fine Scan detail', '收起精细扫描详情') : dual(isZh, 'Expand Fine Scan detail', '展开精细扫描详情')}
                  icon={expanded ? <ArrowDownOutlined /> : <ArrowRightOutlined />}
                  onClick={event => { event.stopPropagation(); onExpand(record, event); }}
                />
              ),
            }}
          />
        </>
      ) : status === 'running' ? null : (
        <div className="fine-v4-empty"><SafetyCertificateOutlined /><b>{dual(isZh, 'No Fine Scan results yet', '暂无精细扫描结果')}</b><span>{dual(isZh, 'Run Market Scanner first, then validate the top setup and execution candidates.', '请先运行市场扫描器，再验证优先级最高的形态与执行候选。')}</span></div>
      )}
    </div>
  );
}
