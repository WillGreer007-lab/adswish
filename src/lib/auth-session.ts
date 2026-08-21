/**
 * Single-session enforcement: each login stamps a random `active_session` id
 * in user_metadata (Supabase) and a matching `adswish-session-id` cookie.
 * On every request the middleware compares the two — if they differ, a newer
 * login superseded this one and the user is sent to /session-expired.
 */

export const SESSION_COOKIE = "adswish-session-id";

/**
 * Client-side: call after every successful login to stamp the session.
 * Updates user_metadata via the user's own token (no service role needed)
 * and sets a matching browser cookie.
 */
export async function establishSessionClient(
  supabase: { auth: { updateUser: (opts: { data: Record<string, unknown> }) => Promise<unknown> } },
): Promise<string> {
  const id = crypto.randomUUID();
  await supabase.auth.updateUser({ data: { active_session: id } });
  document.cookie = `${SESSION_COOKIE}=${id}; path=/; max-age=${7 * 24 * 3600}; SameSite=Lax`;
  return id;
}

/**
 * Middleware-side: returns true when this session was superseded by a newer
 * login on another device / tab.
 */
export function isSuperseded(
  cookieValue: string | undefined,
  activeSession: string | undefined,
): boolean {
  if (!cookieValue || !activeSession) return false;
  return cookieValue !== activeSession;
}
