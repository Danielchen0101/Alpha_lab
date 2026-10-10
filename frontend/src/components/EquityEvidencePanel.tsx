import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Select, Space, Tag } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { equityEvidenceAPI, EquityProgramStatus, EquityAccountEvidence, evidenceNumber, unwrapAccountEvidence } from '../services/equityEvidenceService';
import './EquityEvidencePanel.css';

type Props = { language: string; mode: 'paper' | 'real'; scopeKey?: string; refreshKey?: number; onActivated?: () => void; onActiveChange?: (active: boolean, status: EquityProgramStatus) => void };

const STATUS_LABELS: Record<string, [string, string]> = {
  completed: ['Cycle completed', '本轮完成'], no_signal: ['No eligible signal', '暂无合格信号'],
  capital_blocked: ['Capital constraint', '资金约束'], data_insufficient: ['Data incomplete', '数据不足'],
  ai_degraded: ['AI unavailable', 'AI 不可用'], research_blocked: ['Research not admitted', '研究尚未通过'],
  risk_paused: ['Risk pause', '风控暂停'], market_closed: ['Market closed', '市场休市'],
  stopped: ['Stopped', '已停止'], failed: ['Failed', '执行失败'],
  running: ['Research running', '研究运行中'], queued: ['Research queued', '研究已排队'],
  frozen: ['Protocol frozen', '协议已冻结'], not_frozen: ['Protocol not frozen', '协议尚未冻结'],
  collecting: ['Collecting historical data', '正在采集历史数据'], insufficient: ['Research evidence insufficient', '研究证据不足'],
  complete: ['Historical research complete', '历史研究已完成'],
  data_ready_requires_offline_replay: ['Data archived; replay pending', '数据已归档，等待回放'],
};

export const equityBusinessLabel = (status: string | undefined, zh: boolean) => (
  STATUS_LABELS[status || '']?.[zh ? 1 : 0] || (zh ? '状态未知' : 'Status unknown')
);

const BLOCKERS: Record<string, [string, string]> = {
  protocol_not_frozen: ['Freeze a research protocol first.', '先冻结研究协议。'],
  trusted_research_artifact_missing: ['A verified research result is not available yet.', '尚无经过核实的研究结果。'],
  research_artifact_integrity_failed: ['The research result failed its integrity check.', '研究结果完整性校验未通过。'],
  frozen_protocol_integrity_failed: ['The frozen protocol failed its integrity check.', '冻结协议完整性校验未通过。'],
  insufficient_evidence: ['More evidence is required.', '证据尚不足。'],
  activity_history_incomplete: ['Broker activity history is incomplete.', '券商流水尚未完整核对。'],
  equity_evidence_missing: ['No reconciled account evidence.', '账户账本尚未核对。'],
  daily_pnl_unknown: ['Daily P/L baseline is unavailable.', '当日盈亏基准尚不完整。'],
  drawdown_latched: ['Drawdown pause remains active.', '回撤暂停仍然生效。'],
  daily_loss_limit: ['Daily loss limit reached.', '已达到当日亏损上限。'],
  cost_evidence_incomplete: ['Execution cost evidence is incomplete.', '执行成本证据尚不完整。'],
  cashflow_timing_unknown: ['Transfer timing is not verified.', '入出金生效时点尚未核实。'],
  cashflow_valuation_missing: ['Equity at the transfer is unavailable.', '缺少入出金时点的净值。'],
  return_baseline_missing: ['Return baseline is unavailable.', '收益率基准尚未建立。'],
};

