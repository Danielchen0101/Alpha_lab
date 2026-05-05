/**
 * Persistent Scanner State Store
 * Stores Market Scanner, Continue Scan, and Fine Scan state outside React components.
 * Survives route changes, page refreshes, and component unmounts.
 */

const STORAGE_KEY = 'alpha_lab_scanner_state_v1';

export type ScannerStatus = 'idle' | 'running' | 'completed' | 'failed' | 'stopped' | 'scheduled';
export type ContinueScanStatus = 'idle' | 'processing' | 'completed' | 'error';
export type FineScanStatus = 'idle' | 'running' | 'completed' | 'failed' | 'stopped' | 'error';
export type DeeperValidationStatus = 'idle' | 'loading' | 'completed' | 'error' | 'stopped';
export type EntryPlanStatus = 'idle' | 'loading' | 'completed' | 'error' | 'stopped';
export type ExitScanStatus = 'idle' | 'scanning' | 'completed' | 'failed' | 'stopped';

export interface ExitScanResult {
  symbol: string;
  qty: number;
  avgEntry: number;
  currentPrice: number;
  pl: number;
  plPct: number;
  positionSource: 'ai_managed' | 'user_marked' | 'manual' | 'unknown';
  entryPlanTarget?: number;
  entryPlanStop?: number;
  exitDecision: 'sell_now' | 'place_target_limit' | 'hold' | 'manual_review' | 'blocked';
  exitOrderType?: 'market' | 'limit';
  exitPrice?: number;
  reason: string;
  exitPlanSource?: 'entry_plan' | 'generated';
  status: 'pending' | 'submitted' | 'filled' | 'failed' | 'hold' | 'manual_review' | 'blocked';
  alpacaOrderId?: string;
  error?: string;
}

export interface ExitScanState {
  status: ExitScanStatus;
  results: ExitScanResult[];
  submittedExitOrders: { symbol: string; orderId: string; orderType: string; exitPrice?: number; submittedAt: string; }[];
  runId: string | null;
  lastUpdated: string | null;
}

export interface MarketScannerState {
  status: ScannerStatus;
  lastScanTime: string | null;
  nextScanTime: string | null;
  progress: number;
  totalSymbols: number;
  scannedSymbols: number;
  currentSymbol: string | null;
  currentStatus: string | null;
  currentBatch: number | null;
  batchProgress: string | null;
  retryAttempt: number;
  maxRetryAttempts: number;
  results: any[];
  outputLogs: string[];
  detailedScanStatus: {
    currentStatus: 'idle' | 'scanning' | 'stopping' | 'stopped' | 'completed' | 'error';
    processedCount: number;
    totalCount: number;
    percent: number;
    activeSymbols: string[];
    retryCount: number;
    validatedCount: number;
    failedCount: number;
    lastFailureReason: string;
    lastScanAt: string | null;
    nextScanAt: string | null;
    statusMessage: string;
  };
}

export interface ContinueScanState {
  status: ContinueScanStatus;
  progress: number;
  results: any[];
  details: {
    currentStage: string;
    startTime: number | null;
    estimatedTimeRemaining: number | null;
    processedCount: number;
    totalCount: number;
  };
  outputLogs: string[];
}

export interface FineScanState {
  status: FineScanStatus;
  progress: number;
  stepProgress: number;
  currentStep: string;
  message: string;
  results: any[];
  expandedRows: string[];
  outputLogs: string[];
  stopRequested: boolean;
  runId: string | null;
  lastUpdated: string | null;
}

export interface DeeperValidationState {
  status: DeeperValidationStatus;
  results: any[] | null;
  runId: string | null;
  lastUpdated: string | null;
}

export interface EntryPlanState {
  status: EntryPlanStatus;
  results: any[] | null;
  runId: string | null;
  lastUpdated: string | null;
}

