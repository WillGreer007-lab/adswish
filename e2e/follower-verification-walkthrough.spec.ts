import { readFileSync } from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { totpCode } from "../src/lib/totp";

/**
 * Guided browser walkthrough of the zero-integration verification flow:
 *
 *   1. Seed a throwaway creator + admin via the service role, and enroll the
 *      admin in TOTP MFA (the /admin middleware enforces AAL2).
 *   2. Creator logs in through the real UI and uploads a follower-count
 *      screenshot on /dashboard/creator/profile.
 *   3. Admin logs in (password + authenticator code) and approves it on
 *      /admin/manual-verifications.
 *   4. Assert the verified social account + recomputed tier landed in the DB.
 *
 * This hits the live cloud Supabase DB with throwaway accounts and cleans them
 * up afterward (same contract as scripts/manual-verification-smoke.mjs).
 * It is NOT a charge/money path — no Stripe keys are touched.
 *
 * Run headed to watch it:
 *   npx playwright test e2e/follower-verification-walkthrough.spec.ts --project=chromium --headed
 */

// Load .env.local into process.env (the Playwright test process does not get
// Next's env loading for free). Never log the values.
function loadDotEnv() {
  try {
    const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
    }
  } catch {
    /* missing .env.local — tests will skip */
  }
}
loadDotEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const runnable = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);

// 1x1 transparent PNG — a real image payload Playwright can attach to the
// hidden file input via setInputFiles.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

const PASSWORD = "Walkthrough123!";
const suffix = Date.now();

