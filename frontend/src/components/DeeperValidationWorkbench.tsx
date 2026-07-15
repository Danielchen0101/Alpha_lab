import React, { useMemo, useState } from 'react';
import { Progress, Table, Tag } from 'antd';
import { ArrowRightOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';

type DvView = 'all' | 'pass' | 'watch' | 'reject' | 'needData' | 'aiChallenge';

interface DeeperValidationWorkbenchProps {
  results: any[];
  status: string;
  progress: number;
  currentStep: string;
  message?: string;
  errors?: any[];
  expandedRows: string[];
  onToggleRow: (symbol: string) => void;
}

const stageLabels = {
  en: ['Intake', '2Y data', 'Strategy routes', 'Parameter robustness', 'Walk-forward', 'Cost & risk', 'AI challenge', 'Finalize'],
  zh: ['候选接收', '两年数据', '策略路由', '参数稳健性', '滚动验证', '成本与风险', 'AI 质疑', '完成'],
};

const dual = (isZh: boolean, en: string, zh: string): string => isZh ? zh : en;

function number(value: any): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function score(value: any): number {
  const parsed = number(value);
  return parsed == null ? 0 : Math.max(0, Math.min(100, parsed));
}

function pct(value: any, signed = false): string {
  const parsed = number(value);
  if (parsed == null) return 'N/A';
  return (signed && parsed >= 0 ? '+' : '') + parsed.toFixed(1) + '%';
}

function ratio(value: any, digits = 2): string {
  const parsed = number(value);
  return parsed == null ? 'N/A' : parsed.toFixed(digits);
}

function money(value: any): string {
  const parsed = number(value);
  if (parsed == null || parsed <= 0) return 'N/A';
  if (parsed >= 1_000_000_000) return '$' + (parsed / 1_000_000_000).toFixed(1) + 'B';
  if (parsed >= 1_000_000) return '$' + (parsed / 1_000_000).toFixed(1) + 'M';
  if (parsed >= 1_000) return '$' + (parsed / 1_000).toFixed(1) + 'K';
  return '$' + parsed.toFixed(0);
}

function decisionOf(record: any): string {
  if (record.dvDecision) return record.dvDecision;
  if (record.verdict === 'Confirmed') return 'PASS_DV';
  if (record.verdict === 'Watch') return 'WATCH';
  return 'REJECT';
}

function normalizedVerdict(value: any): string {
  const text = String(value || '').trim().toLowerCase().replace(/_/g, ' ');
  if (['confirmed', 'confirm', 'pass', 'pass dv', 'advance'].includes(text)) return 'confirmed';
  if (['reject', 'rejected', 'avoid', 'skip'].includes(text)) return 'reject';
  if (['watch', 'review', 'needs manual review'].includes(text)) return 'watch';
  return text;
}

function aiChallenged(record: any): boolean {
  return !!record.aiValidationUsed &&
    normalizedVerdict(record.aiValidationVerdict) !== normalizedVerdict(record.localVerdictBeforeAI);
}

function DecisionTag({ record, isZh }: { record: any; isZh: boolean }) {
  const decision = decisionOf(record);
  const color = decision === 'PASS_DV' ? 'success' : decision === 'WATCH' ? 'warning' : decision === 'NEED_DATA' ? 'orange' : 'error';
  const label = isZh
    ? ({ PASS_DV: '验证通过', WATCH: '观察', NEED_DATA: '缺少数据', REJECT: '拒绝' } as Record<string, string>)[decision] || decision.replace('_', ' ')
    : decision === 'PASS_DV' ? 'PASS DV' : decision.replace('_', ' ');
  return <Tag color={color}>{label}</Tag>;
}

function GateTag({ record, isZh }: { record: any; isZh: boolean }) {
  const gate = record.institutionalGate || record.riskGate || {};
  const value = gate.status || 'REVIEW';
  const label = isZh
    ? `风控闸门 ${{ PASS: '通过', BLOCK: '阻断', REVIEW: '复核' }[value as 'PASS' | 'BLOCK' | 'REVIEW'] || value}`
    : 'GATE ' + value;
  return <Tag color={value === 'PASS' ? 'success' : value === 'BLOCK' ? 'error' : 'warning'}>{label}</Tag>;
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="dv-v5-metric"><span>{label}</span><b>{value}</b></div>;
}

function Factor({ label, value }: { label: string; value: any }) {
  const parsed = score(value);
  const color = parsed >= 70 ? '#16a34a' : parsed >= 48 ? '#d97706' : '#dc2626';
  return (
    <div className="dv-v5-factor">
      <div><span>{label}</span><b>{Math.round(parsed)}</b></div>
      <Progress percent={parsed} showInfo={false} size={['100%', 5]} strokeColor={color} />
    </div>
  );
}

function flagClass(kind: string): string {
  if (kind === 'block') return 'block';
  if (kind === 'warning') return 'warning';
  return 'pass';
}

function DeeperValidationDetail({ record, isZh }: { record: any; isZh: boolean }) {
  const sample = record.sampleQuality || {};
  const walk = record.walkForwardProxy || {};
  const testing = record.multipleTesting || {};
  const capacity = record.costCapacity || {};
  const gate = record.institutionalGate || record.riskGate || {};
  const folds = Array.isArray(walk.folds) ? walk.folds : [];
  const strategies = Array.isArray(record.perStrategyValidation) ? record.perStrategyValidation : [];
  const limitations = Array.isArray(record.researchLimitations) ? record.researchLimitations : [];
  const selectedParams = record.bestParams || record.parameters || {};

  return (
    <div className="dv-v5-detail">
      <div className="dv-v5-detail-head">
        <div>
          <div><strong>{record.symbol}</strong><b>{record.strategy || record.validationStrategy || dual(isZh, 'Strategy validation', '策略验证')}</b></div>
          <span>{record.dvVersion || 'DV'} · {record.strategyStackTested?.length || strategies.length || 1} {dual(isZh, 'strategies tested', '个策略已测试')} · {sample.bars || 'N/A'} {dual(isZh, 'daily bars', '根日线')}</span>
        </div>
        <div><DecisionTag record={record} isZh={isZh} /><GateTag record={record} isZh={isZh} /><Tag color={record.aiValidationUsed ? 'cyan' : 'default'}>{record.aiValidationUsed ? dual(isZh, 'AI REVIEWED', 'AI 已审核') : dual(isZh, 'RULES', '规则')}</Tag></div>
      </div>

      <div className="dv-v5-detail-grid">
        <section>
          <h4>{dual(isZh, 'Validation score', '验证评分')}</h4>
          <div className="dv-v5-score-hero">
            <b>{Math.round(score(record.validationScore))}</b><span>/100</span>
            <em>{dual(isZh, 'Reliability', '可靠性')} {record.evidenceReliability != null ? Math.round(Number(record.evidenceReliability)) + '%' : 'N/A'}</em>
          </div>
          <Factor label={dual(isZh, 'Edge', '策略优势')} value={record.edgeScore} />
          <Factor label={dual(isZh, 'Stability', '稳定性')} value={record.stabilityScore} />
          <Factor label={dual(isZh, 'Sample', '样本质量')} value={record.sampleScore} />
          <Factor label={dual(isZh, 'Walk-forward', '滚动验证')} value={record.oosScore} />
          <Factor label={dual(isZh, 'Execution', '执行')} value={record.executionScore} />
          <Factor label={dual(isZh, 'Risk', '风险')} value={record.riskScore} />
        </section>

        <section>
          <h4>{dual(isZh, 'Net historical edge', '历史净优势')}</h4>
          <div className="dv-v5-metric-grid">
            <Metric label={dual(isZh, 'Annualized net', '年化净收益')} value={pct(record.annualizedNetReturn, true)} />
            <Metric label={dual(isZh, 'SPY annualized', 'SPY 年化收益')} value={pct(record.benchmarkAnnualizedReturn, true)} />
            <Metric label={dual(isZh, 'SPY excess', '超额收益')} value={pct(record.excessReturn, true)} />
            <Metric label={dual(isZh, 'Gross total', '总收益')} value={pct(record.grossReturn ?? record.totalReturn, true)} />
            <Metric label={dual(isZh, 'Cost drag', '成本拖累')} value={pct(record.estimatedCostDragPct)} />
            <Metric label={dual(isZh, 'Sharpe', '夏普比率')} value={ratio(record.sharpeRatio)} />
            <Metric label={dual(isZh, 'Adjusted Sharpe proxy', '调整后夏普代理')} value={ratio(record.selectionAdjustedSharpeProxy)} />
            <Metric label={dual(isZh, 'Profit factor', '盈利因子')} value={ratio(record.profitFactor)} />
            <Metric label={dual(isZh, 'Max drawdown', '最大回撤')} value={pct(record.maxDrawdown)} />
            <Metric label={dual(isZh, 'Trades', '交易次数')} value={record.tradeCount ?? 'N/A'} />
            <Metric label={dual(isZh, 'Win rate', '胜率')} value={pct(record.winRate)} />
          </div>
          <div className="dv-v5-note">{dual(isZh, 'Returns are ranked after estimated round-trip cost. SPY comparison uses the same annualized validation window', '收益排名已计入预计双边成本；SPY 对照使用相同的年化验证窗口')}{record.benchmarkSource ? ' · ' + record.benchmarkSource : ''}.</div>
        </section>

        <section>
          <h4>{dual(isZh, 'Robustness & selection', '稳健性与选择偏差')}</h4>
          <div className="dv-v5-metric-grid">
            <Metric label={dual(isZh, 'Parameter stability', '参数稳定性')} value={Math.round(score(record.stabilityScore)) + '/100'} />
            <Metric label={dual(isZh, 'Overfit risk proxy', '过拟合风险代理')} value={Math.round(score(record.overfitRiskScore)) + '/100'} />
            <Metric label={dual(isZh, 'Valid parameters', '有效参数组')} value={(sample.validCombinations ?? record.validCombinationCount ?? 0) + '/' + (sample.testedCombinations ?? record.testedCombinationCount ?? 0)} />
            <Metric label={dual(isZh, 'Net profitable', '净盈利参数')} value={sample.profitableRatio != null ? Math.round(Number(sample.profitableRatio)) + '%' : 'N/A'} />
            <Metric label={dual(isZh, 'Median net', '净收益中位数')} value={pct(sample.medianReturn, true)} />
            <Metric label={dual(isZh, 'Return spread', '收益离散度')} value={pct(sample.returnSpread)} />
            <Metric label={dual(isZh, 'Selection trials', '选择试验数')} value={testing.totalSelectionTrials ?? record.totalSelectionTrials ?? 'N/A'} />
            <Metric label={dual(isZh, 'Score penalty', '评分惩罚')} value={record.selectionBiasPenalty != null ? '-' + Number(record.selectionBiasPenalty).toFixed(1) : 'N/A'} />
          </div>
          <div className="dv-v5-param-line"><span>{dual(isZh, 'Selected parameters', '已选参数')}</span><code>{JSON.stringify(selectedParams)}</code></div>
          <div className="dv-v5-note">{testing.boundary || dual(isZh, 'Transparent overfit-risk proxy; exact DSR / CSCV / PBO requires full return paths.', '当前使用透明的过拟合风险代理；精确计算 DSR / CSCV / PBO 需要完整收益路径。')}</div>
        </section>
      </div>

      <section className="dv-v5-folds">
        <div className="dv-v5-section-head">
          <div><h4>{dual(isZh, 'Anchored walk-forward', '锚定滚动验证')}</h4><span>{dual(isZh, 'Parameters are selected on prior data, then tested on the next unseen window.', '先用历史窗口选择参数，再在下一段未见数据上独立测试。')}</span></div>
          <div><b>{walk.foldCount || 0} {dual(isZh, 'folds', '折')}</b><span>{walk.positiveFoldRatio != null ? Math.round(Number(walk.positiveFoldRatio) * 100) + dual(isZh, '% positive', '% 为正') : 'N/A'}</span></div>
        </div>
        {folds.length ? (
          <div className="dv-v5-fold-grid">
            {folds.map((fold: any) => (
              <div key={fold.fold}>
                <header><b>{dual(isZh, 'Fold ', '第 ') + fold.fold + dual(isZh, '', ' 折')}</b><span>{fold.trainBars + dual(isZh, ' train / ', ' 训练 / ') + fold.testBars + dual(isZh, ' test', ' 测试')}</span></header>
                <Metric label={dual(isZh, 'Test net', '测试净收益')} value={pct(fold.testNetReturn, true)} />
                <Metric label={dual(isZh, 'Sharpe', '夏普比率')} value={ratio(fold.testSharpe)} />
                <Metric label={dual(isZh, 'Drawdown', '回撤')} value={pct(fold.testMaxDrawdown)} />
                <Metric label={dual(isZh, 'Trades', '交易次数')} value={fold.testTrades ?? 0} />
              </div>
            ))}
          </div>
        ) : <div className="dv-v5-empty">{dual(isZh, 'Multi-fold evidence unavailable for this candidate.', '该候选暂无多折验证证据。')}</div>}
      </section>

      <div className="dv-v5-review-grid">
        <section>
          <h4>{dual(isZh, 'Strategy comparison', '策略对比')}</h4>
          <div className="dv-v5-strategy-list">
            {strategies.slice(0, 6).map((item: any) => (
              <div className={item.strategy === record.strategy ? 'selected' : ''} key={item.strategy}>
                <b>{item.strategy}</b>
                <span>{item.dvDecision || item.verdict}</span>
                <strong>{Math.round(score(item.validationScore))}</strong>
                <small>{pct(item.annualizedNetReturn, true)} {dual(isZh, 'net', '净收益')} · {item.walkForwardFolds || 0} {dual(isZh, 'folds', '折')} · {item.tradeCount || 0} {dual(isZh, 'trades', '次交易')}</small>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h4>{dual(isZh, 'Deterministic controls', '确定性控制')}</h4>
          <div className="dv-v5-flag-list">
            {(gate.blockers || []).map((item: string) => <span className={flagClass('block')} key={'b-' + item}>{item}</span>)}
            {(gate.warnings || gate.checks || []).map((item: string) => <span className={flagClass('warning')} key={'w-' + item}>{item}</span>)}
            {(gate.strengths || []).map((item: string) => <span className={flagClass('pass')} key={'s-' + item}>{item}</span>)}
            {!(gate.blockers || []).length && !(gate.warnings || gate.checks || []).length && <span className="pass">{dual(isZh, 'No active gate flags', '当前没有风控标记')}</span>}
          </div>
          <div className="dv-v5-capacity-line">
            <Metric label="ADV20" value={capacity.adv20Label || money(capacity.adv20)} />
            <Metric label={dual(isZh, 'Round trip', '双边成本')} value={capacity.roundTripCostBps != null ? Number(capacity.roundTripCostBps).toFixed(1) + ' bps' : 'N/A'} />
            <Metric label={dual(isZh, 'Spread', '点差')} value={capacity.spreadBps != null ? Number(capacity.spreadBps).toFixed(1) + ' bps' : 'N/A'} />
            <Metric label="10% ADV" value={money(capacity.tenPctAdvCapacity)} />
          </div>
        </section>

        <section>
          <h4>{dual(isZh, 'AI challenge', 'AI 质疑')}</h4>
          {record.aiValidationUsed ? (
            <>
              <div className="dv-v5-ai-head"><Tag color="cyan">{record.aiValidationVerdict || dual(isZh, 'REVIEWED', '已审核')}</Tag><b>{record.aiValidationConfidence != null ? Math.round(Number(record.aiValidationConfidence) * 100) + dual(isZh, '% confidence', '% 置信度') : dual(isZh, 'Confidence N/A', '暂无置信度')}</b></div>
              <p>{record.aiValidationReason || dual(isZh, 'AI reviewed the deterministic packet.', 'AI 已复核确定性证据包。')}</p>
              <div className="dv-v5-flag-list">
                {(record.aiContradictions || []).map((item: string) => <span className="warning" key={'c-' + item}>{item}</span>)}
                {(record.aiMissingEvidence || []).map((item: string) => <span key={'m-' + item}>{item}</span>)}
              </div>
              <div className="dv-v5-next"><span>{dual(isZh, 'Next measurable check', '下一项可衡量检查')}</span><b>{record.aiNextCheck || record.nextStep || dual(isZh, 'Revalidate when evidence changes.', '证据变化后重新验证。')}</b></div>
            </>
          ) : <p>{dual(isZh, 'AI challenge unavailable; deterministic evidence and hard gates remain binding.', 'AI 质疑不可用；确定性证据与硬性风控闸门仍然有效。')}</p>}
        </section>
      </div>

      <div className="dv-v5-boundaries">
        <div><SafetyCertificateOutlined /><b>{dual(isZh, 'Research boundaries', '研究边界')}</b></div>
        <span>{limitations.length ? limitations.join(' · ') : dual(isZh, 'Daily-bar backtest with estimated costs; monitor live execution separately.', '日线回测已计入预计成本；真实执行仍需独立监控。')}</span>
      </div>
    </div>
  );
}

export default function DeeperValidationWorkbench({
  results,
  status,
  progress,
  currentStep,
  message,
  errors = [],
  expandedRows,
  onToggleRow,
}: DeeperValidationWorkbenchProps) {
  const { language } = useLanguage();
  const isZh = language === 'zh-CN';
  const stages = isZh ? stageLabels.zh : stageLabels.en;
  const [view, setView] = useState<DvView>('all');
  const counts = useMemo(() => ({
    pass: results.filter(row => decisionOf(row) === 'PASS_DV').length,
    watch: results.filter(row => decisionOf(row) === 'WATCH').length,
    reject: results.filter(row => decisionOf(row) === 'REJECT').length,
    needData: results.filter(row => decisionOf(row) === 'NEED_DATA').length,
  }), [results]);
  const displayed = useMemo(() => results.filter(row => {
    const decision = decisionOf(row);
    if (view === 'all') return true;
    if (view === 'pass') return decision === 'PASS_DV';
    if (view === 'watch') return decision === 'WATCH';
    if (view === 'reject') return decision === 'REJECT';
    if (view === 'needData') return decision === 'NEED_DATA';
    return aiChallenged(row);
  }), [results, view]);

  const aiReviewed = results.filter(row => row.aiValidationUsed).length;
  const aiChallengeCount = results.filter(aiChallenged).length;
  const multiFold = results.filter(row => Number(row.walkForwardProxy?.foldCount || 0) >= 2).length;
  const reliable = results.filter(row => Number(row.evidenceReliability || 0) >= 70).length;

  const columns: any[] = [
    {
      title: dual(isZh, 'Candidate', '候选标的'), key: 'candidate', width: 180, fixed: 'left',
      render: (_: any, record: any) => (
        <div className="dv-v5-candidate"><b>{record.symbol}</b><strong>{record.strategy || record.validationStrategy || 'N/A'}</strong><span>{record.strategyStackTested?.length || 1} {dual(isZh, 'strategies tested', '个策略已测试')}</span></div>
      ),
    },
    {
      title: dual(isZh, 'DV decision', '深度验证决策'), key: 'decision', width: 190,
      sorter: (a: any, b: any) => score(a.validationScore) - score(b.validationScore),
      render: (_: any, record: any) => {
        const value = score(record.validationScore);
        const color = decisionOf(record) === 'PASS_DV' ? '#16a34a' : decisionOf(record) === 'WATCH' ? '#d97706' : '#dc2626';
        return <div className="dv-v5-decision"><div><DecisionTag record={record} isZh={isZh} /><b style={{ color }}>{Math.round(value)}</b></div><Progress percent={value} showInfo={false} size={['100%', 5]} strokeColor={color} /><small>{dual(isZh, 'Reliability', '可靠性')} {record.evidenceReliability != null ? Math.round(Number(record.evidenceReliability)) + '%' : 'N/A'} · {record.institutionalGate?.status || dual(isZh, 'REVIEW', '复核')}</small></div>;
      },
    },
    {
      title: dual(isZh, 'Net edge', '净优势'), key: 'edge', width: 200,
      render: (_: any, record: any) => <div className="dv-v5-table-metrics"><Metric label={dual(isZh, 'Annualized', '年化净收益')} value={pct(record.annualizedNetReturn, true)} /><Metric label={dual(isZh, 'vs SPY', '相对 SPY')} value={pct(record.excessReturn, true)} /><Metric label={dual(isZh, 'Sharpe / PF', '夏普 / 盈利因子')} value={ratio(record.sharpeRatio) + ' / ' + ratio(record.profitFactor)} /></div>,
    },
    {
      title: dual(isZh, 'Walk-forward', '滚动验证'), key: 'walk', width: 210,
      render: (_: any, record: any) => {
        const walk = record.walkForwardProxy || {};
        return <div className="dv-v5-table-metrics"><Metric label={dual(isZh, 'Folds / positive', '折数 / 正收益')} value={(walk.foldCount || 0) + ' / ' + (walk.positiveFoldRatio != null ? Math.round(Number(walk.positiveFoldRatio) * 100) + '%' : 'N/A')} /><Metric label={dual(isZh, 'Aggregate net', '汇总净收益')} value={pct(walk.holdoutReturn, true)} /><Metric label={dual(isZh, 'Worst / trades', '最差折 / 交易数')} value={pct(walk.worstFoldReturn) + ' / ' + (walk.holdoutTrades ?? 0)} /></div>;
      },
    },
    {
      title: dual(isZh, 'Robustness', '稳健性'), key: 'robustness', width: 210,
      render: (_: any, record: any) => {
        const sample = record.sampleQuality || {};
        return <div className="dv-v5-table-metrics"><Metric label={dual(isZh, 'Stability', '稳定性')} value={Math.round(score(record.stabilityScore)) + '/100'} /><Metric label={dual(isZh, 'Parameters', '参数组')} value={(sample.validCombinations ?? 0) + '/' + (sample.testedCombinations ?? 0)} /><Metric label={dual(isZh, 'Overfit risk / penalty', '过拟合风险 / 惩罚')} value={Math.round(score(record.overfitRiskScore)) + ' / -' + Number(record.selectionBiasPenalty || 0).toFixed(1)} /></div>;
      },
    },
    {
      title: dual(isZh, 'AI challenge / next', 'AI 质疑 / 下一步'), key: 'ai', width: 260,
      render: (_: any, record: any) => (
        <div className="dv-v5-ai-cell"><span>{record.aiValidationUsed ? 'AI ' + (record.aiValidationVerdict || dual(isZh, 'reviewed', '已审核')) : dual(isZh, 'Rules only', '仅规则')}</span><b>{record.aiValidationReason || record.dvNarrative || dual(isZh, 'Deterministic validation complete.', '确定性验证已完成。')}</b><small>{record.aiNextCheck || record.nextStep || dual(isZh, 'Open detail for evidence.', '展开详情查看证据。')}</small></div>
      ),
    },
  ];

  if (status === 'loading') {
    const active = Math.max(0, Math.min(stages.length - 1, Math.floor((Math.max(progress, 1) / 100) * stages.length)));
    return (
      <div className="dv-v5-workbench">
        <div className="dv-v5-progress">
          <div><span>{dual(isZh, 'Current operation', '当前操作')}</span><b>{currentStep || dual(isZh, 'Building validation evidence', '正在构建验证证据')}</b><small>{message || dual(isZh, 'Two-year bars, strategy routing, parameter sweeps, anchored walk-forward, cost/risk gates, and AI challenge.', '依次处理两年日线、策略路由、参数扫描、锚定滚动验证、成本与风险闸门以及 AI 质疑。')}</small></div>
          <strong>{Math.round(progress)}%</strong>
          <Progress percent={progress} showInfo={false} size={['100%', 7]} />
          <div className="dv-v5-stages">{stages.map((stage, index) => <span className={index <= active ? 'active' : ''} key={stage}><i>{index + 1}</i>{stage}</span>)}</div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return <div className="dv-v5-state error"><b>{dual(isZh, 'Validation failed', '验证失败')}</b><span>{message || errors[0]?.message || dual(isZh, 'Check the service status and retry.', '请检查服务状态后重试。')}</span></div>;
  }

  if (!results.length) {
    return <div className="dv-v5-state"><b>{dual(isZh, 'Deeper Validation is ready', '深度验证已就绪')}</b><span>{dual(isZh, 'Qualified Fine Scan candidates will be tested on historical edge, walk-forward robustness, costs, and risk controls.', '通过精细扫描的候选将在这里接受历史优势、滚动稳健性、成本和风险控制测试。')}</span></div>;
  }

  return (
    <div className="dv-v5-workbench">
      <div className="dv-v5-summary">
        <Metric label={dual(isZh, 'Candidate input', '输入候选')} value={results.length.toLocaleString()} />
        <Metric label={dual(isZh, 'Pass DV', '验证通过')} value={counts.pass.toLocaleString()} />
        <Metric label={dual(isZh, 'Watch', '观察')} value={counts.watch.toLocaleString()} />
        <Metric label={dual(isZh, 'Rejected / data', '拒绝 / 缺数据')} value={(counts.reject + counts.needData).toLocaleString()} />
        <Metric label={dual(isZh, 'Multi-fold ready', '具备多折证据')} value={multiFold.toLocaleString() + '/' + results.length.toLocaleString()} />
        <Metric label={dual(isZh, 'Reliable evidence', '可靠证据')} value={reliable.toLocaleString() + '/' + results.length.toLocaleString()} />
        <Metric label={dual(isZh, 'AI reviewed / challenged', 'AI 审核 / 质疑')} value={aiReviewed.toLocaleString() + ' / ' + aiChallengeCount.toLocaleString()} />
      </div>

      <div className="dv-v5-toolbar">
        <div><b>{dual(isZh, 'Validation evidence board', '验证证据看板')}</b><span>{dual(isZh, 'Scores rank research evidence. They are not buy signals or position sizes.', '评分用于排列研究证据，不代表买入信号或仓位大小。')}</span></div>
        <div>
          {([
            ['all', dual(isZh, 'All', '全部'), results.length], ['pass', dual(isZh, 'Pass', '通过'), counts.pass], ['watch', dual(isZh, 'Watch', '观察'), counts.watch],
            ['reject', dual(isZh, 'Reject', '拒绝'), counts.reject], ['needData', dual(isZh, 'Need data', '缺少数据'), counts.needData], ['aiChallenge', dual(isZh, 'AI challenge', 'AI 质疑'), aiChallengeCount],
          ] as [DvView, string, number][]).map(([key, label, count]) => <button className={view === key ? 'active' : ''} onClick={() => setView(key)} key={key}>{label}<span>{count}</span></button>)}
        </div>
      </div>

      <Table
        className="dv-v5-table"
        dataSource={displayed}
        columns={columns}
        rowKey="symbol"
        size="middle"
        pagination={false}
        scroll={{ x: 1250 }}
        expandable={{
          expandedRowKeys: expandedRows,
          expandedRowRender: record => <DeeperValidationDetail record={record} isZh={isZh} />,
          expandIcon: ({ expanded, record }) => <button className="dv-v5-expand" aria-label={expanded ? dual(isZh, 'Collapse detail', '收起详情') : dual(isZh, 'Expand detail', '展开详情')} onClick={event => { event.stopPropagation(); onToggleRow(record.symbol); }}>{expanded ? '−' : '+'}</button>,
        }}
        onRow={record => ({ onClick: () => onToggleRow(record.symbol) })}
        rowClassName={record => expandedRows.includes(record.symbol) ? 'dv-v5-row expanded' : 'dv-v5-row'}
      />

      <div className="dv-v5-footer"><SafetyCertificateOutlined /><span>{dual(isZh, 'Hard gates remain binding', '硬性风控闸门始终有效')}</span><ArrowRightOutlined /><span>{dual(isZh, 'Only PASS DV candidates advance to Entry Plan', '仅验证通过的候选进入入场计划')}</span><ArrowRightOutlined /><span>{dual(isZh, 'Live pre-trade controls still apply', '真实交易前控制仍会执行')}</span></div>
    </div>
  );
}
