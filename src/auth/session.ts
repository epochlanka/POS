import { createContext, useContext } from 'react'
import type { Role } from './account'

/** The person who unlocked the till with their PIN. */
export interface StaffMember {
  id: string
  name: string
  role: Role
}

export interface Session {
  /** null in offline demo mode, where there is no login. */
  staff: StaffMember | null
  /** Back to the PIN screen (switch user / step away from the till). */
  lock: () => void
}

export const SessionContext = createContext<Session>({ staff: null, lock: () => {} })

export const useSession = () => useContext(SessionContext)

/** Owners and managers see everything; cashiers only selling screens. */
export const canManage = (s: Session) => !s.staff || s.staff.role !== 'cashier'
