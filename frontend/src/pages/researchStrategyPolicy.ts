export type ResearchRiskProfile = 'low' | 'medium' | 'high';
export type ResearchTimeHorizon = 'short' | 'mid' | 'long';
export type ResearchPipelineMode = 'manual' | 'hybrid' | 'ai';

export interface ResearchStrategyContext {
  riskProfile: ResearchRiskProfile;
  timeHorizon: ResearchTimeHorizon;
  pipelineMode: ResearchPipelineMode;
  leverageEnabled: boolean;
}

export interface ResearchStrategyPermissions {
  aiResearch: boolean;
  aiChallenge: boolean;
  aiSelects: boolean;
  autoBuy: boolean;
  autoScaleIn: boolean;
  autoReduce: boolean;
  autoSell: boolean;
  autoClose: boolean;
  userApprovalRequired: boolean;
  label: string;
}

export interface ResearchStrategyDisplayPolicy {
  source: 'backend' | 'fallback';
  contextMatched: boolean;
  version: string;
  riskProfile: ResearchRiskProfile;
  timeHorizon: ResearchTimeHorizon;
  pipelineMode: ResearchPipelineMode;
  targetDeploymentPct: number;
  maxGrossExposurePct: number;
  maxSinglePositionPct: number;
  riskPerTradePct: number;
  dailyLossStopPct: number;
  maxOpenBuys: number;
  maxPositions: number;
  sectorCapPct: number;
  maxDailyFilledOrders: number;
  holdingPeriod: string;
  selectionFocus: string;
  reviewAfterDays: number;
  timeStopDays: number;
  maxStopPct: number;
  targetR1: number;
  targetR2: number;
  minimumR: number;
  slippageCapBps: number;
  participationCapPct: number;
  factorWeights: Record<string, number>;
  permissions: ResearchStrategyPermissions;
  scaleInAllowed: boolean;
  scaleInRequiresWinner: boolean;
  scaleInMinProfitPct: number;
  maxScaleIns: number;
  scaleInStepPct: number;
  leverageRequested: boolean;
  leverageEligible: boolean;
  leverageEnabled: boolean;
  leveragedSleeveMaxPct: number;
  leveragedProductPolicy: string;
  optionsAllowed: false;
  hardRiskGatesFinal: boolean;
  effectiveLimits: Record<string, number>;

  // Stable display aliases retained while the larger Agent page is decomposed.
  deploymentPct: number;
  grossPct: number;
  singlePct: number;
  dailyStopPct: number;
  positions: number;
  holding: string;
  focus: string;
  targetR: number;
  research: boolean;
  selection: boolean;
  buy: boolean;
  scaleIn: boolean;
  reduce: boolean;
  sell: boolean;
  approval: boolean;
  leverageActive: boolean;
}

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {}
);

