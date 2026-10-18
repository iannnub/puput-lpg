'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function loginAction(email: string, password: string) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password
  })

  if (error || !data.user) {
    return {
      error: 'Email atau password salah, atau terlalu banyak percobaan login.'
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('role, full_name, is_active')
    .eq('id', data.user.id)
    .single()

  if (profileError || !profile || !profile.is_active) {
    await supabase.auth.signOut()
    return {
      error: 'Akun tidak aktif atau belum terdaftar di profil sistem.'
    }
  }

  // Sinkronisasi metadata peran agar middleware bisa langsung membaca tanpa query database
  if (data.user.user_metadata?.role !== profile.role) {
    await supabase.auth.updateUser({
      data: { role: profile.role, is_active: profile.is_active }
    })
  }

  if (profile.role === 'owner') {
    const { data: settings } = await supabase
      .from('app_settings')
      .select('onboarding_completed')
      .eq('id', 1)
      .single()

    if (settings && !settings.onboarding_completed) {
      redirect('/onboarding')
    }
  }

  redirect('/dashboard')
}

export async function logoutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
