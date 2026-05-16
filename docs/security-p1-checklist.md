# Security P1 — Manual Configuration Checklist

After deploying the code changes from P1, complete these manual configuration steps.

---

## 1. Cloudflare WAF (Web Application Firewall)

- [ ] **Enable WAF rules** in Cloudflare Dashboard → Security → WAF
- [ ] **Rate limiting rule**: create a rule to limit requests to `/api/*` per IP (e.g. 100 req/min) as a defense-in-depth layer on top of the application-level rate limiter
- [ ] **Block common attack patterns**: enable the Cloudflare OWASP Core Ruleset
- [ ] **Bot Fight Mode** (optional): enable to block automated scraping
- [ ] **Verify `_headers` file**: confirm `public/_headers` is deployed with Cloudflare Pages and contains CSP, HSTS, X-Frame-Options, etc.

---

## 2. Supabase Dashboard

- [ ] **Enable CAPTCHA protection**: Supabase Dashboard → Authentication → Settings → Security → enable "CAPTCHA protection"
- [ ] **Set CAPTCHA site key**: paste the Turnstile Site Key into the "CAPTCHA secret key" field in Supabase Auth settings
- [ ] **Rate limiting on auth endpoints**: Supabase Dashboard → Authentication → Rate Limiting — set appropriate limits for `signup`, `login`, `reset-password` (defaults are reasonable; lower if needed)
- [ ] **Disable unused auth providers**: Supabase Dashboard → Authentication → Providers — disable any provider you do not use (e.g. Apple, Twitter, etc.)
- [ ] **SMTP configuration**: ensure a custom SMTP sender is configured (not the default Supabase email) to improve deliverability and avoid spoofing

---

## 3. OAuth Providers (Google / GitHub)

### Google OAuth
- [ ] **Google Cloud Console** → APIs & Services → Credentials
- [ ] **Authorized JavaScript origins**: add your production domain (e.g. `https://yourdomain.com`)
- [ ] **Authorized redirect URIs**: add `https://yourdomain.com/dashboard`
- [ ] **Verify redirect URI matches** the Supabase OAuth redirect URL format: `https://<project>.supabase.co/auth/v1/callback`

### GitHub OAuth
- [ ] **GitHub Settings** → Developer Settings → OAuth Apps
- [ ] **Homepage URL**: set to your production domain
- [ ] **Authorization callback URL**: set to `https://<project>.supabase.co/auth/v1/callback`

---

## 4. Application Environment Variables

Ensure the following are set in production:

| Variable | Purpose |
|---|---|
| `REACT_APP_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key |
| `REACT_APP_SUPABASE_URL` | Supabase project URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `FRONTEND_ORIGIN` | Backend CORS allowed origin |
| `APP_SECRET_KEY` | Backend secret key (change from default) |
| `SUPABASE_URL` | Supabase URL for backend |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (keep secret) |

---

## 5. Monitoring & Incident Response

- [ ] **Backend logs**: monitor `[AUDIT]` log lines for `RATE_LIMIT`, `AUTH_FAIL`, and `LOGIN_FAIL` events
- [ ] **Alert on anomalies**: set up log-based alerts for >10 `AUTH_FAIL` events per minute from a single IP
- [ ] **Review rate limit thresholds**: adjust `RATE_LIMIT_MAX_REQUESTS` and `RATE_LIMIT_WINDOW` in `start_quant_backend.py` based on traffic patterns
- [ ] **Review security headers**: verify via `curl -I https://yourdomain.com/api/health` that `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` are present

---

## 6. Build & Deploy Verification

- [ ] **Run `npm run build`** — must complete with no errors
- [ ] **Run `pytest`** — all tests must pass (especially `test_auth_401.py`)
- [ ] **Test sign-in flow** end-to-end on production
- [ ] **Test OAuth sign-in** (Google and GitHub) end-to-end
- [ ] **Test password reset** flow end-to-end
- [ ] **Verify CAPTCHA** appears on sign-in, sign-up, and forgot-password pages
- [ ] **Verify 429 response** by sending rapid requests to an API endpoint
