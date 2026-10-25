import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        }
      }
    }
  )

  const {
    data: { user }
  } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Helper agar cookie token yang baru di-refresh tidak hilang saat redirect
  const redirectWithCookies = (targetPath: string) => {
    const redirectResponse = NextResponse.redirect(new URL(targetPath, request.url))
    supabaseResponse.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value)
    })
    return redirectResponse
  }

  const publicPaths = ['/login', '/robots.txt', '/sitemap.xml', '/llms.txt', '/manifest.webmanifest', '/favicon.ico']
  const isPublicPath = publicPaths.includes(pathname) || pathname.endsWith('.txt') || pathname.endsWith('.xml') || pathname.endsWith('.webmanifest')

  if (isPublicPath) {
    if (pathname === '/login' && user) {
      return redirectWithCookies('/dashboard')
    }
    return supabaseResponse
  }

  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return redirectWithCookies('/login')
  }

  const role = (user.app_metadata?.role || user.user_metadata?.role || (user as any).user_role) as 'owner' | 'staff' | undefined
  const isActive = (user.app_metadata?.is_active ?? user.user_metadata?.is_active ?? true) as boolean

  let userRole = role
  let userIsActive = isActive

  // Hanya query database jika peran belum tersemat di token metadata
  if (!userRole) {
    const { data: profile } = await supabase
      .from('users')
      .select('role, is_active')
      .eq('id', user.id)
      .single()

    if (!profile?.is_active) {
      return redirectWithCookies('/login?error=inactive')
    }
    userRole = profile.role
    userIsActive = profile.is_active
  }

  if (!userIsActive) {
    return redirectWithCookies('/login?error=inactive')
  }

  const ownerOnlyPaths = [
    '/onboarding',
    '/employees',
    '/payroll',
    '/reports',
    '/cashflow',
    '/stocks/opname',
    '/api/payroll'
  ]
  const isOwnerPath = ownerOnlyPaths.some(p => pathname.startsWith(p))

  if (isOwnerPath && userRole !== 'owner') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return redirectWithCookies('/dashboard?error=forbidden')
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ]
}
