/**
 * Shared formatting utilities
 */

/**
 * Format market cap value with T/B/M suffixes.
 * Input: actual dollar value (e.g. 2800000000000 for $2.8T)
 */
export const formatMarketCap = (value: number | null | undefined): string => {
  if (value === null || value === undefined || value === 0) return '--';

  const num = Number(value);
  if (isNaN(num)) return '--';

  if (num >= 1e12) {
    const trillions = num / 1e12;
    return `$${trillions.toFixed(trillions >= 100 ? 0 : trillions >= 10 ? 1 : 2)}T`;
  }

  if (num >= 1e9) {
    const billions = num / 1e9;
    return `$${billions.toFixed(billions >= 100 ? 0 : billions >= 10 ? 1 : 2)}B`;
  }

  if (num >= 1e6) {
    const millions = num / 1e6;
    return `$${millions.toFixed(millions >= 100 ? 0 : millions >= 10 ? 1 : 2)}M`;
  }

  if (num >= 1e3) {
    return `$${(num / 1e3).toFixed(1)}K`;
  }

  return `$${num.toFixed(0)}`;
};
