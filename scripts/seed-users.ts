import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi di .env.local')
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
})

async function seedUser(
  email: string,
  password: string,
  role: 'owner' | 'staff',
  fullName: string
) {
  // Cek apakah user sudah ada di auth.users
  const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers()
  if (listErr) throw listErr

  let userId = listData.users.find(u => u.email?.toLowerCase() === email.toLowerCase())?.id

  if (!userId) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role, is_active: true },
      user_metadata: { full_name: fullName, role, is_active: true }
    })
    if (error) throw error
    userId = data.user.id
  } else {
    // Update password & confirm email jika sudah ada agar konsisten
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      app_metadata: { role, is_active: true },
      user_metadata: { full_name: fullName, role, is_active: true }
    })
    if (updateErr) throw updateErr
  }

  const { error: profileError } = await supabaseAdmin.from('users').upsert({
    id: userId,
    email,
    role,
    full_name: fullName,
    is_active: true
  })

  if (profileError) throw profileError
  console.log(`Seeded ${role}: ${email} (${userId})`)
}

async function main() {
  const adminPw = process.env.SEED_OWNER_PASSWORD || 'adminlpg123'
  const staffPw = process.env.SEED_STAFF_PASSWORD || 'staff123'

  // Admin / Owner
  await seedUser('adminlpg@pangkalan.local', adminPw, 'owner', 'Admin Pangkalan LPG')
  await seedUser('owner@pangkalan.local', adminPw, 'owner', 'Owner Pangkalan')

  // Staff
  await seedUser('staff@pangkalan.local', staffPw, 'staff', 'Staff Gudang')
  await seedUser('stafflpg@pangkalan.local', staffPw, 'staff', 'Staff Gudang')
}

main().catch(err => {
  console.error('Failed to seed users:', err)
  process.exit(1)
})
