# Kalshi BTC live review — 2026-08-10

## Evidence window

- Real-mode durable state and market observations from 2026-08-04 05:23 UTC
  through 2026-08-10 17:07 UTC.
- 23,989 decision observations, 22 filled entries, and finalized Kalshi market
  results were reconciled by ticker.
- All P/L below is the account's recorded realized P/L. The sample is small and
  is an implementation diagnostic, not a promise of future returns.

## Findings

| Family | Entries | Correct | Accuracy | Realized P/L | Mean forecast |
| --- | ---: | ---: | ---: | ---: | ---: |
| BTC 15 minute | 12 | 8 | 66.7% | -$0.105 | 81.7% |
| BTC hourly strike | 10 | 3 | 30.0% | -$1.182 | 76.4% |

The scheduler was active: it wrote 13,274 BTC15 waits and 10,679 hourly waits
during the window. Lack of trading was therefore not caused by a stopped
backend. The main defect was calibration, especially in the hourly ladder:
the selected strike's forecast was far more confident than its realized hit
rate.

BTC15 had acceptable directional accuracy but unfavorable payoff asymmetry.
One 72–83 cent loss erased several small wins. A replay of the new static
entry envelope (price at most 80 cents and conservative edge at least 1.5
percentage points) retained 8 of 12 entries, with 6 correct and +$0.120
recorded P/L.

The four protective sales in the window all exited positions that later
settled against the held side. Compared with holding those entries to
settlement, the exits reduced loss by approximately $0.66, so the protective
exit path remains enabled.

## v9 changes

### BTC15

- Maximum entry price: 80 cents.
- Minimum uncertainty-adjusted edge: 1.5 percentage points.
- Existing two-snapshot confirmation, fee accounting, depth checks, Kelly
  sizing, and protective exits remain authoritative.

### BTC hourly

- Entry window shortened from the final 30 minutes to the final 20 minutes.
- Maximum entry price reduced from 92 to 78 cents.
- Minimum net and conservative edge raised to 1.5 percentage points.
- Market blend floor raised from 45% to 60%.
- Distance-model scale compressed from 1.70 to at most 1.50.
- Multiple-candidate penalty weight raised from 0.10 to at least 0.15.

No risk limit was increased. The recent sample has not demonstrated positive
hourly expectancy, so increasing size would magnify a calibration error. A
future risk increase should require a new, untouched sample with positive
profit factor and acceptable probability calibration.
