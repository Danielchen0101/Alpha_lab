import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Typography, Space, Statistic, Row, Col,
  Button, Divider, Table, Tag, Form, Input, Empty,
  message, Progress, Badge, Alert, Tooltip, Spin, Modal, Pagination, Steps
} from 'antd';
import {
  LineChartOutlined, BarChartOutlined,
  SettingOutlined, PauseCircleOutlined, SearchOutlined,
  ThunderboltOutlined, CheckCircleOutlined, ClockCircleOutlined,
  RobotOutlined, CloseCircleOutlined, ExclamationCircleOutlined, SyncOutlined, LoadingOutlined,
  ArrowUpOutlined, ArrowDownOutlined, ArrowRightOutlined, MinusOutlined,
  InfoCircleOutlined,
  CaretDownOutlined, CaretRightOutlined,
  DeleteOutlined, ReloadOutlined, PlusOutlined, CheckOutlined, EyeOutlined,
  WalletOutlined, FundOutlined
} from '@ant-design/icons';
import aiTradingService from '../services/aiTradingService';
import { backtraderAPI, entryQualityAPI, fineScanAdvancedAPI, deeperValidationAPI, entryPlanAPI, fineScanExplainAPI, fineScanDecisionAPI, tradingAccountAPI, aiAgentWatchlistAPI } from '../services/api';
import api from '../services/api';
import marketDataService from '../services/marketDataService';
import { scannerStateStore } from '../services/scannerStateStore';
import {
  startMarketScanner, stopMarketScannerByUser, isScanRunning,
  registerFineScanRun, unregisterFineScanRun, isFineScanRunning,
  registerDeeperValidationRun, unregisterDeeperValidationRun, isDeeperValidationRunning,
  registerEntryPlanRun, unregisterEntryPlanRun, isEntryPlanRunning,
} from '../services/scannerRunnerService';

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

