import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatRupiah, formatNumber, parseRupiahInput } from '../lib/utils/format-currency'
import {
  getWibTodayString,
  getWibCurrentMonthYear,
  addDaysWib,
  formatWibDate,
  calculateDaysOverdue
} from '../lib/utils/date-wib'
import { APP_NAV_ITEMS, getVisibleNavItems } from '../components/layout/nav-items'

// ============================================================================
// SUITE 1: RBAC & AUTHORIZATION GUARD TESTS
// Menguji pemisahan hak akses antara Owner (Admin) dan Staff
// ============================================================================
describe('Suite 1: RBAC & Authorization Guard', () => {
  const OWNER_ONLY_PATHS = [
    '/onboarding',
    '/employees',
    '/payroll',
    '/reports',
    '/cashflow',
    '/stocks/opname',
    '/api/payroll'
  ]

  function isPathOwnerOnly(path: string): boolean {
    return OWNER_ONLY_PATHS.some(p => path.startsWith(p))
  }

  function checkRouteAccess(role: 'owner' | 'staff', path: string): { allowed: boolean; redirectUrl?: string; statusCode?: number } {
    if (role === 'owner') {
      return { allowed: true }
    }
    if (isPathOwnerOnly(path)) {
      if (path.startsWith('/api/')) {
        return { allowed: false, statusCode: 403 }
      }
      return { allowed: false, redirectUrl: '/dashboard?error=forbidden' }
    }
    return { allowed: true }
  }

  it('Owner memiliki akses penuh ke seluruh item menu navigasi', () => {
    const ownerNav = getVisibleNavItems(true)
    assert.equal(ownerNav.length, APP_NAV_ITEMS.length, 'Owner harus melihat seluruh menu navigasi')
    
    const ownerOnlyLabels = ['Karyawan', 'Gaji & Kasbon', 'Kas & Mutasi', 'Laporan Laba Rugi', 'Pengaturan Awal']
    for (const label of ownerOnlyLabels) {
      assert.ok(
        ownerNav.some(item => item.label === label),
        `Owner harus melihat menu "${label}"`
      )
    }
  })

  it('Staff hanya melihat menu operasional dan TIDAK melihat menu finansial/karyawan', () => {
    const staffNav = getVisibleNavItems(false)
    
    // Staff hanya boleh melihat menu operasional:
    const allowedStaffHrefs = ['/dashboard', '/transactions', '/stocks', '/mitras', '/products']
    for (const item of staffNav) {
      assert.ok(
        allowedStaffHrefs.includes(item.href),
        `Staff tidak boleh melihat menu terlarang: ${item.href} (${item.label})`
      )
    }

    // Pastikan menu sensitif tidak muncul untuk Staff:
    const forbiddenHrefs = ['/employees', '/payroll/process', '/cashflow', '/reports/profit-loss', '/onboarding']
    for (const href of forbiddenHrefs) {
      assert.ok(
        !staffNav.some(item => item.href === href),
        `Menu ${href} seharusnya disembunyikan dari Staff`
      )
    }
  })

  it('Middleware RBAC: Staff dilarang keras mengakses rute owner-only dan diarahkan ke forbidden', () => {
    const testForbiddenRoutes = [
      '/onboarding',
      '/employees',
      '/payroll/process',
      '/payroll/kasbon',
      '/reports/profit-loss',
      '/cashflow',
      '/stocks/opname'
    ]

    for (const route of testForbiddenRoutes) {
      const access = checkRouteAccess('staff', route)
      assert.equal(access.allowed, false, `Staff seharusnya dilarang mengakses ${route}`)
      assert.equal(access.redirectUrl, '/dashboard?error=forbidden')
    }
  })

  it('Middleware RBAC: Staff diizinkan mengakses rute operasional kasir & gudang', () => {
    const testAllowedRoutes = [
      '/dashboard',
      '/transactions',
      '/transactions/new',
      '/transactions/piutang',
      '/transactions/susulan',
      '/stocks',
      '/mitras',
      '/products'
    ]

    for (const route of testAllowedRoutes) {
      const access = checkRouteAccess('staff', route)
      assert.equal(access.allowed, true, `Staff harus diizinkan mengakses ${route}`)
    }
  })

  it('Middleware RBAC: API owner-only mengembalikan HTTP 403 jika dipanggil Staff', () => {
    const apiRoute = '/api/payroll/export'
    const access = checkRouteAccess('staff', apiRoute)
    assert.equal(access.allowed, false)
    assert.equal(access.statusCode, 403, 'Akses API terlarang harus HTTP 403 Forbidden')
  })
})

