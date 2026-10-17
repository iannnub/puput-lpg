import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { sign } from 'jsonwebtoken'

export async function POST(request: NextRequest) {
  // 1. Pastikan pemanggil saat ini sudah login (Staff/Owner)
  const serverSupabase = await createServerClient()
  const {
    data: { user: caller }
  } = await serverSupabase.auth.getUser()
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { email, password, mitraId, reason } = body ?? {}
  if (!email || !password || !mitraId || !reason?.trim()) {
    return NextResponse.json(
      { error: 'Email, password, mitra, dan alasan wajib diisi' },
      { status: 400 }
    )
  }

  const adminSupabase = createAdminClient()

  // 2. Proteksi Brute-Force: Cek jumlah percobaan gagal oleh Staff ini dalam 15 menit terakhir
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const { count: failedCount } = await adminSupabase
    .from('audit_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', caller.id)
    .eq('action', 'verify_owner_failed')
    .gte('created_at', fifteenMinsAgo)

  if ((failedCount ?? 0) >= 5) {
    return NextResponse.json(
      { error: 'Terlalu banyak percobaan otorisasi gagal. Tunggu 15 menit.' },
      { status: 429 }
    )
  }

  // 3. Gunakan client STATELESS (persistSession: false) agar cookie sesi Staff TIDAK berubah jadi Owner
  const statelessAuthClient = createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    }
  )

  const { data: authData, error: authError } = await statelessAuthClient.auth.signInWithPassword({
    email: String(email).trim(),
    password: String(password)
  })

  if (authError || !authData.user) {
    await adminSupabase.from('audit_logs').insert({
      user_id: caller.id,
      action: 'verify_owner_failed',
      target_table: 'mitras',
      target_id: mitraId,
      reason: 'Invalid owner credentials'
    })
    return NextResponse.json({ error: 'Kredensial Owner tidak valid' }, { status: 401 })
  }

  // 4. Verifikasi role harus 'owner' dan simpan one-time token hash di audit_logs via Service Role
  const { data: ownerProfile } = await adminSupabase
    .from('users')
    .select('role, is_active')
    .eq('id', authData.user.id)
    .single()

  if (!ownerProfile?.is_active || ownerProfile.role !== 'owner') {
    await adminSupabase.from('audit_logs').insert({
      user_id: caller.id,
      action: 'verify_owner_failed',
      target_table: 'mitras',
      target_id: mitraId,
      reason: 'Authenticated user is not an active owner'
    })
    return NextResponse.json({ error: 'Akun tersebut bukan Owner aktif' }, { status: 403 })
  }

  const temporaryToken = sign(
    {
      ownerId: authData.user.id,
      callerId: caller.id,
      mitraId,
      nonce: randomBytes(16).toString('hex'),
      purpose: 'override_tempo'
    },
    process.env.JWT_SECRET!,
    { expiresIn: '5m' }
  )

  const tokenHash = createHash('sha256').update(temporaryToken).digest('hex')
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

  const { error: logErr } = await adminSupabase.from('audit_logs').insert({
    user_id: authData.user.id,
    action: 'issue_override_token',
    target_table: 'mitras',
    target_id: mitraId,
    reason: String(reason).trim(),
    new_value: {
      token_hash: tokenHash,
      requested_by: caller.id,
      expires_at: expiresAt,
      used: false
    }
  })

  if (logErr) {
    return NextResponse.json({ error: 'Gagal menerbitkan token override' }, { status: 500 })
  }

  return NextResponse.json({ temporaryToken, expiresAt })
}
