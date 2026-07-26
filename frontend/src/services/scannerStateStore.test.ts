import {
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
