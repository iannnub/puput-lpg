import {
  LayoutDashboard,
  FileText,
  Package,
  Users,
  Boxes,
  UserCheck,
  Wallet,
  Landmark,
  BarChart3,
  Settings,
  type LucideIcon
} from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  ownerOnly?: boolean
  requiresIncompleteOnboarding?: boolean
}

export const APP_NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transaksi & Piutang', icon: FileText },
  { href: '/stocks', label: 'Stok Gudang', icon: Boxes },
  { href: '/mitras', label: 'Mitra', icon: Users },
  { href: '/products', label: 'Produk', icon: Package },
  { href: '/employees', label: 'Karyawan', icon: UserCheck, ownerOnly: true },
  { href: '/payroll/process', label: 'Gaji & Kasbon', icon: Wallet, ownerOnly: true },
  { href: '/cashflow', label: 'Kas & Mutasi', icon: Landmark, ownerOnly: true },
  { href: '/reports/profit-loss', label: 'Laporan Laba Rugi', icon: BarChart3, ownerOnly: true },
  {
    href: '/onboarding',
    label: 'Pengaturan Awal',
    icon: Settings,
    ownerOnly: true
  }
]

export function getVisibleNavItems(isOwner: boolean): NavItem[] {
  return APP_NAV_ITEMS.filter(item => {
    if (item.ownerOnly && !isOwner) return false
    return true
  })
}