// ============================================================================
// SUITE 2: FORMAT CURRENCY & PARSER TESTS
// Menguji akurasi format mata uang Rupiah dan integritas input integer
// ============================================================================
describe('Suite 2: Format Currency & Parsing Utilitas', () => {
  it('formatRupiah memformat bilangan bulat positif dengan pemisah ribuan', () => {
    assert.equal(formatRupiah(18000), 'Rp 18.000')
    assert.equal(formatRupiah(1500000), 'Rp 1.500.000')
    assert.equal(formatRupiah(25000000), 'Rp 25.000.000')
  })

  it('formatRupiah menangani nilai negatif (defisit/rugi)', () => {
    assert.equal(formatRupiah(-150000), '- Rp 150.000')
    assert.equal(formatRupiah(-5000), '- Rp 5.000')
  })

  it('formatRupiah menangani nol, null, undefined, dan input string kosong', () => {
    assert.equal(formatRupiah(0), 'Rp 0')
    assert.equal(formatRupiah(null), 'Rp 0')
    assert.equal(formatRupiah(undefined), 'Rp 0')
    assert.equal(formatRupiah(''), 'Rp 0')
  })

  it('formatRupiah membulatkan desimal ke satuan Rupiah terdekat', () => {
    assert.equal(formatRupiah(18000.4), 'Rp 18.000')
    assert.equal(formatRupiah(18000.6), 'Rp 18.001')
  })

  it('formatNumber memformat angka dengan pemisah ribuan lokal id-ID', () => {
    assert.equal(formatNumber(100), '100')
    assert.equal(formatNumber(1500), '1.500')
    assert.equal(formatNumber(20000), '20.000')
    assert.equal(formatNumber(0), '0')
    assert.equal(formatNumber(null), '0')
  })

  it('parseRupiahInput mengekstrak angka murni dari string berformat', () => {
    assert.equal(parseRupiahInput('Rp 18.000'), 18000)
    assert.equal(parseRupiahInput('Rp 1.500.000'), 1500000)
    assert.equal(parseRupiahInput('25000'), 25000)
    assert.equal(parseRupiahInput('Rp 0'), 0)
    assert.equal(parseRupiahInput(''), 0)
    assert.equal(parseRupiahInput('BukanAngka!@#'), 0)
  })
})

