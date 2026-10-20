'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function verifyOwnerCaller() {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Sesi login tidak ditemukan.', callerId: null }
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'owner' || !profile.is_active) {
    return { error: 'Hanya Owner aktif yang memiliki akses ke fitur ini.', callerId: null }
  }

  return { error: null, callerId: user.id }
}

export async function createEmployeeAction(data: {
  name: string
  position: string
  base_salary: number
  allowance: number
  bonus_per_tabung: number
  join_date: string // 'YYYY-MM-DD'
}) {
  const authCheck = await verifyOwnerCaller()
  if (authCheck.error) {
    return { error: authCheck.error }
  }

  const supabase = await createClient()

  const { error } = await supabase.from('employees').insert({
    name: data.name.trim(),
    position: data.position.trim(),
    base_salary: Math.floor(data.base_salary),
    allowance: Math.floor(data.allowance),
    bonus_per_tabung: Math.floor(data.bonus_per_tabung),
    join_date: data.join_date,
    is_active: true
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/employees')
  revalidatePath('/payroll/process')
  revalidatePath('/payroll/kasbon')
  return { success: true }
}

export async function updateEmployeeAction(data: {
  id: string
  name: string
  position: string
  base_salary: number
  allowance: number
  bonus_per_tabung: number
  join_date: string
  is_active: boolean
}) {
  const authCheck = await verifyOwnerCaller()
  if (authCheck.error) {
    return { error: authCheck.error }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('employees')
    .update({
      name: data.name.trim(),
      position: data.position.trim(),
      base_salary: Math.floor(data.base_salary),
      allowance: Math.floor(data.allowance),
      bonus_per_tabung: Math.floor(data.bonus_per_tabung),
      join_date: data.join_date,
      is_active: data.is_active,
      updated_at: new Date().toISOString()
    })
    .eq('id', data.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/employees')
  revalidatePath('/payroll/process')
  revalidatePath('/payroll/kasbon')
  return { success: true }
}

export async function createSystemUserAction(data: {
  email: string
  password: string
  full_name: string
  role: 'owner' | 'staff'
}) {
  const authCheck = await verifyOwnerCaller()
  if (authCheck.error) {
    return { error: authCheck.error }
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      error:
        'SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi pada environment server untuk membuat akun login baru.'
    }
  }

  const email = data.email.trim().toLowerCase()
  const fullName = data.full_name.trim()
  const password = data.password

  if (!email || !fullName || password.length < 6) {
    return { error: 'Email, nama lengkap, dan password (minimal 6 karakter) wajib diisi.' }
  }

  const supabaseAdmin = createAdminClient()

  const { data: created, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName }
  })

  if (authErr || !created.user) {
    return { error: authErr?.message ?? 'Gagal membuat akun di Supabase Auth.' }
  }

  const { error: profileErr } = await supabaseAdmin.from('users').upsert({
    id: created.user.id,
    email,
    full_name: fullName,
    role: data.role,
    is_active: true
  })

  if (profileErr) {
    return { error: profileErr.message }
  }

  revalidatePath('/employees')
  return { success: true }
}

export async function updateSystemUserAction(data: {
  id: string
  full_name: string
  role: 'owner' | 'staff'
  is_active: boolean
  new_password?: string
}) {
  const authCheck = await verifyOwnerCaller()
  if (authCheck.error) {
    return { error: authCheck.error }
  }

  if (data.id === authCheck.callerId && (!data.is_active || data.role !== 'owner')) {
    return {
      error: 'Anda tidak dapat menonaktifkan atau menurunkan role akun Owner yang sedang Anda gunakan.'
    }
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      error:
        'SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi pada environment server untuk mengubah akun login.'
    }
  }

  const fullName = data.full_name.trim()
  if (!fullName) {
    return { error: 'Nama lengkap pengguna wajib diisi.' }
  }

  const supabaseAdmin = createAdminClient()

  const updateAuthPayload: {
    user_metadata: { full_name: string }
    password?: string
  } = {
    user_metadata: { full_name: fullName }
  }

  if (data.new_password && data.new_password.trim().length > 0) {
    if (data.new_password.trim().length < 6) {
      return { error: 'Password baru minimal harus 6 karakter.' }
    }
    updateAuthPayload.password = data.new_password.trim()
  }

  const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(
    data.id,
    updateAuthPayload
  )

  if (authErr) {
    return { error: authErr.message }
  }

  const { error: profileErr } = await supabaseAdmin
    .from('users')
    .update({
      full_name: fullName,
      role: data.role,
      is_active: data.is_active
    })
    .eq('id', data.id)

  if (profileErr) {
    return { error: profileErr.message }
  }

  revalidatePath('/employees')
  return { success: true }
}