export interface AiExecutionCandidate {
  symbol: string;
  // Entry plan data
  setup?: string;
  entryZoneLow?: number;
  entryZoneHigh?: number;
  stopLoss?: number;
  takeProfit1?: number;
  riskReward1?: number;
  confidence?: number;
  aiDecision?: string;
  riskGateStatus?: string;
  dataQuality?: string;
  // Position sizing
  positionSizeShares?: number;
  positionSizeDollars?: number;
  // User-editable order params
  qtyMode: 'shares' | 'dollars';
  userQty: number;
  dollarAmount?: number;
  orderType: 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop';
  limitPrice?: number;
  stopPrice?: number;
  trailPrice?: number;
  trailPercent?: number;
  timeInForce: 'day' | 'gtc' | 'ioc' | 'fok';
  // Execution tracking
  executionStatus: 'draft' | 'pending' | 'submitted' | 'filled' | 'failed' | 'canceled';
  executionError?: string;
  alpacaOrderId?: string;
  alpacaOrderStatus?: string;
  // Metadata
  source: string;
  addedAt: string;
  // Full entry plan snapshot (for detail view)
  entryPlan?: any;
}

export interface ScannerStoreState {
  marketScanner: MarketScannerState;
  continueScan: ContinueScanState;
  fineScan: FineScanState;
  deeperValidation: DeeperValidationState;
  entryPlan: EntryPlanState;
  exitScan: ExitScanState;
  aiExecutionCandidates: AiExecutionCandidate[];
  pipelineSchedule: {
    intervalKey: string; // 'off' | '15m' | '30m' | '1h' | '2h'
    nextRunAt: string | null;
    lastRunAt: string | null;
    lastRunResult: string | null; // 'success' | 'failed' | 'stopped'
  };
  lastUpdated: string | null;
  version: number;
}

type Listener = (state: ScannerStoreState) => void;

const DEFAULT_STATE: ScannerStoreState = {
  marketScanner: {
    status: 'idle',
    lastScanTime: null,
    nextScanTime: null,
    progress: 0,
    totalSymbols: 0,
    scannedSymbols: 0,
    currentSymbol: null,
    currentStatus: null,
    currentBatch: null,
    batchProgress: null,
    retryAttempt: 0,
    maxRetryAttempts: 3,
    results: [],
    outputLogs: [],
    detailedScanStatus: {
      currentStatus: 'idle',
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
      statusMessage: '',
    },
  },
  continueScan: {
    status: 'idle',
    progress: 0,
    results: [],
    details: {
      currentStage: '',
      startTime: null,
      estimatedTimeRemaining: null,
      processedCount: 0,
      totalCount: 0,
    },
    outputLogs: [],
  },
  fineScan: {
    status: 'idle',
    progress: 0,
    stepProgress: 0,
    currentStep: '',
    message: '',
    results: [],
    expandedRows: [],
    outputLogs: [],
    stopRequested: false,
    runId: null,
    lastUpdated: null,
  },
  deeperValidation: {
    status: 'idle',
    results: null,
    runId: null,
    lastUpdated: null,
  },
  entryPlan: {
    status: 'idle',
    results: null,
    runId: null,
    lastUpdated: null,
  },
  exitScan: {
    status: 'idle',
    results: [],
    submittedExitOrders: [],
    runId: null,
    lastUpdated: null,
  },
  aiExecutionCandidates: [],
  pipelineSchedule: {
    intervalKey: 'off',
    nextRunAt: null,
    lastRunAt: null,
    lastRunResult: null,
  },
  lastUpdated: null,
  version: 1,
};