const finiteNumber = (value: unknown, fallback: number): number => {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const nonNegative = (value: unknown, fallback: number): number => Math.max(0, finiteNumber(value, fallback));
const bounded = (value: unknown, fallback: number, maximum: number): number => (
  Math.min(maximum, nonNegative(value, fallback))
);

const booleanValue = (value: unknown, fallback: boolean): boolean => (
  typeof value === 'boolean' ? value : fallback
);

const stringValue = (value: unknown, fallback: string): string => (
  typeof value === 'string' && value.trim() ? value.trim() : fallback
);

const RISK_POLICY = {
  low: {
    targetDeploymentPct: 30,
    maxGrossExposurePct: 35,
    maxSinglePositionPct: 8,
    riskPerTradePct: 0.5,
    dailyLossStopPct: 1.5,
    maxOpenBuys: 2,
    maxPositions: 8,
    sectorCapPct: 20,
    maxScaleIns: 1,
    scaleInStepPct: 25,
    maxDailyFilledOrders: 6,
  },
  medium: {
    targetDeploymentPct: 50,
    maxGrossExposurePct: 60,
    maxSinglePositionPct: 15,
    riskPerTradePct: 1,
    dailyLossStopPct: 2.5,
    maxOpenBuys: 5,
    maxPositions: 10,
    sectorCapPct: 30,
    maxScaleIns: 2,
    scaleInStepPct: 35,
    maxDailyFilledOrders: 12,
  },
  high: {
    targetDeploymentPct: 100,
    maxGrossExposurePct: 100,
    // This is also the absolute platform ceiling. Never display the former 100% value.
    maxSinglePositionPct: 25,
    riskPerTradePct: 1.5,
    dailyLossStopPct: 4,
    maxOpenBuys: 7,
    maxPositions: 12,
    sectorCapPct: 40,
    maxScaleIns: 3,
    scaleInStepPct: 50,
    maxDailyFilledOrders: 20,
  },
} as const;

const HORIZON_POLICY = {
  short: {
    holdingPeriod: '1-5 trading days',
    selectionFocus: 'Recent momentum, volume expansion, catalysts and liquidity',
    timeStopDays: 5,
    reviewAfterDays: 3,
    targetR1: 1.5,
    targetR2: 2.25,
    minimumR: 1.25,
    maxStopPct: 5,
    slippageCapBps: 12,
    participationCapPct: 3,
    factorWeights: { momentum: 0.35, trend: 0.1, relative: 0.2, liquidity: 0.25, risk: 0.1 },
  },
  mid: {
    holdingPeriod: '2-8 weeks',
    selectionFocus: 'Balanced momentum, trend persistence, relative strength and stability',
    timeStopDays: 40,
    reviewAfterDays: 20,
    targetR1: 1.8,
    targetR2: 2.8,
    minimumR: 1.5,
    maxStopPct: 9,
    slippageCapBps: 18,
    participationCapPct: 5,
    factorWeights: { momentum: 0.25, trend: 0.25, relative: 0.2, liquidity: 0.15, risk: 0.15 },
  },
  long: {
    holdingPeriod: '3-12 months',
    selectionFocus: 'Long trend, quality, durable relative strength and drawdown resilience',
    timeStopDays: 180,
    reviewAfterDays: 60,
    targetR1: 2.2,
    targetR2: 3.5,
    minimumR: 1.75,
    maxStopPct: 15,
    slippageCapBps: 25,
    participationCapPct: 8,
    factorWeights: { momentum: 0.1, trend: 0.35, relative: 0.2, liquidity: 0.1, risk: 0.25 },
  },
} as const;

const MODE_PERMISSIONS: Record<ResearchPipelineMode, ResearchStrategyPermissions> = {
  manual: {
    aiResearch: false,
    aiChallenge: false,
    aiSelects: false,
    autoBuy: false,
    autoScaleIn: false,
    autoReduce: false,
    autoSell: false,
    autoClose: false,
    userApprovalRequired: true,
    label: 'Manual Control',
  },
  hybrid: {
    aiResearch: true,
    aiChallenge: true,
    aiSelects: false,
    autoBuy: false,
    autoScaleIn: false,
    autoReduce: false,
    autoSell: false,
    autoClose: false,
    userApprovalRequired: true,
    label: 'AI Review',
  },
  ai: {
    aiResearch: true,
    aiChallenge: true,
    aiSelects: true,
    autoBuy: true,
    autoScaleIn: true,
    autoReduce: true,
    autoSell: true,
    autoClose: true,
    userApprovalRequired: false,
    label: 'Full AI',
  },
};

const fallbackFactorWeights = (
  riskProfile: ResearchRiskProfile,
  timeHorizon: ResearchTimeHorizon,
): Record<string, number> => {
  const weights = { ...HORIZON_POLICY[timeHorizon].factorWeights } as Record<string, number>;
  if (riskProfile === 'low') {
    weights.risk += 0.08;
    weights.momentum = Math.max(0.05, weights.momentum - 0.05);
    weights.trend = Math.max(0.05, weights.trend - 0.03);
  } else if (riskProfile === 'high') {
    weights.risk = Math.max(0.05, weights.risk - 0.05);
    weights.momentum += 0.03;
    weights.trend += 0.02;
  }
  const total = Object.keys(weights).reduce((sum, key) => sum + weights[key], 0) || 1;
  return Object.keys(weights).reduce<Record<string, number>>((normalized, key) => {
    normalized[key] = Number((weights[key] / total).toFixed(4));
    return normalized;
  }, {});
};

const scaleInMinimumProfit = (
  riskProfile: ResearchRiskProfile,
  timeHorizon: ResearchTimeHorizon,
): number => ({
  low: { short: 1.5, mid: 2, long: 3 },
  medium: { short: 1, mid: 1.5, long: 2 },
  high: { short: 0.5, mid: 0.75, long: 1 },
}[riskProfile][timeHorizon]);

const makeAliases = (
  policy: Omit<ResearchStrategyDisplayPolicy,
  'deploymentPct' | 'grossPct' | 'singlePct' | 'dailyStopPct' | 'positions' | 'holding' | 'focus'
  | 'targetR' | 'research' | 'selection' | 'buy' | 'scaleIn' | 'reduce' | 'sell' | 'approval'
  | 'leverageActive'>,
): ResearchStrategyDisplayPolicy => ({
  ...policy,
  deploymentPct: policy.targetDeploymentPct,
  grossPct: policy.maxGrossExposurePct,
  singlePct: policy.maxSinglePositionPct,
  dailyStopPct: policy.dailyLossStopPct,
  positions: policy.maxPositions,
  holding: policy.holdingPeriod,
  focus: policy.selectionFocus,
  targetR: policy.targetR1,
  research: policy.permissions.aiResearch,
  selection: policy.permissions.aiSelects,
  buy: policy.permissions.autoBuy,
  scaleIn: policy.permissions.autoScaleIn,
  reduce: policy.permissions.autoReduce,
  sell: policy.permissions.autoSell || policy.permissions.autoClose,
  approval: policy.permissions.userApprovalRequired,
  leverageActive: policy.leverageEnabled,
});

export const buildFallbackResearchStrategyPolicy = (
  context: ResearchStrategyContext,
): ResearchStrategyDisplayPolicy => {
  const risk = RISK_POLICY[context.riskProfile];
  const horizon = HORIZON_POLICY[context.timeHorizon];
  const leverageEligible = context.riskProfile === 'high' && context.timeHorizon === 'short';
  const leverageActive = context.leverageEnabled && leverageEligible;
  const maxGrossExposurePct = leverageActive ? 115 : risk.maxGrossExposurePct;
  const permissions = { ...MODE_PERMISSIONS[context.pipelineMode] };
  const effectiveLimits = {
    maxSinglePositionPct: risk.maxSinglePositionPct,
    sectorCapPct: risk.sectorCapPct,
    riskPerTradePct: risk.riskPerTradePct,
    dailyLossStopPct: risk.dailyLossStopPct,
    maxDailyFilledOrders: risk.maxDailyFilledOrders,
  };

  return makeAliases({
    source: 'fallback',
    contextMatched: false,
    version: 'strategy_mandate_v2_fallback',
    ...context,
    targetDeploymentPct: risk.targetDeploymentPct,
    maxGrossExposurePct,
    maxSinglePositionPct: risk.maxSinglePositionPct,
    riskPerTradePct: risk.riskPerTradePct,
    dailyLossStopPct: risk.dailyLossStopPct,
    maxOpenBuys: risk.maxOpenBuys,
    maxPositions: risk.maxPositions,
    sectorCapPct: risk.sectorCapPct,
    maxDailyFilledOrders: risk.maxDailyFilledOrders,
    holdingPeriod: horizon.holdingPeriod,
    selectionFocus: horizon.selectionFocus,
    reviewAfterDays: horizon.reviewAfterDays,
    timeStopDays: horizon.timeStopDays,
    maxStopPct: horizon.maxStopPct,
    targetR1: horizon.targetR1,
    targetR2: horizon.targetR2,
    minimumR: horizon.minimumR,
    slippageCapBps: horizon.slippageCapBps,
    participationCapPct: horizon.participationCapPct,
    factorWeights: fallbackFactorWeights(context.riskProfile, context.timeHorizon),
    permissions,
    scaleInAllowed: true,
    scaleInRequiresWinner: true,
    scaleInMinProfitPct: scaleInMinimumProfit(context.riskProfile, context.timeHorizon),
    maxScaleIns: risk.maxScaleIns,
    scaleInStepPct: risk.scaleInStepPct,
    leverageRequested: context.leverageEnabled,
    leverageEligible,
    leverageEnabled: leverageActive,
    leveragedSleeveMaxPct: leverageActive ? 15 : 0,
    leveragedProductPolicy: 'long-only leveraged equity ETPs; no inverse products',
    optionsAllowed: false,
    hardRiskGatesFinal: true,
    effectiveLimits,
  });
};

const policyContextMatches = (
  status: UnknownRecord,
  policy: UnknownRecord,
  context: ResearchStrategyContext,
): boolean => {
  const riskProfile = stringValue(policy.riskProfile, stringValue(status.riskProfile, ''));
  const timeHorizon = stringValue(policy.timeHorizon, stringValue(status.timeHorizon, ''));
  const pipelineMode = stringValue(policy.pipelineMode, stringValue(status.mode, ''));
  const leverageRequested = typeof policy.leverageRequested === 'boolean'
    ? policy.leverageRequested
    : status.leverageEnabled;
  return riskProfile === context.riskProfile
    && timeHorizon === context.timeHorizon
    && pipelineMode === context.pipelineMode
    && leverageRequested === context.leverageEnabled;
};

const readFactorWeights = (
  value: unknown,
  fallback: Record<string, number>,
): Record<string, number> => {
  const record = asRecord(value);
  const parsed = Object.keys(record).reduce<Record<string, number>>((weights, key) => {
    const weight = finiteNumber(record[key], -1);
    if (weight >= 0) weights[key] = weight;
    return weights;
  }, {});
  return Object.keys(parsed).length ? parsed : fallback;
};

/**
 * Resolve the policy shown by Research. A matching backend status is authoritative.
 * During initial loading or while a preference update is waiting for a matching
 * status snapshot, a contract-compatible safe fallback is used instead.
 */
export const resolveResearchStrategyPolicy = (
  pipelineAutoStatus: unknown,
  context: ResearchStrategyContext,
): ResearchStrategyDisplayPolicy => {
  const fallback = buildFallbackResearchStrategyPolicy(context);
  const status = asRecord(pipelineAutoStatus);
  const rawPolicy = asRecord(status.strategyPolicy);
  if (!Object.keys(rawPolicy).length || !policyContextMatches(status, rawPolicy, context)) return fallback;

  const nestedLimits = asRecord(rawPolicy.effectiveLimits);
  const statusLimits = asRecord(status.effectiveLimits);
  const effective = { ...nestedLimits, ...statusLimits };
  const rawPermissions = asRecord(rawPolicy.permissions);
  const permissionsFallback = fallback.permissions;
  const permissions: ResearchStrategyPermissions = {
    aiResearch: booleanValue(rawPermissions.aiResearch, permissionsFallback.aiResearch),
    aiChallenge: booleanValue(rawPermissions.aiChallenge, permissionsFallback.aiChallenge),
    aiSelects: booleanValue(rawPermissions.aiSelects, permissionsFallback.aiSelects),
    autoBuy: booleanValue(rawPermissions.autoBuy, permissionsFallback.autoBuy),
    autoScaleIn: booleanValue(rawPermissions.autoScaleIn, permissionsFallback.autoScaleIn),
    autoReduce: booleanValue(rawPermissions.autoReduce, permissionsFallback.autoReduce),
    autoSell: booleanValue(rawPermissions.autoSell, permissionsFallback.autoSell),
    autoClose: booleanValue(rawPermissions.autoClose, permissionsFallback.autoClose),
    userApprovalRequired: booleanValue(rawPermissions.userApprovalRequired, permissionsFallback.userApprovalRequired),
    label: stringValue(rawPermissions.label, permissionsFallback.label),
  };
  const leverageEligible = context.riskProfile === 'high' && context.timeHorizon === 'short';
  const leverageActive = leverageEligible && context.leverageEnabled
    && booleanValue(rawPolicy.leverageEnabled, fallback.leverageEnabled);

  const maxSinglePositionPct = bounded(
    effective.maxSinglePositionPct ?? rawPolicy.maxSinglePositionPct,
    fallback.maxSinglePositionPct,
    fallback.maxSinglePositionPct,
  );
  const sectorCapPct = bounded(
    effective.sectorCapPct ?? rawPolicy.sectorCapPct,
    fallback.sectorCapPct,
    fallback.sectorCapPct,
  );
  const riskPerTradePct = bounded(
    effective.riskPerTradePct ?? rawPolicy.riskPerTradePct,
    fallback.riskPerTradePct,
    fallback.riskPerTradePct,
  );
  const dailyLossStopPct = bounded(
    effective.dailyLossStopPct ?? rawPolicy.dailyLossStopPct,
    fallback.dailyLossStopPct,
    fallback.dailyLossStopPct,
  );
  const maxDailyFilledOrders = bounded(
    effective.maxDailyFilledOrders ?? rawPolicy.maxDailyFilledOrders,
    fallback.maxDailyFilledOrders,
    fallback.maxDailyFilledOrders,
  );

  return makeAliases({
    source: 'backend',
    contextMatched: true,
    version: stringValue(rawPolicy.version, 'backend-policy'),
    ...context,
    targetDeploymentPct: bounded(rawPolicy.targetDeploymentPct, fallback.targetDeploymentPct, fallback.targetDeploymentPct),
    maxGrossExposurePct: bounded(rawPolicy.maxGrossExposurePct, fallback.maxGrossExposurePct, fallback.maxGrossExposurePct),
    maxSinglePositionPct,
    riskPerTradePct,
    dailyLossStopPct,
    maxOpenBuys: bounded(rawPolicy.maxOpenBuys, fallback.maxOpenBuys, fallback.maxOpenBuys),
    maxPositions: bounded(rawPolicy.maxPositions, fallback.maxPositions, fallback.maxPositions),
    sectorCapPct,
    maxDailyFilledOrders,
    holdingPeriod: stringValue(rawPolicy.holdingPeriod, fallback.holdingPeriod),
    selectionFocus: stringValue(rawPolicy.selectionFocus, fallback.selectionFocus),
    reviewAfterDays: nonNegative(rawPolicy.reviewAfterDays, fallback.reviewAfterDays),
    timeStopDays: nonNegative(rawPolicy.timeStopDays, fallback.timeStopDays),
    maxStopPct: bounded(rawPolicy.maxStopPct, fallback.maxStopPct, fallback.maxStopPct),
    targetR1: nonNegative(rawPolicy.targetR1, fallback.targetR1),
    targetR2: nonNegative(rawPolicy.targetR2, fallback.targetR2),
    minimumR: nonNegative(rawPolicy.minimumR, fallback.minimumR),
    slippageCapBps: nonNegative(rawPolicy.slippageCapBps, fallback.slippageCapBps),
    participationCapPct: nonNegative(rawPolicy.participationCapPct, fallback.participationCapPct),
    factorWeights: readFactorWeights(rawPolicy.factorWeights, fallback.factorWeights),
    permissions,
    scaleInAllowed: booleanValue(rawPolicy.scaleInAllowed, fallback.scaleInAllowed),
    scaleInRequiresWinner: booleanValue(rawPolicy.scaleInRequiresWinner, fallback.scaleInRequiresWinner),
    scaleInMinProfitPct: nonNegative(rawPolicy.scaleInMinProfitPct, fallback.scaleInMinProfitPct),
    maxScaleIns: bounded(rawPolicy.maxScaleIns, fallback.maxScaleIns, fallback.maxScaleIns),
    scaleInStepPct: bounded(rawPolicy.scaleInStepPct, fallback.scaleInStepPct, fallback.scaleInStepPct),
    leverageRequested: context.leverageEnabled,
    leverageEligible,
    leverageEnabled: leverageActive,
    leveragedSleeveMaxPct: leverageActive
      ? bounded(rawPolicy.leveragedSleeveMaxPct, fallback.leveragedSleeveMaxPct, 15)
      : 0,
    leveragedProductPolicy: stringValue(rawPolicy.leveragedProductPolicy, fallback.leveragedProductPolicy),
    optionsAllowed: false,
    hardRiskGatesFinal: booleanValue(rawPolicy.hardRiskGatesFinal, true),
    effectiveLimits: {
      maxSinglePositionPct,
      sectorCapPct,
      riskPerTradePct,
      dailyLossStopPct,
      maxDailyFilledOrders,
    },
  });
};
