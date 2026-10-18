import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export interface UserProfile {
  id: string
  email: string
  full_name: string
  role: 'owner' | 'staff'
  is_active: boolean
}

export interface SessionContext {
  user: {
    id: string
    email?: string
    user_metadata?: Record<string, any>
    app_metadata?: Record<string, any>
  }
  profile: UserProfile
  isOwner: boolean
}

export const getSessionContext = cache(async (): Promise<SessionContext> => {
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

  return {
    user,
    profile: profile as UserProfile,
    isOwner: profile.role === 'owner'
  }
})
