/* eslint-disable testing-library/no-unnecessary-act -- React createRoot is used directly */
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import EquityEvidencePanel, { EquityAccountMetrics, equityBusinessLabel } from './EquityEvidencePanel';
import api from '../services/api';
import { equitySchedulePatch } from '../services/equityEvidenceService';

jest.mock('../services/api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock('antd', () => ({
  Alert: ({ message }: any) => <div role="alert">{message}</div>,
  Button: ({ children, onClick, disabled, loading }: any) => <button onClick={onClick} disabled={disabled || loading}>{children}</button>,
  Card: ({ title, extra, children }: any) => <section><h2>{title}</h2>{extra}{children}</section>,
  Space: ({ children }: any) => <div>{children}</div>,
  Tag: ({ children }: any) => <span>{children}</span>,
  Select: ({ value, onChange, disabled, options }: any) => <select value={value} onChange={event => onChange(event.target.value)} disabled={disabled}>{options.map((option: any) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>,
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const get = api.get as jest.Mock;
const post = api.post as jest.Mock;
const frozen = { success: true, protocol: { protocolKey: 'protocol-1' }, active: false, brokerOrdersAllowed: false, executionMode: 'shadow',
  businessStatus: 'research_blocked', researchAdmission: { eligible: false, historicalEligible: false },
  forward: { tradingSessions: 0, completedTrades: 0, requiredSessions: 60, requiredTrades: 30 } };
const button = (container: HTMLElement, label: string) => Array.from(container.querySelectorAll('button')).find(item => item.textContent?.includes(label)) as HTMLButtonElement;

describe('Stock evidence controls', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    jest.clearAllMocks();
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    get.mockResolvedValue({ data: frozen }); post.mockResolvedValue({ data: { success: true } });
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  test('frozen protocol can begin exploratory shadow without pretending to pass research', async () => {
    const onActivated = jest.fn();
    await act(async () => { root.render(<EquityEvidencePanel language="en-US" mode="paper" onActivated={onActivated} />); });
    expect(container.textContent).toContain('Research has not passed');
    expect(container.textContent).toContain('Broker orders disabled');
    expect(button(container, 'Start $2,000').disabled).toBe(false);
    expect(button(container, 'Protocol frozen').disabled).toBe(true);
    await act(async () => { button(container, 'Start $2,000').click(); });
    expect(post).toHaveBeenCalledWith('/ai-agent/equity/activate', { protocolKey: 'protocol-1' });
    expect(onActivated).toHaveBeenCalledTimes(1);
  });

  test('transport success does not replace the business outcome', async () => {
    get.mockResolvedValue({ data: { ...frozen, businessStatus: 'capital_blocked' } });
    await act(async () => { root.render(<EquityEvidencePanel language="en-US" mode="real" />); });
    expect(container.textContent).toContain('Capital constraint');
    expect(container.textContent).not.toContain('Cycle completed');
    expect(equityBusinessLabel(undefined, false)).toBe('Status unknown');
  });

  test('future broker authority and missing authority are rendered from server evidence', async () => {
    const onActiveChange = jest.fn();
    get.mockResolvedValue({ data: { ...frozen, active: true, executionMode: 'broker', brokerOrdersAllowed: true } });
    await act(async () => { root.render(<EquityEvidencePanel language="en-US" mode="real" onActiveChange={onActiveChange} />); });
    expect(container.textContent).toContain('Broker order authority enabled');
    expect(container.textContent).not.toContain('Broker orders disabled');
    expect(onActiveChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ executionMode: 'broker', brokerOrdersAllowed: true }));
    get.mockResolvedValue({ data: { ...frozen, brokerOrdersAllowed: undefined } });
    await act(async () => { button(container, 'Refresh').click(); });
    expect(container.textContent).toContain('Broker order authority unknown');
  });

  test('freezes the chosen preregistered strategy through the dedicated endpoint', async () => {
    get.mockResolvedValue({ data: { success: true, active: false, businessStatus: 'research_blocked' } });
    await act(async () => { root.render(<EquityEvidencePanel language="en-US" mode="paper" />); });
    expect(button(container, 'Start $2,000').disabled).toBe(true);
    await act(async () => { button(container, 'Freeze protocol').click(); });
    expect(post).toHaveBeenCalledWith('/ai-agent/equity/protocol', { strategy: 'breakout20' });
  });

  test('failed status clears stale success and disables mutations', async () => {
    get.mockRejectedValue(new Error('network'));
    await act(async () => { root.render(<EquityEvidencePanel language="en-US" mode="paper" />); });
    expect(container.textContent).toContain('Success is unconfirmed');
    expect(button(container, 'Freeze protocol').disabled).toBe(true);
    expect(button(container, 'Start $2,000').disabled).toBe(true);
  });

  test('old account responses cannot replace a newer account scope', async () => {
    let resolveOld: (value: any) => void = () => {};
    get.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
      .mockResolvedValueOnce({ data: { ...frozen, businessStatus: 'risk_paused' } });
    await act(async () => { root.render(<EquityEvidencePanel language="en-US" mode="paper" scopeKey="first" />); });
    await act(async () => { root.render(<EquityEvidencePanel language="en-US" mode="paper" scopeKey="second" />); });
    await act(async () => { resolveOld({ data: { ...frozen, businessStatus: 'completed' } }); });
    expect(container.textContent).toContain('Risk pause');
    expect(container.textContent).not.toContain('Cycle completed');
  });

  test('historical pass is distinct from completed forward admission', async () => {
    get.mockResolvedValue({ data: { ...frozen, researchAdmission: { eligible: false, historicalEligible: true }, forward: { tradingSessions: 9, completedTrades: 4 }, shadow: { forward: { tradingSessions: 70, completedTrades: 40 }, metrics: { netPnl: 99 } }, research: { qualification: { metrics: { netPnl: -3 } } } } });
    await act(async () => { root.render(<EquityEvidencePanel language="en-US" mode="paper" />); });
    expect(container.textContent).toContain('Historical research passed; forward validation remains incomplete');
    expect(container.textContent).toContain('9 / 60 · 4 / 30');
    expect(container.textContent).toContain('Exploratory sessions / completed trades: 70 / 40');
    expect(container.textContent).toContain('Qualifying forward P/L after modelled costs: -$3.00');
    expect(container.textContent).toContain('Exploratory shadow P/L after modelled costs: $99.00');
  });

  test('resumes saved collection without claiming a research pass', async () => {
    get.mockResolvedValue({ data: { ...frozen, research: { status: 'collecting' } } });
    await act(async () => { root.render(<EquityEvidencePanel language="en-US" mode="paper" />); });
    expect(container.textContent).toContain('out-of-sample evaluation has not started');
    expect(button(container, 'Resume research collection').disabled).toBe(false);
    await act(async () => { button(container, 'Resume research collection').click(); });
    expect(post).toHaveBeenCalledWith('/ai-agent/equity/research/run', { protocolKey: 'protocol-1' });
  });

  test('archived data awaits offline replay and cannot restart frozen parameter research', async () => {
    get.mockResolvedValue({ data: { ...frozen, research: { status: 'data_ready_requires_offline_replay' } } });
    await act(async () => { root.render(<EquityEvidencePanel language="en-US" mode="paper" />); });
    expect(container.textContent).toContain('awaits a dedicated research worker');
    expect(button(container, 'Run out-of-sample research').disabled).toBe(true);
    expect(button(container, 'Start $2,000').disabled).toBe(false);
  });

  test('202 queue acknowledgement keeps polling before the worker claims the job', async () => {
    jest.useFakeTimers();
    try {
      get.mockResolvedValue({ data: { ...frozen, research: { status: 'frozen' } } });
      post.mockResolvedValue({ data: { success: true, status: 'queued' } });
      await act(async () => { root.render(<EquityEvidencePanel language="en-US" mode="paper" />); });
      await act(async () => { button(container, 'Run out-of-sample research').click(); });
      expect(button(container, 'Run out-of-sample research').disabled).toBe(true);
      get.mockResolvedValue({ data: { ...frozen, research: { status: 'collecting' } } });
      await act(async () => { jest.advanceTimersByTime(15000); });
      expect(button(container, 'Resume research collection').disabled).toBe(false);
    } finally { jest.useRealTimers(); }
  });
});

