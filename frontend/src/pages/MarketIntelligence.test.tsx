import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { CalendarView, marketIntelligenceRefreshTimestamp } from './MarketIntelligence';
import type { MarketRiskSnapshotResponse } from '../services/marketDataService';
import type { MarketCalendarResponse, MarketNewsResponse } from '../services/marketIntelligenceService';

const copy = {
  calendarTitle: '未来 30 天事件日历', economic: '公共宏观事件', macroEvents: '项宏观事件',
  macroPartial: '部分来源不可用', calendarPending: '宏观日历不可用', actual: '实际值', forecast: '预期值',
  previous: '前值', importance: '影响', high: '高', medium: '中', low: '低', unknown: '时间待定',
  earningsTitle: 'Watchlist 财报', watchlistSummary: '只显示 Watchlist 中股票的财报', watchlistStocks: '只股票',
  earnings: '财报', manageWatchlist: '管理 Watchlist', unavailable: '数据暂不可用', emptyWatchlist: 'Watchlist 还是空的，请先添加股票。',
  noEarnings: '未来暂无财报', before: '盘前', after: '盘后', estimate: '预期 EPS', revenue: '预期营收',
  showAll: '显示全部', collapse: '收起',
  nextCatalyst: '下一个高影响事件',
  allEvents: '按日期排列的全部事件', scheduled: '数据源日程', actualPending: '待公布', noConsensus: '暂无共识', noPrevious: '暂无数据',
  earningsCoverage: '财报覆盖', noDateInWindow: '其余股票在当前窗口内暂无数据源日程', valuesPlanRequired: '套餐不含宏观一致预期',
};

const calendar: MarketCalendarResponse = {
  success: true,
  earnings: [],
  earningsCount: 0,
  earningsScope: 'watchlist',
  watchlistSymbols: ['AAPL'],
  watchlistCount: 1,
  watchlistStatus: 'ready',
  economicEvents: [{
    date: '2026-08-07',
    time: '08:30 ET',
    name: 'Employment Situation (Nonfarm Payrolls)',
    country: 'US',
    importance: 'high',
    source: 'U.S. Bureau of Labor Statistics',
  }],
  economicEventsCount: 1,
  economicCalendar: { status: 'ready', message: 'ready' },
  sources: ['U.S. Bureau of Labor Statistics'],
  errors: [],
  windowDays: 30,
  generatedAt: '2026-08-02T05:00:00Z',
};

describe('MarketIntelligence CalendarView', () => {
  it('renders official macro releases independently from Watchlist earnings', () => {
    const view = renderToStaticMarkup(
      <StaticRouter location="/market/intelligence/calendar">
        <CalendarView data={calendar} copy={copy} isZh onSymbol={() => undefined} />
      </StaticRouter>,
    );

    expect(view).toContain('Employment Situation (Nonfarm Payrolls)');
    expect(view).toContain('08:30 ET');
    expect(view).toContain('U.S. Bureau of Labor Statistics');
    expect(view).toContain('未来暂无财报');
  });

  it('uses the active view response time instead of a stale market as-of date', () => {
    const pulse = {
      asOf: '2026-08-01',
      generatedAt: '2026-08-02T20:15:00Z',
    } as MarketRiskSnapshotResponse;
    const news = { generatedAt: '2026-08-02T20:20:00Z' } as MarketNewsResponse;

    expect(marketIntelligenceRefreshTimestamp('pulse', pulse, null, null)).toBe('2026-08-02T20:15:00Z');
    expect(marketIntelligenceRefreshTimestamp('news', pulse, news, null)).toBe('2026-08-02T20:20:00Z');
  });
});
