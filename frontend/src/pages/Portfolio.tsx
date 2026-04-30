import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card, Typography, Space, Statistic, Row, Col,
  Button, Divider, Table, Tag, Select, Form, Input, InputNumber,
  message, Progress, Empty, Badge, Alert, Tooltip, Spin, Modal, Pagination
} from 'antd';
import {
  LineChartOutlined, BarChartOutlined,
  SettingOutlined, PlayCircleOutlined, PauseCircleOutlined,
  ThunderboltOutlined, CheckCircleOutlined, ClockCircleOutlined,
  RobotOutlined, CloseCircleOutlined, ExclamationCircleOutlined, SyncOutlined, LoadingOutlined,
  ArrowUpOutlined, ArrowDownOutlined, ArrowRightOutlined, MinusOutlined,
  SortDescendingOutlined, SortAscendingOutlined, InfoCircleOutlined,
  CaretDownOutlined, CaretRightOutlined
} from '@ant-design/icons';
import aiTradingService, { AIProviderConfig } from '../services/aiTradingService';
import { backtraderAPI, marketAPI, entryQualityAPI, fineScanAdvancedAPI, deeperValidationAPI, entryPlanAPI, fineScanExplainAPI, fineScanDecisionAPI, tradingAccountAPI, aiAgentWatchlistAPI } from '../services/api';
import api, { scannerApi } from '../services/api';
import marketDataService from '../services/marketDataService';
import alpacaBrokerService, { AlpacaPosition, AlpacaOrder } from '../services/alpacaBrokerService';

const { Title, Text } = Typography;
const { Option } = Select;

// Small inline tag used in Entry Quality detail panel
const DetailTag: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <div style={{
    padding: '2px 8px', backgroundColor: '#fff', borderRadius: 3,
    border: '1px solid #e8e8e8', fontSize: '9px', lineHeight: '1.6'
  }}>
    <span style={{ color: '#888', marginRight: 4 }}>{label}:</span>
    <span style={{ fontWeight: 500, color: color || '#333' }}>{value}</span>
  </div>
);

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
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', height: expanded ? 56 : 52,
          padding: '0 16px', background: isRunning ? '#f0f7ff' : '#fafafa',
          border: `1px solid ${isRunning ? '#91caff' : '#e8e8e8'}`,
          borderRadius: expanded ? '6px 6px 0 0' : 6,
          cursor: 'pointer', transition: 'all 0.2s',
          userSelect: 'none',
        }}
      >
        {/* Expand icon */}
        <span style={{ marginRight: 8, fontSize: 12, color: '#888', flexShrink: 0 }}>
          {expanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
        </span>

        {/* Title + Icon */}
        <span style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a', marginRight: 12, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          {icon}
          {title}
        </span>

        {/* Status badge */}
        {statusText && (
          <Tag color={statusTagColor} style={{ margin: 0, fontSize: 11, lineHeight: '18px', padding: '0 6px', marginRight: 10 }}>
            {statusText}
          </Tag>
        )}

        {/* Progress bar (compact 6px) */}
        {progressValue !== null && progressValue !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 10, minWidth: 120, flexShrink: 0 }}>
            <div style={{ flex: 1, height: 6, background: '#e8e8e8', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, Math.max(0, progressValue))}%`, height: '100%', background: isRunning ? '#1890ff' : '#52c41a', borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontSize: 11, color: '#888', minWidth: 28, textAlign: 'right' }}>{Math.round(progressValue)}%</span>
          </div>
        )}
        {progressText && (progressValue === null || progressValue === undefined) && (
          <span style={{ fontSize: 11, color: '#888', marginRight: 10 }}>{progressText}</span>
        )}

        {/* Summary chips */}
        {summaryChips && summaryChips.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginRight: 10, flexWrap: 'wrap' }}>
            {summaryChips.map((chip, i) => (
              <span key={i} style={{ fontSize: 11, color: chip.color || '#595959', background: '#f5f5f5', borderRadius: 3, padding: '1px 6px', lineHeight: '18px' }}>
                {chip.label}: <strong>{chip.value}</strong>
              </span>
            ))}
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Action button */}
        {actionButton && (
          <div onClick={(e) => e.stopPropagation()}>
            {actionButton}
          </div>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ border: '1px solid #e8e8e8', borderTop: 'none', borderRadius: '0 0 6px 6px', padding: '16px', background: '#fff' }}>
          {children}
        </div>
      )}
    </div>
  );
};

// AI分析结果类型定义 - V3格式
interface AIAnalysisResult {
  // 基础字段
  success: boolean;
  symbol: string;

  // V1/V2兼容字段
  trend?: string | null;
  overallScore?: number | null;
  confidence?: number | null;
  trendScore?: number | null;
  momentumScore?: number | null;
  volumeScore?: number | null;
  volatilityScore?: number | null;
  structureScore?: number | null;
  newsScore?: number | null;
  scannerReason?: string | null;
  aiReasoning?: string | null;
  newsSentiment?: string | null;
  eventRisk?: string | null;
  topNews?: string | null;
  companyName?: string | null;
  sector?: string | null;
  volumeStatus?: string | null;
  conciseReasoning?: string | null;
  detailedReasoning?: string | null;

  // V3增强字段
  trendLabel?: string | null;
  momentumLabel?: string | null;
  volatilityLabel?: string | null;
  volumeLabel?: 'low' | 'normal' | 'high' | null;
  structureLabel?: 'uptrend' | 'downtrend' | 'sideways' | 'breakout' | 'high-volatility' | null;
  newsLabel?: 'positive' | 'neutral' | 'negative' | null;
  riskLevel?: 'low' | 'medium' | 'high' | null;
  conciseReason?: string | null;

  // 数据源信息
  provenance?: {
    marketData?: string;
    companyInfo?: string;
    news?: string;
    aiAnalysis?: string;
  };
}

// 趋势分析结果类型
interface TrendAnalysis {
  // 核心趋势字段
  trendLabel: string | null;
  trendScore: number | null;
  trendConfidence: number | null;
  scannerReason: string | null;

  // 6维度分数
  trendScoreDetail: number | null;
  momentumScore: number | null;
  volumeScore: number | null;
  volatilityScore: number | null;
  structureScore: number | null;
  newsScore: number | null;

  // V2兼容字段
  volumeStatus: string | null;
  conciseReasoning: string | null;
  detailedReasoning: string | null;
  aiReasoning: string | null;
  newsSentiment: string | null;
  eventRisk: string | null;
  topNews: string | null;
  companyName: string | null;
  sector: string | null;

  // V3字段
  momentumLabel?: string | null;
  volatilityLabel?: string | null;
  volumeLabel?: 'low' | 'normal' | 'high' | null;

  // 数据来源
  provenance?: {
    marketData: string;
    companyInfo: string;
    news: string;
    aiAnalysis: string;
  } | null;
  structureLabel?: 'uptrend' | 'downtrend' | 'sideways' | 'breakout' | 'high-volatility' | null;
  newsLabel?: 'positive' | 'neutral' | 'negative' | null;
  riskLevel?: 'low' | 'medium' | 'high' | null;

  // 新增字段（实际使用中）
  overallScore?: number | null;
  confidence?: number | null;
  conciseReason?: string | null;

  // AI source tracking
  analysisSource?: string | null;
  aiCalled?: boolean;
  aiSource?: string | null;
  aiModel?: string | null;
  aiError?: string | null;
}

const Portfolio: React.FC = (): React.ReactElement => {
  console.log('Portfolio component rendering');
  // AI Agent 状态 - Step 2: 只做 UI，不接真实逻辑
  const [aiConfig, setAiConfig] = useState({
    apiKey: '',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    provider: 'DeepSeek'
  });

  const [aiConfigForm] = Form.useForm();
  const [testingConnection, setTestingConnection] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Alpaca Paper Trading 真实账户状态
  const [alpacaOrders, setAlpacaOrders] = useState<any[]>([]);

  // Market Scanner 状态
  const [marketScannerStatus, setMarketScannerStatus] = useState({
    status: 'stopped' as 'stopped' | 'running' | 'scheduled',
    lastScanTime: null as string | null,
    nextScanTime: null as string | null,
    progress: 0,
    totalSymbols: 0,
    scannedSymbols: 0,
    // 新增字段用于详细进度显示
    currentSymbol: null as string | null,
    currentStatus: null as 'initializing' | 'scanning' | 'retrying' | 'validating' | 'validated' | 'queued' | 'queued_for_retry' | 'rendering' | 'completed' | 'failed' | 'error' | 'idle' | 'stopped' | null,
    currentBatch: null as number | null,
    batchProgress: null as string | null,
    retryAttempt: 0,
    maxRetryAttempts: 3
  });
  const [marketScannerResults, setMarketScannerResults] = useState<any[]>([]);

  // Preferred Continue Scan List 状态
  const [continueScanStatus, setContinueScanStatus] = useState<'idle' | 'processing' | 'completed' | 'error'>('idle');
  console.log('continueScanStatus defined');
  const [continueScanProgress, setContinueScanProgress] = useState(0);
  const [preferredContinueScanList, setPreferredContinueScanList] = useState<any[]>([]);
const [preferredContinuePage, setPreferredContinuePage] = useState(1);

  // Continue Scan 进度详情
  const [continueScanDetails, setContinueScanDetails] = useState({
    currentStage: '' as string,
    startTime: null as number | null,
    estimatedTimeRemaining: null as number | null,
    processedCount: 0,
    totalCount: 0
  });


  // Fine Scan 状态
  const [fineScanStatus, setFineScanStatus] = useState('idle');     
  const [fineScanResults, setFineScanResults] = useState<any[]>([]);
  const [fineScanProgress, setFineScanProgress] = useState(0);
  const [fineScanStepProgress, setFineScanStepProgress] = useState(0);
  const [fineScanCurrentStep, setFineScanCurrentStep] = useState<string>('');
  const [fineScanMessage, setFineScanMessage] = useState<string>('');
  // Trading Account Mode
  const [tradingAccountMode, setTradingAccountMode] = useState<'paper' | 'real'>(() => {
    const saved = localStorage.getItem('tradingAccountMode');
    return saved === 'paper' || saved === 'real' ? saved : 'paper';
  });
  const [tradingAccountData, setTradingAccountData] = useState<any>(null);
  const [tradingAccountLoading, setTradingAccountLoading] = useState(false);
  const [fineScanExpandedRows, setFineScanExpandedRows] = useState<string[]>([]);

  // AI调用互斥控制
  const [aiCallInProgress, setAiCallInProgress] = useState(false);
  const aiCallInProgressRef = useRef(false);

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

  // 手动启动Continue Scan的函数
  const handleStartContinueScan = (forceRerun: boolean = false) => {
    // 检查是否有market scan结果
    if (marketScannerResults.length === 0) {
      message.warning('No market scan results available. Run Market Scanner first.');
      return;
    }

    // 如果正在running，不能重复启动
    if (continueScanStatus === 'processing') {
      message.warning('Continue scan is already running');
      return;
    }

    // 如果completed且有force标志，允许re-run；如果idle，正常启动
    if (continueScanStatus === 'completed' && !forceRerun) {
      // 不应该到达这里（按钮会传force=true），但以防万一
      console.log('Continue scan already completed, use Re-run button');
      return;
    }

    const isRerun = continueScanStatus === 'completed' || continueScanStatus === 'error';
    console.log(isRerun ? 'Re-running continue scan...' : 'Starting continue scan...');

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
      setContinueScanDetails(prev => ({
        ...prev,
        currentStage: 'Initializing rule-based scan...',
        processedCount: 0,
        totalCount: marketScannerResults.length,
        estimatedTimeRemaining: null
      }));

      // 检查是否有有效的market scan结果
      if (marketScannerResults.length === 0) {
        setPreferredContinueScanList([]);
        setContinueScanStatus('completed');
        setContinueScanProgress(100);
        setContinueScanDetails(prev => ({
          ...prev,
          currentStage: 'No market scan results available',
          estimatedTimeRemaining: 0
        }));
        console.log('No market scan results available for continue scan');
        return;
      }

      // 阶段B: 读取market scan results (20%)
      setContinueScanProgress(20);
      setContinueScanDetails(prev => ({
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
      setContinueScanDetails(prev => ({
        ...prev,
        currentStage: 'Filtering bullish candidates...',
        estimatedTimeRemaining: null
      }));

      // 阶段D: 计算priority score (60%)
      setContinueScanProgress(60);
      setContinueScanDetails(prev => ({
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
        setContinueScanDetails(prev => ({
          ...prev,
          processedCount: i + 1
        }));

        // 检查是否有新的Market Scan开始
        if (detailedScanStatus.currentStatus === 'scanning') {
          console.log('New market scan started, aborting continue scan');
          setContinueScanStatus('error');
          setContinueScanProgress(0);
          setContinueScanDetails(prev => ({
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
        if (trend !== 'Bullish' && trend !== 'Strong Bullish') {
          continue; // 跳过不符合条件的候选
        }

        // 条件2: score >= 70
        if (score < 70) {
          continue; // 跳过不符合条件的候选
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
          const scannerAiCalled = originalData.aiCalled === true;
          const scannerAiSource = originalData.aiSource || 'Local Rules';
          const scannerAiModel = originalData.aiModel || null;
          const scannerAiError = originalData.aiError || null;

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
      setContinueScanDetails(prev => ({
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
      setContinueScanDetails(prev => ({
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
      setContinueScanDetails(prev => ({
        ...prev,
        currentStage: `Error: ${error instanceof Error ? error.message : String(error)}`,
        estimatedTimeRemaining: null
      }));
    }
  };

  // AI生成selection reason的函数
  const generateAiSelectionReasons = async (candidates: any[]) => {
    if (!candidates || candidates.length === 0) return;

    // 检查是否有新的Market Scan开始
    if (detailedScanStatus.currentStatus === 'scanning') {
      console.log('New market scan started, aborting AI reason generation');
      return;
    }

    console.log(`Starting AI reason generation for ${candidates.length} candidates`);

    // 设置AI调用状态
    setAiCallInProgress(true);

    try {
      // 批量处理，避免同时发起太多请求
      const batchSize = 5;
      const batches = [];

      for (let i = 0; i < candidates.length; i += batchSize) {
        batches.push(candidates.slice(i, i + batchSize));
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];

        // 更新进度
        const progressPercent = Math.round(((batchIndex * batchSize) / candidates.length) * 100);
        setContinueScanDetails(prev => ({
          ...prev,
          currentStage: `Generating AI reasons: batch ${batchIndex + 1}/${batches.length}`,
          estimatedTimeRemaining: Math.max(1, (batches.length - batchIndex) * 3) // 估算剩余时间
        }));

        // 并行处理批次内的candidate
        const promises = batch.map(async (candidate, indexInBatch) => {
          const globalIndex = batchIndex * batchSize + indexInBatch;

          try {
            // 更新状态为processing
            setPreferredContinueScanList(prev => {
              const newList = [...prev];
              if (newList[globalIndex]) {
                newList[globalIndex] = {
                  ...newList[globalIndex],
                  aiReasonStatus: 'processing'
                };
              }
              return newList;
            });

            // 构建AI上下文
            const aiContext = {
              symbol: candidate.symbol,
              trend: candidate.trendLabel,
              score: candidate.overallScore || candidate.trendScore || 0,
              risk: candidate.eventRisk || 'Medium',
              sector: candidate.sector || 'Unknown',
              priceChange: candidate.changePct || 0,
              volumeStatus: candidate.volumeStatus || 'Normal',
              newsSentiment: candidate.newsSentiment || 'Neutral',
              // 添加其他可用字段
              ...candidate
            };

            // 调用AI服务生成selection reason
            const aiResponse = await aiTradingService.previewTradeWithContext(candidate.symbol, aiContext);

            if (aiResponse.success && aiResponse.decision && aiResponse.decision.reason) {
              // 使用AI生成的reason
              const aiReason = aiResponse.decision.reason;

              // 更新列表中的selection reason
              setPreferredContinueScanList(prev => {
                const newList = [...prev];
                if (newList[globalIndex]) {
                  newList[globalIndex] = {
                    ...newList[globalIndex],
                    selectionReason: aiReason,
                    aiReasonStatus: 'completed',
                    reasonSource: 'AI',
                    aiCalled: true,
                    aiSource: 'DeepSeek',
                    aiModel: null,
                  };
                }
                return newList;
              });

              console.log(`AI reason generated for ${candidate.symbol}: ${aiReason.substring(0, 50)}...`);
            } else {
              // AI调用失败，使用fallback reason
              const fallbackReason = generateFallbackReason(candidate);

              setPreferredContinueScanList(prev => {
                const newList = [...prev];
                if (newList[globalIndex]) {
                  newList[globalIndex] = {
                    ...newList[globalIndex],
                    selectionReason: fallbackReason,
                    aiReasonStatus: 'failed',
                    reasonSource: 'Rule-based',
                    aiCalled: false,
                  };
                }
                return newList;
              });

              console.log(`AI reason generation failed for ${candidate.symbol}, using fallback: ${fallbackReason}`);
            }

          } catch (error) {
            console.error(`AI reason generation error for ${candidate.symbol}:`, error);

            // 错误处理：使用fallback reason
            const fallbackReason = generateFallbackReason(candidate);

            setPreferredContinueScanList(prev => {
              const newList = [...prev];
              if (newList[globalIndex]) {
                newList[globalIndex] = {
                  ...newList[globalIndex],
                  selectionReason: fallbackReason,
                  aiReasonStatus: 'failed',
                  reasonSource: 'Rule-based',
                  aiCalled: false,
                };
              }
              return newList;
            });
          }
        });

        // 等待当前批次完成
        await Promise.allSettled(promises);

        // 批次间短暂延迟，避免过载
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      console.log('AI reason generation completed for all candidates');
      setContinueScanDetails(prev => ({
        ...prev,
        currentStage: 'AI reason generation completed',
        estimatedTimeRemaining: 0
      }));

    } catch (error) {
      console.error('AI reason generation failed:', error);
      setContinueScanDetails(prev => ({
        ...prev,
        currentStage: `AI generation error: ${error instanceof Error ? error.message : String(error)}`,
        estimatedTimeRemaining: null
      }));
    } finally {
      // 无论成功还是失败，都重置AI调用状态
      setAiCallInProgress(false);
    }
  };

  // Fallback reason生成函数
  // Continue Scan专用的AI评估函数
  const evaluateContinueScanCandidate = async (symbol: string, context: any): Promise<any> => {
    try {
      console.log('Evaluating continue scan candidate:', { symbol, context });

      // 构建专门的continue scan prompt
      const prompt = `You are evaluating stocks for a "Continue Scan" list. This is NOT for trading decisions.

Based on the following market scan data, determine if this stock should be included in the continue scan shortlist:

Symbol: ${context.symbol}
Trend: ${context.trend}
Score: ${context.score}/100
Risk: ${context.risk}
Sector: ${context.sector}
Price Change: ${context.priceChange}%
Volume Status: ${context.volumeStatus}
News Sentiment: ${context.newsSentiment}
${context.companyName ? `Company: ${context.companyName}` : ''}
${context.marketCap ? `Market Cap: ${context.marketCap}` : ''}

Your task:
1. Should this stock be included in the continue scan shortlist? (true/false)
2. What priority score (1-100) should it have for follow-up analysis?
3. Provide a concise selection reason based ONLY on the market scan data above.

IMPORTANT:
- Do NOT mention trading, buying power, account balance, backtest results, or $0.00 prices
- Focus ONLY on the market scan data provided
- Base your decision on trend, score, risk, and other scan metrics
- For continue scan, prioritize bullish/strong bullish trends with good scores and manageable risk

