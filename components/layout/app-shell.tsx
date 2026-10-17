import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logoutAction } from '@/app/login/actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  LogOut
} from 'lucide-react'

export async function getAuthenticatedContext() {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('id, email, full_name, role, is_active')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active) {
    redirect('/login?error=inactive')
  }

  const { data: settings } = await supabase
    .from('app_settings')
    .select('*')
    .eq('id', 1)
    .single()

  return {
    supabase,
    user,
    profile,
    isOwner: profile.role === 'owner',
    settings
  }
}

interface AppShellProps {
  children: React.ReactNode
  activePath?: string
}

export async function AppShell({ children, activePath = '' }: AppShellProps) {
  const { profile, isOwner, settings } = await getAuthenticatedContext()

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { href: '/transactions', label: 'Transaksi & Piutang', icon: FileText, show: true },
    { href: '/stocks', label: 'Stok Gudang', icon: Boxes, show: true },
    { href: '/mitras', label: 'Mitra', icon: Users, show: true },
    { href: '/products', label: 'Produk', icon: Package, show: true },
    { href: '/employees', label: 'Karyawan', icon: UserCheck, show: isOwner },
    { href: '/payroll/process', label: 'Gaji & Kasbon', icon: Wallet, show: isOwner },
    { href: '/cashflow', label: 'Kas & Mutasi', icon: Landmark, show: isOwner },
    { href: '/reports/profit-loss', label: 'Laporan Laba Rugi', icon: BarChart3, show: isOwner }
  ]

  if (isOwner && settings && !settings.onboarding_completed) {
    navItems.unshift({
      href: '/onboarding',
      label: 'Setup Awal (Onboarding)',
      icon: Settings,
      show: true
    })
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary font-bold text-white"
            >
              LPG
            </Link>
            <div>
              <div className="text-base font-bold text-slate-900">
                {settings?.business_name || process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Pangkalan LPG'}
              </div>
              <div className="text-xs text-slate-600">
                Sistem Distribusi & Buku Besar Operasional
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold text-slate-900">{profile.full_name}</div>
              <div className="text-xs text-slate-600">{profile.email}</div>
            </div>
            <Badge variant={isOwner ? 'default' : 'secondary'}>
              {isOwner ? 'OWNER' : 'STAFF'}
            </Badge>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm" title="Keluar">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Keluar</span>
              </Button>
            </form>
          </div>
        </div>

        {/* Mobile / Horizontal Navigation Bar */}
        <div className="border-t border-slate-200 bg-slate-100 lg:hidden">
          <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2">
            {navItems
              .filter(item => item.show)
              .map(item => {
                const isActive =
                  activePath === item.href ||
                  (item.href !== '/dashboard' && activePath.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                      isActive
                        ? 'bg-primary text-white'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
          </nav>
        </div>
      </header>

      {/* Main Content Area with Desktop Sidebar */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6">
        <aside className="hidden w-60 shrink-0 lg:block">
          <nav className="space-y-1 rounded-md border border-slate-200 bg-white p-3 shadow-sm">
            {navItems
              .filter(item => item.show)
              .map(item => {
                const isActive =
                  activePath === item.href ||
                  (item.href !== '/dashboard' && activePath.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                      isActive
                        ? 'bg-primary text-white'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 space-y-6">{children}</main>
      </div>
    </div>
  )
}