describe('Cash-flow ledger presentation', () => {
  test('unknown cost and return metrics never become zero', () => {
    const view = renderToStaticMarkup(<EquityAccountMetrics language="en-US" evidence={{ accounting: { account_net_operating_pnl: -1.89, net_operating_profit: null }, risk: { daily_pnl: null, drawdown_pct: null } }} />);
    expect(view).toContain('-$1.89');
    expect(view).toContain('Net operating profit</span><strong>—</strong>');
    expect(view).toContain('Adjusted daily P/L</span><strong>—</strong>');
    expect(view).not.toContain('$0.00');
  });
  test('verified zero and a persistent drawdown latch are represented honestly', () => {
    const view = renderToStaticMarkup(<EquityAccountMetrics language="zh-CN" evidence={{ risk: { daily_pnl: 0, drawdown_latched: true } }} />);
    expect(view).toContain('$0.00');
    expect(view).toContain('入金或重启不会解除');
  });
  test('retained accounting and a new performance baseline expose their distinct periods', () => {
    const view = renderToStaticMarkup(<EquityAccountMetrics language="en-US" evidence={{
      accountingAsOf: '2026-10-08T20:00:00Z', performanceSince: '2026-10-09T14:00:00Z', performanceThrough: '2026-10-09T15:00:00Z',
      risk: { as_of: '2026-10-09T15:10:00Z', complete: false, drawdown_pct: 0 }, accounting: { account_net_operating_pnl: -1.89 },
    }} />);
    expect(view).toContain('Account P/L evidence through');
    expect(view).toContain('10/8/2026');
    expect(view).toContain('not full account history');
    expect(view).toContain('Incomplete / unknown');
  });
});

test('shadow scheduling never resaves stale legacy broker authority or strategy settings', () => {
  const legacy = { mode: 'ai', tradeMode: 'real', liveAutoTradingEnabled: true, leverageEnabled: true, riskProfile: 'high' };
  expect(equitySchedulePatch(true, { enabled: true, intervalMinutes: 15 }, legacy)).toEqual({ enabled: true, intervalMinutes: 15 });
  expect(equitySchedulePatch(false, { enabled: false, intervalMinutes: null }, legacy)).toEqual({ ...legacy, enabled: false, intervalMinutes: null });
});
