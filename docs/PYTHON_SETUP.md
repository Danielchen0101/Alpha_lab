# Python Backend Setup

AlphaLab requires Python 3.11 or newer. Use an isolated virtual environment; do not install backend packages into the system Python.

## macOS / Linux

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python start_quant_backend.py
```

## Windows PowerShell

```powershell
cd backend
py -3.11 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python start_quant_backend.py
```

If PowerShell blocks activation, use a process-scoped policy instead of changing the whole machine:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.venv\Scripts\Activate.ps1
```

## Verify

```bash
python --version
curl http://127.0.0.1:8889/api/health
python -m pytest -q
```

## Important environment variables

Copy `backend/.env.example` to `backend/.env`. Production requires valid values for `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FERNET_KEY`, `APP_SECRET_KEY`, an exact frontend origin, and `FLASK_ENV=production`.

Never expose the service-role key, Fernet key, application secret, broker secrets, or AI-provider secrets to the React build or Git.

The full local workflow is in [QUICK_START.md](QUICK_START.md); deployment settings are in [DEPLOYMENT.md](../DEPLOYMENT.md).
