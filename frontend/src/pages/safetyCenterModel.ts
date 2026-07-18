import type { WorkspacePreferences } from '../services/api';
import type { ReadinessCheck, SafetyState } from '../services/safetyCenterService';

export interface SafetySemantics {
  entriesAllowed: boolean;
  protectionsGuaranteed: boolean;
  canResume: boolean;
  canPause: boolean;
  tone: 'ready' | 'paused' | 'critical';
}

export const deriveSafetySemantics = (state: SafetyState): SafetySemantics => {
  const entriesAllowed = !state.pauseNewEntries;
  const protectionsGuaranteed = state.keepProtectiveExits !== false;
  return {
    entriesAllowed,
    protectionsGuaranteed,
    canResume: state.pauseNewEntries && protectionsGuaranteed,
    canPause: !state.pauseNewEntries,
    tone: protectionsGuaranteed ? (entriesAllowed ? 'ready' : 'paused') : 'critical',
  };
};

export const readinessCheckIsReady = (check: ReadinessCheck): boolean => {
  if (typeof check.ready === 'boolean') return check.ready;
  if (typeof check.status === 'boolean') return check.status;
  return check.status === 'ready';
};

export interface EffectiveLimit {
  key: string;
  value: string;
  source: string;
}

const numberText = (value: unknown, suffix = ''): string => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '—';
  return `${parsed.toLocaleString('en-US', { maximumFractionDigits: 2 })}${suffix}`;
};

export const buildEffectiveLimits = (preferences: Partial<WorkspacePreferences> | null): EffectiveLimit[] => {
  const policy = preferences?.strategyPolicy && typeof preferences.strategyPolicy === 'object'
    ? preferences.strategyPolicy
    : {};
  const source = String(policy.version || 'strategy mandate');
  return [
    { key: 'dailyLoss', value: numberText(policy.dailyLossStopPct, '%'), source },
    { key: 'perTrade', value: numberText(policy.riskPerTradePct, '%'), source },
    { key: 'singlePosition', value: numberText(policy.maxSinglePositionPct, '%'), source },
    { key: 'grossExposure', value: numberText(policy.maxGrossExposurePct, '%'), source },
    { key: 'sectorExposure', value: numberText(policy.sectorCapPct, '%'), source },
    { key: 'openBuys', value: numberText(policy.maxOpenBuys), source },
    { key: 'positions', value: numberText(policy.maxPositions), source },
    { key: 'slippage', value: numberText(policy.slippageCapBps, ' bps'), source },
  ];
};
