---
name: quant-platform-task-runner
description: Use for quant platform coding tasks — React frontend, Flask backend, Market Scanner, AI Recommendations, Preferred Continue Scan List, Continue Scan, Backtest, Optimization, Alpaca/Finnhub/TwelveData integration, and bug fixes. Enforces real-code inspection first, minimal scoped edits, build/test verification, and compact reporting.
---

# Quant Platform Task Runner

Use this skill for professional_quant_platform tasks.

## Main rule

Do not start by editing. Read real code first.

## Required workflow

1. Inspect the relevant real files.
2. Identify the exact root cause.
3. Make the smallest scoped change.
4. Modify one logical block at a time.
5. Do not rewrite whole pages.
6. Do not delete working features.
7. Do not replace real logic with mock/static placeholder logic.
8. Run the correct verification command.
9. Report compactly with changed snippets only.

## Important references

Load these only when needed:

- `references/frontend-workflow.md` for React/TypeScript frontend tasks.
- `references/backend-workflow.md` for Flask backend tasks.
- `references/scanner-ai-rules.md` for Market Scanner, AI Recommendation, Continue Scan, Preferred Continue Scan List, and quick backtest tasks.
- `references/report-format.md` for final response format.

## Default commands

Frontend build:
```bash
cd frontend && npm run build
```

Backend syntax check:
```bash
python -m py_compile backend/start_quant_backend.py
```

Search patterns:
```bash
rg "Market Scanner|AI Recommendations|Preferred Continue Scan|Continue Scan|Backtest|Optimization" frontend/src
rg "analyze|scanner|backtest|optimization" backend
```

## Output requirement

Never paste full large files.

Always include:
- Files checked
- Files changed
- Root cause
- Changes made
- Verification
- Before / after snippets for changed blocks only
- Remaining risk