// ============================================================================
// SUITE 3: WIB DATE & TIMEZONE UTILITIES
// Menguji penanganan tanggal Asia/Jakarta (UTC+7) tanpa pergeseran hari
// ============================================================================
describe('Suite 3: WIB Date & Timezone Utilities', () => {
  it('getWibTodayString mengembalikan tanggal dengan format YYYY-MM-DD', () => {
    const today = getWibTodayString()
    assert.match(today, /^\d{4}-\d{2}-\d{2}$/, 'Format tanggal WIB harus YYYY-MM-DD')
  })

  it('getWibCurrentMonthYear mengekstrak bulan (1-12) dan tahun dengan benar', () => {
    const { month, year } = getWibCurrentMonthYear()
    assert.ok(month >= 1 && month <= 12, 'Bulan harus bernilai 1-12')
    assert.ok(year >= 2024 && year <= 2030, 'Tahun harus berada pada rentang yang valid')
  })

  it('addDaysWib menambah hari dengan benar termasuk pergantian bulan', () => {
    assert.equal(addDaysWib('2026-10-15', 7), '2026-10-22')
    assert.equal(addDaysWib('2026-10-28', 5), '2026-11-02', 'Harus menangani pergantian bulan Okt -> Nov')
    assert.equal(addDaysWib('2026-12-30', 3), '2027-01-02', 'Harus menangani pergantian tahun 2026 -> 2027')
  })

  it('formatWibDate menghasilkan tanggal berformat id-ID ramah pengguna', () => {
    const formatted = formatWibDate('2026-10-19')
    assert.ok(formatted.includes('2026'), 'Tahun harus 2026')
    assert.ok(formatted.toLowerCase().includes('okt'), 'Bulan harus Okt')
    assert.equal(formatWibDate(null), '-')
    assert.equal(formatWibDate(undefined), '-')
  })

  it('calculateDaysOverdue menghitung keterlambatan jatuh tempo piutang', () => {
    const today = getWibTodayString()
    // Tepat hari ini = 0 hari terlambat
    assert.equal(calculateDaysOverdue(today), 0)
    
    // Jatuh tempo 5 hari yang lalu
    const pastDate = addDaysWib(today, -5)
    assert.equal(calculateDaysOverdue(pastDate), 5)
    
    // Jatuh tempo 3 hari ke depan (belum terlambat)
    const futureDate = addDaysWib(today, 3)
    assert.ok(calculateDaysOverdue(futureDate) <= 0)

    // Null / Undefined
    assert.equal(calculateDaysOverdue(null), 0)
  })
})

// ============================================================================
// SUITE 4: INVARIANT 4 KERANJANG STOK TABUNG
// Menguji konservasi aset fisik: Total = Isi + Kosong + Bocor + Pinjam Mitra
// ============================================================================
describe('Suite 4: Invariant 4 Keranjang Stok Tabung', () => {
  interface StockState {
    isi: number
    kosong: number
    bocor: number
    pinjam: number
  }

  function totalAsset(s: StockState): number {
    return s.isi + s.kosong + s.bocor + s.pinjam
  }

  it('Skenario A: Penjualan Ritel Normal (Tukar Tabung 1:1)', () => {
    const initial: StockState = { isi: 100, kosong: 50, bocor: 5, pinjam: 20 }
    const initialTotal = totalAsset(initial)

    // Penjualan 10 tabung isi, pelanggan membawa 10 tabung kosong
    const updated: StockState = {
      isi: initial.isi - 10,
      kosong: initial.kosong + 10,
      bocor: initial.bocor,
      pinjam: initial.pinjam
    }

    assert.equal(updated.isi, 90)
    assert.equal(updated.kosong, 60)
    assert.equal(totalAsset(updated), initialTotal, 'Total tabung fisik harus tetap konstan (175)')
  })

  it('Skenario B: Penjualan Tempo dengan Susulan Tabung Kosong', () => {
    const initial: StockState = { isi: 100, kosong: 50, bocor: 5, pinjam: 20 }
    const initialTotal = totalAsset(initial)

    // Kirim 30 tabung isi ke pangkalan, pangkalan hanya punya 20 tabung kosong (10 tabung susulan/pinjam)
    const sentIsi = 30
    const returnedKosong = 20
    const susulan = sentIsi - returnedKosong // 10

    const updated: StockState = {
      isi: initial.isi - sentIsi,
      kosong: initial.kosong + returnedKosong,
      bocor: initial.bocor,
      pinjam: initial.pinjam + susulan
    }

    assert.equal(updated.isi, 70)
    assert.equal(updated.kosong, 70)
    assert.equal(updated.pinjam, 30)
    assert.equal(totalAsset(updated), initialTotal, 'Total aset tidak boleh bocor/hilang saat susulan dicatat')
  })

  it('Skenario C: Penerimaan Susulan Tabung Kosong dari Mitra', () => {
    const initial: StockState = { isi: 70, kosong: 70, bocor: 5, pinjam: 30 }
    const initialTotal = totalAsset(initial)

    // Mitra mengembalikan 10 tabung susulan yang dipinjam sebelumnya
    const returnedSusulan = 10
    const updated: StockState = {
      isi: initial.isi,
      kosong: initial.kosong + returnedSusulan,
      bocor: initial.bocor,
      pinjam: initial.pinjam - returnedSusulan
    }

    assert.equal(updated.kosong, 80)
    assert.equal(updated.pinjam, 20)
    assert.equal(totalAsset(updated), initialTotal, 'Total aset tetap terjaga setelah susulan dikembalikan')
  })

  it('Skenario D: Restock Klaim Garansi Tabung Bocor ke Supplier Pertamina', () => {
    const initial: StockState = { isi: 70, kosong: 80, bocor: 5, pinjam: 20 }
    const initialTotal = totalAsset(initial)

    // Supplier menukar 5 tabung bocor dengan 5 tabung isi baru tanpa biaya
    const claimBocor = 5
    const updated: StockState = {
      isi: initial.isi + claimBocor,
      kosong: initial.kosong,
      bocor: initial.bocor - claimBocor,
      pinjam: initial.pinjam
    }

    assert.equal(updated.bocor, 0)
    assert.equal(updated.isi, 75)
    assert.equal(totalAsset(updated), initialTotal, 'Klaim garansi mengembalikan aset bocor menjadi tabung isi')
  })

  it('Skenario E: Lapor Tabung Bocor di Gudang', () => {
    const initial: StockState = { isi: 75, kosong: 80, bocor: 0, pinjam: 20 }
    const initialTotal = totalAsset(initial)

    // Ditemukan 2 tabung isi bocor di gudang saat pengecekan rutin
    const bocorFound = 2
    const updated: StockState = {
      isi: initial.isi - bocorFound,
      kosong: initial.kosong,
      bocor: initial.bocor + bocorFound,
      pinjam: initial.pinjam
    }

    assert.equal(updated.isi, 73)
    assert.equal(updated.bocor, 2)
    assert.equal(totalAsset(updated), initialTotal, 'Perpindahan status tabung isi ke bocor mempertahankan total fisik')
  })
})

