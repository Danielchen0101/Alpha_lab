import {
  reconcileMarketScannerWithBackend,
  ScannerStateStore,
  SCANNER_STATE_STORAGE_KEY,
} from './scannerStateStore';

describe('ScannerStateStore execution recovery boundary', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('drops legacy unscoped execution candidates and removal markers on recovery', () => {
    window.localStorage.setItem(SCANNER_STATE_STORAGE_KEY, JSON.stringify({
      version: 1,
      aiExecutionCandidates: [{
        symbol: 'SPY',
        qtyMode: 'shares',
        userQty: 1,
        orderType: 'limit',
        timeInForce: 'day',
        executionStatus: 'draft',
        source: 'legacy-cache',
        addedAt: '2026-01-01T00:00:00.000Z',
      }],
      removedExecutionSymbols: ['QQQ'],
      entryPlan: {
        status: 'completed',
        results: [{ symbol: 'SPY', limitPrice: 600, positionSizeShares: 10 }],
        runId: 'legacy-run',
        lastUpdated: '2026-01-01T00:00:00.000Z',
      },
    }));

    const store = new ScannerStateStore();

    expect(store.getAiExecutionCandidates()).toEqual([]);
    expect(store.getRemovedExecutionSymbols()).toEqual([]);
    expect(store.getState().entryPlan).toEqual({
      status: 'idle',
      results: null,
      runId: null,
      lastUpdated: null,
    });
  });

  test('keeps execution candidates in memory but strips them from browser persistence', () => {
    const store = new ScannerStateStore();
    store.setAiExecutionCandidates([{
      symbol: 'IWM',
      qtyMode: 'shares',
      userQty: 2,
      orderType: 'limit',
      timeInForce: 'day',
      executionStatus: 'draft',
      source: 'authenticated-run',
      addedAt: '2026-01-01T00:00:00.000Z',
    }]);
    store.addRemovedExecutionSymbol('DIA');
    store.flushPendingSave();

    expect(store.getAiExecutionCandidates()).toHaveLength(1);
    const persisted = JSON.parse(window.localStorage.getItem(SCANNER_STATE_STORAGE_KEY) || '{}');
    expect(persisted.entryPlan).toEqual({
      status: 'idle',
      results: null,
      runId: null,
      lastUpdated: null,
    });
    expect(persisted.aiExecutionCandidates).toEqual([]);
    expect(persisted.removedExecutionSymbols).toEqual([]);
  });
});

describe('market scanner backend reconciliation', () => {
  const failedCachedScanner = () => {
    const store = new ScannerStateStore();
    store.updateMarketScanner({
      status: 'failed',
      results: [{ symbol: 'AAPL' }],
      detailedScanStatus: {
        ...store.getState().marketScanner.detailedScanStatus,
        currentStatus: 'error',
        percent: 2,
        statusMessage: '市场扫描进行中',
      },
    });
    return store.getState().marketScanner;
  };

  test('repairs a stale cached error when the backend run completed', () => {
    const cached = failedCachedScanner();
    const patch = reconcileMarketScannerWithBackend(cached, {
      status: 'completed',
      currentStep: 'market_scanner',
      message: 'Market scan completed',
    });

    expect(patch?.status).toBe('completed');
    expect(patch?.detailedScanStatus?.currentStatus).toBe('completed');
    expect(patch?.detailedScanStatus?.statusMessage).toBe('Market scan completed');
    expect(patch).not.toHaveProperty('results');
  });

  test('replaces contradictory running text with the real backend failure', () => {
    const cached = failedCachedScanner();
    const patch = reconcileMarketScannerWithBackend(cached, {
      status: 'failed',
      currentStep: 'market_scanner',
      lastError: 'Alpaca snapshot request timed out',
    });

    expect(patch?.status).toBe('failed');
    expect(patch?.detailedScanStatus?.currentStatus).toBe('error');
    expect(patch?.detailedScanStatus?.statusMessage).toBe('Alpaca snapshot request timed out');
    expect(patch?.detailedScanStatus?.lastFailureReason).toBe('Alpaca snapshot request timed out');
  });

  test('does not overwrite an active browser display while the backend is running', () => {
    expect(reconcileMarketScannerWithBackend(failedCachedScanner(), {
      status: 'running',
      currentStep: 'market_scanner',
    })).toBeNull();
  });

  test('marks market scanning complete as soon as the backend advances to a later stage', () => {
    const cached = failedCachedScanner();
    cached.status = 'running';
    cached.detailedScanStatus.currentStatus = 'scanning';
    const patch = reconcileMarketScannerWithBackend(cached, {
      status: 'running',
      currentStep: 'fine_scan',
      message: 'Fine scan running',
    });

    expect(patch?.status).toBe('completed');
    expect(patch?.progress).toBe(100);
    expect(patch?.detailedScanStatus?.currentStatus).toBe('completed');
    expect(patch?.detailedScanStatus?.statusMessage).toContain('Fine scan running');
  });
});
