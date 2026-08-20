import { NextResponse, type NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  // OAuth sign-ins (e.g. "Continue with Google") can't set user_metadata at
  // sign-in time, so the signup screen passes the chosen role through here.
  const roleParam = searchParams.get("role");

  // OAuth provider errors (bad_oauth_state, access_denied, …) come back as
  // query params instead of a code. Surface them instead of silently failing.
  const oauthError = searchParams.get("error");
  if (oauthError) {
    const description = searchParams.get("error_description") || oauthError.replace(/_/g, " ");
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Sign-in failed: " + description)}`,
    );
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      const msg = error.message || "This link is invalid or has expired.";

      // PKCE confirmation links carry a one-time code that can only be
      // exchanged in the browser that requested it (the code verifier lives in
      // that browser's cookies). Opening the link in a different browser or
      // device fails here. For confirmation links we know the email from the
      // link itself, so we can still verify the account server-side and send
      // the user to log in normally. Recovery links (`next=/update-password`)
      // need the session, so those keep the error path.
      const emailParam = searchParams.get("email");
      const isPkceFailure = /code verifier|PKCE|storage/i.test(msg);
      if (isPkceFailure && emailParam && nextParam !== "/update-password") {
        const serviceClient = createSupabaseServiceRoleClient();
        // The auth schema isn't exposed to PostgREST, so find the user via the
        // admin API instead of a table query.
        const { data: page } = await serviceClient.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        const target = (page?.users ?? []).find(
          (u: { email?: string | null }) => u.email?.toLowerCase() === emailParam.toLowerCase(),
        );
        if (target && !target.email_confirmed_at) {
          await serviceClient.auth.admin.updateUserById(target.id, {
            email_confirm: true,
          });
          return NextResponse.redirect(`${origin}/login?confirmed=1`);
        }
      }

      // Otherwise surface the real reason (expired/used link, invalid
      // request…) on the verify-email page, which offers resend — instead of
      // a dead generic "auth_callback_failed" that looks like the site is
      // broken.
      return NextResponse.redirect(
        `${origin}/verify-email?error=${encodeURIComponent(msg)}`,
      );
    }

    if (data.user) {
      // OAuth providers (Google) already confirmed the email — mark the auth
      // user confirmed so nothing downstream blocks them on a verification
      // email they'll never receive. Email-confirmation link callbacks are
      // excluded: those users arrive already confirmed by the flow itself.
      const provider = data.user.app_metadata?.provider as string | undefined;
      if (provider && provider !== "email" && !data.user.email_confirmed_at) {
        const serviceClient = createSupabaseServiceRoleClient();
        await serviceClient.auth.admin.updateUserById(data.user.id, {
          email_confirm: true,
        });
      }

      const metaRole = data.user.user_metadata?.role as string | undefined;
      let role = metaRole;
      if (!role && (roleParam === "creator" || roleParam === "business")) {
        role = roleParam;
        const serviceClient = createSupabaseServiceRoleClient();
        await serviceClient.auth.admin.updateUserById(data.user.id, {
          user_metadata: { ...(data.user.user_metadata ?? {}), role },
        });
      }

      if (role === "creator" || role === "business") {
        const serviceClient = createSupabaseServiceRoleClient();

        if (role === "creator") {
          // Create the profile only on FIRST sign-in. Upserting here used to
          // reset onboarding_step to "profile_setup" on every Google sign-in,
          // which forced returning creators back through onboarding.
          const { data: existing } = await serviceClient
            .from("creator_profiles")
            .select("user_id")
            .eq("user_id", data.user.id)
            .maybeSingle();
          if (!existing) {
            await serviceClient.from("creator_profiles").insert({
              user_id: data.user.id,
              display_name: data.user.user_metadata?.display_name || "",
              account_status: "active",
              onboarding_step: "profile_setup",
            });
          }
        } else if (role === "business") {
          const { data: existing } = await serviceClient
            .from("business_profiles")
            .select("user_id")
            .eq("user_id", data.user.id)
            .maybeSingle();
          if (!existing) {
            await serviceClient.from("business_profiles").insert({
              user_id: data.user.id,
              company_name: data.user.user_metadata?.company_name || "",
              account_status: "active",
              onboarding_step: "company_info",
            });
          }
        }

        await serviceClient.from("notification_preferences").upsert({
          user_id: data.user.id,
        }, { onConflict: "user_id" });
      }

      // Existing users (role already set) go straight to the dashboard;
      // brand-new users continue into onboarding. Email-confirmation link
      // callbacks land here too — same rule keeps them out of onboarding.
      //
      // Brand-new accounts (created within the last few minutes) first get
      // the optional authenticator setup step (/auth/setup-mfa) so 2FA can
      // be enabled during sign-up; that page skips straight to `next` for
      // anyone who already has a verified factor or declines.
      const createdAt = data.user.created_at
        ? new Date(data.user.created_at).getTime()
        : 0;
      const isFreshAccount =
        createdAt > 0 && Date.now() - createdAt < 15 * 60 * 1000;
      const next =
        nextParam ||
        (isFreshAccount
          ? "/setup-mfa?next=/onboarding"
          : data.user.app_metadata?.role
            ? "/dashboard"
            : "/onboarding");
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/verify-email?error=${encodeURIComponent("This link is invalid or has expired.")}`,
  );
}

async function createSupabaseServerClient() {
  const { createServerClient } = await import("@supabase/ssr");
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
          }
        },
      },
    },
  );
}
