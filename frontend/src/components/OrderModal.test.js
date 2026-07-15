import {
  buildTradingOrderPayload,
  normalizeOrderSymbolInput,
} from './OrderModal';

jest.mock('../services/api', () => ({
  tradingAccountAPI: { placeOrder: jest.fn() },
}));

const baseOrder = (overrides = {}) => ({
  symbol: 'AAPL',
  side: 'buy',
  amountMode: 'shares',
  qty: 2,
  type: 'market',
  time_in_force: 'day',
  trailMode: 'price',
  extended_hours: false,
  order_class: 'simple',
  ...overrides,
});

describe('order ticket payload', () => {
  it('marks only a reviewed live order as confirmed', () => {
    expect(buildTradingOrderPayload(baseOrder(), 'paper')).toMatchObject({
      mode: 'paper',
      confirmed: false,
    });
    expect(buildTradingOrderPayload(baseOrder(), 'real')).toMatchObject({
      mode: 'real',
      confirmed: true,
    });
  });

  it('keeps share and dollar sizing mutually exclusive', () => {
    const sharePayload = buildTradingOrderPayload(baseOrder({ qty: 1.5, notional: 500 }), 'paper');
    const dollarPayload = buildTradingOrderPayload(baseOrder({
      amountMode: 'dollars',
      qty: 3,
      notional: 500,
    }), 'paper');

    expect(sharePayload).toMatchObject({ qty: 1.5 });
    expect(sharePayload).not.toHaveProperty('notional');
    expect(dollarPayload).toMatchObject({ notional: 500 });
    expect(dollarPayload).not.toHaveProperty('qty');
  });

  it('carries linked exits and a trimmed client reference', () => {
    expect(buildTradingOrderPayload(baseOrder({
      type: 'limit',
      limit_price: 190,
      order_class: 'bracket',
      take_profit_limit_price: 215,
      stop_loss_stop_price: 180,
      stop_loss_limit_price: 179.5,
      client_order_id: '  research-42  ',
    }), 'paper')).toMatchObject({
      order_class: 'bracket',
      take_profit: { limit_price: 215 },
      stop_loss: { stop_price: 180, limit_price: 179.5 },
      client_order_id: 'research-42',
    });
  });

  it('normalizes symbols before they reach review or submission', () => {
    expect(normalizeOrderSymbolInput(' brk.b /? ')).toBe('BRK.B');
    expect(buildTradingOrderPayload(baseOrder({ symbol: 'brk.b' }), 'paper').symbol).toBe('BRK.B');
  });
});
