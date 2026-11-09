/** UUIDs let every device create records offline without clashing. */
export function newId(): string {
  return crypto.randomUUID()
}

/**
 * Bill numbers carry the counter's prefix (C1, C2, ...) so two counters that
 * are offline at the same time can never issue the same number.
 */
export function formatBillNo(devicePrefix: string, seq: number): string {
  if (!/^[A-Z0-9]{1,4}$/.test(devicePrefix)) {
    throw new Error(`Invalid device prefix: ${devicePrefix}`)
  }
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error(`Invalid bill sequence: ${seq}`)
  }
  return `${devicePrefix}-${String(seq).padStart(6, '0')}`
}
