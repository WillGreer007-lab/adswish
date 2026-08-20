import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

/**
 * Server-side helpers for the QR-code (authenticator) signup/login fallback.
 * No email delivery is involved anywhere: the TOTP secret is stored in
 * `totp_credentials`, verified against the 6-digit code the user enters, and
 * the session is issued by setting a fresh random password + signing in with
 * it (the password is never shared with the user — the authenticator code IS
 * their credential).
 */

export type TotpSession = { access_token: string; refresh_token: string };

/** Scan auth users for one email (auth.users is not exposed to PostgREST). */
export async function findUserByEmail(
  email: string,
): Promise<{ id: string; email: string } | null> {
  const service = createSupabaseServiceRoleClient();
  const { data: page } = await service.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const target = (page?.users ?? []).find(
    (u: { email?: string | null }) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  return target ? { id: target.id, email: target.email ?? email } : null;
}

function randomPassword(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Issue a real browser session for a user WITHOUT any email flow: reset the
 * password to a fresh random value via the admin API, then sign in with it on
 * a non-persisting client. The returned tokens are applied by the caller.
 */
export async function issueSessionForUser(
  userId: string,
  email: string,
): Promise<{ session: TotpSession } | { error: string }> {
  const service = createSupabaseServiceRoleClient();
  const password = randomPassword();

  const { error: updateErr } = await service.auth.admin.updateUserById(userId, {
    password,
  });
  if (updateErr) return { error: updateErr.message };

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await anon.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session) {
    return { error: error?.message || "Could not start your session." };
  }
  return {
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
  };
}

/**
 * Create the account + profile rows for a QR signup and store the TOTP
 * credential. Mirrors the /auth/callback profile creation so the user lands
 * in onboarding exactly like an email signup would.
 */
export async function createTotpUser(opts: {
  email: string;
  role: "creator" | "business";
  secret: string;
}): Promise<{ ok: true } | { error: string; code?: string }> {
  const service = createSupabaseServiceRoleClient();
  const password = randomPassword();

  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email: opts.email,
    password,
    email_confirm: true,
    user_metadata: { role: opts.role },
  });
  if (createErr || !created.user) {
    const alreadyExists = /already registered|already been registered/i.test(
      createErr?.message ?? "",
    );
    return {
      error: alreadyExists
        ? "An account with this email already exists — log in instead."
        : createErr?.message || "Could not create the account.",
      code: alreadyExists ? "email_in_use" : undefined,
    };
  }

  const userId = created.user.id;

  if (opts.role === "creator") {
    const { data: existing } = await service
      .from("creator_profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!existing) {
      await service.from("creator_profiles").insert({
        user_id: userId,
        display_name: "",
        account_status: "active",
        onboarding_step: "profile_setup",
      });
    }
  } else {
    const { data: existing } = await service
      .from("business_profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!existing) {
      await service.from("business_profiles").insert({
        user_id: userId,
        company_name: "",
        account_status: "active",
        onboarding_step: "company_info",
      });
    }
  }

  await service.from("notification_preferences").upsert(
    { user_id: userId },
    { onConflict: "user_id" },
  );

  const { error: secretErr } = await service.from("totp_credentials").insert({
    user_id: userId,
    secret: opts.secret,
  });
  if (secretErr) {
    return { error: "Could not save your authenticator setup." };
  }

  return { ok: true };
}
