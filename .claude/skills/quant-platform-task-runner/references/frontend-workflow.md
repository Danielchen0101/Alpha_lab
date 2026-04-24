# Frontend Workflow

Use this for React / TypeScript / JavaScript frontend work.

## Files to inspect first

Common files:
- `frontend/src/pages/Portfolio.tsx`
- `frontend/src/pages/Market.tsx`
- `frontend/src/pages/SymbolAnalysis.tsx`
- `frontend/src/pages/Backtest.tsx`
- `frontend/src/services/api.ts`
- `frontend/src/services/marketDataService.ts`
- `frontend/src/services/aiTradingService.ts`

Do not assume the file. Use `rg` first.

## Rules

- Do not rewrite the whole component.
- Do not delete existing state unless the task explicitly asks.
- Do not remove progress bars, stop buttons, detail panels, or existing result tables by accident.
- Preserve current UI style.
- Keep state names and backend field names consistent.
- Do not use mock data when real API/AI data is required.
- Do not clear scan results when switching pages unless a new scan starts.
- If a scan is running, page switch should not stop it unless the user presses Stop.

## Verification

Run:
```bash
cd frontend && npm run build
```

If build fails, fix only the related error.
