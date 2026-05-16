# P3 Roadmap

## Phase 1 — Complete

| Item | Status | Description |
|------|--------|-------------|
| System Status Indicator | ✅ | `SystemStatusIndicator.tsx` — fetches `/api/health` every 60s, shows online/degraded with last-checked tooltip. Placed in MarketingLayout footer. |
| FAQ / Trust Section | ✅ | 6 FAQ items on homepage (after walkthrough, before CTA) covering: investment advice disclaimer, API key protection, paper vs real trading, AI authorization, data providers, open source. i18n en-US + zh-CN. |
| Product Demo Walkthrough | ✅ | 5-step workflow on homepage: Connect Providers → Scan Market → Validate Candidates → Generate Entry Plan → Execute. Vertical timeline with icons and progress line. |
| Security Center (public) | ✅ | `/security` page with 6 security feature cards: auth protection, email verification, Turnstile CAPTCHA, API key encryption, rate limiting, security headers. Uses MarketingLayout. |
| E2E Test Foundation | ✅ | Playwright with chromium. 7 smoke tests: homepage, signin, signup, forgot-password, security, 404, protected redirect. Script `npm run test:e2e`. |
| Documentation | ✅ | This file. |

### Files Changed

- `frontend/src/locales/en-US.ts` — added `systemStatus`, `faq`, `walkthrough`, `security` sections + `navSecurity` key
- `frontend/src/locales/zh-CN.ts` — Chinese translations for all new keys
- `frontend/src/components/SystemStatusIndicator.tsx` — new component
- `frontend/src/components/MarketingLayout.tsx` — added status indicator + security link in footer
- `frontend/src/pages/Landing.tsx` — added walkthrough + FAQ sections
- `frontend/src/pages/Security.tsx` — new public security/trust page
- `frontend/src/App.tsx` — added `/security` route
- `frontend/src/pages/SignUp.tsx` — bugfix (orphaned `confirmMessage` reference)
- `frontend/package.json` — added `test:e2e` / `test:e2e:headed` scripts
- `frontend/playwright.config.ts` — new Playwright config
- `frontend/e2e/smoke.spec.ts` — 7 smoke tests
- `docs/p3-roadmap.md` — this file

## Phase 2 — Planned

- [ ] **Security Center (authenticated)** — real login history, active sessions list, logout-all-devices
- [ ] **Abnormal login alerts** — detect and flag unusual IP/location auth events
- [ ] **Uptime monitoring integration** — connect status indicator to a lightweight uptime dashboard
- [ ] **Pricing / Waitlist page** — basic tier info and signup interest form
- [ ] **Full CI E2E** — integrate Playwright into GitHub Actions (allow manual trigger or schedule, not required for PR merge)
- [ ] **Advanced audit logging** — structured audit log viewer (backend + frontend)

## Manual Verification Checklist

### Before deploying P3 Phase 1
- [ ] `npm run build` passes with no errors
- [ ] Homepage renders with walkthrough + FAQ sections
- [ ] `/security` page renders with 6 feature cards
- [ ] Status indicator shows in footer on all marketing pages
- [ ] All auth pages still work (signin, signup, forgot-password)
- [ ] Protected routes still redirect to /signin
- [ ] Language switch works on new sections
- [ ] Playwright smoke tests pass against production
