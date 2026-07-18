import { formatNumericValue, resolveDataFreshness } from './dataPresentation';

describe('shared data presentation helpers', () => {
  it('formats professional tabular values and suppresses negative zero', () => {
    expect(formatNumericValue(8421, { maximumFractionDigits: 0 })).toBe('8,421');
    expect(formatNumericValue(-0, { minimumFractionDigits: 2 })).toBe('0.00');
    expect(formatNumericValue(null)).toBe('—');
    expect(formatNumericValue('not-a-number')).toBe('—');
  });

  it('classifies feed freshness at explicit boundaries', () => {
    const now = Date.parse('2026-07-16T16:00:00Z');
    expect(resolveDataFreshness('2026-07-16T15:59:50Z', now).status).toBe('fresh');
    expect(resolveDataFreshness('2026-07-16T15:59:45Z', now).status).toBe('delayed');
    expect(resolveDataFreshness('2026-07-16T15:59:00Z', now).status).toBe('stale');
    expect(resolveDataFreshness('invalid', now).status).toBe('unavailable');
  });
});