class ScannerStateStore {
  private state: ScannerStoreState;
  private listeners: Set<Listener> = new Set();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.state = this.loadFromStorage();
  }

  private loadFromStorage(): ScannerStoreState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === 1) {
          // Merge with defaults to handle new fields
          return {
            ...DEFAULT_STATE,
            ...parsed,
            marketScanner: { ...DEFAULT_STATE.marketScanner, ...parsed.marketScanner },
            continueScan: { ...DEFAULT_STATE.continueScan, ...parsed.continueScan },
            fineScan: { ...DEFAULT_STATE.fineScan, ...parsed.fineScan },
            deeperValidation: { ...DEFAULT_STATE.deeperValidation, ...parsed.deeperValidation },
            entryPlan: { ...DEFAULT_STATE.entryPlan, ...parsed.entryPlan },
            exitScan: { ...DEFAULT_STATE.exitScan, ...parsed.exitScan },
            aiExecutionCandidates: Array.isArray(parsed.aiExecutionCandidates) ? parsed.aiExecutionCandidates : [],
            pipelineSchedule: { ...DEFAULT_STATE.pipelineSchedule, ...parsed.pipelineSchedule },
          };
        }
      }
    } catch (e) {
      console.warn('[ScannerStateStore] Failed to load from storage:', e);
    }
    return { ...DEFAULT_STATE };
  }

  private saveToStorage(): void {
    try {
      this.state.lastUpdated = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn('[ScannerStateStore] Failed to save to storage:', e);
    }
  }

  private scheduleSave(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.saveToStorage(), 300);
  }

  private notify(): void {
    const snapshot = this.getState();
    this.listeners.forEach(listener => {
      try { listener(snapshot); } catch (e) { console.error('[ScannerStateStore] Listener error:', e); }
    });
  }

  getState(): ScannerStoreState {
    return JSON.parse(JSON.stringify(this.state));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ── Market Scanner ──

  updateMarketScanner(partial: Partial<MarketScannerState>): void {
    this.state.marketScanner = { ...this.state.marketScanner, ...partial };
    this.scheduleSave();
    this.notify();
  }

  setMarketScannerResults(results: any[]): void {
    this.state.marketScanner.results = results;
    this.scheduleSave();
    this.notify();
  }

  appendMarketScannerOutputLog(line: string): void {
    this.state.marketScanner.outputLogs.push(line);
    if (this.state.marketScanner.outputLogs.length > 500) {
      this.state.marketScanner.outputLogs = this.state.marketScanner.outputLogs.slice(-500);
    }
    this.scheduleSave();
    this.notify();
  }

  resetMarketScanner(): void {
    this.state.marketScanner = { ...DEFAULT_STATE.marketScanner };
    this.scheduleSave();
    this.notify();
  }

  // ── Continue Scan ──

  updateContinueScan(partial: Partial<ContinueScanState>): void {
    this.state.continueScan = { ...this.state.continueScan, ...partial };
    this.scheduleSave();
    this.notify();
  }

  setContinueScanResults(results: any[]): void {
    this.state.continueScan.results = results;
    this.scheduleSave();
    this.notify();
  }

  appendContinueScanOutputLog(line: string): void {
    this.state.continueScan.outputLogs.push(line);
    if (this.state.continueScan.outputLogs.length > 500) {
      this.state.continueScan.outputLogs = this.state.continueScan.outputLogs.slice(-500);
    }
    this.scheduleSave();
    this.notify();
  }

  resetContinueScan(): void {
    this.state.continueScan = { ...DEFAULT_STATE.continueScan };
    this.scheduleSave();
    this.notify();
  }

  // ── Fine Scan ──

  updateFineScan(partial: Partial<FineScanState>): void {
    this.state.fineScan = { ...this.state.fineScan, ...partial };
    this.scheduleSave();
    this.notify();
  }

  setFineScanResults(results: any[]): void {
    this.state.fineScan.results = results;
    this.scheduleSave();
    this.notify();
  }

  appendFineScanOutputLog(line: string): void {
    this.state.fineScan.outputLogs.push(line);
    if (this.state.fineScan.outputLogs.length > 500) {
      this.state.fineScan.outputLogs = this.state.fineScan.outputLogs.slice(-500);
    }
    this.scheduleSave();
    this.notify();
  }

  resetFineScan(): void {
    this.state.fineScan = { ...DEFAULT_STATE.fineScan };
    this.scheduleSave();
    this.notify();
  }

  // ── Deeper Validation ──

  updateDeeperValidation(partial: Partial<DeeperValidationState>): void {
    this.state.deeperValidation = { ...this.state.deeperValidation, ...partial };
    this.scheduleSave();
    this.notify();
  }

  setDeeperValidationResults(results: any[] | null): void {
    this.state.deeperValidation.results = results;
    this.scheduleSave();
    this.notify();
  }

  resetDeeperValidation(): void {
    this.state.deeperValidation = { ...DEFAULT_STATE.deeperValidation };
    this.scheduleSave();
    this.notify();
  }

  // ── Entry Plan ──

  updateEntryPlan(partial: Partial<EntryPlanState>): void {
    this.state.entryPlan = { ...this.state.entryPlan, ...partial };
    this.scheduleSave();
    this.notify();
  }

  setEntryPlanResults(results: any[] | null): void {
    this.state.entryPlan.results = results;
    this.scheduleSave();
    this.notify();
  }

  resetEntryPlan(): void {
    this.state.entryPlan = { ...DEFAULT_STATE.entryPlan };
    this.scheduleSave();
    this.notify();
  }

  // ── Exit Scan ──

  updateExitScan(partial: Partial<ExitScanState>): void {
    this.state.exitScan = { ...this.state.exitScan, ...partial };
    this.scheduleSave();
    this.notify();
  }

  setExitScanResults(results: ExitScanResult[]): void {
    this.state.exitScan.results = results;
    this.scheduleSave();
    this.notify();
  }

  addSubmittedExitOrder(order: { symbol: string; orderId: string; orderType: string; exitPrice?: number; submittedAt: string }): void {
    this.state.exitScan.submittedExitOrders.push(order);
    this.scheduleSave();
    this.notify();
  }

  resetExitScan(): void {
    this.state.exitScan = { ...DEFAULT_STATE.exitScan };
    this.scheduleSave();
    this.notify();
  }

  // ── AI Execution Candidates ──

  getAiExecutionCandidates(): AiExecutionCandidate[] {
    return JSON.parse(JSON.stringify(this.state.aiExecutionCandidates));
  }

  setAiExecutionCandidates(candidates: AiExecutionCandidate[]): void {
    this.state.aiExecutionCandidates = candidates;
    this.scheduleSave();
    this.notify();
  }

  updateAiExecutionCandidate(symbol: string, partial: Partial<AiExecutionCandidate>): void {
    const idx = this.state.aiExecutionCandidates.findIndex(c => c.symbol === symbol);
    if (idx >= 0) {
      this.state.aiExecutionCandidates[idx] = { ...this.state.aiExecutionCandidates[idx], ...partial };
    }
    this.scheduleSave();
    this.notify();
  }

  addAiExecutionCandidate(candidate: AiExecutionCandidate): void {
    // Prevent duplicates (ignore failed/canceled)
    const exists = this.state.aiExecutionCandidates.some(
      c => c.symbol === candidate.symbol && c.executionStatus !== 'failed' && c.executionStatus !== 'canceled'
    );
    if (!exists) {
      this.state.aiExecutionCandidates.push(candidate);
      this.scheduleSave();
      this.notify();
    }
  }

  removeAiExecutionCandidate(symbol: string): void {
    this.state.aiExecutionCandidates = this.state.aiExecutionCandidates.filter(c => c.symbol !== symbol);
    this.scheduleSave();
    this.notify();
  }

  clearAiExecutionCandidates(): void {
    this.state.aiExecutionCandidates = [];
    this.scheduleSave();
    this.notify();
  }

  // ── Pipeline Schedule ──

  updatePipelineSchedule(partial: Partial<ScannerStoreState['pipelineSchedule']>): void {
    this.state.pipelineSchedule = { ...this.state.pipelineSchedule, ...partial };
    this.scheduleSave();
    this.notify();
  }

  getPipelineSchedule(): ScannerStoreState['pipelineSchedule'] {
    return { ...this.state.pipelineSchedule };
  }

  // ── Global ──

  resetAll(): void {
    this.state = { ...DEFAULT_STATE };
    this.state.aiExecutionCandidates = [];
    this.state.pipelineSchedule = { ...DEFAULT_STATE.pipelineSchedule };
    this.saveToStorage();
    this.notify();
  }

  clearStorage(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.state = { ...DEFAULT_STATE };
    this.notify();
  }
}

// Singleton instance - lives outside React, survives route changes
export const scannerStateStore = new ScannerStateStore();
export default scannerStateStore;
