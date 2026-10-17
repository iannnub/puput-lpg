import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function runRaceConditionTest() {
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  // 1. Ambil UUID produk '3kg' dan mitra sistem 'Pelanggan Umum (Walk-In)' hasil seed.sql
  const { data: product3kg, error: prodErr } = await admin
    .from('products')
    .select('id')
    .eq('name', '3kg')
    .single()
  if (prodErr || !product3kg) throw new Error('Produk 3kg belum di-seed')

  const { data: walkInMitra, error: mitraErr } = await admin
    .from('mitras')
    .select('id')
    .eq('is_system', true)
    .single()
  if (mitraErr || !walkInMitra) throw new Error('Pelanggan Umum (Walk-In) belum di-seed')

  // Simpan stok sebelum tes agar bisa dipulihkan setelah verifikasi
  const { data: beforeStock } = await admin
    .from('stocks')
    .select('gudang_isi, gudang_kosong, dipinjam_mitra, gudang_bocor')
    .eq('product_id', product3kg.id)
    .single()

  // Set stok awal 3kg = 50 via Service Role
  await admin.from('stocks').update({ gudang_isi: 50 }).eq('product_id', product3kg.id)

  // 2. Buat 2 client Staff independen (stateless) dan login (sesuai scripts/seed-users.ts)
  const staffClientA = createClient(url, anonKey, { auth: { persistSession: false } })
  const staffClientB = createClient(url, anonKey, { auth: { persistSession: false } })

  const staffEmail = process.env.SEED_STAFF_EMAIL || 'staff@pangkalan.local'
  const staffPassword = process.env.SEED_STAFF_PASSWORD!

  await Promise.all([
    staffClientA.auth.signInWithPassword({ email: staffEmail, password: staffPassword }),
    staffClientB.auth.signInWithPassword({ email: staffEmail, password: staffPassword })
  ])

  const payload30Tabung = {
    p_mitra_id: walkInMitra.id,
    p_driver_id: null,
    p_items: [
      {
        product_id: product3kg.id,
        qty_sent_isi: 30,
        qty_returned_kosong: 30,
        sell_price: 25000
      }
    ],
    p_payment_method: 'lunas_tunai_laci',
    p_dp_amount: 0,
    p_dp_method: 'tunai_laci',
    p_due_date: null,
    p_transaction_date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()),
    p_recipient_name: 'Uji Konkurensi',
    p_photo_url: null,
    p_notes: 'Race condition test'
  }

  // 3. Tembakkan 2 request di milidetik yang sama
  const [resA, resB] = await Promise.all([
    staffClientA.rpc('rpc_create_transaction_sale', payload30Tabung),
    staffClientB.rpc('rpc_create_transaction_sale', payload30Tabung)
  ])

  const successCount = [resA, resB].filter(r => !r.error).length
  const failedErrors = [resA, resB].filter(r => r.error).map(r => r.error?.message)

  const { data: finalStock } = await admin
    .from('stocks')
    .select('gudang_isi')
    .eq('product_id', product3kg.id)
    .single()

  console.log({ successCount, failedErrors, finalGudangIsi: finalStock?.gudang_isi })

  // Cleanup transaksi uji coba dan pulihkan stok awal
  const winningRes = !resA.error ? resA : resB
  const txId =
    typeof winningRes.data === 'string'
      ? winningRes.data
      : (winningRes.data as { transaction_id?: string } | null)?.transaction_id
  if (txId) {
    await admin.from('cashflows').delete().eq('reference_id', txId)
    await admin.from('payments').delete().eq('transaction_id', txId)
    await admin.from('stock_movements').delete().eq('linked_transaction_id', txId)
    await admin.from('transaction_items').delete().eq('transaction_id', txId)
    await admin.from('transactions').delete().eq('id', txId)
  }
  if (beforeStock) {
    await admin.from('stocks').update(beforeStock).eq('product_id', product3kg.id)
  }

  if (successCount !== 1 || finalStock?.gudang_isi !== 20) {
    throw new Error('Verifikasi Race Condition Gagal!')
  }
}

runRaceConditionTest().catch(err => {
  console.error(err)
  process.exit(1)
})
