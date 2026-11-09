/**
 * Owner accounts (Supabase Auth, email + password) and linking a device to a
 * shop. Only these steps need the internet. Once a device is linked, the app
 * works offline: the shop, branch and counter ids live in device_settings
 * and staff unlock the till with a PIN.
 */
import type { AuthError, User } from '@supabase/supabase-js'
import { connectSync, db, getSetting, setSetting } from '../db/database'
import { supabase } from '../db/connector'
import { newId } from '../lib/ids'

export type Role = 'owner' | 'manager' | 'cashier'

export interface MyShop {
  id: string
  name: string
  address: string | null
  phone: string | null
  role: Role
}

/** Error with a key under auth.err.* for the message shown to the user. */
export class AccountError extends Error {
  readonly key: string
  constructor(key: string, detail?: string) {
    super(detail ?? key)
    this.key = key
  }
}

const KNOWN = new Set([
  'invalid_credentials',
  'email_not_confirmed',
  'user_already_exists',
  'email_exists',
  'weak_password',
  'over_email_send_rate_limit',
  'over_request_rate_limit',
  'otp_expired',
  'same_password',
  'signup_disabled',
])

function fail(err: AuthError | { code?: string; message: string; status?: number } | null): never {
  const code = (err as { code?: string } | null)?.code ?? ''
  const status = (err as { status?: number } | null)?.status
  if (!navigator.onLine || status === 0 || /fetch|network/i.test(err?.message ?? '')) throw new AccountError('offline', err?.message)
  if (code === 'email_exists') throw new AccountError('user_already_exists', err?.message)
  throw new AccountError(KNOWN.has(code) ? code : 'generic', err?.message)
}

function client() {
  if (!supabase) throw new AccountError('generic', 'Supabase is not configured')
  return supabase
}

export async function signIn(email: string, password: string): Promise<User> {
  const { data, error } = await client().auth.signInWithPassword({ email: email.trim(), password })
  if (error) fail(error)
  return data.user
}

/** Returns the user if signed in straight away, or null if the email must be confirmed first. */
export async function signUp(email: string, password: string): Promise<User | null> {
  const { data, error } = await client().auth.signUp({ email: email.trim(), password })
  if (error) fail(error)
  // With email confirmation on, an existing address comes back with no identities.
  if (data.user && data.user.identities?.length === 0) throw new AccountError('user_already_exists')
  return data.session ? data.user : null
}

export async function verifySignUpCode(email: string, code: string): Promise<User> {
  const { data, error } = await client().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
  if (error || !data.user) fail(error ?? { message: 'no user' })
  return data.user
}

export async function resendSignUpCode(email: string): Promise<void> {
  const { error } = await client().auth.resend({ type: 'signup', email: email.trim() })
  if (error) fail(error)
}

export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await client().auth.resetPasswordForEmail(email.trim())
  if (error) fail(error)
}

export async function resetPassword(email: string, code: string, password: string): Promise<User> {
  const sb = client()
  const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' })
  if (error) fail(error)
  const { data, error: e2 } = await sb.auth.updateUser({ password })
  if (e2) fail(e2)
  return data.user
}

export async function currentUser(): Promise<User | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user ?? null
}

export async function myShops(): Promise<MyShop[]> {
  const { data, error } = await client().from('shop_members').select('role, shops(id, name, address, phone)')
  if (error) fail(error)
  type Row = { role: Role; shops: Omit<MyShop, 'role'> | null }
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.shops)
    .map((r) => ({ ...r.shops!, role: r.role }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function createShop(name: string, address: string, phone: string): Promise<MyShop> {
  const { data, error } = await client().rpc('create_shop', { p_name: name, p_address: address, p_phone: phone })
  if (error) fail(error)
  return { id: data as string, name: name.trim(), address: address.trim() || null, phone: phone.trim() || null, role: 'owner' }
}

/**
 * Makes this device a counter of `shop`: registers it (prefix C1, C2…, so
 * offline counters never issue the same bill number), wipes any other local
 * data, and stores the ids the rest of the app reads via deviceContext().
 */
export async function linkDevice(shop: MyShop, user: User): Promise<void> {
  if (shop.role === 'cashier') throw new AccountError('cashier_device')
  const sb = client()

  const { data: branch, error: bErr } = await sb.from('branches').select('id').eq('shop_id', shop.id).order('created_at').limit(1).single()
  if (bErr || !branch) fail(bErr ?? { message: 'shop has no branch' })

  const { data: devices, error: dErr } = await sb.from('devices').select('id, prefix').eq('shop_id', shop.id)
  if (dErr) fail(dErr)

  // Re-linking the same device to the same shop keeps its counter number.
  const oldShop = await getSetting('shop_id')
  const oldDevice = await getSetting('device_id')
  let device = oldShop === shop.id ? devices.find((d) => d.id === oldDevice) : undefined

  for (let n = 1; !device && n < 1000; n++) {
    const prefix = `C${n}`
    if (devices.some((d) => d.prefix === prefix)) continue
    const row = { id: newId(), shop_id: shop.id, branch_id: branch.id, prefix, name: `Counter ${n}` }
    const { error } = await sb.from('devices').insert(row)
    if (!error) device = row
    else if (error.code !== '23505') fail(error) // 23505: another device took this number just now
  }
  if (!device) throw new AccountError('generic', 'no free counter number')

  await db.disconnectAndClear()
  const settings: Record<string, string> = {
    shop_id: shop.id,
    branch_id: branch.id,
    device_id: device.id,
    device_prefix: device.prefix,
    shop_name: shop.name,
    shop_address: shop.address ?? '',
    shop_phone: shop.phone ?? '',
    account_user_id: user.id,
    account_email: user.email ?? '',
    account_role: shop.role,
  }
  for (const [k, v] of Object.entries(settings)) await setSetting(k, v)
  await connectSync()
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut({ scope: 'local' })
}

/** Signs out and removes this shop's data from the device. */
export async function unlinkDevice(): Promise<void> {
  await supabase?.auth.signOut({ scope: 'local' })
  await db.disconnectAndClear()
}

export interface LinkedAccount {
  userId: string
  email: string
  role: Role
  shopId: string
  shopName: string
  devicePrefix: string
}

export async function linkedAccount(): Promise<LinkedAccount | null> {
  const [userId, email, role, shopId, shopName, devicePrefix] = await Promise.all(
    ['account_user_id', 'account_email', 'account_role', 'shop_id', 'shop_name', 'device_prefix'].map(getSetting),
  )
  if (!userId || !shopId) return null
  return { userId, email: email ?? '', role: (role as Role) ?? 'owner', shopId, shopName: shopName ?? '', devicePrefix: devicePrefix ?? '' }
}

/** Sales and other changes saved on this device that haven't reached the cloud. */
export async function unsyncedChanges(): Promise<number> {
  return (await db.getUploadQueueStats()).count
}
