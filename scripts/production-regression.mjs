#!/usr/bin/env node
/**
 * Read-only browser regression sweep for production.
 *
 * Usage:
 *   node scripts/production-regression.mjs [base-url]
 *
 * The two existing clean regression accounts are used by default. Override
 * credentials with REGRESSION_BUSINESS_EMAIL,
 * REGRESSION_BUSINESS_PASSWORD, REGRESSION_CREATOR_EMAIL,
 * REGRESSION_CREATOR_PASSWORD, and ADMIN_EMAIL/ADMIN_PASSWORD in the process
 * environment or .env.local. No campaign, payment, or account data is created.
 * Admin verification creates one temporary TOTP factor only to obtain an AAL2
 * session, sweeps the pages, and removes that factor in finally.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

function loadEnv() {
  const values = {};
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match) {
        values[match[1]] = match[2]
          .trim()
          .replace(/^['"]|['"]$/g, "");
      }
    }
  } catch {
    // Local env is optional when all required values are passed by process env.
  }
  return values;
}

const fileEnv = loadEnv();
const env = (name, fallback = "") => process.env[name] || fileEnv[name] || fallback;
const BASE = (process.argv[2] || "https://adswish-lake.vercel.app").replace(/\/$/, "");
const SUPABASE_URL = env("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_ANON_KEY = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");

const accounts = {
  business: {
    email: env("REGRESSION_BUSINESS_EMAIL", "willgreer38@gmail.com"),
    password: env("REGRESSION_BUSINESS_PASSWORD", "123456"),
  },
  creator: {
    email: env("REGRESSION_CREATOR_EMAIL", "wgreer301@gmail.com"),
    password: env("REGRESSION_CREATOR_PASSWORD", "123456"),
  },
  admin: {
    email: env("ADMIN_EMAIL", "willgreer38@gmail.com"),
    password: env("ADMIN_PASSWORD", "123456"),
  },
};

const publicRoutes = [
  "/",
  "/plans",
  "/businesses",
  "/creators",
  "/legal/terms",
  "/legal/privacy",
  "/legal/subprocessors",
  "/guides/businesses/launching",
  "/guides/creators/getting-started",
  "/guides/engineering/pixel-integration",
  "/login",
  "/signup",
  "/verify-email",
];

const sharedRoutes = [
  "/dashboard/settings",
  "/dashboard/settings/notifications",
];

const roleRoutes = {
  business: [
    "/dashboard/business",
    "/dashboard/business/campaigns",
    "/dashboard/business/campaigns/new",
    "/dashboard/business/applicants",
    "/dashboard/business/analytics",
    "/dashboard/business/tracking",
    "/dashboard/business/payments",
    "/dashboard/business/plan",
    "/dashboard/business/profile",
    "/dashboard/business/messages",
    ...sharedRoutes,
  ],
  creator: [
    "/dashboard/creator",
    "/dashboard/creator/campaigns",
    "/dashboard/creator/discover",
    "/dashboard/creator/analytics",
    "/dashboard/creator/payouts",
    "/dashboard/creator/plan",
    "/dashboard/creator/profile",
    "/dashboard/creator/messages",
    "/dashboard/creator/earnings",
    ...sharedRoutes,
  ],
};

const adminRoutes = [
  "/admin",
  "/admin/audit-logs",
  "/admin/fraud",
  "/admin/sla",
  "/admin/telemetry",
  "/admin/users",
];

const results = [];
let failures = 0;
let skipped = 0;
function record(role, route, ok, detail) {
  results.push({ role, route, ok, detail, status: ok ? "PASS" : "FAIL" });
  if (!ok) failures++;
  console.log(`${ok ? "✅" : "❌"} [${role}] ${route}${detail ? ` — ${detail}` : ""}`);
}
function skip(role, route, detail) {
  results.push({ role, route, ok: true, detail, status: "SKIP" });
  skipped++;
  console.log(`⚠️  [${role}] ${route} — skipped: ${detail}`);
}

function totp(secretB32) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const character of secretB32.replace(/=+$/, "").toUpperCase()) {
    const value = alphabet.indexOf(character);
    if (value < 0) throw new Error("Invalid TOTP secret");
    bits += value.toString(2).padStart(5, "0");
  }
  const key = Buffer.from(bits.match(/.{1,8}/g).map((part) => parseInt(part, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return (binary % 1_000_000).toString().padStart(6, "0");
}

function sessionCookie(session) {
  const payload = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
  };
  return `base64-${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
}

async function login(page, account, role) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  const emailInput = page.locator('input[type="email"]');
  await emailInput.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
  const emailInputCount = await emailInput.count();
  if (emailInputCount) {
    await emailInput.fill(account.email);
    await page.locator('input[type="password"]').fill(account.password);
    await page.getByRole("button", { name: /^Log in$/i }).click();
    await page
      .waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 })
      .catch(() => {});
  }
  const url = new URL(page.url());
  const loggedIn = !url.pathname.startsWith("/login");
  const loginError = (await page.locator("p.text-destructive").allTextContents().catch(() => []))
    .join(" | ")
    .slice(0, 240);
  record(role, "login", loggedIn, loggedIn ? url.pathname : `still on /login${loginError ? ` — ${loginError}` : ""}`);
  return loggedIn;
}

async function inspectPage(page, role, route, options = {}) {
  const browserErrors = [];
  const requestFailures = [];
  const onConsole = (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  };
  const onPageError = (error) => browserErrors.push(error.message);
  const onRequestFailed = (request) =>
    requestFailures.push(`${request.method()} ${request.url()} (${request.failure()?.errorText || "failed"})`);
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("requestfailed", onRequestFailed);

  let response;
  try {
    response = await page.goto(`${BASE}${route}`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForTimeout(700);
  } catch (error) {
    record(role, route, false, `navigation error: ${error.message}`);
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
    page.off("requestfailed", onRequestFailed);
    return;
  }

  const status = response?.status() || 0;
  const current = new URL(page.url());
  const expectedRedirect = options.expectedRedirect;
  const redirectedUnexpectedly =
    !options.allowRedirect &&
    route !== "/login" &&
    route !== "/signup" &&
    route !== "/verify-email" &&
    (current.pathname === "/login" || current.pathname.startsWith("/onboarding"));
  const bodyText = (await page.locator("body").innerText().catch(() => "")).slice(0, 12_000);
  const appError = /Application error|Internal Server Error|404\s*[-|:]?\s*Not Found/i.test(bodyText);
  const ok =
    status >= 200 &&
    status < 400 &&
    !redirectedUnexpectedly &&
    !appError &&
    (!expectedRedirect || current.pathname === expectedRedirect);
  const details = !ok
    ? `HTTP ${status}, landed ${current.pathname}${appError ? ", app error text" : ""}`
    : browserErrors.length || requestFailures.filter((failure) => !failure.includes("ERR_ABORTED")).length
      ? `${browserErrors.length} console error(s), ${requestFailures.filter((failure) => !failure.includes("ERR_ABORTED")).length} request failure(s)`
      : "rendered";
  record(role, route, ok, details);

  const invalidLinks = await page.locator("a").evaluateAll((anchors) =>
    anchors
      .map((anchor) => ({
        href: anchor.getAttribute("href") || "",
        text: (anchor.textContent || "").trim().replace(/\s+/g, " "),
      }))
      .filter(({ href }) => !href || href === "#" || href.toLowerCase().startsWith("javascript:")),
  );
  for (const link of invalidLinks) {
    record(role, `${route} link`, false, `placeholder href for “${link.text || "unnamed link"}”`);
  }

  const unnamedButtons = await page.locator("button").evaluateAll((buttons) =>
    buttons
      .map((button) => ({
        text: (button.textContent || "").trim().replace(/\s+/g, " "),
        label: button.getAttribute("aria-label") || "",
      }))
      .filter(({ text, label }) => !text && !label),
  );
  for (const button of unnamedButtons) {
    record(role, `${route} button`, false, "button has no accessible name");
  }

  // Validate internal hrefs with GETs, but never invoke API/action links.
  const internalLinks = await page.locator('a[href^="/"]').evaluateAll((anchors) =>
    [...new Set(
      anchors
        .map((anchor) => anchor.getAttribute("href"))
        .filter((href) => href && !href.startsWith("/api/")),
    )].slice(0, 80),
  );
  for (const href of internalLinks) {
    try {
      const linkResponse = await page.request.get(`${BASE}${href}`, {
        maxRedirects: 0,
        timeout: 15_000,
      });
      if (linkResponse.status() >= 400) {
        record(role, `${route} → ${href}`, false, `HTTP ${linkResponse.status()}`);
      }
    } catch (error) {
      record(role, `${route} → ${href}`, false, `link check failed: ${error.message}`);
    }
  }

  if (browserErrors.length) {
    record(role, `${route} console`, false, browserErrors.slice(0, 2).join(" | "));
  }
  const meaningfulRequestFailures = requestFailures.filter(
    (failure) => !failure.includes("ERR_ABORTED"),
  );
  if (meaningfulRequestFailures.length) {
    record(role, `${route} network`, false, meaningfulRequestFailures.slice(0, 2).join(" | "));
  }

  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  page.off("requestfailed", onRequestFailed);
}

async function createAdminSession() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase public env vars");
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signedIn, error: signInError } = await supabase.auth.signInWithPassword(accounts.admin);
  if (signInError || !signedIn.session) throw new Error(`admin sign-in: ${signInError?.message || "no session"}`);

  const verifiedFactor = (signedIn.user?.factors || []).find((factor) => factor.status === "verified");
  const configuredSecret = env("ADMIN_TOTP_SECRET");
  if (verifiedFactor && !configuredSecret) {
    throw new Error("existing admin MFA factor requires ADMIN_TOTP_SECRET for the protected page sweep");
  }

  let temporaryFactorId = null;
  try {
    const enrolled = verifiedFactor
      ? { id: verifiedFactor.id, totp: { secret: configuredSecret } }
      : (await supabase.auth.mfa.enroll({
          factorType: "totp",
          issuer: "Adswish Regression",
          friendlyName: "Temporary regression check",
        })).data;
    if (!enrolled) throw new Error("temporary MFA enroll returned no factor");
    if (!verifiedFactor) temporaryFactorId = enrolled.id;
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: enrolled.id });
    if (challengeError || !challenge) throw new Error(`temporary MFA challenge: ${challengeError?.message || "no challenge"}`);
    const { data: verified, error: verifyError } = await supabase.auth.mfa.verify({
      factorId: enrolled.id,
      challengeId: challenge.id,
      code: totp(enrolled.totp.secret),
    });
    if (verifyError || !verified?.session) throw new Error(`temporary MFA verify: ${verifyError?.message || "no session"}`);
    return { cookie: sessionCookie(verified.session), factorId: temporaryFactorId, supabase };
  } catch (error) {
    if (temporaryFactorId) await supabase.auth.mfa.unenroll({ factorId: temporaryFactorId }).catch(() => {});
    throw error;
  }
}

const installedChrome = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome for Testing",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
].find((path) => existsSync(path));
const browser = await chromium.launch({
  headless: true,
  ...(installedChrome ? { executablePath: installedChrome } : {}),
});
try {
  console.log(`Production regression sweep: ${BASE}\n`);

  const publicContext = await browser.newContext();
  const publicPage = await publicContext.newPage();
  for (const route of publicRoutes) await inspectPage(publicPage, "public", route);
  await publicContext.close();

  for (const role of ["business", "creator"]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    if (await login(page, accounts[role], role)) {
      for (const route of roleRoutes[role]) await inspectPage(page, role, route);
    }
    await context.close();
  }

  // Verify the exact MFA redirect path in a real browser session before using a
  // temporary AAL2 session for the protected admin surface.
  const gateContext = await browser.newContext();
  const gatePage = await gateContext.newPage();
  if (await login(gatePage, accounts.admin, "admin-gate")) {
    await gatePage.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
    await gatePage.waitForURL((url) => url.pathname === "/admin/mfa-setup", { timeout: 15_000 }).catch(() => {});
    const landed = new URL(gatePage.url());
    const codeInput = gatePage.locator('input#code, input[placeholder="123456"]');
    await codeInput.first().waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
    const codeVisible = await codeInput.first().isVisible().catch(() => false);
    record("admin", "/admin MFA gate", landed.pathname === "/admin/mfa-setup" && codeVisible,
      `landed ${landed.pathname}, code input ${codeVisible ? "visible" : "missing"}`);
  }
  await gateContext.close();

  try {
    const adminSession = await createAdminSession();
    try {
      const adminContext = await browser.newContext();
      await adminContext.addCookies([{
        name: `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`,
        value: adminSession.cookie,
        domain: new URL(BASE).hostname,
        path: "/",
        secure: BASE.startsWith("https://"),
        httpOnly: false,
      }]);
      const adminPage = await adminContext.newPage();
      for (const route of adminRoutes) await inspectPage(adminPage, "admin", route);
      await adminContext.close();
    } finally {
      if (adminSession.factorId) {
        await adminSession.supabase.auth.mfa.unenroll({ factorId: adminSession.factorId }).catch((error) => {
          record("admin", "temporary MFA cleanup", false, error.message);
        });
      }
    }
  } catch (error) {
    if (error.message.includes("ADMIN_TOTP_SECRET")) {
      skip("admin", "protected admin pages", `${error.message}; the MFA gate itself was verified above`);
    } else {
      throw error;
    }
  }
} catch (error) {
  failures++;
  console.error(`\n❌ Sweep aborted: ${error.message}`);
} finally {
  await browser.close();
}

const passed = results.filter((result) => result.status === "PASS").length;
const report = [
  "# Production regression sweep",
  "",
  `- URL: ${BASE}`,
  `- Date: ${new Date().toISOString()}`,
  `- Result: ${failures === 0 ? "PASS" : "FAIL"}`,
  `- Checks passed: ${passed}`,
  `- Checks failed: ${failures}`,
  `- Checks skipped: ${skipped}`,
  "",
  "| Role | Route/check | Result | Detail |",
  "| --- | --- | --- | --- |",
  ...results.map((result) =>
    `| ${result.role} | ${result.route.replaceAll("|", "\\|")} | ${result.status} | ${(result.detail || "").replaceAll("|", "\\|")} |`,
  ),
  "",
];
writeFileSync("PRODUCTION_REGRESSION.md", report.join("\n"));
console.log(`\n${failures === 0 ? "✅" : "❌"} ${passed} passed, ${failures} failed, ${skipped} skipped`);
console.log("Report: PRODUCTION_REGRESSION.md");
process.exit(failures === 0 ? 0 : 1);
