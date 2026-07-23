import { buildPresetConfig, resolveKalshiView, STRATEGY_PRESETS } from './Kalshi';
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

  it('starts with bounded paper risk instead of an unconstrained stake', () => {
    expect(DEFAULT_KALSHI_BOT_CONFIG.paperBankroll).toBe(1000);
    expect(DEFAULT_KALSHI_BOT_CONFIG.riskPerTradePct).toBeLessThanOrEqual(0.5);
    expect(DEFAULT_KALSHI_BOT_CONFIG.maxBookParticipation).toBeLessThanOrEqual(0.2);
    expect(DEFAULT_KALSHI_BOT_CONFIG.minNetEdge).toBeGreaterThanOrEqual(0.04);
  });

  it('offers distinct low, balanced, active, adaptive, and stress presets', () => {
    expect(STRATEGY_PRESETS.map((preset) => preset.id)).toEqual([
      'capital-guard',
      'balanced',
      'active-sampling',
      'adaptive-learning',
      'stress-test',
    ]);
    expect(STRATEGY_PRESETS.filter((preset) => preset.recommended)).toHaveLength(2);
    expect(STRATEGY_PRESETS[0].config.riskPerTradePct).toBeLessThan(
      Number(STRATEGY_PRESETS[4].config.riskPerTradePct),
    );
  });

  it('keeps adaptive learning bounded to a paper-sized risk envelope', () => {
    const adaptive = STRATEGY_PRESETS.find((preset) => preset.id === 'adaptive-learning');
    expect(adaptive?.config.learningMode).toBe(true);
    expect(adaptive?.config.learningReviewEvery).toBe(4);
    expect(adaptive?.config.learningAiMode).toBe(true);
    expect(adaptive?.config.learningWindowSize).toBe(24);
    expect(adaptive?.config.learningMaxRiskPct).toBeLessThanOrEqual(0.5);
    expect(adaptive?.config.learningExplorationRate).toBeGreaterThan(0);
  });

  it('applies a preset as a complete configuration while retaining the paper bankroll', () => {
    const adaptive = STRATEGY_PRESETS.find((preset) => preset.id === 'adaptive-learning');
    const balanced = STRATEGY_PRESETS.find((preset) => preset.id === 'balanced');
    expect(adaptive).toBeDefined();
    expect(balanced).toBeDefined();

    const adaptiveConfig = buildPresetConfig(adaptive!, 4321);
    expect(adaptiveConfig.paperBankroll).toBe(4321);
    expect(adaptiveConfig.learningMode).toBe(true);
    expect(adaptiveConfig.marketBlendWeight).toBeDefined();

    const balancedConfig = buildPresetConfig(balanced!, 4321);
    expect(balancedConfig.learningMode).toBe(false);
    expect(balancedConfig.paperBankroll).toBe(4321);
  });
});
