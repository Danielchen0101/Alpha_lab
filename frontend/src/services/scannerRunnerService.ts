/**
 * Scanner Runner Service — module-level singleton
 * Holds the actual async scan loop outside of React components.
 * Survives route changes. Only lost on browser refresh.
 */

import { scannerStateStore } from './scannerStateStore';
import api, { scannerApi } from './api';
import marketDataService from './marketDataService';

interface ActiveRun {
  id: string;
  type: 'market-scanner' | 'continue-scan' | 'fine-scan' | 'deeper-validation' | 'entry-plan';
  promise: Promise<void>;
  stopRequested: boolean;
  abortController: AbortController;
  startedAt: number;
}

let activeRun: ActiveRun | null = null;

function generateRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Check if a scan is currently running at the module level.
 * Used by Portfolio.tsx to distinguish route change from page refresh.
 */
export function isScanRunning(): boolean {
  return activeRun !== null && !activeRun.stopRequested;
}

/**
 * Get the active run info (for UI display).
 */
export function getActiveRun(): { id: string; type: string; startedAt: number } | null {
  if (!activeRun) return null;
  return { id: activeRun.id, type: activeRun.type, startedAt: activeRun.startedAt };
}

// ── Fine Scan tracking ──

/**
 * Register a Fine Scan async loop as active.
 * Called from Portfolio.tsx when Fine Scan starts.
 */
export function registerFineScanRun(promise: Promise<void>): string {
  const runId = generateRunId();
  const abortController = new AbortController();
  const run: ActiveRun = {
    id: runId,
    type: 'fine-scan',
    promise,
    stopRequested: false,
    abortController,
    startedAt: Date.now(),
  };
  activeRun = run;
  console.log('[ScannerRunner] Registered Fine Scan run:', runId);
  return runId;
}

/**
 * Unregister the Fine Scan run when it completes or fails.
 */
export function unregisterFineScanRun(): void {
  if (activeRun && activeRun.type === 'fine-scan') {
    console.log('[ScannerRunner] Unregistered Fine Scan run:', activeRun.id);
    activeRun = null;
  }
}

/**
 * Check if Fine Scan is currently running at the module level.
 */
export function isFineScanRunning(): boolean {
  return activeRun !== null && activeRun.type === 'fine-scan' && !activeRun.stopRequested;
}

// ── Deeper Validation tracking ──

/**
 * Register a Deeper Validation async loop as active.
 */
export function registerDeeperValidationRun(promise: Promise<void>): string {
  const runId = generateRunId();
  const abortController = new AbortController();
  const run: ActiveRun = {
    id: runId,
    type: 'deeper-validation',
    promise,
    stopRequested: false,
    abortController,
    startedAt: Date.now(),
  };
  activeRun = run;
  console.log('[ScannerRunner] Registered Deeper Validation run:', runId);
  return runId;
}

/**
 * Unregister the Deeper Validation run when it completes or fails.
 */
export function unregisterDeeperValidationRun(): void {
  if (activeRun && activeRun.type === 'deeper-validation') {
    console.log('[ScannerRunner] Unregistered Deeper Validation run:', activeRun.id);
    activeRun = null;
  }
}

/**
 * Check if Deeper Validation is currently running at the module level.
 */
export function isDeeperValidationRunning(): boolean {
  return activeRun !== null && activeRun.type === 'deeper-validation' && !activeRun.stopRequested;
}

// ── Entry Plan tracking ──

/**
 * Register an Entry Plan async loop as active.
 */
export function registerEntryPlanRun(promise: Promise<void>): string {
  const runId = generateRunId();
  const abortController = new AbortController();
  const run: ActiveRun = {
    id: runId,
    type: 'entry-plan',
    promise,
    stopRequested: false,
    abortController,
    startedAt: Date.now(),
  };
  activeRun = run;
  console.log('[ScannerRunner] Registered Entry Plan run:', runId);
  return runId;
}

/**
 * Unregister the Entry Plan run when it completes or fails.
 */
