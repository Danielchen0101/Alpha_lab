import api from './api';

export interface MarketNewsArticle {
  id?: string | number;
  headline: string;
  summary?: string;
  source: string;
  author?: string;
  url?: string;
  createdAt?: string;
  symbols: string[];
  symbolImpactSource?: 'provider' | 'topic_inference' | 'unresolved';
  impactScore: number;
  impactLevel: 'Critical' | 'High' | 'Medium' | 'Low';
  topic: string;
  sentiment: 'Positive' | 'Negative' | 'Neutral';
  marketDirection: 'positive' | 'negative' | 'mixed';
  marketImpact: string;
}

export interface EarningsEvent {
  date: string;
  symbol: string;
  hour?: string;
  epsEstimate?: number | null;
  epsActual?: number | null;
  revenueEstimate?: number | null;
  revenueActual?: number | null;
  quarter?: number;
  year?: number;
}

export interface EconomicEvent {
  date?: string;
  time?: string;
  name?: string;
  event?: string;
  country?: string;
  importance?: 'high' | 'medium' | 'low' | string;
  source?: string;
  sourceUrl?: string;
  period?: string | null;
  actual?: string | number | null;
  forecast?: string | number | null;
  previous?: string | number | null;
}

export interface NormalizedEconomicEvent extends EconomicEvent {
  dateKey: string;
  title: string;
}

export const normalizeEconomicEvents = (events: EconomicEvent[]): NormalizedEconomicEvent[] => (
  (Array.isArray(events) ? events : [])
    .filter(event => event && (event.date || event.name || event.event))
    .map(event => ({
      ...event,
      dateKey: String(event.date || '').slice(0, 10) || 'TBD',
      title: String(event.name || event.event || 'Macroeconomic release'),
    }))
    .sort((left, right) => (
      left.dateKey.localeCompare(right.dateKey)
      || String(left.time || '').localeCompare(String(right.time || ''))
      || left.title.localeCompare(right.title)
    ))
);

export interface MarketNewsResponse {
  success: boolean;
  articles: MarketNewsArticle[];
  count: number;
  sources: string[];
  errors: string[];
  generatedAt: string;
}

export interface MarketCalendarResponse {
  success: boolean;
  earnings: EarningsEvent[];
  earningsCount: number;
  earningsScope: 'watchlist';
  watchlistSymbols: string[];
  watchlistCount: number;
  watchlistStatus: 'ready' | 'empty' | 'unavailable';
  economicEvents: EconomicEvent[];
  economicEventsCount: number;
  economicCalendar: {
    status: 'ready' | 'partial' | 'unavailable' | string;
    message: string;
    cache?: { status?: string; ageSeconds?: number };
    sourceStatus?: Record<string, { status: string; eventCount?: number; source?: string; error?: string }>;
  };
  sources: string[];
  errors: string[];
  warnings?: string[];
  windowDays: number;
  generatedAt: string;
}

export const getMarketIntelligenceNews = async (days = 1): Promise<MarketNewsResponse> => {
  const response = await api.get('/trade/intelligence/news', { params: { days, limit: 120 }, timeout: 45000 });
  if (!response.data?.success) throw new Error(response.data?.error || 'Market news is unavailable.');
  return response.data as MarketNewsResponse;
};

export const getMarketIntelligenceCalendar = async (days = 30, refresh = false): Promise<MarketCalendarResponse> => {
  const response = await api.get('/trade/intelligence/calendar', { params: { days, refresh: refresh ? 1 : undefined }, timeout: 30000 });
  if (!response.data?.success) throw new Error(response.data?.error || 'Market calendar is unavailable.');
  return response.data as MarketCalendarResponse;
};
