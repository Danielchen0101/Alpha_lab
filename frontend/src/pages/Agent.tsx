import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useTradeMode } from '../contexts/TradeModeContext';
import { useAuth } from '../contexts/AuthContext';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend as RechartsLegend, ResponsiveContainer } from 'recharts'; // eslint-disable-line @typescript-eslint/no-unused-vars
import {
  Card, Typography, Space, Row, Col,
  Button, Divider, Table, Tag, Input, Empty,
  message, Progress, Alert, Tooltip, Spin, Modal, Steps, Select, Segmented, Switch, Checkbox
} from 'antd';
import {
  LineChartOutlined, BarChartOutlined,
  SettingOutlined, PauseCircleOutlined, SearchOutlined,
  ThunderboltOutlined, CheckCircleOutlined, ClockCircleOutlined,
  RobotOutlined, CloseCircleOutlined, ExclamationCircleOutlined, SyncOutlined, LoadingOutlined, SafetyCertificateOutlined,
  InfoCircleOutlined,
  CaretDownOutlined, CaretRightOutlined,
  DeleteOutlined, ReloadOutlined, PlusOutlined, CheckOutlined, EyeOutlined,
  WalletOutlined, FundOutlined, SwapOutlined, WarningOutlined
} from '@ant-design/icons';
import aiTradingService from '../services/aiTradingService';
import { deeperValidationAPI, entryPlanAPI, tradingAccountAPI, aiAgentWatchlistAPI, aiExecutionAPI, pipelineAutoAPI, workspacePreferencesAPI, notificationAPI, loadConfigStatus } from '../services/api';
import api from '../services/api';
import OrderModal from '../components/OrderModal';
import MarketScannerWorkbench from '../components/MarketScannerWorkbench';
import FineScanWorkbench from '../components/FineScanWorkbench';
import DeeperValidationWorkbench from '../components/DeeperValidationWorkbench';
import marketDataService from '../services/marketDataService';
import { scannerStateStore } from '../services/scannerStateStore';
import {
  startMarketScanner, stopMarketScannerByUser, isScanRunning,
  registerFineScanRun, unregisterFineScanRun, isFineScanRunning,
  registerDeeperValidationRun, unregisterDeeperValidationRun, isDeeperValidationRunning,
  registerEntryPlanRun, unregisterEntryPlanRun, isEntryPlanRunning,
} from '../services/scannerRunnerService';
import './AgentEditorial.css';

const { Option } = Select;


const { Title, Text } = Typography;

const AI_AGENT_PRIMARY_BTN_STYLE: React.CSSProperties = { 
  borderRadius: '4px', 
  fontWeight: 600, 
  height: '32px', 
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const AUTO_PIPELINE_TRIGGERS = new Set(['market_auto_run', 'headless_market_auto_run', 'toggle_on', 'auto_run_now']);
const AUTO_PIPELINE_STAGE_FALLBACK = [
  { key: 'market_scanner', label: 'Market Scanner' },
  { key: 'fine_scan', label: 'Fine Scan' },
  { key: 'deeper_validation', label: 'Deeper Validation' },
  { key: 'admission', label: 'Portfolio Admission' },
  { key: 'entry_plan', label: 'Entry Plan' },
  { key: 'execution', label: 'Execution' },
  { key: 'exit_scan', label: 'Position & Exit' },
];

const accountStorageKey = (base: string, userId?: string): string | null => (
  userId ? `${base}:${userId}` : null
);

const readAccountStorage = (base: string, userId?: string): string | null => {
  const key = accountStorageKey(base, userId);
  return key ? localStorage.getItem(key) : null;
};

const writeAccountStorage = (base: string, userId: string | undefined, value: string): void => {
  const key = accountStorageKey(base, userId);
  if (key) localStorage.setItem(key, value);
};

const ExitMetric: React.FC<{ label: string; value: React.ReactNode; tone?: 'default' | 'good' | 'warn' | 'risk' }> = ({ label, value, tone = 'default' }) => (
  <div className={`exit-plan-metric is-${tone}`}>
    <span>{label}</span>
    <strong>{value ?? '—'}</strong>
  </div>
);

const exitFinite = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.abs(parsed) < 0.0000005 ? 0 : parsed;
};

const exitPrice = (value: unknown, digits = 2): string => {
  const parsed = exitFinite(value);
  return parsed == null ? '—' : `$${parsed.toFixed(digits)}`;
};

const exitMoney = (value: unknown): string => {
  const parsed = exitFinite(value);
  if (parsed == null) return '—';
  const absolute = Math.abs(parsed);
  if (absolute >= 1_000_000) return `${parsed < 0 ? '-' : ''}$${(absolute / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `${parsed < 0 ? '-' : ''}$${(absolute / 1_000).toFixed(1)}K`;
  return `${parsed < 0 ? '-' : ''}$${absolute.toFixed(2)}`;
};

const exitPercent = (value: unknown, signed = false): string => {
  const parsed = exitFinite(value);
  if (parsed == null) return '—';
  return `${signed && parsed > 0 ? '+' : ''}${parsed.toFixed(2)}%`;
};

const exitSignedMoney = (value: unknown): string => {
  const parsed = exitFinite(value);
  if (parsed == null) return '—';
  const formatted = exitMoney(parsed);
  return parsed > 0 ? `+${formatted}` : formatted;
};

const exitRatioPercent = (value: unknown): string => {
  const parsed = exitFinite(value);
  return parsed == null ? '—' : exitPercent(parsed * 100, true);
};

const exitValueTone = (value: unknown): string => {
  const parsed = exitFinite(value);
  if (parsed == null || parsed === 0) return 'var(--app-text-muted)';
  return parsed > 0 ? '#3d7a47' : '#b64a38';
};

const exitQuoteAge = (value: unknown): string => {
  const seconds = exitFinite(value);
  if (seconds == null) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
};

// Small inline tag used in Entry Quality detail panel
// Collapsible Stage Section Component
interface CollapsibleStageSectionProps {
  stageNumber?: string;
  stageLabel?: string;
  expandLabel?: string;
  collapseLabel?: string;
  title: string;
  icon: React.ReactNode;
  statusText?: string;
  statusColor?: string;
  progressValue?: number | null;  // 0-100, null = no progress bar
  progressText?: string;
  summaryChips?: Array<{ label: string; value: string | number; color?: string }>;
  actionButton?: React.ReactNode;
  isRunning?: boolean;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const CollapsibleStageSection: React.FC<CollapsibleStageSectionProps> = ({
  stageNumber, stageLabel = 'Stage', expandLabel = 'Expand', collapseLabel = 'Collapse',
  title, icon, statusText, statusColor, progressValue, progressText,
  summaryChips, actionButton, isRunning, expanded, onToggle, children
}) => {
  const statusTagColor = statusColor || (isRunning ? 'processing' : 'default');
  const statusKey = isRunning ? 'running' : statusColor || 'default';

  return (
    <section className={`agent-stage-section is-${statusKey}${expanded ? ' is-expanded' : ''}`}>
      <div
        className="agent-stage-header"
        onClick={onToggle}
      >
        <button
          type="button"
          className="agent-stage-toggle"
          aria-label={`${expanded ? collapseLabel : expandLabel} ${title}`}
          aria-expanded={expanded}
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
        >
          {expanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
        </button>

        <div className="agent-stage-identity">
          <span className="agent-stage-icon">
            {icon}
          </span>
          <span className="agent-stage-title-block">
            {stageNumber && <small>{stageLabel} {stageNumber}</small>}
            <strong>{title}</strong>
          </span>
        </div>

        {statusText && (
          <Tag 
            color={statusTagColor} 
            bordered={false}
            className="agent-stage-status"
          >
            {isRunning && <SyncOutlined spin style={{ marginRight: 6 }} />}
            {statusText}
          </Tag>
        )}

        {progressValue !== null && progressValue !== undefined && (
          <div className="agent-stage-progress">
            <div className="agent-stage-progress-track">
              <div 
                className="agent-stage-progress-value"
                style={{ 
                  width: `${Math.min(100, Math.max(0, progressValue))}%`, 
                }} 
              />
            </div>
            <b>
              {Math.round(progressValue)}%
            </b>
            {progressText && (
              <span>
                {progressText}
              </span>
            )}
          </div>
        )}
        
        {progressText && (progressValue === null || progressValue === undefined) && (
          <span className="agent-stage-progress-text">{progressText}</span>
        )}

        {summaryChips && summaryChips.length > 0 && (
          <div className="agent-stage-summary">
            {summaryChips.map((chip, i) => (
              <span key={i}>
                <small>{chip.label}</small>
                <b style={{ color: chip.color || 'var(--app-text-strong)' }}>{chip.value}</b>
              </span>
            ))}
          </div>
        )}

        <div className="agent-stage-spacer" />

        {actionButton && (
          <div className="agent-stage-action" onClick={(e) => e.stopPropagation()}>
            {actionButton}
          </div>
        )}
      </div>

      {expanded && (
        <div className="agent-stage-content">
          {children}
        </div>
      )}
    </section>
  );
};

// AI分析结果类型定义 - V3格式
// 趋势分析结果类型

// Entry Plan API uses stable machine values; keep display compatible with older cached plans.
const getEntryPlanAction = (plan: any): string => {
  const raw = String(plan?.finalAction || '').trim();
  const normalized = raw.toUpperCase().replace(/\s+/g, '_');
  const aliases: Record<string, string> = {
    'BUY_READY': 'BUY_READY',
    'BUY_ALLOWED': 'BUY_READY',
    'READY_FOR_REVIEW': 'READY_REVIEW',
    'READY_REVIEW': 'READY_REVIEW',
    'WAIT_FOR_ENTRY': 'WAIT_FOR_ENTRY',
    'WATCH': 'WAIT_FOR_ENTRY',
    'WATCH_ONLY': 'WAIT_FOR_ENTRY',
    'NEED_DATA': 'NEED_DATA',
    'DATA_UNAVAILABLE': 'NEED_DATA',
    'BLOCKED_BY_RISK': 'BLOCKED_BY_RISK',
    'SKIP': 'SKIP',
  };
  return aliases[normalized] || normalized;
};

const toEntryPlanNumber = (value: any): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[$,%\s]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const getEntryPlanZone = (plan: any): { low: number | null; high: number | null } => {
  const low = plan?.entryZone?.low ?? plan?.entryZoneLow ?? plan?.entryLow ?? null;
  const high = plan?.entryZone?.high ?? plan?.entryZoneHigh ?? plan?.entryHigh ?? null;
  const lowNum = toEntryPlanNumber(low);
  const highNum = toEntryPlanNumber(high);
  return {
    low: lowNum != null && lowNum > 0 ? lowNum : null,
    high: highNum != null && highNum > 0 ? highNum : null,
  };
};

const getEntryPlanCurrentPrice = (plan: any): number | null => {
  const value = plan?.currentPrice ?? plan?.price ?? null;
  const num = toEntryPlanNumber(value);
  return num != null && num > 0 ? num : null;
};

const getEntryPlanExecutablePrice = (plan: any): number | null => (
  toEntryPlanNumber(plan?.executableAsk ?? plan?.latestAsk) ?? getEntryPlanCurrentPrice(plan)
);

const hasEntryPlanExitLevels = (plan: any): boolean => {
  const stop = toEntryPlanNumber(plan?.stopLoss ?? plan?.stop ?? plan?.entryPlanStop);
  const target = toEntryPlanNumber(plan?.takeProfit1 ?? plan?.takeProfit ?? plan?.target ?? plan?.entryPlanTarget);
  return !!(stop && stop > 0 && target && target > 0);
};

const isEntryPlanInZone = (plan: any): boolean => {
  const current = getEntryPlanExecutablePrice(plan);
  const { low, high } = getEntryPlanZone(plan);
  return current != null && low != null && high != null && current >= low && current <= high;
};

const isAllocationCapReason = (reason: any): boolean => {
  const text = String(reason || '').toLowerCase();
  return (
    text.includes('max allocation') ||
    text.includes('position would be') ||
    text.includes('exceeds max') ||
    text.includes('position capped') ||
    text.includes('capped by position limit')
  ) && !text.includes('below minimum');
};

const hasExecutableCappedAllocation = (plan: any): boolean => {
  const shares = toEntryPlanNumber(plan?.executableShares ?? plan?.finalShares ?? plan?.positionSizeShares ?? plan?.shares);
  return !!(plan?.cappedByAllocation || plan?.positionCapped) && shares != null && shares >= 1;
};

const getEntryPlanFilteredBlockers = (plan: any): string[] => {
  const rg = plan?.riskGate || plan?.hardRiskGate || {};
  const raw = [
    ...(Array.isArray(plan?.blockers) ? plan.blockers : []),
    ...(Array.isArray(rg?.blockers) ? rg.blockers : []),
    ...(Array.isArray(plan?.riskGateReasons?.blockers) ? plan.riskGateReasons.blockers : []),
    plan?.localOverrideReason,
  ].filter(Boolean).map((v: any) => String(v));
  const unique = Array.from(new Set(raw));
  if (!hasExecutableCappedAllocation(plan)) return unique;
  return unique.filter(reason => !isAllocationCapReason(reason));
};

const hasEntryPlanHardBlock = (plan: any): boolean => {
  const rg = plan?.riskGate || plan?.hardRiskGate || {};
  const blockers = getEntryPlanFilteredBlockers(plan);
  if (blockers.length > 0) return true;
  return rg?.status === 'BLOCK' && !hasExecutableCappedAllocation(plan);
};

const getEntryPlanEffectiveAction = (plan: any): string => {
  const action = getEntryPlanAction(plan);
  if (action === 'SKIP' || action === 'NEED_DATA') return action;

  if (plan?.dataQuality && plan.dataQuality !== 'GOOD') return 'NEED_DATA';
  if (plan?.marketIsOpen === false) return action === 'BLOCKED_BY_RISK' ? action : 'WAIT_FOR_ENTRY';
  const quoteAge = toEntryPlanNumber(plan?.quoteAgeSeconds);
  if (plan?.marketIsOpen === true && (quoteAge == null || quoteAge > 90)) return 'NEED_DATA';

  const current = getEntryPlanExecutablePrice(plan);
  const { low, high } = getEntryPlanZone(plan);
  if (current == null || low == null || high == null || !hasEntryPlanExitLevels(plan)) {
    return 'NEED_DATA';
  }

  if (action === 'BLOCKED_BY_RISK') {
    return action;
  }

  const triggerStatus = String(plan?.entryTriggerStatus || plan?.institutionalEntryPlan?.entry?.triggerStatus || '').toUpperCase();
  const triggerMet = plan?.entryTriggerMet ?? plan?.institutionalEntryPlan?.entry?.triggerMet;
  const setupAutoEligible = plan?.setupAutoEligible ?? plan?.institutionalEntryPlan?.entry?.setupAutoEligible;
  if (triggerStatus === 'NOT_ELIGIBLE' || setupAutoEligible === false) return 'SKIP';
  if (triggerStatus === 'NEED_DATA') return 'NEED_DATA';
  if ((action === 'BUY_READY' || action === 'READY_REVIEW') && (
    (triggerStatus && triggerStatus !== 'CONFIRMED') || triggerMet === false
  )) {
    return 'WAIT_FOR_ENTRY';
  }

  if ((action === 'BUY_READY' || action === 'READY_REVIEW') && !isEntryPlanInZone(plan)) {
    return 'WAIT_FOR_ENTRY';
  }
  return action;
};

const getEntryPlanUnavailableReason = (plan: any): string => {
  const triggerStatus = String(plan?.entryTriggerStatus || '').toUpperCase();
  if (triggerStatus === 'NEED_DATA') {
    const missing = Array.isArray(plan?.entryTriggerMissing) ? plan.entryTriggerMissing.join(', ') : '';
    return missing ? `Trigger data missing: ${missing}.` : 'Setup-trigger evidence is unavailable. Rerun Entry Plan.';
  }
  const current = getEntryPlanExecutablePrice(plan);
  const { low, high } = getEntryPlanZone(plan);
  if (low == null || high == null) return 'Entry zone unavailable. Refresh market data.';
  if (current == null) return 'Executable ask unavailable. Refresh market data.';
  if (!hasEntryPlanExitLevels(plan)) return 'Stop/target unavailable. Refresh market data.';
  return '';
};

const getEntryPlanCapNote = (plan: any): string => {
  if (!hasExecutableCappedAllocation(plan)) return '';
  const pct = toEntryPlanNumber(plan?.maxAllocationPct) ?? 10;
  return plan?.positionCapReason || `Original size exceeded max allocation, capped to ${pct}%.`;
};

const getEntryPlanSanitizedText = (plan: any, text: any): string => {
  const value = String(text || '');
  if (hasExecutableCappedAllocation(plan) && isAllocationCapReason(value)) {
    return getEntryPlanCapNote(plan);
  }
  return value;
};

const getEntryPlanActionTooltip = (plan: any): string => {
  const action = getEntryPlanEffectiveAction(plan);
  const capNote = getEntryPlanCapNote(plan);
  if (action === 'NEED_DATA') return getEntryPlanUnavailableReason(plan) || 'Entry plan data unavailable.';
  if (action === 'WAIT_FOR_ENTRY') {
    const triggerStatus = String(plan?.entryTriggerStatus || '').toUpperCase();
    if (triggerStatus === 'WAIT_TRIGGER') {
      return plan?.entryTriggerReasons?.join('; ') || `Price is in the zone, but the ${String(plan?.entryTriggerKind || 'setup').replace(/_/g, ' ')} confirmation is still pending.`;
    }
    if (triggerStatus === 'NEED_DATA') {
      return plan?.entryTriggerReasons?.join('; ') || 'Required setup-trigger evidence is missing.';
    }
    const current = getEntryPlanExecutablePrice(plan);
    const { low, high } = getEntryPlanZone(plan);
    if (current != null && low != null && high != null) {
      if (current > high) return `Waiting for price to return to entry zone. Executable ask is above the approved zone.${capNote ? ` ${capNote}` : ''}`;
      if (current < low) return `Waiting for price to return to entry zone. Executable ask is below the approved zone.${capNote ? ` ${capNote}` : ''}`;
    }
    return `Waiting for price to return to entry zone.${capNote ? ` ${capNote}` : ''}`;
  }
  if (action === 'READY_REVIEW') {
    return getEntryPlanSanitizedText(plan, plan?.readyReviewReason || getEntryPlanFilteredBlockers(plan).join('; ') || plan?.riskComment || plan?.decisionReason) || `Review required before execution.${capNote ? ` ${capNote}` : ''}`;
  }
  if (action === 'BLOCKED_BY_RISK') {
    return getEntryPlanSanitizedText(plan, getEntryPlanFilteredBlockers(plan).join('; ') || plan?.riskComment || plan?.decisionReason) || 'Review risk gate and data quality.';
  }
  if (action === 'BUY_READY') return capNote || 'Executable entry plan.';
  return plan?.decisionReason || capNote || 'Review entry plan.';
};

const getEntryPlanExecutionSnapshot = (plan: any): any => {
  const action = getEntryPlanEffectiveAction(plan);
  const rg = plan?.riskGate || plan?.hardRiskGate || {};
  const blockers = getEntryPlanFilteredBlockers(plan);
  const status = blockers.length > 0 ? 'BLOCK' : (rg?.status || 'PASS');
  const shares = plan?.executableShares ?? plan?.finalShares ?? plan?.positionSizeShares ?? plan?.shares;
  return {
    ...plan,
    finalAction: action,
    tradeReadiness: action === 'BUY_READY' ? 'READY' : action === 'READY_REVIEW' || action === 'WAIT_FOR_ENTRY' ? 'WAIT' : 'BLOCKED',
    riskGate: { ...rg, status, blockers },
    hardRiskGate: { ...(plan?.hardRiskGate || rg), status, blockers },
    shares,
    positionSizeShares: shares,
  };
};

const Agent: React.FC = (): React.ReactElement => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const accountUserId = user?.id;
  const { t, language, translateSector } = useLanguage();
  const isZh = language === 'zh-CN';
  const agentText = useCallback(
    (english: string, chinese: string): string => (isZh ? chinese : english),
    [isZh],
  );
  const agentErrorText = useCallback((
    raw: unknown,
    englishFallback: string,
    chineseFallback: string,
  ): string => {
    const detail = String(raw ?? '').trim();
    if (!detail) return isZh ? chineseFallback : englishFallback;
    if (!isZh) return detail;

    const normalized = detail.toLowerCase();
    if (/session|token|sign.?in|unauthor|\b401\b/.test(normalized)) return '登录状态已过期，请重新登录。';
    if (/rate.?limit|throttl|\b429\b/.test(normalized)) return '请求频率过高，系统稍后会自动重试。';
    if (/timeout|timed out|monitoring window/.test(normalized)) return '本次操作等待超时，请稍后重试。';
    if (/not configured|configuration|credential|api.?key|provider|forbidden|\b403\b/.test(normalized)) {
      return '当前服务连接或凭据不可用，请在设置中检查配置。';
    }
    if (/network|failed to fetch|failed to reach|connection/.test(normalized)) return '暂时无法连接服务，请稍后重试。';
    return chineseFallback;
  }, [isZh]);
  const agentEnumLabel = useCallback((value: unknown): string => {
    const raw = String(value ?? '').trim();
    if (!raw) return '—';
    const normalized = raw.toUpperCase().replace(/[\s-]+/g, '_');
    if (!isZh) return raw.replace(/_/g, ' ');
    const labels: Record<string, string> = {
      ADVANCE: '推进', AVOID: '回避', WATCH: '观察', BUY: '买入', SELL: '卖出', SKIP: '跳过',
      PRIORITY_A: '优先级 A', PRIORITY_B: '优先级 B', PRIORITY_C: '优先级 C',
      POSITIVE: '正面', NEGATIVE: '负面', NEUTRAL: '中性',
      READY: '就绪', REVIEW: '待审核', WAIT: '等待', ELIGIBLE: '符合条件', RESEARCH_ONLY: '仅研究',
      OPEN: '开市', CLOSED: '已收市', MONITORING: '监控中', TRAILING: '追踪止损', BREAKEVEN: '保本',
      PENDING: '待处理', SUBMITTED: '已提交', FILLED: '已成交', FAILED: '失败', HOLDING: '持有中',
      ZONE_WAIT: '等待入场区间', ORDER_PENDING: '订单待处理', AUTO_EXECUTING: '自动执行中',
      GOOD: '良好', PARTIAL: '部分数据', POOR: '较差', HIGH: '高', MEDIUM: '中', LOW: '低', UNKNOWN: '未知',
      DATA: '数据', DAY: '当日有效', GTC: '撤销前有效', IOC: '立即成交或取消', FOK: '全部成交或取消',
      SIMPLE: '普通订单', BRACKET: '保护性组合订单', OCO: '二选一订单', OTO: '触发式订单',
      STRONG_BULLISH: '强势看多', BULLISH: '看多', BEARISH: '看空', STRONG_BEARISH: '强势看空',
      UPTREND: '上升趋势', DOWNTREND: '下降趋势', RANGE: '区间震荡', RISK_ON: '偏风险', RISK_OFF: '偏防御',
      NONE: '无', ADMIT: '准入', HOLD: '暂缓', BLOCK: '阻断', CHECKING: '检查中', COMPLETED: '已完成',
      BUY_READY: '可买入', READY_REVIEW: '待审核', WAIT_FOR_ENTRY: '等待入场', NEED_DATA: '需要数据',
      BLOCKED_BY_RISK: '风险阻断', PASS_DV: '验证通过', REJECT: '已拒绝',
      EMERGENCY_EXIT: '紧急退出', EMERGENCY_EXIT_SUBMITTED: '紧急退出已提交', MANUAL_INTERVENTION: '人工介入',
      PROTECTION_REQUIRED: '需要保护单', REVIEW_OPEN_ORDERS: '检查未成交订单', PROTECTED_REVIEW: '保护单复核',
      TIME_EXIT_REVIEW: '持有时间复核', THESIS_REVIEW: '交易逻辑复核', EVENT_REVIEW: '事件风险复核',
      CONCENTRATION_REVIEW: '集中度复核', RATCHET_STOP: '上调止损', TARGET_REACHED: '已达目标',
      MONITOR: '继续监控', PROTECTED: '已保护', UNPROTECTED: '未保护', BLOCKED: '已阻断',
    };
    return labels[normalized] || raw.replace(/_/g, ' ');
  }, [isZh]);
  const liveAutoCopy = language === 'zh-CN'
    ? {
        eyebrow: '实盘自动化授权',
        title: '授权无人值守实盘订单？',
        description: '你将授予后台引擎实盘下单权限。该引擎可在本页面关闭后继续运行，但不会绕过任何既有风控。',
        status: '当前权限',
        locked: '未授权',
        environment: '交易环境',
        liveConnected: '实盘 · Alpaca 已连接',
        liveConnectionRequired: '实盘 · 需要连接 Alpaca',
        schedule: '运行范围',
        scheduleOff: '定时关闭 · 仅手动触发完整周期',
        scheduleEvery: (interval: string) => `每 ${interval} · 仅纽约市场时段`,
        orders: '订单范围',
        orderScope: '符合条件的限价买单、保护性 OCO 与风险退出单',
        risk: '风控边界',
        riskScope: '硬风控、账户限额、熔断器与持仓保护仍然有效',
        boundariesTitle: '本次授权允许什么',
        backgroundBoundary: '后台周期可在页面关闭后继续完成，并使用已保存的账户与风险配置。',
        modeBoundary: '只有 Full AI 模式可以自动提交订单；Hybrid 和 Manual 仍需人工审核。',
        gateBoundary: '市场时段检查、确定性硬门槛、熔断器和券商限制始终具有最终约束力。',
        note: '授权操作本身不会立即创建订单。权限仅在“实盘 + Full AI”条件下生效，并可随时通过此开关关闭。',
        acceptance: '我理解这会允许后台引擎在无需逐单确认的情况下，使用真实资金提交符合条件的实盘订单。',
        cancel: '保持关闭',
        confirm: '授权实盘自动运行',
        switchLabel: '授权无人值守实盘订单',
      }
    : {
        eyebrow: 'LIVE AUTOMATION AUTHORIZATION',
        title: 'Authorize unattended live orders?',
        description: 'You are granting the background engine live order authority. It can continue after this page closes, but it cannot bypass existing risk controls.',
        status: 'Current authority',
        locked: 'Locked',
        environment: 'Environment',
        liveConnected: 'Live · Alpaca connected',
        liveConnectionRequired: 'Live · Alpaca connection required',
        schedule: 'Run scope',
        scheduleOff: 'Schedule off · manually triggered full cycles only',
        scheduleEvery: (interval: string) => `Every ${interval} · New York market hours only`,
        orders: 'Order scope',
        orderScope: 'Eligible buy limits, protective OCO, and risk-exit orders',
        risk: 'Risk boundary',
        riskScope: 'Hard gates, account limits, circuit breakers, and position protection remain binding',
        boundariesTitle: 'What this authorization allows',
        backgroundBoundary: 'A background cycle may finish after this page closes, using the saved account and risk context.',
        modeBoundary: 'Only Full AI mode can submit orders automatically; Hybrid and Manual remain review-only.',
        gateBoundary: 'Market-hour checks, deterministic hard gates, circuit breakers, and broker controls always have final authority.',
        note: 'This authorization does not place an order now. It is effective only while Real + Full AI are active and can be revoked with this switch at any time.',
        acceptance: 'I understand this permits the background engine to submit eligible real-money orders without confirming each order individually.',
        cancel: 'Keep disabled',
        confirm: 'Authorize live automation',
        switchLabel: 'Authorize unattended live orders',
      };
  const agentConsoleCopy = language === 'zh-CN'
    ? {
        consoleKicker: '研究与执行控制台',
        engineOnline: '后台引擎在线',
        engineChecking: '正在检查引擎',
        controlPlaneAria: '自动化控制面板',
        scheduler: '调度器',
        online: '在线',
        checking: '检查中',
        manualOnly: '仅手动运行',
        every: (interval: string) => `每 ${interval} 运行`,
        market: '市场',
        open: '开市',
        holiday: '休市日',
        closed: '已收市',
        newYorkSession: '纽约交易时段',
        orderAuthority: '下单权限',
        paperAuto: '模拟自动交易',
        liveAuthorized: '实盘已授权',
        liveLocked: '实盘未授权',
        fullAiMode: '全自动 AI 模式',
        reviewRequired: '需要人工审核',
        noAutoOrders: '不会自动下单',
        notifications: '通知',
        discordOn: 'Discord 已开启',
        discordOff: 'Discord 已关闭',
        notificationScope: '买卖 · 推荐股票 · 重要风险 · 单次运行摘要',
        riskControls: '风险控制',
        circuitOpen: '熔断器已触发',
        hardGatesActive: '硬风控已启用',
        checkingPositions: '正在检查持仓',
        positionGuard: (seconds: number) => `每 ${seconds} 秒检查持仓`,
        operations: '运行管理',
        automationControl: '自动化控制',
        paperEnvironment: '模拟环境',
        liveAuthorizedEnvironment: '实盘已授权',
        liveLockedEnvironment: '实盘未授权',
        pipeline: '自动化流程',
        inProgress: '进行中',
        stoppedHere: '在此阶段停止',
        interrupted: '已中断',
        noCandidates: '无候选标的',
        partial: '部分完成',
        partialResult: '部分结果',
        complete: '完成',
        queued: '等待执行',
        stageProgress: (progress: number) => `本阶段 ${progress}%`,
        allStagesCompleted: (count: number) => `${count}/${count} 个阶段已完成`,
        stagesBeforeFailure: (count: number) => `失败前已完成 ${count} 个阶段`,
        stagesBeforeStop: (count: number) => `停止前已完成 ${count} 个阶段`,
        stagesReady: '七个确定性阶段均已就绪',
        disabled: '已关闭',
        cycleRunning: '流程运行中',
        armed: '已就绪',
        premarketArmed: '盘前已就绪',
        waitingForMarket: '等待开市',
        pending: '等待中',
        runFullCycle: '运行完整自动化流程',
        startingPipeline: '正在启动流程',
        cycleCompleted: '流程已完成',
        pipelineFailed: (stage: string) => `${stage}失败`,
        cycleInterrupted: '流程已中断',
        ready: '就绪',
        running: '运行中',
        completed: '已完成',
        failed: '失败',
        stopped: '已停止',
        idle: '空闲',
        preparingPipeline: '正在准备七阶段后台流程。',
        cycleStoppedEarly: '流程在完成前停止。',
        allStagesFinished: '全部七个阶段均已完成。',
        readyForBackgroundRun: '可随时运行一次完整后台流程。',
        overall: '总进度',
        currentStage: '当前阶段',
        elapsed: '已用时间',
        progressAria: (progress: number) => `完整自动化流程已完成 ${progress}%`,
        completedCount: (completed: number, total: number) => `${completed}/${total} 已完成`,
        backgroundSchedule: '后台调度',
        off: '关闭',
        scheduleHelper: '仅在交易时段运行，且同一时间只会执行一个后台流程。',
        paperAutomation: '模拟自动交易',
        liveOrdersAuthorized: '实盘订单已授权',
        liveOrdersLocked: '实盘订单未授权',
        paper: '模拟',
        paperCode: '模拟',
        eligibleOrders: '通过全部硬风控后，系统可提交符合条件的限价单。',
        fullAiRequired: '只有全自动 AI 模式可以自动提交订单。',
        runTooltip: '在后台完整运行一次七阶段流程。这不是试运行，也不会开启周期调度。',
        fullCycleRunning: '完整流程运行中',
        sevenStagesTitle: '一次后台运行完成七个真实阶段。',
        sevenStagesDescription: '扫描、精筛、深度验证、组合准入、入场计划、符合条件的限价单执行与持仓保护，共用同一套已保存的账户和风控配置。',
        automation: '自动化',
        newYorkSessionOpen: '纽约交易时段已开市',
        marketHoursGateActive: '交易时段限制已启用',
        lastCompleted: '上次完成',
        noCompletedRun: '暂无已完成流程',
        awaitingFirstCycle: '等待首次完整流程',
        nextEligibleRun: '下次可运行时间',
        enableSchedule: '开启调度后自动待命',
        authoritativeSchedule: '以后端调度时间为准',
        runsToday: '今日运行次数',
        schedulerOnline: '后台调度器在线',
        schedulerPending: '正在确认调度器状态',
        savedContext: '已保存配置',
        real: '实盘',
        riskHorizon: (risk: string, horizon: string) => `${risk}风险 / ${horizon}周期`,
        discordPolicy: 'Discord 通知策略',
        quietAlertsOn: '精简通知已开启',
        trades: '交易',
        recommendations: '推荐',
        risk: '风险',
        digest: '摘要',
        materialEventsOnly: '仅重要事件',
        noWebhook: '不发送 Webhook 通知',
        lastCycle: '上次流程',
        scanner: '市场扫描',
        aiReviewed: 'AI 已审核',
        entryPlans: '入场计划',
        positionsChecked: '已检查持仓',
        marketCalendar: '市场日历',
        scheduleOff: '调度已关闭',
        next15Days: '未来 15 天',
        runHistory: '运行记录',
        loaded: (count: number) => `已载入 ${count} 条`,
        auditTrail: '审计记录',
        earlyClose: '提前收市',
        unknown: '未知',
        scheduled: '已安排',
        noRun: '不运行',
        alpacaCalendar: 'Alpaca 日历',
        fallbackCalendar: '备用交易时段',
        source: '来源',
        loadingCalendar: '正在载入市场日历…',
        noCalendarData: '暂无市场日历数据。',
        automatic: '自动运行',
        timeUnavailable: '时间不可用',
        completedWithoutException: '运行完成，未发现异常。',
        noStoredCycles: '尚未保存任何已完成的自动化流程。',
        completedFallback: '已完成',
        pipelineModeSuffix: ' · 模式',
        calendarRowAlpaca: 'Alpaca 日历',
        calendarRowFallback: '备用日历',
        paperTradingStatus: '模拟交易',
        liveTradingStatus: '实盘',
        clear: '清空',
        paperAiModeDescription: '模拟 AI 模式：通过审核的买入计划可以自动提交；被拦截的计划仍需人工审核。',
        liveAiModeDescription: '实盘 AI 模式：通过审核的买入计划可以自动提交；被拦截的计划仍需人工审核。',
        noExecutionCandidates: '暂无执行候选',
        executionCandidatesHint: '符合条件的入场计划会显示在这里，供你审核或提交。',
        waitingForEntryPlan: '等待入场计划',
        riskGateRequired: '必须通过风险门槛',
        autoSubmitProtected: '自动提交受风控保护',
        openSell: '待成交卖单',
        cancel: '取消',
        on: '开启',
        tradingDesk: '交易工作台',
        portfolioOperations: '持仓操作',
        assetClass: '资产类别',
        costBasis: '成本基础',
        exchange: '交易所',
        stageLabels: {
          market_scanner: '市场扫描',
          fine_scan: '精细筛选',
          deeper_validation: '深度验证',
          admission: '组合准入',
          entry_plan: '入场计划',
          execution: '订单执行',
          exit_scan: '持仓与退出',
        } as Record<string, string>,
        autoExecuting: '自动执行中',
        holding: '持仓管理中',
        orderPending: '订单待成交',
        zoneWait: '等待价格区间',
        blocked: '已拦截',
        managedByExitScan: '由退出扫描管理',
        waitingForFill: '等待成交',
        watching: '持续观察',
        remove: '移除',
        retry: '重试',
        runStatusLabels: {
          success: '成功',
          completed: '已完成',
          failed: '失败',
          blocked: '已拦截',
          running: '运行中',
          stopped: '已停止',
          interrupted: '已中断',
          pending: '等待中',
          unknown: '未知',
        } as Record<string, string>,
        calendarStatusLabels: {
          open: '开市',
          early_close: '提前收市',
          holiday: '休市日',
          closed: '已收市',
        } as Record<string, string>,
        riskLabels: { low: '低', medium: '中等', high: '高' } as Record<string, string>,
        horizonLabels: { short: '短期', mid: '中期', medium: '中期', long: '长期' } as Record<string, string>,
      }
    : {
        consoleKicker: 'Research and execution console',
        engineOnline: 'Headless Engine Online',
        engineChecking: 'Engine Checking',
        controlPlaneAria: 'Automation control plane',
        scheduler: 'Scheduler',
        online: 'Online',
        checking: 'Checking',
        manualOnly: 'Manual only',
        every: (interval: string) => `Every ${interval}`,
        market: 'Market',
        open: 'Open',
        holiday: 'Holiday',
        closed: 'Closed',
        newYorkSession: 'New York session',
        orderAuthority: 'Order Authority',
        paperAuto: 'Paper Auto',
        liveAuthorized: 'Live Authorized',
        liveLocked: 'Live Locked',
        fullAiMode: 'Full AI mode',
        reviewRequired: 'Review required',
        noAutoOrders: 'No auto orders',
        notifications: 'Notifications',
        discordOn: 'Discord On',
        discordOff: 'Discord Off',
        notificationScope: 'Buys & sells · recommendations · material risk · one cycle digest',
        riskControls: 'Risk Controls',
        circuitOpen: 'Circuit Open',
        hardGatesActive: 'Hard Gates Active',
        checkingPositions: 'Checking positions now',
        positionGuard: (seconds: number) => `${seconds}s position guard`,
        operations: 'Operations',
        automationControl: 'Automation Control',
        paperEnvironment: 'Paper environment',
        liveAuthorizedEnvironment: 'Live authorized',
        liveLockedEnvironment: 'Live locked',
        pipeline: 'Pipeline',
        inProgress: 'In progress',
        stoppedHere: 'Stopped here',
        interrupted: 'Interrupted',
        noCandidates: 'No candidates',
        partial: 'Partial',
        partialResult: 'Partial result',
        complete: 'Complete',
        queued: 'Queued',
        stageProgress: (progress: number) => `${progress}% of stage`,
        allStagesCompleted: (count: number) => `${count} of ${count} stages completed`,
        stagesBeforeFailure: (count: number) => `${count} stages completed before the failure`,
        stagesBeforeStop: (count: number) => `${count} stages completed before the stop`,
        stagesReady: 'Seven deterministic stages are ready',
        disabled: 'Disabled',
        cycleRunning: 'Cycle running',
        armed: 'Armed',
        premarketArmed: 'Premarket armed',
        waitingForMarket: 'Waiting for market',
        pending: 'Pending',
        runFullCycle: 'Run Full Auto Cycle',
        startingPipeline: 'Starting pipeline',
        cycleCompleted: 'Cycle completed',
        pipelineFailed: (stage: string) => `${stage} failed`,
        cycleInterrupted: 'Cycle interrupted',
        ready: 'Ready',
        running: 'Running',
        completed: 'Completed',
        failed: 'Failed',
        stopped: 'Stopped',
        idle: 'Idle',
        preparingPipeline: 'Preparing the seven-stage backend pipeline.',
        cycleStoppedEarly: 'The cycle stopped before completion.',
        allStagesFinished: 'All seven stages finished.',
        readyForBackgroundRun: 'Ready for one complete background run.',
        overall: 'Overall',
        currentStage: 'Current stage',
        elapsed: 'Elapsed',
        progressAria: (progress: number) => `Full auto cycle ${progress}% complete`,
        completedCount: (completed: number, total: number) => `${completed}/${total} complete`,
        backgroundSchedule: 'Background schedule',
        off: 'Off',
        scheduleHelper: 'Market hours only. One background cycle runs at a time.',
        paperAutomation: 'Paper automation',
        liveOrdersAuthorized: 'Live orders authorized',
        liveOrdersLocked: 'Live orders locked',
        paper: 'Paper',
        paperCode: 'PAPER',
        eligibleOrders: 'Eligible limit orders may be submitted after every hard gate passes.',
        fullAiRequired: 'Automatic order submission requires Full AI mode.',
        runTooltip: 'Runs the complete seven-stage chain once in the background. This is not a dry run and does not enable the recurring schedule.',
        fullCycleRunning: 'Full Cycle Running',
        sevenStagesTitle: 'Seven real stages in one backend run.',
        sevenStagesDescription: 'Scanner, Fine Scan, DV, admission, entry planning, eligible limit-order execution, and position protection use the same saved account and risk context.',
        automation: 'Automation',
        newYorkSessionOpen: 'New York session open',
        marketHoursGateActive: 'Market-hours gate active',
        lastCompleted: 'Last completed',
        noCompletedRun: 'No completed run',
        awaitingFirstCycle: 'Awaiting first completed cycle',
        nextEligibleRun: 'Next eligible run',
        enableSchedule: 'Enable a schedule to arm',
        authoritativeSchedule: 'Authoritative backend schedule',
        runsToday: 'Runs today',
        schedulerOnline: 'Headless scheduler online',
        schedulerPending: 'Scheduler status pending',
        savedContext: 'Saved context',
        real: 'REAL',
        riskHorizon: (risk: string, horizon: string) => `${risk} risk / ${horizon} horizon`,
        discordPolicy: 'Discord policy',
        quietAlertsOn: 'Quiet alerts on',
        trades: 'trades',
        recommendations: 'recommendations',
        risk: 'risk',
        digest: 'digest',
        materialEventsOnly: 'material events only',
        noWebhook: 'No webhook delivery',
        lastCycle: 'Last cycle',
        scanner: 'Scanner',
        aiReviewed: 'AI reviewed',
        entryPlans: 'Entry plans',
        positionsChecked: 'Positions checked',
        marketCalendar: 'Market calendar',
        scheduleOff: 'Schedule off',
        next15Days: 'Next 15 days',
        runHistory: 'Run history',
        loaded: (count: number) => `${count} loaded`,
        auditTrail: 'Audit trail',
        earlyClose: 'Early close',
        unknown: 'Unknown',
        scheduled: 'Scheduled',
        noRun: 'No run',
        alpacaCalendar: 'Alpaca Calendar',
        fallbackCalendar: 'Fallback basic hours',
        source: 'Source',
        loadingCalendar: 'Loading market calendar...',
        noCalendarData: 'No market calendar data available.',
        automatic: 'automatic',
        timeUnavailable: 'Time unavailable',
        completedWithoutException: 'Completed without an exception.',
        noStoredCycles: 'No completed auto cycles are stored yet.',
        completedFallback: 'completed',
        pipelineModeSuffix: ' Mode',
        calendarRowAlpaca: 'Alpaca calendar',
        calendarRowFallback: 'Fallback calendar',
        paperTradingStatus: 'PAPER TRADING',
        liveTradingStatus: 'LIVE',
        clear: 'Clear',
        paperAiModeDescription: 'Paper AI mode: approved BUY plans may be submitted automatically. Blocked plans require review.',
        liveAiModeDescription: 'Live AI mode: approved BUY plans may be submitted automatically. Blocked plans require review.',
        noExecutionCandidates: 'No execution candidates',
        executionCandidatesHint: 'Qualified Entry Plan results will appear here for review or submission.',
        waitingForEntryPlan: 'Waiting for Entry Plan',
        riskGateRequired: 'Risk gate required',
        autoSubmitProtected: 'Auto-submit protected',
        openSell: 'Open sell',
        cancel: 'Cancel',
        on: 'On',
        tradingDesk: 'Trading desk',
        portfolioOperations: 'Portfolio Operations',
        assetClass: 'Asset Class',
        costBasis: 'Cost Basis',
        exchange: 'Exchange',
        stageLabels: {} as Record<string, string>,
        autoExecuting: 'Auto Executing',
        holding: 'Holding',
        orderPending: 'Order Pending',
        zoneWait: 'Zone Wait',
        blocked: 'Blocked',
        managedByExitScan: 'Managed by Exit Scan',
        waitingForFill: 'Waiting for Fill',
        watching: 'Watching',
        remove: 'Remove',
        retry: 'Retry',
        runStatusLabels: {} as Record<string, string>,
        calendarStatusLabels: {} as Record<string, string>,
        riskLabels: {} as Record<string, string>,
        horizonLabels: {} as Record<string, string>,
      };
  const agentModalCopy = language === 'zh-CN'
    ? {
        reviewEyebrow: '订单核对',
        executionEyebrow: '计划执行',
        cancelEyebrow: '撤单确认',
        buyOrder: '买入订单',
        liveAccount: '实盘账户',
        paperAccount: '模拟账户',
        recommended: '入场计划建议',
        orderParameters: '订单参数',
        estimateAndRisk: '金额与风控',
        cancellationDetails: '待撤订单',
        cancelDescription: '请确认以下订单仍应撤销。撤单不会平掉已经成交的持仓。',
        planSummary: '执行计划摘要',
        liveFundsNotice: '该操作将使用真实资金；提交前请再次核对代码、数量、价格和风控边界。',
        liveAcceptance: '我已核对标的、数量、价格和保护性退出，并确认使用实盘账户提交该订单。',
        acceptanceRequired: '请先确认已核对实盘订单。',
        mode: '交易环境',
        setup: '交易结构',
        entryZone: '入场区间',
        expectedValue: '预计金额',
        riskBudget: '最大风险',
        protectiveExit: '保护性退出',
      }
    : {
        reviewEyebrow: 'ORDER REVIEW',
        executionEyebrow: 'PLAN EXECUTION',
        cancelEyebrow: 'CANCEL REVIEW',
        buyOrder: 'Buy order',
        liveAccount: 'Live account',
        paperAccount: 'Paper account',
        recommended: 'Entry-plan recommendation',
        orderParameters: 'Order parameters',
        estimateAndRisk: 'Value & risk',
        cancellationDetails: 'Order to cancel',
        cancelDescription: 'Confirm that this order should still be canceled. Canceling does not close any quantity that has already filled.',
        planSummary: 'Execution-plan summary',
        liveFundsNotice: 'This action uses real funds. Recheck the symbol, size, prices, and risk boundaries before submitting.',
        liveAcceptance: 'I reviewed the symbol, size, prices, and protective exits and authorize this order for the live account.',
        acceptanceRequired: 'Review and accept the live-order confirmation before submitting.',
        mode: 'Environment',
        setup: 'Setup',
        entryZone: 'Entry zone',
        expectedValue: 'Estimated value',
        riskBudget: 'Maximum risk',
        protectiveExit: 'Protective exits',
      };
  // AI Agent 状态 - Step 2: 只做 UI，不接真实逻辑
  const [aiConfig, setAiConfig] = useState({
    apiKey: '',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    provider: 'DeepSeek'
  });

  // Real config status from backend /api/config/status
  const [configStatus, setConfigStatus] = useState<{
    ai: boolean;
    aiTestStatus: string;  // not_tested | saved | connected | error
    aiLastTestError: string | null;
    alpaca: boolean;
    finnhub: boolean;
    loaded: boolean;
  }>({ ai: false, aiTestStatus: 'not_tested', aiLastTestError: null, alpaca: false, finnhub: false, loaded: false });

  // ── Persistent Scanner State (from scannerStateStore) ──
  const [scannerSnapshot, setScannerSnapshot] = useState(() => scannerStateStore.getState());

  useEffect(() => {
    const unsubscribe = scannerStateStore.subscribe((state) => {
      setScannerSnapshot(state);
    });
    return unsubscribe;
  }, []);

  // Lazy news fetch: on-demand Alpaca News for expanded scanner symbols.
  const [lazyNewsCache, setLazyNewsCache] = useState<Record<string, any>>({});
  const lazyNewsLoadingSetRef = useRef<Set<string>>(new Set());
  const lazyNewsQueueRef = useRef<string[]>([]);
  const lazyNewsTimerRef = useRef<any>(null);

  const scheduleLazyNews = useCallback((symbol: string) => {
    if (!symbol) return;
    if (lazyNewsCache[symbol] !== undefined) return;
    if (lazyNewsLoadingSetRef.current.has(symbol)) return;
    lazyNewsLoadingSetRef.current.add(symbol);
    lazyNewsQueueRef.current.push(symbol);
    if (!lazyNewsTimerRef.current) {
      lazyNewsTimerRef.current = setTimeout(async () => {
        const queue = [...lazyNewsQueueRef.current];
        lazyNewsQueueRef.current = [];
        lazyNewsTimerRef.current = null;
        for (let i = 0; i < queue.length; i += 1) {
          const sym = queue[i];
          let pauseMs = 350;
          try {
            const res = await pipelineAutoAPI.fetchScannerNews(sym);
            const data = res.data;
            setLazyNewsCache(prev => ({ ...prev, [sym]: data ?? { _error: true } }));
            const retryAfterSeconds = Number(data?.retryAfterSeconds || 0);
            if (retryAfterSeconds > 0) {
              pauseMs = Math.min(Math.max(retryAfterSeconds * 1000, 1000), 70000);
            }
            if (data && !data._error) {
              const currentResults = scannerStateStore.getState().marketScanner.results;
              const idx = currentResults.findIndex((r: any) => r.symbol === sym);
              if (idx >= 0) {
                const updated = [...currentResults];
                updated[idx] = { ...updated[idx],
                  topNews: data.topNews || null, allNews: data.allNews || [],
                  newsCount: data.newsCount || 0, hasNews: data.hasNews || false,
                  newsSentiment: data.newsSentiment ?? updated[idx].newsSentiment,
                  newsScore: data.newsScore ?? updated[idx].newsScore,
                  sentimentScore: data.sentimentScore ?? updated[idx].sentimentScore,
                  eventRisk: data.eventRisk ?? updated[idx].eventRisk,
                  eventTags: data.eventTags ?? updated[idx].eventTags,
                  newsSource: data.newsSource || updated[idx].newsSource,
                  newsFetchReason: data.newsFetchReason || updated[idx].newsFetchReason,
                  dataSources: { ...updated[idx].dataSources, news: data.dataSources?.news || updated[idx].dataSources?.news },
                  provenance: { ...updated[idx].provenance, news: data.provenance?.news || updated[idx].provenance?.news },
                };
                scannerStateStore.setMarketScannerResults(updated);
              }
            }
          } catch { setLazyNewsCache(prev => ({ ...prev, [sym]: { _error: true } })); }
          finally { lazyNewsLoadingSetRef.current.delete(sym); }
          if (i < queue.length - 1) {
            await new Promise(resolve => setTimeout(resolve, pauseMs));
          }
        }
      }, 150);
    }
  }, [lazyNewsCache]);

  // Derive human-readable no-news reason
  const getNewsEmptyReason = (record: any): string => {
    const reason = record.newsFetchReason || '';
    const source = record.newsSource || '';
    const dsNews = record.dataSources?.news || '';
    if (reason === 'no_news_last_7d') return agentText('No Alpaca news found in the last 7 days.', '最近 7 天没有可用的 Alpaca 新闻。');
    if (reason === 'alpaca_news_not_configured' || reason === 'finnhub_not_configured') return agentText('Alpaca market data keys are not configured for news.', '尚未配置用于新闻服务的 Alpaca 市场数据密钥。');
    if (reason.includes('alpaca_news_rate_limited') || reason.includes('alpaca_news_http_429') || reason === 'finnhub_rate_limited') return agentText('Alpaca News is rate limited. The scanner waits about 60 seconds before retrying.', 'Alpaca 新闻服务已触发频率限制，扫描器将在约 60 秒后重试。');
    if (reason.includes('alpaca_news') || reason === 'finnhub_news_api_failed') return agentText('Alpaca News request failed. Check API key, quota, or backend logs.', 'Alpaca 新闻请求失败，请检查 API 密钥、额度或后台日志。');
    if (reason === 'news_fetch_skipped_top_n_limit') return agentText('News fetch queued for this symbol. Open the row to fetch Alpaca News.', '该标的已进入新闻获取队列，展开此行即可加载新闻。');
    if (reason === 'news_fetched') return agentText('News metadata was fetched, but no displayable headline was available.', '新闻元数据已获取，但暂时没有可显示的标题。');
    const combo = [source, dsNews].join(' ').toLowerCase();
    if (combo.includes('no news in 7d')) return agentText('No Alpaca news found in the last 7 days.', '最近 7 天没有可用的 Alpaca 新闻。');
    if (combo.includes('rate limit') || combo.includes('429')) return agentText('Alpaca News is rate limited. The scanner waits about 60 seconds before retrying.', 'Alpaca 新闻服务已触发频率限制，扫描器将在约 60 秒后重试。');
    if (combo.includes('not configured')) return agentText('Alpaca market data keys are not configured for news.', '尚未配置用于新闻服务的 Alpaca 市场数据密钥。');
    if (combo.includes('error')) return agentText('Alpaca News request failed. Check API key, quota, or backend logs.', 'Alpaca 新闻请求失败，请检查 API 密钥、额度或后台日志。');
    if (combo.includes('below top candidate')) return agentText('News fetch queued for this symbol. Open the row to fetch Alpaca News.', '该标的已进入新闻获取队列，展开此行即可加载新闻。');
    return agentText('No market news available for this symbol.', '该标的暂无可用的市场新闻。');
  };

  // Hydrate from store on mount — use module-level checks to detect page refresh vs route change
  useEffect(() => {
    const state = scannerStateStore.getState();

    // Market Scanner: only reset if status says running but no module-level loop exists
    if (state.marketScanner.status === 'running' && !isScanRunning()) {
      scannerStateStore.updateMarketScanner({
        status: 'stopped', currentStatus: 'idle',
        detailedScanStatus: { ...state.marketScanner.detailedScanStatus, currentStatus: 'stopped', statusMessage: 'Scan interrupted by page refresh. Results preserved.' },
      });
    }
    // Fine Scan: only reset if status says running but no module-level loop exists
    if (state.fineScan.status === 'running' && !isFineScanRunning()) {
      scannerStateStore.updateFineScan({ status: 'stopped', message: 'Scan interrupted by page refresh. Results preserved.' });
    }
    // Deeper Validation: only reset if status says loading but no module-level loop exists
    if (state.deeperValidation.status === 'loading' && !isDeeperValidationRunning()) {
      scannerStateStore.updateDeeperValidation({ status: 'stopped' });
    }
    // Entry Plan: only reset if status says loading but no module-level loop exists
    if (state.entryPlan.status === 'loading' && !isEntryPlanRunning()) {
      scannerStateStore.updateEntryPlan({ status: 'stopped' });
    }
    // On route change: module-level loops continue in background, store keeps updating
  }, []);

  // Derived state from store (backward-compatible names)
  const marketScannerStatus = scannerSnapshot.marketScanner;
  const marketScannerResults = scannerSnapshot.marketScanner.results;
  const fineScanStatus = scannerSnapshot.fineScan.status;
  const fineScanResults = scannerSnapshot.fineScan.results;
  const fineScanProgress = scannerSnapshot.fineScan.progress;
  const fineScanMessage = scannerSnapshot.fineScan.message;
  const fineScanCurrentStep = scannerSnapshot.fineScan.currentStep;
  const fineScanExpandedRows = scannerSnapshot.fineScan.expandedRows;

  // Deeper Validation and Entry Plan from store
  const deeperValidationStatus = scannerSnapshot.deeperValidation.status;
  const deeperValidationResults = scannerSnapshot.deeperValidation.results;
  const admissionStatus = scannerSnapshot.admission.status;
  const admissionResults = scannerSnapshot.admission.results;
  const admissionSummary = scannerSnapshot.admission.summary;
  const entryPlanStatus = scannerSnapshot.entryPlan.status;
  const entryPlanResults = scannerSnapshot.entryPlan.results;

  // Exit Scan from store
  const exitScanStatus = scannerSnapshot.exitScan.status;
  const exitScanResults = scannerSnapshot.exitScan.results;
  const submittedExitOrders = scannerSnapshot.exitScan.submittedExitOrders;
  const exitScanSummary = scannerSnapshot.exitScan.summary || {};

  // Setter wrappers that update the store
  const setFineScanStatus = useCallback((status: any) => {
    scannerStateStore.updateFineScan({ status });
  }, []);

  const setFineScanResults = useCallback((results: any) => {
    const next = typeof results === 'function' ? results(scannerStateStore.getState().fineScan.results) : results;
    scannerStateStore.setFineScanResults(next);
  }, []);

  const setFineScanProgress = useCallback((progress: number) => {
    scannerStateStore.updateFineScan({ progress });
  }, []);

  const setFineScanStepProgress = useCallback((stepProgress: number) => {
    scannerStateStore.updateFineScan({ stepProgress });
  }, []);

  const setFineScanCurrentStep = useCallback((currentStep: string) => {
    scannerStateStore.updateFineScan({ currentStep });
  }, []);

  const setFineScanMessage = useCallback((message: string) => {
    scannerStateStore.updateFineScan({ message });
  }, []);

  const setFineScanExpandedRows = useCallback((rows: any) => {
    const next = typeof rows === 'function' ? rows(scannerStateStore.getState().fineScan.expandedRows) : rows;
    scannerStateStore.updateFineScan({ expandedRows: next });
  }, []);

  // Deeper Validation store-backed setters
  const setDeeperValidationStatus = useCallback((status: any) => {
    scannerStateStore.updateDeeperValidation({ status });
  }, []);

  const setDeeperValidationResults = useCallback((results: any) => {
    const next = typeof results === 'function' ? results(scannerStateStore.getState().deeperValidation.results) : results;
    scannerStateStore.setDeeperValidationResults(next);
  }, []);

  // Entry Plan store-backed setters
  const setEntryPlanStatus = useCallback((status: any) => {
    scannerStateStore.updateEntryPlan({ status });
  }, []);

  const setEntryPlanResults = useCallback((results: any) => {
    const next = typeof results === 'function' ? results(scannerStateStore.getState().entryPlan.results) : results;
    scannerStateStore.setEntryPlanResults(next);
  }, []);

  // Exit Scan store-backed setters
  const setExitScanStatus = useCallback((status: any) => {
    scannerStateStore.updateExitScan({ status });
  }, []);

  const setExitScanResults = useCallback((results: any) => {
    const next = typeof results === 'function' ? results(scannerStateStore.getState().exitScan.results) : results;
    scannerStateStore.setExitScanResults(next);
  }, []);

  // Trading Account Mode (global context)
  const { tradeMode } = useTradeMode();
  const [tradingAccountData, setTradingAccountData] = useState<any>(null);
  const [tradingAccountLoading, setTradingAccountLoading] = useState(false);

  // Trading Preferences (local to AI Agent, persisted in localStorage)
  type RiskProfile = 'low' | 'medium' | 'high';
  type TimeHorizon = 'short' | 'mid' | 'long';
  const [riskProfile, setRiskProfile] = useState<RiskProfile>(() => {
    const stored = readAccountStorage('agent_riskProfile', accountUserId);
    return (stored === 'low' || stored === 'high') ? stored : 'medium';
  });
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>(() => {
    const stored = readAccountStorage('agent_timeHorizon', accountUserId);
    return (stored === 'short' || stored === 'long') ? stored : 'mid';
  });
  const [leverageEnabled, setLeverageEnabled] = useState<boolean>(() => (
    readAccountStorage('agent_leverageEnabled', accountUserId) === 'true'
  ));
  const handleRiskProfileChange = (val: string | number) => {
    const v = val as RiskProfile;
    const disableLeverage = v !== 'high';
    setRiskProfile(v);
    writeAccountStorage('agent_riskProfile', accountUserId, v);
    if (disableLeverage) {
      setLeverageEnabled(false);
      writeAccountStorage('agent_leverageEnabled', accountUserId, 'false');
    }
    void workspacePreferencesAPI.update({
      riskProfile: v,
      ...(disableLeverage ? { leverageEnabled: false } : {}),
    }).catch(() => {
      message.error(agentText('Risk preference could not be saved.', '风险偏好保存失败。'));
    });
  };
  const handleTimeHorizonChange = (val: string | number) => {
    const v = val as TimeHorizon;
    const disableLeverage = v !== 'short';
    setTimeHorizon(v);
    writeAccountStorage('agent_timeHorizon', accountUserId, v);
    if (disableLeverage) {
      setLeverageEnabled(false);
      writeAccountStorage('agent_leverageEnabled', accountUserId, 'false');
    }
    void workspacePreferencesAPI.update({
      timeHorizon: v,
      ...(disableLeverage ? { leverageEnabled: false } : {}),
    }).catch(() => {
      message.error(agentText('Time-horizon preference could not be saved.', '持仓周期偏好保存失败。'));
    });
  };
  const handleLeverageEnabledChange = (enabled: boolean) => {
    if (enabled && (riskProfile !== 'high' || timeHorizon !== 'short')) {
      message.warning(agentText(
        'The leveraged sleeve is available only with High risk and Short horizon.',
        '杠杆仓位仅在“高风险 + 短周期”组合下可用。',
      ));
      return;
    }
    setLeverageEnabled(enabled);
    writeAccountStorage('agent_leverageEnabled', accountUserId, String(enabled));
    void workspacePreferencesAPI.update({ leverageEnabled: enabled }).catch(() => {
      message.error(agentText('Leverage preference could not be saved.', '杠杆偏好保存失败。'));
    });
  };

  // Order Modal state
  const [orderModalVisible, setOrderModalVisible] = useState(false);
  const [orderModalPreset, setOrderModalPreset] = useState<{
    symbol?: string;
    side?: 'buy' | 'sell';
    qty?: number;
    limitPrice?: number;
    takeProfitPrice?: number;
    stopLossPrice?: number;
  } | undefined>(undefined);

  // Portfolio Performance state
  const [_portfolioHistoryData, setPortfolioHistoryData] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [_portfolioHistoryLoading, setPortfolioHistoryLoading] = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [portfolioHistoryRange, _setPortfolioHistoryRange] = useState<string>('1M'); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [_portfolioHistorySummary, setPortfolioHistorySummary] = useState<{ // eslint-disable-line @typescript-eslint/no-unused-vars
    totalChange?: number;
    totalChangePct?: number;
    firstValue?: number;
    lastValue?: number;
  }>({});

  // AI Watchlist state
  const [aiWatchlistItems, setAiWatchlistItems] = useState<any[]>([]);
  const aiWatchlistItemsRef = useRef<any[]>([]);
  const [aiWatchlistLoading, setAiWatchlistLoading] = useState(false);
  const [aiWatchlistAutoRefresh, _setAiWatchlistAutoRefresh] = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [_aiWatchlistCountdown, setAiWatchlistCountdown] = useState(60); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [aiWatchlistSearch, setAiWatchlistSearch] = useState('');
  const aiWatchlistTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // AI Auto Pipeline state
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const pipelineRunningRef = useRef(false);
  const [pipelineStage, setPipelineStage] = useState<string>('idle');
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const pipelineStopRequestedRef = useRef(false);
  const holdingsRef = useRef<any[]>([]);

  // Keep ref in sync with state for timer callbacks
  useEffect(() => { pipelineRunningRef.current = pipelineRunning; }, [pipelineRunning]);

  const [aiExecutionList, setAiExecutionList] = useState<any[]>(() => {
    try {
      const restored = scannerStateStore.getAiExecutionCandidates();
      const removedSet = new Set(scannerStateStore.getRemovedExecutionSymbols());
      return restored
        .filter((item: any) => !removedSet.has(String(item.symbol || '').toUpperCase()))
        .map((item: any) => {
          // Convert stale auto_executing to failed — the promise is gone after refresh
          if (item.executionStatus === 'auto_executing') {
            return { ...item, executionStatus: 'failed', executionError: 'Execution interrupted by page refresh' };
          }
          return item;
        });
    } catch { return []; }
  });
  const [pipelineMode, setPipelineMode] = useState<'ai' | 'hybrid' | 'manual'>(() => {
    const saved = readAccountStorage('pipelineMode', accountUserId);
    return saved === 'ai' || saved === 'hybrid' || saved === 'manual' ? saved : 'hybrid';
  });
  const handlePipelineModeChange = (value: string | number) => {
    const nextMode = value as 'ai' | 'hybrid' | 'manual';
    setPipelineMode(nextMode);
    writeAccountStorage('pipelineMode', accountUserId, nextMode);
    void workspacePreferencesAPI.update({ pipelineMode: nextMode }).catch(() => {
      message.error(agentText('Pipeline mode could not be saved.', '流程模式保存失败。'));
    });
  };

  const riskMandate = {
    low: { deploymentPct: 30, grossPct: 35, singlePct: 8, riskPerTradePct: 0.5, dailyStopPct: 1.5, positions: 8 },
    medium: { deploymentPct: 50, grossPct: 60, singlePct: 15, riskPerTradePct: 1.0, dailyStopPct: 2.5, positions: 10 },
    high: { deploymentPct: 100, grossPct: leverageEnabled && timeHorizon === 'short' ? 115 : 100, singlePct: 100, riskPerTradePct: 1.5, dailyStopPct: 4.0, positions: 12 },
  }[riskProfile];
  const horizonMandate = {
    short: { holding: agentText('1–5 trading days', '1–5 个交易日'), reviewDays: 3, timeStopDays: 5, maxStopPct: 5, targetR: 1.5, focus: agentText('Momentum, liquidity and fresh catalysts', '动量、流动性与最新催化因素') },
    mid: { holding: agentText('2–8 weeks', '2–8 周'), reviewDays: 20, timeStopDays: 40, maxStopPct: 9, targetR: 1.8, focus: agentText('Trend quality, relative strength and catalysts', '趋势质量、相对强度与催化因素') },
    long: { holding: agentText('3–12 months', '3–12 个月'), reviewDays: 60, timeStopDays: 180, maxStopPct: 15, targetR: 2.2, focus: agentText('Durable trend, quality and long-term strength', '长期趋势、基本质量与持续强度') },
  }[timeHorizon];
  const aiMandate = {
    manual: { label: agentText('Manual', '手动'), research: false, selection: false, buy: false, scaleIn: false, reduce: false, sell: false, approval: true },
    hybrid: { label: agentText('AI assisted', 'AI 辅助'), research: true, selection: false, buy: false, scaleIn: false, reduce: false, sell: false, approval: true },
    ai: { label: agentText('Full AI', '全 AI'), research: true, selection: true, buy: true, scaleIn: true, reduce: true, sell: true, approval: false },
  }[pipelineMode];
  const leverageAvailable = riskProfile === 'high' && timeHorizon === 'short';
  const strategyMandate = {
    ...riskMandate,
    ...horizonMandate,
    ...aiMandate,
    leverageActive: leverageAvailable && leverageEnabled,
    optionsAllowed: false,
  };

  const [pipelineSchedule, setPipelineSchedule] = useState<'off' | '15m' | '30m' | '1h' | '2h'>(() => {
    const saved = readAccountStorage('pipelineSchedule', accountUserId);
    return saved === '15m' || saved === '30m' || saved === '1h' || saved === '2h' ? saved : 'off';
  });
  // Ref: only sync pipelineSchedule from backend on first successful status fetch
  const initialAutoSyncRef = useRef(true);

  // Pipeline Auto (market-hours scheduler) state
  // Unattended live orders require a separate explicit authorization. Paper
  // automation remains available without this switch.
  const [liveAutoTradingEnabled, setLiveAutoTradingEnabled] = useState(false);
  const [liveAutoConfirmOpen, setLiveAutoConfirmOpen] = useState(false);
  const [liveAutoRiskAccepted, setLiveAutoRiskAccepted] = useState(false);
  const shouldAutoConfirmOrder = pipelineMode === 'ai' && (
    tradeMode === 'paper' || liveAutoTradingEnabled
  );
  const [pipelineAutoStatus, setPipelineAutoStatus] = useState<any>(null);
  const pipelineAutoStatusRef = useRef<any>(null);
  useEffect(() => { pipelineAutoStatusRef.current = pipelineAutoStatus; }, [pipelineAutoStatus]);
  // Auto-run background display state — separate from manual pipeline state
  const [autoRunActive, setAutoRunActive] = useState(false);
  const [autoRunStep, setAutoRunStep] = useState('');
  const [autoRunProgress, setAutoRunProgress] = useState(0);
  const [autoRunRequestedId, setAutoRunRequestedId] = useState('');
  const [autoRunClock, setAutoRunClock] = useState(Date.now());
  const [pipelineAutoLoading, setPipelineAutoLoading] = useState(false);
  const runAutoNowInFlightRef = useRef(false);
  const [pipelineAutoHistory, setPipelineAutoHistory] = useState<any[]>([]);
  const [pipelineAutoHistoryExpanded, setPipelineAutoHistoryExpanded] = useState(false);
  const [pipelineAutoSchedule, setPipelineAutoSchedule] = useState<any[] | null>(null);
  const [pipelineAutoScheduleSource, setPipelineAutoScheduleSource] = useState<string>('');
  const [pipelineAutoScheduleWarning, setPipelineAutoScheduleWarning] = useState<string>('');
  const [pipelineAutoScheduleLoading, setPipelineAutoScheduleLoading] = useState(false);
  const [pipelineAutoScheduleExpanded, setPipelineAutoScheduleExpanded] = useState(false);
  const [pipelineAutoScheduleError, setPipelineAutoScheduleError] = useState<string>('');

  // Never carry one account's operational choices into another account's UI.
  // The durable backend status fetched below remains authoritative; these
  // account-scoped values only prevent an empty-state flash while it loads.
  useEffect(() => {
    initialAutoSyncRef.current = true;
    pipelineAutoStatusRef.current = null;
    setPipelineAutoStatus(null);

    const cachedRisk = readAccountStorage('agent_riskProfile', accountUserId);
    const cachedHorizon = readAccountStorage('agent_timeHorizon', accountUserId);
    const cachedMode = readAccountStorage('pipelineMode', accountUserId);
    const cachedSchedule = readAccountStorage('pipelineSchedule', accountUserId);

    setRiskProfile(cachedRisk === 'low' || cachedRisk === 'high' ? cachedRisk : 'medium');
    setTimeHorizon(cachedHorizon === 'short' || cachedHorizon === 'long' ? cachedHorizon : 'mid');
    setLeverageEnabled(readAccountStorage('agent_leverageEnabled', accountUserId) === 'true');
    setPipelineMode(cachedMode === 'ai' || cachedMode === 'manual' ? cachedMode : 'hybrid');
    setPipelineSchedule(
      cachedSchedule === '15m' || cachedSchedule === '30m' || cachedSchedule === '1h' || cachedSchedule === '2h'
        ? cachedSchedule
        : 'off',
    );
  }, [accountUserId]);

  const fetchPipelineAutoStatus = useCallback(async () => {
    try {
      const res = await pipelineAutoAPI.getStatus();
      if (res.data.success) {
        setPipelineAutoStatus(res.data);
        return res.data;
      }
    } catch {
      // Backend may not be available
    }
    return null;
  }, []);

  const fetchPipelineAutoHistory = useCallback(async () => {
    try {
      const res = await pipelineAutoAPI.getHistory(5);
      if (res.data.success) {
        setPipelineAutoHistory(res.data.history);
      }
    } catch {
      // Silently ignore
    }
  }, []);

  const fetchPipelineAutoSchedule = useCallback(async () => {
    setPipelineAutoScheduleLoading(true);
    setPipelineAutoScheduleError('');
    try {
      const res = await pipelineAutoAPI.getMarketSchedule(15);
      if (res.data.success) {
        setPipelineAutoSchedule(res.data.days || []);
        setPipelineAutoScheduleSource(res.data.source || '');
        setPipelineAutoScheduleWarning(res.data.warning
          ? agentErrorText(
              res.data.warning,
              res.data.warning,
              '市场日程正在使用备用来源，显示时间可能稍有延迟。',
            )
          : '');
      } else {
        setPipelineAutoSchedule([]);
        setPipelineAutoScheduleError(agentErrorText(
          (res.data as any).message || (res.data as any).error,
          'The market schedule could not be loaded.',
          '暂时无法读取市场日程。',
        ));
      }
    } catch (err: any) {
      setPipelineAutoSchedule([]);
      setPipelineAutoScheduleError(agentErrorText(
        err?.response?.data?.message || err?.message,
        'The market schedule could not be loaded.',
        '暂时无法读取市场日程。',
      ));
    } finally {
      setPipelineAutoScheduleLoading(false);
    }
  }, [agentErrorText]);

  // Fetch schedule when expanded
  useEffect(() => {
    if (pipelineAutoScheduleExpanded) {
      fetchPipelineAutoSchedule();
    }
  }, [pipelineAutoScheduleExpanded, fetchPipelineAutoSchedule]);

  // Save pipeline-auto config when schedule changes
  const savePipelineAutoConfig = useCallback(async (schedule: 'off' | '15m' | '30m' | '1h' | '2h') => {
    setPipelineAutoLoading(true);
    // Mark user as having interacted — initial sync effect should not overwrite this
    initialAutoSyncRef.current = false;
    const prevSchedule = pipelineSchedule;
    try {
      const enabled = schedule !== 'off';
      const intervalMap: Record<string, number> = { '15m': 15, '30m': 30, '1h': 60, '2h': 120 };
      const res = await pipelineAutoAPI.saveConfig({
        enabled,
        intervalMinutes: enabled ? intervalMap[schedule] : null,
        mode: pipelineMode,
        riskProfile,
        timeHorizon,
        tradeMode,
        leverageEnabled,
      });
      if (!res?.data?.success) {
        const reason = res?.data?.reason || res?.data?.message || 'Unknown error';
        throw new Error('Save failed: ' + reason);
      }
      console.log('[PipelineAutoFrontend] save config response enabled=%s', enabled);

      // Save succeeded — sync from backend status to get truth
      const statusData = await fetchPipelineAutoStatus();
      const intervalToKey: Record<number, '15m' | '30m' | '1h' | '2h'> = { 15: '15m', 30: '30m', 60: '1h', 120: '2h' };
      const backendEnabled = statusData?.enabled === true;
      const newSchedule = backendEnabled && statusData?.intervalMinutes
        ? (intervalToKey[statusData.intervalMinutes] || 'off')
        : 'off';
      setPipelineSchedule(newSchedule);
      writeAccountStorage('pipelineSchedule', accountUserId, newSchedule);
      const marketOpen = statusData?.marketOpen === true;
      if (enabled && prevSchedule === 'off' && marketOpen) {
        console.log('[AutoRun] Toggle-on: backend scheduler armed during market hours');
      } else if (enabled && prevSchedule === 'off' && !marketOpen) {
        console.log('[AutoRun] Toggle-on: armed but market closed — waiting for next market open');
      }
    } catch (err: any) {
      // Show specific error message based on backend reason
      const errMsg = err?.message || '';
      let displayMsg = 'Failed to save Market Auto Run setting.';
      if (errMsg.includes('missing_table')) {
        displayMsg = 'Failed to save: Supabase table missing. Please run the database migration.';
      } else if (errMsg.includes('missing_column')) {
        displayMsg = 'Failed to save: database schema mismatch. Please run the database migration.';
      } else if (errMsg.includes('rls_blocked')) {
        displayMsg = 'Failed to save: database permission denied.';
      } else if (errMsg.includes('upsert_conflict')) {
        displayMsg = 'Failed to save: duplicate configuration conflict.';
      } else if (errMsg.includes('service_role_missing')) {
        displayMsg = 'Failed to save: backend service role key not configured.';
      } else if (errMsg.includes('schema_mismatch')) {
        displayMsg = 'Failed to save: database schema mismatch. Please run the database migration.';
      } else if (errMsg.includes('supabase_write_failed')) {
        displayMsg = 'Failed to save: database write error. Check backend logs.';
      } else if (errMsg.includes('Save failed:')) {
        displayMsg = errMsg;
      }
      message.error(displayMsg);
      // Rollback: fetch backend truth and force-sync the toggle
      const statusData = await fetchPipelineAutoStatus();
      if (statusData) {
        const intervalToKey: Record<number, '15m' | '30m' | '1h' | '2h'> = { 15: '15m', 30: '30m', 60: '1h', 120: '2h' };
        const backendEnabled = statusData.enabled === true;
        const newSchedule = backendEnabled && statusData.intervalMinutes
          ? (intervalToKey[statusData.intervalMinutes] || 'off')
          : 'off';
        setPipelineSchedule(newSchedule);
        writeAccountStorage('pipelineSchedule', accountUserId, newSchedule);
        console.log('[PipelineAutoConfig] rollback toggle to backend state: enabled=%s schedule=%s', backendEnabled, newSchedule);
      }
    } finally {
      setPipelineAutoLoading(false);
    }
  }, [accountUserId, pipelineMode, fetchPipelineAutoStatus, pipelineSchedule, riskProfile, timeHorizon, tradeMode, leverageEnabled]);

  const persistLiveAutoTrading = useCallback(async (nextValue: boolean) => {
    setPipelineAutoLoading(true);
    try {
      const response = await pipelineAutoAPI.setLiveAuthority(nextValue);
      if (!response?.data?.success) {
        throw new Error(response?.data?.message || 'Live automation authority could not be saved.');
      }

      // The switch follows persisted backend truth. Do not optimistically show
      // live authority before broker verification and database persistence pass.
      setLiveAutoTradingEnabled(response.data.liveAutoTradingEnabled === true);
      await fetchPipelineAutoStatus();
      return true;
    } catch (err: any) {
      const backendMessage = err?.response?.data?.message;
      const backendReason = err?.response?.data?.reason;
      const fallback = nextValue
        ? agentText(
            'Live automation could not be authorized. Check the live Alpaca connection and try again.',
            '无法授权真实自动交易。请检查 Alpaca 实盘连接后重试。',
          )
        : agentText(
            'Live automation authority could not be revoked. Please try again.',
            '无法撤销真实自动交易授权。请重试。',
          );
      message.error(backendMessage || (backendReason ? `${fallback} (${backendReason})` : fallback));

      // Re-read the authoritative value so a failed request cannot leave the
      // control visually out of sync with server-side order authority.
      const status = await fetchPipelineAutoStatus();
      if (status) setLiveAutoTradingEnabled(status.liveAutoTradingEnabled === true);
      return false;
    } finally {
      setPipelineAutoLoading(false);
    }
  }, [agentText, fetchPipelineAutoStatus]);

  const closeLiveAutoConfirmation = () => {
    if (pipelineAutoLoading) return;
    setLiveAutoConfirmOpen(false);
    setLiveAutoRiskAccepted(false);
  };

  const confirmLiveAutoTrading = async () => {
    if (!liveAutoRiskAccepted) return;
    const saved = await persistLiveAutoTrading(true);
    if (saved) {
      setLiveAutoConfirmOpen(false);
      setLiveAutoRiskAccepted(false);
    }
  };

  const handleLiveAutoTradingToggle = (checked: boolean) => {
    if (!checked) {
      setLiveAutoConfirmOpen(false);
      setLiveAutoRiskAccepted(false);
      void persistLiveAutoTrading(false);
      return;
    }
    setLiveAutoRiskAccepted(false);
    setLiveAutoConfirmOpen(true);
  };

  // Auto-save config when mode/risk/horizon/trade changes and schedule is enabled
  const autoSaveTimerRef = useRef<any>(null);
  const autoSaveRequestRef = useRef(0);
  const prevAutoSaveRef = useRef<{ mode: string; risk: string; horizon: string; trade: string; leverage: boolean }>({ mode: '', risk: '', horizon: '', trade: '', leverage: false });
  useEffect(() => {
    if (pipelineSchedule === 'off') return;
    const current = { mode: pipelineMode, risk: riskProfile, horizon: timeHorizon, trade: tradeMode, leverage: leverageEnabled };
    const prev = prevAutoSaveRef.current;
    if (current.mode === prev.mode && current.risk === prev.risk && current.horizon === prev.horizon && current.trade === prev.trade && current.leverage === prev.leverage) return;
    prevAutoSaveRef.current = current;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    const requestId = ++autoSaveRequestRef.current;
    autoSaveTimerRef.current = setTimeout(async () => {
      const intervalMap: Record<string, number> = { '15m': 15, '30m': 30, '1h': 60, '2h': 120 };
      const payload = {
        enabled: true,
        intervalMinutes: intervalMap[pipelineSchedule] || 15,
        mode: pipelineMode,
        riskProfile,
        timeHorizon,
        tradeMode,
        leverageEnabled,
      };
      const backendMatches = (status: any) => Boolean(status)
        && status.enabled === true
        && Number(status.intervalMinutes) === payload.intervalMinutes
        && status.mode === payload.mode
        && status.riskProfile === payload.riskProfile
        && status.timeHorizon === payload.timeHorizon
        && status.tradeMode === payload.tradeMode
        && status.leverageEnabled === payload.leverageEnabled;
      try {
        let response;
        try {
          response = await pipelineAutoAPI.saveConfig(payload);
        } catch {
          // A short retry absorbs a transient Render/Supabase wake-up without
          // showing a false warning for settings that ultimately persisted.
          await new Promise((resolve) => setTimeout(resolve, 500));
          if (requestId !== autoSaveRequestRef.current) return;
          response = await pipelineAutoAPI.saveConfig(payload);
        }
        if (requestId !== autoSaveRequestRef.current) return;
        if (!response?.data?.success) throw new Error(response?.data?.message || 'save_failed');

        const status = await fetchPipelineAutoStatus();
        if (requestId !== autoSaveRequestRef.current) return;
        if (!backendMatches(status)) throw new Error('scheduler_status_mismatch');
      } catch {
        if (requestId !== autoSaveRequestRef.current) return;
        // The save response can be lost after the backend commits. Confirm the
        // authoritative status before telling the user that sync failed.
        const status = await fetchPipelineAutoStatus();
        if (requestId !== autoSaveRequestRef.current || backendMatches(status)) return;
        message.warning(agentText(
          'Automation settings could not be synced. The scheduler may still have the previous settings.',
          '自动化设置同步失败，调度器可能仍在使用上一次的设置。',
        ));
      }
    }, 600);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [agentText, fetchPipelineAutoStatus, pipelineMode, riskProfile, timeHorizon, tradeMode, pipelineSchedule, leverageEnabled]);

  // Initial fetch: always fetch pipeline-auto status on mount to correct stale localStorage
  useEffect(() => {
    fetchPipelineAutoStatus();
  }, [accountUserId, fetchPipelineAutoStatus]);

  // Restore all operational settings from the authenticated user's durable
  // backend config. Local storage is only a fast UI cache.
  useEffect(() => {
    if (!pipelineAutoStatus || !initialAutoSyncRef.current) return;
    initialAutoSyncRef.current = false;
    const backendEnabled = pipelineAutoStatus.enabled === true;
    const intervalToKey: Record<number, '15m' | '30m' | '1h' | '2h'> = { 15: '15m', 30: '30m', 60: '1h', 120: '2h' };
    const key = backendEnabled && pipelineAutoStatus.intervalMinutes ? intervalToKey[pipelineAutoStatus.intervalMinutes] : null;
    const newSchedule = key || 'off';
    const savedMode = pipelineAutoStatus.mode;
    const savedRisk = pipelineAutoStatus.riskProfile;
    const savedHorizon = pipelineAutoStatus.timeHorizon;
    const savedLeverage = pipelineAutoStatus.leverageEnabled === true;
    if (savedMode === 'ai' || savedMode === 'hybrid' || savedMode === 'manual') {
      setPipelineMode(savedMode);
      writeAccountStorage('pipelineMode', accountUserId, savedMode);
    }
    if (savedRisk === 'low' || savedRisk === 'medium' || savedRisk === 'high') {
      setRiskProfile(savedRisk);
      writeAccountStorage('agent_riskProfile', accountUserId, savedRisk);
    }
    if (savedHorizon === 'short' || savedHorizon === 'mid' || savedHorizon === 'long') {
      setTimeHorizon(savedHorizon);
      writeAccountStorage('agent_timeHorizon', accountUserId, savedHorizon);
    }
    setLeverageEnabled(savedLeverage);
    writeAccountStorage('agent_leverageEnabled', accountUserId, String(savedLeverage));
    setPipelineSchedule(newSchedule);
    setLiveAutoTradingEnabled(pipelineAutoStatus.liveAutoTradingEnabled === true);
    writeAccountStorage('pipelineSchedule', accountUserId, newSchedule);
    console.log('[PipelineAutoConfig] initial sync from backend: enabled=%s interval=%s schedule=%s',
      backendEnabled, pipelineAutoStatus.intervalMinutes, newSchedule);
  }, [accountUserId, pipelineAutoStatus]);

  // Poll slowly while scheduled and quickly during a one-shot/background run.
  useEffect(() => {
    if (pipelineSchedule === 'off' && !autoRunActive && !autoRunRequestedId) return;
    fetchPipelineAutoStatus();
    const id = setInterval(fetchPipelineAutoStatus, autoRunActive || autoRunRequestedId ? 1500 : 15000);
    return () => clearInterval(id);
  }, [pipelineSchedule, autoRunActive, autoRunRequestedId, fetchPipelineAutoStatus]);

  // Track background auto-run status from activeRun (display only, never touches scannerStateStore)
  // Only auto triggers (not manual) affect autoRunActive state
  useEffect(() => {
    const activeRun = pipelineAutoStatus?.activeRun;
    const isMatchingRequestedRun = Boolean(autoRunRequestedId && activeRun?.runId === autoRunRequestedId);
    const isAutoRun = Boolean(activeRun && AUTO_PIPELINE_TRIGGERS.has(activeRun.trigger || ''));
    if (activeRun?.status === 'running' && isAutoRun) {
      setAutoRunActive(true);
      setAutoRunStep(activeRun.currentStep || 'market_scanner');
      setAutoRunProgress(activeRun.progressPct || 0);
      return;
    }
    if (isMatchingRequestedRun && ['completed', 'failed', 'stopped', 'interrupted'].includes(activeRun?.status)) {
      setAutoRunActive(false);
      setAutoRunStep(activeRun.currentStep || '');
      setAutoRunProgress(activeRun.status === 'completed' ? 100 : activeRun.progressPct || 0);
      setAutoRunRequestedId('');
      fetchPipelineAutoHistory();
      return;
    }
    if (!autoRunRequestedId) {
      setAutoRunActive(false);
      setAutoRunStep('');
      setAutoRunProgress(0);
    }
  }, [pipelineAutoStatus?.activeRun, autoRunRequestedId, fetchPipelineAutoHistory]);

  useEffect(() => {
    if (!autoRunActive) return;
    setAutoRunClock(Date.now());
    const id = setInterval(() => setAutoRunClock(Date.now()), 1000);
    return () => clearInterval(id);
  }, [autoRunActive]);

  // Fetch history when expanded
  useEffect(() => {
    if (pipelineAutoHistoryExpanded) {
      fetchPipelineAutoHistory();
    }
  }, [pipelineAutoHistoryExpanded, fetchPipelineAutoHistory]);

  // Current Holding state
  const [holdings, setHoldings] = useState<any[]>([]);
  const [holdingsLoading, setHoldingsLoading] = useState(false);
  const [holdingsError, setHoldingsError] = useState<string | null>(null);
  const [openSellOrders, setOpenSellOrders] = useState<any[]>([]);
  const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null);

  const fetchHoldings = useCallback(async (mode?: 'paper' | 'real') => {
    const m = mode || tradeMode;
    setHoldingsLoading(true);
    setHoldingsError(null);
    try {
      const [posRes, ordersRes] = await Promise.allSettled([
        tradingAccountAPI.getPositions(m),
        tradingAccountAPI.getOrders(m, 'open'),
      ]);

      let positions: any[] = [];
      if (posRes.status === 'fulfilled' && posRes.value.data.success) {
        positions = posRes.value.data.positions || [];
      } else if (posRes.status === 'fulfilled') {
        setHoldingsError(agentErrorText(
          posRes.value.data.error,
          'Configure Alpaca API in Settings to load positions.',
          '暂时无法读取持仓，请在设置中检查 Alpaca 连接。',
        ));
      } else {
        setHoldingsError(agentText(
          'Configure Alpaca API in Settings to load positions.',
          '暂时无法读取持仓，请在设置中检查 Alpaca 连接。',
        ));
      }

      // Collect open sell orders
      let sellOrders: any[] = [];
      if (ordersRes.status === 'fulfilled' && ordersRes.value.data.success) {
        const allOrders = ordersRes.value.data.orders || [];
        sellOrders = allOrders.filter((o: any) => o.side === 'sell');
      }

      // Filter out positions that have a filled sell order (position should be gone)
      const filledSellSymbols = new Set(
        sellOrders.filter((o: any) => o.status === 'filled').map((o: any) => o.symbol)
      );
      positions = positions.filter((p: any) => !filledSellSymbols.has(p.symbol));

      // Only keep open/pending sell orders for display
      const activeSellOrders = sellOrders.filter((o: any) =>
        ['open', 'accepted', 'pending_new', 'accepted_for_bidding', 'pending_replace'].includes(o.status)
      );

      // Update both React state AND ref synchronously so pipeline await fetchHoldings()
      // immediately sees fresh data without waiting for React re-render (useEffect).
      setHoldings(positions);
      holdingsRef.current = positions;
      setOpenSellOrders(activeSellOrders);
      console.log(`[ExitScan] holdings fetched: mode=${m}, count=${positions.length}, symbols=[${positions.map((p: any) => p.symbol).join(',')}]`);
    } catch (e: any) {
      setHoldingsError(agentErrorText(
        e?.response?.data?.error || e?.response?.data?.message || e?.message,
        'Configure Alpaca API in Settings to load positions.',
        '暂时无法读取持仓，请在设置中检查 Alpaca 连接。',
      ));
      setHoldings([]);
      holdingsRef.current = [];
      setOpenSellOrders([]);
      console.error(`[ExitScan] holdings fetch failed: mode=${m}, error=${e?.response?.data?.error || e?.message}`);
    } finally {
      setHoldingsLoading(false);
    }
  }, [agentErrorText, agentText, tradeMode]);

  // Fetch holdings when trading account mode changes
  useEffect(() => { fetchHoldings(); }, [fetchHoldings]);

  // Sync holdings to ref so pipeline closure always reads latest
  useEffect(() => { holdingsRef.current = holdings; }, [holdings]);

  // Cancel a sell order for a holding
  const handleCancelSellOrder = useCallback(async (orderId: string, symbol: string) => {
    setCancelingOrderId(orderId);
    try {
      const res = await tradingAccountAPI.cancelOrder(orderId, tradeMode);
      if (res.data.success) {
        message.success(agentText(`Sell order canceled for ${symbol}.`, `${symbol} 的卖出订单已取消。`));
        setOpenSellOrders(prev => prev.filter(o => o.id !== orderId));
      } else {
        const detail = agentErrorText(res.data.error, 'Unknown order error.', '订单服务返回错误，请稍后重试。');
        message.error(agentText(`Could not cancel the order: ${detail}`, `无法取消订单：${detail}`));
      }
    } catch (e: any) {
      const detail = agentErrorText(
        e?.response?.data?.error || e?.response?.data?.message || e?.message,
        'Unknown order error.',
        '订单服务返回错误，请稍后重试。',
      );
      message.error(agentText(`Could not cancel the order: ${detail}`, `无法取消订单：${detail}`));
    } finally {
      setCancelingOrderId(null);
    }
  }, [agentErrorText, agentText, tradeMode]);

  // Entry Plan results by symbol map (for Watchlist/Execution detail lookup)
  const entryPlanResultsBySymbol = React.useMemo(() => {
    const map: Record<string, any> = {};
    if (entryPlanResults && Array.isArray(entryPlanResults)) {
      for (const r of entryPlanResults) {
        if (r.symbol) map[r.symbol] = r;
      }
    }
    return map;
  }, [entryPlanResults]);

  // Unified busy guard: true when any scan/pipeline is running
  const isAnyScanRunning = pipelineRunning || isScanRunning() || isFineScanRunning() || isDeeperValidationRunning() || isEntryPlanRunning();

  // Scanner stop controls are in scannerRunnerService.ts (module-level)

  // Trading Account Mode handler
  const handleTradingAccountModeChange = async (mode: 'paper' | 'real') => {
    setTradingAccountLoading(true);
    try {
      const res = await tradingAccountAPI.getAccount(mode);
      setTradingAccountData(res.data);
    } catch (err) {
      setTradingAccountData({ success: false, error: 'Failed to fetch account data', mode, available: false });
    } finally {
      setTradingAccountLoading(false);
    }
    fetchPortfolioHistory(mode, portfolioHistoryRange);
    fetchHoldings(mode);
  };

  const fetchPortfolioHistory = async (mode?: 'paper' | 'real', range?: string) => {
    const m: 'paper' | 'real' = mode || tradeMode;
    const r = range || portfolioHistoryRange;
    setPortfolioHistoryLoading(true);
    try {
      const res = await tradingAccountAPI.getPortfolioHistory(m, r);
      if (res.data.success) {
        setPortfolioHistoryData(res.data.data || []);
        setPortfolioHistorySummary({
          totalChange: res.data.total_change,
          totalChangePct: res.data.total_change_pct,
          firstValue: res.data.first_value,
          lastValue: res.data.last_value,
        });
      } else {
        setPortfolioHistoryData([]);
        setPortfolioHistorySummary({});
      }
    } catch {
      setPortfolioHistoryData([]);
      setPortfolioHistorySummary({});
    } finally {
      setPortfolioHistoryLoading(false);
    }
  };

  const handleOrderSuccess = () => {
    // Refresh positions, orders, account, and portfolio history after order
    handleTradingAccountModeChange(tradeMode);
    fetchAiWatchlist();
  };

  const openBuyModal = (symbol: string, preset?: {
    qty?: number;
    limitPrice?: number;
    takeProfitPrice?: number;
    stopLossPrice?: number;
  }) => {
    setOrderModalPreset({
      symbol,
      side: 'buy',
      ...preset,
    });
    setOrderModalVisible(true);
  };

  const openSellModal = (symbol: string, qty?: number) => {
    setOrderModalPreset({
      symbol,
      side: 'sell',
      qty,
    });
    setOrderModalVisible(true);
  };

  // ── Preflight config check shared by the active research and execution stages ──
  interface PreflightResult {
    ok: boolean;
    sessionValid: boolean;
    alpacaConfigured: boolean;
    aiAvailable: boolean;
    aiConfigured: boolean;
    aiTestStatus: string;
    aiKeyIsMasked: boolean;
    error?: string;
  }

  async function preflightConfigCheck(): Promise<PreflightResult> {
    const fail = (error: string, partial: Partial<PreflightResult> = {}): PreflightResult => ({
      ok: false, sessionValid: false, alpacaConfigured: false, aiAvailable: false,
      aiConfigured: false, aiTestStatus: 'not_tested', aiKeyIsMasked: false, ...partial, error,
    });

    try {
      const statusResult = await loadConfigStatus({ timeoutMs: 10000 });
      if (!statusResult.ok || !statusResult.data?.success) {
        return fail(statusResult.message || 'Failed to load configuration status.');
      }

      const s = statusResult.data;

      // Session check
      if (!s.user?.userResolved) {
        return fail('Session expired. Please sign in again.');
      }

      // Alpaca Market Data check
      const alpacaOk = !!(s.alpaca?.paperConfigured || s.alpaca?.liveConfigured);

      // AI Provider check
      const aiCfg = s.ai || {};
      const aiConfigured = !!aiCfg.configured;
      const aiTestStatus: string = aiCfg.testStatus || 'not_tested';
      const aiKeyIsMasked = !!aiCfg.keyIsMasked;
      const aiAvailable = aiConfigured && !aiKeyIsMasked && aiTestStatus === 'connected';

      return {
        ok: true,
        sessionValid: true,
        alpacaConfigured: alpacaOk,
        aiAvailable,
        aiConfigured,
        aiTestStatus,
        aiKeyIsMasked,
      };
    } catch (e: any) {
      return fail('Config check failed: ' + (e.message || 'Network error'));
    }
  }

  // Fallback priority计算函数（当AI调用失败时使用）
  const [marketScannerFilters, setMarketScannerFilters] = useState({
    trendFilter: 'all' as 'all' | 'priorityA' | 'advance' | 'watch' | 'event',
    sortBy: 'selectionScore' as 'selectionScore' | 'volume' | 'changePct' | 'newsSentiment',
    sortOrder: 'desc' as 'asc' | 'desc'
  });

  // 展开行状态
  const [expandedRows, setExpandedRows] = useState<string[]>([]);

  // 详细扫描状态 (from store)
  const detailedScanStatus = scannerSnapshot.marketScanner.detailedScanStatus;

  // Step 3: 加载 AI 配置（接入真实配置系统）
  useEffect(() => {
    loadAiConfig();
    fetchConfigStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load trading account data on mount and when global trade mode changes
  useEffect(() => {
    handleTradingAccountModeChange(tradeMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeMode]);

  // 组件卸载时清理 — do NOT stop the scan runner
  // The scan loop runs at module level via scannerRunnerService and updates the store.
  // Only user clicking Stop should call stopMarketScannerByUser().

  const fetchConfigStatus = async () => {
    try {
      const statusResult = await loadConfigStatus({ timeoutMs: 10000 });
      if (statusResult.ok && statusResult.data?.success) {
        const data = statusResult.data;
        setConfigStatus({
          ai: data.ai?.configured || false,
          aiTestStatus: data.ai?.testStatus || 'not_tested',
          aiLastTestError: data.ai?.lastTestError || null,
          alpaca: data.alpaca?.paperConfigured || false,
          finnhub: data.finnhub?.configured || false,
          loaded: true,
        });
      } else {
        console.warn('Failed to fetch config status:', statusResult.message);
        setConfigStatus(prev => ({ ...prev, loaded: true }));
      }
    } catch (e) {
      console.warn('Failed to fetch config status:', e);
      setConfigStatus(prev => ({ ...prev, loaded: true }));
    }
  };

  const loadAiConfig = async () => {
    try {
      const response = await aiTradingService.getProviderConfig();

      if (response.success && response.config) {
        const config = response.config;

        // Provider合法化：只允许合法的provider
        const allowedProviders = ['DeepSeek', 'OpenAI', 'Claude', 'NVIDIA NIM'] as const;
        type AIProvider = typeof allowedProviders[number];

        let provider = config.provider || 'DeepSeek';
        let model = config.model || 'deepseek-chat';

        // 如果provider不在允许列表中，重置为默认值
        if (!allowedProviders.includes(provider as AIProvider)) {
          console.warn(`非法provider值: ${provider}，重置为DeepSeek`);
          provider = 'DeepSeek';
          model = 'deepseek-chat';
        }

        // 更新本地状态
        setAiConfig({
          provider: provider,
          model: model,
          apiKey: config.apiKey || '',
          baseUrl: config.baseUrl || 'https://api.deepseek.com'
        });
      } else {
        console.error('[ai-config] load failed — response had no config data, keeping existing');
        // 不覆盖现有配置，静默保持现有值
      }
    } catch (error) {
      console.error('[ai-config] load failed', error);
      // 不覆盖现有配置，避免清空用户已保存的设置
    }
  };

  // 加载 Alpaca Paper Trading 真实账户数据
  // Step 3: AI 配置保存（接入真实配置系统）
  // Step 3: 测试 AI 连接（接入真实测试系统）
  // Market Scanner functions are in scannerRunnerService.ts

  const getTrendColor = (label: string): string => {
    switch (label) {
      case 'Strong Bullish': return '#52c41a';
      case 'Bullish': return '#73d13d';
      case 'Neutral': return '#faad14';
      case 'Bearish': return '#ff7875';
      case 'Strong Bearish': return '#ff4d4f';
      default: return 'var(--app-text-muted)';
    }
  };

  // 统一的 trend badge 渲染函数
  const renderTrendBadge = (label: string) => {
    if (!label) {
      return (
        <div className="scanner-badge-base" style={{ backgroundColor: 'var(--app-card-bg-soft)', color: 'var(--app-text-muted)', border: '1px solid var(--app-border)' }}>
          N/A
        </div>
      );
    }

    const trendMap: Record<string, string> = {
      'Strong Bullish': t.agent.trendStrongBullish,
      'Bullish': t.agent.trendBullish,
      'Neutral': t.agent.trendNeutral,
      'Bearish': t.agent.trendBearish,
      'Strong Bearish': t.agent.trendStrongBearish,
    };
    const displayLabel = trendMap[label] || label;

    const color = getTrendColor(label);
    const isStrong = label && typeof label === 'string' && label.includes('Strong');

    return (
      <div className="scanner-badge-base" style={{
        backgroundColor: `${color}15`,
        color: color,
        border: `1px solid ${color}`,
        fontWeight: isStrong ? '700' : '600'
      }}>
        {displayLabel}
      </div>
    );
  };
  // 获取过滤和排序后的结果
  const getFilteredAndSortedResults = (): any[] => {
    if (!marketScannerResults || marketScannerResults.length === 0) {
      return [];
    }

    // 1. 先过滤
    let filteredResults = [...marketScannerResults];

    if (marketScannerFilters.trendFilter !== 'all') {
      switch (marketScannerFilters.trendFilter) {
        case 'priorityA':
          filteredResults = filteredResults.filter(r => r.selectionLabel === 'Priority A');
          break;
        case 'advance':
          filteredResults = filteredResults.filter(r => r.aiTraderDecision === 'Advance');
          break;
        case 'watch':
          filteredResults = filteredResults.filter(r => r.aiTraderDecision === 'Watch' || r.aiTraderDecision === 'Avoid');
          break;
        case 'event':
          filteredResults = filteredResults.filter(r =>
            r.eventRisk === 'High' ||
            (r.daysToEarnings != null && Number(r.daysToEarnings) >= 0 && Number(r.daysToEarnings) <= 10) ||
            (r.optionIvSkew != null && Math.abs(Number(r.optionIvSkew)) >= 20)
          );
          break;
      }
    }

    // 2. 再排序
    const sortField = marketScannerFilters.sortBy;
    const sortOrder = marketScannerFilters.sortOrder;

    filteredResults.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      // 处理特殊字段
      if (sortField === 'selectionScore') {
        aValue = a.selectionScore ?? a.overallScore ?? a.trendScore ?? 0;
        bValue = b.selectionScore ?? b.overallScore ?? b.trendScore ?? 0;
      } else if (sortField === 'changePct') {
        aValue = a.changePct || a.changePercent || 0;
        bValue = b.changePct || b.changePercent || 0;
      } else if (sortField === 'volume') {
        aValue = a.volume || 0;
        bValue = b.volume || 0;
      } else if (sortField === 'newsSentiment') {
        // 将新闻情绪映射为数值进行排序
        const sentimentMap: Record<string, number> = {
          'Positive': 3,
          'Neutral': 2,
          'Negative': 1,
          'Mixed': 2
        };
        aValue = sentimentMap[a.newsSentiment] || 0;
        bValue = sentimentMap[b.newsSentiment] || 0;
      }

      // 处理空值
      if (aValue === null || aValue === undefined) aValue = sortOrder === 'desc' ? -Infinity : Infinity;
      if (bValue === null || bValue === undefined) bValue = sortOrder === 'desc' ? -Infinity : Infinity;

      // 数值比较
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
      }

      // 字符串比较
      const aStr = String(aValue || '');
      const bStr = String(bValue || '');
      return sortOrder === 'desc' ? bStr.localeCompare(aStr) : aStr.localeCompare(bStr);
    });

    return filteredResults;
  };

  // 获取bullish候选数量（用于UI显示）
  const handleToggleMarketScanner = (): void => {
    if (isScanRunning()) {
      // Stop the running scan — only user action can stop
      stopMarketScannerByUser();
      message.info(agentText('Stopping the scanner…', '正在停止扫描…'));
    } else {
      if (pipelineRunning) {
        message.warning(agentText('This action is unavailable while the AI pipeline is running.', 'AI 流水线运行期间无法执行此操作。'));
        return;
      }
      // A new universe and ranking invalidates every downstream research artifact.
      scannerStateStore.resetFineScan();
      scannerStateStore.resetDeeperValidation();
      scannerStateStore.resetAdmission();
      scannerStateStore.resetEntryPlan();
      scannerStateStore.resetExitScan();
      setDvErrorMessage(null);
      setDvErrors([]);
      // Start a new scan via module-level service
      startMarketScanner({ accountUserId, riskProfile, timeHorizon, pipelineMode, leverageEnabled });
    }
  };

  // Step 4: 获取候选股票符号 - 扩展股票池：科技股 + 非科技股
  // 展开行相关函数
  const toggleRowExpand = (symbol: string) => {
    setExpandedRows(prev =>
      prev.includes(symbol)
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  };

  // 格式化新闻日期函数
  const formatNewsDate = (timestamp: any): string => {
    if (!timestamp) return agentText('Time unavailable', '时间不可用');

    try {
      // 检查是否是数字（Unix时间戳）
      const num = Number(timestamp);
      if (!isNaN(num)) {
        // 判断是秒时间戳（10位）还是毫秒时间戳（13位）
        const timestampMs = num < 10000000000 ? num * 1000 : num;
        const date = new Date(timestampMs);

        // 检查日期是否有效（不是1970年）
        if (date.getFullYear() < 1971) {
          return agentText('Time unavailable', '时间不可用');
        }

        return date.toLocaleDateString(isZh ? 'zh-CN' : 'en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }

      // 如果不是数字，尝试直接解析
      const date = new Date(timestamp);
      if (isNaN(date.getTime()) || date.getFullYear() < 1971) {
        return agentText('Time unavailable', '时间不可用');
      }

      return date.toLocaleDateString(isZh ? 'zh-CN' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting news date:', error, timestamp);
      return agentText('Time unavailable', '时间不可用');
    }
  };

  const renderDetailPanel = (record: any) => {
    const lazyNews = lazyNewsCache[record.symbol];
    const displayRecord = lazyNews && !lazyNews._error
      ? {
        ...record,
        ...lazyNews,
        dataSources: { ...(record.dataSources || {}), ...(lazyNews.dataSources || {}) },
        provenance: { ...(record.provenance || {}), ...(lazyNews.provenance || {}) },
      }
      : record;

    const reason = displayRecord.newsFetchReason || record.newsFetchReason || '';
    const source = String(displayRecord.newsSource || record.newsSource || '').toLowerCase();
    const needsLazyRefresh = !displayRecord.topNews && (
      reason === 'news_fetch_skipped_top_n_limit' ||
      source.includes('below top candidate') ||
      source.includes('finnhub') ||
      reason.includes('finnhub') ||
      reason.includes('alpaca_news_rate_limited') ||
      reason.includes('alpaca_news_http_429') ||
      reason.includes('alpaca_news_timeout') ||
      source.includes('rate limit') ||
      source.includes('error')
    );
    if (needsLazyRefresh) { scheduleLazyNews(record.symbol); }

    const score = Number(displayRecord.selectionScore ?? displayRecord.overallScore ?? displayRecord.trendScore ?? 0);
    const scoreColor = score >= 80 ? '#16a34a' : score >= 65 ? '#2563eb' : score >= 50 ? '#d97706' : '#dc2626';
    const confidenceValue = displayRecord.scoreReliability != null
      ? Number(displayRecord.scoreReliability).toFixed(0)
      : displayRecord.trendConfidence
        ? (displayRecord.trendConfidence * (displayRecord.trendConfidence <= 1 ? 100 : 1)).toFixed(0)
        : 'N/A';
    const changePct = displayRecord.changePct != null ? displayRecord.changePct : (displayRecord.changePercent != null ? displayRecord.changePercent : null);
    const trendLabel = displayRecord.trendLabel || agentText('Need Data', '需要数据');
    const provenance = displayRecord.provenance || {};
    const newsItems = Array.isArray(displayRecord.allNews) ? displayRecord.allNews.slice(0, 3) : (displayRecord.topNews ? [displayRecord.topNews] : []);
    const isNewsLoading = needsLazyRefresh && !lazyNewsCache[record.symbol];

    const fmtMoney = (value: any, digits = 2) => {
      const num = Number(value);
      return Number.isFinite(num) && num > 0 ? `$${num.toFixed(digits)}` : null;
    };
    const fmtPct = (value: any, digits = 1) => {
      const num = exitFinite(value);
      return num == null ? null : `${num > 0 ? '+' : ''}${num.toFixed(digits)}%`;
    };
    const fmtCompactMoney = (value: any) => {
      const num = Number(value);
      if (!Number.isFinite(num) || num <= 0) return null;
      if (num >= 1_000_000_000_000) return `$${(num / 1_000_000_000_000).toFixed(2)}T`;
      if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
      if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
      return `$${num.toFixed(0)}`;
    };
    const fmtVolume = (value: any) => {
      const num = Number(value);
      return Number.isFinite(num) && num > 0 ? marketDataService.formatVolume(num) : null;
    };
    const sourceDisplay = (value: any) => {
      const text = String(value || '');
      if (!text) return '';
      if (text.includes('cdn.finra.org')) return agentText('FINRA CNMS daily file', 'FINRA CNMS 每日文件');
      if (text.includes('/v1beta1/options')) return agentText('Alpaca options snapshot', 'Alpaca 期权快照');
      if (text.includes('/v1beta1/news')) return agentText('Alpaca news', 'Alpaca 新闻');
      if (text.includes('/v2/stocks/bars')) return text.includes('benchmark') || text.includes('ETF') ? agentText('Alpaca benchmark bars', 'Alpaca 基准行情') : agentText('Alpaca stock bars', 'Alpaca 个股行情');
      if (text.includes('/v2/assets')) return agentText('Alpaca assets + profile', 'Alpaca 资产与资料');
      if (text.includes('/stock/metric')) return agentText('Finnhub metrics', 'Finnhub 指标');
      if (text.toLowerCase().includes('earnings')) return agentText('Finnhub earnings calendar', 'Finnhub 财报日历');
      if (text.toLowerCase().includes('deepseek')) return agentText('AI trader review', 'AI 交易审核');
      return text.length > 34 ? `${text.slice(0, 34)}...` : text;
    };

    const metricRows = [
      { label: agentText('Price', '价格'), value: fmtMoney(displayRecord.price) },
      { label: agentText('Change', '涨跌'), value: fmtPct(changePct, 2), tone: changePct != null ? (changePct >= 0 ? 'positive' : 'negative') : undefined },
      { label: agentText('Volume', '成交量'), value: fmtVolume(displayRecord.volume) },
      { label: 'ADV20', value: fmtCompactMoney(displayRecord.avgDollarVolume20) },
      { label: agentText('Day Range', '日内区间'), value: (fmtMoney(displayRecord.dayLow) && fmtMoney(displayRecord.dayHigh)) ? `${fmtMoney(displayRecord.dayLow)} - ${fmtMoney(displayRecord.dayHigh)}` : null },
      { label: agentText('Market Cap', '总市值'), value: fmtCompactMoney(displayRecord.marketCap) },
      { label: agentText('Sector', '板块'), value: translateSector(displayRecord.sector) },
      { label: agentText('Industry', '行业'), value: translateSector(displayRecord.industry || displayRecord.sector) },
      { label: agentText('Direction', '方向评分'), value: displayRecord.directionScore != null ? String(Math.round(Number(displayRecord.directionScore))) + '/100' : null },
      { label: agentText('Agreement', '因子一致度'), value: displayRecord.factorAgreementPct != null ? String(Math.round(Number(displayRecord.factorAgreementPct))) + '%' : null },
      { label: agentText('Core Coverage', '核心覆盖率'), value: displayRecord.factorCoveragePct != null ? String(Math.round(Number(displayRecord.factorCoveragePct))) + '%' : null },
    ].filter(item => item.value);

    const executionRows = [
      { label: agentText('SPY Rel 3M', '相对 SPY（3 个月）'), value: fmtPct(displayRecord.relativeStrength3m) },
      { label: agentText('Market Beta', '市场 Beta'), value: displayRecord.marketBeta != null ? Number(displayRecord.marketBeta).toFixed(2) : null },
      { label: agentText('Trade Cost', '交易成本'), value: displayRecord.estimatedRoundTripCostBps != null ? `${Number(displayRecord.estimatedRoundTripCostBps).toFixed(1)} bps` : null },
      { label: '10% ADV', value: fmtCompactMoney(displayRecord.participation10pctDollar) },
      { label: agentText('Sector Rank', '板块排名'), value: displayRecord.sectorRank != null ? `#${displayRecord.sectorRank}/${displayRecord.sectorCount || '-'}` : null },
      { label: agentText('Liquidity Tier', '流动性等级'), value: displayRecord.liquidityTier ? agentEnumLabel(displayRecord.liquidityTier) : null },
      { label: agentText('Capacity', '资金容量'), value: displayRecord.capacityScore != null ? String(Math.round(Number(displayRecord.capacityScore))) + '/100' : null },
    ].filter(item => item.value);

    const factorRows = [
      { label: agentText('Momentum', '动量'), value: displayRecord.factorScores?.momentum ?? displayRecord.momentumScore },
      { label: agentText('Trend', '趋势'), value: displayRecord.factorScores?.trend ?? displayRecord.trendScoreDetail ?? displayRecord.trendScore },
      { label: agentText('Relative', '相对强度'), value: displayRecord.factorScores?.relative ?? displayRecord.relativeScore },
      { label: agentText('Liquidity', '流动性'), value: displayRecord.factorScores?.liquidity ?? displayRecord.volumeScore },
      { label: agentText('Risk', '风险'), value: displayRecord.factorScores?.risk ?? displayRecord.volatilityScore },
      { label: agentText('Sentiment', '市场情绪'), value: displayRecord.newsScore ?? displayRecord.sentimentScore },
    ].filter(item => item.value != null);

    const riskTags = [
      displayRecord.eventRisk ? `${agentText('Event risk', '事件风险')}: ${agentEnumLabel(displayRecord.eventRisk)}` : null,
      displayRecord.nextEarningsDate ? `${agentText('Earnings', '下一财报')}: ${displayRecord.nextEarningsDate}${displayRecord.daysToEarnings != null ? ` (${displayRecord.daysToEarnings}${agentText('d', '天')})` : ''}` : null,
      displayRecord.shortVolumeRatio != null ? `${agentText('Short vol', '空头成交占比')}: ${Number(displayRecord.shortVolumeRatio).toFixed(1)}%` : null,
      displayRecord.optionIvSkew != null ? `${agentText('IV skew', '隐含波动率偏斜')}: ${Number(displayRecord.optionIvSkew).toFixed(1)}%` : null,
      displayRecord.realizedVol20 != null ? `Vol20: ${Number(displayRecord.realizedVol20).toFixed(1)}%` : null,
      displayRecord.atrPercent != null ? `ATR: ${Number(displayRecord.atrPercent).toFixed(1)}%` : null,
    ].filter((tag): tag is string => Boolean(tag));

    const sourceRows = [
      { label: agentText('Market', '市场行情'), value: provenance.marketData },
      { label: agentText('Benchmark', '基准'), value: provenance.benchmarks },
      { label: agentText('Cost', '成本'), value: provenance.tradingCost },
      { label: agentText('Company', '公司资料'), value: provenance.companyInfo },
      { label: agentText('Fundamentals', '基本面'), value: provenance.fundamentals },
      { label: agentText('News', '新闻'), value: provenance.news },
      { label: agentText('Events', '事件'), value: provenance.events },
      { label: agentText('Short Volume', '空头成交量'), value: provenance.shortVolume },
      { label: agentText('Options', '期权'), value: provenance.options },
      { label: 'AI', value: provenance.aiData },
    ].filter(item => item.value);

    return (
      <div className="scanner-detail-container">
        <div className="scanner-detail-header">
          <div>
            <div className="scanner-detail-title-group">
              <span className="scanner-detail-symbol">{displayRecord.symbol}</span>
              <span className="scanner-detail-company">{displayRecord.companyName || displayRecord.name || t.agent.unknownCompany}</span>
            </div>
            <div className="scanner-detail-meta">
              {agentText('Updated', '更新时间')} {displayRecord.timestamp ? new Date(displayRecord.timestamp).toLocaleString(isZh ? 'zh-CN' : 'en-US') : '—'}
            </div>
          </div>
          <div className="scanner-detail-header-actions">
            <Tag color={displayRecord.selectionLabel === 'Priority A' ? 'success' : displayRecord.selectionLabel === 'Priority B' ? 'blue' : 'gold'} style={{ margin: 0, fontWeight: 700 }}>
              {displayRecord.selectionLabel ? agentEnumLabel(displayRecord.selectionLabel) : agentText('Research Priority', '研究优先级')}
            </Tag>
            <Tag color={displayRecord.aiTraderDecision === 'Advance' ? 'success' : displayRecord.aiTraderDecision === 'Avoid' ? 'error' : displayRecord.aiTraderDecision === 'Watch' ? 'warning' : 'default'} style={{ margin: 0, fontWeight: 700 }}>
              {displayRecord.aiTraderDecision ? `AI ${agentEnumLabel(displayRecord.aiTraderDecision)}` : agentText('Rules only', '仅规则判断')}
            </Tag>
            {renderTrendBadge(trendLabel)}
          </div>
        </div>

        <div className="scanner-detail-grid">
          <section className="scanner-detail-panel">
            <div className="scanner-detail-section-title">{agentText('Priority & Evidence', '优先级与证据')}</div>
            <div className="scanner-detail-score-strip">
              <div>
                <div className="scanner-detail-label">{agentText('Research Priority', '研究优先级')}</div>
                <div className="scanner-detail-score" style={{ color: scoreColor }}>{score.toFixed(0)}<span>/100</span></div>
              </div>
              <Progress percent={score} strokeColor={scoreColor} showInfo={false} size={['100%', 8]} />
              <div className="scanner-detail-meta">{agentText('Evidence reliability', '证据可靠度')} {confidenceValue}% · {displayRecord.scoreVersion || agentText('legacy score', '旧版评分')}</div>
            </div>
            <div className="scanner-metric-grid">
              {metricRows.map(item => (
                <div key={item.label} className="scanner-metric">
                  <div className="scanner-detail-label">{item.label}</div>
                  <div className={`scanner-detail-value ${item.tone === 'positive' ? 'scanner-positive' : item.tone === 'negative' ? 'scanner-negative' : ''}`}>{item.value}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="scanner-detail-panel">
            <div className="scanner-detail-section-title">{agentText('Factor Model & Investability', '因子模型与可投资性')}</div>
            <div className="scanner-factor-list">
              {factorRows.map(item => {
                const value = Number(item.value);
                const color = value >= 70 ? '#52c41a' : value >= 40 ? '#faad14' : '#ff4d4f';
                return (
                  <div key={item.label} className="scanner-factor-row">
                    <div className="scanner-factor-head">
                      <span>{item.label}</span>
                      <b>{Number.isFinite(value) ? value.toFixed(0) : '--'}</b>
                    </div>
                    <Progress percent={Number.isFinite(value) ? value : 0} strokeColor={color} showInfo={false} size={['100%', 6]} />
                  </div>
                );
              })}
            </div>
            {riskTags.length > 0 && (
              <div className="scanner-detail-tag-row">
                {riskTags.map(tag => <Tag key={tag} color={/High|高/i.test(String(tag)) ? 'red' : /Medium|中/i.test(String(tag)) ? 'gold' : 'blue'} style={{ margin: 0 }}>{tag}</Tag>)}
              </div>
            )}
            {executionRows.length > 0 && (
              <>
                <div className="scanner-detail-section-title scanner-detail-section-title-spaced">{agentText('Execution Context', '执行条件')}</div>
                <div className="scanner-execution-grid">
                  {executionRows.map(item => (
                    <div key={item.label} className="scanner-execution-metric">
                      <span>{item.label}</span>
                      <b>{item.value}</b>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="scanner-detail-panel">
            <div className="scanner-detail-section-title">{agentText('Catalysts & AI Challenge', '催化因素与 AI 质询')}</div>
            <div className="scanner-news-status-row">
              <Tag color={displayRecord.hasNews ? 'blue' : isNewsLoading ? 'processing' : 'default'} style={{ margin: 0 }}>
                {displayRecord.hasNews
                  ? `${agentText('Alpaca News', 'Alpaca 新闻')} ${displayRecord.newsCount || newsItems.length}`
                  : isNewsLoading ? agentText('Fetching Alpaca News', '正在获取 Alpaca 新闻') : agentText('No News', '暂无新闻')}
              </Tag>
              {displayRecord.newsSentiment && <Tag color={displayRecord.newsSentiment === 'Negative' ? 'red' : displayRecord.newsSentiment === 'Positive' ? 'green' : 'default'} style={{ margin: 0 }}>{agentEnumLabel(displayRecord.newsSentiment)}</Tag>}
            </div>
            <div className="scanner-detail-news-box">
              {isNewsLoading ? (
                <div className="scanner-news-empty">
                  <LoadingOutlined />
                  <span>{agentText('Fetching Alpaca News...', '正在获取 Alpaca 新闻…')}</span>
                </div>
              ) : newsItems.length > 0 ? (
                newsItems.map((item: any, index: number) => {
                  const title = item.title || item.headline || agentText('Untitled news', '未命名新闻');
                  const sourceLabel = item.source || item.publisher || agentText('Alpaca News', 'Alpaca 新闻');
                  const published = item.published || item.publishedAt || item.createdAt || item.updatedAt;
                  const summary = item.summary || '';
                  const url = item.url || '';
                  return (
                    <div key={`${title}-${index}`} className="scanner-news-item">
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="scanner-detail-news-title">{title}</a>
                      ) : (
                        <span className="scanner-detail-news-title">{title}</span>
                      )}
                      <div className="scanner-news-meta">{sourceLabel} · {published ? formatNewsDate(published) : agentText('Time unavailable', '时间不可用')}</div>
                      {summary && <div className="scanner-detail-news-summary">{summary.length > 150 ? `${summary.substring(0, 150)}...` : summary}</div>}
                    </div>
                  );
                })
              ) : (
                <div className="scanner-news-empty">
                  <InfoCircleOutlined />
                  <span>{getNewsEmptyReason(displayRecord)}</span>
                </div>
              )}
            </div>
            <div className="scanner-detail-section-title scanner-detail-section-title-spaced">{agentText('AI Challenge Review', 'AI 质询审核')}</div>
            <div className="scanner-detail-reasoning-box scanner-detail-reasoning-box-right">
              {displayRecord.aiTraderRationale || displayRecord.detailedReasoning || displayRecord.aiReasoning || displayRecord.scannerReason || t.agent.noDetailedAnalysis}
            </div>
            {(displayRecord.aiRiskFlags?.length > 0 || displayRecord.aiContradictions?.length > 0 || displayRecord.aiMissingChecks?.length > 0) && (
              <div className="scanner-detail-tag-row">
                {(displayRecord.aiRiskFlags || []).slice(0, 3).map((item: string) => <Tag key={'risk-' + item} color="warning">{item}</Tag>)}
                {(displayRecord.aiContradictions || []).slice(0, 3).map((item: string) => <Tag key={'conflict-' + item} color="error">{item}</Tag>)}
                {(displayRecord.aiMissingChecks || []).slice(0, 3).map((item: string) => <Tag key={'check-' + item} color="blue">{item}</Tag>)}
              </div>
            )}
            {(displayRecord.aiNextStep || displayRecord.nextStep) && (
              <div className="scanner-next-step">
                <span>{agentText('Next Step', '下一步')}</span>
                <b>{displayRecord.aiNextStep || displayRecord.nextStep}</b>
              </div>
            )}
            {sourceRows.length > 0 && (
              <div className="scanner-source-list scanner-source-list-right">
                {sourceRows.map(item => (
                  <div key={item.label}>
                    <span>{item.label}</span>
                    <Tooltip title={String(item.value)}>
                      <b>{sourceDisplay(item.value)}</b>
                    </Tooltip>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    );
  };

  // 回退函数：原始市场扫描逻辑
  // 格式化时间显示

  // 辅助函数：基于候选数据生成AI Reasoning
  // 辅助函数：确定Backtest状态
  // 辅助函数：确定Optimization状态
  // 辅助函数：计算Suggested Qty
  // 辅助函数：确定推荐状态
  // 辅助函数：生成fallback推荐（AI不可用时）
  // 辅助函数：计算推荐汇总统计
  // ========== 策略路由相关辅助函数 ==========

  // 从AI决策中提取市场类型
  // 根据市场类型选择策略
  // 基于规则确定市场类型（AI路由失败时的fallback）
  // 生成包含策略路由的AI Reasoning
  // 基于策略路由确定Backtest状态
  // 基于策略路由确定Optimization状态
  // 基于策略路由计算Suggested Qty
  // 基于策略路由确定推荐状态
  // ========== 回测相关辅助函数 ==========

  // 运行策略回测 - 真正调用平台内已有的backtest功能
  // 运行参数优化 - 真正调用平台内已有的parameter optimization功能
  // 获取策略参数
  // 从回测响应中提取总回报
  // 从回测响应中提取夏普比率
  // 从回测响应中提取胜率
  // 从回测响应中提取最大回撤
  // 从回测响应中提取交易次数
  // 生成回测摘要
  // 找到最佳策略
  // 找到最佳策略回报
  // 确定整体回测状态
  // 基于回测结果确定Action
  // 基于回测结果调整置信度
  // 生成包含回测结果的AI Reasoning
  // 基于回测结果计算Suggested Qty
  // 基于回测结果确定推荐状态
  // 基于回测结果确定优化状态
  // ========== 优化结果相关辅助函数 ==========

  // 生成优化摘要
  // 找到最佳优化策略
  // 找到最佳优化回报
  // 确定整体优化状态
  // 基于回测和优化结果确定Action
  // 基于回测和优化结果调整置信度
  // 生成包含回测和优化结果的AI Reasoning
  // 基于回测和优化结果计算Suggested Qty
  // 基于回测和优化结果确定推荐状态
  // 生成展开详情需要的backtestKeyResults
  // 生成展开详情需要的optimizationKeyResults


  // Fine Scan: Regime detection, strategy matching AND Multi-timeframe confirmation
  // Part 1: strategy matching | Part 2: MTF (1D/4H/1H/15min) alignment
  // Process one symbol fully (both steps) before moving to the next
  const handleRunFineScan = async () => {
    if (pipelineRunning) {
      message.warning(agentText('This action is unavailable while the AI pipeline is running.', 'AI 流水线运行期间无法执行此操作。'));
      return;
    }
    if (marketScannerResults.length === 0) {
      message.warning(agentText('No scanner candidates are available. Run the market scanner first.', '暂无市场扫描候选标的，请先运行市场扫描。'));
      return;
    }

    // Register with runner service so isFineScanRunning() returns true during route changes
    const fineScanPromise = _runFineScanLoop();
    registerFineScanRun(fineScanPromise);
    await fineScanPromise;
  };

  const _runFineScanLoop = async (): Promise<any[]> => {
    setFineScanStatus('running');
    setFineScanProgress(0);
    setFineScanStepProgress(0);
    setFineScanCurrentStep('');
    setFineScanResults([]);
    setFineScanMessage('');
    // Clear downstream stale results when Fine Scan re-runs
    setDeeperValidationStatus('idle');
    setDeeperValidationResults(null);
    scannerStateStore.resetAdmission();
    setEntryPlanStatus('idle');
    setEntryPlanResults(null);
    setExitScanStatus('idle');
    setExitScanResults([]);

    // Preflight: check session, Alpaca, and AI config
    const preflight = await preflightConfigCheck();
    if (!preflight.ok || !preflight.sessionValid) {
      setFineScanStatus('failed');
      setFineScanMessage(agentErrorText(
        preflight.error,
        'Your session has expired.',
        '登录状态已过期，请重新登录。',
      ));
      unregisterFineScanRun();
      message.error(agentErrorText(
        preflight.error,
        'Your session has expired.',
        '登录状态已过期，请重新登录。',
      ));
      return [];
    }
    if (!preflight.alpacaConfigured) {
      setFineScanStatus('failed');
      setFineScanMessage(agentText(
        'Alpaca Market Data API is not configured. Configure it in Settings.',
        '尚未配置 Alpaca 行情数据，请前往设置完成连接。',
      ));
      unregisterFineScanRun();
      message.error(agentText('Alpaca market data is not configured.', '尚未配置 Alpaca 行情数据。'));
      return [];
    }
    if (!preflight.aiAvailable) {
      setFineScanMessage(agentText(
        'AI overlay unavailable; running the deterministic rule scan.',
        'AI 复核暂不可用；正在运行确定性规则扫描。',
      ));
    }

    const fineScanCandidateLimit = 30;
    const candidateSource = (scannerStateStore.getState().marketScanner.results || [])
      .filter((row: any) => row?.symbol)
      .sort((a: any, b: any) => ((b.overallScore ?? b.trendScore ?? 0) - (a.overallScore ?? a.trendScore ?? 0)))
      .slice(0, fineScanCandidateLimit);

    if (candidateSource.length === 0) {
      setFineScanStatus('completed');
      setFineScanProgress(100);
      setFineScanMessage(agentText(
        'No Market Scanner candidates are available for Fine Scan.',
        '市场扫描暂未生成可进入精细扫描的候选标的。',
      ));
      unregisterFineScanRun();
      return [];
    }

    setFineScanCurrentStep(agentText('Candidate intake', '候选接收'));
    setFineScanStepProgress(10);
    setFineScanProgress(8);
    setFineScanMessage(agentText(
      `Preparing ${candidateSource.length} Market Scanner candidates for Fine Scan...`,
      `正在准备 ${candidateSource.length} 个市场扫描候选标的...`,
    ));

    let progress = 8;
    let progressTimer: ReturnType<typeof setInterval> | null = null;
    try {
      progressTimer = setInterval(() => {
        progress = Math.min(94, progress + (progress < 20 ? 4 : progress < 58 ? 3 : 2));
        if (progress < 20) {
          setFineScanCurrentStep(agentText('Candidate intake', '候选接收'));
          setFineScanMessage(agentText(
            `Normalizing ${candidateSource.length} scanner candidates...`,
            `正在标准化 ${candidateSource.length} 个候选标的...`,
          ));
        } else if (progress < 38) {
          setFineScanCurrentStep(agentText('Alpaca snapshot refresh', '刷新 Alpaca 行情快照'));
          setFineScanMessage(agentText(
            'Refreshing price, quote, VWAP, day range, spread, and quote age...',
            '正在刷新价格、报价、VWAP、日内区间、点差与报价时效...',
          ));
        } else if (progress < 60) {
          setFineScanCurrentStep(agentText('Setup and entry geometry', '形态与入场结构'));
          setFineScanMessage(agentText(
            'Classifying setups and validating zones, stops, targets, and reward/risk...',
            '正在识别形态并验证入场区间、止损、目标与盈亏比...',
          ));
        } else if (progress < 78) {
          setFineScanCurrentStep(agentText('Execution and risk gates', '执行与风险闸门'));
          setFineScanMessage(agentText(
            'Checking spread, cost, capacity, quote freshness, events, and required evidence...',
            '正在检查点差、成本、容量、报价时效、事件风险与必需证据...',
          ));
        } else if (progress < 92) {
          setFineScanCurrentStep(preflight.aiAvailable
            ? agentText('Batched AI challenge', '批量 AI 质疑')
            : agentText('Deterministic finalization', '确定性结果汇总'));
          setFineScanMessage(preflight.aiAvailable
            ? agentText('AI is challenging the deterministic evidence packets in batches...', 'AI 正在批量质疑确定性证据包...')
            : agentText('Finalizing deterministic Fine Scan routes...', '正在汇总确定性精细扫描路线...'));
        } else {
          setFineScanCurrentStep(agentText('Finalizing routes', '汇总验证路线'));
          setFineScanMessage(agentText(
            'Merging binding gates, AI challenges, and final validation routes...',
            '正在合并强制闸门、AI 质疑与最终验证路线...',
          ));
        }
        setFineScanStepProgress(progress);
        setFineScanProgress(progress);
      }, 700);

      const response = await pipelineAutoAPI.runFineScan({
        candidates: candidateSource,
        riskProfile,
        timeHorizon,
        pipelineMode,
        tradeMode,
        maxSymbols: fineScanCandidateLimit,
      } as any);

      const payload = response?.data || {};
      if (!payload.success) {
        throw new Error(payload.message || 'Backend Fine Scan returned non-success');
      }

      const finalResults = Array.isArray(payload.results) ? payload.results : [];
      setFineScanCurrentStep(agentText('Completed', '已完成'));
      setFineScanStepProgress(100);
      setFineScanProgress(100);
      setFineScanResults(finalResults);
      setFineScanStatus('completed');
      const summary = payload.summary || {};
      const decisions = summary.decisions || {};
      const aiSummary = summary.ai || {};
      setFineScanMessage(agentText(
        `Fine Scan complete: ${finalResults.length} scanned, ${decisions.Continue || 0} continue, ${decisions.Watch || 0} watch, ${decisions.Reject || 0} reject, ${decisions.NeedMoreData || 0} need data; AI ${aiSummary.reviewed || 0}/${aiSummary.requested || 0}.`,
        `精细扫描完成：共 ${finalResults.length} 个，继续 ${decisions.Continue || 0} 个，观察 ${decisions.Watch || 0} 个，拒绝 ${decisions.Reject || 0} 个，需补数据 ${decisions.NeedMoreData || 0} 个；AI 已复核 ${aiSummary.reviewed || 0}/${aiSummary.requested || 0}。`,
      ));
      unregisterFineScanRun();
      message.success(agentText(`Fine scan complete. ${finalResults.length} candidates analyzed.`, `精细扫描完成，已分析 ${finalResults.length} 个候选标的。`));
      return finalResults;
    } catch (error: any) {
      console.error('Fine scan error:', error);
      setFineScanStatus('error');
      setFineScanMessage(agentErrorText(
        error?.response?.data?.message || error?.message,
        'Fine Scan failed.',
        '精细扫描失败，请稍后重试。',
      ));
      unregisterFineScanRun();
      message.error(agentErrorText(
        error?.response?.data?.message || error?.message,
        'Fine Scan failed.',
        '精细扫描失败，请稍后重试。',
      ));
      return [];
    } finally {
      if (progressTimer) clearInterval(progressTimer);
    }

  };


  // ===== Deeper Validation State ===== (now in scannerStateStore)
  // deeperValidationStatus and deeperValidationResults are read from store snapshot above

  // ===== Entry Plan State ===== (now in scannerStateStore)
  // entryPlanStatus and entryPlanResults are read from store snapshot above
  const [expandedEntryPlanSymbol, setExpandedEntryPlanSymbol] = useState<string | null>(null);
  const [entryPlanAccountSize] = useState<number>(100000);
  // Portfolio loss budget per entry; gross allocation is capped separately.
  const entryPlanRiskPerTrade = riskProfile === 'low' ? 0.5 : riskProfile === 'high' ? 1.5 : 1.0;
  const entryPlanMaxPositionPct = riskProfile === 'low' ? 8 : riskProfile === 'high' ? 25 : 15;
  // Derived from pipelineMode + tradeMode
  const entryPlanExecutionMode = pipelineMode === 'ai'
    ? (tradeMode === 'paper' ? 'AI Auto Paper' : 'AI Auto Live')
    : tradeMode === 'real'
      ? 'Real Trade if Triggered'
      : 'Paper Trade if Triggered';
  // Unified execution mode derivation — matches backend _pa_run_pipeline
  // Manual → Recommend Only; all other modes: paper → Paper Trade, real → Real Trade
  const entryPlanApiExecutionMode = pipelineMode === 'manual'
    ? 'Recommend Only'
    : tradeMode === 'real'
      ? 'Real Trade if Triggered'
      : 'Paper Trade if Triggered';

  // ===== Entry Plan Execution State =====
  const [executeModalVisible, setExecuteModalVisible] = useState(false);
  const [executeTarget, setExecuteTarget] = useState<any>(null);
  const [executeLoading, setExecuteLoading] = useState(false);
  const [liveOrderAccepted, setLiveOrderAccepted] = useState(false);
  const autoEntryPlanExecuteKeysRef = useRef<Set<string>>(new Set());
  // Track symbols the user explicitly removed — prevents useEffect from re-adding in the same pipeline run
  const removedSymbolsRef = useRef<Set<string>>(new Set());
  // Ref mirror of aiExecutionList for reading latest state inside callbacks without stale closure
  const aiExecutionListRef = useRef<any[]>([]);
  // Incremented on each new Entry Plan run; compared against the generation when Clear was last pressed
  const entryPlanGenerationRef = useRef<number>(0);
  const clearedAtGenerationRef = useRef<number>(-1);

  // ===== AI Execution Order State =====
  const [executionLog, setExecutionLog] = useState<any[]>([]);
  const [executingSymbol, setExecutingSymbol] = useState<string | null>(null);
  const [orderConfirmVisible, setOrderConfirmVisible] = useState(false);
  const [orderConfirmTarget, setOrderConfirmTarget] = useState<any>(null);
  const [orderRiskAccepted, setOrderRiskAccepted] = useState(false);
  const [executionLogExpanded, setExecutionLogExpanded] = useState(false);
  // Modal editing state — initialized when modal opens, used for final order params
  const [modalQtyMode, setModalQtyMode] = useState<'shares' | 'dollars'>('shares');
  const [modalUserQty, setModalUserQty] = useState(1);
  const [modalDollarAmount, setModalDollarAmount] = useState(0);
  const [modalOrderType, setModalOrderType] = useState<string>('market');
  const [modalLimitPrice, setModalLimitPrice] = useState<number>(0);
  const [modalStopPrice, setModalStopPrice] = useState<number>(0);
  const [modalTrailPrice, setModalTrailPrice] = useState<number>(0);
  const [modalTrailPercent, setModalTrailPercent] = useState<number>(0);
  const [modalTimeInForce, setModalTimeInForce] = useState<string>('day');

  // Cancel order confirmation state
  const [cancelConfirmVisible, setCancelConfirmVisible] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // tradeMode is from global context — no stale closure issue

  // Persist aiExecutionList to scannerStateStore on every change
  useEffect(() => {
    scannerStateStore.setAiExecutionCandidates(aiExecutionList);
  }, [aiExecutionList]);
  // Flush pending saves before page unload to prevent data loss from debounce
  useEffect(() => {
    const handleBeforeUnload = () => { scannerStateStore.flushPendingSave(); };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);
  // Keep ref mirror in sync during render (before effects) so callbacks always read latest state
  aiExecutionListRef.current = aiExecutionList;

  // ===== Collapsible Stage Sections Expanded State =====
  const [scannerExpanded, setScannerExpanded] = useState(false);
  const [fineScanExpanded, setFineScanExpanded] = useState(false);
  const [dvExpanded, setDvExpanded] = useState(false);
  const [dvErrorMessage, setDvErrorMessage] = useState<string | null>(null);
  const [dvErrors, setDvErrors] = useState<any[]>([]);
  const [dvProgress, setDvProgress] = useState(0);
  const [dvProgressStage, setDvProgressStage] = useState(agentText('Ready', '就绪'));
  const [entryPlanExpanded, setEntryPlanExpanded] = useState(false);
  const [exitScanExpanded, setExitScanExpanded] = useState(false);

  const handleEntryPlanAction = (plan: any) => {
    const action = getEntryPlanEffectiveAction(plan);
    const aiDecision = plan.aiDecision;
    const dq = plan.dataQuality;
    const tr = plan.tradeReadiness;

    if (action === 'BLOCKED_BY_RISK' || action === 'NEED_DATA' || hasEntryPlanHardBlock(plan) || dq === 'POOR') {
      const blockers = action === 'NEED_DATA'
        ? [isZh ? '缺少生成可执行计划所需的行情或保护价位数据。' : (getEntryPlanUnavailableReason(plan) || 'Entry plan data unavailable.')]
        : [isZh ? '当前计划未通过风险门控，暂时不能执行。' : (getEntryPlanActionTooltip(plan) || 'Unknown blocker.')];
      Modal.warning({
        title: agentText('Order blocked', '订单已阻断'),
        content: agentText(
          `This plan cannot be executed: ${blockers.slice(0, 3).join('; ')}`,
          `该计划当前无法执行：${blockers.slice(0, 3).join('；')}`,
        ),
        okText: agentText('Close', '关闭'),
        className: 'agent-confirm-dialog',
        rootClassName: 'agent-confirm-modal',
      });
      return;
    }

    if (action === 'SKIP' || aiDecision === 'SKIP') {
      message.info(agentText('No action is needed for this plan.', '此计划当前无需操作。'));
      return;
    }

    if (action === 'WAIT_FOR_ENTRY' || tr === 'WAIT') {
      // Add to watchlist
      addToWatchlist(plan);
      return;
    }

    if (action === 'READY_REVIEW') {
      message.info(agentText(`${plan.symbol}: review candidates stay under observation and cannot submit an order.`, `${plan.symbol}：复核中的候选只会继续监控，不能提交订单。`));
      addToWatchlist(plan);
      return;
    }

    if (action === 'BUY_READY') {
      // Open confirmation modal
      setExecuteTarget(plan);
      setLiveOrderAccepted(false);
      setExecuteModalVisible(true);
    }
  };

  const addToWatchlist = async (plan: any) => {
    try {
      const item = {
        symbol: plan.symbol,
        setupType: plan.setup,
        aiDecision: plan.aiDecision,
        confidence: plan.confidence,
        entryZoneLow: getEntryPlanZone(plan).low,
        entryZoneHigh: getEntryPlanZone(plan).high,
        trigger: plan.triggerCondition || '',
        stopLoss: plan.stopLoss,
        takeProfit1: plan.takeProfit1,
        takeProfit2: plan.takeProfit2,
        riskReward: plan.riskReward1,
        shares: plan.positionSizeShares || plan.shares || 0,
        finalAction: plan.finalAction,
        riskGateStatus: (plan.riskGate || plan.hardRiskGate || {}).status || '',
        dataQuality: plan.dataQuality || '',
        nextStep: plan.nextStep || '',
        decisionReason: plan.decisionReason || '',
        riskComment: plan.riskComment || '',
        invalidationComment: plan.invalidationComment || '',
        source: 'Entry Plan',
        selectedBy: plan.selectedBy || '',
      };
      const res = await aiAgentWatchlistAPI.add(item);
      if (res.data.success) {
        const action = res.data.action === 'UPDATED'
          ? agentText('Watchlist entry updated.', '已更新观察列表中的记录。')
          : agentText('Added to the entry watchlist.', '已加入入场观察列表。');
        message.success(`${plan.symbol}: ${action}`);
        fetchAiWatchlist();
      }
    } catch (e: any) {
      const detail = agentErrorText(
        e?.response?.data?.message || e?.message,
        'Unknown watchlist error.',
        '观察列表服务暂不可用，请稍后重试。',
      );
      message.error(agentText(`Could not add the symbol to the watchlist: ${detail}`, `无法加入观察列表：${detail}`));
    }
  };

  // ===== Exit Scan Functions =====

  // Determine position source: ai_managed, user_marked, manual, unknown
  const getPositionSource = useCallback((symbol: string): 'ai_managed' | 'user_marked' | 'manual' | 'unknown' => {
    // Check if this symbol was in AI execution successful history
    const execCandidate = aiExecutionList.find(c => c.symbol === symbol && c.executionStatus === 'filled');
    if (execCandidate) return 'ai_managed';

    // Check if there's a linked entry plan
    const ep = entryPlanResultsBySymbol[symbol];
    if (ep && ep.symbol) return 'ai_managed';

    // Check cached scanner/fine-scan data for AI involvement
    const scannerResult = (scannerSnapshot.marketScanner.results || []).find((r: any) => r.symbol === symbol);
    const fineScanResult = (scannerSnapshot.fineScan.results || []).find((r: any) => r.symbol === symbol);
    if (scannerResult || fineScanResult) return 'ai_managed';

    // Default: unknown (not explicitly user-marked — will generate exit plan)
    return 'unknown';
  }, [aiExecutionList, entryPlanResultsBySymbol, scannerSnapshot.marketScanner.results, scannerSnapshot.fineScan.results]);

  // Generate fallback exit plan using rules when no entry plan exists
  const generateExitPlanFallback = useCallback((position: any): {
    stopPrice: number;
    targetPrice: number;
    reason: string;
  } => {
    const avgEntry = Number(position.avgEntryPrice) || 0;
    const currentPrice = Number(position.currentPrice) || 0;
    const plPct = Number(position.unrealizedPLPercent) || 0;

    // Use avg entry as baseline; fall back to current price if avg entry is 0
    const baseline = avgEntry > 0 ? avgEntry : currentPrice;

    // Entry and Exit Plans share one mandate. Horizon owns the initial price
    // geometry; risk profile owns allocation and account loss budgets.
    const stopPct = 1 - strategyMandate.maxStopPct / 100;
    const targetPct = 1 + (strategyMandate.maxStopPct / 100) * strategyMandate.targetR;

    // Stop price
    let stopPrice = baseline * stopPct;

    // If already in a significant loss, tighten stop
    if (plPct <= -5) {
      stopPrice = currentPrice * 0.97; // 3% below current
    }

    // Target price
    let targetPrice = baseline * targetPct;

    // If already in profit > 5%, adjust target to lock in gains
    if (plPct > 5) {
      targetPrice = Math.max(baseline * (targetPct - 0.02), currentPrice * 1.03);
    }

    return {
      stopPrice: Math.round(stopPrice * 100) / 100,
      targetPrice: Math.round(targetPrice * 100) / 100,
      reason: agentText(
        `Generated from avg entry $${baseline.toFixed(2)}: stop $${(baseline * stopPct).toFixed(2)} (-${((1 - stopPct) * 100).toFixed(0)}%), target $${(baseline * targetPct).toFixed(2)} (+${((targetPct - 1) * 100).toFixed(0)}%) [${riskProfile}/${timeHorizon}]`,
        `根据平均成本 $${baseline.toFixed(2)} 生成：止损 $${(baseline * stopPct).toFixed(2)}（-${((1 - stopPct) * 100).toFixed(0)}%），目标 $${(baseline * targetPct).toFixed(2)}（+${((targetPct - 1) * 100).toFixed(0)}%）`,
      ),
    };
  }, [agentText, riskProfile, strategyMandate.maxStopPct, strategyMandate.targetR, timeHorizon]);

  // Evaluate exit plan for a position
  const evaluateExitPlan = useCallback((position: any, entryPlan: any): {
    decision: 'sell_now' | 'place_target_limit' | 'hold' | 'manual_review' | 'blocked';
    orderType?: 'market' | 'limit';
    exitPrice?: number;
    stopPrice?: number;
    targetPrice?: number;
    reason: string;
    confidence: number;
    source: 'entry_plan' | 'generated';
  } => {
    const _symbol = position.symbol; // eslint-disable-line @typescript-eslint/no-unused-vars
    const currentPrice = Number(position.currentPrice) || 0;
    const _avgEntry = Number(position.avgEntryPrice) || 0; // eslint-disable-line @typescript-eslint/no-unused-vars
    const plPct = Number(position.unrealizedPLPercent) || 0;

    // If no entry plan, generate one using rules
    if (!entryPlan || !entryPlan.symbol) {
      const fallback = generateExitPlanFallback(position);

      // Check immediate sell conditions on the fallback
      const severeLossThreshold = -strategyMandate.maxStopPct;
      if (plPct <= severeLossThreshold) {
        return {
          decision: 'sell_now',
          orderType: 'market',
          stopPrice: fallback.stopPrice,
          targetPrice: fallback.targetPrice,
          reason: agentText(
            `Severe loss ${plPct.toFixed(1)}% — immediate exit recommended`,
            `当前亏损 ${plPct.toFixed(1)}%，建议立即退出`,
          ),
          confidence: 85,
          source: 'generated',
        };
      }

      // Price below generated stop — sell now
      if (currentPrice > 0 && currentPrice <= fallback.stopPrice) {
        return {
          decision: 'sell_now',
          orderType: 'market',
          stopPrice: fallback.stopPrice,
          targetPrice: fallback.targetPrice,
          reason: agentText(
            `Price $${currentPrice.toFixed(2)} is below stop $${fallback.stopPrice.toFixed(2)} — immediate exit`,
            `当前价 $${currentPrice.toFixed(2)} 已低于止损 $${fallback.stopPrice.toFixed(2)}，建议立即退出`,
          ),
          confidence: 80,
          source: 'generated',
        };
      }

      // Price near/at generated target — place limit sell
      if (currentPrice > 0 && currentPrice >= fallback.targetPrice * 0.98) {
        return {
          decision: 'place_target_limit',
          orderType: 'limit',
          exitPrice: fallback.targetPrice,
          stopPrice: fallback.stopPrice,
          targetPrice: fallback.targetPrice,
          reason: agentText(
            `Price is near generated target $${fallback.targetPrice.toFixed(2)} — place limit sell`,
            `价格接近目标 $${fallback.targetPrice.toFixed(2)}，建议提交限价卖单`,
          ),
          confidence: 65,
          source: 'generated',
        };
      }

      // Default: place target limit sell
      return {
        decision: 'place_target_limit',
        orderType: 'limit',
        exitPrice: fallback.targetPrice,
        stopPrice: fallback.stopPrice,
        targetPrice: fallback.targetPrice,
        reason: fallback.reason,
        confidence: 55,
        source: 'generated',
      };
    }

    // Entry plan exists — use its data
    const stopLoss = entryPlan.stopLoss ?? entryPlan.stop_loss;
    const takeProfit = entryPlan.takeProfit1 ?? entryPlan.take_profit ?? entryPlan.target;
    const aiDecision = entryPlan.aiDecision ?? entryPlan.finalAction;
    const riskGate = entryPlan.riskGateStatus ?? entryPlan.risk_gate;

    // Gate: risk gate failed
    if (riskGate === 'FAIL' || riskGate === 'BLOCKED') {
      return {
        decision: 'sell_now',
        orderType: 'market',
        stopPrice: stopLoss,
        targetPrice: takeProfit,
        reason: agentText(
          `Risk gate ${riskGate} — immediate exit recommended`,
          `风险闸门状态为 ${riskGate === 'PASS' ? '通过' : riskGate === 'REVIEW' ? '待复核' : '阻断'}，建议立即退出`,
        ),
        confidence: 80,
        source: 'entry_plan',
      };
    }

    // Gate: stop loss triggered (current price below stop)
    if (stopLoss && currentPrice > 0 && currentPrice <= stopLoss) {
      return {
        decision: 'sell_now',
        orderType: 'market',
        stopPrice: stopLoss,
        targetPrice: takeProfit,
        reason: agentText(
          `Price $${currentPrice.toFixed(2)} is at or below stop $${stopLoss.toFixed(2)}`,
          `当前价 $${currentPrice.toFixed(2)} 已触及或跌破止损 $${stopLoss.toFixed(2)}`,
        ),
        confidence: 90,
        source: 'entry_plan',
      };
    }

    // Gate: the same horizon-specific loss boundary used by Entry Plan.
    if (plPct <= -strategyMandate.maxStopPct) {
      return {
        decision: 'sell_now',
        orderType: 'market',
        stopPrice: stopLoss,
        targetPrice: takeProfit,
        reason: agentText(
          `Severe loss ${plPct.toFixed(1)}% — immediate exit recommended`,
          `当前亏损 ${plPct.toFixed(1)}%，建议立即退出`,
        ),
        confidence: 85,
        source: 'entry_plan',
      };
    }

    // AI decision says sell
    if (aiDecision === 'SELL' || aiDecision === 'EXIT') {
      return {
        decision: 'sell_now',
        orderType: 'market',
        stopPrice: stopLoss,
        targetPrice: takeProfit,
        reason: agentText(`AI decision: ${aiDecision}`, `AI 决策：${agentEnumLabel(aiDecision)}`),
        confidence: 75,
        source: 'entry_plan',
      };
    }

    // Target reached (current price at or above target)
    if (takeProfit && currentPrice > 0 && currentPrice >= takeProfit * 0.98) {
      return {
        decision: 'place_target_limit',
        orderType: 'limit',
        exitPrice: takeProfit,
        stopPrice: stopLoss,
        targetPrice: takeProfit,
        reason: agentText(
          `Price is near or at target $${takeProfit.toFixed(2)} — place limit sell`,
          `价格接近或已达到目标 $${takeProfit.toFixed(2)}，建议提交限价卖单`,
        ),
        confidence: 70,
        source: 'entry_plan',
      };
    }

    // Has target, not yet reached — place target limit order
    if (takeProfit && currentPrice > 0 && currentPrice < takeProfit * 0.98) {
      return {
        decision: 'place_target_limit',
        orderType: 'limit',
        exitPrice: takeProfit,
        stopPrice: stopLoss,
        targetPrice: takeProfit,
        reason: agentText(
          `Target $${takeProfit.toFixed(2)} — place limit sell at target`,
          `目标价 $${takeProfit.toFixed(2)}，建议在目标价提交限价卖单`,
        ),
        confidence: 60,
        source: 'entry_plan',
      };
    }

    // Default: hold
    return {
      decision: 'hold',
      stopPrice: stopLoss,
      targetPrice: takeProfit,
      reason: agentText('No exit trigger — hold position', '尚未触发退出条件，继续持有'),
      confidence: 50,
      source: 'entry_plan',
    };
  }, [agentEnumLabel, agentText, generateExitPlanFallback, strategyMandate.maxStopPct]);

  // Run Exit Scan
  const [exitScanRunning, setExitScanRunning] = useState(false);
  const exitScanInFlightRef = useRef(false);

  const runExitScanLegacy = useCallback(async (options?: { autoSubmit?: boolean; mode?: 'paper' | 'real'; holdingsOverride?: any[]; suppressDiscord?: boolean }) => {
    if (exitScanInFlightRef.current || exitScanRunning) return [];
    exitScanInFlightRef.current = true;
    // Use holdingsOverride if provided, then ref (always fresh), then closure variable as fallback
    const holdingsToScan = options?.holdingsOverride || holdingsRef.current || holdings;
    const exitScanMode = options?.mode || tradeMode;
    console.log(`[ExitScan] start`);
    console.log(`[ExitScan] tradingMode=${exitScanMode}`);
    console.log(`[ExitScan] holdings count=${holdingsToScan.length}, override=${!!options?.holdingsOverride}, ref=${holdingsRef.current.length}, closure=${holdings.length}`);
    if (holdingsToScan.length > 0) {
      console.log(`[ExitScan] holdings symbols=[${holdingsToScan.map((p: any) => p.symbol).join(',')}]`);
    }
    if (holdingsToScan.length === 0) {
      console.log('[ExitScan] skip reason=no_current_holdings');
      setExitScanStatus('skipped');
      exitScanInFlightRef.current = false;
      return [];
    }
    // Only auto-submit sell orders in AI mode; Hybrid/Manual are review-only
    const shouldAutoSubmit = options?.autoSubmit !== false && pipelineMode === 'ai';

    // Check for already-submitted exit orders to prevent duplicates
    const existingExitOrderSymbols = new Set([
      ...submittedExitOrders.map(o => o.symbol),
      ...openSellOrders.map(o => o.symbol),
    ]);

    setExitScanRunning(true);
    setExitScanStatus('scanning');
    const results: any[] = [];

    try {
      for (const position of holdingsToScan) {
        const symbol = position.symbol;

        // Skip if already has a pending exit order
        if (existingExitOrderSymbols.has(symbol)) {
          const existingSellOrder = openSellOrders.find(o => o.symbol === symbol);
          const orderInfo = existingSellOrder
            ? `${(existingSellOrder.type || 'market').toUpperCase()}${existingSellOrder.limit_price ? ` $${Number(existingSellOrder.limit_price).toFixed(2)}` : ''}`
            : agentText('submitted', '已提交');
          results.push({
            symbol,
            qty: position.qty,
            avgEntry: position.avgEntryPrice,
            currentPrice: position.currentPrice,
            pl: position.unrealizedPL,
            plPct: position.unrealizedPLPercent,
            positionSource: getPositionSource(symbol),
            exitDecision: 'blocked',
            reason: agentText(`Active sell order exists (${orderInfo})`, `已有生效中的卖出订单（${orderInfo}）`),
            status: 'blocked',
          });
          continue;
        }

        const source = getPositionSource(symbol);
        const ep = entryPlanResultsBySymbol[symbol];
        const evalResult = evaluateExitPlan(position, ep);

        const result: any = {
          symbol,
          qty: position.qty,
          avgEntry: position.avgEntryPrice,
          currentPrice: position.currentPrice,
          pl: position.unrealizedPL,
          plPct: position.unrealizedPLPercent,
          positionSource: source,
          entryPlanTarget: evalResult.targetPrice ?? ep?.takeProfit1 ?? ep?.take_profit ?? ep?.target,
          entryPlanStop: evalResult.stopPrice ?? ep?.stopLoss ?? ep?.stop_loss,
          exitDecision: evalResult.decision,
          exitOrderType: evalResult.orderType,
          exitPrice: evalResult.exitPrice,
          reason: evalResult.reason,
          exitPlanSource: evalResult.source,
          status: 'pending',
        };

        // Only user_marked positions get manual_review — all others can auto-submit
        if (source === 'user_marked') {
          result.status = 'manual_review';
          result.reason = agentText('User-marked position — no automatic exit order', '用户手动标记的持仓，不自动提交退出订单');
          results.push(result);
          continue;
        }

        // Auto-submit for non-user-marked positions (paper and real both auto-submit in AI mode)
        if (shouldAutoSubmit &&
            (evalResult.decision === 'sell_now' || evalResult.decision === 'place_target_limit' || evalResult.decision === 'hold')) {
          try {
            const sellQty = Number(position.qty) || 0;
            if (sellQty <= 0) {
              result.status = 'failed';
              result.error = agentText(`Invalid sell quantity: ${position.qty}`, `卖出数量无效：${position.qty}`);
              results.push(result);
              continue;
            }

            const tpPrice = evalResult.targetPrice || result.entryPlanTarget;
            const slPrice = evalResult.stopPrice || result.entryPlanStop;

            if (evalResult.decision === 'sell_now') {
              // Immediate market sell — price below stop
              const orderPayload: any = {
                mode: exitScanMode, symbol, side: 'sell', qty: sellQty,
                type: 'market', time_in_force: 'day', confirmed: true,
              };
              const res = await tradingAccountAPI.placeOrder(orderPayload);
              if (res.data.success) {
                result.status = 'submitted';
                result.alpacaOrderId = res.data.order?.id;
                result.orderType = 'market';
                scannerStateStore.addSubmittedExitOrder({ symbol, orderId: res.data.order?.id || '', orderType: 'market', submittedAt: new Date().toISOString() });
                message.success(agentText(`Exit order submitted: sell ${sellQty} ${symbol} shares at market.`, `退出订单已提交：按市价卖出 ${sellQty} 股 ${symbol}。`));
              } else {
                result.status = 'failed';
                result.error = agentErrorText(
                  res.data.message || res.data.error,
                  'Market sell failed.',
                  '市价卖出订单提交失败。',
                );
              }
            } else if (evalResult.decision === 'place_target_limit' && tpPrice && tpPrice > 0) {
              // Take-profit limit sell
              const orderPayload: any = {
                mode: exitScanMode, symbol, side: 'sell', qty: sellQty,
                type: 'limit', limit_price: Math.round(Number(tpPrice) * 100) / 100,
                time_in_force: 'day', confirmed: true,
              };
              const res = await tradingAccountAPI.placeOrder(orderPayload);
              if (res.data.success) {
                result.status = 'submitted';
                result.alpacaOrderId = res.data.order?.id;
                result.orderType = 'limit';
                result.exitPrice = tpPrice;
                result.reason = agentText(
                  `Take-profit limit sell at $${tpPrice.toFixed(2)}`,
                  `在 $${tpPrice.toFixed(2)} 提交止盈限价卖单`,
                );
                scannerStateStore.addSubmittedExitOrder({ symbol, orderId: res.data.order?.id || '', orderType: 'limit', exitPrice: tpPrice, submittedAt: new Date().toISOString() });
                message.success(agentText(`Take-profit order submitted: sell ${sellQty} ${symbol} shares at $${tpPrice.toFixed(2)}.`, `止盈订单已提交：以 $${tpPrice.toFixed(2)} 卖出 ${sellQty} 股 ${symbol}。`));
              } else {
                result.status = 'failed';
                result.error = agentErrorText(
                  res.data.message || res.data.error,
                  'Limit sell failed.',
                  '限价卖出订单提交失败。',
                );
              }
            } else if (evalResult.decision === 'hold' && tpPrice && tpPrice > 0 && slPrice && slPrice > 0) {
              // Position between stop and target — place OCO exit: take-profit limit + stop-loss stop
              const tpLimit = Math.round(Number(tpPrice) * 100) / 100;
              const slStop = Math.round(Number(slPrice) * 100) / 100;
              const orderPayload: any = {
                mode: exitScanMode, symbol, side: 'sell', qty: sellQty,
                type: 'limit', limit_price: tpLimit,
                time_in_force: 'day', confirmed: true,
                order_class: 'oco',
                take_profit: { limit_price: tpLimit },
                stop_loss: { stop_price: slStop },
              };
              try {
                const res = await tradingAccountAPI.placeOrder(orderPayload);
                if (res.data.success) {
                  result.status = 'submitted';
                  result.alpacaOrderId = res.data.order?.id;
                  result.orderType = 'oco';
                  result.exitPrice = tpLimit;
                  result.stopPrice = slStop;
                  result.reason = agentText(
                    `OCO exit: take profit $${tpLimit.toFixed(2)} / stop $${slStop.toFixed(2)}`,
                    `OCO 退出：止盈 $${tpLimit.toFixed(2)} / 止损 $${slStop.toFixed(2)}`,
                  );
                  scannerStateStore.addSubmittedExitOrder({ symbol, orderId: res.data.order?.id || '', orderType: 'oco', exitPrice: tpLimit, submittedAt: new Date().toISOString() });
                  message.success(agentText(`${symbol} OCO exit submitted. Take profit: $${tpLimit.toFixed(2)}. Stop: $${slStop.toFixed(2)}.`, `${symbol} 的 OCO 退出订单已提交。止盈：$${tpLimit.toFixed(2)}，止损：$${slStop.toFixed(2)}。`));
                } else if (res.data.status === 'confirmation_required') {
                  result.status = 'pending_confirm';
                  result.reason = agentText(
                    res.data.message || 'Live trading requires confirmation.',
                    '实盘订单需要人工确认。',
                  );
                } else {
                  // OCO rejected — fall back to simple limit sell
                  const errDetail = agentErrorText(
                    res.data.message || res.data.error,
                    'OCO order was rejected.',
                    'OCO 订单未被接受。',
                  );
                  console.warn(`[ExitScan] ${symbol} OCO rejected, falling back to limit sell: ${errDetail}`);
                  const fbRes = await tradingAccountAPI.placeOrder({
                    mode: exitScanMode, symbol, side: 'sell', qty: sellQty,
                    type: 'limit', limit_price: tpLimit, time_in_force: 'day', confirmed: true,
                  });
                  if (fbRes.data.success) {
                    result.status = 'submitted';
                    result.alpacaOrderId = fbRes.data.order?.id;
                    result.orderType = 'limit';
                    result.exitPrice = tpLimit;
                    result.reason = agentText(
                      `Take-profit limit sell at $${tpLimit.toFixed(2)} (OCO unavailable: ${errDetail})`,
                      `OCO 不可用，已改为在 $${tpLimit.toFixed(2)} 提交止盈限价卖单`,
                    );
                    scannerStateStore.addSubmittedExitOrder({ symbol, orderId: fbRes.data.order?.id || '', orderType: 'limit', exitPrice: tpLimit, submittedAt: new Date().toISOString() });
                    message.success(agentText(`Fallback limit exit submitted: sell ${sellQty} ${symbol} shares at $${tpLimit.toFixed(2)}.`, `备用限价退出订单已提交：以 $${tpLimit.toFixed(2)} 卖出 ${sellQty} 股 ${symbol}。`));
                  } else {
                    result.status = 'failed';
                    result.error = agentText(
                      `OCO and limit fallback both failed: ${errDetail}`,
                      `OCO 与备用限价订单均提交失败：${errDetail}`,
                    );
                  }
                }
              } catch (ocoErr: any) {
                // OCO threw — try fallback limit sell
                console.warn(`[ExitScan] ${symbol} OCO exception, falling back to limit sell:`, ocoErr.message);
                try {
                  const fbRes = await tradingAccountAPI.placeOrder({
                    mode: exitScanMode, symbol, side: 'sell', qty: sellQty,
                    type: 'limit', limit_price: tpLimit, time_in_force: 'day', confirmed: true,
                  });
                  if (fbRes.data.success) {
                    result.status = 'submitted';
                    result.alpacaOrderId = fbRes.data.order?.id;
                    result.orderType = 'limit';
                    result.exitPrice = tpLimit;
                    result.reason = agentText('Take-profit limit sell (OCO fallback)', '已改用止盈限价卖单');
                    message.success(agentText(`${symbol} fallback limit exit submitted.`, `${symbol} 的备用限价退出订单已提交。`));
                  } else {
                    result.status = 'failed';
                    result.error = agentErrorText(
                      fbRes.data.message || fbRes.data.error,
                      'OCO and limit fallback failed.',
                      'OCO 与备用限价订单均提交失败。',
                    );
                  }
                } catch (fbErr: any) {
                  result.status = 'failed';
                  result.error = agentErrorText(
                    fbErr?.response?.data?.message || fbErr?.message,
                    'OCO and limit fallback both failed.',
                    'OCO 与备用限价订单均提交失败。',
                  );
                }
              }
            } else {
              // hold with incomplete stop/target — monitoring only
              result.status = 'monitoring';
              result.reason = agentText(
                `Monitoring only — ${!tpPrice || tpPrice <= 0 ? 'target unavailable' : ''}${(!tpPrice || tpPrice <= 0) && (!slPrice || slPrice <= 0) ? ', ' : ''}${!slPrice || slPrice <= 0 ? 'stop unavailable' : ''}`,
                `仅监控 — ${!tpPrice || tpPrice <= 0 ? '缺少目标价' : ''}${(!tpPrice || tpPrice <= 0) && (!slPrice || slPrice <= 0) ? '，' : ''}${!slPrice || slPrice <= 0 ? '缺少止损价' : ''}`,
              );
            }
          } catch (e: any) {
            const errBody = e?.response?.data;
            const errDetail = agentErrorText(
              errBody?.message || errBody?.error || e?.message,
              'Order request failed.',
              '订单请求失败，请稍后重试。',
            );
            result.status = 'failed';
            result.error = errDetail;
            console.error(`[ExitScan] ${symbol} order error:`, errBody || e);
            message.error(agentText(`Exit order failed for ${symbol}: ${errDetail}`, `${symbol} 的退出订单失败：${errDetail}`), 8);
          }
        } else if (evalResult.decision === 'hold') {
          result.status = 'no_order';
        } else if (evalResult.decision === 'manual_review') {
          result.status = 'manual_review';
        } else {
          result.status = 'no_order';
        }

        results.push(result);
      }

      setExitScanResults(results);
      setExitScanStatus('completed');
      message.success(agentText(`Exit scan complete. ${results.length} positions checked.`, `退出扫描完成，已检查 ${results.length} 个持仓。`));
      const actionableExitSignals = results.filter(r => r.exitDecision === 'sell_now' || r.exitDecision === 'place_target_limit');
      if (!options?.suppressDiscord) {
        notificationAPI.sendDiscordEvent('exit_scan', {
          event_id: `exit-scan-${Date.now()}-${results.length}`,
          mode: exitScanMode,
          holdingsScanned: results.length,
          sellCount: results.filter(r => r.exitDecision === 'sell_now').length,
          reduceCount: results.filter(r => r.exitDecision === 'place_target_limit').length,
          holdCount: results.filter(r => r.exitDecision === 'hold' || r.status === 'no_order').length,
          signals: actionableExitSignals.slice(0, 8).map(r => ({
            symbol: r.symbol,
            action: r.exitDecision === 'sell_now' ? 'SELL' : 'REDUCE',
            reason: r.reason,
            currentPrice: r.currentPrice,
            target: r.entryPlanTarget,
            stop: r.entryPlanStop,
          })),
        }).catch(() => {});
      }
      return [...results];
    } catch (e: any) {
      setExitScanStatus('failed');
      message.error(agentErrorText(
        e?.response?.data?.message || e?.message,
        'Exit scan failed.',
        '退出扫描失败，请稍后重试。',
      ));
      if (!options?.suppressDiscord) {
        notificationAPI.sendDiscordEvent('error', {
          event_id: `exit-scan-error-${Date.now()}`,
          step: 'Exit Scan',
          status: 'failed',
          reason: e?.message || 'Unknown error',
          action: 'Review holdings, Alpaca configuration, and exit scan inputs.',
        }).catch(() => {});
      }
      return [];
    } finally {
      exitScanInFlightRef.current = false;
      setExitScanRunning(false);
      // Refresh holdings if any orders were submitted
      if (results.some(r => r.status === 'submitted')) {
        setTimeout(() => fetchHoldings(), 2000);
      }
    }
  }, [agentErrorText, agentText, exitScanRunning, holdings, submittedExitOrders, openSellOrders, tradeMode, pipelineMode, entryPlanResultsBySymbol, getPositionSource, evaluateExitPlan, setExitScanStatus, setExitScanResults, fetchHoldings]);

  // The browser no longer owns exit decisions or broker order construction.
  // Keep the legacy closure temporarily for persisted sessions while all new
  // scans use the same backend engine as the unattended Position Guard.
  void runExitScanLegacy;
  const runExitScan = useCallback(async (options?: { autoSubmit?: boolean; mode?: 'paper' | 'real'; holdingsOverride?: any[]; suppressDiscord?: boolean }) => {
    if (exitScanInFlightRef.current || exitScanRunning) return [];
    exitScanInFlightRef.current = true;
    setExitScanRunning(true);
    setExitScanStatus('scanning');
    const exitMode = options?.mode || tradeMode;
    try {
      const response = await pipelineAutoAPI.runExitScan({
        entryPlans: Array.isArray(entryPlanResults) ? entryPlanResults : [],
        riskProfile,
        timeHorizon,
        pipelineMode,
        tradeMode: exitMode,
        autoSubmit: options?.autoSubmit ?? pipelineMode === 'ai',
        aiReview: true,
        suppressDiscord: options?.suppressDiscord ?? false,
      });
      const payload = response.data || {};
      const rows = Array.isArray(payload.signals) ? payload.signals : [];
      scannerStateStore.updateExitScan({
        status: payload.success === false ? 'failed' : (rows.length ? 'completed' : 'skipped'),
        results: rows,
        runId: payload.runId || null,
        lastUpdated: payload.evaluatedAt || new Date().toISOString(),
        summary: payload,
      });
      rows
        .filter((row: any) => row.orderId && String(row.status || '').toLowerCase() === 'submitted')
        .forEach((row: any) => scannerStateStore.addSubmittedExitOrder({
          symbol: row.symbol,
          orderId: row.orderId,
          orderType: row.exitOrderType || 'sell',
          exitPrice: row.exitPrice,
          submittedAt: new Date().toISOString(),
        }));
      if (payload.success === false) {
        message.error(agentErrorText(
          payload.message || payload.error,
          'Exit scan failed.',
          '退出扫描失败，请稍后重试。',
        ));
      } else if (rows.length === 0) {
        message.info(t.agent.noActiveHoldings);
      } else {
        message.success(agentText(`Position guard checked ${rows.length} holding${rows.length === 1 ? '' : 's'}.`, `持仓保护已检查 ${rows.length} 个持仓。`));
      }
      return rows;
    } catch (error: any) {
      const detail = agentErrorText(
        error?.response?.data?.message || error?.response?.data?.error || error?.message,
        'Exit scan failed.',
        '退出扫描失败，请稍后重试。',
      );
      setExitScanStatus('failed');
      message.error(agentText(`Exit scan failed: ${detail}`, `退出扫描失败：${detail}`));
      return [];
    } finally {
      exitScanInFlightRef.current = false;
      setExitScanRunning(false);
      window.setTimeout(() => fetchHoldings(exitMode), 1200);
    }
  }, [agentErrorText, agentText, entryPlanResults, exitScanRunning, fetchHoldings, pipelineMode, riskProfile, setExitScanStatus, timeHorizon, tradeMode, t.agent.noActiveHoldings]);

  // ===== AI Watchlist Functions =====
  useEffect(() => {
    aiWatchlistItemsRef.current = aiWatchlistItems;
  }, [aiWatchlistItems]);

  const refreshWatchlistPrices = useCallback(async (items?: any[]) => {
    const currentItems = items || aiWatchlistItemsRef.current;
    if (currentItems.length === 0) return;
    const symbols = currentItems.map((i: any) => i.symbol).filter(Boolean);
    if (symbols.length === 0) return;
    try {
      // Batch in groups of 10
      const batches: string[][] = [];
      for (let i = 0; i < symbols.length; i += 10) {
        batches.push(symbols.slice(i, i + 10));
      }
      const priceMap: Record<string, { price: number; changePct: number }> = {};
      for (const batch of batches) {
        try {
          const stocks = await marketDataService.getBatchStockData(batch);
          for (const s of stocks) {
            priceMap[s.symbol] = {
              price: s.price ?? 0,
              changePct: s.changePercent ?? s.change ?? 0,
            };
          }
        } catch { /* skip failed batch */ }
      }
      if (Object.keys(priceMap).length > 0) {
        setAiWatchlistItems(prev => prev.map(item => ({
          ...item,
          currentPrice: priceMap[item.symbol]?.price ?? item.currentPrice,
          changePercent: priceMap[item.symbol]?.changePct ?? item.changePercent,
          lastUpdated: new Date().toISOString(),
        })));
      }
    } catch (e) {
      console.error('Failed to refresh watchlist prices:', e);
    }
  }, []);

  const fetchAiWatchlist = useCallback(async () => {
    try {
      const res = await aiAgentWatchlistAPI.list();
      if (res.data.success) {
        const items = res.data.items || [];
        setAiWatchlistItems(items);
        if (items.length > 0) {
          refreshWatchlistPrices(items);
        }
      }
    } catch (e) {
      console.error('Failed to fetch AI watchlist:', e);
    }
  }, [refreshWatchlistPrices]);

  const removeFromWatchlist = async (id: string, symbol: string) => {
    try {
      await aiAgentWatchlistAPI.remove(id);
      setAiWatchlistItems(prev => prev.filter(i => i.id !== id));
      message.success(agentText(`${symbol} removed from the watchlist.`, `${symbol} 已从观察列表移除。`));
    } catch (e: any) {
      const detail = agentErrorText(e?.response?.data?.message || e?.message, 'Unknown watchlist error.', '观察列表服务暂不可用，请稍后重试。');
      message.error(agentText(`Could not remove ${symbol}: ${detail}`, `无法移除 ${symbol}：${detail}`));
    }
  };

  const clearAllWatchlist = () => {
    Modal.confirm({
      title: agentText('Clear the AI watchlist?', '清空 AI 观察列表？'),
      content: agentText(
        `This removes all ${aiWatchlistItems.length} symbols from the watchlist. You cannot undo this action.`,
        `这会从观察列表移除全部 ${aiWatchlistItems.length} 个标的，且无法撤销。`,
      ),
      okText: agentText('Clear watchlist', '清空观察列表'),
      okType: 'danger',
      cancelText: agentText('Cancel', '取消'),
      className: 'agent-confirm-dialog',
      rootClassName: 'agent-confirm-modal',
      onOk: async () => {
        try {
          for (const item of aiWatchlistItems) {
            await aiAgentWatchlistAPI.remove(item.id);
          }
          setAiWatchlistItems([]);
          message.success(agentText('The watchlist is now empty.', '观察列表已清空。'));
        } catch (e: any) {
          const detail = agentErrorText(e?.response?.data?.message || e?.message, 'Unknown watchlist error.', '观察列表服务暂不可用，请稍后重试。');
          message.error(agentText(`Could not clear the watchlist: ${detail}`, `无法清空观察列表：${detail}`));
          fetchAiWatchlist();
        }
      },
    });
  };

  // Add a watchlist item (or entry plan) to AI Execution list
  const addToExecution = (item: any) => {
    const symbol = (item.symbol || '').toUpperCase();
    if (!symbol) { message.warning(agentText('Select a symbol first.', '请先选择一个标的。')); return; }

    // Duplicate check
    const exists = aiExecutionList.some(e => e.symbol === symbol && e.executionStatus !== 'failed' && e.executionStatus !== 'canceled');
    if (exists) { message.info(agentText(`${symbol} is already in the execution list.`, `${symbol} 已在执行列表中。`)); return; }

    const ep = entryPlanResultsBySymbol[symbol] || normalizeWatchlistToEntryPlan(item);
    const recommendedShares = ep.positionSizeShares || item.shares || item.positionSizeShares || 0;
    const { low: entryLow, high: entryHigh } = getEntryPlanZone(ep);
    const entryPrice = entryHigh || entryLow || getEntryPlanCurrentPrice(ep) || getEntryPlanCurrentPrice(item) || 0;

    const executionItem = {
      symbol,
      // Entry plan data
      setup: ep.setup || item.setup || item.setupType,
      entryZoneLow: entryLow,
      entryZoneHigh: entryHigh,
      stopLoss: ep.stopLoss || item.stopLoss,
      takeProfit1: ep.takeProfit1 || item.takeProfit1,
      riskReward1: ep.riskReward1 || item.riskReward1 || item.riskReward,
      confidence: ep.confidence || item.confidence,
      aiDecision: ep.aiDecision || item.aiDecision,
      riskGate: ep.riskGate || item.riskGate || undefined,
      riskGateStatus: (ep.riskGate || {}).status || ep.riskGateStatus || item.riskGateStatus,
      dataQuality: ep.dataQuality || item.dataQuality,
      positionSizeShares: recommendedShares,
      positionSizeDollars: ep.positionSizeDollars || item.positionSizeDollars,
      // User-editable order params
      qtyMode: 'shares' as const,
      userQty: recommendedShares > 0 ? recommendedShares : 1,
      dollarAmount: recommendedShares > 0 && entryPrice > 0 ? Math.round(recommendedShares * entryPrice) : 0,
      orderType: 'limit' as const,
      limitPrice: entryPrice > 0 ? entryPrice : undefined,
      stopPrice: ep.stopLoss || undefined,
      trailPrice: undefined,
      trailPercent: undefined,
      timeInForce: 'day' as const,
      // Execution tracking
      executionStatus: 'draft' as const,
      // Metadata
      source: 'watchlist',
      addedAt: new Date().toISOString(),
      entryPlan: ep,
    };

    setAiExecutionList(prev => [...prev, executionItem]);
    message.success(agentText(`${symbol} added to the execution list.`, `${symbol} 已加入执行列表。`));
  };

  // Check if a symbol is already in the execution list
  const isInExecutionList = (symbol: string): boolean => {
    return aiExecutionList.some(e => e.symbol === symbol && e.executionStatus !== 'failed' && e.executionStatus !== 'canceled');
  };

  const getWatchlistReadiness = (item: any): string => {
    const rg = (item.riskGateStatus || '').toUpperCase();
    const ai = (item.aiDecision || '').toUpperCase();
    const action = getEntryPlanEffectiveAction(item);

    if (rg === 'BLOCK' || action === 'BLOCKED_BY_RISK') return 'Blocked';
    if (rg === 'FAIL') return 'Blocked';

    // Watch-to-Validate source: only Ready if gate PASS
    if (item.source === 'Watch-to-Validate' || item.selectedBy === 'Watch-to-Validate') {
      if (rg !== 'PASS') return 'Watch-only';
    }

    if (ai === 'SKIP') return 'Blocked';

    if (action === 'NEED_DATA') return 'Stale';
    if (action === 'BUY_READY') return isEntryPlanInZone(item) ? 'Ready' : 'Waiting Entry';
    if (action === 'READY_REVIEW') return 'Watch-only';
    if (action === 'WAIT_FOR_ENTRY') return 'Waiting Entry';

    if (ai === 'WATCH' || ai === 'WAIT') return 'Waiting Entry';

    if (ai === 'BUY' && rg === 'PASS') {
      const price = getEntryPlanCurrentPrice(item);
      const { low: lo, high: hi } = getEntryPlanZone(item);
      if (price && lo && hi && price >= lo && price <= hi) return 'Ready';
      if (price && lo && hi) return 'Waiting Entry'; // price outside zone
      return 'Waiting Entry'; // missing price data
    }

    if (!getEntryPlanCurrentPrice(item) && getEntryPlanZone(item).low == null) return 'Stale';
    return 'Waiting Entry';
  };

  const getReadinessColor = (readiness: string): string => {
    switch (readiness) {
      case 'Ready': return '#52c41a';
      case 'Waiting Entry': return '#d48806';
      case 'Watch-only': return '#1890ff';
      case 'Blocked': return '#ff4d4f';
      case 'Stale': return '#bbb';
      default: return 'var(--app-text-muted)';
    }
  };

  const translateReadiness = (readiness: string) => {
    switch (readiness) {
      case 'Ready': return t.agent.statusReady;
      case 'Waiting Entry': return t.agent.statusWaitingEntry;
      case 'Watch-only': return t.agent.statusWatchOnly;
      case 'Blocked': return t.agent.statusBlocked;
      case 'Stale': return t.agent.statusStale;
      default: return readiness;
    }
  };

  const translateStatus = (status: string) => {
    if (!status) return t.agent.statusNA;
    const s = status.toUpperCase();
    if (s === 'REVIEW' || s === 'NEEDS_REVIEW') return t.agent.statusReview;
    if (s === 'GOOD' || s === 'PASS' || s === 'BUY_ALLOWED') return t.agent.statusGood;
    if (s === 'N/A') return t.agent.statusNA;
    if (s === 'BLOCK' || s === 'FAIL' || s === 'BLOCKED' || s === 'Blocked by Risk') return t.agent.statusBlocked;
    if (s === 'BUY' || s === 'Buy Ready') return t.agent.buyLabel;
    if (s === 'WAIT' || s === 'Wait for Entry') return t.agent.statusWaitingEntry;
    if (s === 'WATCH' || s === 'WATCH_ONLY') return t.agent.statusWatchOnly;
    return status;
  };

  // Check if symbol already in watchlist
  const isInWatchlist = (symbol: string): boolean => {
    return aiWatchlistItems.some(i => i.symbol === symbol);
  };

  // Auto-refresh timer
  const startWatchlistAutoRefresh = useCallback(() => {
    if (aiWatchlistTimerRef.current) clearInterval(aiWatchlistTimerRef.current);
    setAiWatchlistCountdown(60);
    aiWatchlistTimerRef.current = setInterval(() => {
      setAiWatchlistCountdown(prev => {
        if (prev <= 1) {
          refreshWatchlistPrices();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
  }, [refreshWatchlistPrices]);

  const stopWatchlistAutoRefresh = useCallback(() => {
    if (aiWatchlistTimerRef.current) {
      clearInterval(aiWatchlistTimerRef.current);
      aiWatchlistTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    fetchAiWatchlist();
    return stopWatchlistAutoRefresh;
  }, [fetchAiWatchlist, stopWatchlistAutoRefresh]);

  useEffect(() => {
    if (aiWatchlistAutoRefresh) {
      startWatchlistAutoRefresh();
    } else {
      stopWatchlistAutoRefresh();
    }
    return stopWatchlistAutoRefresh;
  }, [aiWatchlistAutoRefresh, startWatchlistAutoRefresh, stopWatchlistAutoRefresh]);

  const confirmExecutePlan = async () => {
    if (!executeTarget) return;
    const plan = executeTarget;
    const ed = plan.executionDetails || {};
    const orderPreview = ed.orderPreview || plan.orderPreview || {};

    // Live trading keeps the backend confirmation contract, while the UI uses
    // a clear acknowledgement instead of asking people to type a magic phrase.
    const isLive = entryPlanExecutionMode.toLowerCase().includes('live');
    const expectedConfirm = `CONFIRM LIVE BUY ${plan.symbol}`;
    if (isLive) {
      if (!liveOrderAccepted) {
        message.error(agentModalCopy.acceptanceRequired);
        return;
      }
    }

    setExecuteLoading(true);
    try {
      const normalizedPlan = getEntryPlanExecutionSnapshot(plan);
      const res = await entryPlanAPI.execute({
        symbol: plan.symbol,
        planSnapshot: {
          ...normalizedPlan,
          orderPreview: orderPreview,
        },
        executionMode: isLive ? 'live' : 'paper',
        liveConfirm: isLive,
        confirmText: isLive ? expectedConfirm : undefined,
      });

      const d = res.data;
      if (d.success && d.action === 'ORDER_SUBMITTED') {
        message.success(agentText(
          `${plan.symbol}: order submitted (ID: ${d.orderId?.slice(0, 8)}...).`,
          `${plan.symbol}：订单已提交（ID：${d.orderId?.slice(0, 8)}...）。`,
        ));
        setExecuteModalVisible(false);
        setExecuteTarget(null);
        setLiveOrderAccepted(false);
      } else {
        const detail = agentErrorText(
          [d.reason, ...(d.blockers || [])].filter(Boolean).join('; '),
          'The order was blocked by the execution gate.',
          '订单已被当前执行或风险闸门阻断。',
        );
        message.error(agentText(`${plan.symbol}: ${detail}`, `${plan.symbol}：${detail}`));
      }
    } catch (e: any) {
      const errData = e?.response?.data;
      message.error(agentErrorText(
        errData?.reason || errData?.message || e?.message,
        'Execution failed.',
        '执行失败，请检查订单条件与连接后重试。',
      ));
    } finally {
      setExecuteLoading(false);
    }
  };

  const getEntryPlanAutoExecuteKey = useCallback((plan: any): string => {
    const symbol = String(plan?.symbol || '').toUpperCase();
    const { low, high } = getEntryPlanZone(plan);
    const executableAsk = toEntryPlanNumber(plan?.executableAsk ?? plan?.latestAsk) ?? getEntryPlanCurrentPrice(plan);
    const quoteTimestamp = plan?.quoteTimestamp ?? plan?.institutionalEntryPlan?.entry?.quoteTimestamp ?? 'no-quote-time';
    const stop = toEntryPlanNumber(plan?.stopLoss ?? plan?.stop);
    const target = toEntryPlanNumber(plan?.takeProfit1 ?? plan?.takeProfit ?? plan?.target);
    const shares = toEntryPlanNumber(plan?.positionSizeShares ?? plan?.shares);
    return [symbol, executableAsk, quoteTimestamp, low, high, stop, target, shares, getEntryPlanEffectiveAction(plan)]
      .map(v => v == null ? 'na' : String(v))
      .join('|');
  }, []);

  const getEntryPlanClientOrderId = useCallback((plan: any, key: string, retryCount?: number): string => {
    const symbol = String(plan?.symbol || 'UNKNOWN').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'UNKNOWN';
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) {
      hash = ((hash * 31) + key.charCodeAt(i)) >>> 0;
    }
    const suffix = retryCount && retryCount > 0 ? `-r${retryCount}` : '';
    return `alphalab-ui-${symbol}-${hash.toString(36)}${suffix}`.slice(0, 48);
  }, []);

  const upsertAutoExecutionItem = useCallback((plan: any, patch: any) => {
    const symbol = String(plan?.symbol || '').toUpperCase();
    if (!symbol) return;
    setAiExecutionList(prev => {
      const existingIndex = prev.findIndex(item => String(item.symbol || '').toUpperCase() === symbol && item.source === 'entry-plan-auto');
      const zone = getEntryPlanZone(plan);
      const _stop = toEntryPlanNumber(plan?.stopLoss ?? plan?.stop);
      const _target = toEntryPlanNumber(plan?.takeProfit1 ?? plan?.takeProfit ?? plan?.target);
      const _entry = toEntryPlanNumber(plan?.entryZoneLow ?? plan?.entryLow ?? plan?.entryZone?.low) ?? toEntryPlanNumber(plan?.entryZoneHigh ?? plan?.entryHigh ?? plan?.entryZone?.high);
      const _rr = plan.riskReward1 ?? (_stop && _target && _entry && _stop > 0 && _target > 0 && _entry > 0 ? Math.abs(_target - _entry) / Math.abs(_entry - _stop) : null);
      const _rg = plan.riskGate || plan.hardRiskGate || {};
      const _rgStatus = _rg.status || plan.riskGateStatus || undefined;
      const baseItem = {
        id: `entry-auto-${symbol}`,
        symbol,
        setupType: plan.setup,
        aiDecision: plan.aiDecision,
        confidence: plan.confidence,
        currentPrice: getEntryPlanCurrentPrice(plan),
        entryZoneLow: zone.low,
        entryZoneHigh: zone.high,
        stopLoss: plan.stopLoss,
        takeProfit1: plan.takeProfit1,
        riskReward1: _rr != null && Number.isFinite(_rr) ? _rr : undefined,
        riskGate: _rgStatus ? { ..._rg, status: _rgStatus } : undefined,
        riskGateStatus: _rgStatus,
        shares: plan.positionSizeShares || plan.shares || 0,
        positionSizeShares: plan.positionSizeShares || plan.shares || 0,
        allocationDollars: plan.allocationDollars || plan.positionValue || plan.positionSizeDollars || 0,
        orderType: 'limit',
        timeInForce: plan.timeInForce || plan.executionDetails?.orderPreview?.timeInForce || plan.orderPreview?.timeInForce || 'day',
        finalAction: plan.finalAction,
        source: 'entry-plan-auto',
        entryPlan: plan,
      };
      if (existingIndex >= 0) {
        return prev.map((item, idx) => idx === existingIndex ? { ...item, ...baseItem, ...patch } : item);
      }
      return [...prev, { ...baseItem, ...patch }];
    });
  }, []);

  const autoExecuteEntryPlan = useCallback(async (plan: any, key: string) => {
    const symbol = String(plan?.symbol || '').toUpperCase();
    if (!symbol) return;
    const orderPreview = plan.executionDetails?.orderPreview || plan.orderPreview || {};
    // Use retryCount to generate a unique clientOrderId on each retry attempt
    // Read from state directly to avoid stale closure after Retry increments retryCount
    const existingItem = aiExecutionListRef.current.find((item: any) => String(item.symbol || '').toUpperCase() === symbol);
    const retryCount = (existingItem?.retryCount || 0);
    const clientOrderId = getEntryPlanClientOrderId(plan, key, retryCount);
    const normalizedPlan = getEntryPlanExecutionSnapshot(plan);
    autoEntryPlanExecuteKeysRef.current.add(key);
    upsertAutoExecutionItem(plan, {
      executionStatus: 'auto_executing',
      executionError: undefined,
      autoEntryPlanKey: key,
      clientOrderId,
    });
    // 30-second timeout to prevent indefinite "Auto Executing" stuck state
    const TIMEOUT_MS = 30000;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT: Auto execute request timed out after 30s')), TIMEOUT_MS)
    );
    try {
      const res = await Promise.race([
        entryPlanAPI.execute({
          symbol,
          planSnapshot: {
            ...normalizedPlan,
            orderPreview,
          },
          executionMode: tradeMode === 'real' ? 'live' : 'paper',
          liveConfirm: false,
          confirmText: '',
          clientOrderId,
          isAutoExecute: true,
        }),
        timeoutPromise,
      ]);
      const d = res.data || {};
      if (d.success && d.action === 'ORDER_SUBMITTED') {
        const order = d.order || d.orderData || {};
        upsertAutoExecutionItem(plan, {
          executionStatus: 'submitted',
          alpacaOrderId: d.orderId || order.id,
          alpacaOrderStatus: d.orderStatus || order.status,
          submittedLimitPrice: d.limitPrice,
          submittedShares: d.submittedShares,
          submittedNotional: d.submittedNotional,
          orderClass: d.orderClass,
          protectionMode: d.protectionMode,
          marketableLimit: d.marketableLimit,
          executionPreflight: d.preflight,
          quoteAgeSeconds: d.quoteAgeSeconds,
          executionError: undefined,
          autoEntryPlanKey: key,
          clientOrderId,
        });
        setExecutionLog(prev => [{
          id: d.orderId || order.id || clientOrderId,
          symbol,
          side: 'buy',
          qty: plan.positionSizeShares || plan.shares || 0,
          mode: tradeMode === 'real' ? 'live' : 'paper',
          orderId: d.orderId || order.id,
          orderStatus: d.orderStatus || order.status || 'submitted',
          submittedAt: new Date().toISOString(),
          message: d.message || `${tradeMode === 'real' ? 'Live' : 'Paper'} order placed by AI Entry Plan.`,
        }, ...prev]);
        message.success(agentText(
          `${symbol}: ${tradeMode === 'real' ? 'Live' : 'Paper'} order submitted by AI mode.`,
          `${symbol}：AI 模式已提交${tradeMode === 'real' ? '实盘' : '模拟'}订单。`,
        ));
        setTimeout(() => fetchHoldings(tradeMode), 2000);
      } else {
        // Classify the blocker for appropriate UI status
        const failReason = d.reason || (d.blockers || []).join('; ') || 'Auto execute blocked';
        const blockerCode = d.code || '';
        // Permanent blockers: keep key, show informational status (not red "Failed")
        if (blockerCode === 'existing_position') {
          upsertAutoExecutionItem(plan, {
            executionStatus: 'holding',
            executionError: 'Already holding — managed by Exit Scan',
            autoEntryPlanKey: key,
            clientOrderId,
          });
        } else if (blockerCode === 'open_buy_order') {
          upsertAutoExecutionItem(plan, {
            executionStatus: 'order_pending',
            executionError: 'Open buy order exists — waiting for fill',
            autoEntryPlanKey: key,
            clientOrderId,
          });
        } else if (blockerCode === 'price_outside_zone' || blockerCode === 'market_closed' || blockerCode === 'stale_quote' || blockerCode === 'quote_unavailable') {
          // The same quote is attempted once. A fresh scan/quote produces a new
          // execution key; the explicit Retry control can also clear this key.
          upsertAutoExecutionItem(plan, {
            executionStatus: 'zone_wait',
            executionError: blockerCode === 'market_closed'
              ? 'Market closed — automatic entry waits for the next regular session'
              : blockerCode === 'stale_quote' || blockerCode === 'quote_unavailable'
                ? 'Fresh executable quote unavailable — watching'
                : 'Executable ask left the entry zone — watching',
            autoEntryPlanKey: key,
            clientOrderId,
          });
        } else if (blockerCode === 'duplicate_client_order_id') {
          // Keep the key until the explicit Retry control increments retryCount.
          upsertAutoExecutionItem(plan, {
            executionStatus: 'blocked',
            executionError: 'Duplicate order ID — use Retry to submit with a new ID',
            autoEntryPlanKey: key,
            clientOrderId,
          });
        } else {
          // Other blockers (safety gate, config, etc.) — keep key, show as blocked
          upsertAutoExecutionItem(plan, {
            executionStatus: 'blocked',
            executionError: failReason,
            autoEntryPlanKey: key,
            clientOrderId,
          });
        }
        console.log('[AutoExecute] symbol=%s code=%s reason=%s', symbol, blockerCode, failReason);
      }
    } catch (e: any) {
      const errData = e?.response?.data;
      const errCode = errData?.code || '';
      const errMsg = errData?.reason || e?.message || 'Auto execute failed';
      // Do not spin on timeouts or network failures. The next fresh quote or an
      // explicit Retry action is the next permitted attempt.
      // Detect duplicate client_order_id — show specific message and don't auto-retry
      const isDuplicateCid = errCode === 'duplicate_client_order_id' || /client_order_id must be unique/i.test(errMsg);
      upsertAutoExecutionItem(plan, {
        executionStatus: isDuplicateCid ? 'blocked' : 'failed',
        executionError: isDuplicateCid ? 'Duplicate order ID — use Retry to submit with a new ID' : errMsg,
        autoEntryPlanKey: key,
        clientOrderId,
      });
      console.log('[AutoExecute] symbol=%s error reason=%s duplicateCid=%s', symbol, errMsg, isDuplicateCid);
    }
  }, [agentText, fetchHoldings, getEntryPlanClientOrderId, upsertAutoExecutionItem, tradeMode]);

  useEffect(() => {
    if (pipelineMode !== 'ai' || entryPlanStatus !== 'completed') return;
    if (tradeMode === 'real' && !liveAutoTradingEnabled) return;
    if (!Array.isArray(entryPlanResults) || entryPlanResults.length === 0) return;
    // If the user clicked Clear during this Entry Plan generation, skip auto-add
    if (clearedAtGenerationRef.current === entryPlanGenerationRef.current) return;
    // Helpers: build orderPreview when plan lacks one (e.g. leveraged alternatives)
    const _hasCompleteOrderPreview = (p: any) => {
      const op = p?.executionDetails?.orderPreview || p?.orderPreview;
      return !!(op && op.orderType === 'limit' && op.limitPrice > 0);
    };
    const _buildOrderPreview = (p: any) => {
      const _n = (v: any) => { const n = parseFloat(v); return Number.isFinite(n) && n > 0 ? n : undefined; };
      const lo = _n(p?.entryZoneLow ?? p?.entryLow ?? p?.entryZone?.low);
      const hi = _n(p?.entryZoneHigh ?? p?.entryHigh ?? p?.entryZone?.high);
      const cur = _n(p?.currentPrice ?? p?.price);
      const limit = (cur != null && hi != null) ? Math.min(cur, hi) : (cur ?? hi ?? 0);
      return { orderType: 'limit', limitPrice: limit, timeInForce: 'day', entryZoneLow: lo, entryZoneHigh: hi };
    };
    // Also check persisted removed symbols (survives page refresh)
    const persistedRemoved = new Set(scannerStateStore.getRemovedExecutionSymbols());
    for (const plan of entryPlanResults) {
      const symbol = String(plan?.symbol || '').toUpperCase();
      if (plan?.executionHandledByBackend) { console.log('[AutoExecPipeline] skip symbol=%s reason=backend_execution_owner', symbol); continue; }
      // Skip symbols the user explicitly removed in this run or persisted from before refresh
      if (removedSymbolsRef.current.has(symbol)) { console.log('[AutoExecPipeline] skip symbol=%s reason=user_removed', symbol); continue; }
      if (persistedRemoved.has(symbol)) { console.log('[AutoExecPipeline] skip symbol=%s reason=persisted_removed', symbol); continue; }
      const _rawAction = getEntryPlanEffectiveAction(plan);
      const _effPlan = plan;
      if (!symbol || getEntryPlanEffectiveAction(_effPlan) !== 'BUY_READY') { console.log('[AutoExecPipeline] skip symbol=%s reason=not_BUY_READY action=%s', symbol, _rawAction); continue; }
      const key = getEntryPlanAutoExecuteKey(_effPlan);
      if (autoEntryPlanExecuteKeysRef.current.has(key)) { console.log('[AutoExecPipeline] skip symbol=%s reason=already_processed_key', symbol); continue; }
      if (hasEntryPlanHardBlock(_effPlan)) { console.log('[AutoExecPipeline] skip symbol=%s reason=hard_block', symbol); continue; }
      const normalizedPlan = getEntryPlanExecutionSnapshot(_effPlan);
      const dq = normalizedPlan.dataQuality;
      if (dq !== 'GOOD') {
        console.log('[AutoExecPipeline] skip symbol=%s reason=data_quality=%s', symbol, dq);
        continue;
      }
      if (normalizedPlan.tradeReadiness !== 'READY') {
        console.log('[AutoExecPipeline] skip symbol=%s reason=trade_readiness=%s', symbol, normalizedPlan.tradeReadiness);
        continue;
      }
      const shares = toEntryPlanNumber(_effPlan.positionSizeShares ?? _effPlan.shares);
      const allocation = toEntryPlanNumber(_effPlan.allocationDollars ?? _effPlan.positionValue ?? _effPlan.positionSizeDollars);
      const buyingPower = toEntryPlanNumber(tradingAccountData?.buyingPower);
      const hasPosition = (holdingsRef.current || holdings || []).some((p: any) => String(p.symbol || '').toUpperCase() === symbol);
      const hasActiveExecution = aiExecutionList.some((item: any) => (
        String(item.symbol || '').toUpperCase() === symbol &&
        ['auto_executing', 'submitted', 'pending', 'filled'].includes(item.executionStatus || '')
      ));
      if (!shares || shares <= 0) { console.log('[AutoExecPipeline] skip symbol=%s reason=shares_invalid=%s', symbol, shares); continue; }
      if (buyingPower != null && allocation != null && allocation > buyingPower) { console.log('[AutoExecPipeline] skip symbol=%s reason=insufficient_bp allocation=%s bp=%s', symbol, allocation, buyingPower); continue; }
      if (hasPosition || hasActiveExecution) { console.log('[AutoExecPipeline] skip symbol=%s reason=duplicate hasPosition=%s hasActiveExecution=%s', symbol, hasPosition, hasActiveExecution); continue; }
      // Ensure plan has orderPreview (leveraged alternatives may lack it)
      const _planForExec = _hasCompleteOrderPreview(_effPlan) ? _effPlan : { ..._effPlan, executionDetails: { ...(_effPlan.executionDetails || {}), orderPreview: _buildOrderPreview(_effPlan) } };
      autoExecuteEntryPlan(_planForExec, key);
    }
  }, [aiExecutionList, autoExecuteEntryPlan, entryPlanResults, entryPlanStatus, getEntryPlanAutoExecuteKey, holdings, liveAutoTradingEnabled, pipelineMode, tradeMode, tradingAccountData]);

  // ===== AI Execution Order Handler =====
  const getAutomationMode = (): string => {
    if (pipelineMode === 'manual') return 'manual';
    if (pipelineMode === 'hybrid') return 'semi-ai';
    return 'full-ai'; // pipelineMode === 'ai'
  };

  const handleExecuteOrder = async (record: any, confirmed = false) => {
    const automationMode = getAutomationMode();
    const tradingMode = tradeMode;

    // Manual mode — should not reach here (button hidden), but guard anyway
    if (automationMode === 'manual') {
      message.info(agentText('Manual mode is review only. It will not place an order.', '手动模式仅供审核，不会提交订单。'));
      return;
    }

    // Determine order params from the record's editable fields
    const orderType = record.orderType || 'market';
    const qtyMode = record.qtyMode || 'shares';
    const shares = qtyMode === 'shares' ? (record.userQty || record.positionSizeShares || 1) : undefined;
    const notional = qtyMode === 'dollars' ? (record.dollarAmount || 0) : undefined;
    const limitPrice = record.limitPrice;
    const stopPrice = record.stopPrice;
    const trailPrice = record.trailPrice;
    const trailPercent = record.trailPercent;
    const tif = record.timeInForce || 'day';

    setExecutingSymbol(record.symbol);
    try {
      const orderData: any = {
        symbol: record.symbol,
        side: 'buy',
        type: orderType,
        time_in_force: tif,
        tradingMode: tradingMode,
        automationMode: automationMode,
        executionSource: record.source || 'ai-execution',
        confirmed: confirmed,
      };
      if (qtyMode === 'shares' && shares && shares > 0) {
        orderData.qty = shares;
      } else if (qtyMode === 'dollars' && notional && notional > 0) {
        orderData.notional = notional;
      } else {
        orderData.qty = 1; // fallback
      }
      if (orderType === 'limit' && limitPrice > 0) orderData.limit_price = limitPrice;
      if (orderType === 'stop' && stopPrice > 0) orderData.stop_price = stopPrice;
      if (orderType === 'stop_limit') {
        if (stopPrice > 0) orderData.stop_price = stopPrice;
        if (limitPrice > 0) orderData.limit_price = limitPrice;
      }
      if (orderType === 'trailing_stop') {
        if (trailPrice > 0) orderData.trail_price = trailPrice;
        else if (trailPercent > 0) orderData.trail_percent = trailPercent;
      }

      const res = await aiExecutionAPI.placeOrder(orderData);

      const d = res.data;
      if (d.success && d.status === 'submitted') {
        // Update execution item status
        setAiExecutionList(prev => prev.map(e =>
          e.symbol === record.symbol ? { ...e, executionStatus: 'submitted', alpacaOrderId: d.order?.id, alpacaOrderStatus: d.order?.status } : e
        ));
        const logEntry = {
          id: d.order?.id || Date.now().toString(),
          symbol: record.symbol,
          side: 'buy',
          qty: orderData.qty || orderData.notional || 0,
          mode: d.modeUsed,
          orderId: d.order?.id,
          orderStatus: d.order?.status,
          submittedAt: new Date().toISOString(),
          message: agentText(d.message || 'Order submitted.', '订单已提交。'),
        };
        setExecutionLog(prev => [logEntry, ...prev]);
        message.success(agentText(`${record.symbol}: order submitted.`, `${record.symbol}：订单已提交。`));
        // Refresh holdings after successful order
        fetchHoldings();
      } else if (d.status === 'confirmation_required') {
        // Show confirmation modal
        setOrderConfirmTarget({ record, preview: d.orderPreview || {} });
        setOrderConfirmVisible(true);
        setOrderRiskAccepted(false);
      } else if (d.status === 'config_required') {
        setAiExecutionList(prev => prev.map(e =>
          e.symbol === record.symbol ? { ...e, executionStatus: 'failed', executionError: agentText('Trading connection required.', '需要配置交易连接。') } : e
        ));
        Modal.warning({
          title: agentText('Trading connection required', '需要配置交易连接'),
          content: agentText(
            'Add the required Alpaca credentials before submitting this order.',
            '提交订单前，请先补充所需的 Alpaca 凭证。',
          ),
          okText: agentText('Open settings', '打开设置'),
          cancelText: agentText('Cancel', '取消'),
          className: 'agent-confirm-dialog',
          rootClassName: 'agent-confirm-modal',
          onOk: () => navigate('/settings/configuration'),
        });
      } else if (d.status === 'risk_blocked') {
        setAiExecutionList(prev => prev.map(e =>
          e.symbol === record.symbol ? { ...e, executionStatus: 'failed', executionError: agentText('Blocked by current risk limits.', '已被当前风险限制阻断。') } : e
        ));
        message.warning(agentText(`${record.symbol}: blocked by the current risk limits.`, `${record.symbol}：已被当前风险限制阻断。`));
      } else if (d.status === 'auth_required') {
        message.error(agentText('Your session has expired. Sign in again to continue.', '登录状态已过期，请重新登录后继续。'));
      } else {
        const detail = agentErrorText(
          d.message || d.error,
          'Order failed.',
          '订单提交失败，请检查订单参数与风险限制。',
        );
        setAiExecutionList(prev => prev.map(e =>
          e.symbol === record.symbol ? { ...e, executionStatus: 'failed', executionError: detail } : e
        ));
        message.error(agentText(`${record.symbol}: ${detail}`, `${record.symbol}：${detail}`));
      }
    } catch (e: any) {
      const rawError = e?.response?.data?.message
        || e?.response?.data?.error
        || (e?.response ? `Server error (${e.response.status})` : e?.message);
      const errMsg = agentErrorText(
        rawError,
        'The order service is unavailable.',
        '订单服务暂时不可用，请稍后重试。',
      );
      setAiExecutionList(prev => prev.map(e2 =>
        e2.symbol === record.symbol ? { ...e2, executionStatus: 'failed', executionError: errMsg } : e2
      ));
      message.error(agentText(`${record.symbol}: ${errMsg}`, `${record.symbol}：${errMsg}`));
    } finally {
      setExecutingSymbol(null);
    }
  };

  // Open confirm modal and initialize editing state from current record values
  const openConfirmModal = (r: any) => {
    setOrderConfirmTarget({ record: r });
    setModalQtyMode(r.qtyMode || 'shares');
    setModalUserQty(r.userQty || r.positionSizeShares || 1);
    setModalDollarAmount(r.dollarAmount || 0);
    setModalOrderType(r.orderType || 'market');
    setModalLimitPrice(r.limitPrice || 0);
    setModalStopPrice(r.stopPrice || 0);
    setModalTrailPrice(r.trailPrice || 0);
    setModalTrailPercent(r.trailPercent || 0);
    setModalTimeInForce(r.timeInForce || 'day');
    setOrderConfirmVisible(true);
    setOrderRiskAccepted(false);
  };

  const handleConfirmOrder = async () => {
    if (!orderConfirmTarget) return;
    const { record } = orderConfirmTarget;
    const isReal = tradeMode === 'real';

    if (isReal && !orderRiskAccepted) {
      message.error(agentModalCopy.acceptanceRequired);
      return;
    }

    // Sync modal edits back to the execution list before submitting
    const updatedRecord = {
      ...record,
      qtyMode: modalQtyMode,
      userQty: modalUserQty,
      dollarAmount: modalDollarAmount,
      orderType: modalOrderType,
      limitPrice: modalLimitPrice,
      stopPrice: modalStopPrice,
      trailPrice: modalTrailPrice,
      trailPercent: modalTrailPercent,
      timeInForce: modalTimeInForce,
    };
    setAiExecutionList(prev => prev.map(item =>
      item.symbol === record.symbol ? updatedRecord : item
    ));

    setOrderConfirmVisible(false);
    await handleExecuteOrder(updatedRecord, true);
    setOrderConfirmTarget(null);
    setOrderRiskAccepted(false);
  };

  // ===== Cancel Order Handler =====
  const handleCancelOrder = async () => {
    if (!cancelTarget) return;
    const { record } = cancelTarget;
    const orderId = record.alpacaOrderId;
    if (!orderId) { message.error(agentText('The order ID is missing.', '未找到订单 ID。')); return; }

    setCancelLoading(true);
    try {
      const res = await tradingAccountAPI.cancelOrder(orderId, tradeMode as 'paper' | 'real');
      const d = res.data;
      if (d.success) {
        // Remove from execution list on successful cancel
        setAiExecutionList(prev => prev.filter(e => e.symbol !== record.symbol));
        const logEntry = {
          id: `cancel-${orderId}`,
          symbol: record.symbol,
          side: 'buy',
          qty: 0,
          mode: tradeMode,
          orderId: orderId,
          orderStatus: 'canceled',
          submittedAt: new Date().toISOString(),
          message: agentText('Order canceled by user.', '用户已取消订单。'),
        };
        setExecutionLog(prev => [logEntry, ...prev]);
        message.success(agentText(`${record.symbol}: order canceled.`, `${record.symbol}：订单已取消。`));
        fetchHoldings();
      } else if (d.errorType === 'order_filled') {
        // Order already filled — remove from execution, refresh holdings
        setAiExecutionList(prev => prev.filter(e => e.symbol !== record.symbol));
        fetchHoldings();
        message.info(agentText(`${record.symbol}: the order is already filled. The position now appears under current holdings.`, `${record.symbol}：订单已经成交，持仓已移至当前持仓。`));
      } else {
        const detail = agentErrorText(d.error, 'Cancel failed.', '撤单失败，请稍后重试。');
        message.error(agentText(`${record.symbol}: ${detail}`, `${record.symbol}：${detail}`));
      }
    } catch (e: any) {
      const rawError = e?.response?.data?.error
        || e?.response?.data?.message
        || (e?.response ? `Server error (${e.response.status})` : e?.message);
      const errMsg = agentErrorText(rawError, 'Cancel failed.', '撤单失败，请稍后重试。');
      message.error(agentText(`${record.symbol}: ${errMsg}`, `${record.symbol}：${errMsg}`));
    } finally {
      setCancelLoading(false);
      setCancelConfirmVisible(false);
      setCancelTarget(null);
    }
  };

  // ===== Sync filled/canceled orders with Alpaca =====
  const syncExecutionOrders = useCallback(async () => {
    const submittedItems = aiExecutionList.filter(e =>
      e.alpacaOrderId && (e.executionStatus === 'submitted' || e.executionStatus === 'pending')
    );
    if (submittedItems.length === 0) return;

    const mode = tradeMode as 'paper' | 'real';
    let _removed = 0; // eslint-disable-line @typescript-eslint/no-unused-vars
    let needsHoldingsRefresh = false;

    for (const item of submittedItems) {
      try {
        const res = await tradingAccountAPI.getOrderStatus(item.alpacaOrderId, mode);
        const d = res.data;
        if (d.success && d.order) {
          const s = d.order.status;
          if (s === 'filled') {
            setAiExecutionList(prev => prev.filter(e => e.symbol !== item.symbol));
            _removed++; // eslint-disable-line @typescript-eslint/no-unused-vars
            needsHoldingsRefresh = true;
          } else if (s === 'canceled' || s === 'expired' || s === 'rejected') {
            setAiExecutionList(prev => prev.map(e =>
              e.symbol === item.symbol ? { ...e, executionStatus: 'canceled' } : e
            ));
          } else if (s === 'partially_filled') {
            setAiExecutionList(prev => prev.map(e =>
              e.symbol === item.symbol ? { ...e, alpacaOrderStatus: s } : e
            ));
          }
        }
      } catch {
        // Ignore individual sync errors
      }
    }
    if (needsHoldingsRefresh) fetchHoldings();
  }, [aiExecutionList, tradeMode, fetchHoldings]);

  // Auto-sync submitted orders on mount and periodically
  useEffect(() => {
    syncExecutionOrders();
    const interval = setInterval(syncExecutionOrders, 30000); // every 30s
    return () => clearInterval(interval);
  }, [syncExecutionOrders]);

  const isConfirmedForEntryPlan = useCallback((record: any) => {
    const gate = record.institutionalGate || record.riskGate || {};
    const gateStatus = String(gate.status || '').toUpperCase();
    if (gateStatus === 'BLOCK') return false;

    const decision = String(record.dvDecision || '').toUpperCase();
    if (decision === 'PASS_DV') return true;

    const verdict = String(
      record.finalVerdict ||
      record.verdict ||
      record.aiValidationVerdict ||
      record.localVerdictBeforeAI ||
      record.decision ||
      ''
    ).trim().toLowerCase();
    return ['confirmed', 'pass', 'pass_dv'].includes(verdict);
  }, []);

  const getEntryPlanCandidates = useCallback(() => {
    if (!deeperValidationResults || deeperValidationResults.length === 0) return [];
    const holdingSymbols = new Set((holdingsRef.current || holdings || []).map((p: any) => String(p.symbol || '').toUpperCase()));
    return deeperValidationResults
      .filter((record: any) => isConfirmedForEntryPlan(record))
      .filter((record: any) => !holdingSymbols.has(String(record.symbol || '').toUpperCase()))
      .sort((a: any, b: any) => Number(b.validationScore || 0) - Number(a.validationScore || 0))
      .slice(0, 8)
      .map((record: any) => ({
        ...record,
        entryPlanInput: 'DV_CONFIRMED',
      }));
  }, [deeperValidationResults, holdings, isConfirmedForEntryPlan]);

  const handleRunEntryPlan = async () => {
    if (pipelineRunning) {
      message.warning(agentText('This action is unavailable while the AI pipeline is running.', 'AI 流水线运行期间无法执行此操作。'));
      return;
    }
    const candidates = getEntryPlanCandidates();
    if (!candidates.length) return;

    scannerStateStore.updateAdmission({
      status: 'loading',
      results: null,
      summary: null,
      lastUpdated: new Date().toISOString(),
    });

    let admittedCandidates: any[] = [];
    try {
      const holdingSymbols = (holdingsRef.current || holdings || [])
        .map((position: any) => String(position?.symbol || '').toUpperCase())
        .filter(Boolean);
      const openBuySymbols = aiExecutionList
        .filter((order: any) => {
          const status = String(order?.alpacaOrderStatus || order?.executionStatus || '').toLowerCase();
          return ['pending', 'submitted', 'accepted', 'new', 'partially_filled'].includes(status);
        })
        .map((order: any) => String(order?.symbol || '').toUpperCase())
        .filter(Boolean);
      const accountStatus = String(tradingAccountData?.status || '').toUpperCase();
      const accountBlocked = Boolean(
        tradingAccountData?.accountBlocked ||
        tradingAccountData?.tradingBlocked ||
        (tradingAccountData?.success && accountStatus && accountStatus !== 'ACTIVE')
      );

      const admissionResponse = await pipelineAutoAPI.runAdmission({
        candidates,
        fineResults: fineScanResults || [],
        marketResults: marketScannerResults || [],
        accountState: {
          holdingSymbols,
          openBuySymbols,
          positionCount: holdingSymbols.length,
          buyingPower: tradingAccountData?.buyingPower,
          accountBlocked,
        },
        riskProfile,
        timeHorizon,
        pipelineMode,
        aiEnabled: pipelineMode !== 'manual',
      });
      const admissionRows = admissionResponse.data?.results || [];
      const admissionRunSummary = admissionResponse.data?.summary || null;
      scannerStateStore.updateAdmission({
        status: 'completed',
        results: admissionRows,
        summary: admissionRunSummary,
        lastUpdated: new Date().toISOString(),
      });

      admittedCandidates = admissionRows
        .filter((row: any) => row?.admissionDecision === 'ADMIT')
        .map((row: any) => ({
          ...(row.sourceCandidate || {}),
          admission: row,
          admissionDecision: row.admissionDecision,
          admissionScore: row.admissionScore,
          admissionWarnings: row.warnings || [],
          admissionAiReview: row.aiAdmissionReview || null,
          signalSnapshot: row.signalSnapshot,
        }));

      if (!admittedCandidates.length) {
        setEntryPlanStatus('completed');
        setEntryPlanResults([]);
        const holdCount = admissionRunSummary?.counts?.HOLD || 0;
        const blockCount = admissionRunSummary?.counts?.BLOCK || 0;
        message.warning(agentText(
          `Portfolio admission held this batch: ${holdCount} on hold and ${blockCount} blocked.`,
          `本批次未通过组合准入：${holdCount} 个暂缓，${blockCount} 个阻断。`,
        ));
        return;
      }

    } catch (error: any) {
      scannerStateStore.updateAdmission({
        status: 'error',
        lastUpdated: new Date().toISOString(),
      });
      message.error(agentErrorText(
        error?.response?.data?.message || error?.message,
        'Portfolio admission failed.',
        '组合准入失败，请检查数据连接后重试。',
      ));
      return;
    }

    // Entry Plan has its own error state; a downstream failure must not rewrite
    // a successfully completed Portfolio Admission as failed.
    try {
      const epPromise = _runEntryPlanLoop(admittedCandidates);
      registerEntryPlanRun(epPromise);
      await epPromise;
    } catch {
      // _runEntryPlanLoop already records and displays the precise failure.
    }
  };

  const _runEntryPlanLoop = async (candidates: any[], options?: { suppressDiscord?: boolean }): Promise<any[]> => {
    let _epResult: any[] = [];
    // New Entry Plan run: reset all execution guards so candidates can be freshly generated
    entryPlanGenerationRef.current += 1;
    clearedAtGenerationRef.current = -1;
    removedSymbolsRef.current.clear();
    autoEntryPlanExecuteKeysRef.current.clear();
    scannerStateStore.clearRemovedExecutionSymbols();
    setEntryPlanStatus('loading');
    setEntryPlanResults(null);

    // Preflight: check session, AI config, and trading account
    const preflight = await preflightConfigCheck();
    if (!preflight.ok || !preflight.sessionValid) {
      setEntryPlanStatus('error');
      unregisterEntryPlanRun();
      const errMsg = agentErrorText(
        preflight.error,
        'Your session has expired. Please sign in again.',
        '登录状态已过期，请重新登录。',
      );
      message.error(errMsg);
      throw new Error(errMsg);
    }
    if (!preflight.aiAvailable) {
      const reason = preflight.aiKeyIsMasked
        ? agentText('The AI key is invalid. Re-enter it in Settings.', 'AI 密钥无效，请在设置中重新填写。')
        : !preflight.aiConfigured
          ? agentText('The AI provider is not configured. Configure it in Settings.', '尚未配置 AI 服务，请前往设置完成配置。')
          : preflight.aiTestStatus !== 'connected'
            ? agentText(`The AI provider connection is not ready (${preflight.aiTestStatus}). Test it in Settings.`, 'AI 服务连接尚未就绪，请在设置中测试连接。')
            : agentText('The AI provider is unavailable.', 'AI 服务暂不可用。');
      setEntryPlanStatus('error');
      unregisterEntryPlanRun();
      message.error(reason);
      throw new Error(reason);
    }
    // No candidates → skip gracefully
    if (!candidates || candidates.length === 0) {
      setEntryPlanStatus('completed');
      setEntryPlanResults([]);
      unregisterEntryPlanRun();
      console.log('[EntryPlan] skipped — no eligible candidates from Deeper Validation');
      return [];
    }

    // Check trading account config — warn but don't block if unavailable (backend uses fallback)
    if (!tradingAccountData?.success) {
      console.warn(`[EntryPlan] Trading account (${tradeMode}) not available, using estimated account size`);
    }

    try {
      const candidateData = candidates.map((c: any) => ({
        symbol: c.symbol,
        companyName: c.companyName || c.name,
        strategy: c.strategy || c.strategyType || '',
        verdict: c.verdict || '',
        totalReturn: c.totalReturn ?? c.aggregateReturn,
        sharpeRatio: c.sharpeRatio ?? c.sharpe,
        maxDrawdown: c.maxDrawdown,
        winRate: c.winRate,
        profitFactor: c.profitFactor,
        tradeCount: c.tradeCount ?? c.trades,
        stabilityScore: c.stabilityScore,
        recentVsLongTerm: c.recentVsLongTerm,
        fineScanEntryQuality: c.fineScanEntryQuality || '',
        liquidity: c.liquidity || '',
        riskGrade: c.riskGrade || '',
        currentPrice: c.currentPrice || c.price || 0,
        support: c.support || 0,
        resistance: c.resistance || 0,
        atr: c.atr || 0,
        ema20: c.ema20 || 0,
        ema50: c.ema50 || 0,
        recentHigh: c.recentHigh || 0,
        recentLow: c.recentLow || 0,
        volume: c.volume || 0,
        avgVolume: c.avgVolume || 0,
        fineScanDecision: c.fineScanDecision || 'Pass',
        fineScanScore: c.fineScanScore || 50,
        fineScanStrategy: c.fineScanStrategy || '',
        fineScanRisk: c.fineScanRisk || '',
        fineScanNews: c.fineScanNews || '',
        entryQualityDetail: c.entryQualityDetail || '',
        entryPlan: c.entryPlan || c.entryValidation || c.institutionalPacket?.entryValidation || {},
        entryPlanSource: c.entryPlanSource || c.entryPlan?.entryPlanSource || 'deeper_validation',
        avgDollarVolume20: c.avgDollarVolume20 ?? c.costCapacity?.adv20 ?? c.institutionalPacket?.costCapacity?.adv20,
        estimatedRoundTripCostBps: c.estimatedRoundTripCostBps ?? c.costCapacity?.roundTripCostBps ?? c.institutionalPacket?.costCapacity?.roundTripCostBps,
        quotedSpreadBps: c.quotedSpreadBps ?? c.spreadBps ?? c.costCapacity?.spreadBps ?? c.institutionalPacket?.costCapacity?.spreadBps,
        eventRisk: c.eventRisk,
        dataQuality: c.dataQuality,
        sector: c.sector || c.companySector,
        admissionDecision: c.admissionDecision || c.admission?.admissionDecision,
        admissionScore: c.admissionScore ?? c.admission?.admissionScore,
        admissionSnapshot: c.signalSnapshot || c.admission?.signalSnapshot,
        admissionWarnings: c.admissionWarnings || c.admission?.warnings || [],
        admissionAiReview: c.admissionAiReview || c.admission?.aiAdmissionReview || null,
      }));
      // Pass actual holdings so backend can filter existing positions and open orders
      const existingPositions: string[] = (holdingsRef.current || holdings || []).map((p: any) => String(p.symbol || '').toUpperCase());
      const dailyLoss = 0;
      // Use real account data: buyingPower > equity > portfolioValue > fallback
      const realAccountSize = tradingAccountData?.success
        ? (tradingAccountData.portfolioValue ?? tradingAccountData.equity ?? tradingAccountData.buyingPower ?? entryPlanAccountSize)
        : entryPlanAccountSize;
      const res = options?.suppressDiscord
        ? await api.post('/ai/entry-plan', {
            candidates: candidateData, accountSize: realAccountSize, riskPerTradePct: entryPlanRiskPerTrade,
            maxPositionPct: entryPlanMaxPositionPct, existingPositions, dailyLoss, holdingSymbols: existingPositions,
            executionMode: entryPlanApiExecutionMode, accountMode: tradeMode, riskProfile, timeHorizon,
            pipelineMode, leverageEnabled,
            suppressDiscord: true,
          })
        : await entryPlanAPI.generate(
            candidateData, realAccountSize, entryPlanRiskPerTrade, entryPlanMaxPositionPct,
            existingPositions, dailyLoss, existingPositions, entryPlanApiExecutionMode, tradeMode,
            riskProfile, timeHorizon, pipelineMode, leverageEnabled
          );
      if (res.data?.success && res.data?.plans) {
        // Propagate isDevTest flag from DV candidates to Entry Plan results
        const devTestSymbols = new Set(candidates.filter((c: any) => c.isDevTest).map((c: any) => c.symbol));
        const enrichedPlans = res.data.plans.map((p: any) => ({
          ...p,
          isDevTest: devTestSymbols.has(p.symbol) || p.isDevTest || false,
        }));
        setEntryPlanResults(enrichedPlans);
        _epResult = enrichedPlans;
        const epStatus = res.data.status || 'completed';
        const epErrors = res.data.errors || [];
        if (epStatus === 'partial' && epErrors.length > 0) {
          const failSymbols = epErrors.map((e: any) => e.symbol).join(', ');
          message.warning(agentText(`Entry plans completed with errors for: ${failSymbols}.`, `入场计划部分完成，以下标的出现错误：${failSymbols}。`));
        }
        setEntryPlanStatus('completed');
        unregisterEntryPlanRun();
      } else {
        const errMsg = agentErrorText(
          res.data?.message || res.data?.error,
          'Entry Plan returned no valid results.',
          '入场计划未返回有效结果。',
        );
        setEntryPlanStatus('completed');
        setEntryPlanResults([]);
        unregisterEntryPlanRun();
        console.warn('[EntryPlan] backend returned non-success:', errMsg);
        message.warning(agentText(`Entry planning completed without a valid plan: ${errMsg}`, `入场计划已完成，但没有生成有效计划：${errMsg}`));
        return [];
      }
    } catch (err: any) {
      const httpStatus = err.response?.status;
      const backendSkipRetry = err.response?.data?.skipRetry;
      const isConfigError = backendSkipRetry || httpStatus === 401 || httpStatus === 403;
      const isRateLimit = httpStatus === 429;

      if (isRateLimit) {
        // 429: retry once with backoff
        console.warn('[EntryPlan] Rate limited (429), retrying after delay...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        try {
          const candidateData = candidates.map((c: any) => ({
            symbol: c.symbol, companyName: c.companyName || c.name, strategy: c.strategy || c.strategyType || '', verdict: c.verdict || '',
            totalReturn: c.totalReturn ?? c.aggregateReturn, sharpeRatio: c.sharpeRatio ?? c.sharpe,
            maxDrawdown: c.maxDrawdown, winRate: c.winRate, profitFactor: c.profitFactor,
            tradeCount: c.tradeCount ?? c.trades, stabilityScore: c.stabilityScore,
            recentVsLongTerm: c.recentVsLongTerm, fineScanEntryQuality: c.fineScanEntryQuality || '',
            liquidity: c.liquidity || '', riskGrade: c.riskGrade || '',
            currentPrice: c.currentPrice || c.price || 0, support: c.support || 0,
            resistance: c.resistance || 0, atr: c.atr || 0, ema20: c.ema20 || 0, ema50: c.ema50 || 0,
            recentHigh: c.recentHigh || 0, recentLow: c.recentLow || 0, volume: c.volume || 0,
            avgVolume: c.avgVolume || 0, fineScanDecision: c.fineScanDecision || 'Pass',
            fineScanScore: c.fineScanScore || 50, fineScanStrategy: c.fineScanStrategy || '',
            fineScanRisk: c.fineScanRisk || '', fineScanNews: c.fineScanNews || '',
            entryQualityDetail: c.entryQualityDetail || '',
            entryPlan: c.entryPlan || c.entryValidation || c.institutionalPacket?.entryValidation || {},
            entryPlanSource: c.entryPlanSource || c.entryPlan?.entryPlanSource || 'deeper_validation',
            avgDollarVolume20: c.avgDollarVolume20 ?? c.costCapacity?.adv20 ?? c.institutionalPacket?.costCapacity?.adv20,
            estimatedRoundTripCostBps: c.estimatedRoundTripCostBps ?? c.costCapacity?.roundTripCostBps ?? c.institutionalPacket?.costCapacity?.roundTripCostBps,
            quotedSpreadBps: c.quotedSpreadBps ?? c.spreadBps ?? c.costCapacity?.spreadBps ?? c.institutionalPacket?.costCapacity?.spreadBps,
            eventRisk: c.eventRisk, dataQuality: c.dataQuality, sector: c.sector || c.companySector,
            admissionDecision: c.admissionDecision || c.admission?.admissionDecision,
            admissionScore: c.admissionScore ?? c.admission?.admissionScore,
            admissionSnapshot: c.signalSnapshot || c.admission?.signalSnapshot,
            admissionWarnings: c.admissionWarnings || c.admission?.warnings || [],
            admissionAiReview: c.admissionAiReview || c.admission?.aiAdmissionReview || null,
          }));
          const realAccountSize = tradingAccountData?.success
            ? (tradingAccountData.portfolioValue ?? tradingAccountData.equity ?? tradingAccountData.buyingPower ?? entryPlanAccountSize)
            : entryPlanAccountSize;
          const res = options?.suppressDiscord
            ? await api.post('/ai/entry-plan', {
                candidates: candidateData, accountSize: realAccountSize, riskPerTradePct: entryPlanRiskPerTrade,
                maxPositionPct: entryPlanMaxPositionPct, existingPositions: [], dailyLoss: 0, holdingSymbols: [],
                executionMode: entryPlanApiExecutionMode, accountMode: tradeMode, riskProfile, timeHorizon,
                pipelineMode, leverageEnabled,
                suppressDiscord: true,
              })
            : await entryPlanAPI.generate(
                candidateData, realAccountSize, entryPlanRiskPerTrade, entryPlanMaxPositionPct,
                [], 0, [], entryPlanApiExecutionMode, tradeMode,
                riskProfile, timeHorizon, pipelineMode, leverageEnabled
              );
          if (res.data?.success && res.data?.plans) {
            const devTestSymbols = new Set(candidates.filter((c: any) => c.isDevTest).map((c: any) => c.symbol));
            const enrichedPlans = res.data.plans.map((p: any) => ({
              ...p, isDevTest: devTestSymbols.has(p.symbol) || p.isDevTest || false,
            }));
            setEntryPlanResults(enrichedPlans);
            _epResult = enrichedPlans;
            setEntryPlanStatus('completed');
            unregisterEntryPlanRun();
            return _epResult;
          }
        } catch (retryErr: any) {
          console.error('[EntryPlan] Retry also failed:', retryErr.message);
        }
      }

      const rawError = err.response?.data?.error || err.response?.data?.message || err.message;
      const errMsg = agentErrorText(
        rawError,
        isConfigError
          ? 'Configuration error. Check the AI provider settings.'
          : isRateLimit
            ? 'The AI service rate limit was reached. Please wait and try again.'
            : 'Entry planning failed.',
        isConfigError
          ? '入场计划服务配置不可用，请在设置中检查 AI 连接。'
          : isRateLimit
            ? 'AI 服务请求频率受限，请稍后重试。'
            : '入场计划生成失败，请稍后重试。',
      );
      console.error('Entry plan error:', err);
      setEntryPlanStatus('error');
      unregisterEntryPlanRun();
      message.error(errMsg);
      throw new Error(errMsg);
    }
    return _epResult;
  };

  // ===== AI Auto Pipeline =====
  // Shared: render Entry Plan detail (used by Watchlist, Execution, etc.)
  // Safe render helper: converts any value to displayable string/JSX
  const safeRender = (val: any): React.ReactNode => {
    if (val == null) return 'N/A';
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (Array.isArray(val)) return val.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(', ');
    if (typeof val === 'object') {
      return Object.entries(val).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v ?? 'N/A')}`).join(' | ');
    }
    return String(val);
  };

  // ===== Leveraged ETF Alternative Lookup =====
  // Known leveraged ETF mappings (symbol -> {bull, bear} alternatives)
  const LEVERAGED_ETF_MAP: Record<string, { bull: string[]; bear: string[] }> = {
    'TSLA': { bull: ['TSLL', 'TSLR'], bear: ['TSLQ', 'TSLZ'] },
    'NVDA': { bull: ['NVDL', 'NVDU'], bear: ['NVD', 'NVDQ'] },
    'AAPL': { bull: ['AAPU'], bear: ['AAPD'] },
    'AMZN': { bull: ['AMZU'], bear: ['AMZD'] },
    'META': { bull: ['FBL'], bear: ['FBZ'] },
    'GOOGL': { bull: ['GOOX'], bear: ['GGLS'] },
    'MSFT': { bull: ['MSFU'], bear: ['MSFD'] },
    'AMD': { bull: ['AMDL'], bear: ['AMDS'] },
    'NFLX': { bull: ['NFXL'], bear: ['NFXS'] },
    'COIN': { bull: ['CONL'], bear: ['COID'] },
    'MSTR': { bull: ['MSTU', 'MSTX'], bear: ['MSTZ', 'MSTS'] },
    'QQQ': { bull: ['TQQQ', 'QLD'], bear: ['SQQQ', 'QID'] },
    'SPY': { bull: ['SPXL', 'UPRO', 'SSO'], bear: ['SPXS', 'SPXU', 'SDS'] },
    'IWM': { bull: ['TNA', 'UWM'], bear: ['TZA', 'TWM'] },
  };

  interface LeveragedAlternative {
    originalSymbol: string;
    alternativeSymbol: string;
    direction: 'bull' | 'bear';
    reason: string;
    riskWarning: string;
    tradable?: boolean;
    fractionable?: boolean;
  }

  const findLeveragedAlternative = async (
    symbol: string,
    direction: 'bull' | 'bear',
    buyingPower: number,
    currentPrice: number,
  ): Promise<LeveragedAlternative | null> => {
    if (riskProfile !== 'high') return null;

    const mapping = LEVERAGED_ETF_MAP[symbol.toUpperCase()];
    if (!mapping) return null;

    const candidates = mapping[direction] || [];
    for (const alt of candidates) {
      try {
        const res = await tradingAccountAPI.getAsset(alt, tradeMode);
        if (res.data?.success && res.data.tradable) {
          // Check if we have enough buying power for at least 1 share
          // (leveraged ETFs are usually cheaper than the underlying)
          return {
            originalSymbol: symbol,
            alternativeSymbol: alt,
            direction,
            reason: agentText(
              `High-risk mode: ${symbol} exceeds buying power. Leveraged alternative ${alt} found.`,
              `高风险模式下，${symbol} 超出当前购买力；已找到杠杆替代标的 ${alt}。`,
            ),
            riskWarning: agentText(
              `${alt} is a leveraged product with amplified volatility and loss risk. Suitable only for high-risk tolerance.`,
              `${alt} 属于杠杆产品，波动与亏损风险会被放大，仅适合高风险承受能力。`,
            ),
            tradable: true,
            fractionable: res.data.fractionable,
          };
        }
      } catch {
        // Asset not found or API error — try next candidate
      }
    }
    return null;
  };

  const renderEntryPlanDetail = (ep: any) => {
    const packet = ep.institutionalEntryPlan || {};
    const entry = packet.entry || {};
    const exits = packet.exits || {};
    const sizing = packet.sizing || {};
    const execution = packet.execution || {};
    const controls = packet.controls || {};
    const market = packet.marketContext || {};
    const ai = packet.aiReview || {};
    const provenance = packet.provenance || {};
    const rg = ep.riskGate || ep.hardRiskGate || {};
    const action = getEntryPlanEffectiveAction(ep);
    const zone = getEntryPlanZone(ep);
    const gateStatus = controls.gateStatus || rg.status || 'N/A';
    const blockers = controls.blockers || ep.blockers || [];
    const warnings = controls.warnings || rg.warnings || [];
    const triggerChecks = entry.triggerChecks || ep.entryTriggerChecks || [];
    const triggerStatus = String(entry.triggerStatus || ep.entryTriggerStatus || 'NOT EVALUATED').toUpperCase();
    const triggerMet = entry.triggerMet ?? ep.entryTriggerMet ?? false;
    const setupAutoEligible = entry.setupAutoEligible ?? ep.setupAutoEligible ?? false;
    const autoExecution = aiExecutionList.find((item: any) => (
      String(item.symbol || '').toUpperCase() === String(ep.symbol || '').toUpperCase() && item.source === 'entry-plan-auto'
    ));
    const fmtNum = (v: any, digits = 2) => Number.isFinite(Number(v)) ? Number(v).toFixed(digits) : '--';
    const fmtPrice = (v: any) => Number.isFinite(Number(v)) && Number(v) > 0 ? `$${Number(v).toFixed(2)}` : '--';
    const fmtMoney = (v: any) => Number.isFinite(Number(v)) ? `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '--';
    const fmtPct = (v: any, digits = 1) => Number.isFinite(Number(v)) ? `${Number(v).toFixed(digits)}%` : '--';
    const fmtBps = (v: any) => Number.isFinite(Number(v)) ? `${Number(v).toFixed(1)} bps` : '--';
    const actionTone = action === 'BUY_READY' ? 'ready' : action === 'READY_REVIEW' ? 'review' : action === 'WAIT_FOR_ENTRY' ? 'wait' : 'block';

    const Metric = ({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) => (
      <div className="epv2-metric">
        <span>{label}</span>
        <b className={tone ? `epv2-tone-${tone}` : ''}>{value}</b>
      </div>
    );

    const DataLine = ({ label, value }: { label: string; value: React.ReactNode }) => (
      <div className="epv2-data-line">
        <span>{label}</span>
        <b>{value}</b>
      </div>
    );

    return (
      <div className="epv2-detail">
        <div className="epv2-detail-head">
          <div>
            <div className="epv2-symbol-line">
              <b>{ep.symbol}</b>
              <span>{packet.setupClass || ep.setup || agentText('Entry setup', '入场结构')}</span>
            </div>
            <div className="epv2-subline">
              {packet.validatedStrategy || ep.strategy || agentText('validated strategy', '已验证策略')} · {packet.method || ep.executionPlanVersion || agentText('pretrade plan', '交易前计划')}
            </div>
          </div>
          <Space size={8} wrap>
            {String(ep.entryIntent || '').toUpperCase() === 'SCALE_IN' && (
              <Tag color="cyan" bordered={false}>{agentText('SCALE IN', '补仓')}</Tag>
            )}
            <Tag className={`epv2-chip epv2-chip-${actionTone}`} bordered={false}>{agentEnumLabel(packet.planState || ep.planState || action)}</Tag>
            <Tag className={`epv2-chip epv2-chip-${String(gateStatus).toLowerCase()}`} bordered={false}>{agentText('Gate', '风控门槛')} {agentEnumLabel(gateStatus)}</Tag>
            <Tag className="epv2-chip epv2-chip-neutral" bordered={false}>{agentEnumLabel(ep.dataQuality || controls.dataQuality || 'DATA')}</Tag>
          </Space>
        </div>

        {autoExecution && (
          <div className={`epv2-order-audit epv2-order-audit-${autoExecution.executionStatus || 'pending'}`}>
            <div><span>{agentText('Automation', '自动执行')}</span><b>{agentEnumLabel(autoExecution.executionStatus || 'pending')}</b></div>
            <div><span>{agentText('Submitted Limit', '已提交限价')}</span><b>{fmtPrice(autoExecution.submittedLimitPrice)}</b></div>
            <div><span>{agentText('Order Class', '订单组合')}</span><b>{agentEnumLabel(autoExecution.orderClass || '--')}</b></div>
            <div><span>{agentText('Protection', '保护方式')}</span><b>{agentEnumLabel(autoExecution.protectionMode || '--')}</b></div>
            <div><span>{agentText('Broker Order', '券商订单')}</span><b>{autoExecution.alpacaOrderId ? String(autoExecution.alpacaOrderId).slice(0, 12) : '--'}</b></div>
          </div>
        )}

        <div className="epv2-detail-grid">
          <section className="epv2-panel epv2-panel-primary">
            <div className="epv2-panel-title">{agentText('Entry & Trigger', '入场与触发')}</div>
            <div className="epv2-metric-grid">
              <Metric label={agentText('Last Trade', '最新成交价')} value={fmtPrice(entry.currentPrice ?? ep.currentPrice)} />
              <Metric label={agentText('Executable Ask', '可执行卖价')} value={fmtPrice(entry.executableAsk ?? entry.latestAsk ?? ep.executableAsk ?? ep.latestAsk)} tone={ep.isInEntryZone ? 'ready' : 'wait'} />
              <Metric label={agentText('Best Bid', '最佳买价')} value={fmtPrice(entry.latestBid ?? ep.latestBid)} />
              <Metric label={agentText('Entry Zone', '入场区间')} value={`${fmtPrice(entry.zoneLow ?? zone.low)} - ${fmtPrice(entry.zoneHigh ?? zone.high)}`} />
              <Metric label={agentText('Quote Age', '报价延迟')} value={(entry.quoteAgeSeconds ?? ep.quoteAgeSeconds) != null ? `${Number(entry.quoteAgeSeconds ?? ep.quoteAgeSeconds).toFixed(0)}s` : '--'} />
              <Metric label={agentText('Session', '交易时段')} value={(entry.marketIsOpen ?? ep.marketIsOpen) === true ? agentText('Open', '开市') : (entry.marketIsOpen ?? ep.marketIsOpen) === false ? agentText('Closed', '已收市') : '--'} />
              <Metric label={agentText('Trigger Status', '触发状态')} value={agentEnumLabel(triggerStatus)} tone={triggerMet ? 'ready' : triggerStatus === 'NEED_DATA' ? 'block' : 'wait'} />
              <Metric label={agentText('Auto Eligibility', '自动执行资格')} value={setupAutoEligible ? agentText('Eligible', '符合条件') : agentText('Research only', '仅研究')} tone={setupAutoEligible ? 'ready' : 'wait'} />
            </div>
            <div className="epv2-callout">
              <span>{agentText('Trigger', '触发条件')}</span>
              <p>{entry.trigger || ep.triggerCondition || '--'}</p>
            </div>
            {triggerChecks.length > 0 && (
              <div className="epv2-trigger-checks" aria-label={agentText('Entry trigger checks', '入场触发检查')}>
                {triggerChecks.map((check: any, idx: number) => {
                  const state = check.passed === true ? 'pass' : check.passed === false ? 'fail' : 'missing';
                  const Icon = state === 'pass' ? CheckCircleOutlined : state === 'fail' ? ClockCircleOutlined : ExclamationCircleOutlined;
                  return (
                    <div key={`${check.name || 'check'}-${idx}`} className={`epv2-trigger-check epv2-trigger-check-${state}`}>
                      <Icon />
                      <div>
                        <b>{check.name || agentText('Trigger check', '触发检查')}{check.required === false ? agentText(' · context', ' · 参考项') : ''}</b>
                        <span>{check.observed || check.requirement || '--'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="epv2-panel">
            <div className="epv2-panel-title">{agentText('Exit Geometry', '退出价位')}</div>
            <div className="epv2-metric-grid">
              <Metric label={agentText('Stop', '止损')} value={fmtPrice(exits.stopLoss ?? ep.stopLoss)} tone="block" />
              <Metric label={agentText('Target 1', '目标 1')} value={fmtPrice(exits.target1 ?? ep.takeProfit1)} tone="ready" />
              <Metric label={agentText('Target 2', '目标 2')} value={fmtPrice(exits.target2 ?? ep.takeProfit2)} tone="ready" />
              <Metric label="R/R 1" value={`${fmtNum(exits.riskReward1 ?? ep.riskReward1, 2)}x`} tone={(exits.riskReward1 ?? ep.riskReward1) >= 1.5 ? 'ready' : 'wait'} />
              <Metric label={agentText('Target Source', '目标依据')} value={agentEnumLabel(exits.targetSource || ep.targetSource || '--')} />
            </div>
            <div className="epv2-callout">
              <span>{agentText('Invalidation', '失效条件')}</span>
              <p>{exits.invalidation || ep.invalidationCondition || ep.invalidationComment || '--'}</p>
            </div>
          </section>

          <section className="epv2-panel">
            <div className="epv2-panel-title">{agentText('Sizing', '仓位规模')}</div>
            <div className="epv2-metric-grid">
              <Metric label={agentText('Shares', '股数')} value={Number(sizing.shares ?? ep.shares ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} />
              <Metric label={agentText('Notional', '名义金额')} value={fmtMoney(sizing.notional ?? ep.allocationDollars)} />
              <Metric label={agentText('Risk Used', '已用风险额度')} value={fmtPct(sizing.riskUsedPct ?? ep.riskUsedPct)} />
              <Metric label={agentText('Risk Budget', '风险预算')} value={fmtMoney(sizing.riskBudget ?? ep.riskBudget)} />
              <Metric label={agentText('Cash Capacity', '可用现金')} value={fmtMoney(ep.accountSpendablePower ?? tradingAccountData?.cash)} />
              <Metric label={agentText('Allocation Cap', '配置上限')} value={fmtMoney(ep.maxAllocationDollars)} />
              {String(ep.entryIntent || '').toUpperCase() === 'SCALE_IN' && (
                <>
                  <Metric label={agentText('Existing Position', '现有仓位')} value={fmtMoney(ep.existingPositionValue)} />
                  <Metric label={agentText('After Add', '补仓后仓位')} value={fmtMoney(ep.postTradePositionValue)} />
                  <Metric label={agentText('Scale-ins', '已补仓次数')} value={`${ep.scaleInCount || 0}/${ep.maxScaleIns || 0}`} />
                  <Metric label={agentText('Position P/L', '持仓收益')} value={fmtPct(ep.existingUnrealizedPct)} />
                </>
              )}
            </div>
            <div className="epv2-footnote">{sizing.capStatus || ep.positionCapStatus || agentText('Within allocation limits', '未超过配置上限')}</div>
          </section>

          <section className="epv2-panel">
            <div className="epv2-panel-title">{agentText('Execution Controls', '执行控制')}</div>
            <div className="epv2-metric-grid">
              <Metric label={agentText('Order', '订单')} value={agentText('Limit only', '仅限价单')} />
              <Metric label={agentText('Limit', '限价')} value={fmtPrice(execution.limitPrice ?? ep.limitPrice)} />
              <Metric label={agentText('TIF / Session', '有效期 / 时段')} value={`${agentEnumLabel(execution.timeInForce || ep.timeInForce || 'day')} / ${agentText('Regular', '常规')}`} />
              <Metric label={agentText('Slippage Cap', '滑点上限')} value={fmtBps(execution.slippageCapBps ?? ep.slippageCapBps)} />
              <Metric label={agentText('Protection', '保护方式')} value={execution.protectionMode ? agentEnumLabel(execution.protectionMode) : agentText('Whole-share bracket required', '整股自动执行需使用保护性组合订单')} />
              <Metric label={agentText('Extended Hours', '盘前盘后')} value={agentText('Off', '关闭')} />
            </div>
            <div className="epv2-footnote">{execution.reason || ep.executionDetails?.orderTypeReason || '--'}</div>
          </section>
        </div>

        <div className="epv2-lower-grid">
          <section className="epv2-panel">
            <div className="epv2-panel-title">{agentText('Risk Gate', '风险门控')}</div>
            <div className="epv2-tag-row">
              <Tag className={`epv2-chip epv2-chip-${String(gateStatus).toLowerCase()}`} bordered={false}>{gateStatus}</Tag>
              <Tag bordered={false}>{controls.accountConnected ? agentText('Broker connected', '券商已连接') : agentText('Broker review', '需要检查券商连接')}</Tag>
              <Tag bordered={false}>{entry.zoneStatus || ep.zoneStatus ? agentEnumLabel(entry.zoneStatus || ep.zoneStatus) : agentText('Zone —', '区间 —')}</Tag>
            </div>
            <div className="epv2-risk-list">
              {[...blockers, ...warnings].slice(0, 5).map((item: any, idx: number) => (
                <div key={idx} className={idx < blockers.length ? 'epv2-risk-block' : 'epv2-risk-warn'}>
                  {safeRender(item)}
                </div>
              ))}
              {blockers.length === 0 && warnings.length === 0 && <div className="epv2-risk-clean">{agentText('No active blockers.', '当前没有生效中的阻断项。')}</div>}
            </div>
          </section>

          <section className="epv2-panel">
            <div className="epv2-panel-title">{agentText('AI Trader Review', 'AI 交易审核')}</div>
            <p className="epv2-ai-text">{ai.reason || ep.decisionReason || ep.reason || '--'}</p>
            <div className="epv2-tag-row">
              <Tag color={ai.decision === 'BUY' ? 'success' : ai.decision === 'SKIP' ? 'error' : 'warning'} bordered={false}>{agentEnumLabel(ai.decision || ep.aiDecision || 'WATCH')}</Tag>
              <Tag bordered={false}>{ai.confidence ?? ep.confidence ?? '--'}% {agentText('confidence', '置信度')}</Tag>
              <Tag bordered={false}>{ai.source || ep.aiSource || agentText('Local Rules', '本地规则')}</Tag>
            </div>
            <div className="epv2-footnote">{ai.nextStep || ep.nextStep || '--'}</div>
          </section>

          <section className="epv2-panel">
            <div className="epv2-panel-title">{agentText('Market & Sources', '市场与数据来源')}</div>
            <DataLine label="ADV20" value={fmtMoney(market.avgDollarVolume20 ?? ep.avgDollarVolume20)} />
            <DataLine label={agentText('Spread / Cost', '价差 / 成本')} value={`${fmtBps(market.spreadBps ?? ep.quotedSpreadBps)} / ${fmtBps(market.roundTripCostBps ?? ep.estimatedRoundTripCostBps)}`} />
            <DataLine label="ATR / EMA20" value={`${fmtPct(market.atrPct ?? ep.atrPct)} / ${fmtPrice(market.ema20 ?? ep.ema20)}`} />
            <DataLine label={agentText('Market', '市场数据')} value={provenance.marketData || ep.dataSources?.marketData || '--'} />
            <DataLine label={agentText('Account', '账户数据')} value={provenance.accountData || ep.dataSources?.accountData || '--'} />
          </section>
        </div>

        {riskProfile === 'high' && (action === 'SKIP' || action === 'BLOCKED_BY_RISK') && !ep.isLeveragedAlternative && (
          <LeveragedETFSuggestion
            symbol={ep.symbol}
            currentPrice={ep.currentPrice}
            plan={ep}
            buyingPower={tradingAccountData?.buyingPower || 0}
          />
        )}
      </div>
    );
  };

  // Leveraged ETF suggestion component (async lookup — tries bull then bear)
  const LeveragedETFSuggestion: React.FC<{
    symbol: string;
    currentPrice: number;
    plan?: any;
    buyingPower: number;
  }> = ({ symbol, currentPrice, plan, buyingPower }) => {
    const [suggestion, setSuggestion] = React.useState<LeveragedAlternative | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
      const lookup = async () => {
        setLoading(true);
        // Try bull first, then bear
        let result = await findLeveragedAlternative(symbol, 'bull', buyingPower, currentPrice);
        if (!result) {
          result = await findLeveragedAlternative(symbol, 'bear', buyingPower, currentPrice);
        }
        setSuggestion(result);
        setLoading(false);
      };
      lookup();
    }, [symbol, currentPrice, buyingPower]);

    if (loading) return <Spin size="small" style={{ marginTop: 8 }} />;
    if (!suggestion) return null;

    return (
      <Alert
        style={{ marginTop: 16, borderRadius: 8 }}
        type="warning"
        showIcon
        message={<Text strong>{language === 'zh-CN' ? '杠杆替代标的建议' : 'Leveraged Alternative Suggestion'}</Text>}
        description={
          <div style={{ fontSize: 12, lineHeight: 1.6 }}>
            <div style={{ marginBottom: 8 }}>
              {language === 'zh-CN'
                ? `当前为高风险模式，正股 ${symbol} 资金不足。系统检测到可交易的杠杆替代标的 ${suggestion.alternativeSymbol}，但该产品波动和亏损风险更高，仅在风控允许时作为进攻型候选。`
                : `High-risk mode detected. The underlying stock ${symbol} exceeds available buying power. A tradable leveraged alternative was found (${suggestion.alternativeSymbol}), but it carries amplified volatility and loss risk.`}
            </div>
            <Tag color="red" style={{ fontWeight: 700 }}>{suggestion.riskWarning}</Tag>
            {suggestion.fractionable !== undefined && (
              <Tag color={suggestion.fractionable ? 'green' : 'default'} style={{ marginLeft: 8 }}>
                {suggestion.fractionable ? (language === 'zh-CN' ? '支持碎股' : 'Fractionable') : (language === 'zh-CN' ? '仅整股' : 'Whole shares only')}
              </Tag>
            )}
          </div>
        }
      />
    );
  };

  // Normalize a watchlist item (or any partial entry plan shape) to full Entry Plan format
  const normalizeWatchlistToEntryPlan = (item: any): any => ({
    symbol: item.symbol,
    // Decision section
    finalAction: item.finalAction,
    aiDecision: item.aiDecision,
    confidence: item.confidence,
    tradeReadiness: item.tradeReadiness,
    setup: item.setup || item.setupType,
    nextStep: item.nextStep,
    // Entry / Exit levels
    entryZoneLow: getEntryPlanZone(item).low,
    entryZoneHigh: getEntryPlanZone(item).high,
    triggerCondition: item.triggerCondition || item.trigger,
    entryTriggerStatus: item.entryTriggerStatus,
    entryTriggerMet: item.entryTriggerMet,
    entryTriggerChecks: item.entryTriggerChecks,
    entryTriggerMissing: item.entryTriggerMissing,
    entryTriggerReasons: item.entryTriggerReasons,
    setupAutoEligible: item.setupAutoEligible,
    triggerEvaluatedAt: item.triggerEvaluatedAt,
    invalidationCondition: item.invalidationCondition || item.invalidationComment,
    stopLoss: item.stopLoss,
    takeProfit1: item.takeProfit1,
    takeProfit2: item.takeProfit2,
    riskReward1: item.riskReward1 || item.riskReward,
    riskReward2: item.riskReward2,
    // Risk / Position sizing
    positionSizeShares: item.positionSizeShares || item.shares,
    positionSizeDollars: item.positionSizeDollars,
    positionPct: item.positionPct,
    riskGate: item.riskGate || { status: item.riskGateStatus },
    dataQuality: item.dataQuality,
    // AI / Data
    aiSource: item.aiSource,
    aiModel: item.aiModel,
    aiError: item.aiError,
    aiCalled: item.aiCalled,
    dataSources: item.dataSources,
    // Reasons
    decisionReason: item.decisionReason,
    riskNotes: item.riskNotes || item.riskComment,
    blockers: item.blockers,
  });

  const renderEntryPlanWorkbench = () => {
    if (!entryPlanResults || entryPlanResults.length === 0) return null;

    const plans = entryPlanResults as any[];
    const fmtPrice = (v: any) => Number.isFinite(Number(v)) && Number(v) > 0 ? `$${Number(v).toFixed(2)}` : '--';
    const fmtMoney = (v: any) => Number.isFinite(Number(v)) ? `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '--';
    const fmtPct = (v: any, digits = 1) => Number.isFinite(Number(v)) ? `${Number(v).toFixed(digits)}%` : '--';
    const fmtShares = (v: any) => Number.isFinite(Number(v)) ? Number(v).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '--';
    const getPacket = (p: any) => p?.institutionalEntryPlan || {};
    const getTone = (p: any) => {
      const action = getEntryPlanEffectiveAction(p);
      if (action === 'BUY_READY') return 'ready';
      if (action === 'READY_REVIEW') return 'review';
      if (action === 'WAIT_FOR_ENTRY') return 'wait';
      return 'block';
    };
    const labelAction = (action: string) => ({
      BUY_READY: agentText('BUY READY', '可买入'),
      READY_REVIEW: agentText('REVIEW', '待审核'),
      WAIT_FOR_ENTRY: agentText('WAIT', '等待入场'),
      NEED_DATA: agentText('NEED DATA', '需要数据'),
      BLOCKED_BY_RISK: agentText('BLOCKED', '风险阻断'),
      SKIP: agentText('SKIP', '跳过'),
    }[action] || action || '--');

    const readyCount = plans.filter((p) => getEntryPlanEffectiveAction(p) === 'BUY_READY').length;
    const reviewCount = plans.filter((p) => getEntryPlanEffectiveAction(p) === 'READY_REVIEW').length;
    const waitCount = plans.filter((p) => getEntryPlanEffectiveAction(p) === 'WAIT_FOR_ENTRY').length;
    const blockedCount = plans.filter((p) => ['BLOCKED_BY_RISK', 'SKIP', 'NEED_DATA'].includes(getEntryPlanEffectiveAction(p))).length;
    const totalRisk = plans
      .filter((p) => getEntryPlanEffectiveAction(p) === 'BUY_READY')
      .reduce((sum, p) => sum + Number(p.riskDollars || p.institutionalEntryPlan?.sizing?.riskDollars || 0), 0);
    const totalNotional = plans
      .filter((p) => getEntryPlanEffectiveAction(p) === 'BUY_READY')
      .reduce((sum, p) => sum + Number(p.allocationDollars || p.positionSizeDollars || p.institutionalEntryPlan?.sizing?.notional || 0), 0);
    const submittedCount = aiExecutionList.filter((item: any) => (
      ['entry-plan-auto', 'backend-pipeline'].includes(item.source) &&
      ['submitted', 'pending', 'filled', 'order_pending'].includes(item.executionStatus || '')
    )).length;
    const accountEquity = tradingAccountData?.portfolioValue ?? tradingAccountData?.equity;
    const accountBuyingPower = tradingAccountData?.buyingPower;
    const accountCash = tradingAccountData?.cash;
    const accountSpendable = Number.isFinite(Number(accountBuyingPower)) && Number.isFinite(Number(accountCash))
      ? Math.max(0, Math.min(Number(accountBuyingPower), Number(accountCash)))
      : accountCash ?? accountBuyingPower;

    const renderActionButton = (record: any) => {
      const action = getEntryPlanEffectiveAction(record);
      const tooltip = isZh
        ? action === 'NEED_DATA'
          ? '缺少生成可执行计划所需的数据，请刷新行情后重新运行入场计划。'
          : action === 'WAIT_FOR_ENTRY'
            ? '当前价格或触发条件尚未进入获批区间，系统将继续观察。'
            : action === 'READY_REVIEW'
              ? '执行前需要人工核对风险门控、价格与保护性退出。'
              : action === 'BLOCKED_BY_RISK' || action === 'SKIP'
                ? '当前计划未通过风险门控，不能提交订单。'
                : '该入场计划已经具备执行条件。'
        : getEntryPlanActionTooltip(record);
      const dq = record.dataQuality;
      const hasHardBlock = hasEntryPlanHardBlock(record);
      const activeAutoExecution = aiExecutionList.find((item: any) => (
        String(item.symbol || '').toUpperCase() === String(record.symbol || '').toUpperCase() &&
        ['entry-plan-auto', 'backend-pipeline'].includes(item.source) &&
        ['auto_executing', 'submitted', 'pending', 'filled', 'failed', 'zone_wait', 'blocked', 'holding', 'order_pending'].includes(item.executionStatus || '')
      ));

      if (action === 'BLOCKED_BY_RISK' || action === 'NEED_DATA' || action === 'SKIP' || hasHardBlock || dq === 'POOR') {
        return <Tooltip title={tooltip}><Button size="small" disabled danger className="epv2-action-btn">{action === 'NEED_DATA' ? agentText('Need Data', '需要数据') : agentText('Blocked', '已阻断')}</Button></Tooltip>;
      }
      if (action === 'BUY_READY') {
        if (activeAutoExecution?.executionStatus === 'submitted' || activeAutoExecution?.executionStatus === 'pending' || activeAutoExecution?.executionStatus === 'filled') {
          return <Tag color="success" bordered={false} className="epv2-action-tag">{agentText('Submitted', '已提交')}</Tag>;
        }
        if (activeAutoExecution?.executionStatus === 'failed') {
          return <Tooltip title={activeAutoExecution.executionError || agentText('Auto execution failed', '自动执行失败')}><Tag color="error" bordered={false} className="epv2-action-tag">{agentText('Failed', '失败')}</Tag></Tooltip>;
        }
        if (activeAutoExecution?.executionStatus === 'zone_wait') {
          return <Tooltip title={activeAutoExecution.executionError}><Tag color="warning" bordered={false} className="epv2-action-tag">{agentText('Waiting', '等待中')}</Tag></Tooltip>;
        }
        if (activeAutoExecution?.executionStatus === 'holding' || activeAutoExecution?.executionStatus === 'order_pending') {
          return <Tooltip title={activeAutoExecution.executionError}><Tag color="default" bordered={false} className="epv2-action-tag">{agentText('Protected', '已保护')}</Tag></Tooltip>;
        }
        if (pipelineMode === 'ai') {
          return <Tag color="processing" bordered={false} className="epv2-action-tag">{agentText('Auto Limit', '自动限价')}</Tag>;
        }
        return <Button size="small" type="primary" className="epv2-action-btn epv2-action-execute" onClick={() => handleEntryPlanAction(record)}>{agentText('Execute', '执行')}</Button>;
      }
      if (action === 'READY_REVIEW') {
        return <Button size="small" className="epv2-action-btn" onClick={() => handleEntryPlanAction(record)}>{agentText('Review', '审核')}</Button>;
      }
      if (action === 'WAIT_FOR_ENTRY') {
        const inWl = isInWatchlist(record.symbol);
        return (
          <Tooltip title={tooltip}>
            <Button size="small" icon={inWl ? <CheckOutlined /> : <PlusOutlined />} className="epv2-action-btn" onClick={() => addToWatchlist(record)}>
              {inWl ? agentText('Watching', '观察中') : agentText('Watch', '加入观察')}
            </Button>
          </Tooltip>
        );
      }
      return <span className="epv2-muted">--</span>;
    };

    return (
      <div className="entry-plan-v2">
        <div className="epv2-summary">
          <div className="epv2-summary-item">
            <span>{agentText('DV Qualified', '深度验证通过')}</span>
            <b>{plans.length}</b>
            <small>{agentText('validated candidates', '已验证候选')}</small>
          </div>
          <div className="epv2-summary-item">
            <span>{agentText('Auto Eligible', '可自动执行')}</span>
            <b className="epv2-tone-ready">{readyCount}</b>
            <small>{agentText('ask in zone · clean gate', '卖价在区间内 · 风控通过')}</small>
          </div>
          <div className="epv2-summary-item">
            <span>{agentText('Review / Wait', '审核 / 等待')}</span>
            <b><span className="epv2-tone-review">{reviewCount}</span> / <span className="epv2-tone-wait">{waitCount}</span></b>
            <small>{blockedCount} {agentText('blocked', '个已阻断')}</small>
          </div>
          <div className="epv2-summary-item">
            <span>{agentText('Approved Exposure', '已批准风险敞口')}</span>
            <b>{fmtMoney(totalRisk)}</b>
            <small>{fmtMoney(totalNotional)} {agentText('notional', '名义金额')}</small>
          </div>
          <div className="epv2-summary-item">
            <span>{agentText('Cash Capacity', '可用现金')}</span>
            <b>{fmtMoney(accountSpendable)}</b>
            <small>{fmtMoney(accountEquity)} {agentText('equity · no margin', '账户权益 · 不使用保证金')}</small>
          </div>
          <div className="epv2-summary-item">
            <span>{agentText('Orders Submitted', '已提交订单')}</span>
            <b>{submittedCount}</b>
            <small>{pipelineMode === 'ai' ? `${tradeMode === 'real' ? agentText('LIVE', '实盘') : agentText('PAPER', '模拟')} ${agentText('auto', '自动')}` : agentText('review workflow', '人工审核流程')}</small>
          </div>
        </div>

        <div className="epv2-policy" role="status" aria-label={agentText('Entry execution policy', '入场执行规则')}>
          <div><span>{agentText('Automation', '自动执行')}</span><b>{pipelineMode === 'ai' ? agentText('Enabled', '已启用') : agentText('Review', '需审核')}</b></div>
          <div><span>{agentText('Trigger', '触发条件')}</span><b>{agentText('Zone + setup confirmation', '进入区间 + 形态确认')}</b></div>
          <div><span>{agentText('Entry Order', '入场订单')}</span><b>{agentText('Limit only · DAY', '仅限价 · 当日有效')}</b></div>
          <div><span>{agentText('Session', '交易时段')}</span><b>{agentText('Regular hours', '常规交易时段')}</b></div>
          <div><span>{agentText('Protection', '保护机制')}</span><b>{agentText('Whole-share bracket for auto', '整股自动执行使用保护性组合订单')}</b></div>
        </div>

        {tradingAccountData && tradingAccountData.success !== true && (
          <Alert
            message={agentText(
              'Trading account is not connected. Entry Plan can still calculate levels, but execution stays blocked until Alpaca is connected.',
              '交易账户尚未连接。系统仍可计算入场价位，但在连接 Alpaca 之前不会执行订单。',
            )}
            type="warning"
            showIcon
            className="epv2-alert"
          />
        )}

        <Table
          className="entry-plan-v2-table"
          dataSource={plans}
          rowKey="symbol"
          size="middle"
          scroll={{ x: 1332 }}
          pagination={plans.length > 12 ? { pageSize: 12, size: 'small' } : false}
          onRow={(record) => ({
            onClick: (event) => {
              if ((event.target as HTMLElement).closest('button') || (event.target as HTMLElement).closest('a')) return;
              setExpandedEntryPlanSymbol(expandedEntryPlanSymbol === record.symbol ? null : record.symbol);
            },
          })}
          rowClassName={(record) => `epv2-row epv2-row-${getTone(record)}`}
          expandable={{
            expandedRowKeys: expandedEntryPlanSymbol ? [expandedEntryPlanSymbol] : [],
            expandIcon: () => null,
            onExpand: (expanded, record) => setExpandedEntryPlanSymbol(expanded ? record.symbol : null),
            expandedRowRender: (record) => renderEntryPlanDetail(record),
          }}
          columns={[
            {
              title: agentText('Candidate', '候选标的'),
              key: 'candidate',
              width: 170,
              render: (record: any) => (
                <div className="epv2-candidate">
                  <b>{record.symbol}</b>
                  <span>{record.companyName || record.name || record.underlyingSymbol || record.strategy || '--'}</span>
                </div>
              ),
            },
            {
              title: agentText('State', '状态'),
              key: 'state',
              width: 130,
              render: (record: any) => {
                const action = getEntryPlanEffectiveAction(record);
                return (
                  <div className="epv2-state">
                    <Tag bordered={false} className={`epv2-chip epv2-chip-${getTone(record)}`}>{labelAction(action)}</Tag>
                    <span>{agentEnumLabel(record.aiDecision || 'WATCH')} · {record.confidence ?? '--'}%</span>
                  </div>
                );
              },
            },
            {
              title: agentText('Entry', '入场'),
              key: 'entry',
              width: 210,
              render: (record: any) => {
                const packet = getPacket(record);
                const entry = packet.entry || {};
                const zone = getEntryPlanZone(record);
                const ask = entry.executableAsk ?? entry.latestAsk ?? record.executableAsk ?? record.latestAsk;
                const bid = entry.latestBid ?? record.latestBid;
                const quoteAge = entry.quoteAgeSeconds ?? record.quoteAgeSeconds;
                const triggerStatus = String(entry.triggerStatus || record.entryTriggerStatus || 'not evaluated').replace(/_/g, ' ');
                return (
                  <div className="epv2-stack">
                    <b>{agentText('Ask', '卖价')} {fmtPrice(ask)}</b>
                    <span>{fmtPrice(entry.zoneLow ?? zone.low)} - {fmtPrice(entry.zoneHigh ?? zone.high)}</span>
                    <small>{agentText('Bid', '买价')} {fmtPrice(bid)} · {quoteAge != null ? `${Number(quoteAge).toFixed(0)}s` : '--'}</small>
                    <small>{agentText('Trigger', '触发')} {agentEnumLabel(triggerStatus)}</small>
                  </div>
                );
              },
            },
            {
              title: agentText('Stop / Targets', '止损 / 目标'),
              key: 'exit',
              width: 180,
              render: (record: any) => {
                const packet = getPacket(record);
                const exits = packet.exits || {};
                return (
                  <div className="epv2-stack">
                    <b className="epv2-tone-block">S {fmtPrice(exits.stopLoss ?? record.stopLoss)}</b>
                    <span>T1 {fmtPrice(exits.target1 ?? record.takeProfit1)}</span>
                    <small>R/R {Number(exits.riskReward1 ?? record.riskReward1 ?? 0).toFixed(2)}x</small>
                  </div>
                );
              },
            },
            {
              title: agentText('Sizing', '仓位'),
              key: 'sizing',
              width: 170,
              render: (record: any) => {
                const sizing = getPacket(record).sizing || {};
                return (
                  <div className="epv2-stack">
                    <b>{fmtShares(sizing.shares ?? record.shares ?? record.positionSizeShares)} {agentText('sh', '股')}</b>
                    <span>{fmtMoney(sizing.notional ?? record.allocationDollars ?? record.positionSizeDollars)}</span>
                    <small>{agentText('risk', '风险')} {fmtMoney(sizing.riskDollars ?? record.riskDollars)} · {fmtPct(sizing.riskUsedPct ?? record.riskUsedPct)}</small>
                  </div>
                );
              },
            },
            {
              title: agentText('Execution', '执行'),
              key: 'execution',
              width: 190,
              render: (record: any) => {
                const execution = getPacket(record).execution || {};
                const protection = execution.protectionMode || record.executionDetails?.orderPreview?.protectionMode || agentText('Whole-share bracket required', '整股自动执行需使用保护性组合订单');
                return (
                  <div className="epv2-stack">
                    <b>{agentText('Limit', '限价')} {fmtPrice(execution.limitPrice ?? record.limitPrice)}</b>
                    <span>{agentEnumLabel(execution.timeInForce || record.timeInForce || 'day')} · {agentText('regular session', '常规交易时段')}</span>
                    <small>{agentEnumLabel(protection)}</small>
                  </div>
                );
              },
            },
            {
              title: agentText('Controls', '风控'),
              key: 'controls',
              width: 170,
              render: (record: any) => {
                const controls = getPacket(record).controls || {};
                const gate = controls.gateStatus || record.hardRiskGate?.status || '--';
                const issueCount = (controls.blockers?.length || record.blockers?.length || 0) + (controls.warnings?.length || record.hardRiskGate?.warnings?.length || 0);
                const marketOpen = record.marketIsOpen ?? getPacket(record).entry?.marketIsOpen;
                return (
                  <div className="epv2-stack">
                    <b>{agentText('Gate', '门控')} {agentEnumLabel(gate)}</b>
                    <span>{marketOpen === true ? agentText('Market open', '市场开市') : marketOpen === false ? agentText('Market closed', '市场已收市') : agentText('Session —', '时段 —')}</span>
                    <small>{issueCount} {agentText(issueCount === 1 ? 'issue' : 'issues', '个问题')}</small>
                  </div>
                );
              },
            },
            {
              title: '',
              key: 'action',
              width: 112,
              render: renderActionButton,
            },
          ]}
        />
      </div>
    );
  };

  const PIPELINE_STAGES = ['Market Scanner', 'Fine Scan', 'Deeper Validation', 'Portfolio Admission', 'Entry Plan', 'Execution', 'Position & Exit'] as const;

  // Translate pipeline stage name for display (internal keys stay English)
  const getPipelineStageLabel = (name: string): string => {
    const map: Record<string, string> = {
      'Market Scanner': t.agent.pipelineStageMarketScanner,
      'Fine Scan': t.agent.pipelineStageFineScan,
      'Deeper Validation': t.agent.pipelineStageDeeperValidation,
      'Portfolio Admission': agentText('Portfolio Admission', '组合准入'),
      'Entry Plan': t.agent.pipelineStageEntryPlan,
      'Execution': agentText('Execution', '订单执行'),
      'Position & Exit': t.agent.pipelineStageExitScan,
    };
    return map[name] || name;
  };

  // ── Run Auto Pipeline Now (background auto-run, does NOT touch manual state) ──
  const handleRunAutoNow = async () => {
    if (runAutoNowInFlightRef.current || pipelineAutoLoading) {
      message.warning(agentText('Auto pipeline request is already in progress.', '自动化流程请求正在处理中。'));
      return;
    }
    if (pipelineRunning) {
      message.warning(agentText('Manual pipeline is running. Please wait for it to complete.', '手动流程正在运行，请等待其完成。'));
      return;
    }
    if (autoRunActive) {
      message.warning(agentText('Auto pipeline is already running.', '自动化流程已经在运行。'));
      return;
    }
    runAutoNowInFlightRef.current = true;
    setPipelineAutoLoading(true);
    try {
      // Save current context so scheduled runs use the same settings as the UI.
      // Ensures riskProfile / timeHorizon / pipelineMode / tradeMode are persisted
      // before the auto pipeline reads them via _pa_resolve_auto_run_context.
      const intervalMap: Record<string, number> = { '15m': 15, '30m': 30, '1h': 60, '2h': 120 };
      const scheduleEnabled = pipelineSchedule !== 'off';
      const configResponse = await pipelineAutoAPI.saveConfig({
        enabled: scheduleEnabled,
        intervalMinutes: scheduleEnabled ? intervalMap[pipelineSchedule] || 15 : null,
        mode: pipelineMode,
        riskProfile,
        timeHorizon,
        tradeMode,
        leverageEnabled,
        liveAutoTradingEnabled,
      });
      if (!configResponse?.data?.success) {
        throw new Error(configResponse?.data?.message || configResponse?.data?.reason || 'Automation settings could not be saved');
      }
      console.log('[AutoPipelineNow] saved config mode=%s risk=%s horizon=%s trade=%s', pipelineMode, riskProfile, timeHorizon, tradeMode);
      const res = await pipelineAutoAPI.runNow({});
      if (!res?.data?.success) {
        throw new Error(res?.data?.message || res?.data?.error || 'Failed to start auto pipeline');
      }
      console.log('[AutoPipelineNow] started runId=%s using saved config', res.data.runId);
      setAutoRunRequestedId(res.data.runId || 'starting');
      setAutoRunActive(true);
      setAutoRunStep('market_scanner');
      setAutoRunProgress(1);
      setAutoRunClock(Date.now());
      const authority = res.data.orderAuthority;
      if (authority && !authority.authorized) {
        message.warning(agentText(
          `The research cycle is running, but broker orders are locked: ${authority.message}`,
          `研究流程已启动，但自动买卖仍被锁定：${authority.code === 'live_auto_not_enabled' ? '请先开启实盘自动交易授权。' : '需要使用完整 AI 模式。'}`,
        ));
      } else {
        message.success(agentText('The seven-stage cycle is running in the background.', '七阶段流程已在后台运行。'));
      }
      fetchPipelineAutoStatus();
    } catch (e: any) {
      console.log('[AutoPipelineNow] failed: %s', e.message);
      message.error(agentErrorText(
        e?.response?.data?.message || e?.message,
        'Could not start the automated pipeline.',
        '无法启动自动化流水线，请检查连接后重试。',
      ));
    } finally {
      runAutoNowInFlightRef.current = false;
      setPipelineAutoLoading(false);
    }
  };

  const confirmRunAutoNow = () => {
    const canSubmitOrders = pipelineMode === 'ai' && (
      tradeMode === 'paper' || (tradeMode === 'real' && liveAutoTradingEnabled)
    );
    Modal.confirm({
      title: agentText('Run one complete cycle?', '运行一次完整流程？'),
      content: (
        <div className="agent-confirm-content">
          <div>{agentText('All seven stages will run once in the background. This uses the active account and saved settings.', '系统会使用当前账户和已保存设置，在后台依次运行全部七个阶段。')}</div>
          <div className={canSubmitOrders ? (tradeMode === 'real' ? 'is-risk' : 'is-paper') : 'is-review'}>
            {canSubmitOrders
              ? tradeMode === 'real'
                ? agentText('Full AI and live authorization are active. Eligible live limit orders may be submitted.', '完整 AI 与实盘授权已启用，符合条件的实盘限价单可能会被提交。')
                : agentText('Full AI is active. Eligible paper limit orders may be submitted.', '完整 AI 已启用，符合条件的模拟限价单可能会被提交。')
              : agentText('The current mode will not submit orders automatically.', '当前模式不会自动提交订单。')}
          </div>
        </div>
      ),
      okText: canSubmitOrders ? agentText('Run complete cycle', '运行完整流程') : agentText('Run research cycle', '运行研究流程'),
      cancelText: agentText('Cancel', '取消'),
      okButtonProps: { type: 'primary' },
      className: 'agent-confirm-dialog',
      rootClassName: 'agent-confirm-modal',
      onOk: handleRunAutoNow,
    });
  };

  const runAIPipeline = async (opts?: { trigger?: string }) => {
    if (autoRunActive) {
      console.log('[PipelineUI] early return reason=background_auto_run_active');
      message.warning(agentText('A background cycle is already running. Wait for it to finish or stop it first.', '后台流程正在运行，请等待完成或先停止它。'));
      return;
    }
    if (isAnyScanRunning) {
      console.log('[PipelineUI] early return before start reason=isAnyScanRunning pipelineRunning=%s', pipelineRunning);
      message.warning(t.agent.scanAlreadyRunning);
      return;
    }

    const runTrigger = opts?.trigger || 'manual';
    setPipelineRunning(true);
    setPipelineError(null);
    setPipelineStage(agentText('Market Scanner', '市场扫描'));
    pipelineStopRequestedRef.current = false;
    scannerStateStore.resetMarketScanner();
    scannerStateStore.resetFineScan();
    scannerStateStore.resetDeeperValidation();
    scannerStateStore.resetAdmission();
    scannerStateStore.resetEntryPlan();
    scannerStateStore.resetExitScan();
    scannerStateStore.updateMarketScanner({
      status: 'running' as const,
      progress: 0,
      totalSymbols: 0,
      scannedSymbols: 0,
      detailedScanStatus: {
        currentStatus: 'scanning' as const,
        processedCount: 0,
        totalCount: 0,
        percent: 0,
        activeSymbols: [],
        retryCount: 0,
        validatedCount: 0,
        failedCount: 0,
        lastFailureReason: '',
        lastScanAt: null,
        nextScanAt: null,
        statusMessage: 'Starting unified backend pipeline...',
      },
    });

    try {
      const startResponse = await pipelineAutoAPI.runPipeline({
        trigger: runTrigger,
        mode: pipelineMode,
        intervalMinutes: 0,
        riskProfile,
        timeHorizon,
        tradeMode,
        leverageEnabled,
      });
      if (!startResponse?.data?.success || !startResponse.data.runId) {
        throw new Error(startResponse?.data?.message || 'Unable to start the unified pipeline');
      }
      const runId = startResponse.data.runId;
      const stageLabels: Record<string, string> = {
        market_scanner: agentText('Market Scanner', '市场扫描'),
        fine_scan: agentText('Fine Scan', '精细扫描'),
        deeper_validation: agentText('Deeper Validation', '深度验证'),
        admission: agentText('Portfolio Admission', '组合准入'),
        entry_plan: agentText('Entry Plan', '入场计划'),
        execution: agentText('Execution', '订单执行'),
        exit_scan: agentText('Position & Exit', '持仓与退出'),
      };
      const startedAt = Date.now();
      let terminalStatus = '';
      let terminalError = '';

      while (!terminalStatus) {
        if (Date.now() - startedAt > 35 * 60 * 1000) {
          throw new Error('Pipeline exceeded the 35 minute client monitoring window');
        }
        const statusResponse = await pipelineAutoAPI.getStatus();
        const active = statusResponse?.data?.activeRun;
        if (active?.runId === runId) {
          const key = active.currentStep || 'market_scanner';
          const step = active.steps?.[key] || {};
          const stageLabel = stageLabels[key] || key;
          setPipelineStage(stageLabel);

          if (key === 'market_scanner') {
            const processed = Number(step.processedSymbols ?? step.processed ?? 0);
            const total = Number(step.totalSymbols ?? step.total ?? 0);
            const percent = Number(step.progressPct ?? (total > 0 ? Math.round(processed / total * 100) : 0));
            const current = scannerStateStore.getState().marketScanner.detailedScanStatus;
            scannerStateStore.updateMarketScanner({
              status: active.status === 'running' ? 'running' : active.status === 'completed' ? 'completed' : 'failed',
              progress: percent,
              totalSymbols: total,
              scannedSymbols: processed,
              detailedScanStatus: {
                ...current,
                currentStatus: active.status === 'running' ? 'scanning' : active.status === 'completed' ? 'completed' : 'error',
                currentStage: key,
                stageLabel,
                stageIndex: active.stepIndex,
                stageCount: active.totalSteps,
                processedCount: processed,
                totalCount: total,
                percent,
                statusMessage: isZh
                  ? `${stageLabel}进行中`
                  : active.message || 'Market scan running',
              },
            });
          } else if (key === 'fine_scan') {
            scannerStateStore.updateFineScan({ status: active.status === 'running' ? 'running' : 'completed', progress: Number(active.progressPct || 0), message: active.message || '' });
          } else if (key === 'deeper_validation') {
            scannerStateStore.updateDeeperValidation({ status: active.status === 'running' ? 'loading' : 'completed', runId });
          } else if (key === 'admission') {
            scannerStateStore.updateAdmission({ status: active.status === 'running' ? 'loading' : 'completed', runId });
          } else if (key === 'entry_plan') {
            scannerStateStore.updateEntryPlan({ status: active.status === 'running' ? 'loading' : 'completed', runId });
          } else if (key === 'exit_scan') {
            scannerStateStore.updateExitScan({ status: active.status === 'running' ? 'scanning' : 'completed', runId });
          }

          if (['completed', 'failed', 'stopped', 'interrupted'].includes(active.status)) {
            terminalStatus = active.status;
            terminalError = active.lastError || active.message || '';
            break;
          }
        }
        await new Promise(resolve => window.setTimeout(resolve, 1500));
      }

      if (terminalStatus !== 'completed') {
        throw new Error(terminalStatus === 'stopped' ? 'STOPPED' : terminalError || `Pipeline ${terminalStatus}`);
      }

      let pipelineResult: any = null;
      for (let attempt = 0; attempt < 8 && !pipelineResult; attempt += 1) {
        try {
          const resultResponse = await pipelineAutoAPI.getPipelineResult(runId, 'manual');
          pipelineResult = resultResponse?.data?.result;
        } catch {
          await new Promise(resolve => window.setTimeout(resolve, 500));
        }
      }
      if (!pipelineResult) throw new Error('Pipeline completed but its result snapshot is unavailable');

      const marketRows = pipelineResult.market_scanner?.results || [];
      const fineRows = pipelineResult.fine_scan?.results || [];
      const dvRows = pipelineResult.deeper_validation?.results || [];
      const admissionRows = pipelineResult.admission?.results || [];
      const entryRows = pipelineResult.entry_plan?.results || [];
      const executionRows = pipelineResult.execution?.results || [];
      const exitRows = pipelineResult.exit_scan?.results || [];
      const completedAt = new Date().toISOString();
      scannerStateStore.updateMarketScanner({
        status: 'completed', progress: 100, results: marketRows,
        scannedSymbols: pipelineResult.market_scanner?.processed || marketRows.length,
        totalSymbols: pipelineResult.market_scanner?.processed || marketRows.length,
        lastScanTime: completedAt,
        detailedScanStatus: {
          ...scannerStateStore.getState().marketScanner.detailedScanStatus,
          currentStatus: 'completed', processedCount: marketRows.length,
          totalCount: pipelineResult.market_scanner?.processed || marketRows.length,
          percent: 100, validatedCount: marketRows.length,
          statusMessage: agentText('Unified pipeline market scan completed', '统一流水线的市场扫描已完成'),
        },
      });
      scannerStateStore.updateFineScan({ status: 'completed', progress: 100, stepProgress: 100, results: fineRows, runId, lastUpdated: completedAt });
      scannerStateStore.updateDeeperValidation({ status: 'completed', results: dvRows, runId, lastUpdated: completedAt });
      scannerStateStore.updateAdmission({ status: 'completed', results: admissionRows, summary: pipelineResult.summary?.admission_stats || null, runId, lastUpdated: completedAt });
      scannerStateStore.updateEntryPlan({ status: 'completed', results: entryRows, runId, lastUpdated: completedAt });
      scannerStateStore.updateExitScan({ status: 'completed', results: exitRows, runId, lastUpdated: completedAt });
      if (executionRows.length > 0) {
        setAiExecutionList((previous) => {
          const bySymbol = new Map(previous.map((item: any) => [String(item.symbol || '').toUpperCase(), item]));
          for (const row of executionRows) {
            const symbol = String(row?.symbol || '').toUpperCase();
            if (!symbol) continue;
            const submitted = row?.action === 'ORDER_SUBMITTED';
            const existing = bySymbol.get(symbol) || {};
            bySymbol.set(symbol, {
              ...existing,
              symbol,
              source: 'backend-pipeline',
              executionStatus: submitted ? 'submitted' : row?.status === 'dry_run' ? 'dry_run' : 'blocked',
              executionError: submitted ? null : agentErrorText(
                row?.reason || row?.message,
                'The execution gate did not submit an order.',
                '执行闸门未提交订单，请检查风控与订单条件。',
              ),
              alpacaOrderId: row?.orderId || row?.order?.id,
              alpacaOrderStatus: row?.orderStatus || row?.order?.status,
              pipelineRunId: runId,
            });
          }
          return Array.from(bySymbol.values());
        });
      }
      setPipelineStage('idle');
      message.success(agentText('The research pipeline is complete.', '研究流水线已完成。'));
    } catch (e: any) {
      if (e.message === 'STOPPED') {
        setPipelineStage('idle');
        message.info(agentText('The pipeline was stopped.', '流水线已停止。'));
      } else {
        const msg = agentErrorText(
          e?.response?.data?.message || e?.message,
          'The research pipeline failed.',
          '研究流水线运行失败，请检查连接后重试。',
        );
        setPipelineError(msg);
        setPipelineStage('failed');
        message.error(msg);
      }
    } finally {
      setPipelineRunning(false);
      fetchPipelineAutoStatus();
    }
  };

  const stopPipeline = () => {
    pipelineStopRequestedRef.current = true;
    pipelineAutoAPI.stopPipeline().catch(() => {});
  };

  // Keep scanner timing UI in sync. Account-scoped persistence happens only
  // after an explicit save or a durable backend sync, never on account switch.
  useEffect(() => {
    scannerStateStore.updatePipelineSchedule({ intervalKey: pipelineSchedule });
  }, [pipelineSchedule]);

  const selectValidationCandidates = useCallback(() => {
    if (!fineScanResults || fineScanResults.length === 0) return [];
    // Continue → always qualify; Watch → qualify if no critical blockers and score >= 50
    const qualified: any[] = [];
    for (const r of fineScanResults) {
      if (r.scanStatus !== 'completed') continue;
      if (r.decision === 'Continue') {
        qualified.push({ ...r, selectedBy: 'Continue' });
      } else if (r.decision === 'Watch') {
        const hasCriticalBlocker = (r.decisionBlockers || []).some((b: string) =>
          /bankruptcy|delisted|halted|fraud/i.test(b)
        );
        if (!hasCriticalBlocker && (r.matchConfidence || 0) >= 50) {
          qualified.push({ ...r, selectedBy: 'Watch-to-Validate' });
        }
      }
    }
    // Sort: Continue first, then by score descending, limit to a compact DV basket.
    qualified.sort((a: any, b: any) => {
      if (a.selectedBy !== b.selectedBy) return a.selectedBy === 'Continue' ? -1 : 1;
      return (b.matchConfidence || 0) - (a.matchConfidence || 0);
    });
    return qualified.slice(0, 12);
  }, [fineScanResults]);

  // Breakdown counts for display
  const validationCandidateBreakdown = useCallback(() => {
    const candidates = selectValidationCandidates();
    const continueCount = candidates.filter((c: any) => c.selectedBy === 'Continue').length;
    const watchCount = candidates.filter((c: any) => c.selectedBy === 'Watch-to-Validate').length;
    return { total: candidates.length, continueCount, watchCount };
  }, [selectValidationCandidates]);

  const handleDeeperValidation = async () => {
    if (pipelineRunning) {
      message.warning(agentText('This action is unavailable while the AI pipeline is running.', 'AI 流水线运行期间无法执行此操作。'));
      return;
    }
    const selected = selectValidationCandidates();
    if (selected.length === 0) {
      message.warning(t.agent.noFineScanCandidates);
      return;
    }
    // Register with runner service so isDeeperValidationRunning() returns true during route changes
    const dvPromise = _runDeeperValidationLoop(selected);
    registerDeeperValidationRun(dvPromise);
    await dvPromise;
  };

  const _runDeeperValidationLoop = async (selected: any[]): Promise<any[]> => {
    let _result: any[] = [];
    let dvProgressTimer: number | undefined;
    setDeeperValidationStatus('loading');
    setDeeperValidationResults(null);
    scannerStateStore.resetAdmission();
    setEntryPlanStatus('idle');
    setEntryPlanResults(null);
    setExitScanStatus('idle');
    setExitScanResults([]);
    setDvErrorMessage(null);
    setDvProgress(5);
    setDvProgressStage(agentText('Preflight', '运行前检查'));

    // Preflight: check session and optional provider availability.
    // DV can still run on institutional local rules when AI/config status is unavailable.
    const preflight = await preflightConfigCheck();
    if (!preflight.ok || !preflight.sessionValid) {
      setDeeperValidationStatus('error');
      setDvErrorMessage(agentErrorText(
        preflight.error,
        'Your session has expired.',
        '登录状态已过期，请重新登录。',
      ));
      unregisterDeeperValidationRun();
      message.error(agentErrorText(
        preflight.error,
        'Your session has expired.',
        '登录状态已过期，请重新登录。',
      ));
      return _result;
    }
    const aiOverlayEnabled = !!(preflight.aiConfigured && !preflight.aiKeyIsMasked);
    if (!preflight.alpacaConfigured) {
      setDvProgressStage(agentText('Configuration warning; trying backend market data', '配置提示：正在尝试后端行情数据'));
    } else if (!aiOverlayEnabled) {
      setDvProgressStage(agentText('Local rules mode', '本地规则模式'));
    } else if (!preflight.aiAvailable) {
      setDvProgressStage(agentText('AI configured; verifying provider', 'AI 已配置，正在验证服务连接'));
    }

    try {
      setDvProgress(18);
      setDvProgressStage(aiOverlayEnabled
        ? agentText('Building evidence packet', '正在构建证据包')
        : agentText('Building evidence packet (local rules)', '正在使用本地规则构建证据包'));
      const candidates = selected.map((r: any) => {
        // Map strategies to backend-friendly names
        const strats = r.matchedStrategies || [];
        const stack = Array.isArray(r.strategyStack) && r.strategyStack.length > 0
          ? r.strategyStack
          : (r.bestStrategy ? [r.bestStrategy] : []);
        const strategy = r.bestStrategy || stack[0] || 'moving_average';
        return {
          ...r,
          symbol: r.symbol,
          decision: r.decision,
          selectedBy: r.selectedBy || 'Continue',
          score: r.matchConfidence || 0,
          strategy: strategy,
          bestStrategy: r.bestStrategy || strategy,
          strategyStack: stack,
          matchedStrategies: strats,
          backtestStatus: r.backtestStatus || '',
          optimizationStatus: r.quickOptStatus || '',
          entryQuality: r.entryQuality || '',
          liquidityGrade: r.liquidityGrade || '',
          riskGrade: r.riskGrade || '',
          whyMatched: r.matchReason || '',
          decisionReason: r.decisionReason || r.finalReason || '',
        };
      });
      setDvProgress(35);
      setDvProgressStage(agentText('Loading two-year evidence', '正在加载两年期证据'));
      let estimatedProgress = 35;
      dvProgressTimer = window.setInterval(() => {
        estimatedProgress = Math.min(82, estimatedProgress + (estimatedProgress < 60 ? 3 : 2));
        setDvProgress(estimatedProgress);
        if (estimatedProgress < 46) setDvProgressStage(agentText('Loading two-year evidence', '正在加载两年期证据'));
        else if (estimatedProgress < 57) setDvProgressStage(agentText('Testing strategy routes', '正在测试策略路线'));
        else if (estimatedProgress < 68) setDvProgressStage(agentText('Checking parameter robustness', '正在检查参数稳健性'));
        else if (estimatedProgress < 77) setDvProgressStage(agentText('Running anchored walk-forward', '正在运行锚定式滚动验证'));
        else setDvProgressStage(aiOverlayEnabled
          ? agentText('Applying cost gates and AI challenge', '正在应用成本闸门与 AI 质疑')
          : agentText('Applying cost and risk gates', '正在应用成本与风险闸门'));
      }, 3000);
      const resp = (await deeperValidationAPI.validate(candidates, '2y', 100000, {
        riskProfile,
        timeHorizon,
        pipelineMode,
        tradeMode,
        validateAllStrategies: false,
        strategySelectionMode: 'trend_aware',
        maxStrategiesPerSymbol: 6,
        skipAiOverlay: !aiOverlayEnabled,
        aiOptional: true,
      })).data;
      if (dvProgressTimer !== undefined) window.clearInterval(dvProgressTimer);
      setDvProgress(88);
      setDvProgressStage(agentText('Ranking results', '正在排列验证结果'));
      if (resp.success && Array.isArray(resp.results)) {
        // Propagate isDevTest flag and selectedBy from Fine Scan results to DV results
        const devTestSymbols = new Set(selected.filter((r: any) => r.isDevTest).map((r: any) => r.symbol));
        const selectedByMap = new Map(selected.map((r: any) => [r.symbol, r.selectedBy || 'Continue']));
        const enrichedResults = resp.results.map((r: any) => ({
          ...r,
          isDevTest: devTestSymbols.has(r.symbol) || r.isDevTest || false,
          selectedBy: selectedByMap.get(r.symbol) || 'Continue',
        }));
        setDeeperValidationResults(enrichedResults);
        _result = enrichedResults;
        setDvErrors(resp.errors || []);

        const dvStatus = resp.status || 'completed';
        const failedCount = resp.summary?.failed || resp.errors?.length || 0;

        if (dvStatus === 'failed') {
          setDeeperValidationStatus('error');
          const failReasons = (resp.errors || []).map((e: any) => `${e.symbol}: ${e.message}`).join('; ');
          setDvErrorMessage(agentText(
            `All ${resp.results.length} symbols failed. ${failReasons || 'Check Alpaca Market Data configuration.'}`,
            `全部 ${resp.results.length} 个标的均未通过验证，请检查行情连接与数据完整性。`,
          ));
          message.error(agentText('Validation failed for every symbol.', '所有标的验证失败。'));
        } else if (dvStatus === 'partial') {
          setDeeperValidationStatus('completed');
          setDvErrorMessage(null);
          message.warning(agentText(
            `Validation finished with mixed results: ${resp.results.length - failedCount} succeeded and ${failedCount} failed.`,
            `验证部分完成：${resp.results.length - failedCount} 个成功，${failedCount} 个失败。`,
          ));
        } else {
          setDeeperValidationStatus('completed');
          setDvErrorMessage(null);
          message.success(agentText(`Deeper validation completed for ${resp.results.length} results.`, `深度验证完成，共 ${resp.results.length} 条结果。`));
        }
        setDvProgress(100);
        setDvProgressStage(agentText('Completed', '已完成'));
        unregisterDeeperValidationRun();
      } else {
        setDeeperValidationStatus('error');
        setDvErrorMessage(agentErrorText(
          resp.message,
          'Validation returned no results.',
          '验证未返回有效结果，请检查数据后重试。',
        ));
        setDvErrors([]);
        setDvProgressStage(agentText('Error', '发生错误'));
        unregisterDeeperValidationRun();
        message.error(agentErrorText(
          resp.message,
          'Validation returned no results.',
          '验证未返回有效结果，请检查数据后重试。',
        ));
      }
    } catch (err: any) {
      if (dvProgressTimer !== undefined) window.clearInterval(dvProgressTimer);
      const httpStatus = err.response?.status;
      const backendSkipRetry = err.response?.data?.skipRetry;
      const isConfigError = backendSkipRetry || httpStatus === 401 || httpStatus === 403;
      const isRateLimit = httpStatus === 429;

      if (isRateLimit) {
        // 429: retry once with backoff
        console.warn('[DeeperValidation] Rate limited (429), retrying after delay...');
        setDvProgress(42);
        setDvProgressStage(agentText('Rate limited; retrying', '请求频率受限，正在重试'));
        await new Promise(resolve => setTimeout(resolve, 5000));
        try {
          const resp = (await deeperValidationAPI.validate(
            selected.map((r: any) => ({
              ...r, symbol: r.symbol, decision: r.decision, selectedBy: r.selectedBy || 'Continue',
              score: r.matchConfidence || 0, strategy: r.bestStrategy || (r.strategyStack || [])[0] || 'moving_average',
              bestStrategy: r.bestStrategy || (r.strategyStack || [])[0] || 'moving_average',
              strategyStack: r.strategyStack || [],
              matchedStrategies: r.matchedStrategies || [],
              backtestStatus: r.backtestStatus || '', optimizationStatus: r.quickOptStatus || '',
              entryQuality: r.entryQuality || '', liquidityGrade: r.liquidityGrade || '',
              riskGrade: r.riskGrade || '', whyMatched: r.matchReason || '',
              decisionReason: r.decisionReason || r.finalReason || '',
            })), '2y', 100000, {
              riskProfile,
              timeHorizon,
              pipelineMode,
              tradeMode,
              validateAllStrategies: false,
              strategySelectionMode: 'trend_aware',
              maxStrategiesPerSymbol: 6,
              skipAiOverlay: !aiOverlayEnabled,
              aiOptional: true,
            }
          )).data;
          if (resp.success && Array.isArray(resp.results)) {
            const devTestSymbols = new Set(selected.filter((r: any) => r.isDevTest).map((r: any) => r.symbol));
            const selectedByMap = new Map(selected.map((r: any) => [r.symbol, r.selectedBy || 'Continue']));
            const enrichedResults = resp.results.map((r: any) => ({
              ...r, isDevTest: devTestSymbols.has(r.symbol) || r.isDevTest || false,
              selectedBy: selectedByMap.get(r.symbol) || 'Continue',
            }));
            setDeeperValidationResults(enrichedResults);
            _result = enrichedResults;
            setDvErrors(resp.errors || []);

            const dvStatus = resp.status || 'completed';
            const failedCount = resp.summary?.failed || resp.errors?.length || 0;

            if (dvStatus === 'failed') {
              setDeeperValidationStatus('error');
              const failReasons = (resp.errors || []).map((e: any) => `${e.symbol}: ${e.message}`).join('; ');
              setDvErrorMessage(agentText(
                `All ${resp.results.length} symbols failed. ${failReasons || 'Check Alpaca Market Data configuration.'}`,
                `全部 ${resp.results.length} 个标的均未通过验证，请检查行情连接与数据完整性。`,
              ));
              message.error(agentText('Validation failed for every symbol.', '所有标的验证失败。'));
            } else if (dvStatus === 'partial') {
              setDeeperValidationStatus('completed');
              setDvErrorMessage(null);
              message.warning(agentText(
                `Validation finished with mixed results: ${resp.results.length - failedCount} succeeded and ${failedCount} failed.`,
                `验证部分完成：${resp.results.length - failedCount} 个成功，${failedCount} 个失败。`,
              ));
            } else {
              setDeeperValidationStatus('completed');
              setDvErrorMessage(null);
              message.success(agentText(`Deeper validation completed for ${resp.results.length} results.`, `深度验证完成，共 ${resp.results.length} 条结果。`));
            }
            setDvProgress(100);
            setDvProgressStage(agentText('Completed', '已完成'));
            unregisterDeeperValidationRun();
            return _result;
          }
        } catch (retryErr: any) {
          console.error('[DeeperValidation] Retry also failed:', retryErr.message);
        }
      }

      const dvHttpStatus = err.response?.status;
      const backendMsg = err.response?.data?.message || err.response?.data?.error;
      const backendErrors = err.response?.data?.errors || [];
      const isTimeout = err.code === 'ECONNABORTED' || (err.message || '').includes('timeout');
      const errSymbols = selected.map((r: any) => r.symbol);
      const errDetail = backendErrors.length > 0
        ? backendErrors.slice(0, 3).map((e: any) => `${e.symbol||''}: ${e.message||e}`).join('; ') + (backendErrors.length > 3 ? ` (+${backendErrors.length - 3} more)` : '')
        : '';
      const englishError = isConfigError
        ? `Config error (HTTP ${dvHttpStatus || '?'}): ${backendMsg || 'Check AI Provider settings.'}`
        : isRateLimit
          ? `Rate Limited (429)${errDetail ? ` — ${errDetail}` : ''}. Backend API throttled. Retry will happen next interval.`
          : isTimeout
            ? `Timed out${errDetail ? ` — ${errDetail}` : ''}. Try fewer symbols or retry.`
            : `HTTP ${dvHttpStatus || '?'}: ${backendMsg || err.message || 'Unknown error'}${errDetail ? ` — ${errDetail}` : ''} [${errSymbols.slice(0, 5).join(', ')}${errSymbols.length > 5 ? '...' : ''}]`;
      const chineseError = isConfigError
        ? '验证服务配置不可用，请在设置中检查连接。'
        : isRateLimit
          ? '请求频率受限，系统稍后会自动重试。'
          : isTimeout
            ? '深度验证超时，请减少候选数量或稍后重试。'
            : `深度验证失败，涉及 ${errSymbols.length} 个候选标的。请检查数据连接后重试。`;
      const errMsg = agentErrorText(backendMsg || err.message, englishError, chineseError);
      setDeeperValidationStatus('error');
      setDvErrorMessage(errMsg);
      setDvErrors(backendErrors);
      setDvProgressStage(agentText('Error', '发生错误'));
      unregisterDeeperValidationRun();
      message.error(errMsg);
    }
    return _result;
  };


// ===== Deeper Validation Detail Panel =====


  const displayedMarketScannerResults = getFilteredAndSortedResults();
  
  
  
  
  
  
  
  
  const scannerProgressSteps = [
    { key: 'preflight', label: 'Preflight' },
    { key: 'universe', label: 'Universe' },
    { key: 'snapshots', label: 'Snapshots' },
    { key: 'history', label: 'History' },
    { key: 'factors', label: 'Factors' },
    { key: 'fundamentals', label: 'Fundamentals' },
    { key: 'events', label: 'Events' },
    { key: 'ai_review', label: 'AI Review' },
    { key: 'finalize', label: 'Finalize' },
  ];
  const scannerProgressPercent = Math.max(0, Math.min(100, Number(detailedScanStatus.percent || 0)));
  const scannerStageIndex = Math.max(0, Number(detailedScanStatus.stageIndex || 0));
  const scannerStageCount = Number(detailedScanStatus.stageCount || scannerProgressSteps.length);
  const scannerStageLabel = detailedScanStatus.stageLabel || (
    detailedScanStatus.currentStatus === 'completed' ? 'Complete' :
    detailedScanStatus.currentStatus === 'error' ? 'Error' :
    detailedScanStatus.currentStatus === 'stopped' ? 'Stopped' : 'Ready'
  );
  const scannerStageDetail = detailedScanStatus.stageDetail || detailedScanStatus.statusMessage || 'Ready to scan Alpaca whole-market universe';
  const scannerEtaLabel = detailedScanStatus.estimatedSecondsRemaining != null
    ? `${Math.ceil(Number(detailedScanStatus.estimatedSecondsRemaining) / 60)}m est.`
    : (detailedScanStatus.currentStatus === 'scanning' ? 'Waiting on providers' : '');
  const rawAutoRunRecord = pipelineAutoStatus?.activeRun;
  const autoRunRecord = rawAutoRunRecord
    && AUTO_PIPELINE_TRIGGERS.has(rawAutoRunRecord.trigger || '')
    && (!autoRunRequestedId || rawAutoRunRecord.runId === autoRunRequestedId)
      ? rawAutoRunRecord
      : null;
  const autoRunStages = Array.isArray(pipelineAutoStatus?.pipelineStages) && pipelineAutoStatus.pipelineStages.length
    ? pipelineAutoStatus.pipelineStages
    : AUTO_PIPELINE_STAGE_FALLBACK;
  const getAutoRunStageLabel = (stage: any): string => (
    agentConsoleCopy.stageLabels[String(stage?.key || '')] || String(stage?.label || agentConsoleCopy.pipeline)
  );
  const autoRunDisplayStatus = autoRunActive ? 'running' : (autoRunRecord?.status || 'idle');
  const autoRunStepStates = autoRunRecord?.steps || {};
  const autoRunCompletedStages = autoRunStages.filter((stage: any) => (
    ['completed', 'completed_no_candidates'].includes(autoRunStepStates?.[stage.key]?.status)
  )).length;
  const autoRunFailedStage = autoRunStages.find((stage: any) => autoRunStepStates?.[stage.key]?.status === 'failed')
    || (autoRunDisplayStatus === 'failed'
      ? [...autoRunStages].reverse().find((stage: any) => autoRunStepStates?.[stage.key]?.status === 'running')
        || autoRunStages[Math.max(0, Number(autoRunRecord?.stepIndex || 1) - 1)]
      : null);
  const autoRunComputedProgress = autoRunDisplayStatus === 'completed'
    ? 100
    : autoRunDisplayStatus === 'failed'
      ? Math.max(Number(autoRunRecord?.progressPct || 0), Math.round((autoRunCompletedStages / autoRunStages.length) * 100))
      : Math.max(0, Math.min(99, Number(autoRunRecord?.progressPct ?? autoRunProgress ?? 0)));
  const autoRunCurrentStepKey = autoRunFailedStage?.key || autoRunRecord?.currentStep || autoRunStep || (autoRunActive ? 'market_scanner' : '');
  const autoRunCurrentStage = autoRunStages.find((stage: any) => stage.key === autoRunCurrentStepKey);
  const autoRunCurrentStageIndex = autoRunStages.findIndex((stage: any) => stage.key === autoRunCurrentStepKey);
  const autoRunCurrentStepState = autoRunCurrentStepKey ? (autoRunStepStates?.[autoRunCurrentStepKey] || {}) : {};
  const autoRunCurrentStageProgress = Math.max(0, Math.min(100, Number(autoRunCurrentStepState?.progressPct || 0)));
  const autoRunStartedAtMs = autoRunRecord?.startedAt ? Date.parse(autoRunRecord.startedAt) : NaN;
  const autoRunFinishedAtMs = autoRunRecord?.finishedAt ? Date.parse(autoRunRecord.finishedAt) : NaN;
  const autoRunElapsedSeconds = Number.isFinite(autoRunStartedAtMs)
    ? Math.max(0, Math.floor(((autoRunActive ? autoRunClock : (Number.isFinite(autoRunFinishedAtMs) ? autoRunFinishedAtMs : autoRunClock)) - autoRunStartedAtMs) / 1000))
    : 0;
  const formatAutoRunDuration = (seconds: number): string => {
    const safeSeconds = Math.max(0, Math.round(Number(seconds || 0)));
    if (language === 'zh-CN') {
      if (safeSeconds >= 3600) return `${Math.floor(safeSeconds / 3600)} 小时 ${Math.floor((safeSeconds % 3600) / 60)} 分钟`;
      if (safeSeconds >= 60) return `${Math.floor(safeSeconds / 60)} 分 ${safeSeconds % 60} 秒`;
      return `${safeSeconds} 秒`;
    }
    if (safeSeconds >= 3600) return `${Math.floor(safeSeconds / 3600)}h ${Math.floor((safeSeconds % 3600) / 60)}m`;
    if (safeSeconds >= 60) return `${Math.floor(safeSeconds / 60)}m ${safeSeconds % 60}s`;
    return `${safeSeconds}s`;
  };
  const autoRunElapsedLabel = formatAutoRunDuration(autoRunElapsedSeconds);
  const getAutoRunStageDetail = (stageState: any, status: string): string => {
    const processed = Number(stageState?.processedSymbols ?? stageState?.processed ?? 0);
    const total = Number(stageState?.totalSymbols ?? stageState?.total ?? 0);
    const duration = Number(stageState?.durationSeconds || 0);
    if (status === 'running') {
      if (total > 0) return `${processed}/${total} · ${Math.max(0, Math.min(100, Number(stageState?.progressPct || 0)))}%`;
      return agentConsoleCopy.inProgress;
    }
    if (status === 'failed') return agentConsoleCopy.stoppedHere;
    if (status === 'stopped' || status === 'interrupted') return agentConsoleCopy.interrupted;
    if (status === 'completed_no_candidates') return duration > 0 ? `${agentConsoleCopy.noCandidates} · ${formatAutoRunDuration(duration)}` : agentConsoleCopy.noCandidates;
    if (status === 'partial') return duration > 0 ? `${agentConsoleCopy.partial} · ${formatAutoRunDuration(duration)}` : agentConsoleCopy.partialResult;
    if (status === 'completed') {
      if (duration > 0) return formatAutoRunDuration(duration);
      if (total > 0) return `${processed}/${total}`;
      return agentConsoleCopy.complete;
    }
    return agentConsoleCopy.queued;
  };
  const autoRunCurrentDetail = autoRunDisplayStatus === 'running'
    ? autoRunCurrentStepState?.currentSymbol
      ? `${getAutoRunStageLabel(autoRunCurrentStage)} · ${autoRunCurrentStepState.currentSymbol}`
      : autoRunCurrentStageProgress > 0
        ? `${getAutoRunStageLabel(autoRunCurrentStage)} · ${agentConsoleCopy.stageProgress(autoRunCurrentStageProgress)}`
        : language === 'zh-CN'
          ? `${getAutoRunStageLabel(autoRunCurrentStage)}正在初始化`
          : `${getAutoRunStageLabel(autoRunCurrentStage)} is initializing`
    : autoRunDisplayStatus === 'completed'
      ? agentConsoleCopy.allStagesCompleted(autoRunStages.length)
      : autoRunDisplayStatus === 'failed'
        ? agentConsoleCopy.stagesBeforeFailure(autoRunCompletedStages)
        : autoRunDisplayStatus === 'stopped' || autoRunDisplayStatus === 'interrupted'
          ? agentConsoleCopy.stagesBeforeStop(autoRunCompletedStages)
          : agentConsoleCopy.stagesReady;
  const autoRunLastSummary = pipelineAutoStatus?.lastAutoSummary || {};
  const autoRunLastCompletedAt = autoRunLastSummary?.completedAt || pipelineAutoStatus?.lastRunAt || null;
  const autoRunStatusLabel = pipelineSchedule === 'off'
    ? agentConsoleCopy.disabled
    : pipelineAutoStatus?.circuitBreakerOpen
      ? agentConsoleCopy.circuitOpen
      : autoRunActive
        ? agentConsoleCopy.cycleRunning
        : pipelineAutoStatus?.marketOpen
          ? agentConsoleCopy.armed
          : pipelineAutoStatus?.marketStage === 'premarket'
            ? agentConsoleCopy.premarketArmed
            : agentConsoleCopy.waitingForMarket;
  const autoRunNextLabel = pipelineSchedule === 'off'
    ? agentConsoleCopy.disabled
    : pipelineAutoStatus?.nextAutoRunAt
      ? new Date(pipelineAutoStatus.nextAutoRunAt).toLocaleString(
          language === 'zh-CN' ? 'zh-CN' : 'en-US',
          { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' }
        )
      : pipelineAutoStatus?.nextMarketOpenAt
        ? new Date(pipelineAutoStatus.nextMarketOpenAt).toLocaleString(
            language === 'zh-CN' ? 'zh-CN' : 'en-US',
            { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' }
          )
        : pipelineAutoStatus?.nextAutoRunDisplay || pipelineAutoStatus?.nextMarketOpenDisplay || agentConsoleCopy.pending;
  const discordPolicy = pipelineAutoStatus?.discordPolicy || {};
  return (
    <div className="ai-agent-page-container agent-workspace" id="ai-research-workspace">
      <style>{`
        .ai-agent-page-container { animation: fadeIn 0.25s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .premium-card { border-radius: 8px !important; border: 1px solid var(--app-border-soft) !important; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04) !important; transition: box-shadow 0.2s ease !important; }
        .premium-card:hover { box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06) !important; }
        .status-strip { background: var(--app-card-bg); border-radius: 8px; padding: 12px 20px; border: 1px solid var(--app-border-soft); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
        .stat-box { display: flex; flex-direction: column; gap: 4px; }
        .stat-label { font-size: 11px; color: var(--app-text-muted); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
        .stat-value { font-size: 14px; font-weight: 700; color: var(--app-text-strong); }
        .compact-table .ant-table-thead > tr > th { background: var(--app-table-header-bg) !important; font-size: 11px !important; text-transform: uppercase !important; letter-spacing: 0.3px !important; padding: 10px 8px !important; }
      `}</style>

      {/* ── Page Header ── */}
      <header className="agent-command-header">
        <div className="agent-command-title">
          <div className="agent-command-icon">
            <RobotOutlined />
          </div>
          <div>
            <span className="agent-command-kicker">{agentConsoleCopy.consoleKicker}</span>
            <Title level={1}>{t.agent.pageTitle}</Title>
            <Text type="secondary">{t.agent.pageSubtitle}</Text>
          </div>
        </div>
        <div className="agent-command-engine">
          <Tag
            color={pipelineAutoStatus?.schedulerRunning ? 'success' : 'warning'}
            bordered={false}
          >
            <span className="agent-engine-dot" />
            {pipelineAutoStatus?.schedulerRunning ? agentConsoleCopy.engineOnline : agentConsoleCopy.engineChecking}
          </Tag>
        </div>
      </header>

      <div className="agent-control-plane" role="status" aria-label={agentConsoleCopy.controlPlaneAria}>
        <div className="agent-control-plane-item">
          <span>{agentConsoleCopy.scheduler}</span>
          <b className={pipelineAutoStatus?.schedulerRunning ? 'is-ok' : 'is-warn'}>
            {pipelineAutoStatus?.schedulerRunning ? agentConsoleCopy.online : agentConsoleCopy.checking}
          </b>
          <small>{pipelineSchedule === 'off' ? agentConsoleCopy.manualOnly : agentConsoleCopy.every(pipelineSchedule)}</small>
        </div>
        <div className="agent-control-plane-item">
          <span>{agentConsoleCopy.market}</span>
          <b className={pipelineAutoStatus?.marketOpen ? 'is-ok' : 'is-neutral'}>
            {pipelineAutoStatus?.marketOpen ? agentConsoleCopy.open : (pipelineAutoStatus?.marketStatusRaw === 'holiday' ? agentConsoleCopy.holiday : agentConsoleCopy.closed)}
          </b>
          <small>{agentConsoleCopy.newYorkSession}</small>
        </div>
        <div className="agent-control-plane-item">
          <span>{agentConsoleCopy.orderAuthority}</span>
          <b className={tradeMode === 'real' && !liveAutoTradingEnabled ? 'is-warn' : 'is-ok'}>
            {tradeMode === 'paper' ? agentConsoleCopy.paperAuto : liveAutoTradingEnabled ? agentConsoleCopy.liveAuthorized : agentConsoleCopy.liveLocked}
          </b>
          <small>{pipelineMode === 'ai' ? agentConsoleCopy.fullAiMode : pipelineMode === 'hybrid' ? agentConsoleCopy.reviewRequired : agentConsoleCopy.noAutoOrders}</small>
        </div>
        <div className="agent-control-plane-item">
          <span>{agentConsoleCopy.notifications}</span>
          <b className={pipelineAutoStatus?.discordEnabled ? 'is-ok' : 'is-neutral'}>
            {pipelineAutoStatus?.discordEnabled ? agentConsoleCopy.discordOn : agentConsoleCopy.discordOff}
          </b>
          <small>{agentConsoleCopy.notificationScope}</small>
        </div>
        <div className="agent-control-plane-item">
          <span>{agentConsoleCopy.riskControls}</span>
          <b className={pipelineAutoStatus?.circuitBreakerOpen ? 'is-block' : 'is-ok'}>
            {pipelineAutoStatus?.circuitBreakerOpen ? agentConsoleCopy.circuitOpen : agentConsoleCopy.hardGatesActive}
          </b>
          <small>{pipelineAutoStatus?.positionGuard?.running ? agentConsoleCopy.checkingPositions : agentConsoleCopy.positionGuard(pipelineAutoStatus?.positionGuard?.intervalSeconds || 60)}</small>
        </div>
      </div>

      {/* 1. System Configuration & Status */}
      <div className="agent-config-strip">
        <div className="agent-config-items" style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t.agent.aiProvider}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--app-text-strong)' }}>{aiConfig.provider || t.agent.notSet}</span>
              <Tag color="blue" bordered={false} style={{ margin: 0, fontSize: 10, fontWeight: 700, borderRadius: 4 }}>V3</Tag>
            </div>
          </div>
          <Divider type="vertical" style={{ height: 28, margin: 0, opacity: 0.5 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t.agent.model}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--app-text-muted)' }}>{aiConfig.model || t.agent.notSet}</span>
          </div>
          <Divider type="vertical" style={{ height: 28, margin: 0, opacity: 0.5 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t.agent.aiStatus}</span>
            <div>
              {configStatus.loaded ? (
                configStatus.aiTestStatus === 'connected' ? <Tag color="success" style={{ margin: 0, borderRadius: 10, fontWeight: 700, fontSize: 10 }}>{t.agent.connected}</Tag> :
                configStatus.aiTestStatus === 'saved' ? <Tag color="warning" style={{ margin: 0, borderRadius: 10, fontWeight: 700, fontSize: 10 }}>{t.agent.notTested}</Tag> :
                configStatus.aiTestStatus === 'error' ? <Tag color="error" style={{ margin: 0, borderRadius: 10, fontWeight: 700, fontSize: 10 }}>{t.agent.error}</Tag> :
                configStatus.ai ? <Tag color="warning" style={{ margin: 0, borderRadius: 10, fontWeight: 700, fontSize: 10 }}>{t.agent.notTested}</Tag> :
                <Tag color="default" style={{ margin: 0, borderRadius: 10, fontWeight: 700, fontSize: 10 }}>{t.agent.notConfigured}</Tag>
              ) : <Spin size="small" />}
            </div>
          </div>
          <Divider type="vertical" style={{ height: 28, margin: 0, opacity: 0.5 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t.agent.marketData}</span>
            <div>
              {configStatus.loaded ? <Tag color="processing" style={{ margin: 0, borderRadius: 10, fontWeight: 700, fontSize: 10 }}>{t.agent.alpaca}</Tag> : <Spin size="small" />}
            </div>
          </div>
          <Divider type="vertical" style={{ height: 28, margin: 0, opacity: 0.5 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t.agent.trading}</span>
            <div>
              {configStatus.loaded ? (
                configStatus.alpaca ? (
                  <Tag color={tradeMode === 'real' ? 'error' : 'processing'} style={{ margin: 0, borderRadius: 10, fontWeight: 700, fontSize: 10 }}>
                    {tradeMode === 'real' ? t.agent.realTrading : t.agent.paperTrading}
                  </Tag>
                ) : (
                  <Tag color="default" style={{ margin: 0, borderRadius: 10, fontWeight: 700, fontSize: 10 }}>{t.agent.notLinked}</Tag>
                )
              ) : <Spin size="small" />}
            </div>
          </div>
        </div>
        <Button type="text" icon={<SettingOutlined />} onClick={() => navigate('/settings/configuration', { state: { returnTo: window.location.pathname } })} style={{ color: 'var(--app-text-muted)', fontWeight: 600, fontSize: 13, background: 'var(--app-card-bg-soft)', border: '1px solid var(--app-border)', borderRadius: 6, height: 32 }}>
          {t.agent.manageSettings}
        </Button>
      </div>

      <div className="agent-research-flow">
      <div className="agent-section-heading agent-operations-heading">
        <div>
          <span>{agentConsoleCopy.operations}</span>
          <h2>{agentConsoleCopy.automationControl}</h2>
        </div>
        <b>{tradeMode === 'paper' ? agentConsoleCopy.paperEnvironment : liveAutoTradingEnabled ? agentConsoleCopy.liveAuthorizedEnvironment : agentConsoleCopy.liveLockedEnvironment}</b>
      </div>

      {/* 1.5 Trading Account Mode */}
      <div className="agent-account-panel" id="research-account">
        <Card
          className="premium-card"
          styles={{ body: { padding: '20px 24px' } }}
          title={null}
        >
          <div className="agent-account-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="agent-account-heading" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--app-text-strong)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <WalletOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                {t.agent.tradingAccountMode}
              </span>
              <Tag color={tradeMode === 'paper' ? 'blue' : 'error'} bordered={false} style={{ fontSize: 11, fontWeight: 800, borderRadius: 4, margin: 0, padding: '2px 8px' }}>
                {tradeMode === 'paper' ? t.agent.paperTrading : t.agent.realTrading}
              </Tag>
              {tradeMode === 'real' && (
                <span style={{ fontSize: 12, color: '#faad14', display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(250, 173, 20, 0.1)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(250, 173, 20, 0.2)' }}>
                  <WarningOutlined />
                  {t.agent.tradingModeRealHint}
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: 'var(--app-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <InfoCircleOutlined style={{ color: '#1890ff' }} />
              {t.agent.tradingAccountDescNote}
            </div>
          </div>
          
          <div style={{ background: 'var(--app-card-bg-soft)', borderRadius: 8, padding: '16px', border: '1px solid var(--app-border-soft)' }}>
            {tradingAccountLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--app-text-muted)', height: 48 }}>
                <Spin indicator={<LoadingOutlined style={{ fontSize: 18 }} spin />} />
                <span style={{ fontWeight: 500 }}>{t.agent.syncAccountData}</span>
              </div>
            ) : tradingAccountData?.success ? (
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} xl={6}>
                  <div style={{ padding: '12px 16px', background: 'var(--app-card-bg)', borderRadius: 8, border: '1px solid var(--app-border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{t.agent.status}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: tradingAccountData.status === 'ACTIVE' ? '#52c41a' : '#faad14' }} />
                      <span style={{ fontWeight: 800, fontSize: 15, color: tradingAccountData.status === 'ACTIVE' ? 'var(--app-text-strong)' : '#faad14' }}>
                        {tradingAccountData.status || 'N/A'}
                      </span>
                    </div>
                  </div>
                </Col>
                <Col xs={24} sm={12} xl={6}>
                  <div style={{ padding: '12px 16px', background: 'var(--app-card-bg)', borderRadius: 8, border: '1px solid var(--app-border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{t.agent.portfolioValue}</span>
                    <span style={{ fontWeight: 800, fontSize: 18, color: '#1890ff', fontFamily: "'Inter', sans-serif", letterSpacing: 0 }}>
                      ${(tradingAccountData.portfolioValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </Col>
                <Col xs={24} sm={12} xl={6}>
                  <div style={{ padding: '12px 16px', background: 'var(--app-card-bg)', borderRadius: 8, border: '1px solid var(--app-border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{t.agent.cash}</span>
                    <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--app-text-strong)', fontFamily: "'Inter', sans-serif", letterSpacing: 0 }}>
                      ${(tradingAccountData.cash ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </Col>
                <Col xs={24} sm={12} xl={6}>
                  <div style={{ padding: '12px 16px', background: 'var(--app-card-bg)', borderRadius: 8, border: '1px solid var(--app-border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{t.agent.buyingPower}</span>
                    <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--app-text-strong)', fontFamily: "'Inter', sans-serif", letterSpacing: 0 }}>
                      ${(tradingAccountData.buyingPower ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </Col>
              </Row>
            ) : (
              <div style={{ color: 'var(--app-text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, height: 48 }}>
                {tradingAccountData?.error ? (
                  <><ExclamationCircleOutlined style={{ color: '#faad14' }} />{tradingAccountData.error}</>
                ) : (
                  <><InfoCircleOutlined /> {t.agent.noAccountData}</>
                )}
                <Tag style={{ marginLeft: 8, fontWeight: 600 }}>{t.agent.configureAlpaca}</Tag>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Market Auto Run — standalone background auto pipeline card */}
      <div className="agent-auto-panel" id="research-automation">
        <Card
          className="premium-card"
          styles={{ body: { padding: 0 } }}
          title={
            <div className="agent-auto-card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid var(--app-border-soft)' }}>
              <span className="agent-auto-card-heading" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--app-blue-bg)', color: '#1890ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, border: '1px solid rgba(24, 144, 255, 0.2)' }}>
                  <SyncOutlined />
                </div>
                <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--app-text-strong)', letterSpacing: 0 }}>{t.agent.marketAutoRun}</span>
                <Tag color={pipelineSchedule !== 'off' ? 'green' : 'default'} bordered={false} style={{ fontSize: 11, fontWeight: 800, borderRadius: 6, margin: 0, padding: '2px 8px' }}>
                  {pipelineSchedule !== 'off' ? agentConsoleCopy.on : agentConsoleCopy.off}
                </Tag>
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Switch
                  aria-label={agentText('Enable background market automation', '启用后台市场自动化')}
                  checked={pipelineSchedule !== 'off'}
                  loading={pipelineAutoLoading}
                  onChange={(checked) => {
                    if (checked) {
                      const defaultSchedule = pipelineSchedule === 'off' ? '15m' : pipelineSchedule;
                      setPipelineSchedule(defaultSchedule);
                      savePipelineAutoConfig(defaultSchedule);
                    } else {
                      setPipelineSchedule('off');
                      savePipelineAutoConfig('off');
                    }
                  }}
                />
              </div>
            </div>
          }
        >
          {/* Subtitle */}
          <div style={{ padding: '10px 20px', background: 'var(--app-card-bg-soft)', borderBottom: '1px solid var(--app-border-soft)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--app-text-muted)', fontSize: 12 }}>
              <InfoCircleOutlined style={{ color: '#1890ff', fontSize: 13 }} />
              <span style={{ fontWeight: 500 }}>{t.agent.marketAutoRunSubtitle}</span>
            </div>
          </div>

          <section className={`agent-full-cycle-progress is-${autoRunDisplayStatus}`} aria-label={agentConsoleCopy.runFullCycle}>
            <div className="agent-full-cycle-head">
              <div>
                <span className="agent-full-cycle-kicker">{agentConsoleCopy.runFullCycle}</span>
                <div className="agent-full-cycle-operation">
                  <strong>
                    {autoRunDisplayStatus === 'running'
                      ? (autoRunCurrentStage ? getAutoRunStageLabel(autoRunCurrentStage) : agentConsoleCopy.startingPipeline)
                      : autoRunDisplayStatus === 'completed'
                        ? agentConsoleCopy.cycleCompleted
                        : autoRunDisplayStatus === 'failed'
                          ? agentConsoleCopy.pipelineFailed(getAutoRunStageLabel(autoRunFailedStage))
                          : autoRunDisplayStatus === 'stopped' || autoRunDisplayStatus === 'interrupted'
                            ? agentConsoleCopy.cycleInterrupted
                            : agentConsoleCopy.ready}
                  </strong>
                  <Tag
                    bordered={false}
                    color={
                      autoRunDisplayStatus === 'running' ? 'processing' :
                      autoRunDisplayStatus === 'completed' ? 'success' :
                      autoRunDisplayStatus === 'failed' ? 'error' :
                      autoRunDisplayStatus === 'stopped' || autoRunDisplayStatus === 'interrupted' ? 'warning' : 'default'
                    }
                  >
                    {autoRunDisplayStatus === 'running' ? agentConsoleCopy.running :
                     autoRunDisplayStatus === 'completed' ? agentConsoleCopy.completed :
                     autoRunDisplayStatus === 'failed' ? agentConsoleCopy.failed :
                     autoRunDisplayStatus === 'stopped' || autoRunDisplayStatus === 'interrupted' ? agentConsoleCopy.stopped : agentConsoleCopy.idle}
                  </Tag>
                </div>
                <span className="agent-full-cycle-message">
                  {autoRunDisplayStatus === 'running'
                    ? autoRunRecord?.message || agentConsoleCopy.preparingPipeline
                    : autoRunDisplayStatus === 'failed'
                      ? autoRunRecord?.lastError || autoRunRecord?.message || agentConsoleCopy.cycleStoppedEarly
                      : autoRunDisplayStatus === 'completed'
                        ? autoRunRecord?.message || agentConsoleCopy.allStagesFinished
                        : agentConsoleCopy.readyForBackgroundRun}
                </span>
              </div>
              <div className="agent-full-cycle-metrics">
                <div className="agent-full-cycle-overall"><span>{agentConsoleCopy.overall}</span><b>{autoRunComputedProgress}%</b></div>
                <div><span>{agentConsoleCopy.currentStage}</span><b>{autoRunDisplayStatus === 'idle' ? '0' : Math.min(autoRunStages.length, Math.max(1, autoRunCurrentStageIndex + 1 || Number(autoRunRecord?.stepIndex || 1)))}/{autoRunStages.length}</b></div>
                <div><span>{agentConsoleCopy.elapsed}</span><b>{autoRunDisplayStatus === 'idle' ? '--' : autoRunElapsedLabel}</b></div>
              </div>
            </div>

            <div className="agent-full-cycle-rail-wrap">
              <div
                className="agent-full-cycle-rail"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={autoRunComputedProgress}
                aria-label={agentConsoleCopy.progressAria(autoRunComputedProgress)}
              >
                <span className="agent-full-cycle-rail-fill" style={{ width: `${autoRunComputedProgress}%` }} />
                {autoRunDisplayStatus === 'running' && autoRunComputedProgress > 0 && (
                  <i className="agent-full-cycle-rail-pulse" style={{ left: `${autoRunComputedProgress}%` }} aria-hidden="true" />
                )}
                <div className="agent-full-cycle-rail-markers" aria-hidden="true">
                  {autoRunStages.slice(1).map((stage: any, index: number) => (
                    <i key={stage.key} style={{ left: `${((index + 1) / autoRunStages.length) * 100}%` }} />
                  ))}
                </div>
              </div>
              <div className="agent-full-cycle-rail-meta">
                <span>{autoRunCurrentDetail}</span>
                <b>{agentConsoleCopy.completedCount(autoRunCompletedStages, autoRunStages.length)}</b>
              </div>
            </div>

            <div className="agent-full-cycle-stages">
              {autoRunStages.map((stage: any, index: number) => {
                const stageState = autoRunStepStates?.[stage.key] || {};
                const recordedStatus = autoRunFailedStage?.key === stage.key
                  ? 'failed'
                  : stageState?.status || 'pending';
                const stageStatus = autoRunActive && !autoRunRecord && index === 0 ? 'running' : recordedStatus;
                const completed = ['completed', 'completed_no_candidates'].includes(stageStatus);
                const partial = stageStatus === 'partial';
                const failed = stageStatus === 'failed';
                const running = stageStatus === 'running';
                const stopped = stageStatus === 'stopped' || stageStatus === 'interrupted';
                const stageProgress = completed || partial
                  ? 100
                  : Math.max(0, Math.min(100, Number(stageState?.progressPct || 0)));
                const visualStatus = failed ? 'failed' : stopped ? 'stopped' : partial ? 'partial' : completed ? 'completed' : running ? 'running' : 'pending';
                return (
                  <div
                    key={stage.key}
                    className={`agent-full-cycle-stage is-${visualStatus}`}
                    aria-current={running ? 'step' : undefined}
                  >
                    <span className="agent-full-cycle-stage-index">
                      {completed ? <CheckOutlined /> : failed ? <CloseCircleOutlined /> : stopped ? <PauseCircleOutlined /> : running ? <SyncOutlined spin /> : index + 1}
                    </span>
                    <span className="agent-full-cycle-stage-copy">
                      <strong>{getAutoRunStageLabel(stage)}</strong>
                      <small>{getAutoRunStageDetail(stageState, stageStatus)}</small>
                    </span>
                    <span className="agent-full-cycle-stage-bar" aria-hidden="true">
                      <i style={{ width: `${stageProgress}%` }} />
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="agent-auto-console">
            <div className="agent-auto-command">
              <div className="agent-auto-command-block agent-auto-schedule-control">
                <span className="agent-auto-command-label">{agentConsoleCopy.backgroundSchedule}</span>
                <Segmented
                  className="agent-auto-schedule-options"
                  value={pipelineSchedule}
                  disabled={pipelineAutoLoading}
                  onChange={(value) => savePipelineAutoConfig(value as 'off' | '15m' | '30m' | '1h' | '2h')}
                  options={[
                    { label: agentConsoleCopy.off, value: 'off' },
                    { label: '15m', value: '15m' },
                    { label: '30m', value: '30m' },
                    { label: '1h', value: '1h' },
                    { label: '2h', value: '2h' },
                  ]}
                />
                <small>{agentConsoleCopy.scheduleHelper}</small>
              </div>

              <div className="agent-auto-command-block agent-auto-authority">
                <span className="agent-auto-command-label">{agentConsoleCopy.orderAuthority}</span>
                <div>
                  <strong>
                    {tradeMode === 'paper'
                      ? agentConsoleCopy.paperAutomation
                      : liveAutoTradingEnabled
                        ? agentConsoleCopy.liveOrdersAuthorized
                        : agentConsoleCopy.liveOrdersLocked}
                  </strong>
                  {tradeMode === 'real' ? (
                    <Switch
                      aria-label={liveAutoCopy.switchLabel}
                      size="small"
                      checked={liveAutoTradingEnabled}
                      loading={pipelineAutoLoading}
                      onChange={handleLiveAutoTradingToggle}
                    />
                  ) : (
                    <Tag bordered={false} color="blue">{agentConsoleCopy.paper}</Tag>
                  )}
                </div>
                <small>
                  {liveAutoTradingEnabled
                    ? agentText('Authorization stays saved until you turn it off. Orders are active only in Real + Full AI.', '授权会一直保留，直到你手动关闭；只有实盘 + 全 AI 时才会实际生效。')
                    : pipelineMode === 'ai'
                      ? agentConsoleCopy.eligibleOrders
                      : agentConsoleCopy.fullAiRequired}
                </small>
              </div>

              <Tooltip title={agentConsoleCopy.runTooltip}>
                <Button
                  className="agent-auto-run-button"
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  onClick={confirmRunAutoNow}
                  disabled={pipelineRunning || autoRunActive || pipelineAutoLoading}
                  loading={pipelineAutoLoading}
                >
                  {autoRunActive ? agentConsoleCopy.fullCycleRunning : agentConsoleCopy.runFullCycle}
                </Button>
              </Tooltip>
            </div>

            <div className="agent-auto-disclosure">
              <InfoCircleOutlined />
              <span>
                <strong>{agentConsoleCopy.sevenStagesTitle}</strong>
                {agentConsoleCopy.sevenStagesDescription}
              </span>
            </div>

            <div className="agent-auto-facts">
              <div className="agent-auto-fact">
                <span>{agentConsoleCopy.automation}</span>
                <strong className={pipelineAutoStatus?.circuitBreakerOpen ? 'is-block' : pipelineSchedule === 'off' ? 'is-muted' : 'is-ok'}>
                  {autoRunStatusLabel}
                </strong>
                <small>{pipelineAutoStatus?.marketOpen ? agentConsoleCopy.newYorkSessionOpen : agentConsoleCopy.marketHoursGateActive}</small>
              </div>
              <div className="agent-auto-fact">
                <span>{agentConsoleCopy.lastCompleted}</span>
                <strong>
                  {autoRunLastCompletedAt
                    ? new Date(autoRunLastCompletedAt).toLocaleString(
                        language === 'zh-CN' ? 'zh-CN' : 'en-US',
                        { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
                      )
                    : agentConsoleCopy.noCompletedRun}
                </strong>
                <small>
                  {autoRunLastSummary?.durationSeconds
                    ? formatAutoRunDuration(Number(autoRunLastSummary.durationSeconds))
                    : agentConsoleCopy.awaitingFirstCycle}
                </small>
              </div>
              <div className="agent-auto-fact">
                <span>{agentConsoleCopy.nextEligibleRun}</span>
                <strong>{autoRunNextLabel}</strong>
                <small>{pipelineSchedule === 'off' ? agentConsoleCopy.enableSchedule : agentConsoleCopy.authoritativeSchedule}</small>
              </div>
              <div className="agent-auto-fact">
                <span>{agentConsoleCopy.runsToday}</span>
                <strong>{pipelineAutoStatus?.runCountToday || 0}</strong>
                <small>{pipelineAutoStatus?.schedulerRunning ? agentConsoleCopy.schedulerOnline : agentConsoleCopy.schedulerPending}</small>
              </div>
              <div className="agent-auto-fact">
                <span>{agentConsoleCopy.savedContext}</span>
                <strong>
                  {(pipelineAutoStatus?.mode || pipelineMode || 'hybrid').toUpperCase()}
                  {' / '}
                  {pipelineAutoStatus?.tradeMode === 'real' ? agentConsoleCopy.real : agentConsoleCopy.paperCode}
                </strong>
                <small>
                  {agentConsoleCopy.riskHorizon(
                    agentConsoleCopy.riskLabels[pipelineAutoStatus?.riskProfile || riskProfile || 'medium'] || pipelineAutoStatus?.riskProfile || riskProfile || 'medium',
                    agentConsoleCopy.horizonLabels[pipelineAutoStatus?.timeHorizon || timeHorizon || 'medium'] || pipelineAutoStatus?.timeHorizon || timeHorizon || 'medium'
                  )}
                </small>
              </div>
              <div className="agent-auto-fact">
                <span>{agentConsoleCopy.discordPolicy}</span>
                <strong className={pipelineAutoStatus?.discordEnabled ? 'is-ok' : 'is-muted'}>
                  {pipelineAutoStatus?.discordEnabled ? agentConsoleCopy.quietAlertsOn : agentConsoleCopy.off}
                </strong>
                <small>
                  {pipelineAutoStatus?.discordEnabled
                    ? [
                        discordPolicy.tradeActivity ? agentConsoleCopy.trades : null,
                        discordPolicy.recommendations ? agentConsoleCopy.recommendations : null,
                        discordPolicy.riskAlerts ? agentConsoleCopy.risk : null,
                        discordPolicy.cycleDigest ? agentConsoleCopy.digest : null,
                      ].filter(Boolean).join(' / ') || agentConsoleCopy.materialEventsOnly
                    : agentConsoleCopy.noWebhook}
                </small>
              </div>
            </div>

            {!autoRunActive && autoRunLastCompletedAt && (
              <div className="agent-auto-last-run">
                <div>
                  <span>{agentConsoleCopy.lastCycle}</span>
                  <strong>{
                    agentConsoleCopy.runStatusLabels[autoRunLastSummary?.status || pipelineAutoStatus?.lastBackendRunStatus || 'completed']
                    || autoRunLastSummary?.status
                    || pipelineAutoStatus?.lastBackendRunStatus
                    || agentConsoleCopy.completedFallback
                  }</strong>
                </div>
                <div>
                  <span>{agentConsoleCopy.scanner}</span>
                  <strong>{autoRunLastSummary?.scanned || 0}</strong>
                </div>
                <div>
                  <span>{agentConsoleCopy.aiReviewed}</span>
                  <strong>{autoRunLastSummary?.aiSuccess || 0}</strong>
                </div>
                <div>
                  <span>{agentConsoleCopy.entryPlans}</span>
                  <strong>{autoRunLastSummary?.entryPlanCount || 0}</strong>
                </div>
                <div>
                  <span>{agentConsoleCopy.positionsChecked}</span>
                  <strong>{autoRunLastSummary?.exitScanCount || 0}</strong>
                </div>
              </div>
            )}

            {(pipelineAutoStatus?.stoppedForToday || pipelineAutoStatus?.blockedForDay) && (
              <div className="agent-auto-notice">
                <WarningOutlined />
                <span>
                  {pipelineAutoStatus?.blockedForDay
                    ? t.agent.noTradingToday
                    : t.agent.stoppedForToday}
                </span>
              </div>
            )}

            <div className="agent-auto-expanders">
              <button
                type="button"
                className="agent-auto-expander"
                aria-expanded={pipelineAutoScheduleExpanded}
                onClick={() => setPipelineAutoScheduleExpanded(!pipelineAutoScheduleExpanded)}
                disabled={pipelineSchedule === 'off'}
              >
                {pipelineAutoScheduleExpanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
                <span>{agentConsoleCopy.marketCalendar}</span>
                <small>{pipelineSchedule === 'off' ? agentConsoleCopy.scheduleOff : agentConsoleCopy.next15Days}</small>
                {pipelineAutoScheduleLoading && <Spin size="small" />}
              </button>
              <button
                type="button"
                className="agent-auto-expander"
                aria-expanded={pipelineAutoHistoryExpanded}
                onClick={() => setPipelineAutoHistoryExpanded(!pipelineAutoHistoryExpanded)}
              >
                {pipelineAutoHistoryExpanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
                <span>{agentConsoleCopy.runHistory}</span>
                <small>{pipelineAutoHistory.length ? agentConsoleCopy.loaded(pipelineAutoHistory.length) : agentConsoleCopy.auditTrail}</small>
              </button>
            </div>

            {pipelineSchedule !== 'off' && pipelineAutoScheduleExpanded && (
              <div className="agent-auto-drawer" aria-label={agentConsoleCopy.marketCalendar}>
                {pipelineAutoScheduleError ? (
                  <div className="agent-auto-empty is-error">{pipelineAutoScheduleError}</div>
                ) : pipelineAutoSchedule?.length ? (
                  <>
                    <div className="agent-auto-list agent-auto-calendar-list">
                      {pipelineAutoSchedule.map((day: any) => {
                        const dayColor = day.status === 'open'
                          ? 'green'
                          : day.status === 'early_close'
                            ? 'gold'
                            : day.status === 'holiday'
                              ? 'red'
                              : 'default';
                        return (
                          <div className="agent-auto-list-row" key={day.date}>
                            <strong>{day.weekday?.slice(0, 3)} {day.date?.slice(5)}</strong>
                            <Tag bordered={false} color={dayColor}>
                              {agentConsoleCopy.calendarStatusLabels[day.status] || day.status || agentConsoleCopy.unknown}
                            </Tag>
                            <span>{day.openTime && day.closeTime ? day.openTime + '-' + day.closeTime : agentConsoleCopy.closed}</span>
                            <span className={day.autoRun ? 'is-ok' : 'is-muted'}>{day.autoRun ? agentConsoleCopy.scheduled : agentConsoleCopy.noRun}</span>
                            <small>{day.reason || (day.source === 'alpaca_calendar' ? agentConsoleCopy.calendarRowAlpaca : agentConsoleCopy.calendarRowFallback)}</small>
                          </div>
                        );
                      })}
                    </div>
                    <div className="agent-auto-source-note">
                      {agentConsoleCopy.source}: {pipelineAutoScheduleSource === 'alpaca_calendar' ? agentConsoleCopy.alpacaCalendar : agentConsoleCopy.fallbackCalendar}
                      {pipelineAutoScheduleWarning ? ' / ' + pipelineAutoScheduleWarning : ''}
                    </div>
                  </>
                ) : (
                  <div className="agent-auto-empty">
                    {pipelineAutoScheduleLoading ? agentConsoleCopy.loadingCalendar : agentConsoleCopy.noCalendarData}
                  </div>
                )}
              </div>
            )}

            {pipelineAutoHistoryExpanded && (
              <div className="agent-auto-drawer" aria-label={agentConsoleCopy.runHistory}>
                {pipelineAutoHistory.length ? (
                  <div className="agent-auto-list agent-auto-history-list">
                    {pipelineAutoHistory.map((entry: any, index: number) => (
                      <div className="agent-auto-list-row" key={entry.run_id || entry.id || index}>
                        <Tag
                          bordered={false}
                          color={
                            entry.status === 'success' ? 'green' :
                            entry.status === 'failed' ? 'red' :
                            entry.status === 'blocked' ? 'orange' : 'default'
                          }
                        >
                          {agentConsoleCopy.runStatusLabels[entry.status] || entry.status || agentConsoleCopy.unknown}
                        </Tag>
                        <strong>{entry.trigger_type || agentConsoleCopy.automatic}</strong>
                        <span>
                          {entry.started_at
                            ? new Date(entry.started_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : agentConsoleCopy.timeUnavailable}
                        </span>
                        <span>{entry.duration_seconds ? entry.duration_seconds + 's' : '--'}</span>
                        <small>{entry.reason || entry.error || agentConsoleCopy.completedWithoutException}</small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="agent-auto-empty">{agentConsoleCopy.noStoredCycles}</div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Portfolio Automation — one source of truth for scan, entry, exit and automation */}
      <section id="portfolio-mandate" className="agent-preferences-panel agent-mandate-panel" aria-labelledby="strategy-mandate-title">
        <header className="agent-mandate-header">
          <div>
            <span className="agent-mandate-kicker">02 / {agentText('TRADING POLICY', '交易策略')}</span>
            <h2 id="strategy-mandate-title">{agentText('Portfolio Automation', '投资组合自动化')}</h2>
            <p>{agentText('One operating policy for manual scans, Auto Pipeline, Market Auto Run, position sizing and exits.', '同一套策略会作用于手动扫描、自动流程、定时自动运行、仓位计算和退出规则。')}</p>
          </div>
          <div className="agent-mandate-summary">
            <span>{riskProfile.toUpperCase()} RISK</span>
            <strong>{strategyMandate.deploymentPct}%</strong>
            <small>{agentText('target capital deployed', '目标资金投入')}</small>
          </div>
        </header>

        <div className="agent-mandate-control-grid">
          <div className="agent-mandate-control">
            <div className="agent-mandate-control-title"><FundOutlined /><span>{t.agent.riskProfile}</span></div>
            <p>{agentText('Controls total exposure, position concentration and account loss limits.', '控制总仓位、单股集中度与账户止损。')}</p>
            <div className="agent-choice-grid">
              {([
                ['low', t.agent.lowRisk, '30%', agentText('Capital preservation', '保守稳定')],
                ['medium', t.agent.mediumRisk, '50%', agentText('Balanced growth', '均衡增长')],
                ['high', t.agent.highRisk, '100%', agentText('Aggressive growth', '激进增长')],
              ] as const).map(([value, label, metric, detail]) => (
                <button type="button" key={value} className={`agent-choice-card ${riskProfile === value ? 'is-selected' : ''}`} aria-pressed={riskProfile === value} onClick={() => handleRiskProfileChange(value)}>
                  <span>{label}</span><strong>{metric}</strong><small>{detail}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="agent-mandate-control">
            <div className="agent-mandate-control-title"><ClockCircleOutlined /><span>{t.agent.timeHorizon}</span></div>
            <p>{agentText('Changes factor weights, expected holding period, review cadence and time stop.', '改变因子权重、预计持有期、复核频率与时间止损。')}</p>
            <div className="agent-choice-grid">
              {([
                ['short', t.agent.shortTerm, '1–5D', agentText('Momentum', '短线动量')],
                ['mid', t.agent.midTerm, '2–8W', agentText('Balanced', '长短结合')],
                ['long', t.agent.longTerm, '3–12M', agentText('Durability', '长期质量')],
              ] as const).map(([value, label, metric, detail]) => (
                <button type="button" key={value} className={`agent-choice-card ${timeHorizon === value ? 'is-selected' : ''}`} aria-pressed={timeHorizon === value} onClick={() => handleTimeHorizonChange(value)}>
                  <span>{label}</span><strong>{metric}</strong><small>{detail}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="agent-mandate-control agent-mandate-ai-control">
            <div className="agent-mandate-control-title"><RobotOutlined /><span>{agentText('AI authority', 'AI 权限')}</span></div>
            <p>{agentText('Sets how far AI may progress from research to selection and order submission.', '设定 AI 从研究、筛选到提交订单可以参与到哪一步。')}</p>
            <div className="agent-choice-grid">
              {([
                ['manual', t.agent.modeManual, agentText('Review only', '仅供查看'), agentText('You decide', '全部由你决定')],
                ['hybrid', t.agent.modeHybrid, agentText('AI research', 'AI 研究'), agentText('Approval required', '下单需确认')],
                ['ai', t.agent.modeAI, agentText('Buy + add + sell', '买入 + 补仓 + 卖出'), agentText('Hard gates remain', '仍受硬风控')],
              ] as const).map(([value, label, metric, detail]) => (
                <button type="button" key={value} className={`agent-choice-card ${pipelineMode === value ? 'is-selected' : ''}`} aria-pressed={pipelineMode === value} onClick={() => handlePipelineModeChange(value)}>
                  <span>{label}</span><strong>{metric}</strong><small>{detail}</small>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="agent-mandate-facts">
          <div><span>{agentText('Gross exposure', '总敞口')}</span><strong>{strategyMandate.grossPct}%</strong><small>{agentText(`${strategyMandate.singlePct}% max per symbol`, `单一标的最高 ${strategyMandate.singlePct}%`)}</small></div>
          <div><span>{agentText('Risk budget', '风险预算')}</span><strong>{strategyMandate.riskPerTradePct}%</strong><small>{agentText(`${strategyMandate.dailyStopPct}% daily stop`, `单日止损 ${strategyMandate.dailyStopPct}%`)}</small></div>
          <div><span>{agentText('Holding mandate', '持有规则')}</span><strong>{strategyMandate.holding}</strong><small>{strategyMandate.focus}</small></div>
          <div><span>{agentText('Exit geometry', '退出参数')}</span><strong>{strategyMandate.maxStopPct}% / {strategyMandate.targetR}R</strong><small>{agentText(`Review day ${strategyMandate.reviewDays}`, `第 ${strategyMandate.reviewDays} 天复核`)}</small></div>
          <div><span>{agentText('AI order authority', 'AI 下单权限')}</span><strong>{strategyMandate.buy && strategyMandate.sell ? agentText('BUY + ADD + REDUCE + EXIT', '买入 + 补仓 + 减仓 + 清仓') : agentText('LOCKED', '已锁定')}</strong><small>{strategyMandate.approval ? agentText('Human approval required', '需要人工确认') : agentText('Hard gates remain final', '硬风控拥有最终权限')}</small></div>
        </div>

        <div className="agent-mandate-safety-row">
          <div className="agent-mandate-leverage">
            <Switch checked={leverageEnabled} disabled={!leverageAvailable} onChange={handleLeverageEnabledChange} />
            <div><strong>{agentText('Leveraged equity sleeve', '杠杆股票仓位')}</strong><span>{leverageAvailable ? agentText('Optional, capped at 15% of equity; long-only leveraged ETPs.', '可选，最高为权益的 15%；仅限做多杠杆 ETP。') : agentText('Requires High risk + Short horizon.', '仅在“高风险 + 短周期”时开放。')}</span></div>
          </div>
          <div className="agent-mandate-prohibition"><SafetyCertificateOutlined /><div><strong>{agentText('OPTIONS PROHIBITED', '禁止期权')}</strong><span>{agentText('US equities only. This cannot be overridden by AI mode.', '仅限美股；任何 AI 模式都不能绕过。')}</span></div></div>
        </div>
      </section>

      {/* 1.55 AI Auto Pipeline */}
      <div className="agent-interactive-pipeline agent-legacy-ai-pipeline" id="research-pipeline-control" aria-hidden="true">
        <Card
          className="premium-card"
          styles={{ body: { padding: 0 } }}
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--app-border-soft)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 6, background: 'var(--app-blue-bg)', color: '#1677ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, border: '1px solid rgba(22, 119, 255, 0.2)' }}>
                  <RobotOutlined />
                </div>
                <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--app-text-strong)', letterSpacing: 0 }}>{t.agent.aiPipeline}</span>
                <Tag color={pipelineMode === 'ai' ? 'processing' : pipelineMode === 'hybrid' ? 'blue' : 'default'} bordered={false} style={{ fontSize: 11, fontWeight: 800, borderRadius: 6, margin: 0, padding: '2px 8px' }}>
                  {aiMandate.label}
                </Tag>
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {pipelineRunning ? (
                  <Button
                    danger
                    type="primary"
                    icon={<PauseCircleOutlined />}
                    onClick={stopPipeline}
                    style={{ borderRadius: 8, height: 36, fontWeight: 700, fontSize: 13, boxShadow: '0 2px 6px rgba(255, 77, 79, 0.2)' }}
                  >
                    {t.agent.stop}
                  </Button>
                ) : (
                  <Button
                    type="primary"
                    icon={<ThunderboltOutlined />}
                    onClick={() => runAIPipeline({ trigger: 'manual' })}
                    disabled={autoRunActive || (pipelineMode === 'manual' ? false : isAnyScanRunning)}
                    style={{ 
                      background: '#1677ff',
                      borderColor: '#1677ff',
                      color: 'var(--app-card-bg)',
                      height: 36,
                      borderRadius: 6,
                      fontWeight: 700,
                      fontSize: 13,
                      boxShadow: '0 2px 6px rgba(22, 119, 255, 0.18)'
                    }}
                  >
                    {t.agent.runPipeline}
                  </Button>
                )}
              </div>
            </div>
          }
        >
          {/* Mode-specific compact hint */}
          <div style={{ padding: '16px 20px', background: 'var(--app-card-bg-soft)', borderBottom: '1px solid var(--app-border-soft)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--app-text-muted)', fontSize: 12, background: 'var(--app-card-bg)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--app-border)' }}>
              <InfoCircleOutlined style={{ color: '#1890ff', fontSize: 14 }} />
              <span style={{ fontWeight: 500 }}>
                {pipelineMode === 'ai'
                  ? t.agent.pipelineModeAiDesc
                  : pipelineMode === 'hybrid'
                    ? t.agent.pipelineModeHybridDesc
                    : t.agent.pipelineModeManualDesc}
              </span>
            </div>
          </div>

          <div className="agent-pipeline-authority-strip">
            {[
              [agentText('Research', '研究'), aiMandate.research],
              [agentText('Select', '筛选'), aiMandate.selection],
              [agentText('Buy', '买入'), aiMandate.buy],
              [agentText('Sell', '卖出'), aiMandate.sell],
            ].map(([label, enabled]) => (
              <div key={String(label)} className={enabled ? 'is-enabled' : 'is-locked'}>
                {enabled ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                <span>{label}</span>
                <small>{enabled ? agentText('Allowed', '允许') : agentText('Locked', '锁定')}</small>
              </div>
            ))}

            {pipelineStage !== 'idle' && (
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px dashed var(--app-border)' }}>
                <Steps
                  size="small"
                  current={PIPELINE_STAGES.indexOf(pipelineStage as any)}
                  status={pipelineStage === 'failed' ? 'error' : pipelineRunning ? 'process' : 'finish'}
                  items={PIPELINE_STAGES.map((name) => {
                    const idx = PIPELINE_STAGES.indexOf(name);
                    const currentIdx = PIPELINE_STAGES.indexOf(pipelineStage as any);
                    let status: 'wait' | 'process' | 'finish' | 'error' = 'wait';
                    if (pipelineStage === 'failed' && idx === currentIdx) status = 'error';
                    else if (idx < currentIdx) status = 'finish';
                    else if (idx === currentIdx) status = 'process';
                    return { title: <span style={{ fontSize: 11, fontWeight: status === 'process' ? 700 : 500 }}>{getPipelineStageLabel(name)}</span>, status };
                  })}
                />
              </div>
            )}
          </div>

          {pipelineError && (
            <Alert
              type="error"
              showIcon
              message={t.agent.error}
              description={pipelineError}
              style={{ marginTop: 12, borderRadius: 8 }}
              closable
              onClose={() => setPipelineError(null)}
            />
          )}
        </Card>
      </div>

      <div className="agent-section-heading agent-portfolio-heading">
        <div>
          <span>{agentConsoleCopy.tradingDesk}</span>
          <h2>{agentConsoleCopy.portfolioOperations}</h2>
        </div>
        <b>{agentText(
          `${holdings.length} open · ${aiExecutionList.length} queued · ${aiWatchlistItems.length} monitored`,
          `${holdings.length} 个持仓 · ${aiExecutionList.length} 个待执行 · ${aiWatchlistItems.length} 个监控中`,
        )}</b>
      </div>

      {/* 1.58 Current Holdings */}
      <div className="agent-portfolio-panel" id="research-portfolio">
        <Card
          className="premium-card"
          styles={{ body: { padding: 0 } }}
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--app-border-soft)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: 'rgba(82, 196, 26, 0.1)',
                  color: '#52c41a', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 18,
                  border: '1px solid rgba(82, 196, 26, 0.2)'
                }}>
                  <WalletOutlined />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--app-text-strong)', letterSpacing: 0 }}>{t.agent.positions}</span>
                    <Tag color="success" bordered={false} style={{ fontSize: 11, fontWeight: 800, borderRadius: 6, margin: 0, padding: '0 8px' }}>
                      {holdings.length}
                    </Tag>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--app-text-muted)', fontWeight: 500 }}>{t.agent.accountOverview}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Tag color={tradeMode === 'paper' ? 'blue' : 'default'} bordered={false} className="agent-environment-tag" style={{ fontSize: 11, fontWeight: 800, borderRadius: 6, margin: 0, padding: '4px 8px' }}>
                  {tradeMode === 'paper' ? agentConsoleCopy.paperTradingStatus : agentConsoleCopy.liveTradingStatus}
                </Tag>
                <Divider type="vertical" style={{ height: 24, margin: 0, opacity: 0.5 }} />
                <Button
                  type="text"
                  icon={<ReloadOutlined spin={holdingsLoading} />}
                  onClick={() => fetchHoldings()}
                  style={{ color: 'var(--app-text-muted)', fontWeight: 600, fontSize: 13, background: 'var(--app-card-bg-soft)', border: '1px solid var(--app-border)', borderRadius: 8, height: 32 }}
                >
                  {t.agent.refresh}
                </Button>
              </div>
            </div>
          }
        >
          {holdingsError && (
            <Alert type="error" showIcon message={holdingsError} style={{ margin: '16px 20px', borderRadius: 8 }} closable onClose={() => setHoldingsError(null)} />
          )}

          {holdingsLoading && holdings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--app-text-muted)' }}><Spin size="large" /> <div style={{ marginTop: 12, fontWeight: 500 }}>{t.agent.loading}</div></div>
          ) : holdings.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div style={{ padding: '30px 0' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--app-text-muted)' }}>{t.agent.noOpenPositions}</div>
                  <div style={{ fontSize: 13, color: 'var(--app-text-muted)', marginTop: 4 }}>{t.agent.noData}</div>
                </div>
              }
              style={{ margin: 0 }}
            />
          ) : (
            <div className="holdings-table-container">
              <style>{`
                .holdings-table .ant-table-thead > tr > th { 
                  background: var(--app-card-bg-soft) !important; 
                  padding: 12px 16px !important; 
                  color: var(--app-text-muted) !important;
                  font-weight: 700 !important;
                  font-size: 11px !important;
                  letter-spacing: 0.5px !important;
                  border-bottom: 1px solid var(--app-border-soft) !important;
                }
                .holdings-table .ant-table-tbody > tr > td { padding: 12px 16px !important; border-bottom: 1px solid var(--app-border-soft) !important; }
                .holdings-row:hover > td { background-color: var(--app-blue-bg) !important; }
                .holdings-row-expanded > td { background-color: var(--app-table-row-bg) !important; }
              `}</style>
              <Table
                className="holdings-table"
                dataSource={holdings}
                rowKey="symbol"
                size="middle"
                pagination={holdings.length > 10 ? { pageSize: 10, size: 'small' } : false}
                scroll={{ x: 900 }}
                style={{ fontSize: 13 }}
                rowClassName={(record) => record.id === expandedRows[0] ? 'holdings-row holdings-row-expanded' : 'holdings-row'}
                expandable={{
                  expandedRowRender: (h: any) => (
                    <div style={{ padding: '16px 24px', background: 'var(--app-card-bg-soft)', borderRadius: 8, margin: '8px 16px', border: '1px solid var(--app-border)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)' }}>
                      <div style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 }}>{t.agent.colPosition} {t.agent.details}</div>
                      <Row gutter={[24, 16]}>
                        {[
                          { label: t.agent.symbol, value: <span style={{ fontWeight: 800 }}>{h.symbol}</span> },
                          { label: t.agent.side, value: <Tag color={h.side === 'short' ? 'red' : 'green'} bordered={false} style={{ margin: 0, fontWeight: 700 }}>{h.side?.toUpperCase() || t.agent.longSide}</Tag> },
                          { label: t.agent.qty, value: h.qty },
                          { label: agentConsoleCopy.assetClass, value: h.assetClass || 'us_equity' },
                          { label: t.agent.avgEntry, value: exitPrice(h.avgEntryPrice) },
                          { label: t.agent.currentPrice, value: exitPrice(h.currentPrice) },
                          { label: t.agent.marketValue, value: exitMoney(h.marketValue) },
                          { label: agentConsoleCopy.costBasis, value: exitMoney(h.costBasis) },
                          { label: t.agent.plDollar, value: <span style={{ color: exitValueTone(h.unrealizedPL), fontWeight: 700 }}>{exitSignedMoney(h.unrealizedPL)}</span> },
                          { label: t.agent.plPercent, value: <span style={{ color: exitValueTone(h.unrealizedPLPercent), fontWeight: 700 }}>{exitRatioPercent(h.unrealizedPLPercent)}</span> },
                          { label: agentConsoleCopy.exchange, value: h.exchange || 'N/A' },
                        ].map((item, idx) => (
                          <Col xs={12} md={6} key={idx}>
                            <div style={{ fontSize: 11, color: 'var(--app-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{item.label}</div>
                            <div style={{ fontSize: 14, color: 'var(--app-text-strong)', fontWeight: 600 }}>{item.value}</div>
                          </Col>
                        ))}
                      </Row>
                    </div>
                  ),
                }}
                columns={[
                  { 
                    title: t.agent.symbol.toUpperCase(),
                    dataIndex: 'symbol', key: 'symbol', width: 90, fixed: 'left' as const,
                    render: (t: string) => <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--app-text-strong)', letterSpacing: 0 }}>{t}</span>
                  },
                  {
                    title: t.agent.qty.toUpperCase(),
                    dataIndex: 'qty', key: 'qty', width: 70, align: 'right' as const,
                    render: (v: number) => <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--app-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{v}</span>
                  },
                  {
                    title: t.agent.avgEntry.toUpperCase(),
                    dataIndex: 'avgEntryPrice', key: 'avgEntry', width: 90, align: 'right' as const,
                    render: (v: number) => <span style={{ fontSize: 13, color: 'var(--app-text-muted)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{exitPrice(v)}</span>
                  },
                  {
                    title: t.agent.colCurrent.toUpperCase(),
                    dataIndex: 'currentPrice', key: 'current', width: 90, align: 'right' as const,
                    render: (v: number) => <span style={{ fontSize: 13, color: 'var(--app-text-muted)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{exitPrice(v)}</span>
                  },
                  {
                    title: t.agent.marketValue.toUpperCase(),
                    dataIndex: 'marketValue', key: 'mktVal', width: 110, align: 'right' as const,
                    render: (v: number) => <span style={{ fontSize: 14, color: 'var(--app-text-strong)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{exitMoney(v)}</span>
                  },
                  {
                    title: t.agent.plDollar.toUpperCase(),
                    dataIndex: 'unrealizedPL', key: 'pl', width: 110, align: 'right' as const,
                    render: (v: number) => <span style={{ color: exitValueTone(v), fontWeight: 700, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{exitSignedMoney(v)}</span>
                  },
                  {
                    title: t.agent.plPercent.toUpperCase(),
                    dataIndex: 'unrealizedPLPercent', key: 'plpct', width: 100, align: 'right' as const,
                    render: (v: number) => {
                      const normalized = exitFinite(v) ?? 0;
                      return <Tag color={normalized > 0 ? 'success' : normalized < 0 ? 'error' : 'default'} bordered={false} style={{ fontWeight: 700, fontSize: 13, margin: 0, padding: '2px 8px', borderRadius: 6, fontVariantNumeric: 'tabular-nums' }}>{exitRatioPercent(normalized)}</Tag>;
                    }
                  },
                  {
                    title: t.agent.sell.toUpperCase(),
                    key: 'sell',
                    width: 188,
                    fixed: 'right' as const,
                    align: 'left' as const,
                    render: (_: any, record: any) => {
                      const sellOrder = openSellOrders.find(o => o.symbol === record.symbol);
                      if (sellOrder) {
                        const orderType = (sellOrder.type || 'market').toUpperCase();
                        const priceStr = sellOrder.limit_price ? ` $${Number(sellOrder.limit_price).toFixed(2)}` : sellOrder.stop_price ? ` $${Number(sellOrder.stop_price).toFixed(2)}` : '';
                        return (
                          <div className="agent-holding-actions">
                            <div className="agent-holding-order-summary">
                              <span>{agentConsoleCopy.openSell}</span>
                              <strong>{orderType}{priceStr}</strong>
                            </div>
                            <Button
                              className="agent-holding-cancel"
                              size="small"
                              danger
                              loading={cancelingOrderId === sellOrder.id}
                              onClick={() => handleCancelSellOrder(sellOrder.id, record.symbol)}
                            >
                              {agentConsoleCopy.cancel}
                            </Button>
                          </div>
                        );
                      }
                      return (
                        <Button
                          className="agent-holding-sell-button"
                          size="small"
                          danger
                          onClick={() => openSellModal(record.symbol, record.qty)}
                        >
                          {t.agent.sell}
                        </Button>
                      );
                    },
                  },
                ]}
              />
            </div>
          )}
        </Card>
      </div>
      <section className="agent-order-monitoring" aria-label={agentText('Orders and entry monitoring', '订单与入场监控')}>
      <div className="agent-section-heading agent-order-monitoring-heading">
        <div>
          <span>{agentText('Trading handoff', '交易衔接')}</span>
          <h2>{agentText('Orders & monitoring', '订单与监控')}</h2>
        </div>
        <b>{agentText('Only expands when candidates are available', '仅在有候选时展开')}</b>
      </div>
      {/* 1.7 AI Execution Candidates */}
      <div className={`agent-execution-panel ${aiExecutionList.length === 0 ? 'is-empty' : ''}`} id="research-execution">
        <Card
          className="premium-card"
          styles={{ body: { padding: 0 } }}
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--app-border-soft)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  width: 36, height: 36, borderRadius: 10, 
                  background: 'rgba(250, 173, 20, 0.1)', 
                  color: '#faad14', display: 'flex', alignItems: 'center', 
                  justifyContent: 'center', fontSize: 18,
                  border: '1px solid rgba(250, 173, 20, 0.2)'
                }}>
                  <FundOutlined />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--app-text-strong)', letterSpacing: 0 }}>{t.agent.executionCandidates}</span>
                    <Tag color="warning" bordered={false} style={{ fontSize: 11, fontWeight: 800, borderRadius: 6, margin: 0, padding: '0 8px' }}>
                      {aiExecutionList.length}
                    </Tag>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--app-text-muted)', fontWeight: 500 }}>{t.agent.aiExecution}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Tag color={tradeMode === 'paper' ? 'blue' : 'default'} bordered={false} className="agent-environment-tag" style={{ fontSize: 11, fontWeight: 800, borderRadius: 6, margin: 0, padding: '4px 8px' }}>
                  {tradeMode === 'paper' ? agentConsoleCopy.paperTradingStatus : agentConsoleCopy.liveTradingStatus}
                </Tag>
                <Divider type="vertical" style={{ height: 24, margin: 0, opacity: 0.5 }} />
                {aiExecutionList.length > 0 ? (
                  <Button 
                    type="text" 
                    danger 
                    icon={<DeleteOutlined />} 
                    onClick={() => {
                      Modal.confirm({
                        title: t.agent.clearWatchlist,
                        content: t.agent.clearWatchlistConfirm,
                        okText: agentText('Clear list', '清空列表'),
                        cancelText: agentText('Cancel', '取消'),
                        okType: 'danger',
                        className: 'agent-confirm-dialog',
                        rootClassName: 'agent-confirm-modal',
                        onOk: () => { clearedAtGenerationRef.current = entryPlanGenerationRef.current; autoEntryPlanExecuteKeysRef.current.clear(); aiExecutionList.forEach((item: any) => { const sym = String(item.symbol || '').toUpperCase(); if (sym) { removedSymbolsRef.current.add(sym); scannerStateStore.addRemovedExecutionSymbol(sym); } }); setAiExecutionList([]); scannerStateStore.clearAiExecutionCandidates(); scannerStateStore.flushPendingSave(); }
                      });
                    }} 
                    style={{ fontWeight: 600, fontSize: 13, background: 'rgba(255, 77, 79, 0.1)', border: '1px solid rgba(255, 77, 79, 0.2)', borderRadius: 8, height: 32 }}
                  >
                    {agentConsoleCopy.clear}
                  </Button>
                ) : (
                  <Button type="text" disabled style={{ fontWeight: 600, fontSize: 13, background: 'var(--app-card-bg-soft)', border: '1px solid var(--app-border)', borderRadius: 8, height: 32 }}>{agentConsoleCopy.clear}</Button>
                )}
              </div>
            </div>
          }
        >
          {/* Info Strip */}
          <div style={{ padding: '12px 20px', background: 'var(--app-card-bg-soft)', borderBottom: '1px solid var(--app-border-soft)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--app-text-muted)', fontSize: 12 }}>
              <InfoCircleOutlined style={{ color: pipelineMode === 'ai' ? '#1890ff' : '#faad14', fontSize: 14 }} />
              <span style={{ fontWeight: 500 }}>
                {pipelineMode === 'ai'
                  ? (tradeMode === 'paper' ? agentConsoleCopy.paperAiModeDescription : agentConsoleCopy.liveAiModeDescription)
                  : pipelineMode === 'hybrid'
                    ? t.agent.hybridModeDesc
                    : t.agent.manualModeDesc}
              </span>
            </div>
          </div>

          {aiExecutionList.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', background: 'var(--app-card-bg)' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--app-card-bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: '1px dashed var(--app-border)' }}>
                <CheckCircleOutlined style={{ fontSize: 20, color: 'var(--app-text-muted)' }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--app-text-strong)', marginBottom: 4 }}>{agentConsoleCopy.noExecutionCandidates}</div>
              <div style={{ fontSize: 13, color: 'var(--app-text-muted)', marginBottom: 16 }}>{agentConsoleCopy.executionCandidatesHint}</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                <Tag bordered={false} style={{ margin: 0, color: 'var(--app-text-muted)', background: 'var(--app-card-bg-soft)', borderRadius: 4 }}>{agentConsoleCopy.waitingForEntryPlan}</Tag>
                <Tag bordered={false} style={{ margin: 0, color: 'var(--app-text-muted)', background: 'var(--app-card-bg-soft)', borderRadius: 4 }}>{agentConsoleCopy.riskGateRequired}</Tag>
                <Tag bordered={false} style={{ margin: 0, color: 'var(--app-text-muted)', background: 'var(--app-card-bg-soft)', borderRadius: 4 }}>{agentConsoleCopy.autoSubmitProtected}</Tag>
              </div>
            </div>
          ) : (
            <div className="execution-table-container" style={{ width: '100%', overflowX: 'auto' }}>
              <style>{`
                .execution-table .ant-table-thead > tr > th {
                  background: var(--app-card-bg-soft) !important;
                  padding: 10px 12px !important;
                  color: var(--app-text-muted) !important;
                  font-weight: 700 !important;
                  font-size: 10px !important;
                  letter-spacing: 0.5px !important;
                  border-bottom: 1px solid var(--app-border-soft) !important;
                  white-space: nowrap !important;
                }
                .execution-table .ant-table-tbody > tr > td {
                  padding: 10px 12px !important;
                  border-bottom: 1px solid var(--app-border-soft) !important;
                  vertical-align: top !important;
                  overflow: hidden !important;
                }
                .execution-row:hover > td { background-color: rgba(82, 196, 26, 0.1) !important; }
                .execution-row-expanded > td { background-color: var(--app-card-bg-soft) !important; }
                .execution-log-row > td { padding: 8px 12px !important; border-bottom: 1px solid var(--app-border-soft) !important; }
                .execution-table .ant-table-fixed-right {
                  background: var(--app-card-bg) !important;
                  box-shadow: -6px 0 12px -4px rgba(0,0,0,0.08) !important;
                }
                .execution-table .ant-table-cell-fix-right-first::after {
                  box-shadow: none !important;
                }
              `}</style>
              <Table
                className="execution-table"
                dataSource={aiExecutionList}
                rowKey={(r: any) => r.symbol + (r.addedAt || '')}
                size="middle"
                pagination={false}
                scroll={{ x: 1960 }}
                style={{ fontSize: '12px' }}
              rowClassName={(record) => record.id === expandedRows[0] ? 'execution-row execution-row-expanded' : 'execution-row'}
              expandable={{
                expandedRowRender: (record: any) => {
                  const ep = entryPlanResultsBySymbol[record.symbol] || normalizeWatchlistToEntryPlan(record);
                  return renderEntryPlanDetail(ep);
                },
              }}
              columns={[
                {
                  title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colSymbol}</span>,
                  dataIndex: 'symbol',
                  key: 'symbol',
                  width: 120,
                  fixed: 'left' as const,
                  render: (text: string) => (
                    <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--app-text-strong)', letterSpacing: 0 }}>{text}</span>
                  ),
                },
                {
                  title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.setup}</span>,
                  key: 'setup',
                  width: 220,
                  ellipsis: true,
                  render: (r: any) => {
                    const s = r.setup || r.setupType || 'N/A';
                    const color = s.includes('Pullback') ? 'gold' : s.includes('Breakout') ? 'purple' : s.includes('Range') ? 'green' : 'blue';
                    return <Tag color={color} style={{ fontSize: 9, fontWeight: 700, borderRadius: 4, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.toUpperCase()}>{s.toUpperCase()}</Tag>;
                  },
                },
                {
                  title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.entryZone}</span>,
                  key: 'entryZone',
                  width: 180,
                  render: (r: any) => {
                    const { low: lo, high: hi } = getEntryPlanZone(r);
                    if (!lo && !hi) return <span style={{ color: '#d1d5db' }}>—</span>;
                    return <span style={{ fontSize: 12, color: 'var(--app-text-strong)', fontWeight: 600 }}>${(lo || 0).toFixed(2)} – ${(hi || 0).toFixed(2)}</span>;
                  },
                },
                {
                  title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colStop} / {t.agent.colTargets}</span>,
                  key: 'levels',
                  width: 170,
                  render: (r: any) => (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ color: 'rgba(239, 68, 68, 0.8)', fontSize: 11, fontWeight: 700 }}>S: ${(r.stopLoss || 0).toFixed(2)}</span>
                      <span style={{ color: '#10b981', fontSize: 11, fontWeight: 700 }}>T: ${(r.takeProfit1 || 0).toFixed(2)}</span>
                    </div>
                  )
                },
                {
                  title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.riskReward}</span>,
                  key: 'riskReward1',
                  width: 140,
                  render: (r: any) => {
                    const v = r.riskReward1 || (() => {
                      const stop = toEntryPlanNumber(r.stopLoss ?? r.entryPlan?.stopLoss);
                      const target = toEntryPlanNumber(r.takeProfit1 ?? r.entryPlan?.takeProfit1);
                      const entry = toEntryPlanNumber(r.entryZoneLow ?? r.entryZoneHigh ?? r.entryPlan?.entryZoneLow ?? r.entryPlan?.entryZoneHigh);
                      if (stop && target && entry && stop > 0 && target > 0 && entry > 0 && entry !== stop) {
                        return Math.abs(target - entry) / Math.abs(entry - stop);
                      }
                      return null;
                    })();
                    return v ? <span style={{ fontWeight: 700, color: v >= 2 ? '#10b981' : 'var(--app-text-muted)', fontSize: 12 }}>{v.toFixed(1)}x</span> : <span style={{ color: '#d1d5db' }} title={agentText('Stop, target, and entry data are required.', '需要止损、目标和入场数据。')}>—</span>;
                  },
                },
                {
                  title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colAIDecision} / {t.agent.colGate}</span>,
                  key: 'aiGate',
                  width: 220,
                  render: (r: any) => {
                    const d = r.aiDecision || 'WATCH';
                    const s = (r.riskGate || r.hardRiskGate || {}).status || r.riskGateStatus || '';
                    const dCol = d === 'BUY' ? 'green' : d === 'WATCH' ? 'gold' : 'red';
                    const sCol = s === 'PASS' ? 'green' : s === 'REVIEW' ? 'gold' : s ? 'red' : 'default';
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                        <Tag color={dCol} bordered={false} style={{ fontSize: 9, margin: 0, fontWeight: 800, borderRadius: 4, width: 'fit-content', maxWidth: 80, textAlign: 'center' }}>{translateStatus(d)}</Tag>
                        {s ? (
                          <Tag color={sCol} bordered={false} style={{ fontSize: 9, margin: 0, fontWeight: 800, borderRadius: 4, width: 'fit-content', maxWidth: 120, textAlign: 'center' }}>{t.agent.riskGate}: {translateStatus(s)}</Tag>
                        ) : (
                          <Tag bordered={false} style={{ fontSize: 9, margin: 0, fontWeight: 600, borderRadius: 4, width: 'fit-content', maxWidth: 120, textAlign: 'center', color: '#9ca3af', background: 'var(--app-card-bg-soft)' }}>{t.agent.riskGate}: {t.agent.pending}</Tag>
                        )}
                      </div>
                    );
                  },
                },
                {
                  title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.recommendation}</span>,
                  key: 'recommendedShares',
                  width: 170,
                  render: (r: any) => {
                    const rec = r.positionSizeShares || r.entryPlan?.positionSizeShares || 0;
                    return rec > 0
                      ? <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: '#2563eb' }}>{rec}</span>
                          <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600 }}>{t.agent.shares}</span>
                        </div>
                      : <span style={{ color: '#d1d5db' }}>—</span>;
                  },
                },
                {
                  title: <span style={{ fontWeight: 700, color: '#1890ff', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.qty}</span>,
                  key: 'qty',
                  width: 130,
                  render: (r: any) => {
                    const isDraft = !r.executionStatus || r.executionStatus === 'draft';
                    const editable = isDraft;
                    const updateField = (field: string, val: any) => {
                      setAiExecutionList(prev => prev.map(item =>
                        item.symbol === r.symbol ? { ...item, [field]: val } : item
                      ));
                    };

                    if (editable) {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <Select
                            size="small"
                            value={r.qtyMode || 'shares'}
                            onChange={val => updateField('qtyMode', val)}
                            style={{ width: '100%', fontSize: 10 }}
                            dropdownStyle={{ minWidth: 100 }}
                          >
                            <Option value="shares">{t.agent.shares}</Option>
                            <Option value="dollars">{t.agent.dollarAmount}</Option>
                          </Select>
                          {r.qtyMode === 'dollars' ? (
                            <Input
                              size="small"
                              type="number"
                              prefix="$"
                              value={r.dollarAmount || 0}
                              onChange={e => updateField('dollarAmount', parseFloat(e.target.value) || 0)}
                              style={{ width: '100%', fontSize: 11, borderRadius: 4, height: 26 }}
                              min={0}
                            />
                          ) : (
                            <Input
                              size="small"
                              type="number"
                              value={r.userQty || ''}
                              onChange={e => updateField('userQty', parseFloat(e.target.value) || 0)}
                              style={{ width: '100%', fontSize: 11, borderRadius: 4, height: 26 }}
                              min={0.0001}
                              step={0.01}
                              placeholder={agentText('e.g. 0.5', '例如 0.5')}
                            />
                          )}
                        </div>
                      );
                    }
                    if (r.qtyMode === 'dollars') return <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--app-text-strong)' }}>${(r.dollarAmount || 0).toLocaleString()}</span>;
                    return <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--app-text-strong)' }}>{r.userQty || r.positionSizeShares || '—'}</span>;
                  },
                },
                {
                  title: <span style={{ fontWeight: 700, color: '#1890ff', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.typeTif}</span>,
                  key: 'orderTypeTif',
                  width: 120,
                  render: (r: any) => {
                    const isDraft = !r.executionStatus || r.executionStatus === 'draft';
                    const editable = isDraft;
                    const updateField = (field: string, val: any) => {
                      setAiExecutionList(prev => prev.map(item =>
                        item.symbol === r.symbol ? { ...item, [field]: val } : item
                      ));
                    };
                    const typeLabels: Record<string, string> = {
                      market: 'MKT', limit: 'LMT', stop: 'STP', stop_limit: 'STP LMT', trailing_stop: 'TRAIL'
                    };

                    if (editable) {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <Select
                            size="small"
                            value={r.orderType || 'market'}
                            onChange={val => updateField('orderType', val)}
                            style={{ width: '100%', fontSize: 10 }}
                          >
                            <Option value="market">{t.agent.market}</Option>
                            <Option value="limit">{t.agent.limit}</Option>
                            <Option value="stop">{t.agent.stopOrder}</Option>
                            <Option value="stop_limit">{t.agent.stopLimit}</Option>
                            <Option value="trailing_stop">{t.agent.trailStop}</Option>
                          </Select>
                          <Select
                            size="small"
                            value={r.timeInForce || 'day'}
                            onChange={val => updateField('timeInForce', val)}
                            style={{ width: '100%', fontSize: 10 }}
                          >
                            <Option value="day">{t.agent.day}</Option>
                            <Option value="gtc">{t.agent.gtc}</Option>
                          </Select>
                        </div>
                      );
                    }
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--app-text-strong)' }}>{typeLabels[r.orderType]?.toUpperCase() || r.orderType?.toUpperCase() || 'MKT'}</span>
                        <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>{r.timeInForce?.toUpperCase() || 'DAY'}</span>
                      </div>
                    );
                  },
                },
                {
                  title: <span style={{ fontWeight: 700, color: '#1890ff', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.price}</span>,
                  key: 'priceFields',
                  width: 130,
                  render: (r: any) => {
                    const isDraft = !r.executionStatus || r.executionStatus === 'draft';
                    const editable = isDraft;
                    const ot = r.orderType || 'market';
                    const updateField = (field: string, val: any) => {
                      setAiExecutionList(prev => prev.map(item =>
                        item.symbol === r.symbol ? { ...item, [field]: val } : item
                      ));
                    };

                    if (ot === 'market') {
                      return <Tag bordered={false} style={{ fontSize: 13, fontWeight: 800, color: 'var(--app-text-strong)', background: 'var(--app-card-bg-soft)', borderRadius: 6 }}>MKT</Tag>;
                    }

                    if (editable) {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {(ot === 'limit' || ot === 'stop_limit') && (
                            <Input
                              size="small"
                              type="number"
                              prefix={<span style={{ fontSize: 9, color: '#9ca3af' }}>LMT</span>}
                              value={r.limitPrice || ''}
                              onChange={e => updateField('limitPrice', parseFloat(e.target.value) || 0)}
                              style={{ width: '100%', fontSize: 11, borderRadius: 4, height: 26 }}
                              min={0}
                              step={0.01}
                            />
                          )}
                          {(ot === 'stop' || ot === 'stop_limit') && (
                            <Input
                              size="small"
                              type="number"
                              prefix={<span style={{ fontSize: 9, color: '#9ca3af' }}>STP</span>}
                              value={r.stopPrice || ''}
                              onChange={e => updateField('stopPrice', parseFloat(e.target.value) || 0)}
                              style={{ width: '100%', fontSize: 11, borderRadius: 4, height: 26 }}
                              min={0}
                              step={0.01}
                            />
                          )}
                          {ot === 'trailing_stop' && (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <Input
                                size="small"
                                type="number"
                                prefix="$"
                                value={r.trailPrice || ''}
                                onChange={e => { updateField('trailPrice', parseFloat(e.target.value) || 0); updateField('trailPercent', 0); }}
                                style={{ width: '50%', fontSize: 10, height: 26 }}
                              />
                              <Input
                                size="small"
                                type="number"
                                suffix="%"
                                value={r.trailPercent || ''}
                                onChange={e => { updateField('trailPercent', parseFloat(e.target.value) || 0); updateField('trailPrice', 0); }}
                                style={{ width: '50%', fontSize: 10, height: 26 }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    }

                    const parts: string[] = [];
                    if (ot === 'limit') parts.push(`LMT $${(r.limitPrice || 0).toFixed(2)}`);
                    else if (ot === 'stop') parts.push(`STP $${(r.stopPrice || 0).toFixed(2)}`);
                    else if (ot === 'stop_limit') parts.push(`STP $${(r.stopPrice || 0).toFixed(2)} / LMT $${(r.limitPrice || 0).toFixed(2)}`);
                    else if (ot === 'trailing_stop') {
                      if (r.trailPrice > 0) parts.push(`TRAIL $${r.trailPrice.toFixed(2)}`);
                      else if (r.trailPercent > 0) parts.push(`TRAIL ${r.trailPercent}%`);
                    }
                    return <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--app-text-strong)', fontFamily: 'Inter, -apple-system, sans-serif' }}>{parts.join(' / ') || '—'}</span>;
                  },
                },
                {
                  title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.orderStatus}</span>,
                  key: 'executionStatus',
                  width: 120,
                  render: (r: any) => {
                    const status = r.executionStatus || 'draft';
                    const statusMap: Record<string, { color: string; label: string }> = {
                      draft: { color: 'orange', label: t.agent.draft },
                      pending: { color: 'processing', label: t.agent.pending },
                      submitted: { color: 'success', label: t.agent.submitted },
                      auto_executing: { color: 'processing', label: agentConsoleCopy.autoExecuting },
                      filled: { color: 'green', label: t.agent.filled },
                      failed: { color: 'error', label: t.agent.failed },
                      canceled: { color: 'default', label: t.agent.canceled },
                      holding: { color: 'blue', label: agentConsoleCopy.holding },
                      order_pending: { color: 'processing', label: agentConsoleCopy.orderPending },
                      zone_wait: { color: 'warning', label: agentConsoleCopy.zoneWait },
                      blocked: { color: 'orange', label: agentConsoleCopy.blocked },
                    };
                    const s = statusMap[status] || statusMap.draft;
                    const isInfoStatus = ['holding', 'order_pending', 'zone_wait', 'blocked'].includes(status);
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <Tag color={s.color} bordered={false} style={{ fontSize: 9, margin: 0, padding: '0 8px', fontWeight: 800, borderRadius: 4, width: 'fit-content' }}>{s.label}</Tag>
                        {r.executionError && <div style={{ fontSize: 9, color: isInfoStatus ? '#9ca3af' : '#ff4d4f', marginTop: 4, maxWidth: 120, fontWeight: 500 }} title={r.executionError}>{r.executionError}</div>}
                        {r.alpacaOrderId && <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2, fontFamily: 'monospace' }}>{r.alpacaOrderId.slice(0, 10)}</div>}
                      </div>
                    );
                  },
                },
                {
                  title: '',
                  key: 'action',
                  width: 170,
                  fixed: 'right' as const,
                  render: (r: any) => {
                    const autoMode = getAutomationMode();
                    const isExecuting = executingSymbol === r.symbol;
                    const status = r.executionStatus || 'draft';
                    const handleRemove = () => {
                      removedSymbolsRef.current.add(r.symbol.toUpperCase());
                      autoEntryPlanExecuteKeysRef.current.delete(r.autoEntryPlanKey || '');
                      setAiExecutionList(prev => prev.filter(e => e.symbol !== r.symbol));
                      scannerStateStore.removeAiExecutionCandidate(r.symbol);
                      scannerStateStore.addRemovedExecutionSymbol(r.symbol);
                      scannerStateStore.flushPendingSave();
                    };

                    // Active order — show Cancel + note
                    if (status === 'auto_executing') {
                      return <Tag color="processing" bordered={false} style={{ width: '100%', textAlign: 'center', fontWeight: 700 }}>{agentConsoleCopy.autoExecuting}</Tag>;
                    }

                    if (status === 'submitted' || status === 'pending') {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <Button
                            size="small"
                            danger
                            loading={cancelLoading && cancelTarget?.record?.symbol === r.symbol}
                            style={{ borderRadius: 6, height: 28, fontSize: 11, fontWeight: 600, width: '100%' }}
                            onClick={() => { setCancelTarget({ record: r }); setCancelConfirmVisible(true); }}
                          >
                            {t.agent.cancelOrder}
                          </Button>
                          <div style={{ fontSize: 9, color: '#9ca3af', textAlign: 'center' }}>{t.agent.cancelBeforeRemoving}</div>
                        </div>
                      );
                    }

                    // Filled — no remove
                    if (status === 'filled') return <Tag color="green" bordered={false} style={{ width: '100%', textAlign: 'center', fontWeight: 700 }}>{t.agent.filled}</Tag>;

                    // Failed — Retry + Remove
                    if (status === 'failed') {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <Button
                            size="small"
                            danger
                            loading={isExecuting}
                            style={{ borderRadius: 6, height: 26, fontSize: 11, fontWeight: 600, width: '100%' }}
                            onClick={() => {
                              autoEntryPlanExecuteKeysRef.current.delete(r.autoEntryPlanKey || '');
                              removedSymbolsRef.current.delete(r.symbol.toUpperCase());
                              scannerStateStore.removeRemovedExecutionSymbol(r.symbol);
                              setAiExecutionList(prev => prev.map(item =>
                                item.symbol === r.symbol ? { ...item, executionStatus: 'draft', executionError: undefined, retryCount: (item.retryCount || 0) + 1 } : item
                              ));
                            }}
                          >
                            {t.agent.retryOrder}
                          </Button>
                          <Button
                            size="small"
                            icon={<DeleteOutlined />}
                            style={{ borderRadius: 6, height: 26, fontSize: 11, fontWeight: 600, width: '100%' }}
                            onClick={handleRemove}
                          >
                            {t.agent.removeOrder}
                          </Button>
                        </div>
                      );
                    }

                    // Canceled — Remove only
                    if (status === 'canceled') {
                      return (
                        <Button
                          size="small"
                          icon={<DeleteOutlined />}
                          style={{ borderRadius: 6, height: 28, fontSize: 11, fontWeight: 600, width: '100%' }}
                          onClick={handleRemove}
                        >
                          {agentConsoleCopy.remove}
                        </Button>
                      );
                    }

                    // Holding — managed by Exit Scan, remove only
                    if (status === 'holding') {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                          <Tag color="blue" bordered={false} style={{ width: '100%', textAlign: 'center', fontWeight: 700, fontSize: 10 }}>{agentConsoleCopy.managedByExitScan}</Tag>
                          <Button size="small" icon={<DeleteOutlined />} style={{ borderRadius: 6, height: 24, fontSize: 10, fontWeight: 600, width: '100%' }} onClick={handleRemove}>{agentConsoleCopy.remove}</Button>
                        </div>
                      );
                    }

                    // Order Pending — waiting for fill, remove only
                    if (status === 'order_pending') {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                          <Tag color="processing" bordered={false} style={{ width: '100%', textAlign: 'center', fontWeight: 700, fontSize: 10 }}>{agentConsoleCopy.waitingForFill}</Tag>
                          <Button size="small" icon={<DeleteOutlined />} style={{ borderRadius: 6, height: 24, fontSize: 10, fontWeight: 600, width: '100%' }} onClick={handleRemove}>{agentConsoleCopy.remove}</Button>
                        </div>
                      );
                    }

                    // Zone Wait — price left entry zone, can retry
                    if (status === 'zone_wait') {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <Tag color="warning" bordered={false} style={{ width: '100%', textAlign: 'center', fontWeight: 700, fontSize: 10 }}>{agentConsoleCopy.watching}</Tag>
                          <Button size="small" icon={<DeleteOutlined />} style={{ borderRadius: 6, height: 24, fontSize: 10, fontWeight: 600, width: '100%' }} onClick={handleRemove}>{agentConsoleCopy.remove}</Button>
                        </div>
                      );
                    }

                    // Blocked — safety gate failed, can retry
                    if (status === 'blocked') {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <Button
                            size="small"
                            loading={isExecuting}
                            style={{ borderRadius: 6, height: 26, fontSize: 11, fontWeight: 600, width: '100%' }}
                            onClick={() => {
                              autoEntryPlanExecuteKeysRef.current.delete(r.autoEntryPlanKey || '');
                              removedSymbolsRef.current.delete(r.symbol.toUpperCase());
                              scannerStateStore.removeRemovedExecutionSymbol(r.symbol);
                              setAiExecutionList(prev => prev.map(item =>
                                item.symbol === r.symbol ? { ...item, executionStatus: 'draft', executionError: undefined, retryCount: (item.retryCount || 0) + 1 } : item
                              ));
                            }}
                          >
                            {agentConsoleCopy.retry}
                          </Button>
                          <Button size="small" icon={<DeleteOutlined />} style={{ borderRadius: 6, height: 24, fontSize: 10, fontWeight: 600, width: '100%' }} onClick={handleRemove}>{agentConsoleCopy.remove}</Button>
                        </div>
                      );
                    }

                    // Manual mode — Review only + Remove
                    if (autoMode === 'manual') {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <Tag color="default" style={{ fontSize: 10, textAlign: 'center', margin: 0 }}>{t.agent.reviewOnly}</Tag>
                          <Button
                            size="small"
                            icon={<DeleteOutlined />}
                            style={{ borderRadius: 6, height: 26, fontSize: 11, fontWeight: 600, width: '100%' }}
                            onClick={handleRemove}
                          >
                            {t.agent.removeOrder}
                          </Button>
                        </div>
                      );
                    }

                    // Draft — Submit + Remove
                    const submitLabel = tradeMode === 'paper' ? t.agent.submitPaper : t.agent.confirmLive;
                    const btnType = tradeMode === 'paper' ? 'primary' : 'default';

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <Button
                          type={btnType}
                          size="small"
                          loading={isExecuting}
                          style={{
                            borderRadius: 6, height: 28, fontSize: 11, fontWeight: 700, width: '100%',
                            background: tradeMode === 'paper' ? '#1890ff' : 'var(--app-card-bg)',
                            boxShadow: tradeMode === 'paper' ? '0 2px 6px rgba(24,144,255,0.3)' : 'none'
                          }}
                          onClick={() => shouldAutoConfirmOrder ? handleExecuteOrder(r) : openConfirmModal(r)}
                        >
                          {submitLabel}
                        </Button>
                        <Button
                          size="small"
                          icon={<DeleteOutlined />}
                          style={{ borderRadius: 6, height: 26, fontSize: 11, fontWeight: 600, width: '100%' }}
                          onClick={handleRemove}
                        >
                          {t.agent.removeOrder}
                        </Button>
                      </div>
                    );
                  },
                },
              ]}
            />
          </div>
          )}
        </Card>

        {/* Execution Log */}
        {executionLog.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div
              onClick={() => setExecutionLogExpanded(!executionLogExpanded)}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', fontSize: 12, color: 'var(--app-text-muted)' }}
            >
              {executionLogExpanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
              <span style={{ fontWeight: 600 }}>{t.agent.executionLog} ({executionLog.length})</span>
            </div>
            {executionLogExpanded && (
              <Table
                dataSource={executionLog}
                rowKey="id"
                size="small"
                pagination={false}
                style={{ fontSize: 11, marginTop: 4 }}
                columns={[
                  { title: t.agent.time, key: 'time', width: 80, render: (r: any) => <span style={{ fontSize: 10 }}>{new Date(r.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> },
                  { title: t.agent.colSymbol, dataIndex: 'symbol', key: 'symbol', width: 70, render: (text: string) => <span style={{ fontWeight: 700 }}>{text}</span> },
                  { title: t.agent.side, dataIndex: 'side', key: 'side', width: 50 },
                  { title: t.agent.qty, dataIndex: 'qty', key: 'qty', width: 50 },
                  { title: t.agent.mode, dataIndex: 'mode', key: 'mode', width: 60, render: (v: string) => <Tag color={v === 'paper' ? 'blue' : 'default'} className="agent-environment-tag" style={{ fontSize: 9, margin: 0, padding: '0 4px' }}>{v === 'paper' ? agentConsoleCopy.paperCode : agentConsoleCopy.real}</Tag> },
                  { title: t.agent.orderId, dataIndex: 'orderId', key: 'orderId', width: 120, render: (v: string) => <span style={{ fontSize: 10, fontFamily: 'monospace' }}>{v ? v.slice(0, 12) + '...' : 'N/A'}</span> },
                  { title: t.agent.orderStatus, dataIndex: 'orderStatus', key: 'status', width: 80, render: (v: string) => <Tag color={v === 'filled' ? 'green' : v === 'new' ? 'blue' : 'default'} style={{ fontSize: 9, margin: 0, padding: '0 4px' }}>{v || 'N/A'}</Tag> },
                ]}
              />
            )}
          </div>
        )}
      </div>

      {/* Order Confirmation Modal — Editable */}
      <Modal
        title={(
          <div className="agent-execution-modal__heading">
            <div>
              <span>{agentModalCopy.reviewEyebrow}</span>
              <strong>{tradeMode === 'real' ? t.agent.confirmRealOrder : t.agent.confirmPaperOrder}</strong>
            </div>
            <em className={tradeMode === 'real' ? 'is-live' : 'is-paper'}>
              <i />{tradeMode === 'real' ? agentModalCopy.liveAccount : agentModalCopy.paperAccount}
            </em>
          </div>
        )}
        open={orderConfirmVisible}
        onCancel={() => { setOrderConfirmVisible(false); setOrderConfirmTarget(null); setOrderRiskAccepted(false); }}
        footer={null}
        width={600}
        centered
        maskClosable={false}
        destroyOnHidden
        className="agent-execution-modal agent-edit-order-modal"
      >
        {orderConfirmTarget && (() => {
          const r = orderConfirmTarget.record;
          const ep = entryPlanResultsBySymbol[r.symbol] || normalizeWatchlistToEntryPlan(r);
          const isReal = tradeMode === 'real';
          const recShares = r.positionSizeShares || ep.positionSizeShares || 0;
          const { low: confirmEntryLow, high: confirmEntryHigh } = getEntryPlanZone(ep);
          const entryPrice = modalLimitPrice || modalStopPrice || confirmEntryHigh || confirmEntryLow || 0;

          // Estimated cost from modal state
          const estShares = modalQtyMode === 'dollars' ? 0 : (modalUserQty || recShares || 1);
          const estCost = modalQtyMode === 'dollars' ? (modalDollarAmount || 0) : (estShares * entryPrice);
          const RO = ({ label, value, color }: { label: string; value: any; color?: string }) => (
            <div className="agent-execution-modal__summary-row">
              <dt>{label}</dt>
              <dd style={color ? { color } : undefined}>{safeRender(value)}</dd>
            </div>
          );

          return (
            <div className="agent-execution-modal__content">
              <div className="agent-execution-modal__instrument">
                <div>
                  <span>{agentModalCopy.buyOrder}</span>
                  <strong>{r.symbol}</strong>
                </div>
                <Tag color="green" bordered={false}>{t.agent.buy}</Tag>
              </div>

              {recShares > 0 && (
                <div className="agent-execution-modal__recommendation">
                  <InfoCircleOutlined />
                  <span>{agentModalCopy.recommended}: <strong>{recShares} {t.agent.shares}</strong></span>
                </div>
              )}

              <section className="agent-execution-modal__section">
                <div className="agent-execution-modal__section-title"><span>01</span><h3>{agentModalCopy.orderParameters}</h3></div>
                <div className="agent-execution-modal__form-grid">
                  <label>
                    <span>{t.agent.buyBy}</span>
                    <Select
                      value={modalQtyMode}
                      onChange={(value) => setModalQtyMode(value as 'shares' | 'dollars')}
                      options={[
                        { value: 'shares', label: t.agent.shares },
                        { value: 'dollars', label: t.agent.dollarAmount },
                      ]}
                    />
                  </label>
                  <label>
                    <span>{modalQtyMode === 'dollars' ? t.agent.dollarAmount : t.agent.shares}</span>
                    <Input
                      type="number"
                      prefix={modalQtyMode === 'dollars' ? '$' : undefined}
                      suffix={modalQtyMode === 'shares' ? t.agent.shares : undefined}
                      value={modalQtyMode === 'dollars' ? modalDollarAmount : modalUserQty}
                      onChange={e => {
                        const v = parseFloat(e.target.value) || 0;
                        if (modalQtyMode === 'dollars') setModalDollarAmount(v);
                        else setModalUserQty(v);
                      }}
                      min={modalQtyMode === 'shares' ? 0.0001 : 0}
                      step={modalQtyMode === 'shares' ? 0.01 : 1}
                      placeholder={modalQtyMode === 'shares' ? '0.5' : '0.00'}
                    />
                  </label>
                  <label>
                    <span>{t.agent.orderType}</span>
                    <Select
                      value={modalOrderType}
                      onChange={setModalOrderType}
                      options={[
                        { value: 'market', label: t.agent.market },
                        { value: 'limit', label: t.agent.limit },
                        { value: 'stop', label: t.agent.stopOrder },
                        { value: 'stop_limit', label: t.agent.stopLimit },
                        { value: 'trailing_stop', label: t.agent.trailingStop },
                      ]}
                    />
                  </label>
                  <label>
                    <span>{t.agent.timeInForce}</span>
                    <Select
                      value={modalTimeInForce}
                      onChange={setModalTimeInForce}
                      options={[
                        { value: 'day', label: t.agent.day },
                        { value: 'gtc', label: t.agent.gtcLabel },
                        { value: 'ioc', label: t.agent.iocLabel },
                        { value: 'fok', label: t.agent.fokLabel },
                      ]}
                    />
                  </label>

                {(modalOrderType === 'limit' || modalOrderType === 'stop_limit') && (
                  <label>
                    <span>{t.agent.limitPrice}</span>
                    <Input
                      type="number"
                      prefix="$"
                      value={modalLimitPrice || ''}
                      onChange={e => setModalLimitPrice(parseFloat(e.target.value) || 0)}
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                    />
                  </label>
                )}
                {(modalOrderType === 'stop' || modalOrderType === 'stop_limit') && (
                  <label>
                    <span>{t.agent.stopPrice}</span>
                    <Input
                      type="number"
                      prefix="$"
                      value={modalStopPrice || ''}
                      onChange={e => setModalStopPrice(parseFloat(e.target.value) || 0)}
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                    />
                  </label>
                )}
                {modalOrderType === 'trailing_stop' && (
                  <>
                    <label>
                      <span>{t.agent.trailPrice}</span>
                      <Input
                        type="number"
                        prefix="$"
                        value={modalTrailPrice || ''}
                        onChange={e => { setModalTrailPrice(parseFloat(e.target.value) || 0); setModalTrailPercent(0); }}
                        min={0}
                        step={0.01}
                        placeholder="0.00"
                      />
                    </label>
                    <label>
                      <span>{t.agent.trailPercent}</span>
                      <Input
                        type="number"
                        suffix="%"
                        value={modalTrailPercent || ''}
                        onChange={e => { setModalTrailPercent(parseFloat(e.target.value) || 0); setModalTrailPrice(0); }}
                        min={0}
                        step={0.1}
                        placeholder="0.0"
                      />
                    </label>
                  </>
                )}
                </div>
              </section>

              <section className="agent-execution-modal__section agent-execution-modal__section--summary">
                <div className="agent-execution-modal__section-title"><span>02</span><h3>{agentModalCopy.estimateAndRisk}</h3></div>
                <dl className="agent-execution-modal__summary">
                <RO label={t.agent.estCost} value={estCost > 0 ? `$${estCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : 'N/A'} />
                <RO label={t.agent.riskGate} value={(r.riskGate || r.hardRiskGate || {}).status || r.riskGateStatus || 'N/A'} />
                <RO label="R/R" value={ep.riskReward1 ? `${ep.riskReward1.toFixed(1)}:1` : 'N/A'} />
                </dl>
              </section>

              {isReal && (
                <div className="agent-execution-modal__live-confirm">
                  <SafetyCertificateOutlined />
                  <div>
                    <strong>{t.agent.realTradingWarning}</strong>
                    <span>{agentModalCopy.liveFundsNotice}</span>
                    <label className={`agent-execution-modal__acceptance${orderRiskAccepted ? ' is-accepted' : ''}`}>
                      <Checkbox
                        checked={orderRiskAccepted}
                        onChange={(event) => setOrderRiskAccepted(event.target.checked)}
                        aria-label={agentModalCopy.liveAcceptance}
                      />
                      <span>{agentModalCopy.liveAcceptance}</span>
                    </label>
                  </div>
                </div>
              )}
              <div className="agent-execution-modal__footer">
                <Button onClick={() => { setOrderConfirmVisible(false); setOrderConfirmTarget(null); setOrderRiskAccepted(false); }}>{t.agent.cancel}</Button>
                <Button
                  type="primary"
                  onClick={handleConfirmOrder}
                  disabled={isReal && !orderRiskAccepted}
                >
                  {isReal ? t.agent.submitRealOrder : t.agent.submitPaperOrder}
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Cancel Order Confirmation Modal */}
      <Modal
        title={<div className="agent-execution-modal__simple-title"><span>{agentModalCopy.cancelEyebrow}</span><strong>{t.agent.cancelOrder}</strong></div>}
        open={cancelConfirmVisible}
        onCancel={() => { if (cancelLoading) return; setCancelConfirmVisible(false); setCancelTarget(null); }}
        footer={null}
        width={440}
        centered
        maskClosable={false}
        closable={!cancelLoading}
        keyboard={!cancelLoading}
        destroyOnHidden
        className="agent-execution-modal agent-cancel-order-modal"
      >
        {cancelTarget && (() => {
          const r = cancelTarget.record;
          return (
            <div className="agent-execution-modal__content">
              <div className="agent-cancel-order-modal__notice">
                <WarningOutlined />
                <div><strong>{t.agent.cancelOrderConfirm}</strong><span>{agentModalCopy.cancelDescription}</span></div>
              </div>
              <dl className="agent-cancel-order-modal__details">
                <div><dt>{t.agent.colSymbol}</dt><dd>{r.symbol}</dd></div>
                <div><dt>{t.agent.orderId}</dt><dd className="is-monospace">{r.alpacaOrderId || 'N/A'}</dd></div>
                <div><dt>{t.agent.qty}</dt><dd>{r.userQty || r.positionSizeShares || 'N/A'}</dd></div>
                <div><dt>{t.agent.orderType}</dt><dd>{r.orderType || 'market'}</dd></div>
                <div><dt>{agentModalCopy.mode}</dt><dd>{tradeMode === 'paper' ? agentModalCopy.paperAccount : agentModalCopy.liveAccount}</dd></div>
              </dl>
              <div className="agent-execution-modal__footer">
                <Button disabled={cancelLoading} onClick={() => { setCancelConfirmVisible(false); setCancelTarget(null); }}>{t.agent.keepOrder}</Button>
                <Button danger loading={cancelLoading} onClick={handleCancelOrder}>{t.agent.cancelOrder}</Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* 1.6 AI Watchlist */}
      <div className={`agent-watchlist-panel ${aiWatchlistItems.length === 0 ? 'is-empty' : ''}`} id="research-watchlist">
        <Card
          className="premium-card"
          styles={{ body: { padding: 0 } }}
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--app-border-soft)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  width: 36, height: 36, borderRadius: 10, 
                  background: 'var(--app-blue-bg)', 
                  color: '#1890ff', display: 'flex', alignItems: 'center', 
                  justifyContent: 'center', fontSize: 18,
                  border: '1px solid rgba(24, 144, 255, 0.2)'
                }}>
                  <EyeOutlined />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--app-text-strong)', letterSpacing: 0 }}>{t.agent.aiWatchlist}</span>
                    <Tag color="processing" bordered={false} style={{ fontSize: 11, fontWeight: 800, borderRadius: 6, margin: 0, padding: '0 8px' }}>
                      {aiWatchlistItems.length}
                    </Tag>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--app-text-muted)', fontWeight: 500 }}>{t.agent.activeEntryMonitoring}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Input
                  placeholder={t.agent.searchSymbol}
                  size="small"
                  prefix={<SearchOutlined style={{ color: 'var(--app-text-muted)' }} />}
                  value={aiWatchlistSearch}
                  onChange={e => setAiWatchlistSearch(e.target.value.toUpperCase())}
                  style={{ width: 160, borderRadius: 8, fontSize: 12, height: 32, background: 'var(--app-card-bg-soft)', border: '1px solid var(--app-border)' }}
                  allowClear
                />
                <Divider type="vertical" style={{ height: 24, margin: 0, opacity: 0.5 }} />
                <Button
                  type="text"
                  icon={<ReloadOutlined spin={aiWatchlistLoading} />}
                  onClick={() => { setAiWatchlistLoading(true); refreshWatchlistPrices().finally(() => setAiWatchlistLoading(false)); }}
                  style={{ color: 'var(--app-text-muted)', fontWeight: 600, fontSize: 13, background: 'var(--app-card-bg-soft)', border: '1px solid var(--app-border)', borderRadius: 8, height: 32 }}
                >
                  {t.agent.refresh}
                </Button>
                {aiWatchlistItems.length > 0 && (
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={clearAllWatchlist}
                    style={{ fontWeight: 600, fontSize: 13, background: 'rgba(255, 77, 79, 0.1)', border: '1px solid rgba(255, 77, 79, 0.2)', borderRadius: 8, height: 32 }}
                  >
                    {agentText('Clear', '清空')}
                  </Button>
                )}
              </div>
            </div>
          }
        >
          {aiWatchlistItems.length > 0 && (
            <div className="agent-watchlist-summary" style={{
              padding: '16px 20px',
              background: 'var(--app-card-bg-soft)', borderBottom: '1px solid var(--app-border-soft)' 
            }}>
              {[
                { label: t.agent.total, value: aiWatchlistItems.length, color: 'var(--app-text-strong)', icon: <EyeOutlined /> },
                { label: t.agent.waitingEntry, value: aiWatchlistItems.filter(i => getWatchlistReadiness(i) === 'Waiting Entry').length, color: '#d97706', icon: <ClockCircleOutlined /> },
                { label: t.agent.reviewRequired, value: aiWatchlistItems.filter(i => i.riskGateStatus === 'REVIEW').length, color: '#2563eb', icon: <ExclamationCircleOutlined /> },
                { label: t.agent.readyOrHot, value: aiWatchlistItems.filter(i => getWatchlistReadiness(i) === 'Ready').length, color: '#059669', icon: <ThunderboltOutlined /> }
              ].map((stat) => (
                  <div className="agent-watchlist-summary__stat" key={stat.label}>
                    <div className="agent-watchlist-summary__icon" style={{
                      width: 32, height: 32, borderRadius: 8, background: 'var(--app-card-bg)', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: stat.color, border: '1px solid var(--app-border)'
                    }}>
                      {stat.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--app-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{stat.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: stat.color, lineHeight: 1.1 }}>{stat.value}</div>
                    </div>
                  </div>
              ))}
              <div className="agent-watchlist-summary__feed">
                <Tag color="blue" bordered={false} style={{ fontSize: 9, margin: 0, fontWeight: 700, borderRadius: 4 }}>{t.agent.alpacaRealTimeFeed}</Tag>
              </div>
            </div>
          )}

          {aiWatchlistItems.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', background: 'var(--app-card-bg)' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--app-card-bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: '1px dashed var(--app-border)' }}>
                <EyeOutlined style={{ fontSize: 20, color: 'var(--app-text-muted)' }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--app-text-strong)', marginBottom: 4 }}>{agentText('No watchlist candidates yet', '观察列表暂无候选标的')}</div>
              <div style={{ fontSize: 13, color: 'var(--app-text-muted)', marginBottom: 16 }}>{agentText('Candidates watched from Entry Plan appear here for automated entry monitoring.', '从入场计划加入观察的候选会显示在这里，并持续监控入场条件。')}</div>
              <div className="agent-watchlist-empty-tags">
                <Tag bordered={false} style={{ margin: 0, color: 'var(--app-text-muted)', background: 'var(--app-card-bg-soft)', borderRadius: 4 }}>{agentText('Waiting for Entry Plan', '等待入场计划')}</Tag>
                <Tag bordered={false} style={{ margin: 0, color: 'var(--app-text-muted)', background: 'var(--app-card-bg-soft)', borderRadius: 4 }}>{agentText('Entry-zone monitoring', '监控入场区间')}</Tag>
                <Tag bordered={false} style={{ margin: 0, color: 'var(--app-text-muted)', background: 'var(--app-card-bg-soft)', borderRadius: 4 }}>{agentText('Alerts ready', '提醒已就绪')}</Tag>
              </div>
            </div>
          ) : (
            <div className="watchlist-table-container" style={{ width: '100%', overflowX: 'auto' }}>
              <style>{`
                .watchlist-table .ant-table-thead > tr > th { 
                  background: var(--app-card-bg-soft) !important; 
                  padding: 12px 16px !important; 
                  color: var(--app-text-muted) !important;
                  font-weight: 700 !important;
                  font-size: 11px !important;
                  letter-spacing: 0.5px !important;
                  border-bottom: 1px solid var(--app-border-soft) !important;
                }
                .watchlist-table .ant-table-tbody > tr > td { padding: 12px 16px !important; border-bottom: 1px solid var(--app-border-soft) !important; }
                .watchlist-row:hover > td { background-color: rgba(82, 196, 26, 0.1) !important; }
                .watchlist-row-expanded > td { background-color: var(--app-card-bg-soft) !important; }
                .ant-table-fixed-right { background: var(--app-card-bg) !important; }
              `}</style>
              <Table
                className="watchlist-table"
                dataSource={aiWatchlistItems.filter(item => item.symbol.toLowerCase().includes(aiWatchlistSearch.toLowerCase()))}
                rowKey="id"
                size="middle"
                pagination={aiWatchlistItems.length > 10 ? { pageSize: 10, size: 'small' } : false}
                scroll={{ x: 1250 }}
                rowClassName={(record) => record.id === expandedRows[0] ? 'watchlist-row watchlist-row-expanded' : 'watchlist-row'}
                style={{ fontSize: 12 }}
                expandable={{
                  expandedRowRender: (record: any) => {
                    const ep = entryPlanResultsBySymbol[record.symbol] || normalizeWatchlistToEntryPlan(record);
                    return renderEntryPlanDetail(ep);
                  },
                }}
                columns={[
                  {
                    title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 11, textTransform: 'uppercase' }}>{t.agent.colSymbol}</span>,
                    dataIndex: 'symbol',
                    key: 'symbol',
                    width: 100,
                    fixed: 'left' as const,
                    render: (text: string, record: any) => (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--app-text-strong)', letterSpacing: 0 }}>{text}</span>
                        {record.isDevTest && <Tag style={{ fontSize: 8, padding: '0 4px', lineHeight: '14px', margin: 0, fontWeight: 700 }} color="red">DEV</Tag>}
                      </div>
                    ),
                  },
                  {
                    title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 11, textTransform: 'uppercase' }}>{t.agent.price}</span>,
                    key: 'currentPrice',
                    width: 100,
                    render: (record: any) => {
                      const p = record.currentPrice;
                      if (!p) return <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>;
                      return <span style={{ fontWeight: 700, color: 'var(--app-text-strong)', fontSize: 14 }}>${p.toFixed(2)}</span>;
                    },
                  },
                  {
                    title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 11, textTransform: 'uppercase' }}>{t.agent.chgPercent}</span>,
                    key: 'changePercent',
                    width: 90,
                    render: (record: any) => {
                      const c = exitFinite(record.changePercent);
                      if (c == null) return <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>;
                      return <span style={{ color: exitValueTone(c), fontSize: 13, fontWeight: 800 }}>{exitPercent(c, true)}</span>;
                    },
                  },
                  {
                    title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 11, textTransform: 'uppercase' }}>{t.agent.colEntryZone}</span>,
                    key: 'entryZone',
                    width: 150,
                    render: (record: any) => {
                      const { low: lo, high: hi } = getEntryPlanZone(record);
                      if (!lo && !hi) return <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>;
                      return <span style={{ fontSize: 13, color: 'var(--app-text-strong)', fontWeight: 600, fontFamily: 'Inter' }}>{exitPrice(lo)} – {exitPrice(hi)}</span>;
                    },
                  },
                  {
                    title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 11, textTransform: 'uppercase' }}>{t.agent.stopTarget}</span>,
                    key: 'levels',
                    width: 140,
                    render: (record: any) => (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ color: 'rgba(182, 74, 56, 0.88)', fontSize: 12, fontWeight: 600 }}>S: {exitPrice(record.stopLoss)}</span>
                        <span style={{ color: '#3d7a47', fontSize: 12, fontWeight: 600 }}>T: {exitPrice(record.takeProfit1)}</span>
                      </div>
                    )
                  },
                  {
                    title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 11, textTransform: 'uppercase' }}>R/R</span>,
                    dataIndex: 'riskReward',
                    key: 'riskReward',
                    width: 70,
                    render: (v: number | null) => v ? <span style={{ fontWeight: 700, color: v >= 2 ? '#10b981' : 'var(--app-text-muted)', fontSize: 13 }}>{v.toFixed(1)}x</span> : <span style={{ color: '#d1d5db' }}>—</span>,
                  },
                  {
                    title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 11, textTransform: 'uppercase' }}>{t.agent.status}</span>,
                    key: 'status',
                    width: 130,
                    render: (record: any) => {
                      const r = getWatchlistReadiness(record);
                      return <Tag color={getReadinessColor(r)} bordered={false} style={{ fontSize: 10, fontWeight: 800, padding: '0 10px', borderRadius: 6, height: 22, lineHeight: '22px' }}>{translateReadiness(r).toUpperCase()}</Tag>;
                    },
                  },
                  {
                    title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 11, textTransform: 'uppercase' }}>{t.agent.colSource}</span>,
                    key: 'source',
                    width: 110,
                    render: (record: any) => {
                      const src = record.selectedBy || record.source || 'Entry Plan';
                      const color = src === 'Continue' ? 'success' : src === 'Watch-to-Validate' ? 'warning' : 'blue';
                      const label = src === 'Watch-to-Validate'
                        ? agentText('Watch→Val', '观察→验证')
                        : src === 'Entry Plan'
                          ? agentText('Entry Plan', '入场计划')
                          : src === 'Continue'
                            ? agentText('Continue', '继续')
                            : src;
                      return <Tag color={color} style={{ fontSize: 9, margin: 0, padding: '0 6px', borderRadius: 4, fontWeight: 700 }}>{label.toUpperCase()}</Tag>;
                    },
                  },
                  {
                    title: '',
                    key: 'actions',
                    width: 140,
                    fixed: 'right' as const,
                    render: (record: any) => {
                      const ep = entryPlanResultsBySymbol[record.symbol] || {};
                      const alreadyIn = isInExecutionList(record.symbol);
                      return (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <Tooltip title={t.agent.buyThisStock}>
                            <Button
                              type="primary"
                              size="small"
                              style={{ fontSize: 11, fontWeight: 700, borderRadius: 6, height: 28, padding: '0 12px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                openBuyModal(record.symbol, {
                                  qty: ep.positionSizeShares || record.positionSizeShares || record.shares,
                                  limitPrice: getEntryPlanZone(ep).high || getEntryPlanZone(ep).low || getEntryPlanZone(record).high || getEntryPlanZone(record).low || getEntryPlanCurrentPrice(record) || undefined,
                                  takeProfitPrice: ep.takeProfit1 || record.takeProfit1,
                                  stopLossPrice: ep.stopLoss || record.stopLoss,
                                });
                              }}
                            >
                              {t.agent.buy}
                            </Button>
                          </Tooltip>
                          <Tooltip title={alreadyIn ? t.agent.alreadyInExecutionTooltip : t.agent.addToExecution}>
                            <Button
                              type="default"
                              size="small"
                              disabled={alreadyIn}
                              icon={<PlusOutlined style={{ fontSize: 12 }} />}
                              style={{ 
                                fontSize: 11, fontWeight: 700, borderRadius: 6, height: 28, padding: '0 8px',
                                color: alreadyIn ? '#d1d5db' : '#1890ff', 
                                borderColor: alreadyIn ? 'var(--app-border)' : '#1890ff',
                                background: alreadyIn ? 'var(--app-card-bg-soft)' : 'var(--app-blue-bg)'
                              }}
                              onClick={(e) => { e.stopPropagation(); addToExecution(record); }}
                            >
                              {t.agent.addToWatchlist}
                            </Button>
                          </Tooltip>
                          <Tooltip title={t.agent.removeFromWatchlistTooltip}>
                            <Button
                              type="text"
                              size="small"
                              danger
                              icon={<DeleteOutlined style={{ fontSize: 14 }} />}
                              onClick={(e) => { e.stopPropagation(); removeFromWatchlist(record.id, record.symbol); }}
                              style={{ padding: 0, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}
                            />
                          </Tooltip>
                        </div>
                      );
                    },
                  },
                ]}
              />
            </div>
          )}
        </Card>
      </div>

      </section>

      <section className="agent-research-pipeline-block" aria-labelledby="research-pipeline-title">
      <div className="agent-section-heading agent-pipeline-heading" id="research-pipeline">
        <div>
          <span>{agentText('Decision engine', '决策引擎')}</span>
          <h2 id="research-pipeline-title">{agentText('Research Pipeline', '研究流程')}</h2>
        </div>
        <div className="agent-pipeline-heading-actions">
          <b>{agentText('Deterministic scores · AI challenge · hard risk gates', '确定性评分 · AI 质询 · 硬性风险门控')}</b>
          {pipelineRunning ? (
            <Button
              danger
              type="primary"
              className="agent-pipeline-action agent-pipeline-stop-button"
              icon={<PauseCircleOutlined />}
              onClick={stopPipeline}
            >
              {agentText('Stop Auto Pipeline', '停止自动流程')}
            </Button>
          ) : (
            <Button
              type="primary"
              className="agent-pipeline-action agent-pipeline-start-button"
              icon={<ThunderboltOutlined />}
              onClick={() => runAIPipeline({ trigger: 'manual' })}
              disabled={autoRunActive || isAnyScanRunning}
            >
              {agentText('Auto Pipeline', '自动流程')}
            </Button>
          )}
        </div>
      </div>

      {/* 2. Market Scanner */}
      <CollapsibleStageSection
        stageNumber="01"
        stageLabel={agentText('Stage', '阶段')}
        expandLabel={agentText('Expand', '展开')}
        collapseLabel={agentText('Collapse', '收起')}
        title={t.agent.marketScanner}
        icon={<LineChartOutlined />}
        statusText={
          detailedScanStatus.currentStatus === 'scanning' ? t.agent.statusScanning :
          detailedScanStatus.currentStatus === 'completed' ? t.agent.statusCompleted :
          detailedScanStatus.currentStatus === 'error' ? t.agent.statusError :
          detailedScanStatus.currentStatus === 'stopping' ? t.agent.statusStopping :
          detailedScanStatus.currentStatus === 'stopped' ? t.agent.statusStopped2 : t.agent.statusIdle
        }
        statusColor={
          detailedScanStatus.currentStatus === 'scanning' ? 'processing' :
          detailedScanStatus.currentStatus === 'completed' ? 'success' :
          detailedScanStatus.currentStatus === 'error' ? 'error' : 'default'
        }
        progressValue={detailedScanStatus.currentStatus === 'scanning' || detailedScanStatus.currentStatus === 'completed' ? scannerProgressPercent : null}
        progressText={detailedScanStatus.currentStatus === 'scanning' ? `${scannerStageIndex}/${scannerStageCount} · ${scannerStageLabel}` : undefined}
        summaryChips={marketScannerResults.length > 0 ? [
          { label: agentText('Ranked', '已排名'), value: marketScannerResults.length },
          { label: agentText('Priority A', '优先级 A'), value: marketScannerResults.filter((r: any) => r.selectionLabel === 'Priority A').length, color: 'var(--app-positive)' },
          { label: agentText('AI Reviewed', 'AI 已审核'), value: marketScannerResults.filter((r: any) => r.aiCalled && r.aiSuccess !== false).length, color: 'var(--app-accent)' },
          { label: agentText('AI Challenge', 'AI 已质询'), value: marketScannerResults.filter((r: any) => r.aiChallenged || r.aiTraderDecision === 'Watch' || r.aiTraderDecision === 'Avoid').length, color: '#d97706' },
          ...(marketScannerResults.filter((r: any) => r.analysisStatus === 'failed').length > 0
            ? [{ label: t.agent.needDataLabel.replace(':', ''), value: marketScannerResults.filter((r: any) => r.analysisStatus === 'failed').length, color: '#ff4d4f' }]
            : []),
        ] : undefined}
        actionButton={
          <Tooltip title={pipelineRunning && detailedScanStatus.currentStatus !== 'scanning' ? t.agent.pipelineDisabled : ''}>
            <span>
              <Button
                type={detailedScanStatus.currentStatus === 'scanning' ? 'default' : 'primary'}
                danger={detailedScanStatus.currentStatus === 'scanning'}
                icon={detailedScanStatus.currentStatus === 'scanning' ? <PauseCircleOutlined /> : <ThunderboltOutlined />}
                onClick={handleToggleMarketScanner}
                loading={detailedScanStatus.currentStatus === 'stopping'}
                disabled={pipelineRunning && detailedScanStatus.currentStatus !== 'scanning'}
                style={AI_AGENT_PRIMARY_BTN_STYLE}
              >
                {detailedScanStatus.currentStatus === 'scanning' ? t.agent.stop : t.agent.runScanner}
              </Button>
            </span>
          </Tooltip>
        }
        isRunning={detailedScanStatus.currentStatus === 'scanning'}
        expanded={scannerExpanded}
        onToggle={() => setScannerExpanded(!scannerExpanded)}
      >
        <MarketScannerWorkbench
          results={marketScannerResults}
          displayedResults={displayedMarketScannerResults}
          detailedStatus={detailedScanStatus}
          totalSymbols={detailedScanStatus.totalCount || marketScannerStatus.totalSymbols || 0}
          progressPercent={scannerProgressPercent}
          stageIndex={scannerStageIndex}
          stageCount={scannerStageCount}
          stageLabel={scannerStageLabel}
          stageDetail={scannerStageDetail}
          etaLabel={scannerEtaLabel}
          progressSteps={scannerProgressSteps}
          viewFilter={marketScannerFilters.trendFilter}
          onViewFilterChange={(value) => setMarketScannerFilters(prev => ({ ...prev, trendFilter: value }))}
          expandedRows={expandedRows}
          onToggleRow={toggleRowExpand}
          renderDetail={renderDetailPanel}
        />

      </CollapsibleStageSection>

      {/* 3. Fine Scan */}
      <CollapsibleStageSection
        stageNumber="02"
        stageLabel={agentText('Stage', '阶段')}
        expandLabel={agentText('Expand', '展开')}
        collapseLabel={agentText('Collapse', '收起')}
        title={t.agent.fineScan}
        icon={<ThunderboltOutlined />}
        statusText={
          fineScanStatus === 'running' ? t.agent.statusRunning :
          fineScanStatus === 'completed' ? t.agent.statusCompleted :
          fineScanStatus === 'stopped' ? t.agent.statusStopped :
          fineScanStatus === 'error' ? t.agent.statusError : t.agent.statusIdle
        }
        statusColor={
          fineScanStatus === 'running' ? 'processing' :
          fineScanStatus === 'completed' ? 'success' :
          fineScanStatus === 'stopped' ? 'warning' :
          fineScanStatus === 'error' ? 'error' : 'default'
        }
        progressValue={(fineScanStatus === 'running' || fineScanStatus === 'stopped') && fineScanProgress > 0 ? fineScanProgress : null}
        summaryChips={fineScanResults.length > 0 ? [
          { label: t.agent.scanned, value: fineScanResults.length },
          { label: t.agent.continueLabel.replace(':', ''), value: fineScanResults.filter((r: any) => r.decision === 'Continue').length, color: 'var(--app-positive)' },
          { label: t.agent.watchLabel.replace(':', ''), value: fineScanResults.filter((r: any) => r.decision === 'Watch').length, color: '#faad14' },
          { label: t.agent.rejectLabel.replace(':', ''), value: fineScanResults.filter((r: any) => r.decision === 'Reject').length, color: '#ff4d4f' },
          { label: t.agent.needDataLabel.replace(':', ''), value: fineScanResults.filter((r: any) => r.decision === 'NeedMoreData').length, color: '#fa8c16' },
        ] : undefined}
        actionButton={
          <Tooltip title={pipelineRunning ? t.agent.pipelineDisabled : ''}>
            <span>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={handleRunFineScan}
                disabled={fineScanStatus === 'running' || marketScannerResults.length === 0 || pipelineRunning}
                loading={fineScanStatus === 'running'}
                style={AI_AGENT_PRIMARY_BTN_STYLE}
              >
                {fineScanStatus === 'running' ? t.agent.fineScanRunning : t.agent.runFineScan}
              </Button>
            </span>
          </Tooltip>
        }
        isRunning={fineScanStatus === 'running'}
        expanded={fineScanExpanded}
        onToggle={() => setFineScanExpanded(!fineScanExpanded)}
      >
        <Card styles={{ body: { padding: '24px' } }} style={{ borderRadius: '12px', border: '1px solid var(--app-border-soft)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <FineScanWorkbench
            results={fineScanResults}
            status={fineScanStatus}
            progress={fineScanProgress}
            currentStep={fineScanCurrentStep}
            message={fineScanMessage}
            expandedRows={fineScanExpandedRows}
            onToggleRow={(symbol: string) => setFineScanExpandedRows((previous: string[]) => (
              previous.includes(symbol) ? previous.filter(item => item !== symbol) : [...previous, symbol]
            ))}
          />

        </Card>
      </CollapsibleStageSection>

      {/* ===== Deeper Validation ===== */}
      <CollapsibleStageSection
        stageNumber="03"
        stageLabel={agentText('Stage', '阶段')}
        expandLabel={agentText('Expand', '展开')}
        collapseLabel={agentText('Collapse', '收起')}
        title={t.agent.deeperValidation}
        icon={<BarChartOutlined />}
        statusText={
          deeperValidationStatus === 'loading' ? t.agent.statusValidating :
          deeperValidationStatus === 'completed' ? t.agent.statusCompleted :
          deeperValidationStatus === 'stopped' ? t.agent.statusInterrupted :
          deeperValidationStatus === 'error' ? t.agent.statusError : t.agent.statusIdle
        }
        statusColor={
          deeperValidationStatus === 'loading' ? 'processing' :
          deeperValidationStatus === 'completed' ? 'success' :
          deeperValidationStatus === 'stopped' ? 'warning' :
          deeperValidationStatus === 'error' ? 'error' : 'default'
        }
        progressValue={
          deeperValidationStatus === 'loading' ? dvProgress :
          deeperValidationStatus === 'completed' ? 100 :
          null
        }
        progressText={deeperValidationStatus === 'loading' ? dvProgressStage : undefined}
        summaryChips={(() => {
          const bd = validationCandidateBreakdown();
          if (deeperValidationResults) {
            return [
              { label: agentText('Tested', '已测试'), value: deeperValidationResults.length },
              { label: agentText('Pass DV', '验证通过'), value: deeperValidationResults.filter((r: any) => r.dvDecision === 'PASS_DV' || r.verdict === 'Confirmed').length, color: 'var(--app-positive)' },
              { label: agentText('Watch', '观察'), value: deeperValidationResults.filter((r: any) => r.dvDecision === 'WATCH' || r.verdict === 'Watch').length, color: '#faad14' },
              { label: agentText('Rejected', '已拒绝'), value: deeperValidationResults.filter((r: any) => r.dvDecision === 'REJECT' || r.dvDecision === 'NEED_DATA' || r.verdict === 'Rejected' || r.verdict === 'Reject').length, color: '#ff4d4f' },
              { label: 'AI', value: deeperValidationResults.filter((r: any) => r.aiValidationUsed).length, color: 'var(--app-accent-secondary)' },
            ];
          }
          if (bd.total > 0) {
            const chips: any[] = [
              { label: t.agent.continueAction, value: bd.continueCount, color: 'var(--app-positive)' },
            ];
            if (bd.watchCount > 0) {
              chips.push({ label: t.agent.watchToValidate, value: bd.watchCount, color: '#faad14' });
            }
            return chips;
          }
          return undefined;
        })()}
        actionButton={
          <Tooltip title={pipelineRunning ? t.agent.pipelineDisabled : ''}>
            <span>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleDeeperValidation}
                loading={deeperValidationStatus === 'loading'}
                disabled={fineScanStatus !== 'completed' || fineScanResults.length === 0 || selectValidationCandidates().length === 0 || pipelineRunning}
                style={AI_AGENT_PRIMARY_BTN_STYLE}
              >
            {deeperValidationStatus === 'loading' ? t.agent.validating : (() => {
              const bd = validationCandidateBreakdown();
              if (bd.watchCount > 0) {
                return `${t.agent.runValidation} (${bd.continueCount}C + ${bd.watchCount}W = ${bd.total})`;
              }
              return `${t.agent.runValidation} (${bd.total})`;
            })()}
              </Button>
            </span>
          </Tooltip>
        }
        isRunning={deeperValidationStatus === 'loading'}
        expanded={dvExpanded}
        onToggle={() => setDvExpanded(!dvExpanded)}
      >
        <DeeperValidationWorkbench
          results={deeperValidationResults || []}
          status={deeperValidationStatus}
          progress={dvProgress}
          currentStep={dvProgressStage}
          message={dvErrorMessage || undefined}
          errors={dvErrors}
          expandedRows={expandedRows}
          onToggleRow={(symbol: string) => setExpandedRows(prev => prev.includes(symbol) ? prev.filter(item => item !== symbol) : [...prev, symbol])}
        />

      </CollapsibleStageSection>

      {/* ▲▲▲ Above: Deeper Validation ▲▲▲ */}

      {/* ▲▲▲ Below: Entry Plan ▲▲▲ */}
      <CollapsibleStageSection
        stageNumber="04"
        stageLabel={agentText('Stage', '阶段')}
        expandLabel={agentText('Expand', '展开')}
        collapseLabel={agentText('Collapse', '收起')}
        title={t.agent.entryPlan}
        icon={<RobotOutlined />}
        statusText={
          entryPlanStatus === 'loading' ? t.agent.generatingLabel :
          entryPlanStatus === 'completed' ? (entryPlanResults && entryPlanResults.length > 0 ? t.agent.completedLabel : agentText('Completed — No Candidates', '已完成 — 无候选')) :
          entryPlanStatus === 'stopped' ? t.agent.interruptedLabel2 :
          entryPlanStatus === 'error' ? t.agent.errorLabel : agentText('IDLE', '空闲')
        }
        statusColor={
          entryPlanStatus === 'loading' ? 'processing' :
          entryPlanStatus === 'completed' ? (entryPlanResults && entryPlanResults.length > 0 ? 'success' : 'warning') :
          entryPlanStatus === 'stopped' ? 'warning' :
          entryPlanStatus === 'error' ? 'error' : 'default'
        }
        summaryChips={entryPlanResults && entryPlanResults.length > 0 ? [
          { label: t.agent.entryPlan, value: entryPlanResults.length },
          { label: t.agent.buyLabel, value: entryPlanResults.filter((p: any) => getEntryPlanEffectiveAction(p) === 'BUY_READY').length, color: 'var(--app-positive)' },
          { label: agentText('Review', '待审核'), value: entryPlanResults.filter((p: any) => getEntryPlanEffectiveAction(p) === 'READY_REVIEW').length, color: 'var(--app-accent-secondary)' },
          { label: agentText('Wait', '等待入场'), value: entryPlanResults.filter((p: any) => getEntryPlanEffectiveAction(p) === 'WAIT_FOR_ENTRY').length, color: '#faad14' },
          { label: agentText('Need Data', '需要数据'), value: entryPlanResults.filter((p: any) => getEntryPlanEffectiveAction(p) === 'NEED_DATA').length, color: '#ff7a45' },
          ...(entryPlanResults.filter((p: any) => ['BLOCKED_BY_RISK', 'SKIP'].includes(getEntryPlanEffectiveAction(p))).length > 0 ? [{ label: agentText('Blocked', '已阻断'), value: entryPlanResults.filter((p: any) => ['BLOCKED_BY_RISK', 'SKIP'].includes(getEntryPlanEffectiveAction(p))).length, color: '#ff4d4f' }] : []),
        ] : (entryPlanStatus === 'completed' ? [{ label: t.agent.entryPlan, value: 0 }, { label: agentText('Empty', '空'), value: agentText('No candidates passed DV', '没有候选通过深度验证') }] : undefined)}
        actionButton={
          <Tooltip title={pipelineRunning ? t.agent.pipelineDisabled : !getEntryPlanCandidates().length ? agentText('No confirmed DV candidates. Only PASS_DV / Confirmed candidates advance to Entry Plan.', '没有已确认的深度验证候选。只有“验证通过 / 已确认”的候选会进入入场计划。') : ''}>
            <span>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                loading={entryPlanStatus === 'loading'}
                disabled={entryPlanStatus === 'loading' || !getEntryPlanCandidates().length || pipelineRunning}
                onClick={handleRunEntryPlan}
                style={AI_AGENT_PRIMARY_BTN_STYLE}
              >
                {t.agent.runEntryPlan}
              </Button>
            </span>
          </Tooltip>
        }
        isRunning={entryPlanStatus === 'loading'}
        expanded={entryPlanExpanded}
        onToggle={() => setEntryPlanExpanded(!entryPlanExpanded)}
      >
          {admissionStatus !== 'idle' && (
            <div className="epv2-admission-band">
              <div className="epv2-admission-title">
                <SafetyCertificateOutlined />
                <span>{agentText('Portfolio Admission', '组合准入')}</span>
                <Tag bordered={false} className={`epv2-admission-status epv2-admission-status-${admissionStatus}`}>
                  {admissionStatus === 'loading' ? agentText('Checking', '检查中') : agentEnumLabel(admissionStatus)}
                </Tag>
              </div>
              <div className="epv2-admission-metrics">
                <div><span>{agentText('DV Eligible', '深度验证合格')}</span><b>{admissionSummary?.eligibleDvCount ?? admissionResults?.length ?? 0}</b></div>
                <div><span>{agentText('Admit', '准入')}</span><b className="epv2-tone-ready">{admissionSummary?.counts?.ADMIT ?? admissionResults?.filter((row: any) => row.admissionDecision === 'ADMIT').length ?? 0}</b></div>
                <div><span>{agentText('Hold', '暂缓')}</span><b className="epv2-tone-wait">{admissionSummary?.counts?.HOLD ?? admissionResults?.filter((row: any) => row.admissionDecision === 'HOLD').length ?? 0}</b></div>
                <div><span>{agentText('Block', '阻断')}</span><b className="epv2-tone-block">{admissionSummary?.counts?.BLOCK ?? admissionResults?.filter((row: any) => row.admissionDecision === 'BLOCK').length ?? 0}</b></div>
                <div><span>{agentText('AI Challenge', 'AI 质询')}</span><b>{admissionSummary?.ai?.challengedSymbols ?? 0}</b></div>
                <div><span>{agentText('Capacity', '剩余容量')}</span><b>{admissionSummary?.availablePortfolioSlots ?? '--'} {agentText('slots', '个名额')}</b></div>
              </div>
              <div className="epv2-admission-note">
                {agentText('Only admitted, fresh, strategy-consistent candidates can enter sizing and execution planning.', '只有通过准入、数据新鲜且策略一致的候选，才能进入仓位计算与执行计划。')}
              </div>
            </div>
          )}

          {/* No DV candidates yet */}
          {deeperValidationStatus !== 'completed' && deeperValidationStatus !== 'stopped' && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#bbb', fontSize: '12px', fontStyle: 'italic' }}>
              {t.agent.noValidatedCandidatesYet}
            </div>
          )}

          {/* DV done but no confirmed/watch candidates */}
          {(deeperValidationStatus === 'completed' || deeperValidationStatus === 'stopped') && getEntryPlanCandidates().length === 0 && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#bbb', fontSize: '12px', fontStyle: 'italic' }}>
              {agentText('No confirmed DV candidates. Watch names remain in revalidation.', '没有已确认的深度验证候选；观察标的会继续留在复核流程中。')}
            </div>
          )}

          {/* DV done, candidates available */}
          {(deeperValidationStatus === 'completed' || deeperValidationStatus === 'stopped') && getEntryPlanCandidates().length > 0 && entryPlanStatus === 'idle' && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#999', fontSize: '12px' }}>
              {agentText(`${getEntryPlanCandidates().length} confirmed DV candidates are ready.`, `${getEntryPlanCandidates().length} 个深度验证候选已就绪。`)} <strong>{t.agent.runEntryPlan}</strong>{agentText(' to generate execution plans.', '即可生成执行计划。')}
            </div>
          )}

          {/* Loading */}
          {entryPlanStatus === 'loading' && (
            <div className="epv2-loading">
              <div className="epv2-loading-head">
                <Spin indicator={<LoadingOutlined style={{ fontSize: 20 }} spin />} />
                <div><b>{agentText('Building executable plans', '正在构建可执行计划')}</b><span>{t.agent.computingEntryZones}</span></div>
              </div>
              <div className="epv2-loading-rail"><span /></div>
              <div className="epv2-loading-stages">
                <span>{agentText('Account preflight', '账户预检')}</span><span>{agentText('Fresh quotes', '实时报价')}</span><span>{agentText('Risk sizing', '风险定仓')}</span><span>{agentText('AI challenge', 'AI 质询')}</span>
              </div>
            </div>
          )}

          {/* Error */}
          {entryPlanStatus === 'error' && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#ff4d4f' }}>
              <CloseCircleOutlined style={{ fontSize: 20 }} />
              <div style={{ marginTop: 4 }}>{t.agent.entryPlanFailed}</div>
            </div>
          )}

          {/* Results */}
          {(entryPlanStatus === 'completed' || entryPlanStatus === 'stopped') && entryPlanResults && entryPlanResults.length > 0 && renderEntryPlanWorkbench()}
      </CollapsibleStageSection>
      {/* End Entry Plan Section */}

      {/* ── Exit Scan Section ── */}
      <CollapsibleStageSection
        stageNumber="05"
        stageLabel={agentText('Stage', '阶段')}
        expandLabel={agentText('Expand', '展开')}
        collapseLabel={agentText('Collapse', '收起')}
        title={t.agent.exitScan}
        icon={<SwapOutlined />}
        statusText={
          exitScanStatus === 'scanning' ? t.agent.scanningLabel :
          exitScanStatus === 'completed' ? t.agent.completedLabel :
          exitScanStatus === 'skipped' ? `${t.agent.skippedLabel}: ${t.agent.noActiveHoldings}` :
          exitScanStatus === 'failed' ? t.agent.errorLabel :
          exitScanStatus === 'stopped' ? t.agent.stoppedLabel : agentText('IDLE', '空闲')
        }
        statusColor={
          exitScanStatus === 'scanning' ? 'processing' :
          exitScanStatus === 'completed' ? 'success' :
          exitScanStatus === 'skipped' ? 'warning' :
          exitScanStatus === 'failed' ? 'error' :
          exitScanStatus === 'stopped' ? 'warning' : 'default'
        }
        isRunning={exitScanStatus === 'scanning'}
        expanded={exitScanExpanded}
        onToggle={() => setExitScanExpanded(!exitScanExpanded)}
        actionButton={
          <div style={{ display: 'flex', gap: 8 }}>
            {exitScanStatus !== 'idle' && exitScanStatus !== 'scanning' && exitScanStatus !== 'skipped' && (
              <Tooltip title={t.agent.clearResults}>
                <Button
                  size="middle"
                  icon={<DeleteOutlined />}
                  onClick={(e) => { e.stopPropagation(); scannerStateStore.resetExitScan(); }}
                  style={{ borderRadius: '8px', height: '32px', display: 'flex', alignItems: 'center' }}
                />
              </Tooltip>
            )}
            <Tooltip title={holdings.length === 0 ? t.agent.noActiveHoldings : ''}>
              <span>
                <Button
                  type={exitScanStatus === 'scanning' ? 'default' : 'primary'}
                  danger={exitScanStatus === 'scanning'}
                  icon={exitScanStatus === 'scanning' ? <PauseCircleOutlined /> : <ThunderboltOutlined />}
                  loading={exitScanRunning && exitScanStatus !== 'scanning'}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (exitScanStatus === 'scanning') {
                      setExitScanStatus('stopped');
                      setExitScanRunning(false);
                    } else {
                      runExitScan();
                      if (!exitScanExpanded) setExitScanExpanded(true);
                    }
                  }}
                  disabled={holdings.length === 0 && exitScanStatus !== 'scanning'}
                  style={{
                    borderRadius: '8px',
                    fontWeight: 700,
                    height: '32px',
                    padding: '0 16px',
                    display: 'flex',
                    alignItems: 'center',
                    boxShadow: exitScanStatus !== 'scanning' && holdings.length > 0 ? '0 2px 6px rgba(24,144,255,0.3)' : 'none'
                  }}
                >
                  {exitScanStatus === 'scanning' ? t.agent.stopScanner : exitScanStatus === 'completed' || exitScanStatus === 'stopped' || exitScanStatus === 'skipped' ? t.agent.reRunExitScan : t.agent.runExitScan}
                </Button>
              </span>
            </Tooltip>
          </div>
        }
      >
        <div className="exit-plan-intro">
          <div>
            <strong>{agentText('Position lifecycle control', '持仓生命周期控制')}</strong>
            <span>{agentText('Initial risk stays fixed. Stops may only ratchet tighter; structural targets do not drift between scans.', '初始风险保持固定；止损只能向更安全的方向收紧，结构性目标不会在扫描之间漂移。')}</span>
          </div>
          <div className="exit-plan-cadence">
            <SyncOutlined />
            <span>{agentText(`${pipelineAutoStatus?.positionGuard?.intervalSeconds || 60}s guard`, `每 ${pipelineAutoStatus?.positionGuard?.intervalSeconds || 60} 秒检查`)}</span>
            <i>{exitScanSummary?.scanPolicy?.engine || 'position_lifecycle_v2'}</i>
          </div>
        </div>

        {/* Summary stats */}
        {exitScanResults.length > 0 && (
          <div className="exit-plan-summary">
            {[
              { label: t.agent.scanned, value: exitScanResults.length, color: 'var(--app-text-strong)', icon: <SearchOutlined /> },
              { label: agentText('Hard exits', '强制退出'), value: exitScanResults.filter((r: any) => r.triggerAction === 'emergency_exit').length, color: '#b42318', icon: <ThunderboltOutlined /> },
              { label: agentText('Protected', '已保护'), value: exitScanResults.filter((r: any) => r.protection?.hasFullStopCoverage || String(r.status || '').startsWith('protected')).length, color: '#16835d', icon: <SafetyCertificateOutlined /> },
              { label: agentText('Targets met', '已达目标'), value: exitScanResults.filter((r: any) => r.triggerAction === 'target_reached').length, color: '#a16207', icon: <ClockCircleOutlined /> },
              { label: agentText('Needs review', '需要复核'), value: exitScanResults.filter((r: any) => String(r.status || '').includes('review') || ['unprotected', 'blocked', 'blocked_external_order'].includes(String(r.status || '')) || r.triggerAction === 'event_review').length, color: '#c2410c', icon: <WarningOutlined /> },
              { label: agentText('Stop ratchets', '止损已上调'), value: exitScanResults.filter((r: any) => r.action === 'ratchet_stop').length, color: '#2563eb', icon: <CheckCircleOutlined /> },
            ].map((stat, idx) => (
              <React.Fragment key={stat.label}>
                <div className="exit-plan-summary-item">
                  <div style={{ color: stat.color }}>{stat.icon}</div>
                  <div>
                    <span>{stat.label}</span>
                    <strong style={{ color: stat.color }}>{stat.value}</strong>
                  </div>
                </div>
                {idx < 5 && <Divider type="vertical" />}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Results table */}
        {exitScanResults.length > 0 ? (
          <div className="exitscan-table-container">
            <Table
              className="exitscan-table"
              dataSource={exitScanResults}
              rowKey="symbol"
              size="middle"
              pagination={exitScanResults.length > 12 ? { pageSize: 12, size: 'small', showSizeChanger: false } : false}
              scroll={{ x: 1260 }}
              rowClassName="exitscan-row"
              expandable={{
                expandRowByClick: true,
                expandedRowRender: (record: any) => {
                  const plan = record.exitPlan || {};
                  const indicators = record.indicators || {};
                  const protection = record.protection || {};
                  const eventContext = record.eventContext || {};
                  const aiReview = record.aiExitReview || {};
                  const source = exitScanSummary?.marketData?.source || agentText('Alpaca market data', 'Alpaca 市场数据');
                  const rMultiple = exitFinite(plan.rMultiple);
                  const drawdown = exitFinite(plan.drawdownFromHighPct);
                  const remainingRisk = exitFinite(plan.riskRemainingDollars);
                  return (
                    <div className="exit-plan-detail" onClick={(event) => event.stopPropagation()}>
                      <div className="exit-plan-detail-heading">
                        <div>
                          <span>{agentText('Position control record', '持仓控制记录')}</span>
                          <strong>{record.symbol} / {agentEnumLabel(plan.state || 'MONITORING')}</strong>
                        </div>
                        <div className="exit-plan-detail-policy">
                          <Tag color="blue">{agentText('Stop: ratchet only', '止损：仅可收紧')}</Tag>
                          <Tag>{agentText('Target: fixed', '目标：固定')}</Tag>
                          <Tag color={record.dataQuality === 'GOOD' ? 'success' : 'warning'}>{agentEnumLabel(record.dataQuality || 'PARTIAL')} {agentText('data', '数据')}</Tag>
                        </div>
                      </div>

                      <div className="exit-plan-detail-grid">
                        <section className="exit-plan-detail-panel">
                          <header>
                            <span>01</span>
                            <div><strong>{agentText('Risk lifecycle', '风险生命周期')}</strong><small>{agentText('Geometry established at entry', '价位结构在入场时确定')}</small></div>
                          </header>
                          <div className="exit-plan-metric-grid">
                            <ExitMetric label={agentText('Initial stop', '初始止损')} value={exitPrice(plan.initialStop)} />
                            <ExitMetric label={agentText('Current stop', '当前止损')} value={exitPrice(plan.currentStop)} tone={exitFinite(plan.currentStop) && exitFinite(plan.initialStop) && Number(plan.currentStop) > Number(plan.initialStop) ? 'good' : 'default'} />
                            <ExitMetric label={agentText('Target 1', '目标 1')} value={exitPrice(plan.target1)} />
                            <ExitMetric label={agentText('Target 2', '目标 2')} value={exitPrice(plan.target2)} />
                            <ExitMetric label={agentText('R multiple', 'R 倍数')} value={rMultiple == null ? '—' : `${rMultiple.toFixed(2)}R`} tone={rMultiple != null && rMultiple >= 1 ? 'good' : rMultiple != null && rMultiple < 0 ? 'risk' : 'default'} />
                            <ExitMetric label="MFE" value={exitFinite(plan.mfeR) == null ? '—' : `${Number(plan.mfeR).toFixed(2)}R`} />
                            <ExitMetric label={agentText('High-water', '持仓最高价')} value={exitPrice(plan.highWaterMark)} />
                            <ExitMetric label={agentText('Drawdown from high', '距高点回撤')} value={exitPercent(drawdown)} tone={drawdown != null && drawdown <= -5 ? 'warn' : 'default'} />
                            <ExitMetric label={agentText('Risk remaining', '剩余风险')} value={exitMoney(remainingRisk)} tone={remainingRisk != null && remainingRisk > 0 ? 'warn' : 'good'} />
                            <ExitMetric label={agentText('Profit locked', '已锁定利润')} value={exitMoney(plan.lockedProfitDollars)} tone={exitFinite(plan.lockedProfitDollars) && Number(plan.lockedProfitDollars) > 0 ? 'good' : 'default'} />
                            <ExitMetric label={agentText('Allocation', '配置比例')} value={exitPercent(plan.allocationPct)} />
                            <ExitMetric label={agentText('Allocation review at', '配置复核阈值')} value={exitPercent(plan.maxPositionReviewPct)} />
                            <ExitMetric label={agentText('Days held / time stop', '持有天数 / 时间止损')} value={`${plan.daysHeld ?? '—'} / ${plan.timeStopDays ?? '—'}${agentText('d', '天')}`} />
                          </div>
                        </section>

                        <section className="exit-plan-detail-panel">
                          <header>
                            <span>02</span>
                            <div><strong>{agentText('Market evidence', '市场证据')}</strong><small>{agentText('Observable inputs, not forecasts', '采用可观察数据，而非预测')}</small></div>
                          </header>
                          <div className="exit-plan-metric-grid">
                            <ExitMetric label="ATR 14" value={exitPrice(indicators.atr14)} />
                            <ExitMetric label="ATR %" value={exitPercent(indicators.atrPct)} />
                            <ExitMetric label="EMA 20" value={exitPrice(indicators.ema20)} />
                            <ExitMetric label="EMA 50" value={exitPrice(indicators.ema50)} />
                            <ExitMetric label="RSI 14" value={exitFinite(indicators.rsi14)?.toFixed(1) || '—'} />
                            <ExitMetric label={agentText('Realized vol 20', '20 日实现波动率')} value={exitPercent(indicators.realizedVol20)} />
                            <ExitMetric label="ADV 20" value={exitMoney(indicators.adv20)} />
                            <ExitMetric label={agentText('Bid / ask', '买价 / 卖价')} value={`${exitPrice(indicators.bid)} / ${exitPrice(indicators.ask)}`} />
                            <ExitMetric label={agentText('Spread', '价差')} value={exitPercent(indicators.spreadPct)} tone={exitFinite(indicators.spreadPct) && Number(indicators.spreadPct) > 0.5 ? 'warn' : 'default'} />
                            <ExitMetric label={agentText('Quote age', '报价延迟')} value={exitQuoteAge(indicators.quoteAgeSeconds)} tone={exitFinite(indicators.quoteAgeSeconds) && Number(indicators.quoteAgeSeconds) > 300 ? 'warn' : 'default'} />
                            <ExitMetric label={agentText('Position trend', '持仓趋势')} value={agentEnumLabel(indicators.trendState || 'unknown')} />
                            <ExitMetric label={agentText('SPY regime', 'SPY 市场环境')} value={agentEnumLabel(record.marketRegime || 'unknown')} />
                            <ExitMetric label={agentText('Event risk', '事件风险')} value={agentEnumLabel(eventContext.eventRisk || 'unknown')} tone={String(eventContext.eventRisk || '').toUpperCase() === 'HIGH' ? 'risk' : String(eventContext.eventRisk || '').toUpperCase() === 'MEDIUM' ? 'warn' : 'default'} />
                            <ExitMetric label={agentText('Next earnings', '下一财报')} value={eventContext.nextEarningsDate ? `${eventContext.nextEarningsDate}${eventContext.daysToEarnings != null ? ` / ${eventContext.daysToEarnings}${agentText('d', '天')}` : ''}` : '—'} />
                            <ExitMetric label={agentText('News tone', '新闻情绪')} value={eventContext.newsSentiment ? agentEnumLabel(eventContext.newsSentiment) : '—'} />
                            <ExitMetric label={agentText('Event tags', '事件标签')} value={(eventContext.eventTags || []).length ? eventContext.eventTags.slice(0, 3).join(', ') : '—'} />
                          </div>
                          {eventContext.topNewsHeadline && (
                            <div className="exit-plan-review-note">
                              <span>{agentText('Latest event evidence', '最新事件证据')}</span>
                              <strong>{eventContext.topNewsHeadline}</strong>
                              <p>{agentText('News and earnings can request review, but cannot loosen a stop or force an automatic sale by themselves.', '新闻与财报事件可以触发复核，但不能自行放宽止损，也不会单独触发自动卖出。')}</p>
                            </div>
                          )}
                        </section>

                        <section className="exit-plan-detail-panel">
                          <header>
                            <span>03</span>
                            <div><strong>{agentText('Broker protection', '券商保护单')}</strong><small>{agentText('Order ownership and review authority', '订单归属与复核权限')}</small></div>
                          </header>
                          <div className="exit-plan-metric-grid">
                            <ExitMetric label={agentText('Protection', '保护状态')} value={agentEnumLabel(protection.protectionStatus || 'none')} tone={protection.hasFullStopCoverage ? 'good' : 'risk'} />
                            <ExitMetric label={agentText('Open sell orders', '未成交卖单')} value={protection.orderCount ?? 0} />
                            <ExitMetric label={agentText('Stop coverage', '止损覆盖率')} value={exitPercent(protection.stopCoveragePct)} tone={protection.hasFullStopCoverage ? 'good' : 'risk'} />
                            <ExitMetric label={agentText('Broker stop', '券商止损价')} value={exitPrice(protection.stopPrice)} />
                            <ExitMetric label={agentText('Broker target', '券商目标价')} value={exitPrice(protection.targetPrice)} />
                            <ExitMetric label={agentText('Order owner', '订单归属')} value={protection.hasExternalOrders ? agentText('External / manual', '外部 / 手动') : protection.managedByAlphaLab ? 'AlphaLab' : agentText('None', '无')} tone={protection.hasExternalOrders ? 'warn' : 'default'} />
                            <ExitMetric label={agentText('AI authority', 'AI 权限')} value={agentText('Soft review only', '仅提供辅助复核')} />
                          </div>
                          <div className="exit-plan-review-note">
                            <span>{agentText('Deterministic decision', '确定性决策')}</span>
                            <strong>{record.reason || agentText('No lifecycle exception detected.', '未检测到持仓生命周期异常。')}</strong>
                            {aiReview.decision ? (
                              <p><b>AI {agentEnumLabel(aiReview.decision)}</b> / {aiReview.confidence ?? 0}%: {aiReview.reason || agentText('No additional challenge.', '没有额外质询。')}</p>
                            ) : (
                              <p>{agentText('AI did not change this record. Hard stops and broker protection always remain binding.', 'AI 未修改本次记录；硬性止损与券商保护单始终具有最终约束力。')}</p>
                            )}
                            {aiReview.nextCheck && <p>{agentText('Next check', '下一项检查')}: {aiReview.nextCheck}</p>}
                          </div>
                        </section>
                      </div>

                      <div className="exit-plan-detail-footer">
                        <span>{agentText('Source', '来源')}: {source}</span>
                        <span>{agentText('Bars as of', 'K 线截至')}: {indicators.barsAsOf || '—'}</span>
                        <span>{agentText('Evaluated', '评估时间')}: {plan.evaluatedAt ? new Date(plan.evaluatedAt).toLocaleString(isZh ? 'zh-CN' : 'en-US') : '—'}</span>
                      </div>
                    </div>
                  );
                },
              }}
              columns={[
                {
                  title: <span className="exit-plan-column-title">{agentText('Position', '持仓')}</span>,
                  key: 'position', width: 180, fixed: 'left' as const,
                  render: (_: unknown, record: any) => {
                    const sourceLabels: Record<string, string> = {
                      managed_plan: agentText('Managed plan', '受管计划'),
                      current_entry_plan: agentText('Entry plan', '入场计划'),
                      broker_reconstructed: agentText('Broker recovered', '券商记录重建'),
                    };
                    return (
                      <div className="exit-plan-position">
                        <strong>{record.symbol}</strong>
                        <span>{exitFinite(record.qty)?.toLocaleString(undefined, { maximumFractionDigits: 4 }) || '—'} {agentText('shares', '股')}</span>
                        <small>{sourceLabels[record.exitPlanSource || record.positionSource] || (record.exitPlanSource || record.positionSource ? agentEnumLabel(record.exitPlanSource || record.positionSource) : agentText('Recovered', '已重建'))}</small>
                      </div>
                    );
                  },
                },
                {
                  title: <span className="exit-plan-column-title">{agentText('Mark / P&L', '现价 / 盈亏')}</span>,
                  key: 'market', width: 145,
                  render: (_: unknown, record: any) => {
                    const gain = Number(record.plPct || 0) >= 0;
                    return (
                      <div className="exit-plan-market">
                        <strong>{exitPrice(record.currentPrice)}</strong>
                        <span className={gain ? 'is-gain' : 'is-loss'}>{exitPercent(record.plPct, true)} / {exitMoney(record.pl)}</span>
                        <small>{agentText('Entry', '入场价')} {exitPrice(record.avgEntry)}</small>
                      </div>
                    );
                  },
                },
                {
                  title: <span className="exit-plan-column-title">{agentText('Lifecycle', '生命周期')}</span>,
                  key: 'lifecycle', width: 170,
                  render: (_: unknown, record: any) => {
                    const plan = record.exitPlan || {};
                    const state = String(plan.state || 'MONITORING');
                    return (
                      <div className="exit-plan-lifecycle">
                        <Tag color={state === 'TRAILING' ? 'success' : state === 'BREAKEVEN' ? 'blue' : 'default'}>{agentEnumLabel(state)}</Tag>
                        <span>{exitFinite(plan.rMultiple) == null ? '—' : `${Number(plan.rMultiple).toFixed(2)}R`} {agentText('current', '当前')}</span>
                        <small>{exitPercent(plan.drawdownFromHighPct)} {agentText('from high', '距高点')}</small>
                      </div>
                    );
                  },
                },
                {
                  title: <span className="exit-plan-column-title">{agentText('Stop / target', '止损 / 目标')}</span>,
                  key: 'geometry', width: 190,
                  render: (_: unknown, record: any) => {
                    const plan = record.exitPlan || {};
                    return (
                      <div className="exit-plan-price-stack">
                        <span><i>{agentText('Stop', '止损')}</i><b className="is-stop">{exitPrice(plan.currentStop || record.stopPrice)}</b></span>
                        <span><i>{agentText('Target', '目标')}</i><b className="is-target">{exitPrice(plan.target1 || record.targetPrice)}</b></span>
                        <small>{agentText('Initial stop', '初始止损')} {exitPrice(plan.initialStop)}</small>
                      </div>
                    );
                  },
                },
                {
                  title: <span className="exit-plan-column-title">{agentText('Broker protection', '券商保护')}</span>,
                  key: 'protection', width: 190,
                  render: (_: unknown, record: any) => {
                    const protection = record.protection || {};
                    const protectedPosition = Boolean(protection.hasFullStopCoverage);
                    return (
                      <div className="exit-plan-protection">
                        <Tag color={protectedPosition ? 'success' : protection.hasTarget ? 'warning' : 'error'}>
                          {agentEnumLabel(protection.protectionStatus || 'none')}
                        </Tag>
                        <span>{protection.orderCount || 0} {agentText('orders', '个订单')} / {exitPercent(protection.stopCoveragePct)} {agentText('stop cover', '止损覆盖')}</span>
                        <small>{protection.hasExternalOrders ? agentText('External order owner', '外部订单持有') : protection.managedByAlphaLab ? agentText('Managed by AlphaLab', '由 AlphaLab 管理') : agentText('No broker protection', '无券商保护单')}</small>
                      </div>
                    );
                  },
                },
                {
                  title: <span className="exit-plan-column-title">{agentText('Decision / next action', '决策 / 下一步')}</span>,
                  key: 'decision', width: 255,
                  render: (_: unknown, record: any) => {
                    const action = String(record.action || record.triggerAction || 'monitor');
                    const riskActions = new Set(['emergency_exit', 'emergency_exit_submitted', 'manual_intervention']);
                    const reviewActions = new Set(['protection_required', 'review_open_orders', 'protected_review', 'time_exit_review', 'thesis_review', 'event_review', 'concentration_review']);
                    const color = riskActions.has(action) ? 'error' : reviewActions.has(action) || String(record.status).includes('review') ? 'warning' : action === 'ratchet_stop' ? 'blue' : 'success';
                    return (
                      <div className="exit-plan-decision">
                        <Tag color={color}>{agentEnumLabel(action)}</Tag>
                        <Tooltip title={record.reason} placement="topLeft">
                          <span>{record.reason || agentText('Continue lifecycle monitoring.', '继续监控持仓生命周期。')}</span>
                        </Tooltip>
                        <small>{record.aiExitReview?.decision ? `AI ${agentEnumLabel(record.aiExitReview.decision)} / ${record.aiExitReview.confidence || 0}%` : agentText('Deterministic control', '确定性控制')}</small>
                      </div>
                    );
                  },
                },
                {
                  title: <span className="exit-plan-column-title">{agentText('Evidence', '证据')}</span>,
                  key: 'evidence', width: 130,
                  render: (_: unknown, record: any) => (
                    <div className="exit-plan-evidence">
                      <Tag color={record.dataQuality === 'GOOD' ? 'success' : 'warning'}>{agentEnumLabel(record.dataQuality || 'PARTIAL')}</Tag>
                      <span>{exitQuoteAge(record.indicators?.quoteAgeSeconds)} {agentText('quote', '报价')}</span>
                      <small>{agentEnumLabel(record.marketRegime || 'unknown')} / {agentEnumLabel(record.eventContext?.eventRisk || 'unknown')} {agentText('event', '事件')}</small>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        ) : exitScanStatus === 'idle' ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div style={{ padding: '20px 0' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#4b5563' }}>{t.agent.noExitScanResults}</div>
                <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>{t.agent.clickRunExitScan}</div>
              </div>
            }
          />
        ) : exitScanStatus === 'scanning' ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--app-text-muted)' }}>
            <Spin size="large" /> 
            <div style={{ marginTop: 16, fontSize: 14, fontWeight: 500 }}>{t.agent.scanningHoldings}</div>
          </div>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div style={{ padding: '20px 0' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#4b5563' }}>{t.agent.noHoldingsRequireReview}</div>
                <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>{t.agent.exitScanEvaluates}</div>
              </div>
            }
          />
        )}
      </CollapsibleStageSection>
      {/* End Exit Scan Section */}
      </section>
      </div>

      {/* ── Unattended Live Automation Authorization ── */}
      <Modal
        rootClassName="agent-live-auto-modal"
        className="agent-live-auto-dialog"
        title={(
          <div className="agent-live-auto-heading">
            <span className="agent-live-auto-heading-icon" aria-hidden="true">
              <SafetyCertificateOutlined />
            </span>
            <div>
              <span>{liveAutoCopy.eyebrow}</span>
              <h2>{liveAutoCopy.title}</h2>
            </div>
            <span className="agent-live-auto-authority">
              <small>{liveAutoCopy.status}</small>
              <b>{liveAutoCopy.locked}</b>
            </span>
          </div>
        )}
        open={liveAutoConfirmOpen}
        onCancel={closeLiveAutoConfirmation}
        onOk={confirmLiveAutoTrading}
        confirmLoading={pipelineAutoLoading}
        okText={liveAutoCopy.confirm}
        cancelText={liveAutoCopy.cancel}
        okButtonProps={{ type: 'primary', disabled: !liveAutoRiskAccepted }}
        cancelButtonProps={{ disabled: pipelineAutoLoading }}
        closable={!pipelineAutoLoading}
        maskClosable={false}
        keyboard={!pipelineAutoLoading}
        width={640}
        destroyOnClose
      >
        <div className="agent-live-auto-content">
          <p className="agent-live-auto-intro">{liveAutoCopy.description}</p>

          <div className="agent-live-auto-facts">
            <div className="agent-live-auto-fact">
              <WalletOutlined aria-hidden="true" />
              <span>{liveAutoCopy.environment}</span>
              <strong>{tradingAccountData?.success ? liveAutoCopy.liveConnected : liveAutoCopy.liveConnectionRequired}</strong>
            </div>
            <div className="agent-live-auto-fact">
              <ClockCircleOutlined aria-hidden="true" />
              <span>{liveAutoCopy.schedule}</span>
              <strong>
                {pipelineSchedule === 'off'
                  ? liveAutoCopy.scheduleOff
                  : liveAutoCopy.scheduleEvery(pipelineSchedule)}
              </strong>
            </div>
            <div className="agent-live-auto-fact">
              <SwapOutlined aria-hidden="true" />
              <span>{liveAutoCopy.orders}</span>
              <strong>{liveAutoCopy.orderScope}</strong>
            </div>
            <div className="agent-live-auto-fact">
              <SafetyCertificateOutlined aria-hidden="true" />
              <span>{liveAutoCopy.risk}</span>
              <strong>{liveAutoCopy.riskScope}</strong>
            </div>
          </div>

          <section className="agent-live-auto-boundaries" aria-label={liveAutoCopy.boundariesTitle}>
            <h3>{liveAutoCopy.boundariesTitle}</h3>
            <div>
              <span>01</span>
              <p>{liveAutoCopy.backgroundBoundary}</p>
            </div>
            <div>
              <span>02</span>
              <p>{liveAutoCopy.modeBoundary}</p>
            </div>
            <div>
              <span>03</span>
              <p>{liveAutoCopy.gateBoundary}</p>
            </div>
          </section>

          <div className="agent-live-auto-note" role="note">
            <InfoCircleOutlined aria-hidden="true" />
            <span>{liveAutoCopy.note}</span>
          </div>

          <label className={`agent-live-auto-acceptance${liveAutoRiskAccepted ? ' is-accepted' : ''}`}>
            <Checkbox
              checked={liveAutoRiskAccepted}
              onChange={(event) => setLiveAutoRiskAccepted(event.target.checked)}
              disabled={pipelineAutoLoading}
            />
            <span>{liveAutoCopy.acceptance}</span>
          </label>
        </div>
      </Modal>

      {/* ── Execution Confirmation Modal ── */}
      <Modal
        title={(
          <div className="agent-execution-modal__heading">
            <div>
              <span>{agentModalCopy.executionEyebrow}</span>
              <strong>{entryPlanExecutionMode.toLowerCase().includes('live') ? t.agent.liveTradingConfirmation : t.agent.confirmOrderExecution}</strong>
            </div>
            <em className={entryPlanExecutionMode.toLowerCase().includes('live') ? 'is-live' : 'is-paper'}>
              <i />{entryPlanExecutionMode.toLowerCase().includes('live') ? agentModalCopy.liveAccount : agentModalCopy.paperAccount}
            </em>
          </div>
        )}
        open={executeModalVisible}
        onCancel={() => { if (executeLoading) return; setExecuteModalVisible(false); setExecuteTarget(null); setLiveOrderAccepted(false); }}
        onOk={confirmExecutePlan}
        confirmLoading={executeLoading}
        okText={entryPlanExecutionMode.toLowerCase().includes('live') ? t.agent.confirmLiveOrder : t.agent.submitOrder}
        okButtonProps={{
          disabled: entryPlanExecutionMode.toLowerCase().includes('live')
            && !liveOrderAccepted,
        }}
        cancelText={t.agent.cancel}
        cancelButtonProps={{ disabled: executeLoading }}
        width={600}
        centered
        maskClosable={false}
        closable={!executeLoading}
        keyboard={!executeLoading}
        destroyOnHidden
        className="agent-execution-modal agent-plan-execution-modal"
      >
        {executeTarget && (() => {
          const isLive = entryPlanExecutionMode.toLowerCase().includes('live');
          const { low, high } = getEntryPlanZone(executeTarget);
          const shares = Number(executeTarget.positionSizeShares || executeTarget.shares || 0);
          const estimatedValue = shares * Number(low || 0);
          return (
            <div className="agent-execution-modal__content">
              <div className="agent-execution-modal__instrument">
                <div><span>{agentModalCopy.planSummary}</span><strong>{executeTarget.symbol}</strong></div>
                <Tag color="green" bordered={false}>{t.agent.buy}</Tag>
              </div>

              <dl className="agent-plan-execution-modal__details">
                <div><dt>{agentModalCopy.setup}</dt><dd>{executeTarget.setup || '—'}</dd></div>
                <div><dt>{t.agent.orderTypeLabel}</dt><dd>{(executeTarget.executionDetails || {}).orderTypeSuggestion || '—'}</dd></div>
                <div><dt>{t.agent.sharesLabel}</dt><dd>{shares.toLocaleString(undefined, { maximumFractionDigits: 4 })}</dd></div>
                <div><dt>{agentModalCopy.entryZone}</dt><dd>{low != null && high != null ? `${exitPrice(low)} – ${exitPrice(high)}` : '—'}</dd></div>
                <div><dt>{agentModalCopy.expectedValue}</dt><dd>{estimatedValue > 0 ? exitMoney(estimatedValue) : '—'}</dd></div>
                <div><dt>{agentModalCopy.riskBudget}</dt><dd>{exitMoney(executeTarget.riskDollars)}</dd></div>
                <div><dt>{agentModalCopy.protectiveExit}</dt><dd>{exitPrice(executeTarget.stopLoss)} / {exitPrice(executeTarget.takeProfit1)}</dd></div>
                <div><dt>{agentModalCopy.mode}</dt><dd>{isLive ? agentModalCopy.liveAccount : agentModalCopy.paperAccount}</dd></div>
              </dl>

              {isLive && (
                <div className="agent-execution-modal__live-confirm">
                  <SafetyCertificateOutlined />
                  <div>
                    <strong>{t.agent.realTradingWarning}</strong>
                    <span>{agentModalCopy.liveFundsNotice}</span>
                    <label className={`agent-execution-modal__acceptance${liveOrderAccepted ? ' is-accepted' : ''}`}>
                      <Checkbox
                        checked={liveOrderAccepted}
                        onChange={(event) => setLiveOrderAccepted(event.target.checked)}
                        disabled={executeLoading}
                        aria-label={agentModalCopy.liveAcceptance}
                      />
                      <span>{agentModalCopy.liveAcceptance}</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Order Modal */}
      {orderModalVisible && (
        <OrderModal
          visible
          onClose={() => { setOrderModalVisible(false); setOrderModalPreset(undefined); }}
          onSuccess={handleOrderSuccess}
          preset={orderModalPreset}
        />
      )}

    </div>
  );

}
export default Agent;
