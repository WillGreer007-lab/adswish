import { NextResponse, type NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/onboarding";
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

    if (!error && data.user) {
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

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
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
