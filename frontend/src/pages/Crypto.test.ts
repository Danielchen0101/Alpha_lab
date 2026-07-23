import {
  cryptoViewFromPath,
  cryptoSymbolFromSearch,
  hasUsableCryptoConfigResponse,
  ledgerRecordMatchesFilter,
  localizeConstraintField,
  localizeCryptoEnum,
  localizeServiceMessage,
  normalizeConfig,
  normalizeBacktest,
  normalizeLedger,
  normalizeLedgerMetadata,
  normalizeOverview,
  normalizeRuntime,
} from './Crypto';
import { sanitizeCryptoConfigUpdate } from '../services/cryptoApi';

describe('Crypto page data contracts', () => {
  it('normalizes fractional target weights for percentage display and fails admission closed', () => {
    const overview = normalizeOverview({
      data: {
        mode: 'paper',
        decision: { symbol: 'BTC/USD', action: 'BUY', targetWeight: 0.12 },
      },
    }, 'paper');

    expect(overview.decision?.targetWeight).toBe(12);
    expect(overview.admission.admitted).toBe(false);

    const admitted = normalizeOverview({ data: { liveAdmission: { admitted: true, reason: 'release gate approved' } } }, 'live');
    expect(admitted.admission).toMatchObject({ admitted: true, status: 'admitted' });
  });

  it('preserves the persisted mode and recognizes the short-term 15 minute cadence', () => {
    expect(normalizeConfig({ data: { config: { mode: 'live', intervalMinutes: 15 } } })).toMatchObject({
      mode: 'live',
      tradeHorizon: 'short',
      intervalMinutes: 15,
    });
    expect(normalizeConfig({ data: { config: { mode: 'paper', intervalMinutes: 120 } } }).intervalMinutes).toBe(120);
  });

  it('classifies nested orders and operator actions using the ledger payload and actor', () => {
    const records = normalizeLedger({
      data: {
        records: [
          {
            eventType: 'crypto_decision',
            actor: 'system',
            payload: {
              action: 'BUY',
              status: 'blocked_by_risk',
              order: { symbol: 'BTC/USD', side: 'buy', quantity: 0.05, limitPrice: 62000 },
            },
          },
          { eventType: 'crypto_config_updated', actor: 'user', payload: { mode: 'paper' } },
        ],
      },
    });

    expect(records[0]).toMatchObject({ symbol: 'BTC/USD', action: 'BUY', quantity: 0.05, price: 62000 });
    expect(ledgerRecordMatchesFilter(records[0], 'decision')).toBe(true);
    expect(ledgerRecordMatchesFilter(records[0], 'order')).toBe(true);
    expect(ledgerRecordMatchesFilter(records[0], 'risk')).toBe(true);
    expect(ledgerRecordMatchesFilter(records[1], 'operator')).toBe(true);
    expect(normalizeLedgerMetadata({
      data: { records: [], scanTruncated: true, scannedRows: 1000, scannedPages: 10 },
    })).toEqual({ scanTruncated: true, scannedRows: 1000, scannedPages: 10 });
  });

  it('accepts only supported crypto symbols from the shell query string', () => {
    expect(cryptoSymbolFromSearch('?symbol=BTC%2FUSD')).toBe('BTC/USD');
    expect(cryptoSymbolFromSearch('?symbol=eth-usd')).toBe('ETH/USD');
    expect(cryptoSymbolFromSearch('?symbol=SOL%2FUSD')).toBeNull();
  });

  it('keeps broker failures unknown instead of manufacturing zero balances or positive movement', () => {
    const overview = normalizeOverview({
      data: {
        accountError: 'credentials unavailable',
        account: { configured: false, eligible: null },
        portfolio: { equity: 0, cryptoEquity: 0, exposurePct: 0, dayPnl: 0 },
        assets: [{ symbol: 'BTC/USD', price: null, change24h: null, tradable: true, dataAvailable: false, reasons: ['snapshot_unavailable'] }],
      },
    }, 'paper');

    expect(overview.accountConfigured).toBe(false);
    expect(overview.accountError).toBe('credentials unavailable');
    expect(overview.portfolio).toMatchObject({ equity: null, cryptoEquity: null, exposurePct: null, dayPnl: null });
    expect(overview.assets[0]).toMatchObject({
      price: null,
      change24h: null,
      signal: '',
      regime: '',
      dataAvailable: false,
      tradable: false,
      reasons: ['snapshot_unavailable'],
    });
  });

  it('requires explicit market-data availability even when a payload contains a positive price', () => {
    const overview = normalizeOverview({
      data: {
        assets: [{ symbol: 'BTC/USD', price: 64000, tradable: true }],
      },
    }, 'paper');

    expect(overview.assets[0]).toMatchObject({
      price: null,
      dataAvailable: false,
      tradable: false,
    });
  });

  it('fails config validation closed and leaves absent runtime fields explicitly unknown', () => {
    expect(hasUsableCryptoConfigResponse({ data: { success: true, config: { mode: 'paper' } } })).toBe(false);
    expect(hasUsableCryptoConfigResponse({
      data: {
        config: {
          mode: 'paper', symbols: ['BTC/USD'], intervalMinutes: 60, riskProfile: 'balanced',
          minimumConfidence: 60, maxAssetExposurePct: 12, maxTotalExposure: 0.2, riskPerTradePct: 0.35,
        },
      },
    })).toBe(true);
    expect(normalizeRuntime({ data: { runtime: {} } })).toMatchObject({
      status: '', currentStage: '', progress: null, cooldownUntil: null, manualReviewRequired: false, schedulerHealthy: null,
    });
  });

  it('normalizes top-level runtime progress and scheduler health while retaining nested progress compatibility', () => {
    expect(normalizeRuntime({
      data: {
        runtime: { status: 'running', progress: { stage: 'route', completedSymbols: 1, totalSymbols: 2 } },
        progress: 72,
        currentStage: 'risk_gate',
        runId: 'run-7',
        message: 'checking exposure',
        heartbeat: '2026-07-20T12:00:00Z',
        scheduler: { schedulerHealthy: false, status: 'degraded', message: 'worker thread stopped' },
      },
    })).toMatchObject({
      status: 'running',
      progress: 72,
      currentStage: 'risk_gate',
      runId: 'run-7',
      message: 'checking exposure',
      lastHeartbeat: '2026-07-20T12:00:00Z',
      schedulerHealthy: false,
      schedulerStatus: 'degraded',
      schedulerMessage: 'worker thread stopped',
    });

    expect(normalizeRuntime({
      data: { runtime: { progress: { stage: 'score', completedSymbols: 1, totalSymbols: 4 } } },
    })).toMatchObject({ currentStage: 'score', progress: 25 });
  });

  it('surfaces backtest execution coverage and strips lifecycle fields from config updates', () => {
    const result = normalizeBacktest({
      data: {
        result: {
          executionConstraints: {
            scope: 'single_asset',
            symbol: 'BTC/USD',
            represented: ['Minimum confidence and entry score: 71.00'],
            applied: {
              minimumConfidence: 71,
              singleAssetWeightCap: 0.12,
              maxTotalExposure: 0.2,
              feeBps: 25,
              slippageBps: 5,
            },
            notSimulated: [{
              field: 'brokerOrderContract',
              value: { type: 'market', timeInForce: 'gtc' },
              reason: 'Broker order type, time-in-force, queueing, partial fills, and reconciliation are not replayed from historical order books.',
            }],
          },
          limitations: ['This is a single-asset hourly-bar simulation, not a multi-asset portfolio replay.', 'Provider-specific historical limitation'],
        },
      },
    }, ['BTC/USD']);
    expect(result.executionConstraints).toMatchObject({
      scope: 'single_asset',
      symbol: 'BTC/USD',
      applied: expect.arrayContaining([
        { field: 'minimumConfidence', value: 71 },
        { field: 'singleAssetWeightCap', value: 0.12 },
        { field: 'feeBps', value: 25 },
        { field: 'slippageBps', value: 5 },
      ]),
      notSimulated: [{
        field: 'brokerOrderContract',
        value: { type: 'market', timeInForce: 'gtc' },
        reason: 'Broker order type, time-in-force, queueing, partial fills, and reconciliation are not replayed from historical order books.',
      }],
    });
    expect(result.limitations).toEqual(['This is a single-asset hourly-bar simulation, not a multi-asset portfolio replay.', 'Provider-specific historical limitation']);

    expect(sanitizeCryptoConfigUpdate({
      mode: 'paper',
      enabled: true,
      killSwitch: true,
      liveAuthorized: false,
      confirmLiveRisk: true,
    })).toEqual({ mode: 'paper', liveAuthorized: false, confirmLiveRisk: true });
  });

  it('localizes known enums and does not treat unknown crypto subroutes as the command page', () => {
    expect(localizeCryptoEnum('blocked_by_risk', true)).toBe('已被风控阻止');
    expect(localizeCryptoEnum('risk_on', true)).toBe('风险偏好');
    expect(['account', 'reconcile', 'symbols', 'refresh', 'positions', 'market-data', 'signals', 'route', 'reconciliation_required'].map((stage) => localizeCryptoEnum(stage, true))).toEqual([
      '账户核验', '订单核对', '交易对检查', '刷新数据', '持仓核验', '行情数据', '信号计算', '订单路由', '需要核对券商成交',
    ]);
    expect(['price_unavailable', 'quote_unavailable', 'quote_invalid', 'quote_timestamp_unavailable', 'quote_stale'].map((reason) => localizeCryptoEnum(reason, true))).toEqual([
      '价格不可用', '买卖报价不可用', '买卖报价无效', '报价时间不可用', '报价已过期',
    ]);
    expect(['asset_metadata_unavailable', 'asset_metadata_missing', 'broker_tradability_unknown', 'account_eligibility_unknown', 'account_ineligible'].map((reason) => localizeCryptoEnum(reason, true))).toEqual([
      '券商资产资料不可用', '券商资产资料缺失', '券商交易资格未确认', '账户虚拟币交易资格未确认', '账户不符合虚拟币交易条件',
    ]);
    expect(localizeServiceMessage('Crypto scheduler is not running.', true)).toBe('虚拟币调度器未运行。');
    expect(localizeServiceMessage('This is a single-asset hourly-bar simulation, not a multi-asset portfolio replay.', true)).toBe('这是基于小时 K 线的单资产模拟，并非多资产组合回放。');
    expect(localizeServiceMessage('Provider-specific historical limitation', true)).toBe('服务消息：Provider-specific historical limitation');
    expect(localizeConstraintField('minimumConfidence', true)).toBe('最低决策置信度');
    expect(localizeConstraintField('providerSpecificCap', true)).toBe('服务字段：Provider Specific Cap');
    expect(cryptoViewFromPath('/crypto/strategy/')).toBe('strategy');
    expect(cryptoViewFromPath('/crypto/not-a-page')).toBe('not-found');
    expect(cryptoViewFromPath('/cryptocurrency')).toBe('not-found');
  });
});
