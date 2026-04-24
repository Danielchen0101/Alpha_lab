# UI Validation Checklist

Use this checklist for scanner-related UI validation.

## Market Scanner

- [ ] Progress bar visible during scan
- [ ] Percent updates
- [ ] Stop button visible during scan
- [ ] Stop button stops scan
- [ ] Results appear batch by batch if implemented
- [ ] Results remain after route/page switch
- [ ] New scan clears old results only when the new scan actually starts

## Preferred Continue Scan List

- [ ] Section is above AI Recommendations
- [ ] Section is not nested inside AI Recommendations
- [ ] Starts after Market Scan completes
- [ ] Has independent loading/progress state
- [ ] Uses real AI result when required
- [ ] Does not show identical static priority/reason for every stock
- [ ] Max 20 candidates
- [ ] Filters mainly bullish / strong bullish unless otherwise requested
- [ ] Sorts by score/risk/trend/AI judgment

## Detail panel

- [ ] Expand detail works
- [ ] Shows matched strategies
- [ ] Shows skipped strategies with reason
- [ ] Shows quick backtest status
- [ ] Shows quick backtest metrics when available

## Console/network

- [ ] No React runtime crash
- [ ] No repeated failed API calls
- [ ] No `/api/api/...` duplicate path
- [ ] No 404 for expected backend route
- [ ] No timeout hiding a valid long-running AI request
