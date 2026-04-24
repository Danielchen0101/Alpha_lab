---
name: quant-webapp-validation
description: Use to validate quant platform UI behavior with browser testing, screenshots, console logs, and network checks. Especially useful for Market Scanner, Preferred Continue Scan List, AI Recommendations, progress bars, page switching, and Stop button behavior.
---

# Quant Webapp Validation

Use this skill when UI behavior must be verified.

## Main purpose

Validate the actual running web app instead of guessing from code.

## Check first

Before using Playwright or browser automation, check whether the project already has Playwright or browser testing support.

Run:
```bash
cd frontend && cat package.json
```

Look for:
- `@playwright/test`
- `playwright`
- existing e2e scripts
- testing scripts

Do not install new dependencies unless explicitly requested.

## What to validate

Common validation targets:

- Market Scan progress bar exists while scanning.
- Market Scan results are not cleared when switching pages.
- Scan does not stop when switching pages.
- Stop button stops the active scan.
- Preferred Continue Scan List appears above AI Recommendations.
- Preferred Continue Scan List waits until Market Scanner is complete.
- Preferred Continue Scan List has its own progress bar.
- AI selection reason is not static/mock text.
- Expandable detail shows detailed scan/backtest info.
- Console has no relevant runtime errors.
- Network requests hit the expected `/api/...` routes.

## Output

Only report:
- What was tested
- Pass/fail
- Evidence
- Console errors
- Network errors
- Screenshot path if created
- Exact broken behavior

Do not modify app code in validation mode unless user asks.
