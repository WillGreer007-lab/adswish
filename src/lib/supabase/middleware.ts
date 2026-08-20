import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // OAuth fallback: if Supabase delivered the code to the site root (site_url)
  // because /auth/callback isn't in the project's redirect allowlist, forward it
  // to the exchange route so sign-in still completes. (Guard the pathname so we
  // don't re-forward /auth/callback itself — that would loop.)
  if (
    request.nextUrl.pathname !== "/auth/callback" &&
    request.nextUrl.searchParams.has("code")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const user = await supabase.auth.getUser();

  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (user.error || !user.data.user) {
      const url = request.nextUrl.clone();
      const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;
      url.pathname = "/login";
      url.search = "";
      // Preserve the protected destination so signing in from /admin or
      // /admin/mfa-setup returns the user to the MFA screen instead of
      // silently sending them to the generic dashboard.
      url.searchParams.set("redirect", returnTo);
      return NextResponse.redirect(url);
    }

    const role = user.data.user.app_metadata?.role;
    if (role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    // MFA gate: admins must reach AAL2 before touching admin routes. The
    // enrollment page itself must be reachable at AAL1, so it is exempt here.
    // (This lives in middleware rather than the admin layout because the
    // layout also wraps /admin/mfa-setup — checking there caused an infinite
    // redirect loop.)
    if (request.nextUrl.pathname !== "/admin/mfa-setup") {
      const { data: aalData } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!aalData || aalData.currentLevel !== "aal2") {
        const url = request.nextUrl.clone();
        url.pathname = "/admin/mfa-setup";
        return NextResponse.redirect(url);
      }
    }
  }

  const userRole =
    user.data.user?.app_metadata?.role ?? user.data.user?.user_metadata?.role;
  const isProtectedAppRequest =
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/onboarding") ||
    request.nextUrl.pathname.startsWith("/api/internal");

  // MFA gate for every account (not just admins): anyone with a verified
  // authenticator (TOTP) factor must reach AAL2 before using app routes —
  // covers password, one-time-code, Google, and (later) Microsoft logins,
  // since an OAuth callback lands with an AAL1 session. Auth pages and the
  // /mfa challenge page itself are exempt to avoid redirect loops.
  if (!user.error && user.data.user) {
    const hasVerifiedFactor = (user.data.user.factors ?? []).some(
      (f) => f.status === "verified" && f.factor_type === "totp",
    );
    const isAuthPage =
      request.nextUrl.pathname.startsWith("/auth") ||
      request.nextUrl.pathname.startsWith("/login") ||
      request.nextUrl.pathname.startsWith("/signup") ||
      request.nextUrl.pathname.startsWith("/verify-email") ||
      request.nextUrl.pathname.startsWith("/update-password");
    const isProtectedAppRequest =
      request.nextUrl.pathname.startsWith("/dashboard") ||
      request.nextUrl.pathname.startsWith("/onboarding") ||
      request.nextUrl.pathname.startsWith("/api/internal");
    if (hasVerifiedFactor && !isAuthPage && isProtectedAppRequest) {
      const { data: aalData } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!aalData || aalData.currentLevel !== "aal2") {
        const url = request.nextUrl.clone();
        url.pathname = "/mfa";
        url.search = "";
        url.searchParams.set(
          "next",
          `${request.nextUrl.pathname}${request.nextUrl.search}`,
        );
        return NextResponse.redirect(url);
      }
    }
  }

  // Suspended/banned profiles cannot use dashboard pages or internal APIs.
  // Admins bypass this check so an administrator can restore an account.
  if (!user.error && user.data.user && userRole !== "admin" && isProtectedAppRequest) {
    const profileTable = userRole === "creator" ? "creator_profiles" : userRole === "business" ? "business_profiles" : null;
    if (profileTable) {
      const { data: profile } = await supabase
        .from(profileTable)
        .select("account_status")
        .eq("user_id", user.data.user.id)
        .maybeSingle();
      if (profile?.account_status === "suspended" || profile?.account_status === "banned") {
        if (request.nextUrl.pathname.startsWith("/api/")) {
          return NextResponse.json(
            { error: `Account is ${profile.account_status}`, code: "account_suspended" },
            { status: 403 },
          );
        }
        const url = request.nextUrl.clone();
        url.pathname = "/account-suspended";
        url.search = `?status=${profile.account_status}`;
        return NextResponse.redirect(url);
      }
    }
  }

  if (
    !user.error &&
    user.data.user &&
    request.nextUrl.pathname.startsWith("/login")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
