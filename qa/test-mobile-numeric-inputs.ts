import { chromium, type Page } from 'playwright-core'
import path from 'node:path'
import fs from 'node:fs'

const BASE_URL = 'http://localhost:3000'
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const ARTIFACT_DIR = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\43e14fe9-6de7-4c85-8c6f-331ce1748742'
const LOCAL_DIR = path.join(process.cwd(), 'docs', 'screenshots')
fs.mkdirSync(LOCAL_DIR, { recursive: true })

interface VerificationLog {
  page: string
  field: string
  type: string | null
  inputMode: string | null
  pattern: string | null
  blockedNonDigits: boolean
  status: 'PASS' | 'FAIL'
}

const logs: VerificationLog[] = []

async function captureScreen(page: Page, filename: string) {
  const localPath = path.join(LOCAL_DIR, filename)
  const artPath = path.join(ARTIFACT_DIR, filename)
  await page.screenshot({ path: localPath, fullPage: false })
  fs.copyFileSync(localPath, artPath)
  console.log(`[Screenshot Saved] -> ${filename}`)
}

async function verifyField(page: Page, pageName: string, selector: string, label: string) {
  const loc = page.locator(selector).first()
  await loc.waitFor({ state: 'visible', timeout: 5000 })

  const type = await loc.getAttribute('type')
  const inputMode = await loc.getAttribute('inputmode')
  const pattern = await loc.getAttribute('pattern')

  // Uji coba pengetikan karakter huruf dan eksponensial 'abc'
  await loc.focus()
  await page.keyboard.type('abc')
  const valAfterLetters = await loc.inputValue()
  const blockedLetters = valAfterLetters.replace(/[0-9]/g, '').length === 0

  const passes = inputMode === 'numeric' && (pattern === '[0-9]*' || pattern === null) && blockedLetters

  logs.push({
    page: pageName,
    field: label,
    type,
    inputMode,
    pattern,
    blockedNonDigits: blockedLetters,
    status: passes ? 'PASS' : 'FAIL'
  })

  console.log(
    `[${passes ? 'PASS' : 'FAIL'}] ${pageName} -> ${label}: type="${type}", inputmode="${inputMode}", pattern="${pattern}", blocked="${blockedLetters}"`
  )
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME_PATH
  })

  // Viewport mobile standar (iPhone 14 / iPhone 15: 393 x 852)
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  })

  const page = await context.newPage()

  console.log('\n--- 1. Login Mobile as Owner ---')
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
  await page.locator('#identifier').fill('adminlpg')
  await page.locator('#password').fill('adminlpg123')
  await page.getByRole('button', { name: /masuk/i }).click()
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30000 })
  console.log('Login berhasil, mendarat di:', page.url())

  // =========================================================================
  // 1. FORM TRANSAKSI BARU (/transactions/new)
  // =========================================================================
  console.log('\n--- 2. Verifikasi Form Transaksi Penjualan (/transactions/new) ---')
  await page.goto(`${BASE_URL}/transactions/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  // Pilih mitra pertama agar baris produk muncul
  const mitraTrigger = page.locator('button[role="combobox"]').first()
  if (await mitraTrigger.isVisible()) {
    await mitraTrigger.click()
    await page.waitForTimeout(300)
    await page.locator('[role="option"]').first().click()
    await page.waitForTimeout(400)
  }

  await verifyField(page, 'Transaksi Baru', 'input[type="number"]', 'Kuantitas Kirim Isi')

  const priceInput = page.locator('input[type="number"]').last()
  await priceInput.focus()
  await page.waitForTimeout(300)
  await captureScreen(page, 'mobile-num-transaksi-form.png')

  // =========================================================================
  // 2. MODAL TAMBAH MITRA (/mitras)
  // =========================================================================
  console.log('\n--- 3. Verifikasi Form Tambah Mitra (/mitras) ---')
  await page.goto(`${BASE_URL}/mitras`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: /tambah mitra/i }).click()
  await page.waitForTimeout(400)

  await verifyField(page, 'Master Mitra', '#mitraPhone', 'Nomor HP / WhatsApp')
  await verifyField(page, 'Master Mitra', '#creditLimit', 'Plafon Limit Kredit')
  await verifyField(page, 'Master Mitra', '#maxInvoices', 'Maks Nota Gantung')

  await page.locator('#mitraPhone').focus()
  await page.keyboard.type('081298765432')
  await page.waitForTimeout(300)
  await captureScreen(page, 'mobile-num-mitra-modal.png')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // =========================================================================
  // 3. MODAL KAS & MUTASI (/cashflow)
  // =========================================================================
  console.log('\n--- 4. Verifikasi Form Kas & Mutasi (/cashflow) ---')
  await page.goto(`${BASE_URL}/cashflow`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  // Klik tombol "Setor ke Bank"
  const setorBtn = page.getByRole('button', { name: /setor ke bank/i })
  if (await setorBtn.isVisible()) {
    await setorBtn.click()
    await page.waitForTimeout(400)
    await verifyField(page, 'Kasflow Mutasi', 'input[type="number"]', 'Nominal Setor Bank')
    const transferInput = page.locator('input[type="number"]').first()
    await transferInput.focus()
    await page.keyboard.type('2500000')
    await page.waitForTimeout(300)
    await captureScreen(page, 'mobile-num-cashflow-modal.png')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  }

  // =========================================================================
  // 4. MODAL KASBON KARYAWAN (/payroll/kasbon)
  // =========================================================================
  console.log('\n--- 5. Verifikasi Form Kasbon (/payroll/kasbon) ---')
  await page.goto(`${BASE_URL}/payroll/kasbon`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: /tambah kasbon baru/i }).click()
  await page.waitForTimeout(400)

  await verifyField(page, 'Kasbon Karyawan', '#kasbonAmt', 'Nominal Kasbon')
  await page.locator('#kasbonAmt').focus()
  await page.keyboard.type('300000')
  await page.waitForTimeout(300)
  await captureScreen(page, 'mobile-num-kasbon-modal.png')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // =========================================================================
  // 5. HALAMAN LAPOR STOK BOCOR (/stocks/bocor)
  // =========================================================================
  console.log('\n--- 6. Verifikasi Form Stok Bocor (/stocks/bocor) ---')
  await page.goto(`${BASE_URL}/stocks/bocor`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  await verifyField(page, 'Stok Bocor', '#qtyBocor', 'Jumlah Tabung Bocor')
  await page.locator('#qtyBocor').focus()
  await page.keyboard.type('2')
  await page.waitForTimeout(300)
  await captureScreen(page, 'mobile-num-stocks-bocor.png')

  // =========================================================================
  // 6. HALAMAN RESTOCK DARI PERTAMINA (/stocks/restock)
  // =========================================================================
  console.log('\n--- 7. Verifikasi Form Restock (/stocks/restock) ---')
  await page.goto(`${BASE_URL}/stocks/restock`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  await verifyField(page, 'Restock Agen', '#qtyIsi', 'Kuantitas Tabung Isi')
  await verifyField(page, 'Restock Agen', '#qtyKosong', 'Kuantitas Tabung Kosong')
  await verifyField(page, 'Restock Agen', '#qtyBocor', 'Kuantitas Garansi Bocor')

  await page.locator('#qtyIsi').focus()
  await page.keyboard.type('50')
  await page.waitForTimeout(300)
  await captureScreen(page, 'mobile-num-stocks-restock.png')

  // =========================================================================
  // 7. MODAL PELUNASAN PIUTANG (/transactions/piutang)
  // =========================================================================
  console.log('\n--- 8. Verifikasi Form Pelunasan Piutang (/transactions/piutang) ---')
  await page.goto(`${BASE_URL}/transactions/piutang`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  const bayarBtn = page.getByRole('button', { name: /bayar/i }).first()
  if (await bayarBtn.isVisible()) {
    await bayarBtn.click()
    await page.waitForTimeout(400)
    await verifyField(page, 'Pelunasan Piutang', '#payAmount', 'Nominal Pembayaran Cicilan')
    await page.locator('#payAmount').focus()
    await page.keyboard.type('100000')
    await page.waitForTimeout(300)
    await captureScreen(page, 'mobile-num-piutang-modal.png')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  }

  await context.close()
  await browser.close()

  console.log('\n======================================================')
  console.log('MOBILE NUMERIC INPUT AUDIT SUMMARY:')
  console.log(`Total fields checked: ${logs.length}`)
  console.log(`Passed: ${logs.filter(l => l.status === 'PASS').length}`)
  console.log(`Failed: ${logs.filter(l => l.status === 'FAIL').length}`)
  console.log('======================================================\n')

  fs.writeFileSync(
    path.join(LOCAL_DIR, 'mobile-numeric-audit.json'),
    JSON.stringify(logs, null, 2)
  )
}

run().catch(err => {
  console.error('Error during mobile numeric verification:', err)
  process.exit(1)
})
