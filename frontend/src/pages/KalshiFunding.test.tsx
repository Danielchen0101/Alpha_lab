import React from 'react';
import { renderToStaticMarkup as staticMarkup } from 'react-dom/server';
import {
  actionSummary,
  deriveKalshiFundingReadiness,
  KalshiFundingNotice,
  primaryKalshiNoTradeReason,
} from './Kalshi';
import type { KalshiDecision } from '../services/kalshiApi';

const emptyShard: Partial<KalshiDecision> = {
  action: 'WAIT',
  blockingReasons: ['conservative_edge', 'kalshi_live_shard_cash_insufficient'],
  shardFunding: {
    exchangeIndex: 2,
    aggregateCashAvailable: 99.93,
    shardCashAvailable: 0,
    shardCashKnown: true,
    fundingStatus: 'empty',
    requiresUserFunding: true,
    executionBlocked: true,
  },
};

describe('Kalshi contract funding readiness', () => {
  it('does not replace zero shard cash with aggregate buying power', () => {
    expect(deriveKalshiFundingReadiness(emptyShard, true)).toMatchObject({
      status: 'insufficient', exchangeIndex: 2, aggregateCash: 99.93, shardCash: 0,
    });
    expect(primaryKalshiNoTradeReason({ primaryBlocker: 'conservative_edge' }, emptyShard))
      .toMatchObject({ key: 'kalshi_live_shard_cash_insufficient', source: 'current' });
  });

  it('renders English and Chinese notices with separate balances and no transfer control', () => {
    const english = staticMarkup(<KalshiFundingNotice decision={emptyShard} isRealMode chinese={false} />);
    const chinese = staticMarkup(<KalshiFundingNotice decision={emptyShard} isRealMode chinese />);
    expect(english).toContain('Crypto Predictions');
    expect(english).toContain('$99.93');
    expect(english).toContain('$0.00');
    expect(english).toContain('block new entries and adds, not reduce-only exits');
    expect(english).toContain('has not transferred any funds');
    expect(chinese).toContain('合约所属分片资金不足');
    expect(chinese).toContain('所有分片合计现金');
    expect(chinese).toContain('不阻止减仓和平仓');
    expect(chinese).toContain('未自动转移任何资金');
    expect(english).not.toContain('<button');
    expect(chinese).not.toContain('<button');
    expect(english).toContain('needs-attention');
  });

  it('labels missing balance evidence unverified instead of zero or ready', () => {
    const decision: Partial<KalshiDecision> = {
      action: 'WAIT', blockingReasons: ['kalshi_live_shard_cash_unavailable'],
      account: { exchangeIndex: 2, aggregateCashAvailable: 99.93, shardCashKnown: false },
    };
    expect(deriveKalshiFundingReadiness(decision, true)).toMatchObject({ status: 'unverified', shardCash: null });
    const view = staticMarkup(<KalshiFundingNotice decision={decision} isRealMode chinese={false} />);
    expect(view).toContain('Unverified');
    expect(view).toContain('unverified does not mean zero');
    expect(view).not.toContain('$0.00');
    expect(actionSummary(decision as KalshiDecision, true, true)).toContain('未核实不代表余额为零');
  });

  it('recognizes a funded shard without promising an order', () => {
    const decision: Partial<KalshiDecision> = {
      action: 'WAIT', blockingReasons: ['entry_window'],
      account: { exchangeIndex: 2, aggregateCashAvailable: 99.93, shardCashAvailable: 20, shardCashKnown: true, fundingStatus: 'funded' },
    };
    expect(deriveKalshiFundingReadiness(decision, true)?.status).toBe('funded');
    const view = staticMarkup(<KalshiFundingNotice decision={decision} isRealMode chinese={false} />);
    expect(view).toContain('$20.00');
    expect(view).toContain('no order is implied');
    expect(view).not.toContain('needs-attention');
  });

  it('does not label reduce-only exits blocked by funding', () => {
    const decision: Partial<KalshiDecision> = {
      ...emptyShard,
      shardFunding: { ...emptyShard.shardFunding, applicable: false },
    };
    expect(deriveKalshiFundingReadiness(decision, true)?.status).toBe('exit');
    const view = staticMarkup(<KalshiFundingNotice decision={decision} isRealMode chinese />);
    expect(view).toContain('退出仍须通过持仓、盘口与最终路由检查');
    expect(view).not.toContain('开仓受阻');
  });

  it('shows the planned funding gap separately from the total account balance', () => {
    const decision: Partial<KalshiDecision> = {
      ...emptyShard,
      shardFunding: { ...emptyShard.shardFunding, requiredCash: 0.40, fundingGap: 0.40, strategyQualified: true },
    };
    const view = staticMarkup(<KalshiFundingNotice decision={decision} isRealMode chinese />);
    expect(view).toContain('计划开仓资金缺口');
    expect(view).toContain('$0.40');
    expect(view).toContain('信号已通过 · 资金单独检查');
  });

  it('hides funding notices in paper mode and for legacy snapshots', () => {
    expect(deriveKalshiFundingReadiness(emptyShard, false)).toBeNull();
    expect(deriveKalshiFundingReadiness({ action: 'WAIT' }, true)).toBeNull();
    expect(staticMarkup(<KalshiFundingNotice decision={emptyShard} isRealMode={false} chinese={false} />)).toBe('');
  });
});
