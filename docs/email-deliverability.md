# Email Deliverability Setup

Before sending any transactional emails, configure SPF, DKIM, and DMARC DNS records on the sending domain (adswish.com). Verify the domain in the Resend dashboard.

## DNS Records to Configure

### SPF (Sender Policy Framework)
```
TXT  adswish.com  "v=spf1 include:amazonses.com ~all"
```
Resend uses AWS SES under the hood. Replace `amazonses.com` with the specific include from your Resend dashboard.

### DKIM (DomainKeys Identified Mail)
Resend generates DKIM keys during domain verification. Add the CNAME records provided by Resend:
```
CNAME  resend._domainkey.adswish.com  →  (provided by Resend)
CNAME  resend1._domainkey.adswish.com  →  (provided by Resend)
```

### DMARC (Domain-based Message Authentication, Reporting & Conformance)
Start with `p=none` for monitoring, then escalate to `p=quarantine` then `p=reject`:
```
TXT  _dmarc.adswish.com  "v=DMARC1; p=none; rua=mailto:dmarc@adswish.com; ruf=mailto:dmarc@adswish.com; sp=none; fo=1"
```

## Verification Steps

1. Add all DNS records above
2. Wait for propagation (up to 48 hours, usually 15 minutes)
3. Verify domain in Resend dashboard → Domains → Add domain
4. Send a test email and check headers for `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`
5. Use [mail-tester.com](https://www.mail-tester.com) to score deliverability (target: 10/10)

## Environment Variables

```
RESEND_API_KEY=              # Resend API key
NEXT_PUBLIC_APP_DOMAIN=     # https://adswish.com
```

## Email Templates

Email templates are in `src/lib/emails/` using React Email. All transactional emails are sent from `noreply@adswish.com`.

## Monitoring

- Check Resend dashboard for bounce and complaint rates
- Bounce rate should be < 5%
- Complaint rate should be < 0.1%
- Set up alerts for bounce rate spikes
