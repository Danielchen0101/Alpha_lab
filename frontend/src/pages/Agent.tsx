import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useTradeMode } from '../contexts/TradeModeContext';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend as RechartsLegend, ResponsiveContainer } from 'recharts'; // eslint-disable-line @typescript-eslint/no-unused-vars
import {
  Card, Typography, Space, Statistic, Row, Col,
  Button, Divider, Table, Tag, Form, Input, Empty,
  message, Progress, Badge, Alert, Tooltip, Spin, Modal, Pagination, Steps, Select, Segmented, Switch
} from 'antd';
import {
  LineChartOutlined, BarChartOutlined,
  SettingOutlined, PauseCircleOutlined, SearchOutlined,
  ThunderboltOutlined, CheckCircleOutlined, ClockCircleOutlined,
  RobotOutlined, CloseCircleOutlined, ExclamationCircleOutlined, SyncOutlined, LoadingOutlined, SafetyCertificateOutlined,
  ArrowUpOutlined, ArrowDownOutlined, ArrowRightOutlined, MinusOutlined,
  InfoCircleOutlined,
  CaretDownOutlined, CaretRightOutlined,
  DeleteOutlined, ReloadOutlined, PlusOutlined, CheckOutlined, EyeOutlined,
  WalletOutlined, FundOutlined, SwapOutlined, WarningOutlined
} from '@ant-design/icons';
import aiTradingService from '../services/aiTradingService';
import { backtraderAPI, entryQualityAPI, fineScanAdvancedAPI, deeperValidationAPI, entryPlanAPI, fineScanExplainAPI, fineScanDecisionAPI, tradingAccountAPI, aiAgentWatchlistAPI, aiExecutionAPI, pipelineAutoAPI } from '../services/api';
import api from '../services/api';
import OrderModal from '../components/OrderModal';
import marketDataService from '../services/marketDataService';
import { scannerStateStore } from '../services/scannerStateStore';
import {
  startMarketScanner, stopMarketScannerByUser, isScanRunning,
  registerFineScanRun, unregisterFineScanRun, isFineScanRunning,
  registerDeeperValidationRun, unregisterDeeperValidationRun, isDeeperValidationRunning,
  registerEntryPlanRun, unregisterEntryPlanRun, isEntryPlanRunning,
} from '../services/scannerRunnerService';

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

const AI_AGENT_COMPACT_BTN_STYLE: React.CSSProperties = {
  borderRadius: '4px',
  fontWeight: 600,
  height: '24px',
  fontSize: '11px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 8px'
};

// Small inline tag used in Entry Quality detail panel
// Collapsible Stage Section Component
interface CollapsibleStageSectionProps {
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
  title, icon, statusText, statusColor, progressValue, progressText,
  summaryChips, actionButton, isRunning, expanded, onToggle, children
}) => {
  const statusTagColor = statusColor || (isRunning ? 'processing' : 'default');
  
  // Custom styles for different status colors to match professional palette
  const getStatusStyle = () => {
    if (isRunning) return { background: 'rgba(24, 144, 255, 0.05)', border: '1px solid #91caff' };
    if (statusColor === 'success') return { background: 'rgba(82, 196, 26, 0.03)', border: '1px solid #b7eb8f' };
    if (statusColor === 'error') return { background: 'rgba(255, 77, 79, 0.03)', border: '1px solid #ffa39e' };
    return { background: '#fff', border: '1px solid #f0f0f0' };
  };

  const sectionStyle = getStatusStyle();

  return (
    <div style={{ 
      marginBottom: 20, 
      borderRadius: 12, 
      overflow: 'hidden',
      boxShadow: expanded ? '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)' : '0 2px 8px rgba(0, 0, 0, 0.03)',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      border: sectionStyle.border
    }}>
      <div
        onClick={onToggle}
        style={{
          display: 'flex', 
          alignItems: 'center', 
          height: 60,
          padding: '0 20px', 
          background: sectionStyle.background,
          cursor: 'pointer', 
          transition: 'all 0.2s',
          userSelect: 'none',
          borderBottom: expanded ? sectionStyle.border : 'none'
        }}
      >
        {/* Expand icon */}
        <span style={{ 
          marginRight: 12, 
          fontSize: 10, 
          color: expanded ? '#1890ff' : '#bfbfbf', 
          flexShrink: 0,
          transition: 'transform 0.3s'
        }}>
          {expanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
        </span>

        {/* Title + Icon */}
        <span style={{ 
          fontSize: 16, 
          fontWeight: 700, 
          color: '#262626', 
          marginRight: 16, 
          flexShrink: 0, 
          display: 'flex', 
          alignItems: 'center', 
          gap: 10 
        }}>
          <span style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 8,
            background: isRunning ? '#1890ff15' : '#f5f5f5',
            color: isRunning ? '#1890ff' : '#595959',
            fontSize: 18
          }}>
            {icon}
          </span>
          {title}
        </span>

        {/* Status badge */}
        {statusText && (
          <Tag 
            color={statusTagColor} 
            style={{ 
              margin: 0, 
              fontSize: 11, 
              fontWeight: 700,
              letterSpacing: '0.03em',
              lineHeight: '22px', 
              padding: '0 12px', 
              marginRight: 16,
              borderRadius: 20,
              textTransform: 'uppercase',
              border: 'none',
              boxShadow: isRunning ? '0 0 0 2px rgba(24, 144, 255, 0.1)' : 'none'
            }}
          >
            {isRunning && <SyncOutlined spin style={{ marginRight: 6 }} />}
            {statusText}
          </Tag>
        )}

        {/* Progress bar (compact 6px) */}
        {progressValue !== null && progressValue !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 16, minWidth: 150, flexShrink: 0 }}>
            <div style={{ flex: 1, height: 8, background: '#f0f0f0', borderRadius: 10, overflow: 'hidden' }}>
              <div 
                style={{ 
                  width: `${Math.min(100, Math.max(0, progressValue))}%`, 
                  height: '100%', 
                  background: isRunning ? 'linear-gradient(90deg, #1890ff, #69b1ff)' : '#52c41a', 
                  borderRadius: 10, 
                  transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)' 
                }} 
              />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#595959', minWidth: 38, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(progressValue)}%
            </span>
          </div>
        )}
        
        {progressText && (progressValue === null || progressValue === undefined) && (
          <span style={{ fontSize: 13, color: '#8c8c8c', marginRight: 16, fontStyle: 'italic' }}>{progressText}</span>
        )}

        {/* Summary chips */}
        {summaryChips && summaryChips.length > 0 && (
          <div style={{ display: 'flex', gap: 10, marginRight: 16, flexWrap: 'wrap' }}>
            {summaryChips.map((chip, i) => (
              <span key={i} style={{ 
                fontSize: 12, 
                fontWeight: 600,
                color: '#434343', 
                background: '#f5f5f5', 
                borderRadius: 6, 
                padding: '3px 10px', 
                lineHeight: '20px',
                border: '1px solid #e8e8e8'
              }}>
                <span style={{ color: '#8c8c8c' }}>{chip.label}:</span> <span style={{ color: chip.color || '#262626', fontWeight: 800 }}>{chip.value}</span>
              </span>
            ))}
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Action button */}
        {actionButton && (
          <div onClick={(e) => e.stopPropagation()} style={{ marginLeft: 16 }}>
            {actionButton}
          </div>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: '24px', background: '#fff' }}>
          {children}
        </div>
      )}
    </div>
  );
};

// AI分析结果类型定义 - V3格式
// 趋势分析结果类型
const Agent: React.FC = (): React.ReactElement => {
  console.log('Portfolio component rendering');
  const navigate = useNavigate();
  const { t, language, translateSector } = useLanguage();
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

  const [aiConfigForm] = Form.useForm();

  // ── Persistent Scanner State (from scannerStateStore) ──
  const [scannerSnapshot, setScannerSnapshot] = useState(() => scannerStateStore.getState());

  useEffect(() => {
    const unsubscribe = scannerStateStore.subscribe((state) => {
      setScannerSnapshot(state);
    });
    return unsubscribe;
  }, []);

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
    // Continue Scan: only reset if status says processing but no module-level loop exists
    if (state.continueScan.status === 'processing' && !isScanRunning()) {
      scannerStateStore.updateContinueScan({ status: 'idle' });
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
  const continueScanStatus = scannerSnapshot.continueScan.status;
  const continueScanProgress = scannerSnapshot.continueScan.progress;
  const preferredContinueScanList = scannerSnapshot.continueScan.results;
  const continueScanDetails = scannerSnapshot.continueScan.details;
  const fineScanStatus = scannerSnapshot.fineScan.status;
  const fineScanResults = scannerSnapshot.fineScan.results;
  const fineScanProgress = scannerSnapshot.fineScan.progress;
  const fineScanMessage = scannerSnapshot.fineScan.message;
  const fineScanExpandedRows = scannerSnapshot.fineScan.expandedRows;

  // Deeper Validation and Entry Plan from store
  const deeperValidationStatus = scannerSnapshot.deeperValidation.status;
  const deeperValidationResults = scannerSnapshot.deeperValidation.results;
  const entryPlanStatus = scannerSnapshot.entryPlan.status;
  const entryPlanResults = scannerSnapshot.entryPlan.results;

  // Exit Scan from store
  const exitScanStatus = scannerSnapshot.exitScan.status;
  const exitScanResults = scannerSnapshot.exitScan.results;
  const submittedExitOrders = scannerSnapshot.exitScan.submittedExitOrders;

  // Setter wrappers that update the store
  const setContinueScanStatus = useCallback((status: any) => {
    scannerStateStore.updateContinueScan({ status });
  }, []);

  const setContinueScanProgress = useCallback((progress: number) => {
    scannerStateStore.updateContinueScan({ progress });
  }, []);

  const setPreferredContinueScanList = useCallback((results: any) => {
    const next = typeof results === 'function' ? results(scannerStateStore.getState().continueScan.results) : results;
    scannerStateStore.setContinueScanResults(next);
  }, []);

  const setContinueScanDetails = useCallback((updater: any) => {
    const current = scannerStateStore.getState().continueScan.details;
    const next = typeof updater === 'function' ? updater(current) : updater;
    scannerStateStore.updateContinueScan({ details: next });
  }, []);

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

  const [preferredContinuePage, setPreferredContinuePage] = useState(1);

  // Trading Account Mode (global context)
  const { tradeMode, setTradeMode } = useTradeMode();
  const [tradingAccountData, setTradingAccountData] = useState<any>(null);
  const [tradingAccountLoading, setTradingAccountLoading] = useState(false);

  // Trading Preferences (local to AI Agent, persisted in localStorage)
  type RiskProfile = 'low' | 'medium' | 'high';
  type TimeHorizon = 'short' | 'mid' | 'long';
  const [riskProfile, setRiskProfile] = useState<RiskProfile>(() => {
    const stored = localStorage.getItem('agent_riskProfile');
    return (stored === 'low' || stored === 'high') ? stored : 'medium';
  });
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>(() => {
    const stored = localStorage.getItem('agent_timeHorizon');
    return (stored === 'short' || stored === 'long') ? stored : 'mid';
  });
  const handleRiskProfileChange = (val: string | number) => {
    const v = val as RiskProfile;
    setRiskProfile(v);
    localStorage.setItem('agent_riskProfile', v);
  };
  const handleTimeHorizonChange = (val: string | number) => {
    const v = val as TimeHorizon;
    setTimeHorizon(v);
    localStorage.setItem('agent_timeHorizon', v);
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

  // Ref for runAIPipeline so timer callbacks always call the latest version
  const runAIPipelineRef = useRef<(opts?: { trigger?: string }) => Promise<void>>();
  useEffect(() => { runAIPipelineRef.current = async (opts?: { trigger?: string }) => { await runAIPipeline(opts); }; });
  const [aiExecutionList, setAiExecutionList] = useState<any[]>(() => {
    try {
      return scannerStateStore.getAiExecutionCandidates();
    } catch { return []; }
  });
  const [pipelineMode, setPipelineMode] = useState<'ai' | 'hybrid' | 'manual'>(() => {
    const saved = localStorage.getItem('pipelineMode');
    return saved === 'ai' || saved === 'hybrid' || saved === 'manual' ? saved : 'hybrid';
  });

  // AI mode auto-confirms orders for both paper and real trading
  const shouldAutoConfirmOrder = pipelineMode === 'ai';
  const [pipelineSchedule, setPipelineSchedule] = useState<'off' | '15m' | '30m' | '1h' | '2h'>(() => {
    const saved = localStorage.getItem('pipelineSchedule');
    return saved === '15m' || saved === '30m' || saved === '1h' || saved === '2h' ? saved : 'off';
  });
  const [lastPipelineRun, setLastPipelineRun] = useState<string | null>(() => {
    return scannerStateStore.getPipelineSchedule().lastRunAt;
  });
  const [nextPipelineRun, setNextPipelineRun] = useState<string | null>(() => {
    return scannerStateStore.getPipelineSchedule().nextRunAt;
  });
  const pipelineTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ref to prevent duplicate auto-run triggers from backend scheduler
  const autoRunTriggeredRef = useRef<string | null>(null);

  const SCHEDULE_INTERVALS: Record<string, number> = { '15m': 15 * 60 * 1000, '30m': 30 * 60 * 1000, '1h': 60 * 60 * 1000, '2h': 120 * 60 * 1000 };

  // Pipeline Auto (market-hours scheduler) state
  const [pipelineAutoStatus, setPipelineAutoStatus] = useState<any>(null);
  const [pipelineAutoLoading, setPipelineAutoLoading] = useState(false);
  const [pipelineAutoHistory, setPipelineAutoHistory] = useState<any[]>([]);
  const [pipelineAutoHistoryExpanded, setPipelineAutoHistoryExpanded] = useState(false);
  const [pipelineAutoSchedule, setPipelineAutoSchedule] = useState<any[] | null>(null);
  const [pipelineAutoScheduleSource, setPipelineAutoScheduleSource] = useState<string>('');
  const [pipelineAutoScheduleWarning, setPipelineAutoScheduleWarning] = useState<string>('');
  const [pipelineAutoScheduleLoading, setPipelineAutoScheduleLoading] = useState(false);
  const [pipelineAutoScheduleExpanded, setPipelineAutoScheduleExpanded] = useState(false);
  const [pipelineAutoScheduleError, setPipelineAutoScheduleError] = useState<string>('');

  const fetchPipelineAutoStatus = useCallback(async () => {
    try {
      const res = await pipelineAutoAPI.getStatus();
      if (res.data.success) {
        setPipelineAutoStatus(res.data);
      }
    } catch {
      // Backend may not be available
    }
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
        setPipelineAutoScheduleWarning(res.data.warning || '');
      } else {
        setPipelineAutoSchedule([]);
        setPipelineAutoScheduleError((res.data as any).message || 'API returned error');
      }
    } catch (err: any) {
      setPipelineAutoSchedule([]);
      setPipelineAutoScheduleError(err?.message || 'Failed to fetch market schedule');
    } finally {
      setPipelineAutoScheduleLoading(false);
    }
  }, []);

  // Fetch schedule when expanded
  useEffect(() => {
    if (pipelineAutoScheduleExpanded) {
      fetchPipelineAutoSchedule();
    }
  }, [pipelineAutoScheduleExpanded, fetchPipelineAutoSchedule]);

  // Save pipeline-auto config when schedule changes
  const savePipelineAutoConfig = useCallback(async (schedule: 'off' | '15m' | '30m' | '1h' | '2h') => {
    setPipelineAutoLoading(true);
    const wasOff = pipelineSchedule === 'off';
    try {
      const enabled = schedule !== 'off';
      const intervalMap: Record<string, number> = { '15m': 15, '30m': 30, '1h': 60, '2h': 120 };
      await pipelineAutoAPI.saveConfig({
        enabled,
        intervalMinutes: enabled ? intervalMap[schedule] : null,
        mode: pipelineMode,
      });
      // Fetch updated status
      await fetchPipelineAutoStatus();
      // Toggle-on immediate run: when switching from Off to On with market open
      if (enabled && wasOff && runAIPipelineRef.current) {
        console.log('[AutoRun] Toggle-on immediate trigger after 500ms delay');
        autoRunTriggeredRef.current = 'armed_ready'; // prevent useEffect from re-triggering
        setTimeout(() => {
          runAIPipelineRef.current?.({ trigger: 'auto_market_session' });
        }, 500);
      }
    } catch {
      // Silently ignore
    } finally {
      setPipelineAutoLoading(false);
    }
  }, [pipelineMode, fetchPipelineAutoStatus, pipelineSchedule]);

  // Poll pipeline-auto status (only when schedule is active)
  useEffect(() => {
    if (pipelineSchedule === 'off') return;
    fetchPipelineAutoStatus();
    const id = setInterval(fetchPipelineAutoStatus, 15000);
    return () => clearInterval(id);
  }, [pipelineSchedule, fetchPipelineAutoStatus]);

  // Auto-trigger runAIPipeline when backend scheduler reports "Ready" (nextRunAt === 'now')
  useEffect(() => {
    if (pipelineSchedule === 'off') return;
    if (!pipelineAutoStatus) return;
    if (pipelineRunningRef.current) return;

    const isArmed = pipelineAutoStatus.autoStatus === 'Armed';
    const isMarketOpen = pipelineAutoStatus.marketOpen === true;
    const isReady = pipelineAutoStatus.nextRunAt === 'now';
    const alreadyTriggered = autoRunTriggeredRef.current === 'armed_ready';

    if (isArmed && isMarketOpen && isReady && !alreadyTriggered) {
      autoRunTriggeredRef.current = 'armed_ready';
      console.log('[AutoRun] Auto-triggering runAIPipeline from Market Auto Run (nextRunAt=now)');
      runAIPipelineRef.current?.({ trigger: 'auto_market_session' });
    } else if (!isReady || !isArmed || !isMarketOpen) {
      // Reset trigger when status advances (re-arm for next interval)
      autoRunTriggeredRef.current = null;
    }
  }, [pipelineAutoStatus, pipelineSchedule]);

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
        setHoldingsError(posRes.value.data.error || 'Configure Alpaca API in Settings to load positions.');
      } else {
        setHoldingsError('Configure Alpaca API in Settings to load positions.');
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
      setHoldingsError(e?.response?.data?.error || e?.message || 'Configure Alpaca API in Settings to load positions.');
      setHoldings([]);
      holdingsRef.current = [];
      setOpenSellOrders([]);
      console.error(`[ExitScan] holdings fetch failed: mode=${m}, error=${e?.response?.data?.error || e?.message}`);
    } finally {
      setHoldingsLoading(false);
    }
  }, [tradeMode]);

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
        message.success(`Sell order canceled for ${symbol}`);
        setOpenSellOrders(prev => prev.filter(o => o.id !== orderId));
      } else {
        message.error(`Failed to cancel order: ${res.data.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      message.error(`Cancel failed: ${e?.response?.data?.error || e?.message || 'Unknown error'}`);
    } finally {
      setCancelingOrderId(null);
    }
  }, [tradeMode]);

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
  const isAnyScanRunning = pipelineRunning || isScanRunning() || isFineScanRunning() || isDeeperValidationRunning() || isEntryPlanRunning() || continueScanStatus === 'processing';

  // AI调用互斥控制
  const [aiCallInProgress, setAiCallInProgress] = useState(false);
  const aiCallInProgressRef = useRef(false);

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

  // ── Preflight config check (shared by Continue Scan, Fine Scan, Deeper Validation, Entry Plan) ──
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
      const statusResp = await api.get('/config/status');
      if (!statusResp.data?.success) return fail('Failed to load configuration status.');

      const s = statusResp.data;

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

  // 手动启动Continue Scan的函数
  const handleStartContinueScan = () => {
    if (pipelineRunning) {
      message.warning('Disabled while AI Pipeline is running.');
      return;
    }

    if (marketScannerResults.length === 0) {
      message.warning(t.agent.noMarketScanResultsAvailable);
      return;
    }

    if (continueScanStatus === 'processing') {
      message.warning('Continue scan is already running');
      return;
    }

    console.log('Starting continue scan...');

    // 重置状态
    setContinueScanStatus('processing');
    setContinueScanProgress(0);
    setPreferredContinueScanList([]);
    setContinueScanDetails({
      currentStage: 'Initializing...',
      startTime: Date.now(),
      estimatedTimeRemaining: null,
      processedCount: 0,
      totalCount: (scannerStateStore.getState().marketScanner.results || []).length
    });

    // 开始处理
    processContinueScan();
  };

  // Continue Scan处理函数 - 重构为纯rule-based continue scan
  const processContinueScan = async () => {
    try {
      // Read directly from store to avoid stale React closure (pipeline may have
      // updated store via startMarketScanner() without React re-rendering yet)
      const msResults = scannerStateStore.getState().marketScanner.results || [];
      console.log(`Starting rule-based continue scan for ${msResults.length} market scan results...`);
      if (msResults.length > 0) {
        const sample = msResults[0];
        console.log(`[Pipeline] scanner result keys (${Object.keys(sample).length}): ${Object.keys(sample).slice(0, 20).join(', ')}`);
        console.log(`[Pipeline] first result symbol=${sample.symbol} trendLabel=${sample.trendLabel} trendScore=${sample.trendScore}`);
      }

      // 阶段A: 初始化 (0%)
      setContinueScanProgress(0);
      setContinueScanDetails((prev: any) => ({
        ...prev,
        currentStage: 'Initializing rule-based scan...',
        processedCount: 0,
        totalCount: msResults.length,
        estimatedTimeRemaining: null
      }));

      // Preflight: check session and Alpaca config
      const preflight = await preflightConfigCheck();
      if (!preflight.ok || !preflight.sessionValid) {
        setContinueScanStatus('error');
        setContinueScanProgress(0);
        setContinueScanDetails((prev: any) => ({
          ...prev,
          currentStage: preflight.error || 'Configuration error',
          estimatedTimeRemaining: null,
        }));
        message.error(preflight.error || 'Session expired');
        return;
      }
      if (!preflight.alpacaConfigured) {
        setContinueScanStatus('error');
        setContinueScanProgress(0);
        setContinueScanDetails((prev: any) => ({
          ...prev,
          currentStage: 'Alpaca Market Data API is not configured. Configure in Settings.',
          estimatedTimeRemaining: null,
        }));
        message.error('Alpaca Market Data API is not configured.');
        return;
      }
      // AI is optional for Continue Scan (rule-based), but warn if unavailable
      if (!preflight.aiAvailable) {
        const reason = preflight.aiKeyIsMasked ? 'AI key is invalid (masked)' :
                       !preflight.aiConfigured ? 'AI Provider not configured' :
                       preflight.aiTestStatus !== 'connected' ? `AI Provider not tested (${preflight.aiTestStatus})` :
                       'AI unavailable';
        console.warn(`[ContinueScan] AI pre-flight: ${reason}. AI reason generation will be skipped.`);
      }

      // 检查是否有有效的market scan结果
      if (msResults.length === 0) {
        setPreferredContinueScanList([]);
        setContinueScanStatus('completed');
        setContinueScanProgress(100);
        setContinueScanDetails((prev: any) => ({
          ...prev,
          currentStage: 'No market scan results available',
          estimatedTimeRemaining: 0
        }));
        console.log('No market scan results available for continue scan');
        return;
      }

      // 阶段B: 读取market scan results (20%)
      setContinueScanProgress(20);
      setContinueScanDetails((prev: any) => ({
        ...prev,
        currentStage: 'Loading market scan results...'
      }));

      // Filter out failed/incomplete symbols before Continue Scan evaluation
      const eligibleForContinue = msResults.filter((r: any) => {
        if (r.analysisStatus === 'failed') return false;
        if (r.trendLabel === 'Need Data') return false;
        if (r.price == null || r.price <= 0) return false;
        if (r.trendScore == null && r.overallScore == null) return false;
        return true;
      });
      if (process.env.NODE_ENV !== 'production') {
        const excluded = msResults.length - eligibleForContinue.length;
        if (excluded > 0) {
          console.log(`[ContinueScan] excluded ${excluded} failed/Need Data symbols from ${msResults.length} total`);
        }
      }

      // 准备所有候选的原始数据
      const allCandidates = eligibleForContinue.map(candidate => ({
        symbol: candidate.symbol || 'N/A',
        trend: candidate.trendLabel || 'Neutral',
        score: candidate.overallScore || candidate.trendScore || 0,
        risk: candidate.eventRisk || 'Medium',
        sector: candidate.sector || 'Unknown',
        priceChange: candidate.changePct || 0,
        volumeStatus: candidate.volumeStatus || 'Normal',
        newsSentiment: candidate.newsSentiment || 'Neutral',
        companyName: candidate.companyName || '',
        marketCap: candidate.marketCap || 0,
        // 保留原始数据用于显示
        originalData: candidate
      }));

      console.log(`Loaded ${allCandidates.length} candidates for rule-based evaluation`);

      // 阶段C: 过滤bullish/strong bullish候选 (40%)
      setContinueScanProgress(40);
      setContinueScanDetails((prev: any) => ({
        ...prev,
        currentStage: 'Filtering bullish candidates...',
        estimatedTimeRemaining: null
      }));

      // 阶段D: 计算priority score (60%)
      setContinueScanProgress(60);
      setContinueScanDetails((prev: any) => ({
        ...prev,
        currentStage: 'Calculating priority scores...',
        estimatedTimeRemaining: null
      }));

      // 应用规则筛选和评分
      const ruleEvaluatedCandidates: any[] = [];

      for (let i = 0; i < allCandidates.length; i++) {
        const candidate = allCandidates[i];

        // 更新进度
        const progress = Math.round((i / allCandidates.length) * 20); // 60% - 80%
        setContinueScanProgress(60 + progress);
        setContinueScanDetails((prev: any) => ({
          ...prev,
          processedCount: i + 1
        }));

        // 检查是否有新的Market Scan开始
        if (detailedScanStatus.currentStatus === 'scanning') {
          console.log('New market scan started, aborting continue scan');
          setContinueScanStatus('error');
          setContinueScanProgress(0);
          setContinueScanDetails((prev: any) => ({
            ...prev,
            currentStage: 'Continue scan aborted: new market scan started',
            estimatedTimeRemaining: null
          }));
          return;
        }

        // 应用入选基本条件
        const trend = candidate.trend;
        const score = candidate.score;
        const risk = candidate.risk;

        // 条件1: trend必须是Bullish或Strong Bullish
        // 条件1: trend — allow Bullish, Strong Bullish, and Constructive/Neutral with good score
        const isBullish = trend === 'Bullish' || trend === 'Strong Bullish';
        const isConstructive = trend === 'Constructive' || trend === 'Neutral';
        if (!isBullish && !isConstructive) {
          continue; // skip downtrend / bearish
        }

        // 条件2: score >= 70 for Bullish, >= 80 for Constructive/Neutral
        if (isBullish && score < 70) {
          continue;
        }
        if (isConstructive && score < 80) {
          continue; // higher bar for non-bullish
        }

        // 条件3: risk不能是High
        if (risk === 'High') {
          continue; // 跳过不符合条件的候选
        }

        // 计算priority score
        let priorityScore = 0;

        // Trend加分
        if (trend === 'Strong Bullish') {
          priorityScore += 35;
        } else if (trend === 'Bullish') {
          priorityScore += 25;
        } else if (trend === 'Constructive' || trend === 'Neutral') {
          priorityScore += 15; // lower than Bullish but still eligible
        }

        // Score加分: score * 0.5
        priorityScore += score * 0.5;

        // Risk加分
        if (risk === 'Low') {
          priorityScore += 12;
        } else if (risk === 'Medium') {
          priorityScore += 6;
        }
        // High risk已经排除，不加分

        // News Sentiment加分
        const newsSentiment = candidate.newsSentiment || 'Neutral';
        if (newsSentiment === 'Positive') {
          priorityScore += 10;
        } else if (newsSentiment === 'Neutral') {
          priorityScore += 4;
        } else if (newsSentiment === 'Negative') {
          priorityScore -= 8;
        }

        // Change %加分
        const priceChange = candidate.priceChange || 0;
        if (priceChange >= 3) {
          priorityScore += 8;
        } else if (priceChange >= 1) {
          priorityScore += 5;
        } else if (priceChange > 0) {
          priorityScore += 2;
        } else if (priceChange <= 0) {
          priorityScore -= 6;
        }

        // Volume Status加分
        const volumeStatus = candidate.volumeStatus || 'Normal';
        if (volumeStatus === 'High') {
          priorityScore += 8;
        } else if (volumeStatus === 'Normal') {
          priorityScore += 4;
        }
        // Low不加分

        // Compute priority components (deterministic breakdown)
        const trendContrib = (trend === 'Strong Bullish') ? 35 : (trend === 'Bullish') ? 25 : 0;
        const scoreContrib = Math.round(score * 0.5);
        const riskContrib = (risk === 'Low') ? 12 : (risk === 'Medium') ? 6 : 0;
        const newsContrib = (newsSentiment === 'Positive') ? 10 : (newsSentiment === 'Neutral') ? 4 : (newsSentiment === 'Negative') ? -8 : 0;
        const priceContrib = (priceChange >= 3) ? 8 : (priceChange >= 1) ? 5 : (priceChange > 0) ? 2 : -6;
        const volContrib = (volumeStatus === 'High') ? 8 : (volumeStatus === 'Normal') ? 4 : 0;

        priorityScore = trendContrib + scoreContrib + riskContrib + newsContrib + priceContrib + volContrib;

        // Clamp到0-100
        priorityScore = Math.max(0, Math.min(100, priorityScore));

        // 最终入选规则: priorityScore >= 60
        if (priorityScore >= 60) {
          // 生成selection reason
          const selectionReason = generateRuleBasedReason(candidate);

          // AI source tracking from scanner result
          const originalData = candidate.originalData || {};
          ruleEvaluatedCandidates.push({
            ...originalData,
            includeInContinueScan: true,
            priorityScore: Math.round(priorityScore),
            priorityBreakdown: {
              trend: trendContrib,
              score: scoreContrib,
              risk: riskContrib,
              news: newsContrib,
              price: priceContrib,
              volume: volContrib,
            },
            selectionReason: selectionReason,
            continueScanStatus: 'completed' as const,
            aiReasonStatus: 'pending' as const,
            aiEvaluated: false,
            reasonSource: 'Rule-based',
            selectedBy: 'Local Rules',
            aiSource: null,
            aiModel: null,
            aiError: null,
            aiCalled: false,
            scanBatchId: 'current',
            scanTimestamp: detailedScanStatus.lastScanAt || new Date().toISOString(),
            generatedAt: new Date().toISOString(),
            // 显示字段
            sector: candidate.sector,
            newsSentiment: candidate.newsSentiment,
            priceChangePct: candidate.priceChange,
            volumeStatus: candidate.volumeStatus,
            // data quality from scanner
            dataQuality: originalData.dataQuality || (originalData.price && originalData.volume && originalData.trendLabel ? 'GOOD' : 'PARTIAL'),
          });
        }

        // 短暂延迟，避免UI阻塞
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      console.log(`Rule evaluation completed. Found ${ruleEvaluatedCandidates.length} qualified candidates`);

      // 阶段E: 排序和限制数量 (80%)
      setContinueScanProgress(80);
      setContinueScanDetails((prev: any) => ({
        ...prev,
        currentStage: 'Sorting and limiting candidates...',
        estimatedTimeRemaining: null
      }));

      // 按priority score排序
      ruleEvaluatedCandidates.sort((a, b) => b.priorityScore - a.priorityScore);

      // 限制最多20个
      const finalList = ruleEvaluatedCandidates.slice(0, 20);

      // 阶段F: 完成处理 (100%)
      setContinueScanProgress(100);
      setContinueScanDetails((prev: any) => ({
        ...prev,
        currentStage: 'Finalizing continue scan list...',
        estimatedTimeRemaining: 0
      }));

      // 显示最终列表
      setPreferredContinueScanList(finalList);
      setContinueScanStatus('completed');

      console.log(`Continue scan completed. Rule-based selection found ${finalList.length} candidates for follow-up.`);
      if (finalList.length > 0) {
        const topSymbols = finalList.slice(0, 5).map((c: any) => `${c.symbol}(score=${c.priorityScore},trend=${c.trend})`).join(', ');
        console.log(`[Pipeline] top continue candidates: ${topSymbols}`);
      } else {
        // Log why no candidates were selected for debugging
        const sampleScores = msResults.slice(0, 5).map((c: any) => `${c.symbol}(trendLabel=${c.trendLabel},trendScore=${c.trendScore},eventRisk=${c.eventRisk})`).join(', ');
        console.log(`[Pipeline] no candidates selected. Sample scanner data: ${sampleScores}`);
      }

    } catch (error) {
      console.error('Continue scan processing failed:', error);
      setContinueScanStatus('error');
      setContinueScanProgress(0);
      setContinueScanDetails((prev: any) => ({
        ...prev,
        currentStage: `Error: ${error instanceof Error ? error.message : String(error)}`,
        estimatedTimeRemaining: null
      }));
    }
  };

  // AI生成selection reason的函数
  // Fallback reason生成函数
  // Continue Scan专用的AI评估函数
  // Rule-based selection reason生成函数 — 使用真实scanner字段，具体不模板
  const generateRuleBasedReason = (candidate: any): string => {
    const trend = candidate.trend || '';
    const score = candidate.score || 0;
    const risk = candidate.risk || 'Medium';
    const sector = candidate.sector || 'Unknown';
    const priceChange = candidate.priceChange || 0;
    const volumeStatus = candidate.volumeStatus || 'Normal';
    const newsSentiment = candidate.newsSentiment || 'Neutral';
    const companyName = candidate.companyName || candidate.originalData?.companyName || '';

    const nameOrSymbol = companyName || candidate.originalData?.symbol || '';
    const trendDesc = trend === 'Strong Bullish' ? `strong bullish trend (score ${score})` :
                      trend === 'Bullish' ? `bullish trend (score ${score})` :
                      `trend score ${score}`;
    const riskDesc = risk === 'Low' ? 'low' : risk === 'Medium' ? 'moderate' : 'elevated';
    const newsDesc = newsSentiment === 'Positive' ? 'positive' : newsSentiment === 'Negative' ? 'negative' : 'neutral';
    const volDesc = volumeStatus === 'High' ? 'above-average' : volumeStatus === 'Low' ? 'below-average' : 'normal';
    const priceDesc = priceChange >= 3 ? `+${priceChange.toFixed(1)}% momentum` :
                      priceChange >= 1 ? `+${priceChange.toFixed(1)}% gain` :
                      priceChange > 0 ? `+${priceChange.toFixed(1)}%` :
                      `${priceChange.toFixed(1)}%`;
    const sectorText = sector !== 'Unknown' ? ` in ${sector}` : '';

    return `Selected${sectorText}: ${nameOrSymbol} has ${trendDesc}, ${newsDesc} news sentiment, ${riskDesc} risk, and ${volDesc} volume${priceChange !== 0 ? ` at ${priceDesc}` : ''}. Fine Scan should verify setup quality and backtest alignment before entry planning.`;
  };

  // Fallback priority计算函数（当AI调用失败时使用）
  const [marketScannerSummary] = useState({
    universeScanned: 0,
    bullishCount: 0,
    bearishCount: 0,
    neutralCount: 0,
    strongTrendCount: 0,
    newsRiskCount: 0,
    lastScanTime: null as string | null
  });
  const [marketScannerFilters, setMarketScannerFilters] = useState({
    trendFilter: 'all' as 'all' | 'bullish' | 'bearish' | 'neutral' | 'strong',
    sortBy: 'trendScore' as 'trendScore' | 'volume' | 'changePct' | 'newsSentiment',
    sortOrder: 'desc' as 'asc' | 'desc'
  });
  // 展开行状态
  const [expandedRows, setExpandedRows] = useState<string[]>([]);

  // 跟踪是否已经处理过当前批次的market scan results
  const processedResultsSignatureRef = useRef<string>('');

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

  // 同步 AI 调用状态到 ref
  useEffect(() => {
    aiCallInProgressRef.current = aiCallInProgress;
  }, [aiCallInProgress]);

  // Load AI Watchlist on mount
  useEffect(() => {
    fetchAiWatchlist();
    return () => { stopWatchlistAutoRefresh(); };
  }, []);

  // Toggle auto-refresh
  useEffect(() => {
    if (aiWatchlistAutoRefresh) {
      startWatchlistAutoRefresh();
    } else {
      stopWatchlistAutoRefresh();
    }
    return () => { stopWatchlistAutoRefresh(); };
  }, [aiWatchlistAutoRefresh]);

  // 监控market scan状态，只处理状态重置，不自动触发continue scan
  useEffect(() => {
    // 生成当前results的签名（用于检测是否是新批次）
    const generateResultsSignature = (results: any[]): string => {
      if (!results || results.length === 0) return '';

      // 使用results长度和最后一个symbol的时间戳作为签名
      const lastResult = results[results.length - 1];
      const timestamp = lastResult.scanTime || lastResult.timestamp || Date.now().toString();
      return `${results.length}_${timestamp}`;
    };

    const currentSignature = generateResultsSignature(marketScannerResults);

    // 当有新的market scan结果时，更新签名但不自动开始处理
    if (currentSignature !== '' && currentSignature !== processedResultsSignatureRef.current) {
      console.log(`New market scan results detected (${marketScannerResults.length} results), ready for manual continue scan`);
      processedResultsSignatureRef.current = currentSignature;
    }

    // 如果market scan重新开始，重置continue scan状态
    // 只有当market scanner真正开始扫描时（不是AI Recommendations扫描）才重置
    if (detailedScanStatus.currentStatus === 'scanning' &&
        detailedScanStatus.statusMessage?.includes('Market Scanner')) {
      console.log('Market scan restarted, resetting continue scan state');
      setContinueScanStatus('idle');
      setContinueScanProgress(0);
      setPreferredContinueScanList([]);
      processedResultsSignatureRef.current = ''; // 重置签名

      // 如果AI调用正在进行，也重置
      if (aiCallInProgressRef.current) {
        console.log('Market scan restarted, aborting AI calls');
        setAiCallInProgress(false);
      }
    }
  }, [marketScannerResults, continueScanStatus, detailedScanStatus.currentStatus]);

  const fetchConfigStatus = async () => {
    try {
      const resp = await api.get('/config/status');
      if (resp.data?.success) {
        setConfigStatus({
          ai: resp.data.ai?.configured || false,
          aiTestStatus: resp.data.ai?.testStatus || 'not_tested',
          aiLastTestError: resp.data.ai?.lastTestError || null,
          alpaca: resp.data.alpaca?.paperConfigured || false,
          finnhub: resp.data.finnhub?.configured || false,
          loaded: true,
        });
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

        // 设置表单值
        aiConfigForm.setFieldsValue({
          provider: provider,
          model: model,
          apiKey: config.apiKey || '',
          baseUrl: config.baseUrl || 'https://api.deepseek.com'
        });

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
      default: return '#8c8c8c';
    }
  };

  // 统一的 trend badge 渲染函数
  const renderTrendBadge = (label: string) => {
    if (!label) {
      return (
        <div className="scanner-badge-base" style={{ backgroundColor: '#f5f5f5', color: '#8c8c8c', border: '1px solid #d9d9d9' }}>
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
        case 'bullish':
          filteredResults = filteredResults.filter(r =>
            r.trendLabel === 'Bullish' || r.trendLabel === 'Strong Bullish'
          );
          break;
        case 'bearish':
          filteredResults = filteredResults.filter(r =>
            r.trendLabel === 'Bearish' || r.trendLabel === 'Strong Bearish'
          );
          break;
        case 'neutral':
          filteredResults = filteredResults.filter(r => r.trendLabel === 'Neutral');
          break;
        case 'strong':
          filteredResults = filteredResults.filter(r =>
            r.trendLabel === 'Strong Bullish' || r.trendLabel === 'Strong Bearish'
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
      if (sortField === 'trendScore') {
        aValue = a.trendScore || a.overallScore || 0;
        bValue = b.trendScore || b.overallScore || 0;
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

  // 获取Preferred Continue Scan List


  // 获取bullish候选数量（用于UI显示）
  const handleToggleMarketScanner = (): void => {
    if (isScanRunning()) {
      // Stop the running scan — only user action can stop
      stopMarketScannerByUser();
      message.info('Stopping scanner...');
    } else {
      if (pipelineRunning) {
        message.warning('Disabled while AI Pipeline is running.');
        return;
      }
      // Start a new scan via module-level service
      startMarketScanner();
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
    if (!timestamp) return 'Time unavailable';

    try {
      // 检查是否是数字（Unix时间戳）
      const num = Number(timestamp);
      if (!isNaN(num)) {
        // 判断是秒时间戳（10位）还是毫秒时间戳（13位）
        const timestampMs = num < 10000000000 ? num * 1000 : num;
        const date = new Date(timestampMs);

        // 检查日期是否有效（不是1970年）
        if (date.getFullYear() < 1971) {
          return 'Time unavailable';
        }

        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }

      // 如果不是数字，尝试直接解析
      const date = new Date(timestamp);
      if (isNaN(date.getTime()) || date.getFullYear() < 1971) {
        return 'Time unavailable';
      }

      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting news date:', error, timestamp);
      return 'Time unavailable';
    }
  };

  function FineScanDetailTag({ label, value, color }: { label: string; value: string; color?: string }) {
    return React.createElement('span', { style: { fontSize: '11px', color: '#8c8c8c', marginRight: '10px' } },
      label + ': ',
      React.createElement('span', { style: { color: color || '#262626', fontWeight: 600 } }, value)
    );
  }

  const renderFineScanDetailPanel = (record: any) => {
    const fullReason = record.matchReason || '';
    const signals = record.keySignals || [];
    const aiUsed = record.aiUsed === true;
    const aiExplained = record.aiExplained === true;
    const decisionSource = record.decisionSource === 'ai' ? 'DeepSeek AI' : t.agent.localRulesLabel;
    const dq = (record.provenance && record.provenance.dataQuality) || (record.entryQuality && record.entryQuality !== 'Error / No Data' ? 'GOOD' : 'PARTIAL');
    const decision = record.decision || 'Watch';
    const bestStrat = (record.matchedStrategies || [])[0] || 'N/A';
    const perStrategy = record.backtestPerStrategy || [];
    const optResults = record.quickOptResults || [];
    const eq = record.entryQuality;
    const eqD = record.entryDetails;
    const lg = record.liquidityGrade;
    const ld = record.liquidityDetails;
    const ng = record.newsGrade;
    const nd = record.newsDetails;
    const rg = record.riskGrade;
    const rd = record.riskDetails;

    return React.createElement('div', { style: { padding: '20px 24px', backgroundColor: '#f8f9fa', borderRadius: 12, border: '1px solid #e8e8e8', margin: '8px 12px 16px 12px', fontSize: '13px', lineHeight: '1.6' } },

      // Professional Header Row
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', paddingBottom: '12px', borderBottom: '1px solid #e8eaed', marginBottom: '16px' } },
        React.createElement('span', { style: { fontWeight: 800, fontSize: '18px', color: '#1a1a1a', letterSpacing: '-0.5px' } }, record.symbol),
        React.createElement(Tag, { color: decision === 'Continue' ? 'success' : decision === 'Watch' ? 'warning' : decision === 'NeedMoreData' ? 'orange' : 'error', style: { fontSize: '12px', fontWeight: 700, margin: 0, padding: '0 10px', height: '24px', lineHeight: '24px', borderRadius: '4px' } }, (language === 'zh-CN' ? ({'Continue': '继续', 'Watch': '观察', 'NeedMoreData': '需数据', 'Reject': '拒绝', 'Skip': '跳过'} as any)[decision] || decision : decision.toUpperCase())),
        React.createElement('span', { style: { color: '#8c8c8c', fontSize: '12px', fontWeight: 500 } }, t.agent.scorePrefix, React.createElement('span', { style: { fontWeight: 700, color: '#1890ff' } }, record.matchConfidence || 0)),
        React.createElement('span', { style: { color: '#d9d9d9', fontSize: '14px' } }, '|'),
        React.createElement('span', { style: { color: '#595959', fontSize: '13px', fontWeight: 500 } }, (record.matchedStrategies || []).slice(0, 2).join(' · ') || bestStrat),

        // Warnings inline - emphasized
        (record.decisionWarnings || []).concat((record.decisionBlockers || []).map(function(b: string) { return t.agent.blockPrefix + b; })).slice(0, 2).map(function(w: string, i: number) {
          var isBlocker = w.indexOf(t.agent.blockPrefix) === 0;
          return React.createElement('span', { key: 'hw' + i, style: { padding: '2px 8px', borderRadius: 4, background: isBlocker ? '#fff1f0' : '#fffbe6', color: isBlocker ? '#ff4d4f' : '#d48806', fontSize: '11px', fontWeight: 600, border: '1px solid ' + (isBlocker ? '#ffa39e' : '#ffe58f'), whiteSpace: 'nowrap' } }, (isBlocker ? '✕ ' : '⚠ ') + (isBlocker ? w.slice(t.agent.blockPrefix.length) : w));
        }),

        React.createElement('span', { style: { marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' } },
          React.createElement(Tag, { color: dq === 'GOOD' ? 'success' : dq === 'PARTIAL' ? 'warning' : 'error', style: { fontSize: '10px', fontWeight: 700, margin: 0, padding: '0 6px', lineHeight: '18px' } }, t.agent.dataPrefix + dq),
          perStrategy.some(function(ps: any) { return (ps.tradeCount || 0) < 3; }) ? React.createElement(Tag, { color: 'warning', style: { fontSize: '10px', fontWeight: 700, margin: 0, padding: '0 6px', lineHeight: '18px' } }, t.agent.limitedSampleTag) : null,
          React.createElement(Tag, { color: aiUsed ? 'cyan' : 'default', style: { fontSize: '10px', fontWeight: 700, margin: 0, padding: '0 6px', lineHeight: '18px' } }, aiUsed ? t.agent.deepseekTag : t.agent.localRulesTag)
        )
      ),

      // Provenance Chips - cleaner look
      React.createElement('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' } },
        (function() {
          var p = record.provenance || {};
          var chips: Array<{key: string; label: string; isAI: boolean; title: string}> = [
            {key: 'Mkt', label: t.agent.provenanceMkt, isAI: false, title: p.marketSource || 'Scanner'},
            {key: 'BT', label: t.agent.provenanceBt, isAI: false, title: p.backtestSource || 'Backtest'},
            {key: 'Opt', label: t.agent.provenanceOpt, isAI: false, title: p.optimizationSource || 'Optimization'},
            {key: 'Entry', label: t.agent.provenanceEntry, isAI: false, title: p.entrySource || 'Entry Quality'},
            {key: 'News', label: t.agent.provenanceNews, isAI: false, title: p.newsSource || 'News'},
            {key: 'Dec', label: t.agent.provenanceDecision + (record.decisionSource === 'ai' ? t.agent.provenanceAI : t.agent.provenanceRules), isAI: record.decisionSource === 'ai', title: decisionSource},
          ];
          return chips.map(function(c) {
            return React.createElement('span', { key: c.key, title: c.title, style: { padding: '2px 8px', borderRadius: '4px', background: c.isAI ? '#e6fffb' : '#f0f0f0', color: c.isAI ? '#13c2c2' : '#8c8c8c', fontSize: '10px', fontWeight: 700, border: '1px solid ' + (c.isAI ? '#b5f5ec' : '#d9d9d9'), whiteSpace: 'nowrap', cursor: 'default' } }, c.label);
          });
        })()
      ),

      // Body: 2-column grid with better balance
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px' } },

        // LEFT COLUMN
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },

          // Match Summary
          React.createElement('div', { style: { background: '#fff', borderRadius: 8, border: '1px solid #edf0f2', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' } },
            React.createElement('div', { style: { fontWeight: 700, fontSize: '11px', color: '#8c8c8c', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' } }, t.agent.matchSummary),
            fullReason ? React.createElement('div', { style: { fontSize: '13px', color: '#262626', lineHeight: 1.6, marginBottom: '10px' }, title: fullReason }, fullReason) : null,
            React.createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
              React.createElement(Tag, { color: record.regime === 'Trending' ? 'blue' : record.regime === 'Breakout-ready' ? 'purple' : record.regime === 'Range-bound' ? 'green' : 'default', style: { fontSize: '11px', fontWeight: 600, margin: 0, padding: '0 8px', lineHeight: '20px' } }, language === 'zh-CN' ? ({'Trending': t.agent.regimeTrending, 'Breakout-ready': t.agent.regimeBreakout, 'Range-bound': t.agent.regimeRange} as any)[record.regime] || t.agent.regimeUnclear : (record.regime || 'Unclear')),
              React.createElement('span', { style: { fontSize: '12px', color: '#8c8c8c', fontWeight: 500 } }, t.agent.confidenceLevel + ': ' + (record.matchConfidence || 0) + '% | ' + t.agent.colScore + ': ' + (record.scanScore || 'N/A'))
            )
          ),

          // Backtest
          React.createElement('div', { style: { background: '#fff', borderRadius: 8, border: '1px solid #edf0f2', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' } },
            React.createElement('div', { style: { fontWeight: 700, fontSize: '11px', color: '#8c8c8c', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' } }, t.agent.strategyBacktest),
            perStrategy.length > 0 ? (
              React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '12px' } },
                React.createElement('thead', null,
                  React.createElement('tr', { style: { color: '#8c8c8c', borderBottom: '1px solid #f0f0f0' } },
                    React.createElement('th', { style: { textAlign: 'left', padding: '6px 4px', fontWeight: 600 } }, t.agent.btColStrategy),
                    React.createElement('th', { style: { textAlign: 'right', padding: '6px 4px', fontWeight: 600 } }, t.agent.btColReturn),
                    React.createElement('th', { style: { textAlign: 'right', padding: '6px 4px', fontWeight: 600 } }, t.agent.btColSharpe),
                    React.createElement('th', { style: { textAlign: 'right', padding: '6px 4px', fontWeight: 600 } }, t.agent.btColMaxDD),
                    React.createElement('th', { style: { textAlign: 'right', padding: '6px 4px', fontWeight: 600 } }, t.agent.btColWinPct),
                    React.createElement('th', { style: { textAlign: 'right', padding: '6px 4px', fontWeight: 600 } }, t.agent.btColTrades),
                    React.createElement('th', { style: { textAlign: 'center', padding: '6px 4px', fontWeight: 600 } }, t.agent.btColStatus)
                  )
                ),
                React.createElement('tbody', null,
                  perStrategy.map(function(ps: any, i: number) {
                    return React.createElement('tr', { key: i, style: { borderBottom: '1px solid #f5f5f5' } },
                      React.createElement('td', { style: { padding: '8px 4px', fontWeight: 600, color: '#1f1f1f' } }, ps.strategy),
                      React.createElement('td', { style: { padding: '8px 4px', textAlign: 'right', fontWeight: 700, color: (ps.totalReturn || 0) >= 0 ? '#52c41a' : '#ff4d4f' } }, ps.totalReturn != null ? (ps.totalReturn >= 0 ? '+' : '') + Number(ps.totalReturn).toFixed(1) + '%' : '--'),
                      React.createElement('td', { style: { padding: '8px 4px', textAlign: 'right', fontWeight: 500, color: (ps.sharpe || 0) >= 1.0 ? '#1890ff' : (ps.sharpe || 0) >= 0.5 ? '#262626' : '#ff4d4f' } }, ps.sharpe != null ? Number(ps.sharpe).toFixed(2) : '--'),
                      React.createElement('td', { style: { padding: '8px 4px', textAlign: 'right', color: Math.abs(ps.maxDrawdown || 0) < 15 ? '#262626' : Math.abs(ps.maxDrawdown || 0) < 25 ? '#faad14' : '#ff4d4f' } }, ps.maxDrawdown != null ? Number(ps.maxDrawdown).toFixed(1) + '%' : '--'),
                      React.createElement('td', { style: { padding: '8px 4px', textAlign: 'right', fontWeight: 500 } }, ps.winRate != null ? Number(ps.winRate).toFixed(1) + '%' : '--'),
                      React.createElement('td', { style: { padding: '8px 4px', textAlign: 'right', fontStyle: (ps.tradeCount || 0) < 3 ? 'italic' : 'normal', color: (ps.tradeCount || 0) < 3 ? '#fa8c16' : '#595959' }, title: (ps.tradeCount || 0) < 3 ? t.agent.limitedSample : undefined }, ps.tradeCount != null ? String(ps.tradeCount) : '--'),
                      React.createElement('td', { style: { padding: '8px 4px', textAlign: 'center' } },
                        React.createElement(Tag, { color: ps.status === 'passed' ? 'success' : ps.status === 'caution' ? 'warning' : 'error', style: { fontSize: '10px', fontWeight: 700, margin: 0, padding: '0 6px', lineHeight: '18px' } },
                          ps.status === 'passed' ? t.agent.statusPass : ps.status === 'caution' ? t.agent.statusCaution : ps.status === 'completed_losing' ? t.agent.statusFail : '--')
                      )
                    );
                  })
                )
              )
            ) : React.createElement('div', { style: { fontSize: '13px', color: '#bfbfbf', fontStyle: 'italic', padding: '10px 0' } }, t.agent.backtestNotAvailable),
            record.backtestPeriod ? React.createElement('div', { style: { fontSize: '11px', color: '#8c8c8c', marginTop: '8px', borderTop: '1px solid #f5f5f5', paddingTop: '6px' } }, t.agent.evaluationPeriod + ': ' + record.backtestPeriod) : null
          ),

          // Optimization
          React.createElement('div', { style: { background: '#fff', borderRadius: 8, border: '1px solid #edf0f2', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' } },
            React.createElement('div', { style: { fontWeight: 700, fontSize: '11px', color: '#8c8c8c', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' } }, t.agent.quickOptimization),
            optResults.length > 0 ? (
              React.createElement('div', null,
                React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '12px' } },
                  React.createElement('thead', null,
                    React.createElement('tr', { style: { color: '#8c8c8c', borderBottom: '1px solid #f0f0f0' } },
                      React.createElement('th', { style: { textAlign: 'left', padding: '6px 4px', fontWeight: 600 } }, t.agent.optColStrategy),
                      React.createElement('th', { style: { textAlign: 'center', padding: '6px 4px', fontWeight: 600 } }, t.agent.optColStability),
                      React.createElement('th', { style: { textAlign: 'right', padding: '6px 4px', fontWeight: 600 } }, t.agent.optColAvgReturn),
                      React.createElement('th', { style: { textAlign: 'right', padding: '6px 4px', fontWeight: 600 } }, t.agent.optColPosRatio),
                      React.createElement('th', { style: { textAlign: 'right', padding: '6px 4px', fontWeight: 600 } }, t.agent.optColSpread)
                    )
                  ),
                  React.createElement('tbody', null,
                    optResults.map(function(opt: any, oi: number) {
                      return React.createElement('tr', { key: oi, style: { borderBottom: '1px solid #f5f5f5' } },
                        React.createElement('td', { style: { padding: '8px 4px', fontWeight: 600, color: '#1f1f1f' } }, opt.strategy),
                        React.createElement('td', { style: { padding: '8px 4px', textAlign: 'center' } },
                          React.createElement(Tag, { color: opt.stability === 'Stable' ? 'success' : opt.stability === 'Weak' ? 'warning' : 'error', style: { fontSize: '10px', fontWeight: 700, margin: 0, padding: '0 6px', lineHeight: '18px' } },
                            opt.stability === 'Stable' ? t.agent.statusStable : opt.stability === 'Weak' ? t.agent.statusWeak : t.agent.statusOverfit)
                        ),
                        React.createElement('td', { style: { padding: '8px 4px', textAlign: 'right', fontWeight: 700, color: opt.avgReturn >= 0 ? '#52c41a' : '#ff4d4f' } }, (opt.avgReturn >= 0 ? '+' : '') + opt.avgReturn + '%'),
                        React.createElement('td', { style: { padding: '8px 4px', textAlign: 'right', fontWeight: 500 } }, opt.positiveRatio + '%'),
                        React.createElement('td', { style: { padding: '8px 4px', textAlign: 'right', color: '#8c8c8c' } }, (opt.stdReturn || 0).toFixed(1) + '%')
                      );
                    })
                  )
                ),
                record.quickOptSummary ? React.createElement('div', { style: { fontSize: '11px', color: '#8c8c8c', marginTop: '8px', borderTop: '1px solid #f5f5f5', paddingTop: '6px' } }, record.quickOptSummary) : null
              )
            ) : React.createElement('div', { style: { fontSize: '13px', color: '#bfbfbf', fontStyle: 'italic', padding: '10px 0' } }, t.agent.optimizationNotAvailable),
            record.quickOptStatus === 'running' ? React.createElement('div', { style: { fontSize: '12px', color: '#fa8c16', fontWeight: 600, marginTop: '8px' } }, '⚡ ' + t.agent.optimizationInProgress) : null
          ),

          // Entry Quality
          React.createElement('div', { style: { background: '#fff', borderRadius: 8, border: '1px solid #edf0f2', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' } },
            React.createElement('div', { style: { fontWeight: 700, fontSize: '11px', color: '#8c8c8c', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' } }, t.agent.surgicalEntry),
            eq && eq !== 'Error / No Data' ? (
              React.createElement('div', null,
                React.createElement('div', { style: { marginBottom: '10px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' } },
                  React.createElement('span', { style: { fontSize: '15px', fontWeight: 800, color: eq === 'Good' || eq === 'Excellent' ? '#52c41a' : eq === 'Wait for Pullback' ? '#faad14' : '#ff4d4f' } }, eq),
                  React.createElement('span', { style: { fontSize: '13px', color: '#595959', fontWeight: 500 } }, t.agent.setupScore + ': ' + (record.entryScore || '--') + '/100'),
                  eqD && eqD.reward_risk_ratio != null && eqD.reward_risk_ratio < 1.5 && (eq === 'Good' || eq === 'Excellent') ? React.createElement('span', { style: { padding: '2px 8px', borderRadius: 4, background: '#fffbe6', color: '#d48806', fontSize: '11px', fontWeight: 600, border: '1px solid #ffe58f' } }, '⚠ ' + t.agent.rrCapped + eqD.reward_risk_ratio + ':1') : null
                ),
                eqD ? React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px 20px', fontSize: '12px', backgroundColor: '#fafafa', padding: '10px', borderRadius: '6px' } },
                  eqD.current_price != null ? React.createElement(FineScanDetailTag, { label: t.agent.tagPrice, value: '$' + eqD.current_price }) : null,
                  eqD.atr != null ? React.createElement(FineScanDetailTag, { label: t.agent.tagAtr, value: '$' + eqD.atr + ' (' + eqD.atr_pct + '%)' }) : null,
                  eqD.support != null ? React.createElement(FineScanDetailTag, { label: t.agent.tagSupport, value: '$' + eqD.support }) : null,
                  eqD.resistance != null ? React.createElement(FineScanDetailTag, { label: t.agent.tagResistance, value: '$' + eqD.resistance }) : null,
                  eqD.entry_zone_low != null ? React.createElement(FineScanDetailTag, { label: t.agent.tagZone, value: '$' + eqD.entry_zone_low + '–$' + eqD.entry_zone_high }) : null,
                  eqD.stop_distance_pct != null ? React.createElement(FineScanDetailTag, { label: t.agent.tagStop, value: eqD.stop_distance_pct + '%', color: eqD.stop_distance_pct > 5 ? '#fa8c16' : undefined }) : null,
                  eqD.reward_risk_ratio != null ? React.createElement(FineScanDetailTag, { label: t.agent.tagRR, value: eqD.reward_risk_ratio + ':1', color: eqD.reward_risk_ratio < 1.5 ? '#ff4d4f' : eqD.reward_risk_ratio < 2 ? '#faad14' : '#52c41a' }) : null
                ) : null,
                record.entryReason ? React.createElement('div', { style: { fontSize: '12px', color: '#8c8c8c', marginTop: '10px', lineHeight: '1.5', fontStyle: 'italic' } }, '”' + record.entryReason + '”') : null
              )
            ) : React.createElement('div', { style: { padding: '10px 0', color: '#bfbfbf', fontStyle: 'italic', fontSize: '13px' } }, t.agent.entryQualityUnavailable)
          )
        ),

        // RIGHT COLUMN
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },

          // Key Signals
          React.createElement('div', { style: { background: '#fff', borderRadius: 8, border: '1px solid #edf0f2', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' } },
            React.createElement('div', { style: { fontWeight: 700, fontSize: '11px', color: '#8c8c8c', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' } }, t.agent.highConvictionSignals),
            signals.length > 0 ? (
              React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' } },
                signals.slice(0, 8).map(function(sig: string, i: number) {
                  return React.createElement('span', { key: i, style: { padding: '3px 10px', borderRadius: 4, backgroundColor: '#f0f5ff', color: '#1890ff', fontSize: '12px', fontWeight: 600, border: '1px solid #d6e4ff' } }, sig);
                }),
                signals.length > 8 ? React.createElement('span', { style: { fontSize: '12px', color: '#8c8c8c', fontWeight: 500, alignSelf: 'center' } }, '+' + (signals.length - 8) + ' ' + (language === 'zh-CN' ? '更多' : 'more')) : null
              )
            ) : React.createElement('div', { style: { padding: '5px 0', color: '#bfbfbf', fontSize: '13px' } }, '--')
          ),

          // Liquidity & Risk
          React.createElement('div', { style: { background: '#fff', borderRadius: 8, border: '1px solid #edf0f2', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' } },
            React.createElement('div', { style: { fontWeight: 700, fontSize: '11px', color: '#8c8c8c', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' } }, t.agent.liquidityRiskProfile),
            React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' } },
              React.createElement('div', { style: { backgroundColor: '#fafafa', padding: '10px', borderRadius: '6px' } },
                React.createElement('div', { style: { fontWeight: 700, color: '#595959', marginBottom: '6px', fontSize: '11px', textTransform: 'uppercase' } }, t.agent.liquiditySubLabel),
                lg && lg !== 'Error' ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
                  React.createElement(FineScanDetailTag, { label: t.agent.tagGrade, value: lg, color: lg === 'Good' ? '#52c41a' : lg === 'Caution' ? '#faad14' : '#ff4d4f' }),
                  ld ? React.createElement(React.Fragment, null,
                    ld.rvol != null ? React.createElement(FineScanDetailTag, { label: t.agent.tagRvol, value: ld.rvol + 'x', color: ld.rvol >= 1.5 ? '#52c41a' : ld.rvol < 0.7 ? '#ff4d4f' : undefined }) : null,
                    ld.spread_pct != null ? React.createElement(FineScanDetailTag, { label: t.agent.tagSpread, value: ld.spread_pct + '%', color: ld.spread_pct > 1 ? '#ff4d4f' : ld.spread_pct > 0.2 ? '#faad14' : undefined }) : null
                  ) : null
                ) : React.createElement('span', { style: { color: '#bfbfbf', fontStyle: 'italic' } }, t.agent.noDataLabel)
              ),
              React.createElement('div', { style: { backgroundColor: '#fafafa', padding: '10px', borderRadius: '6px' } },
                React.createElement('div', { style: { fontWeight: 700, color: '#595959', marginBottom: '6px', fontSize: '11px', textTransform: 'uppercase' } }, t.agent.riskPrefix),
                rg && rg !== 'SKIP' ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
                  React.createElement(FineScanDetailTag, { label: t.agent.tagGrade, value: language === 'zh-CN' ? ({'LOW': t.agent.low, 'MEDIUM': t.agent.medium, 'HIGH': t.agent.high} as any)[rg] || rg : (rg === 'LOW' ? 'Low' : rg === 'MEDIUM' ? 'Medium' : rg === 'HIGH' ? 'High' : rg), color: rg === 'LOW' ? '#52c41a' : rg === 'MEDIUM' ? '#faad14' : '#ff4d4f' }),
                  rd ? React.createElement(React.Fragment, null,
                    React.createElement(FineScanDetailTag, { label: t.agent.tagScore, value: (rd.risk_score || '--') + '/100', color: rd.risk_score >= 65 ? '#ff4d4f' : rd.risk_score >= 35 ? '#faad14' : '#52c41a' }),
                    rd.atr_pct != null ? React.createElement(FineScanDetailTag, { label: t.agent.tagAtr, value: rd.atr_pct + '%', color: rd.atr_pct > 5 ? '#ff4d4f' : undefined }) : null
                  ) : null
                ) : React.createElement('span', { style: { color: '#bfbfbf', fontStyle: 'italic' } }, t.agent.noDataLabel)
              )
            )
          ),

          // News & Catalyst
          React.createElement('div', { style: { background: '#fff', borderRadius: 8, border: '1px solid #edf0f2', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' } },
            React.createElement('div', { style: { fontWeight: 700, fontSize: '11px', color: '#8c8c8c', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' } }, t.agent.newsAndCatalyst),
            ng && ng !== 'Error' ? React.createElement('div', null,
              React.createElement('div', { style: { marginBottom: '8px', display: 'flex', gap: '12px' } },
                React.createElement(FineScanDetailTag, { label: t.agent.tagSentiment, value: language === 'zh-CN' ? ({'Catalyst': '催化剂', 'Caution': '谨慎', 'High Event Risk': '高事件风险'} as any)[ng] || ng : ng, color: ng === 'Catalyst' ? '#1890ff' : ng === 'Caution' ? '#faad14' : ng === 'High Event Risk' ? '#ff4d4f' : undefined }),
                nd ? React.createElement(React.Fragment, null,
                  React.createElement(FineScanDetailTag, { label: t.agent.tagHeadlines, value: String(nd.headline_count || 0) }),
                  React.createElement(FineScanDetailTag, { label: t.agent.tagEarnings, value: nd.earnings_soon ? t.agent.earningsUpcoming : t.agent.earningsClear, color: nd.earnings_soon ? '#faad14' : undefined })
                ) : null
              ),
              nd && nd.top_headlines && nd.top_headlines.length > 0 ? React.createElement('div', { style: { fontSize: '12px', color: '#595959', lineHeight: '1.6', backgroundColor: '#fcfcfc', padding: '8px', borderRadius: '4px', borderLeft: '3px solid #eee' } },
                nd.top_headlines.slice(0, 2).map(function(h: string, i: number) {
                  return React.createElement('div', { key: i, style: { display: '-webkit-box', WebkitLineClamp: '1', WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: '4px' }, title: h }, '• ' + h);
                }),
                nd.top_headlines.length > 2 ? React.createElement('div', { style: { color: '#8c8c8c', fontSize: '11px', marginTop: '4px' } }, t.agent.viewMoreHeadlines.replace('{count}', String(nd.top_headlines.length - 2))) : null
              ) : React.createElement('div', { style: { color: '#bfbfbf', fontSize: '12px', fontStyle: 'italic' } }, t.agent.noSignificantNews)
            ) : React.createElement('div', { style: { color: '#bfbfbf', fontSize: '13px' } }, t.agent.newsSentimentUnavailable)
          ),

          // AI Explanation / Strategic Reasoning
          React.createElement('div', { style: { background: '#fff', borderRadius: 8, border: '1px solid #edf0f2', padding: '12px 16px', boxShadow: '0 2px 4px rgba(24, 144, 255, 0.05)' } },
            React.createElement('div', { style: { fontWeight: 700, fontSize: '11px', color: '#1890ff', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' } }, t.agent.strategicReasoning),
            React.createElement('div', { style: { marginBottom: '10px', display: 'flex', gap: '12px' } },
              React.createElement(FineScanDetailTag, { label: t.agent.tagSource, value: aiExplained ? 'DEEPSEEK-V3' : t.agent.localRulesLabel, color: aiExplained ? '#13c2c2' : '#fa8c16' }),
              aiExplained ? React.createElement(FineScanDetailTag, { label: t.agent.tagTokens, value: t.agent.tokensOptimized }) : null
            ),
            record.finalReason ? React.createElement('div', { style: { fontSize: '13px', color: '#262626', lineHeight: '1.6', marginBottom: '12px', padding: '10px', backgroundColor: '#f0f9ff', borderRadius: '6px', border: '1px solid #e6f4ff' }, title: record.finalReason }, record.finalReason) : null,
            record.nextStep ? React.createElement('div', { style: { borderTop: '1px solid #f0f0f0', paddingTop: '10px' } },
              React.createElement('div', { style: { fontSize: '11px', fontWeight: 700, color: '#1890ff', textTransform: 'uppercase', marginBottom: '4px' } }, t.agent.recommendedNextStep + ':'),
              React.createElement('div', { style: { fontSize: '13px', color: '#1890ff', fontWeight: 600, lineHeight: '1.5' }, title: record.nextStep }, record.nextStep)
            ) : null,
            !aiExplained && !record.finalReason ? React.createElement('div', { style: { color: '#bfbfbf', fontSize: '13px', fontStyle: 'italic' } }, t.agent.compilingReasoning) : null
          )
        )
      ),
      // Footer spacer
      React.createElement('div', { style: { height: '8px' } })
    );
  };  const renderDetailPanel = (record: any) => {
    const score = record.trendScore || record.overallScore || 0;
    const scoreColor = score >= 70 ? '#52c41a' : score >= 40 ? '#faad14' : '#ff4d4f';
    const conf = record.trendConfidence ? (record.trendConfidence * (record.trendConfidence <= 1 ? 100 : 1)).toFixed(0) : 'N/A';

    return (
      <div className="scanner-detail-container">
        {/* Detail Header */}
        <div className="scanner-detail-header">
          <div>
            <div className="scanner-detail-title-group">
              <span className="scanner-detail-symbol">{record.symbol}</span>
              <span className="scanner-detail-company">{record.companyName || record.name || t.agent.unknownCompany}</span>
            </div>
            <div className="scanner-detail-meta">
              {t.agent.lastAnalysis}: {record.timestamp ? new Date(record.timestamp).toLocaleString() : 'N/A'} •
              ID: {record.symbol}-{record.timestamp || 'NEW'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              <div className="scanner-detail-label" style={{ marginBottom: 2 }}>{t.agent.analysisSource}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Tag color={record.aiCalled ? 'green' : 'orange'} style={{ margin: 0, fontWeight: 700 }}>
                  {record.aiCalled ? (record.aiSource || 'AI Agent') : t.agent.localRulesLabel}
                </Tag>
                {record.dataSource && (
                  <Tag color="blue" style={{ margin: 0, fontWeight: 700 }}>{record.dataSource}</Tag>
                )}
              </div>
            </div>
            <Divider type="vertical" style={{ height: 40, margin: '0 8px' }} />
            <div style={{ textAlign: 'center', minWidth: 80 }}>
              <div className="scanner-detail-label" style={{ marginBottom: 2 }}>{t.agent.trendLabel}</div>
              {renderTrendBadge(record.trendLabel)}
            </div>
          </div>
        </div>

        <Row gutter={[20, 20]}>
          {/* Column 1: Market Data & Basic Info */}
          <Col span={8}>
            <Card title={`📊 ${t.agent.marketBasicInfo}`} className="scanner-detail-card" bodyStyle={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Primary Price Info */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  backgroundColor: '#fafafa',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #f0f0f0'
                }}>
                  <div>
                    <div className="scanner-detail-label" style={{ marginBottom: 4 }}>{t.agent.currentPrice}</div>
                    <div className="scanner-detail-value" style={{ fontSize: '22px', color: '#1f1f1f' }}>
                      ${(record.price != null && record.price > 0) ? record.price.toFixed(2) : '—'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="scanner-detail-label" style={{ marginBottom: 4 }}>{t.agent.change24h}</div>
                    {(() => {
                      const cp = record.changePct != null ? record.changePct : (record.changePercent != null ? record.changePercent : null);
                      if (cp == null) {
                        return (
                          <div style={{
                            fontSize: '16px', fontWeight: 800, padding: '2px 8px',
                            borderRadius: '4px', backgroundColor: '#f5f5f5',
                            color: '#bfbfbf', display: 'inline-block'
                          }}>—</div>
                        );
                      }
                      return (
                        <div style={{
                          fontSize: '16px', fontWeight: 800, padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: cp >= 0 ? '#f6ffed' : '#fff1f0',
                          color: cp >= 0 ? '#52c41a' : '#ff4d4f',
                          display: 'inline-block'
                        }}>
                          {cp >= 0 ? '▲' : '▼'}
                          {Math.abs(cp).toFixed(2)}%
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Day Range Info - SWAPPED: Low on Left, High on Right */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '0 4px' }}>
                  <div>
                    <div className="scanner-detail-label">{t.agent.dayLow}</div>
                    <div className="scanner-detail-value" style={{ color: '#595959' }}>{record.dayLow != null ? `$${record.dayLow.toFixed(2)}` : '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="scanner-detail-label">{t.agent.dayHigh}</div>
                    <div className="scanner-detail-value" style={{ color: '#595959' }}>{record.dayHigh != null ? `$${record.dayHigh.toFixed(2)}` : '—'}</div>
                  </div>
                </div>

                <Divider style={{ margin: '4px 0' }} />

                {/* Volume & Liquidity */}
                <div style={{ padding: '0 4px' }}>
                  <div className="scanner-detail-label">{t.agent.volumeLiquidity}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <span className="scanner-detail-value" style={{ fontSize: '16px' }}>{(record.volume != null && record.volume > 0) ? marketDataService.formatVolume(record.volume) : '—'}</span>
                    {(() => {
                      const vs = (record.volumeStatus != null && record.analysisStatus !== 'failed') ? record.volumeStatus : null;
                      if (!vs) {
                        return <Tag color="default" style={{ fontSize: '10px', fontWeight: 800, borderRadius: '4px', margin: 0 }}>N/A</Tag>;
                      }
                      const vsColor = vs === 'High' ? 'red' : vs === 'Low' ? 'green' : 'gold';
                      const vsMap: Record<string, string> = { 'High': t.agent.volumeHigh, 'Normal': t.agent.volumeNormal, 'Low': t.agent.volumeLow };
                      return (
                        <Tag color={vsColor} style={{ fontSize: '10px', fontWeight: 800, borderRadius: '4px', margin: 0 }}>
                          {vsMap[vs] || vs}
                        </Tag>
                      );
                    })()}
                  </div>
                </div>

                {/* Sector & Industry */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '0 4px' }}>
                  <div>
                    <div className="scanner-detail-label">{t.agent.sectorLabel}</div>
                    <div className="scanner-detail-value" style={{ fontSize: '13px', color: '#434343' }}>{translateSector(record.sector) || 'N/A'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="scanner-detail-label">{t.agent.industryLabel}</div>
                    <div className="scanner-detail-value" style={{ fontSize: '13px', color: '#434343' }}>{translateSector(record.industry || record.sector) || 'N/A'}</div>
                  </div>
                </div>

                {/* Data Provenances */}
                <div style={{ 
                  marginTop: '4px',
                  padding: '10px',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '6px',
                  border: '1px dashed #d9d9d9'
                }}>
                  <div className="scanner-detail-label" style={{ marginBottom: 8 }}>{t.agent.dataProvenances}</div>
                  <div style={{ fontSize: '11px', color: '#8c8c8c', lineHeight: '1.8' }}>
                    {record.provenance ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>{t.agent.marketDataLabel}:</span>
                          <span style={{ fontWeight: 600, color: '#595959' }}>{record.provenance.marketData || 'Real-time'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>{t.agent.fundamentalsLabel}:</span>
                          <span style={{ fontWeight: 600, color: '#595959' }}>{record.provenance.companyInfo || 'Finnhub'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>{t.agent.sentimentLabel}:</span>
                          <span style={{ fontWeight: 600, color: '#595959' }}>{record.provenance.news || 'Market News'}</span>
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontStyle: 'italic', color: '#bfbfbf' }}>{t.agent.detailedSourceUnavailable}</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </Col>

          {/* Column 2: Trend & Scores */}
          <Col span={8}>
            <Card title={`📈 ${t.agent.analysisScores}`} className="scanner-detail-card" bodyStyle={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
                    <div className="scanner-detail-label" style={{ margin: 0 }}>{t.agent.overallTrendScore}</div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '26px', fontWeight: 800, color: scoreColor }}>{score.toFixed(0)}</span>
                      <span style={{ fontSize: '14px', color: '#bfbfbf', marginLeft: 4 }}>/100</span>
                    </div>
                  </div>
                  <Progress 
                    percent={score} 
                    strokeColor={scoreColor} 
                    showInfo={false} 
                    strokeWidth={12}
                    style={{ marginBottom: 6 }}
                  />
                  <div style={{ fontSize: '12px', color: '#8c8c8c', textAlign: 'right', fontWeight: 600 }}>
                    {t.agent.confidenceLevel}: <span style={{ color: scoreColor }}>{conf}%</span>
                  </div>
                </div>

                <Divider style={{ margin: '8px 0' }} />

                <div>
                  <div className="scanner-detail-label" style={{ marginBottom: 12 }}>{t.agent.dimensionalBreakdown}</div>
                  <div className="scanner-detail-dimension-grid">
                    {[
                      { label: t.agent.dimTrend, value: record.trendScoreDetail || record.trendScore },
                      { label: t.agent.dimMomentum, value: record.momentumScore },
                      { label: t.agent.dimVolume, value: record.volumeScore },
                      { label: t.agent.dimVolatility, value: record.volatilityScore },
                      { label: t.agent.dimStructure, value: record.structureScore },
                      { label: t.agent.dimSentiment, value: record.newsScore || record.sentimentScore }
                    ].map((item, idx) => (
                      <div key={idx} className="scanner-detail-dimension-item" style={{ padding: '12px' }}>
                        <span className="scanner-detail-label" style={{ margin: 0, fontSize: '10px', color: '#bfbfbf' }}>{item.label}</span>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                          <span className="scanner-detail-value" style={{ fontSize: '16px' }}>
                            {item.value != null ? item.value.toFixed(0) : '--'}
                          </span>
                          <div style={{ 
                            width: 36, 
                            height: 5, 
                            borderRadius: 2, 
                            backgroundColor: '#f0f0f0',
                            overflow: 'hidden' 
                          }}>
                            <div style={{ 
                              width: `${item.value || 0}%`, 
                              height: '100%', 
                              backgroundColor: (item.value || 0) >= 70 ? '#52c41a' : (item.value || 0) >= 40 ? '#faad14' : '#ff4d4f' 
                            }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: 'auto' }}>
                  <div className="scanner-detail-label" style={{ marginBottom: 8 }}>{t.agent.riskProfile}</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <Tag color={record.eventRisk === 'High' ? 'red' : record.eventRisk === 'Medium' ? 'gold' : 'green'} 
                         style={{ fontWeight: 700, padding: '4px 10px', borderRadius: '6px', margin: 0 }}>
                      {t.agent.riskPrefix}: {(() => { const rl = (record.eventRisk || 'LOW').toUpperCase(); const rlMap: Record<string, string> = { 'HIGH': t.agent.riskHigh, 'MEDIUM': t.agent.riskMedium, 'LOW': t.agent.riskLow }; return rlMap[rl] || record.eventRisk || t.agent.riskLow; })()}
                    </Tag>
                    <Tag color={record.volatilityScore > 70 ? 'orange' : 'blue'} 
                         style={{ fontWeight: 700, padding: '4px 10px', borderRadius: '6px', margin: 0 }}>
                      {t.agent.volPrefix}: {record.volatilityScore > 70 ? t.agent.volHigh : t.agent.volStable}
                    </Tag>
                  </div>
                </div>
              </div>
            </Card>
          </Col>

          {/* Column 3: AI Reasoning & News */}
          <Col span={8}>
            <Card title={`🧠 ${t.agent.aiAgentReasoning}`} className="scanner-detail-card" bodyStyle={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
                <div>
                  <div className="scanner-detail-label" style={{ marginBottom: 10 }}>{t.agent.detailedAnalysis}</div>
                  <div className="scanner-detail-reasoning-box" style={{ 
                    backgroundColor: '#f6ffed',
                    border: '1px solid #b7eb8f',
                    borderRadius: '8px',
                    padding: '16px',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    color: '#262626',
                    maxHeight: '180px',
                    overflowY: 'auto'
                  }}>
                    {record.detailedReasoning || record.aiReasoning || record.scannerReason || t.agent.noDetailedAnalysis}
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <div className="scanner-detail-label" style={{ marginBottom: 10 }}>{t.agent.latestMarketNews}</div>
                  <div className="scanner-detail-news-box" style={{ 
                    padding: '14px',
                    backgroundColor: '#fff',
                    border: '1px solid #f0f0f0',
                    borderRadius: '8px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                  }}>
                    {record.topNews ? (
                      <div>
                        <span role="button" tabIndex={0} className="scanner-detail-news-title" onClick={(e) => e.preventDefault()} onKeyDown={(e) => e.preventDefault()} style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: '#1890ff',
                          marginBottom: '8px',
                          display: 'block',
                          lineHeight: '1.4',
                          cursor: 'pointer'
                        }}>
                          {record.topNews.title}
                        </span>
                        <div style={{
                          fontSize: '11px',
                          color: '#bfbfbf',
                          marginBottom: 10,
                          display: 'flex',
                          justifyContent: 'space-between',
                          borderTop: '1px solid #f5f5f5',
                          paddingTop: '6px'
                        }}>
                          <span style={{ fontWeight: 600, color: '#8c8c8c' }}>{record.topNews.source || record.topNews.publisher || 'Source N/A'}</span>
                          <span>{record.topNews.published ? formatNewsDate(record.topNews.published) : ''}</span>
                        </div>
                        <div className="scanner-detail-news-summary" style={{ fontSize: '12px', color: '#595959', lineHeight: '1.5' }}>
                          {record.topNews.summary ?
                            (record.topNews.summary.length > 140 ? record.topNews.summary.substring(0, 140) + '...' : record.topNews.summary) :
                            t.agent.newsConsistent}
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '20px 0', color: '#bfbfbf' }}>
                        <InfoCircleOutlined style={{ fontSize: '24px', marginBottom: 8, display: 'block', opacity: 0.5 }} />
                        <span style={{ fontSize: '12px' }}>{t.agent.noSymbolNews}</span>
                      </div>
                    )}
                  </div>
                </div>

                {record.nextStep && (
                  <div style={{ 
                    marginTop: 'auto', 
                    padding: '14px', 
                    backgroundColor: '#e6f7ff', 
                    borderRadius: '8px',
                    border: '1px solid #91d5ff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    <div className="scanner-detail-label" style={{ color: '#0050b3', margin: 0 }}>{t.agent.agentRecommendation}</div>
                    <div style={{ fontSize: '13px', color: '#003a8c', fontWeight: 700 }}>
                      {record.nextStep}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </Col>
        </Row>
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
      message.warning('Disabled while AI Pipeline is running.');
      return;
    }
    if (preferredContinueScanList.length === 0) {
      message.warning('No continue list candidates available. Run Continue Scan first.');
      return;
    }

    // Register with runner service so isFineScanRunning() returns true during route changes
    const fineScanPromise = _runFineScanLoop();
    registerFineScanRun(fineScanPromise);
    await fineScanPromise;
  };

  const _runFineScanLoop = async () => {
    setFineScanStatus('running');
    setFineScanProgress(0);
    setFineScanStepProgress(0);
    setFineScanCurrentStep('');
    setFineScanResults([]);
    setFineScanMessage('');
    // Clear downstream stale results when Fine Scan re-runs
    setDeeperValidationStatus('idle');
    setDeeperValidationResults(null);
    setEntryPlanStatus('idle');
    setEntryPlanResults(null);

    // Preflight: check session, Alpaca, and AI config
    const preflight = await preflightConfigCheck();
    if (!preflight.ok || !preflight.sessionValid) {
      setFineScanStatus('failed');
      setFineScanMessage(preflight.error || 'Session expired');
      unregisterFineScanRun();
      message.error(preflight.error || 'Session expired');
      return;
    }
    if (!preflight.alpacaConfigured) {
      setFineScanStatus('failed');
      setFineScanMessage('Alpaca Market Data API is not configured. Configure in Settings.');
      unregisterFineScanRun();
      message.error('Alpaca Market Data API is not configured.');
      return;
    }
    if (!preflight.aiAvailable) {
      const reason = preflight.aiKeyIsMasked ? 'AI key is invalid (masked). Re-enter in Settings.' :
                     !preflight.aiConfigured ? 'AI Provider not configured. Configure in Settings.' :
                     preflight.aiTestStatus !== 'connected' ? `AI Provider not tested (${preflight.aiTestStatus}). Click Test AI Connection in Settings.` :
                     'AI unavailable';
      setFineScanStatus('failed');
      setFineScanMessage(reason);
      unregisterFineScanRun();
      message.error(reason);
      return;
    }

    try {
      const results: any[] = [];
      // Read from store directly to avoid stale React closure after processContinueScan
      const csResults = scannerStateStore.getState().continueScan.results;
      const candidates = csResults.length > 0 ? csResults : preferredContinueScanList;
      const candidateCount = candidates.length;

      // Build a lookup map from market scanner results (store direct for freshness)
      const msResults = scannerStateStore.getState().marketScanner.results || [];
      const scannerMap = new Map<string, any>();
      for (const s of msResults.length > 0 ? msResults : marketScannerResults) {
        if (s.symbol) scannerMap.set(s.symbol.toUpperCase(), s);
      }


      // Retry helper for API calls that hit 429 rate limits
      const _fetchWithRetry = async <T extends unknown>(
        label: string,
        fn: () => Promise<T>,
        maxRetries = 3
      ): Promise<{ data: T | null; rateLimited: boolean; error: string | null }> => {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const result = await fn();
            return { data: result, rateLimited: false, error: null };
          } catch (e: any) {
            const status = e?.response?.status || e?.status;
            if (status === 429 && attempt < maxRetries) {
              const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
              console.warn(`[FineScan] ${label} rate limited (429), retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
              await new Promise(r => setTimeout(r, delay));
              continue;
            }
            // Non-retryable or out of retries
            const errMsg = status === 429
              ? 'Rate limited — API throttled'
              : status === 401 || status === 403
                ? 'Config/Auth required'
                : status >= 500
                  ? `Server error (${status})`
                  : e.message || 'Request failed';
            return { data: null, rateLimited: status === 429, error: errMsg };
          }
        }
        return { data: null, rateLimited: true, error: 'Rate limited — max retries exceeded' };
      };

      // --- Fine Scan helper: process one symbol ---
      const _processOneFineScanSymbol = async (
        i: number,
        c: any,
        candidateCount: number,
        results: any[],
        scannerMap: Map<string, any>
      ) => {
        // i, c, candidateCount, results, scannerMap come from function params
        const progress = Math.min(100, Math.round(((i + 1) / candidateCount) * 100));
        setFineScanProgress(progress);
        setFineScanStepProgress(14);
        setFineScanCurrentStep('Strategy Matching');
        setFineScanMessage(`[${i+1}/${candidateCount}] ${c.symbol}: Strategy matching...`);

        const symbol = c.symbol || 'N/A';
        const symbolUpper = symbol.toUpperCase();

        // PRIMARY data source: matching market scanner result
        const ms = scannerMap.get(symbolUpper);

        // ===== FIELD NORMALIZATION: ms (scanner) first, c (continue list) fallback =====
        // Core fields - market scanner always has these when data is valid
        const msTrendLabel = ms?.trendLabel || ms?.trend || null;
        const msScore = ms?.overallScore !== null && ms?.overallScore !== undefined ? ms.overallScore : (ms?.trendScore || null);
        const msPrice = ms?.price || ms?.lastPrice || null;
        const msChangePct = ms?.changePct || ms?.changePercent || ms?.priceChangePct || null;
        const msVolumeStatus = ms?.volumeStatus || null;
        const msSector = ms?.sector || null;
        const msNewsSentiment = ms?.newsSentiment || ms?.newsLabel || null;
        const msEventRisk = ms?.eventRisk || ms?.riskLevel || null;
        const msAiReasoning = ms?.aiReasoning || ms?.conciseReasoning || ms?.reason || ms?.scannerReason || null;

        // Now read: ms first, then c, then default
        const trendLabel      = msTrendLabel   || c.trendLabel || c.trend || 'Neutral';
        const score           = msScore        ?? (c.overallScore || c.trendScore || 0);
        const risk            = msEventRisk    || c.eventRisk || c.riskLevel || 'Medium';
        const sector          = msSector       || c.sector || 'Unknown';
        const priceChange     = msChangePct    ?? (c.priceChangePct || c.changePct || 0);
        const volumeStatus    = msVolumeStatus || c.volumeStatus || 'Normal';
        const newsSentiment   = msNewsSentiment || c.newsSentiment || c.newsLabel || 'Neutral';
        const aiReasoning     = msAiReasoning  || c.aiReasoning || c.conciseReasoning || '';
        const structureLabel  = ms?.structureLabel || c.structureLabel || '';
        const momentumLabel   = ms?.momentumLabel || c.momentumLabel || '';
        const volatilityLabel = ms?.volatilityLabel || c.volatilityLabel || '';
        const confidence      = ms?.trendConfidence || ms?.confidence || c.confidence || 0;
        const relativeVolume  = ms?.relativeVolume || c.relativeVolume || 0;
        const price           = msPrice ?? 0;
        const volume          = ms?.volume || 0;
        const companyName     = ms?.companyName || c.companyName || '';

        // ===== DEBUG LOG: first 3 candidates =====
        if (i < 3) {
          console.log('[FINE SCAN DEBUG] Candidate ' + (i+1) + '/' + candidateCount + ': ' + symbol, {
            dataSource: ms ? 'market_scan' : 'continue_list_only',
            scannerSymbolFound: !!ms,
            trendLabel: trendLabel,
            score: score,
            price: price,
            changePct: priceChange,
            volumeStatus: volumeStatus,
            volume: volume,
            newsSentiment: newsSentiment,
            sector: sector,
            risk: risk,
            structureLabel: structureLabel,
            momentumLabel: momentumLabel,
            aiReasoningLength: aiReasoning ? aiReasoning.length : 0,
          });
        }

        const contextPayload = {
          task: 'strategy_matching',
          symbol,
          dataSource: ms ? 'market_scan' : 'continue_list_only',
          data: {
            trend: trendLabel,
            score,
            confidence,
            risk,
            sector,
            price,
            priceChange,
            volume,
            volumeStatus,
            newsSentiment,
            structureLabel,
            momentumLabel,
            volatilityLabel,
            aiReasoning,
            companyName,
            trendScore: ms?.trendScore ?? c.trendScore ?? 0,
            momentumScore: ms?.momentumScore ?? c.momentumScore ?? 0,
            volumeScore: ms?.volumeScore ?? c.volumeScore ?? 0,
            volatilityScore: ms?.volatilityScore ?? c.volatilityScore ?? 0,
            structureScore: ms?.structureScore ?? c.structureScore ?? 0,
            newsScore: ms?.newsScore ?? c.newsScore ?? 0,
            volumeLabel: ms?.volumeLabel || c.volumeLabel || '',
            newsLabel: ms?.newsLabel || c.newsLabel || '',
            riskLevel: ms?.riskLevel || c.riskLevel || '',
            conciseReason: ms?.conciseReason || c.conciseReason || '',
            overallScore: ms?.overallScore ?? c.overallScore ?? score,
            priorityScore: c.priorityScore || 0,
            priceChangePct: priceChange,
            relativeVolume,
            selectionReason: c.selectionReason || '',
          }
        };

        // === REGIME DETECTION (field-driven, not AI fallback) ===
        // Classify regime based on available market scan data BEFORE AI call
        // This ensures regime is data-driven, not dependent on AI trading endpoint

        // Build technical signal profile from available fields
        const isBullTrend = trendLabel === 'Bullish' || trendLabel === 'Strong Bullish';
        const isBearTrend = trendLabel === 'Bearish' || trendLabel === 'Strong Bearish';
        const hasHighScore = score >= 65;
        const hasHighVolume = volumeStatus === 'High' || (relativeVolume > 1.5);
        const hasLowVolume = volumeStatus === 'Low' || (volume > 0 && volume < 100000 && relativeVolume < 0.5);
        const hasPositiveNews = newsSentiment === 'Positive';
        const hasLargeMove = Math.abs(priceChange) > 5;
        const hasModerateMove = Math.abs(priceChange) > 2;
        const isLowRisk = risk === 'Low';
        const isHighRisk = risk === 'High';
        // ===== REGIME CLASSIFICATION (rule-based, using available fields) =====
        // This is a proxy-based regime matching using market scan proxy fields.
        // Without full EMA/RSI/Bollinger/HH-HL, we estimate structure from
        // trendLabel, score, volumeStatus, priceChange, newsSentiment, risk.
        // The result is an approximation, not a complete technical structure analysis.

        // === INDICATOR FUNCTIONS (reusable) ===
        const isPositiveMove = priceChange > 0;
        const isNegativeMove = priceChange < 0;
        const hasPositiveVol = hasHighVolume && !hasLowVolume;
        const hasNeutralVol = !hasHighVolume && !hasLowVolume && volumeStatus !== 'Unknown';
        const isConsistentRange = !isBullTrend && !isBearTrend && !hasLargeMove;
        const hasStrongTrendBias = isBullTrend && hasHighScore && isPositiveMove && hasPositiveVol;
        const hasConflictingSignals = (isBullTrend && isNegativeMove) || (isBullTrend && hasLowVolume);
        const hasBreakoutPotential = (hasPositiveVol || hasHighVolume) && hasModerateMove && (isBullTrend || isPositiveMove);
        const breakoutIndicators = [
          structureLabel === 'breakout',
          isBullTrend && hasHighVolume && hasModerateMove,
          isBullTrend && hasPositiveNews && hasHighVolume,
          hasHighScore && hasHighVolume && hasModerateMove,
          hasHighVolume && hasLargeMove,
          isBullTrend && isLowRisk && (hasHighVolume || hasModerateMove),
        ];

        // === BUILD SIGNAL LIST ===
        const allSignals: string[] = [];
        if (structureLabel === 'uptrend') allSignals.push('EMA aligned');
        if (structureLabel === 'sideways') allSignals.push('Range-bound');
        if (structureLabel === 'breakout') allSignals.push('Breakout structure');
        if (momentumLabel === 'strengthening') allSignals.push('MACD strengthening');
        if (volatilityLabel === 'low') allSignals.push('Low volatility');
        if (isBullTrend) allSignals.push('Bullish trend');
        if (isBearTrend) allSignals.push('Bearish trend');
        if (hasHighScore) allSignals.push('Score: ' + score);
        if (hasHighVolume) allSignals.push(volumeStatus === 'High' ? 'High volume' : 'Above avg volume');
        if (hasLowVolume) allSignals.push('Low volume');
        if (newsSentiment === 'Positive') allSignals.push('Positive catalyst');
        if (newsSentiment === 'Negative') allSignals.push('Negative news');
        if (price > 0) allSignals.push('Price: $' + Number(price).toFixed(2));
        if (hasLargeMove) allSignals.push('Big move: ' + (priceChange > 0 ? '+' : '') + Number(priceChange).toFixed(1) + '%');
        else if (hasModerateMove) allSignals.push('Moderate move: ' + (priceChange > 0 ? '+' : '') + Number(priceChange).toFixed(1) + '%');
        if (isLowRisk) allSignals.push('Low risk profile');
        if (isHighRisk) allSignals.push('Elevated risk');

        let keySignals: string[] = Array.from(new Set(allSignals)).slice(0, 6);

        let regime = 'Unclear';
        let matchReason = '';
        let matchedStrategies: string[] = [];
        let matchConfidence = 22;

        // ===== THREE-REGIME SCORING =====
        // Each regime gets a score. The highest score that clears its threshold wins.
        // If no regime clears threshold, output remains Unclear.

        // --- Breakout-ready scoring (needs at least 2 breakout-specific indicators) ---
        const bOut = breakoutIndicators.filter(Boolean).length;
        const bExtra = (hasBreakoutPotential ? 1 : 0) + (hasHighVolume && isPositiveMove ? 1 : 0);
        const breakoutScore2 = bOut + bExtra;

        // --- Range-bound scoring (needs at least 2 range-specific indicators) ---
        const rangeIndicators2 = [
          structureLabel === 'sideways',
          isConsistentRange,
          volatilityLabel === 'low' && hasModerateMove,
          hasLowVolume && !hasLargeMove,
          !isBullTrend && !isBearTrend,
          isHighRisk && !hasLargeMove,
          hasConflictingSignals,
          !hasHighScore && !hasLargeMove && hasNeutralVol,
        ];
        const rangeScore2 = rangeIndicators2.filter(Boolean).length;

        // --- Trending scoring (needs at least 2 trend-indicators, no conflicting) ---
        const trendIndicators2 = [
          structureLabel === 'uptrend',
          isBullTrend && hasHighScore && isPositiveMove,
          isBullTrend && isPositiveMove && hasPositiveVol,
          isBullTrend && isLowRisk && isPositiveMove,
          momentumLabel === 'strengthening',
          hasStrongTrendBias,
          hasHighScore && isPositiveMove && !hasLowVolume,
        ];
        const trendScore3 = trendIndicators2.filter(Boolean).length;
        const trendPenalized = hasConflictingSignals ? -2 : 0;

        // === FINAL CLASSIFICATION WITH EXPLICIT BOUNDARY HANDLING ===

        // 1) Breakout-ready: needs clear volume + move + bias, not just ordinary bullish
        if (breakoutScore2 >= 3) {
          regime = 'Breakout-ready';
          matchedStrategies = ['Breakout', 'Volume Confirmation', 'Momentum Continuation'];
          matchConfidence = Math.min(85, 50 + breakoutScore2 * 8 + (hasHighVolume ? 10 : 0));

          const volDetail = hasHighVolume ? 'strong volume expansion' : 'elevated volume with price action';
          const direction = isPositiveMove || isBullTrend ? 'bullish direction' : 'directional expansion';
          matchReason = `${companyName || symbol}: Breakout-ready - ${volDetail} in ${direction}. Not fitting mean-reversion or range setups because momentum and volume support directional continuation. Breakout, volume confirmation, and momentum continuation are the natural fit.`;
        }

        // 2) Range-bound: limited move, mixed signals, no clear break or trend
        else if (rangeScore2 >= 2) {
          regime = 'Range-bound';
          if (hasHighVolume) {
            matchedStrategies = ['RSI', 'Mean Reversion', 'Bollinger Band'];
          } else {
            matchedStrategies = ['RSI', 'Mean Reversion'];
          }
          matchConfidence = Math.min(70, 40 + rangeScore2 * 6);

          const rangeType = structureLabel === 'sideways' ? 'clear sideways channel' : 'proxy-based bounded structure';
          const conflictNote = hasConflictingSignals ? 'with conflicting trend signals, making trend-following unreliable' : 'with limited directional conviction';
          matchReason = `${companyName || symbol}: Range-bound regime in ${rangeType} ${conflictNote}. RSI bounces and mean reversion are preferred over breakouts or trend-following because the price is oscillating within a defined zone without clear expansion.`;
        }

        // 3) Trending: needs clear trend confirmation, no negative/conflicting signals
        else if (trendScore3 >= 2 && trendScore3 + trendPenalized >= 2) {
          const isStrongTrend = trendScore3 >= 4;

          regime = 'Trending';

          if (isStrongTrend) {
            matchedStrategies = ['Moving Average', 'MACD', 'Breakout Follow-through'];
            matchConfidence = Math.min(85, 50 + trendScore3 * 8);
          } else {
            matchedStrategies = ['Moving Average', 'MACD'];
            matchConfidence = Math.min(70, 40 + trendScore3 * 8);
          }
          // Add Momentum Continuation if volume is strong
          if (matchedStrategies.length < 3 && hasHighVolume && isPositiveMove) {
            matchedStrategies.push('Momentum Continuation');
          }

          const strength = isStrongTrend ? 'strong trend continuation pattern' : 'moderate trend confirmation';
          const trendType = momentumLabel === 'strengthening' ? 'with strengthening momentum confirming the uptrend' : 'supported by consistent bullish readings';
          const conflictNote = hasConflictingSignals ? ' despite conflicting volume/price signals' : '';
          matchReason = `${companyName || symbol}: Trending regime - ${strength}${conflictNote} ${trendType}. Price is not range-bound (no sideways structure) and not breakout-ready (insufficient volume expansion). Moving average and MACD suit the established direction.${!isStrongTrend ? ' For stronger trend confirmation and breakout follow-through, additional signals are needed.' : ''}`;
        }

        // 4) CONFLICTING / MIXED SIGNALS (Unclear)
        else if (hasConflictingSignals) {
          regime = 'Unclear';
          matchedStrategies = ['Moving Average'];
          matchConfidence = Math.max(20, Math.min(35, score ? Math.round(score * 0.3) : 20));

          const signal2 = isNegativeMove ? 'negative price action' : 'low volume';
          matchReason = `${companyName || symbol}: Unclear regime - conflicting signals: trend label is '${trendLabel}' but ${signal2}. Trend continuation is not reliable because price/volume contradicts the trend label. Range-bound criteria not met due to insufficient bounded structure evidence. Conservative single-strategy fallback used. Needs more data.`;
        }

        // 5) INSUFFICIENT STRUCTURE (Unclear)
        else {
          regime = 'Unclear';
          matchedStrategies = ['Moving Average'];

          const hasAnyData = price > 0 || score > 0 || volume > 0 || (trendLabel && trendLabel !== 'Neutral');
          if (hasAnyData) {
            matchConfidence = Math.max(20, Math.min(35, score ? Math.round(score * 0.3) : 20));
            matchReason = `${companyName || symbol}: Unclear regime - insufficient structure indicators for confident classification. Score ${score > 0 ? score + ' is' : 'is'} below classification thresholds. Trend not clearly trending, range-bound, or breakout-ready. Single conservative strategy applied.`;
          } else {
            matchConfidence = 15;
            matchReason = `${companyName || symbol}: Unclear regime - insufficient market data for any structure classification. Conservative fallback as Moving Average only.`;
          }
        }

        // Clamp confidence
        matchConfidence = Math.max(15, Math.min(95, matchConfidence));

        // === AI VALIDATION (optional, refines but doesn't override field-driven regime) ===
        // Call AI for additional insight (best-effort, results not required)
        let aiSucceeded = false;
        try {
          const aiResponse = await aiTradingService.previewTradeWithContext(symbol, contextPayload);

          if (aiResponse.success && aiResponse.decision) {
            const strategyMode = aiResponse.decision.strategyMode;
            const aiReason = aiResponse.decision.reason || '';

            // AI can only UPGRADE confidence if it confirms our regime
            if (strategyMode?.marketRegime) {
              const r = strategyMode.marketRegime.toLowerCase();
              let aiRegime = '';
              if (r.includes('trend') || r.includes('momentum')) aiRegime = 'Trending';
              else if (r.includes('range') || r.includes('mean') || r.includes('sideways') || r.includes('bound')) aiRegime = 'Range-bound';
              else if (r.includes('break') || r.includes('volatility') || r.includes('expansion')) aiRegime = 'Breakout-ready';

              if (aiRegime === regime || !aiRegime) {
                // AI confirms our regime - boost confidence
                if (aiResponse.decision.confidence && aiResponse.decision.confidence > 0.5) {
                  matchConfidence = Math.min(95, matchConfidence + Math.round(aiResponse.decision.confidence * 15));
                }
              }
            }

            // AI reasoning can supplement matchReason with fresh insight
            if (aiReason && aiReason.length > 10) {
              const hasStale = ['No market data', 'backtest', 'optimization', 'price is $0', 'Insufficient data']
                .some(p => aiReason.toLowerCase().includes(p.toLowerCase()));
              if (!hasStale) {
                // AI provided useful reasoning - incorporate it
                const firstSentence = aiReason.split('.')[0];
                if (firstSentence.length > 15 && !firstSentence.includes('insufficient') && !firstSentence.includes('no market')) {
                  matchReason = matchReason.split('.')[0] + '. AI confirms: ' + firstSentence.substring(0, 80) + '.';
                }
              }
            }

            aiSucceeded = true;
          }
        } catch (aiError) {
          console.warn('[FINE SCAN] AI validation skipped for ' + symbol + ': ' + (aiError as any).message);
        }

        // (MTF multi-timeframe confirmation removed per user request — no 1D/4H/1H/30m/15m fetching)

        // Priority lookup from marketScannerResults
        const scanData = marketScannerResults && marketScannerResults.length > 0
          ? marketScannerResults.find((r: any) => r.symbol === symbol)
          : undefined;

        results.push({
          symbol,
          __rateLimited: false, // tracks 429 rate limit for fallback decisions
          regime,
          matchedStrategies,
          matchReason,
          keySignals,
          matchConfidence,
          priority: 0,
          aiUsed: aiSucceeded,
          isDevTest: c.isDevTest || false,
          // Step 3: Quick Backtest Validation
          backtestStatus: 'pending',
          backtestSummary: '',
          backtestPerStrategy: [],
          // Inherited from market scan
          scanTrend: scanData?.trendLabel || scanData?.trend || 'N/A',
          scanScore: scanData?.overallScore ?? scanData?.trendScore ?? null,
          scanVolume: scanData?.volumeRatio || scanData?.volume || null,
          // Dynamic provenance tracking
          provenance: {
            marketSource: ms ? 'Market Scanner (Alpaca/Finnhub)' : 'Continue Scan List',
            scannerSource: ms ? 'Alpaca Snapshot + Finnhub Profile' : 'Continue List Fallback',
            backtestSource: 'pending',
            optimizationSource: 'pending',
            entrySource: 'pending',
            liquiditySource: 'pending',
            newsSource: 'pending',
            decisionSource: 'pending',
            explanationSource: 'pending',
            aiCalled: ms?.aiCalled || false,
            aiSource: ms?.aiSource || 'Local Rules',
            aiModel: ms?.aiModel || null,
            aiError: ms?.aiError || null,
            dataQuality: ms?.dataQuality || (ms?.price && ms?.volume ? 'GOOD' : 'PARTIAL'),
            missingFields: [] as string[],
            fallbackUsed: !ms,
          },
        });

        // --- Step 3: Quick Backtest Validation ---
        // Map FineScan strategy names -> Backtest page strategy names
        const btStrategyMap: Record<string, string> = {
          'Moving Average': 'moving_average',
          'Moving Average Crossover': 'moving_average',
          'MACD': 'macd',
          'MACD Strategy': 'macd',
          'RSI': 'rsi',
          'RSI Strategy': 'rsi',
          'Mean Reversion': 'mean_reversion',
          'Bollinger Band': 'bollinger',
          'Bollinger Bands': 'bollinger',
          'Range-bound': 'bollinger',
          'Range Bound': 'bollinger',
          'Range-Bound': 'bollinger',
          'Momentum': 'momentum',
          'Momentum Strategy': 'momentum',
          'Momentum Continuation': 'momentum',
        };
        const supportedStrategies = new Set(['moving_average', 'macd', 'rsi', 'bollinger', 'momentum', 'mean_reversion']);

        let perStrategyResults: any[] = [];
        let execStatus = 'pending';
        let perfStatus: string | null = null;
        let overallSummary = '';

        const rec = results[results.length - 1];

        if (matchedStrategies && matchedStrategies.length > 0) {
          for (let si = 0; si < matchedStrategies.length; si++) {
            const stratName = matchedStrategies[si];
            const mappedName = btStrategyMap[stratName];

            if (!mappedName || !supportedStrategies.has(mappedName)) {
              perStrategyResults.push({ strategy: stratName, status: 'skipped', reason: 'Strategy not supported by local Backtest', totalReturn: null, sharpe: null, maxDrawdown: null, winRate: null, profitFactor: null, tradeCount: null, window: null });
              continue;
            }

            // Try 3M, fallback 6M, fallback 1Y
            let windowLabel = '';
            let btSuccess = false;
            let btData = null;
            let btParams = {};

            for (const win of ['3M', '6M', '1Y']) {
              const daysBack = win === '3M' ? 90 : (win === '6M' ? 180 : 365);
              const sd = new Date(Date.now() - daysBack * 86400000).toISOString().split('T')[0];
              const ed = new Date().toISOString().split('T')[0];
              windowLabel = win;

        setFineScanStepProgress(28);
        setFineScanCurrentStep('Backtest');
        setFineScanMessage(`[${i+1}/${candidateCount}] ${symbol}: ${stratName} testing on ${win}...`);

              const payload = {
                strategy: mappedName, symbol, startDate: sd, endDate: ed,
                initialCapital: 100000, dataMode: 'real', parameters: {},
              };
              btParams = payload;
              const { data: btResp, rateLimited: btLimited, error: btErr } = await _fetchWithRetry(
                `Backtest ${symbol} ${stratName} ${win}`,
                () => backtraderAPI.runBacktest(payload) as any,
                2 // 1s, 2s retries
              );
              if (btResp) {
                const btResult = (btResp as any)?.data?.result;
                if (btResult?.results) {
                  btData = btResult.results;
                  btSuccess = true;
                  break;
                }
              }
              // Track rate limit for fallback decision
              if (btLimited) rec.__rateLimited = true;
            }

            if (!btSuccess || !btData) {
              const reason = rec.__rateLimited ? 'Backtest rate limited — API throttled' : 'Backtest failed for all time windows';
              perStrategyResults.push({ strategy: stratName, status: 'error', reason, totalReturn: null, sharpe: null, maxDrawdown: null, winRate: null, profitFactor: null, tradeCount: null, window: null, _params: btParams });
              continue;
            }

            const tr = btData.totalReturn ?? 0;
            const shrp = btData.sharpeRatio ?? 0;
            const mdd = btData.maxDrawdown ?? 0;
            const wr = btData.winRate ?? 0;
            const pf = btData.profitFactor ?? 0;
            const tcnt = btData.trades ?? 0;

            let sStatus = 'completed_losing';
            if (tr > 0 && pf > 1 && tcnt >= 3 && mdd < 30) { sStatus = 'passed'; }
            else if (tr > -10 && tcnt >= 2 && mdd < 40) { sStatus = 'caution'; }

            perStrategyResults.push({
              strategy: stratName, status: sStatus, reason: '',
              totalReturn: tr, sharpe: shrp, maxDrawdown: mdd,
              winRate: wr, profitFactor: pf, tradeCount: tcnt, window: windowLabel, _params: btParams,
            });

            if (si < matchedStrategies.length - 1) await new Promise(r => setTimeout(r, 300));
          }

          // Compute overall — split execution + performance
          const passed = perStrategyResults.filter(r => r.status === 'passed').length;
          const caution = perStrategyResults.filter(r => r.status === 'caution').length;
          const losing = perStrategyResults.filter(r => r.status === 'completed_losing').length;
          const err = perStrategyResults.filter(r => r.status === 'error').length;

          execStatus = 'pass';
          perfStatus = null;

          if (passed >= 1) {
            execStatus = 'pass';
            perfStatus = 'positive';
            const best = perStrategyResults.find(r => r.status === 'passed' && r.totalReturn > -999);
            const retStr = best ? (best.totalReturn >= 0 ? '+' : '') + Number(best.totalReturn).toFixed(1) + '%' : '';
            const pfStr = best && best.profitFactor > 0 ? 'PF ' + Number(best.profitFactor).toFixed(1) : '';
            overallSummary = 'Pass | Positive: ' + (best?.strategy || '') + (retStr ? ' ' + retStr : '') + (pfStr ? ', ' + pfStr : '');
          } else if (caution >= 1) {
            execStatus = 'pass';
            perfStatus = 'caution';
            const c = perStrategyResults.find(r => r.status === 'caution');
            const retStr = c ? (c.totalReturn >= 0 ? '+' : '') + Number(c.totalReturn).toFixed(1) + '%' : '';
            overallSummary = 'Pass | Caution: ' + (c?.strategy || '') + (retStr ? ' ' + retStr : '');
          } else if (losing >= 1) {
            execStatus = 'pass';
            perfStatus = 'negative';
            const l = perStrategyResults.find(r => r.status === 'completed_losing');
            overallSummary = 'Pass | Negative: ' + (l?.strategy || '') + ', return ' + (l?.totalReturn ?? 0).toFixed(1) + '%';
          } else if (err >= 1) {
            execStatus = 'fail';
            perfStatus = null;
            overallSummary = 'Fail: No usable metrics from backtest';
          } else {
            execStatus = 'fail';
            perfStatus = null;
            overallSummary = perStrategyResults.length === 0 ? 'No strategy tested' : 'Tests failed';
          }
        } else {
          execStatus = 'skipped';
          perfStatus = null;
          overallSummary = 'No strategy to test';
        }

        // Update last result record (rec already declared above)
        if (rec && rec.symbol === symbol) {
          rec.backtestStatus = execStatus;
          rec.backtestPerformance = perfStatus;
          rec.backtestSummary = overallSummary;
          rec.backtestPerStrategy = perStrategyResults;
          // Update provenance
          if (rec.provenance) {
            rec.provenance.backtestSource = execStatus === 'pass' ? 'Internal Backtest Engine' : (execStatus === 'fail' ? 'Backtest Failed' : 'Skipped');
            rec.provenance.optimizationSource = 'pending';
          }

          // Quick Optimization: lightweight parameter stability check
          // Run for any symbol with a successful backtest execution regardless of sign
          const canOptimize = (execStatus === 'pass') && perStrategyResults.some(
            (r: any) => r.status === 'passed' || r.status === 'caution' || r.status === 'completed_losing'
          );
          rec.quickOptStatus = 'skipped';
          rec.quickOptResults = [];
          rec.quickOptSummary = null;

          if (canOptimize) {
            rec.quickOptStatus = 'running';
            // Update progress to show optimization phase
        setFineScanStepProgress(42);
        setFineScanCurrentStep('Optimization');
        setFineScanMessage(`[${i+1}/${candidateCount}] ${symbol}: Quick Optimization...`);

            const optStartTime = Date.now();
            const optResults: any[] = [];

            // Get strategies that had usable backtest data
            const optimizableStrategies = perStrategyResults.filter(
              (ps: any) => ps.status === 'passed' || ps.status === 'caution' || ps.status === 'completed_losing'
            );

            // Define lightweight parameter grids: {paramKey: [values]}
            const paramGrid: Record<string, any[]> = {
              'moving_average': [
                { shortMaRange: {start:9,end:9,step:1}, longMaRange: {start:21,end:21,step:1}, label: '9/21' },
                { shortMaRange: {start:10,end:10,step:1}, longMaRange: {start:20,end:20,step:1}, label: '10/20' },
                { shortMaRange: {start:12,end:12,step:1}, longMaRange: {start:26,end:26,step:1}, label: '12/26' },
              ],
              'rsi': [
                { rsiPeriodRange: {start:14,end:14,step:1}, overboughtRange: {start:70,end:70,step:1}, oversoldRange: {start:30,end:30,step:1}, label: '70/30' },
                { rsiPeriodRange: {start:14,end:14,step:1}, overboughtRange: {start:75,end:75,step:1}, oversoldRange: {start:25,end:25,step:1}, label: '75/25' },
                { rsiPeriodRange: {start:14,end:14,step:1}, overboughtRange: {start:65,end:65,step:1}, oversoldRange: {start:35,end:35,step:1}, label: '65/35' },
              ],
              'macd': [
                { fastRange: {start:12,end:12,step:1}, slowRange: {start:26,end:26,step:1}, signalRange: {start:9,end:9,step:1}, label: '12/26/9' },
                { fastRange: {start:10,end:10,step:1}, slowRange: {start:24,end:24,step:1}, signalRange: {start:9,end:9,step:1}, label: '10/24/9' },
                { fastRange: {start:8,end:8,step:1}, slowRange: {start:21,end:21,step:1}, signalRange: {start:5,end:5,step:1}, label: '8/21/5' },
              ],
              'bollinger': [
                { periodRange: {start:20,end:20,step:1}, stdDevRange: {start:2.0,end:2.0,step:0.5}, label: '20/2.0' },
                { periodRange: {start:18,end:18,step:1}, stdDevRange: {start:2.5,end:2.5,step:0.5}, label: '18/2.5' },
                { periodRange: {start:22,end:22,step:1}, stdDevRange: {start:1.5,end:1.5,step:0.5}, label: '22/1.5' },
              ],
              'momentum': [
                { momentumPeriodRange: {start:10,end:10,step:1}, label: '10' },
                { momentumPeriodRange: {start:14,end:14,step:1}, label: '14' },
                { momentumPeriodRange: {start:20,end:20,step:1}, label: '20' },
              ],
              'mean_reversion': [
                { lookbackRange: {start:20,end:20,step:1}, entryZScoreRange: {start:-2.0,end:-2.0,step:0.5}, exitZScoreRange: {start:0.0,end:0.0,step:0.5}, label: '20/-2.0/0.0' },
                { lookbackRange: {start:25,end:25,step:1}, entryZScoreRange: {start:-1.5,end:-1.5,step:0.5}, exitZScoreRange: {start:0.0,end:0.0,step:0.5}, label: '25/-1.5/0.0' },
                { lookbackRange: {start:15,end:15,step:1}, entryZScoreRange: {start:-2.5,end:-2.5,step:0.5}, exitZScoreRange: {start:-0.5,end:-0.5,step:0.5}, label: '15/-2.5/-0.5' },
              ],
            };

            // Map FineScan strategy name to backend strategy key
            const fsToBackend: Record<string, string> = {
              'Moving Average': 'moving_average',
              'Moving Average Crossover': 'moving_average',
              'MACD': 'macd',
              'MACD Strategy': 'macd',
              'RSI': 'rsi',
              'RSI Strategy': 'rsi',
              'Mean Reversion': 'mean_reversion',
              'Bollinger Band': 'bollinger',
              'Bollinger Bands': 'bollinger',
              'Range-bound': 'bollinger',
              'Momentum': 'momentum',
              'Momentum Continuation': 'momentum',
            };

            for (let oi = 0; oi < optimizableStrategies.length; oi++) {
              const ps = optimizableStrategies[oi];
              const backendKey = fsToBackend[ps.strategy];
              if (!backendKey || !paramGrid[backendKey]) continue;

              const paramPoints = paramGrid[backendKey];
              const btWindow = ps.window || '3M';
              const daysBack = btWindow === '3M' ? 90 : (btWindow === '6M' ? 180 : 365);
              const sd = new Date(Date.now() - daysBack * 86400000).toISOString().split('T')[0];
              const ed = new Date().toISOString().split('T')[0];

              const strategyOptResults: any[] = [];

              for (let pi = 0; pi < paramPoints.length; pi++) {
                const pp = paramPoints[pi];
                const optPayload: any = {
                  symbol, strategy: backendKey,
                  startDate: sd, endDate: ed,
                  initialCapital: 100000,
                  ...pp,
                };
                delete optPayload.label;

                try {
                  const optResp = await backtraderAPI.runParameterOptimization(optPayload);
                  const optData = (optResp as any)?.data?.result;
                  if (optData?.results && optData.results.length > 0) {
                    // Use the first (best) result or aggregate
                    const best = optData.results[0];
                    strategyOptResults.push({
                      label: paramPoints[pi].label || `idx${pi}`,
                      totalReturn: best.totalReturn ?? 0,
                      sharpe: best.sharpeRatio ?? 0,
                      maxDrawdown: best.maxDrawdown ?? 0,
                      winRate: best.winRate ?? 0,
                      profitFactor: best.profitFactor ?? 0,
                      tradeCount: best.trades ?? 0,
                      params: paramPoints[pi],
                    });
                  } else {
                    strategyOptResults.push({
                      label: paramPoints[pi].label || `idx${pi}`,
                      totalReturn: 0,
                      sharpe: 0,
                      maxDrawdown: 0,
                      error: 'No results returned',
                      params: paramPoints[pi],
                    });
                  }
                } catch (optErr) {
                  strategyOptResults.push({
                    label: paramPoints[pi].label || `idx${pi}`,
                    totalReturn: 0,
                    sharpe: 0,
                    maxDrawdown: 0,
                    error: (optErr as any).message || 'Request failed',
                    params: paramPoints[pi],
                  });
                }
              }

              if (strategyOptResults.length > 0) {
                // Compute stability
                const returns = strategyOptResults.map(r => r.totalReturn).filter((v: number) => !isNaN(v));
                const positiveCount = returns.filter((v: number) => v > 0).length;
                const avgReturn = returns.length > 0 ? returns.reduce((a: number, b: number) => a + b, 0) / returns.length : 0;
                const stdReturn = returns.length > 1
                  ? Math.sqrt(returns.reduce((sum: number, v: number) => sum + Math.pow(v - avgReturn, 2), 0) / returns.length)
                  : 0;

                let stability: string;
                if (returns.length === 0) {
                  stability = 'N/A';
                } else if (positiveCount / returns.length >= 0.7 && stdReturn < 10) {
                  stability = 'Stable';
                } else if (positiveCount / returns.length >= 0.4 || stdReturn < 20) {
                  stability = 'Weak';
                } else {
                  stability = 'Overfit Risk';
                }

                // Check overfit: only 1 param point with >10% return, all others <2%
                const highReturners = returns.filter((v: number) => v > 10);
                const lowReturners = returns.filter((v: number) => v < 2);
                if (highReturners.length === 1 && lowReturners.length >= returns.length - 1 && returns.length > 1) {
                  stability = 'Overfit Risk';
                }

                optResults.push({
                  strategy: ps.strategy,
                  backendKey,
                  paramCount: paramPoints.length,
                  results: strategyOptResults,
                  returns,
                  avgReturn: Number(avgReturn.toFixed(2)),
                  stdReturn: Number(stdReturn.toFixed(2)),
                  positiveRatio: returns.length > 0 ? Number((positiveCount / returns.length * 100).toFixed(0)) : 0,
                  stability,
                });
              }

              // Small delay between strategy optimizations
              if (oi < optimizableStrategies.length - 1) await new Promise(r => setTimeout(r, 200));
            }

            const optElapsed = Date.now() - optStartTime;
            rec.quickOptResults = optResults;
            // Update provenance
            if (rec.provenance) {
              rec.provenance.optimizationSource = optResults.length > 0 ? 'Internal Optimization Engine' : 'Optimization Skipped';
            }

            // Compute overall optimization status
            if (optResults.length === 0) {
              rec.quickOptStatus = 'skipped';
              rec.quickOptSummary = null;
            } else {
              rec.quickOptStatus = 'completed';
              const stableCount = optResults.filter((r: any) => r.stability === 'Stable').length;
              const weakCount = optResults.filter((r: any) => r.stability === 'Weak').length;
              const overfitCount = optResults.filter((r: any) => r.stability === 'Overfit Risk').length;

              if (stableCount >= optResults.length * 0.7) {
                rec.quickOptSummary = `Stable (${stableCount}/${optResults.length} strategies) - in ${(optElapsed / 1000).toFixed(0)}s`;
              } else if (weakCount > overfitCount) {
                rec.quickOptSummary = `Weak (${weakCount}/${optResults.length} mixed) - in ${(optElapsed / 1000).toFixed(0)}s`;
              } else {
                rec.quickOptSummary = `Overfit Risk (${overfitCount}/${optResults.length} unstable) - in ${(optElapsed / 1000).toFixed(0)}s`;
              }
            }
          }
        }
        // --- End Step 3 (Quick Backtest + Optimization) ---

        // --- Step 4: Entry Quality Scan (Alpaca-based) ---
        setFineScanStepProgress(57);
        setFineScanCurrentStep('Entry Quality');
        setFineScanMessage(`[${i + 1}/${candidateCount}] ${symbol}: assessing entry quality...`);
        {
          const { data: eqResp, rateLimited: eqRL, error: eqErr } = await _fetchWithRetry(
            `EntryQuality ${symbol}`,
            () => entryQualityAPI.assessEntry(symbol) as any,
          );
          if (eqResp) {
            const ed = (eqResp as any).data;
            if (ed?.success) {
              rec.entryQuality = ed.entry_quality;
              rec.entryReason = ed.entry_reason || '';
              rec.entryScore = ed.entry_score || 0;
              rec.entryDetails = ed.details || null;
              if (rec.provenance) rec.provenance.entrySource = 'Entry Quality API (Alpaca)';
            } else {
              rec.entryQuality = 'Error / No Data';
              rec.entryReason = ed?.message || 'API returned no valid data';
              rec.entryDetails = null;
              if (rec.provenance) { rec.provenance.entrySource = 'Entry Quality Failed'; rec.provenance.dataQuality = 'PARTIAL'; }
            }
          } else {
            rec.entryQuality = eqRL ? 'Rate Limited' : 'Error / No Data';
            rec.entryReason = eqErr || 'Alpaca request failed';
            rec.entryDetails = null;
            rec.__rateLimited = eqRL || rec.__rateLimited;
            if (rec.provenance) { rec.provenance.entrySource = `Entry Quality ${eqRL ? 'Rate Limited' : 'Failed'}`; rec.provenance.dataQuality = 'PARTIAL'; }
            if (eqRL) console.warn(`[EntryQuality] ${symbol} rate limited after retries`);
          }
        }
        // --- End Step 4: Entry Quality ---

        // --- Step 5: Liquidity / Volume Scan (Step 6) ---
        setFineScanStepProgress(71);
        setFineScanCurrentStep('Liquidity / Volume Check');
        setFineScanMessage(`[${i + 1}/${candidateCount}] ${symbol}: liquidity/volume check...`);
        {
          const { data: advResp, rateLimited: advRL, error: advErr } = await _fetchWithRetry(
            `FineScanAdvanced ${symbol}`,
            () => fineScanAdvancedAPI.scan(symbol, rec.entryDetails) as any,
          );
          if (advResp) {
            const ad = (advResp as any).data;
            if (ad?.success) {
              rec.liquidityGrade = ad.liquidity?.grade || 'Error';
              rec.liquidityReason = ad.liquidity?.reason || '';
              rec.liquidityDetails = ad.liquidity?.details || null;
              rec.newsGrade = ad.news?.grade || 'Error';
              rec.newsReason = ad.news?.reason || '';
              rec.newsDetails = ad.news?.details || null;
              rec.riskGrade = ad.risk?.grade || 'MEDIUM';
              rec.riskReason = ad.risk?.reason || '';
              rec.riskDetails = ad.risk?.details || null;
              if (rec.provenance) {
                rec.provenance.liquiditySource = 'Fine Scan Advanced API';
                rec.provenance.newsSource = 'Fine Scan Advanced API (Finnhub/Alpaca)';
              }
            } else {
              rec.liquidityGrade = 'Error';
              rec.newsGrade = 'Error';
              rec.riskGrade = 'SKIP';
              rec.riskReason = 'API returned no valid data';
              if (rec.provenance) { rec.provenance.liquiditySource = 'Failed'; rec.provenance.newsSource = 'Failed'; rec.provenance.dataQuality = 'PARTIAL'; }
            }
          } else {
            rec.liquidityGrade = advRL ? 'Rate Limited' : 'Error';
            rec.newsGrade = advRL ? 'Rate Limited' : 'Error';
            rec.riskGrade = advRL ? 'Unknown' : 'SKIP';
            rec.riskReason = advErr || 'advanced scan failed';
            rec.__rateLimited = advRL || rec.__rateLimited;
            if (rec.provenance) {
              rec.provenance.liquiditySource = advRL ? 'Rate Limited' : 'Failed';
              rec.provenance.newsSource = advRL ? 'Rate Limited' : 'Failed';
              rec.provenance.dataQuality = 'PARTIAL';
            }
            if (advRL) console.warn(`[FineScanAdvanced] ${symbol} rate limited after retries`);
          }
        }
        // --- End Steps 5-6-7: Liquidity, News, Risk ---

        // Compute Decision: Continue / Watch / Skip — try AI first, fallback to local rules
        rec.decision = 'Watch'; // default
        rec.decisionSource = 'pending';
        rec.fineScanGrade = 'MEDIUM';
        rec.decisionConfidence = 0;
        {
          const { data: decisionResp, rateLimited: decRL, error: decErr } = await _fetchWithRetry(
            `FineScanDecision ${symbol}`,
            () => fineScanDecisionAPI.decide({
              symbol: rec.symbol,
              trendLabel: rec.trendLabel || rec.trend || 'Neutral',
              trendScore: rec.scanScore || 50,
              matchedStrategies: rec.matchedStrategies || [],
              matchConfidence: rec.matchConfidence || 0,
              backtestStatus: rec.backtestStatus || '',
              backtestPerformance: rec.backtestPerformance || '',
              backtestTotalReturn: rec.backtestPerStrategy?.[0]?.totalReturn,
              entryQuality: {
                grade: rec.entryQuality || '',
                score: rec.entryScore || 0,
                zone: rec.entryDetails?.zone || '',
              },
              liquidityGrade: rec.liquidityGrade || '',
              newsGrade: rec.newsGrade || '',
              riskGrade: rec.riskGrade || '',
              riskScore: rec.riskScore || 0,
              entryScore: rec.entryScore || 0,
            }) as any,
          );
          if (decisionResp) {
            const dd = (decisionResp as any).data;
            if (dd && dd.success) {
              const rawDecision = (dd.decision || '').toUpperCase();
              rec.rawAiVerdict = rawDecision;
              if (rawDecision === 'CONTINUE') rec.decision = 'Continue';
              else if (rawDecision === 'REJECT') rec.decision = 'Reject';
              else if (rawDecision === 'NEED_MORE_DATA') rec.decision = 'NeedMoreData';
              else if (rawDecision === 'WATCH') rec.decision = 'Watch';
              else if (rawDecision === 'SKIP') rec.decision = 'Skip';
              else rec.decision = 'Watch';
              rec.fineScanGrade = dd.grade;
              rec.decisionConfidence = dd.confidence;
              rec.decisionSource = dd.source;
              rec.decisionReason = dd.reason;
              if (dd.decisionDetail) {
                rec.decisionStrengths = dd.decisionDetail.strengths || [];
                rec.decisionWarnings = dd.decisionDetail.warnings || [];
                rec.decisionBlockers = dd.decisionDetail.blockers || [];
              }
              if (!rec.decisionBlockers) rec.decisionBlockers = [];
              if (!rec.decisionWarnings) rec.decisionWarnings = [];
              if (rec.provenance) {
                rec.provenance.decisionSource = dd.source === 'ai' ? 'DeepSeek AI' : 'Local Rules';
                rec.provenance.aiCalled = dd.source === 'ai';
              }
              console.log(`[FineScanDecision] ${symbol}: AI raw=${rawDecision} → final=${rec.decision} reason=${rec.decisionReason}`);
            } else {
              console.warn(`[FineScanDecision] ${symbol} API returned no data, using local rules`);
              // fall through to local rules below
            }
          }
          if (!decisionResp || !((decisionResp as any)?.data?.success)) {
            // 429 / error: log and use local rules
            if (decRL) {
              rec.__rateLimited = true;
              rec.decision = 'NeedMoreData';
              rec.fineScanGrade = 'LOW';
              rec.decisionReason = 'Rate limited — API throttled. Will retry next interval.';
              rec.decisionBlockers = ['Rate limited — retry later'];
              rec.decisionSource = 'rate_limit';
              if (rec.provenance) rec.provenance.decisionSource = 'Rate Limited';
              console.warn(`[FineScanDecision] ${symbol} rate limited, marking as NeedMoreData`);
            } else {
              // Non-rate-limit error: use local rules
              console.warn(`[FineScanDecision] ${symbol} error: ${decErr}, using local rules`);
              const btOk = rec.backtestStatus === 'pass' && (rec.backtestPerformance === 'positive' || rec.backtestPerformance === 'caution');
              const btMissing = !rec.backtestStatus || rec.backtestStatus === 'pending' || rec.backtestStatus === 'skipped';
              const btFail = rec.backtestStatus === 'fail' || rec.backtestPerformance === 'negative';
              const eqOk = rec.entryQuality === 'Excellent' || rec.entryQuality === 'Good' || rec.entryQuality === 'Wait for Pullback' || rec.entryQuality === 'Breakout Setup';
              const eqBad = rec.entryQuality === 'Avoid / Downtrend' || rec.entryQuality === 'Chasing / Extended';
              const eqAcceptable = eqOk || rec.entryQuality === 'Acceptable' || rec.entryQuality === 'Fair';
              const riskOk = rec.riskGrade === 'LOW' || rec.riskGrade === 'MEDIUM';
              const riskHigh = rec.riskGrade === 'HIGH';
              const riskSkip = rec.riskGrade === 'SKIP';
              const riskUnknown = !rec.riskGrade || rec.riskGrade === '' || rec.riskGrade === 'Unknown';
              const liqPoor = rec.liquidityGrade === 'Poor';
              const liqUnknown = !rec.liquidityGrade || rec.liquidityGrade === '' || rec.liquidityGrade === 'Data Unavailable' || rec.liquidityGrade === 'Unknown';
              const score = rec.matchConfidence || 0;
              const trendBullish = rec.trendLabel === 'Strong Bullish' || rec.trendLabel === 'Bullish';
              const trendBearish = rec.trendLabel === 'Strong Bearish' || rec.trendLabel === 'Bearish';
              const hasPrice = rec.price > 0;
              const hasVolume = rec.volume > 0;

              const blockers: string[] = [];
              const warnings: string[] = [];

              if (!hasPrice) blockers.push('price missing');
              if (!hasVolume) warnings.push('volume missing or zero');
              if (btFail) blockers.push('backtest negative');
              if (eqBad) blockers.push(`entry quality: ${rec.entryQuality}`);
              if (riskSkip) blockers.push('risk SKIP (critical data missing)');
              if (trendBearish) warnings.push('bearish trend');
              if (riskHigh) warnings.push('risk HIGH');
              if (liqPoor) warnings.push('liquidity Poor');
              if (liqUnknown) warnings.push('liquidity data unavailable');
              if (btMissing) warnings.push('backtest not run');
              if (rec.liquidityGrade === 'Error') warnings.push('liquidity check failed');

              if (!hasPrice) {
                rec.decision = 'NeedMoreData';
                rec.fineScanGrade = 'LOW';
                rec.decisionReason = 'Price data missing — cannot assess';
              }
              // REJECT: only truly critical blockers
              else if (riskSkip) {
                rec.decision = 'Reject';
                rec.fineScanGrade = 'LOW';
                rec.decisionReason = `Risk SKIP: ${rec.riskReason || 'critical data missing'}`;
              }
              else if (eqBad && trendBearish) {
                rec.decision = 'Reject';
                rec.fineScanGrade = 'LOW';
                rec.decisionReason = `Entry ${rec.entryQuality} + bearish trend`;
              }
              // CONTINUE: strong signals — riskOk preferred but riskHigh alone does NOT block
              else if (score >= 55 && trendBullish && !eqBad && (riskOk || riskUnknown)) {
                rec.decision = 'Continue';
                rec.fineScanGrade = btOk ? 'HIGH' : 'MEDIUM';
                rec.decisionReason = `Score ${score}, ${rec.trendLabel}, entry ${rec.entryQuality || 'N/A'}, risk ${rec.riskGrade || 'N/A'}`;
              }
              // CONTINUE: strong signals + riskHigh → still Continue but flag warning
              else if (score >= 60 && trendBullish && !eqBad && riskHigh) {
                rec.decision = 'Continue';
                rec.fineScanGrade = 'MEDIUM';
                rec.decisionReason = `Score ${score}, trend bullish, but risk HIGH — proceed with caution`;
              }
              // CONTINUE: good backtest + decent score
              else if (btOk && score >= 40 && !eqBad) {
                rec.decision = 'Continue';
                rec.fineScanGrade = 'MEDIUM';
                rec.decisionReason = `Backtest OK, score ${score}`;
              }
              // CONTINUE: backtest missing but trend/entry/risk acceptable
              else if (btMissing && score >= 45 && trendBullish && (riskOk || riskUnknown) && eqAcceptable) {
                rec.decision = 'Continue';
                rec.fineScanGrade = 'MEDIUM';
                rec.decisionReason = `Score ${score}, trend bullish, backtest N/A (not blocking)`;
              }
              // CONTINUE: score decent + entry OK + not bearish, regardless of risk (risk is advisory at Fine Scan)
              else if (score >= 50 && !eqBad && !trendBearish && (riskOk || riskHigh || riskUnknown)) {
                rec.decision = 'Continue';
                rec.fineScanGrade = 'MEDIUM';
                rec.decisionReason = `Score ${score}, entry OK, risk ${rec.riskGrade || 'N/A'} (advisory)`;
              }
              // WATCH: mixed signals
              else if (score >= 30 && hasPrice) {
                rec.decision = 'Watch';
                rec.fineScanGrade = 'MEDIUM';
                rec.decisionReason = `Score ${score}, mixed signals. Blockers: ${blockers.length > 0 ? blockers.join('; ') : 'none'}. Warnings: ${warnings.join('; ') || 'none'}`;
              }
              // NeedMoreData: score too low and no backtest
              else if (score < 30 && btMissing) {
                rec.decision = 'NeedMoreData';
                rec.fineScanGrade = 'LOW';
                rec.decisionReason = `Low score (${score}), backtest missing`;
              }
              // Default Watch
              else {
                rec.decision = 'Watch';
                rec.fineScanGrade = 'MEDIUM';
                rec.decisionReason = `Default Watch — score ${score}, blockers: ${blockers.join('; ') || 'none'}`;
              }
              rec.decisionSource = 'local-rule';
              rec.decisionConfidence = score;
              rec.decisionBlockers = blockers;
              rec.decisionWarnings = warnings;
            }
          }
        }

        // Dev Test override: if this is a test candidate and didn't get Continue, force it
        // so the test candidate can flow through the full pipeline
        if (rec.isDevTest && rec.decision !== 'Continue') {
          console.log(`[FineScanDecision] ${symbol}: DEV TEST override — ${rec.decision} → Continue`);
          rec.decision = 'Continue';
          rec.fineScanGrade = 'MEDIUM';
          rec.decisionReason = '[TEST OVERRIDE] Dev test candidate forced Continue for pipeline testing';
          rec.decisionSource = 'dev-test-override';
          rec.decisionBlockers = [];
          rec.decisionWarnings = ['This is a TEST candidate — decision was overridden'];
        }

        rec.scanStatus = 'completed';

        // ===== AI EXPLANATION (per-symbol, inline) =====
        // Call AI explain RIGHT NOW for this symbol, before moving to the next
        if (matchConfidence >= 15) {
          setFineScanStepProgress(85);
          setFineScanCurrentStep('AI Reasoning');
          setFineScanMessage(`[${i+1}/${candidateCount}] ${symbol}: AI reasoning...`);

          { // rate-limited fetch for Explain
            const explainData: import('../services/api').FineScanExplainRequest = {
              symbol: rec.symbol,
              trendLabel: rec.trendLabel || rec.trend || 'Neutral',
              trendScore: rec.scanScore ?? null,
              matchedStrategies: rec.matchedStrategies || [],
              backtestMetrics: {
                totalReturn: rec.backtestPerStrategy?.[0]?.totalReturn,
                sharpe: rec.backtestPerStrategy?.[0]?.sharpe,
                winRate: rec.backtestPerStrategy?.[0]?.winRate,
                profitFactor: rec.backtestPerStrategy?.[0]?.profitFactor,
                maxDrawdown: rec.backtestPerStrategy?.[0]?.maxDrawdown,
                tradeCount: rec.backtestPerStrategy?.[0]?.tradeCount,
              },
              optimizationMetrics: {
                stability: rec.quickOptSummary?.stability,
                avgReturn: rec.quickOptSummary?.avgReturn,
                positiveRatio: rec.quickOptSummary?.positiveRatio,
              },
              entryQuality: {
                grade: rec.entryQuality,
                score: rec.entryScore,
                atr: rec.entryDetails?.atr,
                zone: rec.entryDetails?.zone,
              },
              liquidity: {
                grade: rec.liquidityGrade,
                score: rec.liquidityScore,
              },
              newsSummary: {
                grade: rec.newsGrade,
                headlineCount: rec.newsDetails?.headlines?.length,
              },
              riskAssessment: {
                grade: rec.riskGrade,
                score: rec.riskScore,
                reason: rec.riskReason,
              },
            };

            const { data: explainResp, rateLimited: expRL } = await _fetchWithRetry(
              `FineScanExplain ${symbol}`,
              () => fineScanExplainAPI.explain(explainData) as any,
              2
            );
            if (explainResp) {
              const resp = (explainResp as any).data;
              if (resp.success) {
                if (resp.whyMatched) rec.matchReason = resp.whyMatched;
                if (resp.keySignalExplanation) rec.keySignalExplanation = resp.keySignalExplanation;
                if (resp.finalReason) rec.finalReason = resp.finalReason;
                if (resp.nextStep) rec.nextStep = resp.nextStep;
                rec.aiExplained = true;
                if (rec.provenance) {
                  rec.provenance.explanationSource = 'DeepSeek AI';
                  rec.provenance.aiCalled = true;
                  rec.provenance.aiSource = 'DeepSeek';
                  rec.provenance.aiModel = 'deepseek-chat';
                }
              } else {
                if (rec.provenance) rec.provenance.explanationSource = 'Explain API failed';
              }
            } else {
              if (expRL) {
                rec.__rateLimited = true;
                if (rec.provenance) rec.provenance.explanationSource = 'Rate Limited';
              } else {
                if (rec.provenance) rec.provenance.explanationSource = 'Explain API error';
              }
            }
          }
        }

        // Update message for this symbol (UI results updated after batch completes)
        setFineScanMessage(`[${i+1}/${candidateCount}] ${symbol}: Completed`);
      };
      // --- Fine Scan sequential execution: one symbol at a time ---
      for (let i = 0; i < candidateCount; i++) {
        if (scannerStateStore.getState().fineScan.stopRequested) break;
        await _processOneFineScanSymbol(i, candidates[i], candidateCount, results, scannerMap);
        // Update UI after each symbol completes
        setFineScanResults([...results]);
        // Small delay between symbols to avoid overwhelming rate limit
        if (i < candidateCount - 1) {
          await new Promise(r => setTimeout(r, 400 + Math.random() * 400)); // 400-800ms jitter
        }
      }
      setFineScanProgress(100);
      setFineScanStatus('completed');
      unregisterFineScanRun();

      message.success(`Fine Scan complete: ${results.length} candidates analyzed`);
    } catch (error) {
      console.error('Fine scan error:', error);
      setFineScanStatus('error');
      unregisterFineScanRun();
      message.error('Fine scan failed: ' + (error as any).message);
    }
  };


  // ===== Deeper Validation State ===== (now in scannerStateStore)
  // deeperValidationStatus and deeperValidationResults are read from store snapshot above

  // ===== Entry Plan State ===== (now in scannerStateStore)
  // entryPlanStatus and entryPlanResults are read from store snapshot above
  const [expandedEntryPlanSymbol, setExpandedEntryPlanSymbol] = useState<string | null>(null);
  const [entryPlanAccountSize] = useState<number>(100000);
  const [entryPlanRiskPerTrade] = useState<number>(1);
  const [entryPlanExecutionMode, _setEntryPlanExecutionMode] = useState<string>('Recommend Only'); // eslint-disable-line @typescript-eslint/no-unused-vars

  // ===== Entry Plan Execution State =====
  const [executeModalVisible, setExecuteModalVisible] = useState(false);
  const [executeTarget, setExecuteTarget] = useState<any>(null);
  const [executeLoading, setExecuteLoading] = useState(false);
  const [liveConfirmText, setLiveConfirmText] = useState('');

  // ===== AI Execution Order State =====
  const [executionLog, setExecutionLog] = useState<any[]>([]);
  const [executingSymbol, setExecutingSymbol] = useState<string | null>(null);
  const [orderConfirmVisible, setOrderConfirmVisible] = useState(false);
  const [orderConfirmTarget, setOrderConfirmTarget] = useState<any>(null);
  const [orderConfirmText, setOrderConfirmText] = useState('');
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

  // ===== Collapsible Stage Sections Expanded State =====
  const [scannerExpanded, setScannerExpanded] = useState(false);
  const [continueScanExpanded, setContinueScanExpanded] = useState(false);
  const [fineScanExpanded, setFineScanExpanded] = useState(false);
  const [dvExpanded, setDvExpanded] = useState(false);
  const [dvErrorMessage, setDvErrorMessage] = useState<string | null>(null);
  const [dvErrors, setDvErrors] = useState<any[]>([]);
  const [entryPlanExpanded, setEntryPlanExpanded] = useState(false);
  const [exitScanExpanded, setExitScanExpanded] = useState(false);

  const handleEntryPlanAction = (plan: any) => {
    const fa = plan.finalAction;
    const aiDecision = plan.aiDecision;
    const rg = plan.riskGate || plan.hardRiskGate || {};
    const dq = plan.dataQuality;
    const tr = plan.tradeReadiness;

    if (fa === 'BLOCKED_BY_RISK' || rg.status === 'BLOCK' || dq === 'POOR') {
      const blockers = plan.blockers || rg.blockers || ['Unknown blocker'];
      Modal.warning({
        title: 'Blocked',
        content: `Cannot execute: ${blockers.slice(0, 3).join('; ')}`,
      });
      return;
    }

    if (fa === 'SKIP' || aiDecision === 'SKIP') {
      message.info('Skipped — no action needed');
      return;
    }

    if (fa === 'WAIT_FOR_ENTRY' || tr === 'WAIT') {
      // Add to watchlist
      addToWatchlist(plan);
      return;
    }

    if (fa === 'BUY_READY' || fa === 'READY_REVIEW') {
      if (fa === 'READY_REVIEW') {
        // AI mode: READY_REVIEW auto-executes via pipeline — skip confirmation modal
        if (pipelineMode === 'ai') {
          setExecuteTarget(plan);
          setLiveConfirmText('');
          setExecuteModalVisible(true);
          return;
        }
        const reviewReason = plan.readyReviewReason || 'AI decision is WATCH — needs manual review';
        const inZone = plan.isInEntryZone ? 'Price is IN entry zone. ' : '';
        Modal.confirm({
          title: `${plan.symbol} — Ready for Review`,
          content: `${inZone}${reviewReason}\n\nR/R: ${plan.riskReward1?.toFixed(1)}x | Stop: $${plan.stopLoss?.toFixed(2)} | Target: $${plan.takeProfit1?.toFixed(2)}\n\nProceed to execute?`,
          okText: 'Execute',
          cancelText: 'Add to Watchlist',
          onOk: () => {
            setExecuteTarget(plan);
            setLiveConfirmText('');
            setExecuteModalVisible(true);
          },
          onCancel: () => {
            addToWatchlist(plan);
          },
        });
        return;
      }
      if (entryPlanExecutionMode === 'Recommend Only') {
        Modal.info({
          title: 'Recommend Only Mode',
          content: 'Order preview only — no order will be submitted. Switch to Paper Trading or Live Trading to execute.',
        });
        return;
      }
      // Open confirmation modal
      setExecuteTarget(plan);
      setLiveConfirmText('');
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
        entryZoneLow: plan.entryZoneLow,
        entryZoneHigh: plan.entryZoneHigh,
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
        const action = res.data.action === 'UPDATED' ? 'Updated in watchlist' : 'Added to AI Entry Watchlist';
        message.success(`${plan.symbol}: ${action}`);
        fetchAiWatchlist();
      }
    } catch (e: any) {
      message.error(`Failed to add to watchlist: ${e?.response?.data?.message || e?.message || 'Unknown error'}`);
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

    // Adjust stop/target based on riskProfile and timeHorizon
    const stopPctMap: Record<string, Record<string, number>> = {
      low:    { short: 0.96, mid: 0.95, long: 0.93 },
      medium: { short: 0.95, mid: 0.94, long: 0.92 },
      high:   { short: 0.93, mid: 0.92, long: 0.90 },
    };
    const targetPctMap: Record<string, Record<string, number>> = {
      low:    { short: 1.06, mid: 1.08, long: 1.10 },
      medium: { short: 1.08, mid: 1.12, long: 1.15 },
      high:   { short: 1.10, mid: 1.15, long: 1.20 },
    };
    const stopPct = stopPctMap[riskProfile]?.[timeHorizon] ?? 0.94;
    const targetPct = targetPctMap[riskProfile]?.[timeHorizon] ?? 1.12;

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
      reason: `Generated from avg entry $${baseline.toFixed(2)}: stop $${(baseline * stopPct).toFixed(2)} (-${((1 - stopPct) * 100).toFixed(0)}%), target $${(baseline * targetPct).toFixed(2)} (+${((targetPct - 1) * 100).toFixed(0)}%) [${riskProfile}/${timeHorizon}]`,
    };
  }, [riskProfile, timeHorizon]);

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
      // Severe loss threshold varies by risk profile
      const severeLossThreshold = riskProfile === 'low' ? -7 : riskProfile === 'high' ? -15 : -10;
      if (plPct <= severeLossThreshold) {
        return {
          decision: 'sell_now',
          orderType: 'market',
          stopPrice: fallback.stopPrice,
          targetPrice: fallback.targetPrice,
          reason: `Severe loss ${plPct.toFixed(1)}% — immediate exit recommended`,
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
          reason: `Price $${currentPrice.toFixed(2)} below stop $${fallback.stopPrice.toFixed(2)} — immediate exit`,
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
          reason: `Price near generated target $${fallback.targetPrice.toFixed(2)} — place limit sell`,
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
        reason: `Risk gate ${riskGate} — immediate exit recommended`,
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
        reason: `Price $${currentPrice.toFixed(2)} at/below stop loss $${stopLoss.toFixed(2)}`,
        confidence: 90,
        source: 'entry_plan',
      };
    }

    // Gate: severe loss (> 10%)
    if (plPct <= -10) {
      return {
        decision: 'sell_now',
        orderType: 'market',
        stopPrice: stopLoss,
        targetPrice: takeProfit,
        reason: `Severe loss ${plPct.toFixed(1)}% — immediate exit recommended`,
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
        reason: `AI decision: ${aiDecision}`,
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
        reason: `Price near/at target $${takeProfit.toFixed(2)} — place limit sell`,
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
        reason: `Target $${takeProfit.toFixed(2)} — place limit sell at target`,
        confidence: 60,
        source: 'entry_plan',
      };
    }

    // Default: hold
    return {
      decision: 'hold',
      stopPrice: stopLoss,
      targetPrice: takeProfit,
      reason: 'No exit trigger — hold position',
      confidence: 50,
      source: 'entry_plan',
    };
  }, [generateExitPlanFallback, riskProfile]);

  // Run Exit Scan
  const [exitScanRunning, setExitScanRunning] = useState(false);

  const runExitScan = useCallback(async (options?: { autoSubmit?: boolean; mode?: 'paper' | 'real'; holdingsOverride?: any[] }) => {
    if (exitScanRunning) return;
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
      return;
    }
    const shouldAutoSubmit = options?.autoSubmit !== false; // default true

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
            : 'submitted';
          results.push({
            symbol,
            qty: position.qty,
            avgEntry: position.avgEntryPrice,
            currentPrice: position.currentPrice,
            pl: position.unrealizedPL,
            plPct: position.unrealizedPLPercent,
            positionSource: getPositionSource(symbol),
            exitDecision: 'blocked',
            reason: `Active sell order exists (${orderInfo})`,
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
          result.reason = 'User-marked position — no automatic exit order';
          results.push(result);
          continue;
        }

        // Auto-submit for non-user-marked positions (ai_managed, unknown, manual)
        if (shouldAutoSubmit && (evalResult.decision === 'sell_now' || evalResult.decision === 'place_target_limit')) {
          try {
            // Validate sellable quantity (fractional shares supported)
            const sellQty = Number(position.qty) || 0;
            if (sellQty <= 0) {
              result.status = 'failed';
              result.error = `Invalid sell quantity: ${position.qty}`;
              message.error(`Exit order skipped for ${symbol}: ${result.error}`);
              results.push(result);
              continue;
            }

            const orderPayload: any = {
              mode: exitScanMode,
              symbol,
              side: 'sell',
              qty: sellQty,
              type: evalResult.orderType || 'market',
              time_in_force: 'gtc',
              confirmed: pipelineMode === 'ai',
            };

            // Simple limit/market sell — bracket orders are for buy-side only on Alpaca
            if (evalResult.orderType === 'limit' && evalResult.exitPrice) {
              orderPayload.limit_price = Math.round(Number(evalResult.exitPrice) * 100) / 100;
            }

            const res = await tradingAccountAPI.placeOrder(orderPayload);
            if (res.data.success) {
              result.status = 'submitted';
              result.alpacaOrderId = res.data.order?.id;
              scannerStateStore.addSubmittedExitOrder({
                symbol,
                orderId: res.data.order?.id || '',
                orderType: evalResult.orderType || 'market',
                exitPrice: evalResult.exitPrice,
                submittedAt: new Date().toISOString(),
              });
              message.success(`Exit order submitted: ${symbol} ${evalResult.orderType} sell ${sellQty} shares`);
            } else if (res.data.status === 'confirmation_required') {
              // Real trading requires confirmation — mark as pending confirmation
              result.status = 'pending_confirm';
              result.reason = res.data.message || 'Real trading requires confirmation';
              message.warning(`Exit order for ${symbol} requires confirmation. Please review in Execution panel.`);
            } else {
              const errDetail = res.data.message || res.data.error || 'Order failed';
              result.status = 'failed';
              result.error = errDetail;
              console.error(`[ExitScan] ${symbol} order rejected:`, JSON.stringify(res.data, null, 2));
              message.error(`Exit order failed for ${symbol}: ${errDetail}`, 8);
            }
          } catch (e: any) {
            const errBody = e?.response?.data;
            const errDetail = errBody?.message || errBody?.error || e?.message || 'Order request failed';
            result.status = 'failed';
            result.error = errDetail;
            console.error(`[ExitScan] ${symbol} order error:`, errBody || e);
            message.error(`Exit order error for ${symbol}: ${errDetail}`, 8);
          }
        } else if (!shouldAutoSubmit && (evalResult.decision === 'sell_now' || evalResult.decision === 'place_target_limit')) {
          // Hybrid/pipeline mode — generate plan but don't submit
          result.status = 'pending';
          result.reason = `${evalResult.reason} — awaiting manual confirmation`;
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
      message.success(`Exit Scan completed: ${results.length} positions scanned`);
    } catch (e: any) {
      setExitScanStatus('failed');
      message.error(`Exit Scan failed: ${e?.message || 'Unknown error'}`);
    } finally {
      setExitScanRunning(false);
      // Refresh holdings if any orders were submitted
      if (results.some(r => r.status === 'submitted')) {
        setTimeout(() => fetchHoldings(), 2000);
      }
    }
  }, [exitScanRunning, holdings, submittedExitOrders, openSellOrders, tradeMode, entryPlanResultsBySymbol, getPositionSource, evaluateExitPlan, setExitScanStatus, setExitScanResults, fetchHoldings]);

  // ===== AI Watchlist Functions =====
  const fetchAiWatchlist = async () => {
    try {
      const res = await aiAgentWatchlistAPI.list();
      if (res.data.success) {
        const items = res.data.items || [];
        setAiWatchlistItems(items);
        // Refresh prices for items that have symbols
        if (items.length > 0) {
          refreshWatchlistPrices(items);
        }
      }
    } catch (e) {
      console.error('Failed to fetch AI watchlist:', e);
    }
  };

  const refreshWatchlistPrices = async (items?: any[]) => {
    const currentItems = items || aiWatchlistItems;
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
  };

  const removeFromWatchlist = async (id: string, symbol: string) => {
    try {
      await aiAgentWatchlistAPI.remove(id);
      setAiWatchlistItems(prev => prev.filter(i => i.id !== id));
      message.success(`${symbol} removed from watchlist`);
    } catch (e: any) {
      message.error(`Failed to remove: ${e?.message || 'Unknown error'}`);
    }
  };

  const clearAllWatchlist = () => {
    Modal.confirm({
      title: 'Clear AI Watchlist',
      content: `Remove all ${aiWatchlistItems.length} items from the watchlist? This cannot be undone.`,
      okText: 'Clear All',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          for (const item of aiWatchlistItems) {
            await aiAgentWatchlistAPI.remove(item.id);
          }
          setAiWatchlistItems([]);
          message.success('Watchlist cleared');
        } catch (e: any) {
          message.error(`Failed to clear: ${e?.message || 'Unknown error'}`);
          fetchAiWatchlist();
        }
      },
    });
  };

  // Add a watchlist item (or entry plan) to AI Execution list
  const addToExecution = (item: any) => {
    const symbol = (item.symbol || '').toUpperCase();
    if (!symbol) { message.warning('No symbol.'); return; }

    // Duplicate check
    const exists = aiExecutionList.some(e => e.symbol === symbol && e.executionStatus !== 'failed' && e.executionStatus !== 'canceled');
    if (exists) { message.info(`${symbol} is already in the execution list.`); return; }

    const ep = entryPlanResultsBySymbol[symbol] || normalizeWatchlistToEntryPlan(item);
    const recommendedShares = ep.positionSizeShares || item.shares || item.positionSizeShares || 0;
    const entryPrice = ep.entryZoneHigh || ep.entryZoneLow || item.entryZoneHigh || item.entryZoneLow || item.currentPrice || 0;

    const executionItem = {
      symbol,
      // Entry plan data
      setup: ep.setup || item.setup || item.setupType,
      entryZoneLow: ep.entryZoneLow || item.entryZoneLow,
      entryZoneHigh: ep.entryZoneHigh || item.entryZoneHigh,
      stopLoss: ep.stopLoss || item.stopLoss,
      takeProfit1: ep.takeProfit1 || item.takeProfit1,
      riskReward1: ep.riskReward1 || item.riskReward1 || item.riskReward,
      confidence: ep.confidence || item.confidence,
      aiDecision: ep.aiDecision || item.aiDecision,
      riskGateStatus: (ep.riskGate || {}).status || ep.riskGateStatus || item.riskGateStatus,
      dataQuality: ep.dataQuality || item.dataQuality,
      positionSizeShares: recommendedShares,
      positionSizeDollars: ep.positionSizeDollars || item.positionSizeDollars,
      // User-editable order params
      qtyMode: 'shares' as const,
      userQty: recommendedShares > 0 ? recommendedShares : 1,
      dollarAmount: recommendedShares > 0 && entryPrice > 0 ? Math.round(recommendedShares * entryPrice) : 0,
      orderType: entryPrice > 0 ? 'limit' as const : 'market' as const,
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
    message.success(`${symbol} added to AI Execution.`);
  };

  // Check if a symbol is already in the execution list
  const isInExecutionList = (symbol: string): boolean => {
    return aiExecutionList.some(e => e.symbol === symbol && e.executionStatus !== 'failed' && e.executionStatus !== 'canceled');
  };

  const getWatchlistReadiness = (item: any): string => {
    const rg = (item.riskGateStatus || '').toUpperCase();
    const ai = (item.aiDecision || '').toUpperCase();
    const fa = (item.finalAction || '').toUpperCase();

    if (rg === 'BLOCK' || fa === 'BLOCKED_BY_RISK') return 'Blocked';
    if (rg === 'FAIL') return 'Blocked';

    // Watch-to-Validate source: only Ready if gate PASS
    if (item.source === 'Watch-to-Validate' || item.selectedBy === 'Watch-to-Validate') {
      if (rg !== 'PASS') return 'Watch-only';
    }

    if (ai === 'SKIP') return 'Blocked';

    // READY_REVIEW or BUY_READY with in-zone = Ready
    if (fa === 'READY_REVIEW' || fa === 'BUY_READY') {
      const price = item.currentPrice;
      const lo = item.entryZoneLow;
      const hi = item.entryZoneHigh;
      if (price && lo && hi && price >= lo && price <= hi) return 'Ready';
      return 'Waiting Entry';
    }

    if (ai === 'WATCH' || ai === 'WAIT') return 'Waiting Entry';

    if (ai === 'BUY' && rg === 'PASS') {
      const price = item.currentPrice;
      const lo = item.entryZoneLow;
      const hi = item.entryZoneHigh;
      if (price && lo && hi && price >= lo && price <= hi) return 'Ready';
      if (price && lo && hi) return 'Waiting Entry'; // price outside zone
      return 'Waiting Entry'; // missing price data
    }

    if (!item.currentPrice && !item.entryZoneLow) return 'Stale';
    return 'Waiting Entry';
  };

  const getReadinessColor = (readiness: string): string => {
    switch (readiness) {
      case 'Ready': return '#52c41a';
      case 'Waiting Entry': return '#d48806';
      case 'Watch-only': return '#1890ff';
      case 'Blocked': return '#ff4d4f';
      case 'Stale': return '#bbb';
      default: return '#888';
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
    if (s === 'BLOCK' || s === 'FAIL' || s === 'BLOCKED' || s === 'BLOCKED_BY_RISK') return t.agent.statusBlocked;
    if (s === 'BUY' || s === 'BUY_READY') return t.agent.buyLabel;
    if (s === 'WAIT' || s === 'WAIT_FOR_ENTRY') return t.agent.statusWaitingEntry;
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
  }, []);

  const stopWatchlistAutoRefresh = useCallback(() => {
    if (aiWatchlistTimerRef.current) {
      clearInterval(aiWatchlistTimerRef.current);
      aiWatchlistTimerRef.current = null;
    }
  }, []);

  const confirmExecutePlan = async () => {
    if (!executeTarget) return;
    const plan = executeTarget;
    const ed = plan.executionDetails || {};
    const orderPreview = ed.orderPreview || plan.orderPreview || {};

    // Live trading requires confirmation text match
    const isLive = entryPlanExecutionMode.toLowerCase().includes('live');
    if (isLive) {
      const expected = `CONFIRM LIVE BUY ${plan.symbol}`;
      if (liveConfirmText.trim().toUpperCase() !== expected.toUpperCase()) {
        message.error(`Type "${expected}" to confirm live trading`);
        return;
      }
    }

    setExecuteLoading(true);
    try {
      const res = await entryPlanAPI.execute({
        symbol: plan.symbol,
        planSnapshot: {
          ...plan,
          riskGate: plan.riskGate || plan.hardRiskGate,
          shares: plan.positionSizeShares || plan.shares,
          orderPreview: orderPreview,
        },
        executionMode: isLive ? 'live' : 'paper',
        liveConfirm: isLive,
        confirmText: isLive ? liveConfirmText : undefined,
      });

      const d = res.data;
      if (d.success && d.action === 'ORDER_SUBMITTED') {
        message.success(`${plan.symbol}: ${d.message} (ID: ${d.orderId?.slice(0, 8)}...)`);
        setExecuteModalVisible(false);
        setExecuteTarget(null);
      } else {
        message.error(`${plan.symbol}: ${d.reason || 'Blocked'} — ${(d.blockers || []).join('; ')}`);
      }
    } catch (e: any) {
      const errData = e?.response?.data;
      message.error(`Execution failed: ${errData?.reason || e?.message || 'Unknown error'}`);
    } finally {
      setExecuteLoading(false);
    }
  };

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
      message.info('Manual mode — review only. No orders will be placed.');
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
          message: d.message,
        };
        setExecutionLog(prev => [logEntry, ...prev]);
        message.success(`${record.symbol}: ${d.message}`);
        // Refresh holdings after successful order
        fetchHoldings();
      } else if (d.status === 'confirmation_required') {
        // Show confirmation modal
        setOrderConfirmTarget({ record, preview: d.orderPreview || {} });
        setOrderConfirmVisible(true);
        setOrderConfirmText('');
      } else if (d.status === 'config_required') {
        setAiExecutionList(prev => prev.map(e =>
          e.symbol === record.symbol ? { ...e, executionStatus: 'failed', executionError: d.message } : e
        ));
        Modal.warning({
          title: 'API Keys Not Configured',
          content: d.message,
          okText: 'Go to Settings',
          onOk: () => navigate('/settings/configuration'),
        });
      } else if (d.status === 'risk_blocked') {
        setAiExecutionList(prev => prev.map(e =>
          e.symbol === record.symbol ? { ...e, executionStatus: 'failed', executionError: d.message } : e
        ));
        message.warning(`${record.symbol}: ${d.message}`);
      } else if (d.status === 'auth_required') {
        message.error(d.message);
      } else {
        setAiExecutionList(prev => prev.map(e =>
          e.symbol === record.symbol ? { ...e, executionStatus: 'failed', executionError: d.message || 'Order failed' } : e
        ));
        message.error(`${record.symbol}: ${d.message || 'Order failed'}`);
      }
    } catch (e: any) {
      let errMsg = 'Unknown error';
      if (e?.response?.data?.message) errMsg = e.response.data.message;
      else if (e?.response?.data?.error) errMsg = e.response.data.error;
      else if (e?.response) errMsg = `Server error (${e.response.status})`;
      else if (e?.request && !e?.response) errMsg = 'Backend unreachable — check if server is running';
      else errMsg = e?.message || 'Unknown error';
      setAiExecutionList(prev => prev.map(e2 =>
        e2.symbol === record.symbol ? { ...e2, executionStatus: 'failed', executionError: errMsg } : e2
      ));
      message.error(`${record.symbol}: ${errMsg}`);
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
    setOrderConfirmText('');
  };

  const handleConfirmOrder = async () => {
    if (!orderConfirmTarget) return;
    const { record } = orderConfirmTarget;
    const isReal = tradeMode === 'real';

    if (isReal) {
      const expected = `CONFIRM REAL ORDER ${record.symbol}`;
      if (orderConfirmText.trim().toUpperCase() !== expected.toUpperCase()) {
        message.error(`Type "${expected}" to confirm`);
        return;
      }
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
    setOrderConfirmText('');
  };

  // ===== Cancel Order Handler =====
  const handleCancelOrder = async () => {
    if (!cancelTarget) return;
    const { record } = cancelTarget;
    const orderId = record.alpacaOrderId;
    if (!orderId) { message.error('No order ID found.'); return; }

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
          message: 'Order canceled by user',
        };
        setExecutionLog(prev => [logEntry, ...prev]);
        message.success(`${record.symbol}: Order canceled.`);
        fetchHoldings();
      } else if (d.errorType === 'order_filled') {
        // Order already filled — remove from execution, refresh holdings
        setAiExecutionList(prev => prev.filter(e => e.symbol !== record.symbol));
        fetchHoldings();
        message.info(`${record.symbol}: Order already filled. Position moved to Current Holdings.`);
      } else {
        message.error(`${record.symbol}: Cancel failed — ${d.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      let errMsg = 'Unknown error';
      if (e?.response?.data?.error) {
        errMsg = e.response.data.error;
      } else if (e?.response) {
        errMsg = `Server error (${e.response.status})`;
      } else if (e?.request && !e?.response) {
        errMsg = 'Backend unreachable — check if server is running';
      } else {
        errMsg = e?.message || 'Unknown error';
      }
      message.error(`${record.symbol}: Cancel failed — ${errMsg}`);
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

  const getEntryPlanCandidates = useCallback(() => {
    if (!deeperValidationResults || deeperValidationResults.length === 0) return [];
    // Include Confirmed, Watch, and Needs Manual Review. Do NOT exclude risk-gate BLOCK here —
    // BLOCK only blocks order execution, not plan generation.
    const confirmed: any[] = [];
    const watch: any[] = [];
    const manualReview: any[] = [];
    for (const r of deeperValidationResults) {
      if (r.verdict === 'Confirmed' || r.verdict === 'Pass') confirmed.push(r);
      else if (r.verdict === 'Watch') watch.push({ ...r, planNote: 'Conservative / Watch Only' });
      else if (r.verdict === 'Needs Manual Review' || r.verdict === 'Manual Review') manualReview.push({ ...r, planNote: 'Review Required' });
    }
    const all = [...confirmed, ...watch, ...manualReview];
    // Limit to total of 8
    return all.slice(0, 8);
  }, [deeperValidationResults]);

  // Store-based version for auto pipeline (avoids stale React snapshot)
  const _getEntryPlanCandidatesFromStore = (): any[] => {
    const results = scannerStateStore.getState().deeperValidation.results;
    if (!results || results.length === 0) return [];
    const confirmed: any[] = [];
    const watch: any[] = [];
    const manualReview: any[] = [];
    for (const r of results) {
      // BLOCK does not block plan generation — only execution
      if (r.verdict === 'Confirmed' || r.verdict === 'Pass') confirmed.push(r);
      else if (r.verdict === 'Watch') watch.push({ ...r, planNote: 'Conservative / Watch Only' });
      else if (r.verdict === 'Needs Manual Review' || r.verdict === 'Manual Review') manualReview.push({ ...r, planNote: 'Review Required' });
    }
    return [...confirmed, ...watch, ...manualReview].slice(0, 8);
  };

  const handleRunEntryPlan = useCallback(async () => {
    if (pipelineRunning) {
      message.warning('Disabled while AI Pipeline is running.');
      return;
    }
    const candidates = getEntryPlanCandidates();
    if (!candidates.length) return;
    // Register with runner service so isEntryPlanRunning() returns true during route changes
    const epPromise = _runEntryPlanLoop(candidates);
    registerEntryPlanRun(epPromise);
    await epPromise;
  }, [getEntryPlanCandidates, entryPlanAccountSize, entryPlanRiskPerTrade, entryPlanExecutionMode, tradeMode, tradingAccountData]);

  const _runEntryPlanLoop = async (candidates: any[]) => {
    setEntryPlanStatus('loading');
    setEntryPlanResults(null);

    // Preflight: check session, AI config, and trading account
    const preflight = await preflightConfigCheck();
    if (!preflight.ok || !preflight.sessionValid) {
      setEntryPlanStatus('error');
      unregisterEntryPlanRun();
      const errMsg = preflight.error || 'Session expired. Please sign in again.';
      message.error(errMsg);
      throw new Error(errMsg);
    }
    if (!preflight.aiAvailable) {
      const reason = preflight.aiKeyIsMasked ? 'AI key is invalid (masked). Re-enter in Settings.' :
                     !preflight.aiConfigured ? 'AI Provider not configured. Configure in Settings.' :
                     preflight.aiTestStatus !== 'connected' ? `AI Provider not tested (${preflight.aiTestStatus}). Click Test AI Connection in Settings.` :
                     'AI unavailable';
      setEntryPlanStatus('error');
      unregisterEntryPlanRun();
      message.error(reason);
      throw new Error(reason);
    }
    // Check trading account config — warn but don't block if unavailable (backend uses fallback)
    if (!tradingAccountData?.success) {
      console.warn(`[EntryPlan] Trading account (${tradeMode}) not available, using estimated account size`);
    }

    try {
      const candidateData = candidates.map((c: any) => ({
        symbol: c.symbol,
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
      }));
      const existingPositions: string[] = [];
      const dailyLoss = 0;
      // Use real account data: buyingPower > equity > portfolioValue > fallback
      const realAccountSize = tradingAccountData?.success
        ? (tradingAccountData.portfolioValue ?? tradingAccountData.equity ?? tradingAccountData.buyingPower ?? entryPlanAccountSize)
        : entryPlanAccountSize;
      const res = await entryPlanAPI.generate(
        candidateData, realAccountSize, entryPlanRiskPerTrade, 10,
        existingPositions, dailyLoss, existingPositions, entryPlanExecutionMode, tradeMode,
        riskProfile, timeHorizon
      );
      if (res.data?.success && res.data?.plans) {
        // Propagate isDevTest flag from DV candidates to Entry Plan results
        const devTestSymbols = new Set(candidates.filter((c: any) => c.isDevTest).map((c: any) => c.symbol));
        const enrichedPlans = res.data.plans.map((p: any) => ({
          ...p,
          isDevTest: devTestSymbols.has(p.symbol) || p.isDevTest || false,
        }));
        setEntryPlanResults(enrichedPlans);
        const epStatus = res.data.status || 'completed';
        const epErrors = res.data.errors || [];
        if (epStatus === 'partial' && epErrors.length > 0) {
          const failSymbols = epErrors.map((e: any) => e.symbol).join(', ');
          message.warning(`Entry Plan partial: some symbols had errors (${failSymbols})`);
        }
        setEntryPlanStatus('completed');
        unregisterEntryPlanRun();
      } else {
        const errMsg = res.data?.message || 'Entry Plan returned no results';
        setEntryPlanStatus('error');
        unregisterEntryPlanRun();
        throw new Error(errMsg);
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
            symbol: c.symbol, strategy: c.strategy || c.strategyType || '', verdict: c.verdict || '',
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
          }));
          const realAccountSize = tradingAccountData?.success
            ? (tradingAccountData.portfolioValue ?? tradingAccountData.equity ?? tradingAccountData.buyingPower ?? entryPlanAccountSize)
            : entryPlanAccountSize;
          const res = await entryPlanAPI.generate(
            candidateData, realAccountSize, entryPlanRiskPerTrade, 10,
            [], 0, [], entryPlanExecutionMode, tradeMode,
            riskProfile, timeHorizon
          );
          if (res.data?.success && res.data?.plans) {
            const devTestSymbols = new Set(candidates.filter((c: any) => c.isDevTest).map((c: any) => c.symbol));
            const enrichedPlans = res.data.plans.map((p: any) => ({
              ...p, isDevTest: devTestSymbols.has(p.symbol) || p.isDevTest || false,
            }));
            setEntryPlanResults(enrichedPlans);
            setEntryPlanStatus('completed');
            unregisterEntryPlanRun();
            return;
          }
        } catch (retryErr: any) {
          console.error('[EntryPlan] Retry also failed:', retryErr.message);
        }
      }

      const errMsg = isConfigError
        ? (err.response?.data?.error || 'Configuration error. Check AI Provider settings.')
        : isRateLimit
          ? 'Rate limited by AI service. Please wait and try again.'
          : (err.response?.data?.message || err.message || 'Entry plan failed');
      console.error('Entry plan error:', err);
      setEntryPlanStatus('error');
      unregisterEntryPlanRun();
      message.error(errMsg);
      throw new Error(errMsg);
    }
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
            reason: `High-risk mode: ${symbol} exceeds buying power. Leveraged alternative ${alt} found.`,
            riskWarning: `${alt} is a leveraged product with amplified volatility and loss risk. Suitable only for high-risk tolerance.`,
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
    const rg = ep.riskGate || ep.hardRiskGate || {};
    const dq = ep.dataQuality || 'N/A';
    const dqColor = dq === 'GOOD' ? '#52c41a' : dq === 'FAIR' ? '#faad14' : '#ff4d4f';
    const rgColor = rg.status === 'PASS' ? '#52c41a' : rg.status === 'REVIEW' ? '#faad14' : '#ff4d4f';
    
    const Section = ({ title, icon, children, last }: { title: string; icon?: React.ReactNode; children: React.ReactNode; last?: boolean }) => (
      <div style={{ 
        flex: 1, 
        minWidth: 280,
        padding: '16px', 
        background: '#fff', 
        borderRadius: 12, 
        border: '1px solid #f0f0f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        marginBottom: last ? 0 : 0
      }}>
        <div style={{ 
          fontSize: 12, 
          fontWeight: 700, 
          color: '#1890ff', 
          textTransform: 'uppercase', 
          letterSpacing: 0.8, 
          marginBottom: 16, 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8 
        }}>
          {icon}
          {title}
        </div>
        {children}
      </div>
    );

    const DetailItem = ({ label, value, color, boldValue, info }: { label: string; value: any; color?: string; boldValue?: boolean; info?: string }) => (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid #f9f9f9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: '#8c8c8c', fontSize: 12 }}>{label}</span>
          {info && <Tooltip title={info}><InfoCircleOutlined style={{ fontSize: 10, color: '#bfbfbf' }} /></Tooltip>}
        </div>
        <span style={{ 
          fontWeight: boldValue ? 700 : 600, 
          color: color || '#262626', 
          fontSize: 12, 
          textAlign: 'right',
          maxWidth: '65%',
          wordBreak: 'break-word'
        }}>
          {safeRender(value)}
        </span>
      </div>
    );

    const readiness = ep.tradeReadiness || 'Unknown';
    const readinessColor = readiness.includes('Ready') || readiness.includes('Now') ? '#52c41a' : readiness.includes('Wait') ? '#faad14' : '#8c8c8c';

    return (
      <div style={{ padding: '20px', background: '#f8f9fb', borderRadius: 16, margin: '8px 0' }}>
        {/* Detail Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: 20, 
          padding: '0 8px' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#111827', lineHeight: 1 }}>{ep.symbol}</span>
              <span style={{ fontSize: 10, color: '#8c8c8c', fontWeight: 600, marginTop: 4, textTransform: 'uppercase' }}>{t.agent.symbolAnalysis}</span>
            </div>
            <Divider type="vertical" style={{ height: 32, borderColor: '#d9d9d9' }} />
            <Space size={8}>
              <Tag color="blue" bordered={false} style={{ fontWeight: 700, borderRadius: 4 }}>{ep.aiDecision || 'WATCH'}</Tag>
              <Tag color={rgColor} bordered={false} style={{ fontWeight: 700, borderRadius: 4 }}>{t.agent.riskGate}: {rg.status || 'N/A'}</Tag>
              <Tag color={readinessColor} bordered={false} style={{ fontWeight: 700, borderRadius: 4 }}>{readiness.toUpperCase()}</Tag>
            </Space>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Tag icon={<SyncOutlined spin={ep.isRefreshing} />} color="default" style={{ margin: 0, borderRadius: 4, fontSize: 10 }}>{ep.aiModel || 'DEEPSEEK'}</Tag>
            <Tag color="cyan" style={{ margin: 0, borderRadius: 4, fontSize: 10 }}>{ep.aiSource === 'DeepSeek' ? 'DEEPSEEK-V3' : ep.aiSource || 'AI'}</Tag>
          </div>
        </div>

        {/* Content Sections */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Section title={t.agent.epDecisionSetup} icon={<CheckCircleOutlined style={{ fontSize: 14 }} />}>
            <DetailItem label={t.agent.finalAction} value={ep.finalAction} color={ep.finalAction === 'BUY_READY' ? '#52c41a' : ep.finalAction === 'WAIT_FOR_ENTRY' ? '#1890ff' : '#ff4d4f'} boldValue />
            <DetailItem label={t.agent.aiDecision} value={ep.aiDecision} color={ep.aiDecision === 'BUY' ? '#52c41a' : '#faad14'} />
            <DetailItem label={t.agent.confidence} value={ep.confidence ? `${ep.confidence}%` : 'N/A'} color={ep.confidence >= 80 ? '#52c41a' : '#1890ff'} />
            <DetailItem label={t.agent.readiness} value={ep.tradeReadiness} color={readinessColor} />
            <DetailItem label={t.agent.setupType} value={ep.setup || ep.setupType} />
            <DetailItem label={t.agent.nextTacticalStep} value={ep.nextStep} color="#1890ff" />
          </Section>

          <Section title={t.agent.epEntryExitLevels} icon={<LineChartOutlined style={{ fontSize: 14 }} />}>
            <DetailItem label={t.agent.entryZone} value={ep.entryZoneLow && ep.entryZoneHigh ? `$${ep.entryZoneLow.toFixed(2)} – $${ep.entryZoneHigh.toFixed(2)}` : 'N/A'} boldValue />
            <DetailItem label={t.agent.trigger} value={ep.triggerCondition} info="Conditions to trigger execution" />
            <DetailItem label={t.agent.stopLoss} value={ep.stopLoss ? `$${ep.stopLoss.toFixed(2)}` : 'N/A'} color="#ff4d4f" boldValue />
            <DetailItem label={t.agent.takeProfit1} value={ep.takeProfit1 ? `$${ep.takeProfit1.toFixed(2)}` : 'N/A'} color="#52c41a" />
            <DetailItem label={t.agent.takeProfit2} value={ep.takeProfit2 ? `$${ep.takeProfit2.toFixed(2)}` : 'N/A'} color="#52c41a" />
            <DetailItem label={t.agent.riskReward1} value={ep.riskReward1 ? `${ep.riskReward1.toFixed(1)}:1` : 'N/A'} color={ep.riskReward1 >= 2 ? '#52c41a' : '#faad14'} />
            <DetailItem label={t.agent.riskReward2} value={ep.riskReward2 ? `${ep.riskReward2.toFixed(1)}:1` : 'N/A'} color={ep.riskReward2 >= 3 ? '#52c41a' : '#faad14'} />
          </Section>

          <Section title={t.agent.epRiskData} icon={<SafetyCertificateOutlined style={{ fontSize: 14 }} />}>
            <DetailItem label={t.agent.positionSize} value={ep.positionSizeShares ? `${ep.positionSizeShares} shares` : ep.positionSizeDollars ? `$${ep.positionSizeDollars.toLocaleString()}` : 'N/A'} boldValue />
            <DetailItem label={t.agent.portfolioRisk} value={ep.positionPct ? `${ep.positionPct.toFixed(1)}%` : 'N/A'} info="Percent of account equity at risk" />
            <Divider style={{ margin: '12px 0' }} />
            <DetailItem label={t.agent.riskGate} value={rg.status || 'N/A'} color={rgColor} boldValue />
            <DetailItem label={t.agent.dataQuality} value={dq} color={dqColor} />
            <DetailItem label={t.agent.technicalScore} value={ep.technicalScore != null ? ep.technicalScore : 'N/A'} />
            <DetailItem label={t.agent.regimeFilter} value={ep.marketRegime || 'N/A'} />
          </Section>
        </div>

        {/* Reason and Warnings Panel */}
        {(ep.decisionReason || ep.riskNotes || (ep.blockers && ep.blockers.length > 0)) && (
          <div style={{
            marginTop: 16,
            padding: '16px',
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #f0f0f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>{t.agent.epAnalysisWarnings}</div>
            <Row gutter={24}>
              {ep.decisionReason && (
                <Col span={ep.riskNotes || (ep.blockers && ep.blockers.length > 0) ? 14 : 24}>
                  <div style={{ fontSize: 13, color: '#434343', lineHeight: 1.6 }}>
                    <Text strong style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginBottom: 4 }}>{t.agent.reasoning}</Text>
                    {safeRender(ep.decisionReason)}
                  </div>
                </Col>
              )}
              {(ep.riskNotes || (ep.blockers && ep.blockers.length > 0)) && (
                <Col span={ep.decisionReason ? 10 : 24}>
                  {ep.riskNotes && (
                    <div style={{ marginBottom: 12 }}>
                      <Text strong style={{ fontSize: 11, color: '#faad14', display: 'block', marginBottom: 4 }}>{t.agent.riskNotes}</Text>
                      <div style={{ fontSize: 12, color: '#d48806', background: '#fffbe6', padding: '8px 12px', borderRadius: 6, border: '1px solid #ffe58f' }}>
                        {safeRender(ep.riskNotes)}
                      </div>
                    </div>
                  )}
                  {ep.blockers && ep.blockers.length > 0 && (
                    <div>
                      <Text strong style={{ fontSize: 11, color: '#ff4d4f', display: 'block', marginBottom: 4 }}>{t.agent.blockers}</Text>
                      <div style={{ fontSize: 12, color: '#cf1322', background: '#fff1f0', padding: '8px 12px', borderRadius: 6, border: '1px solid #ffa39e' }}>
                        {ep.blockers.map((b: any) => safeRender(b)).join('; ')}
                      </div>
                    </div>
                  )}
                </Col>
              )}
            </Row>
          </div>
        )}

        {/* Leveraged ETF Alternative Suggestion (High Risk + Soft Blockers) */}
        {riskProfile === 'high' && (ep.finalAction === 'SKIP' || ep.finalAction === 'BLOCKED_BY_RISK') && !ep.isLeveragedAlternative && (
          <LeveragedETFSuggestion symbol={ep.symbol} currentPrice={ep.currentPrice} plan={ep} />
        )}

        {/* Leveraged Alternative Plan Header */}
        {ep.isLeveragedAlternative && (
          <div style={{
            marginTop: 8, padding: '8px 12px',
            background: 'linear-gradient(135deg, #fff7ed, #fff1f0)',
            borderRadius: 8, border: '1px solid #fed7aa',
            display: 'flex', alignItems: 'center', gap: 8
          }}>
            <ThunderboltOutlined style={{ color: '#fa8c16', fontSize: 14 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#9a3412' }}>
                {language === 'zh-CN' ? '高风险杠杆替代标的' : 'High-Risk Leveraged Alternative'}
              </div>
              <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                {language === 'zh-CN'
                  ? `原始标的：${ep.originalSymbol} → 替代标的：${ep.symbol}（${ep.alternativeDirection === 'bull' ? '做多' : '做空'}）`
                  : `Original: ${ep.originalSymbol} → Alternative: ${ep.symbol} (${ep.alternativeDirection?.toUpperCase()})`}
              </div>
              {ep.alternativeFailed ? (
                <div style={{ fontSize: 11, color: '#ff4d4f', fontWeight: 600, marginTop: 4 }}>
                  {language === 'zh-CN' ? '替代失败：' : 'Alternative failed: '}{ep.alternativeFailReason}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: '#d46b08', marginTop: 4 }}>
                  <ExclamationCircleOutlined style={{ marginRight: 4 }} />
                  {ep.alternativeRiskWarning || ep.reason}
                </div>
              )}
            </div>
            {!ep.alternativeFailed && (
              <Tag color="orange" bordered={false} style={{ fontWeight: 700, borderRadius: 4, fontSize: 10 }}>
                {ep.alternativeDirection?.toUpperCase()}
              </Tag>
            )}
          </div>
        )}
      </div>
    );
  };

  // Leveraged ETF suggestion component (async lookup — tries bull then bear)
  const LeveragedETFSuggestion: React.FC<{ symbol: string; currentPrice: number; plan?: any }> = ({ symbol, currentPrice, plan }) => {
    const [suggestion, setSuggestion] = React.useState<LeveragedAlternative | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
      const lookup = async () => {
        setLoading(true);
        const buyingPower = tradingAccountData?.buyingPower || 0;
        // Try bull first, then bear
        let result = await findLeveragedAlternative(symbol, 'bull', buyingPower, currentPrice);
        if (!result) {
          result = await findLeveragedAlternative(symbol, 'bear', buyingPower, currentPrice);
        }
        setSuggestion(result);
        setLoading(false);
      };
      lookup();
    }, [symbol, currentPrice, tradingAccountData]);

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
    entryZoneLow: item.entryZoneLow,
    entryZoneHigh: item.entryZoneHigh,
    triggerCondition: item.triggerCondition || item.trigger,
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

  const PIPELINE_STAGES = ['Market Scanner', 'Continue Scan', 'Fine Scan', 'Deeper Validation', 'Entry Plan', 'Exit Scan'] as const;

  // Translate pipeline stage name for display (internal keys stay English)
  const getPipelineStageLabel = (name: string): string => {
    const map: Record<string, string> = {
      'Market Scanner': t.agent.pipelineStageMarketScanner,
      'Continue Scan': t.agent.pipelineStageContinueScan,
      'Fine Scan': t.agent.pipelineStageFineScan,
      'Deeper Validation': t.agent.pipelineStageDeeperValidation,
      'Entry Plan': t.agent.pipelineStageEntryPlan,
      'Exit Scan': t.agent.pipelineStageExitScan,
    };
    return map[name] || name;
  };

  const pollStore = (getter: () => any, done: (v: any) => boolean, intervalMs = 2000): Promise<void> =>
    new Promise((resolve, reject) => {
      const check = () => {
        if (pipelineStopRequestedRef.current) { reject(new Error('Pipeline stopped by user')); return; }
        const v = getter();
        if (done(v)) { resolve(); } else { setTimeout(check, intervalMs); }
      };
      check();
    });

  const runAIPipeline = async (opts?: { trigger?: string }) => {
    // Pre-checks
    if (isAnyScanRunning) {
      message.warning(t.agent.scanAlreadyRunning);
      return;
    }

    setPipelineRunning(true);
    setPipelineError(null);
    setPipelineStage('Market Scanner');
    pipelineStopRequestedRef.current = false;
    const _startTime = new Date().toISOString();
    setLastPipelineRun(_startTime);

    try {
      // ── Stage 1: Market Scanner ──
      setPipelineStage('Market Scanner');
      await startMarketScanner();
      await pollStore(
        () => scannerStateStore.getState().marketScanner.status,
        (s) => s === 'completed' || s === 'failed' || s === 'stopped',
      );
      const msStatus = scannerStateStore.getState().marketScanner.status;
      if (msStatus !== 'completed') throw new Error(`Market Scanner ${msStatus}`);

      // ── Stage 2: Continue Scan ──
      setPipelineStage('Continue Scan');
      setContinueScanStatus('processing');
      setContinueScanProgress(0);
      setPreferredContinueScanList([]);
      setContinueScanDetails({
        currentStage: 'Initializing...',
        startTime: Date.now(),
        estimatedTimeRemaining: null,
        processedCount: 0,
        totalCount: scannerStateStore.getState().marketScanner.results.length,
      });
      await processContinueScan();
      const csStatus = scannerStateStore.getState().continueScan.status;
      if (csStatus !== 'completed') throw new Error('Continue Scan failed');

      // ── Stage 3: Fine Scan ──
      setPipelineStage('Fine Scan');
      const fsResults = scannerStateStore.getState().continueScan.results;
      const msCount = scannerStateStore.getState().marketScanner.results.length;
      if (!fsResults || fsResults.length === 0) {
        const msSample = scannerStateStore.getState().marketScanner.results.slice(0, 3).map((r: any) =>
          `${r.symbol}(trend=${r.trendLabel},score=${r.trendScore})`).join(', ');
        throw new Error(`No Continue Scan candidates: Market Scanner completed ${msCount} symbols but 0 passed rule filter. Sample: ${msSample || '(empty scanner data)'}`);
      }
      const fineScanPromise = _runFineScanLoop();
      registerFineScanRun(fineScanPromise);
      await fineScanPromise;
      const fsStatus = scannerStateStore.getState().fineScan.status;
      if (fsStatus !== 'completed') {
        const fsResults = scannerStateStore.getState().fineScan.results || [];
        const rateLimitedCount = fsResults.filter((r: any) => r.__rateLimited).length;
        const completedCount = fsResults.filter((r: any) => r.scanStatus === 'completed').length;
        const rlSuffix = rateLimitedCount > 0
          ? ` (${rateLimitedCount}/${fsResults.length} symbols rate limited, ${completedCount} completed)`
          : ` (${completedCount}/${fsResults.length} completed)`;
        throw new Error(`Fine Scan ${fsStatus}${rlSuffix}`);
      }

      // ── Stage 4: Deeper Validation ──
      setPipelineStage('Deeper Validation');
      // Read from store directly to avoid stale React snapshot after fine scan
      const dvCandidates = _getValidationCandidatesFromStore();
      if (dvCandidates.length === 0) throw new Error('Fine Scan completed but no Continue or Watch-to-Validate candidates found.');
      const dvPromise = _runDeeperValidationLoop(dvCandidates);
      registerDeeperValidationRun(dvPromise);
      await dvPromise;
      const dvStatus = scannerStateStore.getState().deeperValidation.status;
      if (dvStatus !== 'completed') {
        const dvErrDetail = dvErrorMessage
          ? ` — ${dvErrorMessage}`
          : ` (status=${dvStatus})`;
        throw new Error(`Deeper Validation failed${dvErrDetail}`);
      }

      // ── Stage 5: Entry Plan ──
      setPipelineStage('Entry Plan');
      // Read from store directly to avoid stale React snapshot after DV
      const epCandidates = _getEntryPlanCandidatesFromStore();
      if (epCandidates.length === 0) throw new Error('Deeper Validation completed but no Confirmed/Watch/Review candidates found for Entry Plan.');
      const epPromise = _runEntryPlanLoop(epCandidates);
      registerEntryPlanRun(epPromise);
      await epPromise;
      const epStatus = scannerStateStore.getState().entryPlan.status;
      if (epStatus !== 'completed') throw new Error(`Entry Plan ${epStatus}`);

      // ── Stage 6: Exit Scan ──
      setPipelineStage('Exit Scan');
      const currentTradingMode = tradeMode;
      console.log(`[Pipeline] Exit Scan: mode=${currentTradingMode}, fetching holdings...`);
      await fetchHoldings(currentTradingMode);
      console.log(`[Pipeline] Exit Scan: holdings after fetch=${holdingsRef.current.length}, mode=${currentTradingMode}`);
      const exitScanMode = localStorage.getItem('pipelineMode') || 'hybrid';
      const exitAutoSubmit = exitScanMode === 'ai';
      // Pass holdingsOverride from ref to avoid stale closure
      await runExitScan({ autoSubmit: exitAutoSubmit, mode: currentTradingMode, holdingsOverride: holdingsRef.current });
      const esStatus = scannerStateStore.getState().exitScan.status;
      // 'skipped' means no holdings — valid, not an error
      if (esStatus !== 'completed' && esStatus !== 'skipped') throw new Error(`Exit Scan ${esStatus}`);

      // ── Auto-classify results (keep Exit Scan stage active during classification) ──
      const plans = scannerStateStore.getState().entryPlan.results || [];
      const newExecution: any[] = [];
      // Risk-adjusted R/R threshold (matches AI prompt thresholds)
      const rrThreshold = riskProfile === 'high' ? 1.2 : riskProfile === 'low' ? 2.0 : 1.5;
      for (const plan of plans) {
        const fa = plan.finalAction || '';
        const rr = plan.riskReward1 || 0;
        const sl = plan.stopLoss || 0;
        const tp = plan.takeProfit1 || 0;
        const isLeveraged = plan.isLeveragedAlternative === true;
        // AI mode: BUY_READY and READY_REVIEW both qualify for auto-execution
        // Hybrid/Manual: only BUY_READY qualifies (READY_REVIEW stays in review)
        const qualifiesForExec = pipelineMode === 'ai'
          ? (fa === 'BUY_READY' || fa === 'READY_REVIEW')
          : (fa === 'BUY_READY');
        if (qualifiesForExec && rr >= rrThreshold && sl > 0 && tp > 0) {
          const shares = plan.positionSizeShares || plan.shares || 0;
          const entryPrice = plan.entryZoneHigh || plan.entryZoneLow || 0;
          newExecution.push({
            symbol: plan.symbol,
            originalSymbol: plan.originalSymbol,
            isLeveragedAlternative: isLeveraged,
            alternativeDirection: plan.alternativeDirection,
            alternativeRiskWarning: plan.alternativeRiskWarning,
            setup: plan.setup || plan.setupType,
            entryZoneLow: plan.entryZoneLow,
            entryZoneHigh: plan.entryZoneHigh,
            stopLoss: plan.stopLoss,
            takeProfit1: plan.takeProfit1,
            riskReward1: plan.riskReward1,
            confidence: plan.confidence,
            aiDecision: plan.aiDecision,
            riskGateStatus: (plan.hardRiskGate || plan.riskGate || {}).status || plan.riskGateStatus,
            dataQuality: plan.dataQuality,
            positionSizeShares: shares,
            positionSizeDollars: plan.positionSizeDollars,
            qtyMode: 'shares',
            userQty: shares > 0 ? shares : 1,
            dollarAmount: shares > 0 && entryPrice > 0 ? Math.round(shares * entryPrice) : 0,
            currentPrice: plan.currentPrice || 0,
            orderType: entryPrice > 0 ? 'limit' : 'market',
            limitPrice: entryPrice > 0 ? entryPrice : undefined,
            stopPrice: plan.stopLoss || undefined,
            trailPrice: undefined,
            trailPercent: undefined,
            timeInForce: 'day',
            executionStatus: 'draft',
            source: 'ai_mode',
            addedAt: new Date().toISOString(),
            entryPlan: plan,
          });
        } else if (fa === 'WAIT_FOR_ENTRY' || plan.aiDecision === 'WATCH') {
          await addToWatchlist(plan);
        }
      }
      if (newExecution.length > 0) setAiExecutionList(prev => [...prev, ...newExecution]);

      // ── Auto-execute in AI mode ──
      const currentMode = localStorage.getItem('pipelineMode') || 'hybrid';
      const canAutoExecute = currentMode === 'ai';

      if (canAutoExecute && newExecution.length > 0) {
        // Keep Exit Scan stage active during auto-execution
        let submitted = 0;
        let failed = 0;
        for (const item of newExecution) {
          try {
            // Determine order type based on current price vs entry zone
            const cp = item.currentPrice || 0;
            const eLow = item.entryZoneLow || 0;
            const eHigh = item.entryZoneHigh || 0;
            let orderType = item.orderType || 'market';
            let limitPrice = item.limitPrice;
            if (eLow > 0 && eHigh > 0 && cp > 0) {
              if (cp >= eLow && cp <= eHigh) {
                orderType = 'market'; // Price in zone — execute immediately
              } else if (cp < eLow) {
                orderType = 'limit';
                limitPrice = eLow; // Below zone — limit at zone low
              } else {
                orderType = 'limit';
                limitPrice = eHigh; // Above zone — limit at zone high
              }
            }
            const orderData: any = {
              symbol: item.symbol,
              side: 'buy',
              type: orderType,
              time_in_force: item.timeInForce || 'day',
              tradingMode: tradeMode,
              automationMode: 'full-ai',
              executionSource: 'ai_mode',
              confirmed: shouldAutoConfirmOrder,
            };
            if (item.qtyMode === 'dollars' && item.dollarAmount > 0) {
              orderData.notional = item.dollarAmount;
            } else {
              orderData.qty = item.userQty || item.positionSizeShares || 1;
            }
            if (orderType === 'limit' && limitPrice > 0) orderData.limit_price = limitPrice;
            if (orderType === 'stop' && item.stopPrice > 0) orderData.stop_price = item.stopPrice;
            if (orderType === 'stop_limit') {
              if (item.stopPrice > 0) orderData.stop_price = item.stopPrice;
              if (item.limitPrice > 0) orderData.limit_price = item.limitPrice;
            }
            if (orderType === 'trailing_stop') {
              if (item.trailPrice > 0) orderData.trail_price = item.trailPrice;
              else if (item.trailPercent > 0) orderData.trail_percent = item.trailPercent;
            }
            const res = await aiExecutionAPI.placeOrder(orderData);
            const d = res.data;
            if (d.success && d.status === 'submitted') {
              submitted++;
              // Remove from execution list on success
              setAiExecutionList(prev => prev.filter(e => e.symbol !== item.symbol));
              const logEntry = {
                id: d.order?.id || Date.now().toString(),
                symbol: item.symbol,
                side: 'buy',
                qty: orderData.qty || orderData.notional || 0,
                mode: d.modeUsed,
                orderId: d.order?.id,
                orderStatus: d.order?.status,
                submittedAt: new Date().toISOString(),
                message: d.message,
              };
              setExecutionLog(prev => [logEntry, ...prev]);
            } else if (d.status === 'confirmation_required') {
              // Show confirmation modal (Hybrid mode, or unexpected backend rejection)
              setOrderConfirmTarget({ record: item, preview: d.orderPreview || {} });
              setOrderConfirmVisible(true);
              setOrderConfirmText('');
              // Stop auto-execution, let user confirm remaining orders manually
              break;
            } else {
              failed++;
              setAiExecutionList(prev => prev.map(e =>
                e.symbol === item.symbol ? { ...e, executionStatus: 'failed', executionError: d.message || 'Order rejected' } : e
              ));
            }
          } catch (e: any) {
            failed++;
            setAiExecutionList(prev => prev.map(e =>
              e.symbol === item.symbol ? { ...e, executionStatus: 'failed', executionError: e?.response?.data?.message || e?.message || 'Order failed' } : e
            ));
          }
        }
        // Refresh holdings after auto-execution
        if (submitted > 0) {
          fetchHoldings();
        }
        message.info(`Auto-execution: ${submitted} submitted, ${failed} failed out of ${newExecution.length} candidates.`);
      }

      setPipelineStage('idle');
      const exitResults = scannerStateStore.getState().exitScan.results || [];
      const exitSubmitted = exitResults.filter((r: any) => r.status === 'submitted').length;
      const exitMsg = exitSubmitted > 0 ? `, ${exitSubmitted} exit orders submitted` : '';
      message.success(`Pipeline complete! ${newExecution.length} execution candidates, ${plans.length - newExecution.length} added to watchlist${exitMsg}.`);
    } catch (e: any) {
      const msg = e.message || 'Pipeline failed';
      setPipelineError(msg);
      setPipelineStage('failed');
      message.error(msg);
    } finally {
      setPipelineRunning(false);
      const result = pipelineStage === 'failed' ? 'failed' : pipelineStopRequestedRef.current ? 'stopped' : 'success';
      scannerStateStore.updatePipelineSchedule({ lastRunAt: _startTime, lastRunResult: result });
      scheduleNextRun(true);
      // Sync run completion to backend scheduler so it advances nextRunAt
      if (opts?.trigger === 'auto_market_session') {
        const intervalMs = pipelineAutoStatus?.intervalMinutes
          ? pipelineAutoStatus.intervalMinutes * 60000
          : SCHEDULE_INTERVALS[pipelineSchedule] || 15 * 60 * 1000;
        pipelineAutoAPI.saveConfig({
          enabled: true,
          intervalMinutes: Math.round(intervalMs / 60000),
          mode: pipelineMode,
          lastRunAt: _startTime,
        }).catch(() => {});
      }
    }
  };

  const stopPipeline = () => {
    pipelineStopRequestedRef.current = true;
    if (pipelineStage === 'Market Scanner') stopMarketScannerByUser();
  };

  // Schedule next pipeline run — robust implementation with persistence and polling
  const clearScheduleTimer = useCallback(() => {
    if (pipelineTimerRef.current) { clearInterval(pipelineTimerRef.current); pipelineTimerRef.current = null; }
  }, []);

  const scheduleNextRun = useCallback((fromNow = true) => {
    clearScheduleTimer();
    const savedSchedule = localStorage.getItem('pipelineSchedule') || 'off';
    if (savedSchedule === 'off' || savedSchedule === 'manual') {
      setNextPipelineRun(null);
      scannerStateStore.updatePipelineSchedule({ nextRunAt: null });
      return;
    }
    const intervalMs = SCHEDULE_INTERVALS[savedSchedule];
    if (!intervalMs) { setNextPipelineRun(null); return; }

    // Compute next run time
    let nextTime: number;
    if (!fromNow) {
      // Recovery mode: use persisted nextRunAt if still in the future, else run now
      const persisted = scannerStateStore.getPipelineSchedule().nextRunAt;
      const persistedTime = persisted ? new Date(persisted).getTime() : 0;
      nextTime = persistedTime > Date.now() ? persistedTime : Date.now() + 5000; // 5s grace if missed
    } else {
      nextTime = Date.now() + intervalMs;
    }
    const nextIso = new Date(nextTime).toISOString();
    setNextPipelineRun(nextIso);
    scannerStateStore.updatePipelineSchedule({ nextRunAt: nextIso });

    // Poll every 30 seconds to check if it's time
    pipelineTimerRef.current = setInterval(() => {
      const now = Date.now();
      const currentNext = scannerStateStore.getPipelineSchedule().nextRunAt;
      if (!currentNext) { clearScheduleTimer(); return; }
      const nextMs = new Date(currentNext).getTime();
      if (now < nextMs) return; // Not time yet

      // Time to run — check guards
      const mode = localStorage.getItem('pipelineMode') || 'hybrid';
      if (mode === 'manual') return;
      if (pipelineRunningRef.current) {
        // Pipeline busy — skip this run, schedule next
        const newNext = new Date(Date.now() + intervalMs).toISOString();
        setNextPipelineRun(newNext);
        scannerStateStore.updatePipelineSchedule({ nextRunAt: newNext });
        return;
      }
      if (isScanRunning() || isFineScanRunning() || isDeeperValidationRunning() || isEntryPlanRunning()) return;

      // Fire the pipeline (timer-triggered = auto_market_session)
      runAIPipelineRef.current?.({ trigger: 'auto_market_session' });
    }, 30000); // 30-second poll
  }, [clearScheduleTimer]);

  // On mount: recover schedule. On unmount: cleanup.
  useEffect(() => {
    const savedSchedule = localStorage.getItem('pipelineSchedule') || 'off';
    if (savedSchedule !== 'off' && savedSchedule !== 'manual') {
      // Recovery: check if we missed a scheduled run
      scheduleNextRun(false); // false = recovery mode
    }
    return () => { clearScheduleTimer(); };
  }, []);

  // Persist pipeline mode to localStorage
  useEffect(() => { localStorage.setItem('pipelineMode', pipelineMode); }, [pipelineMode]);

  // When schedule setting changes, restart timer
  useEffect(() => {
    localStorage.setItem('pipelineSchedule', pipelineSchedule);
    scannerStateStore.updatePipelineSchedule({ intervalKey: pipelineSchedule });
    if (pipelineSchedule === 'off') {
      clearScheduleTimer();
      setNextPipelineRun(null);
      scannerStateStore.updatePipelineSchedule({ nextRunAt: null });
    } else {
      scheduleNextRun(true); // true = from now
    }
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
    // Sort: Continue first, then by score descending, limit to 8
    qualified.sort((a: any, b: any) => {
      if (a.selectedBy !== b.selectedBy) return a.selectedBy === 'Continue' ? -1 : 1;
      return (b.matchConfidence || 0) - (a.matchConfidence || 0);
    });
    return qualified.slice(0, 8);
  }, [fineScanResults]);

  // Store-based version for auto pipeline (avoids stale React snapshot)
  const _getValidationCandidatesFromStore = (): any[] => {
    const results = scannerStateStore.getState().fineScan.results;
    if (!results || results.length === 0) return [];
    const qualified: any[] = [];
    for (const r of results) {
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
    qualified.sort((a: any, b: any) => {
      if (a.selectedBy !== b.selectedBy) return a.selectedBy === 'Continue' ? -1 : 1;
      return (b.matchConfidence || 0) - (a.matchConfidence || 0);
    });
    return qualified.slice(0, 8);
  };

  // Breakdown counts for display
  const validationCandidateBreakdown = useCallback(() => {
    const candidates = selectValidationCandidates();
    const continueCount = candidates.filter((c: any) => c.selectedBy === 'Continue').length;
    const watchCount = candidates.filter((c: any) => c.selectedBy === 'Watch-to-Validate').length;
    return { total: candidates.length, continueCount, watchCount };
  }, [selectValidationCandidates]);

  const handleDeeperValidation = async () => {
    if (pipelineRunning) {
      message.warning('Disabled while AI Pipeline is running.');
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

  const _runDeeperValidationLoop = async (selected: any[]) => {
    setDeeperValidationStatus('loading');
    setDeeperValidationResults(null);
    setDvErrorMessage(null);

    // Preflight: check session and AI config
    const preflight = await preflightConfigCheck();
    if (!preflight.ok || !preflight.sessionValid) {
      setDeeperValidationStatus('error');
      unregisterDeeperValidationRun();
      message.error(preflight.error || 'Session expired');
      return;
    }
    if (!preflight.aiAvailable) {
      const reason = preflight.aiKeyIsMasked ? 'AI key is invalid (masked). Re-enter in Settings.' :
                     !preflight.aiConfigured ? 'AI Provider not configured. Configure in Settings.' :
                     preflight.aiTestStatus !== 'connected' ? `AI Provider not tested (${preflight.aiTestStatus}). Click Test AI Connection in Settings.` :
                     'AI unavailable';
      setDeeperValidationStatus('error');
      unregisterDeeperValidationRun();
      message.error(reason);
      return;
    }

    try {
      const candidates = selected.map((r: any) => {
        // Map strategies to backend-friendly names
        const strats = r.matchedStrategies || [];
        let strategy = 'momentum';
        for (const s of strats) {
          const sl = s.toLowerCase();
          if (sl.includes('momentum') || sl.includes('continuation') || sl.includes('breakout') || sl.includes('trend following')) { strategy = 'momentum'; break; }
          if (sl.includes('mean reversion')) { strategy = 'mean_reversion'; break; }
          if (sl.includes('rsi') || sl.includes('reversal')) { strategy = 'rsi'; break; }
          if (sl.includes('moving average') || sl.includes('ma crossover') || sl.includes('ema')) { strategy = 'moving_average'; break; }
          if (sl.includes('macd')) { strategy = 'macd'; break; }
          if (sl.includes('bollinger') || sl.includes('range') || sl.includes('bb')) { strategy = 'bollinger'; break; }
        }
        return {
          symbol: r.symbol,
          decision: r.decision,
          selectedBy: r.selectedBy || 'Continue',
          score: r.matchConfidence || 0,
          strategy: strategy,
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
      const resp = (await deeperValidationAPI.validate(candidates, '1y', 100000)).data;
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
        setDvErrors(resp.errors || []);

        const dvStatus = resp.status || 'completed';
        const failedCount = resp.summary?.failed || resp.errors?.length || 0;

        if (dvStatus === 'failed') {
          setDeeperValidationStatus('error');
          const failReasons = (resp.errors || []).map((e: any) => `${e.symbol}: ${e.message}`).join('; ');
          setDvErrorMessage(`All ${resp.results.length} symbols failed. ${failReasons || 'Check Alpaca Market Data configuration.'}`);
          message.error('All validation symbols failed');
        } else if (dvStatus === 'partial') {
          setDeeperValidationStatus('completed');
          setDvErrorMessage(null);
          message.warning(`Validation partial: ${resp.results.length - failedCount} succeeded, ${failedCount} failed`);
        } else {
          setDeeperValidationStatus('completed');
          setDvErrorMessage(null);
          message.success(`Deeper validation completed for ${resp.results.length} results`);
        }
        unregisterDeeperValidationRun();
      } else {
        setDeeperValidationStatus('error');
        setDvErrorMessage(resp.message || 'Validation returned no results');
        setDvErrors([]);
        unregisterDeeperValidationRun();
        message.error(resp.message || 'Validation returned no results');
      }
    } catch (err: any) {
      const httpStatus = err.response?.status;
      const backendSkipRetry = err.response?.data?.skipRetry;
      const isConfigError = backendSkipRetry || httpStatus === 401 || httpStatus === 403;
      const isRateLimit = httpStatus === 429;

      if (isRateLimit) {
        // 429: retry once with backoff
        console.warn('[DeeperValidation] Rate limited (429), retrying after delay...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        try {
          const resp = (await deeperValidationAPI.validate(
            selected.map((r: any) => ({
              symbol: r.symbol, decision: r.decision, selectedBy: r.selectedBy || 'Continue',
              score: r.matchConfidence || 0, strategy: 'momentum', matchedStrategies: r.matchedStrategies || [],
              backtestStatus: r.backtestStatus || '', optimizationStatus: r.quickOptStatus || '',
              entryQuality: r.entryQuality || '', liquidityGrade: r.liquidityGrade || '',
              riskGrade: r.riskGrade || '', whyMatched: r.matchReason || '',
              decisionReason: r.decisionReason || r.finalReason || '',
            })), '1y', 100000
          )).data;
          if (resp.success && Array.isArray(resp.results)) {
            const devTestSymbols = new Set(selected.filter((r: any) => r.isDevTest).map((r: any) => r.symbol));
            const selectedByMap = new Map(selected.map((r: any) => [r.symbol, r.selectedBy || 'Continue']));
            const enrichedResults = resp.results.map((r: any) => ({
              ...r, isDevTest: devTestSymbols.has(r.symbol) || r.isDevTest || false,
              selectedBy: selectedByMap.get(r.symbol) || 'Continue',
            }));
            setDeeperValidationResults(enrichedResults);
            setDvErrors(resp.errors || []);

            const dvStatus = resp.status || 'completed';
            const failedCount = resp.summary?.failed || resp.errors?.length || 0;

            if (dvStatus === 'failed') {
              setDeeperValidationStatus('error');
              const failReasons = (resp.errors || []).map((e: any) => `${e.symbol}: ${e.message}`).join('; ');
              setDvErrorMessage(`All ${resp.results.length} symbols failed. ${failReasons || 'Check Alpaca Market Data configuration.'}`);
              message.error('All validation symbols failed');
            } else if (dvStatus === 'partial') {
              setDeeperValidationStatus('completed');
              setDvErrorMessage(null);
              message.warning(`Validation partial: ${resp.results.length - failedCount} succeeded, ${failedCount} failed`);
            } else {
              setDeeperValidationStatus('completed');
              setDvErrorMessage(null);
              message.success(`Deeper validation completed for ${resp.results.length} results`);
            }
            unregisterDeeperValidationRun();
            return;
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
      const errMsg = isConfigError
        ? `Config error (HTTP ${dvHttpStatus || '?'}): ${backendMsg || 'Check AI Provider settings.'}`
        : isRateLimit
          ? `Rate Limited (429)${errDetail ? ` — ${errDetail}` : ''}. Backend API throttled. Retry will happen next interval.`
          : isTimeout
            ? `Timed out${errDetail ? ` — ${errDetail}` : ''}. Try fewer symbols or retry.`
            : `HTTP ${dvHttpStatus || '?'}: ${backendMsg || err.message || 'Unknown error'}${errDetail ? ` — ${errDetail}` : ''} [${errSymbols.slice(0, 5).join(', ')}${errSymbols.length > 5 ? '...' : ''}]`;
      setDeeperValidationStatus('error');
      setDvErrorMessage(errMsg);
      setDvErrors(backendErrors);
      unregisterDeeperValidationRun();
      message.error(errMsg);
    }
  };


// ===== Deeper Validation Detail Panel =====
function renderDVDetailPanel(record: any, t: any, language: string) {
  var tc = record.tradeCount != null ? record.tradeCount : record.trades;
  
  // Verdict colors
  var v = record.verdict;
  var vColor = '#52c41a';
  if (v === 'Watch' || v === 'Caution') vColor = '#faad14';
  else if (v === 'Avoid' || v === 'Reject' || v === 'Rejected') vColor = '#ff4d4f';
  else if (v === 'Needs Manual Review') vColor = '#722ed1';
  var vNameRaw = v === 'Needs Manual Review' ? 'Review' : v === 'Reject' || v === 'Rejected' || v === 'Avoid' ? 'Rejected' : v === 'Caution' ? 'Watch' : v;
  var verdictMap: Record<string, string> = { 'Confirmed': t.agent.dvVerdictConfirmed, 'Pass': t.agent.dvVerdictPass, 'Rejected': t.agent.dvVerdictRejected, 'Review': t.agent.dvVerdictReview, 'Watch': t.agent.dvVerdictWatch };
  var vName = verdictMap[vNameRaw] || vNameRaw;
  if (vNameRaw === 'Review') v = vNameRaw;
  else if (v === 'Reject' || v === 'Rejected' || v === 'Avoid') v = 'Rejected';
  else if (v === 'Caution') v = 'Watch';
  
  // Reason parts
  var reasonParts = (record.reason || '').split(' | ');
  
  // Helper: translate DV reason text (dictionary replacement for zh-CN)
  function translateDVReason(text: string): string {
    if (!text || language !== 'zh-CN') return text || '';
    var r = text;
    r = r.replace(/\bConfirmed\b/g, t.agent.dvReasonConfirmed);
    r = r.replace(/\bWatch\b/g, t.agent.dvReasonWatch);
    r = r.replace(/\bReject\b/g, t.agent.dvReasonReject);
    r = r.replace(/\bWeakening\b/g, t.agent.dvTrendWeakening);
    r = r.replace(/\brecent Weakening\b/g, t.agent.dvReasonRecentWeakening);
    r = r.replace(/\bparameter sets profitable\b/g, t.agent.dvReasonParamProfitable);
    r = r.replace(/\bmedian return\b/g, t.agent.dvReasonMedianReturn);
    r = r.replace(/\bmedian sharpe\b/g, t.agent.dvReasonMedianSharpe);
    r = r.replace(/\bprofit factor\b/gi, t.agent.dvReasonProfitFactor);
    r = r.replace(/\bsharpe\b/gi, t.agent.dvReasonSharpe);
    r = r.replace(/\breturn\b/gi, t.agent.dvReasonReturn);
    r = r.replace(/\bdrawdown\b/gi, t.agent.dvReasonDrawdown);
    r = r.replace(/\bwin rate\b/gi, t.agent.dvReasonWinRate);
    r = r.replace(/\btrades\b/gi, t.agent.dvReasonTrades);
    r = r.replace(/\bSample Limited\b/gi, t.agent.dvReasonSampleLimited);
    r = r.replace(/\bStable\b/g, t.agent.stableLabel);
    r = r.replace(/\bWeak\b/g, t.agent.weakLabel);
    r = r.replace(/\bModerate\b/g, t.agent.moderateLabel);
    r = r.replace(/\bcombinations tested\b/g, t.agent.testedCombos);
    return r;
  }

  // Helper: render a metric row
  function metricRow(label: any, value: any, color?: any) {
    return React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid #f0f0f0', fontSize: '11px' } },
      React.createElement('span', { style: { color: '#888' } }, label),
      React.createElement('span', { style: { fontWeight: 600, color: color || '#333' } }, value != null ? String(value) : t.agent.naLabel)
    );
  }
  
  // Helper: parameter chips
  function paramChips(params: any) {
    if (!params || Object.keys(params).length === 0) return null;
    return React.createElement('div', { style: { display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'flex-end' } },
      Object.entries(params).map(function(kv: any) {
        return React.createElement(Tag, { key: kv[0], style: { fontSize: '9px', margin: 0, padding: '0 4px', background: '#f0f0f0', border: 'none' } }, kv[0] + ': ' + String(kv[1]));
      })
    );
  }
  
  // Helper: card wrapper
  function cardBlock(title: any, children: any, accentColor: any, extra?: any) {
    return React.createElement('div', { style: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' } },
      React.createElement('div', { style: { fontWeight: 700, fontSize: '12px', marginBottom: 8, color: accentColor || '#333', borderBottom: '2px solid ' + (accentColor || '#e5e7eb'), paddingBottom: 6 } }, title),
      extra ? React.createElement('div', { style: { fontSize: '10px', color: '#999', marginBottom: 6 } }, extra) : null,
      children
    );
  }
  
  // Profit factor text
  function pfText(): string {
    var pf = record.profitFactor;
    if (pf == null) {
      if (tc != null && tc > 0 && record.totalReturn != null && record.totalReturn > 0) return String.fromCharCode(8734) + ` (${t.agent.noLosses})`;
      return t.agent.naLabel;
    }
    return pf.toFixed(2);
  }
  function pfColor(): string {
    var pf = record.profitFactor;
    if (pf == null) return (tc != null && tc > 0 && record.totalReturn != null && record.totalReturn > 0) ? '#52c41a' : '#bbb';
    if (pf >= 1.5) return '#52c41a';
    if (pf >= 1.0) return '#faad14';
    return '#ff4d4f';
  }
  
  // Sharpe color
  function shColor(s: any): string {
    if (s == null) return '#bbb';
    if (s >= 1.0) return '#52c41a';
    if (s >= 0.5) return '#faad14';
    return '#ff4d4f';
  }
  
  // Return color
  function retColor(r: any): string {
    if (r == null) return '#bbb';
    return r > 0 ? '#52c41a' : '#ff4d4f';
  }
  
  // DD color
  function ddColor(d: any): string {
    if (d == null) return '#bbb';
    var absD = Math.abs(d);
    if (absD <= 15) return '#52c41a';
    if (absD <= 25) return '#faad14';
    return '#ff4d4f';
  }
  
  // Stability
  var isLimitedSample = (tc != null && tc < 3) || (record.validCombinationCount != null && record.validCombinationCount < 3);
  var stScore = record.stabilityScore;
  var stLabel = stScore != null ? (stScore >= 70 ? t.agent.stableLabel : stScore >= 50 ? t.agent.moderateLabel : t.agent.weakLabel) : t.agent.naLabel;
  var stColor = stScore != null ? (stScore >= 70 ? '#52c41a' : stScore >= 50 ? '#faad14' : '#ff4d4f') : '#bbb';
  
  // Trend color
  function trendColor(t: any): string {
    if (!t) return '#bbb';
    if (t === 'Weakening') return '#faad14';
    if (t === 'Divergent') return '#ff4d4f';
    if (t === 'Consistent') return '#1890ff';
    return '#52c41a';
  }
  
  return React.createElement('div', { style: { background: '#f8f9fa', padding: '16px', borderRadius: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', maxWidth: '100%' } },
    
    // Card 1: 1Y Backtest
    cardBlock(t.agent.oneYearBacktest,
      React.createElement(React.Fragment, null,
        metricRow(t.agent.strategy, record.strategy),
        metricRow(t.agent.totalReturn, record.totalReturn != null ? (record.totalReturn > 0 ? '+' : '') + record.totalReturn.toFixed(1) + '%' : 'N/A', retColor(record.totalReturn)),
        metricRow(t.agent.sharpeRatio, record.sharpeRatio != null ? record.sharpeRatio.toFixed(2) : 'N/A', shColor(record.sharpeRatio)),
        metricRow(t.agent.maxDrawdown, record.maxDrawdown != null ? '-' + Math.abs(record.maxDrawdown).toFixed(1) + '%' : 'N/A', ddColor(record.maxDrawdown)),
        metricRow(t.agent.winRate, record.winRate != null ? record.winRate + '%' : 'N/A'),
        metricRow(t.agent.profitFactor, pfText(), pfColor()),
        record.parameters && Object.keys(record.parameters).length > 0 ?
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid #f0f0f0', fontSize: '11px' } },
            React.createElement('span', { style: { color: '#888' } }, t.agent.colParams),
            paramChips(record.parameters)
          ) : null,
        metricRow(t.agent.colTrades, tc != null ? (tc < 3 ? t.agent.limitedSample + ' (' + tc + ')' : String(tc)) : 'N/A', tc != null ? (tc >= 10 ? undefined : tc >= 3 ? '#faad14' : '#ff4d4f') : undefined),
      ),
      '#1890ff',
      t.agent.sourceInternalBacktest
    ),
    
    // Card 2: Light Optimization
    cardBlock(t.agent.lightOptimization,
      React.createElement(React.Fragment, null,
        metricRow(t.agent.testedCombos, (record.testedCombinationCount ?? record.optimizationResults?.length ?? record.validCombinationCount ?? 0) > 0 ? String(record.testedCombinationCount ?? record.optimizationResults?.length ?? record.validCombinationCount ?? 0) : 'N/A'),
        metricRow(t.agent.validCombos, record.validCombinationCount != null ? String(record.validCombinationCount) : 'N/A'),
        metricRow(t.agent.bestReturn, record.optimizedReturn != null ? (record.optimizedReturn > 0 ? '+' : '') + record.optimizedReturn.toFixed(1) + '%' : 'N/A', retColor(record.optimizedReturn)),
        metricRow(t.agent.bestSharpe, record.optimizedSharpe != null ? record.optimizedSharpe.toFixed(2) : 'N/A', shColor(record.optimizedSharpe)),
        metricRow(t.agent.avgReturn, record.avgReturn != null ? record.avgReturn + '%' : 'N/A', retColor(record.avgReturn)),
        metricRow(t.agent.medianReturn, record.medianReturn != null ? record.medianReturn + '%' : 'N/A'),
        metricRow(t.agent.positiveRatio, record.profitableRatio != null ? Math.round(record.profitableRatio * 100) + '%' : 'N/A'),
        metricRow(t.agent.returnSpread, record.returnSpread != null ? record.returnSpread + '%' : 'N/A'),
        // Top 3 results
        record.top3Results && record.top3Results.length > 0 ?
          React.createElement('div', { style: { marginTop: 8 } },
            React.createElement('div', { style: { fontSize: '10px', color: '#888', marginBottom: 4 } }, t.agent.topResults + ':'),
            record.top3Results.map(function(r: any, i: number) {
              return React.createElement('div', { key: i, style: { fontSize: '10px', padding: '2px 0', borderBottom: i < record.top3Results.length - 1 ? '1px solid #f0f0f0' : 'none' } },
                React.createElement('span', { style: { color: '#666' } }, '#' + (i+1) + ': '),
                React.createElement('span', { style: { color: r.ret > 0 ? '#52c41a' : '#ff4d4f', fontWeight: 600 } }, t.agent.paramRet + '=' + r.ret + '%'),
                React.createElement('span', { style: { color: '#999' } }, ' ' + t.agent.paramSharpe + '=' + r.sharp + ' '),
                r.params && typeof r.params === 'object' ? 
                  React.createElement('span', { style: { color: '#999' } }, Object.entries(r.params).map(function(kv: any) { return kv[0] + '=' + String(kv[1]); }).join(', ')) : null
              );
            })
          ) : null
      ),
      '#722ed1',
      t.agent.sourceInternalOptimization
    ),
    
    // Card 3: Parameter Stability
    cardBlock(t.agent.parameterStability,
      React.createElement(React.Fragment, null,
        isLimitedSample ?
          React.createElement('div', { style: { padding: '6px 8px', background: '#fff3cd', borderRadius: 6, marginBottom: 8, fontSize: '10px', color: '#856404' } },
            String.fromCharCode(9888) + ' ' + t.agent.limitedSampleWarn.replace('{trades}', String(tc)).replace('{combos}', String(record.validCombinationCount || 0))
          ) : null,
        metricRow(t.agent.colScore, stScore != null ? stScore + '/100' : 'N/A', stColor),
        metricRow(t.agent.colLabel, stLabel, stColor),
        metricRow(t.agent.profitableRatio, record.profitableRatio != null ? Math.round(record.profitableRatio * 100) + '%' : 'N/A'),
        metricRow(t.agent.medianReturn, record.medianReturn != null ? record.medianReturn + '%' : 'N/A'),
        metricRow(t.agent.bestReturn, record.bestReturn != null ? record.bestReturn + '%' : 'N/A', retColor(record.bestReturn)),
        metricRow(t.agent.returnSpread, record.returnSpread != null ? record.returnSpread + '%' : 'N/A'),
        metricRow(t.agent.stableParams, record.stableParameterCount != null ? String(record.stableParameterCount) : 'N/A'),
        record.stabilityReason ?
          React.createElement('div', { style: { marginTop: 6, fontSize: '10px', color: '#666', fontStyle: 'italic' } }, translateDVReason(record.stabilityReason)) : null
      ),
      '#fa8c16'
    ),
    
    // Card 4: Recent vs Long-Term
    cardBlock(t.agent.recentVsLongTermLabel,
      React.createElement(React.Fragment, null,
        metricRow(t.agent.longReturn, record.longTermReturn != null ? (record.longTermReturn > 0 ? '+' : '') + record.longTermReturn.toFixed(1) + '%' : 'N/A', retColor(record.longTermReturn)),
        metricRow(t.agent.recentReturn, record.recentReturn != null ? (record.recentReturn > 0 ? '+' : '') + record.recentReturn.toFixed(1) + '%' : 'N/A', retColor(record.recentReturn)),
        metricRow(t.agent.longSharpe, record.longTermSharpe != null ? record.longTermSharpe.toFixed(2) : 'N/A', shColor(record.longTermSharpe)),
        metricRow(t.agent.recentSharpe, record.recentSharpe != null ? record.recentSharpe.toFixed(2) : 'N/A', shColor(record.recentSharpe)),
        metricRow(t.agent.longDD, record.longTermMaxDrawdown != null ? '-' + Math.abs(record.longTermMaxDrawdown).toFixed(1) + '%' : 'N/A', ddColor(record.longTermMaxDrawdown)),
        metricRow(t.agent.recentDD, record.recentMaxDrawdown != null ? '-' + Math.abs(record.recentMaxDrawdown).toFixed(1) + '%' : 'N/A', ddColor(record.recentMaxDrawdown)),
        record.recentVsLongTerm ?
          React.createElement('div', { style: { marginTop: 8, textAlign: 'center' } },
            React.createElement(Tag, { color: trendColor(record.recentVsLongTerm), style: { fontSize: '10px', fontWeight: 700, margin: 0, padding: '2px 10px', borderRadius: '8px' } }, ({'Improving': t.agent.dvTrendImproving, 'Consistent': t.agent.dvTrendConsistent, 'Weakening': t.agent.dvTrendWeakening, 'Divergent': t.agent.dvTrendDivergent} as any)[record.recentVsLongTerm] || record.recentVsLongTerm)
          ) : null
      ),
      '#13c2c2'
    ),

    // Data Provenance strip — compact chips
    (function() {
      var aiExplained = record.aiExplained === true;
      var explanationSource = aiExplained ? 'DeepSeek' : t.agent.ruleBasedLabel;
      var rgStatus = (record.riskGate || {}).status || t.agent.naLabel;
      var fdSourceRaw = (record.finalDecision || {}).source || 'Rule-based';
      var fdSource = fdSourceRaw === 'Rule-based' ? t.agent.ruleBasedLabel : fdSourceRaw;
      var chips = [
        {label: t.agent.marketDataLabel + ': ' + (record.dataSource === 'alpaca' ? 'Alpaca' : record.dataSource || t.agent.naLabel), isAI: false, title: 'Alpaca Market Data API'},
        {label: t.agent.backtestLabel, isAI: false, title: 'Internal Backtest Engine'},
        {label: t.agent.optLabel, isAI: false, title: 'Internal Optimization Engine'},
        {label: t.agent.verdictLabel, isAI: false, title: 'Deterministic Rules'},
        {label: t.agent.riskGateLabel + rgStatus, isAI: false, title: t.agent.riskGateLabel + ((record.riskGate || {}).reason || t.agent.naLabel)},
        {label: t.agent.decisionLabel + ': ' + fdSource, isAI: fdSourceRaw !== 'Rule-based', title: fdSourceRaw !== 'Rule-based' ? 'AI Final Decision' : 'Rule-based decision (no AI call)'},
        {label: t.agent.explainLabel + ': ' + explanationSource, isAI: aiExplained, title: aiExplained ? 'DeepSeek AI' : 'Rule-based explanation'},
      ];
      return React.createElement('div', { style: { gridColumn: '1 / -1', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', fontSize: '8px', color: '#888' } },
        chips.map(function(c: any) {
          return React.createElement('span', { key: c.label, title: c.title, style: { padding: '1px 6px', borderRadius: '3px', background: c.isAI ? '#e6fffb' : '#f0f0f0', color: c.isAI ? '#13c2c2' : '#888', border: '1px solid ' + (c.isAI ? '#b5f5ec' : '#e0e0e0'), whiteSpace: 'nowrap', cursor: 'default' } }, c.label);
        }),
        isLimitedSample ?
          React.createElement(Tag, { color: 'warning', style: { fontSize: '8px', margin: 0, marginLeft: 'auto', padding: '0 4px', lineHeight: '16px' } }, t.agent.limitedSample) : null
      );
    })(),

    // Summary Footer - Compact Status Row
    React.createElement('div', { style: { gridColumn: '1 / -1', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' } },
      React.createElement('div', { style: { flex: 1, minWidth: 0 } },
        reasonParts.length > 0 ?
          React.createElement('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } },
            React.createElement('span', { style: { fontSize: '10px', color: '#8c8c8c', fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 } }, t.agent.verdictReasons + ':'),
            React.createElement('div', { style: { fontSize: '12px', color: '#434343', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, title: reasonParts.map(translateDVReason).join(' | ') },
              reasonParts.map(translateDVReason).join(' · ')
            )
          ) :
          React.createElement('div', { style: { fontSize: '12px', color: '#8c8c8c', fontStyle: 'italic' } },
            translateDVReason(record.verdictReason || record.decisionSummary) || t.agent.finalValidationComplete
          )
      ),
      React.createElement('div', { style: { display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 } },
        // Risk Gate badge
        (function() {
          var rg = record.riskGate || {};
          var rgStatus = rg.status || 'N/A';
          var rgColor = rgStatus === 'PASS' ? 'green' : rgStatus === 'REVIEW' ? 'gold' : rgStatus === 'BLOCK' ? 'red' : 'default';
          var rgLabel = rgStatus === 'BLOCK' ? t.agent.gateBlocked : rgStatus === 'N/A' ? t.agent.naLabel : rgStatus;
          return React.createElement(Tooltip, { title: rg.reason || t.agent.noRiskGateData },
            React.createElement(Tag, { color: rgColor, style: { fontSize: '10px', margin: 0, padding: '0 8px', fontWeight: 700, borderRadius: '4px' } }, t.agent.gatePrefix + ': ' + rgLabel)
          );
        })(),
        // Final Verdict badge
        React.createElement(Tag, { color: vColor, style: { fontSize: '12px', fontWeight: 800, margin: 0, padding: '2px 14px', borderRadius: '6px', textTransform: 'uppercase' } }, vName)
      )
    )
  );
}

  return (
    <div className="ai-agent-page-container" style={{ padding: '0 8px 40px 8px' }}>
      <style>{`
        .ai-agent-page-container { animation: fadeIn 0.5s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .premium-card { border-radius: 12px !important; border: 1px solid #f0f0f0 !important; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03) !important; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important; }
        .premium-card:hover { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06) !important; transform: translateY(-2px) !important; }
        .status-strip { background: linear-gradient(90deg, #fafafa 0%, #ffffff 100%); border-radius: 10px; padding: 12px 20px; border: 1px solid #f0f0f0; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
        .stat-box { display: flex; flex-direction: column; gap: 4px; }
        .stat-label { font-size: 11px; color: #8c8c8c; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
        .stat-value { font-size: 14px; font-weight: 700; color: #262626; }
        .compact-table .ant-table-thead > tr > th { background: #fafafa !important; font-size: 11px !important; text-transform: uppercase !important; letter-spacing: 0.3px !important; padding: 10px 8px !important; }
      `}</style>

      {/* ── Page Header ── */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'linear-gradient(135deg, #1890ff 0%, #003a8c 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)' }}>
              <RobotOutlined />
            </div>
            <Title level={1} style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', color: '#1a1a1a' }}>{t.agent.pageTitle}</Title>
          </div>
          <Text type="secondary" style={{ fontSize: 15, marginLeft: 52 }}>{t.agent.pageSubtitle}</Text>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
           <Badge status="processing" text={<Text strong style={{ color: '#52c41a', fontSize: 12 }}>{t.agent.systemOnline}</Text>} />
        </div>
      </div>

      <Divider />

      {/* 1. AI Configuration — compact status strip */}
      <div style={{ marginBottom: 24 }}>
        <div className="status-strip">
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div className="stat-box">
              <span className="stat-label">{t.agent.aiProvider}</span>
              <span className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {aiConfig.provider || t.agent.notSet}
                <Tag color="blue" bordered={false} style={{ margin: 0, fontSize: 10, lineHeight: '16px' }}>V3</Tag>
              </span>
            </div>
            <Divider type="vertical" style={{ height: 32, margin: 0 }} />
            <div className="stat-box">
              <span className="stat-label">{t.agent.model}</span>
              <span className="stat-value">{aiConfig.model || t.agent.notSet}</span>
            </div>
            <Divider type="vertical" style={{ height: 32, margin: 0 }} />
            <div className="stat-box">
              <span className="stat-label">{t.agent.aiStatus}</span>
              {configStatus.loaded ? (
                configStatus.aiTestStatus === 'connected' ? <Tag color="success" style={{ margin: 0, borderRadius: 10, fontWeight: 700, fontSize: 10 }}>{t.agent.connected}</Tag> :
                configStatus.aiTestStatus === 'saved' ? <Tag color="warning" style={{ margin: 0, borderRadius: 10, fontWeight: 700, fontSize: 10 }}>{t.agent.notTested}</Tag> :
                configStatus.aiTestStatus === 'error' ? <Tag color="error" style={{ margin: 0, borderRadius: 10, fontWeight: 700, fontSize: 10 }}>{t.agent.error}</Tag> :
                configStatus.ai ? <Tag color="warning" style={{ margin: 0, borderRadius: 10, fontWeight: 700, fontSize: 10 }}>{t.agent.notTested}</Tag> :
                <Tag color="default" style={{ margin: 0, borderRadius: 10, fontWeight: 700, fontSize: 10 }}>{t.agent.notConfigured}</Tag>
              ) : <Spin size="small" />}
            </div>
            <Divider type="vertical" style={{ height: 32, margin: 0 }} />
            <div className="stat-box">
              <span className="stat-label">{t.agent.marketData}</span>
              {configStatus.loaded ? <Tag color="processing" style={{ margin: 0, borderRadius: 10, fontWeight: 700, fontSize: 10 }}>{t.agent.alpaca}</Tag> : <Spin size="small" />}
            </div>
            <Divider type="vertical" style={{ height: 32, margin: 0 }} />
            <div className="stat-box">
              <span className="stat-label">{t.agent.trading}</span>
              {configStatus.loaded ? (configStatus.alpaca ? <Tag color="processing" style={{ margin: 0, borderRadius: 10, fontWeight: 700, fontSize: 10 }}>{t.agent.paper}</Tag> : <Tag color="default" style={{ margin: 0, borderRadius: 10, fontWeight: 700, fontSize: 10 }}>{t.agent.notLinked}</Tag>) : <Spin size="small" />}
            </div>
          </div>
          <Button type="text" icon={<SettingOutlined />} onClick={() => navigate('/settings/configuration')} style={{ color: '#1890ff', fontWeight: 600, fontSize: 13 }}>{t.agent.manageSettings}</Button>
        </div>
      </div>
{/* 1.5 Trading Account Mode */}
      <div style={{ marginBottom: 24 }}>
        <Card
          className="premium-card"
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>
                <SettingOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                {t.agent.tradingAccountMode}
              </span>
              <Tag color={tradeMode === 'paper' ? 'blue' : 'error'} bordered={false} style={{ fontSize: 11, fontWeight: 700, borderRadius: 4, margin: 0 }}>
                {tradeMode === 'paper' ? t.agent.paperTrading : t.agent.realTrading}
              </Tag>
            </div>
          }
        >
          <div style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
            <InfoCircleOutlined style={{ color: '#1890ff' }} />
            {t.agent.tradingAccountDesc} <Text type="secondary" style={{ fontSize: 12 }}>{t.agent.tradingAccountDescNote}</Text>
          </div>
          
          <div style={{ background: '#fafafa', borderRadius: 12, padding: '20px', border: '1px solid #f0f0f0', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}>
            {tradingAccountLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#8c8c8c' }}>
                <Spin indicator={<LoadingOutlined style={{ fontSize: 16 }} spin />} />
                <span>{t.agent.syncAccountData}</span>
              </div>
            ) : tradingAccountData?.success ? (
              <Row gutter={40} align="middle">
                <Col>
                  <div className="stat-box">
                    <span className="stat-label" style={{ fontSize: 10 }}>{t.agent.accountType}</span>
                    <span className="stat-value" style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {tradingAccountData?.mode === 'paper' ? <><Tag color="blue" bordered={false} style={{ margin: 0, fontWeight: 700 }}>{t.agent.paper}</Tag></> : <><Tag color="error" bordered={false} style={{ margin: 0, fontWeight: 700 }}>{t.agent.live}</Tag></>}
                    </span>
                  </div>
                </Col>
                <Col>
                  <div className="stat-box">
                    <span className="stat-label" style={{ fontSize: 10 }}>{t.agent.status}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 22 }}>
                      <Badge status={tradingAccountData.status === 'ACTIVE' ? 'success' : 'warning'} />
                      <span style={{ fontWeight: 800, fontSize: 14, color: tradingAccountData.status === 'ACTIVE' ? '#52c41a' : '#faad14' }}>
                        {tradingAccountData.status || 'N/A'}
                      </span>
                    </div>
                  </div>
                </Col>
                <Col style={{ flex: 1 }}>
                  <Divider type="vertical" style={{ height: 40, margin: 0, opacity: 0.5 }} />
                </Col>
                <Col>
                  <div className="stat-box">
                    <span className="stat-label" style={{ fontSize: 10 }}>{t.agent.cash}</span>
                    <span style={{ fontWeight: 800, fontSize: 18, color: '#1f1f1f', fontFamily: "'Inter', sans-serif" }}>
                      ${(tradingAccountData.cash ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </Col>
                <Col>
                  <div className="stat-box">
                    <span className="stat-label" style={{ fontSize: 10 }}>{t.agent.buyingPower}</span>
                    <span style={{ fontWeight: 800, fontSize: 18, color: '#1f1f1f', fontFamily: "'Inter', sans-serif" }}>
                      ${(tradingAccountData.buyingPower ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </Col>
                <Col>
                  <div className="stat-box">
                    <span className="stat-label" style={{ fontSize: 10 }}>{t.agent.portfolioValue}</span>
                    <span style={{ fontWeight: 800, fontSize: 18, color: '#1890ff', fontFamily: "'Inter', sans-serif" }}>
                      ${(tradingAccountData.portfolioValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </Col>
              </Row>
            ) : (
              <div style={{ color: '#8c8c8c', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                {tradingAccountData?.error ? (
                  <><ExclamationCircleOutlined style={{ color: '#faad14' }} />{tradingAccountData.error}</>
                ) : (
                  <><InfoCircleOutlined /> {t.agent.noAccountData}</>
                )}
                <Tag style={{ marginLeft: 8 }}>{t.agent.configureAlpaca}</Tag>
              </div>
            )}
          </div>

          {tradeMode === 'real' && (
            <div style={{
              marginTop: 12,
              padding: '6px 12px',
              background: '#fafafa',
              borderRadius: 6,
              border: '1px solid #e8e8e8',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: '#595959'
            }}>
              <ExclamationCircleOutlined style={{ color: '#faad14', fontSize: 12 }} />
              <span>{t.agent.tradingModeRealHint}</span>
            </div>
          )}
        </Card>
      </div>

      {/* 1.52 Trading Preferences */}
      <div style={{ marginBottom: 24 }}>
        <Card
          className="premium-card"
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>
                <FundOutlined style={{ marginRight: 8, color: '#722ed1' }} />
                {t.agent.tradingPreferences}
              </span>
            </div>
          }
        >
          <Row gutter={32}>
            <Col flex="1">
              <div style={{ marginBottom: 8 }}>
                <Text strong style={{ fontSize: 13 }}>{t.agent.riskProfile}</Text>
                <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>{t.agent.riskProfileDesc}</Text>
              </div>
              <Segmented
                block
                value={riskProfile}
                onChange={handleRiskProfileChange}
                options={[
                  { label: t.agent.lowRisk, value: 'low' },
                  { label: t.agent.mediumRisk, value: 'medium' },
                  { label: t.agent.highRisk, value: 'high' },
                ]}
                style={{ background: '#f5f5f5', borderRadius: 8 }}
              />
            </Col>
            <Col flex="1">
              <div style={{ marginBottom: 8 }}>
                <Text strong style={{ fontSize: 13 }}>{t.agent.timeHorizon}</Text>
                <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>{t.agent.timeHorizonDesc}</Text>
              </div>
              <Segmented
                block
                value={timeHorizon}
                onChange={handleTimeHorizonChange}
                options={[
                  { label: t.agent.shortTerm, value: 'short' },
                  { label: t.agent.midTerm, value: 'mid' },
                  { label: t.agent.longTerm, value: 'long' },
                ]}
                style={{ background: '#f5f5f5', borderRadius: 8 }}
              />
            </Col>
          </Row>
        </Card>
      </div>

      {/* 1.55 AI Auto Pipeline */}
      <div style={{ marginBottom: 24 }}>
        <Card
          className="premium-card"
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(114, 46, 209, 0.1)', color: '#722ed1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  <RobotOutlined />
                </div>
                <span style={{ fontWeight: 700, fontSize: 16 }}>{t.agent.aiPipeline}</span>
                <Tag color={pipelineMode === 'ai' ? 'purple' : pipelineMode === 'hybrid' ? 'blue' : 'default'} bordered={false} style={{ fontSize: 10, fontWeight: 800, borderRadius: 4 }}>
                  {pipelineMode === 'ai' ? t.agent.buyAction : pipelineMode === 'hybrid' ? t.agent.modeHybrid : t.agent.skipAction}
                </Tag>
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {pipelineRunning ? (
                  <Button
                    danger
                    icon={<PauseCircleOutlined />}
                    onClick={stopPipeline}
                    style={{ ...AI_AGENT_PRIMARY_BTN_STYLE, height: 34 }}
                  >
                    {t.agent.stop}
                  </Button>
                ) : (
                  <Button
                    type="primary"
                    icon={<ThunderboltOutlined />}
                    onClick={() => runAIPipeline({ trigger: 'manual' })}
                    disabled={pipelineMode === 'manual' ? false : isAnyScanRunning}
                    style={{ 
                      ...AI_AGENT_PRIMARY_BTN_STYLE, 
                      background: '#722ed1', 
                      borderColor: '#722ed1', 
                      color: '#ffffff', // FIX: ensure high contrast white text
                      height: 34,
                      boxShadow: '0 4px 10px rgba(114, 46, 209, 0.3)'
                    }}
                  >
                    {pipelineMode === 'manual' ? t.agent.runPipeline : t.agent.runPipeline}
                  </Button>
                )}
              </div>
            </div>
          }
        >
          {/* Mode-specific compact hint */}
          <div style={{ marginBottom: 16 }}>
            <div style={{
              padding: '6px 12px',
              background: '#fafafa',
              borderRadius: 6,
              border: '1px solid #e8e8e8',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: '#595959'
            }}>
              <InfoCircleOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />
              <span>
                {pipelineMode === 'ai'
                  ? t.agent.pipelineModeAiDesc
                  : pipelineMode === 'hybrid'
                    ? t.agent.pipelineModeHybridDesc
                    : t.agent.pipelineModeManualDesc}
              </span>
            </div>
          </div>

          <div style={{ background: '#fafafa', padding: '16px 20px', borderRadius: 12, border: '1px solid #f0f0f0' }}>
            <Row gutter={[32, 16]}>
              <Col span={8}>
                <div style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>{t.agent.aiPipeline}</div>
                <div style={{ display: 'flex', background: '#f0f2f5', padding: 3, borderRadius: 8, gap: 4, border: '1px solid #e8e8e8' }}>
                  {(['ai', 'hybrid', 'manual'] as const).map(m => (
                    <Button key={m} size="small"
                      type={pipelineMode === m ? 'primary' : 'text'}
                      onClick={() => { setPipelineMode(m); if (pipelineSchedule !== 'off') savePipelineAutoConfig(pipelineSchedule); }}
                      style={{ 
                        flex: 1, 
                        borderRadius: 6, 
                        height: 28, 
                        fontSize: 11, 
                        fontWeight: pipelineMode === m ? 700 : 500, 
                        border: 'none',
                        color: pipelineMode === m ? '#fff' : '#8c8c8c',
                        background: pipelineMode === m ? (m === 'ai' ? '#722ed1' : undefined) : 'transparent',
                        boxShadow: pipelineMode === m ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                      }}
                    >
                      {m === 'ai' ? t.agent.modeAI : m === 'hybrid' ? t.agent.modeHybrid : t.agent.modeManual}
                    </Button>
                  ))}
                </div>
              </Col>
              <Col span={9}>
                <div style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>{t.agent.pipelineRunning}</div>
                <div style={{ display: 'flex', background: '#f0f2f5', padding: 3, borderRadius: 8, gap: 2, border: '1px solid #e8e8e8' }}>
                  {(['off', '15m', '30m', '1h', '2h'] as const).map(s => (
                    <Button key={s} size="small"
                      type={pipelineSchedule === s ? 'primary' : 'text'}
                      onClick={() => { setPipelineSchedule(s); savePipelineAutoConfig(s); }}
                      disabled={pipelineMode === 'manual' && s !== 'off'}
                      style={{ 
                        flex: 1, 
                        borderRadius: 6, 
                        height: 28, 
                        fontSize: 10, 
                        fontWeight: pipelineSchedule === s ? 700 : 500, 
                        border: 'none',
                        color: pipelineSchedule === s ? '#fff' : '#8c8c8c',
                        boxShadow: pipelineSchedule === s ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                      }}
                    >
                      {s === 'off' ? t.agent.scheduleOff : s === '15m' ? t.agent.schedule15m : s === '30m' ? t.agent.schedule30m : s === '1h' ? t.agent.schedule1h : t.agent.schedule2h}
                    </Button>
                  ))}
                </div>
                {pipelineSchedule !== 'off' && (
                  <div style={{ fontSize: 10, color: '#52c41a', marginTop: 6, fontWeight: 600 }}>
                    <SyncOutlined spin={pipelineRunning} style={{ marginRight: 4 }} />
                    {pipelineRunning ? t.agent.scheduleRunningWait : `${t.agent.scheduleEvery}${pipelineSchedule === '15m' ? t.agent.schedule15m : pipelineSchedule === '30m' ? t.agent.schedule30m : pipelineSchedule === '1h' ? t.agent.schedule1h : t.agent.schedule2h}`}
                  </div>
                )}
              </Col>
              <Col span={7}>
                <div style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>{t.agent.status}</div>

                {/* Pipeline mode section — label matches current mode */}
                <div style={{ fontSize: 12, lineHeight: '20px' }}>
                  <div style={{ fontSize: 10, color: '#8c8c8c', fontWeight: 600, marginBottom: 2 }}>
                    {pipelineMode === 'ai' ? 'AI' : pipelineMode === 'hybrid' ? 'Hybrid' : 'Manual'}
                  </div>
                  {lastPipelineRun ? (
                    <div style={{ color: '#595959' }}>
                      <ClockCircleOutlined style={{ marginRight: 6, opacity: 0.6 }} />
                      {t.agent.lastRunLabel}<Text strong>{new Date(lastPipelineRun).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                      {pipelineRunning ? (
                        <Tag icon={<SyncOutlined spin />} color="processing" bordered={false} style={{ fontSize: 9, marginLeft: 6 }}>{t.agent.statusRunning}</Tag>
                      ) : (() => {
                        const result = scannerStateStore.getPipelineSchedule().lastRunResult;
                        if (result === 'success') return <Tag color="green" bordered={false} style={{ fontSize: 9, marginLeft: 6 }}>{t.agent.statusOK}</Tag>;
                        if (result === 'failed') return <Tag color="red" bordered={false} style={{ fontSize: 9, marginLeft: 6 }}>{t.agent.statusFailed}</Tag>;
                        if (result === 'stopped') return <Tag color="orange" bordered={false} style={{ fontSize: 9, marginLeft: 6 }}>{t.agent.statusStopped}</Tag>;
                        return null;
                      })()}
                    </div>
                  ) : <div style={{ color: '#bfbfbf', fontStyle: 'italic' }}>{t.agent.noData}</div>}
                </div>

                {/* Auto section */}
                {pipelineAutoStatus && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #e8e8e8', fontSize: 11, lineHeight: '18px' }}>
                    <div style={{ fontSize: 10, color: '#8c8c8c', fontWeight: 600, marginBottom: 4 }}>Auto</div>

                    {pipelineAutoStatus.autoStatus === 'Off' ? (
                      <Tag color="default" bordered={false} style={{ fontSize: 9, fontWeight: 600, margin: 0, lineHeight: '16px', borderRadius: 4 }}>Off</Tag>
                    ) : (
                      <>
                        {/* Tags row: autoStatus + reason + source */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 2 }}>
                          <Tag color={pipelineAutoStatus.autoStatus === 'Armed' ? 'green' : pipelineAutoStatus.autoStatus === 'Running' ? 'processing' : 'orange'}
                            bordered={false} style={{ fontSize: 9, fontWeight: 600, margin: 0, lineHeight: '16px', borderRadius: 4 }}>
                            {pipelineAutoStatus.autoStatus}
                          </Tag>
                          {!pipelineAutoStatus.marketOpen && (
                            <>
                              {pipelineAutoStatus.marketStatusRaw === 'holiday' && (
                                <Tag color="red" bordered={false} style={{ fontSize: 9, fontWeight: 600, margin: 0, lineHeight: '16px', borderRadius: 4 }}>Holiday Closed</Tag>
                              )}
                              {pipelineAutoStatus.marketStatusSource === 'fallback_basic_hours' && (
                                <Tag color="default" bordered={false} style={{ fontSize: 9, fontWeight: 600, margin: 0, lineHeight: '16px', borderRadius: 4 }}>Fallback</Tag>
                              )}
                            </>
                          )}
                        </div>

                        {/* Running state */}
                        {pipelineAutoStatus.autoStatus === 'Running' && (
                          <div style={{ color: '#722ed1', marginTop: 1 }}>
                            <SyncOutlined spin style={{ marginRight: 4 }} />Running AI Pipeline...
                          </div>
                        )}

                        {/* Run count today */}
                        <div style={{ color: '#595959', marginTop: 1, fontSize: 10 }}>
                          Run count today: <Text strong>{pipelineAutoStatus.runCountToday || 0}</Text>
                        </div>

                        {/* Next auto run: always show when enabled */}
                        {(() => {
                          const fmtTime = (iso: string) => {
                            try {
                              const d = new Date(iso);
                              if (!isNaN(d.getTime())) {
                                return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                              }
                            } catch (_) { /* ignore */ }
                            return '';
                          };
                          const computeNext = (baseIso: string | null, intervalMin: number) => {
                            if (!baseIso || !intervalMin) return '';
                            try {
                              const dt = new Date(baseIso);
                              if (!isNaN(dt.getTime())) {
                                const next = new Date(dt.getTime() + intervalMin * 60000);
                                return next.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                              }
                            } catch (_) { /* ignore */ }
                            return '';
                          };

                          // Priority 1: frontend lastPipelineRun + intervalMinutes
                          let displayValue = computeNext(lastPipelineRun, pipelineAutoStatus.intervalMinutes);

                          // Priority 2: backend lastRunStartedAt + intervalMinutes
                          if (!displayValue) {
                            displayValue = computeNext(
                              pipelineAutoStatus.lastRunStartedAt || pipelineAutoStatus.lastRunAt,
                              pipelineAutoStatus.intervalMinutes
                            );
                          }

                          // Priority 3: backend nextAutoRunDisplay or nextAutoRunAt
                          if (!displayValue) {
                            displayValue = pipelineAutoStatus.nextAutoRunDisplay
                              || fmtTime(pipelineAutoStatus.nextAutoRunAt)
                              || '';
                          }

                          // Priority 4: scheduler says run now
                          if (!displayValue && pipelineAutoStatus.nextRunAt === 'now') {
                            displayValue = 'Ready';
                          }

                          // Show dash only when stopped and no computed value
                          if (!displayValue && pipelineAutoStatus.stoppedForToday) {
                            return (
                              <div style={{ color: '#8c8c8c', fontSize: 10 }}>
                                Next auto run: <Text strong>—</Text>
                              </div>
                            );
                          }

                          // Have display → show it
                          if (displayValue) {
                            return (
                              <div style={{ color: displayValue === 'Ready' ? '#1890ff' : '#595959', fontSize: 10 }}>
                                Next auto run: <Text strong style={{ color: displayValue === 'Ready' ? '#1890ff' : undefined }}>
                                  {displayValue}
                                </Text>
                              </div>
                            );
                          }

                          // Enabled but no data yet → show Ready
                          if (pipelineAutoStatus.enabled) {
                            return (
                              <div style={{ color: '#1890ff', fontSize: 10 }}>
                                Next auto run: <Text strong style={{ color: '#1890ff' }}>Ready</Text>
                              </div>
                            );
                          }

                          return null;
                        })()}

                        {/* Scheduler */}
                        <div style={{ color: '#595959', marginTop: 1 }}>
                          Scheduler: <span style={{ fontWeight: 600, color: pipelineAutoStatus.schedulerRunning ? '#52c41a' : '#ff4d4f' }}>
                            {pipelineAutoStatus.schedulerRunning ? 'Running' : 'Offline'}
                          </span>
                        </div>

                        {/* Background capability note */}
                        {pipelineAutoStatus.schedulerRunning && pipelineAutoStatus.enabled && (
                          <div style={{ color: '#8c8c8c', fontSize: 9, marginTop: 2, lineHeight: 1.4 }}>
                            Background: Limited
                            <Tooltip title="Backend scheduler runs a limited market scanner. Full 6-stage pipeline (Continue Scan, Fine Scan, Deeper Validation, Entry Plan, Exit Scan) requires this page to stay open.">
                              <InfoCircleOutlined style={{ marginLeft: 4, fontSize: 10, color: '#bfbfbf' }} />
                            </Tooltip>
                          </div>
                        )}

                      </>
                    )}
                  </div>
                )}
              </Col>
            </Row>

            {/* Market Auto Run Section — compact */}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #e8e8e8' }}>
              <Row gutter={[12, 6]} align="middle">
                {/* Left: title + toggle + description */}
                <Col flex="300px">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#262626', whiteSpace: 'nowrap' }}>Market Auto Run</span>
                    <Switch
                      size="small"
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
                    <Tag
                      color={pipelineSchedule !== 'off' ? 'green' : 'default'}
                      bordered={false}
                      style={{ fontSize: 9, fontWeight: 700, margin: 0, borderRadius: 4 }}
                    >
                      {pipelineSchedule !== 'off' ? 'On' : 'Off'}
                    </Tag>
                  </div>
                  <div style={{ fontSize: 10, color: '#8c8c8c', marginTop: 1, lineHeight: '14px' }}>
                    Runs AI Pipeline automatically during US market hours only.
                  </div>
                </Col>

                {/* Right: compact status (only when enabled) */}
                <Col flex="auto">
                  {pipelineSchedule === 'off' ? (
                    <span style={{ fontSize: 10, color: '#8c8c8c', fontStyle: 'italic' }}>Auto market pipeline off</span>
                  ) : pipelineAutoStatus && pipelineAutoStatus.autoStatus === 'Off' ? (
                    <span style={{ fontSize: 10, color: '#8c8c8c', fontStyle: 'italic' }}>Auto market pipeline off</span>
                  ) : pipelineAutoStatus && !pipelineAutoStatus.marketOpen ? (
                    /* Holiday / Weekend / Closed — compact pill, no progress bar */
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Tag
                        color={pipelineAutoStatus.marketStatusRaw === 'holiday' ? 'red' : 'orange'}
                        bordered={false}
                        style={{ fontSize: 10, fontWeight: 700, margin: 0, borderRadius: 4, lineHeight: '20px' }}
                      >
                        {pipelineAutoStatus.marketStatusRaw === 'holiday'
                          ? 'HOLIDAY — NO AUTO RUN'
                          : pipelineAutoStatus.marketStatusRaw === 'closed' ? 'MARKET CLOSED — WAITING' : 'CLOSED'}
                      </Tag>
                      {pipelineAutoStatus.progress?.label && (
                        <span style={{ fontSize: 10, color: '#8c8c8c' }}>{pipelineAutoStatus.progress.label}</span>
                      )}
                    </div>
                  ) : pipelineAutoStatus && pipelineAutoStatus.autoStatus === 'Armed' ? (
                    /* Armed — no progress bar here; status shown in scheduler area above */
                    null
                  ) : pipelineAutoStatus && pipelineAutoStatus.autoStatus === 'Running' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <SyncOutlined spin style={{ color: '#722ed1' }} />
                      <span style={{ fontSize: 11, color: '#722ed1', fontWeight: 600 }}>Running AI Pipeline...</span>
                    </div>
                  ) : pipelineAutoStatus && pipelineAutoStatus.autoStatus === 'Error' ? (
                    <Alert
                      type="error"
                      showIcon
                      message={pipelineAutoStatus.lastError || 'Auto pipeline error'}
                      style={{ borderRadius: 6, fontSize: 10, padding: '2px 8px' }}
                    />
                  ) : null}
                </Col>
              </Row>
            </div>

            {/* Next 15 Days Market Schedule — expandable */}
            {pipelineSchedule !== 'off' && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #e8e8e8' }}>
                <div
                  onClick={() => setPipelineAutoScheduleExpanded(!pipelineAutoScheduleExpanded)}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#8c8c8c', userSelect: 'none' }}
                >
                  <span style={{ fontSize: 10 }}>{pipelineAutoScheduleExpanded ? '▼' : '▶'}</span>
                  <span style={{ fontWeight: 600 }}>Next 15 Days Market Schedule</span>
                  {pipelineAutoScheduleLoading && <Spin size="small" style={{ marginLeft: 4 }} />}
                </div>
                {pipelineAutoScheduleExpanded && (
                  <div style={{ marginTop: 8, maxHeight: 320, overflowY: 'auto' }}>
                    {pipelineAutoScheduleError ? (
                      <div style={{ fontSize: 10, color: '#ff4d4f', padding: '8px 8px' }}>
                        {pipelineAutoScheduleError}
                      </div>
                    ) : pipelineAutoSchedule && pipelineAutoSchedule.length > 0 ? (
                      <>
                        {pipelineAutoSchedule.map((day: any, i: number) => {
                          const statusColor = day.status === 'open' ? '#52c41a' :
                                              day.status === 'early_close' ? '#faad14' :
                                              day.status === 'holiday' ? '#ff4d4f' :
                                              day.status === 'weekend' ? '#8c8c8c' : '#8c8c8c';
                          const bgColor = i % 2 === 0 ? '#fafafa' : 'transparent';
                          const autoRunText = day.autoRun ? 'Will run' : 'Will not run';
                          const autoRunColor = day.autoRun ? '#52c41a' : '#8c8c8c';
                          const hours = day.openTime && day.closeTime ? `${day.openTime}–${day.closeTime}` : '—';
                          return (
                            <div key={day.date} style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              padding: '5px 8px', fontSize: 10, lineHeight: '16px',
                              background: bgColor, borderRadius: 4, marginBottom: 2
                            }}>
                              <span style={{ minWidth: 80, fontWeight: 600, color: '#262626' }}>
                                {day.weekday?.slice(0, 3)} {day.date?.slice(5)}
                              </span>
                              <Tag bordered={false} style={{ fontSize: 9, margin: 0, lineHeight: '16px', borderRadius: 3, minWidth: 48, textAlign: 'center', background: statusColor + '18', color: statusColor, fontWeight: 700 }}>
                                {day.status === 'early_close' ? 'Early Cls' : day.status === 'open' ? 'Open' : day.status === 'holiday' ? 'Holiday' : day.status === 'weekend' ? 'Weekend' : day.status || '—'}
                              </Tag>
                              <span style={{ color: '#595959', minWidth: 58, fontSize: 9 }}>{hours}</span>
                              <span style={{ color: autoRunColor, fontWeight: 600, minWidth: 50, fontSize: 9 }}>{autoRunText}</span>
                              <span style={{ color: '#8c8c8c', fontSize: 8, minWidth: 40 }}>
                                {day.source === 'alpaca_calendar' ? 'Alpaca' : day.source === 'fallback_basic_hours' ? 'Fallbk' : ''}
                              </span>
                              {day.reason && (
                                <span style={{ color: '#8c8c8c', fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                  {day.reason}
                                </span>
                              )}
                            </div>
                          );
                        })}
                        <div style={{ fontSize: 9, color: '#8c8c8c', marginTop: 4, paddingLeft: 8 }}>
                          Source: {pipelineAutoScheduleSource === 'alpaca_calendar' ? 'Alpaca Calendar' : 'Fallback basic hours'} / {pipelineAutoScheduleWarning && <span style={{ color: '#faad14' }}>{pipelineAutoScheduleWarning}</span>}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 10, color: '#8c8c8c', fontStyle: 'italic', padding: '8px 8px' }}>
                        {pipelineAutoScheduleLoading ? 'Loading...' : 'No schedule data available.'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Auto Run History — expandable */}
            {pipelineAutoStatus && pipelineSchedule !== 'off' && pipelineAutoHistory.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #e8e8e8' }}>
                <div
                  onClick={() => setPipelineAutoHistoryExpanded(!pipelineAutoHistoryExpanded)}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#8c8c8c', userSelect: 'none' }}
                >
                  <span style={{ fontSize: 10 }}>{pipelineAutoHistoryExpanded ? '▼' : '▶'}</span>
                  <span style={{ fontWeight: 600 }}>Recent Auto Runs</span>
                  <Tag bordered={false} style={{ fontSize: 9, margin: 0, lineHeight: '16px', borderRadius: 4, background: '#f0f2f5', color: '#595959' }}>
                    {pipelineAutoHistory.length}
                  </Tag>
                </div>
                {pipelineAutoHistoryExpanded && (
                  <div style={{ marginTop: 8 }}>
                    {pipelineAutoHistory.map((entry: any, i: number) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '4px 8px', fontSize: 10, lineHeight: '18px',
                        background: i % 2 === 0 ? '#fafafa' : 'transparent',
                        borderRadius: 4, marginBottom: 2
                      }}>
                        <Tag bordered={false} style={{ fontSize: 9, margin: 0, lineHeight: '16px', borderRadius: 3, minWidth: 36, textAlign: 'center' }}
                          color={entry.status === 'success' ? 'green' : entry.status === 'failed' ? 'red' : entry.status === 'blocked' ? 'orange' : entry.status === 'skipped' ? 'default' : 'orange'}>
                          {entry.status || '—'}
                        </Tag>
                        <span style={{ color: '#595959', minWidth: 50 }}>{entry.trigger_type || '—'}</span>
                        <span style={{ color: '#8c8c8c' }}>
                          {entry.started_at ? new Date(entry.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </span>
                        <span style={{ color: '#8c8c8c' }}>
                          {entry.duration_seconds ? `${entry.duration_seconds}s` : '—'}
                        </span>
                        <span style={{ color: '#595959', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entry.reason || entry.error || ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {pipelineStage !== 'idle' && (
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px dashed #e8e8e8' }}>
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

      {/* 1.58 Current Holdings */}
      <div style={{ marginBottom: 24 }}>
        <Card
          className="premium-card"
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  width: 38, height: 38, borderRadius: 10, 
                  background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)', 
                  color: '#fff', display: 'flex', alignItems: 'center', 
                  justifyContent: 'center', fontSize: 20,
                  boxShadow: '0 4px 10px rgba(82, 196, 26, 0.2)'
                }}>
                  <WalletOutlined />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', lineHeight: 1.2 }}>{t.agent.positions}</div>
                  <div style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 500 }}>{t.agent.accountOverview}</div>
                </div>
                <Tag color="green" bordered={false} style={{ fontSize: 11, fontWeight: 800, borderRadius: 6, marginLeft: 4, height: 20, lineHeight: '20px' }}>{holdings.length}</Tag>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Tag color={tradeMode === 'paper' ? 'blue' : 'error'} bordered={false} style={{ fontSize: 10, fontWeight: 700, borderRadius: 4 }}>
                  {tradeMode?.toUpperCase()} TRADING
                </Tag>
                <Divider type="vertical" style={{ height: 24 }} />
                <Button 
                  size="middle" 
                  icon={<ReloadOutlined spin={holdingsLoading} />} 
                  onClick={() => fetchHoldings()} 
                  style={{ borderRadius: 8, height: 34, fontSize: 12, fontWeight: 600, color: '#6b7280', border: '1px solid #e5e7eb' }}
                >
                  {t.agent.refresh}
                </Button>
              </div>
            </div>
          }
        >
          {holdingsError && (
            <Alert type="error" showIcon message={holdingsError} style={{ marginBottom: 16, borderRadius: 10 }} closable onClose={() => setHoldingsError(null)} />
          )}
          
          {holdingsLoading && holdings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}><Spin size="large" /> <div style={{ marginTop: 12 }}>{t.agent.loading}</div></div>
          ) : holdings.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div style={{ padding: '30px 0' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#4b5563' }}>{t.agent.noOpenPositions}</div>
                  <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>{t.agent.noData}</div>
                </div>
              }
            />
          ) : (
            <div className="holdings-table-container">
              <style>{`
                .holdings-table .ant-table-thead > tr > th { background: #f9fafb !important; padding: 12px 8px !important; }
                .holdings-row:hover > td { background-color: #f6ffed !important; }
                .holdings-row-expanded > td { background-color: #f8f9fb !important; }
              `}</style>
              <Table
                className="holdings-table"
                dataSource={holdings}
                rowKey="symbol"
                size="middle"
                pagination={holdings.length > 10 ? { pageSize: 10, size: 'small' } : false}
                scroll={{ x: 900 }}
                style={{ fontSize: 12 }}
                rowClassName={(record) => record.id === expandedRows[0] ? 'holdings-row holdings-row-expanded' : 'holdings-row'}
                expandable={{
                  expandedRowRender: (h: any) => (
                    <div style={{ padding: '20px', background: '#f8f9fb', borderRadius: 16, margin: '8px 0', border: '1px solid #f0f0f0' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1890ff', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16 }}>{t.agent.colPosition} {t.agent.details}</div>
                      <Row gutter={[24, 16]}>
                        {[
                          { label: t.agent.symbol, value: <span style={{ fontWeight: 800 }}>{h.symbol}</span> },
                          { label: t.agent.side, value: <Tag color={h.side === 'short' ? 'red' : 'green'} style={{ margin: 0 }}>{h.side?.toUpperCase() || t.agent.longSide}</Tag> },
                          { label: t.agent.qty, value: h.qty },
                          { label: 'Asset Class', value: h.assetClass || 'us_equity' },
                          { label: t.agent.avgEntry, value: `$${(h.avgEntryPrice || 0).toFixed(2)}` },
                          { label: t.agent.currentPrice, value: `$${(h.currentPrice || 0).toFixed(2)}` },
                          { label: t.agent.marketValue, value: `$${(h.marketValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
                          { label: 'Cost Basis', value: `$${(h.costBasis || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
                          { label: t.agent.plDollar, value: <span style={{ color: (h.unrealizedPL || 0) >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>${(h.unrealizedPL || 0).toFixed(2)}</span> },
                          { label: t.agent.plPercent, value: <span style={{ color: (h.unrealizedPLPercent || 0) >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>{((h.unrealizedPLPercent || 0) * 100).toFixed(2)}%</span> },
                          { label: 'Exchange', value: h.exchange || 'N/A' },
                        ].map((item, idx) => (
                          <Col span={6} key={idx}>
                            <div style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{item.label}</div>
                            <div style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>{item.value}</div>
                          </Col>
                        ))}
                      </Row>
                    </div>
                  ),
                }}
                columns={[
                  { 
                    title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.symbol}</span>,
                    dataIndex: 'symbol', key: 'symbol', width: 80, fixed: 'left' as const,
                    render: (t: string) => <span style={{ fontWeight: 800, fontSize: 15, color: '#111827', letterSpacing: '-0.2px' }}>{t}</span>
                  },
                  {
                    title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.qty}</span>,
                    dataIndex: 'qty', key: 'qty', width: 60,
                    render: (v: number) => <span style={{ fontSize: 13, fontWeight: 700 }}>{v}</span>
                  },
                  {
                    title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.avgEntry}</span>,
                    dataIndex: 'avgEntryPrice', key: 'avgEntry', width: 90,
                    render: (v: number) => <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>${(v || 0).toFixed(2)}</span>
                  },
                  {
                    title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colCurrent}</span>,
                    dataIndex: 'currentPrice', key: 'current', width: 90,
                    render: (v: number) => <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>${(v || 0).toFixed(2)}</span>
                  },
                  {
                    title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.marketValue}</span>,
                    dataIndex: 'marketValue', key: 'mktVal', width: 100,
                    render: (v: number) => <span style={{ fontSize: 12, color: '#374151', fontWeight: 700 }}>${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  },
                  {
                    title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.plDollar}</span>,
                    dataIndex: 'unrealizedPL', key: 'pl', width: 110,
                    render: (v: number) => <span style={{ color: (v || 0) >= 0 ? '#10b981' : '#ef4444', fontWeight: 800, fontSize: 15, fontFamily: 'Inter, -apple-system, sans-serif' }}>{(v || 0) >= 0 ? '+' : ''}${(v || 0).toFixed(2)}</span>
                  },
                  {
                    title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.plPercent}</span>,
                    dataIndex: 'unrealizedPLPercent', key: 'plpct', width: 100,
                    render: (v: number) => <span style={{ color: (v || 0) >= 0 ? '#10b981' : '#ef4444', fontWeight: 800, fontSize: 14, fontFamily: 'Inter, -apple-system, sans-serif' }}>{(v || 0) >= 0 ? '+' : ''}{((v || 0) * 100).toFixed(2)}%</span>
                  },
                  {
                    title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.sell}</span>,
                    key: 'sell',
                    width: 180,
                    fixed: 'right' as const,
                    render: (_: any, record: any) => {
                      const sellOrder = openSellOrders.find(o => o.symbol === record.symbol);
                      if (sellOrder) {
                        const orderType = (sellOrder.type || 'market').toUpperCase();
                        const priceStr = sellOrder.limit_price ? ` $${Number(sellOrder.limit_price).toFixed(2)}` : sellOrder.stop_price ? ` $${Number(sellOrder.stop_price).toFixed(2)}` : '';
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Tag color="orange" style={{ fontSize: 10, fontWeight: 700, borderRadius: 4, margin: 0 }}>
                              {orderType}{priceStr}
                            </Tag>
                            <Button
                              size="small"
                              danger
                              loading={cancelingOrderId === sellOrder.id}
                              style={{ borderRadius: 6, fontSize: 11, fontWeight: 700, height: 26, padding: '0 8px' }}
                              onClick={() => handleCancelSellOrder(sellOrder.id, record.symbol)}
                            >
                              Cancel
                            </Button>
                          </div>
                        );
                      }
                      return (
                        <Button
                          size="middle"
                          danger
                          style={{ borderRadius: 8, height: 32, fontSize: 12, fontWeight: 700, width: '100%' }}
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

      {/* 1.7 AI Execution Candidates */}
      <div style={{ marginBottom: 24 }}>
        <Card
          className="premium-card"
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  width: 38, height: 38, borderRadius: 10, 
                  background: 'linear-gradient(135deg, #faad14 0%, #d48806 100%)', 
                  color: '#fff', display: 'flex', alignItems: 'center', 
                  justifyContent: 'center', fontSize: 20,
                  boxShadow: '0 4px 10px rgba(250, 173, 20, 0.2)'
                }}>
                  <FundOutlined />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', lineHeight: 1.2 }}>{t.agent.executionCandidates}</div>
                  <div style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 500 }}>{t.agent.aiExecution}</div>
                </div>
                <Tag color="gold" bordered={false} style={{ fontSize: 11, fontWeight: 800, borderRadius: 6, marginLeft: 4, height: 20, lineHeight: '20px' }}>
                  {aiExecutionList.length}
                </Tag>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Tag color={tradeMode === 'paper' ? 'blue' : 'error'} bordered={false} style={{ fontSize: 10, fontWeight: 700, borderRadius: 4 }}>
                  {tradeMode?.toUpperCase()} TRADING
                </Tag>
                <Divider type="vertical" style={{ height: 24 }} />
                {aiExecutionList.length > 0 && (
                  <Button 
                    size="middle" 
                    danger 
                    icon={<DeleteOutlined />} 
                    onClick={() => {
                      Modal.confirm({
                        title: t.agent.clearWatchlist,
                        content: t.agent.clearWatchlistConfirm,
                        onOk: () => { setAiExecutionList([]); scannerStateStore.clearAiExecutionCandidates(); }
                      });
                    }} 
                    style={{ borderRadius: 8, height: 34, fontWeight: 600 }}
                  >
                    {t.agent.clearWatchlist}
                  </Button>
                )}
              </div>
            </div>
          }
        >
          <Alert
            type={pipelineMode === 'ai' ? 'info' : 'warning'}
            showIcon
            message={
              <div style={{ fontSize: 13, fontWeight: 500 }}>
                {pipelineMode === 'ai'
                  ? (tradeMode === 'paper' ? t.agent.aiModePaperDesc : t.agent.aiModeLiveDesc)
                  : pipelineMode === 'hybrid'
                    ? t.agent.hybridModeDesc
                    : t.agent.manualModeDesc}
              </div>
            }
            style={{ marginBottom: 16, borderRadius: 10 }}
          />

          {aiExecutionList.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div style={{ padding: '30px 0' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#4b5563' }}>{t.agent.noExecutionCandidates}</div>
                  <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>{t.agent.noData}</div>
                </div>
              }
            />
          ) : (
            <div className="execution-table-container" style={{ width: '100%', overflowX: 'auto', paddingBottom: '12px' }}>
              <style>{`
                .execution-table .ant-table-thead > tr > th { 
                  background: #f8fafc !important; 
                  padding: 16px 12px !important; 
                  font-size: 10.5px !important; 
                  text-transform: uppercase !important; 
                  letter-spacing: 0.8px !important; 
                  color: #94a3b8 !important; 
                  font-weight: 800 !important; 
                  border-bottom: 1px solid rgba(15, 23, 42, 0.06) !important;
                }
                .execution-table .ant-table-tbody > tr > td { padding: 12px !important; height: 68px; border-bottom: 1px solid rgba(15, 23, 42, 0.04) !important; }
                .execution-row:hover > td { background-color: #fffdf0 !important; }
                .execution-row-expanded > td { background-color: #f8fafc !important; }
                .ant-table-fixed-right { background: #fff !important; }
              `}</style>
              <Table
                className="execution-table"
                dataSource={aiExecutionList}
                rowKey={(r: any) => r.symbol + (r.addedAt || '')}
                size="small"
                pagination={false}
                scroll={{ x: 1600 }}
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
                  title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colSymbol}</span>,
                  dataIndex: 'symbol',
                  key: 'symbol',
                  width: 90,
                  fixed: 'left' as const,
                  render: (text: string) => (
                    <span style={{ fontWeight: 800, fontSize: 15, color: '#111827', letterSpacing: '-0.2px' }}>{text}</span>
                  ),
                },
                {
                  title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.setup}</span>,
                  key: 'setup',
                  width: 120,
                  render: (r: any) => {
                    const s = r.setup || r.setupType || 'N/A';
                    const color = s.includes('Pullback') ? 'gold' : s.includes('Breakout') ? 'purple' : s.includes('Range') ? 'green' : 'blue';
                    return <Tag color={color} style={{ fontSize: 9, fontWeight: 700, borderRadius: 4 }}>{s.toUpperCase()}</Tag>;
                  },
                },
                {
                  title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.entryZone}</span>,
                  key: 'entryZone',
                  width: 140,
                  render: (r: any) => {
                    const lo = r.entryZoneLow;
                    const hi = r.entryZoneHigh;
                    if (!lo && !hi) return <span style={{ color: '#d1d5db' }}>—</span>;
                    return <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>${(lo || 0).toFixed(2)} – ${(hi || 0).toFixed(2)}</span>;
                  },
                },
                {
                  title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colStop} / {t.agent.colTargets}</span>,
                  key: 'levels',
                  width: 130,
                  render: (r: any) => (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ color: '#ef4444', fontSize: 11, fontWeight: 700 }}>S: ${(r.stopLoss || 0).toFixed(2)}</span>
                      <span style={{ color: '#10b981', fontSize: 11, fontWeight: 700 }}>T: ${(r.takeProfit1 || 0).toFixed(2)}</span>
                    </div>
                  )
                },
                {
                  title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.riskReward}</span>,
                  dataIndex: 'riskReward1',
                  key: 'riskReward1',
                  width: 65,
                  render: (v: number | null) => v ? <span style={{ fontWeight: 700, color: v >= 2 ? '#10b981' : '#6b7280', fontSize: 12 }}>{v.toFixed(1)}x</span> : <span style={{ color: '#d1d5db' }}>—</span>,
                },
                {
                  title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colAIDecision} / {t.agent.colGate}</span>,
                  key: 'aiGate',
                  width: 140,
                  render: (r: any) => {
                    const d = r.aiDecision || 'WATCH';
                    const s = (r.riskGate || r.hardRiskGate || {}).status || r.riskGateStatus || 'N/A';
                    const dCol = d === 'BUY' ? 'green' : d === 'WATCH' ? 'gold' : 'red';
                    const sCol = s === 'PASS' ? 'green' : s === 'REVIEW' ? 'gold' : 'red';
                    return (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Tag color={dCol} bordered={false} style={{ fontSize: 9, margin: 0, fontWeight: 800, borderRadius: 4, width: 45, textAlign: 'center' }}>{translateStatus(d)}</Tag>
                        <Tag color={sCol} bordered={false} style={{ fontSize: 9, margin: 0, fontWeight: 800, borderRadius: 4, width: 60, textAlign: 'center' }}>{t.agent.riskGate}:{translateStatus(s)}</Tag>
                      </div>
                    );
                  },
                },
                {
                  title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.recommendation}</span>,
                  key: 'recommendedShares',
                  width: 70,
                  render: (r: any) => {
                    const rec = r.positionSizeShares || r.entryPlan?.positionSizeShares || 0;
                    return rec > 0
                      ? <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: '#2563eb' }}>{rec}</span>
                          <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600 }}>SHARES</span>
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
                            <Option value="shares">Shares</Option>
                            <Option value="dollars">Dollars</Option>
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
                              placeholder="e.g. 0.5"
                            />
                          )}
                        </div>
                      );
                    }
                    if (r.qtyMode === 'dollars') return <span style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>${(r.dollarAmount || 0).toLocaleString()}</span>;
                    return <span style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>{r.userQty || r.positionSizeShares || '—'}</span>;
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
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>{typeLabels[r.orderType]?.toUpperCase() || r.orderType?.toUpperCase() || 'MKT'}</span>
                        <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>{r.timeInForce?.toUpperCase() || 'DAY'}</span>
                      </div>
                    );
                  },
                },
                {
                  title: <span style={{ fontWeight: 700, color: '#1890ff', fontSize: 10, textTransform: 'uppercase' }}>Price</span>,
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
                      return <Tag bordered={false} style={{ fontSize: 13, fontWeight: 800, color: '#374151', background: '#f3f4f6', borderRadius: 6 }}>MKT</Tag>;
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
                    return <span style={{ fontSize: 14, fontWeight: 800, color: '#111827', fontFamily: 'Inter, -apple-system, sans-serif' }}>{parts.join(' / ') || '—'}</span>;
                  },
                },
                {
                  title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.orderStatus}</span>,
                  key: 'executionStatus',
                  width: 110,
                  render: (r: any) => {
                    const status = r.executionStatus || 'draft';
                    const statusMap: Record<string, { color: string; label: string }> = {
                      draft: { color: 'orange', label: t.agent.draft },
                      pending: { color: 'processing', label: t.agent.pending },
                      submitted: { color: 'success', label: t.agent.submitted },
                      filled: { color: 'green', label: t.agent.filled },
                      failed: { color: 'error', label: t.agent.failed },
                      canceled: { color: 'default', label: t.agent.canceled },
                    };
                    const s = statusMap[status] || statusMap.draft;
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <Tag color={s.color} bordered={false} style={{ fontSize: 9, margin: 0, padding: '0 8px', fontWeight: 800, borderRadius: 4, width: 'fit-content' }}>{s.label}</Tag>
                        {r.executionError && <div style={{ fontSize: 9, color: '#ff4d4f', marginTop: 4, maxWidth: 100, fontWeight: 500 }} title={r.executionError}>{r.executionError}</div>}
                        {r.alpacaOrderId && <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2, fontFamily: 'monospace' }}>{r.alpacaOrderId.slice(0, 10)}</div>}
                      </div>
                    );
                  },
                },
                {
                  title: '',
                  key: 'action',
                  width: 140,
                  fixed: 'right' as const,
                  render: (r: any) => {
                    const autoMode = getAutomationMode();
                    const isExecuting = executingSymbol === r.symbol;
                    const status = r.executionStatus || 'draft';
                    const handleRemove = () => {
                      setAiExecutionList(prev => prev.filter(e => e.symbol !== r.symbol));
                      scannerStateStore.removeAiExecutionCandidate(r.symbol);
                    };

                    // Active order — show Cancel + note
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
                              setAiExecutionList(prev => prev.map(item =>
                                item.symbol === r.symbol ? { ...item, executionStatus: 'draft', executionError: undefined } : item
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
                          Remove
                        </Button>
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
                          danger={tradeMode === 'real'}
                          size="small"
                          loading={isExecuting}
                          style={{
                            borderRadius: 6, height: 28, fontSize: 11, fontWeight: 700, width: '100%',
                            background: tradeMode === 'paper' ? '#1890ff' : '#fff',
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
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', fontSize: 12, color: '#595959' }}
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
                  { title: t.agent.mode, dataIndex: 'mode', key: 'mode', width: 60, render: (v: string) => <Tag color={v === 'paper' ? 'blue' : 'red'} style={{ fontSize: 9, margin: 0, padding: '0 4px' }}>{v?.toUpperCase()}</Tag> },
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
        title={tradeMode === 'real' ? t.agent.confirmRealOrder : t.agent.confirmPaperOrder}
        open={orderConfirmVisible}
        onCancel={() => { setOrderConfirmVisible(false); setOrderConfirmTarget(null); setOrderConfirmText(''); }}
        footer={null}
        width={520}
      >
        {orderConfirmTarget && (() => {
          const r = orderConfirmTarget.record;
          const ep = entryPlanResultsBySymbol[r.symbol] || normalizeWatchlistToEntryPlan(r);
          const isReal = tradeMode === 'real';
          const recShares = r.positionSizeShares || ep.positionSizeShares || 0;
          const entryPrice = modalLimitPrice || modalStopPrice || ep.entryZoneHigh || ep.entryZoneLow || 0;

          // Estimated cost from modal state
          const estShares = modalQtyMode === 'dollars' ? 0 : (modalUserQty || recShares || 1);
          const estCost = modalQtyMode === 'dollars' ? (modalDollarAmount || 0) : (estShares * entryPrice);

          const labelStyle: React.CSSProperties = { color: '#595959', fontSize: 12, marginBottom: 2 };
          const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 };
          const RO = ({ label, value, color }: { label: string; value: any; color?: string }) => (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12 }}>
              <span style={{ color: '#8c8c8c' }}>{label}</span>
              <span style={{ fontWeight: 600, color: color || '#262626' }}>{safeRender(value)}</span>
            </div>
          );

          return (
            <div>
              {/* Read-only info */}
              <div style={{ background: '#f6ffed', borderRadius: 8, padding: '8px 12px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 16 }}>{r.symbol}</span>
                <Space size={8}>
                  <Tag color="blue" style={{ margin: 0 }}>BUY</Tag>
                  <Tag color={isReal ? 'red' : 'blue'} style={{ margin: 0 }}>{isReal ? 'LIVE' : 'PAPER'}</Tag>
                </Space>
              </div>

              {recShares > 0 && (
                <div style={{ background: '#e6f7ff', borderRadius: 6, padding: '4px 10px', marginBottom: 12, fontSize: 11, color: '#1890ff' }}>
                  {t.agent.entryPlanRecommends} <strong>{recShares} {t.agent.shares}</strong>
                </div>
              )}

              {/* Editable order params */}
              <div style={{ background: '#fafafa', borderRadius: 8, padding: 16, marginBottom: 12 }}>
                {/* Choose how to buy: Shares / Dollars */}
                <div style={rowStyle}>
                  <span style={labelStyle}>{t.agent.buyBy}</span>
                  <select
                    value={modalQtyMode}
                    onChange={e => setModalQtyMode(e.target.value as 'shares' | 'dollars')}
                    style={{ fontSize: 12, height: 28, border: '1px solid #d9d9d9', borderRadius: 4, padding: '0 8px', background: '#fff', width: 150 }}
                  >
                    <option value="shares">{t.agent.shares}</option>
                    <option value="dollars">{t.agent.dollarAmount}</option>
                  </select>
                </div>

                {/* Quantity / Dollar Amount */}
                <div style={rowStyle}>
                  <span style={labelStyle}>{modalQtyMode === 'dollars' ? t.agent.dollarAmount : t.agent.shares}</span>
                  <Input
                    type="number"
                    prefix={modalQtyMode === 'dollars' ? '$' : undefined}
                    suffix={modalQtyMode === 'shares' ? 'shares' : undefined}
                    value={modalQtyMode === 'dollars' ? modalDollarAmount : modalUserQty}
                    onChange={e => {
                      const v = parseFloat(e.target.value) || 0;
                      if (modalQtyMode === 'dollars') setModalDollarAmount(v);
                      else setModalUserQty(v);
                    }}
                    style={{ width: 150, fontSize: 12 }}
                    min={modalQtyMode === 'shares' ? 0.0001 : 0}
                    step={modalQtyMode === 'shares' ? 0.01 : 1}
                    placeholder={modalQtyMode === 'shares' ? 'e.g. 0.5' : '0.00'}
                  />
                </div>

                {/* Order Type */}
                <div style={rowStyle}>
                  <span style={labelStyle}>{t.agent.orderType}</span>
                  <select
                    value={modalOrderType}
                    onChange={e => setModalOrderType(e.target.value)}
                    style={{ fontSize: 12, height: 28, border: '1px solid #d9d9d9', borderRadius: 4, padding: '0 8px', background: '#fff', width: 150 }}
                  >
                    <option value="market">{t.agent.market}</option>
                    <option value="limit">{t.agent.limit}</option>
                    <option value="stop">{t.agent.stopOrder}</option>
                    <option value="stop_limit">{t.agent.stopLimit}</option>
                    <option value="trailing_stop">{t.agent.trailingStop}</option>
                  </select>
                </div>

                {/* Price fields — conditional on order type */}
                {(modalOrderType === 'limit' || modalOrderType === 'stop_limit') && (
                  <div style={rowStyle}>
                    <span style={labelStyle}>{t.agent.limitPrice}</span>
                    <Input
                      type="number"
                      prefix="$"
                      value={modalLimitPrice || ''}
                      onChange={e => setModalLimitPrice(parseFloat(e.target.value) || 0)}
                      style={{ width: 150, fontSize: 12 }}
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                    />
                  </div>
                )}
                {(modalOrderType === 'stop' || modalOrderType === 'stop_limit') && (
                  <div style={rowStyle}>
                    <span style={labelStyle}>{t.agent.stopPrice}</span>
                    <Input
                      type="number"
                      prefix="$"
                      value={modalStopPrice || ''}
                      onChange={e => setModalStopPrice(parseFloat(e.target.value) || 0)}
                      style={{ width: 150, fontSize: 12 }}
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                    />
                  </div>
                )}
                {modalOrderType === 'trailing_stop' && (
                  <>
                    <div style={rowStyle}>
                      <span style={labelStyle}>{t.agent.trailPrice}</span>
                      <Input
                        type="number"
                        prefix="$"
                        value={modalTrailPrice || ''}
                        onChange={e => { setModalTrailPrice(parseFloat(e.target.value) || 0); setModalTrailPercent(0); }}
                        style={{ width: 150, fontSize: 12 }}
                        min={0}
                        step={0.01}
                        placeholder="0.00"
                      />
                    </div>
                    <div style={rowStyle}>
                      <span style={labelStyle}>{t.agent.trailPercent}</span>
                      <Input
                        type="number"
                        suffix="%"
                        value={modalTrailPercent || ''}
                        onChange={e => { setModalTrailPercent(parseFloat(e.target.value) || 0); setModalTrailPrice(0); }}
                        style={{ width: 150, fontSize: 12 }}
                        min={0}
                        step={0.1}
                        placeholder="0.0"
                      />
                    </div>
                  </>
                )}

                {/* Time in Force */}
                <div style={rowStyle}>
                  <span style={labelStyle}>{t.agent.timeInForce}</span>
                  <select
                    value={modalTimeInForce}
                    onChange={e => setModalTimeInForce(e.target.value)}
                    style={{ fontSize: 12, height: 28, border: '1px solid #d9d9d9', borderRadius: 4, padding: '0 8px', background: '#fff', width: 150 }}
                  >
                    <option value="day">{t.agent.day}</option>
                    <option value="gtc">{t.agent.gtcLabel}</option>
                    <option value="ioc">{t.agent.iocLabel}</option>
                    <option value="fok">{t.agent.fokLabel}</option>
                  </select>
                </div>
              </div>

              {/* Summary */}
              <div style={{ background: '#f9f9f9', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 12 }}>
                <RO label={t.agent.estCost} value={estCost > 0 ? `$${estCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : 'N/A'} />
                <RO label={t.agent.riskGate} value={(r.riskGate || r.hardRiskGate || {}).status || r.riskGateStatus || 'N/A'} />
                <RO label="R/R" value={ep.riskReward1 ? `${ep.riskReward1.toFixed(1)}:1` : 'N/A'} />
              </div>

              {isReal && (
                <div style={{ marginBottom: 12 }}>
                  <Alert type="warning" showIcon message={t.agent.realTradingWarning} style={{ marginBottom: 8 }} />
                  <Input
                    placeholder={t.agent.confirmRealOrderPlaceholder.replace('{symbol}', r.symbol)}
                    value={orderConfirmText}
                    onChange={e => setOrderConfirmText(e.target.value)}
                    style={{ fontSize: 12 }}
                  />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <Button onClick={() => { setOrderConfirmVisible(false); setOrderConfirmTarget(null); }}>{t.agent.cancel}</Button>
                <Button
                  type="primary"
                  danger={isReal}
                  onClick={handleConfirmOrder}
                  disabled={isReal && orderConfirmText.trim().toUpperCase() !== `CONFIRM REAL ORDER ${r.symbol}`.toUpperCase()}
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
        title={t.agent.cancelOrder}
        open={cancelConfirmVisible}
        onCancel={() => { setCancelConfirmVisible(false); setCancelTarget(null); }}
        footer={null}
        width={400}
      >
        {cancelTarget && (() => {
          const r = cancelTarget.record;
          return (
            <div>
              <div style={{ background: '#fff1f0', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{t.agent.cancelOrderConfirm}</div>
                <div style={{ fontSize: 12, color: '#595959' }}>
                  <div><strong>{t.agent.colSymbol}:</strong> {r.symbol}</div>
                  <div><strong>{t.agent.orderId}:</strong> <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.alpacaOrderId || 'N/A'}</span></div>
                  <div><strong>{t.agent.qty}:</strong> {r.userQty || r.positionSizeShares || 'N/A'}</div>
                  <div><strong>{t.agent.orderType}:</strong> {r.orderType || 'market'}</div>
                  <div><strong>{t.agent.mode}:</strong> {tradeMode === 'paper' ? t.agent.paperTrading : t.agent.live}</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <Button onClick={() => { setCancelConfirmVisible(false); setCancelTarget(null); }}>{t.agent.keepOrder}</Button>
                <Button danger loading={cancelLoading} onClick={handleCancelOrder}>{t.agent.cancelOrder}</Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* 1.6 AI Watchlist */}
      <div style={{ marginBottom: 24 }}>
        <Card
          className="premium-card"
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  width: 38, height: 38, borderRadius: 10, 
                  background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)', 
                  color: '#fff', display: 'flex', alignItems: 'center', 
                  justifyContent: 'center', fontSize: 20,
                  boxShadow: '0 4px 10px rgba(24, 144, 255, 0.2)'
                }}>
                  <EyeOutlined />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', lineHeight: 1.2 }}>{t.agent.aiWatchlist}</div>
                  <div style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 500 }}>{t.agent.activeEntryMonitoring}</div>
                </div>
                <Tag color="blue" bordered={false} style={{ fontSize: 11, fontWeight: 800, borderRadius: 6, marginLeft: 4, height: 20, lineHeight: '20px' }}>{aiWatchlistItems.length}</Tag>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Input
                  placeholder={t.agent.searchSymbol}
                  size="middle"
                  prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                  value={aiWatchlistSearch}
                  onChange={e => setAiWatchlistSearch(e.target.value.toUpperCase())}
                  style={{ width: 180, borderRadius: 8, fontSize: 13, height: 34, background: '#f9fafb', border: '1px solid #e5e7eb' }}
                  allowClear
                />
                <Divider type="vertical" style={{ height: 24 }} />
                <Space size={8}>
                  <Button
                    size="middle"
                    icon={<ReloadOutlined spin={aiWatchlistLoading} />}
                    onClick={() => { setAiWatchlistLoading(true); refreshWatchlistPrices().finally(() => setAiWatchlistLoading(false)); }}
                    style={{ borderRadius: 8, height: 34, fontWeight: 600, color: '#6b7280', border: '1px solid #e5e7eb' }}
                  >
                    {t.agent.refresh}
                  </Button>
                  {aiWatchlistItems.length > 0 && (
                    <Button
                      size="middle"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={clearAllWatchlist}
                      style={{ borderRadius: 8, height: 34, fontWeight: 600 }}
                    >
                      {t.agent.clearWatchlist}
                    </Button>
                  )}
                </Space>
              </div>
            </div>
          }
        >
          {aiWatchlistItems.length > 0 && (
            <div style={{ 
              display: 'flex', gap: 12, marginBottom: 20, padding: '16px', 
              background: '#f8fafc', borderRadius: 12, border: '1px solid #f1f5f9' 
            }}>
              {[
                { label: t.agent.total, value: aiWatchlistItems.length, color: '#1f1f1f', icon: <EyeOutlined /> },
                { label: t.agent.waitingEntry, value: aiWatchlistItems.filter(i => getWatchlistReadiness(i) === 'Waiting Entry').length, color: '#d97706', icon: <ClockCircleOutlined /> },
                { label: t.agent.reviewRequired, value: aiWatchlistItems.filter(i => i.riskGateStatus === 'REVIEW').length, color: '#2563eb', icon: <ExclamationCircleOutlined /> },
                { label: t.agent.readyOrHot, value: aiWatchlistItems.filter(i => getWatchlistReadiness(i) === 'Ready').length, color: '#059669', icon: <ThunderboltOutlined /> }
              ].map((stat, idx) => (
                <React.Fragment key={stat.label}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ 
                      width: 32, height: 32, borderRadius: 8, background: '#fff', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: stat.color, border: '1px solid #e5e7eb'
                    }}>
                      {stat.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#8c8c8c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{stat.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: stat.color, lineHeight: 1.1 }}>{stat.value}</div>
                    </div>
                  </div>
                  {idx < 3 && <Divider type="vertical" style={{ height: 32, margin: 0, borderColor: '#e2e8f0' }} />}
                </React.Fragment>
              ))}
              <div style={{ marginLeft: 'auto', alignSelf: 'center' }}>
                <Tag color="blue" bordered={false} style={{ fontSize: 9, margin: 0, fontWeight: 700, borderRadius: 4 }}>{t.agent.alpacaRealTimeFeed}</Tag>
              </div>
            </div>
          )}

          {aiWatchlistItems.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div style={{ padding: '30px 0' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#4b5563' }}>{t.agent.noAIWatchlistCandidates}</div>
                  <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>{t.agent.addFromEntryPlan}</div>
                </div>
              }
            />
          ) : (
            <div className="watchlist-table-container">
              <style>{`
                .watchlist-table .ant-table-thead > tr > th { background: #f9fafb !important; padding: 14px 12px !important; }
                .watchlist-row:hover > td { background-color: #f0f7ff !important; }
                .watchlist-row-expanded > td { background-color: #f8f9fb !important; }
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
                    title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 11, textTransform: 'uppercase' }}>{t.agent.colSymbol}</span>,
                    dataIndex: 'symbol',
                    key: 'symbol',
                    width: 100,
                    fixed: 'left' as const,
                    render: (text: string, record: any) => (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 800, fontSize: 15, color: '#111827', letterSpacing: '-0.2px' }}>{text}</span>
                        {record.isDevTest && <Tag style={{ fontSize: 8, padding: '0 4px', lineHeight: '14px', margin: 0, fontWeight: 700 }} color="red">DEV</Tag>}
                      </div>
                    ),
                  },
                  {
                    title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 11, textTransform: 'uppercase' }}>{t.agent.price}</span>,
                    key: 'currentPrice',
                    width: 100,
                    render: (record: any) => {
                      const p = record.currentPrice;
                      if (!p) return <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>;
                      return <span style={{ fontWeight: 700, color: '#111827', fontSize: 14 }}>${p.toFixed(2)}</span>;
                    },
                  },
                  {
                    title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 11, textTransform: 'uppercase' }}>{t.agent.chgPercent}</span>,
                    key: 'changePercent',
                    width: 90,
                    render: (record: any) => {
                      const c = record.changePercent;
                      if (c == null) return <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>;
                      const color = c >= 0 ? '#10b981' : '#ef4444';
                      return <span style={{ color, fontSize: 13, fontWeight: 800 }}>{c >= 0 ? '+' : ''}{c.toFixed(2)}%</span>;
                    },
                  },
                  {
                    title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 11, textTransform: 'uppercase' }}>{t.agent.colEntryZone}</span>,
                    key: 'entryZone',
                    width: 150,
                    render: (record: any) => {
                      const lo = record.entryZoneLow;
                      const hi = record.entryZoneHigh;
                      if (!lo && !hi) return <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>;
                      return <span style={{ fontSize: 13, color: '#374151', fontWeight: 600, fontFamily: 'Inter' }}>${(lo || 0).toFixed(2)} – ${(hi || 0).toFixed(2)}</span>;
                    },
                  },
                  {
                    title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 11, textTransform: 'uppercase' }}>{t.agent.stopTarget}</span>,
                    key: 'levels',
                    width: 140,
                    render: (record: any) => (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ color: '#ef4444', fontSize: 12, fontWeight: 600 }}>S: ${(record.stopLoss || 0).toFixed(2)}</span>
                        <span style={{ color: '#10b981', fontSize: 12, fontWeight: 600 }}>T: ${(record.takeProfit1 || 0).toFixed(2)}</span>
                      </div>
                    )
                  },
                  {
                    title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 11, textTransform: 'uppercase' }}>R/R</span>,
                    dataIndex: 'riskReward',
                    key: 'riskReward',
                    width: 70,
                    render: (v: number | null) => v ? <span style={{ fontWeight: 700, color: v >= 2 ? '#10b981' : '#6b7280', fontSize: 13 }}>{v.toFixed(1)}x</span> : <span style={{ color: '#d1d5db' }}>—</span>,
                  },
                  {
                    title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 11, textTransform: 'uppercase' }}>{t.agent.status}</span>,
                    key: 'status',
                    width: 130,
                    render: (record: any) => {
                      const r = getWatchlistReadiness(record);
                      return <Tag color={getReadinessColor(r)} bordered={false} style={{ fontSize: 10, fontWeight: 800, padding: '0 10px', borderRadius: 6, height: 22, lineHeight: '22px' }}>{translateReadiness(r).toUpperCase()}</Tag>;
                    },
                  },
                  {
                    title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 11, textTransform: 'uppercase' }}>{t.agent.colSource}</span>,
                    key: 'source',
                    width: 110,
                    render: (record: any) => {
                      const src = record.selectedBy || record.source || 'Entry Plan';
                      const color = src === 'Continue' ? 'success' : src === 'Watch-to-Validate' ? 'warning' : 'blue';
                      const label = src === 'Watch-to-Validate' ? 'Watch→Val' : src;
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
                                  limitPrice: ep.entryZoneHigh || ep.entryZoneLow || record.entryZoneHigh || record.entryZoneLow || record.currentPrice,
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
                                borderColor: alreadyIn ? '#e5e7eb' : '#1890ff',
                                background: alreadyIn ? '#f9fafb' : '#e6f7ff'
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

      {/* 2. Market Scanner */}
      <CollapsibleStageSection
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
        progressValue={detailedScanStatus.totalCount > 0 ? Math.round((detailedScanStatus.processedCount / detailedScanStatus.totalCount) * 100) : null}
        progressText={detailedScanStatus.currentStatus === 'scanning' ? `${detailedScanStatus.processedCount}/${detailedScanStatus.totalCount}` : undefined}
        summaryChips={marketScannerResults.length > 0 ? [
          { label: t.agent.completed, value: marketScannerResults.length },
          { label: 'AI Success', value: marketScannerResults.filter((r: any) => r.aiCalled && r.analysisStatus !== 'failed').length, color: '#1890ff' },
          { label: t.agent.localRules, value: marketScannerResults.filter((r: any) => !r.aiCalled && r.analysisStatus !== 'failed').length },
          ...(marketScannerResults.filter((r: any) => r.analysisStatus === 'failed').length > 0
            ? [{ label: 'Need Data', value: marketScannerResults.filter((r: any) => r.analysisStatus === 'failed').length, color: '#ff4d4f' }]
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
        <Card>
          <Row gutter={16} align="middle" style={{ marginBottom: 16 }}>
            <Col span={24}>
              <Space size="middle">
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
                {detailedScanStatus.currentStatus === 'scanning' && (
                  <Text type="secondary" style={{ fontSize: '12px' }}>{t.agent.scanningInProgress}...</Text>
                )}
                {detailedScanStatus.currentStatus === 'stopping' && (
                  <Text type="warning" style={{ fontSize: '12px' }}>{t.agent.stoppingScanner}...</Text>
                )}
                {detailedScanStatus.currentStatus === 'stopped' && (
                  <Text type="warning" style={{ fontSize: '12px' }}>{t.agent.scanStopped}. {marketScannerResults.length} {t.agent.retained}.</Text>
                )}
                {detailedScanStatus.currentStatus === 'completed' && (
                  <Text type="success" style={{ fontSize: '12px' }}>{t.agent.scanCompleted}: {detailedScanStatus.processedCount} {t.agent.colSymbol.toLowerCase()}</Text>
                )}
                {detailedScanStatus.currentStatus === 'error' && (
                  <Text type="danger" style={{ fontSize: '12px' }}>{detailedScanStatus.statusMessage}</Text>
                )}
              </Space>
            </Col>
          </Row>

          <Divider style={{ margin: '16px 0' }} />

          {/* Scanner Status Display */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <div style={{ marginBottom: '8px' }}>
                <Text strong>{t.agent.status}:</Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Badge
                  status={
                    detailedScanStatus.currentStatus === 'scanning' ? 'processing' :
                    detailedScanStatus.currentStatus === 'completed' ? 'success' :
                    detailedScanStatus.currentStatus === 'error' ? 'error' :
                    detailedScanStatus.currentStatus === 'stopped' || detailedScanStatus.currentStatus === 'stopping' ? 'warning' : 'default'
                  }
                />
                <Text strong style={{
                  color: detailedScanStatus.currentStatus === 'scanning' ? '#52c41a' :
                         detailedScanStatus.currentStatus === 'completed' ? '#1890ff' :
                         detailedScanStatus.currentStatus === 'error' ? '#ff4d4f' :
                         detailedScanStatus.currentStatus === 'stopped' || detailedScanStatus.currentStatus === 'stopping' ? '#faad14' : '#8c8c8c'
                }}>
                  {detailedScanStatus.currentStatus === 'scanning' ? t.agent.statusScanning :
                   detailedScanStatus.currentStatus === 'completed' ? t.agent.statusCompleted :
                   detailedScanStatus.currentStatus === 'error' ? t.agent.statusError :
                   detailedScanStatus.currentStatus === 'stopping' ? t.agent.statusStopping :
                   detailedScanStatus.currentStatus === 'stopped' ? t.agent.statusStopped2 : t.agent.statusIdle}
                </Text>
              </div>
            </Col>

            <Col span={6}>
              <div style={{ marginBottom: '8px' }}>
                <Text strong>{t.agent.progress}:</Text>
              </div>
              <Text type="secondary" style={{ fontSize: '13px' }}>
                {detailedScanStatus.currentStatus === 'scanning'
                  ? `${detailedScanStatus.processedCount}/${detailedScanStatus.totalCount} ${t.agent.progressSymbols}`
                  : detailedScanStatus.currentStatus === 'completed' ? `${t.agent.progressCompletedPrefix} ${detailedScanStatus.totalCount}/${detailedScanStatus.totalCount}` :
                    detailedScanStatus.currentStatus === 'stopped' ? `${t.agent.progressStoppedAtPrefix} ${detailedScanStatus.processedCount}/${detailedScanStatus.totalCount}` : t.agent.progressIdleText}
              </Text>
            </Col>

            <Col span={6}>
              <div style={{ marginBottom: '8px' }}>
                <Text strong>{t.agent.dataQuality}:</Text>
              </div>
              <Text type="secondary" style={{ fontSize: '13px' }}>
                {marketScannerResults.length > 0
                  ? `${marketScannerResults.filter((r: any) => r.price != null && r.volume > 0).length} ${t.agent.goodData} / ${marketScannerResults.filter((r: any) => (r.price != null || r.volume > 0) && !(r.price != null && r.volume > 0)).length} ${t.agent.partialData}`
                  : !configStatus.alpaca ? t.agent.notConfigured :
                    detailedScanStatus.currentStatus === 'scanning' ? t.agent.collecting : t.agent.noDataYet}
              </Text>
            </Col>

            <Col span={6}>
              <div style={{ marginBottom: '8px' }}>
                <Text strong>{t.agent.aiStatus}:</Text>
              </div>
              <Text type="secondary" style={{ fontSize: '13px' }}>
                {marketScannerResults.length > 0
                  ? `${marketScannerResults.filter((r: any) => r.aiCalled && r.analysisStatus !== 'failed').length} AI · ${marketScannerResults.filter((r: any) => !r.aiCalled && r.analysisStatus !== 'failed').length} ${t.agent.localRules}${marketScannerResults.filter((r: any) => r.analysisStatus === 'failed').length > 0 ? ` · ${marketScannerResults.filter((r: any) => r.analysisStatus === 'failed').length} Need Data` : ''}`
                  : configStatus.aiTestStatus === 'connected' ? t.agent.connected :
                    configStatus.aiTestStatus === 'saved' ? t.agent.notTested :
                    configStatus.aiTestStatus === 'error' ? t.agent.error :
                    configStatus.ai ? t.agent.notTested : t.agent.ruleBasedOnly}
              </Text>
            </Col>
          </Row>

          {(marketScannerStatus.status === 'running' || detailedScanStatus.currentStatus === 'scanning') && (
            <div style={{ 
              marginBottom: 24, 
              padding: '16px 20px', 
              background: '#fafafa', 
              borderRadius: 8, 
              border: '1px solid #f0f0f0' 
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                marginBottom: 12
              }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                    {detailedScanStatus.currentStatus === 'scanning' ? t.agent.scanningInProgress :
                     detailedScanStatus.currentStatus === 'stopped' ? t.agent.scanStopped :
                     detailedScanStatus.currentStatus === 'completed' ? t.agent.scanCompleted :
                     detailedScanStatus.currentStatus === 'error' ? t.agent.scanError : t.agent.waitingForNextScan}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#262626', lineHeight: 1.2 }}>
                    {detailedScanStatus.percent}% <span style={{ fontSize: 14, fontWeight: 400, color: '#8c8c8c' }}>{t.agent.complete}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, color: '#595959', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{detailedScanStatus.processedCount}</span> / {detailedScanStatus.totalCount} {t.agent.symbolsProcessed}
                  </div>
                  <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                    {detailedScanStatus.validatedCount} {t.agent.validated} • {detailedScanStatus.failedCount > 0 && `${detailedScanStatus.failedCount} ${t.agent.failed} • `}{detailedScanStatus.retryCount} {t.agent.retries}
                    {detailedScanStatus.lastFailureReason && <div style={{ fontSize: 11, color: '#ff4d4f', marginTop: 2 }}>{t.agent.lastFailure}: {detailedScanStatus.lastFailureReason}</div>}
                  </div>
                </div>
              </div>

              <Progress
                percent={detailedScanStatus.percent}
                showInfo={false}
                size={["100%", 8]}
                status={detailedScanStatus.currentStatus === 'scanning' ? 'active' :
                       detailedScanStatus.currentStatus === 'stopped' ? 'exception' :
                       detailedScanStatus.currentStatus === 'completed' ? 'success' : 'normal'}
                strokeColor={
                  detailedScanStatus.currentStatus === 'scanning' ? '#1890ff' :
                  detailedScanStatus.currentStatus === 'completed' ? '#52c41a' :
                  detailedScanStatus.currentStatus === 'error' ? '#ff4d4f' : '#faad14'
                }
                style={{ marginBottom: 16 }}
              />

              {detailedScanStatus.activeSymbols.length > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  color: '#595959'
                }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1890ff', margin: 'auto' }} />
                  </div>
                  <Text strong style={{ color: '#262626' }}>{t.agent.currentlyScanning}:</Text>
                  {detailedScanStatus.activeSymbols.map(sym => (
                    <Tag key={sym} color="blue" bordered={false} style={{ margin: 0 }}>{sym}</Tag>
                  ))}
                  {detailedScanStatus.statusMessage && (
                    <span style={{ color: '#8c8c8c', marginLeft: 'auto' }}>{detailedScanStatus.statusMessage}</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Scanner Summary */}
          {marketScannerSummary.universeScanned > 0 && (
            <Card
              size="small"
              style={{
                marginBottom: 16,
                border: '1px solid #f0f0f0',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)'
              }}
              bodyStyle={{ padding: '16px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <Text strong style={{ fontSize: '16px' }}>{t.agent.marketScanSummary}</Text>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: 2 }}>
                    {marketScannerSummary.lastScanTime
                      ? new Date(marketScannerSummary.lastScanTime).toLocaleString()
                      : t.agent.notScanned}
                  </div>
                </div>
                <Tag color="blue">{t.agent.fullMarketScan}</Tag>
              </div>

              <Divider style={{ margin: '12px 0' }} />

              <Row gutter={[16, 16]}>
                <Col span={4}>
                  <Statistic
                    title={t.agent.universeScanned}
                    value={marketScannerSummary.universeScanned}
                    valueStyle={{ color: '#1890ff', fontSize: '20px', fontWeight: 'bold' }}
                    prefix={<BarChartOutlined />}
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title={t.agent.bullish}
                    value={marketScannerSummary.bullishCount}
                    valueStyle={{ color: '#52c41a', fontSize: '20px', fontWeight: 'bold' }}
                    prefix={<ArrowUpOutlined />}
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title={t.agent.bearish}
                    value={marketScannerSummary.bearishCount}
                    valueStyle={{ color: '#ff4d4f', fontSize: '20px', fontWeight: 'bold' }}
                    prefix={<ArrowDownOutlined />}
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title={t.agent.neutral}
                    value={marketScannerSummary.neutralCount}
                    valueStyle={{ color: '#faad14', fontSize: '20px', fontWeight: 'bold' }}
                    prefix={<MinusOutlined />}
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title={t.agent.strongTrend}
                    value={marketScannerSummary.strongTrendCount}
                    valueStyle={{ color: '#722ed1', fontSize: '20px', fontWeight: 'bold' }}
                    prefix={<ThunderboltOutlined />}
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title={t.agent.newsRisk}
                    value={marketScannerSummary.newsRiskCount}
                    valueStyle={{ color: '#fa8c16', fontSize: '20px', fontWeight: 'bold' }}
                    prefix={<ExclamationCircleOutlined />}
                  />
                </Col>
              </Row>
            </Card>
          )}

          {/* Scanner Results Table */}
          {marketScannerResults.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <Text strong style={{ fontSize: '15px' }}>{t.agent.topMarketTrends} <span style={{ color: '#8c8c8c', fontWeight: 'normal', fontSize: '13px' }}>({getFilteredAndSortedResults().length})</span></Text>
                  
                  <div style={{ display: 'flex', background: '#f0f2f5', padding: 4, borderRadius: 6, gap: 4 }}>
                    {[
                      { value: 'all', label: t.agent.all },
                      { value: 'strong', label: t.agent.strong },
                      { value: 'bullish', label: t.agent.bullish },
                      { value: 'neutral', label: t.agent.neutral },
                      { value: 'bearish', label: t.agent.bearish }
                    ].map(tab => (
                      <div
                        key={tab.value}
                        onClick={() => setMarketScannerFilters(prev => ({ ...prev, trendFilter: tab.value as any }))}
                        style={{
                          padding: '4px 12px',
                          fontSize: 12,
                          fontWeight: marketScannerFilters.trendFilter === tab.value ? 600 : 400,
                          color: marketScannerFilters.trendFilter === tab.value ? '#1890ff' : '#595959',
                          background: marketScannerFilters.trendFilter === tab.value ? '#fff' : 'transparent',
                          borderRadius: 4,
                          cursor: 'pointer',
                          boxShadow: marketScannerFilters.trendFilter === tab.value ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                          transition: 'all 0.2s'
                        }}
                      >
                        {tab.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            <div className="scanner-table-container">
              <Table
                columns={[
                  {
                    title: t.agent.colSymbol,
                    dataIndex: 'symbol',
                    key: 'symbol',
                    fixed: 'left',
                    width: 150,
                    render: (text: string, record: any) => (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="scanner-symbol-text">{text}</span>
                        <span className="scanner-company-text">{record.companyName || record.name || t.agent.unknown}</span>
                      </div>
                    ),
                  },
                  {
                    title: t.agent.trend,
                    dataIndex: 'trendLabel',
                    key: 'trendLabel',
                    width: 120,
                    render: (label: string) => renderTrendBadge(label)
                  },
                  {
                    title: t.agent.colScore,
                    dataIndex: 'trendScore',
                    key: 'trendScore',
                    width: 140,
                    render: (score: number, record: any) => {
                      const hasScore = score != null || record.overallScore != null;
                      if (!hasScore) {
                        return (
                          <div style={{ width: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: '#bfbfbf' }}>—</span>
                              <span style={{ fontSize: '10px', color: '#8c8c8c' }}>{t.agent.confidence}: —</span>
                            </div>
                            <Progress percent={0} size="small" strokeColor="#d9d9d9" showInfo={false} style={{ margin: 0 }} />
                          </div>
                        );
                      }
                      const displayScore = score || record.overallScore || 0;
                      const conf = record.trendConfidence ? (record.trendConfidence * (record.trendConfidence <= 1 ? 100 : 1)).toFixed(0) : '0';
                      const scoreColor = displayScore >= 70 ? '#52c41a' : displayScore >= 40 ? '#faad14' : '#ff4d4f';
                      return (
                        <div style={{ width: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: scoreColor }}>{displayScore.toFixed(0)}</span>
                            <span style={{ fontSize: '10px', color: '#8c8c8c' }}>{t.agent.confidence}: {conf}%</span>
                          </div>
                          <Progress
                            percent={displayScore}
                            size="small"
                            strokeColor={scoreColor}
                            showInfo={false}
                            style={{ margin: 0 }}
                          />
                        </div>
                      );
                    }
                  },
                  {
                    title: t.agent.colPrice,
                    dataIndex: 'price',
                    key: 'price',
                    width: 120,
                    render: (price: number, record: any) => {
                      const hasPrice = price != null && price > 0;
                      const changePct = (record.changePct != null) ? record.changePct : (record.changePercent != null ? record.changePercent : null);
                      const changeColor = changePct != null ? (changePct >= 0 ? '#52c41a' : '#ff4d4f') : '#bfbfbf';
                      return (
                        <div>
                          <div className="scanner-price-text">{hasPrice ? `$${price.toFixed(2)}` : '—'}</div>
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: '11px',
                            color: changeColor,
                            fontWeight: 600,
                            padding: '2px 6px',
                            backgroundColor: changePct != null ? `${changeColor}10` : '#f5f5f5',
                            borderRadius: '4px',
                            marginTop: 4
                          }}>
                            {changePct != null ? (
                              <>
                                <span>{changePct >= 0 ? '▲' : '▼'}</span>
                                <span>{changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%</span>
                              </>
                            ) : (
                              <span>—</span>
                            )}
                          </div>
                        </div>
                      );
                    }
                  },
                  {
                    title: t.agent.volume,
                    dataIndex: 'volume',
                    key: 'volume',
                    width: 130,
                    render: (volume: number, record: any) => {
                      const hasVolume = volume != null && volume > 0;
                      const status = (record.volumeStatus != null && record.analysisStatus !== 'failed') ? record.volumeStatus : null;
                      const statusColor = status === 'High' ? '#ff4d4f' : status === 'Low' ? '#52c41a' : '#faad14';
                      const volumeStatusMap: Record<string, string> = { 'High': t.agent.volumeHigh, 'Normal': t.agent.volumeNormal, 'Low': t.agent.volumeLow };
                      return (
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#262626' }}>
                            {hasVolume ? marketDataService.formatVolume(volume) : '—'}
                          </div>
                          <div style={{ marginTop: 4 }}>
                            {status ? (
                              <span style={{
                                fontSize: '10px',
                                color: statusColor,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: `${statusColor}10`,
                                border: `1px solid ${statusColor}30`
                              }}>
                                {volumeStatusMap[status] || status}
                              </span>
                            ) : (
                              <span style={{
                                fontSize: '10px',
                                color: '#bfbfbf',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: '#f5f5f5',
                                border: '1px solid #d9d9d9'
                              }}>N/A</span>
                            )}
                          </div>
                        </div>
                      );
                    }
                  },
                  {
                    title: t.agent.colNews,
                    dataIndex: 'newsSentiment',
                    key: 'newsSentiment',
                    width: 140,
                    render: (sentiment: string, record: any) => {
                      const sentimentMap: Record<string, string> = { 'Positive': t.agent.sentimentPositive, 'Negative': t.agent.sentimentNegative, 'Mixed': t.agent.sentimentMixed };
                      const riskLevelMap: Record<string, string> = { 'High': t.agent.riskHigh, 'Medium': t.agent.riskMedium, 'Low': t.agent.riskLow };
                      let color = '#8c8c8c';
                      let icon = '⚪';
                      if (sentiment === 'Positive') { color = '#52c41a'; icon = '📈'; }
                      else if (sentiment === 'Negative') { color = '#ff4d4f'; icon = '📉'; }
                      else if (sentiment === 'Mixed') { color = '#faad14'; icon = '📊'; }

                      const risk = record.eventRisk || 'Low';
                      const riskColor = risk === 'High' ? '#ff4d4f' : risk === 'Medium' ? '#faad14' : '#52c41a';

                      return (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: '14px' }}>{icon}</span>
                            <span style={{ fontSize: '12px', fontWeight: 600, color }}>{sentimentMap[sentiment] || sentiment || 'N/A'}</span>
                          </div>
                          <div style={{ fontSize: '10px', color: '#8c8c8c', marginTop: 4 }}>
                            {t.agent.riskPrefix}: <span style={{ color: riskColor, fontWeight: 700 }}>{riskLevelMap[risk] || risk}</span>
                          </div>
                        </div>
                      );
                    }
                  },
                  {
                    title: t.agent.colDataQual,
                    key: 'dataQuality',
                    width: 110,
                    render: (record: any) => {
                      const isFailed = record.analysisStatus === 'failed';
                      const hasPrice = record.price != null && record.price > 0;
                      const hasVolume = record.volume != null && record.volume > 0;
                      const hasTrend = record.trendLabel != null && record.trendLabel !== 'Need Data';
                      const dqOk = hasPrice && hasVolume && hasTrend && !isFailed;
                      let dq: string;
                      let dqColor: string;
                      if (isFailed) {
                        dq = 'Failed';
                        dqColor = '#ff4d4f';
                      } else if (dqOk) {
                        dq = t.agent.goodData;
                        dqColor = '#52c41a';
                      } else {
                        dq = t.agent.partialData;
                        dqColor = '#faad14';
                      }
                      const sourceLabel = isFailed ? (record.aiSource === 'Failed' ? 'Local fallback' : record.aiSource || 'Failed')
                        : record.aiCalled ? record.aiSource : t.agent.localLabel;
                      return (
                        <div>
                          <div style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            color: dqColor,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: dqColor }} />
                            {dq}
                          </div>
                          <div style={{ fontSize: '10px', color: '#bfbfbf', marginTop: 2 }}>
                            {sourceLabel}
                          </div>
                        </div>
                      );
                    },
                  },
                  {
                    title: t.agent.aiReasoning,
                    dataIndex: 'conciseReasoning',
                    key: 'conciseReasoning',
                    width: 250,
                    render: (reason: string, record: any) => {
                      const rawReason = reason || record.scannerReason || record.aiReasoning || t.agent.noAnalysisAvailable;
                      const displayReason = rawReason;
                      return (
                        <Tooltip title={displayReason}>
                          <div className="scanner-reasoning-text">
                            {displayReason}
                          </div>
                        </Tooltip>
                      );
                    }
                  }
                ]}
                dataSource={getFilteredAndSortedResults()}
                rowKey="symbol"
                size="middle"
                pagination={{ pageSize: 10, size: 'default', showSizeChanger: false }}
                scroll={{ x: 1200 }}
                onRow={(record) => ({
                  className: expandedRows.includes(record.symbol) ? 'scanner-row-expanded' : '',
                  onClick: () => toggleRowExpand(record.symbol)
                })}
                expandable={{
                  expandedRowRender: (record: any) => renderDetailPanel(record),
                  rowExpandable: () => true,
                  expandedRowKeys: expandedRows,
                  showExpandColumn: true,
                  expandRowByClick: false,
                  expandIcon: ({ expanded, onExpand, record }) => (
                    <Button
                      type="text"
                      size="small"
                      icon={expanded ? <ArrowDownOutlined /> : <ArrowRightOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        onExpand(record, e);
                      }}
                      style={{ padding: 0, width: 24, height: 24, color: '#bfbfbf' }}
                    />
                  )
                }}
              />
            </div>
            </div>
          )}

          {marketScannerResults.length === 0 && marketScannerStatus.status !== 'running' && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
              <LineChartOutlined style={{ fontSize: '48px', marginBottom: 16 }} />
              <div style={{ fontSize: '14px' }}>{t.agent.noMarketScanResults}</div>
              <div style={{ fontSize: '12px', marginTop: 8 }}>
                {t.agent.clickRunScanner}
              </div>
            </div>
          )}
        </Card>
      </CollapsibleStageSection>

      {/* 2.5 Preferred Continue Scan List */}
      <CollapsibleStageSection
        title={t.agent.preferredContinueScanList}
        icon={<BarChartOutlined style={{ color: '#1890ff' }} />}
        statusText={
          continueScanStatus === 'processing' ? t.agent.statusRunning :
          continueScanStatus === 'completed' ? t.agent.statusCompleted :
          continueScanStatus === 'error' ? t.agent.statusError : t.agent.statusReady
        }
        statusColor={
          continueScanStatus === 'processing' ? 'processing' :
          continueScanStatus === 'completed' ? 'success' :
          continueScanStatus === 'error' ? 'error' : 'default'
        }
        progressValue={continueScanStatus === 'processing' ? continueScanProgress : null}
        summaryChips={preferredContinueScanList.length > 0 ? [
          { label: t.agent.candidates, value: preferredContinueScanList.length },
          { label: 'AI', value: preferredContinueScanList.filter((c: any) => c.reasonSource === 'AI').length, color: '#1890ff' },
          { label: t.agent.localRules, value: preferredContinueScanList.filter((c: any) => c.reasonSource !== 'AI').length },
        ] : undefined}
        actionButton={
          <Tooltip title={pipelineRunning ? t.agent.pipelineDisabled : ''}>
            <span>
              <Button
                type="primary"
                onClick={() => handleStartContinueScan()}
                disabled={marketScannerResults.length === 0 || continueScanStatus === 'processing' || pipelineRunning}
                loading={continueScanStatus === 'processing'}
                icon={<ThunderboltOutlined />}
                style={AI_AGENT_PRIMARY_BTN_STYLE}
              >
                {continueScanStatus === 'processing' ? t.agent.processing : t.agent.startSelection}
              </Button>
            </span>
          </Tooltip>
        }
        isRunning={continueScanStatus === 'processing'}
        expanded={continueScanExpanded}
        onToggle={() => setContinueScanExpanded(!continueScanExpanded)}
      >
        <div className="continue-scan-section">
        {/* 顶部控制面板 */}
        <Card style={{ marginBottom: 16, borderRadius: '12px', border: '1px solid #f0f0f0' }} bodyStyle={{ padding: '20px' }}>
          {/* 状态和信息行 */}
          <div className="continue-scan-header-meta">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 600 }}>{t.agent.statusLabel}:</span>
              <Tag 
                color={
                  continueScanStatus === 'processing' ? 'blue' :
                  continueScanStatus === 'completed' ? 'success' :
                  continueScanStatus === 'error' ? 'error' : 'default'
                }
                className="continue-scan-status-badge"
              >
                {continueScanStatus === 'processing' ? t.agent.statusRunning :
                 continueScanStatus === 'completed' ? t.agent.statusCompleted :
                 continueScanStatus === 'error' ? t.agent.statusError : t.agent.statusReady}
              </Tag>
            </div>
            <Divider type="vertical" />
            <span><strong>{t.agent.sourceLabel}:</strong> {t.agent.marketScanner}</span>
            <Divider type="vertical" />
            <span>
              <strong>{t.agent.selectionLabel}:</strong>{' '}
              {preferredContinueScanList.length > 0 ? (
                preferredContinueScanList.filter(c => c.reasonSource === 'AI').length > 0 ? (
                  <Tag color="cyan" style={{ fontSize: '10px', fontWeight: 700 }}>{t.agent.aiRules}</Tag>
                ) : (
                  <Tag color="orange" style={{ fontSize: '10px', fontWeight: 700 }}>{t.agent.rulesOnly}</Tag>
                )
              ) : '—'}
            </span>
            <Divider type="vertical" />
            <span><strong>{t.agent.poolLabel}:</strong> {marketScannerResults.length} {t.agent.symbolsLabel}</span>
            {detailedScanStatus.lastScanAt && (
              <>
                <Divider type="vertical" />
                <span>
                  <strong>{t.agent.lastSync}:</strong> {new Date(detailedScanStatus.lastScanAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </>
            )}
          </div>

          {/* AI fallback warning */}
          {continueScanStatus === 'completed' && preferredContinueScanList.length > 0 &&
            preferredContinueScanList.filter(c => c.reasonSource === 'AI').length === 0 && (
            <Alert
              message={t.agent.rulesOnly + '. ' + t.agent.aiReasoning + ' ' + t.agent.notConfigured + '.'}
              type="info"
              showIcon
              style={{ marginBottom: '16px', borderRadius: '8px' }}
            />
          )}

          {/* 统计卡片 - 只在完成时显示 */}
          {continueScanStatus === 'completed' && preferredContinueScanList.length > 0 && (
            <div className="continue-scan-stat-grid">
              <div className="continue-scan-stat-card">
                <div className="continue-scan-stat-label">{t.agent.candidates}</div>
                <div className="continue-scan-stat-value">
                  {preferredContinueScanList.length}
                  <span className="continue-scan-stat-sub">/ {marketScannerResults.length}</span>
                </div>
              </div>
              <div className="continue-scan-stat-card">
                <div className="continue-scan-stat-label">{t.agent.avgPriority}</div>
                <div className="continue-scan-stat-value" style={{ color: '#1890ff' }}>
                  {preferredContinueScanList.length > 0
                    ? `${Math.round(preferredContinueScanList.reduce((sum, c) => sum + (c.priorityScore || 0), 0) / preferredContinueScanList.length)}%`
                    : '—'}
                </div>
              </div>
              <div className="continue-scan-stat-card">
                <div className="continue-scan-stat-label">{t.agent.riskMix}</div>
                <div className="continue-scan-stat-value" style={{ fontSize: '16px', paddingTop: '4px' }}>
                  <span style={{ color: '#52c41a' }}>{preferredContinueScanList.filter(c => (c.eventRisk || 'Medium') === 'Low').length}</span>
                  <span style={{ color: '#bfbfbf', margin: '0 4px' }}>/</span>
                  <span style={{ color: '#faad14' }}>{preferredContinueScanList.filter(c => (c.eventRisk || 'Medium') === 'Medium').length}</span>
                  <span style={{ color: '#bfbfbf', margin: '0 4px' }}>/</span>
                  <span style={{ color: '#ff4d4f' }}>{preferredContinueScanList.filter(c => (c.eventRisk || 'Medium') === 'High').length}</span>
                </div>
              </div>
              <div className="continue-scan-stat-card">
                <div className="continue-scan-stat-label">{t.agent.avgScore}</div>
                <div className="continue-scan-stat-value">
                  {preferredContinueScanList.length > 0
                    ? Math.round(preferredContinueScanList.reduce((sum, c) => sum + (c.overallScore || c.trendScore || 0), 0) / preferredContinueScanList.length)
                    : '—'}
                </div>
              </div>
              <div className="continue-scan-stat-card">
                <div className="continue-scan-stat-label">{t.agent.aiCoverage}</div>
                <div className="continue-scan-stat-value">
                  {Math.round((preferredContinueScanList.filter(c => c.reasonSource === 'AI').length / preferredContinueScanList.length) * 100)}%
                </div>
              </div>
            </div>
          )}

          {/* 进度条（处理中时显示） */}
          {continueScanStatus === 'processing' && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <Text strong style={{ color: '#1890ff' }}>{continueScanDetails.currentStage || t.agent.processing}</Text>
                <Text strong>{continueScanProgress}%</Text>
              </div>
              <Progress
                percent={continueScanProgress}
                status="active"
                strokeColor={{ '0%': '#1890ff', '100%': '#52c41a' }}
                strokeWidth={10}
              />
              <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: '8px' }}>
                {t.agent.candidatesWord} {t.agent.validated}: <strong>{continueScanDetails.processedCount}</strong> / {continueScanDetails.totalCount}
              </div>
            </div>
          )}
        </Card>

        <Card bodyStyle={{ padding: 0, border: 'none' }} bordered={false}>
          {(() => {
            // 状态1: 没有market scan结果
            if (marketScannerResults.length === 0) {
              return (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                  <BarChartOutlined style={{ fontSize: '48px', marginBottom: 16 }} />
                  <div style={{ fontSize: '14px' }}>{t.agent.noMarketScanResultsAvailable}</div>
                  <div style={{ fontSize: '12px', marginTop: 8 }}>
                    {detailedScanStatus.currentStatus === 'scanning'
                      ? t.agent.marketScanInProgress
                      : detailedScanStatus.currentStatus === 'stopped'
                      ? t.agent.scanStoppedBeforeResults
                      : t.agent.runMarketScannerFirst}
                  </div>
                </div>
              );
            }

            // 状态2: continue scan处理中
            if (continueScanStatus === 'processing') {
              return (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                  <SyncOutlined spin style={{ fontSize: '48px', marginBottom: 16, color: '#1890ff' }} />
                  <div style={{ fontSize: '14px' }}>{t.agent.ruleBasedScanInProgress}</div>
                  <div style={{ fontSize: '12px', marginTop: 8 }}>
                    {t.agent.processingNCandidates.replace('{processed}', String(continueScanDetails.processedCount)).replace('{total}', String(continueScanDetails.totalCount))}
                  </div>
                </div>
              );
            }

            // 状态3: continue scan完成
            if (continueScanStatus === 'completed' && preferredContinueScanList.length > 0) {
              const paginatedData = preferredContinueScanList.slice((preferredContinuePage - 1) * 10, preferredContinuePage * 10);
              return (
                <div className="continue-scan-table-container">
                  <div style={{ 
                    backgroundColor: '#f6ffed', 
                    border: '1px solid #b7eb8f', 
                    padding: '12px 16px', 
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '16px'
                  }}>
                    <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '20px' }} />
                    <div>
                      <div style={{ fontWeight: 700, color: '#1f1f1f', fontSize: '14px' }}>
                        {t.agent.selectionSuccessful}
                      </div>
                      <div style={{ color: '#595959', fontSize: '12px' }}>
                        {t.agent.foundTopCandidates.replace('{count}', String(preferredContinueScanList.length))}
                      </div>
                    </div>
                  </div>

                  <Table
                    dataSource={paginatedData}
                    pagination={false}
                    scroll={{ x: 1300 }}
                    rowKey="symbol"
                    size="middle"
                    expandable={{
                      expandedRowRender: (record: any) => renderDetailPanel(record),
                      rowExpandable: () => true,
                    }}
                    columns={[
                      {
                        title: '#',
                        key: 'rank',
                        width: 50,
                        render: (_, __, index) => {
                          const rank = (preferredContinuePage - 1) * 10 + index + 1;
                          const isTop = rank <= 3;
                          return (
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              backgroundColor: isTop ? '#1890ff' : 'transparent',
                              color: isTop ? '#fff' : '#8c8c8c',
                              fontWeight: 700,
                              fontSize: '11px'
                            }}>
                              {rank}
                            </div>
                          );
                        },
                      },
                      {
                        title: t.agent.colSymbol,
                        key: 'symbol',
                        width: 140,
                        render: (record) => (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span className="scanner-symbol-text">{record.symbol}</span>
                              {record.isDevTest && <Tag color="red" style={{ fontSize: 9, padding: '0 3px', lineHeight: '14px', margin: 0 }}>DEV TEST</Tag>}
                            </div>
                            <span className="scanner-company-text" style={{ maxWidth: 100 }}>
                              {record.companyName || t.agent.unknown}
                            </span>
                          </div>
                        ),
                      },
                      {
                        title: t.agent.trend,
                        key: 'trend',
                        width: 120,
                        render: (record) => renderTrendBadge(record.trendLabel),
                      },
                      {
                        title: t.agent.colScore,
                        key: 'score',
                        width: 80,
                        render: (record) => {
                          const score = record.overallScore || record.trendScore || 0;
                          const color = score >= 70 ? '#52c41a' : score >= 50 ? '#faad14' : '#ff4d4f';
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color }} />
                              <span style={{ fontSize: '14px', fontWeight: 700, color: '#262626' }}>{score > 0 ? score.toFixed(0) : '—'}</span>
                            </div>
                          );
                        },
                      },
                      {
                        title: t.agent.priority,
                        key: 'priority',
                        width: 160,
                        render: (record) => {
                          const ps = record.priorityScore || 0;
                          const pb = record.priorityBreakdown || {};
                          const color = ps >= 80 ? '#52c41a' : ps >= 60 ? '#faad14' : '#ff4d4f';
                          const breakdownContent = (
                            <div style={{ padding: '8px', fontSize: '11px' }}>
                              <div style={{ fontWeight: 700, marginBottom: 4, borderBottom: '1px solid #f0f0f0', paddingBottom: 2 }}>{t.agent.scoreBreakdown}</div>
                              {Object.entries(pb).map(([key, val]: [string, any]) => (
                                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                  <span style={{ textTransform: 'capitalize' }}>{key}:</span>
                                  <span style={{ fontWeight: 700, color: val >= 0 ? '#52c41a' : '#ff4d4f' }}>
                                    {val >= 0 ? '+' : ''}{val}
                                  </span>
                                </div>
                              ))}
                            </div>
                          );
                          return (
                            <Tooltip title={breakdownContent}>
                              <div style={{ width: '100%', cursor: 'help' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '11px' }}>
                                  <span style={{ color: '#8c8c8c', fontWeight: 600 }}>{t.agent.weight}</span>
                                  <span style={{ color: color, fontWeight: 800 }}>{ps}%</span>
                                </div>
                                <div className="continue-scan-priority-bar">
                                  <div style={{ 
                                    width: `${ps}%`, 
                                    height: '100%', 
                                    backgroundColor: color,
                                    transition: 'width 0.3s'
                                  }} />
                                </div>
                              </div>
                            </Tooltip>
                          );
                        },
                      },
                      {
                        title: t.agent.colRisk,
                        key: 'risk',
                        width: 100,
                        render: (record) => {
                          const risk = record.eventRisk || 'Medium';
                          const color = risk === 'Low' ? '#52c41a' : risk === 'Medium' ? '#faad14' : '#ff4d4f';
                          return (
                            <span style={{ 
                              fontSize: '11px', 
                              fontWeight: 700, 
                              color: color,
                              padding: '2px 8px',
                              backgroundColor: `${color}15`,
                              borderRadius: '4px',
                              textTransform: 'uppercase'
                            }}>
                              {risk}
                            </span>
                          );
                        },
                      },
                      {
                        title: t.agent.colPriceChg,
                        key: 'priceChange',
                        width: 120,
                        render: (record) => {
                          const price = record.price;
                          const chg = record.priceChangePct || record.changePct || 0;
                          const color = chg >= 0 ? '#52c41a' : '#ff4d4f';
                          return (
                            <div>
                              <div className="scanner-price-text">{price ? `$${price.toFixed(2)}` : 'N/A'}</div>
                              <div style={{ fontSize: '11px', color: color, fontWeight: 600, marginTop: 2 }}>
                                {chg >= 0 ? '▲' : '▼'} {chg >= 0 ? '+' : ''}{chg.toFixed(2)}%
                              </div>
                            </div>
                          );
                        },
                      },
                      {
                        title: t.agent.colSelectionReason,
                        key: 'reason',
                        width: 280,
                        render: (record) => (
                          <Tooltip title={record.selectionReason || record.scannerReason}>
                            <div className="continue-scan-selection-reason">
                              {record.selectionReason || record.scannerReason || 'N/A'}
                            </div>
                          </Tooltip>
                        ),
                      },
                      {
                        title: t.agent.colSource,
                        key: 'source',
                        width: 100,
                        render: (record) => (
                          <Tag color={record.reasonSource === 'AI' ? 'cyan' : 'orange'} style={{ fontSize: '10px', fontWeight: 700, margin: 0 }}>
                            {record.reasonSource === 'AI' ? 'AI Agent' : t.agent.localRules}
                          </Tag>
                        ),
                      },
                      {
                        title: t.agent.colData,
                        key: 'data',
                        width: 80,
                        render: (record) => {
                          const dq = record.dataQuality || 'PARTIAL';
                          const color = dq === 'GOOD' ? '#52c41a' : '#faad14';
                          return (
                            <Tooltip title={`${t.agent.qualityLabel}: ${dq} | ${t.agent.sourceLabel}: ${record.dataSource || 'N/A'}`}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'help' }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color }} />
                                <span style={{ fontSize: '10px', fontWeight: 700, color: '#8c8c8c' }}>{dq}</span>
                              </div>
                            </Tooltip>
                          );
                        },
                      }
                      ]}
                      />
                  <div className="continue-scan-pagination-wrapper">
                    <Pagination
                      total={preferredContinueScanList.length}
                      current={preferredContinuePage}
                      pageSize={10}
                      size="default"
                      showTotal={(total, range) => (
                        <span style={{ fontSize: '12px', color: '#8c8c8c' }}>
                          {t.agent.displaying} <strong>{range[0]}-{range[1]}</strong> {t.agent.of} <strong>{total}</strong> {t.agent.candidatesWord}
                        </span>
                      )}
                      onChange={(page) => setPreferredContinuePage(page)}
                    />
                  </div>

                  <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
                    <Alert
                      message={t.agent.selectionDisclosure}
                      type="info"
                      showIcon
                      style={{ fontSize: '12px', borderRadius: '8px' }}
                    />
                  </div>
                </div>
              );
            }

            // 状态4: continue scan完成但无结果
            if (continueScanStatus === 'completed' && preferredContinueScanList.length === 0) {
              return (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                  <ExclamationCircleOutlined style={{ fontSize: '48px', marginBottom: 16 }} />
                  <div style={{ fontSize: '14px' }}>{t.agent.noSuitableCandidates}</div>
                  <div style={{ fontSize: '12px', marginTop: 8 }}>
                    {t.agent.noBullishCandidatesMet}
                  </div>
                </div>
              );
            }

            // 状态5: continue scan错误
            if (continueScanStatus === 'error') {
              return (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                  <CloseCircleOutlined style={{ fontSize: '48px', marginBottom: 16, color: '#ff4d4f' }} />
                  <div style={{ fontSize: '14px', color: '#ff4d4f' }}>{t.agent.continueScanFailed}</div>
                  <div style={{ fontSize: '12px', marginTop: 8 }}>
                    {t.agent.continueScanError}
                  </div>
                </div>
              );
            }

            // 状态6: market scan完成但continue scan未开始
            const wasStopped = detailedScanStatus.currentStatus === 'stopped';
            return (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                <ClockCircleOutlined style={{ fontSize: '48px', marginBottom: 16 }} />
                <div style={{ fontSize: '14px' }}>{t.agent.readyToStartContinueScan}</div>
                <div style={{ fontSize: '12px', marginTop: 8 }}>
                  {wasStopped
                    ? t.agent.builtFromPartialResults.replace('{processed}', String(detailedScanStatus.processedCount)).replace('{total}', String(detailedScanStatus.totalCount))
                    : t.agent.marketScanCompletedResults.replace('{count}', String(marketScannerResults.length))}
                </div>
                <div style={{ fontSize: '11px', color: '#999', marginTop: 8 }}>
                  {t.agent.clickStartContinueScan}
                </div>
              </div>
            );
          })()}
        </Card>
        </div>
      </CollapsibleStageSection>

      {/* 3. Fine Scan */}
      <CollapsibleStageSection
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
          { label: t.agent.continueLabel.replace(':', ''), value: fineScanResults.filter((r: any) => r.decision === 'Continue').length, color: '#52c41a' },
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
                disabled={fineScanStatus === 'running' || preferredContinueScanList.length === 0 || pipelineRunning}
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
        <Card bodyStyle={{ padding: '24px' }} style={{ borderRadius: '12px', border: '1px solid #f0f0f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          {/* Header Summary Row */}
          <div className="fine-scan-header-summary" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '24px', 
            marginBottom: '24px', 
            padding: '12px 20px', 
            backgroundColor: '#fafafa', 
            borderRadius: '10px',
            border: '1px solid #f0f0f0'
          }}>
            {fineScanResults.length > 0 ? (() => {
              const total = fineScanResults.length;
              const contCount = fineScanResults.filter((r: any) => r.decision === 'Continue').length;
              const watchCount = fineScanResults.filter((r: any) => r.decision === 'Watch').length;
              const rejectCount = fineScanResults.filter((r: any) => r.decision === 'Reject').length;
              const needDataCount = fineScanResults.filter((r: any) => r.decision === 'NeedMoreData').length;
              return (
                <>
                  <div className="fine-scan-stat-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#8c8c8c', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.agent.candidatesLabel}</span>
                    <span style={{ fontWeight: 800, color: '#1f1f1f', fontSize: '18px' }}>{total}</span>
                  </div>
                  <Divider type="vertical" style={{ height: '24px', backgroundColor: '#e8e8e8' }} />
                  <div className="fine-scan-stat-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#8c8c8c', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase' }}>{t.agent.continueLabel}</span>
                    <Tag color="success" style={{ fontWeight: 800, margin: 0, fontSize: '14px', padding: '0 10px', borderRadius: '4px', lineHeight: '24px' }}>{contCount}</Tag>
                  </div>
                  <Divider type="vertical" style={{ height: '24px' }} />
                  <div className="fine-scan-stat-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#8c8c8c', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase' }}>{t.agent.watchLabel}</span>
                    <Tag color="warning" style={{ fontWeight: 800, margin: 0, fontSize: '14px', padding: '0 10px', borderRadius: '4px', lineHeight: '24px' }}>{watchCount}</Tag>
                  </div>
                  <Divider type="vertical" style={{ height: '24px' }} />
                  <div className="fine-scan-stat-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#8c8c8c', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase' }}>{t.agent.rejectLabel}</span>
                    <Tag color="error" style={{ fontWeight: 800, margin: 0, fontSize: '14px', padding: '0 10px', borderRadius: '4px', lineHeight: '24px' }}>{rejectCount}</Tag>
                  </div>
                  <Divider type="vertical" style={{ height: '24px' }} />
                  <div className="fine-scan-stat-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#8c8c8c', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase' }}>{t.agent.needDataLabel}</span>
                    <Tag color="orange" style={{ fontWeight: 800, margin: 0, fontSize: '14px', padding: '0 10px', borderRadius: '4px', lineHeight: '24px' }}>{needDataCount}</Tag>
                  </div>
                  <Divider type="vertical" style={{ height: '24px' }} />
                  <div className="fine-scan-stat-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                    <span style={{ color: '#8c8c8c', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase' }}>{t.agent.aiAgentLabel}</span>
                    <Tag color="cyan" style={{ fontWeight: 800, margin: 0, fontSize: '13px', padding: '0 10px', borderRadius: '4px', lineHeight: '24px', letterSpacing: '0.5px' }}>DEEPSEEK V3</Tag>
                  </div>
                </>
              );
            })() : (
              <div style={{ color: '#8c8c8c', fontSize: '14px', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 500 }}>
                <InfoCircleOutlined style={{ color: '#1890ff' }} />
                {fineScanStatus === 'idle' ? t.agent.systemReady : t.agent.awaitingInput}
              </div>
            )}
          </div>

          {/* Progress Panel */}
          {(fineScanStatus === 'running' || (fineScanStatus === 'stopped' && fineScanProgress > 0)) && (
            <div className="fine-scan-progress-panel" style={{ 
              marginBottom: '24px', 
              padding: '20px 24px', 
              background: '#fafafa', 
              borderRadius: '12px', 
              border: '1px solid #f0f0f0',
              boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: fineScanStatus === 'stopped' ? '#d48806' : '#003a8c', letterSpacing: '-0.2px' }}>
                    {fineScanStatus === 'stopped' ? t.agent.fineScanInterrupted : t.agent.scanningRegimeStrategies}
                  </div>
                  <div style={{ fontSize: '14px', color: fineScanStatus === 'stopped' ? '#d48806' : '#1890ff', marginTop: 4, fontWeight: 500 }}>
                    {fineScanMessage || t.agent.processingMarketData}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: fineScanStatus === 'stopped' ? '#d48806' : '#1890ff', lineHeight: 1, fontFamily: "'Inter', sans-serif" }}>
                    {fineScanProgress}%
                  </div>
                  <div style={{ fontSize: '11px', color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700, marginTop: 4 }}>
                    {fineScanStatus === 'stopped' ? t.agent.retained : t.agent.processProgress}
                  </div>
                </div>
              </div>
              <Progress
                percent={fineScanProgress}
                status={fineScanStatus === 'stopped' ? 'exception' : 'active'}
                strokeColor={fineScanStatus === 'stopped' ? '#d48806' : { '0%': '#1890ff', '100%': '#52c41a' }}
                strokeWidth={12}
                showInfo={false}
                style={{ borderRadius: '10px' }}
              />
            </div>
          )}

          {fineScanResults.length > 0 && (
            <>
            <style>{`
              .fine-scan-table .ant-table-thead > tr > th {
                font-size: 13px;
                font-weight: 700;
                color: #262626;
                background: #f5f7f9 !important;
                padding: 14px 16px !important;
                border-bottom: 2px solid #e1e4e8;
                text-transform: uppercase;
                letter-spacing: 0.4px;
              }
              .fine-scan-table .ant-table-tbody > tr > td {
                padding: 12px 16px !important;
                font-size: 13px;
                color: #434343;
              }
              .fine-scan-table .ant-table-tbody > tr:hover > td {
                background: #f8faff !important;
              }
              .fine-scan-table .ant-table-row {
                height: 52px;
              }
              .fine-scan-table .ant-table-expanded-row > td {
                background: #ffffff !important;
                padding: 0 !important;
              }
            `}</style>
            <Table
              className="fine-scan-table"
              dataSource={fineScanResults}
              rowKey="symbol"
              pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (total, range) => `${range[0]}-${range[1]} / ${total}`, style: { marginTop: '16px', paddingRight: '16px' } }}
              size="middle"
              scroll={{ x: 'max-content' }}
              expandable={{
                expandedRowRender: (record: any) => renderFineScanDetailPanel(record),
                rowExpandable: (record: any) => true,
                expandedRowKeys: fineScanExpandedRows,
                onExpand: (expanded: any, record: any) => {
                  if (expanded) {
                    setFineScanExpandedRows((prev: any) => [...prev, record.symbol]);
                  } else {
                    setFineScanExpandedRows((prev: any) => prev.filter((s: any) => s !== record.symbol));
                  }
                }
              }}
              columns={[
                {
                  title: t.agent.colSymbol,
                  key: 'symbol',
                  width: 90,
                  fixed: 'left',
                  render: (record) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Text strong style={{ fontSize: '15px', color: '#1890ff', letterSpacing: '-0.2px' }}>{record.symbol}</Text>
                      {record.isDevTest && <Tag color="error" style={{ fontSize: 9, padding: '0 4px', lineHeight: '14px', margin: 0, fontWeight: 700 }}>TEST</Tag>}
                    </div>
                  ),
                },
                // ===== Decision =====
                {
                  title: t.agent.colDecision,
                  key: 'decision',
                  width: 110,
                  render: (record) => {
                    const d = record.decision || '--';
                    let c = '#999', l = d;
                    const source = record.decisionSource || 'local-rule';
                    const sourceLabel = source === 'ai' ? 'AI' : t.agent.localRules;
                    const decisionMap: Record<string, string> = { 'Continue': t.agent.dvSourceContinue, 'Watch': t.agent.dvVerdictWatch, 'Reject': t.agent.dvVerdictRejected, 'NeedMoreData': t.agent.needDataLabel?.replace(':', '') || 'Need Data', 'Skip': t.agent.skip || 'Skip' };
                    if (d === 'Continue') { c = '#52c41a'; }
                    else if (d === 'Watch') { c = '#faad14'; }
                    else if (d === 'Reject') { c = '#ff4d4f'; }
                    else if (d === 'NeedMoreData') { c = '#fa8c16'; }
                    else if (d === 'Skip') { c = '#ff4d4f'; }
                    l = decisionMap[d] || d;
                    return (
                      <Tooltip title={`${t.agent.sourceLabel}: ${source}${record.decisionReason ? ' | ' + record.decisionReason : ''}`}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ color: c, fontSize: '13px', fontWeight: 700 }}>{l}</span>
                          <span style={{ fontSize: '10px', color: '#bfbfbf', fontWeight: 600, textTransform: 'uppercase' }}>{sourceLabel}</span>
                        </div>
                      </Tooltip>
                    );
                  },
                },
                // ===== Reason / Blocking =====
                {
                  title: t.agent.colWhy,
                  key: 'blockingReason',
                  width: 240,
                  render: (record: any) => {
                    const d = record.decision || '--';
                    const reason = record.decisionReason || '';
                    const blockers = record.decisionBlockers || [];
                    const warnings = record.decisionWarnings || [];
                    const parts: string[] = [];
                    if (d !== 'Continue' && blockers.length > 0) {
                      parts.push((t.agent.blockLabel || 'Block') + ': ' + blockers.slice(0, 2).join('; '));
                    }
                    if (warnings.length > 0) {
                      parts.push((t.agent.warnLabel || 'Warn') + ': ' + warnings.slice(0, 2).join('; '));
                    }
                    if (reason && parts.length === 0) {
                      parts.push(reason.length > 100 ? reason.slice(0, 100) + '...' : reason);
                    }
                    const text = parts.join(' | ') || (d === 'Continue' ? t.agent.pass : '-');
                    const color = d === 'Continue' ? '#52c41a' : d === 'Reject' ? '#ff4d4f' : '#595959';
                    return (
                      <Tooltip title={text}>
                        <span style={{ fontSize: '12px', color, lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontWeight: 500 }}>
                          {text}
                        </span>
                      </Tooltip>
                    );
                  },
                },
                // ===== Score =====
                {
                  title: t.agent.colScore,
                  key: 'score',
                  width: 100,
                  render: (record) => {
                    const s = record.score ?? record.matchConfidence;
                    if (s == null) return <Text style={{ fontSize: '13px', color: '#bbb' }}>-</Text>;
                    let c = '#ff4d4f';
                    if (s >= 80) c = '#52c41a';
                    else if (s >= 60) c = '#faad14';
                    else if (s >= 40) c = '#ff7a45';
                    const w = Math.min(100, Math.max(2, s));
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: c, minWidth: 28, fontFamily: "'Inter', sans-serif" }}>{s}</span>
                        <div style={{ width: 48, height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${w}%`, height: '100%', background: c, borderRadius: 3 }} />
                        </div>
                      </div>
                    );
                  },
                },
                // ===== Strategies =====
                {
                  title: t.agent.colStrategies,
                  key: 'strategies',
                  width: 220,
                  render: (record) => {
                    const strats = record.matchedStrategies || [];
                    if (strats.length === 0) return <Text style={{ fontSize: '13px', color: '#bbb' }}>-</Text>;
                    const display = strats.slice(0, 3).join(' · ');
                    const extra = strats.length > 3 ? ` +${strats.length - 3}` : '';
                    return (
                      <Tooltip title={strats.join(', ')}>
                        <span style={{ fontSize: '12px', color: '#595959', lineHeight: '1.5', fontWeight: 600 }}>
                          {display}{extra}
                        </span>
                      </Tooltip>
                    );
                  },
                },
                // ===== Liquidity =====
                {
                  title: t.agent.colLiquidity,
                  key: 'liquidity',
                  width: 100,
                  render: (record) => {
                    const lg = record.liquidityGrade || '-';
                    let c = '#bbb', l = '-';
                    if (lg === 'Good') { c = '#52c41a'; l = t.agent.goodData; }
                    else if (lg === 'Caution') { c = '#faad14'; l = t.agent.caution; }
                    else if (lg === 'Poor') { c = '#ff4d4f'; l = t.agent.poorRR; }
                    else if (lg === 'Error' || lg === 'Data Unavailable' || lg === 'Unknown') { c = '#bbb'; l = 'N/A'; }
                    else if (lg === 'Partial') { c = '#faad14'; l = t.agent.partialLabel; }
                    return <span style={{ color: c, fontSize: '13px', fontWeight: 700 }}>{l}</span>;
                  },
                },
                // ===== Entry =====
                {
                  title: t.agent.entry,
                  key: 'entry',
                  width: 120,
                  render: (record) => {
                    const eq = record.entryQuality || '-';
                    let c = '#999', l = '-';
                    if (eq === 'Excellent') { c = '#52c41a'; l = t.agent.excellent; }
                    else if (eq === 'Good') { c = '#73d13d'; l = t.agent.goodData; }
                    else if (eq === 'Wait for Pullback') { c = '#faad14'; l = t.agent.wait; }
                    else if (eq === 'Chasing / Extended') { c = '#ff7a45'; l = t.agent.extended; }
                    else if (eq === 'Near Resistance') { c = '#ff4d4f'; l = t.agent.nearRes; }
                    else if (eq === 'Poor Reward-Risk') { c = '#ff4d4f'; l = t.agent.poorRR; }
                    else if (eq === 'Partial') { c = '#b37feb'; l = t.agent.partialLabel; }
                    else if (eq === 'Data Unavailable' || eq === 'Error / No Data') { c = '#bbb'; l = t.agent.fineScanNoData; }
                    return <span style={{ color: c, fontSize: '13px', fontWeight: 700 }}>{l}</span>;
                  },
                },
                // ===== Validation =====
                {
                  title: t.agent.colValidation,
                  key: 'validation',
                  width: 160,
                  render: (record) => {
                    const ps = record.backtestPerformance || null;
                    let pc = '#999', pl = t.agent.pending;
                    if (ps === 'positive') { pc = '#52c41a'; pl = t.agent.positive; }
                    else if (ps === 'negative') { pc = '#ff4d4f'; pl = t.agent.negative; }
                    else if (ps === 'caution') { pc = '#faad14'; pl = t.agent.caution; }
                    const optStatus = record.quickOptStatus || 'not_run';
                    let stLabel = 'N/A', stColor = '#999';
                    if (optStatus === 'completed') {
                      const qr = record.quickOptResults || [];
                      if (qr.length > 0) {
                        const stable = qr.filter(function(r: any) { return r.stability === 'Stable'; }).length;
                        const weak = qr.filter(function(r: any) { return r.stability === 'Weak'; }).length;
                        const overfit = qr.filter(function(r: any) { return r.stability === 'Overfit Risk'; }).length;
                        if (stable >= qr.length * 0.7 || stable >= 2) { stLabel = t.agent.fineScanStable; stColor = '#52c41a'; }
                        else if (weak > overfit) { stLabel = t.agent.weak; stColor = '#faad14'; }
                        else if (overfit > 0) { stLabel = t.agent.overfit; stColor = '#ff4d4f'; }
                      }
                    }
                    return (
                      <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
                        <div>
                          <span style={{ color: '#8c8c8c', fontWeight: 500 }}>{t.agent.backtestLabelShort}</span>
                          <span style={{ color: pc, fontWeight: 700 }}>{pl}</span>
                        </div>
                        <div>
                          <span style={{ color: '#8c8c8c', fontWeight: 500 }}>{t.agent.optLabelShort}</span>
                          <span style={{ color: stColor, fontWeight: 700 }}>{stLabel}</span>
                        </div>
                      </div>
                    );
                  },
                },
                {
                  title: t.agent.colRisk,
                  key: 'risk',
                  width: 90,
                  render: (record) => {
                    const rg = record.riskGrade || '-';
                    let c = '#bbb', l = '-', dot = '';
                    if (rg === 'LOW') { c = '#52c41a'; l = t.agent.low; dot = '🟢'; }
                    else if (rg === 'MEDIUM') { c = '#faad14'; l = t.agent.medium; dot = '🟠'; }
                    else if (rg === 'HIGH') { c = '#ff4d4f'; l = t.agent.high; dot = '🔴'; }
                    else if (rg === 'SKIP') { c = '#ff4d4f'; l = t.agent.skipAction; dot = '⛔'; }
                    else { c = '#bbb'; l = 'N/A'; }
                    const riskReason = record.riskReason || '';
                    return <Tooltip title={riskReason}><span style={{ color: c, fontSize: '13px', fontWeight: 700 }}>{dot} {l}</span></Tooltip>;
                  },
                },
                // ===== Why Matched =====
                {
                  title: t.agent.colWhyMatched,
                  key: 'whyMatched',
                  width: 180,
                  render: (record) => {
                    const full = record.matchReason || '';
                    const truncated = full.length > 60 ? full.substring(0, 60) + '...' : full;
                    return (
                      <Tooltip title={record.matchAISource === 'ai-explain' ? t.agent.whyMatchedTooltip : t.agent.whyMatchedTemplate}>
                        <Text style={{ fontSize: '12px', color: '#434343', lineHeight: '1.5', fontWeight: 500 }}>
                          {truncated || '-'}
                          <span style={{ fontSize: '11px', color: '#bfbfbf', marginLeft: '4px' }}>
                            {record.matchAISource === 'ai-explain' ? '🤖' : '⚙️'}
                          </span>
                        </Text>
                      </Tooltip>
                    );
                  },
                },
                // ===== Grade =====
                {
                  title: t.agent.colGrade,
                  key: 'grade',
                  width: 80,
                  render: (record) => {
                    const g = record.fineScanGrade || null;
                    const getGrade = () => {
                      if (g === 'HIGH') return { l: t.agent.high, c: '#52c41a' };
                      if (g === 'MEDIUM') return { l: t.agent.medium, c: '#faad14' };
                      if (g === 'LOW') return { l: t.agent.low, c: '#ff4d4f' };
                      const btOk = record.backtestStatus === 'pass' && (record.backtestPerformance === 'positive' || record.backtestPerformance === 'caution');
                      const eqOk = record.entryQuality === 'Excellent' || record.entryQuality === 'Good' || record.entryQuality === 'Wait for Pullback';
                      const riskOk = record.riskGrade === 'LOW' || record.riskGrade === 'MEDIUM';
                      const scoreOk = (record.matchConfidence || 0) >= 30;
                      if (btOk && scoreOk && eqOk && riskOk) return { l: t.agent.high, c: '#52c41a' };
                      if (btOk && (record.matchConfidence || 0) >= 20) return { l: t.agent.medium, c: '#faad14' };
                      return { l: t.agent.low, c: '#ff4d4f' };
                    };
                    const res = getGrade();
                    return <span style={{ color: res.c, fontSize: '13px', fontWeight: 800, textTransform: 'uppercase' }}>{res.l}</span>;
                  },
                },
                // ===== Rank =====
                {
                  title: t.agent.colRank,
                  key: 'rank',
                  width: 65,
                  render: (record) => (
                    <Text style={{ fontSize: '14px', color: '#262626', fontWeight: 800, fontFamily: "'Inter', sans-serif" }}>
                      {record.priority != null ? (record.priority + 1) : '-'}
                    </Text>
                  ),
                }
              ]}
            />
            </>
          )}

          {fineScanStatus === 'completed' && fineScanResults.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>
              <Text>{t.agent.noCandidatesToAnalyze}</Text>
            </div>
          )}

          {fineScanStatus === 'error' && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#ff4d4f' }}>
              <CloseCircleOutlined style={{ fontSize: '24px', marginBottom: 8 }} />
              <div>{t.agent.errorDuringFineScan}</div>
            </div>
          )}

          {fineScanStatus === 'idle' && fineScanResults.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>
              <ThunderboltOutlined style={{ fontSize: '36px', marginBottom: 12, opacity: 0.4 }} />
              <div style={{ fontSize: '13px' }}>{t.agent.runFineScanToMatch}</div>
              <div style={{ fontSize: '11px', marginTop: 8, color: '#bbb' }}>
                {t.agent.step1Regime} &nbsp;|&nbsp; {t.agent.step3QuickBacktest}
              </div>
            </div>
          )}
        </Card>
      </CollapsibleStageSection>

      {/* ===== Deeper Validation ===== */}
      <CollapsibleStageSection
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
        summaryChips={(() => {
          const bd = validationCandidateBreakdown();
          if (deeperValidationResults) {
            return [
              { label: t.agent.validated, value: deeperValidationResults.length },
              { label: t.agent.pass, value: deeperValidationResults.filter((r: any) => r.riskGate?.status === 'PASS').length, color: '#52c41a' },
              { label: t.agent.blocked, value: deeperValidationResults.filter((r: any) => r.riskGate?.status === 'BLOCK').length, color: '#ff4d4f' },
            ];
          }
          if (bd.total > 0) {
            const chips: any[] = [
              { label: t.agent.continueAction, value: bd.continueCount, color: '#52c41a' },
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
        <div className="validation-section">
          <Card bodyStyle={{ padding: '20px' }} style={{ borderRadius: '12px', border: '1px solid #f0f0f0' }}>
            {/* Header Summary Row */}
            <div className="validation-header-summary">
              {deeperValidationResults ? (
                <>
                  <div className="validation-stat-item">
                    <span style={{ color: '#8c8c8c', fontWeight: 600 }}>{t.agent.candidatesLabel.replace(':', '')}:</span>
                    <span style={{ fontWeight: 800, color: '#1f1f1f' }}>{deeperValidationResults.length}</span>
                  </div>
                  <Divider type="vertical" />
                  <div className="validation-stat-item">
                    <span style={{ color: '#8c8c8c', fontWeight: 600 }}>{t.agent.riskGatePass}:</span>
                    <Tag color="success" style={{ fontWeight: 800, margin: 0 }}>
                      {deeperValidationResults.filter((r: any) => r.riskGate?.status === 'PASS').length}
                    </Tag>
                  </div>
                  <Divider type="vertical" />
                  <div className="validation-stat-item">
                    <span style={{ color: '#8c8c8c', fontWeight: 600 }}>{t.agent.confirmed}:</span>
                    <Tag color="processing" style={{ fontWeight: 800, margin: 0 }}>
                      {deeperValidationResults.filter((r: any) => r.verdict === 'Confirmed' || r.verdict === 'Pass').length}
                    </Tag>
                  </div>
                  <Divider type="vertical" />
                  <div className="validation-stat-item">
                    <span style={{ color: '#8c8c8c', fontWeight: 600 }}>{t.agent.systemMonteCarlo}:</span>
                    <Tag color="blue" style={{ fontWeight: 800, margin: 0 }}>{t.agent.monteCarloV2}</Tag>
                  </div>
                </>
              ) : (
                <div style={{ color: '#8c8c8c', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <InfoCircleOutlined />
                  {deeperValidationStatus === 'idle'
                    ? `${t.agent.readyForHistorical} ${selectValidationCandidates().length} ${t.agent.candidatesAvailable}`
                    : t.agent.systemPerformingValidation}
                </div>
              )}
            </div>

            {deeperValidationStatus === 'loading' && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <SyncOutlined spin style={{ fontSize: 32, color: '#1890ff', marginBottom: 16 }} />
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#003a8c' }}>{t.agent.runningDeeperValidation}</div>
                <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: 4 }}>{t.agent.backtestOptStability}</div>
              </div>
            )}

            {(deeperValidationStatus === 'completed' || deeperValidationStatus === 'stopped') && deeperValidationResults && (
              <div className="validation-table-container">
                <Table
                  dataSource={deeperValidationResults}
                  rowKey="symbol"
                  size="middle"
                  pagination={false}
                  scroll={{ x: 1600 }}
                  expandable={{
                    expandedRowRender: (record: any) => renderDVDetailPanel(record, t, language),
                    rowExpandable: () => true,
                    expandIcon: ({ expanded, onExpand, record }) => (
                      <Button
                        type="text"
                        size="small"
                        icon={expanded ? <ArrowDownOutlined /> : <ArrowRightOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          onExpand(record, e);
                        }}
                        style={{ padding: 0, width: 24, height: 24, color: '#bfbfbf' }}
                      />
                    )
                  }}
                  columns={[
                    {
                      title: t.agent.colSymbol,
                      key: 'symbol',
                      width: 100,
                      fixed: 'left',
                      render: (record: any) => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="scanner-symbol-text" style={{ color: '#1890ff' }}>{record.symbol}</span>
                          {record.isDevTest && <Tag color="error" style={{ fontSize: '8px', padding: '0 4px', lineHeight: '14px', margin: 0 }}>TEST</Tag>}
                        </div>
                      ),
                    },
                    {
                      title: t.agent.colSource,
                      key: 'selectedBy',
                      width: 100,
                      render: (record: any) => {
                        const src = record.selectedBy || 'Continue';
                        const isContinue = src === 'Continue';
                        return (
                          <Tag color={isContinue ? 'success' : 'warning'} style={{ fontSize: '9px', margin: 0, padding: '0 4px' }}>
                            {isContinue ? t.agent.dvSourceContinue : t.agent.dvSourceWatch}
                          </Tag>
                        );
                      },
                    },
                    {
                      title: t.agent.colReturn1Y,
                      key: 'totalReturn',
                      width: 100,
                      render: (record: any) => {
                        const tr = record.totalReturn;
                        if (tr == null) return <span style={{ color: '#bfbfbf' }}>N/A</span>;
                        const color = tr >= 0 ? '#52c41a' : '#ff4d4f';
                        return <span style={{ color, fontWeight: 800, fontSize: '12px' }}>{tr >= 0 ? '+' : ''}{tr.toFixed(1)}%</span>;
                      },
                    },
                    {
                      title: t.agent.colSharpe,
                      key: 'sharpeRatio',
                      width: 80,
                      render: (record: any) => {
                        const s = record.sharpeRatio ?? record.sharpe;
                        if (s == null) return <span style={{ color: '#bfbfbf' }}>-</span>;
                        const color = s >= 1.0 ? '#52c41a' : s >= 0.5 ? '#faad14' : '#ff4d4f';
                        return <span style={{ color, fontWeight: 700 }}>{s.toFixed(2)}</span>;
                      },
                    },
                    {
                      title: t.agent.colMaxDD,
                      key: 'maxDrawdown',
                      width: 90,
                      render: (record: any) => {
                        const mdd = Math.abs(record.maxDrawdown || 0);
                        const color = mdd <= 15 ? '#52c41a' : mdd <= 25 ? '#faad14' : '#ff4d4f';
                        return <span style={{ color, fontWeight: 600 }}>-{mdd.toFixed(1)}%</span>;
                      },
                    },
                    {
                      title: t.agent.colWinRate,
                      key: 'winRate',
                      width: 90,
                      render: (record: any) => {
                        const wr = record.winRate || 0;
                        const color = wr >= 55 ? '#52c41a' : wr >= 45 ? '#faad14' : '#ff4d4f';
                        return <span style={{ color, fontWeight: 700 }}>{wr.toFixed(0)}%</span>;
                      },
                    },
                    {
                      title: t.agent.colPFactor,
                      key: 'profitFactor',
                      width: 90,
                      render: (record: any) => {
                        const pf = record.profitFactor;
                        if (pf == null) return <span style={{ color: '#bfbfbf' }}>-</span>;
                        const color = pf >= 1.5 ? '#52c41a' : pf >= 1.0 ? '#faad14' : '#ff4d4f';
                        return <span style={{ color, fontWeight: 700 }}>{pf.toFixed(2)}</span>;
                      },
                    },
                    {
                      title: t.agent.colTrades,
                      key: 'tradeCount',
                      width: 80,
                      render: (record: any) => {
                        const tc = record.tradeCount ?? record.trades ?? 0;
                        const color = tc < 5 ? '#faad14' : '#595959';
                        return <span style={{ color, fontWeight: 600 }}>{tc}</span>;
                      },
                    },
                    {
                      title: t.agent.colStability,
                      key: 'stabilityScore',
                      width: 120,
                      render: (record: any) => {
                        const score = record.stabilityScore || 0;
                        const color = score >= 70 ? '#52c41a' : score >= 50 ? '#faad14' : '#ff4d4f';
                        return (
                          <div style={{ width: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, fontSize: '10px' }}>
                              <span style={{ fontWeight: 700, color }}>{score}</span>
                            </div>
                            <div style={{ height: 3, borderRadius: 2, backgroundColor: '#f0f0f0', overflow: 'hidden' }}>
                              <div style={{ width: `${score}%`, height: '100%', backgroundColor: color }} />
                            </div>
                          </div>
                        );
                      },
                    },
                    {
                      title: t.agent.colTrend,
                      key: 'trend',
                      width: 100,
                      render: (record: any) => {
                        const trendVal = record.recentVsLongTerm || 'N/A';
                        const trendMap: Record<string, string> = { 'Improving': t.agent.dvTrendImproving, 'Consistent': t.agent.dvTrendConsistent, 'Weakening': t.agent.dvTrendWeakening };
                        const color = trendVal === 'Improving' || trendVal === 'Consistent' ? 'blue' : trendVal === 'Weakening' ? 'warning' : 'error';
                        return <Tag className="validation-badge" color={color} style={{ margin: 0 }}>{trendMap[trendVal] || trendVal}</Tag>;
                      },
                    },
                    {
                      title: t.agent.colVerdict,
                      key: 'verdict',
                      width: 100,
                      render: (record: any) => {
                        const v = record.verdict || 'Review';
                        const verdictMap: Record<string, string> = { 'Confirmed': t.agent.dvVerdictConfirmed, 'Pass': t.agent.dvVerdictPass, 'Rejected': t.agent.dvVerdictRejected, 'Review': t.agent.dvVerdictReview, 'Watch': t.agent.dvVerdictWatch };
                        const color = (v === 'Confirmed' || v === 'Pass') ? 'success' : v === 'Rejected' ? 'error' : 'warning';
                        return <Tag className="validation-badge" color={color} style={{ margin: 0 }}>{verdictMap[v] || v}</Tag>;
                      },
                    },
                    {
                      title: t.agent.colRiskGate,
                      key: 'riskGate',
                      width: 100,
                      render: (record: any) => {
                        const rg = record.riskGate?.status || 'N/A';
                        const color = rg === 'PASS' ? 'success' : rg === 'BLOCK' ? 'error' : 'warning';
                        const rgDisplay = rg === 'N/A' ? t.agent.naLabel : rg === 'BLOCK' ? t.agent.gateBlocked : rg;
                        return (
                          <Tooltip title={record.riskGate?.reason}>
                            <Tag className="validation-badge" color={color} style={{ margin: 0, cursor: 'help' }}>{rgDisplay}</Tag>
                          </Tooltip>
                        );
                      },
                    },
                    {
                      title: t.agent.colAnalysisReason,
                      key: 'reason',
                      width: 250,
                      render: (record: any) => {
                        const reasonText = record.reason || '';
                        const translatedReason = language === 'zh-CN' && reasonText ? reasonText
                          .replace(/\bConfirmed\b/g, t.agent.dvReasonConfirmed)
                          .replace(/\bWatch\b/g, t.agent.dvReasonWatch)
                          .replace(/\bReject\b/g, t.agent.dvReasonReject)
                          .replace(/\bWeakening\b/g, t.agent.dvTrendWeakening)
                          .replace(/\brecent Weakening\b/g, t.agent.dvReasonRecentWeakening)
                          .replace(/\bparameter sets profitable\b/g, t.agent.dvReasonParamProfitable)
                          .replace(/\bmedian return\b/g, t.agent.dvReasonMedianReturn)
                          .replace(/\bmedian sharpe\b/g, t.agent.dvReasonMedianSharpe)
                          .replace(/\bprofit factor\b/gi, t.agent.dvReasonProfitFactor)
                          .replace(/\bsharpe\b/gi, t.agent.dvReasonSharpe)
                          .replace(/\breturn\b/gi, t.agent.dvReasonReturn)
                          .replace(/\bdrawdown\b/gi, t.agent.dvReasonDrawdown)
                          .replace(/\bwin rate\b/gi, t.agent.dvReasonWinRate)
                          .replace(/\btrades\b/gi, t.agent.dvReasonTrades)
                          .replace(/\bSample Limited\b/gi, t.agent.dvReasonSampleLimited)
                          .replace(/\bStable\b/g, t.agent.stableLabel)
                          .replace(/\bWeak\b/g, t.agent.weakLabel)
                          .replace(/\bModerate\b/g, t.agent.moderateLabel)
                          .replace(/\bcombinations tested\b/g, t.agent.testedCombos)
                          : reasonText;
                        return (
                        <Tooltip title={record.reason}>
                          <div className="validation-reason">
                            {translatedReason || t.agent.epNoDetailedAnalysis}
                          </div>
                        </Tooltip>
                        );
                      },
                    },
                    {
                      title: t.agent.colSrc,
                      key: 'dataSource',
                      width: 70,
                      render: (record: any) => (
                        <Tag style={{ fontSize: '9px', margin: 0, padding: '0 4px', textTransform: 'uppercase' }}>
                          {record.dataSource || 'N/A'}
                        </Tag>
                      ),
                    }
                  ]}
                />
              </div>
            )}

            {deeperValidationStatus === 'error' && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#ff4d4f' }}>
                <CloseCircleOutlined style={{ fontSize: '32px', marginBottom: 16 }} />
                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: 8 }}>{t.agent.validationFailed}</div>
                <div style={{ fontSize: '12px', color: '#888', maxWidth: 500, margin: '0 auto', lineHeight: 1.6 }}>
                  {dvErrorMessage || t.agent.checkBackendLogs}
                </div>
                {dvErrors.length > 0 && (
                  <div style={{ marginTop: 16, textAlign: 'left', maxWidth: 500, margin: '16px auto 0' }}>
                    <div style={{ fontSize: '11px', color: '#666', fontWeight: 600, marginBottom: 4 }}>{t.agent.failedSymbols}</div>
                    {dvErrors.slice(0, 8).map((e: any, i: number) => (
                      <div key={i} style={{ fontSize: '11px', color: '#999', padding: '2px 0' }}>
                        <span style={{ fontWeight: 600, color: '#ff4d4f' }}>{e.symbol}</span>
                        {e.step && <span style={{ color: '#bbb' }}> [{e.step}]</span>}
                        {`: ${e.message}`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {deeperValidationStatus === 'idle' && fineScanStatus === 'completed' && (() => {
              const bd = validationCandidateBreakdown();
              return (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                  <ClockCircleOutlined style={{ fontSize: '32px', marginBottom: 16, opacity: 0.5 }} />
                  <div style={{ fontSize: '14px' }}>
                    {bd.total} {t.agent.candidatesFromFineScan}
                    {bd.watchCount > 0 && (
                      <div style={{ fontSize: '12px', marginTop: 4, color: '#bbb' }}>
                        {bd.continueCount} {t.agent.continueAction} + {bd.watchCount} {t.agent.watchToValidate} ({t.agent.scoreGe50})
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {deeperValidationStatus === 'idle' && fineScanStatus !== 'completed' && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#bfbfbf' }}>
                <BarChartOutlined style={{ fontSize: '48px', marginBottom: 16, opacity: 0.2 }} />
                <div style={{ fontSize: '14px' }}>{t.agent.completeFineScanFirst}</div>
              </div>
            )}
          </Card>
        </div>
      </CollapsibleStageSection>

      {/* ▲▲▲ Above: Deeper Validation ▲▲▲ */}

      {/* ▲▲▲ Below: Entry Plan ▲▲▲ */}
      <CollapsibleStageSection
        title={t.agent.entryPlan}
        icon={<RobotOutlined />}
        statusText={
          entryPlanStatus === 'loading' ? t.agent.generatingLabel :
          entryPlanStatus === 'completed' ? t.agent.completedLabel :
          entryPlanStatus === 'stopped' ? t.agent.interruptedLabel2 :
          entryPlanStatus === 'error' ? t.agent.errorLabel : 'IDLE'
        }
        statusColor={
          entryPlanStatus === 'loading' ? 'processing' :
          entryPlanStatus === 'completed' ? 'success' :
          entryPlanStatus === 'stopped' ? 'warning' :
          entryPlanStatus === 'error' ? 'error' : 'default'
        }
        summaryChips={entryPlanResults ? [
          { label: t.agent.entryPlan, value: entryPlanResults.length },
          { label: t.agent.buyLabel, value: entryPlanResults.filter((p: any) => p.aiDecision === 'BUY').length, color: '#52c41a' },
        ] : undefined}
        actionButton={
          <Tooltip title={pipelineRunning ? t.agent.pipelineDisabled : !getEntryPlanCandidates().length ? t.agent.noConfirmedOrWatch : ''}>
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
          {/* No DV candidates yet */}
          {deeperValidationStatus !== 'completed' && deeperValidationStatus !== 'stopped' && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#bbb', fontSize: '12px', fontStyle: 'italic' }}>
              {t.agent.noValidatedCandidatesYet}
            </div>
          )}

          {/* DV done but no confirmed/watch candidates */}
          {(deeperValidationStatus === 'completed' || deeperValidationStatus === 'stopped') && getEntryPlanCandidates().length === 0 && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#bbb', fontSize: '12px', fontStyle: 'italic' }}>
              {t.agent.noConfirmedOrWatch}
            </div>
          )}

          {/* DV done, candidates available */}
          {(deeperValidationStatus === 'completed' || deeperValidationStatus === 'stopped') && getEntryPlanCandidates().length > 0 && entryPlanStatus === 'idle' && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#999', fontSize: '12px' }}>
              {getEntryPlanCandidates().length} {t.agent.validatedCandidatesReady} <strong>{t.agent.runEntryPlan}</strong> {t.agent.toGenerateEntryPlans}
            </div>
          )}

          {/* Loading */}
          {entryPlanStatus === 'loading' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
              <div style={{ marginTop: '8px', color: '#888', fontSize: '12px' }}>
                {t.agent.computingEntryZones}
              </div>
              <Progress
                type="line"
                percent={50}
                showInfo={false}
                strokeColor="#1890ff"
                style={{ maxWidth: '400px', margin: '12px auto 0' }}
              />
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
          {(entryPlanStatus === 'completed' || entryPlanStatus === 'stopped') && entryPlanResults && entryPlanResults.length > 0 && (
            <>
              {/* Summary stat blocks — compact key metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
                {/* Block 1: AI Decisions */}
                <div style={{ background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e8eaed', padding: '12px 14px' }}>
                  <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500, marginBottom: '6px' }}>{t.agent.aiDecisions}</div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#333', fontFamily: "'Inter', sans-serif", marginBottom: '6px' }}>
                    <span style={{ color: '#52c41a' }}>{entryPlanResults.filter(p => p.aiDecision === 'BUY').length} {t.agent.buyLabel}</span>
                    <span style={{ margin: '0 6px', color: '#ccc' }}>/</span>
                    <span style={{ color: '#fa8c16' }}>{entryPlanResults.filter(p => p.aiDecision === 'WATCH').length} {t.agent.epWatchLabel}</span>
                    <span style={{ margin: '0 6px', color: '#ccc' }}>/</span>
                    <span style={{ color: '#ff4d4f' }}>{entryPlanResults.filter(p => p.aiDecision === 'SKIP').length} {t.agent.skipLabel}</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#999', marginTop: '2px' }}>
                    {entryPlanResults[0]?.aiCalled ? (
                      <span style={{ color: '#52c41a' }}>{entryPlanResults[0]?.aiSource || 'AI'} / {entryPlanResults[0]?.aiModel || 'LLM'} ✓</span>
                    ) : (
                      <Tooltip title={entryPlanResults[0]?.aiError || 'No AI provider configured. Using Local Rules fallback.'}>
                        <span style={{ color: '#fa8c16', cursor: 'help' }}>{t.agent.localRulesNoAICall}</span>
                      </Tooltip>
                    )}
                  </div>
                </div>

                {/* Block 2: Risk Gate */}
                <div style={{ background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e8eaed', padding: '12px 14px' }}>
                  <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500, marginBottom: '6px' }}>{t.agent.riskReview}</div>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'baseline' }}>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: 600, color: '#52c41a', fontFamily: "'Inter', sans-serif", lineHeight: '1.2' }}>
                        {entryPlanResults.filter(p => p.hardRiskGate?.status === 'PASS').length}
                      </div>
                      <div style={{ fontSize: '10px', color: '#888' }}>{t.agent.passed}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: 600, color: '#fa8c16', fontFamily: "'Inter', sans-serif", lineHeight: '1.2' }}>
                        {entryPlanResults.filter(p => p.hardRiskGate?.status === 'REVIEW').length}
                      </div>
                      <div style={{ fontSize: '10px', color: '#888' }}>{t.agent.review}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: 600, color: '#ff4d4f', fontFamily: "'Inter', sans-serif", lineHeight: '1.2' }}>
                        {entryPlanResults.filter(p => p.hardRiskGate?.status === 'BLOCK').length}
                      </div>
                      <div style={{ fontSize: '10px', color: '#888' }}>{t.agent.blocked}</div>
                    </div>
                  </div>
                </div>

                {/* Block 3: Trade Readiness */}
                <div style={{ background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e8eaed', padding: '12px 14px' }}>
                  <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500, marginBottom: '6px' }}>{t.agent.tradeReadiness}</div>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'baseline' }}>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: 600, color: '#52c41a', fontFamily: "'Inter', sans-serif", lineHeight: '1.2' }}>
                        {entryPlanResults.filter(p => p.tradeReadiness === 'READY').length}
                      </div>
                      <div style={{ fontSize: '10px', color: '#888' }}>{t.agent.ready}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: 600, color: '#fa8c16', fontFamily: "'Inter', sans-serif", lineHeight: '1.2' }}>
                        {entryPlanResults.filter(p => p.tradeReadiness === 'WAIT').length}
                      </div>
                      <div style={{ fontSize: '10px', color: '#888' }}>{t.agent.waitLabel}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: 600, color: '#ff4d4f', fontFamily: "'Inter', sans-serif", lineHeight: '1.2' }}>
                        {entryPlanResults.filter(p => p.tradeReadiness === 'BLOCKED').length}
                      </div>
                      <div style={{ fontSize: '10px', color: '#888' }}>{t.agent.blockedLabel}</div>
                    </div>
                  </div>
                </div>

                {/* Block 4: Execution Mode */}
                <div style={{ background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e8eaed', padding: '12px 14px' }}>
                  <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500, marginBottom: '6px' }}>{t.agent.execution}</div>
                  <div style={{ fontSize: '12px', fontWeight: 500, color: '#555', fontFamily: "'Inter', sans-serif", marginBottom: '4px' }}>
                    {pipelineMode === 'ai'
                      ? t.agent.aiModeLiveConfirm
                      : pipelineMode === 'hybrid'
                        ? t.agent.hybridModeManual
                        : t.agent.manualModeRecommendations}
                  </div>
                  <div style={{ fontSize: '10px', color: '#999' }}>
                    {pipelineMode === 'ai'
                      ? t.agent.paperPreviewOnly
                      : pipelineMode === 'hybrid'
                        ? t.agent.noAutomaticOrders
                        : t.agent.manualOnly}
                  </div>
                </div>
              </div>

              {/* Execution mode warning for Real Trading — only in Hybrid/Manual modes */}
              {pipelineMode !== 'ai' && entryPlanExecutionMode === 'Real Trade if Triggered' && (
                <Alert
                  message={t.agent.realTradingRequiresConfirm}
                  type="warning"
                  showIcon
                  style={{ marginBottom: '16px', marginTop: '8px', fontSize: '12px', padding: '8px 16px' }}
                />
              )}

              {/* Main table */}
              <div className="entry-plan-table-wrapper" style={{ width: '100%', overflowX: 'auto', paddingBottom: '12px' }}>
                <Table
                  dataSource={entryPlanResults}
                  rowKey="symbol"
                  size="small"
                  pagination={false}
                  expandable={{
                    expandedRowKeys: expandedEntryPlanSymbol ? [expandedEntryPlanSymbol] : [],
                    onExpand: (expanded, record) => {
                      setExpandedEntryPlanSymbol(expanded ? record.symbol : null);
                    },
                    expandedRowRender: (record) => {
                      const ep = record;
                      const rg = ep.hardRiskGate || {};
                      const dq = ep.dataQuality || 'PARTIAL';
                      const ds = ep.dataSources || {};
                      const ed = ep.executionDetails || {};
                      const fontStk = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

                      const fmtPrice = (v: number | null | undefined) => v != null ? `$${v.toFixed(2)}` : '—';
                      const fmtPct = (v: number | null | undefined) => v != null ? `${v.toFixed(1)}%` : '—';
                      const fmtRR = (v: number | null | undefined) => v != null ? `${v.toFixed(1)}:1` : '—';
                      const fmtDollars = (v: number | null | undefined) => v != null ? `$${v.toFixed(0)}` : '—';
                      const fmtShares = (v: number | null | undefined) => v != null ? v.toLocaleString() : '—';

                      const sym = record.symbol || '—';
                      const setupLabel = ep.setup || '—';
                      const aiDecision = ep.aiDecision || '—';
                      const finalAction = ep.finalAction || '—';
                      const confidence = ep.confidence || ep.aiConfidence || '—';
                      const tradeReadiness = ep.tradeReadiness || '—';

                      const aiColor = (v: string) => v === 'BUY' ? '#52c41a' : v === 'WATCH' ? '#d48806' : v === 'SKIP' ? '#e84749' : undefined;
                      const dqColor = dq === 'GOOD' ? '#52c41a' : dq === 'PARTIAL' ? '#fa8c16' : '#ff4d4f';
                      const trColor = tradeReadiness === 'READY' ? '#52c41a' : tradeReadiness === 'WAIT' ? '#fa8c16' : '#ff4d4f';
                      const rgColor = rg.status === 'PASS' ? '#52c41a' : rg.status === 'REVIEW' ? '#fa8c16' : '#ff4d4f';
                      const faColor = finalAction === 'BUY_READY' ? '#52c41a' : finalAction === 'WAIT_FOR_ENTRY' ? '#fa8c16' : '#ff4d4f';

                      const curPrice = ep.currentPrice || ep.price;
                      const loPrice = ep.entryLow || ep.entryZoneLow;
                      const hiPrice = ep.entryHigh || ep.entryZoneHigh;
                      let distText = '—';
                      let distColor = '#8c8c8c';
                      if (curPrice && loPrice && hiPrice) {
                        if (curPrice < loPrice) {
                          const diff = loPrice - curPrice;
                          const pct = (diff / curPrice) * 100;
                          distText = t.agent.belowEntry.replace('${diff}', `$${diff.toFixed(2)}`).replace('{pct}', pct.toFixed(1)); // eslint-disable-line no-template-curly-in-string
                          distColor = '#fa8c16';
                        } else if (curPrice > hiPrice) {
                          const diff = curPrice - hiPrice;
                          const pct = (diff / hiPrice) * 100;
                          distText = t.agent.aboveEntry.replace('${diff}', `$${diff.toFixed(2)}`).replace('{pct}', pct.toFixed(1)); // eslint-disable-line no-template-curly-in-string
                          distColor = '#fa8c16';
                        } else {
                          distText = t.agent.inEntryZone;
                          distColor = '#52c41a';
                        }
                      }

                      const SectionHeader = ({ title, color }: { title: string; color?: string }) => (
                        <div style={{ 
                          fontSize: '12px', 
                          fontWeight: 700, 
                          color: color || '#595959', 
                          textTransform: 'uppercase', 
                          letterSpacing: '0.6px', 
                          marginBottom: '10px', 
                          paddingBottom: '6px', 
                          borderBottom: '1px solid #f0f2f5',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          {title}
                        </div>
                      );

                      const Label = ({ text }: { text: string }) => (
                        <span style={{ fontSize: '11px', color: '#8c8c8c', fontWeight: 500 }}>{text}</span>
                      );
                      
                      const Value = ({ v, bold, color, subText }: { v: string; bold?: boolean; color?: string; subText?: string }) => (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '12px', fontWeight: bold ? 700 : 500, color: color || '#262626' }}>{v}</span>
                          {subText && <span style={{ fontSize: '10px', color: '#8c8c8c', marginTop: '1px' }}>{subText}</span>}
                        </div>
                      );

                      const ActionBadge = ({ label, color }: { label: string; color: string }) => (
                        <span style={{ 
                          backgroundColor: `${color}15`, 
                          color: color, 
                          padding: '2px 8px', 
                          borderRadius: '4px', 
                          fontSize: '10px', 
                          fontWeight: 700,
                          border: `1px solid ${color}30`,
                          textTransform: 'uppercase'
                        }}>
                          {label}
                        </span>
                      );

                      return (
                        <div style={{ 
                          padding: '16px', 
                          background: '#f8fafc', 
                          border: '1px solid #e5e7eb', 
                          borderRadius: '10px', 
                          fontFamily: fontStk, 
                          lineHeight: '1.4',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                        }}>
                          {/* ── Professional Header ── */}
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            paddingBottom: '12px', 
                            borderBottom: '1px solid #e5e7eb', 
                            marginBottom: '16px' 
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ fontSize: '18px', fontWeight: 800, color: '#111827', letterSpacing: '-0.2px' }}>{sym}</span>
                              <Tag color={setupLabel.includes('Pullback') ? 'gold' : setupLabel.includes('Breakout') ? 'purple' : setupLabel.includes('Range') ? 'green' : 'blue'} 
                                   style={{ fontSize: '11px', fontWeight: 600, borderRadius: '4px', margin: 0 }}>
                                {setupLabel}
                              </Tag>
                              <Tag color={aiDecision === 'BUY' ? 'success' : aiDecision === 'WATCH' ? 'warning' : 'error'} 
                                   style={{ fontSize: '11px', fontWeight: 700, borderRadius: '4px', margin: 0 }}>
                                AI: {aiDecision}
                              </Tag>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', backgroundColor: '#f3f4f6', padding: '2px 8px', borderRadius: '4px' }}>
                                Confidence {confidence}%
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ display: 'flex', gap: '6px', marginRight: '8px' }}>
                                <ActionBadge label={`Data: ${dq}`} color={dqColor} />
                                <ActionBadge label={`Gate: ${rg.status || 'N/A'}`} color={rgColor} />
                                <ActionBadge label={finalAction} color={faColor} />
                              </div>
                              <Space size={8}>
                                <Button
                                  size="middle"
                                  type={finalAction === 'BUY_READY' ? 'primary' : finalAction === 'READY_REVIEW' ? 'primary' : 'default'}
                                  ghost={finalAction === 'READY_REVIEW' && pipelineMode !== 'ai'}
                                  danger={finalAction === 'BLOCKED_BY_RISK'}
                                  disabled={finalAction === 'SKIP' || finalAction === 'BLOCKED_BY_RISK' || dq === 'POOR'}
                                  onClick={() => handleEntryPlanAction(ep)}
                                  style={{
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    borderRadius: '6px',
                                    height: '32px'
                                  }}
                                >
                                  {finalAction === 'BUY_READY' ? t.agent.epExecuteTrade : finalAction === 'READY_REVIEW' ? t.agent.reviewAndExecute : finalAction === 'WAIT_FOR_ENTRY' ? t.agent.epMonitorEntry : finalAction === 'SKIP' ? t.agent.planSkipped : t.agent.epRiskBlocked}
                                </Button>
                                <Button
                                  size="middle"
                                  icon={isInWatchlist(ep.symbol) ? <CheckOutlined /> : <PlusOutlined />}
                                  onClick={() => addToWatchlist(ep)}
                                  style={{
                                    fontSize: '12px', 
                                    fontWeight: 600,
                                    borderRadius: '6px',
                                    height: '32px',
                                    color: isInWatchlist(ep.symbol) ? '#52c41a' : '#2563eb',
                                    borderColor: isInWatchlist(ep.symbol) ? '#52c41a' : '#2563eb',
                                    backgroundColor: isInWatchlist(ep.symbol) ? '#f0fdf4' : '#eff6ff'
                                  }}
                                >
                                  {isInWatchlist(ep.symbol) ? t.agent.inWatchlist : t.agent.addToWatchlist}
                                </Button>
                              </Space>
                            </div>
                          </div>

                          {/* ── 4-Card Balanced Grid ── */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>

                            {/* A. Execution Plan */}
                            <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                              <SectionHeader title={t.agent.executionPlan} />
                              <div style={{ display: 'grid', gridTemplateColumns: '95px 1fr', gap: '8px 12px', alignItems: 'baseline' }}>
                                <Label text={t.agent.epCurrentPrice} /><Value v={curPrice != null ? `$${curPrice.toFixed(2)}` : '—'} bold color="#111827" />
                                <Label text={t.agent.distance} /><Value v={distText} color={distColor} bold />
                                <Label text={t.agent.entryZone} /><Value v={loPrice != null ? `$${loPrice.toFixed(2)} – $${(hiPrice ?? 0).toFixed(2)}` : '—'} bold color="#111827" />
                                <Label text={t.agent.epTrigger} /><Value v={ep.triggerCondition || '—'} color="#4b5563" />
                                <Label text={t.agent.stopLoss} /><Value v={fmtPrice(ep.stopLoss)} bold color="#dc2626" subText={`${ep.stopLossPct != null ? fmtPct(ep.stopLossPct) : 'N/A'} ${t.agent.fromEntry} ${ep.stopSource || 'entry'}`} />
                                <Label text={t.agent.epTargets} />
                                <div style={{ display: 'flex', gap: '16px' }}>
                                  <Value v={fmtPrice(ep.takeProfit1)} bold color="#16a34a" subText={`T1 (R/R ${fmtRR(ep.riskReward1)})`} />
                                  <Value v={fmtPrice(ep.takeProfit2)} color="#16a34a" subText={`T2 (R/R ${fmtRR(ep.riskReward2)})`} />
                                </div>
                                <Label text={t.agent.epInvalidation} /><Value v={ep.invalidationCondition || '—'} color="#dc2626" />
                                <Label text={t.agent.orderTypeSuggestion} /><Value v={ed.orderTypeSuggestion || 'N/A'} bold color={ed.orderTypeSuggestion === 'Not Available' ? '#dc2626' : '#16a34a'} subText={ed.orderTypeReason} />
                              </div>
                            </div>

                            {/* B. Position & Risk */}
                            <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                              <SectionHeader title={t.agent.positionRisk} />
                              <div style={{ display: 'grid', gridTemplateColumns: '95px 1fr', gap: '8px 12px', alignItems: 'baseline' }}>
                                <Label text={t.agent.epPortfolio} /><Value v={fmtDollars(ep.positionCapital)} bold />
                                <Label text={t.agent.epBuyingPower} /><Value v={fmtDollars(ep.accountBuyingPower)} />
                                <Label text={t.agent.riskBudget} /><Value v={fmtDollars(ep.riskBudget)} subText={`${fmtPct(ep.riskPct)} ${t.agent.ofRiskBudget}`} />
                                <Label text={t.agent.actualRisk} /><Value v={fmtDollars(ep.riskDollars)} bold color="#dc2626" />
                                <Label text={t.agent.riskUsed} /><Value v={ep.riskUsedPct != null ? `${ep.riskUsedPct.toFixed(1)}%` : (ep.riskBudget > 0 ? `${(ep.riskDollars / ep.riskBudget * 100).toFixed(1)}%` : '—')} bold color={ep.riskUsedPct > 80 ? '#dc2626' : '#d97706'} subText={t.agent.ofRiskBudget} />
                                <Label text={t.agent.size} />
                                <div style={{ display: 'flex', gap: '16px' }}>
                                  <Value v={fmtShares(ep.positionSize || ep.positionSizeShares)} bold subText={t.agent.sharesLabel} />
                                  <Value v={fmtDollars(ep.positionValue || ep.positionSizeDollars)} bold subText={t.agent.estValue} />
                                </div>
                                <Label text={t.agent.capStatus} /><Value v={ep.positionCapStatus || (ep.positionCapped ? `${t.agent.cappedAt} ${fmtPct(ep.positionPct)}` : `${t.agent.okAt.replace('{pct}', fmtPct(ep.positionPct))}`)} bold color={ep.positionCapped ? '#d97706' : '#16a34a'} />
                              </div>
                            </div>

                            {/* C. Decision */}
                            <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                              <SectionHeader title={t.agent.decision} />
                              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '8px 12px', alignItems: 'baseline' }}>
                                <Label text={t.agent.epAIDecision} /><Value v={ep.aiDecision || '—'} color={aiColor(ep.aiDecision)} bold />
                                <Label text={t.agent.epConfidence} /><Value v={`${confidence}%`} bold />
                                <Label text={t.agent.epRiskGate} /><Value v={rg.status || 'N/A'} color={rgColor} bold />
                                <Label text={t.agent.finalAction} /><Value v={finalAction} color={faColor} bold />
                                <Label text={t.agent.tradeReadinessLabel} /><Value v={tradeReadiness} color={trColor} bold />
                                <Label text={t.agent.entryTrigger} /><Value v={ep.entryTriggerMet ? t.agent.readyOrWaiting : t.agent.waiting} color={ep.entryTriggerMet ? '#16a34a' : '#d97706'} bold />
                                <Label text={t.agent.bestStrategy} /><Value v={ep.bestStrategy || '—'} />
                              </div>
                            </div>

                            {/* D. Data Quality */}
                            <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                              <SectionHeader title={t.agent.dataQualityCard} color={dqColor} />
                              <div style={{ display: 'grid', gridTemplateColumns: '95px 1fr', gap: '8px 12px', alignItems: 'baseline' }}>
                                <Label text={t.agent.marketDataLabel} /><Value v={ds.marketData || 'N/A'} bold />
                                <Label text={t.agent.accountData} /><Value v={ds.accountData || 'N/A'} />
                                <Label text={t.agent.aiProviderLabel} />
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  {ep.aiCalled ? (
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#16a34a' }}>{ep.aiSource || 'AI'} ({ep.aiModel || 'LLM'}) <CheckOutlined style={{ fontSize: '10px' }} /></span>
                                  ) : (
                                    <Tooltip title={ep.aiError || t.agent.noAIProviderConfigured}>
                                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#d97706', cursor: 'help', borderBottom: '1px dotted #d97706' }}>{t.agent.localRulesFallback}</span>
                                    </Tooltip>
                                  )}
                                </div>
                                <Label text={t.agent.broker} /><Value v={ed.brokerSource || t.agent.notConnected} bold color={ed.brokerConnected ? '#16a34a' : '#dc2626'} />
                                {ep.aiError && <><Label text={t.agent.aiErrorLabel} /><Value v={ep.aiError} color="#dc2626" /></>}
                              </div>
                            </div>
                          </div>

                          {/* ── Bottom Text Insights ── */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderTop: '1px solid #e5e7eb', paddingTop: '12px' }}>
                            {/* Left: Decision Reason + Next Step */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <div>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
                                  {t.agent.decisionReason} {ep.aiCalled ? '(AI)' : `(${t.agent.epLocalRules})`}
                                </div>
                                <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.6', background: '#fff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #f3f4f6' }}>
                                  {ep.decisionReason || ep.reason || t.agent.noDetailedReasoning}
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>{t.agent.nextStep}</div>
                                <div style={{ fontSize: '13px', color: '#1d4ed8', lineHeight: '1.5', fontWeight: 600, paddingLeft: '4px' }}>
                                  → {ep.nextStep || t.agent.waitForFurtherSignals}
                                </div>
                              </div>
                              {ep.riskComment && (
                                <div style={{ background: '#fff7ed', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ffedd5' }}>
                                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>{t.agent.riskComment}</div>
                                  <div style={{ fontSize: '12px', color: '#9a3412', lineHeight: '1.5' }}>{ep.riskComment}</div>
                                </div>
                              )}
                            </div>

                            {/* Right: Risk Notes + Blockers */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <div>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>{t.agent.riskAssessment}</div>
                                <div style={{ background: '#fff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #f3f4f6', minHeight: '60px' }}>
                                  {(() => {
                                    const warnings = rg.warnings || [];
                                    if (warnings.length === 0) return <div style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '12px' }}>{t.agent.noRiskWarnings}</div>;
                                    return warnings.slice(0, 4).map((r: string, i: number) => (
                                      <div key={i} style={{ marginBottom: '3px', color: '#4b5563', fontSize: '12px', display: 'flex', gap: '6px' }}>
                                        <span style={{ color: '#f59e0b' }}>•</span> <span>{r}</span>
                                      </div>
                                    ));
                                  })()}
                                </div>
                              </div>
                              
                              {(ep.blockers || rg.blockers || []).length > 0 && (
                                <div style={{ background: '#fef2f2', padding: '8px 12px', borderRadius: '6px', border: '1px solid #fee2e2' }}>
                                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>{t.agent.criticalBlockers}</div>
                                  {(() => {
                                    const blockers = ep.blockers || rg.blockers || [];
                                    return blockers.slice(0, 4).map((r: string, i: number) => (
                                      <div key={i} style={{ marginBottom: '2px', color: '#991b1b', fontSize: '12px', fontWeight: 500, display: 'flex', gap: '6px' }}>
                                        <span>✕</span> <span>{r}</span>
                                      </div>
                                    ));
                                  })()}
                                </div>
                              )}

                              {ep.invalidationComment && (
                                <div style={{ fontSize: '12px', color: '#b91c1c', borderLeft: '3px solid #f87171', paddingLeft: '8px', marginTop: '4px' }}>
                                  <span style={{ fontWeight: 700 }}>{t.agent.invalidationLabel}</span> {ep.invalidationComment}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    },
                  }}
                  columns={[
                    {
                      title: t.agent.colSymbol,
                      dataIndex: 'symbol',
                      key: 'symbol',
                      width: 140,
                      fixed: 'left',
                      render: (text, record) => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '1px 0' }}>
                          <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.1px' }}>{text}</span>
                          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                            {record.isDevTest && <Tag style={{ fontSize: 9, padding: '0 4px', lineHeight: '16px', margin: 0, fontWeight: 800 }} color="error">DEV</Tag>}
                            {record.dataQuality === 'PARTIAL' && <Tag style={{ fontSize: '9px', padding: '0 4px', lineHeight: '16px', margin: 0, fontWeight: 800 }} color="gold">P</Tag>}
                            {record.aiCalled === false && (
                              <Tooltip title="Local Rules — no LLM call.">
                                <Tag style={{ fontSize: '9px', padding: '0 4px', lineHeight: '16px', margin: 0, fontWeight: 800, cursor: 'help' }} color="default">LR</Tag>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      ),
                    },
                    {
                      title: t.agent.colSetup,
                      dataIndex: 'setup',
                      key: 'setup',
                      width: 130,
                      render: (text) => {
                        const colors: Record<string, string> = { 'Pullback Entry': 'gold', 'Breakout Entry': 'purple', 'Range Support Entry': 'green', 'Watch Only': 'blue', 'No Trade': 'red' };
                        return <Tag color={colors[text] || 'default'} bordered={false} style={{ fontSize: '10.5px', fontWeight: 800, padding: '0 8px', lineHeight: '22px', borderRadius: '6px', margin: 0 }}>{text?.toUpperCase() || '-'}</Tag>;
                      },
                    },
                    {
                      title: t.agent.colCurrent,
                      key: 'currentPrice',
                      width: 110,
                      render: (record) => {
                        const p = record.currentPrice || record.price;
                        const lo = record.entryLow || record.entryZoneLow;
                        const hi = record.entryHigh || record.entryZoneHigh;
                        if (!p) return <span style={{ fontSize: '11px', color: '#bbb' }}>N/A</span>;
                        
                        let distShort = '';
                        let distColor = '#aaa';
                        if (lo && hi) {
                          if (p < lo) {
                            const pct = ((lo - p) / p) * 100;
                            distShort = `-${pct.toFixed(1)}%`;
                            distColor = '#f59e0b';
                          } else if (p > hi) {
                            const pct = ((p - hi) / hi) * 100;
                            distShort = `+${pct.toFixed(1)}%`;
                            distColor = '#f59e0b';
                          } else {
                            distShort = t.agent.inZone;
                            distColor = '#10b981';
                          }
                        }
                        
                        return (
                          <div style={{ lineHeight: '1.3' }}>
                            <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>${p.toFixed(2)}</div>
                            {distShort && <div style={{ fontSize: '10px', color: distColor, fontWeight: 800, letterSpacing: '0.2px' }}>{distShort}</div>}
                          </div>
                        );
                      },
                    },
                    {
                      title: t.agent.colEntryZone,
                      key: 'entryZone',
                      width: 150,
                      render: (record) => {
                        const lo = record.entryLow || record.entryZoneLow;
                        const hi = record.entryHigh || record.entryZoneHigh;
                        if (lo == null || hi == null || (lo === 0 && hi === 0)) {
                          return <span style={{ fontSize: '11px', color: '#bbb', fontStyle: 'italic' }}>N/A</span>;
                        }
                        return (
                          <div style={{ lineHeight: '1.3' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>${lo.toFixed(2)} – ${hi.toFixed(2)}</div>
                            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Entry Zone</div>
                          </div>
                        );
                      },
                    },
                    {
                      title: t.agent.colStop,
                      key: 'stopLoss',
                      width: 120,
                      render: (record) => {
                        const v = record.stopLoss;
                        const pct = record.stopLossPct;
                        if (v == null || v === 0) return <span style={{ fontSize: '11px', color: '#bbb' }}>-</span>;
                        return (
                          <div style={{ lineHeight: '1.3' }}>
                            <div style={{ fontSize: '13px', fontWeight: 800, color: '#ef4444' }}>${v.toFixed(2)}</div>
                            {pct != null && pct > 0 && <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>{pct.toFixed(1)}% RISK</div>}
                          </div>
                        );
                      },
                    },
                    {
                      title: t.agent.colTargets,
                      key: 'targets',
                      width: 140,
                      render: (record) => {
                        const t1 = record.takeProfit1;
                        const rr1 = record.riskReward1 || 0;
                        if (t1 == null || t1 === 0) return <span style={{ fontSize: '11px', color: '#bbb' }}>-</span>;
                        return (
                          <div style={{ lineHeight: '1.3' }}>
                            <div style={{ fontSize: '13px', fontWeight: 800, color: '#10b981' }}>${t1.toFixed(2)}</div>
                            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>R/R {rr1.toFixed(1)}x</div>
                          </div>
                        );
                      },
                    },
                    {
                      title: t.agent.colPosition,
                      key: 'position',
                      width: 120,
                      render: (record) => {
                        const sh = record.positionSize || record.positionSizeShares || 0;
                        const val = record.positionValue || record.positionSizeDollars || 0;
                        if (sh === 0 && val === 0) return <span style={{ fontSize: '11px', color: '#bbb' }}>-</span>;
                        return (
                          <div style={{ lineHeight: '1.3' }}>
                            <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#3b82f6' }}>{sh} SHARES</div>
                            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>${val.toFixed(0)} EST.</div>
                          </div>
                        );
                      },
                    },
                    {
                      title: t.agent.colAIDecision,
                      key: 'aiDecision',
                      width: 110,
                      render: (record) => {
                        const d = record.aiDecision;
                        if (!d) return <span style={{ fontSize: '11px', color: '#bbb' }}>-</span>;
                        const tagColor = d === 'BUY' ? 'success' : d === 'WATCH' ? 'warning' : 'error';
                        return (
                          <div>
                            <Tag color={tagColor} bordered={false} style={{ fontSize: '10.5px', fontWeight: 800, padding: '0 8px', lineHeight: '22px', borderRadius: '6px', margin: 0 }}>{d}</Tag>
                            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, marginTop: 2 }}>{record.confidence != null ? `${record.confidence}% CONF` : ''}</div>
                          </div>
                        );
                      },
                    },
                    {
                      title: t.agent.colGate,
                      key: 'riskGate',
                      width: 100,
                      render: (record) => {
                        const rg = record.riskGate || record.hardRiskGate;
                        const status = rg?.status;
                        if (!status) return <span style={{ fontSize: '11px', color: '#ccc' }}>N/A</span>;
                        const tagColor = status === 'PASS' ? 'success' : status === 'REVIEW' ? 'warning' : 'error';
                        return (
                          <Tooltip title={rg.warnings?.join('; ') || status}>
                            <Tag color={tagColor} bordered={false} style={{ fontSize: '10.5px', fontWeight: 800, padding: '0 8px', lineHeight: '22px', borderRadius: '6px', margin: 0 }}>{status}</Tag>
                          </Tooltip>
                        );
                      },
                    },
                    {
                      title: t.agent.colFinalAction,
                      key: 'finalAction',
                      width: 130,
                      render: (record) => {
                        const a = record.finalAction;
                        if (!a) return <span style={{ fontSize: '11px', color: '#bbb' }}>-</span>;
                        const displayText: Record<string, string> = {
                          'BUY_READY': 'BUY READY',
                          'BUY_ALLOWED': 'BUY',
                          'READY_REVIEW': 'READY REVIEW',
                          'WAIT_FOR_ENTRY': 'WAIT ENTRY',
                          'WATCH_ONLY': 'WATCH',
                          'SKIP': 'SKIP',
                          'BLOCKED_BY_RISK': 'BLOCKED',
                          'NEEDS_REVIEW': 'REVIEW',
                        };
                        const tagColor = a.includes('BUY') ? 'success' : a === 'READY_REVIEW' ? 'processing' : a.includes('WAIT') || a === 'WATCH_ONLY' ? 'warning' : 'error';
                        return <Tag color={tagColor} bordered={false} style={{ fontSize: '10.5px', fontWeight: 800, padding: '0 8px', lineHeight: '22px', borderRadius: '6px', margin: 0 }}>{displayText[a] || a}</Tag>;
                      },
                    },
                    {
                      title: t.agent.colData,
                      key: 'dataQuality',
                      width: 100,
                      render: (record) => {
                        const dq = record.dataQuality || 'PARTIAL';
                        const tagColor = dq === 'GOOD' ? 'success' : dq === 'PARTIAL' ? 'warning' : 'error';
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <Tag color={tagColor} bordered={false} style={{ fontSize: '9.5px', fontWeight: 800, padding: '0 6px', lineHeight: '18px', borderRadius: '4px', width: 'fit-content', margin: 0 }}>{dq}</Tag>
                            <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 700, marginTop: 2 }}>{record.aiCalled ? record.aiSource || 'AI' : 'RULES'}</span>
                          </div>
                        );
                      },
                    },
                    {
                      title: t.agent.reason,
                      dataIndex: 'reason',
                      key: 'reason',
                      width: 260,
                      render: (text, record) => {
                        const fullText = record.decisionReason || text || '';
                        return (
                          <Tooltip title={fullText} overlayClassName="heatmap-professional-tooltip">
                            <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.5, WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {fullText || '—'}
                            </div>
                          </Tooltip>
                        );
                      },
                    },
                    {
                      title: t.agent.actions,
                      key: 'action',
                      width: 140,
                      fixed: 'right' as const,
                      render: (record) => {
                        const fa = record.finalAction;
                        const aiDec = record.aiDecision;
                        const dq = record.dataQuality;
                        const rg = record.riskGate || record.hardRiskGate || {};

                        if (fa === 'BLOCKED_BY_RISK' || rg.status === 'BLOCK' || dq === 'POOR') {
                          return <Button size="small" danger disabled style={{ height: 32, borderRadius: 8, fontSize: 11, fontWeight: 700, width: '100%' }}>{t.agent.blocked}</Button>;
                        }
                        if (fa === 'SKIP' || aiDec === 'SKIP') {
                          return <Button size="small" disabled style={{ height: 32, borderRadius: 8, fontSize: 11, fontWeight: 700, width: '100%' }}>{t.agent.skipped}</Button>;
                        }
                        if (fa === 'BUY_READY') {
                          return <Button size="small" type="primary" onClick={() => handleEntryPlanAction(record)} style={{ height: 32, borderRadius: 8, fontSize: 11, fontWeight: 700, width: '100%', background: '#10b981', borderColor: '#10b981' }}>{t.agent.execute}</Button>;
                        }
                        if (fa === 'READY_REVIEW') {
                          const inWl = isInWatchlist(record.symbol);
                          return (
                            <Space size={6}>
                              <Button size="small" type="primary" ghost onClick={() => handleEntryPlanAction(record)} style={{ height: 32, borderRadius: 8, fontSize: 11, fontWeight: 700 }}>{t.agent.review}</Button>
                              <Button size="small" icon={inWl ? <CheckOutlined /> : <PlusOutlined />} onClick={() => addToWatchlist(record)} style={{ height: 32, width: 32, borderRadius: 8, color: inWl ? '#10b981' : '#3b82f6', borderColor: inWl ? '#10b981' : '#3b82f6' }} />
                            </Space>
                          );
                        }
                        if (fa === 'WAIT_FOR_ENTRY' || aiDec === 'WATCH') {
                          const inWl = isInWatchlist(record.symbol);
                          return <Button size="small" icon={inWl ? <CheckOutlined /> : <PlusOutlined />} onClick={() => addToWatchlist(record)} style={{ height: 32, borderRadius: 8, fontSize: 11, fontWeight: 700, width: '100%', color: inWl ? '#10b981' : '#3b82f6', borderColor: inWl ? '#10b981' : '#3b82f6' }}>{inWl ? t.agent.update : t.agent.plusWatchlist}</Button>;
                        }
                        return <span style={{ fontSize: '10px', color: '#bbb' }}>—</span>;
                      },
                    },
                  ]}
                  scroll={{ x: 1750 }}
                  style={{ fontSize: '12px', marginTop: '16px' }}
                  rowClassName={() => 'ep-table-row'}
                />
              </div>
              <style>{`
                .ep-table-row {
                  height: 72px !important;
                }
                .ep-table-row > td {
                  padding: 10px 12px !important;
                  vertical-align: middle;
                  font-size: 13.5px !important;
                  background: #fff;
                }
                .entry-plan-table-wrapper .ant-table-thead > tr > th {
                  font-weight: 800 !important;
                  font-size: 10.5px !important;
                  color: #94a3b8 !important;
                  background: #f8fafc !important;
                  padding: 16px 12px !important;
                  border-bottom: 1px solid rgba(15, 23, 42, 0.06) !important;
                  letter-spacing: 0.8px !important;
                  text-transform: uppercase !important;
                }
                .ep-table-row:hover > td {
                  background: #f8fbff !important;
                }
                .ant-table-thead > tr > th:not(:last-child)::after {
                  display: none !important;
                }
                .ant-table-fixed-right {
                  background: #fff !important;
                }
              `}</style>
            </>
          )}
      </CollapsibleStageSection>
      {/* End Entry Plan Section */}

      {/* ── Exit Scan Section ── */}
      <CollapsibleStageSection
        title={t.agent.exitScan}
        icon={<SwapOutlined />}
        statusText={
          exitScanStatus === 'scanning' ? t.agent.scanningLabel :
          exitScanStatus === 'completed' ? t.agent.completedLabel :
          exitScanStatus === 'skipped' ? `${t.agent.skippedLabel}: ${t.agent.noActiveHoldings}` :
          exitScanStatus === 'failed' ? t.agent.errorLabel :
          exitScanStatus === 'stopped' ? t.agent.stoppedLabel : 'IDLE'
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
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>
            {t.agent.evaluateHoldings}
          </Text>
        </div>

        {/* Summary stats */}
        {exitScanResults.length > 0 && (
          <div style={{
            display: 'flex', gap: 12, marginBottom: 16, padding: '12px',
            background: '#f8fafc', borderRadius: 10, border: '1px solid #f1f5f9'
          }}>
            {[
              { label: t.agent.scanned, value: exitScanResults.length, color: '#1f1f1f', icon: <SearchOutlined /> },
              { label: t.agent.sellNow, value: exitScanResults.filter(r => r.exitDecision === 'sell_now').length, color: '#ef4444', icon: <ThunderboltOutlined /> },
              { label: t.agent.targetLimit, value: exitScanResults.filter(r => r.exitDecision === 'place_target_limit').length, color: '#d97706', icon: <ClockCircleOutlined /> },
              { label: t.agent.hold, value: exitScanResults.filter(r => r.exitDecision === 'hold').length, color: '#10b981', icon: <SafetyCertificateOutlined /> },
              { label: t.agent.epPending, value: exitScanResults.filter(r => r.status === 'pending').length, color: '#f59e0b', icon: <SyncOutlined /> },
              { label: t.agent.epSubmitted, value: exitScanResults.filter(r => r.status === 'submitted').length, color: '#3b82f6', icon: <CheckCircleOutlined /> },
            ].map((stat, idx) => (
              <React.Fragment key={stat.label}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ color: stat.color, fontSize: 14 }}>{stat.icon}</div>
                  <div>
                    <div style={{ fontSize: 9, color: '#8c8c8c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{stat.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: stat.color, lineHeight: 1.1 }}>{stat.value}</div>
                  </div>
                </div>
                {idx < 5 && <Divider type="vertical" style={{ height: 24, margin: 0, borderColor: '#e2e8f0' }} />}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Results table */}
        {exitScanResults.length > 0 ? (
          <div className="exitscan-table-container">
            <style>{`
              .exitscan-table .ant-table-thead > tr > th { background: #f9fafb !important; padding: 12px 16px !important; border-bottom: 1px solid #f0f0f0 !important; }
              .exitscan-table .ant-table-thead > tr > th:first-child,
              .exitscan-table .ant-table-tbody > tr > td:first-child { padding-left: 24px !important; }
              .exitscan-row > td { border-bottom: 1px solid #f0f0f0 !important; }
              .exitscan-row:hover > td { background-color: #f0f7ff !important; }
            `}</style>
            <Table
              className="exitscan-table"
              dataSource={exitScanResults}
              rowKey="symbol"
              size="middle"
              pagination={exitScanResults.length > 10 ? { pageSize: 10, size: 'small' } : false}
              scroll={{ x: 1400 }}
              rowClassName="exitscan-row"
              columns={[
                { title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colSymbol}</span>,
                  dataIndex: 'symbol', key: 'symbol', width: 80, fixed: 'left' as const,
                  render: (t: string) => <span style={{ fontWeight: 800, fontSize: 15, color: '#111827', letterSpacing: '-0.2px' }}>{t}</span> },
                { title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colQty}</span>,
                  dataIndex: 'qty', key: 'qty', width: 60,
                  render: (v: number) => <span style={{ fontSize: 13, fontWeight: 700 }}>{v}</span> },
                { title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colAvgEntry}</span>,
                  dataIndex: 'avgEntry', key: 'avgEntry', width: 90,
                  render: (v: number) => <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>${(v || 0).toFixed(2)}</span> },
                { title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colCurrent}</span>,
                  dataIndex: 'currentPrice', key: 'current', width: 90,
                  render: (v: number) => <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>${(v || 0).toFixed(2)}</span> },
                { title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colPL}</span>,
                  dataIndex: 'pl', key: 'pl', width: 90,
                  render: (v: number) => <span style={{ color: (v || 0) >= 0 ? '#10b981' : '#ef4444', fontWeight: 800, fontSize: 13 }}>{(v || 0) >= 0 ? '+' : ''}${(v || 0).toFixed(2)}</span> },
                { title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colPLPct}</span>,
                  dataIndex: 'plPct', key: 'plPct', width: 80,
                  render: (v: number) => <Tag color={(v || 0) >= 0 ? 'success' : 'error'} bordered={false} style={{ fontSize: 11, fontWeight: 800, borderRadius: 6, margin: 0, padding: '0 6px' }}>{(v || 0) >= 0 ? '+' : ''}{((v || 0) * 100).toFixed(2)}%</Tag> },
                { title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colSource}</span>,
                  dataIndex: 'positionSource', key: 'source', width: 110,
                  render: (s: string, record: any) => {
                    if (s === 'user_marked') return <Tag color="default" style={{ fontSize: 9, fontWeight: 700, borderRadius: 4 }}>USER-MARKED</Tag>;
                    if (s === 'ai_managed') return <Tag color="blue" style={{ fontSize: 9, fontWeight: 700, borderRadius: 4 }}>AI MANAGED</Tag>;
                    if (record.exitPlanSource === 'generated') return <Tag color="cyan" style={{ fontSize: 9, fontWeight: 700, borderRadius: 4 }}>AI GENERATED</Tag>;
                    return <Tag color="orange" style={{ fontSize: 9, fontWeight: 700, borderRadius: 4 }}>{s?.toUpperCase()}</Tag>;
                  }},
                { title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colTarget}</span>,
                  dataIndex: 'entryPlanTarget', key: 'target', width: 90,
                  render: (v?: number) => v != null ? <span style={{ color: '#10b981', fontSize: 12, fontWeight: 700 }}>${v.toFixed(2)}</span> : <span style={{ color: '#d1d5db' }}>—</span> },
                { title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colStop}</span>,
                  dataIndex: 'entryPlanStop', key: 'stop', width: 90,
                  render: (v?: number) => v != null ? <span style={{ color: '#ef4444', fontSize: 12, fontWeight: 700 }}>${v.toFixed(2)}</span> : <span style={{ color: '#d1d5db' }}>—</span> },
                { title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colExitDecision}</span>,
                  dataIndex: 'exitDecision', key: 'decision', width: 130,
                  render: (d: string) => {
                    const m: Record<string, { color: string; label: string }> = {
                      sell_now: { color: 'red', label: t.agent.sellNowLabel },
                      place_target_limit: { color: 'gold', label: t.agent.targetLimitLabel },
                      hold: { color: 'green', label: t.agent.holdLabel },
                      manual_review: { color: 'default', label: t.agent.manualReviewLabel },
                      blocked: { color: 'default', label: t.agent.blockedLabelExit },
                    };
                    const info = m[d] || { color: 'default', label: d?.toUpperCase() };
                    return <Tag color={info.color} bordered={false} style={{ fontSize: 10, fontWeight: 800, borderRadius: 6, padding: '0 8px' }}>{info.label}</Tag>;
                  }},
                { title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colExitOrder}</span>,
                  dataIndex: 'exitOrderType', key: 'orderType', width: 100,
                  render: (orderType?: string, record?: any) => {
                    if (record?.status === 'submitted' || record?.status === 'filled') {
                      return <Tag color="blue" style={{ fontSize: 10, fontWeight: 700, borderRadius: 4 }}>{orderType === 'limit' ? t.agent.lmtSell : t.agent.mktSell}</Tag>;
                    }
                    if (orderType === 'market') return <Tag color="red" style={{ fontSize: 10, fontWeight: 700, borderRadius: 4 }}>{t.agent.mktSell}</Tag>;
                    if (orderType === 'limit') return <Tag color="gold" style={{ fontSize: 10, fontWeight: 700, borderRadius: 4 }}>{t.agent.lmtSell}</Tag>;
                    if (record?.exitDecision === 'hold') return <Tag color="green" style={{ fontSize: 10, fontWeight: 700, borderRadius: 4 }}>{t.agent.holdLabel}</Tag>;
                    if (record?.exitDecision === 'manual_review') return <Tag style={{ fontSize: 10, fontWeight: 700, borderRadius: 4 }}>{t.agent.reviewLabel}</Tag>;
                    return <span style={{ color: '#d1d5db' }}>—</span>;
                  }},
                { title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.exitPrice}</span>,
                  dataIndex: 'exitPrice', key: 'exitPrice', width: 90,
                  render: (v?: number, record?: any) => {
                    if (v != null) return <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>${v.toFixed(2)}</span>;
                    if (record?.exitDecision === 'hold' && record?.entryPlanTarget) return <span style={{ color: '#10b981', fontSize: 12, fontWeight: 600 }}>${record.entryPlanTarget.toFixed(2)}</span>;
                    return <span style={{ color: '#d1d5db' }}>—</span>;
                  }},
                { title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.reason}</span>,
                  dataIndex: 'reason', key: 'reason', width: 200, ellipsis: true,
                  render: (t: string) => <Tooltip title={t}><span style={{ fontSize: 12, color: '#4b5563', fontWeight: 500 }}>{t}</span></Tooltip> },
                { title: <span style={{ fontWeight: 700, color: '#6b7280', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colExitStatus}</span>,
                  dataIndex: 'status', key: 'status', width: 140,
                  render: (s: string) => {
                    const m: Record<string, { label: string; color: string }> = {
                      submitted: { label: t.agent.epSubmitted, color: 'blue' },
                      filled: { label: t.agent.filledLabel, color: 'green' },
                      failed: { label: t.agent.failedLabel, color: 'red' },
                      hold: { label: t.agent.holdLabel, color: 'green' },
                      no_order: { label: t.agent.noOrder, color: 'default' },
                      manual_review: { label: t.agent.reviewLabel, color: 'orange' },
                      blocked: { label: t.agent.blockedLabelExit, color: 'default' },
                      pending: { label: t.agent.epPending, color: 'orange' },
                    };
                    const entry = m[s] || { label: s?.toUpperCase() || 'UNKNOWN', color: 'default' };
                    return <Tag color={entry.color} bordered={false} style={{ fontSize: 9, fontWeight: 800, borderRadius: 4 }}>{entry.label}</Tag>;
                  }},
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
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#8c8c8c' }}>
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

      {/* ── Execution Confirmation Modal ── */}
      <Modal
        title={entryPlanExecutionMode.toLowerCase().includes('live') ? `⚠ ${t.agent.liveTradingConfirmation}` : t.agent.confirmOrderExecution}
        open={executeModalVisible}
        onCancel={() => { setExecuteModalVisible(false); setExecuteTarget(null); setLiveConfirmText(''); }}
        onOk={confirmExecutePlan}
        confirmLoading={executeLoading}
        okText={entryPlanExecutionMode.toLowerCase().includes('live') ? t.agent.confirmLiveOrder : t.agent.submitOrder}
        okButtonProps={{ danger: entryPlanExecutionMode.toLowerCase().includes('live') }}
        width={520}
      >
        {executeTarget && (
          <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
            {entryPlanExecutionMode.toLowerCase().includes('live') && (
              <Alert
                message={t.agent.liveTradingUsesRealMoney}
                type="error"
                showIcon
                style={{ marginBottom: '12px' }}
              />
            )}
            <div><strong>{t.agent.symbolLabel}:</strong> {executeTarget.symbol}</div>
            <div><strong>{t.agent.setupLabel}:</strong> {executeTarget.setup}</div>
            <div><strong>{t.agent.orderTypeLabel}:</strong> {(executeTarget.executionDetails || {}).orderTypeSuggestion || 'N/A'}</div>
            <div><strong>{t.agent.sharesLabel}:</strong> {executeTarget.positionSizeShares || executeTarget.shares || 0}</div>
            <div><strong>{t.agent.entryZoneLabel}:</strong> ${executeTarget.entryZoneLow?.toFixed(2)} – ${executeTarget.entryZoneHigh?.toFixed(2)}</div>
            <div><strong>{t.agent.estimatedValue}:</strong> ${((executeTarget.positionSizeShares || 0) * (executeTarget.entryZoneLow || 0)).toFixed(0)}</div>
            <div><strong>{t.agent.maxRisk}:</strong> ${executeTarget.riskDollars?.toFixed(0) || '0'}</div>
            <div><strong>{t.agent.stopLossLabel}:</strong> ${executeTarget.stopLoss?.toFixed(2)}</div>
            <div><strong>{t.agent.takeProfitLabel}:</strong> ${executeTarget.takeProfit1?.toFixed(2)}</div>
            <div><strong>{t.agent.modeLabel}:</strong> {entryPlanExecutionMode}</div>
            {entryPlanExecutionMode.toLowerCase().includes('live') && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontWeight: 600, color: '#ff4d4f', marginBottom: '4px' }}>
                  {t.agent.confirmLiveBuy.replace('{text}', `CONFIRM LIVE BUY ${executeTarget.symbol}`)}
                </div>
                <Input
                  value={liveConfirmText}
                  onChange={(e) => setLiveConfirmText(e.target.value)}
                  placeholder={`CONFIRM LIVE BUY ${executeTarget.symbol}`}
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Order Modal */}
      <OrderModal
        visible={orderModalVisible}
        onClose={() => { setOrderModalVisible(false); setOrderModalPreset(undefined); }}
        onSuccess={handleOrderSuccess}
        preset={orderModalPreset}
      />

    </div>
  );

}
export default Agent;
