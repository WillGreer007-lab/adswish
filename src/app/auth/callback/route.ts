import { NextResponse, type NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { SESSION_COOKIE } from "@/lib/auth-session";
import { randomUUID } from "node:crypto";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const roleParam = searchParams.get("role");

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
      const emailParam = searchParams.get("email");
      const isPkceFailure = /code verifier|PKCE|storage/i.test(msg);
      if (isPkceFailure && emailParam && nextParam !== "/update-password") {
        const serviceClient = createSupabaseServiceRoleClient();
        const { data: page } = await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const target = (page?.users ?? []).find(
          (u: { email?: string | null }) => u.email?.toLowerCase() === emailParam.toLowerCase(),
        );
        if (target && !target.email_confirmed_at) {
          await serviceClient.auth.admin.updateUserById(target.id, { email_confirm: true });
          return NextResponse.redirect(`${origin}/login?confirmed=1`);
        }
      }
      return NextResponse.redirect(
        `${origin}/verify-email?error=${encodeURIComponent(msg)}`,
      );
    }

    if (data.user) {
      const provider = data.user.app_metadata?.provider as string | undefined;
      if (provider && provider !== "email" && !data.user.email_confirmed_at) {
        const serviceClient = createSupabaseServiceRoleClient();
        await serviceClient.auth.admin.updateUserById(data.user.id, { email_confirm: true });
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
          const { data: existing } = await serviceClient
            .from("creator_profiles").select("user_id").eq("user_id", data.user.id).maybeSingle();
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
            .from("business_profiles").select("user_id").eq("user_id", data.user.id).maybeSingle();
          if (!existing) {
            await serviceClient.from("business_profiles").insert({
              user_id: data.user.id,
              company_name: data.user.user_metadata?.company_name || "",
              account_status: "active",
              onboarding_step: "company_info",
            });
          }
        }
        await serviceClient.from("notification_preferences").upsert({ user_id: data.user.id }, { onConflict: "user_id" });
      }

      const createdAt = data.user.created_at ? new Date(data.user.created_at).getTime() : 0;
      const isFreshAccount = createdAt > 0 && Date.now() - createdAt < 15 * 60 * 1000;
      const next = nextParam || (isFreshAccount ? "/setup-mfa?next=/onboarding" : data.user.app_metadata?.role ? "/dashboard" : "/onboarding");

      // Single-session enforcement: stamp a new session id so any old session is superseded.
      const sessionId = randomUUID();
      const serviceClient = createSupabaseServiceRoleClient();
      const { data: currentUser } = await serviceClient.auth.admin.getUserById(data.user.id);
      await serviceClient.auth.admin.updateUserById(data.user.id, {
        user_metadata: { ...(currentUser?.user?.user_metadata ?? {}), active_session: sessionId },
      });
      const response = NextResponse.redirect(`${origin}${next}`);
      response.cookies.set(SESSION_COOKIE, sessionId, { path: "/", maxAge: 7 * 24 * 3600, sameSite: "lax" });
      return response;
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
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    },
  );
}