test.describe("follower verification browser walkthrough", () => {
  test.describe.configure({ mode: "serial" });

  const service = runnable ? createClient(SUPABASE_URL!, SERVICE_KEY!) : null;
  const anon = runnable ? createClient(SUPABASE_URL!, ANON_KEY!) : null;
  let creatorEmail = "";
  let adminEmail = "";
  let creatorId = "";
  let adminId = "";
  let adminTotpSecret = "";
  let storagePath: string | null = null;

  test.beforeAll(async () => {
    test.skip(!runnable || !service || !anon, "SUPABASE credentials not present — skipping live-DB walkthrough");

    creatorEmail = `walkthrough-creator-${suffix}@adswish.test`;
    adminEmail = `walkthrough-admin-${suffix}@adswish.test`;

    const { data: creator } = await service!.auth.admin.createUser({
      email: creatorEmail,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { role: "creator" },
    });
    if (!creator.user) throw new Error("failed to create walkthrough creator");
    creatorId = creator.user.id;
    await service!.from("creator_profiles").upsert({
      user_id: creatorId,
      display_name: "Walkthrough Creator",
      account_status: "active",
      onboarding_step: "complete",
      tier: "micro",
    });

    const { data: admin } = await service!.auth.admin.createUser({
      email: adminEmail,
      password: PASSWORD,
      email_confirm: true,
      // Both are needed: app_metadata.role gates /admin in middleware; the
      // /dashboard redirect page reads user_metadata.role to route admins.
      app_metadata: { role: "admin" },
      user_metadata: { role: "admin" },
    });
    if (!admin.user) throw new Error("failed to create walkthrough admin");
    adminId = admin.user.id;

    // Enroll the admin in TOTP MFA so the /admin middleware's AAL2 gate
    // (mfa.getAuthenticatorAssuranceLevel() === "aal2") passes on approval.
    const { data: sess, error: signInError } = await anon!.auth.signInWithPassword({
      email: adminEmail,
      password: PASSWORD,
    });
    if (signInError || !sess.session) throw new Error(`admin seed sign-in failed: ${signInError?.message}`);
    const { data: enrolled, error: enrollError } = await anon!.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "walkthrough",
    });
    if (enrollError || !enrolled) throw new Error(`admin MFA enroll failed: ${enrollError?.message}`);
    adminTotpSecret = enrolled.totp.secret;
    const { data: challenge, error: challengeError } = await anon!.auth.mfa.challenge({ factorId: enrolled.id });
    if (challengeError || !challenge) throw new Error(`admin MFA challenge failed: ${challengeError?.message}`);
    const { error: verifyError } = await anon!.auth.mfa.verify({
      factorId: enrolled.id,
      challengeId: challenge.id,
      code: totpCode(adminTotpSecret),
    });
    if (verifyError) throw new Error(`admin MFA verify failed: ${verifyError.message}`);
    await anon!.auth.signOut();
  });

  test.afterAll(async () => {
    if (!service) return;
    try {
      if (creatorId) {
        await service.from("creator_social_accounts").delete().eq("creator_id", creatorId);
        await service.from("manual_follower_verifications").delete().eq("creator_id", creatorId);
        await service.from("notifications").delete().eq("user_id", creatorId);
        await service.from("creator_profiles").delete().eq("user_id", creatorId);
        await service.auth.admin.deleteUser(creatorId);
      }
    } catch {}
    try {
      if (adminId) await service.auth.admin.deleteUser(adminId);
    } catch {}
    try {
      if (storagePath) await service.storage.from("creator-verification").remove([storagePath]);
    } catch {}
  });

  test("creator uploads a follower-count screenshot", async ({ page }) => {
    test.skip(!runnable, "no SUPABASE creds");

    await page.goto("/login");
    await page.fill('input[type="email"]', creatorEmail);
    await page.fill('input[type="password"]', PASSWORD);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForURL(/\/dashboard/);

    await page.goto("/dashboard/creator/profile");
    await expect(page.getByText("Manual follower verification")).toBeVisible();

    await page.fill("#manual-handle", "walkthroughcreator");
    await page.fill("#manual-followers", "1500000");
    // The profile page also has an avatar upload input — scope to the manual
    // verification form's screenshot input.
    const manualForm = page.locator("form").filter({
      has: page.getByRole("button", { name: /Submit for review/i }),
    });
    await manualForm
      .locator('input[type="file"]')
      .setInputFiles({ name: "screenshot.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("button", { name: /Submit for review/i }).click();

    await expect(page.getByText(/proof submitted for admin review/i)).toBeVisible();
    await expect(page.getByText(/pending/i).first()).toBeVisible();

    // Capture the storage path for cleanup via the API the same way the UI does.
    const res = await page.request.get("/api/internal/manual-verifications");
    const json = await res.json();
    storagePath = json?.verifications?.[0]?.storage_path ?? null;
  });

  test("admin approves the screenshot", async ({ page }) => {
    test.skip(!runnable, "no SUPABASE creds");

    await page.goto("/login");
    await page.fill('input[type="email"]', adminEmail);
    await page.fill('input[type="password"]', PASSWORD);
    await page.getByRole("button", { name: "Log in", exact: true }).click();

    // App-level 2FA: the admin has a verified factor, so the login form shows
    // the authenticator step before persisting a session.
    await expect(page.locator("#mfa")).toBeVisible();
    await page.fill("#mfa", totpCode(adminTotpSecret));
    await page.getByRole("button", { name: /Verify & log in/i }).click();
    // Login redirects to /dashboard, which routes the admin to /admin.
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 });

    await page.goto("/admin/manual-verifications");
    await expect(page.getByRole("heading", { name: /Manual follower verification/i })).toBeVisible();

    // Scope to THIS walkthrough creator's row (the queue shows every pending
    // submission across the whole project, oldest first).
    const row = page.locator("article").filter({ hasText: "@walkthroughcreator" });
    await expect(row).toBeVisible();
    const approve = row.getByRole("button", { name: /Approve/i });
    await expect(approve).toBeVisible();

    // Wait for the PATCH to fully complete server-side (status update, social
    // upsert, tier, badges, notification) — not just the optimistic busy state.
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes("/api/internal/admin/manual-verifications") &&
          r.request().method() === "PATCH",
      ),
      approve.click(),
    ]);
    expect(response.status()).toBe(200);

    // Local state flips the row to approved and disables the button.
    await expect(approve).toBeDisabled();
  });

  test("verified social account + tier are written to the DB", async () => {
    test.skip(!runnable || !service, "no SUPABASE creds");

    const { data: social } = await service!
      .from("creator_social_accounts")
      .select("follower_count, verified_at, platform")
      .eq("creator_id", creatorId)
      .eq("platform", "tiktok")
      .maybeSingle();

    expect(social?.verified_at).toBeTruthy();
    expect(Number(social?.follower_count)).toBe(1500000);

    const { data: profile } = await service!
      .from("creator_profiles")
      .select("tier")
      .eq("user_id", creatorId)
      .single();
    expect(profile?.tier).toBe("macro");
  });
});