export function unregisterEntryPlanRun(): void {
  if (activeRun && activeRun.type === 'entry-plan') {
    console.log('[ScannerRunner] Unregistered Entry Plan run:', activeRun.id);
    activeRun = null;
  }
}

/**
 * Check if Entry Plan is currently running at the module level.
 */
export function isEntryPlanRunning(): boolean {
  return activeRun !== null && activeRun.type === 'entry-plan' && !activeRun.stopRequested;
}

/**
 * Stop the currently running market scanner. Only called by user action.
 */
export function stopMarketScannerByUser(): void {
  if (!activeRun) {
    console.log('[ScannerRunner] No active run to stop');
    return;
  }
  console.log('[ScannerRunner] User requested stop for run:', activeRun.id);
  activeRun.stopRequested = true;
  activeRun.abortController.abort();

  // Update store with user-stopped status
  const state = scannerStateStore.getState();
  scannerStateStore.updateMarketScanner({
    status: 'stopped',
    currentStatus: 'stopped',
    detailedScanStatus: {
      ...state.marketScanner.detailedScanStatus,
      currentStatus: 'stopped',
      statusMessage: 'Scan stopped by user',
    },
  });
}

/**
 * Start the Market Scanner. Called from Portfolio.tsx when user clicks Run.
 */
export async function startMarketScanner(): Promise<void> {
  // If already running, don't start another
  if (activeRun && !activeRun.stopRequested) {
    console.log('[ScannerRunner] Scan already running, skipping');
    return;
  }

  const runId = generateRunId();
  const abortController = new AbortController();

  // Reset store state for new scan
  scannerStateStore.updateMarketScanner({
    status: 'running',
    progress: 0,
    totalSymbols: 0,
    scannedSymbols: 0,
    currentSymbol: null,
    currentStatus: 'scanning',
    currentBatch: null,
    batchProgress: null,
    retryAttempt: 0,
    results: [],
    outputLogs: [],
    detailedScanStatus: {
      currentStatus: 'scanning',
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
      statusMessage: 'Starting scan...',
    },
  });

  const run: ActiveRun = {
    id: runId,
    type: 'market-scanner',
    promise: Promise.resolve(),
    stopRequested: false,
    abortController,
    startedAt: Date.now(),
  };

  // Start the actual scan
  run.promise = runMarketScannerLoop(run);

  activeRun = run;
  console.log('[ScannerRunner] Started run:', runId);

  try {
    await run.promise;
  } finally {
    // Clear active run when done (unless a new one was started)
    if (activeRun && activeRun.id === runId) {
      activeRun = null;
    }
    console.log('[ScannerRunner] Run finished:', runId);
  }
}

/**
 * The actual market scanner loop. Runs entirely at module level.
 */