Please respond in this exact JSON format:
{
  "include_in_continue_scan": true/false,
  "priority_score": 1-100,
  "selection_reason": "concise reason based on market scan data",
  "confidence": 0.0-1.0
}`;

      // 使用现有的AI服务，但使用专门的continue scan prompt
      const response = await aiTradingService.previewTradeWithContext(symbol, {
        ...context,
        prompt: prompt,
        task: 'continue_scan_evaluation_only',
        evaluation_type: 'continue_scan_shortlist'
      });

      console.log('Continue scan AI response:', response);

      // 解析AI响应
      if (response.success && response.decision && response.decision.reason) {
        const aiReason = response.decision.reason;

        // 尝试从AI响应中提取结构化数据
        try {
          // 首先尝试解析JSON格式的响应
          const jsonMatch = aiReason.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
              success: true,
              decision: {
                include_in_continue_scan: parsed.include_in_continue_scan || false,
                priority_score: parsed.priority_score || Math.round((response.decision.confidence || 0.5) * 100),
                selection_reason: parsed.selection_reason || response.decision.reason,
                confidence: parsed.confidence || response.decision.confidence || 0.5
              }
            };
          }
        } catch (e) {
          console.log('Failed to parse JSON from AI response, using fallback parsing');
        }

        // 如果无法解析JSON，使用启发式方法
        const lowerReason = aiReason.toLowerCase();

        // 检查是否包含交易/账户相关的不相关内容
        const unwantedPatterns = [
          /\$0\.00/,
          /zero volume/i,
          /no backtest/i,
          /buying power/i,
          /account balance/i,
          /trade/i,
          /position/i,
          /order/i
        ];

        let hasUnwantedContent = false;
        for (const pattern of unwantedPatterns) {
          if (pattern.test(aiReason)) {
            hasUnwantedContent = true;
            console.warn(`AI response contains unwanted content for continue scan: ${pattern}`);
            break;
          }
        }

        // 如果包含不相关内容，使用fallback
        if (hasUnwantedContent) {
          console.log(`AI response contains trading/account context for ${symbol}, using fallback`);
          throw new Error('AI response contains trading context, not suitable for continue scan');
        }

        // 基于AI响应决定是否入选
        const includeKeywords = ['include', 'recommend', 'select', 'worth', 'good', 'strong', 'bullish', 'positive', 'follow-up'];
        const excludeKeywords = ['exclude', 'not recommend', 'avoid', 'weak', 'bearish', 'negative', 'risk', 'skip'];

        let includeScore = 0;
        let excludeScore = 0;

        includeKeywords.forEach(keyword => {
          if (lowerReason && typeof lowerReason === 'string' && lowerReason.includes(keyword)) includeScore++;
        });

        excludeKeywords.forEach(keyword => {
          if (lowerReason && typeof lowerReason === 'string' && lowerReason.includes(keyword)) excludeScore++;
        });

        const confidence = response.decision.confidence || 0.5;
        const includeInContinueScan = (confidence > 0.6 && includeScore > excludeScore) ||
                                     (confidence > 0.7 && includeScore >= excludeScore);

        // 基于趋势和分数调整priority
        let priorityScore = Math.round(confidence * 100);
        if (context.trend === 'Strong Bullish') priorityScore += 20;
        if (context.trend === 'Bullish') priorityScore += 10;
        if (context.trend === 'Bearish') priorityScore -= 15;
        if (context.trend === 'Strong Bearish') priorityScore -= 25;
        if (context.score > 80) priorityScore += 10;
        if (context.score > 60) priorityScore += 5;
        if (context.risk === 'Low') priorityScore += 5;
        if (context.risk === 'High') priorityScore -= 10;

        priorityScore = Math.max(1, Math.min(100, priorityScore));

        return {
          success: true,
          decision: {
            include_in_continue_scan: includeInContinueScan,
            priority_score: priorityScore,
            selection_reason: aiReason,
            confidence: confidence
          }
        };
      }

      // AI调用失败
      return {
        success: false,
        decision: null
      };

    } catch (error) {
      console.error(`Continue scan evaluation error for ${symbol}:`, error);
      return {
        success: false,
        decision: null
      };
    }
  };

  const generateFallbackReason = (candidate: any): string => {
    const trend = candidate.trendLabel || 'N/A';
    const score = candidate.overallScore ?? candidate.trendScore ?? null;
    const risk = candidate.eventRisk || 'N/A';
    const scoreStr = score != null ? String(score) : 'N/A';

    return `[AI unavailable] Rule-based: ${trend} trend, score ${scoreStr}, risk ${risk}. AI selection reason could not be generated.`;
  };

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
  const calculateFallbackPriority = (candidate: any): number => {
    const trend = candidate.trendLabel;
    const score = candidate.overallScore || candidate.trendScore || 0;
    const risk = candidate.eventRisk || 'Medium';

    // 基础分数
    let priorityScore = score;

    // 趋势加成
    if (trend === 'Strong Bullish') priorityScore += 30;
    if (trend === 'Bullish') priorityScore += 20;
    if (trend === 'Neutral') priorityScore += 10;
    if (trend === 'Bearish') priorityScore -= 10;

    // 风险调整
    if (risk === 'Low') priorityScore += 15;
    if (risk === 'Medium') priorityScore += 5;
    if (risk === 'High') priorityScore -= 20;

    // 确保分数在合理范围内
    priorityScore = Math.max(0, Math.min(100, priorityScore));

    return Math.round(priorityScore);
  };

  const [marketScannerSummary, setMarketScannerSummary] = useState({
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
  const marketScannerStopRequestedRef = useRef(false);
  const marketScannerIsScanningRef = useRef(false);

  // 展开行状态
  const [expandedRows, setExpandedRows] = useState<string[]>([]);

  // 扫描控制标记
  const stopRequestedRef = useRef(false);
  const activeSymbolsRef = useRef<string[]>([]);
  const retryCountRef = useRef<number>(0);
  const validatedCountRef = useRef<number>(0);

  // 跟踪是否已经处理过当前批次的market scan results
  const processedResultsSignatureRef = useRef<string>('');

  // 详细扫描状态
  const [detailedScanStatus, setDetailedScanStatus] = useState({
    currentStatus: 'idle' as 'idle' | 'scanning' | 'stopping' | 'stopped' | 'completed' | 'error',
    processedCount: 0,
    totalCount: 0,
    percent: 0,
    activeSymbols: [] as string[],
    retryCount: 0,
    validatedCount: 0,
    lastScanAt: null as string | null,
    nextScanAt: null as string | null,
    statusMessage: '' as string
  });

  // Step 3: 加载 AI 配置（接入真实配置系统）
  useEffect(() => {
    loadAiConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load trading account data on mount
  useEffect(() => {
    handleTradingAccountModeChange(tradingAccountMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      stopRequestedRef.current = true;
    };
  }, []);

  // 同步 AI 调用状态到 ref
  useEffect(() => {
    aiCallInProgressRef.current = aiCallInProgress;
  }, [aiCallInProgress]);

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

  const loadAiConfig = async () => {
    try {
      const response = await aiTradingService.getProviderConfig();

      if (response.success && response.config) {
        const config = response.config;

        // Provider合法化：只允许合法的provider
        const allowedProviders = ['DeepSeek', 'OpenAI', 'Claude'] as const;
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
  const loadAlpacaAccount = async () => {
    try {
      console.log('开始加载 Alpaca Paper Trading 账户数据...');

      // 获取账户信息 - 直接使用导入的alpacaBrokerService实例
      const account = await alpacaBrokerService.getAccount();
      console.log('Alpaca 账户数据加载成功:', account);

      // 获取持仓信息
      let positions: AlpacaPosition[] = [];
      try {
        positions = await alpacaBrokerService.getPositions();
        console.log(`Alpaca 持仓数据加载成功: ${positions.length} 个持仓`);
      } catch (positionsError) {
        console.warn('获取持仓数据失败:', positionsError);
      }

      // 获取订单信息
      let orders: AlpacaOrder[] = [];
      try {
        orders = await alpacaBrokerService.getOrders();
        setAlpacaOrders(orders);
        console.log(`Alpaca 订单数据加载成功: ${orders.length} 个订单`);
      } catch (ordersError) {
        console.warn('获取订单数据失败:', ordersError);
        setAlpacaOrders([]);
      }

      return {
        account,
        positions,
        orders
      };
    } catch (error: any) {
      console.error('加载 Alpaca 账户数据失败:', error);
      const errorMessage = error.response?.data?.error?.message || error.message || '未知错误';
      message.error(`Alpaca 账户数据加载失败: ${errorMessage}`);

      // 返回null表示失败
      return null;
    }
  };

  // Step 3: AI 配置保存（接入真实配置系统）
  const handleSaveAiConfig = async (values: any) => {
    setSavingConfig(true);
    try {
      // 构建符合 AIProviderConfig 接口的配置对象
      const config: AIProviderConfig = {
        provider: values.provider || 'DeepSeek',
        model: values.model || 'deepseek-chat',
        apiKey: values.apiKey || '',
        baseUrl: values.baseUrl || 'https://api.deepseek.com'
      };

      // 调用真实保存接口
      const response = await aiTradingService.saveProviderConfig(config);

      if (response.success) {
        message.success('AI 配置保存成功');

        // 更新本地状态
        setAiConfig(config);

        // 重新加载配置以确保与后端同步
        await loadAiConfig();
      } else {
        message.error('AI 配置保存失败');
        console.error('保存配置失败，响应:', response);
      }
    } catch (error: any) {
      console.error('保存 AI 配置失败:', error);
      message.error(`保存 AI 配置失败: ${error.message || '未知错误'}`);
    } finally {
      setSavingConfig(false);
    }
  };

  // Step 3: 测试 AI 连接（接入真实测试系统）
  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      // 获取当前表单值
      const values = await aiConfigForm.validateFields();

      // 构建符合 AIProviderConfig 接口的配置对象
      const config: AIProviderConfig = {
        provider: values.provider || 'DeepSeek',
        model: values.model || 'deepseek-chat',
        apiKey: values.apiKey || '',
        baseUrl: values.baseUrl || 'https://api.deepseek.com'
      };

      // 调用真实测试接口
      const response = await aiTradingService.testProviderConnection(config);

      if (response.success && response.valid) {
        message.success(`AI 连接测试成功: ${response.message || '连接正常'}`);
      } else {
        message.error(`AI 连接测试失败: ${response.message || '连接失败'}`);
        console.error('连接测试失败，响应:', response);
      }
    } catch (error: any) {
      console.error('测试 AI 连接失败:', error);
      message.error(`测试 AI 连接失败: ${error.message || '未知错误'}`);
    } finally {
      setTestingConnection(false);
    }
  };

  // Market Scanner 函数
  const runMarketScanner = async (): Promise<void> => {
    // 重置停止标记
    stopRequestedRef.current = false;
    marketScannerStopRequestedRef.current = false;

    // 设置扫描状态 ref
    marketScannerIsScanningRef.current = true;

    // 设置详细状态
    setDetailedScanStatus(prev => ({
      ...prev,
      currentStatus: 'scanning',
      processedCount: 0,
      percent: 0,
      activeSymbols: [],
      retryCount: 0,
      validatedCount: 0,
      statusMessage: 'Starting scan...'
    }));

    setMarketScannerStatus(prev => ({ ...prev, status: 'running', progress: 0 }));
    setMarketScannerResults([]);

    try {
      console.log('开始市场扫描...');

      // 1. 获取固定50个symbol universe (30个科技股 + 20个非科技股)
      const tradingSymbols = await getTradingUniverse();

      if (!tradingSymbols || tradingSymbols.length === 0) {
        console.warn('没有获取到可交易股票列表，使用默认股票池');
        // 使用默认股票池作为后备
        const defaultSymbols = [
          'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META',
          'TSLA', 'NVDA', 'AMD', 'AVGO', 'INTC',
          'JPM', 'XOM', 'WMT', 'HD', 'JNJ',
          'PG', 'KO', 'PEP', 'V', 'MA'
        ];
        await scanSymbols(defaultSymbols);
      } else {
        // 使用完整的50个symbol universe
        console.log(`开始扫描固定universe: ${tradingSymbols.length}个symbol`);
        await scanSymbols(tradingSymbols);
      }

      // 检查是否被停止
      if (stopRequestedRef.current || marketScannerStopRequestedRef.current) {
        console.log('扫描被用户停止');
        setDetailedScanStatus(prev => ({
          ...prev,
          currentStatus: 'stopped',
          statusMessage: 'Scan stopped by user'
        }));
        setMarketScannerStatus(prev => ({ ...prev, status: 'stopped' }));
        marketScannerIsScanningRef.current = false;
        return;
      }

      // 扫描完成，更新最后扫描时间
      const now = new Date().toISOString();
      setDetailedScanStatus(prev => ({
        ...prev,
        currentStatus: 'completed',
        lastScanAt: now,
        statusMessage: 'Scan completed'
      }));
      setMarketScannerStatus(prev => ({ ...prev, status: 'stopped', lastScanTime: now }));

      // 清除扫描状态 ref
      marketScannerIsScanningRef.current = false;

      console.log('市场扫描完成');

    } catch (error: any) {
      console.error('=== 市场扫描失败 - 外层catch捕获的完整错误 ===');
      console.error('错误消息:', error?.message);
      console.error('错误堆栈:', error?.stack);
      console.error('错误名称:', error?.name);
      console.error('错误代码:', error?.code);
      console.error('完整错误对象:', error);

      // 如果是Axios错误，打印更多信息
      if (error?.isAxiosError) {
        console.error('Axios错误详情:');
        console.error('状态码:', error?.response?.status);
        console.error('状态文本:', error?.response?.statusText);
        console.error('响应数据:', error?.response?.data);
        console.error('请求URL:', error?.config?.url);
        console.error('请求方法:', error?.config?.method);
      }

      setDetailedScanStatus(prev => ({
        ...prev,
        currentStatus: 'error',
        statusMessage: `Error: ${error.message || 'Unknown error'}`
      }));
      setMarketScannerStatus(prev => ({ ...prev, status: 'stopped' }));
      // 清除扫描状态 ref
      marketScannerIsScanningRef.current = false;
      message.error('市场扫描失败');
    }
  };

  const getTradingUniverse = async (): Promise<string[]> => {
    try {
      // 固定50个symbol universe：30个科技股 + 20个非科技股

      // 1. 科技股 (30个) - 必须包含：AAPL, TSLA, NVDA, AMD, RKLB, SNDK
      const techStocks = [
        // 必须包含的科技股 (6个)
        'AAPL', 'TSLA', 'NVDA', 'AMD', 'RKLB', 'SNDK',

        // 其他热门科技股 (24个)
        'MSFT', 'GOOGL', 'AMZN', 'META', 'AVGO', 'INTC',
        'QCOM', 'TXN', 'MU', 'AMAT', 'LRCX', 'KLAC',
        'ASML', 'ADBE', 'CRM', 'ORCL', 'IBM', 'CSCO',
        'ACN', 'NOW', 'SNOW', 'DDOG', 'CRWD', 'ZS'
      ];

      // 2. 非科技股 (20个) - 不能包含科技股
      const nonTechStocks = [
        // 金融 (5个)
        'JPM', 'BAC', 'WFC', 'GS', 'C',

        // 医疗 (4个)
        'JNJ', 'UNH', 'PFE', 'MRK',

        // 消费 (4个)
        'WMT', 'PG', 'KO', 'PEP',

        // 工业 (3个)
        'CAT', 'HON', 'BA',

        // 能源 (2个)
        'XOM', 'CVX',

        // 材料 (1个)
        'LIN',

        // 公用事业 (1个)
        'NEE'
      ];

      // 3. 合并并确保总数正好50个
      const allStocks = [...techStocks, ...nonTechStocks];

      // 验证数量
      if (techStocks.length !== 30) {
        console.error(`科技股数量错误: ${techStocks.length}, 应为30个`);
      }
      if (nonTechStocks.length !== 20) {
        console.error(`非科技股数量错误: ${nonTechStocks.length}, 应为20个`);
      }
      if (allStocks.length !== 50) {
        console.error(`总股票数量错误: ${allStocks.length}, 应为50个`);
      }

      console.log(`固定universe生成完成: ${techStocks.length}个科技股 + ${nonTechStocks.length}个非科技股 = ${allStocks.length}个symbol`);
      console.log(`科技股: ${techStocks.slice(0, 10).join(', ')}${techStocks.length > 10 ? '...' : ''}`);
      console.log(`非科技股: ${nonTechStocks.slice(0, 10).join(', ')}${nonTechStocks.length > 10 ? '...' : ''}`);

      return allStocks;
    } catch (error) {
      console.error('获取交易股票列表失败:', error);
      return [];
    }
  };

  // 处理单个symbol的函数
  // eslint-disable-next-line no-unreachable
  const processSingleSymbol = async (symbol: string, retryCount: number = 0): Promise<any> => {
    try {
      console.log(`[${symbol}] === 开始处理symbol (第${retryCount + 1}次尝试) ===`);

      // 获取股票数据
      console.log(`[${symbol}] 开始获取stockData...`);
      const stockData = await marketDataService.getStockData(symbol);
      console.log(`[${symbol}] stockData获取完成:`, {
        hasPrice: stockData?.price !== null && stockData?.price !== undefined,
        price: stockData?.price,
        hasVolume: stockData?.volume !== null && stockData?.volume !== undefined,
        volume: stockData?.volume,
        changePct: stockData?.changePct,
        changePercent: stockData?.changePercent,
        dayHigh: stockData?.dayHigh,
        dayLow: stockData?.dayLow
      });

      // 获取新闻数据（真实API）
      console.log(`[${symbol}] 开始获取newsData...`);
      const newsData = await getStockNews(symbol);
      console.log(`[${symbol}] newsData获取完成:`, {
        hasSentiment: !!newsData?.sentiment,
        sentiment: newsData?.sentiment,
        hasTopNews: !!newsData?.topNews,
        topNews: newsData?.topNews
      });

      // 获取公司名（真实API）
      console.log(`[${symbol}] 开始获取companyName...`);
      const companyName = await getCompanyName(symbol);
      console.log(`[${symbol}] companyName获取完成:`, companyName);

      // 计算趋势分数和标签（真实AI分析）
      console.log(`[${symbol}] 开始analyzeTrend...`);
      const trendAnalysis = await analyzeTrend(symbol, stockData, newsData);
      console.log(`[${symbol}] analyzeTrend完成:`, {
        hasTrendLabel: !!trendAnalysis.trendLabel,
        trendLabel: trendAnalysis.trendLabel,
        hasTrendScore: !!trendAnalysis.trendScore,
        trendScore: trendAnalysis.trendScore,
        hasAiReasoning: !!trendAnalysis.aiReasoning
      });

      // 创建结果对象
      const result = {
        symbol,
        companyName: trendAnalysis.companyName || companyName,
        trendLabel: trendAnalysis.trendLabel,
        trendScore: trendAnalysis.trendScore || trendAnalysis.overallScore || null,
        trendConfidence: trendAnalysis.trendConfidence || trendAnalysis.confidence || null,
        price: stockData.price || null,
        changePct: stockData.changePct || stockData.changePercent || null, // 使用changePct字段
        changePercent: stockData.changePercent || null, // 保留原字段
        volume: stockData.volume || null,
        marketCap: stockData.marketCap || null,
        dayHigh: stockData.dayHigh || null, // 添加dayHigh
        dayLow: stockData.dayLow || null,   // 添加dayLow
        newsSentiment: trendAnalysis.newsSentiment || newsData.sentiment,
        eventRisk: trendAnalysis.eventRisk || newsData.eventRisk,
        topNews: trendAnalysis.topNews || newsData.topNews,
        sector: stockData.sector || trendAnalysis.sector,
        scannerReason: trendAnalysis.scannerReason,
        trendScoreDetail: trendAnalysis.trendScoreDetail,
        momentumScore: trendAnalysis.momentumScore,
        volumeScore: trendAnalysis.volumeScore,
        volatilityScore: trendAnalysis.volatilityScore,
        structureScore: trendAnalysis.structureScore,
        newsScore: trendAnalysis.newsScore,
        aiReasoning: trendAnalysis.aiReasoning,
        detailedReasoning: trendAnalysis.detailedReasoning,
        conciseReasoning: trendAnalysis.conciseReasoning,
        volumeStatus: trendAnalysis.volumeStatus,
        provenance: trendAnalysis.provenance || {
          marketData: stockData.dataSource || 'Unknown',
          companyInfo: (stockData as any).profileSource || 'Finnhub',
          news: newsData?.source || 'Unknown',
          aiAnalysis: trendAnalysis.analysisSource === 'deepseek' ? 'DeepSeek' :
                     trendAnalysis.analysisSource === 'unavailable' ? 'unavailable' :
                     trendAnalysis.analysisSource === 'rule_based' ? 'Local Rules' : 'Unknown'
        },
        dataSource: stockData.dataSource || 'Unknown',
        analysisStatus: trendAnalysis.trendLabel ? 'success' as 'success' : 'partial' as 'partial',
        analysisError: trendAnalysis.aiError || null,

        // AI source tracking
        aiCalled: trendAnalysis.aiCalled !== undefined ? trendAnalysis.aiCalled : (trendAnalysis.analysisSource === 'deepseek'),
        aiSource: trendAnalysis.aiSource || (trendAnalysis.analysisSource === 'deepseek' ? 'DeepSeek' :
                 trendAnalysis.analysisSource === 'unavailable' ? 'unavailable' :
                 trendAnalysis.analysisSource === 'rule_based' ? 'Local Rules' : 'Unknown'),
        aiModel: trendAnalysis.aiModel || null,
        aiError: trendAnalysis.aiError || null,
        timestamp: new Date().toISOString()
      };

      console.log(`[${symbol}] 处理成功:`, {
        trendLabel: result.trendLabel,
        trendScore: result.trendScore,
        changePct: result.changePct,
        sector: result.sector
      });

      // 检查数据完整性
      const validation = validateSymbolData(result);
      if (!validation.valid) {
        console.warn(`[${symbol}] 关键字段缺失，需要重试。缺失关键字段: ${validation.missingFields.join(', ')}`);
        console.log(`[${symbol}] 详细字段状态:`, {
          symbol: result.symbol,
          price: result.price,
          changePct: result.changePct,
          changePercent: result.changePercent,
          volume: result.volume,
          trendLabel: result.trendLabel,
          trendScore: result.trendScore,
          aiReasoning: result.aiReasoning
        });

        // 如果还有重试次数，抛出错误以触发重试
        if (retryCount < 2) { // 最多重试2次（加上当前这次共3次）
          throw new Error(`关键字段缺失，需要重试。缺失字段: ${validation.missingFields.join(', ')}`);
        } else {
          console.error(`[${symbol}] 已达到最大重试次数(3)，关键字段仍缺失`);
          // 即使关键字段缺失，也返回结果，但标记为部分成功
          result.analysisStatus = 'partial' as 'partial';
          (result as any).analysisError = `关键字段缺失: ${validation.missingFields.join(', ')}`;
        }
      }

      return result;

    } catch (error: any) {
      console.error(`扫描 ${symbol} 失败:`, error);

      // 创建失败结果
      const failedResult = {
        symbol,
        companyName: null,
        trendLabel: null,
        trendScore: null,
        trendConfidence: null,
        price: null,
        changePct: null,
        changePercent: null,
        volume: null,
        marketCap: null,
        newsSentiment: null,
        eventRisk: null,
        topNews: null,
        sector: null,
        scannerReason: null,
        trendScoreDetail: null,
        momentumScore: null,
        volumeScore: null,
        volatilityScore: null,
        structureScore: null,
        newsScore: null,
        aiReasoning: null,
        detailedReasoning: null,
        conciseReasoning: null,
        volumeStatus: null,
        analysisStatus: 'failed' as 'failed',
        analysisError: error?.message || 'Unknown error',
        timestamp: new Date().toISOString()
      };

      console.warn(`[${symbol}] 处理失败:`, {
        analysisStatus: 'failed',
        analysisError: error?.message
      });

      return failedResult;
    }
  };

    const scanSymbols = async (symbols: string[]): Promise<void> => {
    try {
      console.log('=== scanSymbols 开始执行（小并发滑动窗口） ===');
      console.log('总symbols数:', symbols.length);
      console.log('symbols列表:', symbols);

      const totalSymbols = symbols.length;
      const RENDER_BATCH_SIZE = 10; // 每10个完整结果渲染一批

      // 更新详细状态
      setDetailedScanStatus(prev => ({
        ...prev,
        totalCount: totalSymbols,
        processedCount: 0,
        percent: 0,
        activeSymbols: [],
        retryCount: 0,
        validatedCount: 0,
        statusMessage: `Starting scan of ${totalSymbols} symbols`
      }));

      // 并发配置（按照用户要求）
      const CONCURRENT_CONFIG = {
        windowSize: 3,           // 滑动窗口大小：同时处理3个symbols
        marketDataConcurrent: 3, // 市场数据并发数
        finnhubConcurrent: 2,    // Finnhub并发数
        aiConcurrent: 2,         // AI分析并发数
        maxRetries: 3            // 最大重试次数
      };

      console.log('并发配置:', CONCURRENT_CONFIG);

      setMarketScannerStatus(prev => ({
        ...prev,
        totalSymbols,
        scannedSymbols: 0,
        currentStatus: 'initializing',
        currentSymbol: '',
        currentBatch: 0,
        batchProgress: '',
        retryAttempt: 0,
        maxRetryAttempts: CONCURRENT_CONFIG.maxRetries
      }));

      // 1. 清空结果，从头开始
      console.log('=== 清空结果，开始滑动窗口扫描 ===');
      setMarketScannerResults([]);

      // 2. 初始化数据结构
      const pendingSymbols = [...symbols]; // 待处理的symbols队列
      const validatedBuffer: any[] = [];   // 已验证的完整结果缓冲区
      const retryQueue: Array<{symbol: string, retryCount: number, lastError?: string}> = []; // 重试队列
      const processingSlots = new Set<string>(); // 正在处理的symbols
      const failedSymbols: Array<{symbol: string, error: string}> = []; // 失败symbols记录

      let totalProcessed = 0;
      let totalValidated = 0;
      let totalRetries = 0;

      // 单个symbol处理函数
      const startProcessing = async (symbol: string, retryCount: number, lastError?: string) => {
        // 检查停止标记
        if (stopRequestedRef.current) {
          console.log(`[${symbol}] 停止请求已收到，跳过处理`);
          return;
        }

        processingSlots.add(symbol);
        totalProcessed++;

        // 更新状态
        setMarketScannerStatus(prev => ({
          ...prev,
          currentSymbol: symbol,
          currentStatus: retryCount > 0 ? 'retrying' : 'scanning',
          retryAttempt: retryCount
        }));

        console.log(`[${symbol}] 开始处理 (重试 ${retryCount}/${CONCURRENT_CONFIG.maxRetries})`);
        if (lastError) {
          console.log(`[${symbol}] 上次错误: ${lastError}`);
        }

        try {
          // 处理单个symbol，传递重试计数
          const result = await processSingleSymbol(symbol, retryCount);

          // 严格校验数据（按照用户要求的校验规则）
          const validation = validateSymbolData(result);

          if (validation.valid && result.analysisStatus !== 'partial') {
            // 校验通过且数据完整，加入validatedBuffer
            console.log(`[${symbol}] ✅ 数据校验通过 (第${retryCount + 1}次尝试)`);
            validatedBuffer.push(result);
            totalValidated++;

            // 更新状态
            setMarketScannerStatus(prev => ({
              ...prev,
              currentStatus: 'validated',
              batchProgress: `${validatedBuffer.length}/${RENDER_BATCH_SIZE}`
            }));

          } else if (retryCount < CONCURRENT_CONFIG.maxRetries) {
            // 准备重试
            console.log(`[${symbol}] ❌ 数据校验失败: ${validation.error}`);
            console.log(`[${symbol}] 准备重试 (${retryCount + 1}/${CONCURRENT_CONFIG.maxRetries})`);

            retryQueue.push({
              symbol,
              retryCount,
              lastError: validation.error
            });

            // 更新状态
            setMarketScannerStatus(prev => ({
              ...prev,
              currentStatus: 'queued_for_retry'
            }));

          } else {
            // 超过最大重试次数，标记失败
            console.warn(`[${symbol}] ❌ 超过最大重试次数，标记失败: ${validation.error}`);
            failedSymbols.push({
              symbol,
              error: validation.error || 'Unknown error'
            });

            // 更新状态
            setMarketScannerStatus(prev => ({
              ...prev,
              currentStatus: 'failed'
            }));
          }

        } catch (error: any) {
          console.error(`[${symbol}] 处理异常:`, error);

          // 检查是否是数据不完整错误
          const isDataIncompleteError = error.message?.includes('数据不完整');

          if (retryCount < CONCURRENT_CONFIG.maxRetries) {
            // 准备重试
            console.log(`[${symbol}] 准备重试异常 (${retryCount + 1}/${CONCURRENT_CONFIG.maxRetries})`);
            console.log(`[${symbol}] 错误类型: ${isDataIncompleteError ? '数据不完整' : '其他错误'}`);

            retryQueue.push({
              symbol,
              retryCount,
              lastError: error.message || 'Processing error'
            });

          } else {
            // 超过最大重试次数，标记失败
            console.warn(`[${symbol}] ❌ 超过最大重试次数，标记失败: ${error.message}`);
            console.log(`[${symbol}] 最终状态: ${isDataIncompleteError ? '数据仍不完整' : '处理失败'}`);

            failedSymbols.push({
              symbol,
              error: error.message || 'Unknown error'
            });
          }

        } finally {
          // 释放slot
          processingSlots.delete(symbol);
          console.log(`[${symbol}] 处理完成，释放slot，当前活动slots: ${Array.from(processingSlots).join(', ') || 'none'}`);
        }
      };

      // 渲染已验证的批次
      const renderValidatedBatch = () => {
        const batchToRender = validatedBuffer.splice(0, RENDER_BATCH_SIZE);
        console.log(`=== 渲染批次 (${batchToRender.length}个symbols) ===`);
        console.log('渲染symbols:', batchToRender.map(r => r.symbol).join(', '));

        setMarketScannerStatus(prev => ({
          ...prev,
          currentStatus: 'rendering',
          currentSymbol: `Rendering ${batchToRender.length} symbols`
        }));

        // 使用函数式更新确保追加正确
        setMarketScannerResults(prevResults => {
          const newResults = [...prevResults, ...batchToRender];
          console.log(`追加后结果数量: ${newResults.length}`);
          return newResults;
        });

        console.log('UI更新完成');

        setMarketScannerStatus(prev => ({
          ...prev,
          currentStatus: 'scanning',
          batchProgress: `${validatedBuffer.length}/${RENDER_BATCH_SIZE}`
        }));
      };

      // 3. 初始化滑动窗口
      console.log('=== 初始化滑动窗口 ===');
      while (processingSlots.size < CONCURRENT_CONFIG.windowSize && pendingSymbols.length > 0) {
        const symbol = pendingSymbols.shift()!;
        startProcessing(symbol, 0);
      }

      console.log(`初始窗口: ${Array.from(processingSlots).join(', ')}`);
      console.log(`剩余待处理: ${pendingSymbols.length} symbols`);

      // 4. 主处理循环
      console.log('=== 开始主处理循环 ===');
      while (processingSlots.size > 0 || pendingSymbols.length > 0 || retryQueue.length > 0) {
        // 检查停止标记
        if (stopRequestedRef.current) {
          console.log('检测到停止请求，退出扫描循环');
          break;
        }

        // 等待一小段时间，避免CPU占用过高
        await new Promise(resolve => setTimeout(resolve, 100));

        // 更新进度状态（按照用户要求的进度条规则）
        const progressPercent = Math.round((totalProcessed / totalSymbols) * 100);
        const validatedProgress = `${totalValidated}/${RENDER_BATCH_SIZE}`;
        const activeSymbols = Array.from(processingSlots);

        // 更新详细状态
        setDetailedScanStatus(prev => ({
          ...prev,
          processedCount: totalProcessed,
          percent: progressPercent,
          activeSymbols: activeSymbols,
          retryCount: totalRetries,
          validatedCount: totalValidated,
          statusMessage: activeSymbols.length > 0
            ? `Scanning: ${activeSymbols.join(', ')}`
            : 'Processing queue...'
        }));

        setMarketScannerStatus(prev => ({
          ...prev,
          progress: progressPercent,
          scannedSymbols: totalProcessed,
          currentStatus: processingSlots.size > 0 ? 'scanning' : 'idle',
          currentSymbol: activeSymbols.join(', ') || 'Waiting...',
          batchProgress: validatedProgress,
          retryAttempt: totalRetries
        }));

        // 处理retryQueue（优先级较低）
        if (processingSlots.size < CONCURRENT_CONFIG.windowSize && retryQueue.length > 0) {
          const retryItem = retryQueue.shift()!;
          console.log(`[retryQueue] 处理重试: ${retryItem.symbol} (重试 ${retryItem.retryCount + 1}/${CONCURRENT_CONFIG.maxRetries})`);
          startProcessing(retryItem.symbol, retryItem.retryCount + 1, retryItem.lastError);
          totalRetries++;
        }

        // 处理新symbols
        if (processingSlots.size < CONCURRENT_CONFIG.windowSize && pendingSymbols.length > 0) {
          const symbol = pendingSymbols.shift()!;
          startProcessing(symbol, 0);
        }

        // 检查是否需要渲染（收集到10个完整结果就渲染）
        if (validatedBuffer.length >= RENDER_BATCH_SIZE) {
          renderValidatedBatch();
        }
      }

      // 5. 处理最后一批（可能不满10个）- only if not stopped
      if (!stopRequestedRef.current && !marketScannerStopRequestedRef.current) {
        console.log('=== 处理最后一批 ===');
        if (validatedBuffer.length > 0) {
          renderValidatedBatch();
        }
      }

      // 6. 扫描完成或被停止
      if (stopRequestedRef.current || marketScannerStopRequestedRef.current) {
        console.log('=== 扫描被用户停止 ===');
        console.log(`已处理: ${totalProcessed}, 已验证: ${totalValidated}, 失败: ${failedSymbols.length}`);

        setMarketScannerStatus(prev => ({
          ...prev,
          progress: Math.round((totalProcessed / totalSymbols) * 100),
          scannedSymbols: totalProcessed,
          currentStatus: 'stopped',
          currentSymbol: 'Stopped by user',
          batchProgress: `Stopped at ${totalProcessed}/${totalSymbols}`,
          retryAttempt: totalRetries
        }));

        setDetailedScanStatus(prev => ({
          ...prev,
          currentStatus: 'stopped',
          processedCount: totalProcessed,
          totalCount: totalSymbols,
          percent: Math.round((totalProcessed / totalSymbols) * 100),
          validatedCount: totalValidated,
          lastScanAt: new Date().toISOString(),
          statusMessage: `Stopped at ${totalProcessed}/${totalSymbols} symbols — ${marketScannerResults.length + validatedBuffer.length} results retained`
        }));

        marketScannerIsScanningRef.current = false;
        return;
      }

      console.log('=== 扫描完成 ===');
      console.log(`总处理: ${totalProcessed}, 成功: ${totalValidated}, 失败: ${failedSymbols.length}, 重试: ${totalRetries}`);

      if (failedSymbols.length > 0) {
        console.warn('失败的symbols:', failedSymbols);
      }

      // 设置market scanner状态
      setMarketScannerStatus(prev => ({
        ...prev,
        progress: 100,
        scannedSymbols: totalProcessed,
        currentStatus: 'completed',
        currentSymbol: 'Scan completed',
        batchProgress: 'Completed',
        retryAttempt: totalRetries
      }));

      // 同时设置detailed scan状态为completed
      setDetailedScanStatus(prev => ({
        ...prev,
        currentStatus: 'completed',
        processedCount: totalProcessed,
        totalCount: totalSymbols,
        percent: 100,
        validatedCount: totalValidated,
        lastScanAt: new Date().toISOString(),
        statusMessage: `Scan completed: ${totalValidated}/${totalSymbols} symbols validated`
      }));

    } catch (error: any) {
      console.error('scanSymbols 主循环异常:', error);
      setMarketScannerStatus(prev => ({
        ...prev,
        currentStatus: 'error',
        currentSymbol: `Error: ${error.message}`,
        analysisError: error.message
      }));
    }
  };

  const getCompanyName = async (symbol: string): Promise<string> => {
    try {
      // 从marketDataService获取真实公司名
      const stockData = await marketDataService.getStockData(symbol);
      if (stockData?.name) {
        return stockData.name;
      }
      // 如果API没有返回公司名，返回symbol
      return symbol;
    } catch (error) {
      console.warn(`无法获取${symbol}的公司名:`, error);
      // 不返回假数据，返回symbol
      return symbol;
    }
  };

  const getStockNews = async (symbol: string): Promise<any> => {
    try {
      console.log(`[DEBUG] 开始获取 ${symbol} 新闻`);

      // 调用新的新闻接口
      const response = await api.get(`/market/news/${symbol}`);

      console.log(`[DEBUG] ${symbol} 新闻响应状态:`, response.status);
      console.log(`[DEBUG] ${symbol} 新闻响应数据:`, response.data);
      console.log(`[DEBUG] ${symbol} 新闻success字段:`, response.data?.success);
      console.log(`[DEBUG] ${symbol} 新闻sentiment字段:`, response.data?.sentiment);
      console.log(`[DEBUG] ${symbol} 新闻eventRisk字段:`, response.data?.eventRisk);
      console.log(`[DEBUG] ${symbol} 新闻topNews字段:`, response.data?.topNews);

      if (response.data?.success) {
        const newsData = response.data;
        console.log(`[DEBUG] ${symbol} 新闻获取成功:`, newsData);

        return {
          sentiment: newsData.sentiment || null,
          eventRisk: newsData.eventRisk || null,
          topCatalyst: newsData.topNews?.title || null,
          newsItems: newsData.news || [],
          source: newsData.source || null,
          topNews: newsData.topNews || null,
          newsCount: newsData.newsCount || 0,
          hasNews: newsData.hasNews || false
        };
      } else {
        console.error(`[DEBUG] ${symbol} 新闻获取失败:`, response.data?.error);
        // 返回空数据
        return {
          sentiment: null,
          eventRisk: null,
          topCatalyst: null,
          newsItems: [],
          source: null,
          topNews: null,
          newsCount: 0,
          hasNews: false
        };
      }

    } catch (error: any) {
      console.error(`[DEBUG] 获取 ${symbol} 新闻异常:`, error.message, error.response?.data);
      // 返回空数据，而不是模拟数据
      return {
        sentiment: null,
        eventRisk: null,
        topCatalyst: null,
        newsItems: [],
        source: null,
        topNews: null,
        newsCount: 0,
        hasNews: false
      };
    }
  };

  // Symbol数据完整性校验函数
  const validateSymbolData = (data: any): { valid: boolean; missingFields: string[]; error?: string } => {
    const missingFields: string[] = [];

    // 辅助函数：检查真正的空值（null/undefined/空字符串），0是有效值
    const isReallyEmpty = (value: any): boolean => {
      return value === null || value === undefined || value === '';
    };

    // ========== 关键字段（缺了才重扫） ==========
    // 1. symbol - 必须存在且非空
    if (isReallyEmpty(data?.symbol)) missingFields.push('symbol');

    // 2. price - 必须存在，0是有效价格
    if (isReallyEmpty(data?.price)) missingFields.push('price');

    // 3. changePct/changePercent - 必须存在，0是有效涨跌幅
    if (isReallyEmpty(data?.changePct) && isReallyEmpty(data?.changePercent)) {
      missingFields.push('changePct/changePercent');
    }

    // 4. volume - 必须存在，0是有效成交量
    if (isReallyEmpty(data?.volume)) missingFields.push('volume');

    // 5. trendLabel - 必须存在且非空
    if (isReallyEmpty(data?.trendLabel)) missingFields.push('trendLabel');

    // 6. overallScore/trendScore - 必须存在，0是有效分数
    if (isReallyEmpty(data?.overallScore) && isReallyEmpty(data?.trendScore)) {
      missingFields.push('overallScore/trendScore');
    }

    // 7. aiReasoning - 必须存在且非空
    if (isReallyEmpty(data?.aiReasoning)) missingFields.push('aiReasoning');

    // ========== 非关键增强字段（只记录，不触发重扫） ==========
    const enhancementFields: string[] = [];

    // 价格范围字段
    if (isReallyEmpty(data?.dayHigh)) enhancementFields.push('dayHigh');
    if (isReallyEmpty(data?.dayLow)) enhancementFields.push('dayLow');

    // 新闻相关字段
    if (isReallyEmpty(data?.newsSentiment)) enhancementFields.push('newsSentiment');
    if (isReallyEmpty(data?.eventRisk)) enhancementFields.push('eventRisk');

    // 6维度分数字段
    if (isReallyEmpty(data?.momentumScore)) enhancementFields.push('momentumScore');
    if (isReallyEmpty(data?.volumeScore)) enhancementFields.push('volumeScore');
    if (isReallyEmpty(data?.volatilityScore)) enhancementFields.push('volatilityScore');
    if (isReallyEmpty(data?.structureScore)) enhancementFields.push('structureScore');
    if (isReallyEmpty(data?.newsScore)) enhancementFields.push('newsScore');

    // 记录增强字段缺失情况（只记录，不影响验证结果）
    if (enhancementFields.length > 0) {
      console.log(`[${data?.symbol}] 增强字段缺失（不影响验证）: ${enhancementFields.join(', ')}`);
    }

    // 至少一个有效的AI判断字段（非空）
    const hasValidAIField = !isReallyEmpty(data?.trendLabel) ||
                           !isReallyEmpty(data?.trendScore) ||
                           !isReallyEmpty(data?.aiReasoning);

    // provenance检查（如果有的话）
    const hasProvenance = data?.provenance || data?.source;
    if (!hasProvenance) {
      // 不是必须字段，但记录警告
      console.warn(`[${data?.symbol}] 缺少provenance/source字段`);
    }

    const valid = missingFields.length === 0 && hasValidAIField;

    return {
      valid,
      missingFields,
      error: valid ? undefined : `Missing critical fields: ${missingFields.join(', ')}${!hasValidAIField ? ' (no valid AI field)' : ''}`
    };
  };

  const analyzeTrend = async (symbol: string, stockData: any, newsData: any): Promise<TrendAnalysis> => {
    try {
      console.log(`[AI DEBUG] ====== 开始AI分析 ${symbol} ======`);
      console.log(`[AI DEBUG] symbol before analyze =`, symbol);
      console.log(`[AI DEBUG] request payload =`, { symbol });
      const requestStartTime = Date.now();

      // 调用新的单只股票AI分析接口 - 使用scanner专用api（无timeout限制）
      const response = await scannerApi.post('/ai/analyze/single', {
        symbol: symbol
      });

      const requestEndTime = Date.now();
      const requestDuration = requestEndTime - requestStartTime;
      console.log(`[AI DEBUG] API请求耗时: ${requestDuration}ms`);

      console.log(`[AI DEBUG] raw analyze response =`, response.data);
      console.log(`[AI DEBUG] response status =`, response.status);
      console.log(`[AI DEBUG] response success =`, response.data?.success);

      if (response.data?.success) {
        const result = response.data;
        console.log(`[AI DEBUG] AI分析 ${symbol} 成功:`, {
          trendLabel: result.trendLabel,
          trendScore: result.trendScore,
          overallScore: result.overallScore,
          aiReasoning: result.aiReasoning ? '有' : '无'
        });

        // 调试：检查关键字段 - V3格式
        console.log(`[DEBUG] AI分析 ${symbol} - trendLabel字段:`, result.trendLabel);
        console.log(`[DEBUG] AI分析 ${symbol} - trendScore字段:`, result.trendScore);
        console.log(`[DEBUG] AI分析 ${symbol} - momentumLabel字段:`, result.momentumLabel);
        console.log(`[DEBUG] AI分析 ${symbol} - momentumScore字段:`, result.momentumScore);
        console.log(`[DEBUG] AI分析 ${symbol} - volatilityLabel字段:`, result.volatilityLabel);
        console.log(`[DEBUG] AI分析 ${symbol} - volatilityScore字段:`, result.volatilityScore);
        console.log(`[DEBUG] AI分析 ${symbol} - volumeLabel字段:`, result.volumeLabel);
        console.log(`[DEBUG] AI分析 ${symbol} - volumeScore字段:`, result.volumeScore);
        console.log(`[DEBUG] AI分析 ${symbol} - structureLabel字段:`, result.structureLabel);
        console.log(`[DEBUG] AI分析 ${symbol} - structureScore字段:`, result.structureScore);
        console.log(`[DEBUG] AI分析 ${symbol} - newsLabel字段:`, result.newsLabel);
        console.log(`[DEBUG] AI分析 ${symbol} - newsScore字段:`, result.newsScore);
        console.log(`[DEBUG] AI分析 ${symbol} - riskLevel字段:`, result.riskLevel);
        console.log(`[DEBUG] AI分析 ${symbol} - overallScore字段:`, result.overallScore);
        console.log(`[DEBUG] AI分析 ${symbol} - aiReasoning字段:`, result.aiReasoning);
        console.log(`[DEBUG] AI分析 ${symbol} - conciseReason字段:`, result.conciseReason);

        // 向后兼容：检查V2格式字段
        console.log(`[DEBUG] AI分析 ${symbol} - trend字段(V2):`, result.trend);
        console.log(`[DEBUG] AI分析 ${symbol} - confidence字段(V2):`, result.confidence);
        console.log(`[DEBUG] AI分析 ${symbol} - newsSentiment字段(V2):`, result.newsSentiment);
        console.log(`[DEBUG] AI分析 ${symbol} - eventRisk字段(V2):`, result.eventRisk);
        console.log(`[DEBUG] AI分析 ${symbol} - volumeStatus字段(V2):`, result.volumeStatus);
        console.log(`[DEBUG] AI分析 ${symbol} - conciseReasoning字段(V2):`, result.conciseReasoning);
        console.log(`[DEBUG] AI分析 ${symbol} - detailedReasoning字段(V2):`, result.detailedReasoning);
        console.log(`[DEBUG] AI分析 ${symbol} - scannerReason字段(V2):`, result.scannerReason);
        console.log(`[DEBUG] AI分析 ${symbol} - companyName字段:`, result.companyName);
        console.log(`[DEBUG] AI分析 ${symbol} - sector字段:`, result.sector);

        // 构建trendAnalysis对象 - 优先使用V3格式，回退到V2格式
        const trendAnalysis: TrendAnalysis = {
          // V3字段
          trendLabel: result.trendLabel || result.trend || null,
          trendScore: result.trendScore || result.overallScore || null,
          momentumLabel: result.momentumLabel || null,
          momentumScore: result.momentumScore || null,
          volatilityLabel: result.volatilityLabel || null,
          volatilityScore: result.volatilityScore || null,
          volumeLabel: (result.volumeLabel as 'low' | 'normal' | 'high') || result.volumeStatus || null,
          volumeScore: result.volumeScore || null,
          structureLabel: result.structureLabel || null,
          structureScore: result.structureScore || null,
          newsLabel: (result.newsLabel as 'positive' | 'neutral' | 'negative') || result.newsSentiment || null,
          newsScore: result.newsScore || null,
          riskLevel: (result.riskLevel as 'low' | 'medium' | 'high') || result.eventRisk || null,

          // V2兼容字段
          trendConfidence: result.confidence || null,
          scannerReason: result.scannerReason || result.conciseReason || null,
          trendScoreDetail: result.trendScore || null,
          volumeStatus: result.volumeStatus || result.volumeLabel || null,
          conciseReasoning: result.conciseReasoning || result.conciseReason || null,
          detailedReasoning: result.detailedReasoning || result.aiReasoning || null,
          aiReasoning: result.aiReasoning || null,
          newsSentiment: result.newsSentiment || result.newsLabel || null,
          eventRisk: result.eventRisk || result.riskLevel || null,
          topNews: result.topNews || null,
          companyName: result.companyName || null,
          sector: result.sector || null,

          // 确保所有字段都有值
          overallScore: result.overallScore || result.trendScore || null,
          conciseReason: result.conciseReason || result.conciseReasoning || null,

          // AI source tracking
          analysisSource: result.analysisSource || result.aiAnalysis || null,
          aiCalled: result.aiCalled !== undefined ? result.aiCalled : (result.analysisSource === 'deepseek' || result.analysisSource === 'gemini' || result.analysisSource === 'openai'),
          aiSource: result.aiSource || result.provider || (result.analysisSource === 'deepseek' ? 'DeepSeek' : result.analysisSource === 'rule_based' ? 'Local Rules' : null),
          aiModel: result.aiModel || result.model || null,
          aiError: result.aiError || result.message || null,
        };

        console.log(`[AI DEBUG] normalized trendAnalysis (V3) =`, {
          symbol,
          // V3核心字段
          trendLabel: trendAnalysis.trendLabel,
          trendScore: trendAnalysis.trendScore,
          momentumLabel: trendAnalysis.momentumLabel,
          momentumScore: trendAnalysis.momentumScore,
          volumeLabel: trendAnalysis.volumeLabel,
          volumeScore: trendAnalysis.volumeScore,
          newsLabel: trendAnalysis.newsLabel,
          newsScore: trendAnalysis.newsScore,
          riskLevel: trendAnalysis.riskLevel,
          overallScore: trendAnalysis.overallScore,
          // 关键推理字段
          aiReasoning: trendAnalysis.aiReasoning,
          conciseReason: trendAnalysis.conciseReason
        });

        console.log(`[AI DEBUG] ====== AI分析 ${symbol} 完成 (成功) ======`);
        return trendAnalysis;
      } else {
        // 后端返回success: false，返回null数据
        console.warn(`[AI DEBUG] AI分析 ${symbol} 后端返回success: false，返回null数据`);
        console.warn(`[AI DEBUG] AI分析 ${symbol} 错误信息:`, response.data?.error);
        console.log(`[AI DEBUG] ====== AI分析 ${symbol} 完成 (失败: success=false) ======`);

        // 返回null数据，不伪造任何值 - 包含所有V3字段
        // 保留后端返回的real news/profile data和AI source tracking
        const errorData = response.data || {};
        return {
          // V3字段
          trendLabel: null,
          trendScore: null,
          momentumLabel: null,
          momentumScore: null,
          volatilityLabel: null,
          volatilityScore: null,
          volumeLabel: null,
          volumeScore: null,
          structureLabel: null,
          structureScore: null,
          newsLabel: null,
          newsScore: null,
          riskLevel: null,
          overallScore: null,
          conciseReason: null,

          // V2兼容字段
          trendConfidence: null,
          scannerReason: null,
          trendScoreDetail: null,
          volumeStatus: null,
          conciseReasoning: null,
          detailedReasoning: null,
          aiReasoning: null,
          newsSentiment: errorData.newsSentiment || null,
          eventRisk: errorData.eventRisk || null,
          topNews: errorData.topNews || null,
          companyName: errorData.companyName || null,
          sector: errorData.sector || null,

          // AI source tracking - mark as unavailable
          analysisSource: 'unavailable',
          aiCalled: true,
          aiSource: 'unavailable',
          aiModel: null,
          aiError: errorData.error || 'AI analysis failed',
        };
      }
    } catch (error: any) {
      console.error(`[AI DEBUG] AI分析 ${symbol} 异常:`, error.message, error.response?.data);
      console.error(`[AI DEBUG] 异常类型:`, error.constructor.name);
      console.error(`[AI DEBUG] 异常堆栈:`, error.stack);
      console.log(`[AI DEBUG] ====== AI分析 ${symbol} 完成 (异常) ======`);
      // AI分析失败时，返回null数据，不伪造任何值 - 包含所有V3字段
      return {
        // V3字段
        trendLabel: null,
        trendScore: null,
        momentumLabel: null,
        momentumScore: null,
        volatilityLabel: null,
        volatilityScore: null,
        volumeLabel: null,
        volumeScore: null,
        structureLabel: null,
        structureScore: null,
        newsLabel: null,
        newsScore: null,
        riskLevel: null,
        overallScore: null,
        conciseReason: null,

        // V2兼容字段
        trendConfidence: null,
        scannerReason: null,
        trendScoreDetail: null,
        volumeStatus: null,
        conciseReasoning: null,
        detailedReasoning: null,
        aiReasoning: null,
        newsSentiment: null,
        eventRisk: null,
        topNews: null,
        companyName: null,
        sector: null,

        // AI source tracking - mark as unavailable
        analysisSource: 'unavailable',
        aiCalled: true,
        aiSource: 'unavailable',
        aiModel: null,
        aiError: error?.message || 'AI analysis exception',
      };
    }
  };

  const calculateRelativeVolume = (volume: number | null, symbol: string): string | null => {
    // 基于真实成交量计算相对成交量
    // 暂时返回null，等待真实平均成交量数据
    return null;
  };

  const getTrendLabel = (score: number): string => {
    if (score >= 80) return 'Strong Bullish';
    if (score >= 60) return 'Bullish';
    if (score >= 40) return 'Neutral';
    if (score >= 20) return 'Bearish';
    return 'Strong Bearish';
  };

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
  const generateScannerReason = (symbol: string, score: number, newsData: any, stockData: any): string | null => {
    // 不再使用模板句子，返回null让AI分析提供真实reasoning
    return null;
  };

  const updateScannerSummary = (results: any[]): void => {
    // 修复：全部使用 null-safe 检查
    const bullishCount = results.filter(r => (r.trendLabel || '').includes('Bullish')).length;
    const bearishCount = results.filter(r => (r.trendLabel || '').includes('Bearish')).length;
    const neutralCount = results.filter(r => r.trendLabel === 'Neutral').length;
    const strongTrendCount = results.filter(r => (r.trendLabel || '').includes('Strong')).length;
    const newsRiskCount = results.filter(r => r.eventRisk === 'High').length;

    setMarketScannerSummary({
      universeScanned: results.length,
      bullishCount,
      bearishCount,
      neutralCount,
      strongTrendCount,
      newsRiskCount,
      lastScanTime: new Date().toISOString()
    });
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
  const getBullishCandidatesCount = (): number => {
    if (!marketScannerResults || marketScannerResults.length === 0) {
      return 0;
    }

    return marketScannerResults.filter(candidate => {
      if (!candidate.symbol || !candidate.trendLabel) return false;
      const trend = candidate.trendLabel;
      const score = candidate.overallScore || candidate.trendScore || 0;
      const risk = candidate.eventRisk || 'Medium';

      // 排除规则
      if (risk === 'High') return false;
      if (trend === 'Strong Bearish') return false;
      if (score < 30) return false;

      // 只计算Bullish/Strong Bullish
      return trend === 'Bullish' || trend === 'Strong Bullish';
    }).length;
  };

  const handleToggleMarketScanner = (): void => {
    if (marketScannerIsScanningRef.current) {
      // Stop the running scan
      stopRequestedRef.current = true;
      marketScannerStopRequestedRef.current = true;
      setDetailedScanStatus(prev => ({
        ...prev,
        currentStatus: 'stopping',
        statusMessage: 'Stopping scan...'
      }));
      message.info('Stopping scanner...');
      // The scan loop checks stopRequestedRef and will exit
    } else {
      // Start a new scan
      runMarketScanner();
    }
  };

  const handleSymbolClick = (symbol: string): void => {
    // 将选中的symbol添加到AI Recommendations扫描
    message.info(`已将 ${symbol} 添加到分析队列`);
    // 这里可以实现将symbol添加到AI分析队列的逻辑
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
    return React.createElement('span', { style: { fontSize: '9px', color: '#888', marginRight: '6px' } },
      label + ': ',
      React.createElement('span', { style: { color: color || '#333', fontWeight: 500 } }, value)
    );
  }

  const renderFineScanDetailPanel = (record: any) => {
    const fullReason = record.matchReason || '';
    const signals = record.keySignals || [];
    const aiUsed = record.aiUsed === true;
    const aiExplained = record.aiExplained === true;
    const decisionSource = record.decisionSource === 'ai' ? 'DeepSeek AI' : 'Local Rules';
    const dq = (record.provenance && record.provenance.dataQuality) || (record.entryQuality && record.entryQuality !== 'Error / No Data' ? 'GOOD' : 'PARTIAL');
    const dqColor = dq === 'GOOD' ? '#52c41a' : dq === 'PARTIAL' ? '#fa8c16' : '#ff4d4f';
    const decision = record.decision || 'Watch';
    const grade = record.fineScanGrade || 'MEDIUM';
    const risk = record.riskGrade || 'MEDIUM';
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

    return React.createElement('div', { style: { padding: '10px 14px', backgroundColor: '#f8f9fa', borderRadius: 8, border: '1px solid #e8e8e8', margin: '0 6px 6px 6px', fontSize: '11px', lineHeight: '1.4' } },

      // Compact Header Row — only essential identifiers, details in cards
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '6px 0', borderBottom: '1px solid #e8eaed', marginBottom: '8px' } },
        React.createElement('span', { style: { fontWeight: 700, fontSize: '13px', color: '#1a1a1a' } }, record.symbol),
        React.createElement(Tag, { color: decision === 'Continue' ? 'green' : decision === 'Watch' ? 'gold' : 'red', style: { fontSize: '10px', margin: 0, padding: '0 5px', lineHeight: '18px' } }, decision),
        React.createElement('span', { style: { color: '#888', fontSize: '10px' } }, 'Score ', React.createElement('span', { style: { fontWeight: 600, color: '#333' } }, record.matchConfidence || 0)),
        React.createElement('span', { style: { color: '#aaa', fontSize: '10px' } }, '|'),
        React.createElement('span', { style: { color: '#888', fontSize: '10px' } }, (record.matchedStrategies || []).slice(0, 2).join(', ') || bestStrat),
        // Warnings inline
        (record.decisionWarnings || []).concat((record.decisionBlockers || []).map(function(b: string) { return 'BLOCK: ' + b; })).slice(0, 2).map(function(w: string, i: number) {
          var isBlocker = w.indexOf('BLOCK: ') === 0;
          return React.createElement('span', { key: 'hw' + i, style: { padding: '1px 5px', borderRadius: 3, background: isBlocker ? '#fff1f0' : '#fffbe6', color: isBlocker ? '#ff4d4f' : '#d48806', fontSize: '8px', border: '1px solid ' + (isBlocker ? '#ffa39e' : '#ffe58f'), whiteSpace: 'nowrap' } }, (isBlocker ? '✕ ' : '⚠ ') + (isBlocker ? w.slice(7) : w));
        }),
        React.createElement('span', { style: { marginLeft: 'auto', display: 'flex', gap: '4px', alignItems: 'center' } },
          React.createElement(Tag, { color: dq === 'GOOD' ? 'green' : dq === 'PARTIAL' ? 'gold' : 'red', style: { fontSize: '8px', margin: 0, padding: '0 4px', lineHeight: '16px' } }, dq),
          perStrategy.some(function(ps: any) { return (ps.tradeCount || 0) < 3; }) ? React.createElement(Tag, { color: 'warning', style: { fontSize: '8px', margin: 0, padding: '0 4px', lineHeight: '16px' } }, 'limited') : null,
          React.createElement(Tag, { color: aiUsed ? 'green' : 'default', style: { fontSize: '8px', margin: 0, padding: '0 4px', lineHeight: '16px' } }, aiUsed ? 'DeepSeek' : 'LR')
        )
      ),

      // Provenance Chips — short labels, full source in title
      React.createElement('div', { style: { display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '8px' } },
        (function() {
          var p = record.provenance || {};
          var chips: Array<{key: string; label: string; isAI: boolean; title: string}> = [
            {key: 'Mkt', label: 'Market', isAI: false, title: p.marketSource || 'Scanner'},
            {key: 'BT', label: 'BT', isAI: false, title: p.backtestSource || 'Backtest'},
            {key: 'Opt', label: 'Opt', isAI: false, title: p.optimizationSource || 'Optimization'},
            {key: 'Entry', label: 'Entry', isAI: false, title: p.entrySource || 'Entry Quality'},
            {key: 'News', label: 'News', isAI: false, title: p.newsSource || 'News'},
            {key: 'Dec', label: 'Dec ' + (record.decisionSource === 'ai' ? 'AI' : 'Rules'), isAI: record.decisionSource === 'ai', title: decisionSource},
            {key: 'Exp', label: 'Exp ' + (aiExplained ? 'AI' : 'LR'), isAI: aiExplained, title: aiExplained ? 'DeepSeek AI' : (p.explanationSource || 'Local Rules')},
          ];
          return chips.map(function(c) {
            return React.createElement('span', { key: c.key, title: c.title, style: { padding: '1px 5px', borderRadius: '3px', background: c.isAI ? '#e6fffb' : '#f0f0f0', color: c.isAI ? '#13c2c2' : '#888', fontSize: '8px', border: '1px solid ' + (c.isAI ? '#b5f5ec' : '#e0e0e0'), whiteSpace: 'nowrap', cursor: 'default' } }, c.label);
          });
        })()
      ),

      // Body: 2-column grid
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '8px' } },

        // LEFT COLUMN
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },

          // Match Summary
          React.createElement('div', { style: { background: '#fff', borderRadius: 6, border: '1px solid #edf0f2', padding: '8px 10px' } },
            React.createElement('div', { style: { fontWeight: 600, fontSize: '10px', color: '#8c8c8c', textTransform: 'uppercase', marginBottom: '4px' } }, 'Match Summary'),
            fullReason ? React.createElement('div', { style: { fontSize: '10px', color: '#444', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden', maxHeight: '30px', marginBottom: '4px' }, title: fullReason }, fullReason) : null,
            React.createElement('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
              React.createElement(Tag, { color: record.regime === 'Trending' ? 'blue' : record.regime === 'Breakout-ready' ? 'purple' : record.regime === 'Range-bound' ? 'green' : 'default', style: { fontSize: '9px', margin: 0, padding: '0 5px', lineHeight: '16px' } }, record.regime || 'Unclear'),
              React.createElement('span', { style: { fontSize: '9px', color: '#888' } }, 'Confidence: ' + (record.matchConfidence || 0) + '% | Score: ' + (record.scanScore || 'N/A'))
            )
          ),

          // Backtest
          React.createElement('div', { style: { background: '#fff', borderRadius: 6, border: '1px solid #edf0f2', padding: '8px 10px' } },
            React.createElement('div', { style: { fontWeight: 600, fontSize: '10px', color: '#8c8c8c', textTransform: 'uppercase', marginBottom: '4px' } }, 'Backtest'),
            perStrategy.length > 0 ? (
              React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '9px' } },
                React.createElement('thead', null,
                  React.createElement('tr', { style: { color: '#888', borderBottom: '1px solid #f0f0f0' } },
                    React.createElement('th', { style: { textAlign: 'left', padding: '2px 4px', fontWeight: 500 } }, 'Strategy'),
                    React.createElement('th', { style: { textAlign: 'right', padding: '2px 4px', fontWeight: 500 } }, 'Return'),
                    React.createElement('th', { style: { textAlign: 'right', padding: '2px 4px', fontWeight: 500 } }, 'Sharpe'),
                    React.createElement('th', { style: { textAlign: 'right', padding: '2px 4px', fontWeight: 500 } }, 'MaxDD'),
                    React.createElement('th', { style: { textAlign: 'right', padding: '2px 4px', fontWeight: 500 } }, 'WR'),
                    React.createElement('th', { style: { textAlign: 'right', padding: '2px 4px', fontWeight: 500 } }, 'Tr'),
                    React.createElement('th', { style: { textAlign: 'center', padding: '2px 4px', fontWeight: 500 } }, 'Status')
                  )
                ),
                React.createElement('tbody', null,
                  perStrategy.map(function(ps: any, i: number) {
                    return React.createElement('tr', { key: i, style: { borderBottom: '1px solid #f5f5f5' } },
                      React.createElement('td', { style: { padding: '2px 4px', fontWeight: 500 } }, ps.strategy),
                      React.createElement('td', { style: { padding: '2px 4px', textAlign: 'right', color: (ps.totalReturn || 0) >= 0 ? '#52c41a' : '#ff4d4f' } }, ps.totalReturn != null ? (ps.totalReturn >= 0 ? '+' : '') + Number(ps.totalReturn).toFixed(1) + '%' : '--'),
                      React.createElement('td', { style: { padding: '2px 4px', textAlign: 'right', color: (ps.sharpe || 0) >= 0.5 ? '#333' : '#ff4d4f' } }, ps.sharpe != null ? Number(ps.sharpe).toFixed(2) : '--'),
                      React.createElement('td', { style: { padding: '2px 4px', textAlign: 'right', color: Math.abs(ps.maxDrawdown || 0) < 15 ? '#333' : Math.abs(ps.maxDrawdown || 0) < 25 ? '#faad14' : '#ff4d4f' } }, ps.maxDrawdown != null ? Number(ps.maxDrawdown).toFixed(1) + '%' : '--'),
                      React.createElement('td', { style: { padding: '2px 4px', textAlign: 'right' } }, ps.winRate != null ? Number(ps.winRate).toFixed(1) + '%' : '--'),
                      React.createElement('td', { style: { padding: '2px 4px', textAlign: 'right', fontStyle: (ps.tradeCount || 0) < 3 ? 'italic' : 'normal' }, title: (ps.tradeCount || 0) < 3 ? 'Limited sample' : undefined }, ps.tradeCount != null ? String(ps.tradeCount) : '--'),
                      React.createElement('td', { style: { padding: '2px 4px', textAlign: 'center' } },
                        React.createElement(Tag, { color: ps.status === 'passed' ? 'green' : ps.status === 'caution' ? 'gold' : 'red', style: { fontSize: '8px', margin: 0, padding: '0 3px', lineHeight: '14px' } },
                          ps.status === 'passed' ? 'Pos' : ps.status === 'caution' ? 'Caut' : ps.status === 'completed_losing' ? 'Loss' : '--')
                      )
                    );
                  })
                )
              )
            ) : React.createElement('div', { style: { fontSize: '10px', color: '#999', fontStyle: 'italic' } }, 'Backtest not yet available.'),
            record.backtestPeriod ? React.createElement('div', { style: { fontSize: '9px', color: '#aaa', marginTop: '4px' } }, 'Period: ' + record.backtestPeriod) : null
          ),

          // Optimization
          React.createElement('div', { style: { background: '#fff', borderRadius: 6, border: '1px solid #edf0f2', padding: '8px 10px' } },
            React.createElement('div', { style: { fontWeight: 600, fontSize: '10px', color: '#8c8c8c', textTransform: 'uppercase', marginBottom: '4px' } }, 'Optimization'),
            optResults.length > 0 ? (
              React.createElement('div', { style: { fontSize: '9px' } },
                React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '9px' } },
                  React.createElement('thead', null,
                    React.createElement('tr', { style: { color: '#888', borderBottom: '1px solid #f0f0f0' } },
                      React.createElement('th', { style: { textAlign: 'left', padding: '2px 4px', fontWeight: 500 } }, 'Strategy'),
                      React.createElement('th', { style: { textAlign: 'center', padding: '2px 4px', fontWeight: 500 } }, 'Status'),
                      React.createElement('th', { style: { textAlign: 'right', padding: '2px 4px', fontWeight: 500 } }, 'Avg Ret'),
                      React.createElement('th', { style: { textAlign: 'right', padding: '2px 4px', fontWeight: 500 } }, 'Pos%'),
                      React.createElement('th', { style: { textAlign: 'right', padding: '2px 4px', fontWeight: 500 } }, 'Spread')
                    )
                  ),
                  React.createElement('tbody', null,
                    optResults.map(function(opt: any, oi: number) {
                      var hasResults = opt.results && opt.results.length > 0;
                      return React.createElement('tr', { key: oi, style: { borderBottom: '1px solid #f5f5f5' } },
                        React.createElement('td', { style: { padding: '2px 4px', fontWeight: 500 } }, opt.strategy),
                        React.createElement('td', { style: { padding: '2px 4px', textAlign: 'center' } },
                          React.createElement(Tag, { color: opt.stability === 'Stable' ? 'green' : opt.stability === 'Weak' ? 'gold' : 'red', style: { fontSize: '8px', margin: 0, padding: '0 3px', lineHeight: '14px' } },
                            opt.stability === 'Stable' ? 'Stable' : opt.stability === 'Weak' ? 'Weak' : 'Overfit')
                        ),
                        React.createElement('td', { style: { padding: '2px 4px', textAlign: 'right', color: opt.avgReturn >= 0 ? '#52c41a' : '#ff4d4f' } }, (opt.avgReturn >= 0 ? '+' : '') + opt.avgReturn + '%'),
                        React.createElement('td', { style: { padding: '2px 4px', textAlign: 'right' } }, opt.positiveRatio + '%'),
                        React.createElement('td', { style: { padding: '2px 4px', textAlign: 'right' } }, (opt.stdReturn || 0).toFixed(1) + '%')
                      );
                    })
                  )
                ),
                record.quickOptSummary ? React.createElement('div', { style: { fontSize: '9px', color: '#aaa', marginTop: '4px' } }, record.quickOptSummary) : null
              )
            ) : React.createElement('div', { style: { fontSize: '10px', color: '#999', fontStyle: 'italic' } }, 'Optimization not run.'),
            record.quickOptStatus === 'running' ? React.createElement('div', { style: { fontSize: '10px', color: '#fa8c16' } }, 'In progress...') : null
          ),

          // Entry Quality
          React.createElement('div', { style: { background: '#fff', borderRadius: 6, border: '1px solid #edf0f2', padding: '8px 10px' } },
            React.createElement('div', { style: { fontWeight: 600, fontSize: '10px', color: '#8c8c8c', textTransform: 'uppercase', marginBottom: '4px' } }, 'Entry Quality'),
            eq && eq !== 'Error / No Data' ? (
              React.createElement('div', null,
                React.createElement('div', { style: { marginBottom: '4px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' } },
                  React.createElement('span', { style: { fontWeight: 600, color: eq === 'Good' ? '#52c41a' : eq === 'Wait for Pullback' ? '#faad14' : eq === 'Near Resistance' || eq === 'Chasing / Extended' || eq === 'Poor Reward-Risk' ? '#ff4d4f' : '#333' } }, eq),
                  React.createElement('span', { style: { color: '#888' } }, 'Score: ' + (record.entryScore || '--') + '/100'),
                  eqD && eqD.reward_risk_ratio != null && eqD.reward_risk_ratio < 1.5 && eq === 'Good' ? React.createElement('span', { style: { padding: '1px 5px', borderRadius: 3, background: '#fffbe6', color: '#d48806', fontSize: '8px', border: '1px solid #ffe58f' } }, '⚠ Entry capped by low R/R (' + eqD.reward_risk_ratio + ':1)') : null
                ),
                eqD ? React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: '9px' } },
                  eqD.current_price != null ? React.createElement(FineScanDetailTag, { label: 'Price', value: '$' + eqD.current_price }) : null,
                  eqD.atr != null ? React.createElement(FineScanDetailTag, { label: 'ATR', value: '$' + eqD.atr + ' (' + eqD.atr_pct + '%)' }) : null,
                  eqD.support != null ? React.createElement(FineScanDetailTag, { label: 'Support', value: '$' + eqD.support }) : null,
                  eqD.resistance != null ? React.createElement(FineScanDetailTag, { label: 'Res', value: '$' + eqD.resistance }) : null,
                  eqD.entry_zone_low != null ? React.createElement(FineScanDetailTag, { label: 'Entry', value: '$' + eqD.entry_zone_low + '–$' + eqD.entry_zone_high }) : null,
                  eqD.stop_distance_pct != null ? React.createElement(FineScanDetailTag, { label: 'Stop', value: eqD.stop_distance_pct + '%', color: eqD.stop_distance_pct > 5 ? '#faad14' : undefined }) : null,
                  eqD.reward_risk_ratio != null ? React.createElement(FineScanDetailTag, { label: 'R/R', value: eqD.reward_risk_ratio + ':1', color: eqD.reward_risk_ratio < 1.5 ? '#ff4d4f' : eqD.reward_risk_ratio < 2 ? '#faad14' : '#52c41a' }) : null
                ) : null,
                record.entryReason ? React.createElement('div', { style: { fontSize: '9px', color: '#aaa', marginTop: '3px', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: '1', WebkitBoxOrient: 'vertical', overflow: 'hidden' } }, record.entryReason) : null
              )
            ) : React.createElement('span', { style: { color: '#bbb', fontSize: '10px' } }, 'Entry quality data unavailable')
          )
        ),

        // RIGHT COLUMN
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },

          // Key Signals
          React.createElement('div', { style: { background: '#fff', borderRadius: 6, border: '1px solid #edf0f2', padding: '8px 10px' } },
            React.createElement('div', { style: { fontWeight: 600, fontSize: '10px', color: '#8c8c8c', textTransform: 'uppercase', marginBottom: '4px' } }, 'Key Signals'),
            signals.length > 0 ? (
              React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '3px' } },
                signals.slice(0, 6).map(function(sig: string, i: number) {
                  return React.createElement('span', { key: i, style: { padding: '1px 6px', borderRadius: 3, backgroundColor: '#f0f5ff', color: '#1890ff', fontSize: '9px', border: '1px solid #d6e4ff' } }, sig);
                }),
                signals.length > 6 ? React.createElement('span', { style: { fontSize: '9px', color: '#999' } }, '+' + (signals.length - 6)) : null
              )
            ) : React.createElement('span', { style: { color: '#bbb', fontSize: '10px' } }, '--')
          ),

          // Liquidity & Risk -- merged
          React.createElement('div', { style: { background: '#fff', borderRadius: 6, border: '1px solid #edf0f2', padding: '8px 10px' } },
            React.createElement('div', { style: { fontWeight: 600, fontSize: '10px', color: '#8c8c8c', textTransform: 'uppercase', marginBottom: '4px' } }, 'Liquidity & Risk'),
            React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', fontSize: '9px' } },
              React.createElement('div', null,
                React.createElement('div', { style: { fontWeight: 500, color: '#555', marginBottom: '3px' } }, 'Liquidity'),
                lg && lg !== 'Error' ? React.createElement('div', null,
                  React.createElement(FineScanDetailTag, { label: 'Grade', value: lg, color: lg === 'Good' ? '#52c41a' : lg === 'Caution' ? '#faad14' : '#ff4d4f' }),
                  ld ? React.createElement('div', null,
                    ld.rvol != null ? React.createElement('div', { style: { marginTop: '2px' } }, React.createElement(FineScanDetailTag, { label: 'RVOL', value: ld.rvol + 'x', color: ld.rvol >= 1.5 ? '#52c41a' : ld.rvol < 0.7 ? '#ff4d4f' : undefined })) : null,
                    ld.spread_pct != null ? React.createElement('div', { style: { marginTop: '2px' } }, React.createElement(FineScanDetailTag, { label: 'Spread', value: ld.spread_pct + '%', color: ld.spread_pct > 1 ? '#ff4d4f' : ld.spread_pct > 0.2 ? '#faad14' : undefined })) : React.createElement('div', { style: { marginTop: '2px', color: '#bbb' } }, 'Spread: N/A')
                  ) : null
                ) : React.createElement('span', { style: { color: '#bbb' } }, '--')
              ),
              React.createElement('div', null,
                React.createElement('div', { style: { fontWeight: 500, color: '#555', marginBottom: '3px' } }, 'Risk'),
                rg && rg !== 'SKIP' ? React.createElement('div', null,
                  React.createElement(FineScanDetailTag, { label: 'Grade', value: rg === 'LOW' ? 'Low' : rg === 'MEDIUM' ? 'Medium' : rg === 'HIGH' ? 'High' : rg, color: rg === 'LOW' ? '#52c41a' : rg === 'MEDIUM' ? '#faad14' : '#ff4d4f' }),
                  rd ? React.createElement('div', null,
                    React.createElement('div', { style: { marginTop: '2px' } }, React.createElement(FineScanDetailTag, { label: 'Score', value: (rd.risk_score || '--') + '/100', color: rd.risk_score >= 65 ? '#ff4d4f' : rd.risk_score >= 35 ? '#faad14' : '#52c41a' })),
                    rd.atr_pct != null ? React.createElement('div', { style: { marginTop: '2px' } }, React.createElement(FineScanDetailTag, { label: 'ATR', value: rd.atr_pct + '%', color: rd.atr_pct > 5 ? '#ff4d4f' : undefined })) : null
                  ) : null
                ) : React.createElement('span', { style: { color: '#bbb' } }, '--')
              )
            )
          ),

          // News & Catalyst
          React.createElement('div', { style: { background: '#fff', borderRadius: 6, border: '1px solid #edf0f2', padding: '8px 10px' } },
            React.createElement('div', { style: { fontWeight: 600, fontSize: '10px', color: '#8c8c8c', textTransform: 'uppercase', marginBottom: '4px' } }, 'News & Catalyst'),
            ng && ng !== 'Error' ? React.createElement('div', null,
              React.createElement('div', { style: { marginBottom: '3px' } },
                React.createElement(FineScanDetailTag, { label: 'Grade', value: ng, color: ng === 'Catalyst' ? '#1890ff' : ng === 'Caution' ? '#faad14' : ng === 'High Event Risk' ? '#ff4d4f' : undefined }),
                nd ? React.createElement(React.Fragment, null,
                  React.createElement(FineScanDetailTag, { label: 'Count', value: String(nd.headline_count || 0) }),
                  React.createElement(FineScanDetailTag, { label: 'Earnings', value: nd.earnings_soon ? 'Soon' : 'No', color: nd.earnings_soon ? '#faad14' : undefined })
                ) : null
              ),
              nd && nd.top_headlines && nd.top_headlines.length > 0 ? React.createElement('div', { style: { fontSize: '9px', color: '#666', lineHeight: '1.4' } },
                nd.top_headlines.slice(0, 2).map(function(h: string, i: number) {
                  return React.createElement('div', { key: i, style: { display: '-webkit-box', WebkitLineClamp: '1', WebkitBoxOrient: 'vertical', overflow: 'hidden', maxHeight: '14px', marginBottom: '1px' }, title: h }, '• ' + h);
                }),
                nd.top_headlines.length > 2 ? React.createElement('span', { style: { color: '#999' } }, '+' + (nd.top_headlines.length - 2) + ' more') : null
              ) : React.createElement('span', { style: { color: '#bbb', fontSize: '9px' } }, 'No recent symbol-specific news')
            ) : React.createElement('span', { style: { color: '#bbb', fontSize: '10px' } }, '--')
          ),

          // AI Explanation / Next Step
          React.createElement('div', { style: { background: '#fff', borderRadius: 6, border: '1px solid #edf0f2', padding: '8px 10px' } },
            React.createElement('div', { style: { fontWeight: 600, fontSize: '10px', color: '#8c8c8c', textTransform: 'uppercase', marginBottom: '4px' } }, 'AI Explanation'),
            React.createElement('div', { style: { marginBottom: '3px' } },
              React.createElement(FineScanDetailTag, { label: 'Source', value: aiExplained ? 'DeepSeek' : 'Local Rules', color: aiExplained ? '#52c41a' : '#fa8c16' }),
              aiExplained ? React.createElement(FineScanDetailTag, { label: 'Model', value: 'deepseek-chat' }) : null
            ),
            record.finalReason ? React.createElement('div', { style: { fontSize: '9px', color: '#555', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden', maxHeight: '28px', marginBottom: '3px' }, title: record.finalReason }, record.finalReason) : null,
            record.nextStep ? React.createElement('div', null,
              React.createElement('div', { style: { fontSize: '9px', fontWeight: 500, color: '#333', marginBottom: '1px' } }, 'Next Step:'),
              React.createElement('div', { style: { fontSize: '9px', color: '#1890ff', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden', maxHeight: '26px' }, title: record.nextStep }, record.nextStep)
            ) : null,
            !aiExplained && !record.finalReason ? React.createElement('span', { style: { color: '#bbb', fontSize: '9px' } }, 'AI explanation loading or unavailable.') : null
          )
        )
      ),

    );
  };
  const renderDetailPanel = (record: any) => {
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
                        <a href="#" className="scanner-detail-news-title" onClick={(e) => e.preventDefault()} style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: '#1890ff',
                          marginBottom: '8px',
                          display: 'block',
                          lineHeight: '1.4'
                        }}>
                          {record.topNews.title}
                        </a>
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

  const getCandidateSymbols = async (): Promise<{symbols: string[], source: string, scanType: string}> => {
    try {
      console.log('开始从Preferred Continue Scan List获取候选股票...');

      // 1. 从Preferred Continue Scan List中获取股票
      // 检查是否有可用的continue list结果
      if (!preferredContinueScanList || preferredContinueScanList.length === 0) {
        console.log('Preferred Continue Scan List为空，尝试从Market Scanner结果中获取');

        // 如果continue list为空，尝试从market scanner结果中获取
        if (marketScannerResults && marketScannerResults.length > 0) {
          const symbolsFromMarketScanner = marketScannerResults
            .filter((result: any) => result.symbol)
            .map((result: any) => result.symbol)
            .slice(0, 12); // 限制最多12个

          console.log(`从Market Scanner结果中获取 ${symbolsFromMarketScanner.length} 只股票: ${symbolsFromMarketScanner.join(', ')}`);

          return {
            symbols: symbolsFromMarketScanner,
            source: 'market_scanner_results',
            scanType: 'market_scanner_fallback'
          };
        }

        // 如果都没有，返回空列表（不使用硬编码默认symbols）
        console.log('没有可用的扫描结果，无法生成候选列表');
        return {
          symbols: [],
          source: 'none',
          scanType: 'none'
        };
      }

      // 2. 从Preferred Continue Scan List中提取symbol
      const symbolsFromContinueList = preferredContinueScanList
        .filter((candidate: any) => candidate.symbol && candidate.includeInContinueScan === true)
        .map((candidate: any) => candidate.symbol)
        .slice(0, 12); // 限制最多12个，避免扫描时间过长

      console.log(`从Preferred Continue Scan List中获取 ${symbolsFromContinueList.length} 只股票: ${symbolsFromContinueList.join(', ')}`);

      return {
        symbols: symbolsFromContinueList,
        source: 'preferred_continue_scan_list',
        scanType: 'continue_list_scan'
      };

    } catch (error: any) {
      console.error('从Preferred Continue Scan List获取候选股票失败:', error);
      // 如果失败，回退到原始市场扫描逻辑
      console.log('尝试回退到原始市场扫描逻辑...');
      return await fallbackMarketScan();
    }
  };

  // 回退函数：原始市场扫描逻辑
  const fallbackMarketScan = async (): Promise<{symbols: string[], source: string, scanType: string}> => {
    try {
      console.log('开始回退市场扫描...');

      const response = await marketAPI.getStocks();

      if (!response.data || !response.data.stocks || !Array.isArray(response.data.stocks)) {
        throw new Error('市场数据源返回的股票列表为空或格式不正确');
      }

      const allStocks = response.data.stocks;

      // 简单的股票选择：取前5只有数据的股票
      const validStocks = allStocks.filter((stock: any) =>
        stock.symbol && stock.changePercent !== null && stock.price !== null
      ).slice(0, 5);

      if (validStocks.length === 0) {
        throw new Error('没有找到有效的股票数据');
      }

      const symbols = validStocks.map((stock: any) => stock.symbol);
      console.log(`回退市场扫描完成: ${symbols.join(', ')}`);

      return {
        symbols,
        source: 'fallback_market_scan',
        scanType: 'market_all'
      };
    } catch (fallbackError: any) {
      console.error('回退市场扫描失败:', fallbackError);
      // 不使用硬编码默认列表，抛出错误让调用方处理
      throw new Error('All market scan methods failed. No symbols available.');
    }
  };

  // 格式化时间显示
  const formatTimeDisplay = (isoString: string | null): string => {
    if (!isoString) return 'N/A';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    } catch (error) {
      return 'Invalid time';
    }
  };


  // 辅助函数：基于候选数据生成AI Reasoning
  // 辅助函数：确定Backtest状态
  const determineBacktestStatus = (candidate: any): string => {
    const score = candidate.overallScore || candidate.trendScore || 0;

    if (score >= 80) {
      return 'Available (High Score)';
    } else if (score >= 60) {
      return 'Not run (Medium Score)';
    } else {
      return 'Pending (Low Score)';
    }
  };

  // 辅助函数：确定Optimization状态
  const determineOptimizationStatus = (candidate: any): string => {
    const priority = candidate.priorityScore || 0;

    if (priority >= 80) {
      return 'Available (High Priority)';
    } else if (priority >= 60) {
      return 'Not run (Medium Priority)';
    } else {
      return 'Pending (Low Priority)';
    }
  };

  // 辅助函数：计算Suggested Qty
  const calculateSuggestedQty = (action: string, confidencePercent: number, candidate: any): number => {
    if (action !== 'BUY') {
      return 0;
    }

    const score = candidate.overallScore || candidate.trendScore || 0;
    const priority = candidate.priorityScore || 0;
    const risk = candidate.eventRisk || 'Medium';

    // 基础数量
    let baseQty = 10;

    // 根据confidence调整
    if (confidencePercent >= 80) {
      baseQty = 20;
    } else if (confidencePercent >= 60) {
      baseQty = 15;
    }

    // 根据score调整
    if (score >= 80) {
      baseQty += 5;
    } else if (score >= 60) {
      baseQty += 2;
    }

    // 根据priority调整
    if (priority >= 80) {
      baseQty += 5;
    } else if (priority >= 60) {
      baseQty += 2;
    }

    // 根据risk调整
    if (risk === 'Low') {
      baseQty += 3;
    } else if (risk === 'High') {
      baseQty = Math.max(1, baseQty - 5);
    }

    return Math.max(1, baseQty); // 确保至少为1
  };

  // 辅助函数：确定推荐状态
  const determineRecommendationStatus = (aiResponse: any, candidate: any): string => {
    if (!aiResponse.success) {
      return 'error';
    }

    const score = candidate.overallScore || candidate.trendScore || 0;
    const priority = candidate.priorityScore || 0;

    if (score >= 80 && priority >= 80) {
      return 'success';
    } else if (score >= 60 && priority >= 60) {
      return 'partial';
    } else {
      return 'success'; // 默认成功
    }
  };

  // 辅助函数：生成fallback推荐（AI不可用时）
  const generateFallbackRecommendation = (candidate: any): any => {
    const trend = candidate.trendLabel || 'N/A';
    const score = candidate.overallScore ?? candidate.trendScore ?? null;
    const risk = candidate.eventRisk || 'N/A';
    const scoreStr = score != null ? String(score) : 'N/A';

    const reasoning = `[AI unavailable] Cannot generate recommendation. Trend: ${trend}, Score: ${scoreStr}, Risk: ${risk}.`;

    return {
      recommendation: 'N/A',
      confidence: null,
      reason: reasoning,
      reasonFull: reasoning,
      backtestSummary: 'N/A',
      optimizationSummary: 'N/A',
      recommendedQty: null,
      positionSize: null
    };
  };

  // 辅助函数：计算推荐汇总统计
  const calculateRecommendationSummary = (recommendations: any[]): any => {
    const total = recommendations.length;
    const successful = recommendations.filter(r => r.status === 'success').length;
    const errors = recommendations.filter(r => r.status === 'error').length;
    const partial = recommendations.filter(r => r.status === 'partial').length;
    const holdCount = recommendations.filter(r => r.recommendation === 'HOLD').length;

    // 计算平均confidence (0-100%)
    const validConfidences = recommendations
      .filter(r => r.confidence >= 0 && r.confidence <= 1)
      .map(r => r.confidence * 100);

    const avgConfidence = validConfidences.length > 0
      ? validConfidences.reduce((sum, conf) => sum + conf, 0) / validConfidences.length
      : 0;

    // 验证统计
    const validationStats = {
      confidenceValid: recommendations.filter(r => r.validation?.confidenceValid === true).length,
      actionValid: recommendations.filter(r => r.validation?.actionValid === true).length,
      reasoningValid: recommendations.filter(r => r.validation?.reasoningValid === true).length,
      qtyValid: recommendations.filter(r => r.validation?.qtyValid === true).length,
      strategyCountValid: recommendations.filter(r => r.validation?.strategyCountValid === true).length,
      marketTypeValid: recommendations.filter(r => r.validation?.marketTypeValid === true).length
    };

    // 市场类型统计
    const marketTypeStats = {
      trend: recommendations.filter(r => r.marketType === 'Trend').length,
      range: recommendations.filter(r => r.marketType === 'Range').length,
      breakout: recommendations.filter(r => r.marketType === 'Breakout Prep').length,
      mixed: recommendations.filter(r => r.marketType === 'Mixed').length,
      unclear: recommendations.filter(r => r.marketType === 'Unclear').length
    };

    // 策略数量统计
    const strategyCountStats = {
      oneStrategy: recommendations.filter(r => {
        const strategies = r.selectedStrategies?.split(',') || [];
        return strategies.length === 1;
      }).length,
      twoStrategies: recommendations.filter(r => {
        const strategies = r.selectedStrategies?.split(',') || [];
        return strategies.length === 2;
      }).length,
      threeStrategies: recommendations.filter(r => {
        const strategies = r.selectedStrategies?.split(',') || [];
        return strategies.length === 3;
      }).length,
      moreThanThree: recommendations.filter(r => {
        const strategies = r.selectedStrategies?.split(',') || [];
        return strategies.length > 3;
      }).length
    };

    return {
      total,
      successful,
      errors,
      partial,
      holdCount,
      avgConfidence: Math.round(avgConfidence * 10) / 10, // 保留一位小数
      validationStats,
      marketTypeStats,
      strategyCountStats
    };
  };

  // ========== 策略路由相关辅助函数 ==========

  // 从AI决策中提取市场类型
  const extractMarketTypeFromDecision = (decision: any): string => {
    const reason = decision.reason || '';
    const reasonLower = reason.toLowerCase();

    // 检查AI返回的reasoning中是否包含市场类型关键词
    if (reasonLower.includes('trend') || reasonLower.includes('趋势')) {
      return 'Trend';
    } else if (reasonLower.includes('range') || reasonLower.includes('震荡') || reasonLower.includes('区间')) {
      return 'Range';
    } else if (reasonLower.includes('breakout') || reasonLower.includes('突破')) {
      return 'Breakout Prep';
    } else if (reasonLower.includes('mixed') || reasonLower.includes('混合')) {
      return 'Mixed';
    } else {
      return 'Unclear';
    }
  };

  // 根据市场类型选择策略
  const selectStrategiesForMarketType = (marketType: string, candidate: any): string[] => {
    const trend = candidate.trendLabel || 'Neutral';
    const score = candidate.overallScore || candidate.trendScore || 0;
    const risk = candidate.eventRisk || 'Medium';

    // 策略映射
    const strategyMap: Record<string, string[]> = {
      'Trend': ['Moving Average', 'MACD', 'Breakout follow-through'],
      'Range': ['RSI', 'Mean Reversion', 'Bollinger Band'],
      'Breakout Prep': ['Breakout', 'Volume confirmation', 'Momentum continuation'],
      'Mixed': ['Moving Average', 'RSI', 'Breakout'], // 混合型：各选一个代表性策略
      'Unclear': ['Moving Average'] // 不明确：只跑最基础的移动平均
    };

    // 获取基础策略列表
    let strategies = strategyMap[marketType] || ['Moving Average'];

    // 根据候选特征调整策略数量
    if (marketType === 'Unclear' || risk === 'High' || score < 60) {
      // 高风险或低分股票：只跑1个策略
      strategies = strategies.slice(0, 1);
    } else if (marketType === 'Mixed' || score < 75) {
      // 混合型或中等分数：跑2个策略
      strategies = strategies.slice(0, 2);
    } else {
      // 明确类型且高分：跑最多3个策略
      strategies = strategies.slice(0, 3);
    }

    return strategies;
  };

  // 基于规则确定市场类型（AI路由失败时的fallback）
  const determineMarketTypeByRules = (candidate: any, marketData: any): string => {
    const trend = candidate.trendLabel || 'Neutral';
    const score = candidate.overallScore || candidate.trendScore || 0;
    const changePercent = marketData?.changePercent || candidate.changePct || candidate.priceChange || 0;
    const volumeStatus = candidate.volumeStatus || 'Normal';

    // 规则1: 强趋势股票 -> Trend
    if ((trend === 'Strong Bullish' || trend === 'Strong Bearish') && score >= 75) {
      return 'Trend';
    }

    // 规则2: 中等趋势但波动大 -> Mixed
    if ((trend === 'Bullish' || trend === 'Bearish') && Math.abs(changePercent) > 3) {
      return 'Mixed';
    }

    // 规则3: 趋势不明显，分数中等 -> Range
    if (trend === 'Neutral' && score >= 60 && score < 75) {
      return 'Range';
    }

    // 规则4: 接近关键位置，成交量异常 -> Breakout Prep
    if (Math.abs(changePercent) < 1.5 && (volumeStatus === 'High' || volumeStatus === 'Very High')) {
      return 'Breakout Prep';
    }

    // 默认: Unclear
    return 'Unclear';
  };

  // 生成包含策略路由的AI Reasoning
  const generateAiReasoningWithStrategyRouting = (candidate: any, decision: any, marketType: string, selectedStrategies: string[]): string => {
    const trend = candidate.trendLabel || 'Neutral';
    const score = candidate.overallScore || candidate.trendScore || 0;
    const risk = candidate.eventRisk || 'Medium';
    const news = candidate.newsSentiment || 'Neutral';
    const change = candidate.changePct || candidate.priceChange || 0;

    let reasoning = '';

    if (decision.reason && decision.reason.length > 0) {
      // 使用AI生成的reasoning
      reasoning = decision.reason;
    } else {
      // 生成基于字段和策略路由的reasoning
      reasoning = `${marketType}市场类型: ${trend}趋势，${score}分，${risk}风险。`;
      reasoning += `分配策略: ${selectedStrategies.join('、')}。`;
      reasoning += `${news}新闻情绪，${change >= 0 ? '+' : ''}${change.toFixed(2)}%涨跌幅。`;
    }

    // 确保reasoning不为空且长度合理
    if (!reasoning || reasoning.trim().length === 0) {
      reasoning = `${marketType}市场类型分析: ${trend}趋势，${score}分，分配${selectedStrategies.length}个策略。`;
    }

    // 限制长度
    if (reasoning.length > 200) {
      reasoning = reasoning.substring(0, 197) + '...';
    }

    return reasoning;
  };

  // 基于策略路由确定Backtest状态
  const determineBacktestStatusWithRouting = (candidate: any, marketType: string, selectedStrategies: string[]): string => {
    const score = candidate.overallScore || candidate.trendScore || 0;
    const strategyCount = selectedStrategies.length;

    if (marketType === 'Trend' && score >= 75) {
      return `Available for ${strategyCount} trend strategies`;
    } else if (marketType === 'Range' && score >= 65) {
      return `Available for ${strategyCount} range strategies`;
    } else if (marketType === 'Breakout Prep') {
      return `Pending breakout confirmation`;
    } else if (strategyCount === 1) {
      return 'Single strategy backtest';
    } else {
      return `Limited to ${strategyCount} strategies`;
    }
  };

  // 基于策略路由确定Optimization状态
  const determineOptimizationStatusWithRouting = (candidate: any, marketType: string, selectedStrategies: string[]): string => {
    const priority = candidate.priorityScore || 0;
    const strategyCount = selectedStrategies.length;

    if (priority >= 80 && strategyCount <= 2) {
      return `Optimization feasible for ${strategyCount} strategies`;
    } else if (priority >= 60) {
      return `Limited optimization for ${strategyCount} strategies`;
    } else if (strategyCount === 1) {
      return 'Single strategy optimization';
    } else {
      return `Strategy-specific optimization`;
    }
  };

  // 基于策略路由计算Suggested Qty
  const calculateSuggestedQtyWithRouting = (action: string, confidencePercent: number, candidate: any, marketType: string): number => {
    if (action !== 'BUY') {
      return 0;
    }

    const score = candidate.overallScore || candidate.trendScore || 0;
    const priority = candidate.priorityScore || 0;
    const risk = candidate.eventRisk || 'Medium';

    // 基础数量
    let baseQty = 10;

    // 根据市场类型调整
    if (marketType === 'Trend') {
      baseQty += 5; // 趋势型可以多买
    } else if (marketType === 'Breakout Prep') {
      baseQty += 3; // 突破准备型中等
    } else if (marketType === 'Range') {
      baseQty -= 2; // 震荡型少买
    }

    // 根据confidence调整
    if (confidencePercent >= 80) {
      baseQty = Math.round(baseQty * 1.5);
    } else if (confidencePercent >= 60) {
      baseQty = Math.round(baseQty * 1.2);
    }

    // 根据score调整
    if (score >= 80) {
      baseQty += 5;
    } else if (score >= 60) {
      baseQty += 2;
    }

    // 根据priority调整
    if (priority >= 80) {
      baseQty += 5;
    } else if (priority >= 60) {
      baseQty += 2;
    }

    // 根据risk调整
    if (risk === 'Low') {
      baseQty += 3;
    } else if (risk === 'High') {
      baseQty = Math.max(1, baseQty - 5);
    }

    return Math.max(1, baseQty); // 确保至少为1
  };

  // 基于策略路由确定推荐状态
  const determineRecommendationStatusWithRouting = (aiResponse: any, candidate: any, marketType: string): string => {
    if (!aiResponse.success) {
      return 'error';
    }

    const score = candidate.overallScore || candidate.trendScore || 0;
    const priority = candidate.priorityScore || 0;

    // 明确的市场类型且高分 -> success
    if (marketType !== 'Unclear' && score >= 75 && priority >= 70) {
      return 'success';
    }

    // 中等条件 -> partial
    if (score >= 60 && priority >= 60) {
      return 'partial';
    }

    // 默认成功
    return 'success';
  };

  // ========== 回测相关辅助函数 ==========

  // 运行策略回测 - 真正调用平台内已有的backtest功能
  const runStrategyBacktests = async (symbol: string, strategies: string[], candidate: any, marketData: any): Promise<any[]> => {
    const backtestResults = [];

    for (const strategy of strategies) {
      try {
        console.log(`=== 开始真实回测: ${symbol} - ${strategy} ===`);

        // 构建回测配置 - 使用平台标准格式
        const backtestConfig = {
          symbol: symbol,
          strategy: mapStrategyToBacktestType(strategy),
          startDate: getDefaultStartDate(),
          endDate: getDefaultEndDate(),
          initialCapital: 10000,
          parameters: getStrategyParameters(strategy)
        };

        console.log(`回测请求配置:`, JSON.stringify(backtestConfig, null, 2));

        // 真正调用平台内已有的backtest API
        const backtestResponse = await backtraderAPI.runBacktest(backtestConfig);
        console.log(`回测响应:`, backtestResponse);

        // 详细解析API响应
        const responseData = backtestResponse.data;
        console.log(`回测响应数据:`, responseData);

        let backtestResult: any = {
          strategy: strategy,
          responseData: responseData
        };

        if (responseData?.success) {
          // 成功响应 - 解析真实结果
          const result = responseData.result || {};
          const results = result.results || {};

          backtestResult = {
            ...backtestResult,
            status: 'completed',
            totalReturn: results.totalReturn || result.totalReturn || 0,
            sharpeRatio: results.sharpeRatio || result.sharpeRatio || 0,
            winRate: results.winRate || result.winRate || 0,
            maxDrawdown: results.maxDrawdown || result.maxDrawdown || 0,
            tradeCount: results.tradeCount || result.tradeCount || 0,
            bestParams: results.bestParams || result.bestParams || {},
            equityCurve: results.equityCurve || result.equityCurve || [],
            trades: results.trades || result.trades || [],
            error: null
          };

          console.log(`回测成功 - ${strategy}:`, {
            totalReturn: backtestResult.totalReturn,
            winRate: backtestResult.winRate,
            sharpeRatio: backtestResult.sharpeRatio,
            maxDrawdown: backtestResult.maxDrawdown
          });
        } else {
          // 失败响应
          backtestResult = {
            ...backtestResult,
            status: 'failed',
            totalReturn: 0,
            sharpeRatio: 0,
            winRate: 0,
            maxDrawdown: 0,
            tradeCount: 0,
            error: responseData?.error || responseData?.message || '回测失败'
          };

          console.warn(`回测失败 - ${strategy}:`, backtestResult.error);
        }

        backtestResults.push(backtestResult);

        // 短暂延迟，避免API限制
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error: any) {
        console.error(`回测异常 - ${symbol} - ${strategy}:`, error);

        // 添加异常的回测结果
        backtestResults.push({
          strategy: strategy,
          status: 'failed',
          totalReturn: 0,
          sharpeRatio: 0,
          winRate: 0,
          maxDrawdown: 0,
          tradeCount: 0,
          error: error.message || '回测异常',
          responseData: null
        });
      }
    }

    console.log(`=== ${symbol} 回测完成，${backtestResults.filter(r => r.status === 'completed').length}/${strategies.length} 个策略成功 ===`);
    return backtestResults;
  };

  // 运行参数优化 - 真正调用平台内已有的parameter optimization功能
  const runParameterOptimizations = async (symbol: string, strategies: string[], backtestResults: any[]): Promise<any[]> => {
    const optimizationResults: any[] = [];

    // 只对回测成功的策略进行优化
    const successfulStrategies = backtestResults
      .filter(r => r.status === 'completed' && r.totalReturn > 0)
      .map(r => r.strategy);

    if (successfulStrategies.length === 0) {
      console.log(`股票 ${symbol} 没有成功的回测结果，跳过参数优化`);
      return optimizationResults;
    }

    for (const strategy of successfulStrategies) {
      try {
        console.log(`=== 开始参数优化: ${symbol} - ${strategy} ===`);

        // 1. 检查平台是否支持该策略的optimization
        if (!isStrategySupportedForOptimization(strategy)) {
          console.log(`策略 ${strategy} 不支持optimization，跳过`);

          optimizationResults.push({
            strategy: strategy,
            status: 'not_supported',
            bestParams: {},
            bestReturn: 0,
            bestSharpe: 0,
            error: `策略 ${strategy} 不支持参数优化`,
            responseData: null,
            optimizationConfig: null
          });

          continue;
        }

        // 2. 获取平台支持的optimization配置
        const optimizationConfig = getPlatformOptimizationConfig(symbol, strategy);

        if (!optimizationConfig) {
          console.log(`无法为策略 ${strategy} 生成有效的optimization配置`);

          optimizationResults.push({
            strategy: strategy,
            status: 'not_supported',
            bestParams: {},
            bestReturn: 0,
            bestSharpe: 0,
            error: `策略 ${strategy} 的optimization配置不可用`,
            responseData: null,
            optimizationConfig: null
          });

          continue;
        }

        console.log(`优化请求配置:`, JSON.stringify(optimizationConfig, null, 2));

        // 3. 真正调用平台内已有的parameter optimization API
        const optimizationResponse = await backtraderAPI.runParameterOptimization(optimizationConfig);
        console.log(`优化响应状态:`, optimizationResponse.status);
        console.log(`优化响应数据:`, optimizationResponse.data);

        // 详细解析API响应
        const responseData = optimizationResponse.data;

        let optimizationResult: any = {
          strategy: strategy,
          responseData: responseData,
          optimizationConfig: optimizationConfig
        };

        if (responseData?.success) {
          // 成功响应 - 解析真实结果
          const result = responseData.result || {};
          const bestResult = result.bestResult || {};

          optimizationResult = {
            ...optimizationResult,
            status: 'completed',
            bestParams: bestResult.parameters || result.bestParams || {},
            bestReturn: bestResult.totalReturn || result.bestReturn || 0,
            bestSharpe: bestResult.sharpeRatio || result.bestSharpe || 0,
            optimizationSpace: result.optimizationSpace || optimizationConfig.parameterSpace || {},
            allResults: result.allResults || [],
            totalCombinations: result.totalCombinations ||
                              (optimizationConfig.parameterSpace ?
                               Object.keys(optimizationConfig.parameterSpace).length : 0),
            error: null
          };

          console.log(`优化成功 - ${strategy}:`, {
            bestReturn: optimizationResult.bestReturn,
            bestParams: optimizationResult.bestParams,
            totalCombinations: optimizationResult.totalCombinations
          });
        } else {
          // 失败响应 - 提取详细错误信息
          let errorMessage = '参数优化失败';

          if (responseData?.error) {
            errorMessage = responseData.error;
          } else if (responseData?.message) {
            errorMessage = responseData.message;
          } else if (optimizationResponse.status === 400) {
            errorMessage = `API请求错误 (400): ${JSON.stringify(responseData || {})}`;
          } else if (optimizationResponse.status >= 500) {
            errorMessage = `服务器错误 (${optimizationResponse.status})`;
          }

          optimizationResult = {
            ...optimizationResult,
            status: 'failed',
            bestParams: {},
            bestReturn: 0,
            bestSharpe: 0,
            error: errorMessage,
            optimizationSpace: optimizationConfig.parameterSpace || {}
          };

          console.warn(`优化失败 - ${strategy}:`, {
            error: optimizationResult.error,
            status: optimizationResponse.status,
            config: optimizationConfig
          });
        }

        optimizationResults.push(optimizationResult);

        // 短暂延迟，避免API限制
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error: any) {
        console.error(`优化异常 - ${symbol} - ${strategy}:`, error);

        // 添加异常的优化结果
        optimizationResults.push({
          strategy: strategy,
          status: 'failed',
          bestParams: {},
          bestReturn: 0,
          bestSharpe: 0,
          error: `异常: ${error.message || '未知错误'}`,
          responseData: null,
          optimizationConfig: null
        });
      }
    }

    console.log(`=== ${symbol} 参数优化完成，${optimizationResults.filter(r => r.status === 'completed').length}/${successfulStrategies.length} 个策略成功 ===`);
    return optimizationResults;
  };

  // 获取优化参数范围
  const getOptimizationParameters = (strategy: string): any => {
    const optimizationParams: Record<string, any> = {
      'Moving Average': {
        shortPeriod: { min: 5, max: 30, step: 5 },
        longPeriod: { min: 30, max: 100, step: 10 }
      },
      'MACD': {
        fastPeriod: { min: 8, max: 20, step: 2 },
        slowPeriod: { min: 20, max: 40, step: 5 },
        signalPeriod: { min: 5, max: 15, step: 2 }
      },
      'RSI': {
        period: { min: 10, max: 30, step: 5 },
        oversold: { min: 20, max: 40, step: 5 },
        overbought: { min: 60, max: 80, step: 5 }
      },
      'Mean Reversion': {
        period: { min: 10, max: 40, step: 5 },
        stdDev: { min: 1.5, max: 3.0, step: 0.5 }
      },
      'Bollinger Band': {
        period: { min: 10, max: 40, step: 5 },
        stdDev: { min: 1.5, max: 3.0, step: 0.5 }
      },
      'Breakout': {
        period: { min: 10, max: 40, step: 5 },
        multiplier: { min: 1.0, max: 2.0, step: 0.2 }
      },
      'Volume confirmation': {
        volumePeriod: { min: 10, max: 40, step: 5 },
        volumeMultiplier: { min: 1.2, max: 2.5, step: 0.2 }
      },
      'Momentum continuation': {
        period: { min: 5, max: 20, step: 3 }
      }
    };

    return optimizationParams[strategy] || optimizationParams['Moving Average'];
  };

  // 将策略名称映射到回测类型
  const mapStrategyToBacktestType = (strategy: string): string => {
    const strategyMap: Record<string, string> = {
      'Moving Average': 'moving_average',
      'MACD': 'macd',
      'Breakout follow-through': 'breakout',
      'RSI': 'rsi',
      'Mean Reversion': 'mean_reversion',
      'Bollinger Band': 'bollinger_band',
      'Breakout': 'breakout',
      'Volume confirmation': 'volume_breakout',
      'Momentum continuation': 'momentum'
    };

    return strategyMap[strategy] || 'moving_average';
  };

  // 检查平台是否支持该策略的optimization
  const isStrategySupportedForOptimization = (strategy: string): boolean => {
    // 平台支持的optimization策略列表（基于实际平台能力）
    const supportedStrategies = [
      'moving_average',
      'macd',
      'rsi',
      'bollinger_band',
      'breakout'
      // 注意：mean_reversion, volume_breakout, momentum 可能不被平台optimization支持
    ];

    const strategyKey = mapStrategyToBacktestType(strategy);
    return supportedStrategies.includes(strategyKey);
  };

  // 获取平台支持的optimization配置
  const getPlatformOptimizationConfig = (symbol: string, strategy: string): any => {
    const strategyKey = mapStrategyToBacktestType(strategy);

    // 基础配置
    const baseConfig = {
      symbol: symbol,
      strategy: strategyKey,
      startDate: getDefaultStartDate(),
      endDate: getDefaultEndDate(),
      initialCapital: 10000
    };

    // 根据策略类型添加特定配置
    switch (strategyKey) {
      case 'moving_average':
        return {
          ...baseConfig,
          parameterSpace: {
            shortPeriod: { min: 5, max: 30, step: 5 },
            longPeriod: { min: 30, max: 100, step: 10 }
          }
        };
      case 'macd':
        return {
          ...baseConfig,
          parameterSpace: {
            fastPeriod: { min: 8, max: 20, step: 2 },
            slowPeriod: { min: 20, max: 40, step: 5 },
            signalPeriod: { min: 5, max: 15, step: 2 }
          }
        };
      case 'rsi':
        return {
          ...baseConfig,
          parameterSpace: {
            period: { min: 10, max: 30, step: 5 },
            oversold: { min: 20, max: 40, step: 5 },
            overbought: { min: 60, max: 80, step: 5 }
          }
        };
      case 'bollinger_band':
        return {
          ...baseConfig,
          parameterSpace: {
            period: { min: 10, max: 40, step: 5 },
            stdDev: { min: 1.5, max: 3.0, step: 0.5 }
          }
        };
      case 'breakout':
        return {
          ...baseConfig,
          parameterSpace: {
            period: { min: 10, max: 40, step: 5 },
            multiplier: { min: 1.0, max: 2.0, step: 0.2 }
          }
        };
      default:
        // 对于不支持的策略，返回null表示不运行optimization
        return null;
    }
  };

  // 获取默认开始日期（30天前）
  const getDefaultStartDate = (): string => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  };

  // 获取默认结束日期（今天）
  const getDefaultEndDate = (): string => {
    return new Date().toISOString().split('T')[0];
  };

  // 获取策略参数
  const getStrategyParameters = (strategy: string): any => {
    const defaultParams: Record<string, any> = {
      moving_average: { shortPeriod: 20, longPeriod: 50 },
      macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
      rsi: { period: 14, oversold: 30, overbought: 70 },
      mean_reversion: { period: 20, stdDev: 2 },
      bollinger_band: { period: 20, stdDev: 2 },
      breakout: { period: 20, multiplier: 1 },
      volume_breakout: { volumePeriod: 20, volumeMultiplier: 1.5 },
      momentum: { period: 10 }
    };

    const strategyKey = mapStrategyToBacktestType(strategy);
    return defaultParams[strategyKey] || defaultParams.moving_average;
  };

  // 从回测响应中提取总回报
  const extractTotalReturn = (responseData: any): number => {
    if (!responseData?.result) return 0;

    // 尝试不同的字段名
    return responseData.result.results?.totalReturn ||
           responseData.result.totalReturn ||
           responseData.result.return ||
           0;
  };

  // 从回测响应中提取夏普比率
  const extractSharpeRatio = (responseData: any): number => {
    if (!responseData?.result) return 0;

    return responseData.result.results?.sharpeRatio ||
           responseData.result.sharpeRatio ||
           0;
  };

  // 从回测响应中提取胜率
  const extractWinRate = (responseData: any): number => {
    if (!responseData?.result) return 0;

    return responseData.result.results?.winRate ||
           responseData.result.winRate ||
           0;
  };

  // 从回测响应中提取最大回撤
  const extractMaxDrawdown = (responseData: any): number => {
    if (!responseData?.result) return 0;

    return responseData.result.results?.maxDrawdown ||
           responseData.result.maxDrawdown ||
           0;
  };

  // 从回测响应中提取交易次数
  const extractTradeCount = (responseData: any): number => {
    if (!responseData?.result) return 0;

    return responseData.result.results?.tradeCount ||
           responseData.result.tradeCount ||
           0;
  };

  // 生成回测摘要
  const generateBacktestSummary = (backtestResults: any[]): string => {
    const completedResults = backtestResults.filter(r => r.status === 'completed');

    if (completedResults.length === 0) {
      return 'No backtest completed';
    }

    // 找到最佳策略
    const bestResult = completedResults.reduce((best, current) => {
      return (current.totalReturn > best.totalReturn) ? current : best;
    }, completedResults[0]);

    return `${completedResults.length} strategies tested | Best: ${bestResult.strategy} (${bestResult.totalReturn.toFixed(1)}%)`;
  };

  // 找到最佳策略
  const findBestStrategy = (backtestResults: any[]): string => {
    const completedResults = backtestResults.filter(r => r.status === 'completed');

    if (completedResults.length === 0) {
      return 'N/A';
    }

    const bestResult = completedResults.reduce((best, current) => {
      return (current.totalReturn > best.totalReturn) ? current : best;
    }, completedResults[0]);

    return bestResult.strategy;
  };

  // 找到最佳策略回报
  const findBestStrategyReturn = (backtestResults: any[]): number => {
    const completedResults = backtestResults.filter(r => r.status === 'completed');

    if (completedResults.length === 0) {
      return 0;
    }

    const bestResult = completedResults.reduce((best, current) => {
      return (current.totalReturn > best.totalReturn) ? current : best;
    }, completedResults[0]);

    return bestResult.totalReturn;
  };

  // 确定整体回测状态
  const determineOverallBacktestStatus = (backtestResults: any[]): string => {
    const completedCount = backtestResults.filter(r => r.status === 'completed').length;
    const totalCount = backtestResults.length;

    if (completedCount === 0) {
      return 'Failed';
    } else if (completedCount === totalCount) {
      return 'Completed';
    } else if (completedCount >= totalCount / 2) {
      return 'Partial';
    } else {
      return 'Limited';
    }
  };

  // 基于回测结果确定Action
  const determineActionFromBacktestResults = (backtestResults: any[], defaultAction: string): string => {
    const completedResults = backtestResults.filter(r => r.status === 'completed');

    if (completedResults.length === 0) {
      return defaultAction;
    }

    // 检查是否有成功的回测结果
    const profitableResults = completedResults.filter(r => r.totalReturn > 0);
    const profitableRatio = profitableResults.length / completedResults.length;

    if (profitableRatio >= 0.7) {
      return 'BUY';
    } else if (profitableRatio >= 0.4) {
      return 'HOLD';
    } else {
      return 'SKIP';
    }
  };

  // 基于回测结果调整置信度
  const adjustConfidenceWithBacktestResults = (baseConfidence: number, backtestResults: any[]): number => {
    const completedResults = backtestResults.filter(r => r.status === 'completed');

    if (completedResults.length === 0) {
      return baseConfidence * 0.5; // 没有回测结果，降低置信度
    }

    // 计算平均夏普比率
    const avgSharpe = completedResults.reduce((sum, r) => sum + r.sharpeRatio, 0) / completedResults.length;

    // 基于夏普比率调整置信度
    let adjustment = 1.0;
    if (avgSharpe > 1.5) {
      adjustment = 1.2;
    } else if (avgSharpe > 1.0) {
      adjustment = 1.1;
    } else if (avgSharpe < 0) {
      adjustment = 0.7;
    }

    return Math.max(0, Math.min(1, baseConfidence * adjustment));
  };

  // 生成包含回测结果的AI Reasoning
  const generateAiReasoningWithBacktestResults = (candidate: any, decision: any, marketType: string, selectedStrategies: string[], backtestResults: any[]): string => {
    const trend = candidate.trendLabel || 'Neutral';
    const score = candidate.overallScore || candidate.trendScore || 0;
    const risk = candidate.eventRisk || 'Medium';

    let reasoning = '';

    if (decision.reason && decision.reason.length > 0) {
      // 使用AI生成的reasoning
      reasoning = decision.reason;
    } else {
      // 生成基于字段、策略路由和回测结果的reasoning
      const completedResults = backtestResults.filter(r => r.status === 'completed');
      const bestResult = completedResults.length > 0 ?
        completedResults.reduce((best, current) => (current.totalReturn > best.totalReturn) ? current : best, completedResults[0]) :
        null;

      reasoning = `${marketType}市场类型: ${trend}趋势，${score}分，${risk}风险。`;
      reasoning += `运行${selectedStrategies.length}个策略，${completedResults.length}个回测完成。`;

      if (bestResult) {
        reasoning += `最佳策略: ${bestResult.strategy} (${bestResult.totalReturn.toFixed(1)}%回报)。`;
      }
    }

    // 确保reasoning不为空且长度合理
    if (!reasoning || reasoning.trim().length === 0) {
      reasoning = `${marketType}市场类型分析: ${trend}趋势，${score}分，运行${selectedStrategies.length}个策略回测。`;
    }

    // 限制长度
    if (reasoning.length > 200) {
      reasoning = reasoning.substring(0, 197) + '...';
    }

    return reasoning;
  };

  // 基于回测结果计算Suggested Qty
  const calculateSuggestedQtyWithBacktestResults = (action: string, confidencePercent: number, candidate: any, marketType: string, backtestResults: any[]): number => {
    if (action !== 'BUY') {
      return 0;
    }

    const completedResults = backtestResults.filter(r => r.status === 'completed');

    if (completedResults.length === 0) {
      return calculateSuggestedQtyWithRouting(action, confidencePercent, candidate, marketType);
    }

    // 基于回测结果计算数量
    const avgReturn = completedResults.reduce((sum, r) => sum + r.totalReturn, 0) / completedResults.length;
    const avgSharpe = completedResults.reduce((sum, r) => sum + r.sharpeRatio, 0) / completedResults.length;

    // 基础数量
    let baseQty = 10;

    // 根据平均回报调整
    if (avgReturn > 10) {
      baseQty += 10;
    } else if (avgReturn > 5) {
      baseQty += 5;
    } else if (avgReturn < 0) {
      baseQty = Math.max(1, baseQty - 5);
    }

    // 根据夏普比率调整
    if (avgSharpe > 1.5) {
      baseQty += 5;
    } else if (avgSharpe > 1.0) {
      baseQty += 3;
    } else if (avgSharpe < 0.5) {
      baseQty = Math.max(1, baseQty - 3);
    }

    // 根据confidence调整
    if (confidencePercent >= 80) {
      baseQty = Math.round(baseQty * 1.5);
    } else if (confidencePercent >= 60) {
      baseQty = Math.round(baseQty * 1.2);
    }

    return Math.max(1, baseQty);
  };

  // 基于回测结果确定推荐状态
  const determineRecommendationStatusWithBacktestResults = (aiResponse: any, candidate: any, marketType: string, backtestResults: any[]): string => {
    if (!aiResponse.success) {
      return 'error';
    }

    const completedResults = backtestResults.filter(r => r.status === 'completed');

    if (completedResults.length === 0) {
      return 'error';
    }

    const score = candidate.overallScore || candidate.trendScore || 0;
    const avgReturn = completedResults.reduce((sum, r) => sum + r.totalReturn, 0) / completedResults.length;

    // 高分且正回报 -> success
    if (score >= 75 && avgReturn > 5) {
      return 'success';
    }

    // 中等条件 -> partial
    if (score >= 60 && avgReturn > 0) {
      return 'partial';
    }

    // 默认成功
    return 'success';
  };

  // 基于回测结果确定优化状态
  const determineOptimizationStatusWithBacktestResults = (candidate: any, marketType: string, selectedStrategies: string[], backtestResults: any[]): string => {
    const completedResults = backtestResults.filter(r => r.status === 'completed');

    if (completedResults.length === 0) {
      return 'Backtest failed';
    }

    const profitableResults = completedResults.filter(r => r.totalReturn > 0);
    const profitableRatio = profitableResults.length / completedResults.length;

    if (profitableRatio >= 0.7 && completedResults.length >= 2) {
      return `Optimization feasible (${profitableResults.length}/${completedResults.length} profitable)`;
    } else if (profitableRatio >= 0.5) {
      return `Limited optimization (${profitableResults.length}/${completedResults.length} profitable)`;
    } else {
      return `Strategy-specific analysis`;
    }
  };

  // ========== 优化结果相关辅助函数 ==========

  // 生成优化摘要
  const generateOptimizationSummary = (optimizationResults: any[]): string => {
    const completedResults = optimizationResults.filter(r => r.status === 'completed');

    if (completedResults.length === 0) {
      return 'No optimization completed';
    }

    // 找到最佳优化策略
    const bestResult = completedResults.reduce((best, current) => {
      return (current.bestReturn > best.bestReturn) ? current : best;
    }, completedResults[0]);

    return `${completedResults.length} strategies optimized | Best: ${bestResult.strategy} (${bestResult.bestReturn.toFixed(1)}%)`;
  };

  // 找到最佳优化策略
  const findBestOptimizedStrategy = (optimizationResults: any[]): string => {
    const completedResults = optimizationResults.filter(r => r.status === 'completed');

    if (completedResults.length === 0) {
      return 'N/A';
    }

    const bestResult = completedResults.reduce((best, current) => {
      return (current.bestReturn > best.bestReturn) ? current : best;
    }, completedResults[0]);

    return bestResult.strategy;
  };

  // 找到最佳优化回报
  const findBestOptimizedReturn = (optimizationResults: any[]): number => {
    const completedResults = optimizationResults.filter(r => r.status === 'completed');

    if (completedResults.length === 0) {
      return 0;
    }

    const bestResult = completedResults.reduce((best, current) => {
      return (current.bestReturn > best.bestReturn) ? current : best;
    }, completedResults[0]);

    return bestResult.bestReturn;
  };

  // 确定整体优化状态
  const determineOverallOptimizationStatus = (optimizationResults: any[]): string => {
    const completedCount = optimizationResults.filter(r => r.status === 'completed').length;
    const totalCount = optimizationResults.length;

    if (completedCount === 0) {
      return 'Failed';
    } else if (completedCount === totalCount) {
      return 'Completed';
    } else if (completedCount >= totalCount / 2) {
      return 'Partial';
    } else {
      return 'Limited';
    }
  };

  // 基于回测和优化结果确定Action
  const determineActionFromBacktestAndOptimizationResults = (backtestResults: any[], optimizationResults: any[], defaultAction: string): string => {
    const completedBacktests = backtestResults.filter(r => r.status === 'completed');
    const completedOptimizations = optimizationResults.filter(r => r.status === 'completed');

    if (completedBacktests.length === 0) {
      return defaultAction;
    }

    // 检查回测结果
    const profitableBacktests = completedBacktests.filter(r => r.totalReturn > 0);
    const backtestProfitableRatio = profitableBacktests.length / completedBacktests.length;

    // 检查优化结果（如果有）
    let optimizationProfitableRatio = 0;
    if (completedOptimizations.length > 0) {
      const profitableOptimizations = completedOptimizations.filter(r => r.bestReturn > 0);
      optimizationProfitableRatio = profitableOptimizations.length / completedOptimizations.length;
    }

    // 综合判断
    const overallProfitableRatio = completedOptimizations.length > 0
      ? (backtestProfitableRatio * 0.4 + optimizationProfitableRatio * 0.6)  // 优化结果权重更高
      : backtestProfitableRatio;

    if (overallProfitableRatio >= 0.7) {
      return 'BUY';
    } else if (overallProfitableRatio >= 0.4) {
      return 'HOLD';
    } else {
      return 'SKIP';
    }
  };

  // 基于回测和优化结果调整置信度
  const adjustConfidenceWithBacktestAndOptimizationResults = (baseConfidence: number, backtestResults: any[], optimizationResults: any[]): number => {
    const completedBacktests = backtestResults.filter(r => r.status === 'completed');
    const completedOptimizations = optimizationResults.filter(r => r.status === 'completed');

    if (completedBacktests.length === 0) {
      return baseConfidence * 0.5; // 没有回测结果，降低置信度
    }

    // 计算平均夏普比率（回测）
    const avgBacktestSharpe = completedBacktests.reduce((sum, r) => sum + r.sharpeRatio, 0) / completedBacktests.length;

    // 计算平均优化回报（如果有）
    let avgOptimizationReturn = 0;
    if (completedOptimizations.length > 0) {
      avgOptimizationReturn = completedOptimizations.reduce((sum, r) => sum + r.bestReturn, 0) / completedOptimizations.length;
    }

    // 基于结果调整置信度
    let adjustment = 1.0;

    // 回测夏普比率调整
    if (avgBacktestSharpe > 1.5) {
      adjustment *= 1.2;
    } else if (avgBacktestSharpe > 1.0) {
      adjustment *= 1.1;
    } else if (avgBacktestSharpe < 0) {
      adjustment *= 0.8;
    }

    // 优化结果调整（如果有）
    if (completedOptimizations.length > 0) {
      if (avgOptimizationReturn > 10) {
        adjustment *= 1.3;
      } else if (avgOptimizationReturn > 5) {
        adjustment *= 1.2;
      } else if (avgOptimizationReturn < 0) {
        adjustment *= 0.7;
      }
    }

    return Math.max(0, Math.min(1, baseConfidence * adjustment));
  };

  // 生成包含回测和优化结果的AI Reasoning
  const generateAiReasoningWithBacktestAndOptimizationResults = (candidate: any, decision: any, marketType: string, selectedStrategies: string[], backtestResults: any[], optimizationResults: any[]): string => {
    const trend = candidate.trendLabel || 'Neutral';
    const score = candidate.overallScore || candidate.trendScore || 0;
    const risk = candidate.eventRisk || 'Medium';

    let reasoning = '';

    if (decision.reason && decision.reason.length > 0) {
      // 使用AI生成的reasoning
      reasoning = decision.reason;
    } else {
      // 生成基于字段、策略路由、回测和优化结果的reasoning
      const completedBacktests = backtestResults.filter(r => r.status === 'completed');
      const completedOptimizations = optimizationResults.filter(r => r.status === 'completed');

      const bestBacktest = completedBacktests.length > 0 ?
        completedBacktests.reduce((best, current) => (current.totalReturn > best.totalReturn) ? current : best, completedBacktests[0]) :
        null;

      const bestOptimization = completedOptimizations.length > 0 ?
        completedOptimizations.reduce((best, current) => (current.bestReturn > best.bestReturn) ? current : best, completedOptimizations[0]) :
        null;

      reasoning = `${marketType}市场类型: ${trend}趋势，${score}分，${risk}风险。`;
      reasoning += `运行${selectedStrategies.length}个策略，${completedBacktests.length}个回测完成，${completedOptimizations.length}个优化完成。`;

      if (bestBacktest) {
        reasoning += `最佳回测策略: ${bestBacktest.strategy} (${bestBacktest.totalReturn.toFixed(1)}%回报)。`;
      }

      if (bestOptimization) {
        reasoning += `最佳优化策略: ${bestOptimization.strategy} (${bestOptimization.bestReturn.toFixed(1)}%优化后回报)。`;
      }
    }

    // 确保reasoning不为空且长度合理
    if (!reasoning || reasoning.trim().length === 0) {
      reasoning = `${marketType}市场类型分析: ${trend}趋势，${score}分，运行${selectedStrategies.length}个策略回测和优化。`;
    }

    // 限制长度
    if (reasoning.length > 200) {
      reasoning = reasoning.substring(0, 197) + '...';
    }

    return reasoning;
  };

  // 基于回测和优化结果计算Suggested Qty
  const calculateSuggestedQtyWithBacktestAndOptimizationResults = (action: string, confidencePercent: number, candidate: any, marketType: string, backtestResults: any[], optimizationResults: any[]): number => {
    if (action !== 'BUY') {
      return 0;
    }

    const completedBacktests = backtestResults.filter(r => r.status === 'completed');
    const completedOptimizations = optimizationResults.filter(r => r.status === 'completed');

    if (completedBacktests.length === 0) {
      return calculateSuggestedQtyWithRouting(action, confidencePercent, candidate, marketType);
    }

    // 基于回测结果计算基础数量
    const avgBacktestReturn = completedBacktests.reduce((sum, r) => sum + r.totalReturn, 0) / completedBacktests.length;
    const avgBacktestSharpe = completedBacktests.reduce((sum, r) => sum + r.sharpeRatio, 0) / completedBacktests.length;

    // 基础数量
    let baseQty = 10;

    // 根据回测平均回报调整
    if (avgBacktestReturn > 10) {
      baseQty += 10;
    } else if (avgBacktestReturn > 5) {
      baseQty += 5;
    } else if (avgBacktestReturn < 0) {
      baseQty = Math.max(1, baseQty - 5);
    }

    // 根据回测夏普比率调整
    if (avgBacktestSharpe > 1.5) {
      baseQty += 5;
    } else if (avgBacktestSharpe > 1.0) {
      baseQty += 3;
    } else if (avgBacktestSharpe < 0.5) {
      baseQty = Math.max(1, baseQty - 3);
    }

    // 根据优化结果调整（如果有）
    if (completedOptimizations.length > 0) {
      const avgOptimizationReturn = completedOptimizations.reduce((sum, r) => sum + r.bestReturn, 0) / completedOptimizations.length;

      if (avgOptimizationReturn > avgBacktestReturn + 3) {
        baseQty += 5; // 优化显著提升回报
      } else if (avgOptimizationReturn > avgBacktestReturn) {
        baseQty += 2; // 优化有提升
      }
    }

    // 根据confidence调整
    if (confidencePercent >= 80) {
      baseQty = Math.round(baseQty * 1.5);
    } else if (confidencePercent >= 60) {
      baseQty = Math.round(baseQty * 1.2);
    }

    return Math.max(1, baseQty);
  };

  // 基于回测和优化结果确定推荐状态
  const determineRecommendationStatusWithBacktestAndOptimizationResults = (aiResponse: any, candidate: any, marketType: string, backtestResults: any[], optimizationResults: any[]): string => {
    if (!aiResponse.success) {
      return 'error';
    }

    const completedBacktests = backtestResults.filter(r => r.status === 'completed');

    if (completedBacktests.length === 0) {
      return 'error';
    }

    const score = candidate.overallScore || candidate.trendScore || 0;
    const avgBacktestReturn = completedBacktests.reduce((sum, r) => sum + r.totalReturn, 0) / completedBacktests.length;

    // 检查优化结果（如果有）
    const completedOptimizations = optimizationResults.filter(r => r.status === 'completed');
    let avgOptimizationReturn = 0;
    if (completedOptimizations.length > 0) {
      avgOptimizationReturn = completedOptimizations.reduce((sum, r) => sum + r.bestReturn, 0) / completedOptimizations.length;
    }

    // 使用优化结果（如果有）或回测结果
    const effectiveReturn = completedOptimizations.length > 0 ? avgOptimizationReturn : avgBacktestReturn;

    // 高分且正回报 -> success
    if (score >= 75 && effectiveReturn > 5) {
      return 'success';
    }

    // 中等条件 -> partial
    if (score >= 60 && effectiveReturn > 0) {
      return 'partial';
    }

    // 默认成功
    return 'success';
  };

  // 生成展开详情需要的backtestKeyResults
  const generateBacktestKeyResults = (backtestResults: any[]): any => {
    const completedResults = backtestResults.filter(r => r.status === 'completed');

    if (completedResults.length === 0) {
      return null;
    }

    // 找到最佳回测结果
    const bestResult = completedResults.reduce((best, current) => {
      return (current.totalReturn > best.totalReturn) ? current : best;
    }, completedResults[0]);

    return {
      totalReturn: bestResult.totalReturn || 0,
      sharpeRatio: bestResult.sharpeRatio || 0,
      maxDrawdown: bestResult.maxDrawdown || 0,
      winRate: bestResult.winRate || 0,
      tradeCount: bestResult.tradeCount || 0,
      strategy: bestResult.strategy || 'N/A'
    };
  };

  // 生成展开详情需要的optimizationKeyResults
  const generateOptimizationKeyResults = (optimizationResults: any[]): any => {
    const completedResults = optimizationResults.filter(r => r.status === 'completed');

    if (completedResults.length === 0) {
      return null;
    }

    // 找到最佳优化结果
    const bestResult = completedResults.reduce((best, current) => {
      return (current.bestReturn > best.bestReturn) ? current : best;
    }, completedResults[0]);

    return {
      bestScore: bestResult.bestReturn || 0,
      bestCombination: bestResult.bestParams || {},
      totalCombinations: Object.keys(bestResult.optimizationSpace || {}).length || 0,
      strategy: bestResult.strategy || 'N/A'
    };
  };



  // Fine Scan: Regime detection, strategy matching AND Multi-timeframe confirmation
  // Part 1: strategy matching | Part 2: MTF (1D/4H/1H/15min) alignment
  // Process one symbol fully (both steps) before moving to the next
  const handleRunFineScan = async () => {
    if (preferredContinueScanList.length === 0) {
      message.warning('No continue list candidates available. Run Continue Scan first.');
      return;
    }

    setFineScanStatus('running');
    setFineScanProgress(0);
    setFineScanStepProgress(0);
    setFineScanCurrentStep('');
    setFineScanResults([]);
    setFineScanMessage('');

    try {
      const results: any[] = [];
      const candidates = preferredContinueScanList;
      const candidateCount = candidates.length;

      // Build a lookup map from marketScannerResults for primary data
      const scannerMap = new Map<string, any>();
      for (const s of marketScannerResults) {
        if (s.symbol) scannerMap.set(s.symbol.toUpperCase(), s);
      }

      for (let i = 0; i < candidateCount; i++) {
        const c = candidates[i];
        const progress = Math.round(((i + 1) / candidateCount) * 100);
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
        const hasAiReasoning = aiReasoning && aiReasoning.length > 20;
        const hasStructureData = !!structureLabel;

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
        const hasClearTrendSignals = (structureLabel === 'uptrend' ? 1 : 0) + (momentumLabel === 'strengthening' ? 1 : 0) + (hasStrongTrendBias ? 1 : 0);
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

          const signal1 = isBullTrend ? 'Bullish trend label' : (isBearTrend ? 'Bearish trend label' : 'Neutral trend');
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
            rec.decision = decisionResp.data.decision === 'CONTINUE' ? 'Continue' :
                           decisionResp.data.decision === 'SKIP' ? 'Skip' : 'Watch';
            rec.fineScanGrade = decisionResp.data.grade;
            rec.decisionConfidence = decisionResp.data.confidence;
            rec.decisionSource = decisionResp.data.source;
            rec.decisionReason = decisionResp.data.reason;
            if (decisionResp.data.decisionDetail) {
              rec.decisionStrengths = decisionResp.data.decisionDetail.strengths;
              rec.decisionWarnings = decisionResp.data.decisionDetail.warnings;
              rec.decisionBlockers = decisionResp.data.decisionDetail.blockers;
            }
            if (rec.provenance) {
              rec.provenance.decisionSource = decisionResp.data.source === 'ai' ? 'DeepSeek AI' : 'Local Rules';
              rec.provenance.aiCalled = decisionResp.data.source === 'ai';
            }
          } else {
            throw new Error('Decision API returned no data');
          }
        } catch (decErr: any) {
          console.warn(`[FineScanDecision] ${symbol} AI decision failed: ${decErr.message}, using local rules`);
          // Local fallback decision rules — CONTINUE = "worth deeper analysis and entry plan", not "buy now"
          const btOk = rec.backtestStatus === 'pass' && (rec.backtestPerformance === 'positive' || rec.backtestPerformance === 'caution');
          const eqOk = rec.entryQuality === 'Excellent' || rec.entryQuality === 'Good' || rec.entryQuality === 'Wait for Pullback' || rec.entryQuality === 'Breakout Setup';
          const riskOk = rec.riskGrade === 'LOW' || rec.riskGrade === 'MEDIUM';
          const scoreOk = (rec.matchConfidence || 0) >= 30;
          const riskSkip = rec.riskGrade === 'SKIP';
          const entryAvoidDowntrend = rec.entryQuality === 'Avoid / Downtrend';
          const blockers = (rec.entryQuality === 'Chasing / Extended' ? 1 : 0) +
            (rec.riskGrade === 'HIGH' ? 1 : 0) +
            (rec.liquidityGrade === 'Poor' ? 1 : 0);
          const hasPositiveBacktest = rec.backtestStatus === 'pass' && rec.backtestPerformance !== 'negative';
          if (btOk && scoreOk && riskOk && blockers === 0) {
            // Strong across all dimensions
            rec.decision = 'Continue';
            rec.fineScanGrade = 'HIGH';
          } else if (btOk && (rec.matchConfidence || 0) >= 25 && blockers <= 1) {
            // Good enough for deeper validation — relaxed
            rec.decision = 'Continue';
            rec.fineScanGrade = riskOk ? 'HIGH' : 'MEDIUM';
          } else if (hasPositiveBacktest && (rec.matchConfidence || 0) >= 20 && blockers <= 2) {
            // Borderline but worth deeper analysis
            rec.decision = 'Continue';
            rec.fineScanGrade = 'MEDIUM';
          } else if (riskSkip || entryAvoidDowntrend || ((rec.matchConfidence || 0) < 10 && !btOk && !riskOk)) {
            rec.decision = 'Skip';
            rec.fineScanGrade = 'LOW';
          } else {
            rec.decision = 'Watch';
            rec.fineScanGrade = 'MEDIUM';
          }
          rec.decisionSource = 'local-rule';
          rec.decisionConfidence = rec.matchConfidence || 0;
        }
        rec.scanStatus = 'completed';

        // Append to results (keep scan order from Preferred Continue Scan List)
        const scanOrderIndex = results.length;
        results[results.length - 1].priority = scanOrderIndex;
        setFineScanResults([...results]);

        // Rate-limit delay between symbols (500ms)
        if (i < candidateCount - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      setFineScanProgress(100);
      setFineScanStatus('completed');

      message.success(`Fine Scan complete: ${results.length} candidates analyzed`);

      // ===== AI EXPLANATION LAYER (fire-and-forget, best-effort) =====
      // Only overwrites narrative fields (whyMatched, keySignalExplanation, finalReason, nextStep)
      // Never touches: backtest metrics, optimization, entry, liquidity, risk scores
      (async () => {
        for (const r of results) {
          try {
            // Only generate AI explanations for results that had at least some data
            if (r.matchConfidence < 15) continue;

            const explainData: import('../services/api').FineScanExplainRequest = {
              symbol: r.symbol,
              trendLabel: r.trendLabel || r.trend || 'Neutral',
              trendScore: r.scanScore ?? null,
              matchedStrategies: r.matchedStrategies || [],
              backtestMetrics: {
                totalReturn: r.backtestPerStrategy?.[0]?.totalReturn,
                sharpe: r.backtestPerStrategy?.[0]?.sharpe,
                winRate: r.backtestPerStrategy?.[0]?.winRate,
                profitFactor: r.backtestPerStrategy?.[0]?.profitFactor,
                maxDrawdown: r.backtestPerStrategy?.[0]?.maxDrawdown,
                tradeCount: r.backtestPerStrategy?.[0]?.tradeCount,
              },
              optimizationMetrics: {
                stability: r.quickOptSummary?.stability,
                avgReturn: r.quickOptSummary?.avgReturn,
                positiveRatio: r.quickOptSummary?.positiveRatio,
              },
              entryQuality: {
                grade: r.entryQuality,
                score: r.entryScore,
                atr: r.entryDetails?.atr,
                zone: r.entryDetails?.zone,
              },
              liquidity: {
                grade: r.liquidityGrade,
                score: r.liquidityScore,
              },
              newsSummary: {
                grade: r.newsGrade,
                headlineCount: r.newsDetails?.headlines?.length,
              },
              riskAssessment: {
                grade: r.riskGrade,
                score: r.riskScore,
                reason: r.riskReason,
              },
            };

            const resp = (await fineScanExplainAPI.explain(explainData)).data;
            if (resp.success) {
              // OVERWRITE ONLY: narrative fields
              if (resp.whyMatched) r.matchReason = resp.whyMatched;
              if (resp.keySignalExplanation) r.keySignalExplanation = resp.keySignalExplanation;
              if (resp.finalReason) r.finalReason = resp.finalReason;
              if (resp.nextStep) r.nextStep = resp.nextStep;
              // Mark as AI-enhanced for UI
              r.aiExplained = true;
              if (r.provenance) {
                r.provenance.explanationSource = 'DeepSeek AI';
                r.provenance.aiCalled = true;
                r.provenance.aiSource = 'DeepSeek';
                r.provenance.aiModel = 'deepseek-chat';
              }
            } else {
              if (r.provenance) r.provenance.explanationSource = 'Explain API failed';
            }
          } catch (e: any) {
            console.warn(`[FineScanExplain] AI failed for ${r.symbol}: ${e.message}`);
            if (r.provenance) r.provenance.explanationSource = 'Explain API error';
          }
        }
        // Refresh UI with AI-enhanced explanations
        setFineScanResults([...results]);
      })();
    } catch (error) {
      console.error('Fine scan error:', error);
      setFineScanStatus('error');
      message.error('Fine scan failed: ' + (error as any).message);
    }
  };


  // ===== Deeper Validation State =====
  const [deeperValidationStatus, setDeeperValidationStatus] = useState<'idle' | 'loading' | 'completed' | 'error'>('idle');
  const [deeperValidationResults, setDeeperValidationResults] = useState<any[] | null>(null);

  // ===== Entry Plan State =====
  const [entryPlanStatus, setEntryPlanStatus] = useState<'idle' | 'loading' | 'completed' | 'error'>('idle');
  const [entryPlanResults, setEntryPlanResults] = useState<any[] | null>(null);
  const [expandedEntryPlanSymbol, setExpandedEntryPlanSymbol] = useState<string | null>(null);
  const [entryPlanAccountSize, setEntryPlanAccountSize] = useState<number>(100000);
  const [entryPlanRiskPerTrade, setEntryPlanRiskPerTrade] = useState<number>(1);
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
  const [entryPlanExpanded, setEntryPlanExpanded] = useState(false);

  // ===== Dev Test Mode =====
  const [devTestMode, setDevTestMode] = useState(false);

  const DEV_TEST_CANDIDATE = {
    symbol: 'AAPL',
    companyName: 'Apple Inc. [DEV TEST]',
    trendLabel: 'Strong Bullish',
    trendScore: 88,
    overallScore: 88,
    price: 198.50,
    changePct: 2.3,
    volume: 52000000,
    marketCap: 3100000000000,
    sector: 'Technology',
    newsSentiment: 'Positive',
    eventRisk: 'Low',
    volumeStatus: 'High',
    topNews: '[DEV TEST] Strong quarterly earnings beat expectations',
    scannerReason: '[DEV TEST] Strong bullish trend with high volume and positive sentiment',
    aiReasoning: '[DEV TEST MOCK] AAPL shows strong momentum with volume confirmation. EMA aligned bullish, MACD strengthening.',
    conciseReasoning: '[DEV TEST MOCK] Strong uptrend with volume expansion',
    detailedReasoning: '[DEV TEST MOCK] Multi-timeframe alignment bullish. Volume above average. News catalyst positive.',
    selectionReason: '[DEV TEST] Selected: Apple has strong bullish trend (score 88), positive news sentiment, low risk, and above-average volume at +2.3% momentum.',
    reasonSource: 'Dev Test',
    aiCalled: false,
    aiSource: null,
    aiModel: null,
    aiError: null,
    selectedBy: 'Dev Test',
    includeInContinueScan: true,
    priorityScore: 92,
    priorityBreakdown: { trend: 35, score: 44, risk: 12, news: 10, price: 5, volume: 8 },
    continueScanStatus: 'completed',
    aiReasonStatus: 'completed',
    aiEvaluated: false,
    scanBatchId: 'dev-test',
    scanTimestamp: new Date().toISOString(),
    generatedAt: new Date().toISOString(),
    dataQuality: 'MOCK',
    priceChangePct: 2.3,
    isDevTest: true,
    provenance: {
      marketData: 'MOCK DATA',
      companyInfo: 'MOCK DATA',
      news: 'MOCK DATA',
      aiAnalysis: 'MOCK DATA',
    },
    analysisSource: 'dev-test',
    analysisStatus: 'success',
    structureLabel: 'uptrend',
    momentumLabel: 'strengthening',
    volatilityLabel: 'low',
    newsLabel: 'positive',
    riskLevel: 'low',
    trendConfidence: 0.85,
    confidence: 0.85,
    trend: 'Strong Bullish',
    risk: 'Low',
    priceChange: 2.3,
    scanTime: new Date().toISOString(),
    timestamp: new Date().toISOString(),
    dataSource: 'MOCK DATA',
  };

  const injectDevTestCandidate = () => {
    setPreferredContinueScanList(prev => {
      const exists = prev.some(c => c.isDevTest);
      if (exists) return prev;
      return [DEV_TEST_CANDIDATE, ...prev];
    });
    setContinueScanStatus('completed');
    message.success('DEV TEST candidate (AAPL) injected into Continue Scan List');
  };

  const removeDevTestCandidate = () => {
    setPreferredContinueScanList(prev => prev.filter(c => !c.isDevTest));
    message.info('DEV TEST candidate removed');
  };

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

    if (fa === 'WAIT_FOR_ENTRY' || aiDecision === 'WATCH' || tr === 'WAIT') {
      // Add to watchlist
      addToWatchlist(plan);
      return;
    }

    if (fa === 'BUY_READY') {
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
      const ed = plan.executionDetails || {};
      const orderPreview = ed.orderPreview || plan.orderPreview || {};
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
      };
      const res = await aiAgentWatchlistAPI.add(item);
      if (res.data.success) {
        const action = res.data.action === 'UPDATED' ? 'Updated in watchlist' : 'Added to AI Entry Watchlist';
        message.success(`${plan.symbol}: ${action}`);
      }
    } catch (e: any) {
      message.error(`Failed to add to watchlist: ${e?.response?.data?.message || e?.message || 'Unknown error'}`);
    }
  };

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

  const handleRunEntryPlan = useCallback(async () => {
    const candidates = getEntryPlanCandidates();
    if (!candidates.length) return;
    setEntryPlanStatus('loading');
    setEntryPlanResults(null);
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
        setEntryPlanStatus('completed');
      } else {
        setEntryPlanStatus('error');
      }
    } catch (err) {
      console.error('Entry plan error:', err);
      setEntryPlanStatus('error');
    }
  }, [getEntryPlanCandidates, entryPlanAccountSize, entryPlanRiskPerTrade, entryPlanExecutionMode, tradingAccountMode, tradingAccountData]);

  const selectValidationCandidates = useCallback(() => {
    if (!fineScanResults || fineScanResults.length === 0) return [];
    // ONLY Fine Scan Continue decisions — no Watch/Skip supplement
    const continueCandidates = fineScanResults.filter((r: any) =>
      r.decision === 'Continue' && r.scanStatus === 'completed'
    );
    // Sort by score descending, limit to 5
    continueCandidates.sort((a: any, b: any) =>
      (b.matchConfidence || 0) - (a.matchConfidence || 0)
    );
    return continueCandidates.slice(0, 5);
  }, [fineScanResults]);

  const handleDeeperValidation = async () => {
    const selected = selectValidationCandidates();
    if (selected.length === 0) {
      message.warning('No qualified Fine Scan candidates. Run Fine Scan first or adjust criteria.');
      return;
    }
    setDeeperValidationStatus('loading');
    setDeeperValidationResults(null);
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
        // Propagate isDevTest flag from Fine Scan results to DV results
        const devTestSymbols = new Set(selected.filter((r: any) => r.isDevTest).map((r: any) => r.symbol));
        const enrichedResults = resp.results.map((r: any) => ({
          ...r,
          isDevTest: devTestSymbols.has(r.symbol) || r.isDevTest || false,
        }));
        setDeeperValidationResults(enrichedResults);
        setDeeperValidationStatus('completed');
        message.success(`Deeper validation completed for ${resp.results.length} results`);
      } else {
        setDeeperValidationStatus('error');
        message.error('Validation returned no results');
      }
    } catch (err: any) {
      setDeeperValidationStatus('error');
      message.error('Validation failed: ' + (err.message || 'Unknown error'));
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

    // Summary Footer
    React.createElement('div', { style: { gridColumn: '1 / -1', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' } },
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 } },
        React.createElement('div', { style: { fontSize: '10px', color: '#555', flex: 1, lineHeight: 1.5 } },
          (record.verdictReason || record.decisionSummary) ?
            React.createElement('span', { style: { fontWeight: 500, color: '#333' } }, record.verdictReason || record.decisionSummary)
          : null,
          isLimitedSample ?
            React.createElement('div', { style: { fontSize: '9px', color: '#856404', marginTop: 2 } }, 'Note: Limited sample') : null
        ),
        React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 } },
          // Risk Gate badge
          (function() {
            var rg = record.riskGate || {};
            var rgStatus = rg.status || 'N/A';
            var rgColor = rgStatus === 'PASS' ? '#52c41a' : rgStatus === 'REVIEW' ? '#faad14' : rgStatus === 'BLOCK' ? '#ff4d4f' : '#bbb';
            var rgLabel = rgStatus === 'BLOCK' ? 'Blocked' : rgStatus;
            return React.createElement(Tooltip, { title: rg.reason || 'No risk gate data' },
              React.createElement(Tag, { color: rgColor === '#52c41a' ? 'green' : rgColor === '#faad14' ? 'gold' : rgColor === '#ff4d4f' ? 'red' : 'default', style: { fontSize: '10px', margin: 0, padding: '0 6px' } }, 'Gate: ' + rgLabel)
            );
          })(),
          // Verdict badge
          React.createElement(Tag, { color: vColor, style: { fontSize: '12px', fontWeight: 700, margin: 0, padding: '2px 12px', borderRadius: '10px' } }, v || 'N/A')
        )
      ),
      reasonParts.length > 0 ?
        React.createElement('div', { style: { marginTop: 8, borderTop: '1px solid #f0f0f0', paddingTop: 8 } },
          React.createElement('div', { style: { fontSize: '9px', color: '#aaa', marginBottom: 4 } }, 'Verdict Reasons'),
          reasonParts.map(function(part: any, i: number) {
            return React.createElement('div', { key: i, style: { fontSize: '10px', color: '#555', lineHeight: 1.5, marginBottom: 2 } }, '• ' + part);
          })
        ) : null
    )
  );
}

  return (
    <div>
      <Title level={2}><RobotOutlined style={{ marginRight: '12px' }} />AI Agent</Title>
      <Text type="secondary">AI-powered stock recommendations and trading automation</Text>

      <Divider />

      {/* 1. AI Configuration */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4}>
          <SettingOutlined style={{ marginRight: '8px' }} />
          AI Configuration
        </Title>
        <Card>
          <Form
            form={aiConfigForm}
            layout="vertical"
            onFinish={handleSaveAiConfig}
            initialValues={aiConfig}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="provider"
                  label="AI Provider"
                  rules={[{ required: true, message: 'Please select AI provider' }]}
                >
                  <Select
                    placeholder="Select AI provider"
                    onChange={(value) => {
                      // 当provider改变时，重置model为默认值
                      const providerModels = {
                        'DeepSeek': 'deepseek-chat',
                        'OpenAI': 'gpt-4',
                        'Claude': 'claude-3-opus'
                      } as const;

                      type AIProvider = keyof typeof providerModels;
                      const provider = value as AIProvider;

                      if (value && providerModels[provider]) {
                        aiConfigForm.setFieldsValue({ model: providerModels[provider] });
                      }
                    }}
                  >
                    <Option value="DeepSeek">DeepSeek</Option>
                    <Option value="OpenAI">OpenAI</Option>
                    <Option value="Claude">Claude</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="model"
                  label="Model"
                  rules={[{ required: true, message: 'Please select model' }]}
                >
                  <Select placeholder="Select model">
                    <Option value="deepseek-chat">deepseek-chat</Option>
                    <Option value="deepseek-coder">deepseek-coder</Option>
                    <Option value="gpt-4">GPT-4</Option>
                    <Option value="gpt-3.5-turbo">GPT-3.5 Turbo</Option>
                    <Option value="claude-3-opus">Claude 3 Opus</Option>
                    <Option value="claude-3-sonnet">Claude 3 Sonnet</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="apiKey"
                  label="API Key"
                  rules={[{ required: true, message: 'Please enter API key' }]}
                >
                  <Input.Password
                    placeholder="Enter your API key"
                    visibilityToggle={true}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="baseUrl"
                  label="Base URL"
                  rules={[{ required: true, message: 'Please enter base URL' }]}
                >
                  <Input placeholder="e.g., https://api.deepseek.com" />
                </Form.Item>
              </Col>
            </Row>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button
                onClick={handleTestConnection}
                loading={testingConnection}
                icon={<CheckCircleOutlined />}
              >
                Test Connection
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={savingConfig}
                icon={<SettingOutlined />}
              >
                Save Settings
              </Button>
            </div>
          </Form>
        </Card>
      </div>

      {/* 1.5 Trading Account Mode */}
      <div style={{ marginBottom: 24 }}>
        <Card
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                <SettingOutlined style={{ marginRight: 8 }} />
                Trading Account Mode
              </span>
              <div style={{ display: 'flex', background: '#f0f2f5', padding: 4, borderRadius: 8, gap: 4 }}>
                <Button
                  type={tradingAccountMode === 'paper' ? 'primary' : 'text'}
                  onClick={() => handleTradingAccountModeChange('paper')}
                  style={{
                    borderRadius: 6,
                    height: 28,
                    padding: '0 16px',
                    fontSize: 13,
                    fontWeight: tradingAccountMode === 'paper' ? 600 : 400,
                    boxShadow: tradingAccountMode === 'paper' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                    color: tradingAccountMode === 'paper' ? '#fff' : '#595959',
                    background: tradingAccountMode === 'paper' ? undefined : 'transparent',
                    border: 'none',
                  }}
                >
                  Paper Trading
                </Button>
                <Button
                  type={tradingAccountMode === 'real' ? 'primary' : 'text'}
                  danger={tradingAccountMode === 'real'}
                  onClick={() => handleTradingAccountModeChange('real')}
                  style={{
                    borderRadius: 6,
                    height: 28,
                    padding: '0 16px',
                    fontSize: 13,
                    fontWeight: tradingAccountMode === 'real' ? 600 : 400,
                    boxShadow: tradingAccountMode === 'real' ? '0 1px 2px rgba(255,0,0,0.1)' : 'none',
                    color: tradingAccountMode === 'real' ? '#fff' : '#595959',
                    background: tradingAccountMode === 'real' ? undefined : 'transparent',
                    border: 'none',
                  }}
                >
                  Real Trading
                </Button>
              </div>
            </div>
          }
        >
          <div style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 16 }}>
            Select which Alpaca account is used for Entry Plan position sizing and risk checks. Switching mode does not place any orders.
          </div>
          
          <div style={{ background: '#fafafa', borderRadius: 8, padding: '12px 16px', border: '1px solid #f0f0f0' }}>
            {tradingAccountLoading ? (
              <div style={{ color: '#8c8c8c', fontSize: 13 }}>Loading account data...</div>
            ) : tradingAccountData?.success ? (
              <Row gutter={[24, 12]} align="middle">
                <Col>
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 2 }}>Account Type</div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {tradingAccountData?.mode === 'paper' ? '📄 Paper' : tradingAccountData?.mode === 'real' ? '🔴 Real' : '⚪ Unknown'}
                  </div>
                </Col>
                <Col>
                  <Divider type="vertical" style={{ height: 32, margin: 0 }} />
                </Col>
                <Col>
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 2 }}>Status</div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: tradingAccountData.status === 'ACTIVE' ? '#52c41a' : '#faad14' }}>
                    {tradingAccountData.status || 'N/A'}
                  </div>
                </Col>
                <Col>
                  <Divider type="vertical" style={{ height: 32, margin: 0 }} />
                </Col>
                <Col>
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 2 }}>Cash</div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    ${(tradingAccountData.cash ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </Col>
                <Col>
                  <Divider type="vertical" style={{ height: 32, margin: 0 }} />
                </Col>
                <Col>
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 2 }}>Buying Power</div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    ${(tradingAccountData.buyingPower ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </Col>
                <Col>
                  <Divider type="vertical" style={{ height: 32, margin: 0 }} />
                </Col>
                <Col>
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 2 }}>Portfolio Value</div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    ${(tradingAccountData.portfolioValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </Col>
              </Row>
            ) : (
              <div style={{ color: '#8c8c8c', fontSize: 13 }}>
                {tradingAccountData?.error ? (
                  <><ExclamationCircleOutlined style={{ marginRight: 4, color: '#faad14' }} />{tradingAccountData.error}</>
                ) : (
                  'Account data unavailable'
                )}
                <span style={{ marginLeft: 8, fontSize: 12 }}>— Entry Plan will use estimated defaults</span>
              </div>
            )}
          </div>

          {tradingAccountMode === 'real' && (
            <Alert
              style={{ marginTop: 16 }}
              type="warning"
              showIcon
              message="Real trading account selected"
              description="Used only for position sizing and risk calculations. No orders will be placed from this switch."
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
          <Button
            type={detailedScanStatus.currentStatus === 'scanning' ? 'default' : 'primary'}
            danger={detailedScanStatus.currentStatus === 'scanning'}
            icon={detailedScanStatus.currentStatus === 'scanning' ? <PauseCircleOutlined /> : <ThunderboltOutlined />}
            onClick={handleToggleMarketScanner}
            loading={detailedScanStatus.currentStatus === 'stopping'}
            size="small"
          >
            {detailedScanStatus.currentStatus === 'scanning' ? 'Stop Scanner' : 'Run Scanner'}
          </Button>
        }
        isRunning={detailedScanStatus.currentStatus === 'scanning'}
        expanded={scannerExpanded}
        onToggle={() => setScannerExpanded(!scannerExpanded)}
      >
        <Card>
          <Row gutter={16} align="middle" style={{ marginBottom: 16 }}>
            <Col span={24}>
              <Space size="middle">
                <Button
                  type={detailedScanStatus.currentStatus === 'scanning' ? 'default' : 'primary'}
                  danger={detailedScanStatus.currentStatus === 'scanning'}
                  icon={detailedScanStatus.currentStatus === 'scanning' ? <PauseCircleOutlined /> : <ThunderboltOutlined />}
                  onClick={handleToggleMarketScanner}
                  loading={detailedScanStatus.currentStatus === 'stopping'}
                >
                  {detailedScanStatus.currentStatus === 'scanning' ? 'Stop Scanner' : 'Run Scanner'}
                </Button>
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
                  ? `${marketScannerResults.filter((r: any) => r.price != null && r.volume > 0 && r.trendLabel != null).length} good / ${marketScannerResults.filter((r: any) => (r.price != null || r.volume > 0 || r.trendLabel != null) && !(r.price != null && r.volume > 0 && r.trendLabel != null)).length} partial`
                  : '—'}
              </Text>
            </Col>

            <Col span={6}>
              <div style={{ marginBottom: '8px' }}>
                <Text strong>AI Status:</Text>
              </div>
              <Text type="secondary" style={{ fontSize: '13px' }}>
                {marketScannerResults.length > 0
                  ? `${marketScannerResults.filter((r: any) => r.aiCalled).length} AI / ${marketScannerResults.filter((r: any) => !r.aiCalled).length} Local Rules`
                  : '—'}
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
                    {detailedScanStatus.validatedCount} Validated • {detailedScanStatus.retryCount} Retries
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
          <div style={{ display: 'flex', gap: 6 }}>
            <Button
              type={devTestMode ? 'primary' : 'default'}
              size="small"
              danger={devTestMode}
              onClick={() => {
                if (devTestMode) {
                  setDevTestMode(false);
                  removeDevTestCandidate();
                } else {
                  setDevTestMode(true);
                  injectDevTestCandidate();
                }
              }}
              style={devTestMode ? { background: '#ff4d4f', borderColor: '#ff4d4f' } : {}}
            >
              {devTestMode ? 'Disable Test' : 'Enable Test'}
            </Button>
            <Button
              type={continueScanStatus === 'completed' || continueScanStatus === 'error' ? 'default' : 'primary'}
              size="small"
              onClick={() => handleStartContinueScan(continueScanStatus === 'completed' || continueScanStatus === 'error')}
              disabled={marketScannerResults.length === 0 || continueScanStatus === 'processing'}
              loading={continueScanStatus === 'processing'}
              icon={<SyncOutlined />}
            >
              {continueScanStatus === 'completed' || continueScanStatus === 'error' ? 'Re-run Scan' : 'Start Continue Scan'}
            </Button>
          </div>
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
          fineScanStatus === 'error' ? 'ERROR' : 'IDLE'
        }
        statusColor={
          fineScanStatus === 'running' ? 'processing' :
          fineScanStatus === 'completed' ? 'success' :
          fineScanStatus === 'error' ? 'error' : 'default'
        }
        progressValue={fineScanStatus === 'running' ? fineScanProgress : null}
        summaryChips={fineScanResults.length > 0 ? [
          { label: 'Scanned', value: fineScanResults.length },
          { label: 'Continue', value: fineScanResults.filter((r: any) => r.decision === 'Continue').length, color: '#52c41a' },
          { label: 'Watch', value: fineScanResults.filter((r: any) => r.decision === 'Watch').length, color: '#d48806' },
          { label: 'Skip', value: fineScanResults.filter((r: any) => r.decision === 'Skip').length, color: '#ff4d4f' },
        ] : undefined}
        actionButton={
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={handleRunFineScan}
            disabled={fineScanStatus === 'running' || preferredContinueScanList.length === 0}
            loading={fineScanStatus === 'running'}
            size="small"
          >
            {fineScanStatus === 'running' ? 'Running...' : 'Run Fine Scan'}
          </Button>
        }
        isRunning={fineScanStatus === 'running'}
        expanded={fineScanExpanded}
        onToggle={() => setFineScanExpanded(!fineScanExpanded)}
      >
        <Card bodyStyle={{ padding: '20px' }} style={{ borderRadius: '12px', border: '1px solid #f0f0f0' }}>
          {/* Header Summary Row */}
          <div className="fine-scan-header-summary">
            {fineScanResults.length > 0 ? (() => {
              const total = fineScanResults.length;
              const contCount = fineScanResults.filter((r: any) => r.decision === 'Continue').length;
              const watchCount = fineScanResults.filter((r: any) => r.decision === 'Watch').length;
              const skipCount = fineScanResults.filter((r: any) => r.decision === 'Skip').length;
              return (
                <>
                  <div className="fine-scan-stat-item">
                    <span style={{ color: '#8c8c8c', fontWeight: 600 }}>CANDIDATES:</span>
                    <span style={{ fontWeight: 800, color: '#1f1f1f' }}>{total}</span>
                  </div>
                  <Divider type="vertical" />
                  <div className="fine-scan-stat-item">
                    <span style={{ color: '#8c8c8c', fontWeight: 600 }}>CONTINUE:</span>
                    <Tag color="success" style={{ fontWeight: 800, margin: 0 }}>{contCount}</Tag>
                  </div>
                  <Divider type="vertical" />
                  <div className="fine-scan-stat-item">
                    <span style={{ color: '#8c8c8c', fontWeight: 600 }}>WATCH:</span>
                    <Tag color="warning" style={{ fontWeight: 800, margin: 0 }}>{watchCount}</Tag>
                  </div>
                  <Divider type="vertical" />
                  <div className="fine-scan-stat-item">
                    <span style={{ color: '#8c8c8c', fontWeight: 600 }}>SKIP:</span>
                    <Tag color="error" style={{ fontWeight: 800, margin: 0 }}>{skipCount}</Tag>
                  </div>
                  <Divider type="vertical" />
                  <div className="fine-scan-stat-item">
                    <span style={{ color: '#8c8c8c', fontWeight: 600 }}>AI AGENT:</span>
                    <Tag color="cyan" style={{ fontWeight: 800, margin: 0 }}>DEEPSEEK V3</Tag>
                  </div>
                </>
              );
            })() : (
              <div style={{ color: '#8c8c8c', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <InfoCircleOutlined />
                {fineScanStatus === 'idle' ? 'System ready for multi-dimensional strategy confirmation' : 'Awaiting input from Continue Scan'}
              </div>
            )}
          </div>

          {/* Progress Panel */}
          {fineScanStatus === 'running' && (
            <div className="fine-scan-progress-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#003a8c' }}>
                    Scanning Regime & Strategies
                  </div>
                  <div style={{ fontSize: '12px', color: '#1890ff' }}>
                    {fineScanMessage || 'Processing market data for selected candidates...'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#1890ff', lineHeight: 1 }}>
                    {fineScanProgress}%
                  </div>
                  <div style={{ fontSize: '10px', color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.5 }}>Complete</div>
                </div>
              </div>
              <Progress 
                percent={fineScanProgress} 
                status="active" 
                strokeColor={{ '0%': '#1890ff', '100%': '#52c41a' }} 
                strokeWidth={8} 
                showInfo={false} 
              />
            </div>
          )}

          {fineScanResults.length > 0 && (
            <>
            <style>{`
              .fine-scan-table .ant-table-thead > tr > th {
                font-size: 11px;
                font-weight: 600;
                color: #595959;
                background: #fafafa;
                padding: 6px 8px !important;
                border-bottom: 2px solid #e8e8e8;
              }
              .fine-scan-table .ant-table-tbody > tr > td {
                padding: 5px 8px !important;
                font-size: 11px;
              }
              .fine-scan-table .ant-table-tbody > tr:hover > td {
                background: #fafafa;
              }
              .fine-scan-table .ant-table-row {
                height: 36px;
              }
            `}</style>
            <Table
              className="fine-scan-table"
              dataSource={fineScanResults}
              rowKey="symbol"
              pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (total, range) => `${range[0]}-${range[1]} / ${total}` }}
              size="small"
              scroll={{ x: 'max-content' }}
              expandable={{
                expandedRowRender: (record: any) => renderFineScanDetailPanel(record),
                rowExpandable: (record: any) => true,
                expandedRowKeys: fineScanExpandedRows,
                onExpand: (expanded, record) => {
                  if (expanded) {
                    setFineScanExpandedRows(prev => [...prev, record.symbol]);
                  } else {
                    setFineScanExpandedRows(prev => prev.filter(s => s !== record.symbol));
                  }
                }
              }}
              columns={[
                {
                  title: 'Symbol',
                  key: 'symbol',
                  width: 80,
                  fixed: 'left',
                  render: (record) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Text strong style={{ fontSize: '12px' }}>{record.symbol}</Text>
                      {record.isDevTest && <Tag color="red" style={{ fontSize: 8, padding: '0 2px', lineHeight: '12px', margin: 0 }}>TEST</Tag>}
                    </div>
                  ),
                },
                // ===== Decision =====
                {
                  title: 'Decision',
                  key: 'decision',
                  width: 95,
                  render: (record) => {
                    const d = record.decision || '--';
                    let c = '#999', l = d;
                    const source = record.decisionSource || 'local-rule';
                    const sourceLabel = source === 'ai' ? 'AI' : '⚙️';
                    if (d === 'Continue') { c = '#52c41a'; l = 'Continue'; }
                    else if (d === 'Watch') { c = '#faad14'; l = 'Watch'; }
                    else if (d === 'Skip') { c = '#ff4d4f'; l = 'Skip'; }
                    return (
                      <Tooltip title={`Source: ${source}${record.decisionReason ? ' | ' + record.decisionReason : ''}`}>
                        <span style={{ color: c, fontSize: '11px', fontWeight: 600 }}>
                          {l}
                          <span style={{ fontSize: '9px', color: '#bbb', marginLeft: '3px' }}>{sourceLabel}</span>
                        </span>
                      </Tooltip>
                    );
                  },
                },
                // ===== Score =====
                {
                  title: 'Score',
                  key: 'score',
                  width: 80,
                  render: (record) => {
                    const s = record.score ?? record.matchConfidence;
                    if (s == null) return <Text style={{ fontSize: '11px', color: '#bbb' }}>-</Text>;
                    let c = '#ff4d4f';
                    if (s >= 80) c = '#52c41a';
                    else if (s >= 60) c = '#faad14';
                    else if (s >= 40) c = '#ff7a45';
                    const w = Math.min(100, Math.max(2, s));
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: c, minWidth: 22 }}>{s}</span>
                        <div style={{ width: 36, height: 4, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${w}%`, height: '100%', background: c, borderRadius: 2 }} />
                        </div>
                      </div>
                    );
                  },
                },
                // ===== Strategies =====
                {
                  title: 'Strategies',
                  key: 'strategies',
                  width: 200,
                  render: (record) => {
                    const strats = record.matchedStrategies || [];
                    if (strats.length === 0) return <Text style={{ fontSize: '11px', color: '#bbb' }}>-</Text>;
                    const display = strats.slice(0, 3).join(' · ');
                    const extra = strats.length > 3 ? ` +${strats.length - 3}` : '';
                    return (
                      <Tooltip title={strats.join(', ')}>
                        <span style={{ fontSize: '10px', color: '#595959', lineHeight: '1.4' }}>
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
                  width: 90,
                  render: (record) => {
                    const lg = record.liquidityGrade || '-';
                    let c = '#bbb', l = '-';
                    if (lg === 'Good') { c = '#52c41a'; l = 'Good'; }
                    else if (lg === 'Caution') { c = '#faad14'; l = 'Caution'; }
                    else if (lg === 'Poor') { c = '#ff4d4f'; l = 'Poor'; }
                    else if (lg === 'Error') { c = '#bbb'; l = 'Error'; }
                    return <span style={{ color: c, fontSize: '11px', fontWeight: 500 }}>{l}</span>;
                  },
                },
                // ===== Entry =====
                {
                  title: 'Entry',
                  key: 'entry',
                  width: 100,
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
                    return <span style={{ color: c, fontSize: '11px', fontWeight: 500 }}>{l}</span>;
                  },
                },
                // ===== Validation =====
                {
                  title: 'Validation',
                  key: 'validation',
                  width: 145,
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
                      <div style={{ fontSize: '10px', lineHeight: '1.8' }}>
                        <div>
                          <span style={{ color: '#8c8c8c' }}>Backtest: </span>
                          <span style={{ color: pc, fontWeight: 500 }}>{pl}</span>
                        </div>
                        <div>
                          <span style={{ color: '#8c8c8c' }}>Optimization: </span>
                          <span style={{ color: stColor, fontWeight: 500 }}>{stLabel}</span>
                        </div>
                      </div>
                    );
                  },
                },
                {
                  title: 'Risk',
                  key: 'risk',
                  width: 75,
                  render: (record) => {
                    const rg = record.riskGrade || '-';
                    let c = '#bbb', l = '-', dot = '';
                    if (rg === 'LOW') { c = '#52c41a'; l = 'Low'; dot = '🟢'; }
                    else if (rg === 'MEDIUM') { c = '#faad14'; l = 'Medium'; dot = '🟠'; }
                    else if (rg === 'HIGH') { c = '#ff4d4f'; l = 'High'; dot = '🔴'; }
                    else if (rg === 'SKIP') { c = '#bbb'; l = 'SKIP'; }
                    return <span style={{ color: c, fontSize: '11px', fontWeight: 500 }}>{dot} {l}</span>;
                  },
                },
                // ===== Why Matched =====
                {
                  title: 'Why Matched',
                  key: 'whyMatched',
                  width: 150,
                  render: (record) => {
                    const full = record.matchReason || '';
                    const truncated = full.length > 50 ? full.substring(0, 50) + '...' : full;
                    return (
                      <Tooltip title={record.matchAISource === 'ai-explain' ? 'AI-generated explanation' : 'Template-based (market data)'}>
                        <Text style={{ fontSize: '10px', color: '#666', lineHeight: '1.4' }}>
                          {truncated || '-'}
                          <span style={{ fontSize: '9px', color: '#bbb', marginLeft: '3px' }}>
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
                  width: 65,
                  render: (record) => {
                    // Grade = stock quality / whether it's worth pursuing
                    // High = good quality = green, Medium = orange, Low = poor = red
                    const g = record.fineScanGrade || null;
                    if (g === 'HIGH') return <span style={{ color: '#52c41a', fontSize: '11px', fontWeight: 600 }}>High</span>;
                    if (g === 'MEDIUM') return <span style={{ color: '#faad14', fontSize: '11px', fontWeight: 600 }}>Medium</span>;
                    if (g === 'LOW') return <span style={{ color: '#ff4d4f', fontSize: '11px', fontWeight: 600 }}>Low</span>;
                    // Fallback grade computation from available data
                    const btOk = record.backtestStatus === 'pass' && (record.backtestPerformance === 'positive' || record.backtestPerformance === 'caution');
                    const eqOk = record.entryQuality === 'Excellent' || record.entryQuality === 'Good' || record.entryQuality === 'Wait for Pullback';
                    const riskOk = record.riskGrade === 'LOW' || record.riskGrade === 'MEDIUM';
                    const scoreOk = (record.matchConfidence || 0) >= 30;
                    if (btOk && scoreOk && eqOk && riskOk) {
                      return <span style={{ color: '#52c41a', fontSize: '11px', fontWeight: 600 }}>High</span>;
                    }
                    if (btOk && (record.matchConfidence || 0) >= 20) {
                      return <span style={{ color: '#faad14', fontSize: '11px', fontWeight: 600 }}>Medium</span>;
                    }
                    return <span style={{ color: '#ff4d4f', fontSize: '11px', fontWeight: 600 }}>Low</span>;
                  },
                },
                // ===== Rank =====
                {
                  title: 'Rank',
                  key: 'rank',
                  width: 55,
                  render: (record) => (
                    <Text style={{ fontSize: '12px', color: '#595959', fontWeight: 500 }}>
                      {record.priority || '-'}
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
          deeperValidationStatus === 'error' ? 'ERROR' : 'IDLE'
        }
        statusColor={
          deeperValidationStatus === 'loading' ? 'processing' :
          deeperValidationStatus === 'completed' ? 'success' :
          deeperValidationStatus === 'error' ? 'error' : 'default'
        }
        summaryChips={deeperValidationResults ? [
          { label: 'Validated', value: deeperValidationResults.length },
          { label: 'PASS', value: deeperValidationResults.filter((r: any) => r.riskGate?.status === 'PASS').length, color: '#52c41a' },
          { label: 'BLOCK', value: deeperValidationResults.filter((r: any) => r.riskGate?.status === 'BLOCK').length, color: '#ff4d4f' },
        ] : undefined}
        actionButton={
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={handleDeeperValidation}
            loading={deeperValidationStatus === 'loading'}
            disabled={fineScanStatus !== 'completed' || fineScanResults.length === 0 || selectValidationCandidates().length === 0}
            size="small"
          >
            {deeperValidationStatus === 'loading' ? 'Validating...' : `Run Validation (${selectValidationCandidates().length})`}
          </Button>
        }
        isRunning={deeperValidationStatus === 'loading'}
        expanded={dvExpanded}
        onToggle={() => setDvExpanded(!dvExpanded)}
      >
          {deeperValidationStatus === 'loading' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <SyncOutlined spin style={{ fontSize: 24, color: '#1890ff' }} />
              <div style={{ marginTop: 8, color: '#666' }}>Validating deeper metrics...</div>
            </div>
          )}

          {deeperValidationStatus === 'completed' && deeperValidationResults && (
            <Table
              dataSource={deeperValidationResults}
              rowKey="symbol"
              size="small"
              pagination={false}
              style={{ marginTop: 12 }}
              expandable={{
                expandedRowRender: (record: any) => renderDVDetailPanel(record),
                rowExpandable: () => true,
                expandIconColumnIndex: 0,
              }}
                              columns={[
                {
                  title: '',
                  key: 'expand',
                  width: 30,
                },
                {
                  title: 'Symbol',
                  key: 'symbol',
                  width: 72,
                  render: (record: any) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Text strong style={{ fontSize: '11px' }}>{record.symbol}</Text>
                      {record.isDevTest && <Tag color="red" style={{ fontSize: 8, padding: '0 2px', lineHeight: '12px', margin: 0 }}>TEST</Tag>}
                    </div>
                  ),
                },
                {
                  title: '1Y Return',
                  key: 'totalReturn',
                  width: 80,
                  render: (record: any) => {
                    const tr = record.totalReturn;
                    if (tr == null) return <Text style={{ color: '#bbb', fontSize: '11px' }}>N/A</Text>;
                    const c = tr > 0 ? '#52c41a' : '#ff4d4f';
                    return <Text style={{ color: c, fontWeight: 600, fontSize: '11px' }}>{tr > 0 ? '+' : ''}{tr.toFixed(1)}%</Text>;
                  },
                },
                {
                  title: 'Strategy',
                  key: 'strategy',
                  width: 80,
                  render: (record: any) => <Text style={{ fontSize: '10px' }}>{record.strategy}</Text>,
                },
                {
                  title: 'Sharpe',
                  key: 'sharpeRatio',
                  width: 64,
                  render: (record: any) => {
                    const s = record.sharpeRatio ?? record.sharpe;
                    if (s == null) return <Text style={{ color: '#bbb', fontSize: '11px' }}>N/A</Text>;
                    let c = '#bbb';
                    if (s >= 1.0) c = '#52c41a';
                    else if (s >= 0.5) c = '#faad14';
                    else c = '#ff4d4f';
                    return <Text style={{ color: c, fontWeight: 600, fontSize: '11px' }}>{s.toFixed(2)}</Text>;
                  },
                },
                {
                  title: 'Max DD',
                  key: 'maxDrawdown',
                  width: 70,
                  render: (record: any) => {
                    const mdd = record.maxDrawdown;
                    if (mdd == null) return <Text style={{ color: '#bbb', fontSize: '11px' }}>N/A</Text>;
                    const absDd = Math.abs(mdd);
                    let c = '#bbb';
                    if (absDd <= 15) c = '#52c41a';
                    else if (absDd <= 25) c = '#faad14';
                    else c = '#ff4d4f';
                    return <Text style={{ color: c, fontWeight: 600, fontSize: '11px' }}>-{absDd.toFixed(1)}%</Text>;
                  },
                },
                {
                  title: 'Win Rate',
                  key: 'winRate',
                  width: 66,
                  render: (record: any) => {
                    const wr = record.winRate;
                    if (wr == null) return <Text style={{ color: '#bbb', fontSize: '11px' }}>N/A</Text>;
                    let c = '#bbb';
                    if (wr >= 55) c = '#52c41a';
                    else if (wr >= 40) c = '#faad14';
                    else c = '#ff4d4f';
                    return <Text style={{ color: c, fontWeight: 600, fontSize: '11px' }}>{wr}%</Text>;
                  },
                },
                {
                  title: 'P.Factor',
                  key: 'profitFactor',
                  width: 72,
                  render: (record: any) => {
                    const pf = record.profitFactor;
                    if (pf == null) {
                      const tc = record.tradeCount ?? record.trades;
                      if (tc != null && tc > 0 && record.totalReturn != null && record.totalReturn > 0) {
                        return (React.createElement(Tooltip, { title: 'No losing trades in this sample; limited reliability due to low trade count' },
                          React.createElement('span', { style: { color: '#52c41a', fontWeight: 600, fontSize: '11px' } }, String.fromCharCode(8734))
                        ));
                      }
                      return <Text style={{ color: '#bbb', fontSize: '11px' }}>N/A</Text>;
                    }
                    let c = '#bbb';
                    if (pf >= 1.5) c = '#52c41a';
                    else if (pf >= 1.0) c = '#faad14';
                    else c = '#ff4d4f';
                    return <Text style={{ color: c, fontWeight: 600, fontSize: '11px' }}>{pf.toFixed(2)}</Text>;
                  },
                },
                {
                  title: 'Trades',
                  key: 'tradeCount',
                  width: 60,
                  render: (record: any) => {
                    const tc = record.tradeCount ?? record.trades;
                    if (tc == null) return <Text style={{ color: '#bbb', fontSize: '11px' }}>N/A</Text>;
                    if (tc < 3) return <Text style={{ color: '#ff4d4f', fontSize: '11px' }}>Limited ({tc})</Text>;
                    if (tc < 10) return <Text style={{ color: '#faad14', fontSize: '11px' }}>{tc}</Text>;
                    return <Text style={{ fontSize: '11px' }}>{tc}</Text>;
                  },
                },
                {
                  title: 'Stability',
                  key: 'stabilityScore',
                  width: 88,
                  render: (record: any) => {
                    const score = record.stabilityScore;
                    const tc = record.tradeCount ?? record.trades;
                    const vc = record.validCombinationCount;
                    const isLimited = (tc != null && tc < 3) || (vc != null && vc < 3);
                    if (score == null) return <Text style={{ color: '#bbb', fontSize: '11px' }}>N/A</Text>;
                    let c = '#52c41a', l = 'Stable';
                    if (score < 50) { c = '#ff4d4f'; l = 'Weak'; }
                    else if (score < 70) { c = '#faad14'; l = 'Moderate'; }
                    if (isLimited) { l = 'Limited'; }
                    return React.createElement(Tooltip,
                      { title: isLimited ? 'Limited sample (' + tc + ' trade(s), ' + vc + ' combo(s)) - stability confidence reduced' : l + ' (' + score + '/100)' },
                      React.createElement('span', { style: { fontSize: '11px', fontWeight: 600, color: c } }, l + ' \u00B7 ' + score)
                    );
                  },
                },
                {
                  title: 'Trend',
                  key: 'recentVsLongTerm',
                  width: 78,
                  render: (record: any) => {
                    const t = record.recentVsLongTerm;
                    if (!t) return <Text style={{ color: '#bbb', fontSize: '11px' }}>N/A</Text>;
                    let c = '#52c41a';
                    if (t === 'Weakening') c = '#faad14';
                    else if (t === 'Divergent') c = '#ff4d4f';
                    else if (t === 'Consistent') c = '#1890ff';
                    else if (t === 'Improving') c = '#52c41a';
                    return <Text style={{ fontSize: '11px', fontWeight: 600, color: c }}>{t}</Text>;
                  },
                },
                {
                  title: 'Verdict',
                  key: 'verdict',
                  width: 85,
                  render: (record: any) => {
                    const v = record.verdict;
                    if (!v) return <Text style={{ color: '#bbb', fontSize: '11px' }}>N/A</Text>;
                    let c = '#52c41a', l = v;
                    if (v === 'Watch' || v === 'Caution') { c = '#faad14'; l = 'Watch'; }
                    else if (v === 'Avoid' || v === 'Reject' || v === 'Rejected') { c = '#ff4d4f'; l = 'Rejected'; }
                    else if (v === 'Needs Manual Review') { c = '#722ed1'; l = 'Review'; }
                    return <Text style={{ fontSize: '11px', fontWeight: 700, color: c }}>{l}</Text>;
                  },
                },
                {
                  title: 'Risk Gate',
                  key: 'riskGate',
                  width: 80,
                  render: (record: any) => {
                    const rg = record.riskGate || {};
                    const status = rg.status || 'N/A';
                    let c = '#52c41a', l = status;
                    if (status === 'REVIEW') { c = '#faad14'; }
                    else if (status === 'BLOCK' || status === 'ERROR') { c = '#ff4d4f'; l = status === 'BLOCK' ? 'Blocked' : 'Error'; }
                    else if (status === 'PASS') { l = 'Pass'; }
                    else { c = '#bbb'; }
                    const tip = rg.reason || (rg.checks && rg.checks.length > 0 ? rg.checks.join('; ') : 'No checks');
                    return React.createElement(Tooltip, { title: tip },
                      React.createElement('span', { style: { fontSize: '11px', fontWeight: 600, color: c } }, l)
                    );
                  },
                },
                {
                  title: 'Source',
                  key: 'dataSource',
                  width: 60,
                  render: (record: any) => {
                    const ds = record.dataSource || 'N/A';
                    return <Tag color={ds === 'alpaca' ? 'green' : 'default'} style={{ fontSize: '9px', margin: 0, padding: '0 4px' }}>{ds === 'alpaca' ? 'Alpaca' : ds}</Tag>;
                  },
                },
                {
                  title: 'Reason',
                  key: 'reason',
                  width: 200,
                  render: (record: any) => {
                    const r = record.reason;
                    if (!r) return <Text style={{ color: '#bbb', fontSize: '11px' }}>N/A</Text>;
                    const truncated = r.length > 65 ? r.substring(0, 62) + '...' : r;
                    return (
                      React.createElement(Tooltip,
                        { title: React.createElement('span', { style: { fontSize: 12, maxWidth: 500, whiteSpace: 'pre-wrap' as any } }, r) },
                        React.createElement('span', { style: { fontSize: '10px', color: '#666', lineHeight: 1.3 } }, truncated)
                      )
                    );
                  },
                },
              ]}
            />
          )}

          {deeperValidationStatus === 'error' && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#ff4d4f' }}>
              <CloseCircleOutlined style={{ fontSize: 20 }} />
              <div style={{ marginTop: 4 }}>Validation failed. Please try again.</div>
            </div>
          )}

          {deeperValidationStatus === 'idle' && fineScanStatus === 'completed' && (
            <div style={{ textAlign: 'center', padding: '12px 0', color: '#bbb', fontSize: '12px' }}>
              Selected {selectValidationCandidates().length} Continue candidates from Fine Scan for deeper validation.
            </div>
          )}
          {deeperValidationStatus === 'idle' && fineScanStatus !== 'completed' && (
            <div style={{ textAlign: 'center', padding: '12px 0', color: '#bbb', fontSize: '12px' }}>
              Run Fine Scan first, then validate top candidates.
            </div>
          )}
      </CollapsibleStageSection>

      {/* ▲▲▲ Above: Deeper Validation ▲▲▲ */}

      {/* ▲▲▲ Below: Entry Plan ▲▲▲ */}
      <CollapsibleStageSection
        title="Entry Plan"
        icon={<RobotOutlined />}
        statusText={
          entryPlanStatus === 'loading' ? 'GENERATING' :
          entryPlanStatus === 'completed' ? 'COMPLETED' :
          entryPlanStatus === 'error' ? 'ERROR' : 'IDLE'
        }
        statusColor={
          entryPlanStatus === 'loading' ? 'processing' :
          entryPlanStatus === 'completed' ? 'success' :
          entryPlanStatus === 'error' ? 'error' : 'default'
        }
        summaryChips={entryPlanResults ? [
          { label: 'Plans', value: entryPlanResults.length },
          { label: 'Mode', value: entryPlanExecutionMode },
        ] : undefined}
        actionButton={
          deeperValidationStatus === 'completed' && getEntryPlanCandidates().length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Select
                size="small"
                value={entryPlanExecutionMode}
                onChange={(v) => setEntryPlanExecutionMode(v)}
                style={{ width: 140, fontSize: 11 }}
              >
                <Option value="Recommend Only">Recommend Only</Option>
                <Option value="Add to Watchlist">Add to Watchlist</Option>
                <Option value="Paper Trade if Triggered">Paper Trade</Option>
                <Option value="Real Trade if Triggered">Real Trade</Option>
              </Select>
              <Button
                type="primary"
                size="small"
                loading={entryPlanStatus === 'loading'}
                disabled={entryPlanStatus === 'loading' || !getEntryPlanCandidates().length}
                onClick={handleRunEntryPlan}
              >
                Run Entry Plan
              </Button>
            </div>
          ) : undefined
        }
        isRunning={entryPlanStatus === 'loading'}
        expanded={entryPlanExpanded}
        onToggle={() => setEntryPlanExpanded(!entryPlanExpanded)}
      >
          {/* No DV candidates yet */}
          {deeperValidationStatus !== 'completed' && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#bbb', fontSize: '12px', fontStyle: 'italic' }}>
              No validated candidates yet. Run Deeper Validation first.
            </div>
          )}

          {/* DV done but no confirmed/watch candidates */}
          {deeperValidationStatus === 'completed' && getEntryPlanCandidates().length === 0 && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#bbb', fontSize: '12px', fontStyle: 'italic' }}>
              No Confirmed or Watch candidates available from Deeper Validation.
            </div>
          )}

          {/* DV done, candidates available */}
          {deeperValidationStatus === 'completed' && getEntryPlanCandidates().length > 0 && entryPlanStatus === 'idle' && (
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
          {entryPlanStatus === 'completed' && entryPlanResults && entryPlanResults.length > 0 && (
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
                  <div style={{ fontSize: '12px', fontWeight: 500, color: '#555', fontFamily: "'Inter', sans-serif", marginBottom: '4px' }}>{entryPlanExecutionMode}</div>
                  <div style={{ fontSize: '10px', color: '#999' }}>
                    {(() => {
                      const ed = entryPlanResults[0]?.executionDetails;
                      if (ed) return `${ed.brokerSource || 'Not Connected'} | Can execute: ${ed.canExecute ? 'Yes' : 'No'}`;
                      return `Risk/trade: ${entryPlanRiskPerTrade}%`;
                    })()}
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

                    const CardHeader = ({ title, color }: { title: string; color?: string }) => (
                      <div style={{ fontSize: '11px', fontWeight: 600, color: color || '#8c8c8c', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', paddingBottom: '4px', borderBottom: '1px solid #edf0f2' }}>{title}</div>
                    );

                    const Label = ({ text }: { text: string }) => <span style={{ fontSize: '11px', color: '#8c8c8c', fontWeight: 500 }}>{text}</span>;
                    const Value = ({ v, bold, color }: { v: string; bold?: boolean; color?: string }) => <span style={{ fontSize: '12px', fontWeight: bold ? 700 : 500, color: color || '#262626' }}>{v}</span>;

                    return (
                      <div style={{ padding: '10px 16px', background: '#fbfbfc', border: '1px solid #edf0f2', borderRadius: '8px', fontFamily: fontStk, lineHeight: '1.4' }}>
                        {/* ── Header ── */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '6px', borderBottom: '1px solid #edf0f2', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a1a' }}>{sym}</span>
                            <Tag color={setupLabel.includes('Pullback') ? 'gold' : setupLabel.includes('Breakout') ? 'purple' : setupLabel.includes('Range') ? 'green' : setupLabel.includes('Watch') ? 'blue' : 'default'} style={{ fontSize: '11px', margin: 0 }}>{setupLabel}</Tag>
                            <Tag color={aiDecision === 'BUY' ? 'green' : aiDecision === 'WATCH' ? 'gold' : aiDecision === 'SKIP' ? 'red' : 'default'} style={{ fontSize: '11px', margin: 0 }}>{aiDecision}</Tag>
                            <span style={{ fontSize: '10px', color: '#999' }}>Cnf {confidence}%</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px' }}>
                            <Tag color={dq === 'GOOD' ? 'green' : dq === 'PARTIAL' ? 'gold' : 'red'} style={{ margin: 0 }}>Data: {dq}</Tag>
                            <Tag color={rg.status === 'PASS' ? 'green' : rg.status === 'REVIEW' ? 'gold' : 'red'} style={{ margin: 0 }}>Gate: {rg.status || 'N/A'}</Tag>
                            <Tag color={finalAction === 'BUY_READY' ? 'green' : finalAction === 'WAIT_FOR_ENTRY' ? 'gold' : 'red'} style={{ margin: 0, fontWeight: 600 }}>{finalAction}</Tag>
                            <Button
                              size="small"
                              type={finalAction === 'BUY_READY' ? 'primary' : finalAction === 'WAIT_FOR_ENTRY' ? 'default' : 'dashed'}
                              danger={finalAction === 'BLOCKED_BY_RISK'}
                              disabled={finalAction === 'SKIP' || finalAction === 'BLOCKED_BY_RISK' || dq === 'POOR'}
                              onClick={() => handleEntryPlanAction(ep)}
                              style={{ fontSize: '11px', fontWeight: 500 }}
                            >
                              {finalAction === 'BUY_READY' ? 'Execute Plan' : finalAction === 'WAIT_FOR_ENTRY' ? 'Add to Watchlist' : finalAction === 'SKIP' ? 'Skipped' : 'Blocked'}
                            </Button>
                          </div>
                        </div>

                        {/* ── 4-Card Grid ── */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>

                          {/* A. Execution Plan */}
                          <div style={{ background: '#fff', borderRadius: '6px', border: '1px solid #edf0f2', padding: '10px 12px' }}>
                            <CardHeader title="A. Execution Plan" />
                            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '3px 8px', alignItems: 'baseline' }}>
                              <Label text="Entry Zone" /><Value v={ep.entryZoneLow != null ? `$${ep.entryZoneLow.toFixed(2)} – $${(ep.entryZoneHigh ?? 0).toFixed(2)}` : '—'} bold />
                              <Label text="Trigger" /><Value v={ep.triggerCondition || '—'} />
                              <Label text="Stop Loss" /><Value v={`${fmtPrice(ep.stopLoss)} (${ep.stopLossPct != null ? fmtPct(ep.stopLossPct) : 'N/A'} from ${ep.stopSource || 'entry'})`} color="#e84749" bold />
                              <Label text="Target 1" /><Value v={`${fmtPrice(ep.takeProfit1)}  R/R ${fmtRR(ep.riskReward1)}`} color="#52c41a" bold />
                              <Label text="Target 2" /><Value v={`${fmtPrice(ep.takeProfit2)}  R/R ${fmtRR(ep.riskReward2)}`} color="#52c41a" />
                              <Label text="Invalidation" /><Value v={ep.invalidationCondition || '—'} color="#e84749" />
                              <Label text="Order Type" />
                              <span>
                                <Value v={ed.orderTypeSuggestion || 'N/A'} bold color={ed.orderTypeSuggestion === 'Not Available' ? '#ff4d4f' : '#52c41a'} />
                                {ed.orderTypeReason && <div style={{ fontSize: '10px', color: '#888', marginTop: '1px' }}>{ed.orderTypeReason}</div>}
                              </span>
                            </div>
                          </div>

                          {/* B. Position & Risk */}
                          <div style={{ background: '#fff', borderRadius: '6px', border: '1px solid #edf0f2', padding: '10px 12px' }}>
                            <CardHeader title="B. Position & Risk" />
                            <div style={{ display: 'grid', gridTemplateColumns: '85px 1fr', gap: '3px 8px', alignItems: 'baseline' }}>
                              <Label text="Portfolio" /><Value v={fmtDollars(ep.positionCapital)} bold />
                              <Label text="Buying Power" /><Value v={fmtDollars(ep.accountBuyingPower)} />
                              <Label text="Risk Budget" /><Value v={`${fmtDollars(ep.riskBudget)} (${fmtPct(ep.riskPct)} of portfolio)`} />
                              <Label text="Actual Risk" /><Value v={fmtDollars(ep.riskDollars)} color="#e84749" bold />
                              <Label text="Risk Used" /><Value v={ep.riskUsedPct != null ? `${ep.riskUsedPct.toFixed(1)}% of budget` : (ep.riskBudget > 0 ? `${(ep.riskDollars / ep.riskBudget * 100).toFixed(1)}% of budget` : '—')} color={ep.riskUsedPct > 80 ? '#ff4d4f' : '#d48806'} bold />
                              <Label text="Shares" /><Value v={fmtShares(ep.positionSize || ep.positionSizeShares)} bold />
                              <Label text="Est. Position" /><Value v={fmtDollars(ep.positionValue || ep.positionSizeDollars)} bold />
                              <Label text="Cap" /><Value v={ep.positionCapStatus || (ep.positionCapped ? `Capped ${fmtPct(ep.positionPct)}` : `OK (${fmtPct(ep.positionPct)} of portfolio)`)} color={ep.positionCapped ? '#d48806' : '#52c41a'} />
                            </div>
                          </div>

                          {/* C. Decision */}
                          <div style={{ background: '#fff', borderRadius: '6px', border: '1px solid #edf0f2', padding: '10px 12px' }}>
                            <CardHeader title="C. Decision" />
                            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '3px 8px', alignItems: 'baseline' }}>
                              <Label text="AI Decision" /><Value v={ep.aiDecision || '—'} color={aiColor(ep.aiDecision)} bold />
                              <Label text="Confidence" /><Value v={`${confidence}%`} bold />
                              <Label text="Risk Gate" /><Value v={rg.status || 'N/A'} color={rgColor} bold />
                              <Label text="Final Action" /><Value v={finalAction} color={faColor} bold />
                              <Label text="Trade Readiness" /><Value v={tradeReadiness} color={trColor} bold />
                              <Label text="Entry Trigger" /><Value v={ep.entryTriggerMet ? 'Met' : 'Not met'} color={ep.entryTriggerMet ? '#52c41a' : '#fa8c16'} />
                              <Label text="Best Strategy" /><Value v={ep.bestStrategy || '—'} />
                            </div>
                          </div>

                          {/* D. Data Quality */}
                          <div style={{ background: '#fff', borderRadius: '6px', border: '1px solid #edf0f2', padding: '10px 12px' }}>
                            <CardHeader title="D. Data Quality" color={dqColor} />
                            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '3px 8px', alignItems: 'baseline' }}>
                              <Label text="Quality" /><Tag color={dq === 'GOOD' ? 'green' : dq === 'PARTIAL' ? 'gold' : 'red'} style={{ margin: 0, fontSize: '11px' }}>{dq}</Tag>
                              <Label text="Market" /><Value v={ds.marketData || 'N/A'} />
                              <Label text="Account" /><Value v={ds.accountData || 'N/A'} />
                              <Label text="AI" />
                              <span style={{ fontSize: '11px', fontWeight: 500 }}>
                                {ep.aiCalled ? (
                                  <span style={{ color: '#52c41a' }}>{ep.aiSource || 'AI'} ({ep.aiModel || 'LLM'}) ✓</span>
                                ) : (
                                  <Tooltip title={ep.aiError || 'No AI provider configured or call failed'}>
                                    <span style={{ color: '#fa8c16', cursor: 'help', borderBottom: '1px dotted #fa8c16' }}>Local Rules fallback</span>
                                  </Tooltip>
                                )}
                              </span>
                              <Label text="Broker" /><Value v={ed.brokerSource || 'Not Connected'} color={ed.brokerConnected ? '#52c41a' : '#ff4d4f'} />
                              {ep.aiError && <><Label text="AI Error" /><Value v={ep.aiError} color="#ff4d4f" /></>}
                            </div>
                          </div>
                        </div>

                        {/* ── Bottom Text Sections ── */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', borderTop: '1px solid #edf0f2', paddingTop: '8px' }}>
                          {/* Left: Decision Reason + Next Step */}
                          <div>
                            <div style={{ fontSize: '10px', fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>
                              Decision Reason {ep.aiCalled ? '(AI)' : '(Local Rules)'}
                            </div>
                            <div style={{ fontSize: '12px', color: '#444', lineHeight: '1.5', marginBottom: '6px' }}>
                              {ep.decisionReason || ep.reason || 'No reason provided'}
                            </div>
                            <div style={{ fontSize: '10px', fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>Next Step</div>
                            <div style={{ fontSize: '12px', color: '#1890ff', lineHeight: '1.5', fontWeight: 500 }}>
                              {ep.nextStep || 'No next step defined'}
                            </div>
                            {ep.riskComment && (
                              <>
                                <div style={{ fontSize: '10px', fontWeight: 600, color: '#d48806', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: '6px', marginBottom: '4px' }}>Risk Comment</div>
                                <div style={{ fontSize: '11px', color: '#595959', lineHeight: '1.5' }}>{ep.riskComment}</div>
                              </>
                            )}
                            {ep.invalidationComment && (
                              <>
                                <div style={{ fontSize: '10px', fontWeight: 600, color: '#e84749', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: '6px', marginBottom: '4px' }}>Invalidation</div>
                                <div style={{ fontSize: '11px', color: '#595959', lineHeight: '1.5' }}>{ep.invalidationComment}</div>
                              </>
                            )}
                          </div>

                          {/* Right: Risk Notes + Blockers + Gate Detail */}
                          <div>
                            <div style={{ fontSize: '10px', fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>Risk Notes</div>
                            <div style={{ fontSize: '11px', lineHeight: '1.5' }}>
                              {(() => {
                                const warnings = rg.warnings || [];
                                if (warnings.length === 0) return <div style={{ color: '#bbb', fontStyle: 'italic' }}>No risk notes</div>;
                                return warnings.slice(0, 4).map((r: string, i: number) => (
                                  <div key={i} style={{ marginBottom: '2px', color: '#595959' }}><span style={{ color: '#d48806' }}>•</span> {r}</div>
                                ));
                              })()}
                            </div>
                            <div style={{ fontSize: '10px', fontWeight: 600, color: '#ff4d4f', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: '6px', marginBottom: '4px' }}>Blockers / Warnings</div>
                            <div style={{ fontSize: '11px', lineHeight: '1.5' }}>
                              {(() => {
                                const blockers = ep.blockers || rg.blockers || [];
                                if (blockers.length === 0) return <div style={{ color: '#bbb', fontStyle: 'italic' }}>No blockers</div>;
                                return blockers.slice(0, 4).map((r: string, i: number) => (
                                  <div key={i} style={{ marginBottom: '2px', color: '#595959' }}><span style={{ color: '#d93025' }}>•</span> {r}</div>
                                ));
                              })()}
                            </div>
                            {/* Gate REVIEW detail */}
                            {rg.status === 'REVIEW' && (rg.warnings || []).length > 0 && (
                              <div style={{ marginTop: '6px', padding: '6px 8px', background: '#fffbe6', borderRadius: '4px', border: '1px solid #ffe58f' }}>
                                <div style={{ fontSize: '9px', fontWeight: 600, color: '#d48806', marginBottom: '2px' }}>REVIEW: {(rg.warnings || []).slice(0, 2).join('; ')}</div>
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
                        'WAIT_FOR_ENTRY': 'WAIT ENTRY',
                        'WATCH_ONLY': 'WATCH',
                        'SKIP': 'SKIP',
                        'BLOCKED_BY_RISK': 'BLOCKED',
                        'NEEDS_REVIEW': 'REVIEW',
                      };
                      const tagColor = a === 'BUY_READY' || a === 'BUY_ALLOWED' ? 'green' : a === 'WAIT_FOR_ENTRY' || a === 'WATCH_ONLY' ? 'gold' : 'red';
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
                            <Button size="small" danger disabled style={{ fontSize: '10px' }}>Blocked</Button>
                          </Tooltip>
                        );
                      }
                      if (fa === 'SKIP' || aiDec === 'SKIP') {
                        return <Button size="small" disabled style={{ fontSize: '10px' }}>Skipped</Button>;
                      }
                      if (fa === 'WAIT_FOR_ENTRY' || aiDec === 'WATCH') {
                        return (
                          <Button size="small" onClick={() => addToWatchlist(record)} style={{ fontSize: '10px', color: '#d48806', borderColor: '#d48806' }}>
                            + Watchlist
                          </Button>
                        );
                      }
                      if (fa === 'BUY_READY') {
                        return (
                          <Button size="small" type="primary" onClick={() => handleEntryPlanAction(record)} style={{ fontSize: '10px' }}>
                            Execute
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