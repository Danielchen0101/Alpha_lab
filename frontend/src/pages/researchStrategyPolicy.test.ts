import {
  buildFallbackResearchStrategyPolicy,
  resolveResearchStrategyPolicy,
  ResearchPipelineMode,
  ResearchRiskProfile,
  ResearchTimeHorizon,
} from './researchStrategyPolicy';

describe('Research strategy policy display contract', () => {
  it('keeps the aggressive fallback at the backend 25% single-position ceiling', () => {
    const policy = buildFallbackResearchStrategyPolicy({
      riskProfile: 'high',
      timeHorizon: 'short',
      pipelineMode: 'ai',
      leverageEnabled: true,
    });

    expect(policy.maxSinglePositionPct).toBe(25);
    expect(policy.singlePct).toBe(25);
    expect(policy.maxGrossExposurePct).toBe(115);
    expect(policy.leverageEnabled).toBe(true);
    expect(policy.leveragedSleeveMaxPct).toBe(15);
    expect(policy.maxScaleIns).toBe(3);
    expect(policy.scaleInStepPct).toBe(50);
  });

  it('never allows any fallback context to display more than 25% per symbol', () => {
    const risks: ResearchRiskProfile[] = ['low', 'medium', 'high'];
    const horizons: ResearchTimeHorizon[] = ['short', 'mid', 'long'];
    const modes: ResearchPipelineMode[] = ['manual', 'hybrid', 'ai'];

    risks.forEach((riskProfile) => horizons.forEach((timeHorizon) => modes.forEach((pipelineMode) => {
      const policy = buildFallbackResearchStrategyPolicy({
        riskProfile,
        timeHorizon,
        pipelineMode,
        leverageEnabled: true,
      });
      expect(policy.maxSinglePositionPct).toBeLessThanOrEqual(25);
      expect(policy.optionsAllowed).toBe(false);
    })));
  });

  it('prefers a matching backend policy and applies top-level effective limits', () => {
    const policy = resolveResearchStrategyPolicy({
      riskProfile: 'medium',
      timeHorizon: 'mid',
      mode: 'hybrid',
      leverageEnabled: false,
      effectiveLimits: {
        maxSinglePositionPct: 11,
        riskPerTradePct: 0.8,
        dailyLossStopPct: 2,
      },
      strategyPolicy: {
        version: 'strategy_mandate_v9',
        riskProfile: 'medium',
        timeHorizon: 'mid',
        pipelineMode: 'hybrid',
        leverageRequested: false,
        maxSinglePositionPct: 15,
        riskPerTradePct: 1,
        dailyLossStopPct: 2.5,
        holdingPeriod: 'server holding period',
        selectionFocus: 'server-owned selection focus',
        factorWeights: { momentum: 0.2, trend: 0.3, relative: 0.2, liquidity: 0.1, risk: 0.2 },
      },
    }, {
      riskProfile: 'medium',
      timeHorizon: 'mid',
      pipelineMode: 'hybrid',
      leverageEnabled: false,
    });

    expect(policy.source).toBe('backend');
    expect(policy.contextMatched).toBe(true);
    expect(policy.version).toBe('strategy_mandate_v9');
    expect(policy.maxSinglePositionPct).toBe(11);
    expect(policy.riskPerTradePct).toBe(0.8);
    expect(policy.dailyLossStopPct).toBe(2);
    expect(policy.holdingPeriod).toBe('server holding period');
    expect(policy.selectionFocus).toBe('server-owned selection focus');
    expect(policy.factorWeights.trend).toBe(0.3);
  });

  it('uses the matching safe fallback while the backend snapshot has stale context', () => {
    const policy = resolveResearchStrategyPolicy({
      riskProfile: 'high',
      timeHorizon: 'short',
      mode: 'ai',
      leverageEnabled: true,
      strategyPolicy: {
        version: 'stale-policy',
        riskProfile: 'high',
        timeHorizon: 'short',
        pipelineMode: 'ai',
        leverageRequested: true,
        maxSinglePositionPct: 25,
      },
    }, {
      riskProfile: 'medium',
      timeHorizon: 'long',
      pipelineMode: 'manual',
      leverageEnabled: false,
    });

    expect(policy.source).toBe('fallback');
    expect(policy.riskProfile).toBe('medium');
    expect(policy.timeHorizon).toBe('long');
    expect(policy.maxSinglePositionPct).toBe(15);
    expect(policy.permissions.autoBuy).toBe(false);
  });

  it('clamps an unsafe or malformed backend display value to the backend hard ceiling', () => {
    const policy = resolveResearchStrategyPolicy({
      riskProfile: 'high',
      timeHorizon: 'short',
      mode: 'ai',
      leverageEnabled: false,
      effectiveLimits: { maxSinglePositionPct: 100 },
      strategyPolicy: {
        version: 'unsafe-test-policy',
        riskProfile: 'high',
        timeHorizon: 'short',
        pipelineMode: 'ai',
        leverageRequested: false,
        maxSinglePositionPct: 100,
        optionsAllowed: true,
      },
    }, {
      riskProfile: 'high',
      timeHorizon: 'short',
      pipelineMode: 'ai',
      leverageEnabled: false,
    });

    expect(policy.source).toBe('backend');
    expect(policy.maxSinglePositionPct).toBe(25);
    expect(policy.singlePct).toBe(25);
    expect(policy.optionsAllowed).toBe(false);
  });
});