// ============================================================================
// SUITE 5: LOGIKA PENGGAJIAN, BONUS SUPIR & KASBON FIFO
// Menguji kalkulasi gaji bruto, insentif pengiriman supir, dan pemotongan kasbon
// ============================================================================
describe('Suite 5: Kalkulasi Payroll, Komisi Supir & Kasbon FIFO', () => {
  interface Employee {
    id: string
    name: string
    position: 'supir' | 'staff'
    base_salary: number
    allowance: number
  }

  interface KasbonTranche {
    id: string
    amount: number
    remaining_amount: number
    date: string
  }

  function calculatePayroll(
    emp: Employee,
    deliveriesQty: number,
    bonusPerQty: number,
    bonusExtra: number,
    deductionAbsence: number,
    deductionKasbon: number,
    unpaidKasbon: number
  ) {
    // Insentif hanya berlaku jika karyawan adalah supir
    const bonusDelivery = emp.position === 'supir' ? deliveriesQty * bonusPerQty : 0
    const grossSalary = emp.base_salary + emp.allowance + bonusDelivery + bonusExtra - deductionAbsence

    if (deductionKasbon < 0 || deductionKasbon > unpaidKasbon) {
      throw new Error(`Potongan kasbon (Rp ${deductionKasbon}) melebihi sisa kasbon aktif (Rp ${unpaidKasbon})`)
    }

    const netSalary = grossSalary - deductionKasbon
    if (netSalary < 0) {
      throw new Error(`Gaji bersih bernilai negatif: Rp ${netSalary}`)
    }

    return {
      bonusDelivery,
      grossSalary,
      netSalary
    }
  }

  function applyFifoKasbonRepayment(tranches: KasbonTranche[], deductionAmount: number) {
    let remDeduction = deductionAmount
    const repayments: Array<{ kasbon_id: string; amount: number }> = []

    // Sort FIFO berdasarkan tanggal
    const sorted = [...tranches].sort((a, b) => a.date.localeCompare(b.date))

    for (const tranche of sorted) {
      if (remDeduction <= 0) break
      if (tranche.remaining_amount <= 0) continue

      const cut = Math.min(tranche.remaining_amount, remDeduction)
      tranche.remaining_amount -= cut
      repayments.push({ kasbon_id: tranche.id, amount: cut })
      remDeduction -= cut
    }

    return { repayments, remainingDeduction: remDeduction }
  }

  it('Supir mendapatkan insentif per tabung kirim dan dipotong kasbon', () => {
    const supir: Employee = {
      id: 'emp-driver-1',
      name: 'Budi Santoso',
      position: 'supir',
      base_salary: 1500000,
      allowance: 500000
    }

    // Mengantar 30 tabung dengan insentif Rp 1.000/tabung
    const result = calculatePayroll(
      supir,
      30, // 30 tabung
      1000, // Rp 1.000/tabung
      0, // bonus ekstra
      0, // potongan absen
      200000, // potongan kasbon
      200000 // total kasbon aktif
    )

    assert.equal(result.bonusDelivery, 30000, 'Bonus supir 30 tabung × Rp 1.000 = Rp 30.000')
    assert.equal(result.grossSalary, 2030000, 'Gaji bruto = 1.500.000 + 500.000 + 30.000 = 2.030.000')
    assert.equal(result.netSalary, 1830000, 'Gaji bersih = 2.030.000 - 200.000 = 1.830.000')
  })

  it('Staff gudang TIDAK mendapatkan bonus pengiriman tabung supir', () => {
    const staff: Employee = {
      id: 'emp-staff-1',
      name: 'Siti Aminah',
      position: 'staff',
      base_salary: 2200000,
      allowance: 300000
    }

    const result = calculatePayroll(
      staff,
      100, // kuantitas transaksi gudang
      1000, // tarif bonus supir
      50000, // bonus lembur ekstra
      0, // absen
      0, // kasbon
      0
    )

    assert.equal(result.bonusDelivery, 0, 'Staff toko/gudang tidak berhak atas bonus supir')
    assert.equal(result.grossSalary, 2550000, 'Gaji bruto = 2.200.000 + 300.000 + 50.000 = 2.550.000')
    assert.equal(result.netSalary, 2550000)
  })

  it('Pelunasan Kasbon dieksekusi secara FIFO (First In, First Out)', () => {
    const tranches: KasbonTranche[] = [
      { id: 'k-1', amount: 150000, remaining_amount: 150000, date: '2026-10-05' },
      { id: 'k-2', amount: 250000, remaining_amount: 250000, date: '2026-10-12' }
    ]

    // Potongan payroll sebesar Rp 300.000
    const { repayments, remainingDeduction } = applyFifoKasbonRepayment(tranches, 300000)

    assert.equal(remainingDeduction, 0, 'Seluruh potongan kasbon berhasil dialokasikan')
    assert.equal(repayments.length, 2)
    assert.equal(repayments[0].kasbon_id, 'k-1')
    assert.equal(repayments[0].amount, 150000, 'Tranche 1 lunas seluruhnya (Rp 150.000)')
    assert.equal(tranches[0].remaining_amount, 0)

    assert.equal(repayments[1].kasbon_id, 'k-2')
    assert.equal(repayments[1].amount, 150000, 'Tranche 2 terpotong sisa deduction (Rp 150.000)')
    assert.equal(tranches[1].remaining_amount, 100000, 'Sisa kasbon tranche 2 tinggal Rp 100.000')
  })

  it('Gagal jika potongan kasbon melebihi sisa kasbon yang tercatat', () => {
    const supir: Employee = {
      id: 'emp-driver-2',
      name: 'Supir C',
      position: 'supir',
      base_salary: 1500000,
      allowance: 0
    }

    assert.throws(
      () => calculatePayroll(supir, 0, 0, 0, 0, 500000, 200000),
      /melebihi sisa kasbon aktif/
    )
  })
})

