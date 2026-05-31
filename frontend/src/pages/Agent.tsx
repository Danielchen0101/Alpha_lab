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
  ThunderboltOutlined, CheckCircleOutlined, ClockCircleOutlined, CheckCircleFilled,
  RobotOutlined, CloseCircleOutlined, ExclamationCircleOutlined, SyncOutlined, LoadingOutlined, SafetyCertificateOutlined,
  ArrowUpOutlined, ArrowDownOutlined, ArrowRightOutlined, MinusOutlined,
  InfoCircleOutlined,
  CaretDownOutlined, CaretRightOutlined,
  DeleteOutlined, ReloadOutlined, PlusOutlined, CheckOutlined, EyeOutlined,
  WalletOutlined, FundOutlined, SwapOutlined, WarningOutlined
} from '@ant-design/icons';
import aiTradingService from '../services/aiTradingService';
import { backtraderAPI, entryQualityAPI, fineScanAdvancedAPI, deeperValidationAPI, entryPlanAPI, fineScanExplainAPI, fineScanDecisionAPI, tradingAccountAPI, aiAgentWatchlistAPI, aiExecutionAPI, pipelineAutoAPI, notificationAPI } from '../services/api';
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
    if (isRunning) return { background: 'rgba(24, 144, 255, 0.05)', border: '1px solid rgba(24, 144, 255, 0.2)' };
    if (statusColor === 'success') return { background: 'rgba(82, 196, 26, 0.03)', border: '1px solid #eaff8f' };
    if (statusColor === 'error') return { background: 'rgba(255, 77, 79, 0.03)', border: '1px solid #ffd8bf' };
    return { background: 'var(--app-card-bg)', border: '1px solid var(--app-border-soft)' };
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
          color: expanded ? '#1890ff' : 'var(--app-text-muted)', 
          flexShrink: 0,
          transition: 'transform 0.3s'
        }}>
          {expanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
        </span>

        {/* Title + Icon */}
        <span style={{ 
          fontSize: 16, 
          fontWeight: 700, 
          color: 'var(--app-text-strong)', 
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
            background: isRunning ? '#1890ff15' : 'var(--app-card-bg-soft)',
            color: isRunning ? 'var(--app-blue-text)' : 'var(--app-text-muted)',
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
            <div style={{ flex: 1, height: 8, background: 'var(--app-table-header-bg)', borderRadius: 10, overflow: 'hidden' }}>
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
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--app-text-muted)', minWidth: 38, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(progressValue)}%
            </span>
          </div>
        )}
        
        {progressText && (progressValue === null || progressValue === undefined) && (
          <span style={{ fontSize: 13, color: 'var(--app-text-muted)', marginRight: 16, fontStyle: 'italic' }}>{progressText}</span>
        )}

        {/* Summary chips */}
        {summaryChips && summaryChips.length > 0 && (
          <div style={{ display: 'flex', gap: 10, marginRight: 16, flexWrap: 'wrap' }}>
            {summaryChips.map((chip, i) => (
              <span key={i} style={{ 
                fontSize: 12, 
                fontWeight: 600,
                color: 'var(--app-text)', 
                background: 'var(--app-card-bg-soft)', 
                borderRadius: 6, 
                padding: '3px 10px', 
                lineHeight: '20px',
                border: '1px solid var(--app-border)'
              }}>
                <span style={{ color: 'var(--app-text-muted)' }}>{chip.label}:</span> <span style={{ color: chip.color || 'var(--app-text-strong)', fontWeight: 800 }}>{chip.value}</span>
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
        <div style={{ padding: '24px', background: 'var(--app-card-bg)' }}>
          {children}
        </div>
      )}
    </div>
  );
};

// AI分析结果类型定义 - V3格式
// 趋势分析结果类型

// Helper for Entry Zone Display
const formatEntryZoneDisplay = (plan: any) => {
  if (!plan || !plan.entryZone || plan.entryZone.low == null || plan.entryZone.high == null) {
    return {
      statusLabel: 'Need Data',
      primaryText: 'Entry zone unavailable',
      secondaryText: 'Refresh market data',
      tone: 'neutral'
    };
  }
  
  const current = plan.currentPrice;
  const low = plan.entryZone.low;
  const high = plan.entryZone.high;
  
  if (current == null) {
    return {
      statusLabel: 'Need Data',
      primaryText: 'Price unavailable',
      secondaryText: `${low.toFixed(2)} – ${high.toFixed(2)} zone`,
      tone: 'neutral'
    };
  }

  if (current < low) {
    return {
      statusLabel: 'Wait for breakout',
      primaryText: `Entry above ${low.toFixed(2)}`,
      secondaryText: `${low.toFixed(2)} – ${high.toFixed(2)} zone`,
      tone: 'warning'
    };
  } else if (current > high) {
    const diff = current - high;
    const diffPct = (diff / current) * 100;
    return {
      statusLabel: 'Wait for pullback',
      primaryText: `Target zone ${low.toFixed(2)} – ${high.toFixed(2)}`,
      secondaryText: `Above zone by ${diff.toFixed(2)} / ${diffPct.toFixed(1)}%`,
      tone: 'info'
    };
  } else {
    return {
      statusLabel: 'In entry zone',
      primaryText: `${low.toFixed(2)} – ${high.toFixed(2)}`,
      secondaryText: 'Ready for risk review',
      tone: 'success'
    };
  }
};

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

  // Lazy news fetch: on-demand Finnhub news for symbols where backend fetch was limited
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
        for (const sym of queue) {
          try {
            const res = await pipelineAutoAPI.fetchScannerNews(sym);
            const data = res.data;
            setLazyNewsCache(prev => ({ ...prev, [sym]: data ?? { _error: true } }));
            if (data && !data._error) {
              const currentResults = scannerStateStore.getState().marketScanner.results;
              const idx = currentResults.findIndex((r: any) => r.symbol === sym);
              if (idx >= 0) {
                const updated = [...currentResults];
                updated[idx] = { ...updated[idx],
                  topNews: data.topNews || null, allNews: data.allNews || [],
                  newsCount: data.newsCount || 0, hasNews: data.hasNews || false,
                  newsSentiment: data.newsSentiment ?? updated[idx].newsSentiment,
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
        }
      }, 150);
    }
  }, [lazyNewsCache]);

  // Derive human-readable no-news reason
  const getNewsEmptyReason = (record: any): string => {
    const reason = record.newsFetchReason || '';
    const source = record.newsSource || '';
    const dsNews = record.dataSources?.news || '';
    if (reason === 'no_news_last_7d') return 'No Finnhub company news found in the last 7 days.';
    if (reason === 'finnhub_not_configured') return 'Finnhub news is not configured for this account.';
    if (reason === 'finnhub_news_api_failed') return 'Finnhub news request failed. Check API key, quota, or backend logs.';
    if (reason === 'news_fetch_skipped_top_n_limit') return 'News fetch skipped — this symbol was outside the top 10 scanner candidates.';
    if (reason === 'news_fetched') return 'News metadata was fetched, but no displayable headline was available.';
    const combo = [source, dsNews].join(' ').toLowerCase();
    if (combo.includes('no news in 7d')) return 'No Finnhub company news found in the last 7 days.';
    if (combo.includes('not configured')) return 'Finnhub news is not configured for this account.';
    if (combo.includes('error')) return 'Finnhub news request failed. Check API key, quota, or backend logs.';
    if (combo.includes('below top candidate')) return 'News fetch skipped — this symbol was outside the top 10 scanner candidates.';
    return 'No market news available for this symbol.';
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
  const { tradeMode } = useTradeMode();
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
  // Ref: only sync pipelineSchedule from backend on first successful status fetch
  const initialAutoSyncRef = useRef(true);

  // Pipeline Auto (market-hours scheduler) state
  const [pipelineAutoStatus, setPipelineAutoStatus] = useState<any>(null);
  const pipelineAutoStatusRef = useRef<any>(null);
  useEffect(() => { pipelineAutoStatusRef.current = pipelineAutoStatus; }, [pipelineAutoStatus]);
  // Auto-run background display state — separate from manual pipeline state
  const [autoRunActive, setAutoRunActive] = useState(false);
  const [autoRunStep, setAutoRunStep] = useState('');
  const [autoRunProgress, setAutoRunProgress] = useState(0);
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
      localStorage.setItem('pipelineSchedule', newSchedule);
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
        localStorage.setItem('pipelineSchedule', newSchedule);
        console.log('[PipelineAutoConfig] rollback toggle to backend state: enabled=%s schedule=%s', backendEnabled, newSchedule);
      }
    } finally {
      setPipelineAutoLoading(false);
    }
  }, [pipelineMode, fetchPipelineAutoStatus, pipelineSchedule]);

  // Auto-save config when mode/risk/horizon/trade changes and schedule is enabled
  const autoSaveTimerRef = useRef<any>(null);
  const prevAutoSaveRef = useRef<{ mode: string; risk: string; horizon: string; trade: string }>({ mode: '', risk: '', horizon: '', trade: '' });
  useEffect(() => {
    if (pipelineSchedule === 'off') return;
    const current = { mode: pipelineMode, risk: riskProfile, horizon: timeHorizon, trade: tradeMode };
    const prev = prevAutoSaveRef.current;
    if (current.mode === prev.mode && current.risk === prev.risk && current.horizon === prev.horizon && current.trade === prev.trade) return;
    prevAutoSaveRef.current = current;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        const intervalMap: Record<string, number> = { '15m': 15, '30m': 30, '1h': 60, '2h': 120 };
        const res = await pipelineAutoAPI.saveConfig({ enabled: true, intervalMinutes: intervalMap[pipelineSchedule] || 15, mode: pipelineMode, riskProfile, timeHorizon, tradeMode });
        if (!res?.data?.success) { message.warning('Auto config sync failed. Scheduler may use stale settings.'); }
      } catch { message.warning('Auto config sync failed. Scheduler may use stale settings.'); }
    }, 600);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [pipelineMode, riskProfile, timeHorizon, tradeMode, pipelineSchedule]);

  // Initial fetch: always fetch pipeline-auto status on mount to correct stale localStorage
  useEffect(() => {
    fetchPipelineAutoStatus();
  }, [fetchPipelineAutoStatus]);

  // Sync pipelineSchedule from backend status on first successful fetch
  useEffect(() => {
    if (!pipelineAutoStatus || !initialAutoSyncRef.current) return;
    initialAutoSyncRef.current = false;
    const backendEnabled = pipelineAutoStatus.enabled === true;
    const intervalToKey: Record<number, '15m' | '30m' | '1h' | '2h'> = { 15: '15m', 30: '30m', 60: '1h', 120: '2h' };
    const key = backendEnabled && pipelineAutoStatus.intervalMinutes ? intervalToKey[pipelineAutoStatus.intervalMinutes] : null;
    const newSchedule = key || 'off';
    setPipelineSchedule(newSchedule);
    localStorage.setItem('pipelineSchedule', newSchedule);
    console.log('[PipelineAutoConfig] initial sync from backend: enabled=%s interval=%s schedule=%s',
      backendEnabled, pipelineAutoStatus.intervalMinutes, newSchedule);
  }, [pipelineAutoStatus]);

  // Poll pipeline-auto status (only when schedule is active)
  useEffect(() => {
    if (pipelineSchedule === 'off') return;
    fetchPipelineAutoStatus();
    const id = setInterval(fetchPipelineAutoStatus, 15000);
    return () => clearInterval(id);
  }, [pipelineSchedule, fetchPipelineAutoStatus]);

  // Track background auto-run status from activeRun (display only, never touches scannerStateStore)
  // Only auto triggers (not manual) affect autoRunActive state
  const AUTO_TRIGGERS = new Set(['market_auto_run', 'headless_market_auto_run', 'toggle_on', 'auto_manual_now']);
  useEffect(() => {
    const activeRun = pipelineAutoStatus?.activeRun;
    if (!activeRun || activeRun.status !== 'running' || !AUTO_TRIGGERS.has(activeRun.trigger || '')) {
      setAutoRunActive(false);
      setAutoRunStep('');
      setAutoRunProgress(0);
      return;
    }
    setAutoRunActive(true);
    setAutoRunStep(activeRun.currentStep || '');
    setAutoRunProgress(activeRun.progressPct || 0);
  }, [pipelineAutoStatus?.activeRun]);

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
  const processContinueScan = async (): Promise<any[]> => {
    try {
      const msResults = scannerStateStore.getState().marketScanner.results || [];
      console.log(`[ContinueScan] backend shared selector — ${msResults.length} market scan results`);

      setContinueScanProgress(0);
      setContinueScanDetails((prev: any) => ({ ...prev, currentStage: 'Calling backend shared Continue Scan selector...', processedCount: 0, totalCount: msResults.length, estimatedTimeRemaining: null }));

      if (msResults.length === 0) {
        setPreferredContinueScanList([]);
        setContinueScanStatus('completed');
        setContinueScanProgress(100);
        return [];
      }

      setContinueScanProgress(30);

      let finalList: any[] = [];
      let usedLocalFallback = false;
      try {
        const res = await pipelineAutoAPI.runContinueScan({ scannerResults: msResults, riskProfile, timeHorizon, pipelineMode, tradeMode });
        if (res?.data?.success) { finalList = res.data.results || []; }
        else { throw new Error(res?.data?.message || 'Backend returned non-success'); }
      } catch (apiErr: any) {
        console.warn('[ContinueScan] backend endpoint unavailable, using local fallback:', apiErr);
        usedLocalFallback = true;
        finalList = _localContinueScanFallback(msResults);
      }

      setContinueScanProgress(90);
      setContinueScanDetails((prev: any) => ({ ...prev, currentStage: usedLocalFallback ? 'Local fallback completed' : 'Backend selection completed', estimatedTimeRemaining: 0 }));

      setPreferredContinueScanList(finalList);
      setContinueScanStatus('completed');
      setContinueScanProgress(100);

      if (usedLocalFallback) { message.warning('Backend Continue Scan unavailable, using local fallback.'); }
      console.log(`[ContinueScan] completed — ${finalList.length} candidates, source=${usedLocalFallback ? 'local_fallback' : 'backend_shared'}`);
      return finalList;
    } catch (error) {
      console.error('[ContinueScan] processing failed:', error);
      setContinueScanStatus('error'); setContinueScanProgress(0);
      return [];
    }
  };

  // Local fallback if backend continue-scan endpoint is unavailable
  const _localContinueScanFallback = (msResults: any[]): any[] => {
    const results: any[] = [];
    for (const r of msResults) {
      if (r.analysisStatus === 'failed' || r.trendLabel === 'Need Data') continue;
      if (!r.price || r.price <= 0) continue;
      const trend = r.trendLabel; const score = r.overallScore || r.trendScore;
      if (trend == null || score == null) continue;
      if (!['Bullish', 'Strong Bullish', 'Constructive', 'Neutral'].includes(trend)) continue;
      const isBullish = trend === 'Bullish' || trend === 'Strong Bullish';
      if (isBullish && score < 70) continue;
      if (!isBullish && score < 80) continue;
      if (r.eventRisk === 'High') continue;
      const tc = trend === 'Strong Bullish' ? 35 : trend === 'Bullish' ? 25 : 15;
      const sc = Math.round(score * 0.5);
      const rc = r.eventRisk === 'Low' ? 12 : r.eventRisk === 'Medium' ? 6 : 0;
      const n = r.newsSentiment || 'Neutral';
      const nc = n === 'Positive' ? 10 : n === 'Neutral' ? 4 : n === 'Negative' ? -8 : 0;
      const chg = r.changePct || r.changePercent || 0;
      const cc = chg >= 3 ? 8 : chg >= 1 ? 5 : chg > 0 ? 2 : -6;
      const vs = r.volumeStatus || 'Normal';
      const vc = vs === 'High' ? 8 : vs === 'Normal' ? 4 : 0;
      const p = Math.max(0, Math.min(100, tc + sc + rc + nc + cc + vc));
      if (p >= 60) {
        results.push({ ...r, includeInContinueScan: true, priorityScore: p,
          priorityBreakdown: { trend: tc, score: sc, risk: rc, news: nc, price: cc, volume: vc },
          selectionReason: `[LOCAL FALLBACK] ${trend} trend, score ${score}`,
          continueScanStatus: 'completed', reasonSource: 'local_fallback',
          selectedBy: 'Local Fallback', continueDecisionSource: 'local_fallback',
          continueContextUsed: false, generatedAt: new Date().toISOString() });
      }
    }
    results.sort((a, b) => b.priorityScore - a.priorityScore);
    return results.slice(0, 20);
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
    return React.createElement('span', { style: { fontSize: '11px', color: 'var(--app-text-muted)', marginRight: '10px' } },
      label + ': ',
      React.createElement('span', { style: { color: color || 'var(--app-text-strong)', fontWeight: 600 } }, value)
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

    return React.createElement('div', { style: { padding: '20px 24px', backgroundColor: 'var(--app-card-bg-soft)', borderRadius: 12, border: '1px solid var(--app-border)', margin: '8px 12px 16px 12px', fontSize: '13px', lineHeight: '1.6' } },

      // Professional Header Row
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', paddingBottom: '12px', borderBottom: '1px solid var(--app-border)', marginBottom: '16px' } },
        React.createElement('span', { style: { fontWeight: 800, fontSize: '18px', color: 'var(--app-text-strong)', letterSpacing: '-0.5px' } }, record.symbol),
        React.createElement(Tag, { color: decision === 'Continue' ? 'success' : decision === 'Watch' ? 'warning' : decision === 'NeedMoreData' ? 'orange' : 'error', style: { fontSize: '12px', fontWeight: 700, margin: 0, padding: '0 10px', height: '24px', lineHeight: '24px', borderRadius: '4px' } }, (language === 'zh-CN' ? ({'Continue': '继续', 'Watch': '观察', 'NeedMoreData': '需数据', 'Reject': '拒绝', 'Skip': '跳过'} as any)[decision] || decision : decision.toUpperCase())),
        React.createElement('span', { style: { color: 'var(--app-text-muted)', fontSize: '12px', fontWeight: 500 } }, t.agent.scorePrefix, React.createElement('span', { style: { fontWeight: 700, color: '#1890ff' } }, record.matchConfidence || 0)),
        React.createElement('span', { style: { color: 'var(--app-text-muted)', fontSize: '14px' } }, '|'),
        React.createElement('span', { style: { color: 'var(--app-text-muted)', fontSize: '13px', fontWeight: 500 } }, (record.matchedStrategies || []).slice(0, 2).join(' · ') || bestStrat),

        // Warnings inline - emphasized
        (record.decisionWarnings || []).concat((record.decisionBlockers || []).map(function(b: string) { return t.agent.blockPrefix + b; })).slice(0, 2).map(function(w: string, i: number) {
          var isBlocker = w.indexOf(t.agent.blockPrefix) === 0;
          return React.createElement('span', { key: 'hw' + i, style: { padding: '2px 8px', borderRadius: 4, background: isBlocker ? 'rgba(255, 77, 79, 0.1)' : 'rgba(250, 173, 20, 0.1)', color: isBlocker ? '#ff4d4f' : '#d48806', fontSize: '11px', fontWeight: 600, border: '1px solid ' + (isBlocker ? 'rgba(255, 77, 79, 0.2)' : 'rgba(250, 173, 20, 0.2)'), whiteSpace: 'nowrap' } }, (isBlocker ? '✕ ' : '⚠ ') + (isBlocker ? w.slice(t.agent.blockPrefix.length) : w));
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
            return React.createElement('span', { key: c.key, title: c.title, style: { padding: '2px 8px', borderRadius: '4px', background: c.isAI ? 'rgba(19, 194, 194, 0.1)' : 'var(--app-border-soft)', color: c.isAI ? '#13c2c2' : 'var(--app-text-muted)', fontSize: '10px', fontWeight: 700, border: '1px solid ' + (c.isAI ? 'rgba(19, 194, 194, 0.2)' : 'var(--app-border)'), whiteSpace: 'nowrap', cursor: 'default' } }, c.label);
          });
        })()
      ),

      // Body: 2-column grid with better balance
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px' } },

        // LEFT COLUMN
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },

          // Match Summary
          React.createElement('div', { style: { background: 'var(--app-card-bg)', borderRadius: 8, border: '1px solid var(--app-border)', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' } },
            React.createElement('div', { style: { fontWeight: 700, fontSize: '11px', color: 'var(--app-text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' } }, t.agent.matchSummary),
            fullReason ? React.createElement('div', { style: { fontSize: '13px', color: 'var(--app-text-strong)', lineHeight: 1.6, marginBottom: '10px' }, title: fullReason }, fullReason) : null,
            React.createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
              React.createElement(Tag, { color: record.regime === 'Trending' ? 'blue' : record.regime === 'Breakout-ready' ? 'purple' : record.regime === 'Range-bound' ? 'green' : 'default', style: { fontSize: '11px', fontWeight: 600, margin: 0, padding: '0 8px', lineHeight: '20px' } }, language === 'zh-CN' ? ({'Trending': t.agent.regimeTrending, 'Breakout-ready': t.agent.regimeBreakout, 'Range-bound': t.agent.regimeRange} as any)[record.regime] || t.agent.regimeUnclear : (record.regime || 'Unclear')),
              React.createElement('span', { style: { fontSize: '12px', color: 'var(--app-text-muted)', fontWeight: 500 } }, t.agent.confidenceLevel + ': ' + (record.matchConfidence || 0) + '% | ' + t.agent.colScore + ': ' + (record.scanScore || 'N/A'))
            )
          ),

          // Backtest
          React.createElement('div', { style: { background: 'var(--app-card-bg)', borderRadius: 8, border: '1px solid var(--app-border)', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' } },
            React.createElement('div', { style: { fontWeight: 700, fontSize: '11px', color: 'var(--app-text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' } }, t.agent.strategyBacktest),
            perStrategy.length > 0 ? (
              React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '12px' } },
                React.createElement('thead', null,
                  React.createElement('tr', { style: { color: 'var(--app-text-muted)', borderBottom: '1px solid var(--app-border-soft)' } },
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
                    return React.createElement('tr', { key: i, style: { borderBottom: '1px solid var(--app-card-bg-soft)' } },
                      React.createElement('td', { style: { padding: '8px 4px', fontWeight: 600, color: 'var(--app-text-strong)' } }, ps.strategy),
                      React.createElement('td', { style: { padding: '8px 4px', textAlign: 'right', fontWeight: 700, color: (ps.totalReturn || 0) >= 0 ? '#52c41a' : '#ff4d4f' } }, ps.totalReturn != null ? (ps.totalReturn >= 0 ? '+' : '') + Number(ps.totalReturn).toFixed(1) + '%' : '--'),
                      React.createElement('td', { style: { padding: '8px 4px', textAlign: 'right', fontWeight: 500, color: (ps.sharpe || 0) >= 1.0 ? '#1890ff' : (ps.sharpe || 0) >= 0.5 ? 'var(--app-text-strong)' : '#ff4d4f' } }, ps.sharpe != null ? Number(ps.sharpe).toFixed(2) : '--'),
                      React.createElement('td', { style: { padding: '8px 4px', textAlign: 'right', color: Math.abs(ps.maxDrawdown || 0) < 15 ? 'var(--app-text-strong)' : Math.abs(ps.maxDrawdown || 0) < 25 ? '#faad14' : '#ff4d4f' } }, ps.maxDrawdown != null ? Number(ps.maxDrawdown).toFixed(1) + '%' : '--'),
                      React.createElement('td', { style: { padding: '8px 4px', textAlign: 'right', fontWeight: 500 } }, ps.winRate != null ? Number(ps.winRate).toFixed(1) + '%' : '--'),
                      React.createElement('td', { style: { padding: '8px 4px', textAlign: 'right', fontStyle: (ps.tradeCount || 0) < 3 ? 'italic' : 'normal', color: (ps.tradeCount || 0) < 3 ? '#fa8c16' : 'var(--app-text-muted)' }, title: (ps.tradeCount || 0) < 3 ? t.agent.limitedSample : undefined }, ps.tradeCount != null ? String(ps.tradeCount) : '--'),
                      React.createElement('td', { style: { padding: '8px 4px', textAlign: 'center' } },
                        React.createElement(Tag, { color: ps.status === 'passed' ? 'success' : ps.status === 'caution' ? 'warning' : 'error', style: { fontSize: '10px', fontWeight: 700, margin: 0, padding: '0 6px', lineHeight: '18px' } },
                          ps.status === 'passed' ? t.agent.statusPass : ps.status === 'caution' ? t.agent.statusCaution : ps.status === 'completed_losing' ? t.agent.statusFail : '--')
                      )
                    );
                  })
                )
              )
            ) : React.createElement('div', { style: { fontSize: '13px', color: 'var(--app-text-muted)', fontStyle: 'italic', padding: '10px 0' } }, t.agent.backtestNotAvailable),
            record.backtestPeriod ? React.createElement('div', { style: { fontSize: '11px', color: 'var(--app-text-muted)', marginTop: '8px', borderTop: '1px solid var(--app-border-soft)', paddingTop: '6px' } }, t.agent.evaluationPeriod + ': ' + record.backtestPeriod) : null
          ),

          // Optimization
          React.createElement('div', { style: { background: 'var(--app-card-bg)', borderRadius: 8, border: '1px solid var(--app-border)', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' } },
            React.createElement('div', { style: { fontWeight: 700, fontSize: '11px', color: 'var(--app-text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' } }, t.agent.quickOptimization),
            optResults.length > 0 ? (
              React.createElement('div', null,
                React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '12px' } },
                  React.createElement('thead', null,
                    React.createElement('tr', { style: { color: 'var(--app-text-muted)', borderBottom: '1px solid var(--app-border-soft)' } },
                      React.createElement('th', { style: { textAlign: 'left', padding: '6px 4px', fontWeight: 600 } }, t.agent.optColStrategy),
                      React.createElement('th', { style: { textAlign: 'center', padding: '6px 4px', fontWeight: 600 } }, t.agent.optColStability),
                      React.createElement('th', { style: { textAlign: 'right', padding: '6px 4px', fontWeight: 600 } }, t.agent.optColAvgReturn),
                      React.createElement('th', { style: { textAlign: 'right', padding: '6px 4px', fontWeight: 600 } }, t.agent.optColPosRatio),
                      React.createElement('th', { style: { textAlign: 'right', padding: '6px 4px', fontWeight: 600 } }, t.agent.optColSpread)
                    )
                  ),
                  React.createElement('tbody', null,
                    optResults.map(function(opt: any, oi: number) {
                      return React.createElement('tr', { key: oi, style: { borderBottom: '1px solid var(--app-card-bg-soft)' } },
                        React.createElement('td', { style: { padding: '8px 4px', fontWeight: 600, color: 'var(--app-text-strong)' } }, opt.strategy),
                        React.createElement('td', { style: { padding: '8px 4px', textAlign: 'center' } },
                          React.createElement(Tag, { color: opt.stability === 'Stable' ? 'success' : opt.stability === 'Weak' ? 'warning' : 'error', style: { fontSize: '10px', fontWeight: 700, margin: 0, padding: '0 6px', lineHeight: '18px' } },
                            opt.stability === 'Stable' ? t.agent.statusStable : opt.stability === 'Weak' ? t.agent.statusWeak : t.agent.statusOverfit)
                        ),
                        React.createElement('td', { style: { padding: '8px 4px', textAlign: 'right', fontWeight: 700, color: opt.avgReturn >= 0 ? '#52c41a' : '#ff4d4f' } }, (opt.avgReturn >= 0 ? '+' : '') + opt.avgReturn + '%'),
                        React.createElement('td', { style: { padding: '8px 4px', textAlign: 'right', fontWeight: 500 } }, opt.positiveRatio + '%'),
                        React.createElement('td', { style: { padding: '8px 4px', textAlign: 'right', color: 'var(--app-text-muted)' } }, (opt.stdReturn || 0).toFixed(1) + '%')
                      );
                    })
                  )
                ),
                record.quickOptSummary ? React.createElement('div', { style: { fontSize: '11px', color: 'var(--app-text-muted)', marginTop: '8px', borderTop: '1px solid var(--app-border-soft)', paddingTop: '6px' } }, record.quickOptSummary) : null
              )
            ) : React.createElement('div', { style: { fontSize: '13px', color: 'var(--app-text-muted)', fontStyle: 'italic', padding: '10px 0' } }, t.agent.optimizationNotAvailable),
            record.quickOptStatus === 'running' ? React.createElement('div', { style: { fontSize: '12px', color: '#fa8c16', fontWeight: 600, marginTop: '8px' } }, '⚡ ' + t.agent.optimizationInProgress) : null
          ),

          // Entry Quality
          React.createElement('div', { style: { background: 'var(--app-card-bg)', borderRadius: 8, border: '1px solid var(--app-border)', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' } },
            React.createElement('div', { style: { fontWeight: 700, fontSize: '11px', color: 'var(--app-text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' } }, t.agent.surgicalEntry),
            eq && eq !== 'Error / No Data' ? (
              React.createElement('div', null,
                React.createElement('div', { style: { marginBottom: '10px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' } },
                  React.createElement('span', { style: { fontSize: '15px', fontWeight: 800, color: eq === 'Good' || eq === 'Excellent' ? '#52c41a' : eq === 'Wait for Pullback' ? '#faad14' : '#ff4d4f' } }, eq),
                  React.createElement('span', { style: { fontSize: '13px', color: 'var(--app-text-muted)', fontWeight: 500 } }, t.agent.setupScore + ': ' + (record.entryScore || '--') + '/100'),
                  eqD && eqD.reward_risk_ratio != null && eqD.reward_risk_ratio < 1.5 && (eq === 'Good' || eq === 'Excellent') ? React.createElement('span', { style: { padding: '2px 8px', borderRadius: 4, background: 'rgba(250, 173, 20, 0.1)', color: '#d48806', fontSize: '11px', fontWeight: 600, border: '1px solid rgba(250, 173, 20, 0.2)' } }, '⚠ ' + t.agent.rrCapped + eqD.reward_risk_ratio + ':1') : null
                ),
                eqD ? React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px 20px', fontSize: '12px', backgroundColor: 'var(--app-card-bg-soft)', padding: '10px', borderRadius: '6px' } },
                  eqD.current_price != null ? React.createElement(FineScanDetailTag, { label: t.agent.tagPrice, value: '$' + eqD.current_price }) : null,
                  eqD.atr != null ? React.createElement(FineScanDetailTag, { label: t.agent.tagAtr, value: '$' + eqD.atr + ' (' + eqD.atr_pct + '%)' }) : null,
                  eqD.support != null ? React.createElement(FineScanDetailTag, { label: t.agent.tagSupport, value: '$' + eqD.support }) : null,
                  eqD.resistance != null ? React.createElement(FineScanDetailTag, { label: t.agent.tagResistance, value: '$' + eqD.resistance }) : null,
                  eqD.entry_zone_low != null ? React.createElement(FineScanDetailTag, { label: t.agent.tagZone, value: '$' + eqD.entry_zone_low + '–$' + eqD.entry_zone_high }) : null,
                  eqD.stop_distance_pct != null ? React.createElement(FineScanDetailTag, { label: t.agent.tagStop, value: eqD.stop_distance_pct + '%', color: eqD.stop_distance_pct > 5 ? '#fa8c16' : undefined }) : null,
                  eqD.reward_risk_ratio != null ? React.createElement(FineScanDetailTag, { label: t.agent.tagRR, value: eqD.reward_risk_ratio + ':1', color: eqD.reward_risk_ratio < 1.5 ? '#ff4d4f' : eqD.reward_risk_ratio < 2 ? '#faad14' : '#52c41a' }) : null
                ) : null,
                record.entryReason ? React.createElement('div', { style: { fontSize: '12px', color: 'var(--app-text-muted)', marginTop: '10px', lineHeight: '1.5', fontStyle: 'italic' } }, '”' + record.entryReason + '”') : null
              )
            ) : React.createElement('div', { style: { padding: '10px 0', color: 'var(--app-text-muted)', fontStyle: 'italic', fontSize: '13px' } }, t.agent.entryQualityUnavailable)
          )
        ),

        // RIGHT COLUMN
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },

          // Key Signals
          React.createElement('div', { style: { background: 'var(--app-card-bg)', borderRadius: 8, border: '1px solid var(--app-border)', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' } },
            React.createElement('div', { style: { fontWeight: 700, fontSize: '11px', color: 'var(--app-text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' } }, t.agent.highConvictionSignals),
            signals.length > 0 ? (
              React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' } },
                signals.slice(0, 8).map(function(sig: string, i: number) {
                  return React.createElement('span', { key: i, style: { padding: '3px 10px', borderRadius: 4, backgroundColor: 'rgba(47, 84, 235, 0.1)', color: '#1890ff', fontSize: '12px', fontWeight: 600, border: '1px solid rgba(47, 84, 235, 0.2)' } }, sig);
                }),
                signals.length > 8 ? React.createElement('span', { style: { fontSize: '12px', color: 'var(--app-text-muted)', fontWeight: 500, alignSelf: 'center' } }, '+' + (signals.length - 8) + ' ' + (language === 'zh-CN' ? '更多' : 'more')) : null
              )
            ) : React.createElement('div', { style: { padding: '5px 0', color: 'var(--app-text-muted)', fontSize: '13px' } }, '--')
          ),

          // Liquidity & Risk
          React.createElement('div', { style: { background: 'var(--app-card-bg)', borderRadius: 8, border: '1px solid var(--app-border)', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' } },
            React.createElement('div', { style: { fontWeight: 700, fontSize: '11px', color: 'var(--app-text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' } }, t.agent.liquidityRiskProfile),
            React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' } },
              React.createElement('div', { style: { backgroundColor: 'var(--app-card-bg-soft)', padding: '10px', borderRadius: '6px' } },
                React.createElement('div', { style: { fontWeight: 700, color: 'var(--app-text-muted)', marginBottom: '6px', fontSize: '11px', textTransform: 'uppercase' } }, t.agent.liquiditySubLabel),
                lg && lg !== 'Error' ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
                  React.createElement(FineScanDetailTag, { label: t.agent.tagGrade, value: lg, color: lg === 'Good' ? '#52c41a' : lg === 'Caution' ? '#faad14' : '#ff4d4f' }),
                  ld ? React.createElement(React.Fragment, null,
                    ld.rvol != null ? React.createElement(FineScanDetailTag, { label: t.agent.tagRvol, value: ld.rvol + 'x', color: ld.rvol >= 1.5 ? '#52c41a' : ld.rvol < 0.7 ? '#ff4d4f' : undefined }) : null,
                    ld.spread_pct != null ? React.createElement(FineScanDetailTag, { label: t.agent.tagSpread, value: ld.spread_pct + '%', color: ld.spread_pct > 1 ? '#ff4d4f' : ld.spread_pct > 0.2 ? '#faad14' : undefined }) : null
                  ) : null
                ) : React.createElement('span', { style: { color: 'var(--app-text-muted)', fontStyle: 'italic' } }, t.agent.noDataLabel)
              ),
              React.createElement('div', { style: { backgroundColor: 'var(--app-card-bg-soft)', padding: '10px', borderRadius: '6px' } },
                React.createElement('div', { style: { fontWeight: 700, color: 'var(--app-text-muted)', marginBottom: '6px', fontSize: '11px', textTransform: 'uppercase' } }, t.agent.riskPrefix),
                rg && rg !== 'SKIP' ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
                  React.createElement(FineScanDetailTag, { label: t.agent.tagGrade, value: language === 'zh-CN' ? ({'LOW': t.agent.low, 'MEDIUM': t.agent.medium, 'HIGH': t.agent.high} as any)[rg] || rg : (rg === 'LOW' ? 'Low' : rg === 'MEDIUM' ? 'Medium' : rg === 'HIGH' ? 'High' : rg), color: rg === 'LOW' ? '#52c41a' : rg === 'MEDIUM' ? '#faad14' : '#ff4d4f' }),
                  rd ? React.createElement(React.Fragment, null,
                    React.createElement(FineScanDetailTag, { label: t.agent.tagScore, value: (rd.risk_score || '--') + '/100', color: rd.risk_score >= 65 ? '#ff4d4f' : rd.risk_score >= 35 ? '#faad14' : '#52c41a' }),
                    rd.atr_pct != null ? React.createElement(FineScanDetailTag, { label: t.agent.tagAtr, value: rd.atr_pct + '%', color: rd.atr_pct > 5 ? '#ff4d4f' : undefined }) : null
                  ) : null
                ) : React.createElement('span', { style: { color: 'var(--app-text-muted)', fontStyle: 'italic' } }, t.agent.noDataLabel)
              )
            )
          ),

          // News & Catalyst
          React.createElement('div', { style: { background: 'var(--app-card-bg)', borderRadius: 8, border: '1px solid var(--app-border)', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' } },
            React.createElement('div', { style: { fontWeight: 700, fontSize: '11px', color: 'var(--app-text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' } }, t.agent.newsAndCatalyst),
            ng && ng !== 'Error' ? React.createElement('div', null,
              React.createElement('div', { style: { marginBottom: '8px', display: 'flex', gap: '12px' } },
                React.createElement(FineScanDetailTag, { label: t.agent.tagSentiment, value: language === 'zh-CN' ? ({'Catalyst': '催化剂', 'Caution': '谨慎', 'High Event Risk': '高事件风险'} as any)[ng] || ng : ng, color: ng === 'Catalyst' ? '#1890ff' : ng === 'Caution' ? '#faad14' : ng === 'High Event Risk' ? '#ff4d4f' : undefined }),
                nd ? React.createElement(React.Fragment, null,
                  React.createElement(FineScanDetailTag, { label: t.agent.tagHeadlines, value: String(nd.headline_count || 0) }),
                  React.createElement(FineScanDetailTag, { label: t.agent.tagEarnings, value: nd.earnings_soon ? t.agent.earningsUpcoming : t.agent.earningsClear, color: nd.earnings_soon ? '#faad14' : undefined })
                ) : null
              ),
              nd && nd.top_headlines && nd.top_headlines.length > 0 ? React.createElement('div', { style: { fontSize: '12px', color: 'var(--app-text-muted)', lineHeight: '1.6', backgroundColor: 'var(--app-card-bg-soft)', padding: '8px', borderRadius: '4px', borderLeft: '3px solid var(--app-border)' } },
                nd.top_headlines.slice(0, 2).map(function(h: string, i: number) {
                  return React.createElement('div', { key: i, style: { display: '-webkit-box', WebkitLineClamp: '1', WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: '4px' }, title: h }, '• ' + h);
                }),
                nd.top_headlines.length > 2 ? React.createElement('div', { style: { color: 'var(--app-text-muted)', fontSize: '11px', marginTop: '4px' } }, t.agent.viewMoreHeadlines.replace('{count}', String(nd.top_headlines.length - 2))) : null
              ) : React.createElement('div', { style: { color: 'var(--app-text-muted)', fontSize: '12px', fontStyle: 'italic' } }, t.agent.noSignificantNews)
            ) : React.createElement('div', { style: { color: 'var(--app-text-muted)', fontSize: '13px' } }, t.agent.newsSentimentUnavailable)
          ),

          // AI Explanation / Strategic Reasoning
          React.createElement('div', { style: { background: 'var(--app-card-bg)', borderRadius: 8, border: '1px solid var(--app-border)', padding: '12px 16px', boxShadow: '0 2px 4px rgba(24, 144, 255, 0.05)' } },
            React.createElement('div', { style: { fontWeight: 700, fontSize: '11px', color: '#1890ff', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' } }, t.agent.strategicReasoning),
            React.createElement('div', { style: { marginBottom: '10px', display: 'flex', gap: '12px' } },
              React.createElement(FineScanDetailTag, { label: t.agent.tagSource, value: aiExplained ? 'DEEPSEEK-V3' : t.agent.localRulesLabel, color: aiExplained ? '#13c2c2' : '#fa8c16' }),
              aiExplained ? React.createElement(FineScanDetailTag, { label: t.agent.tagTokens, value: t.agent.tokensOptimized }) : null
            ),
            record.finalReason ? React.createElement('div', { style: { fontSize: '13px', color: 'var(--app-text-strong)', lineHeight: '1.6', marginBottom: '12px', padding: '10px', backgroundColor: 'var(--app-blue-bg)', borderRadius: '6px', border: '1px solid var(--app-blue-border)' }, title: record.finalReason }, record.finalReason) : null,
            record.nextStep ? React.createElement('div', { style: { borderTop: '1px solid var(--app-border-soft)', paddingTop: '10px' } },
              React.createElement('div', { style: { fontSize: '11px', fontWeight: 700, color: '#1890ff', textTransform: 'uppercase', marginBottom: '4px' } }, t.agent.recommendedNextStep + ':'),
              React.createElement('div', { style: { fontSize: '13px', color: '#1890ff', fontWeight: 600, lineHeight: '1.5' }, title: record.nextStep }, record.nextStep)
            ) : null,
            !aiExplained && !record.finalReason ? React.createElement('div', { style: { color: 'var(--app-text-muted)', fontSize: '13px', fontStyle: 'italic' } }, t.agent.compilingReasoning) : null
          )
        )
      ),
      // Footer spacer
      React.createElement('div', { style: { height: '8px' } })
    );
  };  const renderDetailPanel = (record: any) => {
    // Merge lazy-fetched news into display record
    const lazyNews = lazyNewsCache[record.symbol];
    const displayRecord = (lazyNews && !lazyNews._error && lazyNews.topNews)
      ? { ...record, ...lazyNews, topNews: lazyNews.topNews, newsSource: lazyNews.newsSource, newsFetchReason: lazyNews.newsFetchReason, dataSources: { ...record.dataSources, news: lazyNews.dataSources?.news }, provenance: { ...record.provenance, news: lazyNews.provenance?.news }, newsCount: lazyNews.newsCount, hasNews: lazyNews.hasNews }
      : record;
    // Trigger lazy refresh for rate-limited/failed/skipped symbols
    const _reason = record.newsFetchReason || '';
    const _src = (record.newsSource || '').toLowerCase();
    const needsLazyRefresh = !record.topNews && (
      _reason === 'news_fetch_skipped_top_n_limit' || _src.includes('below top candidate')
      || _reason === 'finnhub_rate_limited' || _src.includes('rate limit')
      || _reason === 'finnhub_news_api_failed' || _src.includes('finnhub error')
    );
    if (needsLazyRefresh) { scheduleLazyNews(record.symbol); }

    const score = displayRecord.trendScore || displayRecord.overallScore || 0;
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
                  backgroundColor: 'var(--app-card-bg-soft)',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--app-border-soft)'
                }}>
                  <div>
                    <div className="scanner-detail-label" style={{ marginBottom: 4 }}>{t.agent.currentPrice}</div>
                    <div className="scanner-detail-value" style={{ fontSize: '22px', color: 'var(--app-text-strong)' }}>
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
                            borderRadius: '4px', backgroundColor: 'var(--app-card-bg-soft)',
                            color: 'var(--app-text-muted)', display: 'inline-block'
                          }}>—</div>
                        );
                      }
                      return (
                        <div style={{
                          fontSize: '16px', fontWeight: 800, padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: cp >= 0 ? 'rgba(82, 196, 26, 0.1)' : 'rgba(255, 77, 79, 0.1)',
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
                    <div className="scanner-detail-value" style={{ color: 'var(--app-text-muted)' }}>{record.dayLow != null ? `$${record.dayLow.toFixed(2)}` : '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="scanner-detail-label">{t.agent.dayHigh}</div>
                    <div className="scanner-detail-value" style={{ color: 'var(--app-text-muted)' }}>{record.dayHigh != null ? `$${record.dayHigh.toFixed(2)}` : '—'}</div>
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
                    <div className="scanner-detail-value" style={{ fontSize: '13px', color: 'var(--app-text)' }}>{translateSector(record.sector) || 'N/A'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="scanner-detail-label">{t.agent.industryLabel}</div>
                    <div className="scanner-detail-value" style={{ fontSize: '13px', color: 'var(--app-text)' }}>{translateSector(record.industry || record.sector) || 'N/A'}</div>
                  </div>
                </div>

                {/* Data Provenances */}
                <div style={{ 
                  marginTop: '4px',
                  padding: '10px',
                  backgroundColor: 'var(--app-card-bg-soft)',
                  borderRadius: '6px',
                  border: '1px dashed var(--app-border)'
                }}>
                  <div className="scanner-detail-label" style={{ marginBottom: 8 }}>{t.agent.dataProvenances}</div>
                  <div style={{ fontSize: '11px', color: 'var(--app-text-muted)', lineHeight: '1.8' }}>
                    {record.provenance ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>{t.agent.marketDataLabel}:</span>
                          <span style={{ fontWeight: 600, color: 'var(--app-text-muted)' }}>{record.provenance.marketData || 'Real-time'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>{t.agent.fundamentalsLabel}:</span>
                          <span style={{ fontWeight: 600, color: 'var(--app-text-muted)' }}>{record.provenance.companyInfo || 'Finnhub'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>{t.agent.sentimentLabel}:</span>
                          <span style={{ fontWeight: 600, color: 'var(--app-text-muted)' }}>{record.provenance.news || 'Market News'}</span>
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontStyle: 'italic', color: 'var(--app-text-muted)' }}>{t.agent.detailedSourceUnavailable}</span>
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
                      <span style={{ fontSize: '14px', color: 'var(--app-text-muted)', marginLeft: 4 }}>/100</span>
                    </div>
                  </div>
                  <Progress 
                    percent={score} 
                    strokeColor={scoreColor} 
                    showInfo={false} 
                    strokeWidth={12}
                    style={{ marginBottom: 6 }}
                  />
                  <div style={{ fontSize: '12px', color: 'var(--app-text-muted)', textAlign: 'right', fontWeight: 600 }}>
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
                        <span className="scanner-detail-label" style={{ margin: 0, fontSize: '10px', color: 'var(--app-text-muted)' }}>{item.label}</span>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                          <span className="scanner-detail-value" style={{ fontSize: '16px' }}>
                            {item.value != null ? item.value.toFixed(0) : '--'}
                          </span>
                          <div style={{ 
                            width: 36, 
                            height: 5, 
                            borderRadius: 2, 
                            backgroundColor: 'var(--app-table-header-bg)',
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
                    backgroundColor: 'var(--app-card-bg-soft)', border: '1px solid rgba(82, 196, 26, 0.3)',
                    borderRadius: '8px',
                    padding: '16px',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    color: 'var(--app-text-strong)',
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
                    backgroundColor: 'var(--app-card-bg)',
                    border: '1px solid var(--app-border-soft)',
                    borderRadius: '8px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                  }}>
                    {displayRecord.topNews ? (() => {
                      const tn = displayRecord.topNews;
                      const title = tn.title || 'Untitled news';
                      const source = tn.source || tn.publisher || 'Finnhub';
                      const published = tn.published || tn.publishedAt;
                      const summary = tn.summary || 'No summary available';
                      const url = tn.url || '';
                      return (
                      <div>
                        {url ? (
                          <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '14px', fontWeight: 700, color: '#1890ff', marginBottom: '8px', display: 'block', lineHeight: '1.4', textDecoration: 'none' }}>{title}</a>
                        ) : (
                          <span style={{ fontSize: '14px', fontWeight: 700, color: '#1890ff', marginBottom: '8px', display: 'block', lineHeight: '1.4' }}>{title}</span>
                        )}
                        <div style={{ fontSize: '11px', color: 'var(--app-text-muted)', marginBottom: 10, display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--app-border-soft)', paddingTop: '6px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--app-text-muted)' }}>{source}</span>
                          <span>{published ? formatNewsDate(published) : 'Time unavailable'}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--app-text-muted)', lineHeight: '1.5' }}>
                          {summary.length > 140 ? summary.substring(0, 140) + '...' : summary}
                        </div>
                      </div>
                      );
                    })() : (
                      <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--app-text-muted)' }}>
                        {needsLazyRefresh && !lazyNewsCache[record.symbol] ? (
                          <>
                            <LoadingOutlined style={{ fontSize: '20px', marginBottom: 8, display: 'block' }} />
                            <span style={{ fontSize: '12px' }}>Fetching Finnhub news...</span>
                          </>
                        ) : (
                          <>
                            <InfoCircleOutlined style={{ fontSize: '24px', marginBottom: 8, display: 'block', opacity: 0.5 }} />
                            <span style={{ fontSize: '12px' }}>{getNewsEmptyReason(displayRecord)}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {record.nextStep && (
                  <div style={{ 
                    marginTop: 'auto', 
                    padding: '14px', 
                    backgroundColor: 'var(--app-blue-bg)', 
                    borderRadius: '8px',
                    border: '1px solid rgba(24, 144, 255, 0.2)',
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
    setEntryPlanStatus('idle');
    setEntryPlanResults(null);

    // Preflight: check session, Alpaca, and AI config
    const preflight = await preflightConfigCheck();
    if (!preflight.ok || !preflight.sessionValid) {
      setFineScanStatus('failed');
      setFineScanMessage(preflight.error || 'Session expired');
      unregisterFineScanRun();
      message.error(preflight.error || 'Session expired');
      return [];
    }
    if (!preflight.alpacaConfigured) {
      setFineScanStatus('failed');
      setFineScanMessage('Alpaca Market Data API is not configured. Configure in Settings.');
      unregisterFineScanRun();
      message.error('Alpaca Market Data API is not configured.');
      return [];
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
      return [];
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
      return results;
    } catch (error) {
      console.error('Fine scan error:', error);
      setFineScanStatus('error');
      unregisterFineScanRun();
      message.error('Fine scan failed: ' + (error as any).message);
      return [];
    }
  };


  // ===== Deeper Validation State ===== (now in scannerStateStore)
  // deeperValidationStatus and deeperValidationResults are read from store snapshot above

  // ===== Entry Plan State ===== (now in scannerStateStore)
  // entryPlanStatus and entryPlanResults are read from store snapshot above
  const [expandedEntryPlanSymbol, setExpandedEntryPlanSymbol] = useState<string | null>(null);
  const [entryPlanAccountSize] = useState<number>(100000);
  // Derived from global riskProfile: Low→0.5%, Medium→1.0%, High→1.5%
  const entryPlanRiskPerTrade = riskProfile === 'low' ? 0.5 : riskProfile === 'high' ? 1.5 : 1.0;
  // Derived from pipelineMode + tradeMode
  const entryPlanExecutionMode = pipelineMode === 'ai'
    ? 'Recommend Only'
    : tradeMode === 'real'
      ? 'Real Trade if Triggered'
      : 'Paper Trade if Triggered';

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

    if (fa === 'Blocked by Risk' || rg.status === 'BLOCK' || dq === 'POOR') {
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

    if (fa === 'Wait for Entry' || tr === 'WAIT') {
      // Add to watchlist
      addToWatchlist(plan);
      return;
    }

    if (fa === 'Buy Ready' || fa === 'Ready for Review') {
      if (fa === 'Ready for Review') {
        // AI mode: Ready for Review auto-executes via pipeline — skip confirmation modal
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
    if (exitScanRunning) return [];
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
      return [];
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
      const actionableExitSignals = results.filter(r => r.exitDecision === 'sell_now' || r.exitDecision === 'place_target_limit');
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
      return [...results];
    } catch (e: any) {
      setExitScanStatus('failed');
      message.error(`Exit Scan failed: ${e?.message || 'Unknown error'}`);
      notificationAPI.sendDiscordEvent('error', {
        event_id: `exit-scan-error-${Date.now()}`,
        step: 'Exit Scan',
        status: 'failed',
        reason: e?.message || 'Unknown error',
        action: 'Review holdings, Alpaca configuration, and exit scan inputs.',
      }).catch(() => {});
      return [];
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

    if (rg === 'BLOCK' || fa === 'Blocked by Risk') return 'Blocked';
    if (rg === 'FAIL') return 'Blocked';

    // Watch-to-Validate source: only Ready if gate PASS
    if (item.source === 'Watch-to-Validate' || item.selectedBy === 'Watch-to-Validate') {
      if (rg !== 'PASS') return 'Watch-only';
    }

    if (ai === 'SKIP') return 'Blocked';

    // Ready for Review or Buy Ready with in-zone = Ready
    if (fa === 'Ready for Review' || fa === 'Buy Ready') {
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
    const _normalize = (v: any) => String(v || '').trim();
    const eligible = new Set(['confirmed', 'pass', 'watch', 'review', 'needs manual review', 'manual review', 'readyreview', 'ready_review']);
    const ineligible = new Set(['blocked', 'reject', 'rejected', 'avoid', 'needdata', 'need_data', 'error']);
    const candidates: any[] = [];
    for (const r of results) {
      // Read finalVerdict first (AI overlay), fallback to verdict (local), then other fields
      const rawV = _normalize(r.finalVerdict || r.verdict || r.aiValidationVerdict || r.localVerdictBeforeAI || r.decision || '');
      const v = rawV.toLowerCase();
      if (ineligible.has(v)) continue;
      if (eligible.has(v)) {
        const note = v === 'watch' ? 'Conservative / Watch Only'
          : v === 'review' || v.includes('review') ? 'Review Required'
          : v === 'pass' || v === 'confirmed' ? '' : '';
        candidates.push({ ...r, _planNote: note || undefined });
      }
    }
    return candidates.slice(0, 8);
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

  const _runEntryPlanLoop = async (candidates: any[]): Promise<any[]> => {
    let _epResult: any[] = [];
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
        _epResult = enrichedPlans;
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
        setEntryPlanStatus('completed');
        setEntryPlanResults([]);
        unregisterEntryPlanRun();
        console.warn('[EntryPlan] backend returned non-success:', errMsg);
        message.warning('Entry Plan completed with no plans: ' + errMsg);
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
            _epResult = enrichedPlans;
            setEntryPlanStatus('completed');
            unregisterEntryPlanRun();
            return _epResult;
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
        background: 'var(--app-card-bg)', 
        borderRadius: 12, 
        border: '1px solid var(--app-border-soft)',
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid var(--app-card-bg-soft)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: 'var(--app-text-muted)', fontSize: 12 }}>{label}</span>
          {info && <Tooltip title={info}><InfoCircleOutlined style={{ fontSize: 10, color: 'var(--app-text-muted)' }} /></Tooltip>}
        </div>
        <span style={{ 
          fontWeight: boldValue ? 700 : 600, 
          color: color || 'var(--app-text-strong)', 
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
    const readinessColor = readiness.includes('Ready') || readiness.includes('Now') ? '#52c41a' : readiness.includes('Wait') ? '#faad14' : 'var(--app-text-muted)';

    return (
      <div style={{ padding: '20px', background: 'var(--app-card-bg-soft)', borderRadius: 16, margin: '8px 0' }}>
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
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--app-text-strong)', lineHeight: 1 }}>{ep.symbol}</span>
              <span style={{ fontSize: 10, color: 'var(--app-text-muted)', fontWeight: 600, marginTop: 4, textTransform: 'uppercase' }}>{t.agent.symbolAnalysis}</span>
            </div>
            <Divider type="vertical" style={{ height: 32, borderColor: 'var(--app-border)' }} />
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
            <DetailItem label={t.agent.finalAction} value={ep.finalAction === 'Blocked by Risk' ? 'Blocked by Risk' : ep.finalAction === 'BUY' ? 'Buy' : ep.finalAction === 'WAIT' ? 'Wait' : ep.finalAction} color={ep.finalAction === 'Buy Ready' ? '#52c41a' : ep.finalAction === 'Wait for Entry' ? '#1890ff' : '#ff4d4f'} boldValue />
            <DetailItem label={t.agent.aiDecision} value={ep.aiDecision === 'SKIP' ? 'Skip' : ep.aiDecision === 'BUY' ? 'Buy' : ep.aiDecision === 'WATCH' ? 'Watch' : ep.aiDecision} color={ep.aiDecision === 'BUY' ? '#52c41a' : '#faad14'} />
            <DetailItem label={t.agent.confidence} value={ep.confidence ? `${ep.confidence}%` : 'N/A'} color={ep.confidence >= 80 ? '#52c41a' : '#1890ff'} />
            <DetailItem label={t.agent.readiness} value={ep.tradeReadiness === 'BLOCKED' ? 'Blocked' : ep.tradeReadiness === 'READY' ? 'Ready' : ep.tradeReadiness === 'WAITING' ? 'Waiting' : ep.tradeReadiness} color={readinessColor} />
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
            background: 'var(--app-card-bg)',
            borderRadius: 12,
            border: '1px solid var(--app-border-soft)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--app-text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>{t.agent.epAnalysisWarnings}</div>
            <Row gutter={24}>
              {ep.decisionReason && (
                <Col span={ep.riskNotes || (ep.blockers && ep.blockers.length > 0) ? 14 : 24}>
                  <div style={{ fontSize: 13, color: 'var(--app-text)', lineHeight: 1.6 }}>
                    <Text strong style={{ fontSize: 11, color: 'var(--app-text-muted)', display: 'block', marginBottom: 4 }}>{t.agent.reasoning}</Text>
                    {safeRender(ep.decisionReason)}
                  </div>
                </Col>
              )}
              {(ep.riskNotes || (ep.blockers && ep.blockers.length > 0)) && (
                <Col span={ep.decisionReason ? 10 : 24}>
                  {ep.riskNotes && (
                    <div style={{ marginBottom: 12 }}>
                      <Text strong style={{ fontSize: 11, color: '#faad14', display: 'block', marginBottom: 4 }}>{t.agent.riskNotes}</Text>
                      <div style={{ fontSize: 12, color: '#d48806', background: 'rgba(250, 173, 20, 0.1)', padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(250, 173, 20, 0.2)' }}>
                        {safeRender(ep.riskNotes)}
                      </div>
                    </div>
                  )}
                  {ep.blockers && ep.blockers.length > 0 && (
                    <div>
                      <Text strong style={{ fontSize: 11, color: '#ff4d4f', display: 'block', marginBottom: 4 }}>{t.agent.blockers}</Text>
                      <div style={{ fontSize: 12, color: '#cf1322', background: 'rgba(255, 77, 79, 0.1)', padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(255, 77, 79, 0.2)' }}>
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
        {riskProfile === 'high' && (ep.finalAction === 'SKIP' || ep.finalAction === 'Blocked by Risk') && !ep.isLeveragedAlternative && (
          <LeveragedETFSuggestion symbol={ep.symbol} currentPrice={ep.currentPrice} plan={ep} />
        )}

        {/* Leveraged Alternative Plan Header */}
        {ep.isLeveragedAlternative && (
          <div style={{
            marginTop: 8, padding: '8px 12px',
            background: 'linear-gradient(135deg, rgba(250, 173, 20, 0.1), rgba(255, 77, 79, 0.1))',
            borderRadius: 8, border: '1px solid #fed7aa',
            display: 'flex', alignItems: 'center', gap: 8
          }}>
            <ThunderboltOutlined style={{ color: '#fa8c16', fontSize: 14 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#9a3412' }}>
                {language === 'zh-CN' ? '高风险杠杆替代标的' : 'High-Risk Leveraged Alternative'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--app-text-muted)' }}>
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

  // ── Run Auto Pipeline Now (background auto-run, does NOT touch manual state) ──
  const handleRunAutoNow = async () => {
    if (pipelineRunning) {
      message.warning('Manual pipeline is running. Please wait for it to complete.');
      return;
    }
    if (autoRunActive) {
      message.warning('Auto pipeline is already running.');
      return;
    }
    setPipelineAutoLoading(true);
    try {
      // Save current config first so backend uses same settings as scheduler
      const intervalMap: Record<string, number> = { '15m': 15, '30m': 30, '1h': 60, '2h': 120 };
      await pipelineAutoAPI.saveConfig({ enabled: true, intervalMinutes: intervalMap[pipelineSchedule] || 15, mode: pipelineMode, riskProfile, timeHorizon, tradeMode });
      const res = await pipelineAutoAPI.runNow({});
      if (!res?.data?.success) {
        throw new Error(res?.data?.message || res?.data?.error || 'Failed to start auto pipeline');
      }
      console.log('[AutoPipelineNow] started runId=%s using saved config', res.data.runId);
      message.success('Auto pipeline started in background using saved config.');
      fetchPipelineAutoStatus();
    } catch (e: any) {
      console.log('[AutoPipelineNow] failed: %s', e.message);
      message.error(e.message || 'Failed to start auto pipeline');
    } finally {
      setPipelineAutoLoading(false);
    }
  };

  const runAIPipeline = async (opts?: { trigger?: string }) => {
    if (autoRunActive) {
      console.log('[PipelineUI] early return reason=background_auto_run_active');
      message.warning('Background auto-run is active. Please wait for it to complete or stop it first.');
      return;
    }
    if (isAnyScanRunning) {
      console.log('[PipelineUI] early return before start reason=isAnyScanRunning pipelineRunning=%s', pipelineRunning);
      message.warning(t.agent.scanAlreadyRunning);
      return;
    }

    const runTrigger = opts?.trigger || 'manual';
    console.log('[ManualPipeline] start trigger=%s mode=%s risk=%s horizon=%s tradeMode=%s',
      runTrigger, pipelineMode, riskProfile, timeHorizon, tradeMode);

    // Clear all old pipeline result states for a fresh run
    setPipelineRunning(true);
    setPipelineError(null);
    setPipelineStage('Market Scanner');
    setFineScanResults([]);
    setDeeperValidationStatus('idle');
    setDeeperValidationResults(null);
    setEntryPlanResults(null);
    pipelineStopRequestedRef.current = false;

    // Reset all scanner state store sections — clears old STOPPED states, results, progress
    scannerStateStore.resetMarketScanner();
    scannerStateStore.resetContinueScan();
    scannerStateStore.resetFineScan();
    scannerStateStore.resetDeeperValidation();
    scannerStateStore.resetEntryPlan();
    scannerStateStore.resetExitScan();

    const DEFAULT_SCAN_TOTAL = 50;
    scannerStateStore.updateMarketScanner({
      status: 'running' as const,
      progress: 0,
      totalSymbols: DEFAULT_SCAN_TOTAL,
      scannedSymbols: 0,
      detailedScanStatus: {
        currentStatus: 'scanning' as const,
        processedCount: 0,
        totalCount: DEFAULT_SCAN_TOTAL,
        percent: 0,
        activeSymbols: [],
        retryCount: 0,
        validatedCount: 0,
        failedCount: 0,
        lastFailureReason: '',
        lastScanAt: null,
        nextScanAt: null,
        statusMessage: 'Pipeline scanning in progress...',
      },
    });
    console.log('[ManualPipeline] reset complete marketScanner=scanning');

    try {
      // ── Manual Sequential Pipeline: frontend buttons in order ──

      // Step 1: Market Scanner
      console.log('[ManualPipeline] step=market_scanner frontend');
      setPipelineStage('Market Scanner');
      if (pipelineStopRequestedRef.current) throw new Error('STOPPED');
      await startMarketScanner();
      if (pipelineStopRequestedRef.current) { scannerStateStore.updateMarketScanner({ status: 'stopped' }); throw new Error('STOPPED'); }
      console.log('[ManualPipeline] market_scanner completed');

      // Step 2: Continue Scan
      console.log('[ManualPipeline] step=continue_scan frontend');
      setPipelineStage('Continue Scan');
      const continueResults = await processContinueScan();
      if (pipelineStopRequestedRef.current) { scannerStateStore.updateContinueScan({ status: 'idle' }); throw new Error('STOPPED'); }
      console.log('[ManualPipeline] continue_scan completed candidates=%d', continueResults.length);

      // Step 3: Fine Scan
      if (continueResults.length === 0) {
        console.log('[ManualPipeline] step=fine_scan skipped reason=no_continue_candidates');
        scannerStateStore.updateFineScan({ status: 'idle', message: 'No candidates from Continue Scan' });
      } else {
        console.log('[ManualPipeline] step=fine_scan frontend');
        setPipelineStage('Fine Scan');
        await _runFineScanLoop();
        if (pipelineStopRequestedRef.current) { scannerStateStore.updateFineScan({ status: 'stopped', message: 'Stopped by user' }); throw new Error('STOPPED'); }
        console.log('[ManualPipeline] fine_scan completed');
      }

      // Step 4: Deeper Validation
      const dvCandidates = _getValidationCandidatesFromStore();
      if (dvCandidates.length === 0) {
        console.log('[ManualPipeline] step=deeper_validation skipped reason=no_candidates');
        scannerStateStore.updateDeeperValidation({ status: 'idle' });
      } else {
        console.log('[ManualPipeline] step=deeper_validation candidates=%d', dvCandidates.length);
        setPipelineStage('Deeper Validation');
        await _runDeeperValidationLoop(dvCandidates);
        if (pipelineStopRequestedRef.current) { scannerStateStore.updateDeeperValidation({ status: 'stopped' }); throw new Error('STOPPED'); }
        console.log('[ManualPipeline] deeper_validation completed');
      }

      // Step 5: Entry Plan
      const epCandidates = _getEntryPlanCandidatesFromStore();
      if (epCandidates.length === 0) {
        console.log('[ManualPipeline] step=entry_plan skipped reason=no_candidates');
        scannerStateStore.updateEntryPlan({ status: 'idle' });
      } else {
        console.log('[ManualPipeline] step=entry_plan candidates=%d', epCandidates.length);
        setPipelineStage('Entry Plan');
        try {
          await _runEntryPlanLoop(epCandidates);
          if (pipelineStopRequestedRef.current) { scannerStateStore.updateEntryPlan({ status: 'stopped' }); throw new Error('STOPPED'); }
          console.log('[ManualPipeline] entry_plan completed');
        } catch (epErr: any) {
          console.log('[ManualPipeline] entry_plan failed error=%s', epErr.message);
        }
      }

      // Step 6: Exit Scan
      console.log('[ManualPipeline] step=exit_scan frontend');
      setPipelineStage('Exit Scan');
      await runExitScan({ autoSubmit: false }); // Manual Pipeline: preview-only, never submit orders
      if (pipelineStopRequestedRef.current) { scannerStateStore.updateExitScan({ status: 'stopped' }); throw new Error('STOPPED'); }
      console.log('[ManualPipeline] exit_scan completed');

      setPipelineStage('idle');
      console.log('[ManualPipeline] completed trigger=manual (frontend sequential)');
      message.success('Pipeline complete!');
    } catch (e: any) {
      if (e.message === 'STOPPED') {
        setPipelineStage('idle');
        console.log('[ManualPipeline] stopped by user');
        message.info('Pipeline stopped by user');
      } else {
        const msg = e.message || 'Pipeline failed';
        console.log('[ManualPipeline] failed error=%s', msg);
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

  // Persist pipeline mode to localStorage
  useEffect(() => { localStorage.setItem('pipelineMode', pipelineMode); }, [pipelineMode]);

  // Persist pipeline schedule choice to localStorage
  useEffect(() => {
    localStorage.setItem('pipelineSchedule', pipelineSchedule);
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

  const _runDeeperValidationLoop = async (selected: any[]): Promise<any[]> => {
    let _result: any[] = [];
    setDeeperValidationStatus('loading');
    setDeeperValidationResults(null);
    setDvErrorMessage(null);

    // Preflight: check session and AI config
    const preflight = await preflightConfigCheck();
    if (!preflight.ok || !preflight.sessionValid) {
      setDeeperValidationStatus('error');
      unregisterDeeperValidationRun();
      message.error(preflight.error || 'Session expired');
      return _result;
    }
    if (!preflight.aiAvailable) {
      const reason = preflight.aiKeyIsMasked ? 'AI key is invalid (masked). Re-enter in Settings.' :
                     !preflight.aiConfigured ? 'AI Provider not configured. Configure in Settings.' :
                     preflight.aiTestStatus !== 'connected' ? `AI Provider not tested (${preflight.aiTestStatus}). Click Test AI Connection in Settings.` :
                     'AI unavailable';
      setDeeperValidationStatus('error');
      unregisterDeeperValidationRun();
      message.error(reason);
      return _result;
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
        _result = enrichedResults;
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
            _result = enrichedResults;
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
    return _result;
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
    return React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid var(--app-border-soft)', fontSize: '11px' } },
      React.createElement('span', { style: { color: 'var(--app-text-muted)' } }, label),
      React.createElement('span', { style: { fontWeight: 600, color: color || 'var(--app-text-strong)' } }, value != null ? String(value) : t.agent.naLabel)
    );
  }
  
  // Helper: parameter chips
  function paramChips(params: any) {
    if (!params || Object.keys(params).length === 0) return null;
    return React.createElement('div', { style: { display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'flex-end' } },
      Object.entries(params).map(function(kv: any) {
        return React.createElement(Tag, { key: kv[0], style: { fontSize: '9px', margin: 0, padding: '0 4px', background: 'var(--app-table-header-bg)', border: 'none' } }, kv[0] + ': ' + String(kv[1]));
      })
    );
  }
  
  // Helper: card wrapper
  function cardBlock(title: any, children: any, accentColor: any, extra?: any) {
    return React.createElement('div', { style: { background: 'var(--app-card-bg)', border: '1px solid var(--app-border)', borderRadius: 10, padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' } },
      React.createElement('div', { style: { fontWeight: 700, fontSize: '12px', marginBottom: 8, color: accentColor || 'var(--app-text-strong)', borderBottom: '2px solid ' + (accentColor || 'var(--app-border)'), paddingBottom: 6 } }, title),
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
  
  return React.createElement('div', { style: { background: 'var(--app-card-bg-soft)', padding: '16px', borderRadius: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', maxWidth: '100%' } },
    
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
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid var(--app-border-soft)', fontSize: '11px' } },
            React.createElement('span', { style: { color: 'var(--app-text-muted)' } }, t.agent.colParams),
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
            React.createElement('div', { style: { fontSize: '10px', color: 'var(--app-text-muted)', marginBottom: 4 } }, t.agent.topResults + ':'),
            record.top3Results.map(function(r: any, i: number) {
              return React.createElement('div', { key: i, style: { fontSize: '10px', padding: '2px 0', borderBottom: i < record.top3Results.length - 1 ? '1px solid var(--app-border-soft)' : 'none' } },
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
          React.createElement('div', { style: { padding: '6px 8px', background: 'rgba(250, 173, 20, 0.1)', borderRadius: 6, marginBottom: 8, fontSize: '10px', color: '#856404' } },
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
      return React.createElement('div', { style: { gridColumn: '1 / -1', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', fontSize: '8px', color: 'var(--app-text-muted)' } },
        chips.map(function(c: any) {
          return React.createElement('span', { key: c.label, title: c.title, style: { padding: '1px 6px', borderRadius: '3px', background: c.isAI ? 'rgba(19, 194, 194, 0.1)' : 'var(--app-border-soft)', color: c.isAI ? '#13c2c2' : 'var(--app-text-muted)', border: '1px solid ' + (c.isAI ? 'rgba(19, 194, 194, 0.2)' : '#e0e0e0'), whiteSpace: 'nowrap', cursor: 'default' } }, c.label);
        }),
        isLimitedSample ?
          React.createElement(Tag, { color: 'warning', style: { fontSize: '8px', margin: 0, marginLeft: 'auto', padding: '0 4px', lineHeight: '16px' } }, t.agent.limitedSample) : null
      );
    })(),

    // Summary Footer - Compact Status Row
    React.createElement('div', { style: { gridColumn: '1 / -1', background: 'var(--app-card-bg)', border: '1px solid var(--app-border)', borderRadius: 10, padding: '12px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' } },
      React.createElement('div', { style: { flex: 1, minWidth: 0 } },
        reasonParts.length > 0 ?
          React.createElement('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } },
            React.createElement('span', { style: { fontSize: '10px', color: 'var(--app-text-muted)', fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 } }, t.agent.verdictReasons + ':'),
            React.createElement('div', { style: { fontSize: '12px', color: 'var(--app-text)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, title: reasonParts.map(translateDVReason).join(' | ') },
              reasonParts.map(translateDVReason).join(' · ')
            )
          ) :
          React.createElement('div', { style: { fontSize: '12px', color: 'var(--app-text-muted)', fontStyle: 'italic' } },
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
        .premium-card { border-radius: 12px !important; border: 1px solid var(--app-border-soft) !important; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03) !important; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important; }
        .premium-card:hover { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06) !important; transform: translateY(-2px) !important; }
        .status-strip { background: var(--app-card-bg); border-radius: 10px; padding: 12px 20px; border: 1px solid var(--app-border-soft); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
        .stat-box { display: flex; flex-direction: column; gap: 4px; }
        .stat-label { font-size: 11px; color: var(--app-text-muted); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
        .stat-value { font-size: 14px; font-weight: 700; color: var(--app-text-strong); }
        .compact-table .ant-table-thead > tr > th { background: var(--app-table-header-bg) !important; font-size: 11px !important; text-transform: uppercase !important; letter-spacing: 0.3px !important; padding: 10px 8px !important; }
      `}</style>

      {/* ── Page Header ── */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'var(--app-blue-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1890ff', fontSize: 24, border: '1px solid rgba(24, 144, 255, 0.2)', boxShadow: '0 2px 8px rgba(24, 144, 255, 0.1)' }}>
            <RobotOutlined />
          </div>
          <div>
            <Title level={1} style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--app-text-strong)', lineHeight: 1.2 }}>{t.agent.pageTitle}</Title>
            <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>{t.agent.pageSubtitle}</Text>
          </div>
        </div>
        <div>
          <Tag color="success" style={{ margin: 0, padding: '4px 12px', borderRadius: '16px', fontWeight: 700, fontSize: 12, border: '1px solid rgba(82, 196, 26, 0.2)', background: 'rgba(82, 196, 26, 0.1)', color: '#52c41a', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#52c41a', boxShadow: '0 0 4px #52c41a' }} />
            {t.agent.systemOnline}
          </Tag>
        </div>
      </div>

      {/* 1. System Configuration & Status */}
      <div style={{ marginBottom: 20, background: 'var(--app-card-bg)', borderRadius: 12, border: '1px solid var(--app-border-soft)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
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
              {configStatus.loaded ? (configStatus.alpaca ? <Tag color="processing" style={{ margin: 0, borderRadius: 10, fontWeight: 700, fontSize: 10 }}>{t.agent.paper}</Tag> : <Tag color="default" style={{ margin: 0, borderRadius: 10, fontWeight: 700, fontSize: 10 }}>{t.agent.notLinked}</Tag>) : <Spin size="small" />}
            </div>
          </div>
        </div>
        <Button type="text" icon={<SettingOutlined />} onClick={() => navigate('/settings/configuration')} style={{ color: 'var(--app-text-muted)', fontWeight: 600, fontSize: 13, background: 'var(--app-card-bg-soft)', border: '1px solid var(--app-border)', borderRadius: 6, height: 32 }}>
          {t.agent.manageSettings}
        </Button>
      </div>

      {/* 1.5 Trading Account Mode */}
      <div style={{ marginBottom: 20 }}>
        <Card
          className="premium-card"
          bodyStyle={{ padding: '20px 24px' }}
          title={null}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
          
          <div style={{ background: 'var(--app-card-bg-soft)', borderRadius: 10, padding: '16px', border: '1px solid var(--app-border-soft)' }}>
            {tradingAccountLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--app-text-muted)', height: 48 }}>
                <Spin indicator={<LoadingOutlined style={{ fontSize: 18 }} spin />} />
                <span style={{ fontWeight: 500 }}>{t.agent.syncAccountData}</span>
              </div>
            ) : tradingAccountData?.success ? (
              <Row gutter={16}>
                <Col span={6}>
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
                <Col span={6}>
                  <div style={{ padding: '12px 16px', background: 'var(--app-card-bg)', borderRadius: 8, border: '1px solid var(--app-border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{t.agent.portfolioValue}</span>
                    <span style={{ fontWeight: 800, fontSize: 18, color: '#1890ff', fontFamily: "'Inter', sans-serif", letterSpacing: '-0.5px' }}>
                      ${(tradingAccountData.portfolioValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </Col>
                <Col span={6}>
                  <div style={{ padding: '12px 16px', background: 'var(--app-card-bg)', borderRadius: 8, border: '1px solid var(--app-border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{t.agent.cash}</span>
                    <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--app-text-strong)', fontFamily: "'Inter', sans-serif", letterSpacing: '-0.5px' }}>
                      ${(tradingAccountData.cash ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </Col>
                <Col span={6}>
                  <div style={{ padding: '12px 16px', background: 'var(--app-card-bg)', borderRadius: 8, border: '1px solid var(--app-border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{t.agent.buyingPower}</span>
                    <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--app-text-strong)', fontFamily: "'Inter', sans-serif", letterSpacing: '-0.5px' }}>
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
      <div style={{ marginBottom: 24 }}>
        <Card
          className="premium-card"
          bodyStyle={{ padding: 0 }}
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid var(--app-border-soft)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--app-blue-bg)', color: '#1890ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, border: '1px solid rgba(24, 144, 255, 0.2)' }}>
                  <SyncOutlined />
                </div>
                <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--app-text-strong)', letterSpacing: '-0.3px' }}>{t.agent.marketAutoRun}</span>
                <Tag color={pipelineSchedule !== 'off' ? 'green' : 'default'} bordered={false} style={{ fontSize: 11, fontWeight: 800, borderRadius: 6, margin: 0, padding: '2px 8px' }}>
                  {pipelineSchedule !== 'off' ? 'On' : 'Off'}
                </Tag>
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Switch
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

          <div style={{ background: 'var(--app-card-bg-soft)', padding: '16px 20px' }}>
            <Row gutter={32}>
              {/* Left Column: Control */}
              <Col span={8}>
                <div style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Control</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ThunderboltOutlined style={{ color: pipelineSchedule !== 'off' ? '#52c41a' : 'var(--app-text-muted)', fontSize: 14 }} />
                    <span style={{ fontSize: 12, color: 'var(--app-text-muted)', fontWeight: 500 }}>
                      {pipelineSchedule === 'off' ? (
                        'Automation is disabled.'
                      ) : pipelineAutoStatus && !pipelineAutoStatus.marketOpen ? (
                        pipelineAutoStatus.marketStage === 'premarket' ? (
                          <span style={{ color: '#1890ff' }}>Premarket — armed, next run at 09:30 ET.</span>
                        ) : (
                          <span style={{ color: '#faad14' }}>Market closed — armed, waiting for open.</span>
                        )
                      ) : (
                        <span style={{ color: '#52c41a' }}>Active — monitoring during market hours.</span>
                      )}
                    </span>
                  </div>
                  <Tooltip title="Runs one background auto scan without enabling the scheduler. Does not affect manual pipeline sections.">
                    <Button
                      type="primary"
                      ghost
                      icon={<ThunderboltOutlined />}
                      onClick={handleRunAutoNow}
                      disabled={pipelineRunning || autoRunActive || pipelineAutoLoading}
                      loading={pipelineAutoLoading}
                      block
                      style={{
                        borderRadius: 8,
                        height: 36,
                        fontSize: 12,
                        fontWeight: 700,
                        borderColor: pipelineRunning || autoRunActive ? 'var(--app-border)' : '#1890ff',
                        color: pipelineRunning || autoRunActive ? 'var(--app-text-muted)' : '#1890ff',
                      }}
                    >
                      {autoRunActive ? 'Auto Running...' : t.agent.runAutoPipelineNow}
                    </Button>
                  </Tooltip>
                  <div style={{ fontSize: 10, color: 'var(--app-text-muted)', textAlign: 'center' }}>
                    {pipelineSchedule === 'off'
                      ? 'Run once without enabling schedule'
                      : 'Trigger an immediate background scan'}
                  </div>
                </div>
              </Col>

              {/* Middle Column: Schedule */}
              <Col span={8}>
                <div style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>{t.agent.backgroundSchedule}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {(['off', '15m', '30m', '1h', '2h'] as const).map((s) => (
                    <Button key={s}
                      type={pipelineSchedule === s ? 'primary' : 'default'}
                      onClick={() => savePipelineAutoConfig(s)}
                      disabled={pipelineAutoLoading}
                      style={{
                        borderRadius: 8,
                        height: 36,
                        fontSize: 12,
                        fontWeight: pipelineSchedule === s ? 700 : 500,
                        gridColumn: s === 'off' ? '1 / -1' : undefined,
                        background: pipelineSchedule === s ? '#1890ff' : 'var(--app-card-bg)',
                        color: pipelineSchedule === s ? 'var(--app-card-bg)' : 'var(--app-text-muted)',
                        borderColor: pipelineSchedule === s ? '#1890ff' : 'var(--app-border)',
                        boxShadow: pipelineSchedule === s ? '0 2px 6px rgba(24, 144, 255, 0.2)' : 'none'
                      }}
                    >
                      {s === 'off' ? t.agent.scheduleOff : s === '15m' ? t.agent.schedule15m : s === '30m' ? t.agent.schedule30m : s === '1h' ? t.agent.schedule1h : t.agent.schedule2h}
                    </Button>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: 'var(--app-text-muted)', textAlign: 'center', marginTop: 8 }}>
                  {t.agent.scheduleHelperText}
                </div>
                {pipelineSchedule !== 'off' && (
                  <div style={{
                    marginTop: 10, padding: '8px 10px', borderRadius: 6, border: '1px solid',
                    display: 'flex', alignItems: 'center', gap: 8,
                    ...(pipelineAutoStatus?.marketOpen
                      ? { background: 'rgba(82, 196, 26, 0.1)', borderColor: 'rgba(82, 196, 26, 0.2)' }
                      : { background: 'rgba(250, 173, 20, 0.1)', borderColor: 'rgba(250, 173, 20, 0.2)' }
                    )
                  }}>
                    <SyncOutlined spin={autoRunActive} style={{ color: pipelineAutoStatus?.marketOpen ? '#52c41a' : '#faad14', fontSize: 13 }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: pipelineAutoStatus?.marketOpen ? '#237804' : '#8c6d00' }}>
                      {autoRunActive
                        ? `Background auto scan running (${autoRunProgress}%)`
                        : `Scheduled: Every ${pipelineSchedule}${pipelineAutoStatus?.marketOpen ? '' : ' (during market hours only)'}`
                      }
                    </span>
                  </div>
                )}
              </Col>

              {/* Right Column: Status Summary */}
              <Col span={8}>
                <div style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Status Summary</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--app-card-bg)', padding: 14, borderRadius: 10, border: '1px solid var(--app-border-soft)', height: '100%' }}>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 500 }}>{t.agent.autoStatus}</span>
                    {pipelineAutoStatus ? (
                      pipelineAutoStatus.autoStatus === 'Off' ? (
                        <Tag color="default" bordered={false} style={{ margin: 0, fontWeight: 700, fontSize: 10 }}>Off</Tag>
                      ) : pipelineAutoStatus.autoStatus === 'Running' ? (
                        <Tag color="processing" bordered={false} style={{ margin: 0, fontWeight: 700, fontSize: 10 }}>Running</Tag>
                      ) : !pipelineAutoStatus.marketOpen ? (
                        <Tag color={pipelineAutoStatus.marketStage === 'premarket' ? 'blue' : pipelineAutoStatus.marketStatusRaw === 'holiday' ? 'red' : 'orange'} bordered={false} style={{ margin: 0, fontWeight: 700, fontSize: 10 }}>
                          {pipelineAutoStatus.marketStage === 'premarket' ? 'Premarket' : pipelineAutoStatus.marketStatusRaw === 'holiday' ? 'Holiday Closed' : 'Market Closed'}
                        </Tag>
                      ) : (
                        <Tag color="green" bordered={false} style={{ margin: 0, fontWeight: 700, fontSize: 10 }}>Armed</Tag>
                      )
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--app-text-muted)' }}>—</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 500 }}>{t.agent.lastAutoScan}</span>
                    {pipelineAutoStatus?.lastRunAt ? (
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--app-text-strong)' }}>{new Date(pipelineAutoStatus.lastRunAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--app-text-muted)', fontStyle: 'italic' }}>—</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 500 }}>{t.agent.nextAutoScan}</span>
                    {pipelineSchedule === 'off' ? (
                      <span style={{ fontSize: 11, color: 'var(--app-text-muted)', fontStyle: 'italic' }}>{t.agent.disabled}</span>
                    ) : pipelineAutoStatus?.nextAutoRunAt ? (
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1890ff' }}>{new Date(pipelineAutoStatus.nextAutoRunAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    ) : pipelineAutoStatus?.nextAutoRunDisplay ? (
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#52c41a' }}>{pipelineAutoStatus.nextAutoRunDisplay}</span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--app-text-muted)', fontStyle: 'italic' }}>—</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 500 }}>{t.agent.runsToday}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--app-text-strong)' }}>{pipelineAutoStatus?.runCountToday || 0}</span>
                  </div>

                  <Divider style={{ margin: '2px 0', opacity: 0.4 }} />

                  {/* Saved auto-run config (from backend status) */}
                  {pipelineAutoStatus && pipelineSchedule !== 'off' && (
                    <div style={{ background: 'var(--app-card-bg-soft)', borderRadius: 6, padding: '4px 6px', border: '1px solid var(--app-border)', marginBottom: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
                        <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--app-text-muted)', textTransform: 'uppercase' }}>{t.agent.savedConfig}</span>
                        <span style={{ fontSize: 8, color: pipelineAutoStatus.contextSource === 'saved_config' ? '#52c41a' : '#faad14' }}>
                          {pipelineAutoStatus.contextSource === 'saved_config' ? t.agent.customConfig : t.agent.defaultConfig}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 6px', fontSize: 10 }}>
                        <span>{(pipelineAutoStatus.mode || 'hybrid').toUpperCase()}</span>
                        <span>·</span>
                        <span style={{ color: pipelineAutoStatus.riskProfile === 'high' ? '#ff4d4f' : pipelineAutoStatus.riskProfile === 'low' ? '#52c41a' : '#faad14' }}>
                          {pipelineAutoStatus.riskProfile === 'high' ? 'High' : pipelineAutoStatus.riskProfile === 'low' ? 'Low' : 'Med'} risk
                        </span>
                        <span>·</span>
                        <span style={{ color: '#1890ff' }}>{pipelineAutoStatus.timeHorizon === 'short' ? 'Short' : pipelineAutoStatus.timeHorizon === 'long' ? 'Long' : 'Mid'} term</span>
                        <span>·</span>
                        <span style={{ color: pipelineAutoStatus.tradeMode === 'real' ? '#ff4d4f' : 'var(--app-text-muted)' }}>{pipelineAutoStatus.tradeMode === 'real' ? 'Real' : 'Paper'}</span>
                      </div>
                      {pipelineAutoStatus.tradeMode && pipelineAutoStatus.tradeMode !== tradeMode && (
                        <div style={{ fontSize: 8, color: '#ff4d4f', marginTop: 2 }}>
                          {t.agent.savedModeDiffers}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Background auto-run progress */}
                  {autoRunActive && (
                    <div style={{ background: 'rgba(24, 144, 255, 0.1)', border: '1px solid rgba(24, 144, 255, 0.2)', borderRadius: 6, padding: '6px 8px' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#0050b3', marginBottom: 3 }}>
                        <SyncOutlined spin style={{ marginRight: 4 }} />
                        {t.agent.backgroundAutoRun}
                      </div>
                      <div style={{ fontSize: 10, color: '#003a8c' }}>
                        {t.agent.stepLabel}: {autoRunStep.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </div>
                      <div style={{ fontSize: 10, color: '#003a8c' }}>
                        {t.agent.progressLabel}: {autoRunProgress}%
                      </div>
                    </div>
                  )}

                  {/* Recent auto-run summary */}
                  {!autoRunActive && pipelineAutoStatus?.lastAutoSummary?.completedAt && (
                    <div style={{ background: 'var(--app-card-bg-soft)', borderRadius: 6, padding: '6px 8px' }}>
                      <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--app-text-muted)', marginBottom: 3, textTransform: 'uppercase' }}>{t.agent.lastBackgroundScan}</div>
                      <div style={{ fontSize: 10, color: 'var(--app-text-strong)', lineHeight: 1.5 }}>
                        {pipelineAutoStatus.lastAutoSummary.scanned > 0 && (
                          <div>{pipelineAutoStatus.lastAutoSummary.scanned} {t.agent.scannedLabel}, {pipelineAutoStatus.lastAutoSummary.aiSuccess} AI, {(pipelineAutoStatus.lastAutoSummary.scanned || 0) - (pipelineAutoStatus.lastAutoSummary.aiSuccess || 0)} {t.agent.filteredLabel}</div>
                        )}
                        {pipelineAutoStatus.lastAutoSummary.entryPlanCount > 0 && (
                          <div>{t.agent.entryPlan}: {pipelineAutoStatus.lastAutoSummary.entryPlanCount} {t.agent.candidates}</div>
                        )}
                        {pipelineAutoStatus.lastAutoSummary.exitScanCount > 0 && (
                          <div>{t.agent.exitScan}: {pipelineAutoStatus.lastAutoSummary.exitScanCount} {t.agent.positions}</div>
                        )}
                        <div style={{ fontSize: 9, color: 'var(--app-text-muted)', marginTop: 2 }}>
                          {new Date(pipelineAutoStatus.lastAutoSummary.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' · '}{pipelineAutoStatus.lastAutoSummary.durationSeconds || 0}s
                          {' · '}{pipelineAutoStatus.lastAutoSummary.trigger || 'auto'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Col>
            </Row>

            {/* Bottom: Next auto run info */}
            {pipelineSchedule !== 'off' && pipelineAutoStatus && (
              <div style={{ marginTop: 16, background: 'var(--app-card-bg)', border: '1px solid var(--app-border)', borderRadius: 8, padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 500 }}>
                  {!pipelineAutoStatus.marketOpen ? (
                    <>
                      {pipelineAutoStatus.nextMarketOpenAt ? (
                        <>{t.agent.nextAutoRun}: <span style={{ fontWeight: 700, color: '#1890ff' }}>{new Date(pipelineAutoStatus.nextMarketOpenAt).toLocaleString(language === 'zh-CN' ? 'zh-CN' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' })} ET</span></>
                      ) : pipelineAutoStatus.nextMarketOpenDisplay ? (
                        <span style={{ fontWeight: 700, color: '#faad14' }}>{pipelineAutoStatus.nextMarketOpenDisplay}</span>
                      ) : (
                        <span style={{ color: 'var(--app-text-muted)' }}>{t.agent.waitingForNextMarketOpen}</span>
                      )}
                    </>
                  ) : (
                    <>
                      {pipelineAutoStatus.nextAutoRunDisplay === 'Ready' ? (
                        <>{t.agent.nextAutoRun}: <span style={{ fontWeight: 700, color: '#52c41a' }}>{t.agent.ready}</span></>
                      ) : pipelineAutoStatus.nextAutoRunAt ? (
                        <>{t.agent.nextAutoRun}: <span style={{ fontWeight: 700, color: '#1890ff' }}>{new Date(pipelineAutoStatus.nextAutoRunAt).toLocaleTimeString(language === 'zh-CN' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' })}</span></>
                      ) : null}
                    </>
                  )}
                  {pipelineAutoStatus.stoppedForToday && !pipelineAutoStatus.blockedForDay && (
                    <span style={{ display: 'block', fontSize: 10, color: 'var(--app-text-muted)', marginTop: 2 }}>{t.agent.stoppedForToday}</span>
                  )}
                  {pipelineAutoStatus.blockedForDay && (
                    <span style={{ display: 'block', fontSize: 10, color: 'var(--app-text-muted)', marginTop: 2 }}>{t.agent.noTradingToday}</span>
                  )}
                </div>
              </div>
            )}

            {/* Next 15 Days Market Schedule — expandable */}
            {pipelineSchedule !== 'off' && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--app-border)' }}>
                <div
                  onClick={() => setPipelineAutoScheduleExpanded(!pipelineAutoScheduleExpanded)}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--app-text-muted)', userSelect: 'none' }}
                >
                  <span style={{ fontSize: 10 }}>{pipelineAutoScheduleExpanded ? '▼' : '▶'}</span>
                  <span style={{ fontWeight: 600 }}>{t.agent.nextMarketSchedule}</span>
                  {pipelineAutoScheduleLoading && <Spin size="small" style={{ marginLeft: 4 }} />}
                </div>
                {pipelineAutoScheduleExpanded && (
                  <div style={{ marginTop: 8, maxHeight: 320, overflowY: 'auto' }}>
                    {pipelineAutoScheduleError ? (
                      <div style={{ fontSize: 10, color: '#ff4d4f', padding: '8px' }}>
                        {pipelineAutoScheduleError}
                      </div>
                    ) : pipelineAutoSchedule && pipelineAutoSchedule.length > 0 ? (
                      <>
                        {pipelineAutoSchedule.map((day: any, i: number) => {
                          const statusColor = day.status === 'open' ? '#52c41a' :
                                              day.status === 'early_close' ? '#faad14' :
                                              day.status === 'holiday' ? '#ff4d4f' :
                                              day.status === 'weekend' ? 'var(--app-text-muted)' : 'var(--app-text-muted)';
                          const bgColor = i % 2 === 0 ? 'var(--app-card-bg-soft)' : 'transparent';
                          const autoRunText = day.autoRun ? 'Will run' : 'Will not run';
                          const autoRunColor = day.autoRun ? '#52c41a' : 'var(--app-text-muted)';
                          const hours = day.openTime && day.closeTime ? `${day.openTime}–${day.closeTime}` : '—';
                          return (
                            <div key={day.date} style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              padding: '5px 8px', fontSize: 10, lineHeight: '16px',
                              background: bgColor, borderRadius: 4, marginBottom: 2
                            }}>
                              <span style={{ minWidth: 80, fontWeight: 600, color: 'var(--app-text-strong)' }}>
                                {day.weekday?.slice(0, 3)} {day.date?.slice(5)}
                              </span>
                              <Tag bordered={false} style={{ fontSize: 9, margin: 0, lineHeight: '16px', borderRadius: 3, minWidth: 48, textAlign: 'center', background: statusColor + '18', color: statusColor, fontWeight: 700 }}>
                                {day.status === 'early_close' ? 'Early Cls' : day.status === 'open' ? 'Open' : day.status === 'holiday' ? 'Holiday' : day.status === 'weekend' ? 'Weekend' : day.status || '—'}
                              </Tag>
                              <span style={{ color: 'var(--app-text-muted)', minWidth: 58, fontSize: 9 }}>{hours}</span>
                              <span style={{ color: autoRunColor, fontWeight: 600, minWidth: 50, fontSize: 9 }}>{autoRunText}</span>
                              <span style={{ color: 'var(--app-text-muted)', fontSize: 8, minWidth: 40 }}>
                                {day.source === 'alpaca_calendar' ? 'Alpaca' : day.source === 'fallback_basic_hours' ? 'Fallbk' : ''}
                              </span>
                              {day.reason && (
                                <span style={{ color: 'var(--app-text-muted)', fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                  {day.reason}
                                </span>
                              )}
                            </div>
                          );
                        })}
                        <div style={{ fontSize: 9, color: 'var(--app-text-muted)', marginTop: 4, paddingLeft: 8 }}>
                          Source: {pipelineAutoScheduleSource === 'alpaca_calendar' ? 'Alpaca Calendar' : 'Fallback basic hours'} / {pipelineAutoScheduleWarning && <span style={{ color: '#faad14' }}>{pipelineAutoScheduleWarning}</span>}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 10, color: 'var(--app-text-muted)', fontStyle: 'italic', padding: '8px' }}>
                        {pipelineAutoScheduleLoading ? t.agent.loading : t.agent.noScheduleData}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Auto Run History — expandable */}
            {pipelineAutoStatus && pipelineAutoHistory.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--app-border)' }}>
                <div
                  onClick={() => setPipelineAutoHistoryExpanded(!pipelineAutoHistoryExpanded)}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--app-text-muted)', userSelect: 'none' }}
                >
                  <span style={{ fontSize: 10 }}>{pipelineAutoHistoryExpanded ? '▼' : '▶'}</span>
                  <span style={{ fontWeight: 600 }}>{t.agent.recentAutoRuns}</span>
                  <Tag bordered={false} style={{ fontSize: 9, margin: 0, lineHeight: '16px', borderRadius: 4, background: '#f0f2f5', color: 'var(--app-text-muted)' }}>
                    {pipelineAutoHistory.length}
                  </Tag>
                </div>
                {pipelineAutoHistoryExpanded && (
                  <div style={{ marginTop: 8 }}>
                    {pipelineAutoHistory.map((entry: any, i: number) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '4px 8px', fontSize: 10, lineHeight: '18px',
                        background: i % 2 === 0 ? 'var(--app-card-bg-soft)' : 'transparent',
                        borderRadius: 4, marginBottom: 2
                      }}>
                        <Tag bordered={false} style={{ fontSize: 9, margin: 0, lineHeight: '16px', borderRadius: 3, minWidth: 36, textAlign: 'center' }}
                          color={entry.status === 'success' ? 'green' : entry.status === 'failed' ? 'red' : entry.status === 'blocked' ? 'orange' : entry.status === 'skipped' ? 'default' : 'orange'}>
                          {entry.status || '—'}
                        </Tag>
                        <span style={{ color: 'var(--app-text-muted)', minWidth: 50 }}>{entry.trigger_type || '—'}</span>
                        <span style={{ color: 'var(--app-text-muted)' }}>
                          {entry.started_at ? new Date(entry.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </span>
                        <span style={{ color: 'var(--app-text-muted)' }}>
                          {entry.duration_seconds ? `${entry.duration_seconds}s` : '—'}
                        </span>
                        <span style={{ color: 'var(--app-text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entry.reason || entry.error || ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* 1.52 Trading Preferences */}
      <div style={{ marginBottom: 24 }}>
        <Row gutter={20}>
          <Col span={12}>
            <div style={{ background: 'var(--app-card-bg)', borderRadius: 12, border: '1px solid var(--app-border-soft)', padding: '20px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)', height: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <FundOutlined style={{ color: '#722ed1', fontSize: 18 }} />
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--app-text-strong)' }}>{t.agent.riskProfile}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--app-text-muted)', marginBottom: 16, minHeight: 20 }}>
                {t.agent.riskProfileDesc}
              </div>
              <Segmented
                block
                value={riskProfile}
                onChange={handleRiskProfileChange}
                options={[
                  { label: <span style={{ fontWeight: 600, padding: '4px 0' }}>{t.agent.lowRisk}</span>, value: 'low' },
                  { label: <span style={{ fontWeight: 600, padding: '4px 0' }}>{t.agent.mediumRisk}</span>, value: 'medium' },
                  { label: <span style={{ fontWeight: 600, padding: '4px 0' }}>{t.agent.highRisk}</span>, value: 'high' },
                ]}
                style={{ background: 'var(--app-card-bg-soft)', borderRadius: 8, padding: 4 }}
              />
            </div>
          </Col>
          <Col span={12}>
            <div style={{ background: 'var(--app-card-bg)', borderRadius: 12, border: '1px solid var(--app-border-soft)', padding: '20px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)', height: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <ClockCircleOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--app-text-strong)' }}>{t.agent.timeHorizon}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--app-text-muted)', marginBottom: 16, minHeight: 20 }}>
                {t.agent.timeHorizonDesc}
              </div>
              <Segmented
                block
                value={timeHorizon}
                onChange={handleTimeHorizonChange}
                options={[
                  { label: <span style={{ fontWeight: 600, padding: '4px 0' }}>{t.agent.shortTerm}</span>, value: 'short' },
                  { label: <span style={{ fontWeight: 600, padding: '4px 0' }}>{t.agent.midTerm}</span>, value: 'mid' },
                  { label: <span style={{ fontWeight: 600, padding: '4px 0' }}>{t.agent.longTerm}</span>, value: 'long' },
                ]}
                style={{ background: 'var(--app-card-bg-soft)', borderRadius: 8, padding: 4 }}
              />
            </div>
          </Col>
        </Row>
      </div>

      {/* 1.55 AI Auto Pipeline */}
      <div style={{ marginBottom: 24 }}>
        <Card
          className="premium-card"
          bodyStyle={{ padding: 0 }}
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--app-border-soft)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(114, 46, 209, 0.1)', color: '#722ed1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, border: '1px solid rgba(114, 46, 209, 0.2)' }}>
                  <RobotOutlined />
                </div>
                <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--app-text-strong)', letterSpacing: '-0.3px' }}>{t.agent.aiPipeline}</span>
                <Tag color={pipelineMode === 'ai' ? 'purple' : pipelineMode === 'hybrid' ? 'blue' : 'default'} bordered={false} style={{ fontSize: 11, fontWeight: 800, borderRadius: 6, margin: 0, padding: '2px 8px' }}>
                  {pipelineMode === 'ai' ? t.agent.buyAction : pipelineMode === 'hybrid' ? t.agent.modeHybrid : t.agent.skipAction}
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
                      background: 'linear-gradient(135deg, #722ed1 0%, #531dab 100%)', 
                      borderColor: '#722ed1', 
                      color: 'var(--app-card-bg)',
                      height: 36,
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: 13,
                      boxShadow: '0 4px 12px rgba(114, 46, 209, 0.2)'
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

          <div style={{ background: 'var(--app-card-bg-soft)', padding: '16px 20px', borderRadius: 12, border: '1px solid var(--app-border-soft)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{t.agent.aiPipeline} Mode</div>
              <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                {(['ai', 'hybrid', 'manual'] as const).map(m => (
                  <div
                    key={m}
                    onClick={() => { setPipelineMode(m); }}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      border: pipelineMode === m ? (m === 'ai' ? '2px solid #722ed1' : m === 'hybrid' ? '2px solid #1890ff' : '2px solid var(--app-border)') : '1px solid var(--app-border-soft)',
                      background: pipelineMode === m ? (m === 'ai' ? 'var(--app-risk-reward-bg)' : m === 'hybrid' ? 'var(--app-blue-bg)' : 'var(--app-card-bg-soft)') : 'var(--app-card-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      transition: 'all 0.2s',
                      boxShadow: pipelineMode === m ? '0 2px 8px rgba(0,0,0,0.05)' : 'none'
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 14, color: pipelineMode === m ? (m === 'ai' ? '#531dab' : m === 'hybrid' ? '#096dd9' : 'var(--app-text-muted)') : 'var(--app-text-muted)' }}>
                      {m === 'ai' ? t.agent.modeAI : m === 'hybrid' ? t.agent.modeHybrid : t.agent.modeManual}
                    </span>
                    {pipelineMode === m && <CheckCircleFilled style={{ color: m === 'ai' ? '#722ed1' : m === 'hybrid' ? '#1890ff' : 'var(--app-text-muted)', fontSize: 14 }} />}
                  </div>
                ))}
              </div>
            </div>

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

      {/* 1.58 Current Holdings */}
      <div style={{ marginBottom: 24 }}>
        <Card
          className="premium-card"
          bodyStyle={{ padding: 0 }}
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--app-border-soft)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'linear-gradient(135deg, rgba(82, 196, 26, 0.1) 0%, #d9f7be 100%)',
                  color: '#52c41a', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 18,
                  border: '1px solid rgba(82, 196, 26, 0.2)'
                }}>
                  <WalletOutlined />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--app-text-strong)', letterSpacing: '-0.3px' }}>{t.agent.positions}</span>
                    <Tag color="success" bordered={false} style={{ fontSize: 11, fontWeight: 800, borderRadius: 6, margin: 0, padding: '0 8px' }}>
                      {holdings.length}
                    </Tag>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--app-text-muted)', fontWeight: 500 }}>{t.agent.accountOverview}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Tag color={tradeMode === 'paper' ? 'blue' : 'error'} bordered={false} style={{ fontSize: 11, fontWeight: 800, borderRadius: 6, margin: 0, padding: '4px 8px' }}>
                  {tradeMode?.toUpperCase()} TRADING
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
                  expandIconColumnIndex: 0,
                  expandedRowRender: (h: any) => (
                    <div style={{ padding: '16px 24px', background: 'var(--app-card-bg-soft)', borderRadius: 8, margin: '8px 16px', border: '1px solid var(--app-border)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)' }}>
                      <div style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 }}>{t.agent.colPosition} {t.agent.details}</div>
                      <Row gutter={[24, 16]}>
                        {[
                          { label: t.agent.symbol, value: <span style={{ fontWeight: 800 }}>{h.symbol}</span> },
                          { label: t.agent.side, value: <Tag color={h.side === 'short' ? 'red' : 'green'} bordered={false} style={{ margin: 0, fontWeight: 700 }}>{h.side?.toUpperCase() || t.agent.longSide}</Tag> },
                          { label: t.agent.qty, value: h.qty },
                          { label: 'Asset Class', value: h.assetClass || 'us_equity' },
                          { label: t.agent.avgEntry, value: `$${(h.avgEntryPrice || 0).toFixed(2)}` },
                          { label: t.agent.currentPrice, value: `$${(h.currentPrice || 0).toFixed(2)}` },
                          { label: t.agent.marketValue, value: `$${(h.marketValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
                          { label: 'Cost Basis', value: `$${(h.costBasis || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
                          { label: t.agent.plDollar, value: <span style={{ color: (h.unrealizedPL || 0) >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 700 }}>${(h.unrealizedPL || 0).toFixed(2)}</span> },
                          { label: t.agent.plPercent, value: <span style={{ color: (h.unrealizedPLPercent || 0) >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 700 }}>{((h.unrealizedPLPercent || 0) * 100).toFixed(2)}%</span> },
                          { label: 'Exchange', value: h.exchange || 'N/A' },
                        ].map((item, idx) => (
                          <Col span={6} key={idx}>
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
                    render: (t: string) => <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--app-text-strong)', letterSpacing: '-0.3px' }}>{t}</span>
                  },
                  {
                    title: t.agent.qty.toUpperCase(),
                    dataIndex: 'qty', key: 'qty', width: 70, align: 'right' as const,
                    render: (v: number) => <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--app-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{v}</span>
                  },
                  {
                    title: t.agent.avgEntry.toUpperCase(),
                    dataIndex: 'avgEntryPrice', key: 'avgEntry', width: 90, align: 'right' as const,
                    render: (v: number) => <span style={{ fontSize: 13, color: 'var(--app-text-muted)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>${(v || 0).toFixed(2)}</span>
                  },
                  {
                    title: t.agent.colCurrent.toUpperCase(),
                    dataIndex: 'currentPrice', key: 'current', width: 90, align: 'right' as const,
                    render: (v: number) => <span style={{ fontSize: 13, color: 'var(--app-text-muted)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>${(v || 0).toFixed(2)}</span>
                  },
                  {
                    title: t.agent.marketValue.toUpperCase(),
                    dataIndex: 'marketValue', key: 'mktVal', width: 110, align: 'right' as const,
                    render: (v: number) => <span style={{ fontSize: 14, color: 'var(--app-text-strong)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  },
                  {
                    title: t.agent.plDollar.toUpperCase(),
                    dataIndex: 'unrealizedPL', key: 'pl', width: 110, align: 'right' as const,
                    render: (v: number) => <span style={{ color: (v || 0) >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 700, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{(v || 0) >= 0 ? '+' : ''}${(v || 0).toFixed(2)}</span>
                  },
                  {
                    title: t.agent.plPercent.toUpperCase(),
                    dataIndex: 'unrealizedPLPercent', key: 'plpct', width: 100, align: 'right' as const,
                    render: (v: number) => <Tag color={(v || 0) >= 0 ? 'success' : 'error'} bordered={false} style={{ fontWeight: 700, fontSize: 13, margin: 0, padding: '2px 8px', borderRadius: 6, fontVariantNumeric: 'tabular-nums' }}>{(v || 0) >= 0 ? '+' : ''}{((v || 0) * 100).toFixed(2)}%</Tag>
                  },
                  {
                    title: t.agent.sell.toUpperCase(),
                    key: 'sell',
                    width: 120,
                    fixed: 'right' as const,
                    align: 'center' as const,
                    render: (_: any, record: any) => {
                      const sellOrder = openSellOrders.find(o => o.symbol === record.symbol);
                      if (sellOrder) {
                        const orderType = (sellOrder.type || 'market').toUpperCase();
                        const priceStr = sellOrder.limit_price ? ` $${Number(sellOrder.limit_price).toFixed(2)}` : sellOrder.stop_price ? ` $${Number(sellOrder.stop_price).toFixed(2)}` : '';
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                            <Tag color="warning" bordered={false} style={{ fontSize: 10, fontWeight: 700, borderRadius: 4, margin: 0 }}>
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
                          size="small"
                          danger
                          style={{ borderRadius: 6, height: 28, fontSize: 12, fontWeight: 600, border: '1px solid #ff4d4f', color: '#ff4d4f', background: 'transparent' }}
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
          bodyStyle={{ padding: 0 }}
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
                    <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--app-text-strong)', letterSpacing: '-0.3px' }}>{t.agent.executionCandidates}</span>
                    <Tag color="warning" bordered={false} style={{ fontSize: 11, fontWeight: 800, borderRadius: 6, margin: 0, padding: '0 8px' }}>
                      {aiExecutionList.length}
                    </Tag>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--app-text-muted)', fontWeight: 500 }}>{t.agent.aiExecution}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Tag color={tradeMode === 'paper' ? 'blue' : 'error'} bordered={false} style={{ fontSize: 11, fontWeight: 800, borderRadius: 6, margin: 0, padding: '4px 8px' }}>
                  {tradeMode?.toUpperCase()} TRADING
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
                        onOk: () => { setAiExecutionList([]); scannerStateStore.clearAiExecutionCandidates(); }
                      });
                    }} 
                    style={{ fontWeight: 600, fontSize: 13, background: 'rgba(255, 77, 79, 0.1)', border: '1px solid rgba(255, 77, 79, 0.2)', borderRadius: 8, height: 32 }}
                  >
                    Clear
                  </Button>
                ) : (
                  <Button type="text" disabled style={{ fontWeight: 600, fontSize: 13, background: 'var(--app-card-bg-soft)', border: '1px solid var(--app-border)', borderRadius: 8, height: 32 }}>Clear</Button>
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
                  ? (tradeMode === 'paper' ? 'Paper AI mode: approved BUY plans may be submitted automatically. Blocked plans require review.' : 'Live AI mode: approved BUY plans may be submitted automatically. Blocked plans require review.')
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
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--app-text-strong)', marginBottom: 4 }}>No execution candidates</div>
              <div style={{ fontSize: 13, color: 'var(--app-text-muted)', marginBottom: 16 }}>Qualified Entry Plan results will appear here for review or submission.</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                <Tag bordered={false} style={{ margin: 0, color: 'var(--app-text-muted)', background: 'var(--app-card-bg-soft)', borderRadius: 4 }}>Waiting for Entry Plan</Tag>
                <Tag bordered={false} style={{ margin: 0, color: 'var(--app-text-muted)', background: 'var(--app-card-bg-soft)', borderRadius: 4 }}>Risk gate required</Tag>
                <Tag bordered={false} style={{ margin: 0, color: 'var(--app-text-muted)', background: 'var(--app-card-bg-soft)', borderRadius: 4 }}>Auto-submit protected</Tag>
              </div>
            </div>
          ) : (
            <div className="execution-table-container" style={{ width: '100%', overflowX: 'auto' }}>
              <style>{`
                .execution-table .ant-table-thead > tr > th { 
                  background: var(--app-card-bg-soft) !important; 
                  padding: 12px 16px !important; 
                  color: var(--app-text-muted) !important;
                  font-weight: 700 !important;
                  font-size: 11px !important;
                  letter-spacing: 0.5px !important;
                  border-bottom: 1px solid var(--app-border-soft) !important;
                }
                .execution-table .ant-table-tbody > tr > td { padding: 12px 16px !important; border-bottom: 1px solid var(--app-border-soft) !important; }
                .execution-row:hover > td { background-color: rgba(82, 196, 26, 0.1) !important; }
                .execution-row-expanded > td { background-color: var(--app-card-bg-soft) !important; }
                .execution-log-row > td { padding: 8px 12px !important; border-bottom: 1px solid var(--app-border-soft) !important; }
                .ant-table-fixed-right { background: var(--app-card-bg) !important; }
              `}</style>
              <Table
                className="execution-table"
                dataSource={aiExecutionList}
                rowKey={(r: any) => r.symbol + (r.addedAt || '')}
                size="middle"
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
                  title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colSymbol}</span>,
                  dataIndex: 'symbol',
                  key: 'symbol',
                  width: 90,
                  fixed: 'left' as const,
                  render: (text: string) => (
                    <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--app-text-strong)', letterSpacing: '-0.2px' }}>{text}</span>
                  ),
                },
                {
                  title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.setup}</span>,
                  key: 'setup',
                  width: 120,
                  render: (r: any) => {
                    const s = r.setup || r.setupType || 'N/A';
                    const color = s.includes('Pullback') ? 'gold' : s.includes('Breakout') ? 'purple' : s.includes('Range') ? 'green' : 'blue';
                    return <Tag color={color} style={{ fontSize: 9, fontWeight: 700, borderRadius: 4 }}>{s.toUpperCase()}</Tag>;
                  },
                },
                {
                  title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.entryZone}</span>,
                  key: 'entryZone',
                  width: 140,
                  render: (r: any) => {
                    const lo = r.entryZoneLow;
                    const hi = r.entryZoneHigh;
                    if (!lo && !hi) return <span style={{ color: '#d1d5db' }}>—</span>;
                    return <span style={{ fontSize: 12, color: 'var(--app-text-strong)', fontWeight: 600 }}>${(lo || 0).toFixed(2)} – ${(hi || 0).toFixed(2)}</span>;
                  },
                },
                {
                  title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colStop} / {t.agent.colTargets}</span>,
                  key: 'levels',
                  width: 130,
                  render: (r: any) => (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ color: 'rgba(239, 68, 68, 0.8)', fontSize: 11, fontWeight: 700 }}>S: ${(r.stopLoss || 0).toFixed(2)}</span>
                      <span style={{ color: '#10b981', fontSize: 11, fontWeight: 700 }}>T: ${(r.takeProfit1 || 0).toFixed(2)}</span>
                    </div>
                  )
                },
                {
                  title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.riskReward}</span>,
                  dataIndex: 'riskReward1',
                  key: 'riskReward1',
                  width: 65,
                  render: (v: number | null) => v ? <span style={{ fontWeight: 700, color: v >= 2 ? '#10b981' : 'var(--app-text-muted)', fontSize: 12 }}>{v.toFixed(1)}x</span> : <span style={{ color: '#d1d5db' }}>—</span>,
                },
                {
                  title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colAIDecision} / {t.agent.colGate}</span>,
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
                  title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.recommendation}</span>,
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

          const labelStyle: React.CSSProperties = { color: 'var(--app-text-muted)', fontSize: 12, marginBottom: 2 };
          const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 };
          const RO = ({ label, value, color }: { label: string; value: any; color?: string }) => (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12 }}>
              <span style={{ color: 'var(--app-text-muted)' }}>{label}</span>
              <span style={{ fontWeight: 600, color: color || 'var(--app-text-strong)' }}>{safeRender(value)}</span>
            </div>
          );

          return (
            <div>
              {/* Read-only info */}
              <div style={{ background: 'rgba(82, 196, 26, 0.1)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 16 }}>{r.symbol}</span>
                <Space size={8}>
                  <Tag color="blue" style={{ margin: 0 }}>BUY</Tag>
                  <Tag color={isReal ? 'red' : 'blue'} style={{ margin: 0 }}>{isReal ? 'LIVE' : 'PAPER'}</Tag>
                </Space>
              </div>

              {recShares > 0 && (
                <div style={{ background: 'rgba(24, 144, 255, 0.1)', borderRadius: 6, padding: '4px 10px', marginBottom: 12, fontSize: 11, color: '#1890ff' }}>
                  {t.agent.entryPlanRecommends} <strong>{recShares} {t.agent.shares}</strong>
                </div>
              )}

              {/* Editable order params */}
              <div style={{ background: 'var(--app-card-bg-soft)', borderRadius: 8, padding: 16, marginBottom: 12 }}>
                {/* Choose how to buy: Shares / Dollars */}
                <div style={rowStyle}>
                  <span style={labelStyle}>{t.agent.buyBy}</span>
                  <select
                    value={modalQtyMode}
                    onChange={e => setModalQtyMode(e.target.value as 'shares' | 'dollars')}
                    style={{ fontSize: 12, height: 28, border: '1px solid var(--app-border)', borderRadius: 4, padding: '0 8px', background: 'var(--app-card-bg)', width: 150 }}
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
                    style={{ fontSize: 12, height: 28, border: '1px solid var(--app-border)', borderRadius: 4, padding: '0 8px', background: 'var(--app-card-bg)', width: 150 }}
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
                    style={{ fontSize: 12, height: 28, border: '1px solid var(--app-border)', borderRadius: 4, padding: '0 8px', background: 'var(--app-card-bg)', width: 150 }}
                  >
                    <option value="day">{t.agent.day}</option>
                    <option value="gtc">{t.agent.gtcLabel}</option>
                    <option value="ioc">{t.agent.iocLabel}</option>
                    <option value="fok">{t.agent.fokLabel}</option>
                  </select>
                </div>
              </div>

              {/* Summary */}
              <div style={{ background: 'var(--app-card-bg-soft)', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 12 }}>
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
              <div style={{ background: 'rgba(255, 77, 79, 0.1)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{t.agent.cancelOrderConfirm}</div>
                <div style={{ fontSize: 12, color: 'var(--app-text-muted)' }}>
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
          bodyStyle={{ padding: 0 }}
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
                    <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--app-text-strong)', letterSpacing: '-0.3px' }}>{t.agent.aiWatchlist}</span>
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
                    Clear
                  </Button>
                )}
              </div>
            </div>
          }
        >
          {aiWatchlistItems.length > 0 && (
            <div style={{ 
              display: 'flex', gap: 12, padding: '16px 20px', 
              background: 'var(--app-card-bg-soft)', borderBottom: '1px solid var(--app-border-soft)' 
            }}>
              {[
                { label: t.agent.total, value: aiWatchlistItems.length, color: 'var(--app-text-strong)', icon: <EyeOutlined /> },
                { label: t.agent.waitingEntry, value: aiWatchlistItems.filter(i => getWatchlistReadiness(i) === 'Waiting Entry').length, color: '#d97706', icon: <ClockCircleOutlined /> },
                { label: t.agent.reviewRequired, value: aiWatchlistItems.filter(i => i.riskGateStatus === 'REVIEW').length, color: '#2563eb', icon: <ExclamationCircleOutlined /> },
                { label: t.agent.readyOrHot, value: aiWatchlistItems.filter(i => getWatchlistReadiness(i) === 'Ready').length, color: '#059669', icon: <ThunderboltOutlined /> }
              ].map((stat, idx) => (
                <React.Fragment key={stat.label}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ 
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
                  {idx < 3 && <Divider type="vertical" style={{ height: 32, margin: 0, borderColor: '#e2e8f0' }} />}
                </React.Fragment>
              ))}
              <div style={{ marginLeft: 'auto', alignSelf: 'center' }}>
                <Tag color="blue" bordered={false} style={{ fontSize: 9, margin: 0, fontWeight: 700, borderRadius: 4 }}>{t.agent.alpacaRealTimeFeed}</Tag>
              </div>
            </div>
          )}

          {aiWatchlistItems.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', background: 'var(--app-card-bg)' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--app-card-bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: '1px dashed var(--app-border)' }}>
                <EyeOutlined style={{ fontSize: 20, color: 'var(--app-text-muted)' }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--app-text-strong)', marginBottom: 4 }}>No watchlist candidates yet</div>
              <div style={{ fontSize: 13, color: 'var(--app-text-muted)', marginBottom: 16 }}>Watch candidates from Entry Plan will appear here for automated entry monitoring.</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                <Tag bordered={false} style={{ margin: 0, color: 'var(--app-text-muted)', background: 'var(--app-card-bg-soft)', borderRadius: 4 }}>Waiting for Entry Plan</Tag>
                <Tag bordered={false} style={{ margin: 0, color: 'var(--app-text-muted)', background: 'var(--app-card-bg-soft)', borderRadius: 4 }}>Entry zone monitoring</Tag>
                <Tag bordered={false} style={{ margin: 0, color: 'var(--app-text-muted)', background: 'var(--app-card-bg-soft)', borderRadius: 4 }}>Alerts ready</Tag>
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
                        <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--app-text-strong)', letterSpacing: '-0.2px' }}>{text}</span>
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
                      const c = record.changePercent;
                      if (c == null) return <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>;
                      const color = c >= 0 ? '#10b981' : '#ef4444';
                      return <span style={{ color, fontSize: 13, fontWeight: 800 }}>{c >= 0 ? '+' : ''}{c.toFixed(2)}%</span>;
                    },
                  },
                  {
                    title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 11, textTransform: 'uppercase' }}>{t.agent.colEntryZone}</span>,
                    key: 'entryZone',
                    width: 150,
                    render: (record: any) => {
                      const lo = record.entryZoneLow;
                      const hi = record.entryZoneHigh;
                      if (!lo && !hi) return <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>;
                      return <span style={{ fontSize: 13, color: 'var(--app-text-strong)', fontWeight: 600, fontFamily: 'Inter' }}>${(lo || 0).toFixed(2)} – ${(hi || 0).toFixed(2)}</span>;
                    },
                  },
                  {
                    title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 11, textTransform: 'uppercase' }}>{t.agent.stopTarget}</span>,
                    key: 'levels',
                    width: 140,
                    render: (record: any) => (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ color: 'rgba(239, 68, 68, 0.8)', fontSize: 12, fontWeight: 600 }}>S: ${(record.stopLoss || 0).toFixed(2)}</span>
                        <span style={{ color: '#10b981', fontSize: 12, fontWeight: 600 }}>T: ${(record.takeProfit1 || 0).toFixed(2)}</span>
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
          { label: t.agent.aiSuccessLabel, value: marketScannerResults.filter((r: any) => r.aiCalled && r.analysisStatus !== 'failed').length, color: '#1890ff' },
          { label: t.agent.localRules, value: marketScannerResults.filter((r: any) => !r.aiCalled && r.analysisStatus !== 'failed').length },
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
                         detailedScanStatus.currentStatus === 'stopped' || detailedScanStatus.currentStatus === 'stopping' ? '#faad14' : 'var(--app-text-muted)'
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
                  ? `${marketScannerResults.filter((r: any) => r.aiCalled && r.analysisStatus !== 'failed').length} AI · ${marketScannerResults.filter((r: any) => !r.aiCalled && r.analysisStatus !== 'failed').length} ${t.agent.localRules}${marketScannerResults.filter((r: any) => r.analysisStatus === 'failed').length > 0 ? ` · ${marketScannerResults.filter((r: any) => r.analysisStatus === 'failed').length} ${t.agent.needDataLabel.replace(':', '')}` : ''}`
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
              background: 'var(--app-card-bg-soft)', 
              borderRadius: 8, 
              border: '1px solid var(--app-border-soft)' 
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                marginBottom: 12
              }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                    {detailedScanStatus.currentStatus === 'scanning' ? t.agent.scanningInProgress :
                     detailedScanStatus.currentStatus === 'stopped' ? t.agent.scanStopped :
                     detailedScanStatus.currentStatus === 'completed' ? t.agent.scanCompleted :
                     detailedScanStatus.currentStatus === 'error' ? t.agent.scanError : t.agent.waitingForNextScan}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--app-text-strong)', lineHeight: 1.2 }}>
                    {detailedScanStatus.percent}% <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--app-text-muted)' }}>{t.agent.complete}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, color: 'var(--app-text-muted)', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{detailedScanStatus.processedCount}</span> / {detailedScanStatus.totalCount} {t.agent.symbolsProcessed}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--app-text-muted)' }}>
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
                  color: 'var(--app-text-muted)'
                }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1890ff', margin: 'auto' }} />
                  </div>
                  <Text strong style={{ color: 'var(--app-text-strong)' }}>{t.agent.currentlyScanning}:</Text>
                  {detailedScanStatus.activeSymbols.map(sym => (
                    <Tag key={sym} color="blue" bordered={false} style={{ margin: 0 }}>{sym}</Tag>
                  ))}
                  {detailedScanStatus.statusMessage && (
                    <span style={{ color: 'var(--app-text-muted)', marginLeft: 'auto' }}>{detailedScanStatus.statusMessage}</span>
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
                border: '1px solid var(--app-border-soft)',
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--app-border-soft)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <Text strong style={{ fontSize: '15px' }}>{t.agent.topMarketTrends} <span style={{ color: 'var(--app-text-muted)', fontWeight: 'normal', fontSize: '13px' }}>({getFilteredAndSortedResults().length})</span></Text>
                  
                  <div className="agent-trend-tabs-container">
                    {[
                      { value: 'all', label: t.agent.all },
                      { value: 'strong', label: t.agent.strong },
                      { value: 'bullish', label: t.agent.bullish },
                      { value: 'neutral', label: t.agent.neutral },
                      { value: 'bearish', label: t.agent.bearish }
                    ].map(tab => {
                      const isActive = marketScannerFilters.trendFilter === tab.value;
                      return (
                        <div
                          key={tab.value}
                          onClick={() => setMarketScannerFilters(prev => ({ ...prev, trendFilter: tab.value as any }))}
                          className={`agent-trend-tab ${isActive ? 'agent-trend-tab-active' : 'agent-trend-tab-inactive'}`}
                        >
                          {tab.label}
                        </div>
                      );
                    })}
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
                              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--app-text-muted)' }}>—</span>
                              <span style={{ fontSize: '10px', color: 'var(--app-text-muted)' }}>{t.agent.confidence}: —</span>
                            </div>
                            <Progress percent={0} size="small" strokeColor="var(--app-border)" showInfo={false} style={{ margin: 0 }} />
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
                            <span style={{ fontSize: '10px', color: 'var(--app-text-muted)' }}>{t.agent.confidence}: {conf}%</span>
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
                      const changeColor = changePct != null ? (changePct >= 0 ? '#52c41a' : '#ff4d4f') : 'var(--app-text-muted)';
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
                            backgroundColor: changePct != null ? `${changeColor}10` : 'var(--app-card-bg-soft)',
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
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--app-text-strong)' }}>
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
                                color: 'var(--app-text-muted)',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'var(--app-card-bg-soft)',
                                border: '1px solid var(--app-border)'
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
                      const _hasNews = record.hasNews || (record.newsCount > 0) || !!record.topNews;
                      const _src = record.newsSource || (record.dataSources?.news) || '';
                      const _reason = record.newsFetchReason || '';
                      const _isNoNews = _reason === 'no_news_last_7d' || _src.toLowerCase().includes('no news in 7d');
                      const _isError = _reason === 'finnhub_news_api_failed' || _src.toLowerCase().includes('error') && !_src.toLowerCase().includes('no news');
                      const _isRateLimited = _reason === 'finnhub_rate_limited' || _src.toLowerCase().includes('rate limit');
                      const _isNotConfigured = _reason === 'finnhub_not_configured' || _src.toLowerCase().includes('not configured');
                      const _isSkipped = _reason === 'news_fetch_skipped_top_n_limit' || _src.toLowerCase().includes('below top candidate');
                      const _visibleCount = Array.isArray(record.allNews) ? Math.min(record.allNews.length, 5) : record.topNews ? 1 : (record.newsCount > 0 && record.newsCount <= 5) ? record.newsCount : 0;
                      const _countLabel = _visibleCount > 0 ? ` · ${_visibleCount}` : '';

                      let line1Label: string, line1Color: string;
                      if (_hasNews) { line1Label = `Finnhub${_countLabel}`; line1Color = '#3b82f6'; }
                      else if (_isRateLimited) { line1Label = 'News limited'; line1Color = '#fbbf24'; }
                      else if (_isNoNews) { line1Label = 'No news'; line1Color = 'var(--app-text-muted)'; }
                      else if (_isError) { line1Label = 'News error'; line1Color = '#ff4d4f'; }
                      else if (_isNotConfigured) { line1Label = 'No key'; line1Color = 'var(--app-text-muted)'; }
                      else if (_isSkipped) { line1Label = 'Open to fetch'; line1Color = 'var(--app-text-muted)'; }
                      else { line1Label = 'Unknown'; line1Color = 'var(--app-text-muted)'; }

                      const sentimentMap: Record<string, string> = { 'Positive': 'Positive', 'Negative': 'Negative', 'Mixed': 'Mixed' };
                      let line2Label: string, line2Color: string;
                      const _sentLabel = sentimentMap[sentiment] || '';
                      if (_sentLabel) { line2Label = _sentLabel; line2Color = _sentLabel === 'Positive' ? '#4ade80' : _sentLabel === 'Negative' ? '#ef4444' : '#fbbf24'; }
                      else if (_hasNews || _isSkipped) { line2Label = 'Sent. pending'; line2Color = 'var(--app-text-muted)'; }
                      else if (_isRateLimited || _isNoNews || _isError) { line2Label = 'Technical only'; line2Color = 'var(--app-text-muted)'; }
                      else if (_isNotConfigured) { line2Label = 'No data'; line2Color = 'var(--app-text-muted)'; }
                      else { line2Label = 'Sent. N/A'; line2Color = 'var(--app-text-muted)'; }

                      return (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: line1Color }}>{line1Label}</span>
                          </div>
                          <div style={{ fontSize: '10px', color: line2Color, marginTop: 2, fontWeight: 500 }}>{line2Label}</div>
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
                          <div style={{ fontSize: '10px', color: 'var(--app-text-muted)', marginTop: 2 }}>
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
                    ellipsis: { showTitle: false },
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
                      style={{ padding: 0, width: 24, height: 24, color: 'var(--app-text-muted)' }}
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
              <div style={{ fontSize: '14px' }}>
                {marketScannerStatus.status === 'completed'
                  ? 'No qualified candidates / all filtered'
                  : t.agent.noMarketScanResults}
              </div>
              <div style={{ fontSize: '12px', marginTop: 8 }}>
                {marketScannerStatus.status === 'completed'
                  ? `${detailedScanStatus.processedCount} symbols scanned, 0 passed filters`
                  : t.agent.clickRunScanner}
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
        <Card style={{ marginBottom: 16, borderRadius: '12px', border: '1px solid var(--app-border-soft)' }} bodyStyle={{ padding: '20px' }}>
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
                  <span style={{ color: 'var(--app-text-muted)', margin: '0 4px' }}>/</span>
                  <span style={{ color: '#faad14' }}>{preferredContinueScanList.filter(c => (c.eventRisk || 'Medium') === 'Medium').length}</span>
                  <span style={{ color: 'var(--app-text-muted)', margin: '0 4px' }}>/</span>
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
              <div style={{ fontSize: '12px', color: 'var(--app-text-muted)', marginTop: '8px' }}>
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
                    backgroundColor: 'var(--app-card-bg-soft)', border: '1px solid rgba(82, 196, 26, 0.3)', 
                    padding: '12px 16px', 
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '16px'
                  }}>
                    <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '20px' }} />
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--app-text-strong)', fontSize: '14px' }}>
                        {t.agent.selectionSuccessful}
                      </div>
                      <div style={{ color: 'var(--app-text-muted)', fontSize: '12px' }}>
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
                    onRow={(record) => ({
                      onClick: () => toggleRowExpand(record.symbol),
                      style: { cursor: 'pointer' }
                    })}
                    rowClassName={(record) => expandedRows.includes(record.symbol) ? 'continue-scan-row-expanded' : 'continue-scan-row'}
                    expandable={{
                      expandedRowKeys: expandedRows,
                      expandIcon: () => null,
                      rowExpandable: () => true,
                      expandedRowRender: (record: any) => (
                        <div style={{ padding: '16px 24px', background: 'var(--app-card-bg-soft)', borderRadius: 8, margin: '8px 16px', border: '1px solid var(--app-border)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)' }}>
                          <Row gutter={[24, 24]}>
                            <Col span={14}>
                              <div style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Selection Reason</div>
                              <div style={{ fontSize: 13, color: 'var(--app-text-strong)', lineHeight: 1.6, background: 'var(--app-card-bg)', padding: 12, borderRadius: 6, border: '1px solid var(--app-border-soft)' }}>
                                {record.selectionReason || record.scannerReason || record.finalReason || 'No detailed reason provided.'}
                              </div>
                              {record.nextStep && (
                                <div style={{ marginTop: 12 }}>
                                  <div style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Next Step Readiness</div>
                                  <div style={{ fontSize: 13, color: '#1890ff', fontWeight: 600 }}>{record.nextStep}</div>
                                </div>
                              )}
                            </Col>
                            <Col span={10}>
                              <div style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Metrics Summary</div>
                              <div style={{ background: 'var(--app-card-bg)', padding: 12, borderRadius: 6, border: '1px solid var(--app-border-soft)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--app-text-muted)', fontSize: 12 }}>Source</span> <Tag color={record.reasonSource === 'AI' ? 'cyan' : 'orange'} style={{ margin: 0, fontWeight: 700 }}>{record.reasonSource === 'AI' ? 'AI Agent' : 'Local Rules'}</Tag></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--app-text-muted)', fontSize: 12 }}>Score</span> <span style={{ fontWeight: 700, color: 'var(--app-text-strong)' }}>{record.overallScore || record.trendScore || '—'}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--app-text-muted)', fontSize: 12 }}>Trend</span> <span style={{ fontWeight: 700 }}>{record.trendLabel || '—'}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--app-text-muted)', fontSize: 12 }}>Risk</span> <span style={{ fontWeight: 700, color: record.eventRisk === 'Low' ? '#52c41a' : record.eventRisk === 'High' ? '#ff4d4f' : '#faad14' }}>{record.eventRisk || 'Medium'}</span></div>
                              </div>
                            </Col>
                          </Row>
                        </div>
                      )
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
                              color: isTop ? 'var(--app-card-bg)' : 'var(--app-text-muted)',
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
                              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--app-text-strong)' }}>{score > 0 ? score.toFixed(0) : '—'}</span>
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
                              <div style={{ fontWeight: 700, marginBottom: 4, borderBottom: '1px solid var(--app-border-soft)', paddingBottom: 2 }}>{t.agent.scoreBreakdown}</div>
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
                                  <span style={{ color: 'var(--app-text-muted)', fontWeight: 600 }}>{t.agent.weight}</span>
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
                                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--app-text-muted)' }}>{dq}</span>
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
                        <span style={{ fontSize: '12px', color: 'var(--app-text-muted)' }}>
                          {t.agent.displaying} <strong>{range[0]}-{range[1]}</strong> {t.agent.of} <strong>{total}</strong> {t.agent.candidatesWord}
                        </span>
                      )}
                      onChange={(page) => setPreferredContinuePage(page)}
                    />
                  </div>

                  <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--app-border-soft)' }}>
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
        <Card bodyStyle={{ padding: '24px' }} style={{ borderRadius: '12px', border: '1px solid var(--app-border-soft)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          {/* Header Summary Row */}
          <div className="fine-scan-header-summary" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '24px', 
            marginBottom: '24px', 
            padding: '12px 20px', 
            backgroundColor: 'var(--app-card-bg-soft)', 
            borderRadius: '10px',
            border: '1px solid var(--app-border-soft)'
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
                    <span style={{ color: 'var(--app-text-muted)', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.agent.candidatesLabel}</span>
                    <span style={{ fontWeight: 800, color: 'var(--app-text-strong)', fontSize: '18px' }}>{total}</span>
                  </div>
                  <Divider type="vertical" style={{ height: '24px', backgroundColor: 'var(--app-border)' }} />
                  <div className="fine-scan-stat-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--app-text-muted)', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase' }}>{t.agent.continueLabel}</span>
                    <Tag color="success" style={{ fontWeight: 800, margin: 0, fontSize: '14px', padding: '0 10px', borderRadius: '4px', lineHeight: '24px' }}>{contCount}</Tag>
                  </div>
                  <Divider type="vertical" style={{ height: '24px' }} />
                  <div className="fine-scan-stat-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--app-text-muted)', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase' }}>{t.agent.watchLabel}</span>
                    <Tag color="warning" style={{ fontWeight: 800, margin: 0, fontSize: '14px', padding: '0 10px', borderRadius: '4px', lineHeight: '24px' }}>{watchCount}</Tag>
                  </div>
                  <Divider type="vertical" style={{ height: '24px' }} />
                  <div className="fine-scan-stat-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--app-text-muted)', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase' }}>{t.agent.rejectLabel}</span>
                    <Tag color="error" style={{ fontWeight: 800, margin: 0, fontSize: '14px', padding: '0 10px', borderRadius: '4px', lineHeight: '24px' }}>{rejectCount}</Tag>
                  </div>
                  <Divider type="vertical" style={{ height: '24px' }} />
                  <div className="fine-scan-stat-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--app-text-muted)', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase' }}>{t.agent.needDataLabel}</span>
                    <Tag color="orange" style={{ fontWeight: 800, margin: 0, fontSize: '14px', padding: '0 10px', borderRadius: '4px', lineHeight: '24px' }}>{needDataCount}</Tag>
                  </div>
                  <Divider type="vertical" style={{ height: '24px' }} />
                  <div className="fine-scan-stat-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                    <span style={{ color: 'var(--app-text-muted)', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase' }}>{t.agent.aiAgentLabel}</span>
                    <Tag color="cyan" style={{ fontWeight: 800, margin: 0, fontSize: '13px', padding: '0 10px', borderRadius: '4px', lineHeight: '24px', letterSpacing: '0.5px' }}>DEEPSEEK V3</Tag>
                  </div>
                </>
              );
            })() : (
              <div style={{ color: 'var(--app-text-muted)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 500 }}>
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
              background: 'var(--app-card-bg-soft)', 
              borderRadius: '12px', 
              border: '1px solid var(--app-border-soft)',
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
                  <div style={{ fontSize: '11px', color: 'var(--app-text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700, marginTop: 4 }}>
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
                color: var(--app-text-strong);
                background: var(--app-card-bg-soft) !important;
                padding: 14px 16px !important;
                border-bottom: 2px solid #e1e4e8;
                text-transform: uppercase;
                letter-spacing: 0.4px;
              }
              .fine-scan-table .ant-table-tbody > tr > td {
                padding: 12px 16px !important;
                font-size: 13px;
                color: var(--app-text-muted);
              }
              .fine-scan-table .ant-table-tbody > tr:hover > td {
                background: var(--app-card-bg-soft) !important;
              }
              .fine-scan-table .ant-table-row {
                height: 52px;
              }
              .fine-scan-table .ant-table-expanded-row > td {
                background: var(--app-card-bg) !important;
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
                expandIcon: () => null,
                onExpand: (expanded: any, record: any) => {
                  if (expanded) {
                    setFineScanExpandedRows((prev: any) => [...prev, record.symbol]);
                  } else {
                    setFineScanExpandedRows((prev: any) => prev.filter((s: any) => s !== record.symbol));
                  }
                }
              }}
              onRow={(record) => ({
                onClick: (e) => {
                  if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) return;
                  const isExpanded = fineScanExpandedRows.includes(record.symbol);
                  if (isExpanded) {
                    setFineScanExpandedRows((prev: any) => prev.filter((s: any) => s !== record.symbol));
                  } else {
                    setFineScanExpandedRows((prev: any) => [...prev, record.symbol]);
                  }
                },
                style: { cursor: 'pointer' }
              })}
              rowClassName={(record) => fineScanExpandedRows.includes(record.symbol) ? 'fine-scan-row-expanded' : 'fine-scan-row'}
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
                          <span style={{ fontSize: '10px', color: 'var(--app-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{sourceLabel}</span>
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
                    const color = d === 'Continue' ? '#52c41a' : d === 'Reject' ? '#ff4d4f' : 'var(--app-text-muted)';
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
                        <div style={{ width: 48, height: 6, background: 'var(--app-table-header-bg)', borderRadius: 3, overflow: 'hidden' }}>
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
                        <span style={{ fontSize: '12px', color: 'var(--app-text-muted)', lineHeight: '1.5', fontWeight: 600 }}>
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
                          <span style={{ color: 'var(--app-text-muted)', fontWeight: 500 }}>{t.agent.backtestLabelShort}</span>
                          <span style={{ color: pc, fontWeight: 700 }}>{pl}</span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--app-text-muted)', fontWeight: 500 }}>{t.agent.optLabelShort}</span>
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
                        <Text style={{ fontSize: '12px', color: 'var(--app-text)', lineHeight: '1.5', fontWeight: 500 }}>
                          {truncated || '-'}
                          <span style={{ fontSize: '11px', color: 'var(--app-text-muted)', marginLeft: '4px' }}>
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
                    <Text style={{ fontSize: '14px', color: 'var(--app-text-strong)', fontWeight: 800, fontFamily: "'Inter', sans-serif" }}>
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
          <Card bodyStyle={{ padding: '20px' }} style={{ borderRadius: '12px', border: '1px solid var(--app-border-soft)' }}>
            {/* Header Summary Row */}
            <div className="validation-header-summary">
              {deeperValidationResults ? (
                <>
                  <div className="validation-stat-item">
                    <span style={{ color: 'var(--app-text-muted)', fontWeight: 600 }}>{t.agent.candidatesLabel.replace(':', '')}:</span>
                    <span style={{ fontWeight: 800, color: 'var(--app-text-strong)' }}>{deeperValidationResults.length}</span>
                  </div>
                  <Divider type="vertical" />
                  <div className="validation-stat-item">
                    <span style={{ color: 'var(--app-text-muted)', fontWeight: 600 }}>{t.agent.riskGatePass}:</span>
                    <Tag color="success" style={{ fontWeight: 800, margin: 0 }}>
                      {deeperValidationResults.filter((r: any) => r.riskGate?.status === 'PASS').length}
                    </Tag>
                  </div>
                  <Divider type="vertical" />
                  <div className="validation-stat-item">
                    <span style={{ color: 'var(--app-text-muted)', fontWeight: 600 }}>{t.agent.confirmed}:</span>
                    <Tag color="processing" style={{ fontWeight: 800, margin: 0 }}>
                      {deeperValidationResults.filter((r: any) => r.verdict === 'Confirmed' || r.verdict === 'Pass').length}
                    </Tag>
                  </div>
                  <Divider type="vertical" />
                  <div className="validation-stat-item">
                    <span style={{ color: 'var(--app-text-muted)', fontWeight: 600 }}>{t.agent.systemMonteCarlo}:</span>
                    <Tag color="blue" style={{ fontWeight: 800, margin: 0 }}>{t.agent.monteCarloV2}</Tag>
                  </div>
                </>
              ) : (
                <div style={{ color: 'var(--app-text-muted)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 8 }}>
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
                <div style={{ fontSize: '12px', color: 'var(--app-text-muted)', marginTop: 4 }}>{t.agent.backtestOptStability}</div>
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
                    expandedRowKeys: expandedRows,
                    expandIcon: () => null,
                  }}
                  onRow={(record) => ({
                    onClick: (e) => {
                      if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) return;
                      const isExpanded = expandedRows.includes(record.symbol);
                      if (isExpanded) {
                        setExpandedRows(prev => prev.filter(s => s !== record.symbol));
                      } else {
                        setExpandedRows(prev => [...prev, record.symbol]);
                      }
                    },
                    style: { cursor: 'pointer' }
                  })}
                  rowClassName={(record) => expandedRows.includes(record.symbol) ? 'dv-row-expanded' : 'dv-row'}
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
                        if (tr == null) return <span style={{ color: 'var(--app-text-muted)' }}>N/A</span>;
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
                        if (s == null) return <span style={{ color: 'var(--app-text-muted)' }}>-</span>;
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
                        if (pf == null) return <span style={{ color: 'var(--app-text-muted)' }}>-</span>;
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
                        const color = tc < 5 ? '#faad14' : 'var(--app-text-muted)';
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
                            <div style={{ height: 3, borderRadius: 2, backgroundColor: 'var(--app-table-header-bg)', overflow: 'hidden' }}>
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
                <div style={{ fontSize: '12px', color: 'var(--app-text-muted)', maxWidth: 500, margin: '0 auto', lineHeight: 1.6 }}>
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
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--app-text-muted)' }}>
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
          entryPlanStatus === 'completed' ? (entryPlanResults && entryPlanResults.length > 0 ? t.agent.completedLabel : 'Completed — No Candidates') :
          entryPlanStatus === 'stopped' ? t.agent.interruptedLabel2 :
          entryPlanStatus === 'error' ? t.agent.errorLabel : 'IDLE'
        }
        statusColor={
          entryPlanStatus === 'loading' ? 'processing' :
          entryPlanStatus === 'completed' ? (entryPlanResults && entryPlanResults.length > 0 ? 'success' : 'warning') :
          entryPlanStatus === 'stopped' ? 'warning' :
          entryPlanStatus === 'error' ? 'error' : 'default'
        }
        summaryChips={entryPlanResults && entryPlanResults.length > 0 ? [
          { label: t.agent.entryPlan, value: entryPlanResults.length },
          { label: t.agent.buyLabel, value: entryPlanResults.filter((p: any) => p.finalAction === 'Buy Ready').length, color: '#52c41a' },
          { label: 'Review', value: entryPlanResults.filter((p: any) => p.finalAction === 'Ready for Review').length, color: '#1890ff' },
          { label: 'Wait', value: entryPlanResults.filter((p: any) => p.finalAction === 'Wait for Entry' || p.finalAction === 'WATCH').length, color: '#faad14' },
          { label: 'Need Data', value: entryPlanResults.filter((p: any) => p.finalAction === 'Need Data' || p.finalAction === 'DATA_UNAVAILABLE').length, color: '#ff7a45' },
          ...(entryPlanResults.filter((p: any) => p.finalAction === 'Blocked by Risk' || p.finalAction === 'SKIP').length > 0 ? [{ label: 'Blocked' as string, value: entryPlanResults.filter((p: any) => p.finalAction === 'Blocked by Risk' || p.finalAction === 'SKIP').length, color: '#ff4d4f' }] : []),
        ] : (entryPlanStatus === 'completed' ? [{ label: t.agent.entryPlan, value: 0 }, { label: 'Empty', value: 'No candidates passed DV' as string }] : undefined)}
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
              <div style={{ marginTop: '8px', color: 'var(--app-text-muted)', fontSize: '12px' }}>
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
                <div style={{ background: 'var(--app-card-bg-soft)', borderRadius: '8px', border: '1px solid var(--app-border)', padding: '12px 14px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--app-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500, marginBottom: '6px' }}>{t.agent.aiDecisions}</div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--app-text-strong)', fontFamily: "'Inter', sans-serif", marginBottom: '6px' }}>
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
                <div style={{ background: 'var(--app-card-bg-soft)', borderRadius: '8px', border: '1px solid var(--app-border)', padding: '12px 14px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--app-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500, marginBottom: '6px' }}>{t.agent.riskReview}</div>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'baseline' }}>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: 600, color: '#52c41a', fontFamily: "'Inter', sans-serif", lineHeight: '1.2' }}>
                        {entryPlanResults.filter(p => p.hardRiskGate?.status === 'PASS').length}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--app-text-muted)' }}>{t.agent.passed}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: 600, color: '#fa8c16', fontFamily: "'Inter', sans-serif", lineHeight: '1.2' }}>
                        {entryPlanResults.filter(p => p.hardRiskGate?.status === 'REVIEW').length}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--app-text-muted)' }}>{t.agent.review}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: 600, color: '#ff4d4f', fontFamily: "'Inter', sans-serif", lineHeight: '1.2' }}>
                        {entryPlanResults.filter(p => p.hardRiskGate?.status === 'BLOCK').length}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--app-text-muted)' }}>{t.agent.blocked}</div>
                    </div>
                  </div>
                </div>

                {/* Block 3: Trade Readiness */}
                <div style={{ background: 'var(--app-card-bg-soft)', borderRadius: '8px', border: '1px solid var(--app-border)', padding: '12px 14px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--app-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500, marginBottom: '6px' }}>{t.agent.tradeReadiness}</div>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'baseline' }}>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: 600, color: '#52c41a', fontFamily: "'Inter', sans-serif", lineHeight: '1.2' }}>
                        {entryPlanResults.filter(p => p.tradeReadiness === 'READY').length}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--app-text-muted)' }}>{t.agent.ready}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: 600, color: '#fa8c16', fontFamily: "'Inter', sans-serif", lineHeight: '1.2' }}>
                        {entryPlanResults.filter(p => p.tradeReadiness === 'WAIT').length}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--app-text-muted)' }}>{t.agent.waitLabel}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: 600, color: '#ff4d4f', fontFamily: "'Inter', sans-serif", lineHeight: '1.2' }}>
                        {entryPlanResults.filter(p => p.tradeReadiness === 'BLOCKED').length}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--app-text-muted)' }}>{t.agent.blockedLabel}</div>
                    </div>
                  </div>
                </div>

                {/* Block 4: Current Global Settings (read-only) */}
                <div style={{ background: 'var(--app-card-bg-soft)', borderRadius: '8px', border: '1px solid var(--app-border)', padding: '10px 14px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--app-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500, marginBottom: '8px' }}>Global Settings</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '11px' }}>
                    <span style={{ color: 'var(--app-text-muted)' }}>Risk:</span>
                    <span style={{ fontWeight: 600, color: riskProfile === 'high' ? '#e84749' : riskProfile === 'low' ? '#52c41a' : '#d48806' }}>{riskProfile === 'low' ? 'Low Risk' : riskProfile === 'high' ? 'High Risk' : 'Medium Risk'}</span>
                    <span style={{ color: 'var(--app-text-muted)' }}>Horizon:</span>
                    <span style={{ fontWeight: 600, color: 'var(--app-text-muted)' }}>{timeHorizon === 'short' ? 'Short-term' : timeHorizon === 'long' ? 'Long-term' : 'Mid-term'}</span>
                    <span style={{ color: 'var(--app-text-muted)' }}>Mode:</span>
                    <span style={{ fontWeight: 600, color: '#2563eb' }}>{pipelineMode === 'ai' ? 'AI' : pipelineMode === 'hybrid' ? 'Hybrid' : 'Manual'}</span>
                    <span style={{ color: 'var(--app-text-muted)' }}>Trade:</span>
                    <span style={{ fontWeight: 600, color: tradeMode === 'real' ? '#e84749' : '#52c41a' }}>{tradeMode === 'real' ? 'Real' : 'Paper'}</span>
                    <span style={{ color: 'var(--app-text-muted)' }}>Risk/Trade:</span>
                    <span style={{ fontWeight: 600, color: 'var(--app-text-muted)' }}>{entryPlanRiskPerTrade}%</span>
                    <span style={{ color: 'var(--app-text-muted)' }}>Execution:</span>
                    <span style={{ fontWeight: 600, color: entryPlanExecutionMode.includes('Real') ? '#e84749' : 'var(--app-text-muted)', fontSize: '10px' }}>{entryPlanExecutionMode}</span>
                  </div>
                </div>
              </div>

              {/* F3: Buying Power Summary */}
              {tradingAccountData?.buyingPower > 0 && (() => {
                const bp = tradingAccountData.buyingPower || 0;
                const totalAllocated = entryPlanResults
                  .filter((p: any) => p.finalAction === 'Buy Ready' || p.finalAction === 'Ready for Review')
                  .reduce((sum: number, p: any) => sum + (p.allocationDollars || p.positionSizeDollars || 0), 0);
                const remaining = Math.max(0, bp * 0.9 - totalAllocated);
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ background: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '10px 14px', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--app-text)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 }}>Buying Power</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--app-text-strong)', fontFamily: "'Inter', sans-serif" }}>${bp.toLocaleString()}</div>
                    </div>
                    <div style={{ background: 'var(--app-blue-bg)', borderRadius: '8px', border: '1px solid var(--app-blue-border)', padding: '10px 14px', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--app-text)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 }}>Allocated</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--app-text-strong)', fontFamily: "'Inter', sans-serif" }}>${totalAllocated.toLocaleString()}</div>
                    </div>
                    <div style={{ background: 'rgba(250, 173, 20, 0.1)', borderRadius: '8px', border: '1px solid rgba(250, 173, 20, 0.2)', padding: '10px 14px', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--app-text)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 }}>Remaining (90% BP)</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--app-text-strong)', fontFamily: "'Inter', sans-serif" }}>${remaining.toLocaleString()}</div>
                    </div>
                  </div>
                );
              })()}

              {/* F5: Account unavailable warning */}
              {tradingAccountData && tradingAccountData.success !== true && (
                <Alert
                  message="Trading account not connected. Entry Plan will not generate executable BUY orders. Please connect your Alpaca account in Settings."
                  type="error"
                  showIcon
                  style={{ marginBottom: '12px', fontSize: '12px', padding: '8px 16px' }}
                />
              )}
              {/* F5: Account data unavailable (no positions/buying power) */}
              {(!tradingAccountData || !tradingAccountData.buyingPower || tradingAccountData.buyingPower <= 0) && (
                <Alert
                  message="Buying power data unavailable. Position sizing may be unreliable. Ensure Alpaca account is connected in Settings."
                  type="warning"
                  showIcon
                  style={{ marginBottom: '12px', fontSize: '12px', padding: '8px 16px' }}
                />
              )}

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
                  onRow={(record) => ({
                    onClick: (e) => {
                      if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) return;
                      const isExpanded = expandedEntryPlanSymbol === record.symbol;
                      setExpandedEntryPlanSymbol(isExpanded ? null : record.symbol);
                    },
                    style: { cursor: 'pointer' }
                  })}
                  rowClassName={(record) => expandedEntryPlanSymbol === record.symbol ? 'entry-plan-row-expanded' : 'entry-plan-row'}
                  expandable={{
                    expandedRowKeys: expandedEntryPlanSymbol ? [expandedEntryPlanSymbol] : [],
                    expandIcon: () => null,
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
                      const faColor = finalAction === 'Buy Ready' ? '#52c41a' : finalAction === 'Wait for Entry' ? '#fa8c16' : '#ff4d4f';

                      const curPrice = ep.currentPrice || ep.price;
                      const loPrice = ep.entryLow || ep.entryZoneLow;
                      const hiPrice = ep.entryHigh || ep.entryZoneHigh;
                      let distText = '—';
                      let distColor = 'var(--app-text-muted)';
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
                          color: color || 'var(--app-text-muted)', 
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
                        <span style={{ fontSize: '11px', color: 'var(--app-text-muted)', fontWeight: 500 }}>{text}</span>
                      );
                      
                      const Value = ({ v, bold, color, subText }: { v: string; bold?: boolean; color?: string; subText?: string }) => (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '12px', fontWeight: bold ? 700 : 500, color: color || 'var(--app-text-strong)' }}>{v}</span>
                          {subText && <span style={{ fontSize: '10px', color: 'var(--app-text-muted)', marginTop: '1px' }}>{subText}</span>}
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
                          background: 'var(--app-card-bg-soft)', 
                          border: '1px solid var(--app-border)', 
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
                            borderBottom: '1px solid var(--app-border)', 
                            marginBottom: '16px' 
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--app-text-strong)', letterSpacing: '-0.2px' }}>{sym}</span>
                              <Tag color={setupLabel.includes('Pullback') ? 'gold' : setupLabel.includes('Breakout') ? 'purple' : setupLabel.includes('Range') ? 'green' : 'blue'} 
                                   style={{ fontSize: '11px', fontWeight: 600, borderRadius: '4px', margin: 0 }}>
                                {setupLabel}
                              </Tag>
                              <Tag color={aiDecision === 'BUY' ? 'success' : aiDecision === 'WATCH' ? 'warning' : 'error'} 
                                   style={{ fontSize: '11px', fontWeight: 700, borderRadius: '4px', margin: 0 }}>
                                AI: {aiDecision}
                              </Tag>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--app-text-muted)', backgroundColor: 'var(--app-card-bg-soft)', padding: '2px 8px', borderRadius: '4px' }}>
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
                                  type={finalAction === 'Buy Ready' ? 'primary' : finalAction === 'Ready for Review' ? 'primary' : 'default'}
                                  ghost={finalAction === 'Ready for Review' && pipelineMode !== 'ai'}
                                  danger={finalAction === 'Blocked by Risk'}
                                  disabled={finalAction === 'SKIP' || finalAction === 'Blocked by Risk' || dq === 'POOR'}
                                  onClick={() => handleEntryPlanAction(ep)}
                                  style={{
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    borderRadius: '6px',
                                    height: '32px'
                                  }}
                                >
                                  {finalAction === 'Buy Ready' ? t.agent.epExecuteTrade : finalAction === 'Ready for Review' ? t.agent.reviewAndExecute : finalAction === 'Wait for Entry' ? t.agent.epMonitorEntry : finalAction === 'SKIP' ? t.agent.planSkipped : t.agent.epRiskBlocked}
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
                                    backgroundColor: isInWatchlist(ep.symbol) ? 'rgba(34, 197, 94, 0.1)' : '#eff6ff'
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
                            <div style={{ background: 'var(--app-card-bg)', borderRadius: '8px', border: '1px solid var(--app-border)', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                              <SectionHeader title={t.agent.executionPlan} />
                              <div style={{ display: 'grid', gridTemplateColumns: '95px 1fr', gap: '8px 12px', alignItems: 'baseline' }}>
                                <Label text={t.agent.epCurrentPrice} /><Value v={curPrice != null ? `$${curPrice.toFixed(2)}` : '—'} bold color="var(--app-text-strong)" />
                                <Label text={t.agent.distance} /><Value v={distText} color={distColor} bold />
                                <Label text={t.agent.entryZone} /><Value v={loPrice != null ? `$${loPrice.toFixed(2)} – $${(hiPrice ?? 0).toFixed(2)}` : '—'} bold color="var(--app-text-strong)" />
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
                            <div style={{ background: 'var(--app-card-bg)', borderRadius: '8px', border: '1px solid var(--app-border)', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                              <SectionHeader title={t.agent.positionRisk} />
                              <div style={{ display: 'grid', gridTemplateColumns: '95px 1fr', gap: '8px 12px', alignItems: 'baseline' }}>
                                <Label text={t.agent.epPortfolio} /><Value v={fmtDollars(ep.positionCapital)} bold />
                                <Label text={t.agent.epBuyingPower} /><Value v={fmtDollars(ep.accountBuyingPower)} />
                                <Label text={t.agent.riskBudget} /><Value v={fmtDollars(ep.riskBudget)} subText={`${fmtPct(ep.riskPct)} ${t.agent.ofRiskBudget}`} />
                                <Label text={t.agent.actualRisk} /><Value v={fmtDollars(ep.riskDollars)} bold color="#dc2626" />
                                <Label text={t.agent.riskUsed} /><Value v={ep.riskUsedPct != null ? `${ep.riskUsedPct.toFixed(1)}%` : (ep.riskBudget > 0 ? `${(ep.riskDollars / ep.riskBudget * 100).toFixed(1)}%` : '—')} bold color={ep.riskUsedPct > 80 ? '#dc2626' : '#d97706'} subText={t.agent.ofRiskBudget} />
                                <Label text={t.agent.size} />
                                <div style={{ display: 'flex', gap: '16px' }}>
                                  <Value v={fmtShares(ep.shares || ep.positionSize || ep.positionSizeShares)} bold subText={t.agent.sharesLabel} />
                                  <Value v={fmtDollars(ep.allocationDollars || ep.positionValue || ep.positionSizeDollars)} bold subText={t.agent.estValue} />
                                </div>
                                <Label text={t.agent.capStatus} /><Value v={ep.positionCapStatus || (ep.positionCapped ? `${t.agent.cappedAt} ${fmtPct(ep.positionPct)}` : `${t.agent.okAt.replace('{pct}', fmtPct(ep.positionPct))}`)} bold color={ep.positionCapped ? '#d97706' : '#16a34a'} />
                                <Label text="Holding Period" /><Value v={ep.holdingPeriod || '—'} bold color="var(--app-text-muted)" />
                                <Label text="BP Before/After" />
                                <Value v={ep.buyingPowerBefore != null ? `${fmtDollars(ep.buyingPowerBefore)} → ${fmtDollars(ep.buyingPowerAfter)}` : '—'} color="var(--app-text-muted)" />
                                {ep.isLeveraged && (
                                  <><Label text="Leverage" /><Value v={ep.leverageReason || ep.alternativeReason || 'Leveraged ETF'} bold color="#e84749" /></>
                                )}
                                {ep.existingOpenOrder && (
                                  <><Label text="Open Order" /><Value v="Existing open buy order" color="#e84749" bold /></>
                                )}
                                {ep.existingPosition && (
                                  <><Label text="Position" /><Value v="Already holding" color="#fa8c16" bold /></>
                                )}
                              </div>
                            </div>

                            {/* C. Decision */}
                            <div style={{ background: 'var(--app-card-bg)', borderRadius: '8px', border: '1px solid var(--app-border)', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
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
                            <div style={{ background: 'var(--app-card-bg)', borderRadius: '8px', border: '1px solid var(--app-border)', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
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
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderTop: '1px solid var(--app-border)', paddingTop: '12px' }}>
                            {/* Left: Decision Reason + Next Step */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <div>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
                                  {t.agent.decisionReason} {ep.aiCalled ? '(AI)' : `(${t.agent.epLocalRules})`}
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--app-text-strong)', lineHeight: '1.6', background: 'var(--app-card-bg)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--app-card-bg-soft)' }}>
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
                                <div style={{ background: 'rgba(250, 173, 20, 0.1)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(250, 173, 20, 0.2)' }}>
                                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>{t.agent.riskComment}</div>
                                  <div style={{ fontSize: '12px', color: '#9a3412', lineHeight: '1.5' }}>{ep.riskComment}</div>
                                </div>
                              )}
                            </div>

                            {/* Right: Risk Notes + Blockers */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <div>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>{t.agent.riskAssessment}</div>
                                <div style={{ background: 'var(--app-card-bg)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--app-card-bg-soft)', minHeight: '60px' }}>
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
                                <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--app-text-strong)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>{t.agent.criticalBlockers}</div>
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
                                <div style={{ fontSize: '12px', color: 'var(--app-text-strong)', borderLeft: '3px solid rgba(255, 77, 79, 0.2)', paddingLeft: '8px', marginTop: '4px' }}>
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
                      width: 120,
                      fixed: 'left',
                      render: (text, record) => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '1px 0' }}>
                          <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--app-text-strong)', letterSpacing: '-0.1px' }}>{text}</span>
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
                      width: 160,
                      render: (text) => {
                        const colors: Record<string, string> = { 'Pullback Entry': 'gold', 'Breakout Entry': 'purple', 'Range Support Entry': 'green', 'Watch Only': 'blue', 'No Trade': 'red' };
                        return (
                          <Tooltip title={text}>
                            <div style={{
                              maxWidth: '140px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              <Tag color={colors[text] || 'default'} bordered={false} style={{ fontSize: '10px', fontWeight: 700, padding: '0 8px', lineHeight: '20px', borderRadius: '4px', margin: 0 }}>{text?.toUpperCase() || '-'}</Tag>
                            </div>
                          </Tooltip>
                        );
                      },
                    },
                    {
                      title: t.agent.colCurrent,
                      key: 'currentPrice',
                      width: 120,
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
                            distShort = `▼ ${pct.toFixed(1)}%`;
                            distColor = '#f59e0b';
                          } else if (p > hi) {
                            const pct = ((p - hi) / hi) * 100;
                            distShort = `▲ ${pct.toFixed(1)}%`;
                            distColor = '#f59e0b';
                          } else {
                            distShort = t.agent.inZone;
                            distColor = '#10b981';
                          }
                        }
                        
                        return (
                          <div style={{ lineHeight: '1.4' }}>
                            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--app-text-strong)' }}>${p.toFixed(2)}</div>
                            {distShort && <div style={{ fontSize: '10px', color: distColor, fontWeight: 800, letterSpacing: '0.2px' }}>{distShort}</div>}
                          </div>
                        );
                      },
                    },
                    {
                      title: t.agent.colEntryZone,
                      key: 'entryZone',
                      width: 160,
                      render: (record) => {
                        const display = formatEntryZoneDisplay(record);
                        const colorMap: Record<string, string> = {
                          success: '#52c41a',
                          warning: '#faad14',
                          info: '#1890ff',
                          neutral: 'var(--app-text-muted)'
                        };
                        const bgMap: Record<string, string> = {
                          success: 'rgba(82, 196, 26, 0.1)',
                          warning: 'rgba(250, 173, 20, 0.1)',
                          info: 'rgba(24, 144, 255, 0.1)',
                          neutral: 'var(--app-card-bg-soft)'
                        };
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                               <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: bgMap[display.tone] || bgMap.neutral, color: colorMap[display.tone] || colorMap.neutral, whiteSpace: 'nowrap' }}>
                                 {display.statusLabel}
                               </span>
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--app-text-strong)', whiteSpace: 'nowrap' }}>
                              {display.primaryText}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--app-text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                              {display.secondaryText}
                            </span>
                          </div>
                        );
                      },
                    },
                    {
                      title: t.agent.colStop,
                      key: 'stopLoss',
                      width: 130,
                      render: (record) => {
                        const v = record.stopLoss;
                        const pct = record.stopLossPct;
                        if (v == null || v === 0) return <span style={{ fontSize: '11px', color: '#bbb' }}>-</span>;
                        return (
                          <div style={{ lineHeight: '1.4' }}>
                            <div style={{ fontSize: '13px', fontWeight: 800, color: 'rgba(239, 68, 68, 0.8)' }}>${v.toFixed(2)}</div>
                            {pct != null && pct > 0 && <div style={{ fontSize: '10px', color: 'var(--app-text-muted)', fontWeight: 600 }}>{pct.toFixed(1)}% RISK</div>}
                          </div>
                        );
                      },
                    },
                    {
                      title: t.agent.colTargets,
                      key: 'targets',
                      width: 130,
                      render: (record) => {
                        const t1 = record.takeProfit1;
                        const rr1 = record.riskReward1 || 0;
                        if (t1 == null || t1 === 0) return <span style={{ fontSize: '11px', color: '#bbb' }}>-</span>;
                        return (
                          <div style={{ lineHeight: '1.4' }}>
                            <div style={{ fontSize: '13px', fontWeight: 800, color: '#10b981' }}>${t1.toFixed(2)}</div>
                            <div style={{ fontSize: '10px', color: 'var(--app-text-strong)', fontWeight: 700 }}>R/R {rr1.toFixed(1)}x</div>
                          </div>
                        );
                      },
                    },
                    {
                      title: t.agent.colPosition,
                      key: 'position',
                      width: 130,
                      render: (record) => {
                        const sh = record.shares || record.positionSize || record.positionSizeShares || 0;
                        const alloc = record.allocationDollars || record.positionValue || record.positionSizeDollars || 0;
                        const bpBefore = record.buyingPowerBefore;
                        const bpAfter = record.buyingPowerAfter;
                        if (sh === 0 && alloc === 0) return <span style={{ fontSize: '11px', color: '#bbb' }}>-</span>;
                        return (
                          <div style={{ lineHeight: '1.4' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#3b82f6' }}>{typeof sh === 'number' ? Number(sh).toLocaleString(undefined, {maximumFractionDigits: 3}) : sh} sh</div>
                            <div style={{ fontSize: '11px', color: 'var(--app-text-muted)', fontWeight: 500 }}>${alloc.toLocaleString()} alloc</div>
                            {bpBefore != null && bpAfter != null && (
                              <div style={{ fontSize: '10px', color: 'var(--app-text-muted)', fontWeight: 500 }}>
                                BP ${typeof bpBefore === 'number' ? bpBefore.toFixed(0) : bpBefore} → ${typeof bpAfter === 'number' ? bpAfter.toFixed(0) : bpAfter}
                              </div>
                            )}
                          </div>
                        );
                      },
                    },
                    {
                      title: 'Order Plan',
                      key: 'orderPlan',
                      width: 120,
                      render: (record: any) => {
                        const ot = record.orderType || record.executionDetails?.orderPreview?.orderType || '';
                        const tif = record.timeInForce || record.executionDetails?.orderPreview?.timeInForce || '';
                        const isLev = record.isLeveraged || record.isLeveragedAlternative;
                        if (!ot || ot === 'N/A') {
                          const fa = record.finalAction || '';
                          if (fa === 'Wait for Entry') return <Tag color="orange" style={{ fontSize: '10px', margin: 0 }}>WATCH</Tag>;
                          if (fa === 'Blocked by Risk') return <Tag color="red" style={{ fontSize: '10px', margin: 0 }}>BLOCKED</Tag>;
                          if (fa === 'SKIP') return <Tag color="default" style={{ fontSize: '10px', margin: 0 }}>SKIP</Tag>;
                          return <span style={{ fontSize: '10px', color: '#bbb' }}>-</span>;
                        }
                        const label = ot === 'market' ? `Market Buy ${tif}` : ot === 'limit' ? `Limit Buy ${tif}` : ot === 'stop_limit' ? `Stop-Limit ${tif}` : ot;
                        const color = ot === 'market' ? 'blue' : ot === 'limit' ? 'green' : 'purple';
                        return (
                          <div style={{ lineHeight: '1.4' }}>
                            <Tag color={color} style={{ fontSize: '10px', fontWeight: 700, margin: 0 }}>{label}</Tag>
                            {isLev && <div style={{ fontSize: '9px', color: '#e84749', fontWeight: 700, marginTop: 2 }}>LEV</div>}
                          </div>
                        );
                      },
                    },
                    {
                      title: 'Hold',
                      key: 'holdingPeriod',
                      width: 100,
                      render: (record: any) => {
                        const hp = record.holdingPeriod;
                        if (!hp || hp === 'N/A') return <span style={{ fontSize: '10px', color: '#bbb' }}>-</span>;
                        return <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--app-text-muted)' }}>{hp}</span>;
                      },
                    },
                    {
                      title: t.agent.colAIDecision,
                      key: 'aiDecision',
                      width: 130,
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
                      width: 110,
                      render: (record) => {
                        const rg = record.riskGate || record.hardRiskGate;
                        const status = rg?.status;
                        if (!status) return <span style={{ fontSize: '11px', color: '#ccc' }}>N/A</span>;
                        const tagColor = status === 'PASS' ? 'success' : status === 'REVIEW' ? 'warning' : 'error';
                        return (
                          <Tooltip title={rg.warnings?.join('; ') || status}>
                            <Tag color={tagColor} bordered={false} style={{ fontSize: '10.5px', fontWeight: 800, padding: '0 8px', lineHeight: '22px', borderRadius: '6px', margin: 0, textAlign: 'center', width: '60px' }}>{status}</Tag>
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
                          'Buy Ready': 'BUY READY',
                          'BUY_ALLOWED': 'BUY',
                          'Ready for Review': 'READY REVIEW',
                          'Wait for Entry': 'WAIT ENTRY',
                          'WATCH_ONLY': 'WATCH',
                          'SKIP': 'SKIP',
                          'Blocked by Risk': 'BLOCKED',
                          'NEEDS_REVIEW': 'REVIEW',
                        };
                        const tagColor = a.includes('BUY') ? 'success' : a === 'Ready for Review' ? 'processing' : a.includes('WAIT') || a === 'WATCH_ONLY' ? 'warning' : 'error';
                        return <Tag color={tagColor} bordered={false} style={{ fontSize: '10.5px', fontWeight: 800, padding: '0 8px', lineHeight: '22px', borderRadius: '6px', margin: 0 }}>{displayText[a] || a}</Tag>;
                      },
                    },
                    {
                      title: t.agent.reason,
                      dataIndex: 'reason',
                      key: 'reason',
                      width: 180,
                      render: (text, record) => {
                        const fullText = record.decisionReason || text || '';
                        return (
                          <Tooltip title={fullText} overlayClassName="heatmap-professional-tooltip">
                            <div style={{ fontSize: '12px', color: 'var(--app-text-muted)', lineHeight: 1.5, WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {fullText || '—'}
                            </div>
                          </Tooltip>
                        );
                      },
                    },
                    {
                      title: t.agent.actions,
                      key: 'action',
                      width: 160,
                      fixed: 'right' as const,
                      render: (record) => {
                        const fa = record.finalAction;
                        const aiDec = record.aiDecision;
                        const dq = record.dataQuality;
                        const rg = record.riskGate || record.hardRiskGate || {};

                        if (fa === 'Blocked by Risk' || rg.status === 'BLOCK' || dq === 'POOR') {
                          return <Button size="small" danger disabled style={{ height: 32, borderRadius: 8, fontSize: 11, fontWeight: 700, width: '100%' }}>{t.agent.blocked}</Button>;
                        }
                        if (fa === 'SKIP' || aiDec === 'SKIP') {
                          return <Button size="small" disabled style={{ height: 32, borderRadius: 8, fontSize: 11, fontWeight: 700, width: '100%' }}>{t.agent.skipped}</Button>;
                        }
                        if (fa === 'Buy Ready') {
                          return <Button size="small" type="primary" onClick={() => handleEntryPlanAction(record)} style={{ height: 32, borderRadius: 8, fontSize: 11, fontWeight: 700, width: '100%', background: '#10b981', borderColor: '#10b981' }}>{t.agent.execute}</Button>;
                        }
                        if (fa === 'Ready for Review') {
                          const inWl = isInWatchlist(record.symbol);
                          return (
                            <Space size={6}>
                              <Button size="small" type="primary" ghost onClick={() => handleEntryPlanAction(record)} style={{ height: 32, borderRadius: 8, fontSize: 11, fontWeight: 700 }}>{t.agent.review}</Button>
                              <Button size="small" icon={inWl ? <CheckOutlined /> : <PlusOutlined />} onClick={() => addToWatchlist(record)} style={{ height: 32, width: 32, borderRadius: 8, color: inWl ? '#10b981' : '#3b82f6', borderColor: inWl ? '#10b981' : '#3b82f6' }} />
                            </Space>
                          );
                        }
                        if (fa === 'Wait for Entry' || aiDec === 'WATCH') {
                          const inWl = isInWatchlist(record.symbol);
                          return <Button size="small" icon={inWl ? <CheckOutlined /> : <PlusOutlined />} onClick={() => addToWatchlist(record)} style={{ height: 32, borderRadius: 8, fontSize: 11, fontWeight: 700, width: '100%', color: inWl ? '#10b981' : '#3b82f6', borderColor: inWl ? '#10b981' : '#3b82f6' }}>{inWl ? t.agent.update : t.agent.plusWatchlist}</Button>;
                        }
                        return <span style={{ fontSize: '10px', color: '#bbb' }}>—</span>;
                      },
                    },
                  ]}
                  scroll={{ x: 1600 }}
                  style={{ fontSize: '12px', marginTop: '16px' }}
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
                  background: var(--app-card-bg);
                }
                .entry-plan-table-wrapper .ant-table-thead > tr > th {
                  font-weight: 800 !important;
                  font-size: 10.5px !important;
                  color: #94a3b8 !important;
                  background: var(--app-card-bg-soft) !important;
                  padding: 16px 12px !important;
                  border-bottom: 1px solid rgba(15, 23, 42, 0.06) !important;
                  letter-spacing: 0.8px !important;
                  text-transform: uppercase !important;
                }
                .ep-table-row:hover > td {
                  background: var(--app-card-bg-soft) !important;
                }
                .ant-table-thead > tr > th:not(:last-child)::after {
                  display: none !important;
                }
                .ant-table-fixed-right {
                  background: var(--app-card-bg) !important;
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
            background: 'var(--app-card-bg-soft)', borderRadius: 10, border: '1px solid var(--app-card-bg-soft)'
          }}>
            {[
              { label: t.agent.scanned, value: exitScanResults.length, color: 'var(--app-text-strong)', icon: <SearchOutlined /> },
              { label: t.agent.sellNow, value: exitScanResults.filter(r => r.exitDecision === 'sell_now').length, color: 'rgba(239, 68, 68, 0.8)', icon: <ThunderboltOutlined /> },
              { label: t.agent.targetLimit, value: exitScanResults.filter(r => r.exitDecision === 'place_target_limit').length, color: '#d97706', icon: <ClockCircleOutlined /> },
              { label: t.agent.hold, value: exitScanResults.filter(r => r.exitDecision === 'hold').length, color: '#10b981', icon: <SafetyCertificateOutlined /> },
              { label: t.agent.epPending, value: exitScanResults.filter(r => r.status === 'pending').length, color: '#f59e0b', icon: <SyncOutlined /> },
              { label: t.agent.epSubmitted, value: exitScanResults.filter(r => r.status === 'submitted').length, color: '#3b82f6', icon: <CheckCircleOutlined /> },
            ].map((stat, idx) => (
              <React.Fragment key={stat.label}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ color: stat.color, fontSize: 14 }}>{stat.icon}</div>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--app-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{stat.label}</div>
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
              .exitscan-table .ant-table-thead > tr > th { background: var(--app-card-bg-soft) !important; padding: 12px 16px !important; border-bottom: 1px solid var(--app-border-soft) !important; }
              .exitscan-table .ant-table-thead > tr > th:first-child,
              .exitscan-table .ant-table-tbody > tr > td:first-child { padding-left: 24px !important; }
              .exitscan-row > td { border-bottom: 1px solid var(--app-border-soft) !important; }
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
                { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colSymbol}</span>,
                  dataIndex: 'symbol', key: 'symbol', width: 80, fixed: 'left' as const,
                  render: (t: string) => <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--app-text-strong)', letterSpacing: '-0.2px' }}>{t}</span> },
                { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colQty}</span>,
                  dataIndex: 'qty', key: 'qty', width: 60,
                  render: (v: number) => <span style={{ fontSize: 13, fontWeight: 700 }}>{v}</span> },
                { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colAvgEntry}</span>,
                  dataIndex: 'avgEntry', key: 'avgEntry', width: 90,
                  render: (v: number) => <span style={{ fontSize: 12, color: 'var(--app-text-strong)', fontWeight: 600 }}>${(v || 0).toFixed(2)}</span> },
                { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colCurrent}</span>,
                  dataIndex: 'currentPrice', key: 'current', width: 90,
                  render: (v: number) => <span style={{ fontSize: 12, color: 'var(--app-text-strong)', fontWeight: 600 }}>${(v || 0).toFixed(2)}</span> },
                { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colPL}</span>,
                  dataIndex: 'pl', key: 'pl', width: 90,
                  render: (v: number) => <span style={{ color: (v || 0) >= 0 ? '#10b981' : '#ef4444', fontWeight: 800, fontSize: 13 }}>{(v || 0) >= 0 ? '+' : ''}${(v || 0).toFixed(2)}</span> },
                { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colPLPct}</span>,
                  dataIndex: 'plPct', key: 'plPct', width: 80,
                  render: (v: number) => <Tag color={(v || 0) >= 0 ? 'success' : 'error'} bordered={false} style={{ fontSize: 11, fontWeight: 800, borderRadius: 6, margin: 0, padding: '0 6px' }}>{(v || 0) >= 0 ? '+' : ''}{((v || 0) * 100).toFixed(2)}%</Tag> },
                { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colSource}</span>,
                  dataIndex: 'positionSource', key: 'source', width: 110,
                  render: (s: string, record: any) => {
                    if (s === 'user_marked') return <Tag color="default" style={{ fontSize: 9, fontWeight: 700, borderRadius: 4 }}>USER-MARKED</Tag>;
                    if (s === 'ai_managed') return <Tag color="blue" style={{ fontSize: 9, fontWeight: 700, borderRadius: 4 }}>AI MANAGED</Tag>;
                    if (record.exitPlanSource === 'generated') return <Tag color="cyan" style={{ fontSize: 9, fontWeight: 700, borderRadius: 4 }}>AI GENERATED</Tag>;
                    return <Tag color="orange" style={{ fontSize: 9, fontWeight: 700, borderRadius: 4 }}>{s?.toUpperCase()}</Tag>;
                  }},
                { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colTarget}</span>,
                  dataIndex: 'entryPlanTarget', key: 'target', width: 90,
                  render: (v?: number) => v != null ? <span style={{ color: '#10b981', fontSize: 12, fontWeight: 700 }}>${v.toFixed(2)}</span> : <span style={{ color: '#d1d5db' }}>—</span> },
                { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colStop}</span>,
                  dataIndex: 'entryPlanStop', key: 'stop', width: 90,
                  render: (v?: number) => v != null ? <span style={{ color: 'rgba(239, 68, 68, 0.8)', fontSize: 12, fontWeight: 700 }}>${v.toFixed(2)}</span> : <span style={{ color: '#d1d5db' }}>—</span> },
                { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colExitDecision}</span>,
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
                { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colExitOrder}</span>,
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
                { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.exitPrice}</span>,
                  dataIndex: 'exitPrice', key: 'exitPrice', width: 90,
                  render: (v?: number, record?: any) => {
                    if (v != null) return <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--app-text-strong)' }}>${v.toFixed(2)}</span>;
                    if (record?.exitDecision === 'hold' && record?.entryPlanTarget) return <span style={{ color: '#10b981', fontSize: 12, fontWeight: 600 }}>${record.entryPlanTarget.toFixed(2)}</span>;
                    return <span style={{ color: '#d1d5db' }}>—</span>;
                  }},
                { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.reason}</span>,
                  dataIndex: 'reason', key: 'reason', width: 200, ellipsis: true,
                  render: (t: string) => <Tooltip title={t}><span style={{ fontSize: 12, color: '#4b5563', fontWeight: 500 }}>{t}</span></Tooltip> },
                { title: <span style={{ fontWeight: 700, color: 'var(--app-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{t.agent.colExitStatus}</span>,
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
