import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ownerEmail = process.env.SEED_OWNER_EMAIL || 'owner@pangkalan.local'
const ownerPassword = process.env.SEED_OWNER_PASSWORD!

const SAMPLE_WEBP_BASE64 =
  'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA='

async function cleanAndSeed() {
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const ownerClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
  await ownerClient.auth.signInWithPassword({ email: ownerEmail, password: ownerPassword })

  // 1. Bersihkan sisa data uji "MITRA UJI OTOMATIS FASE 6" & "SUPIR UJI FASE 6" & "Uji Konkurensi"
  const { data: testMitras } = await admin
    .from('mitras')
    .select('id')
    .ilike('name', '%MITRA UJI%')

  const testMitraIds = (testMitras ?? []).map(m => m.id)

  const { data: testTxs } = await admin
    .from('transactions')
    .select('id')
    .or('recipient_name.ilike.%Uji%,notes.ilike.%Race condition%')

  const txIdsToClean = new Set<string>((testTxs ?? []).map(t => t.id))
  if (testMitraIds.length > 0) {
    const { data: mTxs } = await admin
      .from('transactions')
      .select('id')
      .in('mitra_id', testMitraIds)
    for (const t of mTxs ?? []) txIdsToClean.add(t.id)
  }

  const allCleanTxIds = Array.from(txIdsToClean)
  if (allCleanTxIds.length > 0) {
    await admin.from('tempo_override_logs').delete().in('transaction_id', allCleanTxIds)
    await admin.from('cashflows').delete().in('reference_id', allCleanTxIds)
    await admin.from('payments').delete().in('transaction_id', allCleanTxIds)
    await admin.from('stock_movements').delete().in('linked_transaction_id', allCleanTxIds)
    await admin.from('transaction_items').delete().in('transaction_id', allCleanTxIds)
    await admin.from('transactions').delete().in('id', allCleanTxIds)
  }

  if (testMitraIds.length > 0) {
    await admin.from('mitra_product_balances').delete().in('mitra_id', testMitraIds)
    await admin.from('mitras').delete().in('id', testMitraIds)
  }

  await admin.from('employees').delete().ilike('name', '%SUPIR UJI%')
  await admin.from('cashflows').delete().ilike('description', '%Modal Uji%')

  // 2. Pastikan Warung Berkah Jaya & Budi Santoso ada
  const { data: mitraBerkah } = await admin
    .from('mitras')
    .select('id')
    .eq('name', 'Warung Berkah Jaya')
    .single()

  const { data: walkInMitra } = await admin
    .from('mitras')
    .select('id')
    .eq('is_system', true)
    .single()

  const { data: driverBudi } = await admin
    .from('employees')
    .select('id')
    .eq('name', 'Budi Santoso')
    .single()

  const { data: products } = await admin.from('products').select('id, name, sell_price')
  const prod3kg = products!.find(p => p.name === '3kg')!
  const prod12kg = products!.find(p => p.name === '12kg')!
  const prod55kg = products!.find(p => p.name.includes('5.5'))!

  // Set stok bersih sesuai hasil onboarding sebelum transaksi sampel
  await admin
    .from('stocks')
    .update({ gudang_isi: 180, gudang_kosong: 40, dipinjam_mitra: 0, gudang_bocor: 2 })
    .eq('product_id', prod3kg.id)
  await admin
    .from('stocks')
    .update({ gudang_isi: 45, gudang_kosong: 15, dipinjam_mitra: 0, gudang_bocor: 0 })
    .eq('product_id', prod12kg.id)
  await admin
    .from('stocks')
    .update({ gudang_isi: 35, gudang_kosong: 10, dipinjam_mitra: 0, gudang_bocor: 0 })
    .eq('product_id', prod55kg.id)

  const todayWib = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
  const webpBuffer = Buffer.from(SAMPLE_WEBP_BASE64, 'base64')
  const txProofPath = `audit-sample/nota-berkah.webp`
  const payProofPath = `audit-sample/cicilan-berkah.webp`

  await ownerClient.storage
    .from('transaction-proofs')
    .upload(txProofPath, webpBuffer, { contentType: 'image/webp', upsert: true })
  await ownerClient.storage
    .from('payment-proofs')
    .upload(payProofPath, webpBuffer, { contentType: 'image/webp', upsert: true })

  // Cek apakah transaksi Warung Berkah Jaya sudah ada
  const { data: existingBerkahTx } = await admin
    .from('transactions')
    .select('id')
    .eq('mitra_id', mitraBerkah!.id)
    .limit(1)
    .maybeSingle()

  if (!existingBerkahTx) {
    // 1. Transaksi Walk-In Lunas Tunai
    await ownerClient.rpc('rpc_create_transaction_sale', {
      p_mitra_id: walkInMitra!.id,
      p_driver_id: null,
      p_items: [
        {
          product_id: prod3kg.id,
          qty_sent_isi: 20,
          qty_returned_kosong: 20,
          sell_price: Number(prod3kg.sell_price)
        }
      ],
      p_payment_method: 'lunas_tunai_laci',
      p_dp_amount: 0,
      p_dp_method: 'tunai_laci',
      p_due_date: null,
      p_transaction_date: todayWib,
      p_recipient_name: 'Pembeli Walk-In Gudang',
      p_photo_url: null,
      p_notes: 'Penjualan langsung di gudang pangkalan'
    })

    // 2. Transaksi Warung Berkah Jaya (Tempo dengan DP + Supir Budi Santoso)
    const { data: berkahTxId } = await ownerClient.rpc('rpc_create_transaction_sale', {
      p_mitra_id: mitraBerkah!.id,
      p_driver_id: driverBudi!.id,
      p_items: [
        {
          product_id: prod3kg.id,
          qty_sent_isi: 30,
          qty_returned_kosong: 25,
          sell_price: Number(prod3kg.sell_price)
        },
        {
          product_id: prod12kg.id,
          qty_sent_isi: 5,
          qty_returned_kosong: 5,
          sell_price: Number(prod12kg.sell_price)
        }
      ],
      p_payment_method: 'tempo_with_dp',
      p_dp_amount: 750000,
      p_dp_method: 'tunai_laci',
      p_due_date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(
        new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      ),
      p_transaction_date: todayWib,
      p_recipient_name: 'H. Rahmat (Warung Berkah Jaya)',
      p_photo_url: txProofPath,
      p_notes: 'Pengiriman rutin mingguan armada pickup'
    })

    // 3. Pembayaran cicilan pertama via transfer bank
    await ownerClient.rpc('rpc_pay_receivable', {
      p_transaction_id: String(berkahTxId),
      p_amount: 250000,
      p_payment_date: todayWib,
      p_method: 'transfer_bank',
      p_proof_url: payProofPath,
      p_notes: 'Cicilan ke-1 via Transfer Bank'
    })

    // 4. Biaya operasional harian
    await ownerClient.rpc('rpc_create_operational_expense', {
      p_amount: 150000,
      p_source: 'kas_laci',
      p_description: 'BBM Solar Armada Pickup L300 & Konsumsi Gudang'
    })
  }

  console.log('Clean & Seed Demo Data Selesai.')
}

cleanAndSeed().catch(err => {
  console.error(err)
  process.exit(1)
})