// Test-only sample item for AI Execution layout preview. Remove when real BUY_READY results exist.
const AI_EXECUTION_TEST_ITEM: any[] = [{
  _isTest: true,
  symbol: 'SAMPLE',
  setup: 'Pullback',
  setupType: 'Pullback',
  aiDecision: 'BUY',
  confidence: 78,
  entryZoneLow: 148.50,
  entryZoneHigh: 152.00,
  stopLoss: 145.00,
  takeProfit1: 160.00,
  takeProfit2: 168.00,
  riskReward1: 2.4,
  riskReward2: 3.8,
  finalAction: 'BUY_READY',
  tradeReadiness: 'Ready',
  triggerCondition: 'Price holds above 148.50 with volume confirmation',
  invalidationCondition: 'Close below 145.00',
  positionSizeShares: 45,
  positionSizeDollars: 6840,
  positionPct: 6.8,
  decisionReason: 'Strong pullback to support with bullish momentum divergence',
  riskNotes: 'Elevated VIX — reduce position size by 20%',
  blockers: [],
  dataSources: ['Alpaca', 'Finnhub', 'AI Provider'],
  dataQuality: 'GOOD',
  aiSource: 'Claude',
  aiCalled: true,
  aiModel: 'claude-sonnet-4-6',
  aiError: null,
  hardRiskGate: { status: 'PASS', blockers: [] },
  riskGate: { status: 'PASS', blockers: [] },
  nextStep: 'Monitor entry trigger',
  addedAt: new Date().toISOString(),
}];

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
const Portfolio: React.FC = (): React.ReactElement => {
  console.log('Portfolio component rendering');
  const navigate = useNavigate();
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

  const [preferredContinuePage, setPreferredContinuePage] = useState(1);

  // Trading Account Mode
  const [tradingAccountMode, setTradingAccountMode] = useState<'paper' | 'real'>(() => {
    const saved = localStorage.getItem('tradingAccountMode');
    return saved === 'paper' || saved === 'real' ? saved : 'paper';
  });
  const [tradingAccountData, setTradingAccountData] = useState<any>(null);
  const [tradingAccountLoading, setTradingAccountLoading] = useState(false);

  // AI Watchlist state
  const [aiWatchlistItems, setAiWatchlistItems] = useState<any[]>([]);
  const [aiWatchlistLoading, setAiWatchlistLoading] = useState(false);
  const [aiWatchlistAutoRefresh, setAiWatchlistAutoRefresh] = useState(false);
  const [aiWatchlistCountdown, setAiWatchlistCountdown] = useState(60);
  const [aiWatchlistSearch, setAiWatchlistSearch] = useState('');
  const aiWatchlistTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // AI Auto Pipeline state
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<string>('idle');
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const pipelineStopRequestedRef = useRef(false);
  const [aiExecutionList, setAiExecutionList] = useState<any[]>([]);
  const [pipelineMode, setPipelineMode] = useState<'ai' | 'hybrid' | 'manual'>(() => {
    const saved = localStorage.getItem('pipelineMode');
    return saved === 'ai' || saved === 'hybrid' || saved === 'manual' ? saved : 'hybrid';
  });
  const [pipelineSchedule, setPipelineSchedule] = useState<'off' | '15m' | '30m' | '1h' | '2h'>(() => {
    const saved = localStorage.getItem('pipelineSchedule');
    return saved === '15m' || saved === '30m' || saved === '1h' || saved === '2h' ? saved : 'off';
  });
  const [lastPipelineRun, setLastPipelineRun] = useState<string | null>(null);
  const [nextPipelineRun, setNextPipelineRun] = useState<string | null>(null);
  const pipelineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const SCHEDULE_INTERVALS: Record<string, number> = { '15m': 15 * 60 * 1000, '30m': 30 * 60 * 1000, '1h': 60 * 60 * 1000, '2h': 120 * 60 * 1000 };

  // Current Holding state
  const [holdings, setHoldings] = useState<any[]>([]);
  const [holdingsLoading, setHoldingsLoading] = useState(false);
  const [holdingsError, setHoldingsError] = useState<string | null>(null);

  const fetchHoldings = useCallback(async () => {
    setHoldingsLoading(true);
    setHoldingsError(null);
    try {
      const res = await tradingAccountAPI.getPositions(tradingAccountMode);
      if (res.data.success) {
        setHoldings(res.data.positions || []);
      } else {
        setHoldingsError(res.data.error || 'Failed to fetch positions');
        setHoldings([]);
      }
    } catch (e: any) {
      setHoldingsError(e?.response?.data?.error || e?.message || 'Failed to fetch positions');
      setHoldings([]);
    } finally {
      setHoldingsLoading(false);
    }
  }, [tradingAccountMode]);

  // Fetch holdings when trading account mode changes
  useEffect(() => { fetchHoldings(); }, [fetchHoldings]);

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
    setTradingAccountMode(mode);
    localStorage.setItem('tradingAccountMode', mode);
    setTradingAccountLoading(true);
    try {
      const res = await tradingAccountAPI.getAccount(mode);
      setTradingAccountData(res.data);
    } catch (err) {
      setTradingAccountData({ success: false, error: 'Failed to fetch account data', mode, available: false });
    } finally {
      setTradingAccountLoading(false);
    }
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
      message.warning('No market scan results available. Run Market Scanner first.');
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
      totalCount: marketScannerResults.length
    });

    // 开始处理
    processContinueScan();
  };

  // Continue Scan处理函数 - 重构为纯rule-based continue scan
  const processContinueScan = async () => {
    try {
      console.log(`Starting rule-based continue scan for ${marketScannerResults.length} market scan results...`);

      // 阶段A: 初始化 (0%)
      setContinueScanProgress(0);
      setContinueScanDetails((prev: any) => ({
        ...prev,
        currentStage: 'Initializing rule-based scan...',
        processedCount: 0,
        totalCount: marketScannerResults.length,
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
      if (marketScannerResults.length === 0) {
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

      // 准备所有候选的原始数据
      const allCandidates = marketScannerResults.map(candidate => ({
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

  // Load trading account data on mount
  useEffect(() => {
    handleTradingAccountModeChange(tradingAccountMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        console.warn('AI 配置加载失败或为空，保留现有配置');
        // 不覆盖现有配置，只显示警告
        message.warning('AI 配置加载失败，保留现有配置');
      }
    } catch (error) {
      console.error('加载 AI 配置失败:', error);
      message.error('加载 AI 配置失败，保留现有配置');
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

    const color = getTrendColor(label);
    const isStrong = label && typeof label === 'string' && label.includes('Strong');

    return (
      <div className="scanner-badge-base" style={{ 
        backgroundColor: `${color}15`, 
        color: color, 
        border: `1px solid ${color}`,
        fontWeight: isStrong ? '700' : '600'
      }}>
        {label}
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
    const decisionSource = record.decisionSource === 'ai' ? 'DeepSeek AI' : 'Local Rules';
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
        React.createElement(Tag, { color: decision === 'Continue' ? 'success' : decision === 'Watch' ? 'warning' : decision === 'NeedMoreData' ? 'orange' : 'error', style: { fontSize: '12px', fontWeight: 700, margin: 0, padding: '0 10px', height: '24px', lineHeight: '24px', borderRadius: '4px' } }, decision.toUpperCase()),
        React.createElement('span', { style: { color: '#8c8c8c', fontSize: '12px', fontWeight: 500 } }, 'SCORE ', React.createElement('span', { style: { fontWeight: 700, color: '#1890ff' } }, record.matchConfidence || 0)),
        React.createElement('span', { style: { color: '#d9d9d9', fontSize: '14px' } }, '|'),
        React.createElement('span', { style: { color: '#595959', fontSize: '13px', fontWeight: 500 } }, (record.matchedStrategies || []).slice(0, 2).join(' · ') || bestStrat),

        // Warnings inline - emphasized
        (record.decisionWarnings || []).concat((record.decisionBlockers || []).map(function(b: string) { return 'BLOCK: ' + b; })).slice(0, 2).map(function(w: string, i: number) {
          var isBlocker = w.indexOf('BLOCK: ') === 0;
          return React.createElement('span', { key: 'hw' + i, style: { padding: '2px 8px', borderRadius: 4, background: isBlocker ? '#fff1f0' : '#fffbe6', color: isBlocker ? '#ff4d4f' : '#d48806', fontSize: '11px', fontWeight: 600, border: '1px solid ' + (isBlocker ? '#ffa39e' : '#ffe58f'), whiteSpace: 'nowrap' } }, (isBlocker ? '✕ ' : '⚠ ') + (isBlocker ? w.slice(7) : w));
        }),

        React.createElement('span', { style: { marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' } },
          React.createElement(Tag, { color: dq === 'GOOD' ? 'success' : dq === 'PARTIAL' ? 'warning' : 'error', style: { fontSize: '10px', fontWeight: 700, margin: 0, padding: '0 6px', lineHeight: '18px' } }, 'DATA: ' + dq),
          perStrategy.some(function(ps: any) { return (ps.tradeCount || 0) < 3; }) ? React.createElement(Tag, { color: 'warning', style: { fontSize: '10px', fontWeight: 700, margin: 0, padding: '0 6px', lineHeight: '18px' } }, 'LIMITED SAMPLE') : null,
          React.createElement(Tag, { color: aiUsed ? 'cyan' : 'default', style: { fontSize: '10px', fontWeight: 700, margin: 0, padding: '0 6px', lineHeight: '18px' } }, aiUsed ? 'DEEPSEEK V3' : 'LOCAL RULES')
        )
      ),

      // Provenance Chips - cleaner look
      React.createElement('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' } },
        (function() {
          var p = record.provenance || {};
          var chips: Array<{key: string; label: string; isAI: boolean; title: string}> = [
            {key: 'Mkt', label: 'MARKET SCANNER', isAI: false, title: p.marketSource || 'Scanner'},
            {key: 'BT', label: 'BACKTEST ENGINE', isAI: false, title: p.backtestSource || 'Backtest'},
            {key: 'Opt', label: 'OPTIMIZER', isAI: false, title: p.optimizationSource || 'Optimization'},
            {key: 'Entry', label: 'ENTRY ANALYSIS', isAI: false, title: p.entrySource || 'Entry Quality'},
            {key: 'News', label: 'NEWS AGGREGATOR', isAI: false, title: p.newsSource || 'News'},
            {key: 'Dec', label: 'DECISION: ' + (record.decisionSource === 'ai' ? 'AI' : 'RULES'), isAI: record.decisionSource === 'ai', title: decisionSource},
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
            React.createElement('div', { style: { fontWeight: 700, fontSize: '11px', color: '#8c8c8c', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' } }, 'Match Summary'),
            fullReason ? React.createElement('div', { style: { fontSize: '13px', color: '#262626', lineHeight: 1.6, marginBottom: '10px' }, title: fullReason }, fullReason) : null,
            React.createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
              React.createElement(Tag, { color: record.regime === 'Trending' ? 'blue' : record.regime === 'Breakout-ready' ? 'purple' : record.regime === 'Range-bound' ? 'green' : 'default', style: { fontSize: '11px', fontWeight: 600, margin: 0, padding: '0 8px', lineHeight: '20px' } }, record.regime || 'Unclear'),
              React.createElement('span', { style: { fontSize: '12px', color: '#8c8c8c', fontWeight: 500 } }, 'Confidence: ' + (record.matchConfidence || 0) + '% | Scan Score: ' + (record.scanScore || 'N/A'))
            )
          ),

          // Backtest
          React.createElement('div', { style: { background: '#fff', borderRadius: 8, border: '1px solid #edf0f2', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' } },
            React.createElement('div', { style: { fontWeight: 700, fontSize: '11px', color: '#8c8c8c', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' } }, 'Strategy Backtest Validation'),
            perStrategy.length > 0 ? (
              React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '12px' } },
                React.createElement('thead', null,
                  React.createElement('tr', { style: { color: '#8c8c8c', borderBottom: '1px solid #f0f0f0' } },
                    React.createElement('th', { style: { textAlign: 'left', padding: '6px 4px', fontWeight: 600 } }, 'Strategy'),
                    React.createElement('th', { style: { textAlign: 'right', padding: '6px 4px', fontWeight: 600 } }, 'Return'),
                    React.createElement('th', { style: { textAlign: 'right', padding: '6px 4px', fontWeight: 600 } }, 'Sharpe'),
                    React.createElement('th', { style: { textAlign: 'right', padding: '6px 4px', fontWeight: 600 } }, 'MaxDD'),
                    React.createElement('th', { style: { textAlign: 'right', padding: '6px 4px', fontWeight: 600 } }, 'Win%'),
                    React.createElement('th', { style: { textAlign: 'right', padding: '6px 4px', fontWeight: 600 } }, 'Trades'),
                    React.createElement('th', { style: { textAlign: 'center', padding: '6px 4px', fontWeight: 600 } }, 'Status')
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
                      React.createElement('td', { style: { padding: '8px 4px', textAlign: 'right', fontStyle: (ps.tradeCount || 0) < 3 ? 'italic' : 'normal', color: (ps.tradeCount || 0) < 3 ? '#fa8c16' : '#595959' }, title: (ps.tradeCount || 0) < 3 ? 'Limited sample' : undefined }, ps.tradeCount != null ? String(ps.tradeCount) : '--'),
                      React.createElement('td', { style: { padding: '8px 4px', textAlign: 'center' } },
                        React.createElement(Tag, { color: ps.status === 'passed' ? 'success' : ps.status === 'caution' ? 'warning' : 'error', style: { fontSize: '10px', fontWeight: 700, margin: 0, padding: '0 6px', lineHeight: '18px' } },
                          ps.status === 'passed' ? 'PASS' : ps.status === 'caution' ? 'CAUT' : ps.status === 'completed_losing' ? 'FAIL' : '--')
                      )
                    );
                  })
                )
              )
            ) : React.createElement('div', { style: { fontSize: '13px', color: '#bfbfbf', fontStyle: 'italic', padding: '10px 0' } }, 'Backtest data not yet available for this candidate.'),
            record.backtestPeriod ? React.createElement('div', { style: { fontSize: '11px', color: '#8c8c8c', marginTop: '8px', borderTop: '1px solid #f5f5f5', paddingTop: '6px' } }, 'Evaluation Period: ' + record.backtestPeriod) : null
          ),

          // Optimization
          React.createElement('div', { style: { background: '#fff', borderRadius: 8, border: '1px solid #edf0f2', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' } },
            React.createElement('div', { style: { fontWeight: 700, fontSize: '11px', color: '#8c8c8c', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' } }, 'Quick Parameter Optimization'),
            optResults.length > 0 ? (
              React.createElement('div', null,
                React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '12px' } },
                  React.createElement('thead', null,
                    React.createElement('tr', { style: { color: '#8c8c8c', borderBottom: '1px solid #f0f0f0' } },
                      React.createElement('th', { style: { textAlign: 'left', padding: '6px 4px', fontWeight: 600 } }, 'Strategy'),
                      React.createElement('th', { style: { textAlign: 'center', padding: '6px 4px', fontWeight: 600 } }, 'Stability'),
                      React.createElement('th', { style: { textAlign: 'right', padding: '6px 4px', fontWeight: 600 } }, 'Avg Return'),
                      React.createElement('th', { style: { textAlign: 'right', padding: '6px 4px', fontWeight: 600 } }, 'Pos Ratio'),
                      React.createElement('th', { style: { textAlign: 'right', padding: '6px 4px', fontWeight: 600 } }, 'Spread')
                    )
                  ),
                  React.createElement('tbody', null,
                    optResults.map(function(opt: any, oi: number) {
                      return React.createElement('tr', { key: oi, style: { borderBottom: '1px solid #f5f5f5' } },
                        React.createElement('td', { style: { padding: '8px 4px', fontWeight: 600, color: '#1f1f1f' } }, opt.strategy),
                        React.createElement('td', { style: { padding: '8px 4px', textAlign: 'center' } },
                          React.createElement(Tag, { color: opt.stability === 'Stable' ? 'success' : opt.stability === 'Weak' ? 'warning' : 'error', style: { fontSize: '10px', fontWeight: 700, margin: 0, padding: '0 6px', lineHeight: '18px' } },
                            opt.stability === 'Stable' ? 'STABLE' : opt.stability === 'Weak' ? 'WEAK' : 'OVERFIT')
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
            ) : React.createElement('div', { style: { fontSize: '13px', color: '#bfbfbf', fontStyle: 'italic', padding: '10px 0' } }, 'Optimization not executed for this candidate.'),
            record.quickOptStatus === 'running' ? React.createElement('div', { style: { fontSize: '12px', color: '#fa8c16', fontWeight: 600, marginTop: '8px' } }, '⚡ Optimization in progress...') : null
          ),

          // Entry Quality
          React.createElement('div', { style: { background: '#fff', borderRadius: 8, border: '1px solid #edf0f2', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' } },
            React.createElement('div', { style: { fontWeight: 700, fontSize: '11px', color: '#8c8c8c', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' } }, 'Surgical Entry Analysis'),
            eq && eq !== 'Error / No Data' ? (
              React.createElement('div', null,
                React.createElement('div', { style: { marginBottom: '10px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' } },
                  React.createElement('span', { style: { fontSize: '15px', fontWeight: 800, color: eq === 'Good' || eq === 'Excellent' ? '#52c41a' : eq === 'Wait for Pullback' ? '#faad14' : '#ff4d4f' } }, eq),
                  React.createElement('span', { style: { fontSize: '13px', color: '#595959', fontWeight: 500 } }, 'Setup Score: ' + (record.entryScore || '--') + '/100'),
                  eqD && eqD.reward_risk_ratio != null && eqD.reward_risk_ratio < 1.5 && (eq === 'Good' || eq === 'Excellent') ? React.createElement('span', { style: { padding: '2px 8px', borderRadius: 4, background: '#fffbe6', color: '#d48806', fontSize: '11px', fontWeight: 600, border: '1px solid #ffe58f' } }, '⚠ R/R Capped: ' + eqD.reward_risk_ratio + ':1') : null
                ),
                eqD ? React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px 20px', fontSize: '12px', backgroundColor: '#fafafa', padding: '10px', borderRadius: '6px' } },
                  eqD.current_price != null ? React.createElement(FineScanDetailTag, { label: 'Price', value: '$' + eqD.current_price }) : null,
                  eqD.atr != null ? React.createElement(FineScanDetailTag, { label: 'ATR', value: '$' + eqD.atr + ' (' + eqD.atr_pct + '%)' }) : null,
                  eqD.support != null ? React.createElement(FineScanDetailTag, { label: 'Support', value: '$' + eqD.support }) : null,
                  eqD.resistance != null ? React.createElement(FineScanDetailTag, { label: 'Resistance', value: '$' + eqD.resistance }) : null,
                  eqD.entry_zone_low != null ? React.createElement(FineScanDetailTag, { label: 'Zone', value: '$' + eqD.entry_zone_low + '–$' + eqD.entry_zone_high }) : null,
                  eqD.stop_distance_pct != null ? React.createElement(FineScanDetailTag, { label: 'Stop', value: eqD.stop_distance_pct + '%', color: eqD.stop_distance_pct > 5 ? '#fa8c16' : undefined }) : null,
                  eqD.reward_risk_ratio != null ? React.createElement(FineScanDetailTag, { label: 'R/R', value: eqD.reward_risk_ratio + ':1', color: eqD.reward_risk_ratio < 1.5 ? '#ff4d4f' : eqD.reward_risk_ratio < 2 ? '#faad14' : '#52c41a' }) : null
                ) : null,
                record.entryReason ? React.createElement('div', { style: { fontSize: '12px', color: '#8c8c8c', marginTop: '10px', lineHeight: '1.5', fontStyle: 'italic' } }, '“' + record.entryReason + '”') : null
              )
            ) : React.createElement('div', { style: { padding: '10px 0', color: '#bfbfbf', fontStyle: 'italic', fontSize: '13px' } }, 'Entry quality metrics currently unavailable.')
          )
        ),

        // RIGHT COLUMN
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },

          // Key Signals
          React.createElement('div', { style: { background: '#fff', borderRadius: 8, border: '1px solid #edf0f2', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' } },
            React.createElement('div', { style: { fontWeight: 700, fontSize: '11px', color: '#8c8c8c', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' } }, 'High-Conviction Signals'),
            signals.length > 0 ? (
              React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' } },
                signals.slice(0, 8).map(function(sig: string, i: number) {
                  return React.createElement('span', { key: i, style: { padding: '3px 10px', borderRadius: 4, backgroundColor: '#f0f5ff', color: '#1890ff', fontSize: '12px', fontWeight: 600, border: '1px solid #d6e4ff' } }, sig);
                }),
                signals.length > 8 ? React.createElement('span', { style: { fontSize: '12px', color: '#8c8c8c', fontWeight: 500, alignSelf: 'center' } }, '+' + (signals.length - 8) + ' more') : null
              )
            ) : React.createElement('div', { style: { padding: '5px 0', color: '#bfbfbf', fontSize: '13px' } }, '--')
          ),

          // Liquidity & Risk
          React.createElement('div', { style: { background: '#fff', borderRadius: 8, border: '1px solid #edf0f2', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' } },
            React.createElement('div', { style: { fontWeight: 700, fontSize: '11px', color: '#8c8c8c', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' } }, 'Liquidity & Risk Profile'),
            React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' } },
              React.createElement('div', { style: { backgroundColor: '#fafafa', padding: '10px', borderRadius: '6px' } },
                React.createElement('div', { style: { fontWeight: 700, color: '#595959', marginBottom: '6px', fontSize: '11px', textTransform: 'uppercase' } }, 'Liquidity'),
                lg && lg !== 'Error' ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
                  React.createElement(FineScanDetailTag, { label: 'Grade', value: lg, color: lg === 'Good' ? '#52c41a' : lg === 'Caution' ? '#faad14' : '#ff4d4f' }),
                  ld ? React.createElement(React.Fragment, null,
                    ld.rvol != null ? React.createElement(FineScanDetailTag, { label: 'RVOL', value: ld.rvol + 'x', color: ld.rvol >= 1.5 ? '#52c41a' : ld.rvol < 0.7 ? '#ff4d4f' : undefined }) : null,
                    ld.spread_pct != null ? React.createElement(FineScanDetailTag, { label: 'Spread', value: ld.spread_pct + '%', color: ld.spread_pct > 1 ? '#ff4d4f' : ld.spread_pct > 0.2 ? '#faad14' : undefined }) : null
                  ) : null
                ) : React.createElement('span', { style: { color: '#bfbfbf', fontStyle: 'italic' } }, 'No data')
              ),
              React.createElement('div', { style: { backgroundColor: '#fafafa', padding: '10px', borderRadius: '6px' } },
                React.createElement('div', { style: { fontWeight: 700, color: '#595959', marginBottom: '6px', fontSize: '11px', textTransform: 'uppercase' } }, 'Risk'),
                rg && rg !== 'SKIP' ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
                  React.createElement(FineScanDetailTag, { label: 'Grade', value: rg === 'LOW' ? 'Low' : rg === 'MEDIUM' ? 'Medium' : rg === 'HIGH' ? 'High' : rg, color: rg === 'LOW' ? '#52c41a' : rg === 'MEDIUM' ? '#faad14' : '#ff4d4f' }),
                  rd ? React.createElement(React.Fragment, null,
                    React.createElement(FineScanDetailTag, { label: 'Score', value: (rd.risk_score || '--') + '/100', color: rd.risk_score >= 65 ? '#ff4d4f' : rd.risk_score >= 35 ? '#faad14' : '#52c41a' }),
                    rd.atr_pct != null ? React.createElement(FineScanDetailTag, { label: 'ATR', value: rd.atr_pct + '%', color: rd.atr_pct > 5 ? '#ff4d4f' : undefined }) : null
                  ) : null
                ) : React.createElement('span', { style: { color: '#bfbfbf', fontStyle: 'italic' } }, 'No data')
              )
            )
          ),

          // News & Catalyst
          React.createElement('div', { style: { background: '#fff', borderRadius: 8, border: '1px solid #edf0f2', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' } },
            React.createElement('div', { style: { fontWeight: 700, fontSize: '11px', color: '#8c8c8c', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' } }, 'News & Market Catalyst'),
            ng && ng !== 'Error' ? React.createElement('div', null,
              React.createElement('div', { style: { marginBottom: '8px', display: 'flex', gap: '12px' } },
                React.createElement(FineScanDetailTag, { label: 'Sentiment', value: ng, color: ng === 'Catalyst' ? '#1890ff' : ng === 'Caution' ? '#faad14' : ng === 'High Event Risk' ? '#ff4d4f' : undefined }),
                nd ? React.createElement(React.Fragment, null,
                  React.createElement(FineScanDetailTag, { label: 'Headlines', value: String(nd.headline_count || 0) }),
                  React.createElement(FineScanDetailTag, { label: 'Earnings', value: nd.earnings_soon ? 'Upcoming' : 'Clear', color: nd.earnings_soon ? '#faad14' : undefined })
                ) : null
              ),
              nd && nd.top_headlines && nd.top_headlines.length > 0 ? React.createElement('div', { style: { fontSize: '12px', color: '#595959', lineHeight: '1.6', backgroundColor: '#fcfcfc', padding: '8px', borderRadius: '4px', borderLeft: '3px solid #eee' } },
                nd.top_headlines.slice(0, 2).map(function(h: string, i: number) {
                  return React.createElement('div', { key: i, style: { display: '-webkit-box', WebkitLineClamp: '1', WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: '4px' }, title: h }, '• ' + h);
                }),
                nd.top_headlines.length > 2 ? React.createElement('div', { style: { color: '#8c8c8c', fontSize: '11px', marginTop: '4px' } }, 'View ' + (nd.top_headlines.length - 2) + ' more headlines in terminal...') : null
              ) : React.createElement('div', { style: { color: '#bfbfbf', fontSize: '12px', fontStyle: 'italic' } }, 'No significant recent news catalysts detected.')
            ) : React.createElement('div', { style: { color: '#bfbfbf', fontSize: '13px' } }, 'News sentiment analysis unavailable.')
          ),

          // AI Explanation / Strategic Reasoning
          React.createElement('div', { style: { background: '#fff', borderRadius: 8, border: '1px solid #edf0f2', padding: '12px 16px', boxShadow: '0 2px 4px rgba(24, 144, 255, 0.05)' } },
            React.createElement('div', { style: { fontWeight: 700, fontSize: '11px', color: '#1890ff', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' } }, 'AI Agent Strategic Reasoning'),
            React.createElement('div', { style: { marginBottom: '10px', display: 'flex', gap: '12px' } },
              React.createElement(FineScanDetailTag, { label: 'Source', value: aiExplained ? 'DEEPSEEK-V3' : 'LOCAL RULES', color: aiExplained ? '#13c2c2' : '#fa8c16' }),
              aiExplained ? React.createElement(FineScanDetailTag, { label: 'Tokens', value: 'Optimized' }) : null
            ),
            record.finalReason ? React.createElement('div', { style: { fontSize: '13px', color: '#262626', lineHeight: '1.6', marginBottom: '12px', padding: '10px', backgroundColor: '#f0f9ff', borderRadius: '6px', border: '1px solid #e6f4ff' }, title: record.finalReason }, record.finalReason) : null,
            record.nextStep ? React.createElement('div', { style: { borderTop: '1px solid #f0f0f0', paddingTop: '10px' } },
              React.createElement('div', { style: { fontSize: '11px', fontWeight: 700, color: '#1890ff', textTransform: 'uppercase', marginBottom: '4px' } }, 'Recommended Next Step:'),
              React.createElement('div', { style: { fontSize: '13px', color: '#1890ff', fontWeight: 600, lineHeight: '1.5' }, title: record.nextStep }, record.nextStep)
            ) : null,
            !aiExplained && !record.finalReason ? React.createElement('div', { style: { color: '#bfbfbf', fontSize: '13px', fontStyle: 'italic' } }, 'AI agent is compiling strategic reasoning for this candidate...') : null
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
              <span className="scanner-detail-company">{record.companyName || record.name || 'Unknown Company'}</span>
            </div>
            <div className="scanner-detail-meta">
              Last Analysis: {record.timestamp ? new Date(record.timestamp).toLocaleString() : 'N/A'} • 
              ID: {record.symbol}-{record.timestamp || 'NEW'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              <div className="scanner-detail-label" style={{ marginBottom: 2 }}>Analysis Source</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Tag color={record.aiCalled ? 'green' : 'orange'} style={{ margin: 0, fontWeight: 700 }}>
                  {record.aiCalled ? (record.aiSource || 'AI Agent') : 'Local Rules'}
                </Tag>
                {record.dataSource && (
                  <Tag color="blue" style={{ margin: 0, fontWeight: 700 }}>{record.dataSource}</Tag>
                )}
              </div>
            </div>
            <Divider type="vertical" style={{ height: 40, margin: '0 8px' }} />
            <div style={{ textAlign: 'center', minWidth: 80 }}>
              <div className="scanner-detail-label" style={{ marginBottom: 2 }}>Trend</div>
              {renderTrendBadge(record.trendLabel)}
            </div>
          </div>
        </div>

        <Row gutter={[20, 20]}>
          {/* Column 1: Market Data & Basic Info */}
          <Col span={8}>
            <Card title="📊 Market & Basic Info" className="scanner-detail-card" bodyStyle={{ padding: '20px' }}>
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
                    <div className="scanner-detail-label" style={{ marginBottom: 4 }}>Current Price</div>
                    <div className="scanner-detail-value" style={{ fontSize: '22px', color: '#1f1f1f' }}>
                      ${(record.price || 0).toFixed(2)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="scanner-detail-label" style={{ marginBottom: 4 }}>24h Change</div>
                    <div style={{ 
                      fontSize: '16px', 
                      fontWeight: 800, 
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: (record.changePct || record.changePercent || 0) >= 0 ? '#f6ffed' : '#fff1f0',
                      color: (record.changePct || record.changePercent || 0) >= 0 ? '#52c41a' : '#ff4d4f',
                      display: 'inline-block'
                    }}>
                      {(record.changePct || record.changePercent || 0) >= 0 ? '▲' : '▼'}
                      {Math.abs(record.changePct || record.changePercent || 0).toFixed(2)}%
                    </div>
                  </div>
                </div>

                {/* Day Range Info - SWAPPED: Low on Left, High on Right */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '0 4px' }}>
                  <div>
                    <div className="scanner-detail-label">Day Low</div>
                    <div className="scanner-detail-value" style={{ color: '#595959' }}>${(record.dayLow || 0).toFixed(2)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="scanner-detail-label">Day High</div>
                    <div className="scanner-detail-value" style={{ color: '#595959' }}>${(record.dayHigh || 0).toFixed(2)}</div>
                  </div>
                </div>

                <Divider style={{ margin: '4px 0' }} />

                {/* Volume & Liquidity */}
                <div style={{ padding: '0 4px' }}>
                  <div className="scanner-detail-label">Volume & Liquidity</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <span className="scanner-detail-value" style={{ fontSize: '16px' }}>{marketDataService.formatVolume(record.volume || 0)}</span>
                    <Tag color={record.volumeStatus === 'High' ? 'red' : record.volumeStatus === 'Low' ? 'green' : 'gold'} 
                         style={{ fontSize: '10px', fontWeight: 800, borderRadius: '4px', margin: 0 }}>
                      {record.volumeStatus || 'NORMAL'}
                    </Tag>
                  </div>
                </div>

                {/* Sector & Industry */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '0 4px' }}>
                  <div>
                    <div className="scanner-detail-label">Sector</div>
                    <div className="scanner-detail-value" style={{ fontSize: '13px', color: '#434343' }}>{record.sector || 'N/A'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="scanner-detail-label">Industry</div>
                    <div className="scanner-detail-value" style={{ fontSize: '13px', color: '#434343' }}>{record.industry || record.sector || 'N/A'}</div>
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
                  <div className="scanner-detail-label" style={{ marginBottom: 8 }}>Data Provenances</div>
                  <div style={{ fontSize: '11px', color: '#8c8c8c', lineHeight: '1.8' }}>
                    {record.provenance ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Market Data:</span>
                          <span style={{ fontWeight: 600, color: '#595959' }}>{record.provenance.marketData || 'Real-time'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Fundamentals:</span>
                          <span style={{ fontWeight: 600, color: '#595959' }}>{record.provenance.companyInfo || 'Finnhub'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Sentiment:</span>
                          <span style={{ fontWeight: 600, color: '#595959' }}>{record.provenance.news || 'Market News'}</span>
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontStyle: 'italic', color: '#bfbfbf' }}>Detailed source mapping unavailable</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </Col>

          {/* Column 2: Trend & Scores */}
          <Col span={8}>
            <Card title="📈 Analysis & Scores" className="scanner-detail-card" bodyStyle={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
                    <div className="scanner-detail-label" style={{ margin: 0 }}>Overall Trend Score</div>
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
                    Confidence Level: <span style={{ color: scoreColor }}>{conf}%</span>
                  </div>
                </div>

                <Divider style={{ margin: '8px 0' }} />

                <div>
                  <div className="scanner-detail-label" style={{ marginBottom: 12 }}>Dimensional Breakdown</div>
                  <div className="scanner-detail-dimension-grid">
                    {[
                      { label: 'Trend', value: record.trendScoreDetail || record.trendScore },
                      { label: 'Momentum', value: record.momentumScore },
                      { label: 'Volume', value: record.volumeScore },
                      { label: 'Volatility', value: record.volatilityScore },
                      { label: 'Structure', value: record.structureScore },
                      { label: 'Sentiment', value: record.newsScore || record.sentimentScore }
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
                  <div className="scanner-detail-label" style={{ marginBottom: 8 }}>Risk Profile</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <Tag color={record.eventRisk === 'High' ? 'red' : record.eventRisk === 'Medium' ? 'gold' : 'green'} 
                         style={{ fontWeight: 700, padding: '4px 10px', borderRadius: '6px', margin: 0 }}>
                      RISK: {record.eventRisk || 'LOW'}
                    </Tag>
                    <Tag color={record.volatilityScore > 70 ? 'orange' : 'blue'} 
                         style={{ fontWeight: 700, padding: '4px 10px', borderRadius: '6px', margin: 0 }}>
                      VOL: {record.volatilityScore > 70 ? 'HIGH' : 'STABLE'}
                    </Tag>
                  </div>
                </div>
              </div>
            </Card>
          </Col>

          {/* Column 3: AI Reasoning & News */}
          <Col span={8}>
            <Card title="🧠 AI Agent Reasoning" className="scanner-detail-card" bodyStyle={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
                <div>
                  <div className="scanner-detail-label" style={{ marginBottom: 10 }}>Detailed Analysis</div>
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
                    {record.detailedReasoning || record.aiReasoning || record.scannerReason || 'No detailed analysis available for this symbol.'}
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <div className="scanner-detail-label" style={{ marginBottom: 10 }}>Latest Market News</div>
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
                            'Recent news headline identified. Sentiment remains consistent with the current trend score.'}
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '20px 0', color: '#bfbfbf' }}>
                        <InfoCircleOutlined style={{ fontSize: '24px', marginBottom: 8, display: 'block', opacity: 0.5 }} />
                        <span style={{ fontSize: '12px' }}>No symbol-specific news found in the last 24h.</span>
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
                    <div className="scanner-detail-label" style={{ color: '#0050b3', margin: 0 }}>Agent Recommendation</div>
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
      const candidates = preferredContinueScanList;
      const candidateCount = candidates.length;

      // Build a lookup map from marketScannerResults for primary data
      const scannerMap = new Map<string, any>();
      for (const s of marketScannerResults) {
        if (s.symbol) scannerMap.set(s.symbol.toUpperCase(), s);
      }


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
          'Mean Reversion': 'rsi',
          'Bollinger Band': 'bollinger',
          'Bollinger Bands': 'bollinger',
          'Range-bound': 'bollinger',
          'Range Bound': 'bollinger',
          'Range-Bound': 'bollinger',
          'Momentum': 'momentum',
          'Momentum Strategy': 'momentum',
          'Momentum Continuation': 'momentum',
        };
        const supportedStrategies = new Set(['moving_average', 'macd', 'rsi', 'bollinger', 'momentum']);

        let perStrategyResults: any[] = [];
        let execStatus = 'pending';
        let perfStatus: string | null = null;
        let overallSummary = '';

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

              try {
                const payload = {
                  strategy: mappedName, symbol, startDate: sd, endDate: ed,
                  initialCapital: 100000, dataMode: 'real', parameters: {},
                };
                btParams = payload;
                const resp = await backtraderAPI.runBacktest(payload);
                const btResult = (resp as any)?.data?.result;
                if (btResult?.results) {
                  btData = btResult.results;
                  btSuccess = true;
                  break;
                }
              } catch (_) { /* continue fallback */ }
            }

            if (!btSuccess || !btData) {
              perStrategyResults.push({ strategy: stratName, status: 'error', reason: 'Backtest failed for all time windows', totalReturn: null, sharpe: null, maxDrawdown: null, winRate: null, profitFactor: null, tradeCount: null, window: null, _params: btParams });
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

        // Update last result record
        const rec = results[results.length - 1];
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
            };

            // Map FineScan strategy name to backend strategy key
            const fsToBackend: Record<string, string> = {
              'Moving Average': 'moving_average',
              'Moving Average Crossover': 'moving_average',
              'MACD': 'macd',
              'MACD Strategy': 'macd',
              'RSI': 'rsi',
              'RSI Strategy': 'rsi',
              'Mean Reversion': 'rsi',
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
        try {
        setFineScanStepProgress(57);
        setFineScanCurrentStep('Entry Quality');
        setFineScanMessage(`[${i + 1}/${candidateCount}] ${symbol}: assessing entry quality...`);
          const eqResponse = await entryQualityAPI.assessEntry(symbol);
          if (eqResponse.data && eqResponse.data.success) {
            rec.entryQuality = eqResponse.data.entry_quality;
            rec.entryReason = eqResponse.data.entry_reason || '';
            rec.entryScore = eqResponse.data.entry_score || 0;
            rec.entryDetails = eqResponse.data.details || null;
            if (rec.provenance) rec.provenance.entrySource = 'Entry Quality API (Alpaca)';
          } else {
            rec.entryQuality = 'Error / No Data';
            rec.entryReason = eqResponse.data?.message || 'API returned no valid data';
            rec.entryDetails = null;
            if (rec.provenance) { rec.provenance.entrySource = 'Entry Quality Failed'; rec.provenance.dataQuality = 'PARTIAL'; }
          }
        } catch (eqErr: any) {
          console.warn(`[EntryQuality] ${symbol} failed:`, eqErr.message);
          rec.entryQuality = 'Error / No Data';
          rec.entryReason = eqErr.message || 'Alpaca request failed';
          rec.entryDetails = null;
          if (rec.provenance) { rec.provenance.entrySource = 'Entry Quality Failed'; rec.provenance.dataQuality = 'PARTIAL'; }
        }
        // --- End Step 4: Entry Quality ---

        // --- Step 5: Liquidity / Volume Scan (Step 6) ---
        try {
        setFineScanStepProgress(71);
        setFineScanCurrentStep('Liquidity / Volume Check');
        setFineScanMessage(`[${i + 1}/${candidateCount}] ${symbol}: liquidity/volume check...`);
          const advResponse = await fineScanAdvancedAPI.scan(symbol, rec.entryDetails);
          if (advResponse.data && advResponse.data.success) {
            rec.liquidityGrade = advResponse.data.liquidity?.grade || 'Error';
            rec.liquidityReason = advResponse.data.liquidity?.reason || '';
            rec.liquidityDetails = advResponse.data.liquidity?.details || null;
            rec.newsGrade = advResponse.data.news?.grade || 'Error';
            rec.newsReason = advResponse.data.news?.reason || '';
            rec.newsDetails = advResponse.data.news?.details || null;
            rec.riskGrade = advResponse.data.risk?.grade || 'MEDIUM';
            rec.riskReason = advResponse.data.risk?.reason || '';
            rec.riskDetails = advResponse.data.risk?.details || null;
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
        } catch (advErr: any) {
          console.warn(`[FineScanAdvanced] ${symbol} failed:`, advErr.message);
          rec.liquidityGrade = 'Error';
          rec.newsGrade = 'Error';
          rec.riskGrade = 'SKIP';
          rec.riskReason = advErr.message || 'advanced scan failed';
          if (rec.provenance) { rec.provenance.liquiditySource = 'Failed'; rec.provenance.newsSource = 'Failed'; rec.provenance.dataQuality = 'PARTIAL'; }
        }
        // --- End Steps 5-6-7: Liquidity, News, Risk ---

        // Compute Decision: Continue / Watch / Skip — try AI first, fallback to local rules
        rec.decision = 'Watch'; // default
        rec.decisionSource = 'pending';
        rec.fineScanGrade = 'MEDIUM';
        rec.decisionConfidence = 0;
        try {
          const decisionResp = await fineScanDecisionAPI.decide({
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
          });
          if (decisionResp.data && decisionResp.data.success) {
            const rawDecision = (decisionResp.data.decision || '').toUpperCase();
            rec.rawAiVerdict = rawDecision; // preserve for debug
            if (rawDecision === 'CONTINUE') rec.decision = 'Continue';
            else if (rawDecision === 'REJECT') rec.decision = 'Reject';
            else if (rawDecision === 'NEED_MORE_DATA') rec.decision = 'NeedMoreData';
            else if (rawDecision === 'WATCH') rec.decision = 'Watch';
            else if (rawDecision === 'SKIP') rec.decision = 'Skip';
            else rec.decision = 'Watch'; // fallback
            rec.fineScanGrade = decisionResp.data.grade;
            rec.decisionConfidence = decisionResp.data.confidence;
            rec.decisionSource = decisionResp.data.source;
            rec.decisionReason = decisionResp.data.reason;
            if (decisionResp.data.decisionDetail) {
              rec.decisionStrengths = decisionResp.data.decisionDetail.strengths || [];
              rec.decisionWarnings = decisionResp.data.decisionDetail.warnings || [];
              rec.decisionBlockers = decisionResp.data.decisionDetail.blockers || [];
            }
            // Ensure blockers/warnings always exist
            if (!rec.decisionBlockers) rec.decisionBlockers = [];
            if (!rec.decisionWarnings) rec.decisionWarnings = [];
            if (rec.provenance) {
              rec.provenance.decisionSource = decisionResp.data.source === 'ai' ? 'DeepSeek AI' : 'Local Rules';
              rec.provenance.aiCalled = decisionResp.data.source === 'ai';
            }
            console.log(`[FineScanDecision] ${symbol}: AI raw=${rawDecision} → final=${rec.decision} reason=${rec.decisionReason}`);
          } else {
            throw new Error('Decision API returned no data');
          }
        } catch (decErr: any) {
          console.warn(`[FineScanDecision] ${symbol} AI decision failed: ${decErr.message}, using local rules`);
          // Local fallback — 4-category: Continue / Watch / Reject / NeedMoreData
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

          // Track blocking reasons
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

          // Core data check — if price completely missing, need more data
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

          try {
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

            const resp = (await fineScanExplainAPI.explain(explainData)).data;
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
          } catch (e: any) {
            console.warn(`[FineScanExplain] AI failed for ${symbol}: ${e.message}`);
            if (rec.provenance) rec.provenance.explanationSource = 'Explain API error';
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
  const [entryPlanExecutionMode, setEntryPlanExecutionMode] = useState<string>('Recommend Only');

  // ===== Entry Plan Execution State =====
  const [executeModalVisible, setExecuteModalVisible] = useState(false);
  const [executeTarget, setExecuteTarget] = useState<any>(null);
  const [executeLoading, setExecuteLoading] = useState(false);
  const [liveConfirmText, setLiveConfirmText] = useState('');

  // ===== Collapsible Stage Sections Expanded State =====
  const [scannerExpanded, setScannerExpanded] = useState(false);
  const [continueScanExpanded, setContinueScanExpanded] = useState(false);
  const [fineScanExpanded, setFineScanExpanded] = useState(false);
  const [dvExpanded, setDvExpanded] = useState(false);
  const [dvErrorMessage, setDvErrorMessage] = useState<string | null>(null);
  const [dvErrors, setDvErrors] = useState<any[]>([]);
  const [entryPlanExpanded, setEntryPlanExpanded] = useState(false);

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

  const getEntryPlanCandidates = useCallback(() => {
    if (!deeperValidationResults || deeperValidationResults.length === 0) return [];
    // Include Confirmed, Watch, and Needs Manual Review. Exclude Rejected and Risk Gate BLOCKED.
    const confirmed: any[] = [];
    const watch: any[] = [];
    const manualReview: any[] = [];
    for (const r of deeperValidationResults) {
      const rgStatus = (r.riskGate || {}).status;
      if (rgStatus === 'BLOCK') continue; // Exclude risk-gate blocked candidates
      if (r.verdict === 'Confirmed') confirmed.push(r);
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
      const rgStatus = (r.riskGate || {}).status;
      if (rgStatus === 'BLOCK') continue;
      if (r.verdict === 'Confirmed') confirmed.push(r);
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
  }, [getEntryPlanCandidates, entryPlanAccountSize, entryPlanRiskPerTrade, entryPlanExecutionMode, tradingAccountMode, tradingAccountData]);

  const _runEntryPlanLoop = async (candidates: any[]) => {
    setEntryPlanStatus('loading');
    setEntryPlanResults(null);

    // Preflight: check session, AI config, and trading account
    const preflight = await preflightConfigCheck();
    if (!preflight.ok || !preflight.sessionValid) {
      setEntryPlanStatus('error');
      unregisterEntryPlanRun();
      message.error(preflight.error || 'Session expired');
      return;
    }
    if (!preflight.aiAvailable) {
      const reason = preflight.aiKeyIsMasked ? 'AI key is invalid (masked). Re-enter in Settings.' :
                     !preflight.aiConfigured ? 'AI Provider not configured. Configure in Settings.' :
                     preflight.aiTestStatus !== 'connected' ? `AI Provider not tested (${preflight.aiTestStatus}). Click Test AI Connection in Settings.` :
                     'AI unavailable';
      setEntryPlanStatus('error');
      unregisterEntryPlanRun();
      message.error(reason);
      return;
    }
    // Check trading account config (paper vs real mode)
    if (!tradingAccountData?.success) {
      setEntryPlanStatus('error');
      unregisterEntryPlanRun();
      message.error(`Trading account (${tradingAccountMode} mode) is not available. Configure Alpaca keys in Settings.`);
      return;
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
        existingPositions, dailyLoss, existingPositions, entryPlanExecutionMode, tradingAccountMode
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
        setEntryPlanStatus('error');
        unregisterEntryPlanRun();
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
            [], 0, [], entryPlanExecutionMode, tradingAccountMode
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
          : (err.message || 'Entry plan failed');
      console.error('Entry plan error:', err);
      setEntryPlanStatus('error');
      unregisterEntryPlanRun();
      message.error(errMsg);
    }
  };

  // ===== AI Auto Pipeline =====
  // Shared: render Entry Plan detail (used by Watchlist, Execution, etc.)
  const renderEntryPlanDetail = (ep: any) => {
    const rg = ep.riskGate || ep.hardRiskGate || {};
    const dq = ep.dataQuality || 'N/A';
    const dqColor = dq === 'GOOD' ? '#52c41a' : dq === 'FAIR' ? '#faad14' : '#ff4d4f';
    const rgColor = rg.status === 'PASS' ? '#52c41a' : rg.status === 'REVIEW' ? '#faad14' : '#ff4d4f';
    const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, paddingBottom: 4, borderBottom: '1px solid #f0f2f5' }}>{title}</div>
        {children}
      </div>
    );
    const Row2 = ({ label, value, color }: { label: string; value: any; color?: string }) => (
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 12 }}>
        <span style={{ color: '#8c8c8c' }}>{label}</span>
        <span style={{ fontWeight: 600, color: color || '#262626' }}>{value ?? 'N/A'}</span>
      </div>
    );
    return (
      <div style={{ padding: '12px 8px', background: '#fafbfc', borderRadius: 8, lineHeight: 1.8, fontSize: 12 }}>
        <Row gutter={[16, 0]}>
          <Col span={8}>
            <Section title="Decision">
              <Row2 label="Final Action" value={ep.finalAction} color={ep.finalAction === 'BUY_READY' ? '#52c41a' : ep.finalAction === 'WAIT_FOR_ENTRY' ? '#1890ff' : '#ff4d4f'} />
              <Row2 label="AI Decision" value={ep.aiDecision} />
              <Row2 label="Confidence" value={ep.confidence ? `${ep.confidence}%` : 'N/A'} />
              <Row2 label="Trade Readiness" value={ep.tradeReadiness} />
              <Row2 label="Setup" value={ep.setup || ep.setupType} />
              <Row2 label="Next Step" value={ep.nextStep} />
            </Section>
          </Col>
          <Col span={8}>
            <Section title="Entry / Exit Levels">
              <Row2 label="Entry Zone" value={ep.entryZoneLow && ep.entryZoneHigh ? `$${ep.entryZoneLow.toFixed(2)} – $${ep.entryZoneHigh.toFixed(2)}` : 'N/A'} />
              <Row2 label="Trigger" value={ep.triggerCondition} />
              <Row2 label="Invalidation" value={ep.invalidationCondition} />
              <Row2 label="Stop Loss" value={ep.stopLoss ? `$${ep.stopLoss.toFixed(2)}` : 'N/A'} color="#ff4d4f" />
              <Row2 label="Take Profit 1" value={ep.takeProfit1 ? `$${ep.takeProfit1.toFixed(2)}` : 'N/A'} color="#52c41a" />
              <Row2 label="Take Profit 2" value={ep.takeProfit2 ? `$${ep.takeProfit2.toFixed(2)}` : 'N/A'} color="#52c41a" />
              <Row2 label="R/R 1" value={ep.riskReward1 ? `${ep.riskReward1.toFixed(1)}:1` : 'N/A'} />
              <Row2 label="R/R 2" value={ep.riskReward2 ? `${ep.riskReward2.toFixed(1)}:1` : 'N/A'} />
            </Section>
          </Col>
          <Col span={8}>
            <Section title="Risk / Position Sizing">
              <Row2 label="Position Size" value={ep.positionSizeShares ? `${ep.positionSizeShares} shares` : ep.positionSizeDollars ? `$${ep.positionSizeDollars.toLocaleString()}` : 'N/A'} />
              <Row2 label="Position %" value={ep.positionPct ? `${ep.positionPct.toFixed(1)}%` : 'N/A'} />
              <Row2 label="Risk Gate" value={rg.status || 'N/A'} color={rgColor} />
              <Row2 label="Data Quality" value={dq} color={dqColor} />
            </Section>
            <Section title="AI / Data Quality">
              <Row2 label="AI Source" value={ep.aiSource || (ep.aiCalled ? 'AI' : 'Local Rules')} />
              <Row2 label="AI Model" value={ep.aiModel || 'N/A'} />
              {ep.aiError && <Row2 label="AI Error" value={ep.aiError} color="#ff4d4f" />}
              <Row2 label="Data Sources" value={Array.isArray(ep.dataSources) ? ep.dataSources.join(', ') : (ep.dataSources || 'N/A')} />
            </Section>
          </Col>
        </Row>
        {(ep.decisionReason || ep.riskNotes || (ep.blockers && ep.blockers.length > 0)) && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0f2f5' }}>
            <Section title="Reasons / Warnings">
              {ep.decisionReason && <div style={{ fontSize: 12, marginBottom: 4 }}><strong>Reason:</strong> {ep.decisionReason}</div>}
              {ep.riskNotes && <div style={{ fontSize: 12, marginBottom: 4, color: '#faad14' }}><strong>Risk Notes:</strong> {ep.riskNotes}</div>}
              {ep.blockers && ep.blockers.length > 0 && <div style={{ fontSize: 12, color: '#ff4d4f' }}><strong>Blockers:</strong> {ep.blockers.join('; ')}</div>}
            </Section>
          </div>
        )}
      </div>
    );
  };

  const PIPELINE_STAGES = ['Market Scanner', 'Continue Scan', 'Fine Scan', 'Deeper Validation', 'Entry Plan'] as const;

  const pollStore = (getter: () => any, done: (v: any) => boolean, intervalMs = 2000): Promise<void> =>
    new Promise((resolve, reject) => {
      const check = () => {
        if (pipelineStopRequestedRef.current) { reject(new Error('Pipeline stopped by user')); return; }
        const v = getter();
        if (done(v)) { resolve(); } else { setTimeout(check, intervalMs); }
      };
      check();
    });

  const runAIPipeline = async () => {
    // Pre-checks
    if (isAnyScanRunning) {
      message.warning('A scan is already running. Stop it before starting AI Pipeline.');
      return;
    }

    setPipelineRunning(true);
    setPipelineError(null);
    setPipelineStage('Market Scanner');
    pipelineStopRequestedRef.current = false;

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
      if (!fsResults || fsResults.length === 0) throw new Error('No Continue Scan candidates');
      const fineScanPromise = _runFineScanLoop();
      registerFineScanRun(fineScanPromise);
      await fineScanPromise;
      const fsStatus = scannerStateStore.getState().fineScan.status;
      if (fsStatus !== 'completed') throw new Error(`Fine Scan ${fsStatus}`);

      // ── Stage 4: Deeper Validation ──
      setPipelineStage('Deeper Validation');
      // Read from store directly to avoid stale React snapshot after fine scan
      const dvCandidates = _getValidationCandidatesFromStore();
      if (dvCandidates.length === 0) throw new Error('Fine Scan completed but no Continue or Watch-to-Validate candidates found.');
      const dvPromise = _runDeeperValidationLoop(dvCandidates);
      registerDeeperValidationRun(dvPromise);
      await dvPromise;
      const dvStatus = scannerStateStore.getState().deeperValidation.status;
      if (dvStatus !== 'completed') throw new Error(`Deeper Validation ${dvStatus}`);

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

      // ── Auto-classify results ──
      setPipelineStage('Classifying');
      const plans = scannerStateStore.getState().entryPlan.results || [];
      const newExecution: any[] = [];
      for (const plan of plans) {
        const fa = plan.finalAction || '';
        const rr = plan.riskReward1 || 0;
        const sl = plan.stopLoss || 0;
        const tp = plan.takeProfit1 || 0;
        if ((fa === 'BUY_READY' || fa === 'READY_REVIEW') && rr >= 2.0 && sl > 0 && tp > 0) {
          newExecution.push({ ...plan, addedAt: new Date().toISOString() });
        } else if (fa === 'WAIT_FOR_ENTRY') {
          await addToWatchlist(plan);
        }
      }
      if (newExecution.length > 0) setAiExecutionList(prev => [...prev, ...newExecution]);

      setPipelineStage('idle');
      message.success(`Pipeline complete! ${newExecution.length} execution candidates, ${plans.length - newExecution.length} added to watchlist/summary.`);
    } catch (e: any) {
      const msg = e.message || 'Pipeline failed';
      setPipelineError(msg);
      setPipelineStage('failed');
      message.error(msg);
    } finally {
      setPipelineRunning(false);
      const now = new Date().toISOString();
      setLastPipelineRun(now);
      scheduleNextRun();
    }
  };

  const stopPipeline = () => {
    pipelineStopRequestedRef.current = true;
    if (pipelineStage === 'Market Scanner') stopMarketScannerByUser();
  };

  // Schedule next pipeline run
  const scheduleNextRun = useCallback(() => {
    if (pipelineTimerRef.current) { clearTimeout(pipelineTimerRef.current); pipelineTimerRef.current = null; }
    const savedSchedule = localStorage.getItem('pipelineSchedule') || 'off';
    if (savedSchedule === 'off' || savedSchedule === 'manual') { setNextPipelineRun(null); return; }
    const intervalMs = SCHEDULE_INTERVALS[savedSchedule];
    if (!intervalMs) { setNextPipelineRun(null); return; }
    const next = new Date(Date.now() + intervalMs);
    setNextPipelineRun(next.toISOString());
    pipelineTimerRef.current = setTimeout(() => {
      const mode = localStorage.getItem('pipelineMode') || 'hybrid';
      if (mode === 'manual') return;
      if (pipelineRunning || isScanRunning() || isFineScanRunning() || isDeeperValidationRunning() || isEntryPlanRunning()) return;
      runAIPipeline();
    }, intervalMs);
  }, [pipelineRunning]);

  // On mount: start schedule timer if needed. On unmount: cleanup.
  useEffect(() => {
    scheduleNextRun();
    return () => { if (pipelineTimerRef.current) clearTimeout(pipelineTimerRef.current); };
  }, []);

  // Persist pipeline mode and schedule to localStorage
  useEffect(() => { localStorage.setItem('pipelineMode', pipelineMode); }, [pipelineMode]);
  useEffect(() => {
    localStorage.setItem('pipelineSchedule', pipelineSchedule);
    scheduleNextRun();
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
      message.warning('No qualified Fine Scan candidates. Run Fine Scan first or adjust criteria.');
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
          if (sl.includes('rsi') || sl.includes('mean reversion') || sl.includes('reversal')) { strategy = 'rsi'; break; }
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

      const backendMsg = err.response?.data?.message || err.response?.data?.error;
      const backendErrors = err.response?.data?.errors || [];
      const isTimeout = err.code === 'ECONNABORTED' || (err.message || '').includes('timeout');
      const errMsg = isConfigError
        ? (backendMsg || 'Configuration error. Check AI Provider settings.')
        : isRateLimit
          ? 'Rate limited by AI service. Please wait and try again.'
          : isTimeout
            ? 'Validation is still running longer than expected. Try fewer symbols or retry.'
            : (backendMsg || ('Validation failed: ' + (err.message || 'Unknown error')));
      setDeeperValidationStatus('error');
      setDvErrorMessage(errMsg);
      setDvErrors(backendErrors);
      unregisterDeeperValidationRun();
      message.error(errMsg);
    }
  };


// ===== Deeper Validation Detail Panel =====
function renderDVDetailPanel(record: any) {
  var tc = record.tradeCount != null ? record.tradeCount : record.trades;
  
  // Verdict colors
  var v = record.verdict;
  var vColor = '#52c41a';
  if (v === 'Watch' || v === 'Caution') vColor = '#faad14';
  else if (v === 'Avoid' || v === 'Reject' || v === 'Rejected') vColor = '#ff4d4f';
  else if (v === 'Needs Manual Review') vColor = '#722ed1';
  var vName = v === 'Needs Manual Review' ? 'Review' : v === 'Reject' || v === 'Rejected' || v === 'Avoid' ? 'Rejected' : v === 'Caution' ? 'Watch' : v;
  if (vName === 'Review') v = vName;
  else if (v === 'Reject' || v === 'Rejected' || v === 'Avoid') v = 'Rejected';
  else if (v === 'Caution') v = 'Watch';
  
  // Reason parts
  var reasonParts = (record.reason || '').split(' | ');
  
  // Helper: render a metric row
  function metricRow(label: any, value: any, color?: any) {
    return React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid #f0f0f0', fontSize: '11px' } },
      React.createElement('span', { style: { color: '#888' } }, label),
      React.createElement('span', { style: { fontWeight: 600, color: color || '#333' } }, value != null ? String(value) : 'N/A')
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
      if (tc != null && tc > 0 && record.totalReturn != null && record.totalReturn > 0) return String.fromCharCode(8734) + ' (no losses)';
      return 'N/A';
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
  var stLabel = stScore != null ? (stScore >= 70 ? 'Stable' : stScore >= 50 ? 'Moderate' : 'Weak') : 'N/A';
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
    cardBlock('1Y Backtest',
      React.createElement(React.Fragment, null,
        metricRow('Strategy', record.strategy),
        metricRow('Total Return', record.totalReturn != null ? (record.totalReturn > 0 ? '+' : '') + record.totalReturn.toFixed(1) + '%' : 'N/A', retColor(record.totalReturn)),
        metricRow('Sharpe', record.sharpeRatio != null ? record.sharpeRatio.toFixed(2) : 'N/A', shColor(record.sharpeRatio)),
        metricRow('Max DD', record.maxDrawdown != null ? '-' + Math.abs(record.maxDrawdown).toFixed(1) + '%' : 'N/A', ddColor(record.maxDrawdown)),
        metricRow('Win Rate', record.winRate != null ? record.winRate + '%' : 'N/A'),
        metricRow('Profit Factor', pfText(), pfColor()),
        record.parameters && Object.keys(record.parameters).length > 0 ? 
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid #f0f0f0', fontSize: '11px' } },
            React.createElement('span', { style: { color: '#888' } }, 'Parameters'),
            paramChips(record.parameters)
          ) : null,
        metricRow('Trades', tc != null ? (tc < 3 ? 'Limited (' + tc + ')' : String(tc)) : 'N/A', tc != null ? (tc >= 10 ? undefined : tc >= 3 ? '#faad14' : '#ff4d4f') : undefined),
      ),
      '#1890ff',
      'Source: Internal Backtest'
    ),
    
    // Card 2: Light Optimization
    cardBlock('Light Optimization',
      React.createElement(React.Fragment, null,
        metricRow('Tested Combos', (record.testedCombinationCount ?? record.optimizationResults?.length ?? record.validCombinationCount ?? 0) > 0 ? String(record.testedCombinationCount ?? record.optimizationResults?.length ?? record.validCombinationCount ?? 0) : 'N/A'),
        metricRow('Valid Combos', record.validCombinationCount != null ? String(record.validCombinationCount) : 'N/A'),
        metricRow('Best Return', record.optimizedReturn != null ? (record.optimizedReturn > 0 ? '+' : '') + record.optimizedReturn.toFixed(1) + '%' : 'N/A', retColor(record.optimizedReturn)),
        metricRow('Best Sharpe', record.optimizedSharpe != null ? record.optimizedSharpe.toFixed(2) : 'N/A', shColor(record.optimizedSharpe)),
        metricRow('Avg Return', record.avgReturn != null ? record.avgReturn + '%' : 'N/A', retColor(record.avgReturn)),
        metricRow('Median Return', record.medianReturn != null ? record.medianReturn + '%' : 'N/A'),
        metricRow('Positive Ratio', record.profitableRatio != null ? Math.round(record.profitableRatio * 100) + '%' : 'N/A'),
        metricRow('Return Spread', record.returnSpread != null ? record.returnSpread + '%' : 'N/A'),
        // Top 3 results
        record.top3Results && record.top3Results.length > 0 ? 
          React.createElement('div', { style: { marginTop: 8 } },
            React.createElement('div', { style: { fontSize: '10px', color: '#888', marginBottom: 4 } }, 'Top Results:'),
            record.top3Results.map(function(r: any, i: number) {
              return React.createElement('div', { key: i, style: { fontSize: '10px', padding: '2px 0', borderBottom: i < record.top3Results.length - 1 ? '1px solid #f0f0f0' : 'none' } },
                React.createElement('span', { style: { color: '#666' } }, '#' + (i+1) + ': '),
                React.createElement('span', { style: { color: r.ret > 0 ? '#52c41a' : '#ff4d4f', fontWeight: 600 } }, 'ret=' + r.ret + '%'),
                React.createElement('span', { style: { color: '#999' } }, ' sharpe=' + r.sharp + ' '),
                r.params && typeof r.params === 'object' ? 
                  React.createElement('span', { style: { color: '#999' } }, Object.entries(r.params).map(function(kv: any) { return kv[0] + '=' + String(kv[1]); }).join(', ')) : null
              );
            })
          ) : null
      ),
      '#722ed1',
      'Source: Internal Optimization'
    ),
    
    // Card 3: Parameter Stability
    cardBlock('Parameter Stability',
      React.createElement(React.Fragment, null,
        isLimitedSample ?
          React.createElement('div', { style: { padding: '6px 8px', background: '#fff3cd', borderRadius: 6, marginBottom: 8, fontSize: '10px', color: '#856404' } },
            String.fromCharCode(9888) + ' Limited sample: only ' + tc + ' trade(s), ' + (record.validCombinationCount || 0) + ' combo(s) tested. Validation confidence is reduced.'
          ) : null,
        metricRow('Score', stScore != null ? stScore + '/100' : 'N/A', stColor),
        metricRow('Label', stLabel, stColor),
        metricRow('Profitable Ratio', record.profitableRatio != null ? Math.round(record.profitableRatio * 100) + '%' : 'N/A'),
        metricRow('Median Return', record.medianReturn != null ? record.medianReturn + '%' : 'N/A'),
        metricRow('Best Return', record.bestReturn != null ? record.bestReturn + '%' : 'N/A', retColor(record.bestReturn)),
        metricRow('Return Spread', record.returnSpread != null ? record.returnSpread + '%' : 'N/A'),
        metricRow('Stable Params', record.stableParameterCount != null ? String(record.stableParameterCount) : 'N/A'),
        record.stabilityReason ?
          React.createElement('div', { style: { marginTop: 6, fontSize: '10px', color: '#666', fontStyle: 'italic' } }, record.stabilityReason) : null
      ),
      '#fa8c16'
    ),
    
    // Card 4: Recent vs Long-Term
    cardBlock('Recent vs Long-Term',
      React.createElement(React.Fragment, null,
        metricRow('Long Return', record.longTermReturn != null ? (record.longTermReturn > 0 ? '+' : '') + record.longTermReturn.toFixed(1) + '%' : 'N/A', retColor(record.longTermReturn)),
        metricRow('Recent Return', record.recentReturn != null ? (record.recentReturn > 0 ? '+' : '') + record.recentReturn.toFixed(1) + '%' : 'N/A', retColor(record.recentReturn)),
        metricRow('Long Sharpe', record.longTermSharpe != null ? record.longTermSharpe.toFixed(2) : 'N/A', shColor(record.longTermSharpe)),
        metricRow('Recent Sharpe', record.recentSharpe != null ? record.recentSharpe.toFixed(2) : 'N/A', shColor(record.recentSharpe)),
        metricRow('Long DD', record.longTermMaxDrawdown != null ? '-' + Math.abs(record.longTermMaxDrawdown).toFixed(1) + '%' : 'N/A', ddColor(record.longTermMaxDrawdown)),
        metricRow('Recent DD', record.recentMaxDrawdown != null ? '-' + Math.abs(record.recentMaxDrawdown).toFixed(1) + '%' : 'N/A', ddColor(record.recentMaxDrawdown)),
        record.recentVsLongTerm ?
          React.createElement('div', { style: { marginTop: 8, textAlign: 'center' } },
            React.createElement(Tag, { color: trendColor(record.recentVsLongTerm), style: { fontSize: '10px', fontWeight: 700, margin: 0, padding: '2px 10px', borderRadius: '8px' } }, record.recentVsLongTerm)
          ) : null
      ),
      '#13c2c2'
    ),

    // Data Provenance strip — compact chips
    (function() {
      var aiExplained = record.aiExplained === true;
      var explanationSource = aiExplained ? 'DeepSeek' : 'Rule-based';
      var rgStatus = (record.riskGate || {}).status || 'N/A';
      var fdSource = (record.finalDecision || {}).source || 'Rule-based';
      var chips = [
        {label: 'Market: ' + (record.dataSource === 'alpaca' ? 'Alpaca' : record.dataSource || 'N/A'), isAI: false, title: 'Alpaca Market Data API'},
        {label: 'Backtest: Internal', isAI: false, title: 'Internal Backtest Engine'},
        {label: 'Opt: Internal', isAI: false, title: 'Internal Optimization Engine'},
        {label: 'Verdict: Rule-based', isAI: false, title: 'Deterministic Rules'},
        {label: 'Risk Gate: ' + rgStatus, isAI: false, title: 'Rule-based risk gate: ' + ((record.riskGate || {}).reason || 'N/A')},
        {label: 'Decision: ' + fdSource, isAI: fdSource !== 'Rule-based', title: fdSource !== 'Rule-based' ? 'AI Final Decision' : 'Rule-based decision (no AI call)'},
        {label: 'Explain: ' + explanationSource, isAI: aiExplained, title: aiExplained ? 'DeepSeek AI' : 'Rule-based explanation'},
      ];
      return React.createElement('div', { style: { gridColumn: '1 / -1', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', fontSize: '8px', color: '#888' } },
        chips.map(function(c: any) {
          return React.createElement('span', { key: c.label, title: c.title, style: { padding: '1px 6px', borderRadius: '3px', background: c.isAI ? '#e6fffb' : '#f0f0f0', color: c.isAI ? '#13c2c2' : '#888', border: '1px solid ' + (c.isAI ? '#b5f5ec' : '#e0e0e0'), whiteSpace: 'nowrap', cursor: 'default' } }, c.label);
        }),
        isLimitedSample ?
          React.createElement(Tag, { color: 'warning', style: { fontSize: '8px', margin: 0, marginLeft: 'auto', padding: '0 4px', lineHeight: '16px' } }, 'Limited sample') : null
      );
    })(),

    // Summary Footer - Compact Status Row
    React.createElement('div', { style: { gridColumn: '1 / -1', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' } },
      React.createElement('div', { style: { flex: 1, minWidth: 0 } },
        reasonParts.length > 0 ?
          React.createElement('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } },
            React.createElement('span', { style: { fontSize: '10px', color: '#8c8c8c', fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 } }, 'Verdict Reasons:'),
            React.createElement('div', { style: { fontSize: '12px', color: '#434343', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, title: reasonParts.join(' | ') }, 
              reasonParts.join(' · ')
            )
          ) : 
          React.createElement('div', { style: { fontSize: '12px', color: '#8c8c8c', fontStyle: 'italic' } }, 
            record.verdictReason || record.decisionSummary || 'Final validation complete. No critical alerts identified.'
          )
      ),
      React.createElement('div', { style: { display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 } },
        // Risk Gate badge
        (function() {
          var rg = record.riskGate || {};
          var rgStatus = rg.status || 'N/A';
          var rgColor = rgStatus === 'PASS' ? 'green' : rgStatus === 'REVIEW' ? 'gold' : rgStatus === 'BLOCK' ? 'red' : 'default';
          var rgLabel = rgStatus === 'BLOCK' ? 'Blocked' : rgStatus;
          return React.createElement(Tooltip, { title: rg.reason || 'No risk gate data' },
            React.createElement(Tag, { color: rgColor, style: { fontSize: '10px', margin: 0, padding: '0 8px', fontWeight: 700, borderRadius: '4px' } }, 'GATE: ' + rgLabel)
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
            <Title level={1} style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', color: '#1a1a1a' }}>AI Agent Orchestrator</Title>
          </div>
          <Text type="secondary" style={{ fontSize: 15, marginLeft: 52 }}>Autonomous intelligence for market screening, technical verification, and automated trading.</Text>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
           <Badge status="processing" text={<Text strong style={{ color: '#52c41a', fontSize: 12 }}>SYSTEM ONLINE</Text>} />
        </div>
      </div>

      <Divider />

      {/* 1. AI Configuration — compact status strip */}
      <div style={{ marginBottom: 24 }}>
        <div className="status-strip">
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div className="stat-box">
              <span className="stat-label">AI Provider</span>
              <span className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {aiConfig.provider || 'Not set'}
                <Tag color="blue" bordered={false} style={{ margin: 0, fontSize: 10, lineHeight: '16px' }}>V3</Tag>
              </span>
            </div>
            <Divider type="vertical" style={{ height: 32, margin: 0 }} />
            <div className="stat-box">
              <span className="stat-label">Model</span>
              <span className="stat-value">{aiConfig.model || 'Not set'}</span>
            </div>
            <Divider type="vertical" style={{ height: 32, margin: 0 }} />
            <div className="stat-box">
              <span className="stat-label">AI Status</span>
              {configStatus.loaded ? (
                configStatus.aiTestStatus === 'connected' ? <Tag color="success" style={{ margin: 0, borderRadius: 10, fontWeight: 700, fontSize: 10 }}>CONNECTED</Tag> :
                configStatus.aiTestStatus === 'saved' ? <Tag color="warning" style={{ margin: 0, borderRadius: 10, fontWeight: 700, fontSize: 10 }}>NOT TESTED</Tag> :
                configStatus.aiTestStatus === 'error' ? <Tag color="error" style={{ margin: 0, borderRadius: 10, fontWeight: 700, fontSize: 10 }}>ERROR</Tag> :
                configStatus.ai ? <Tag color="warning" style={{ margin: 0, borderRadius: 10, fontWeight: 700, fontSize: 10 }}>NOT TESTED</Tag> :
                <Tag color="default" style={{ margin: 0, borderRadius: 10, fontWeight: 700, fontSize: 10 }}>NOT CONFIGURED</Tag>
              ) : <Spin size="small" />}
            </div>
            <Divider type="vertical" style={{ height: 32, margin: 0 }} />
            <div className="stat-box">
              <span className="stat-label">Market Data</span>
              {configStatus.loaded ? <Tag color="processing" style={{ margin: 0, borderRadius: 10, fontWeight: 700, fontSize: 10 }}>ALPACA</Tag> : <Spin size="small" />}
            </div>
            <Divider type="vertical" style={{ height: 32, margin: 0 }} />
            <div className="stat-box">
              <span className="stat-label">Trading</span>
              {configStatus.loaded ? (configStatus.alpaca ? <Tag color="processing" style={{ margin: 0, borderRadius: 10, fontWeight: 700, fontSize: 10 }}>PAPER</Tag> : <Tag color="default" style={{ margin: 0, borderRadius: 10, fontWeight: 700, fontSize: 10 }}>NOT LINKED</Tag>) : <Spin size="small" />}
            </div>
          </div>
          <Button type="text" icon={<SettingOutlined />} onClick={() => navigate('/settings/configuration')} style={{ color: '#1890ff', fontWeight: 600, fontSize: 13 }}>Manage Settings</Button>
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
                Trading Account Mode
              </span>
              <div style={{ display: 'flex', background: '#f5f5f5', padding: 3, borderRadius: 8, gap: 4, border: '1px solid #eee' }}>
                <Button
                  size="small"
                  type={tradingAccountMode === 'paper' ? 'primary' : 'text'}
                  onClick={() => handleTradingAccountModeChange('paper')}
                  style={{
                    borderRadius: 6,
                    height: 28,
                    padding: '0 12px',
                    fontSize: 12,
                    fontWeight: tradingAccountMode === 'paper' ? 700 : 500,
                    boxShadow: tradingAccountMode === 'paper' ? '0 2px 4px rgba(24,144,255,0.2)' : 'none',
                    color: tradingAccountMode === 'paper' ? '#fff' : '#8c8c8c',
                  }}
                >
                  Paper Trading
                </Button>
                <Button
                  size="small"
                  type={tradingAccountMode === 'real' ? 'primary' : 'text'}
                  danger={tradingAccountMode === 'real'}
                  onClick={() => handleTradingAccountModeChange('real')}
                  style={{
                    borderRadius: 6,
                    height: 28,
                    padding: '0 12px',
                    fontSize: 12,
                    fontWeight: tradingAccountMode === 'real' ? 700 : 500,
                    boxShadow: tradingAccountMode === 'real' ? '0 2px 4px rgba(255,77,79,0.2)' : 'none',
                    color: tradingAccountMode === 'real' ? '#fff' : '#8c8c8c',
                  }}
                >
                  Real Trading
                </Button>
              </div>
            </div>
          }
        >
          <div style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
            <InfoCircleOutlined style={{ color: '#1890ff' }} />
            Used for Entry Plan position sizing and risk checks. <Text type="secondary" style={{ fontSize: 12 }}>(Mode switch is for planning only; no real orders are triggered here)</Text>
          </div>
          
          <div style={{ background: '#fafafa', borderRadius: 12, padding: '20px', border: '1px solid #f0f0f0', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}>
            {tradingAccountLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#8c8c8c' }}>
                <Spin indicator={<LoadingOutlined style={{ fontSize: 16 }} spin />} />
                <span>Synchronizing account data...</span>
              </div>
            ) : tradingAccountData?.success ? (
              <Row gutter={40} align="middle">
                <Col>
                  <div className="stat-box">
                    <span className="stat-label" style={{ fontSize: 10 }}>Account Type</span>
                    <span className="stat-value" style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {tradingAccountData?.mode === 'paper' ? <><Tag color="blue" bordered={false} style={{ margin: 0, fontWeight: 700 }}>PAPER</Tag></> : <><Tag color="error" bordered={false} style={{ margin: 0, fontWeight: 700 }}>LIVE</Tag></>}
                    </span>
                  </div>
                </Col>
                <Col>
                  <div className="stat-box">
                    <span className="stat-label" style={{ fontSize: 10 }}>Status</span>
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
                    <span className="stat-label" style={{ fontSize: 10 }}>Cash</span>
                    <span style={{ fontWeight: 800, fontSize: 18, color: '#1f1f1f', fontFamily: "'Inter', sans-serif" }}>
                      ${(tradingAccountData.cash ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </Col>
                <Col>
                  <div className="stat-box">
                    <span className="stat-label" style={{ fontSize: 10 }}>Buying Power</span>
                    <span style={{ fontWeight: 800, fontSize: 18, color: '#1f1f1f', fontFamily: "'Inter', sans-serif" }}>
                      ${(tradingAccountData.buyingPower ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </Col>
                <Col>
                  <div className="stat-box">
                    <span className="stat-label" style={{ fontSize: 10 }}>Portfolio Value</span>
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
                  <><InfoCircleOutlined /> Account data unavailable</>
                )}
                <Tag style={{ marginLeft: 8 }}>USING ESTIMATED DEFAULTS</Tag>
              </div>
            )}
          </div>

          {tradingAccountMode === 'real' && (
            <Alert
              style={{ marginTop: 16, borderRadius: 8, border: '1px solid #ffe58f' }}
              type="warning"
              showIcon
              message={<span style={{ fontWeight: 700 }}>Live Account Active</span>}
              description="Planning engine is now synced with your live portfolio. No trades will be executed until you manually confirm an Entry Plan."
            />
          )}
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
                <span style={{ fontWeight: 700, fontSize: 16 }}>AI Auto Pipeline</span>
                <Tag color={pipelineMode === 'ai' ? 'purple' : pipelineMode === 'hybrid' ? 'blue' : 'default'} bordered={false} style={{ fontSize: 10, fontWeight: 800, borderRadius: 4 }}>
                  {pipelineMode === 'ai' ? 'FULL AI' : pipelineMode === 'hybrid' ? 'HYBRID' : 'MANUAL'}
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
                    Stop Pipeline
                  </Button>
                ) : (
                  <Button
                    type="primary"
                    icon={<ThunderboltOutlined />}
                    onClick={runAIPipeline}
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
                    {pipelineMode === 'manual' ? 'Run Manual Cycle' : 'Run Auto Pipeline'}
                  </Button>
                )}
              </div>
            </div>
          }
        >
          {/* Mode-specific notice */}
          <div style={{ marginBottom: 16 }}>
            {pipelineMode === 'ai' ? (
              <Alert 
                type={tradingAccountMode === 'real' ? 'warning' : 'info'} 
                showIcon 
                style={{ borderRadius: 8 }}
                message={<span style={{ fontWeight: 700 }}>AI Automation Mode</span>}
                description={tradingAccountMode === 'real' 
                  ? "End-to-end scanning and plan generation. Live orders are prepared for confirmation." 
                  : "End-to-end automation. Candidates are prepared for paper execution."} 
              />
            ) : pipelineMode === 'hybrid' ? (
              <Alert type="info" showIcon style={{ borderRadius: 8 }}
                message={<span style={{ fontWeight: 700 }}>Hybrid Decision Support</span>}
                description="AI scans and filters candidates, preparing tactical entry plans for your review and manual execution." />
            ) : (
              <Alert type="info" showIcon style={{ borderRadius: 8, background: '#f5f5f5', border: '1px solid #eee' }}
                message={<span style={{ fontWeight: 700 }}>Manual Control</span>}
                description="Automation disabled. Use individual module buttons to progress candidates through the pipeline." />
            )}
          </div>

          <div style={{ background: '#fafafa', padding: '16px 20px', borderRadius: 12, border: '1px solid #f0f0f0' }}>
            <Row gutter={[32, 16]}>
              <Col span={8}>
                <div style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Pipeline Mode</div>
                <div style={{ display: 'flex', background: '#f0f2f5', padding: 3, borderRadius: 8, gap: 4, border: '1px solid #e8e8e8' }}>
                  {(['ai', 'hybrid', 'manual'] as const).map(m => (
                    <Button key={m} size="small"
                      type={pipelineMode === m ? 'primary' : 'text'}
                      onClick={() => setPipelineMode(m)}
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
                      {m === 'ai' ? 'AI' : m === 'hybrid' ? 'Hybrid' : 'Manual'}
                    </Button>
                  ))}
                </div>
              </Col>
              <Col span={9}>
                <div style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Auto-Run Schedule</div>
                <div style={{ display: 'flex', background: '#f0f2f5', padding: 3, borderRadius: 8, gap: 2, border: '1px solid #e8e8e8' }}>
                  {(['off', '15m', '30m', '1h', '2h'] as const).map(s => (
                    <Button key={s} size="small"
                      type={pipelineSchedule === s ? 'primary' : 'text'}
                      onClick={() => setPipelineSchedule(s)}
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
                      {s === 'off' ? 'Off' : s}
                    </Button>
                  ))}
                </div>
                {pipelineSchedule !== 'off' && (
                  <div style={{ fontSize: 10, color: '#52c41a', marginTop: 6, fontWeight: 600 }}>
                    <SyncOutlined spin style={{ marginRight: 4 }} /> Scheduled: Every {pipelineSchedule}
                  </div>
                )}
              </Col>
              <Col span={7}>
                <div style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Run Status</div>
                <div style={{ fontSize: 12, lineHeight: '20px' }}>
                  {lastPipelineRun ? (
                    <div style={{ color: '#595959' }}>
                      <ClockCircleOutlined style={{ marginRight: 6, opacity: 0.6 }} /> 
                      Last: <Text strong>{new Date(lastPipelineRun).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                    </div>
                  ) : <div style={{ color: '#bfbfbf', fontStyle: 'italic' }}>No recent runs</div>}
                  
                  {nextPipelineRun && pipelineSchedule !== 'off' && (
                    <div style={{ color: '#1890ff', marginTop: 2 }}>
                      <ThunderboltOutlined style={{ marginRight: 6 }} /> 
                      Next: <Text strong style={{ color: '#1890ff' }}>{new Date(nextPipelineRun).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                    </div>
                  )}
                </div>
              </Col>
            </Row>

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
                    return { title: <span style={{ fontSize: 11, fontWeight: status === 'process' ? 700 : 500 }}>{name}</span>, status };
                  })}
                />
              </div>
            )}
          </div>

          {pipelineError && (
            <Alert
              type="error"
              showIcon
              message="Pipeline Error"
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
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(82, 196, 26, 0.1)', color: '#52c41a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  <WalletOutlined />
                </div>
                <span style={{ fontWeight: 700, fontSize: 16 }}>Current Holdings</span>
                <Tag color="green" bordered={false} style={{ fontSize: 11, fontWeight: 800, borderRadius: 4 }}>{holdings.length}</Tag>
                <Tag color="blue" bordered={false} style={{ fontSize: 10, borderRadius: 4 }}>{tradingAccountMode === 'paper' ? 'Paper' : 'Real'}</Tag>
              </span>
              <Button size="small" icon={<ReloadOutlined spin={holdingsLoading} />} onClick={fetchHoldings} style={AI_AGENT_COMPACT_BTN_STYLE}>
                Refresh
              </Button>
            </div>
          }
          size="small"
        >
          {holdingsError && (
            <Alert type="error" showIcon message={holdingsError} style={{ marginBottom: 12 }} closable onClose={() => setHoldingsError(null)} />
          )}
          {holdingsLoading && holdings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#8c8c8c' }}><Spin size="small" /> Loading positions...</div>
          ) : holdings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#bbb', fontSize: 13, fontStyle: 'italic' }}>No current holdings.</div>
          ) : (
            <Table
              dataSource={holdings}
              rowKey="symbol"
              size="small"
              pagination={holdings.length > 10 ? { pageSize: 10, size: 'small' } : false}
              scroll={{ x: 900 }}
              expandable={{
                expandedRowRender: (h: any) => (
                  <div style={{ padding: '8px 0', fontSize: 12, lineHeight: 2 }}>
                    <Row gutter={[24, 8]}>
                      <Col span={6}><span style={{ color: '#8c8c8c' }}>Symbol:</span> <strong>{h.symbol}</strong></Col>
                      <Col span={6}><span style={{ color: '#8c8c8c' }}>Side:</span> {h.side || 'long'}</Col>
                      <Col span={6}><span style={{ color: '#8c8c8c' }}>Qty:</span> {h.qty}</Col>
                      <Col span={6}><span style={{ color: '#8c8c8c' }}>Asset Class:</span> {h.assetClass || 'us_equity'}</Col>
                      <Col span={6}><span style={{ color: '#8c8c8c' }}>Avg Entry:</span> ${(h.avgEntryPrice || 0).toFixed(2)}</Col>
                      <Col span={6}><span style={{ color: '#8c8c8c' }}>Current:</span> ${(h.currentPrice || 0).toFixed(2)}</Col>
                      <Col span={6}><span style={{ color: '#8c8c8c' }}>Market Value:</span> ${(h.marketValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Col>
                      <Col span={6}><span style={{ color: '#8c8c8c' }}>Cost Basis:</span> ${(h.costBasis || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Col>
                      <Col span={6}><span style={{ color: '#8c8c8c' }}>Unrealized P/L:</span> <span style={{ color: (h.unrealizedPL || 0) >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>${(h.unrealizedPL || 0).toFixed(2)}</span></Col>
                      <Col span={6}><span style={{ color: '#8c8c8c' }}>P/L %:</span> <span style={{ color: (h.unrealizedPLPercent || 0) >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>{((h.unrealizedPLPercent || 0) * 100).toFixed(2)}%</span></Col>
                      <Col span={6}><span style={{ color: '#8c8c8c' }}>Exchange:</span> {h.exchange || 'N/A'}</Col>
                    </Row>
                  </div>
                ),
              }}
              columns={[
                { title: 'Symbol', dataIndex: 'symbol', key: 'symbol', width: 80, fixed: 'left' as const, render: (t: string) => <span style={{ fontWeight: 700 }}>{t}</span> },
                { title: 'Qty', dataIndex: 'qty', key: 'qty', width: 60, render: (v: number) => <span style={{ fontFamily: 'Inter, sans-serif' }}>{v}</span> },
                { title: 'Avg Entry', dataIndex: 'avgEntryPrice', key: 'avgEntry', width: 90, render: (v: number) => <span style={{ fontFamily: 'Inter, sans-serif' }}>${(v || 0).toFixed(2)}</span> },
                { title: 'Current', dataIndex: 'currentPrice', key: 'current', width: 90, render: (v: number) => <span style={{ fontFamily: 'Inter, sans-serif' }}>${(v || 0).toFixed(2)}</span> },
                { title: 'Mkt Value', dataIndex: 'marketValue', key: 'mktVal', width: 100, render: (v: number) => <span style={{ fontFamily: 'Inter, sans-serif' }}>${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> },
                { title: 'P/L', dataIndex: 'unrealizedPL', key: 'pl', width: 90, render: (v: number) => <span style={{ color: (v || 0) >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>${(v || 0).toFixed(2)}</span> },
                { title: 'P/L %', dataIndex: 'unrealizedPLPercent', key: 'plpct', width: 80, render: (v: number) => <span style={{ color: (v || 0) >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>{((v || 0) * 100).toFixed(2)}%</span> },
              ]}
            />
          )}
        </Card>
      </div>

      {/* 1.7 AI Execution Candidates */}
      <div style={{ marginBottom: 24 }}>
        <Card
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(250, 173, 20, 0.1)', color: '#faad14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  <FundOutlined />
                </div>
                <span style={{ fontWeight: 700, fontSize: 16 }}>AI Execution Candidates</span>
                <Tag color="gold" bordered={false} style={{ fontSize: 11, fontWeight: 800, borderRadius: 4 }}>
                  {aiExecutionList.length > 0 ? aiExecutionList.length : (aiExecutionList as any)._isTest ? '1 (Test)' : '0'}
                </Tag>
              </span>
              {aiExecutionList.length > 0 && !(aiExecutionList as any)._isTest && (
                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setAiExecutionList([])} style={AI_AGENT_COMPACT_BTN_STYLE}>Clear</Button>
              )}
            </div>
          }
          size="small"
        >
          <Alert
            type={pipelineMode === 'ai' && tradingAccountMode === 'paper' ? 'info' : 'warning'}
            showIcon
            message={
              pipelineMode === 'ai' && tradingAccountMode === 'paper'
                ? 'AI Mode + Paper Trading: Candidates prepared as paper execution preview. No real orders placed.'
                : pipelineMode === 'ai' && tradingAccountMode === 'real'
                  ? 'AI Mode + Live Trading: Needs manual live confirmation. No auto-order submission.'
                  : pipelineMode === 'hybrid'
                    ? 'Hybrid Mode: Manual execution required. AI prepares plans, you execute.'
                    : 'Execution candidates are decision-support only. Review manually before placing any trade.'
            }
            style={{ marginBottom: 12 }}
          />
          <Table
            dataSource={aiExecutionList.length > 0 ? aiExecutionList : AI_EXECUTION_TEST_ITEM}
            rowKey={(r: any) => r.symbol + (r.addedAt || '') + (r._isTest ? '_test' : '')}
            size="small"
            pagination={false}
            scroll={{ x: 1100 }}
            style={{ fontSize: 11 }}
            expandable={{
              expandedRowRender: (record: any) => {
                const ep = entryPlanResultsBySymbol[record.symbol] || record;
                return renderEntryPlanDetail(ep);
              },
            }}
            columns={[
              {
                title: 'Symbol',
                dataIndex: 'symbol',
                key: 'symbol',
                width: 80,
                fixed: 'left' as const,
                render: (text: string, r: any) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 12 }}>{text}</span>
                    {r._isTest && <Tag color="orange" style={{ fontSize: 8, padding: '0 3px', lineHeight: '14px', margin: 0 }}>TEST</Tag>}
                  </div>
                ),
              },
              {
                title: 'Setup',
                key: 'setup',
                width: 100,
                render: (r: any) => {
                  const s = r.setup || r.setupType || 'N/A';
                  const color = s.includes('Pullback') ? 'gold' : s.includes('Breakout') ? 'purple' : s.includes('Range') ? 'green' : 'blue';
                  return <Tag color={color} style={{ fontSize: 9, margin: 0, padding: '0 4px' }}>{s}</Tag>;
                },
              },
              {
                title: 'Entry Zone',
                key: 'entryZone',
                width: 110,
                render: (r: any) => {
                  const lo = r.entryZoneLow;
                  const hi = r.entryZoneHigh;
                  if (!lo && !hi) return <span style={{ color: '#ccc', fontSize: 11 }}>N/A</span>;
                  return <span style={{ fontSize: 11, fontFamily: 'Inter, sans-serif' }}>${(lo || 0).toFixed(2)}–${(hi || 0).toFixed(2)}</span>;
                },
              },
              {
                title: 'Stop',
                dataIndex: 'stopLoss',
                key: 'stopLoss',
                width: 70,
                render: (v: number | null) => v ? <span style={{ color: '#ff4d4f', fontSize: 11, fontFamily: 'Inter, sans-serif' }}>${v.toFixed(2)}</span> : <span style={{ color: '#ccc' }}>N/A</span>,
              },
              {
                title: 'Target',
                key: 'takeProfit',
                width: 75,
                render: (r: any) => {
                  const t = r.takeProfit1;
                  if (!t) return <span style={{ color: '#ccc', fontSize: 11 }}>N/A</span>;
                  return <span style={{ color: '#52c41a', fontSize: 11, fontFamily: 'Inter, sans-serif' }}>${t.toFixed(2)}</span>;
                },
              },
              {
                title: 'R/R',
                dataIndex: 'riskReward1',
                key: 'riskReward1',
                width: 55,
                render: (v: number | null) => v ? <span style={{ fontSize: 11, fontFamily: 'Inter, sans-serif' }}>{v.toFixed(1)}:1</span> : <span style={{ color: '#ccc' }}>N/A</span>,
              },
              {
                title: 'Confidence',
                dataIndex: 'confidence',
                key: 'confidence',
                width: 80,
                render: (v: number | null) => v ? <span style={{ fontSize: 11 }}>{v}%</span> : <span style={{ color: '#ccc' }}>N/A</span>,
              },
              {
                title: 'AI',
                key: 'aiDecision',
                width: 60,
                render: (r: any) => {
                  const d = r.aiDecision;
                  if (!d) return <span style={{ color: '#ccc', fontSize: 11 }}>N/A</span>;
                  const color = d === 'BUY' ? 'green' : d === 'WATCH' ? 'gold' : d === 'SKIP' ? 'red' : 'default';
                  return <Tag color={color} style={{ fontSize: 9, margin: 0, padding: '0 4px', fontWeight: 600 }}>{d}</Tag>;
                },
              },
              {
                title: 'Gate',
                key: 'riskGate',
                width: 60,
                render: (r: any) => {
                  const s = (r.riskGate || r.hardRiskGate || {}).status || r.riskGateStatus || '';
                  if (!s) return <span style={{ color: '#ccc', fontSize: 11 }}>N/A</span>;
                  const color = s === 'PASS' ? 'green' : s === 'REVIEW' ? 'gold' : 'red';
                  return <Tag color={color} style={{ fontSize: 9, margin: 0, padding: '0 4px', fontWeight: 600 }}>{s}</Tag>;
                },
              },
              {
                title: 'Data',
                key: 'dataQuality',
                width: 60,
                render: (r: any) => {
                  const dq = r.dataQuality || '';
                  if (!dq) return <span style={{ color: '#ccc', fontSize: 11 }}>N/A</span>;
                  const color = dq === 'GOOD' ? 'green' : dq === 'FAIR' ? 'gold' : 'red';
                  return <Tag color={color} style={{ fontSize: 9, margin: 0, padding: '0 4px', fontWeight: 600 }}>{dq}</Tag>;
                },
              },
              {
                title: 'Added',
                key: 'addedAt',
                width: 80,
                render: (r: any) => {
                  if (r._isTest) return <Tag color="orange" style={{ fontSize: 9, margin: 0, padding: '0 3px' }}>Sample</Tag>;
                  const t = r.addedAt;
                  if (!t) return <span style={{ color: '#ccc', fontSize: 10 }}>N/A</span>;
                  const d = new Date(t);
                  return <span style={{ fontSize: 10, color: '#888' }}>{d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>;
                },
              },
            ]}
          />
        </Card>
      </div>

      {/* 1.6 AI Watchlist */}
      <div style={{ marginBottom: 24 }}>
        <Card
          className="premium-card"
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(24, 144, 255, 0.1)', color: '#1890ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  <EyeOutlined />
                </div>
                <span style={{ fontWeight: 700, fontSize: 16 }}>AI Watchlist</span>
                <Tag color="blue" bordered={false} style={{ fontSize: 11, fontWeight: 800, borderRadius: 4 }}>{aiWatchlistItems.length}</Tag>
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Input
                  placeholder="Search symbol..."
                  size="small"
                  prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                  value={aiWatchlistSearch}
                  onChange={e => setAiWatchlistSearch(e.target.value.toUpperCase())}
                  style={{ width: 140, borderRadius: 6, fontSize: 12, height: 28 }}
                  allowClear
                />
                <Divider type="vertical" style={{ height: 20 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Button
                    size="small"
                    type={aiWatchlistAutoRefresh ? 'primary' : 'default'}
                    onClick={() => setAiWatchlistAutoRefresh(!aiWatchlistAutoRefresh)}
                    style={{ ...AI_AGENT_COMPACT_BTN_STYLE, height: 28, background: aiWatchlistAutoRefresh ? '#1890ff' : '#f5f5f5', border: aiWatchlistAutoRefresh ? 'none' : '1px solid #d9d9d9', color: aiWatchlistAutoRefresh ? '#fff' : '#8c8c8c' }}
                  >
                    {aiWatchlistAutoRefresh ? <><SyncOutlined spin style={{ marginRight: 4 }} /> {aiWatchlistCountdown}s</> : 'AUTO OFF'}
                  </Button>
                  <Button
                    size="small"
                    icon={<ReloadOutlined spin={aiWatchlistLoading} />}
                    onClick={() => { setAiWatchlistLoading(true); refreshWatchlistPrices().finally(() => setAiWatchlistLoading(false)); }}
                    style={{ ...AI_AGENT_COMPACT_BTN_STYLE, height: 28 }}
                  >
                    Refresh
                  </Button>
                  {aiWatchlistItems.length > 0 && (
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={clearAllWatchlist}
                      style={{ ...AI_AGENT_COMPACT_BTN_STYLE, height: 28 }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </div>
          }
        >
          {aiWatchlistItems.length > 0 && (
            <div style={{ display: 'flex', gap: 24, marginBottom: 20, padding: '12px 16px', background: '#fafafa', borderRadius: 10, border: '1px solid #f0f0f0' }}>
              <div className="mini-stat">
                <div style={{ fontSize: 10, color: '#8c8c8c', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Total</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1f1f1f' }}>{aiWatchlistItems.length}</div>
              </div>
              <Divider type="vertical" style={{ height: 32, margin: 0 }} />
              <div className="mini-stat">
                <div style={{ fontSize: 10, color: '#8c8c8c', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Waiting Entry</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#faad14' }}>{aiWatchlistItems.filter(i => getWatchlistReadiness(i) === 'Waiting Entry').length}</div>
              </div>
              <Divider type="vertical" style={{ height: 32, margin: 0 }} />
              <div className="mini-stat">
                <div style={{ fontSize: 10, color: '#8c8c8c', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Review Required</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1890ff' }}>{aiWatchlistItems.filter(i => i.riskGateStatus === 'REVIEW').length}</div>
              </div>
              <Divider type="vertical" style={{ height: 32, margin: 0 }} />
              <div className="mini-stat">
                <div style={{ fontSize: 10, color: '#8c8c8c', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Ready / Hot</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#52c41a' }}>{aiWatchlistItems.filter(i => getWatchlistReadiness(i) === 'Ready').length}</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Tag color="blue" bordered={false} style={{ fontSize: 9, margin: 0 }}>ALPACA DATA SOURCE</Tag>
              </div>
            </div>
          )}

          {aiWatchlistItems.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div style={{ padding: '20px 0' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#8c8c8c' }}>No AI watchlist candidates yet</div>
                  <div style={{ fontSize: 12, color: '#bfbfbf' }}>Add candidates from Entry Plan to monitor entry conditions.</div>
                </div>
              }
            />
          ) : (
            <Table
              dataSource={aiWatchlistItems.filter(item => item.symbol.toLowerCase().includes(aiWatchlistSearch.toLowerCase()))}
              rowKey="id"
              size="middle"
              pagination={aiWatchlistItems.length > 10 ? { pageSize: 10, size: 'small' } : false}
              scroll={{ x: 1200 }}
              rowClassName="watchlist-row"
              style={{ fontSize: 12 }}
              expandable={{
                expandedRowRender: (record: any) => {
                  const ep = entryPlanResultsBySymbol[record.symbol];
                  if (!ep) return <div style={{ padding: '12px 0', color: '#bbb', fontSize: 12, fontStyle: 'italic' }}>Entry Plan detail unavailable.</div>;
                  return renderEntryPlanDetail(ep);
                },
              }}
              columns={[
                {
                  title: <span style={{ fontWeight: 700, color: '#8c8c8c', fontSize: 10, textTransform: 'uppercase' }}>Symbol</span>,
                  dataIndex: 'symbol',
                  key: 'symbol',
                  width: 90,
                  fixed: 'left' as const,
                  render: (text: string, record: any) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 800, fontSize: 14, color: '#111827' }}>{text}</span>
                      {record.isDevTest && <Tag style={{ fontSize: 8, padding: '0 2px', lineHeight: '12px', margin: 0 }} color="red">DEV</Tag>}
                    </div>
                  ),
                },
                {
                  title: <span style={{ fontWeight: 700, color: '#8c8c8c', fontSize: 10, textTransform: 'uppercase' }}>Price</span>,
                  key: 'currentPrice',
                  width: 90,
                  render: (record: any) => {
                    const p = record.currentPrice;
                    if (!p) return <span style={{ color: '#ccc', fontSize: 12 }}>—</span>;
                    return <span style={{ fontWeight: 700, color: '#1f1f1f', fontSize: 13 }}>${p.toFixed(2)}</span>;
                  },
                },
                {
                  title: <span style={{ fontWeight: 700, color: '#8c8c8c', fontSize: 10, textTransform: 'uppercase' }}>Chg%</span>,
                  key: 'changePercent',
                  width: 80,
                  render: (record: any) => {
                    const c = record.changePercent;
                    if (c == null) return <span style={{ color: '#ccc', fontSize: 12 }}>—</span>;
                    const color = c >= 0 ? '#52c41a' : '#ff4d4f';
                    return <span style={{ color, fontSize: 12, fontWeight: 700 }}>{c >= 0 ? '+' : ''}{c.toFixed(2)}%</span>;
                  },
                },
                {
                  title: <span style={{ fontWeight: 700, color: '#8c8c8c', fontSize: 10, textTransform: 'uppercase' }}>Entry Zone</span>,
                  key: 'entryZone',
                  width: 140,
                  render: (record: any) => {
                    const lo = record.entryZoneLow;
                    const hi = record.entryZoneHigh;
                    if (!lo && !hi) return <span style={{ color: '#ccc', fontSize: 12 }}>—</span>;
                    return <span style={{ fontSize: 12, color: '#434343', fontWeight: 600 }}>${(lo || 0).toFixed(2)} – ${(hi || 0).toFixed(2)}</span>;
                  },
                },
                {
                  title: <span style={{ fontWeight: 700, color: '#8c8c8c', fontSize: 10, textTransform: 'uppercase' }}>Stop / Target</span>,
                  key: 'levels',
                  width: 130,
                  render: (record: any) => (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ color: '#ff4d4f', fontSize: 11 }}>S: ${(record.stopLoss || 0).toFixed(2)}</span>
                      <span style={{ color: '#52c41a', fontSize: 11 }}>T: ${(record.takeProfit1 || 0).toFixed(2)}</span>
                    </div>
                  )
                },
                {
                  title: <span style={{ fontWeight: 700, color: '#8c8c8c', fontSize: 10, textTransform: 'uppercase' }}>R/R</span>,
                  dataIndex: 'riskReward',
                  key: 'riskReward',
                  width: 60,
                  render: (v: number | null) => v ? <span style={{ fontWeight: 600 }}>{v.toFixed(1)}x</span> : <span style={{ color: '#ccc' }}>—</span>,
                },
                {
                  title: <span style={{ fontWeight: 700, color: '#8c8c8c', fontSize: 10, textTransform: 'uppercase' }}>Status</span>,
                  key: 'status',
                  width: 120,
                  render: (record: any) => {
                    const r = getWatchlistReadiness(record);
                    return <Tag color={getReadinessColor(r)} bordered={false} style={{ fontSize: 10, fontWeight: 700, padding: '0 8px', borderRadius: 4 }}>{r.toUpperCase()}</Tag>;
                  },
                },
                {
                  title: <span style={{ fontWeight: 700, color: '#8c8c8c', fontSize: 10, textTransform: 'uppercase' }}>Source</span>,
                  key: 'source',
                  width: 100,
                  render: (record: any) => {
                    const src = record.selectedBy || record.source || 'Entry Plan';
                    const color = src === 'Continue' ? 'success' : src === 'Watch-to-Validate' ? 'warning' : 'blue';
                    const label = src === 'Watch-to-Validate' ? 'Watch→Val' : src;
                    return <Tag color={color} style={{ fontSize: 9, margin: 0, padding: '0 4px', borderRadius: 2 }}>{label.toUpperCase()}</Tag>;
                  },
                },
                {
                  title: '',
                  key: 'actions',
                  width: 44,
                  fixed: 'right' as const,
                  render: (record: any) => (
                    <Tooltip title="Remove from watchlist">
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined style={{ fontSize: 14 }} />}
                        onClick={() => removeFromWatchlist(record.id, record.symbol)}
                        className="delete-action-btn"
                        style={{ padding: 0, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      />
                    </Tooltip>
                  ),
                },
              ]}
            />
          )}
        </Card>
      </div>

      {/* 2. Market Scanner */}
      <CollapsibleStageSection
        title="Market Scanner"
        icon={<LineChartOutlined />}
        statusText={
          detailedScanStatus.currentStatus === 'scanning' ? 'SCANNING' :
          detailedScanStatus.currentStatus === 'completed' ? 'COMPLETED' :
          detailedScanStatus.currentStatus === 'error' ? 'ERROR' :
          detailedScanStatus.currentStatus === 'stopping' ? 'STOPPING' :
          detailedScanStatus.currentStatus === 'stopped' ? 'STOPPED' : 'IDLE'
        }
        statusColor={
          detailedScanStatus.currentStatus === 'scanning' ? 'processing' :
          detailedScanStatus.currentStatus === 'completed' ? 'success' :
          detailedScanStatus.currentStatus === 'error' ? 'error' : 'default'
        }
        progressValue={detailedScanStatus.totalCount > 0 ? Math.round((detailedScanStatus.processedCount / detailedScanStatus.totalCount) * 100) : null}
        progressText={detailedScanStatus.currentStatus === 'scanning' ? `${detailedScanStatus.processedCount}/${detailedScanStatus.totalCount}` : undefined}
        summaryChips={marketScannerResults.length > 0 ? [
          { label: 'Results', value: marketScannerResults.length },
          { label: 'AI', value: marketScannerResults.filter((r: any) => r.aiCalled).length, color: '#1890ff' },
          { label: 'Rules', value: marketScannerResults.filter((r: any) => !r.aiCalled).length },
        ] : undefined}
        actionButton={
          <Tooltip title={pipelineRunning && detailedScanStatus.currentStatus !== 'scanning' ? 'Disabled while AI Pipeline is running.' : ''}>
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
                {detailedScanStatus.currentStatus === 'scanning' ? 'Stop Scanner' : 'Run Scanner'}
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
                <Tooltip title={pipelineRunning && detailedScanStatus.currentStatus !== 'scanning' ? 'Disabled while AI Pipeline is running.' : ''}>
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
                      {detailedScanStatus.currentStatus === 'scanning' ? 'Stop Scanner' : 'Run Scanner'}
                    </Button>
                  </span>
                </Tooltip>
                {detailedScanStatus.currentStatus === 'scanning' && (
                  <Text type="secondary" style={{ fontSize: '12px' }}>Scanning in progress...</Text>
                )}
                {detailedScanStatus.currentStatus === 'stopping' && (
                  <Text type="warning" style={{ fontSize: '12px' }}>Stopping...</Text>
                )}
                {detailedScanStatus.currentStatus === 'stopped' && (
                  <Text type="warning" style={{ fontSize: '12px' }}>Scan stopped by user. {marketScannerResults.length} results retained.</Text>
                )}
                {detailedScanStatus.currentStatus === 'completed' && (
                  <Text type="success" style={{ fontSize: '12px' }}>Scan completed: {detailedScanStatus.processedCount} symbols</Text>
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
                <Text strong>Status:</Text>
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
                  {detailedScanStatus.currentStatus === 'scanning' ? 'SCANNING' :
                   detailedScanStatus.currentStatus === 'completed' ? 'COMPLETED' :
                   detailedScanStatus.currentStatus === 'error' ? 'ERROR' :
                   detailedScanStatus.currentStatus === 'stopping' ? 'STOPPING' :
                   detailedScanStatus.currentStatus === 'stopped' ? 'STOPPED' : 'IDLE'}
                </Text>
              </div>
            </Col>

            <Col span={6}>
              <div style={{ marginBottom: '8px' }}>
                <Text strong>Progress:</Text>
              </div>
              <Text type="secondary" style={{ fontSize: '13px' }}>
                {detailedScanStatus.currentStatus === 'scanning'
                  ? `${detailedScanStatus.processedCount}/${detailedScanStatus.totalCount} symbols`
                  : detailedScanStatus.currentStatus === 'completed' ? `Completed ${detailedScanStatus.totalCount}/${detailedScanStatus.totalCount}` :
                    detailedScanStatus.currentStatus === 'stopped' ? `Stopped at ${detailedScanStatus.processedCount}/${detailedScanStatus.totalCount}` : 'Idle'}
              </Text>
            </Col>

            <Col span={6}>
              <div style={{ marginBottom: '8px' }}>
                <Text strong>Data Quality:</Text>
              </div>
              <Text type="secondary" style={{ fontSize: '13px' }}>
                {marketScannerResults.length > 0
                  ? `${marketScannerResults.filter((r: any) => r.price != null && r.volume > 0).length} good / ${marketScannerResults.filter((r: any) => (r.price != null || r.volume > 0) && !(r.price != null && r.volume > 0)).length} partial`
                  : !configStatus.alpaca ? 'Not configured' :
                    detailedScanStatus.currentStatus === 'scanning' ? 'Collecting...' : 'No data yet'}
              </Text>
            </Col>

            <Col span={6}>
              <div style={{ marginBottom: '8px' }}>
                <Text strong>AI Status:</Text>
              </div>
              <Text type="secondary" style={{ fontSize: '13px' }}>
                {marketScannerResults.length > 0
                  ? `${marketScannerResults.filter((r: any) => r.aiCalled).length} AI / ${marketScannerResults.filter((r: any) => !r.aiCalled).length} Local Rules`
                  : configStatus.aiTestStatus === 'connected' ? 'Connected' :
                    configStatus.aiTestStatus === 'saved' ? 'Not tested' :
                    configStatus.aiTestStatus === 'error' ? 'Error' :
                    configStatus.ai ? 'Not tested' : 'Rule-based only'}
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
                    {detailedScanStatus.currentStatus === 'scanning' ? 'Scanning in Progress' :
                     detailedScanStatus.currentStatus === 'stopped' ? 'Scan Stopped' :
                     detailedScanStatus.currentStatus === 'completed' ? 'Scan Completed' :
                     detailedScanStatus.currentStatus === 'error' ? 'Scan Error' : 'Waiting for Next Scan'}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#262626', lineHeight: 1.2 }}>
                    {detailedScanStatus.percent}% <span style={{ fontSize: 14, fontWeight: 400, color: '#8c8c8c' }}>Complete</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, color: '#595959', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{detailedScanStatus.processedCount}</span> / {detailedScanStatus.totalCount} Symbols Processed
                  </div>
                  <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                    {detailedScanStatus.validatedCount} Validated • {detailedScanStatus.failedCount > 0 && `${detailedScanStatus.failedCount} Failed • `}{detailedScanStatus.retryCount} Retries
                    {detailedScanStatus.lastFailureReason && <div style={{ fontSize: 11, color: '#ff4d4f', marginTop: 2 }}>Last failure: {detailedScanStatus.lastFailureReason}</div>}
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
                  <Text strong style={{ color: '#262626' }}>Currently Scanning:</Text>
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
                  <Text strong style={{ fontSize: '16px' }}>Market Scan Summary</Text>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: 2 }}>
                    {marketScannerSummary.lastScanTime
                      ? new Date(marketScannerSummary.lastScanTime).toLocaleString()
                      : 'Not scanned'}
                  </div>
                </div>
                <Tag color="blue">Full Market Scan</Tag>
              </div>

              <Divider style={{ margin: '12px 0' }} />

              <Row gutter={[16, 16]}>
                <Col span={4}>
                  <Statistic
                    title="Universe Scanned"
                    value={marketScannerSummary.universeScanned}
                    valueStyle={{ color: '#1890ff', fontSize: '20px', fontWeight: 'bold' }}
                    prefix={<BarChartOutlined />}
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title="Bullish"
                    value={marketScannerSummary.bullishCount}
                    valueStyle={{ color: '#52c41a', fontSize: '20px', fontWeight: 'bold' }}
                    prefix={<ArrowUpOutlined />}
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title="Bearish"
                    value={marketScannerSummary.bearishCount}
                    valueStyle={{ color: '#ff4d4f', fontSize: '20px', fontWeight: 'bold' }}
                    prefix={<ArrowDownOutlined />}
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title="Neutral"
                    value={marketScannerSummary.neutralCount}
                    valueStyle={{ color: '#faad14', fontSize: '20px', fontWeight: 'bold' }}
                    prefix={<MinusOutlined />}
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title="Strong Trend"
                    value={marketScannerSummary.strongTrendCount}
                    valueStyle={{ color: '#722ed1', fontSize: '20px', fontWeight: 'bold' }}
                    prefix={<ThunderboltOutlined />}
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title="News Risk"
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
                  <Text strong style={{ fontSize: '15px' }}>Top Market Trends <span style={{ color: '#8c8c8c', fontWeight: 'normal', fontSize: '13px' }}>({getFilteredAndSortedResults().length})</span></Text>
                  
                  <div style={{ display: 'flex', background: '#f0f2f5', padding: 4, borderRadius: 6, gap: 4 }}>
                    {[
                      { value: 'all', label: 'All' },
                      { value: 'strong', label: 'Strong' },
                      { value: 'bullish', label: 'Bullish' },
                      { value: 'neutral', label: 'Neutral' },
                      { value: 'bearish', label: 'Bearish' }
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
                    title: 'Symbol',
                    dataIndex: 'symbol',
                    key: 'symbol',
                    fixed: 'left',
                    width: 150,
                    render: (text: string, record: any) => (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="scanner-symbol-text">{text}</span>
                        <span className="scanner-company-text">{record.companyName || record.name || 'Unknown Company'}</span>
                      </div>
                    ),
                  },
                  {
                    title: 'Trend',
                    dataIndex: 'trendLabel',
                    key: 'trendLabel',
                    width: 120,
                    render: (label: string) => renderTrendBadge(label)
                  },
                  {
                    title: 'Score',
                    dataIndex: 'trendScore',
                    key: 'trendScore',
                    width: 140,
                    render: (score: number, record: any) => {
                      const displayScore = score || record.overallScore || 0;
                      const conf = record.trendConfidence ? (record.trendConfidence * (record.trendConfidence <= 1 ? 100 : 1)).toFixed(0) : '0';
                      const scoreColor = displayScore >= 70 ? '#52c41a' : displayScore >= 40 ? '#faad14' : '#ff4d4f';
                      return (
                        <div style={{ width: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: scoreColor }}>{displayScore.toFixed(0)}</span>
                            <span style={{ fontSize: '10px', color: '#8c8c8c' }}>Conf: {conf}%</span>
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
                    title: 'Price',
                    dataIndex: 'price',
                    key: 'price',
                    width: 120,
                    render: (price: number, record: any) => {
                      const changePct = record.changePct || 0;
                      const changeColor = changePct >= 0 ? '#52c41a' : '#ff4d4f';
                      return (
                        <div>
                          <div className="scanner-price-text">${(price || 0).toFixed(2)}</div>
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: '11px',
                            color: changeColor,
                            fontWeight: 600,
                            padding: '2px 6px',
                            backgroundColor: `${changeColor}10`,
                            borderRadius: '4px',
                            marginTop: 4
                          }}>
                            <span>{changePct >= 0 ? '▲' : '▼'}</span>
                            <span>{changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%</span>
                          </div>
                        </div>
                      );
                    }
                  },
                  {
                    title: 'Volume',
                    dataIndex: 'volume',
                    key: 'volume',
                    width: 130,
                    render: (volume: number, record: any) => {
                      const status = record.volumeStatus || 'Normal';
                      const statusColor = status === 'High' ? '#ff4d4f' : status === 'Low' ? '#52c41a' : '#faad14';
                      return (
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#262626' }}>
                            {marketDataService.formatVolume(volume)}
                          </div>
                          <div style={{ marginTop: 4 }}>
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
                              {status}
                            </span>
                          </div>
                        </div>
                      );
                    }
                  },
                  {
                    title: 'News / Sentiment',
                    dataIndex: 'newsSentiment',
                    key: 'newsSentiment',
                    width: 140,
                    render: (sentiment: string, record: any) => {
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
                            <span style={{ fontSize: '12px', fontWeight: 600, color }}>{sentiment || 'N/A'}</span>
                          </div>
                          <div style={{ fontSize: '10px', color: '#8c8c8c', marginTop: 4 }}>
                            Risk: <span style={{ color: riskColor, fontWeight: 700 }}>{risk}</span>
                          </div>
                        </div>
                      );
                    }
                  },
                  {
                    title: 'Data Qual.',
                    key: 'dataQuality',
                    width: 100,
                    render: (record: any) => {
                      const hasPrice = record.price != null && record.price > 0;
                      const hasVolume = record.volume != null && record.volume > 0;
                      const hasTrend = record.trendLabel != null;
                      const dqOk = hasPrice && hasVolume && hasTrend;
                      const dq = dqOk ? 'Good' : 'Partial';
                      const dqColor = dq === 'Good' ? '#52c41a' : '#faad14';
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
                            {record.aiCalled ? record.aiSource : 'Local'}
                          </div>
                        </div>
                      );
                    },
                  },
                  {
                    title: 'AI Reasoning',
                    dataIndex: 'conciseReasoning',
                    key: 'conciseReasoning',
                    width: 250,
                    render: (reason: string, record: any) => {
                      const displayReason = reason || record.scannerReason || record.aiReasoning || 'No analysis available';
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
              <div style={{ fontSize: '14px' }}>No market scan results yet</div>
              <div style={{ fontSize: '12px', marginTop: 8 }}>
                Click "Run Scanner" to start scanning the market
              </div>
            </div>
          )}
        </Card>
      </CollapsibleStageSection>

      {/* 2.5 Preferred Continue Scan List */}
      <CollapsibleStageSection
        title="Preferred Continue Scan List"
        icon={<BarChartOutlined style={{ color: '#1890ff' }} />}
        statusText={
          continueScanStatus === 'processing' ? 'RUNNING' :
          continueScanStatus === 'completed' ? 'COMPLETED' :
          continueScanStatus === 'error' ? 'ERROR' : 'READY'
        }
        statusColor={
          continueScanStatus === 'processing' ? 'processing' :
          continueScanStatus === 'completed' ? 'success' :
          continueScanStatus === 'error' ? 'error' : 'default'
        }
        progressValue={continueScanStatus === 'processing' ? continueScanProgress : null}
        summaryChips={preferredContinueScanList.length > 0 ? [
          { label: 'Candidates', value: preferredContinueScanList.length },
          { label: 'AI Reasons', value: preferredContinueScanList.filter((c: any) => c.reasonSource === 'AI').length, color: '#1890ff' },
          { label: 'Rule-based', value: preferredContinueScanList.filter((c: any) => c.reasonSource !== 'AI').length },
        ] : undefined}
        actionButton={
          <Tooltip title={pipelineRunning ? 'Disabled while AI Pipeline is running.' : ''}>
            <span>
              <Button
                type="primary"
                onClick={() => handleStartContinueScan()}
                disabled={marketScannerResults.length === 0 || continueScanStatus === 'processing' || pipelineRunning}
                loading={continueScanStatus === 'processing'}
                icon={<ThunderboltOutlined />}
                style={AI_AGENT_PRIMARY_BTN_STYLE}
              >
                {continueScanStatus === 'processing' ? 'Processing...' : 'Start Selection'}
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
              <span style={{ fontWeight: 600 }}>Status:</span>
              <Tag 
                color={
                  continueScanStatus === 'processing' ? 'blue' :
                  continueScanStatus === 'completed' ? 'success' :
                  continueScanStatus === 'error' ? 'error' : 'default'
                }
                className="continue-scan-status-badge"
              >
                {continueScanStatus === 'processing' ? 'RUNNING' :
                 continueScanStatus === 'completed' ? 'COMPLETED' :
                 continueScanStatus === 'error' ? 'ERROR' : 'READY'}
              </Tag>
            </div>
            <Divider type="vertical" />
            <span><strong>Source:</strong> Market Scanner</span>
            <Divider type="vertical" />
            <span>
              <strong>Selection:</strong>{' '}
              {preferredContinueScanList.length > 0 ? (
                preferredContinueScanList.filter(c => c.reasonSource === 'AI').length > 0 ? (
                  <Tag color="cyan" style={{ fontSize: '10px', fontWeight: 700 }}>AI + RULES</Tag>
                ) : (
                  <Tag color="orange" style={{ fontSize: '10px', fontWeight: 700 }}>RULES ONLY</Tag>
                )
              ) : '—'}
            </span>
            <Divider type="vertical" />
            <span><strong>Pool:</strong> {marketScannerResults.length} symbols</span>
            {detailedScanStatus.lastScanAt && (
              <>
                <Divider type="vertical" />
                <span>
                  <strong>Last Sync:</strong> {new Date(detailedScanStatus.lastScanAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </>
            )}
          </div>

          {/* AI fallback warning */}
          {continueScanStatus === 'completed' && preferredContinueScanList.length > 0 &&
            preferredContinueScanList.filter(c => c.reasonSource === 'AI').length === 0 && (
            <Alert
              message="Rule-based selection active. AI reasoning is currently disabled."
              type="info"
              showIcon
              style={{ marginBottom: '16px', borderRadius: '8px' }}
            />
          )}

          {/* 统计卡片 - 只在完成时显示 */}
          {continueScanStatus === 'completed' && preferredContinueScanList.length > 0 && (
            <div className="continue-scan-stat-grid">
              <div className="continue-scan-stat-card">
                <div className="continue-scan-stat-label">Selected</div>
                <div className="continue-scan-stat-value">
                  {preferredContinueScanList.length}
                  <span className="continue-scan-stat-sub">/ {marketScannerResults.length}</span>
                </div>
              </div>
              <div className="continue-scan-stat-card">
                <div className="continue-scan-stat-label">Avg Priority</div>
                <div className="continue-scan-stat-value" style={{ color: '#1890ff' }}>
                  {preferredContinueScanList.length > 0
                    ? `${Math.round(preferredContinueScanList.reduce((sum, c) => sum + (c.priorityScore || 0), 0) / preferredContinueScanList.length)}%`
                    : '—'}
                </div>
              </div>
              <div className="continue-scan-stat-card">
                <div className="continue-scan-stat-label">Risk Mix (L/M/H)</div>
                <div className="continue-scan-stat-value" style={{ fontSize: '16px', paddingTop: '4px' }}>
                  <span style={{ color: '#52c41a' }}>{preferredContinueScanList.filter(c => (c.eventRisk || 'Medium') === 'Low').length}</span>
                  <span style={{ color: '#bfbfbf', margin: '0 4px' }}>/</span>
                  <span style={{ color: '#faad14' }}>{preferredContinueScanList.filter(c => (c.eventRisk || 'Medium') === 'Medium').length}</span>
                  <span style={{ color: '#bfbfbf', margin: '0 4px' }}>/</span>
                  <span style={{ color: '#ff4d4f' }}>{preferredContinueScanList.filter(c => (c.eventRisk || 'Medium') === 'High').length}</span>
                </div>
              </div>
              <div className="continue-scan-stat-card">
                <div className="continue-scan-stat-label">Avg Score</div>
                <div className="continue-scan-stat-value">
                  {preferredContinueScanList.length > 0
                    ? Math.round(preferredContinueScanList.reduce((sum, c) => sum + (c.overallScore || c.trendScore || 0), 0) / preferredContinueScanList.length)
                    : '—'}
                </div>
              </div>
              <div className="continue-scan-stat-card">
                <div className="continue-scan-stat-label">AI Coverage</div>
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
                <Text strong style={{ color: '#1890ff' }}>{continueScanDetails.currentStage || 'Processing...'}</Text>
                <Text strong>{continueScanProgress}%</Text>
              </div>
              <Progress
                percent={continueScanProgress}
                status="active"
                strokeColor={{ '0%': '#1890ff', '100%': '#52c41a' }}
                strokeWidth={10}
              />
              <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: '8px' }}>
                Candidates processed: <strong>{continueScanDetails.processedCount}</strong> / {continueScanDetails.totalCount}
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
                  <div style={{ fontSize: '14px' }}>No market scan results available</div>
                  <div style={{ fontSize: '12px', marginTop: 8 }}>
                    {detailedScanStatus.currentStatus === 'scanning'
                      ? 'Market scan in progress...'
                      : detailedScanStatus.currentStatus === 'stopped'
                      ? 'Scan was stopped before any results were collected.'
                      : 'Run Market Scanner first to build a continue scan shortlist.'}
                  </div>
                </div>
              );
            }

            // 状态2: continue scan处理中
            if (continueScanStatus === 'processing') {
              return (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                  <SyncOutlined spin style={{ fontSize: '48px', marginBottom: 16, color: '#1890ff' }} />
                  <div style={{ fontSize: '14px' }}>Rule-based scan in progress...</div>
                  <div style={{ fontSize: '12px', marginTop: 8 }}>
                    Processing {continueScanDetails.processedCount} of {continueScanDetails.totalCount} candidates
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
                        Selection Successful
                      </div>
                      <div style={{ color: '#595959', fontSize: '12px' }}>
                        Found <strong>{preferredContinueScanList.length}</strong> top-tier candidates for follow-up analysis.
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
                        title: 'Symbol',
                        key: 'symbol',
                        width: 140,
                        render: (record) => (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span className="scanner-symbol-text">{record.symbol}</span>
                              {record.isDevTest && <Tag color="red" style={{ fontSize: 9, padding: '0 3px', lineHeight: '14px', margin: 0 }}>DEV TEST</Tag>}
                            </div>
                            <span className="scanner-company-text" style={{ maxWidth: 100 }}>
                              {record.companyName || 'Unknown Company'}
                            </span>
                          </div>
                        ),
                      },
                      {
                        title: 'Trend',
                        key: 'trend',
                        width: 120,
                        render: (record) => renderTrendBadge(record.trendLabel),
                      },
                      {
                        title: 'Score',
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
                        title: 'Priority',
                        key: 'priority',
                        width: 160,
                        render: (record) => {
                          const ps = record.priorityScore || 0;
                          const pb = record.priorityBreakdown || {};
                          const color = ps >= 80 ? '#52c41a' : ps >= 60 ? '#faad14' : '#ff4d4f';
                          const breakdownContent = (
                            <div style={{ padding: '8px', fontSize: '11px' }}>
                              <div style={{ fontWeight: 700, marginBottom: 4, borderBottom: '1px solid #f0f0f0', paddingBottom: 2 }}>Score Breakdown</div>
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
                                  <span style={{ color: '#8c8c8c', fontWeight: 600 }}>Weight</span>
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
                        title: 'Risk',
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
                        title: 'Price / Chg',
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
                        title: 'Selection Reason',
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
                        title: 'Source',
                        key: 'source',
                        width: 100,
                        render: (record) => (
                          <Tag color={record.reasonSource === 'AI' ? 'cyan' : 'orange'} style={{ fontSize: '10px', fontWeight: 700, margin: 0 }}>
                            {record.reasonSource === 'AI' ? 'AI Agent' : 'Rules'}
                          </Tag>
                        ),
                      },
                      {
                        title: 'Data',
                        key: 'data',
                        width: 80,
                        render: (record) => {
                          const dq = record.dataQuality || 'PARTIAL';
                          const color = dq === 'GOOD' ? '#52c41a' : '#faad14';
                          return (
                            <Tooltip title={`Quality: ${dq} | Source: ${record.dataSource || 'N/A'}`}>
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
                          Displaying <strong>{range[0]}-{range[1]}</strong> of <strong>{total}</strong> candidates
                        </span>
                      )}
                      onChange={(page) => setPreferredContinuePage(page)}
                    />
                  </div>

                  <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
                    <Alert
                      message="Selection Disclosure: These candidates are filtered from the primary scanner and priority-weighted. Run Fine Scan to validate strategy fit and backtest quality."
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
                  <div style={{ fontSize: '14px' }}>No suitable candidates found</div>
                  <div style={{ fontSize: '12px', marginTop: 8 }}>
                    Market scan completed but no bullish candidates met the criteria for continue scan
                  </div>
                </div>
              );
            }

            // 状态5: continue scan错误
            if (continueScanStatus === 'error') {
              return (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                  <CloseCircleOutlined style={{ fontSize: '48px', marginBottom: 16, color: '#ff4d4f' }} />
                  <div style={{ fontSize: '14px', color: '#ff4d4f' }}>Continue scan processing failed</div>
                  <div style={{ fontSize: '12px', marginTop: 8 }}>
                    An error occurred while processing continue scan candidates
                  </div>
                </div>
              );
            }

            // 状态6: market scan完成但continue scan未开始
            const wasStopped = detailedScanStatus.currentStatus === 'stopped';
            return (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                <ClockCircleOutlined style={{ fontSize: '48px', marginBottom: 16 }} />
                <div style={{ fontSize: '14px' }}>Ready to start continue scan</div>
                <div style={{ fontSize: '12px', marginTop: 8 }}>
                  {wasStopped
                    ? `Built from partial scanner results: ${detailedScanStatus.processedCount}/${detailedScanStatus.totalCount} symbols`
                    : `Market scan completed with ${marketScannerResults.length} results`}
                </div>
                <div style={{ fontSize: '11px', color: '#999', marginTop: 8 }}>
                  Click "Start Continue Scan" to run rule-based selection on current results
                </div>
              </div>
            );
          })()}
        </Card>
        </div>
      </CollapsibleStageSection>

      {/* 3. Fine Scan */}
      <CollapsibleStageSection
        title="Fine Scan"
        icon={<ThunderboltOutlined />}
        statusText={
          fineScanStatus === 'running' ? 'RUNNING' :
          fineScanStatus === 'completed' ? 'COMPLETED' :
          fineScanStatus === 'stopped' ? 'STOPPED' :
          fineScanStatus === 'error' ? 'ERROR' : 'IDLE'
        }
        statusColor={
          fineScanStatus === 'running' ? 'processing' :
          fineScanStatus === 'completed' ? 'success' :
          fineScanStatus === 'stopped' ? 'warning' :
          fineScanStatus === 'error' ? 'error' : 'default'
        }
        progressValue={(fineScanStatus === 'running' || fineScanStatus === 'stopped') && fineScanProgress > 0 ? fineScanProgress : null}
        summaryChips={fineScanResults.length > 0 ? [
          { label: 'Scanned', value: fineScanResults.length },
          { label: 'Continue', value: fineScanResults.filter((r: any) => r.decision === 'Continue').length, color: '#52c41a' },
          { label: 'Watch', value: fineScanResults.filter((r: any) => r.decision === 'Watch').length, color: '#faad14' },
          { label: 'Reject', value: fineScanResults.filter((r: any) => r.decision === 'Reject').length, color: '#ff4d4f' },
          { label: 'Need Data', value: fineScanResults.filter((r: any) => r.decision === 'NeedMoreData').length, color: '#fa8c16' },
        ] : undefined}
        actionButton={
          <Tooltip title={pipelineRunning ? 'Disabled while AI Pipeline is running.' : ''}>
            <span>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={handleRunFineScan}
                disabled={fineScanStatus === 'running' || preferredContinueScanList.length === 0 || pipelineRunning}
                loading={fineScanStatus === 'running'}
                style={AI_AGENT_PRIMARY_BTN_STYLE}
              >
                {fineScanStatus === 'running' ? 'Running...' : 'Run Fine Scan'}
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
                    <span style={{ color: '#8c8c8c', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Candidates:</span>
                    <span style={{ fontWeight: 800, color: '#1f1f1f', fontSize: '18px' }}>{total}</span>
                  </div>
                  <Divider type="vertical" style={{ height: '24px', backgroundColor: '#e8e8e8' }} />
                  <div className="fine-scan-stat-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#8c8c8c', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase' }}>Continue:</span>
                    <Tag color="success" style={{ fontWeight: 800, margin: 0, fontSize: '14px', padding: '0 10px', borderRadius: '4px', lineHeight: '24px' }}>{contCount}</Tag>
                  </div>
                  <Divider type="vertical" style={{ height: '24px' }} />
                  <div className="fine-scan-stat-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#8c8c8c', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase' }}>Watch:</span>
                    <Tag color="warning" style={{ fontWeight: 800, margin: 0, fontSize: '14px', padding: '0 10px', borderRadius: '4px', lineHeight: '24px' }}>{watchCount}</Tag>
                  </div>
                  <Divider type="vertical" style={{ height: '24px' }} />
                  <div className="fine-scan-stat-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#8c8c8c', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase' }}>Reject:</span>
                    <Tag color="error" style={{ fontWeight: 800, margin: 0, fontSize: '14px', padding: '0 10px', borderRadius: '4px', lineHeight: '24px' }}>{rejectCount}</Tag>
                  </div>
                  <Divider type="vertical" style={{ height: '24px' }} />
                  <div className="fine-scan-stat-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#8c8c8c', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase' }}>Need Data:</span>
                    <Tag color="orange" style={{ fontWeight: 800, margin: 0, fontSize: '14px', padding: '0 10px', borderRadius: '4px', lineHeight: '24px' }}>{needDataCount}</Tag>
                  </div>
                  <Divider type="vertical" style={{ height: '24px' }} />
                  <div className="fine-scan-stat-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                    <span style={{ color: '#8c8c8c', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase' }}>AI Agent:</span>
                    <Tag color="cyan" style={{ fontWeight: 800, margin: 0, fontSize: '13px', padding: '0 10px', borderRadius: '4px', lineHeight: '24px', letterSpacing: '0.5px' }}>DEEPSEEK V3</Tag>
                  </div>
                </>
              );
            })() : (
              <div style={{ color: '#8c8c8c', fontSize: '14px', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 500 }}>
                <InfoCircleOutlined style={{ color: '#1890ff' }} />
                {fineScanStatus === 'idle' ? 'System ready for multi-dimensional strategy confirmation' : 'Awaiting input from Continue Scan'}
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
                    {fineScanStatus === 'stopped' ? 'Scan Interrupted' : 'Scanning Regime & Strategies'}
                  </div>
                  <div style={{ fontSize: '14px', color: fineScanStatus === 'stopped' ? '#d48806' : '#1890ff', marginTop: 4, fontWeight: 500 }}>
                    {fineScanMessage || 'Processing market data for selected candidates...'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: fineScanStatus === 'stopped' ? '#d48806' : '#1890ff', lineHeight: 1, fontFamily: "'Inter', sans-serif" }}>
                    {fineScanProgress}%
                  </div>
                  <div style={{ fontSize: '11px', color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700, marginTop: 4 }}>
                    {fineScanStatus === 'stopped' ? 'Retained' : 'Process Progress'}
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
                  title: 'Symbol',
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
                  title: 'Decision',
                  key: 'decision',
                  width: 110,
                  render: (record) => {
                    const d = record.decision || '--';
                    let c = '#999', l = d;
                    const source = record.decisionSource || 'local-rule';
                    const sourceLabel = source === 'ai' ? 'AI' : 'Rules';
                    if (d === 'Continue') { c = '#52c41a'; l = 'Continue'; }
                    else if (d === 'Watch') { c = '#faad14'; l = 'Watch'; }
                    else if (d === 'Reject') { c = '#ff4d4f'; l = 'Reject'; }
                    else if (d === 'NeedMoreData') { c = '#fa8c16'; l = 'Need Data'; }
                    else if (d === 'Skip') { c = '#ff4d4f'; l = 'Skip'; }
                    return (
                      <Tooltip title={`Source: ${source}${record.decisionReason ? ' | ' + record.decisionReason : ''}`}>
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
                  title: 'Why',
                  key: 'blockingReason',
                  width: 240,
                  render: (record: any) => {
                    const d = record.decision || '--';
                    const reason = record.decisionReason || '';
                    const blockers = record.decisionBlockers || [];
                    const warnings = record.decisionWarnings || [];
                    const parts: string[] = [];
                    if (d !== 'Continue' && blockers.length > 0) {
                      parts.push('Block: ' + blockers.slice(0, 2).join('; '));
                    }
                    if (warnings.length > 0) {
                      parts.push('Warn: ' + warnings.slice(0, 2).join('; '));
                    }
                    if (reason && parts.length === 0) {
                      parts.push(reason.length > 100 ? reason.slice(0, 100) + '...' : reason);
                    }
                    const text = parts.join(' | ') || (d === 'Continue' ? 'Meets all verification criteria' : '-');
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
                  title: 'Score',
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
                  title: 'Strategies',
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
                  title: 'Liquidity',
                  key: 'liquidity',
                  width: 100,
                  render: (record) => {
                    const lg = record.liquidityGrade || '-';
                    let c = '#bbb', l = '-';
                    if (lg === 'Good') { c = '#52c41a'; l = 'Good'; }
                    else if (lg === 'Caution') { c = '#faad14'; l = 'Caution'; }
                    else if (lg === 'Poor') { c = '#ff4d4f'; l = 'Poor'; }
                    else if (lg === 'Error' || lg === 'Data Unavailable' || lg === 'Unknown') { c = '#bbb'; l = 'N/A'; }
                    else if (lg === 'Partial') { c = '#faad14'; l = 'Partial'; }
                    return <span style={{ color: c, fontSize: '13px', fontWeight: 700 }}>{l}</span>;
                  },
                },
                // ===== Entry =====
                {
                  title: 'Entry',
                  key: 'entry',
                  width: 120,
                  render: (record) => {
                    const eq = record.entryQuality || '-';
                    let c = '#999', l = '-';
                    if (eq === 'Excellent') { c = '#52c41a'; l = 'Excellent'; }
                    else if (eq === 'Good') { c = '#73d13d'; l = 'Good'; }
                    else if (eq === 'Wait for Pullback') { c = '#faad14'; l = 'Wait'; }
                    else if (eq === 'Chasing / Extended') { c = '#ff7a45'; l = 'Extended'; }
                    else if (eq === 'Near Resistance') { c = '#ff4d4f'; l = 'Near Res'; }
                    else if (eq === 'Poor Reward-Risk') { c = '#ff4d4f'; l = 'Poor R/R'; }
                    else if (eq === 'Partial') { c = '#b37feb'; l = 'Partial'; }
                    else if (eq === 'Data Unavailable' || eq === 'Error / No Data') { c = '#bbb'; l = 'No Data'; }
                    return <span style={{ color: c, fontSize: '13px', fontWeight: 700 }}>{l}</span>;
                  },
                },
                // ===== Validation =====
                {
                  title: 'Validation',
                  key: 'validation',
                  width: 160,
                  render: (record) => {
                    const ps = record.backtestPerformance || null;
                    let pc = '#999', pl = 'Pending';
                    if (ps === 'positive') { pc = '#52c41a'; pl = 'Positive'; }
                    else if (ps === 'negative') { pc = '#ff4d4f'; pl = 'Negative'; }
                    else if (ps === 'caution') { pc = '#faad14'; pl = 'Caution'; }
                    const optStatus = record.quickOptStatus || 'Not Run';
                    let stLabel = 'N/A', stColor = '#999';
                    if (optStatus === 'completed') {
                      const qr = record.quickOptResults || [];
                      if (qr.length > 0) {
                        const stable = qr.filter(function(r: any) { return r.stability === 'Stable'; }).length;
                        const weak = qr.filter(function(r: any) { return r.stability === 'Weak'; }).length;
                        const overfit = qr.filter(function(r: any) { return r.stability === 'Overfit Risk'; }).length;
                        if (stable >= qr.length * 0.7 || stable >= 2) { stLabel = 'Stable'; stColor = '#52c41a'; }
                        else if (weak > overfit) { stLabel = 'Weak'; stColor = '#faad14'; }
                        else if (overfit > 0) { stLabel = 'Overfit'; stColor = '#ff4d4f'; }
                      }
                    }
                    return (
                      <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
                        <div>
                          <span style={{ color: '#8c8c8c', fontWeight: 500 }}>Backtest: </span>
                          <span style={{ color: pc, fontWeight: 700 }}>{pl}</span>
                        </div>
                        <div>
                          <span style={{ color: '#8c8c8c', fontWeight: 500 }}>Opt: </span>
                          <span style={{ color: stColor, fontWeight: 700 }}>{stLabel}</span>
                        </div>
                      </div>
                    );
                  },
                },
                {
                  title: 'Risk',
                  key: 'risk',
                  width: 90,
                  render: (record) => {
                    const rg = record.riskGrade || '-';
                    let c = '#bbb', l = '-', dot = '';
                    if (rg === 'LOW') { c = '#52c41a'; l = 'Low'; dot = '🟢'; }
                    else if (rg === 'MEDIUM') { c = '#faad14'; l = 'Medium'; dot = '🟠'; }
                    else if (rg === 'HIGH') { c = '#ff4d4f'; l = 'High'; dot = '🔴'; }
                    else if (rg === 'SKIP') { c = '#ff4d4f'; l = 'Skip'; dot = '⛔'; }
                    else { c = '#bbb'; l = 'N/A'; }
                    const riskReason = record.riskReason || '';
                    return <Tooltip title={riskReason}><span style={{ color: c, fontSize: '13px', fontWeight: 700 }}>{dot} {l}</span></Tooltip>;
                  },
                },
                // ===== Why Matched =====
                {
                  title: 'Why Matched',
                  key: 'whyMatched',
                  width: 180,
                  render: (record) => {
                    const full = record.matchReason || '';
                    const truncated = full.length > 60 ? full.substring(0, 60) + '...' : full;
                    return (
                      <Tooltip title={record.matchAISource === 'ai-explain' ? 'AI-generated explanation' : 'Template-based (market data)'}>
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
                  title: 'Grade',
                  key: 'grade',
                  width: 80,
                  render: (record) => {
                    const g = record.fineScanGrade || null;
                    const getGrade = () => {
                      if (g === 'HIGH') return { l: 'High', c: '#52c41a' };
                      if (g === 'MEDIUM') return { l: 'Medium', c: '#faad14' };
                      if (g === 'LOW') return { l: 'Low', c: '#ff4d4f' };
                      const btOk = record.backtestStatus === 'pass' && (record.backtestPerformance === 'positive' || record.backtestPerformance === 'caution');
                      const eqOk = record.entryQuality === 'Excellent' || record.entryQuality === 'Good' || record.entryQuality === 'Wait for Pullback';
                      const riskOk = record.riskGrade === 'LOW' || record.riskGrade === 'MEDIUM';
                      const scoreOk = (record.matchConfidence || 0) >= 30;
                      if (btOk && scoreOk && eqOk && riskOk) return { l: 'High', c: '#52c41a' };
                      if (btOk && (record.matchConfidence || 0) >= 20) return { l: 'Medium', c: '#faad14' };
                      return { l: 'Low', c: '#ff4d4f' };
                    };
                    const res = getGrade();
                    return <span style={{ color: res.c, fontSize: '13px', fontWeight: 800, textTransform: 'uppercase' }}>{res.l}</span>;
                  },
                },
                // ===== Rank =====
                {
                  title: 'Rank',
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
              <Text>No candidates to analyze. Run Continue Scan first.</Text>
            </div>
          )}

          {fineScanStatus === 'error' && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#ff4d4f' }}>
              <CloseCircleOutlined style={{ fontSize: '24px', marginBottom: 8 }} />
              <div>An error occurred during Fine Scan</div>
            </div>
          )}

          {fineScanStatus === 'idle' && fineScanResults.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>
              <ThunderboltOutlined style={{ fontSize: '36px', marginBottom: 12, opacity: 0.4 }} />
              <div style={{ fontSize: '13px' }}>Run Fine Scan to match strategies for continue-list candidates</div>
              <div style={{ fontSize: '11px', marginTop: 8, color: '#bbb' }}>
                Step 1: Regime & strategy matching &nbsp;|&nbsp; Step 3: Quick backtest validation
              </div>
            </div>
          )}
        </Card>
      </CollapsibleStageSection>

      {/* ===== Deeper Validation ===== */}
      <CollapsibleStageSection
        title="Deeper Validation"
        icon={<BarChartOutlined />}
        statusText={
          deeperValidationStatus === 'loading' ? 'VALIDATING' :
          deeperValidationStatus === 'completed' ? 'COMPLETED' :
          deeperValidationStatus === 'stopped' ? 'INTERRUPTED' :
          deeperValidationStatus === 'error' ? 'ERROR' : 'IDLE'
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
              { label: 'Validated', value: deeperValidationResults.length },
              { label: 'PASS', value: deeperValidationResults.filter((r: any) => r.riskGate?.status === 'PASS').length, color: '#52c41a' },
              { label: 'BLOCK', value: deeperValidationResults.filter((r: any) => r.riskGate?.status === 'BLOCK').length, color: '#ff4d4f' },
            ];
          }
          if (bd.total > 0) {
            const chips: any[] = [
              { label: 'Continue', value: bd.continueCount, color: '#52c41a' },
            ];
            if (bd.watchCount > 0) {
              chips.push({ label: 'Watch-to-Validate', value: bd.watchCount, color: '#faad14' });
            }
            return chips;
          }
          return undefined;
        })()}
        actionButton={
          <Tooltip title={pipelineRunning ? 'Disabled while AI Pipeline is running.' : ''}>
            <span>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleDeeperValidation}
                loading={deeperValidationStatus === 'loading'}
                disabled={fineScanStatus !== 'completed' || fineScanResults.length === 0 || selectValidationCandidates().length === 0 || pipelineRunning}
                style={AI_AGENT_PRIMARY_BTN_STYLE}
              >
            {deeperValidationStatus === 'loading' ? 'Validating...' : (() => {
              const bd = validationCandidateBreakdown();
              if (bd.watchCount > 0) {
                return `Run Validation (${bd.continueCount}C + ${bd.watchCount}W = ${bd.total})`;
              }
              return `Run Validation (${bd.total})`;
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
                    <span style={{ color: '#8c8c8c', fontWeight: 600 }}>CANDIDATES:</span>
                    <span style={{ fontWeight: 800, color: '#1f1f1f' }}>{deeperValidationResults.length}</span>
                  </div>
                  <Divider type="vertical" />
                  <div className="validation-stat-item">
                    <span style={{ color: '#8c8c8c', fontWeight: 600 }}>RISK GATE PASS:</span>
                    <Tag color="success" style={{ fontWeight: 800, margin: 0 }}>
                      {deeperValidationResults.filter((r: any) => r.riskGate?.status === 'PASS').length}
                    </Tag>
                  </div>
                  <Divider type="vertical" />
                  <div className="validation-stat-item">
                    <span style={{ color: '#8c8c8c', fontWeight: 600 }}>CONFIRMED:</span>
                    <Tag color="processing" style={{ fontWeight: 800, margin: 0 }}>
                      {deeperValidationResults.filter((r: any) => r.verdict === 'Confirmed' || r.verdict === 'Pass').length}
                    </Tag>
                  </div>
                  <Divider type="vertical" />
                  <div className="validation-stat-item">
                    <span style={{ color: '#8c8c8c', fontWeight: 600 }}>SYSTEM:</span>
                    <Tag color="blue" style={{ fontWeight: 800, margin: 0 }}>MONTE CARLO v2</Tag>
                  </div>
                </>
              ) : (
                <div style={{ color: '#8c8c8c', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <InfoCircleOutlined />
                  {deeperValidationStatus === 'idle' 
                    ? `Ready for historical stress testing. ${selectValidationCandidates().length} candidates available.` 
                    : 'System performing multi-regime risk validation...'}
                </div>
              )}
            </div>

            {deeperValidationStatus === 'loading' && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <SyncOutlined spin style={{ fontSize: 32, color: '#1890ff', marginBottom: 16 }} />
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#003a8c' }}>Running Deeper Validation</div>
                <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: 4 }}>Backtest, optimization & stability analysis — can take 1–3 minutes for multiple symbols</div>
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
                    expandedRowRender: (record: any) => renderDVDetailPanel(record),
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
                      title: 'Symbol',
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
                      title: 'Source',
                      key: 'selectedBy',
                      width: 100,
                      render: (record: any) => {
                        const src = record.selectedBy || 'Continue';
                        const isContinue = src === 'Continue';
                        return (
                          <Tag color={isContinue ? 'success' : 'warning'} style={{ fontSize: '9px', margin: 0, padding: '0 4px' }}>
                            {isContinue ? 'Continue' : 'Watch→Val'}
                          </Tag>
                        );
                      },
                    },
                    {
                      title: '1Y Return',
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
                      title: 'Sharpe',
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
                      title: 'Max DD',
                      key: 'maxDrawdown',
                      width: 90,
                      render: (record: any) => {
                        const mdd = Math.abs(record.maxDrawdown || 0);
                        const color = mdd <= 15 ? '#52c41a' : mdd <= 25 ? '#faad14' : '#ff4d4f';
                        return <span style={{ color, fontWeight: 600 }}>-{mdd.toFixed(1)}%</span>;
                      },
                    },
                    {
                      title: 'Win Rate',
                      key: 'winRate',
                      width: 90,
                      render: (record: any) => {
                        const wr = record.winRate || 0;
                        const color = wr >= 55 ? '#52c41a' : wr >= 45 ? '#faad14' : '#ff4d4f';
                        return <span style={{ color, fontWeight: 700 }}>{wr.toFixed(0)}%</span>;
                      },
                    },
                    {
                      title: 'P.Factor',
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
                      title: 'Trades',
                      key: 'tradeCount',
                      width: 80,
                      render: (record: any) => {
                        const tc = record.tradeCount ?? record.trades ?? 0;
                        const color = tc < 5 ? '#faad14' : '#595959';
                        return <span style={{ color, fontWeight: 600 }}>{tc}</span>;
                      },
                    },
                    {
                      title: 'Stability',
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
                      title: 'Trend',
                      key: 'trend',
                      width: 100,
                      render: (record: any) => {
                        const t = record.recentVsLongTerm || 'N/A';
                        const color = t === 'Improving' || t === 'Consistent' ? 'blue' : t === 'Weakening' ? 'warning' : 'error';
                        return <Tag className="validation-badge" color={color} style={{ margin: 0 }}>{t}</Tag>;
                      },
                    },
                    {
                      title: 'Verdict',
                      key: 'verdict',
                      width: 100,
                      render: (record: any) => {
                        const v = record.verdict || 'Review';
                        const color = (v === 'Confirmed' || v === 'Pass') ? 'success' : v === 'Rejected' ? 'error' : 'warning';
                        return <Tag className="validation-badge" color={color} style={{ margin: 0 }}>{v}</Tag>;
                      },
                    },
                    {
                      title: 'Risk Gate',
                      key: 'riskGate',
                      width: 100,
                      render: (record: any) => {
                        const rg = record.riskGate?.status || 'N/A';
                        const color = rg === 'PASS' ? 'success' : rg === 'BLOCK' ? 'error' : 'warning';
                        return (
                          <Tooltip title={record.riskGate?.reason}>
                            <Tag className="validation-badge" color={color} style={{ margin: 0, cursor: 'help' }}>{rg}</Tag>
                          </Tooltip>
                        );
                      },
                    },
                    {
                      title: 'Analysis Reason',
                      key: 'reason',
                      width: 250,
                      render: (record: any) => (
                        <Tooltip title={record.reason}>
                          <div className="validation-reason">
                            {record.reason || 'No detailed analysis provided'}
                          </div>
                        </Tooltip>
                      ),
                    },
                    {
                      title: 'Src',
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
                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: 8 }}>Validation failed</div>
                <div style={{ fontSize: '12px', color: '#888', maxWidth: 500, margin: '0 auto', lineHeight: 1.6 }}>
                  {dvErrorMessage || 'Please check backend logs or retry.'}
                </div>
                {dvErrors.length > 0 && (
                  <div style={{ marginTop: 16, textAlign: 'left', maxWidth: 500, margin: '16px auto 0' }}>
                    <div style={{ fontSize: '11px', color: '#666', fontWeight: 600, marginBottom: 4 }}>Failed symbols:</div>
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
                    {bd.total} candidates from Fine Scan ready for deep validation.
                    {bd.watchCount > 0 && (
                      <div style={{ fontSize: '12px', marginTop: 4, color: '#bbb' }}>
                        {bd.continueCount} Continue + {bd.watchCount} Watch-to-Validate (score ≥ 50, no critical blockers)
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {deeperValidationStatus === 'idle' && fineScanStatus !== 'completed' && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#bfbfbf' }}>
                <BarChartOutlined style={{ fontSize: '48px', marginBottom: 16, opacity: 0.2 }} />
                <div style={{ fontSize: '14px' }}>Complete Fine Scan to enable deeper historical validation.</div>
              </div>
            )}
          </Card>
        </div>
      </CollapsibleStageSection>

      {/* ▲▲▲ Above: Deeper Validation ▲▲▲ */}

      {/* ▲▲▲ Below: Entry Plan ▲▲▲ */}
      <CollapsibleStageSection
        title="Entry Plan"
        icon={<RobotOutlined />}
        statusText={
          entryPlanStatus === 'loading' ? 'GENERATING' :
          entryPlanStatus === 'completed' ? 'COMPLETED' :
          entryPlanStatus === 'stopped' ? 'INTERRUPTED' :
          entryPlanStatus === 'error' ? 'ERROR' : 'IDLE'
        }
        statusColor={
          entryPlanStatus === 'loading' ? 'processing' :
          entryPlanStatus === 'completed' ? 'success' :
          entryPlanStatus === 'stopped' ? 'warning' :
          entryPlanStatus === 'error' ? 'error' : 'default'
        }
        summaryChips={entryPlanResults ? [
          { label: 'Plans', value: entryPlanResults.length },
          { label: 'BUY', value: entryPlanResults.filter((p: any) => p.aiDecision === 'BUY').length, color: '#52c41a' },
        ] : undefined}
        actionButton={
          (deeperValidationStatus === 'completed' || deeperValidationStatus === 'stopped') && getEntryPlanCandidates().length > 0 ? (
            <Tooltip title={pipelineRunning ? 'Disabled while AI Pipeline is running.' : ''}>
              <span>
                <Button
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  loading={entryPlanStatus === 'loading'}
                  disabled={entryPlanStatus === 'loading' || !getEntryPlanCandidates().length || pipelineRunning}
                  onClick={handleRunEntryPlan}
                  style={AI_AGENT_PRIMARY_BTN_STYLE}
                >
                  Run Entry Plan
                </Button>
              </span>
            </Tooltip>
          ) : undefined
        }
        isRunning={entryPlanStatus === 'loading'}
        expanded={entryPlanExpanded}
        onToggle={() => setEntryPlanExpanded(!entryPlanExpanded)}
      >
          {/* No DV candidates yet */}
          {deeperValidationStatus !== 'completed' && deeperValidationStatus !== 'stopped' && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#bbb', fontSize: '12px', fontStyle: 'italic' }}>
              No validated candidates yet. Run Deeper Validation first.
            </div>
          )}

          {/* DV done but no confirmed/watch candidates */}
          {(deeperValidationStatus === 'completed' || deeperValidationStatus === 'stopped') && getEntryPlanCandidates().length === 0 && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#bbb', fontSize: '12px', fontStyle: 'italic' }}>
              No Confirmed or Watch candidates available from Deeper Validation.
            </div>
          )}

          {/* DV done, candidates available */}
          {(deeperValidationStatus === 'completed' || deeperValidationStatus === 'stopped') && getEntryPlanCandidates().length > 0 && entryPlanStatus === 'idle' && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#999', fontSize: '12px' }}>
              {getEntryPlanCandidates().length} validated candidates ready. Click <strong>"Run Entry Plan"</strong> to generate entry plans.
            </div>
          )}

          {/* Loading */}
          {entryPlanStatus === 'loading' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
              <div style={{ marginTop: '8px', color: '#888', fontSize: '12px' }}>
                Computing entry zones, stop loss, position sizes, and risk gates...
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
              <div style={{ marginTop: 4 }}>Entry plan generation failed. Please try again.</div>
            </div>
          )}

          {/* Results */}
          {(entryPlanStatus === 'completed' || entryPlanStatus === 'stopped') && entryPlanResults && entryPlanResults.length > 0 && (
            <>
              {/* Summary stat blocks — compact key metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
                {/* Block 1: AI Decisions */}
                <div style={{ background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e8eaed', padding: '12px 14px' }}>
                  <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500, marginBottom: '6px' }}>AI Decisions</div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#333', fontFamily: "'Inter', sans-serif", marginBottom: '6px' }}>
                    <span style={{ color: '#52c41a' }}>{entryPlanResults.filter(p => p.aiDecision === 'BUY').length} Buy</span>
                    <span style={{ margin: '0 6px', color: '#ccc' }}>/</span>
                    <span style={{ color: '#fa8c16' }}>{entryPlanResults.filter(p => p.aiDecision === 'WATCH').length} Watch</span>
                    <span style={{ margin: '0 6px', color: '#ccc' }}>/</span>
                    <span style={{ color: '#ff4d4f' }}>{entryPlanResults.filter(p => p.aiDecision === 'SKIP').length} Skip</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#999', marginTop: '2px' }}>
                    {entryPlanResults[0]?.aiCalled ? (
                      <span style={{ color: '#52c41a' }}>{entryPlanResults[0]?.aiSource || 'AI'} / {entryPlanResults[0]?.aiModel || 'LLM'} ✓</span>
                    ) : (
                      <Tooltip title={entryPlanResults[0]?.aiError || 'No AI provider configured. Using Local Rules fallback.'}>
                        <span style={{ color: '#fa8c16', cursor: 'help' }}>Local Rules (no AI call)</span>
                      </Tooltip>
                    )}
                  </div>
                </div>

                {/* Block 2: Risk Gate */}
                <div style={{ background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e8eaed', padding: '12px 14px' }}>
                  <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500, marginBottom: '6px' }}>Risk Review</div>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'baseline' }}>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: 600, color: '#52c41a', fontFamily: "'Inter', sans-serif", lineHeight: '1.2' }}>
                        {entryPlanResults.filter(p => p.hardRiskGate?.status === 'PASS').length}
                      </div>
                      <div style={{ fontSize: '10px', color: '#888' }}>Passed</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: 600, color: '#fa8c16', fontFamily: "'Inter', sans-serif", lineHeight: '1.2' }}>
                        {entryPlanResults.filter(p => p.hardRiskGate?.status === 'REVIEW').length}
                      </div>
                      <div style={{ fontSize: '10px', color: '#888' }}>Review</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: 600, color: '#ff4d4f', fontFamily: "'Inter', sans-serif", lineHeight: '1.2' }}>
                        {entryPlanResults.filter(p => p.hardRiskGate?.status === 'BLOCK').length}
                      </div>
                      <div style={{ fontSize: '10px', color: '#888' }}>Blocked</div>
                    </div>
                  </div>
                </div>

                {/* Block 3: Trade Readiness */}
                <div style={{ background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e8eaed', padding: '12px 14px' }}>
                  <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500, marginBottom: '6px' }}>Trade Readiness</div>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'baseline' }}>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: 600, color: '#52c41a', fontFamily: "'Inter', sans-serif", lineHeight: '1.2' }}>
                        {entryPlanResults.filter(p => p.tradeReadiness === 'READY').length}
                      </div>
                      <div style={{ fontSize: '10px', color: '#888' }}>Ready</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: 600, color: '#fa8c16', fontFamily: "'Inter', sans-serif", lineHeight: '1.2' }}>
                        {entryPlanResults.filter(p => p.tradeReadiness === 'WAIT').length}
                      </div>
                      <div style={{ fontSize: '10px', color: '#888' }}>Wait</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: 600, color: '#ff4d4f', fontFamily: "'Inter', sans-serif", lineHeight: '1.2' }}>
                        {entryPlanResults.filter(p => p.tradeReadiness === 'BLOCKED').length}
                      </div>
                      <div style={{ fontSize: '10px', color: '#888' }}>Blocked</div>
                    </div>
                  </div>
                </div>

                {/* Block 4: Execution Mode */}
                <div style={{ background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e8eaed', padding: '12px 14px' }}>
                  <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500, marginBottom: '6px' }}>Execution</div>
                  <div style={{ fontSize: '12px', fontWeight: 500, color: '#555', fontFamily: "'Inter', sans-serif", marginBottom: '4px' }}>
                    {pipelineMode === 'ai'
                      ? (tradingAccountMode === 'paper' ? 'AI Mode · Paper Execution Ready' : 'AI Mode · Live Requires Manual Confirm')
                      : pipelineMode === 'hybrid'
                        ? 'Hybrid Mode · Manual Execution'
                        : 'Manual Mode · Recommendations Only'}
                  </div>
                  <div style={{ fontSize: '10px', color: '#999' }}>
                    {pipelineMode === 'ai'
                      ? (tradingAccountMode === 'paper' ? 'Paper preview only' : 'Manual confirm required')
                      : pipelineMode === 'hybrid'
                        ? 'No automatic orders'
                        : 'Manual only'}
                  </div>
                </div>
              </div>

              {/* Execution mode warning for Real Trading */}
              {entryPlanExecutionMode === 'Real Trade if Triggered' && (
                <Alert
                  message="Real trading requires manual confirmation. No order is placed automatically."
                  type="warning"
                  showIcon
                  style={{ marginBottom: '16px', marginTop: '8px', fontSize: '12px', padding: '8px 16px' }}
                />
              )}

              {/* Main table */}
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
                        distText = `Below entry by $${diff.toFixed(2)} (${pct.toFixed(1)}%)`;
                        distColor = '#fa8c16';
                      } else if (curPrice > hiPrice) {
                        const diff = curPrice - hiPrice;
                        const pct = (diff / hiPrice) * 100;
                        distText = `Above entry by $${diff.toFixed(2)} (${pct.toFixed(1)}%)`;
                        distColor = '#fa8c16';
                      } else {
                        distText = 'In entry zone';
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
                                ghost={finalAction === 'READY_REVIEW'}
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
                                {finalAction === 'BUY_READY' ? 'Execute Trade' : finalAction === 'READY_REVIEW' ? 'Review & Execute' : finalAction === 'WAIT_FOR_ENTRY' ? 'Monitor Entry' : finalAction === 'SKIP' ? 'Plan Skipped' : 'Risk Blocked'}
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
                                {isInWatchlist(ep.symbol) ? 'In Watchlist' : 'Add to Watchlist'}
                              </Button>
                            </Space>
                          </div>
                        </div>

                        {/* ── 4-Card Balanced Grid ── */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>

                          {/* A. Execution Plan */}
                          <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                            <SectionHeader title="A. Execution Plan" />
                            <div style={{ display: 'grid', gridTemplateColumns: '95px 1fr', gap: '8px 12px', alignItems: 'baseline' }}>
                              <Label text="Current Price" /><Value v={curPrice != null ? `$${curPrice.toFixed(2)}` : '—'} bold color="#111827" />
                              <Label text="Distance" /><Value v={distText} color={distColor} bold />
                              <Label text="Entry Zone" /><Value v={loPrice != null ? `$${loPrice.toFixed(2)} – $${(hiPrice ?? 0).toFixed(2)}` : '—'} bold color="#111827" />
                              <Label text="Trigger" /><Value v={ep.triggerCondition || '—'} color="#4b5563" />
                              <Label text="Stop Loss" /><Value v={fmtPrice(ep.stopLoss)} bold color="#dc2626" subText={`${ep.stopLossPct != null ? fmtPct(ep.stopLossPct) : 'N/A'} from ${ep.stopSource || 'entry'}`} />
                              <Label text="Targets" />
                              <div style={{ display: 'flex', gap: '16px' }}>
                                <Value v={fmtPrice(ep.takeProfit1)} bold color="#16a34a" subText={`T1 (R/R ${fmtRR(ep.riskReward1)})`} />
                                <Value v={fmtPrice(ep.takeProfit2)} color="#16a34a" subText={`T2 (R/R ${fmtRR(ep.riskReward2)})`} />
                              </div>
                              <Label text="Invalidation" /><Value v={ep.invalidationCondition || '—'} color="#dc2626" />
                              <Label text="Order Type" /><Value v={ed.orderTypeSuggestion || 'N/A'} bold color={ed.orderTypeSuggestion === 'Not Available' ? '#dc2626' : '#16a34a'} subText={ed.orderTypeReason} />
                            </div>
                          </div>

                          {/* B. Position & Risk */}
                          <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                            <SectionHeader title="B. Position & Risk" />
                            <div style={{ display: 'grid', gridTemplateColumns: '95px 1fr', gap: '8px 12px', alignItems: 'baseline' }}>
                              <Label text="Portfolio" /><Value v={fmtDollars(ep.positionCapital)} bold />
                              <Label text="Buying Power" /><Value v={fmtDollars(ep.accountBuyingPower)} />
                              <Label text="Risk Budget" /><Value v={fmtDollars(ep.riskBudget)} subText={`${fmtPct(ep.riskPct)} of portfolio`} />
                              <Label text="Actual Risk" /><Value v={fmtDollars(ep.riskDollars)} bold color="#dc2626" />
                              <Label text="Risk Used" /><Value v={ep.riskUsedPct != null ? `${ep.riskUsedPct.toFixed(1)}%` : (ep.riskBudget > 0 ? `${(ep.riskDollars / ep.riskBudget * 100).toFixed(1)}%` : '—')} bold color={ep.riskUsedPct > 80 ? '#dc2626' : '#d97706'} subText="of risk budget" />
                              <Label text="Size" />
                              <div style={{ display: 'flex', gap: '16px' }}>
                                <Value v={fmtShares(ep.positionSize || ep.positionSizeShares)} bold subText="Shares" />
                                <Value v={fmtDollars(ep.positionValue || ep.positionSizeDollars)} bold subText="Est. Value" />
                              </div>
                              <Label text="Cap Status" /><Value v={ep.positionCapStatus || (ep.positionCapped ? `Capped at ${fmtPct(ep.positionPct)}` : `OK (${fmtPct(ep.positionPct)} of equity)`)} bold color={ep.positionCapped ? '#d97706' : '#16a34a'} />
                            </div>
                          </div>

                          {/* C. Decision */}
                          <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                            <SectionHeader title="C. Decision" />
                            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '8px 12px', alignItems: 'baseline' }}>
                              <Label text="AI Decision" /><Value v={ep.aiDecision || '—'} color={aiColor(ep.aiDecision)} bold />
                              <Label text="Confidence" /><Value v={`${confidence}%`} bold />
                              <Label text="Risk Gate" /><Value v={rg.status || 'N/A'} color={rgColor} bold />
                              <Label text="Final Action" /><Value v={finalAction} color={faColor} bold />
                              <Label text="Trade Readiness" /><Value v={tradeReadiness} color={trColor} bold />
                              <Label text="Entry Trigger" /><Value v={ep.entryTriggerMet ? 'Ready' : 'Waiting'} color={ep.entryTriggerMet ? '#16a34a' : '#d97706'} bold />
                              <Label text="Best Strategy" /><Value v={ep.bestStrategy || '—'} />
                            </div>
                          </div>

                          {/* D. Data Quality */}
                          <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                            <SectionHeader title="D. Data Quality" color={dqColor} />
                            <div style={{ display: 'grid', gridTemplateColumns: '95px 1fr', gap: '8px 12px', alignItems: 'baseline' }}>
                              <Label text="Market Data" /><Value v={ds.marketData || 'N/A'} bold />
                              <Label text="Account Data" /><Value v={ds.accountData || 'N/A'} />
                              <Label text="AI Provider" />
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {ep.aiCalled ? (
                                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#16a34a' }}>{ep.aiSource || 'AI'} ({ep.aiModel || 'LLM'}) <CheckOutlined style={{ fontSize: '10px' }} /></span>
                                ) : (
                                  <Tooltip title={ep.aiError || 'No AI provider configured or call failed'}>
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#d97706', cursor: 'help', borderBottom: '1px dotted #d97706' }}>Local Rules fallback</span>
                                  </Tooltip>
                                )}
                              </div>
                              <Label text="Broker" /><Value v={ed.brokerSource || 'Not Connected'} bold color={ed.brokerConnected ? '#16a34a' : '#dc2626'} />
                              {ep.aiError && <><Label text="AI Error" /><Value v={ep.aiError} color="#dc2626" /></>}
                            </div>
                          </div>
                        </div>

                        {/* ── Bottom Text Insights ── */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderTop: '1px solid #e5e7eb', paddingTop: '12px' }}>
                          {/* Left: Decision Reason + Next Step */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div>
                              <div style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
                                Decision Reason {ep.aiCalled ? '(AI)' : '(Local Rules)'}
                              </div>
                              <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.6', background: '#fff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #f3f4f6' }}>
                                {ep.decisionReason || ep.reason || 'No detailed reasoning provided.'}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '10px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Next Step</div>
                              <div style={{ fontSize: '13px', color: '#1d4ed8', lineHeight: '1.5', fontWeight: 600, paddingLeft: '4px' }}>
                                → {ep.nextStep || 'Wait for further signals.'}
                              </div>
                            </div>
                            {ep.riskComment && (
                              <div style={{ background: '#fff7ed', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ffedd5' }}>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Risk Comment</div>
                                <div style={{ fontSize: '12px', color: '#9a3412', lineHeight: '1.5' }}>{ep.riskComment}</div>
                              </div>
                            )}
                          </div>

                          {/* Right: Risk Notes + Blockers */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div>
                              <div style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>Risk Assessment</div>
                              <div style={{ background: '#fff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #f3f4f6', minHeight: '60px' }}>
                                {(() => {
                                  const warnings = rg.warnings || [];
                                  if (warnings.length === 0) return <div style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '12px' }}>No risk warnings identified.</div>;
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
                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>Critical Blockers</div>
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
                                <span style={{ fontWeight: 700 }}>Invalidation:</span> {ep.invalidationComment}
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
                    title: 'Symbol',
                    dataIndex: 'symbol',
                    key: 'symbol',
                    width: 80,
                    fixed: 'left',
                    render: (text, record) => (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '1px 0' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif", color: '#333', letterSpacing: '0.2px' }}>{text}</span>
                        {record.isDevTest && <Tag style={{ fontSize: 8, padding: '0 2px', lineHeight: '12px', margin: 0 }} color="red">DEV TEST</Tag>}
                        {record.dataQuality === 'PARTIAL' && <Tag style={{ fontSize: '9px', marginLeft: '2px', padding: '0 4px', lineHeight: '16px' }} color="gold">P</Tag>}
                        {record.dataQuality === 'POOR' && <Tag style={{ fontSize: '9px', marginLeft: '2px', padding: '0 4px', lineHeight: '16px' }} color="red">!</Tag>}
                        {record.aiCalled === false && (
                          <Tooltip title="Local Rules — no LLM call. AI provider not configured or call failed.">
                            <Tag style={{ fontSize: '9px', marginLeft: '2px', padding: '0 4px', lineHeight: '16px', cursor: 'help' }} color="default">LR</Tag>
                          </Tooltip>
                        )}
                      </div>
                    ),
                  },
                  {
                    title: 'Setup',
                    dataIndex: 'setup',
                    key: 'setup',
                    width: 110,
                    render: (text) => {
                      const colors: Record<string, string> = { 'Pullback Entry': 'gold', 'Breakout Entry': 'purple', 'Range Support Entry': 'green', 'Watch Only': 'blue', 'No Trade': 'red' };
                      return <Tag color={colors[text] || 'default'} style={{ fontSize: '10px', fontWeight: 600, padding: '0 6px', lineHeight: '18px', borderRadius: '4px', border: 'none' }}>{text || '-'}</Tag>;
                    },
                  },
                  {
                    title: 'Current',
                    key: 'currentPrice',
                    width: 90,
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
                          distColor = '#fa8c16';
                        } else if (p > hi) {
                          const pct = ((p - hi) / hi) * 100;
                          distShort = `+${pct.toFixed(1)}%`;
                          distColor = '#fa8c16';
                        } else {
                          distShort = 'IN ZONE';
                          distColor = '#52c41a';
                        }
                      }
                      
                      return (
                        <div style={{ lineHeight: '1.4' }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>${p.toFixed(2)}</div>
                          {distShort && <div style={{ fontSize: '9px', color: distColor, fontWeight: 700 }}>{distShort}</div>}
                        </div>
                      );
                    },
                  },
                  {
                    title: 'Entry Zone',
                    key: 'entryZone',
                    width: 120,
                    render: (record) => {
                      const lo = record.entryLow || record.entryZoneLow;
                      const hi = record.entryHigh || record.entryZoneHigh;
                      const setup = record.setup || '';
                      if (lo == null || hi == null || (lo === 0 && hi === 0)) {
                        return <span style={{ fontSize: '11px', color: '#bbb', fontStyle: 'italic' }}>N/A</span>;
                      }
                      const zoneLabel = setup.includes('Pullback') ? 'Pullback' :
                                        setup.includes('Breakout') ? 'Breakout' :
                                        setup.includes('Range') ? 'Support' : '';
                      return (
                        <div>
                          <Text style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>${lo.toFixed(2)} – ${hi.toFixed(2)}</Text>
                          {zoneLabel && <div style={{ fontSize: '9px', color: '#aaa', marginTop: '1px' }}>{zoneLabel}</div>}
                        </div>
                      );
                    },
                  },
                  {
                    title: 'Stop',
                    key: 'stopLoss',
                    width: 95,
                    render: (record) => {
                      const v = record.stopLoss;
                      const pct = record.stopLossPct;
                      if (v == null || v === 0) {
                        return <span style={{ fontSize: '11px', color: '#bbb' }}>-</span>;
                      }
                      return (
                        <div>
                          <Text style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif', color: '#e84749', fontWeight: 500 }}>${v.toFixed(2)}</Text>
                          {pct != null && pct > 0 && <div style={{ fontSize: '9px', color: '#aaa', marginTop: '1px' }}>{pct.toFixed(1)}% from entry</div>}
                        </div>
                      );
                    },
                  },
                  {
                    title: 'Targets',
                    key: 'targets',
                    width: 110,
                    render: (record) => {
                      const t1 = record.takeProfit1;
                      const t2 = record.takeProfit2;
                      const rr1 = record.riskReward1 || 0;
                      const rr2 = record.riskReward2 || 0;
                      if (t1 == null && t2 == null) return <span style={{ fontSize: '11px', color: '#bbb' }}>-</span>;
                      return (
                        <div style={{ lineHeight: '1.6' }}>
                          {t1 != null && t1 > 0 ? <div><span style={{ fontSize: '12px', fontWeight: 500, color: '#52c41a', fontFamily: 'Inter, sans-serif' }}>${t1.toFixed(2)}</span><span style={{ fontSize: '9px', color: '#aaa' }}> R{rr1.toFixed(1)}</span></div> : null}
                          {t2 != null && t2 > 0 ? <div style={{ marginTop: '1px' }}><span style={{ fontSize: '12px', fontWeight: 500, color: '#52c41a', fontFamily: 'Inter, sans-serif' }}>${t2.toFixed(2)}</span><span style={{ fontSize: '9px', color: '#aaa' }}> R{rr2.toFixed(1)}</span></div> : null}
                        </div>
                      );
                    },
                  },
                  {
                    title: 'Position',
                    key: 'position',
                    width: 105,
                    render: (record) => {
                      const sh = record.positionSize || record.positionSizeShares || 0;
                      const val = record.positionValue || record.positionSizeDollars || 0;
                      const capPct = record.positionPct || 0;
                      const capped = record.positionCapped;
                      if (sh === 0 && val === 0) {
                        return <span style={{ fontSize: '11px', color: '#bbb' }}>-</span>;
                      }
                      return (
                        <div style={{ lineHeight: '1.5' }}>
                          <Text style={{ fontSize: '11px', fontFamily: 'Inter, sans-serif' }}>{sh} sh</Text>
                          <div style={{ fontSize: '10px', color: '#888', fontFamily: 'Inter, sans-serif' }}>
                            ${val.toFixed(0)}
                            {capped && <span style={{ color: '#d48806', marginLeft: '3px', fontSize: '9px' }}>CAP {capPct.toFixed(1)}%</span>}
                          </div>
                        </div>
                      );
                    },
                  },
                  {
                    title: 'AI Decision',
                    key: 'aiDecision',
                    width: 82,
                    render: (record) => {
                      const d = record.aiDecision;
                      if (!d) return <span style={{ fontSize: '11px', color: '#bbb' }}>-</span>;
                      const tagColor = d === 'BUY' ? 'green' : d === 'WATCH' ? 'gold' : d === 'SKIP' ? 'red' : 'default';
                      const sourceLabel = record.aiCalled ? 'AI' : 'Rule';
                      return (
                        <div>
                          <Tag color={tagColor} style={{ fontSize: '10px', fontWeight: 600, padding: '0 6px', lineHeight: '18px', margin: 0 }}>{d}</Tag>
                          <div style={{ fontSize: '8px', color: '#aaa', marginTop: '1px' }}>
                            {record.confidence != null ? `${record.confidence}% ` : ''}
                            <Tooltip title={record.aiCalled ? `${record.aiSource || 'AI'} (${record.aiModel || 'LLM'}) called` : `Local Rules (deterministic)${record.aiError ? ' — ' + record.aiError : ''}`}>
                              <span style={{ cursor: 'help', borderBottom: '1px dotted #ccc' }}>{sourceLabel}</span>
                            </Tooltip>
                          </div>
                        </div>
                      );
                    },
                  },
                  {
                    title: 'Gate',
                    key: 'riskGate',
                    width: 70,
                    render: (record) => {
                      const rg = record.riskGate || record.hardRiskGate;
                      const status = rg?.status;
                      if (!status) return <span style={{ fontSize: '11px', color: '#ccc' }}>N/A</span>;
                      const tagColor = status === 'PASS' ? 'green' : status === 'REVIEW' ? 'gold' : 'red';
                      // Build tooltip with review reasons
                      const reasons = rg?.warnings || rg?.reasons || [];
                      const tipTitle = status === 'REVIEW' && reasons.length > 0
                        ? `Review: ${reasons.slice(0, 3).join('; ')}`
                        : status === 'BLOCK' && reasons.length > 0
                        ? `Blocked: ${reasons.slice(0, 3).join('; ')}`
                        : `Gate: ${status}`;
                      return (
                        <Tooltip title={tipTitle}>
                          <Tag color={tagColor} style={{ fontSize: '10px', fontWeight: 600, padding: '0 6px', lineHeight: '18px', margin: 0, cursor: 'help' }}>{status}</Tag>
                        </Tooltip>
                      );
                    },
                  },
                  {
                    title: 'Final Action',
                    key: 'finalAction',
                    width: 115,
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
                      const tagColor = a === 'BUY_READY' || a === 'BUY_ALLOWED' ? 'green' : a === 'READY_REVIEW' ? 'blue' : a === 'WAIT_FOR_ENTRY' || a === 'WATCH_ONLY' ? 'gold' : 'red';
                      return <Tag color={tagColor} style={{ fontSize: '10px', fontWeight: 600, padding: '0 6px', lineHeight: '18px', margin: 0 }}>{displayText[a] || a}</Tag>;
                    },
                  },
                  {
                    title: 'Data',
                    key: 'dataQuality',
                    width: 75,
                    render: (record) => {
                      const dq = record.dataQuality || 'PARTIAL';
                      const tagColor = dq === 'GOOD' ? 'green' : dq === 'PARTIAL' ? 'gold' : 'red';
                      const aiInfo = record.aiCalled
                        ? `${record.aiSource || 'AI'}`
                        : `LR${record.aiError ? ': ' + record.aiError.substring(0, 20) : ''}`;
                      return (
                        <div>
                          <Tag color={tagColor} style={{ fontSize: '9px', fontWeight: 600, padding: '0 4px', lineHeight: '16px', margin: 0 }}>{dq}</Tag>
                          <Tooltip title={record.aiCalled ? `${record.aiSource || 'AI'} / ${record.aiModel || 'LLM'} called` : `Local Rules${record.aiError ? ' — ' + record.aiError : ' — no LLM call'}`}>
                            <div style={{ fontSize: '8px', color: '#aaa', marginTop: '1px', cursor: 'help' }}>{aiInfo}</div>
                          </Tooltip>
                        </div>
                      );
                    },
                  },
                  {
                    title: 'Reason',
                    dataIndex: 'reason',
                    key: 'reason',
                    width: 220,
                    render: (text, record) => {
                      const fullText = record.decisionReason || text || '';
                      const displayText = fullText.length > 80 ? fullText.slice(0, 80) + '...' : fullText || '-';
                      return (
                        <Tooltip title={fullText || 'No reason provided'}>
                          <span style={{ fontSize: '11px', color: fullText ? '#555' : '#ccc', cursor: fullText ? 'pointer' : 'default', lineHeight: '1.4' }}>
                            {displayText}
                          </span>
                        </Tooltip>
                      );
                    },
                  },
                  {
                    title: 'Action',
                    key: 'action',
                    width: 110,
                    fixed: 'right' as const,
                    render: (record) => {
                      const fa = record.finalAction;
                      const aiDec = record.aiDecision;
                      const dq = record.dataQuality;
                      const rg = record.riskGate || record.hardRiskGate || {};

                      if (fa === 'BLOCKED_BY_RISK' || rg.status === 'BLOCK' || dq === 'POOR') {
                        return (
                          <Tooltip title={(record.blockers || rg.blockers || ['Blocked']).slice(0, 2).join('; ')}>
                            <Button size="small" danger disabled style={AI_AGENT_COMPACT_BTN_STYLE}>Blocked</Button>
                          </Tooltip>
                        );
                      }
                      if (fa === 'SKIP' || aiDec === 'SKIP') {
                        return <Button size="small" disabled style={AI_AGENT_COMPACT_BTN_STYLE}>Skipped</Button>;
                      }
                      if (fa === 'BLOCKED_BY_RISK' || rg.status === 'BLOCK' || dq === 'POOR') {
                        return (
                          <Tooltip title={(record.blockers || rg.blockers || ['Blocked']).slice(0, 2).join('; ')}>
                            <Button size="small" danger disabled style={AI_AGENT_COMPACT_BTN_STYLE}>Blocked</Button>
                          </Tooltip>
                        );
                      }
                      if (fa === 'BUY_READY') {
                        return (
                          <Button size="small" type="primary" onClick={() => handleEntryPlanAction(record)} style={AI_AGENT_COMPACT_BTN_STYLE}>
                            Execute
                          </Button>
                        );
                      }
                      if (fa === 'READY_REVIEW') {
                        const inWl = isInWatchlist(record.symbol);
                        return (
                          <Space size={4}>
                            <Button size="small" type="primary" ghost onClick={() => handleEntryPlanAction(record)} style={AI_AGENT_COMPACT_BTN_STYLE}>
                              Review
                            </Button>
                            <Button
                              size="small"
                              icon={inWl ? <CheckOutlined /> : <PlusOutlined />}
                              onClick={() => addToWatchlist(record)}
                              style={{ ...AI_AGENT_COMPACT_BTN_STYLE, color: inWl ? '#52c41a' : '#d48806', borderColor: inWl ? '#52c41a' : '#d48806' }}
                            />
                          </Space>
                        );
                      }
                      if (fa === 'WAIT_FOR_ENTRY' || aiDec === 'WATCH') {
                        const inWl = isInWatchlist(record.symbol);
                        return (
                          <Button
                            size="small"
                            icon={inWl ? <CheckOutlined /> : <PlusOutlined />}
                            onClick={() => addToWatchlist(record)}
                            style={{ ...AI_AGENT_COMPACT_BTN_STYLE, color: inWl ? '#52c41a' : '#d48806', borderColor: inWl ? '#52c41a' : '#d48806' }}
                          >
                            {inWl ? 'Update' : '+ Watchlist'}
                          </Button>
                        );
                      }
                      return <span style={{ fontSize: '10px', color: '#bbb' }}>—</span>;
                    },
                  },
                ]}
                scroll={{ x: 1420 }}
                style={{ fontSize: '12px', marginTop: '16px', fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }}
                rowClassName={() => 'ep-table-row'}
              />
              <style>{`
                .ep-table-row {
                  height: 58px !important;
                }
                .ep-table-row > td {
                  padding: 12px 10px !important;
                  vertical-align: middle;
                  font-size: 13px !important;
                  font-family: "Inter", -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
                }
                .ant-table-thead > tr > th {
                  font-weight: 600 !important;
                  font-size: 11px !important;
                  color: #444 !important;
                  background: #f5f6f8 !important;
                  padding: 14px 10px !important;
                  border-bottom: 1px solid #e0e0e0 !important;
                  letter-spacing: 0.3px !important;
                  text-transform: uppercase !important;
                  font-family: "Inter", -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
                }
                .ep-table-row:hover > td {
                  background: #f8faff !important;
                }
                .ant-table-thead > tr > th:not(:last-child)::after {
                  display: none !important;
                }
              `}</style>
            </>
          )}
      </CollapsibleStageSection>
      {/* End Entry Plan Section */}

      {/* ── Execution Confirmation Modal ── */}
      <Modal
        title={entryPlanExecutionMode.toLowerCase().includes('live') ? '⚠ Live Trading Confirmation' : 'Confirm Order Execution'}
        open={executeModalVisible}
        onCancel={() => { setExecuteModalVisible(false); setExecuteTarget(null); setLiveConfirmText(''); }}
        onOk={confirmExecutePlan}
        confirmLoading={executeLoading}
        okText={entryPlanExecutionMode.toLowerCase().includes('live') ? 'Confirm Live Order' : 'Submit Order'}
        okButtonProps={{ danger: entryPlanExecutionMode.toLowerCase().includes('live') }}
        width={520}
      >
        {executeTarget && (
          <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
            {entryPlanExecutionMode.toLowerCase().includes('live') && (
              <Alert
                message="Live trading uses real money. Confirm before submitting."
                type="error"
                showIcon
                style={{ marginBottom: '12px' }}
              />
            )}
            <div><strong>Symbol:</strong> {executeTarget.symbol}</div>
            <div><strong>Setup:</strong> {executeTarget.setup}</div>
            <div><strong>Order Type:</strong> {(executeTarget.executionDetails || {}).orderTypeSuggestion || 'N/A'}</div>
            <div><strong>Shares:</strong> {executeTarget.positionSizeShares || executeTarget.shares || 0}</div>
            <div><strong>Entry Zone:</strong> ${executeTarget.entryZoneLow?.toFixed(2)} – ${executeTarget.entryZoneHigh?.toFixed(2)}</div>
            <div><strong>Estimated Value:</strong> ${((executeTarget.positionSizeShares || 0) * (executeTarget.entryZoneLow || 0)).toFixed(0)}</div>
            <div><strong>Max Risk:</strong> ${executeTarget.riskDollars?.toFixed(0) || '0'}</div>
            <div><strong>Stop Loss:</strong> ${executeTarget.stopLoss?.toFixed(2)}</div>
            <div><strong>Take Profit:</strong> ${executeTarget.takeProfit1?.toFixed(2)}</div>
            <div><strong>Mode:</strong> {entryPlanExecutionMode}</div>
            {entryPlanExecutionMode.toLowerCase().includes('live') && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontWeight: 600, color: '#ff4d4f', marginBottom: '4px' }}>
                  Type <code>CONFIRM LIVE BUY {executeTarget.symbol}</code> to confirm:
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

    </div>
  );

}
export default Portfolio;