async function runMarketScannerLoop(run: ActiveRun): Promise<void> {
  const store = scannerStateStore;

  try {
    // Pre-flight config check
    let aiAvailable = false;
    try {
      const statusResp = await api.get('/config/status');
      if (statusResp.data?.success) {
        const s = statusResp.data;
        if (!s.user?.userResolved) {
          store.updateMarketScanner({
            status: 'failed',
            currentStatus: 'error',
            detailedScanStatus: {
              ...store.getState().marketScanner.detailedScanStatus,
              currentStatus: 'error',
              statusMessage: 'Session expired. Please sign in again.',
            },
          });
          return;
        }
        if (!s.alpaca?.paperConfigured && !s.alpaca?.liveConfigured) {
          store.updateMarketScanner({
            status: 'failed',
            currentStatus: 'error',
            detailedScanStatus: {
              ...store.getState().marketScanner.detailedScanStatus,
              currentStatus: 'error',
              statusMessage: 'Alpaca Market Data API is not configured.',
            },
          });
          return;
        }
        // Check AI provider availability
        const aiCfg = s.ai || {};
        if (aiCfg.configured && !aiCfg.keyIsMasked && aiCfg.testStatus === 'connected') {
          aiAvailable = true;
        } else {
          const reason = aiCfg.keyIsMasked ? 'AI key is invalid (masked). Re-enter in Settings.' :
                         !aiCfg.configured ? 'AI Provider is not configured. Configure in Settings.' :
                         aiCfg.testStatus !== 'connected' ? `AI Provider not tested (status: ${aiCfg.testStatus}). Click Test AI Connection in Settings.` :
                         'AI Provider is unavailable.';
          console.warn(`[ScannerRunner] AI pre-flight: ${reason}`);
          // Don't block scanner — market data still useful, AI analysis will use local rules
        }
      }
    } catch (e) {
      console.warn('[ScannerRunner] Config pre-flight failed, continuing:', e);
    }

    // Get trading universe
    const symbols = await getTradingUniverse();

    if (!symbols || symbols.length === 0) {
      const defaultSymbols = [
        'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META',
        'TSLA', 'NVDA', 'AMD', 'AVGO', 'INTC',
        'JPM', 'XOM', 'WMT', 'HD', 'JNJ',
        'PG', 'KO', 'PEP', 'V', 'MA'
      ];
      await scanSymbolsLoop(run, defaultSymbols, aiAvailable);
    } else {
      await scanSymbolsLoop(run, symbols, aiAvailable);
    }

    // Check if stopped by user
    if (run.stopRequested) {
      const state = store.getState();
      const totalProcessed = state.marketScanner.detailedScanStatus.processedCount;
      const totalSymbols = state.marketScanner.detailedScanStatus.totalCount;
      store.updateMarketScanner({
        status: 'stopped',
        detailedScanStatus: {
          ...state.marketScanner.detailedScanStatus,
          currentStatus: 'stopped',
          statusMessage: `Stopped at ${totalProcessed}/${totalSymbols} symbols — ${state.marketScanner.results.length} results retained`,
        },
      });
      return;
    }

    // Scan completed
    const now = new Date().toISOString();
    store.updateMarketScanner({
      status: 'completed',
      lastScanTime: now,
      currentStatus: 'completed',
      detailedScanStatus: {
        ...store.getState().marketScanner.detailedScanStatus,
        currentStatus: 'completed',
        lastScanAt: now,
        statusMessage: 'Scan completed',
      },
    });
    console.log('[ScannerRunner] Market scan completed');

  } catch (error: any) {
    console.error('[ScannerRunner] Market scan failed:', error);
    const state = store.getState();
    store.updateMarketScanner({
      status: 'failed',
      currentStatus: 'error',
      detailedScanStatus: {
        ...state.marketScanner.detailedScanStatus,
        currentStatus: 'error',
        statusMessage: `Error: ${error.message || 'Unknown error'}`,
      },
    });
  }
}

/**
 * Scan symbols in batches with sliding window.
 */
