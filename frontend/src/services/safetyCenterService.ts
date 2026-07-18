import api, {
  ConfigStatusResponse,
  TradingAccountResponse,
  WorkspacePreferences,
  loadConfigStatus,
  tradingAccountAPI,
  workspacePreferencesAPI,
} from './api';

export type TradingMode = 'paper' | 'real';

export interface SafetyState {
  pauseNewEntries: boolean;
  cancelPendingEntryOrders: boolean;
  keepProtectiveExits: boolean;
  reason: string;
  pausedAt: string | null;
  updatedAt: string | null;
  version: number;
}

export interface SafetyCancellationResult {
  requested?: boolean;
  canceledOrderIds?: string[];
  skippedOrderIds?: string[];
  failed?: Array<{ orderId?: string; message?: string } | string>;
}

export interface SafetyMutationResult {
  success: boolean;
  state: SafetyState;
  cancellation?: SafetyCancellationResult;
  storage?: string;
}

export interface ReadinessCheck {
  key: string;
  label?: string;
  labelZh?: string;
  status?: 'ready' | 'attention' | 'blocked' | 'unknown' | boolean;
  ready?: boolean;
  blocking?: boolean;
  detail?: string;
  detailZh?: string;
  updatedAt?: string;
}

export interface ReadinessState {
  checks: ReadinessCheck[] | Record<string, ReadinessCheck | boolean | string>;
  completionPercent: number;
  blockingReasons: string[];
  updatedAt: string | null;
  version: number;
}

export interface OrderEvent {
  id?: string;
  orderId?: string;
  eventType?: string;
  status?: string;
  symbol?: string;
  side?: string;
  quantity?: number | string;
  brokerEventId?: string;
  createdAt?: string;
  occurredAt?: string;
  payload?: Record<string, any>;
}

export interface NotificationHistoryItem {
  id?: string;
  channel?: string;
  eventType?: string;
  status?: string;
  messageId?: string;
  createdAt?: string;
  deliveredAt?: string;
  error?: string;
  payload?: Record<string, any>;
}

export interface AuditEvent {
  id?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  outcome?: string;
  createdAt?: string;
  metadata?: Record<string, any>;
}

export interface SafetyCenterSnapshot {
  safety: SafetyState;
  readiness: ReadinessState;
  preferences: WorkspacePreferences | null;
  account: TradingAccountResponse | null;
  configuration: ConfigStatusResponse | null;
  orderEvents: OrderEvent[];
  notifications: NotificationHistoryItem[];
  loadedAt: string;
}

const defaultSafetyState = (): SafetyState => ({
  pauseNewEntries: false,
  cancelPendingEntryOrders: false,
  keepProtectiveExits: true,
  reason: '',
  pausedAt: null,
  updatedAt: null,
  version: 0,
});

const defaultReadinessState = (): ReadinessState => ({
  checks: [],
  completionPercent: 0,
  blockingReasons: [],
  updatedAt: null,
  version: 0,
});

const readCollection = <T>(payload: any, keys: string[]): T[] => {
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key] as T[];
  }
  if (Array.isArray(payload)) return payload as T[];
  return [];
};

export const normalizeReadinessChecks = (
  checks: ReadinessState['checks'],
): ReadinessCheck[] => {
  if (Array.isArray(checks)) {
    return checks.map((check, index) => ({ ...check, key: check.key || `check-${index}` }));
  }
  if (!checks || typeof checks !== 'object') return [];
  return Object.entries(checks).map(([key, raw]) => {
    if (typeof raw === 'boolean') return { key, ready: raw, status: raw ? 'ready' : 'blocked' };
    if (typeof raw === 'string') return { key, detail: raw, status: 'unknown' };
    return { ...(raw || {}), key };
  });
};

export const safetyCenterAPI = {
  getSafety: async (): Promise<SafetyMutationResult> => {
    const response = await api.get('/operations/safety');
    return {
      success: Boolean(response.data?.success),
      state: { ...defaultSafetyState(), ...(response.data?.state || {}) },
      storage: response.data?.storage,
    };
  },

  updateSafety: async (data: {
    pauseNewEntries: boolean;
    cancelPendingEntryOrders?: boolean;
    reason?: string;
    mode?: TradingMode;
    expectedVersion?: number;
    idempotencyKey?: string;
  }): Promise<SafetyMutationResult> => {
    const response = await api.patch('/operations/safety', data);
    return {
      success: Boolean(response.data?.success),
      state: { ...defaultSafetyState(), ...(response.data?.state || {}) },
      cancellation: response.data?.cancellation,
      storage: response.data?.storage,
    };
  },

  cancelPendingEntries: async (mode: TradingMode): Promise<SafetyMutationResult> => {
    const response = await api.post('/operations/safety/cancel-pending-entries', {
      mode,
      idempotencyKey: `safety-cancel-${mode}-${Date.now()}`,
    });
    return {
      success: Boolean(response.data?.success),
      state: { ...defaultSafetyState(), ...(response.data?.state || {}) },
      cancellation: response.data?.cancellation,
      storage: response.data?.storage,
    };
  },

  getReadiness: async (): Promise<ReadinessState> => {
    const response = await api.get('/operations/readiness');
    return { ...defaultReadinessState(), ...(response.data?.readiness || {}) };
  },

  getOrderEvents: async (limit = 25): Promise<OrderEvent[]> => {
    const response = await api.get('/operations/orders/events', { params: { limit } });
    return readCollection<OrderEvent>(response.data, ['events', 'orderEvents', 'items', 'records']);
  },

  getNotificationHistory: async (limit = 25): Promise<NotificationHistoryItem[]> => {
    const response = await api.get('/operations/notifications/history', { params: { limit } });
    return readCollection<NotificationHistoryItem>(response.data, ['deliveries', 'notifications', 'history', 'items', 'records']);
  },

  getAuditEvents: async (limit = 250): Promise<AuditEvent[]> => {
    const response = await api.get('/operations/audit', { params: { limit } });
    return readCollection<AuditEvent>(response.data, ['events', 'auditEvents', 'items', 'records']);
  },

  getSnapshot: async (mode: TradingMode): Promise<SafetyCenterSnapshot> => {
    const results = await Promise.allSettled([
      safetyCenterAPI.getSafety(),
      safetyCenterAPI.getReadiness(),
      workspacePreferencesAPI.get(),
      tradingAccountAPI.getAccount(mode),
      loadConfigStatus({ force: true, timeoutMs: 10000 }),
      safetyCenterAPI.getOrderEvents(),
      safetyCenterAPI.getNotificationHistory(),
    ] as const);

    const safety = results[0].status === 'fulfilled' ? results[0].value.state : defaultSafetyState();
    const readiness = results[1].status === 'fulfilled' ? results[1].value : defaultReadinessState();
    const preferences = results[2].status === 'fulfilled'
      ? results[2].value.data?.preferences || null
      : null;
    const account = results[3].status === 'fulfilled' ? results[3].value.data || null : null;
    const configuration = results[4].status === 'fulfilled' && results[4].value.ok
      ? results[4].value.data || null
      : null;
    const orderEvents = results[5].status === 'fulfilled' ? results[5].value : [];
    const notifications = results[6].status === 'fulfilled' ? results[6].value : [];

    if (results[0].status === 'rejected') throw results[0].reason;

    return {
      safety,
      readiness,
      preferences,
      account,
      configuration,
      orderEvents,
      notifications,
      loadedAt: new Date().toISOString(),
    };
  },
};