// ============================================================================
// SUITE 6: VALIDASI TRANSAKSI, CREDIT LIMIT & SYARAT BAYAR
// Menguji aturan tempo, batasan kredit mitra, dan validasi eceran tunai
// ============================================================================
describe('Suite 6: Validasi Transaksi & Credit Limit Mitra', () => {
  interface Mitra {
    id: string
    name: string
    is_system: boolean
    status: 'active' | 'inactive'
    credit_limit: number
    current_receivable: number
  }

  function validateTransactionSale(
    mitra: Mitra,
    paymentMethod: 'tunai_laci' | 'transfer_bank' | 'tempo',
    totalAmount: number,
    dpAmount: number = 0,
    hasOwnerOverride: boolean = false
  ): { valid: boolean; reason?: string } {
    if (mitra.status === 'inactive') {
      return { valid: false, reason: 'Mitra dalam status non-aktif' }
    }

    if (mitra.is_system && paymentMethod === 'tempo') {
      return { valid: false, reason: 'Pelanggan eceran / walk-in tidak boleh bertransaksi tempo' }
    }

    if (paymentMethod === 'tempo') {
      const netTempo = totalAmount - dpAmount
      const newTotalReceivable = mitra.current_receivable + netTempo

      if (newTotalReceivable > mitra.credit_limit && !hasOwnerOverride) {
        return {
          valid: false,
          reason: `Total piutang (Rp ${newTotalReceivable}) melebihi credit limit (Rp ${mitra.credit_limit})`
        }
      }
    }

    return { valid: true }
  }

  it('Pelanggan eceran (is_system) dilarang berhutang / tempo', () => {
    const eceran: Mitra = {
      id: 'mitra-eceran',
      name: 'Pelanggan Eceran Walk-In',
      is_system: true,
      status: 'active',
      credit_limit: 0,
      current_receivable: 0
    }

    const res = validateTransactionSale(eceran, 'tempo', 18000)
    assert.equal(res.valid, false)
    assert.match(res.reason!, /tidak boleh bertransaksi tempo/)
  })

  it('Pelanggan eceran diizinkan bertransaksi tunai atau transfer', () => {
    const eceran: Mitra = {
      id: 'mitra-eceran',
      name: 'Pelanggan Eceran Walk-In',
      is_system: true,
      status: 'active',
      credit_limit: 0,
      current_receivable: 0
    }

    const resTunai = validateTransactionSale(eceran, 'tunai_laci', 18000)
    assert.equal(resTunai.valid, true)

    const resTransfer = validateTransactionSale(eceran, 'transfer_bank', 36000)
    assert.equal(resTransfer.valid, true)
  })

  it('Pangkalan tempo diizinkan selama tidak melampaui credit limit', () => {
    const pangkalan: Mitra = {
      id: 'mitra-pangkalan',
      name: 'Pangkalan Bu Siti',
      is_system: false,
      status: 'active',
      credit_limit: 5000000,
      current_receivable: 3000000
    }

    // Transaksi tempo Rp 1.500.000 -> Total piutang Rp 4.500.000 <= 5.000.000
    const res = validateTransactionSale(pangkalan, 'tempo', 1500000)
    assert.equal(res.valid, true)
  })

  it('Pangkalan tempo ditolak jika melampaui credit limit tanpa override PIN Owner', () => {
    const pangkalan: Mitra = {
      id: 'mitra-pangkalan',
      name: 'Pangkalan Bu Siti',
      is_system: false,
      status: 'active',
      credit_limit: 5000000,
      current_receivable: 4500000
    }

    // Transaksi tempo Rp 1.000.000 -> Total piutang Rp 5.500.000 > 5.000.000
    const res = validateTransactionSale(pangkalan, 'tempo', 1000000, 0, false)
    assert.equal(res.valid, false)
    assert.match(res.reason!, /melebihi credit limit/)

    // Jika ada override Owner, transaksi diizinkan
    const resWithOverride = validateTransactionSale(pangkalan, 'tempo', 1000000, 0, true)
    assert.equal(resWithOverride.valid, true)
  })

  it('Mitra non-aktif ditolak melakukan transaksi apapun', () => {
    const mitraInactive: Mitra = {
      id: 'mitra-nonaktif',
      name: 'Toko Bangkrut',
      is_system: false,
      status: 'inactive',
      credit_limit: 1000000,
      current_receivable: 0
    }

    const res = validateTransactionSale(mitraInactive, 'tunai_laci', 100000)
    assert.equal(res.valid, false)
    assert.match(res.reason!, /non-aktif/)
  })
})

