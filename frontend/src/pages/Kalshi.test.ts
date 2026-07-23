import { buildPresetConfig, positionSideLabel, resolveKalshiView, STRATEGY_PRESETS } from './Kalshi';
import { DEFAULT_KALSHI_BOT_CONFIG } from '../services/kalshiApi';

describe('Kalshi workspace routing', () => {
  it.each([
    ['/kalshi', 'desk'],
    ['/kalshi/markets/btc-15m', 'desk'],
    ['/kalshi/markets/rules', 'rules'],
    ['/kalshi/bots/btc-15m', 'bot'],
    ['/kalshi/bots/decisions', 'decisions'],
    ['/kalshi/bots/risk', 'risk'],
    ['/kalshi/portfolio/positions', 'positions'],
    ['/kalshi/portfolio/orders', 'orders'],
    ['/kalshi/settings/data', 'data'],
    ['/kalshi/settings/connection', 'connection'],
  ])('maps %s to the %s view', (pathname, expected) => {
    expect(resolveKalshiView(pathname)).toBe(expected);
  });

  it('defaults to the calibrated v3 favorite-carry configuration', () => {
    expect(DEFAULT_KALSHI_BOT_CONFIG.paperBankroll).toBe(1000);
    expect(DEFAULT_KALSHI_BOT_CONFIG.riskPerTradePct).toBeLessThanOrEqual(1.0);
    expect(DEFAULT_KALSHI_BOT_CONFIG.maxBookParticipation).toBeLessThanOrEqual(0.2);
    // Favorites only: never buy the longshot band that produced ~20% winners.
    expect(DEFAULT_KALSHI_BOT_CONFIG.minPrice).toBeGreaterThanOrEqual(0.5);
    expect(DEFAULT_KALSHI_BOT_CONFIG.maxPrice).toBeLessThanOrEqual(0.93);
    expect(DEFAULT_KALSHI_BOT_CONFIG.minModelProbability).toBeGreaterThanOrEqual(0.6);
    // Late-window entries where the distance signal is strongest.
    expect(DEFAULT_KALSHI_BOT_CONFIG.maxSecondsToClose).toBeLessThanOrEqual(360);
    expect(DEFAULT_KALSHI_BOT_CONFIG.probabilityLogitScale).toBeGreaterThanOrEqual(1.9);
  });

  it('offers fortress, baseline, adaptive, and active-sampling presets', () => {
    expect(STRATEGY_PRESETS.map((preset) => preset.id)).toEqual([
      'fortress',
      'favorite-carry',
      'adaptive-learning',
      'active-sampling',
    ]);
    expect(STRATEGY_PRESETS.filter((preset) => preset.recommended)).toHaveLength(2);
    const fortress = STRATEGY_PRESETS[0];
    const active = STRATEGY_PRESETS[3];
    expect(Number(fortress.config.minModelProbability)).toBeGreaterThan(
      Number(active.config.minModelProbability),
    );
  });

  it('keeps adaptive learning bounded and evidence-gated', () => {
    const adaptive = STRATEGY_PRESETS.find((preset) => preset.id === 'adaptive-learning');
    expect(adaptive?.config.learningMode).toBe(true);
    expect(adaptive?.config.learningAiMode).toBe(true);
    expect(adaptive?.config.learningReviewEvery).toBe(6);
    expect(adaptive?.config.learningWindowSize).toBe(40);
    expect(adaptive?.config.learningMaxRiskPct).toBeLessThanOrEqual(1.0);
    expect(adaptive?.config.learningExplorationRate).toBeGreaterThan(0);
  });

  it('applies a preset as a complete configuration while retaining the paper bankroll', () => {
    const adaptive = STRATEGY_PRESETS.find((preset) => preset.id === 'adaptive-learning');
    const baseline = STRATEGY_PRESETS.find((preset) => preset.id === 'favorite-carry');
    expect(adaptive).toBeDefined();
    expect(baseline).toBeDefined();

    const adaptiveConfig = buildPresetConfig(adaptive!, 4321);
    expect(adaptiveConfig.paperBankroll).toBe(4321);
    expect(adaptiveConfig.learningMode).toBe(true);
    expect(adaptiveConfig.minModelProbability).toBe(DEFAULT_KALSHI_BOT_CONFIG.minModelProbability);

    const baselineConfig = buildPresetConfig(baseline!, 4321);
    expect(baselineConfig.learningMode).toBe(false);
    expect(baselineConfig.paperBankroll).toBe(4321);
    expect(baselineConfig.minPrice).toBe(DEFAULT_KALSHI_BOT_CONFIG.minPrice);
  });

  it('does not present a flat position as a YES holding', () => {
    expect(positionSideLabel({ position_fp: 0 })).toBe('--');
    expect(positionSideLabel({ position_fp: 3 })).toBe('YES');
    expect(positionSideLabel({ position_fp: -2 })).toBe('NO');
    expect(positionSideLabel({ net_side: 'no', position_fp: 3 })).toBe('NO');
  });
});