const CHECKS: Record<string, [string, string]> = {
  allRegisteredTrialsReported: ['All registered candidates reported', '全部预注册候选均已报告'],
  threeNonoverlappingOosFolds: ['Three separate out-of-sample windows', '至少三个互不重叠的样本外窗口'],
  twentyFourMonthsOos: ['24 months of out-of-sample data', '24 个月样本外数据'],
  completeVerifiedData: ['Verified data coverage', '数据覆盖已核实'],
  oneHundredClosedTrades: ['At least 100 closed research trades', '研究至少 100 次完整交易'],
  profitFactorAtLeast1_2: ['Profit factor at least 1.2', '盈利金额 / 亏损金额至少 1.2'],
  positiveAfterOperatingCosts: ['Positive after operating costs', '扣除经营成本后为正'],
  maxDrawdownAtMost12Pct: ['Drawdown at most 12%', '最大回撤不超过 12%'],
  doubleCostStressPositive: ['Positive with doubled costs', '成本翻倍后仍为正'],
  doubleCostStressProfitFactorAbove1: ['Profit factor above 1 with doubled costs', '成本翻倍后盈亏比大于 1'],
  familywiseBlockBootstrapLowerPositive: ['Adjusted confidence lower bound positive', '多重检验调整后的置信下界为正'],
  cashAndSpyBenchmarksVerified: ['Cash and SPY benchmarks verified', '现金与 SPY 基准已核实'],
  beatsCashAndRiskBudgetSpy: ['Exceeds cash and risk-budget SPY baseline', '超过现金和风险预算 SPY 基准'],
  sixtyForwardSessions: ['60 forward trading sessions', '60 个前向交易日'],
  thirtyForwardClosedTrades: ['30 completed forward trades', '30 次完整前向交易'],
  forwardNetPositive: ['Forward net profit positive', '前向净利润为正'],
  forwardCohortIdentityVerified: ['Forward observations match the frozen protocol', '前向记录与冻结协议一致'],
  forwardDatasetIntegrityVerified: ['Forward data integrity verified', '前向数据完整性已核实'],
  forwardDataComplete: ['Forward data coverage complete', '前向数据覆盖完整'],
  forwardRiskLimitsRespected: ['Forward risk limits respected', '前向交易遵守风险上限'],
};

const blockerLabel = (code: string, zh: boolean) => BLOCKERS[code]?.[zh ? 1 : 0]
  || (CHECKS[code] ? `${zh ? '未通过' : 'Not passed'}: ${CHECKS[code][zh ? 1 : 0]}` : code);
export const evidenceMoney = (value: unknown) => {
  const amount = evidenceNumber(value);
  return amount === null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};
const pct = (value: unknown) => {
  const n = evidenceNumber(value);
  return n === null ? '—' : `${n.toFixed(2)}%`;
};
export const evidenceDate = (value: string | null | undefined, zh: boolean) => value && !Number.isNaN(Date.parse(value))
  ? new Date(value).toLocaleString(zh ? 'zh-CN' : 'en-US', { timeZone: 'America/New_York' }) + ' ET' : '—';

export const EquityAccountMetrics: React.FC<{ evidence?: EquityAccountEvidence | null; language: string }> = ({ evidence, language }) => {
  const zh = language === 'zh-CN';
  const risk = evidence?.risk;
  return <div className="equity-evidence__account">
    <div className="equity-evidence__metrics">
      <div><span>{zh ? '入出金调整后累计盈亏' : 'Account P/L after cash flows'}</span><strong>{evidenceMoney(evidence?.accounting?.account_net_operating_pnl)}</strong></div>
      <div><span>{zh ? '净经营利润' : 'Net operating profit'}</span><strong>{evidenceMoney(evidence?.accounting?.net_operating_profit)}</strong></div>
      <div><span>{zh ? '当日调整后盈亏' : 'Adjusted daily P/L'}</span><strong>{evidenceMoney(risk?.daily_pnl)}</strong></div>
      <div><span>{zh ? '资金调整后回撤' : 'Cash-flow-adjusted drawdown'}</span><strong>{pct(risk?.drawdown_pct)}</strong></div>
    </div>
    <p>{zh ? '“—”表示尚未核实。费用或策略归因不完整时，不能将账户净值变化认定为策略净利润。' : '“—” means unverified. Equity changes do not establish strategy net profit when costs or attribution are incomplete.'}</p>
    <p>{zh ? '账本完整性' : 'Ledger completeness'}: {risk?.complete === true ? (zh ? '已核对' : 'Reconciled') : (zh ? '不完整 / 未知' : 'Incomplete / unknown')}
      {' · '}{zh ? '最近核对尝试' : 'Last reconciliation attempt'}: {evidenceDate(risk?.as_of, zh)}</p>
    <p>{zh ? '累计盈亏数据截至' : 'Account P/L evidence through'}: {evidenceDate(evidence?.accountingAsOf, zh)}</p>
    <p>{zh ? '收益率与回撤观测区间（非账户全部历史）' : 'Return and drawdown observation period (not full account history)'}: {evidenceDate(evidence?.performanceSince, zh)} → {evidenceDate(evidence?.performanceThrough, zh)}</p>
    <p>{zh ? '观测期资金调整后收益率 / 最大回撤' : 'Observed cash-flow-adjusted return / maximum drawdown'}: {pct(evidence?.twr_pct)} / {pct(evidence?.max_drawdown_pct)}</p>
    {risk?.drawdown_latched === true && <Alert type="error" showIcon message={zh ? '12% 回撤暂停已锁定；入金或重启不会解除。' : 'The 12% drawdown pause is latched; deposits and restarts do not clear it.'} />}
    {!!risk?.reasons?.length && <ul>{risk.reasons.map((reason, i) => <li key={`${reason}-${i}`}>{blockerLabel(reason, zh)}</li>)}</ul>}
  </div>;
};

