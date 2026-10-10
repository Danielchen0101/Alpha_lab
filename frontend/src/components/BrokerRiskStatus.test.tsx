import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import BrokerRiskStatus, { brokerRiskState } from './BrokerRiskStatus';

describe('Broker risk evidence', () => {
  test.each([null, {}, { tradingBlocked: false }, { tradingBlocked: null, accountBlocked: null },
    { tradingBlocked: false, accountBlocked: null }])('missing flags do not certify clear risk: %p', (value) => {
    expect(brokerRiskState(value)).toBe('unknown');
  });
  test('an explicit block remains visible even when another flag is unknown', () => {
    expect(brokerRiskState({ tradingBlocked: true, accountBlocked: null })).toBe('blocked');
  });
  test('optional legacy PDT does not become false or a modern trading restriction', () => {
    const view = renderToStaticMarkup(<BrokerRiskStatus account={{ tradingBlocked: false, accountBlocked: false, patternDayTrader: null } as any} language="en-US" />);
    expect(view).toContain('Reported broker blocks are clear');
    expect(view).toContain('Legacy PDT field: Not provided');
  });
  test('unknown flags are shown to the user', () => {
    const view = renderToStaticMarkup(<BrokerRiskStatus account={{} as any} language="zh-CN" />);
    expect(view).toContain('券商限制状态未完整提供');
    expect(view).not.toContain('未触发');
  });
});
