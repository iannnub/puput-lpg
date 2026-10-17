import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi di .env.local')
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
})

async function cleanBucket(bucketName: string) {
  const { data: files } = await admin.storage.from(bucketName).list('', { limit: 1000 })
  if (!files || files.length === 0) return

  for (const item of files) {
    if (item.id === null) {
      const { data: subFiles } = await admin.storage.from(bucketName).list(item.name, { limit: 1000 })
      if (subFiles && subFiles.length > 0) {
        const paths = subFiles.map(f => `${item.name}/${f.name}`)
        await admin.storage.from(bucketName).remove(paths)
      }
    } else {
      await admin.storage.from(bucketName).remove([item.name])
    }
  }
}

async function main() {
  console.log('Membersihkan seluruh data dummy hasil pengujian...')

  // 1. Bersihkan file bukti dummy di Storage
  await cleanBucket('transaction-proofs')
  await cleanBucket('payment-proofs')

  // 2. Hapus tabel-tabel transaksi & jurnal dalam urutan foreign key yang aman
  const tablesToClear = [
    'audit_logs',
    'kasbon_repayments',
    'kasbons',
    'payrolls',
    'cashflows',
    'payments',
    'stock_movements',
    'transaction_items',
    'transactions',
    'mitra_product_balances',
    'mitra_product_settings',
    'employees'
  ]

  for (const tbl of tablesToClear) {
    const { error } = await admin
      .from(tbl as any)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) {
      throw new Error(`Gagal membersihkan tabel ${tbl}: ${error.message}`)
    }
  }

  // Bersihkan invoice_counters (primary key: date)
  const { error: counterErr } = await admin
    .from('invoice_counters')
    .delete()
    .neq('date', '1970-01-01')
  if (counterErr) {
    throw new Error(`Gagal membersihkan invoice_counters: ${counterErr.message}`)
  }

  // 3. Hapus mitra dummy (pertahankan hanya Pelanggan Umum dengan is_system = true)
  const { error: mitraErr } = await admin
    .from('mitras')
    .delete()
    .eq('is_system', false)
  if (mitraErr) {
    throw new Error(`Gagal membersihkan mitra dummy: ${mitraErr.message}`)
  }

  // 4. Hapus produk dummy di luar 3 produk standar ('3kg', '12kg', 'Bright Gas 5.5kg')
  const { data: allProducts } = await admin.from('products').select('id, name')
  const standardNames = new Set(['3kg', '12kg', 'Bright Gas 5.5kg'])
  for (const p of allProducts ?? []) {
    if (!standardNames.has(p.name)) {
      await admin.from('stocks').delete().eq('product_id', p.id)
      await admin.from('products').delete().eq('id', p.id)
    }
  }

  // 5. Reset stok 4-keranjang produk standar menjadi 0
  const { error: stockErr } = await admin
    .from('stocks')
    .update({
      gudang_isi: 0,
      gudang_kosong: 0,
      gudang_bocor: 0,
      dipinjam_mitra: 0,
      updated_at: new Date().toISOString()
    })
    .neq('product_id', '00000000-0000-0000-0000-000000000000')
  if (stockErr) {
    throw new Error(`Gagal mereset stocks: ${stockErr.message}`)
  }

  // 6. Reset status onboarding_completed = false agar siap dipakai dari awal (Flow 0)
  const { error: settingsErr } = await admin
    .from('app_settings')
    .update({
      onboarding_completed: false,
      onboarding_completed_at: null,
      onboarding_completed_by: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', 1)
  if (settingsErr) {
    throw new Error(`Gagal mereset app_settings: ${settingsErr.message}`)
  }

  console.log('Pembersihan data dummy selesai. Database kembali bersih dan siap digunakan.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
