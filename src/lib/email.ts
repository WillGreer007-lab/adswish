/**
 * Transactional email helper using the Resend REST API (no SDK). No-ops
 * gracefully when RESEND_API_KEY is unset (dev/local). Includes a branded HTML
 * wrapper + ready-made templates.
 */

const FROM = "Adswish <onboarding@adswish.com>";
const BRAND = "#3a5ce0";

function wrapHtml(headline: string, body: string, cta?: { label: string; href: string }): string {
  const ctaHtml = cta
    ? `<p style="margin:24px 0 0"><a href="${cta.href}" style="background:${BRAND};color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:600">${cta.label}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f5f6f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#12141c">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="background:#fff;border:1px solid #e4e6ec;border-radius:12px;overflow:hidden">
      <div style="background:${BRAND};padding:16px 24px">
        <span style="color:#fff;font-weight:800;font-size:18px">adswish</span>
      </div>
      <div style="padding:24px">
        <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${headline}</h1>
        <div style="color:#565a68;font-size:15px;line-height:1.6">${body}</div>
        ${ctaHtml}
      </div>
      <div style="padding:16px 24px;border-top:1px solid #e4e6ec;color:#9ca3af;font-size:12px">
        Sent by Adswish — the marketplace for businesses &amp; creators.
      </div>
    </div>
  </div>
</body></html>`;
}

export function acceptedEmailHtml(ctaHref: string): string {
  return wrapHtml(
    "You've been accepted on Adswish 🎉",
    "Good news — a business accepted your application. Your deliverables are now unlocked and you can start chatting with them right away.",
    { label: "View my campaigns", href: ctaHref },
  );
}

export function campaignClosedEmailHtml(title: string, ctaHref: string): string {
  return wrapHtml(
    "Your campaign was closed",
    `Campaign <strong>${title}</strong> was closed because your wallet balance did not cover the fixed payout. Top up and re-open it to continue.`,
    { label: "Top up balance", href: ctaHref },
  );
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !opts.to) {
    return { ok: false, error: "no-api-key" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
        ...(opts.html ? { html: opts.html } : {}),
      }),
    });

    if (!res.ok) {
      return { ok: false, error: `resend ${res.status}: ${await res.text()}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "email-failed" };
  }
}