async function scanSymbolsLoop(run: ActiveRun, symbols: string[], aiAvailable: boolean = true): Promise<void> {
  const store = scannerStateStore;
  const totalSymbols = symbols.length;
  const RENDER_BATCH_SIZE = 1;
  const CONCURRENT_CONFIG = {
    windowSize: 1,
    maxRetries: 3,
  };

  store.updateMarketScanner({
    totalSymbols,
    scannedSymbols: 0,
    currentStatus: 'initializing',
    currentSymbol: '',
    currentBatch: 0,
    batchProgress: '',
    retryAttempt: 0,
    maxRetryAttempts: CONCURRENT_CONFIG.maxRetries,
  });

  store.updateMarketScanner({
    detailedScanStatus: {
      ...store.getState().marketScanner.detailedScanStatus,
      totalCount: totalSymbols,
      processedCount: 0,
      percent: 0,
      activeSymbols: [],
      retryCount: 0,
      validatedCount: 0,
      statusMessage: `Starting scan of ${totalSymbols} symbols`,
    },
  });

  store.setMarketScannerResults([]);

  if (!aiAvailable) {
    store.updateMarketScanner({
      detailedScanStatus: {
        ...store.getState().marketScanner.detailedScanStatus,
        statusMessage: `Scanning ${totalSymbols} symbols with local rules (AI not configured)`,
      },
    });
  }

  const pendingSymbols = [...symbols];
  const validatedBuffer: any[] = [];
  const retryQueue: Array<{ symbol: string; retryCount: number; lastError?: string }> = [];
  const processingSlots = new Set<string>();
  const failedSymbols: Array<{ symbol: string; error: string }> = [];

  let totalProcessed = 0;
  let totalValidated = 0;
  let totalRetries = 0;

  const startProcessing = async (symbol: string, retryCount: number, lastError?: string) => {
    if (run.stopRequested) return;

    processingSlots.add(symbol);
    // Only count new symbols, not retries
    if (retryCount === 0) {
      totalProcessed++;
    }

    store.updateMarketScanner({
      currentSymbol: symbol,
      currentStatus: retryCount > 0 ? 'retrying' : 'scanning',
      retryAttempt: retryCount,
    });

    try {
      // Process single symbol with full data pipeline
      const result = await processSingleSymbol(symbol, retryCount);

      // Validate data
      const validation = validateSymbolData(result);

      if (validation.valid && result.analysisStatus !== 'partial') {
        validatedBuffer.push(result);
        totalValidated++;

        // Update results in batches
        if (validatedBuffer.length >= RENDER_BATCH_SIZE) {
          const currentResults = store.getState().marketScanner.results;
          store.setMarketScannerResults([...currentResults, ...validatedBuffer.splice(0)]);
        }
      } else if (result.skipRetry) {
        // AI analysis failed definitively — don't retry
        failedSymbols.push({
          symbol,
          error: result.analysisError || 'AI analysis failed'
        });
      } else if (retryCount < CONCURRENT_CONFIG.maxRetries) {
        retryQueue.push({ symbol, retryCount: retryCount + 1, lastError: validation.error });
        totalRetries++;
      } else {
        failedSymbols.push({ symbol, error: validation.error || 'Unknown error' });
      }
    } catch (error: any) {
      if (error.name === 'AbortError' || run.stopRequested) return;

      // Don't retry config/auth errors — they won't resolve by retrying
      const isNonRetryable = error.message?.includes('not configured') ||
                             error.message?.includes('not passed Test') ||
                             error.message?.includes('API key');
      if (isNonRetryable || (error.skipRetry)) {
        failedSymbols.push({ symbol, error: error.message });
      } else if (retryCount < CONCURRENT_CONFIG.maxRetries) {
        retryQueue.push({ symbol, retryCount: retryCount + 1, lastError: error.message });
        totalRetries++;
      } else {
        failedSymbols.push({ symbol, error: error.message });
      }
    } finally {
      processingSlots.delete(symbol);

      // Update progress (cap at 100%)
      const progressPct = Math.min(100, Math.round((totalProcessed / totalSymbols) * 100));
      store.updateMarketScanner({
        scannedSymbols: totalProcessed,
        progress: progressPct,
      });

      store.updateMarketScanner({
        detailedScanStatus: {
          ...store.getState().marketScanner.detailedScanStatus,
          processedCount: totalProcessed,
          percent: progressPct,
          validatedCount: totalValidated,
          failedCount: failedSymbols.length,
          retryCount: totalRetries,
          lastFailureReason: failedSymbols.length > 0 ? failedSymbols[failedSymbols.length - 1].error : '',
          activeSymbols: Array.from(processingSlots),
          statusMessage: `Processing: ${totalProcessed}/${totalSymbols} (${totalValidated} validated)`,
        },
      });
    }
  };

  // Sliding window execution
  while ((pendingSymbols.length > 0 || retryQueue.length > 0 || processingSlots.size > 0) && !run.stopRequested) {
    // Fill processing slots
    while (processingSlots.size < CONCURRENT_CONFIG.windowSize && (pendingSymbols.length > 0 || retryQueue.length > 0) && !run.stopRequested) {
      let symbol: string;
      let retryCount = 0;
      let lastError: string | undefined;

      if (retryQueue.length > 0) {
        const retryItem = retryQueue.shift()!;
        symbol = retryItem.symbol;
        retryCount = retryItem.retryCount;
        lastError = retryItem.lastError;
      } else if (pendingSymbols.length > 0) {
        symbol = pendingSymbols.shift()!;
      } else {
        break;
      }

      startProcessing(symbol, retryCount, lastError);
    }

    // Wait a bit before checking again
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Wait for all processing to complete
  while (processingSlots.size > 0 && !run.stopRequested) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Flush remaining results
  if (validatedBuffer.length > 0) {
    const currentResults = store.getState().marketScanner.results;
    store.setMarketScannerResults([...currentResults, ...validatedBuffer.splice(0)]);
  }
}

/**
 * Process a single symbol: fetch market data, news, AI analysis, validate.
 */
async function processSingleSymbol(symbol: string, retryCount: number = 0): Promise<any> {
  const store = scannerStateStore;
  try {
    console.log(`[ScannerRunner] [${symbol}] Processing (attempt ${retryCount + 1})`);

    // Stage 1: Market Data
    store.updateMarketScanner({
      detailedScanStatus: {
        ...store.getState().marketScanner.detailedScanStatus,
        statusMessage: `${symbol} — Market Data`,
      },
    });
    const stockData = await marketDataService.getStockData(symbol);

    // Stage 2: News
    store.updateMarketScanner({
      detailedScanStatus: {
        ...store.getState().marketScanner.detailedScanStatus,
        statusMessage: `${symbol} — News`,
      },
    });
    const newsData = await getStockNews(symbol);

    // Fetch company name
    const companyName = await getCompanyName(symbol);

    // Stage 3: AI Analysis
    store.updateMarketScanner({
      detailedScanStatus: {
        ...store.getState().marketScanner.detailedScanStatus,
        statusMessage: `${symbol} — AI Analysis`,
      },
    });
    const trendAnalysis = await analyzeTrend(symbol, stockData, newsData);

    // Build result object
    const result = {
      symbol,
      companyName: trendAnalysis.companyName || companyName,
      trendLabel: trendAnalysis.trendLabel,
      trendScore: trendAnalysis.trendScore || trendAnalysis.overallScore || null,
      trendConfidence: trendAnalysis.trendConfidence || trendAnalysis.confidence || null,
      price: stockData.price || null,
      changePct: stockData.changePct || stockData.changePercent || null,
      changePercent: stockData.changePercent || null,
      volume: stockData.volume || null,
      marketCap: stockData.marketCap || null,
      dayHigh: stockData.dayHigh || null,
      dayLow: stockData.dayLow || null,
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
      aiCalled: trendAnalysis.aiCalled !== undefined ? trendAnalysis.aiCalled : (trendAnalysis.analysisSource === 'deepseek'),
      aiSource: trendAnalysis.aiSource || (trendAnalysis.analysisSource === 'deepseek' ? 'DeepSeek' :
               trendAnalysis.analysisSource === 'unavailable' ? 'unavailable' :
               trendAnalysis.analysisSource === 'rule_based' ? 'Local Rules' : 'Unknown'),
      aiModel: trendAnalysis.aiModel || null,
      aiError: trendAnalysis.aiError || null,
      timestamp: new Date().toISOString()
    };

    // Check data completeness
    const validation = validateSymbolData(result);
    if (!validation.valid) {
      const aiOnlyFields = ['trendLabel', 'overallScore/trendScore', 'aiReasoning'];
      const onlyAiMissing = validation.missingFields.every(f => aiOnlyFields.includes(f));
      const hasAiError = result.aiError || (result as any).analysisSource === 'unavailable';

      // If backend already flagged skipRetry (config/auth error), respect it immediately
      if ((result as any).skipRetry) {
        result.analysisStatus = 'partial' as 'partial';
        (result as any).analysisError = result.aiError || 'AI unavailable';
      } else if (onlyAiMissing && hasAiError) {
        result.analysisStatus = 'partial' as 'partial';
        (result as any).analysisError = result.aiError || 'AI analysis unavailable';
        (result as any).skipRetry = true;
      } else if (retryCount < 2) {
        throw new Error(`Missing critical fields: ${validation.missingFields.join(', ')}`);
      } else {
        result.analysisStatus = 'partial' as 'partial';
        (result as any).analysisError = `Missing critical fields: ${validation.missingFields.join(', ')}`;
      }
    }

    // Stage 4: Completed
    store.updateMarketScanner({
      detailedScanStatus: {
        ...store.getState().marketScanner.detailedScanStatus,
        statusMessage: `${symbol} — Completed`,
      },
    });

    return result;

  } catch (error: any) {
    console.error(`[ScannerRunner] [${symbol}] Processing failed:`, error.message);

    return {
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
  }
}

/**
 * Fetch news data for a symbol.
 */
async function getStockNews(symbol: string): Promise<any> {
  try {
    const response = await api.get(`/market/news/${symbol}`);

    if (response.data?.success) {
      const newsData = response.data;
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
    }

    return {
      sentiment: null, eventRisk: null, topCatalyst: null,
      newsItems: [], source: null, topNews: null,
      newsCount: 0, hasNews: false
    };
  } catch (error: any) {
    console.warn(`[ScannerRunner] [${symbol}] News fetch failed:`, error.message);
    return {
      sentiment: null, eventRisk: null, topCatalyst: null,
      newsItems: [], source: null, topNews: null,
      newsCount: 0, hasNews: false
    };
  }
}

/**
 * Fetch company name for a symbol.
 */
async function getCompanyName(symbol: string): Promise<string> {
  try {
    const stockData = await marketDataService.getStockData(symbol);
    if (stockData?.name) return stockData.name;
    return symbol;
  } catch (error) {
    console.warn(`[ScannerRunner] [${symbol}] Company name fetch failed:`, error);
    return symbol;
  }
}

/**
 * AI trend analysis for a symbol.
 */
async function analyzeTrend(symbol: string, stockData: any, newsData: any): Promise<any> {
  try {
    const response = await scannerApi.post('/ai/analyze/single', { symbol });

    if (response.data?.success) {
      const result = response.data;
      return {
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
        overallScore: result.overallScore || result.trendScore || null,
        conciseReason: result.conciseReason || result.conciseReasoning || null,
        analysisSource: result.analysisSource || result.aiAnalysis || null,
        aiCalled: result.aiCalled !== undefined ? result.aiCalled : (result.analysisSource === 'deepseek' || result.analysisSource === 'gemini' || result.analysisSource === 'openai'),
        aiSource: result.aiSource || result.provider || (result.analysisSource === 'deepseek' ? 'DeepSeek' : result.analysisSource === 'rule_based' ? 'Local Rules' : null),
        aiModel: result.aiModel || result.model || null,
        aiError: result.aiError || result.message || null,
        provenance: result.provenance || null,
      };
    }

    // AI returned success: false
    const errorData = response.data || {};
    return {
      trendLabel: null, trendScore: null, momentumLabel: null, momentumScore: null,
      volatilityLabel: null, volatilityScore: null, volumeLabel: null, volumeScore: null,
      structureLabel: null, structureScore: null, newsLabel: null, newsScore: null,
      riskLevel: null, overallScore: null, conciseReason: null,
      trendConfidence: null, scannerReason: null, trendScoreDetail: null,
      volumeStatus: null, conciseReasoning: null, detailedReasoning: null,
      aiReasoning: null,
      newsSentiment: errorData.newsSentiment || null,
      eventRisk: errorData.eventRisk || null,
      topNews: errorData.topNews || null,
      companyName: errorData.companyName || null,
      sector: errorData.sector || null,
      analysisSource: 'unavailable',
      aiCalled: true,
      aiSource: 'unavailable',
      aiModel: null,
      aiError: errorData.providerMessage || errorData.error || 'AI analysis failed',
      skipRetry: errorData.skipRetry || false,
    };
  } catch (error: any) {
    console.error(`[ScannerRunner] [${symbol}] AI analysis exception:`, error.message);
    const httpStatus = error.response?.status;
    // Non-retryable: config/auth errors (401, 403) or backend skipRetry flag
    const backendSkipRetry = error.response?.data?.skipRetry;
    const isNonRetryable = backendSkipRetry || httpStatus === 401 || httpStatus === 403;
    return {
      trendLabel: null, trendScore: null, momentumLabel: null, momentumScore: null,
      volatilityLabel: null, volatilityScore: null, volumeLabel: null, volumeScore: null,
      structureLabel: null, structureScore: null, newsLabel: null, newsScore: null,
      riskLevel: null, overallScore: null, conciseReason: null,
      trendConfidence: null, scannerReason: null, trendScoreDetail: null,
      volumeStatus: null, conciseReasoning: null, detailedReasoning: null,
      aiReasoning: null, newsSentiment: null, eventRisk: null, topNews: null,
      companyName: null, sector: null,
      analysisSource: 'unavailable', aiCalled: true, aiSource: 'unavailable',
      aiModel: null, aiError: error.response?.data?.error || error.message || 'AI analysis exception',
      skipRetry: isNonRetryable,
    };
  }
}

/**
 * Validate symbol data completeness.
 */
function validateSymbolData(data: any): { valid: boolean; missingFields: string[]; error?: string } {
  const missingFields: string[] = [];

  const isReallyEmpty = (value: any): boolean => {
    return value === null || value === undefined || value === '';
  };

  if (isReallyEmpty(data?.symbol)) missingFields.push('symbol');
  if (isReallyEmpty(data?.price)) missingFields.push('price');
  if (isReallyEmpty(data?.changePct) && isReallyEmpty(data?.changePercent)) {
    missingFields.push('changePct/changePercent');
  }
  if (isReallyEmpty(data?.volume)) missingFields.push('volume');
  if (isReallyEmpty(data?.trendLabel)) missingFields.push('trendLabel');
  if (isReallyEmpty(data?.overallScore) && isReallyEmpty(data?.trendScore)) {
    missingFields.push('overallScore/trendScore');
  }
  if (isReallyEmpty(data?.aiReasoning)) missingFields.push('aiReasoning');

  const hasValidAIField = !isReallyEmpty(data?.trendLabel) ||
                         !isReallyEmpty(data?.trendScore) ||
                         !isReallyEmpty(data?.aiReasoning);

  const valid = missingFields.length === 0 && hasValidAIField;

  return {
    valid,
    missingFields,
    error: valid ? undefined : `Missing critical fields: ${missingFields.join(', ')}${!hasValidAIField ? ' (no valid AI field)' : ''}`
  };
}

/**
 * Get the trading universe (50 symbols).
 */
async function getTradingUniverse(): Promise<string[]> {
  try {
    const response = await api.get('/trading/universe');
    if (response.data?.symbols) {
      return response.data.symbols;
    }
  } catch (e) {
    console.warn('[ScannerRunner] Failed to fetch trading universe, using defaults:', e);
  }

  // Default universe
  return [
    'AAPL', 'TSLA', 'NVDA', 'AMD', 'RKLB', 'SNDK',
    'MSFT', 'GOOGL', 'AMZN', 'META', 'NFLX', 'INTC',
    'CRM', 'ADBE', 'PYPL', 'SQ', 'SHOP', 'SNOW',
    'PLTR', 'COIN', 'HOOD', 'SOFI', 'RIVN', 'LCID',
    'F', 'GM', 'BA', 'DIS', 'V', 'MA',
    'JPM', 'GS', 'BAC', 'WFC', 'XOM', 'CVX',
    'WMT', 'TGT', 'COST', 'HD', 'JNJ', 'PFE',
    'UNH', 'ABBV', 'KO', 'PEP', 'NKE', 'SBUX',
    'SPY', 'QQQ',
  ];
}
