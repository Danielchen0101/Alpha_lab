import api from './api';

export type EquityAccountEvidence = {
  risk?: {
    complete?: boolean; entry_allowed?: boolean; as_of?: string | null; reasons?: string[];
    daily_pnl?: number | null; daily_loss_pct?: number | null;
    drawdown_pct?: number | null; drawdown_latched?: boolean;
  };
  accounting?: {
    account_net_operating_pnl?: number | null; external_cashflow?: number | null;
    gross_operating_pnl?: number | null; net_operating_profit?: number | null;
    costs_known?: boolean; strategy_attribution_known?: boolean;
  };
  twr_pct?: number | null; max_drawdown_pct?: number | null;
  accountingAsOf?: string | null; performanceSince?: string | null; performanceThrough?: string | null;
  coverage?: Record<string, unknown>; lastAttemptCoverage?: Record<string, unknown>;
};

export type EquityProgramStatus = {
  success?: boolean; error?: string; message?: string;
  active?: boolean; activeProtocolKey?: string | null; protocolKey?: string | null;
  strategyVersion?: string | null; dataVersion?: string | null;
  businessStatus?: string; blockers?: string[]; executionMode?: string;
  brokerOrdersAllowed?: boolean; policy?: Record<string, any>;
  protocol?: Record<string, any> | null; research?: Record<string, any> | null;
  shadow?: Record<string, any> | null;
  qualification?: Record<string, any> | null;
  researchAdmission?: { eligible?: boolean; historicalEligible?: boolean; status?: string; checks?: Record<string, any>; blockers?: string[]; closedTrades?: number | null; profitFactor?: number | null; bootstrapLowerDailyMean?: number | null };
  forward?: { tradingSessions?: number | null; completedTrades?: number | null; requiredSessions?: number; requiredTrades?: number };
  accountEvidence?: EquityAccountEvidence | null;
};

export const equityEvidenceAPI = {
  status: () => api.get<EquityProgramStatus>('/ai-agent/equity/status'),
  protocol: (strategy: 'breakout20' | 'pullback20') => api.post('/ai-agent/equity/protocol', { strategy }),
  runResearch: (protocolKey: string) => api.post('/ai-agent/equity/research/run', { protocolKey }),
  activate: (protocolKey: string) => api.post('/ai-agent/equity/activate', { protocolKey }),
  accountEvidence: (mode: 'paper' | 'real') => api.get('/ai-agent/equity/account-evidence', { params: { mode } }),
};

// A scheduling action must not overwrite a frozen program's execution policy.
export const equitySchedulePatch = (active: boolean, schedule: { enabled: boolean; intervalMinutes: number | null }, legacy: Record<string, any>) => (
  active ? { ...schedule } : { ...legacy, ...schedule }
);

export const evidenceNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
};

export const unwrapAccountEvidence = (body: any): EquityAccountEvidence | null => {
  if (body?.success === false) return null;
  const result = body?.accountEvidence ?? body?.evidence ?? body;
  return result && typeof result === 'object' && ('risk' in result || 'accounting' in result)
    ? { ...result, twr_pct: result.twr_pct ?? result.twrPct, max_drawdown_pct: result.max_drawdown_pct ?? result.maxDrawdownPct } : null;
};
