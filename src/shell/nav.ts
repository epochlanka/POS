import {
  Bell,
  Boxes,
  ChartColumn,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Truck,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react'

export type ScreenId =
  | 'dashboard'
  | 'pos'
  | 'products'
  | 'inventory'
  | 'purchases'
  | 'customers'
  | 'staff'
  | 'reports'
  | 'notifications'
  | 'settings'

export interface NavItem {
  id: ScreenId
  icon: LucideIcon
  /** Shown in the phone bottom bar; the rest go in the "More" sheet. */
  phoneBar?: boolean
  /** Owners and managers only; hidden from cashiers. */
  manage?: boolean
}

// Same modules, same order, same icons on every device.
export const NAV: NavItem[] = [
  { id: 'dashboard', manage: true, icon: LayoutDashboard, phoneBar: true },
  { id: 'pos', icon: ShoppingCart, phoneBar: true },
  { id: 'products', manage: true, icon: Package, phoneBar: true },
  { id: 'inventory', manage: true, icon: Boxes, phoneBar: true },
  { id: 'purchases', manage: true, icon: Truck },
  { id: 'customers', icon: Users },
  { id: 'staff', manage: true, icon: UserCog },
  { id: 'reports', manage: true, icon: ChartColumn },
  { id: 'notifications', icon: Bell },
  { id: 'settings', manage: true, icon: Settings },
]

export const navFor = (canManage: boolean) => NAV.filter((n) => canManage || !n.manage)
