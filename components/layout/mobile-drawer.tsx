'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { APP_NAV_ITEMS, NavItem } from './nav-items'
import { logoutAction } from '@/app/login/actions'

interface MobileDrawerProps {
  businessName: string
  fullName: string
  email: string
  isOwner: boolean
  onboardingCompleted?: boolean
}

export function MobileDrawer({
  businessName,
  fullName,
  email,
  isOwner,
  onboardingCompleted = true
}: MobileDrawerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const pathname = usePathname()

  // Tutup drawer ketika rute berpindah
  React.useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Tutup drawer ketika tombol Escape ditekan
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Cegah scroll pada body saat drawer terbuka
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const visibleItems = APP_NAV_ITEMS.filter(item => {
    if (item.ownerOnly && !isOwner) return false
    return true
  })

  return (
    <>
      {/* Sticky Mobile Top Bar (Tinggi 56px, hanya tampil pada layar < 768px / md:hidden) */}
      <div className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image
            src="/logo-transparent.png"
            alt="Logo Puput LPG"
            width={72}
            height={40}
            priority
            className="h-9 w-auto object-contain"
          />
          <div className="border-l border-slate-200 pl-2">
            <span className="text-sm font-bold text-slate-900 leading-tight block">
              {businessName}
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <Badge variant={isOwner ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0.5">
            {isOwner ? 'OWNER' : 'STAFF'}
          </Badge>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="Buka menu navigasi"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Off-canvas Drawer Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden" role="dialog" aria-modal="true">
          {/* Backdrop gelap */}
          <div
            className="fixed inset-0 bg-slate-900/60 transition-opacity"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Panel Drawer (maksimal 320px) */}
          <div className="relative flex w-full max-w-xs flex-1 flex-col bg-white shadow-xl">
            {/* Header Drawer */}
            <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
              <div className="flex items-center gap-2">
                <Image
                  src="/logo-transparent.png"
                  alt="Logo Puput LPG"
                  width={60}
                  height={34}
                  className="h-8 w-auto object-contain"
                />
                <span className="text-sm font-bold text-slate-900 truncate max-w-[170px]">
                  {businessName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Tutup menu navigasi"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Info Pengguna */}
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1 pr-2">
                  <div className="truncate text-sm font-bold text-slate-900">{fullName}</div>
                  <div className="truncate text-xs text-slate-500">{email}</div>
                </div>
                <Badge variant={isOwner ? 'default' : 'secondary'}>
                  {isOwner ? 'OWNER' : 'STAFF'}
                </Badge>
              </div>
            </div>

            {/* Daftar Menu Navigasi */}
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {visibleItems.map(item => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-base font-semibold transition-colors ${
                      isActive
                        ? 'bg-primary text-white'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>

            {/* Footer Drawer: Tombol Keluar */}
            <div className="border-t border-slate-200 p-3">
              <form action={logoutAction}>
                <Button
                  type="submit"
                  variant="outline"
                  className="w-full min-h-11 justify-start gap-3 border-danger/30 text-danger hover:bg-red-50 hover:text-danger"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span>Keluar dari Akun</span>
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
