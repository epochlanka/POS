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
}

// Same modules, same order, same icons on every device.
export const NAV: NavItem[] = [
  { id: 'dashboard', icon: LayoutDashboard, phoneBar: true },
  { id: 'pos', icon: ShoppingCart, phoneBar: true },
  { id: 'products', icon: Package, phoneBar: true },
  { id: 'inventory', icon: Boxes, phoneBar: true },
  { id: 'purchases', icon: Truck },
  { id: 'customers', icon: Users },
  { id: 'staff', icon: UserCog },
  { id: 'reports', icon: ChartColumn },
  { id: 'notifications', icon: Bell },
  { id: 'settings', icon: Settings },
]
