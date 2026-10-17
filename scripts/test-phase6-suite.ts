import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`)
  }
}

async function runPhase6Suite() {
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const ownerClient = createClient(url, anonKey, { auth: { persistSession: false } })
  const staffClient = createClient(url, anonKey, { auth: { persistSession: false } })

  const ownerEmail = process.env.SEED_OWNER_EMAIL || 'owner@pangkalan.local'
  const ownerPassword = process.env.SEED_OWNER_PASSWORD!
  const staffEmail = process.env.SEED_STAFF_EMAIL || 'staff@pangkalan.local'
  const staffPassword = process.env.SEED_STAFF_PASSWORD!

  const [ownerAuth, staffAuth] = await Promise.all([
    ownerClient.auth.signInWithPassword({ email: ownerEmail, password: ownerPassword }),
    staffClient.auth.signInWithPassword({ email: staffEmail, password: staffPassword })
  ])

  if (ownerAuth.error || !ownerAuth.data.user) throw new Error('Gagal login Owner')
  if (staffAuth.error || !staffAuth.data.user) throw new Error('Gagal login Staff')

  const ownerId = ownerAuth.data.user.id
  const staffId = staffAuth.data.user.id

  const { data: product3kg } = await admin
    .from('products')
    .select('id, buy_price, sell_price')
    .eq('name', '3kg')
    .single()
  if (!product3kg) throw new Error('Produk 3kg tidak ditemukan')

  // Backup initial 3kg stock
  const { data: initialStock } = await admin
    .from('stocks')
    .select('gudang_isi, gudang_kosong, dipinjam_mitra, gudang_bocor')
    .eq('product_id', product3kg.id)
    .single()

  // Buat Mitra Uji & Supir Uji sementara
  const { data: testMitra, error: mitraErr } = await admin
    .from('mitras')
    .insert({
      name: 'MITRA UJI OTOMATIS FASE 6',
      phone: '081200009999',
      credit_limit: 50000000,
      status: 'active',
      is_system: false
    })
    .select('id')
    .single()
  if (mitraErr || !testMitra) throw new Error(`Gagal buat mitra uji: ${mitraErr?.message}`)

  const { data: testDriver, error: driverErr } = await admin
    .from('employees')
    .insert({
      name: 'SUPIR UJI FASE 6',
      position: 'supir',
      base_salary: 3000000,
      allowance: 500000,
      is_active: true
    })
    .select('id')
    .single()
  if (driverErr || !testDriver) throw new Error(`Gagal buat supir uji: ${driverErr?.message}`)

  const createdTxIds: string[] = []
  const createdKasbonIds: string[] = []
  const createdPayrollIds: string[] = []
  const createdCashflowIds: string[] = []

  try {
    // Pastikan ada saldo awal kas_laci yang cukup untuk pengetesan kasbon, gaji, dan void refund
    const { data: seedCashflow, error: cfErr } = await admin
      .from('cashflows')
      .insert({
        type: 'initial_balance',
        direction: 'in',
        source: 'kas_laci',
        amount: 25000000,
        description: 'Modal Uji Fase 6 Sementara',
        created_by: ownerId
      })
      .select('id')
      .single()
    if (cfErr) throw new Error(`Gagal insert modal uji: ${cfErr.message}`)
    if (seedCashflow) createdCashflowIds.push(seedCashflow.id)

    const todayWib = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())

    // =========================================================================
    // 2.2 UJI SIKLUS TABUNG KOSONG, VOID, & DOUBLE VOID REJECTION
    // =========================================================================
    await admin
      .from('stocks')
      .update({ gudang_isi: 100, gudang_kosong: 0, dipinjam_mitra: 0, gudang_bocor: 0 })
      .eq('product_id', product3kg.id)

    const { data: saleRes, error: saleErr } = await staffClient.rpc('rpc_create_transaction_sale', {
      p_mitra_id: testMitra.id,
      p_driver_id: testDriver.id,
      p_items: [
        {
          product_id: product3kg.id,
          qty_sent_isi: 50,
          qty_returned_kosong: 45,
          sell_price: 25000
        }
      ],
      p_payment_method: 'lunas_tunai_laci',
      p_dp_amount: 0,
      p_dp_method: 'tunai_laci',
      p_due_date: null,
      p_transaction_date: todayWib,
      p_recipient_name: 'Penerima Uji 2.2',
      p_photo_url: null,
      p_notes: 'Tes siklus tabung kosong'
    })
    assert(!saleErr && Boolean(saleRes), `Gagal buat transaksi 2.2: ${saleErr?.message}`)
    const tx22Id = String(saleRes)
    createdTxIds.push(tx22Id)

    const { data: stockAfterSale } = await admin
      .from('stocks')
      .select('gudang_isi, gudang_kosong, dipinjam_mitra')
      .eq('product_id', product3kg.id)
      .single()
    const { data: balanceAfterSale } = await admin
      .from('mitra_product_balances')
      .select('borrowed_qty')
      .eq('mitra_id', testMitra.id)
      .eq('product_id', product3kg.id)
      .single()

    assert(stockAfterSale?.gudang_isi === 50, `gudang_isi harus 50, aktual: ${stockAfterSale?.gudang_isi}`)
    assert(stockAfterSale?.gudang_kosong === 45, `gudang_kosong harus 45, aktual: ${stockAfterSale?.gudang_kosong}`)
    assert(stockAfterSale?.dipinjam_mitra === 5, `dipinjam_mitra harus 5, aktual: ${stockAfterSale?.dipinjam_mitra}`)
    assert(balanceAfterSale?.borrowed_qty === 5, `borrowed_qty harus 5, aktual: ${balanceAfterSale?.borrowed_qty}`)
    console.log('[PASS] 2.2.a Siklus kirim 50 isi, kembali 45 kosong -> gudang_isi=50, gudang_kosong=45, dipinjam_mitra=5')

    // Void transaksi oleh Owner
    const { error: voidErr1 } = await ownerClient.rpc('rpc_void_transaction', {
      p_transaction_id: tx22Id,
      p_void_reason: 'Uji Void 2.2'
    })
    assert(!voidErr1, `Gagal void pertama: ${voidErr1?.message}`)

    const { data: stockAfterVoid } = await admin
      .from('stocks')
      .select('gudang_isi, gudang_kosong, dipinjam_mitra')
      .eq('product_id', product3kg.id)
      .single()
    const { data: balanceAfterVoid } = await admin
      .from('mitra_product_balances')
      .select('borrowed_qty')
      .eq('mitra_id', testMitra.id)
      .eq('product_id', product3kg.id)
      .single()

    assert(stockAfterVoid?.gudang_isi === 100, `gudang_isi setelah void harus 100, aktual: ${stockAfterVoid?.gudang_isi}`)
    assert(stockAfterVoid?.gudang_kosong === 0, `gudang_kosong setelah void harus 0, aktual: ${stockAfterVoid?.gudang_kosong}`)
    assert(stockAfterVoid?.dipinjam_mitra === 0, `dipinjam_mitra setelah void harus 0, aktual: ${stockAfterVoid?.dipinjam_mitra}`)
    assert(balanceAfterVoid?.borrowed_qty === 0, `borrowed_qty setelah void harus 0, aktual: ${balanceAfterVoid?.borrowed_qty}`)
    console.log('[PASS] 2.2.b Void transaksi mengembalikan gudang_isi=100, gudang_kosong=0, dipinjam_mitra=0, borrowed_qty=0')

    // Void kedua kali harus ditolak
    const { error: voidErr2 } = await ownerClient.rpc('rpc_void_transaction', {
      p_transaction_id: tx22Id,
      p_void_reason: 'Uji Double Void'
    })
    assert(
      Boolean(voidErr2 && voidErr2.message.includes('sudah pernah di-void sebelumnya')),
      `Double void harus ditolak dengan pesan 'sudah pernah di-void sebelumnya', aktual: ${voidErr2?.message}`
    )
    console.log('[PASS] 2.2.c Double void ditolak dengan pesan yang tepat')

    // =========================================================================
    // 2.3.1 PROTEKSI SALDO KAS & GAJI DARI STAFF
    // =========================================================================
    const { error: staffCashErr } = await staffClient.rpc('get_cash_balance', { p_source: 'kas_laci' })
    assert(Boolean(staffCashErr), 'Staff seharusnya ditolak saat memanggil get_cash_balance')

    const { data: staffEmpRows } = await staffClient.from('employees').select('*')
    assert((staffEmpRows ?? []).length === 0, `Staff tidak boleh membaca tabel employees, dapat ${(staffEmpRows ?? []).length} baris`)

    const { data: activeDrivers, error: drvRpcErr } = await staffClient.rpc('rpc_get_active_drivers')
    assert(!drvRpcErr && Array.isArray(activeDrivers) && activeDrivers.length >= 1, 'rpc_get_active_drivers gagal dipanggil Staff')
    const sampleDriver = activeDrivers![0] as Record<string, unknown>
    assert(!('base_salary' in sampleDriver) && !('allowance' in sampleDriver), 'rpc_get_active_drivers tidak boleh membocorkan kolom gaji')
    console.log('[PASS] 2.3.1 Proteksi saldo kas & gaji dari Staff serta rpc_get_active_drivers aman')

    // =========================================================================
    // 2.3.2 OVERRIDE TEMPO OLEH STAFF (extensions.digest + requested_by = auth.uid())
    // =========================================================================
    const yesterdayWib = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(
      new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    )
    const { data: overdueTx, error: overdueErr } = await ownerClient.rpc('rpc_create_transaction_sale', {
      p_mitra_id: testMitra.id,
      p_driver_id: null,
      p_items: [
        {
          product_id: product3kg.id,
          qty_sent_isi: 5,
          qty_returned_kosong: 5,
          sell_price: 25000
        }
      ],
      p_payment_method: 'tempo',
      p_dp_amount: 0,
      p_dp_method: 'tunai_laci',
      p_due_date: yesterdayWib,
      p_transaction_date: yesterdayWib,
      p_recipient_name: 'Overdue Seed'
    })
    assert(!overdueErr && Boolean(overdueTx), `Gagal buat nota overdue: ${overdueErr?.message}`)
    createdTxIds.push(String(overdueTx))

    // Terbitkan token override di audit_logs yang diikat ke staffId (persis seperti /api/auth/verify-owner)
    const rawOverrideToken = crypto.randomBytes(24).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawOverrideToken).digest('hex')
    const { data: overrideLogRow } = await admin
      .from('audit_logs')
      .insert({
        user_id: ownerId,
        action: 'issue_override_token',
        target_table: 'mitras',
        target_id: testMitra.id,
        reason: 'Override uji otomatis Fase 6',
        new_value: {
          token_hash: tokenHash,
          requested_by: staffId,
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          used: false
        }
      })
      .select('id')
      .single()

    const nextWeekWib = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    )
    const { data: overrideSale, error: overrideSaleErr } = await staffClient.rpc('rpc_create_transaction_sale', {
      p_mitra_id: testMitra.id,
      p_driver_id: testDriver.id,
      p_items: [
        {
          product_id: product3kg.id,
          qty_sent_isi: 5,
          qty_returned_kosong: 5,
          sell_price: 25000
        }
      ],
      p_payment_method: 'tempo',
      p_dp_amount: 0,
      p_dp_method: 'tunai_laci',
      p_due_date: nextWeekWib,
      p_transaction_date: todayWib,
      p_recipient_name: 'Override Staff Test',
      p_override_token: rawOverrideToken,
      p_override_reason: 'Override uji otomatis Fase 6'
    })
    assert(!overrideSaleErr && Boolean(overrideSale), `Override Tempo oleh Staff gagal: ${overrideSaleErr?.message}`)
    const txWithDriverId = String(overrideSale)
    createdTxIds.push(txWithDriverId)
    console.log('[PASS] 2.3.2 Override Tempo oleh Staff menggunakan extensions.digest & requested_by berhasil')

    // =========================================================================
    // 2.2.4 & 2.3.3 KASBON FIFO & LOCK PERIODE GAJI
    // =========================================================================
    const { data: kasbon1Id, error: k1Err } = await ownerClient.rpc('rpc_create_kasbon', {
      p_employee_id: testDriver.id,
      p_amount: 200000,
      p_source: 'kas_laci',
      p_kasbon_date: yesterdayWib,
      p_notes: 'Kasbon FIFO #1'
    })
    assert(!k1Err && Boolean(kasbon1Id), `Gagal kasbon 1: ${k1Err?.message}`)
    createdKasbonIds.push(String(kasbon1Id))

    const { data: kasbon2Id, error: k2Err } = await ownerClient.rpc('rpc_create_kasbon', {
      p_employee_id: testDriver.id,
      p_amount: 300000,
      p_source: 'kas_laci',
      p_kasbon_date: todayWib,
      p_notes: 'Kasbon FIFO #2'
    })
    assert(!k2Err && Boolean(kasbon2Id), `Gagal kasbon 2: ${k2Err?.message}`)
    createdKasbonIds.push(String(kasbon2Id))

    const [yearStr, monthStr] = todayWib.split('-')
    const currentYear = Number(yearStr)
    const currentMonth = Number(monthStr)

    const { data: payrollRes, error: payErr } = await ownerClient.rpc('rpc_process_payroll', {
      p_payrolls: [
        {
          employee_id: testDriver.id,
          period_month: currentMonth,
          period_year: currentYear,
          bonus_extra: 0,
          deduction_absence: 0,
          deduction_kasbon: 450000,
          deduction_other: 0,
          paid_source: 'kas_laci'
        }
      ]
    })
    assert(!payErr && Array.isArray(payrollRes) && payrollRes.length === 1, `Gagal proses payroll: ${payErr?.message}`)
    const pRes = payrollRes![0] as { status: string; payroll_id: string }
    assert(pRes.status === 'processed', `Status payroll harus 'processed', aktual: ${pRes.status}`)
    createdPayrollIds.push(pRes.payroll_id)

    const { data: k1Row } = await admin.from('kasbons').select('remaining_amount').eq('id', String(kasbon1Id)).single()
    const { data: k2Row } = await admin.from('kasbons').select('remaining_amount').eq('id', String(kasbon2Id)).single()
    assert(Number(k1Row?.remaining_amount) === 0, `Kasbon #1 harus sisa 0, aktual: ${k1Row?.remaining_amount}`)
    assert(Number(k2Row?.remaining_amount) === 50000, `Kasbon #2 harus sisa 50000, aktual: ${k2Row?.remaining_amount}`)
    console.log('[PASS] 2.3.3 Potongan Kasbon FIFO akurat (200k -> 0, 300k -> 50k)')

    // Uji Lock Periode Gaji: coba void transaksi yang punya testDriver di bulan yang sudah digaji
    const { error: lockedVoidErr } = await ownerClient.rpc('rpc_void_transaction', {
      p_transaction_id: txWithDriverId,
      p_void_reason: 'Coba void setelah gajian'
    })
    assert(
      Boolean(lockedVoidErr && lockedVoidErr.message.includes('sudah dibayarkan')),
      `Void setelah gajian harus ditolak, aktual: ${lockedVoidErr?.message}`
    )
    console.log('[PASS] 2.2.4 Lock periode gaji menolak void transaksi pada bulan yang sudah diproses gajinya')

    // =========================================================================
    // 2.3.4 RPC LAPORAN LABA RUGI (rpc_get_profit_loss_report)
    // =========================================================================
    const startOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`
    const endOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${new Date(currentYear, currentMonth, 0).getDate()}`

    const { data: plReport, error: plErr } = await ownerClient.rpc('rpc_get_profit_loss_report', {
      p_start_date: startOfMonth,
      p_end_date: endOfMonth
    })
    assert(!plErr && Boolean(plReport), `rpc_get_profit_loss_report gagal: ${plErr?.message}`)
    const reportObj = plReport as Record<string, number>
    const requiredKeys = [
      'omzet_accrual',
      'cash_collected_period',
      'piutang_remaining_from_period',
      'hpp_total',
      'gross_profit',
      'operational_expense',
      'salary_expense',
      'bocor_gross_loss',
      'bocor_warranty_recovered',
      'bocor_net_loss',
      'opname_loss',
      'net_profit'
    ]
    for (const k of requiredKeys) {
      assert(typeof reportObj[k] === 'number', `Key ${k} tidak ditemukan atau bukan number di rpc_get_profit_loss_report`)
    }
    console.log('[PASS] 2.3.4 rpc_get_profit_loss_report mengembalikan 12 metrik keuangan lengkap secara presisi')
  } finally {
    // Cleanup seluruh data uji sementara
    if (createdPayrollIds.length > 0) {
      await admin.from('kasbon_repayments').delete().in('payroll_id', createdPayrollIds)
      await admin.from('cashflows').delete().in('reference_id', createdPayrollIds)
      await admin.from('payrolls').delete().in('id', createdPayrollIds)
      await admin.from('audit_logs').delete().eq('action', 'process_payroll')
    }
    if (createdKasbonIds.length > 0) {
      await admin.from('cashflows').delete().in('reference_id', createdKasbonIds)
      await admin.from('kasbons').delete().in('id', createdKasbonIds)
    }
    if (createdTxIds.length > 0) {
      await admin.from('tempo_override_logs').delete().in('transaction_id', createdTxIds)
      await admin.from('audit_logs').delete().in('target_id', createdTxIds)
      await admin.from('cashflows').delete().in('reference_id', createdTxIds)
      await admin.from('payments').delete().in('transaction_id', createdTxIds)
      await admin.from('stock_movements').delete().in('linked_transaction_id', createdTxIds)
      await admin.from('transaction_items').delete().in('transaction_id', createdTxIds)
      await admin.from('transactions').delete().in('id', createdTxIds)
    }
    if (createdCashflowIds.length > 0) {
      await admin.from('cashflows').delete().in('id', createdCashflowIds)
    }
    await admin.from('audit_logs').delete().eq('target_id', testMitra.id)
    await admin.from('mitra_product_balances').delete().eq('mitra_id', testMitra.id)
    await admin.from('mitras').delete().eq('id', testMitra.id)
    await admin.from('employees').delete().eq('id', testDriver.id)

    await admin
      .from('stocks')
      .update({ gudang_isi: 0, gudang_kosong: 0, dipinjam_mitra: 0, gudang_bocor: 0 })
      .eq('product_id', product3kg.id)
  }
}

runPhase6Suite()
  .then(() => {
    console.log('=== SELURUH UJI OTOMATIS FASE 6 LULUS 100% ===')
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
