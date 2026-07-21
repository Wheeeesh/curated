/**
 * Deterministic fixed UUIDs so the same seed works identically in the demo
 * adapter and in the generated Supabase seed.sql.
 */
function block(prefix: string, n: number): string {
  return `${prefix}0000000-0000-4000-a000-${String(n).padStart(12, '0')}`
}

export const memberId = (n: number) => block('1', n)
export const placeId = (n: number) => block('2', n)
export const reviewId = (n: number) => block('3', n)
export const creditId = (n: number) => block('4', n)
export const inviteId = (n: number) => block('5', n)

/** Fixed reference date so seed data is fully deterministic. */
export const SEED_EPOCH = Date.parse('2026-06-01T12:00:00Z')

export function seedDate(daysAgo: number): string {
  return new Date(SEED_EPOCH - daysAgo * 86_400_000).toISOString()
}
