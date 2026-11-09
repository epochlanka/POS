/**
 * Sales are stored with UTC ISO timestamps. Reports group them by the shop's
 * local day/hour/month, so these helpers build local boundaries and the
 * SQLite modifier that shifts UTC to local time ("+330 minutes" in Sri Lanka).
 */

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

/** Modifier for SQLite date functions: UTC → local wall-clock time. */
export function sqliteLocalModifier(d = new Date()): string {
  const minutes = -d.getTimezoneOffset()
  return `${minutes >= 0 ? '+' : ''}${minutes} minutes`
}

/** Local calendar keys matching strftime('%Y-%m-%d') / ('%Y-%m'). */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** Percentage change, or null when there's nothing to compare against. */
export function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 100)
}
