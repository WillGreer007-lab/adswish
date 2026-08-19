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