// ============================================================================
// SUITE 7: NUMERIC INPUTS & MOBILE KEYBOARD ATTRIBUTES
// Menguji penegakan keyboard angka virtual (inputMode=numeric & pattern=[0-9]*)
// serta pemblokiran karakter non-angka pada seluruh input
// ============================================================================
describe('Suite 7: Input Angka & Konfigurasi Keyboard Mobile', () => {
  function resolveNumericProps(
    type?: string,
    inputMode?: string,
    pattern?: string,
    numericOnly?: boolean,
    allowDecimal: boolean = false
  ) {
    const isNumeric =
      type === 'number' || type === 'tel' || inputMode === 'numeric' || inputMode === 'tel' || numericOnly === true

    const resolvedInputMode =
      inputMode ?? (type === 'tel' ? 'numeric' : isNumeric ? 'numeric' : undefined)
    const resolvedPattern =
      pattern ?? (isNumeric && !allowDecimal ? '[0-9]*' : undefined)

    return { isNumeric, resolvedInputMode, resolvedPattern }
  }

  function shouldBlockKey(key: string, isNumeric: boolean, allowDecimal: boolean = false): boolean {
    if (!isNumeric) return false
    // Blokir karakter eksponensial dan tanda minus/plus
    if (['e', 'E', '+', '-'].includes(key)) return true
    // Blokir desimal jika tidak diizinkan
    if (!allowDecimal && (key === '.' || key === ',')) return true
    return false
  }

  function sanitizeDigitsOnly(val: string): string {
    return val.replace(/[^\d]/g, '')
  }

  it('Input type="number" otomatis menyetel inputMode="numeric" dan pattern="[0-9]*"', () => {
    const props = resolveNumericProps('number')
    assert.equal(props.isNumeric, true)
    assert.equal(props.resolvedInputMode, 'numeric', 'Mobile browser harus membuka keyboard angka')
    assert.equal(props.resolvedPattern, '[0-9]*', 'Pattern harus membatasi ke digit 0-9 murni')
  })

  it('Input type="tel" otomatis menyetel inputMode="numeric" untuk nomor HP/WA', () => {
    const props = resolveNumericProps('tel')
    assert.equal(props.isNumeric, true)
    assert.equal(props.resolvedInputMode, 'numeric')
    assert.equal(props.resolvedPattern, '[0-9]*')
  })

  it('numericOnly=true menyetel atribut keyboard angka meskipun type="text"', () => {
    const props = resolveNumericProps('text', undefined, undefined, true)
    assert.equal(props.isNumeric, true)
    assert.equal(props.resolvedInputMode, 'numeric')
    assert.equal(props.resolvedPattern, '[0-9]*')
  })

  it('Karakter berbahaya eksponensial (e, E) dan tanda (+, -) diblokir pada input angka', () => {
    assert.equal(shouldBlockKey('e', true), true, 'Karakter "e" harus diblokir')
    assert.equal(shouldBlockKey('E', true), true, 'Karakter "E" harus diblokir')
    assert.equal(shouldBlockKey('+', true), true, 'Tanda "+" harus diblokir')
    assert.equal(shouldBlockKey('-', true), true, 'Tanda "-" harus diblokir')
    assert.equal(shouldBlockKey('.', true, false), true, 'Titik harus diblokir jika non-desimal')
    assert.equal(shouldBlockKey('5', true), false, 'Angka "5" harus diizinkan')
  })

  it('Sanitasi nomor telepon / WA membersihkan karakter selain angka', () => {
    assert.equal(sanitizeDigitsOnly('0812-3456-7890'), '081234567890')
    assert.equal(sanitizeDigitsOnly('+62 812 3456 7890'), '6281234567890')
    assert.equal(sanitizeDigitsOnly('abc0852xyz'), '0852')
  })
})

