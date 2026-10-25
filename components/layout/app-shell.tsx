import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getSessionContext } from '@/lib/auth/session'
import { logoutAction } from '@/app/login/actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LogOut } from 'lucide-react'
import { MobileDrawer } from './mobile-drawer'
import { getVisibleNavItems } from './nav-items'

export async function getAuthenticatedContext() {
  const session = await getSessionContext()
  const supabase = await createClient()

  const { data: settings } = await supabase
    .from('app_settings')
    .select('*')
    .eq('id', 1)
    .single()

  return {
    supabase,
    user: session.user,
    profile: session.profile,
    isOwner: session.isOwner,
    settings
  }
}

interface AppShellProps {
  children: React.ReactNode
  activePath?: string
}

export async function AppShell({ children, activePath = '' }: AppShellProps) {
  const { profile, isOwner, settings } = await getAuthenticatedContext()
  const navItems = getVisibleNavItems(isOwner)
  const businessName = settings?.business_name || process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Puput LPG'

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Mobile Sticky Top Bar + Off-canvas Drawer (layar < 768px / md:hidden) */}
      <MobileDrawer
        businessName={businessName}
        fullName={profile.full_name}
        email={profile.email}
        isOwner={isOwner}
        onboardingCompleted={Boolean(settings?.onboarding_completed)}
      />

      {/* Desktop Header (layar >= 768px / hidden md:block) with Liquid Glass */}
      <header className="sticky top-0 z-30 hidden md:block border-b border-slate-200/80 bg-white/85 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-all">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="inline-flex shrink-0 items-center">
              <Image
                src="/logo-transparent.png"
                alt="Logo Puput LPG"
                width={90}
                height={50}
                priority
                className="h-11 w-auto object-contain"
              />
            </Link>
            <div className="border-l border-slate-200 pl-3">
              <div className="text-base font-bold text-slate-900 leading-tight">
                {businessName}
              </div>
              <div className="text-xs text-slate-600">
                Sistem Distribusi & Manajemen Pangkalan
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-semibold text-slate-900">{profile.full_name}</div>
              <div className="text-xs text-slate-600">{profile.email}</div>
            </div>
            <Badge variant={isOwner ? 'default' : 'secondary'}>
              {isOwner ? 'OWNER' : 'STAFF'}
            </Badge>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm" title="Keluar">
                <LogOut className="h-4 w-4" />
                <span>Keluar</span>
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content Area with Desktop Sidebar */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6">
        <aside className="hidden w-60 shrink-0 md:block">
          <nav className="space-y-1.5 rounded-2xl border border-slate-200/80 bg-white/90 backdrop-blur-xl p-3 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
            {navItems.map(item => {
              const isActive =
                activePath === item.href ||
                (item.href !== '/dashboard' && activePath.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 ease-ios-spring active:scale-[0.98] ${
                    isActive
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
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
