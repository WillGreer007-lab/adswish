/**
 * Canonical JSON serialization for HMAC signing.
 *
 * JSON.stringify's second argument is a *replacer array*, not a key sorter —
 * passing Object.keys(obj).sort() silently strips any nested object/array
 * keys not listed at the top level (e.g. `metrics` or `accounts` become `{}`).
 * That would make signatures blind to the very data they claim to protect.
 *
 * This helper sorts keys recursively at every level so that two logically
 * equal objects always serialize to the same bytes, while preserving all
 * nested data.
 */

export function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortDeep(record[key]);
    }
    return sorted;
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}
