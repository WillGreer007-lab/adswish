# Adswish — Security Audit & Hardening Plan

Last reviewed: 2026-08-20. This is a read-only code review plus header
hardening. **No active penetration test was run against production** — an
active test against a live money-moving platform must be authorized and is
best performed by a third party (recommendations below).

---

## 1. What is already in place

| Control | Status | Where |
|---------|--------|-------|
| Strict CSP (no `unsafe-eval` in prod) | ✅ | `next.config.ts` |
| HSTS + includeSubDomains | ✅ | `next.config.ts` |
| `X-Frame-Options: SAMEORIGIN` | ✅ | `next.config.ts` |
| `X-Content-Type-Options: nosniff` | ✅ | `next.config.ts` |
| `Referrer-Policy` | ✅ | `next.config.ts` |
| Admin CSP with `frame-ancestors 'none'` | ✅ | `next.config.ts` |
| Admin TOTP (AAL2) enforcement | ✅ | `middleware.ts` |
| Admin role check on `/admin` | ✅ | `middleware.ts` |
| Suspended/banned account enforcement | ✅ | `middleware.ts` |
| Row Level Security on all tables | ✅ | migrations (incl. 018, 031, 034) |
| Rate limiting (Redis/Upstash) | ✅ | API routes |
| PII filter in chat | ✅ | campaign chat |
| Private payout-invoice storage | ✅ | migration 034 |
| Live/t-test Stripe key safety rules | ✅ | `AGENTS.md` |
| No committed secrets in `src/` | ✅ | verified this session |

## 2. Hardened this session

- Added `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(self)` — blocks camera/mic/geolocation by default, which the product does not need.
- Removed the `beforeunload` handler that was interrupting internal navigation (and could leave the UI in a broken state).

## 3. Gaps to close (recommended, in priority order)

1. **CSP nonces for inline scripts.** `script-src 'unsafe-inline'` is required by
   the current Next.js bootstrap, but nonces (or a proxy that injects them)
   would let us drop `'unsafe-inline'`. Medium effort, meaningful hardening.
2. **Cloudflare in front of Vercel.** Adds WAF rules, DDoS protection, bot
   management, and rate limiting at the edge. See section 5.
3. **Dependency scanning.** No automated CVE scanner runs in CI. Add Snyk or
   GitHub Dependabot (both have free tiers) — see section 5.
4. **Admin audit archival.** Admin actions are logged in-app; a WORM/immutable
   export of audit logs is still outstanding (tracked in the blueprint audit).
5. **Backup/PITR confirmation.** Supabase Point-In-Time Recovery should be
   enabled and a restore tested before a public launch.
6. **Session timeout.** The v3 spec calls for inactivity logout (1–10 min).
   Not yet implemented; queued as a follow-up.

## 4. What I will NOT do without explicit approval

- Run any active exploit/brute-force/DoS test against
  `https://adswish-lake.vercel.app`. This is a live production site; active
  testing can trigger Stripe rate limits, lock admin accounts, or disrupt
  real users.
- Run any Stripe charge/transfer script while `.env.local` contains live keys.

## 5. Third-party security (dedicated) — recommendations

These provide the independent, third-party security reporting you asked for.
Each has a free plan or free tier:

1. **Cloudflare (free plan)** — dedicated WAF + DDoS protection.
   - Create a Cloudflare account, add the `adswish.com` zone, set DNS to
     proxied (orange cloud), and enable the "Managed WAF" rule set.
   - Cloudflare then reports blocked attacks in its Security dashboard.
2. **Snyk (free for open source)** — continuous dependency CVE scanning.
   - Connect the GitHub repo; it scans every PR and reports vulnerable
     packages (this also replaces the risky `npm audit fix --force`).
3. **GitHub Dependabot / secret scanning** — enable in repo Settings →
   Security for free secret + vulnerability alerts.
4. **UptimeRobot (free)** — external uptime/health checks (already referenced
   in the v3 spec as the optional third tracking layer).
5. **Authorized pentest (one-off, paid)** — services such as Detectify or
   ImmuniWeb, or a manual engagement via HackerOne/Intigriti, once the Google
   Ads and payout surfaces are feature-complete. This is the "fully try to
   attack the site" step, done safely and with a report you can act on.

## 6. Owner action items

1. Enable Cloudflare proxying + WAF for the production domain.
2. Enable GitHub Dependabot + secret scanning on this repo.
3. Connect Snyk to the repo for dependency CVE reports.
4. Confirm Supabase PITR is enabled and test a restore.
5. Approve a one-off third-party pentest before the public v3 launch.
6. Keep `.env.local` live keys out of any agent tooling that moves money.
