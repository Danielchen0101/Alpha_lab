# Contributing to AlphaLab

AlphaLab combines market data, research workflows, risk controls, and order execution. Changes can affect both presentation and trading behavior, so contributions should be easy to review, reproducible, and explicit about their operational impact.

## Before opening a change

- Search existing issues and pull requests.
- Use an issue for broad product changes, new data providers, or changes to execution behavior.
- Never commit API keys, account data, generated pipeline state, debug exports, or `.env` files.
- Keep deterministic screening and risk checks separate from optional AI review.

## Local setup

Requirements:

- Node.js 20 or newer
- Python 3.11 or newer
- npm and pip
- A Supabase project for authenticated flows

```bash
git clone https://github.com/Danielchen0101/Alpha_lab.git
cd Alpha_lab

cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env

python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt

cd frontend
npm ci
```

Start the backend and frontend in separate terminals:

```bash
source .venv/bin/activate
python backend/start_quant_backend.py
```

```bash
cd frontend
npm start
```

The web application runs at `http://localhost:3000`. The backend defaults to `http://localhost:8889`.

## Branches and commits

Create a focused branch from the latest `main`:

```bash
git switch main
git pull --ff-only
git switch -c feature/short-description
```

Use concise Conventional Commit titles, for example:

- `feat(scanner): add liquidity eligibility gate`
- `fix(portfolio): align position action controls`
- `docs: document production scheduler constraint`
- `test(pipeline): cover admission rejection state`

Do not combine unrelated cleanup with a product change.

## Validation

Run the checks relevant to the changed area before opening a pull request.

```bash
cd frontend
npm test -- --watchAll=false
npx eslint src --ext .js,.jsx,.ts,.tsx
npx tsc --noEmit
npm run build
```

```bash
source .venv/bin/activate
python -m pytest backend/tests -q
python -m py_compile backend/start_quant_backend.py
```

For UI work, verify at least one desktop and one mobile viewport. For pipeline or trading changes, include the decision states tested and confirm that paper/live mode boundaries remain explicit.

## Pull requests

A useful pull request explains:

1. the user or operational problem;
2. the behavior that changed;
3. the validation performed;
4. configuration, schema, or migration requirements;
5. trading, security, and rollback risk;
6. screenshots for visual changes.

Breaking changes must carry the `breaking-change` and appropriate semantic-version label. A maintainer may request that large changes be split when independent review is possible.

## Product invariants

- AI output is advisory; deterministic gates and human approval remain authoritative.
- A configured credential is not presented as a verified live connection.
- Zero values must render as zero, not as positive progress or unavailable state.
- Runtime evidence and rejection reasons remain inspectable.
- Production scheduling uses one application process unless the scheduler is moved to a separate worker.
- User-facing copy must remain consistent in English and Simplified Chinese.

## Reporting security issues

Do not open a public issue for a vulnerability or exposed credential. Follow [SECURITY.md](SECURITY.md) and use GitHub's private vulnerability reporting when available.

By contributing, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md) and license your contribution under the repository's [MIT License](LICENSE).
