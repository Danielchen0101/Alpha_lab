# Backend Workflow

Use this for Flask backend work.

## Important rule

Before modifying:
```bash
cp backend/start_quant_backend.py backend/simple_fix.py
```

Then edit `backend/start_quant_backend.py`.

Do not edit `simple_fix.py` as the main backend. It is only a backup.

## Rules

- Keep backend routes compatible with frontend.
- Keep response shape consistent.
- Do not silently return fake success.
- Surface real errors.
- For AI routes, avoid short hardcoded timeouts unless explicitly required.
- For market data, keep Alpaca / Finnhub / TwelveData responsibilities clear.
- For backtest metrics, use real closed-trade metrics when possible.

## Verification

Run:
```bash
python -m py_compile backend/start_quant_backend.py
```

If possible, also test the specific route with `curl`.
