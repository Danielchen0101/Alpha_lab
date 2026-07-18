import type { Metric } from 'web-vitals';
import { sanitizeWebVital, shouldReportWebVitals } from './reportWebVitals';

describe('privacy-safe Web Vitals reporting', () => {
  it('is opt-in and accepts only the explicit true flag', () => {
    expect(shouldReportWebVitals('true')).toBe(true);
    expect(shouldReportWebVitals('false')).toBe(false);
    expect(shouldReportWebVitals(undefined)).toBe(false);
    expect(shouldReportWebVitals('TRUE')).toBe(false);
  });

  it('removes entries and any non-metric fields from the emitted payload', () => {
    const metric = {
      name: 'LCP',
      value: 1240,
      delta: 80,
      id: 'v4-test',
      rating: 'good',
      navigationType: 'navigate',
      entries: [{ name: 'private-route-or-resource' }],
      pathname: '/portfolio/AAPL',
    } as unknown as Metric;

    expect(sanitizeWebVital(metric)).toEqual({
      name: 'LCP',
      value: 1240,
      delta: 80,
      id: 'v4-test',
      rating: 'good',
      navigationType: 'navigate',
    });
  });
});
