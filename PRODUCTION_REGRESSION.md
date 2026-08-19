# Production regression sweep

- URL: https://adswish-lake.vercel.app
- Date: 2026-08-19T21:21:15.260Z
- Result: PASS
- Checks passed: 40
- Checks failed: 0
- Checks skipped: 1

| Role | Route/check | Result | Detail |
| --- | --- | --- | --- |
| public | / | PASS | rendered |
| public | /plans | PASS | rendered |
| public | /businesses | PASS | rendered |
| public | /creators | PASS | rendered |
| public | /legal/terms | PASS | rendered |
| public | /legal/privacy | PASS | rendered |
| public | /legal/subprocessors | PASS | rendered |
| public | /guides/businesses/launching | PASS | rendered |
| public | /guides/creators/getting-started | PASS | rendered |
| public | /guides/engineering/pixel-integration | PASS | rendered |
| public | /login | PASS | rendered |
| public | /signup | PASS | rendered |
| public | /verify-email | PASS | rendered |
| business | login | PASS | /dashboard |
| business | /dashboard/business | PASS | rendered |
| business | /dashboard/business/campaigns | PASS | rendered |
| business | /dashboard/business/campaigns/new | PASS | rendered |
| business | /dashboard/business/applicants | PASS | rendered |
| business | /dashboard/business/analytics | PASS | rendered |
| business | /dashboard/business/tracking | PASS | rendered |
| business | /dashboard/business/payments | PASS | rendered |
| business | /dashboard/business/plan | PASS | rendered |
| business | /dashboard/business/profile | PASS | rendered |
| business | /dashboard/business/messages | PASS | rendered |
| business | /dashboard/settings | PASS | rendered |
| business | /dashboard/settings/notifications | PASS | rendered |
| creator | login | PASS | /dashboard |
| creator | /dashboard/creator | PASS | rendered |
| creator | /dashboard/creator/campaigns | PASS | rendered |
| creator | /dashboard/creator/discover | PASS | rendered |
| creator | /dashboard/creator/analytics | PASS | rendered |
| creator | /dashboard/creator/payouts | PASS | rendered |
| creator | /dashboard/creator/plan | PASS | rendered |
| creator | /dashboard/creator/profile | PASS | rendered |
| creator | /dashboard/creator/messages | PASS | rendered |
| creator | /dashboard/creator/earnings | PASS | rendered |
| creator | /dashboard/settings | PASS | rendered |
| creator | /dashboard/settings/notifications | PASS | rendered |
| admin-gate | login | PASS | /dashboard |
| admin | /admin MFA gate | PASS | landed /admin/mfa-setup, code input visible |
| admin | protected admin pages | SKIP | existing admin MFA factor requires ADMIN_TOTP_SECRET for the protected page sweep; the MFA gate itself was verified above |
