import {
  buildEffectiveLimits,
  deriveSafetySemantics,
  readinessCheckIsReady,
} from './safetyCenterModel';

describe('trading safety semantics', () => {
  const state = {
    pauseNewEntries: false,
    cancelPendingEntryOrders: false,
    keepProtectiveExits: true,
    reason: '',
    pausedAt: null,
    updatedAt: null,
    version: 1,
  };

  it('keeps protective exits active while pausing new entries', () => {
    expect(deriveSafetySemantics({ ...state, pauseNewEntries: true })).toEqual({
      entriesAllowed: false,
      protectionsGuaranteed: true,
      canResume: true,
      canPause: false,
      tone: 'paused',
    });
  });

  it('treats a missing protection guarantee as critical and prevents resume', () => {
    expect(deriveSafetySemantics({
      ...state,
      pauseNewEntries: true,
      keepProtectiveExits: false,
    })).toMatchObject({
      protectionsGuaranteed: false,
      canResume: false,
      tone: 'critical',
    });
  });

  it('normalizes readiness values without treating unknown as ready', () => {
    expect(readinessCheckIsReady({ key: 'broker', status: 'ready' })).toBe(true);
    expect(readinessCheckIsReady({ key: 'risk', ready: true })).toBe(true);
    expect(readinessCheckIsReady({ key: 'data', status: 'unknown' })).toBe(false);
  });

  it('builds visible effective limits from the saved mandate', () => {
    const limits = buildEffectiveLimits({
      tradeMode: 'real',
      pipelineMode: 'ai',
      riskProfile: 'medium',
      timeHorizon: 'mid',
      leverageEnabled: false,
      scheduleEnabled: true,
      intervalMinutes: 15,
      liveAutoTradingEnabled: true,
      strategyPolicy: {
        version: 'strategy_mandate_v1',
        dailyLossStopPct: 2.5,
        maxSinglePositionPct: 15,
        slippageCapBps: 18,
      },
    });
    expect(limits.find((limit) => limit.key === 'dailyLoss')?.value).toBe('2.5%');
    expect(limits.find((limit) => limit.key === 'singlePosition')?.value).toBe('15%');
    expect(limits.find((limit) => limit.key === 'slippage')?.value).toBe('18 bps');
  });
});
