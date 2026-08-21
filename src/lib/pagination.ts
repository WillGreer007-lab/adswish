/**
 * Keyset (cursor) pagination helpers.
 *
 * Keyset pagination uses the sort column + primary key of the last row as the
 * cursor instead of OFFSET. OFFSET degrades to a full scan as the page number
 * grows and can skip/duplicate rows when new rows are inserted between pages;
 * keyset pagination is stable and index-friendly.
 *
 * Cursor format: base64url(JSON { v: sortValue, k: id }).
 */

export type CursorSort = { value: string; key: string };

function toBase64Url(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf8");
}

/** Encode the last row's sort value + primary key into an opaque cursor. */
export function encodeCursor(sortValue: string, key: string): string {
  return toBase64Url(JSON.stringify({ v: sortValue, k: key }));
}

/** Decode a cursor. Returns null when missing or malformed. */
export function decodeCursor(cursor: string | null | undefined): CursorSort | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(cursor)) as { v?: unknown; k?: unknown };
    if (typeof parsed.v !== "string" || typeof parsed.k !== "string") return null;
    return { value: parsed.v, key: parsed.k };
  } catch {
    return null;
  }
}

/**
 * Parse the standard pagination query params. Returns the page size (clamped
 * 1..100, default 50) and the decoded cursor, if any.
 */
export function parsePagination(searchParams: URLSearchParams, defaultLimit = 50): {
  limit: number;
  cursor: CursorSort | null;
} {
  const rawLimit = Number(searchParams.get("limit") ?? defaultLimit);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(100, Math.max(1, Math.floor(rawLimit)))
    : defaultLimit;
  return { limit, cursor: decodeCursor(searchParams.get("cursor")) };
}

/**
 * Build the `next_cursor` from the last row of a result page, so the client can
 * request the following page. Returns null when the page is shorter than the
 * limit (i.e. there are no more rows).
 */
export function nextCursor(
  rows: Array<Record<string, unknown>>,
  limit: number,
  sortColumn: string,
  idColumn = "id",
): string | null {
  if (!rows.length || rows.length < limit) return null;
  const last = rows[rows.length - 1];
  const value = last?.[sortColumn];
  const key = last?.[idColumn];
  if (value === undefined || value === null || key === undefined || key === null) return null;
  return encodeCursor(String(value), String(key));
}