const EquityEvidencePanel: React.FC<Props> = ({ language, mode, scopeKey, refreshKey, onActivated, onActiveChange }) => {
  const zh = language === 'zh-CN';
  const [status, setStatus] = useState<EquityProgramStatus | null>(null);
  const [account, setAccount] = useState<EquityAccountEvidence | null>(null);
  const [strategy, setStrategy] = useState<'breakout20' | 'pullback20'>('breakout20');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [queuePending, setQueuePending] = useState(false);
  const queuedAt = useRef(0);
  const generation = useRef(0);
  const mounted = useRef(true);
  const lastActive = useRef<boolean | undefined>();
  const activeCallback = useRef(onActiveChange);
  activeCallback.current = onActiveChange;
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    try {
      const response = await equityEvidenceAPI.status();
      if (!mounted.current || request !== generation.current) return;
      if (response.data?.success === false) throw new Error('status_unavailable');
      setStatus(response.data);
      const researchState = response.data.research?.status;
      const queueExpired = Boolean(queuedAt.current && Date.now() - queuedAt.current > 120000);
      if (researchState && researchState !== 'frozen' && researchState !== 'not_frozen') { setQueuePending(false); queuedAt.current = 0; }
      else if (queueExpired) { setQueuePending(false); queuedAt.current = 0; }
      const selected = response.data.protocol?.strategy;
      if (selected === 'breakout20' || selected === 'pullback20') setStrategy(selected);
      if (typeof response.data.active === 'boolean') { lastActive.current = response.data.active; activeCallback.current?.(response.data.active, response.data); }
      setError(queueExpired && (!researchState || ['frozen', 'not_frozen'].includes(researchState)) ? 'research' : '');
    } catch {
      if (mounted.current && request === generation.current) {
        setStatus(null);
        if (lastActive.current !== undefined) activeCallback.current?.(lastActive.current, { active: lastActive.current });
        setError('refresh');
      }
    } finally {
      if (mounted.current && request === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    setStatus(null); setAccount(null); setError(''); setBusy(''); setQueuePending(false); queuedAt.current = 0; lastActive.current = undefined;
    void load();
    return () => { mounted.current = false; generation.current += 1; };
  }, [load, scopeKey, mode]);
  useEffect(() => { if (refreshKey) void load(); }, [load, refreshKey]);
  const research = status?.research || {};
  const researchRunning = queuePending || ['running', 'queued'].includes(research.status || '');
  const canRunResearch = !research.status || ['frozen', 'collecting'].includes(research.status);
  useEffect(() => {
    if ((!researchRunning && !status?.active) || busy) return undefined;
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 15000);
    return () => window.clearInterval(timer);
  }, [load, researchRunning, status?.active, busy]);
  const protocolKey = status?.protocolKey || status?.protocol?.protocolKey || status?.protocol?.key || research.protocolKey;
  const eligible = status?.researchAdmission?.eligible === true;
  const historicalEligible = status?.researchAdmission?.historicalEligible === true;
  const forward = status?.forward;
  const policy = status?.policy;
  const checks = status?.researchAdmission?.checks || research.checks;
  const shadow = status?.shadow || {};
  const qualification = status?.qualification || research.qualification?.qualification;
  const qualifyingMetrics = research.qualification?.metrics;

  const run = async (action: 'freeze' | 'research' | 'activate' | 'account') => {
    const request = generation.current;
    setBusy(action); setError('');
    try {
      const response = action === 'freeze' ? await equityEvidenceAPI.protocol(strategy)
        : action === 'research' ? await equityEvidenceAPI.runResearch(protocolKey)
          : action === 'activate' ? await equityEvidenceAPI.activate(protocolKey)
            : await equityEvidenceAPI.accountEvidence(mode);
      if (!mounted.current || request !== generation.current) return;
      if (response.data?.success === false) throw new Error('action_failed');
      if (action === 'research' && response.data?.status === 'queued') { queuedAt.current = Date.now(); setQueuePending(true); }
      if (action === 'account') setAccount(unwrapAccountEvidence(response.data));
      else {
        await load();
        if (action === 'activate') onActivated?.();
      }
    } catch {
      if (mounted.current && request === generation.current) setError(action);
    } finally {
      if (mounted.current) setBusy('');
    }
  };

  return <Card className="equity-evidence" title={zh ? '股票 v1 · 盈利验证' : 'Stock v1 · Profitability evidence'}
    extra={<Button size="small" icon={<ReloadOutlined />} onClick={() => void load()} loading={loading} disabled={!!busy}>{zh ? '刷新' : 'Refresh'}</Button>}>
    <div className="equity-evidence__heading">
      <div><strong>$2,000</strong><span>{zh ? '独立影子本金' : 'Separate shadow capital'}</span></div>
      <Space wrap><Tag>{zh ? 'v1：冻结的 8 只 ETF' : 'v1: Eight frozen ETFs'}</Tag><Tag>{zh ? '仅做多 · 不加杠杆' : 'Long only · Unleveraged'}</Tag>
        <Tag color={status?.businessStatus === 'risk_paused' || status?.businessStatus === 'failed' ? 'error' : 'default'}>{equityBusinessLabel(status?.businessStatus, zh)}</Tag>
        <Tag color={status?.brokerOrdersAllowed === true ? 'warning' : 'blue'}>{status?.brokerOrdersAllowed === true
          ? (zh ? '券商订单权限开启' : 'Broker order authority enabled')
          : status?.brokerOrdersAllowed === false ? (zh ? '券商订单关闭' : 'Broker orders disabled')
            : (zh ? '券商订单权限未知' : 'Broker order authority unknown')}</Tag>
        <Tag>{status?.executionMode === 'shadow' ? (zh ? '影子模式' : 'Shadow mode') : status?.executionMode || (zh ? '执行模式未知' : 'Execution mode unknown')}</Tag></Space>
    </div>
    <p>{zh ? '冻结规则后开展样本外研究和探索性影子记录。研究与至少 60 个交易日、30 次完整影子交易的检验均须通过。影子本金独立于现有券商模拟账户余额。' : 'Freeze the rules, then run out-of-sample research and exploratory shadow recording. Research and at least 60 trading sessions with 30 completed shadow trades must pass the checks. Shadow capital is separate from the broker paper balance.'}</p>
    {error && <Alert type="warning" showIcon message={zh ? '证据读取或操作失败。尚未确认成功，请刷新后核对。' : 'The evidence request or action failed. Success is unconfirmed; refresh to verify.'} />}
    <div className="equity-evidence__metrics">
      <div><span>{zh ? '单笔止损风险 / 交易现金' : 'Stop risk / trade cash'}</span><strong>{pct(policy?.riskPerTradePct ?? 0.5)} / {pct(policy?.maxSinglePositionPct ?? 20)}</strong><small>{zh ? '$2,000 下约 $10 风险 / $400 现金上限' : 'At $2,000: about $10 risk / $400 cash cap'}</small></div>
      <div><span>{zh ? '总敞口 / 总止损风险' : 'Gross exposure / total stop risk'}</span><strong>{pct(policy?.maxGrossExposurePct ?? 80)} / {pct(policy?.maxOpenStopRiskPct ?? 2)}</strong></div>
      <div><span>{zh ? '日亏损暂停 / 回撤暂停' : 'Daily loss stop / drawdown pause'}</span><strong>{pct(policy?.dailyLossStopPct ?? 1.5)} / {pct(policy?.maxDrawdownPct ?? 12)}</strong></div>
      <div><span>{zh ? '合格前向交易日 / 完整交易' : 'Qualifying forward sessions / completed trades'}</span><strong>{evidenceNumber(forward?.tradingSessions) ?? '—'} / {forward?.requiredSessions ?? 60} · {evidenceNumber(forward?.completedTrades) ?? '—'} / {forward?.requiredTrades ?? 30}</strong></div>
    </div>
    <div className="equity-evidence__actions"><Space wrap>
      <Select aria-label={zh ? '固定研究策略' : 'Fixed research strategy'} value={strategy} disabled={!!protocolKey || !!busy || !status}
        onChange={setStrategy} options={[{ value: 'breakout20', label: zh ? '20 日突破' : '20-day breakout' }, { value: 'pullback20', label: zh ? '20 日趋势回撤' : '20-day trend pullback' }]} />
      <Button onClick={() => void run('freeze')} disabled={!status || !!protocolKey || !!busy} loading={busy === 'freeze'}>{protocolKey ? (zh ? '协议已冻结' : 'Protocol frozen') : (zh ? '冻结研究协议' : 'Freeze protocol')}</Button>
      <Button onClick={() => void run('research')} disabled={!protocolKey || !!busy || researchRunning || !canRunResearch} loading={busy === 'research' || researchRunning}>{research.status === 'collecting' ? (zh ? '继续采集研究数据' : 'Resume research collection') : (zh ? '运行样本外研究' : 'Run out-of-sample research')}</Button>
      <Button type="primary" onClick={() => void run('activate')} disabled={!protocolKey || !!busy || status?.active === true} loading={busy === 'activate'}>{status?.active ? (status.executionMode === 'shadow' ? (zh ? '影子验证已启用' : 'Shadow validation active') : (zh ? '固定 v1 已启用' : 'Fixed v1 program active')) : (zh ? '启动 $2,000 影子验证' : 'Start $2,000 shadow validation')}</Button>
    </Space></div>
    {research.status === 'collecting' && <Alert type="info" showIcon message={zh ? '数据采集已保存进度，可继续下一批。样本外评估尚未开始。' : 'Data collection progress is saved. Resume the next batch; out-of-sample evaluation has not started.'} />}
    {research.status === 'data_ready_requires_offline_replay' && <Alert type="info" showIcon message={zh ? '历史数据已归档，等待专用研究任务完成完整回放。当前没有通过结论，也不会重新选择参数。' : 'Historical data is archived and awaits a dedicated research worker for full replay. No passing result is established; parameters remain frozen.'} />}
    <div className="equity-evidence__details">
      <div><b>{zh ? '研究准入' : 'Research admission'}</b><p>{eligible ? (zh ? '研究与前向验证检查通过；实盘启用仍需独立决策。' : 'Research and forward checks passed; live activation remains a separate decision.') : historicalEligible ? (zh ? '历史研究通过，前向验证仍未完成。' : 'Historical research passed; forward validation remains incomplete.') : (zh ? '研究尚未通过。可启动探索性影子记录，不能据此晋升实盘。' : 'Research has not passed. Exploratory shadow recording is available; it does not qualify for live promotion.')}</p>
        {eligible && <p>{zh ? '如决定启用实盘，先选择实盘环境，再到运行管理中明确确认下单授权。' : 'To enable live trading, select the live environment, then explicitly confirm order authority in automation controls.'} <a href="#research-automation">{zh ? '查看运行管理' : 'View automation controls'}</a></p>}
        <p>{zh ? '研究任务' : 'Research job'}: {equityBusinessLabel(queuePending ? 'queued' : research.status, zh)}
          {research.run && <><br />{zh ? '本批采集页数 / 已读取缓存页数' : 'Pages fetched this batch / cached pages read'}: {evidenceNumber(research.run.pagesFetchedThisRun) ?? '—'} / {evidenceNumber(research.run.cachedPagesRead) ?? '—'}
            {evidenceNumber(research.run.quoteRowCount) !== null && <><br />{zh ? '已归档报价数' : 'Archived quotes'}: {evidenceNumber(research.run.quoteRowCount)?.toLocaleString()}</>}</>}
        </p>
        <p>{zh ? '样本外完整交易 / 盈亏比 PF' : 'Out-of-sample closed trades / profit factor'}: {evidenceNumber(status?.researchAdmission?.closedTrades) ?? '—'} / {evidenceNumber(status?.researchAdmission?.profitFactor)?.toFixed(2) ?? '—'}</p>
        {checks && <ul>{Object.entries(checks).map(([name, result]) => {
          const detail = result as { passed?: boolean; eligible?: boolean } | null;
          const passed = typeof result === 'boolean' ? result : detail?.passed ?? detail?.eligible;
          return <li key={name}>{CHECKS[name]?.[zh ? 1 : 0] || name}: {passed === true ? (zh ? '通过' : 'Passed') : passed === false ? (zh ? '未通过' : 'Not passed') : '—'}</li>;
        })}</ul>}
        {!!status?.blockers?.length && <ul>{status.blockers.map((reason, i) => <li key={`${reason}-${i}`}>{blockerLabel(reason, zh)}</li>)}</ul>}
      </div>
      <div><b>{zh ? '前向结果与来源' : 'Forward results & provenance'}</b>
        <p>{zh ? '合格前向盈亏（扣除模型成本）' : 'Qualifying forward P/L after modelled costs'}: {evidenceMoney(qualifyingMetrics?.netPnl)}<br />{zh ? '合格记录开始' : 'Qualifying record started'}: {evidenceDate(qualification?.startedAt, zh)}</p>
        <p>{zh ? '探索性影子盈亏（扣除模型成本）' : 'Exploratory shadow P/L after modelled costs'}: {evidenceMoney(shadow.metrics?.netPnl)}<br />{zh ? '探索性交易日 / 完整交易' : 'Exploratory sessions / completed trades'}: {evidenceNumber(shadow.forward?.tradingSessions) ?? '—'} / {evidenceNumber(shadow.forward?.completedTrades) ?? '—'}</p>
        <p>{zh ? '探索性记录不计入 60 日 / 30 次准入门槛；历史研究通过后才开始独立的合格前向账本。' : 'Exploratory records do not count toward the 60-session / 30-trade admission threshold. A separate qualifying ledger starts only after historical research passes.'}</p>
        <p>{zh ? '策略版本' : 'Strategy version'}: {status?.strategyVersion || '—'}<br />{zh ? '数据版本' : 'Data version'}: {status?.dataVersion || '—'}</p>
        <p>{zh ? '冻结资产池' : 'Frozen universe'}: {Array.isArray(status?.protocol?.symbols) ? status?.protocol?.symbols.join(', ') : '—'}</p>
        <p>{zh ? '历史研究：延迟 SIP；影子执行报价：IEX，非全市场 NBBO。整股交易，最多 4 个持仓、20 个交易日。' : 'Historical research: delayed SIP. Shadow execution quotes: IEX, not consolidated NBBO. Whole shares, up to 4 positions and 20 trading sessions.'}</p>
      </div>
    </div>
    <details className="equity-evidence__ledger"><summary>{zh ? '当前券商账户账本（与影子账本分开）' : 'Current broker account ledger (separate from shadow)'}</summary>
      <Button size="small" onClick={() => void run('account')} disabled={!!busy} loading={busy === 'account'}>{zh ? `核对${mode === 'real' ? '实盘' : '模拟'}账本` : `Reconcile ${mode === 'real' ? 'live' : 'paper'} ledger`}</Button>
      <EquityAccountMetrics evidence={account || status?.accountEvidence} language={language} />
    </details>
  </Card>;
};

export default EquityEvidencePanel;
