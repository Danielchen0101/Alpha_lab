import { formatMarketCap } from './format';

describe('formatMarketCap', () => {
  it('formats missing and invalid values as a placeholder', () => {
    expect(formatMarketCap(null)).toBe('--');
    expect(formatMarketCap(undefined)).toBe('--');
    expect(formatMarketCap(Number.NaN)).toBe('--');
  });

  it('formats market cap values with compact suffixes', () => {
    expect(formatMarketCap(999)).toBe('$999');
    expect(formatMarketCap(12_300)).toBe('$12.3K');
    expect(formatMarketCap(2_800_000_000)).toBe('$2.80B');
    expect(formatMarketCap(2_800_000_000_000)).toBe('$2.80T');
  });
});
