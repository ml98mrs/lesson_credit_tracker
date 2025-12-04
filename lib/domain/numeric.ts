// lib/domain/numeric.ts
//
// Shared numeric normalisers for view fields that may be strings or numbers.

/**
 * Normalise a minute field that may come back as string or number.
 * Returns 0 if value is null/undefined or cannot be parsed.
 */
export function normaliseMinutes(
  value: number | string | null | undefined,
): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Normalise an hour field that may come back as string or number.
 * Returns null if value is null/undefined or cannot be parsed.
 */
export function normaliseHours(
  value: number | string | null | undefined,
): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}
