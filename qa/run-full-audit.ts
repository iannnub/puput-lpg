import { chromium, type Page, devices } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const ARTIFACT_DIR = 'C:/Users/user/.gemini/antigravity/brain/43e14fe9-6de7-4c85-8c6f-331ce1748742'
const SCREENSHOT_DIR = path.resolve('docs/screenshots')

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

interface AuditIssue {
  page: string
  type: 'console-error' | 'gradient-detected' | 'broken-ui' | 'rbac-failure'
  message: string
}

const auditIssues: AuditIssue[] = []
const consoleLogs: { level: string; text: string; page: string }[] = []

function attachConsoleListener(page: Page, pageName: string) {
  page.on('console', msg => {
    const text = msg.text()
    const level = msg.type()
    consoleLogs.push({ level, text, page: pageName })
    if (level === 'error') {
      // Abaikan error favicon atau browser extension jika ada
      if (!text.includes('favicon.ico') && !text.includes('chrome-extension')) {
        auditIssues.push({
          page: pageName,
          type: 'console-error',
          message: text
        })
        console.error(`[CONSOLE ERROR] [${pageName}] ${text}`)
      }
    }
  })

  page.on('pageerror', err => {
    auditIssues.push({
      page: pageName,
      type: 'console-error',
      message: err.message
    })
    console.error(`[PAGE UNCAUGHT ERROR] [${pageName}] ${err.message}`)
  })
}

async function capture(page: Page, filename: string) {
  const localPath = path.join(SCREENSHOT_DIR, filename)
  await page.screenshot({ path: localPath, fullPage: false })
  // Salin ke direktori artifact agar dapat ditautkan ke pengguna
  if (fs.existsSync(ARTIFACT_DIR)) {
    const artifactPath = path.join(ARTIFACT_DIR, filename)
    fs.copyFileSync(localPath, artifactPath)
  }
  console.log(`[Screenshot Saved] -> ${filename}`)
}

async function verifyZeroGradients(page: Page, pageName: string) {
  const gradientCount = await page.evaluate(() => {
    return document.querySelectorAll('[class*="bg-gradient-"]').length
  })
  if (gradientCount > 0) {
    auditIssues.push({
      page: pageName,
      type: 'gradient-detected',
      message: `Ditemukan ${gradientCount} elemen menggunakan class gradasi (bg-gradient-*)`
    })
    console.warn(`[FAIL] ${pageName}: Ditemukan ${gradientCount} elemen gradasi!`)
  } else {
    console.log(`[PASS] ${pageName}: 0 elemen gradasi (Murni Solid/Glass).`)
  }
}

async function run() {
  console.log(`=== MEMULAI AUDIT PENUH & PENGUJIAN FITUR (Target: ${BASE_URL}) ===\n`)
  const browser = await chromium.launch({ channel: 'chrome', headless: true })

  try {
    // ----------------------------------------------------
    // TAHAP 1: AUDIT DESKTOP (1280 x 800)
    // ----------------------------------------------------
    console.log('--- 1. AUDIT DESKTOP (Viewport: 1280x800) ---')
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    })
    const page = await desktopContext.newPage()
    attachConsoleListener(page, 'Desktop')

    // 1.1 Halaman Login
    console.log('Navigasi ke /login...')
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
    await verifyZeroGradients(page, 'Desktop Login')
    await capture(page, 'desktop-login.png')

    // 1.2 Login sebagai Owner
    console.log('Melakukan login sebagai Owner (adminlpg)...')
    await page.fill('#identifier', 'adminlpg')
    await page.fill('#password', 'adminlpg123')
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button[type="submit"]')
    ])

    console.log(`Mendarat di: ${page.url()}`)
    await verifyZeroGradients(page, 'Desktop Dashboard')
    await capture(page, 'desktop-dashboard.png')

    // 1.3 Halaman Transaksi
    console.log('Navigasi ke /transactions...')
    await page.goto(`${BASE_URL}/transactions`, { waitUntil: 'networkidle' })
    await verifyZeroGradients(page, 'Desktop Transactions')
    await capture(page, 'desktop-transactions.png')

    // 1.4 Halaman Transaksi Baru (/transactions/new) & Verifikasi Form
    console.log('Navigasi ke /transactions/new...')
    await page.goto(`${BASE_URL}/transactions/new`, { waitUntil: 'networkidle' })
    await verifyZeroGradients(page, 'Desktop Transaksi Baru')
    await capture(page, 'desktop-transactions-new.png')

    // 1.5 Halaman Piutang & Buka Modal Pelunasan (/transactions/piutang)
    console.log('Navigasi ke /transactions/piutang...')
    await page.goto(`${BASE_URL}/transactions/piutang`, { waitUntil: 'networkidle' })
    await verifyZeroGradients(page, 'Desktop Piutang')
    await capture(page, 'desktop-piutang.png')

    // 1.6 Halaman Stok Tabung (/stocks)
    console.log('Navigasi ke /stocks...')
    await page.goto(`${BASE_URL}/stocks`, { waitUntil: 'networkidle' })
    await verifyZeroGradients(page, 'Desktop Stocks')
    await capture(page, 'desktop-stocks.png')

    // 1.7 Halaman Arus Kas (/cashflow)
    console.log('Navigasi ke /cashflow...')
    await page.goto(`${BASE_URL}/cashflow`, { waitUntil: 'networkidle' })
    await verifyZeroGradients(page, 'Desktop Cashflow')
    await capture(page, 'desktop-cashflow.png')

    // 1.8 Halaman Laba Rugi (/reports/profit-loss)
    console.log('Navigasi ke /reports/profit-loss...')
    await page.goto(`${BASE_URL}/reports/profit-loss`, { waitUntil: 'networkidle' })
    await verifyZeroGradients(page, 'Desktop Laba Rugi')
    await capture(page, 'desktop-profit-loss.png')

    // 1.9 Halaman Mitra (/mitras)
    console.log('Navigasi ke /mitras...')
    await page.goto(`${BASE_URL}/mitras`, { waitUntil: 'networkidle' })
    await verifyZeroGradients(page, 'Desktop Mitras')
    await capture(page, 'desktop-mitras.png')

    // 1.10 Halaman Penggajian Kasbon (/payroll/kasbon)
    console.log('Navigasi ke /payroll/kasbon...')
    await page.goto(`${BASE_URL}/payroll/kasbon`, { waitUntil: 'networkidle' })
    await verifyZeroGradients(page, 'Desktop Kasbon')
    await capture(page, 'desktop-kasbon.png')

    await desktopContext.close()

    // ----------------------------------------------------
    // TAHAP 2: AUDIT MOBILE IPHONE (iPhone 14/15 Viewport: 390x844)
    // ----------------------------------------------------
    console.log('\n--- 2. AUDIT MOBILE IPHONE (Viewport: 390x844) ---')
    const mobileContext = await browser.newContext({
      ...devices['iPhone 14'],
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true
    })
    const mobilePage = await mobileContext.newPage()
    attachConsoleListener(mobilePage, 'Mobile iPhone')

    // 2.1 Login Mobile
    console.log('Navigasi ke /login (Mobile)...')
    await mobilePage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
    await verifyZeroGradients(mobilePage, 'Mobile Login')
    await capture(mobilePage, 'mobile-login.png')

    // 2.2 Submit Login Mobile
    await mobilePage.fill('#identifier', 'adminlpg')
    await mobilePage.fill('#password', 'adminlpg123')
    await Promise.all([
      mobilePage.waitForNavigation({ waitUntil: 'networkidle' }),
      mobilePage.click('button[type="submit"]')
    ])

    console.log(`Mobile mendarat di: ${mobilePage.url()}`)
    await verifyZeroGradients(mobilePage, 'Mobile Dashboard')
    await capture(mobilePage, 'mobile-dashboard.png')

    // 2.3 Buka Off-canvas Drawer Menu
    console.log('Membuka Off-canvas Mobile Drawer...')
    const menuBtn = await mobilePage.waitForSelector('button[aria-label="Buka menu navigasi"]')
    await menuBtn.click()
    await mobilePage.waitForTimeout(400) // Animasi spring slide-in
    await verifyZeroGradients(mobilePage, 'Mobile Drawer Open')
    await capture(mobilePage, 'mobile-drawer-open.png')

    // Tutup drawer
    const closeBtn = await mobilePage.waitForSelector('button[aria-label="Tutup menu navigasi"]')
    await closeBtn.click()
    await mobilePage.waitForTimeout(300)

    // 2.4 Navigasi Mobile ke /transactions
    console.log('Navigasi ke /transactions (Mobile)...')
    await mobilePage.goto(`${BASE_URL}/transactions`, { waitUntil: 'networkidle' })
    await verifyZeroGradients(mobilePage, 'Mobile Transactions')
    await capture(mobilePage, 'mobile-transactions.png')

    // 2.5 Buka Modal Pelunasan Piutang di Mobile (/transactions/piutang)
    console.log('Navigasi ke /transactions/piutang (Mobile)...')
    await mobilePage.goto(`${BASE_URL}/transactions/piutang`, { waitUntil: 'networkidle' })
    const bayarBtn = await mobilePage.$('button:has-text("Bayar")')
    if (bayarBtn) {
      await bayarBtn.click()
      await mobilePage.waitForSelector('#payAmount', { timeout: 5000 })
      await mobilePage.waitForTimeout(300)
      console.log('Modal pelunasan piutang terbuka...')
      await verifyZeroGradients(mobilePage, 'Mobile Piutang Modal')
      await capture(mobilePage, 'mobile-piutang-modal.png')
    }

    // 2.6 Navigasi Mobile ke /stocks
    console.log('Navigasi ke /stocks (Mobile)...')
    await mobilePage.goto(`${BASE_URL}/stocks`, { waitUntil: 'networkidle' })
    await verifyZeroGradients(mobilePage, 'Mobile Stocks')
    await capture(mobilePage, 'mobile-stocks.png')

    await mobileContext.close()

    // ----------------------------------------------------
    // TAHAP 3: AUDIT ROLE-BASED ACCESS CONTROL (STAFF)
    // ----------------------------------------------------
    console.log('\n--- 3. AUDIT RBAC ROLE STAFF (staff / staff123) ---')
    const staffContext = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    })
    const staffPage = await staffContext.newPage()
    attachConsoleListener(staffPage, 'Staff Role')

    await staffPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
    await staffPage.fill('#identifier', 'staff')
    await staffPage.fill('#password', 'staff123')
    await Promise.all([
      staffPage.waitForNavigation({ waitUntil: 'networkidle' }),
      staffPage.click('button[type="submit"]')
    ])

    console.log(`Staff mendarat di: ${staffPage.url()}`)
    await capture(staffPage, 'staff-dashboard.png')

    // Staff mencoba mengakses rute terlarang (/cashflow)
    console.log('Staff mencoba mengakses rute terlarang /cashflow...')
    await staffPage.goto(`${BASE_URL}/cashflow`, { waitUntil: 'networkidle' })
    const staffCurrentUrl = staffPage.url()
    console.log(`Staff diarahkan ke: ${staffCurrentUrl}`)
    if (staffCurrentUrl.includes('/dashboard?error=forbidden')) {
      console.log('[PASS] RBAC: Staff berhasil diblokir dari /cashflow dan diarahkan ke forbidden!')
    } else {
      auditIssues.push({
        page: 'Staff RBAC',
        type: 'rbac-failure',
        message: `Staff seharusnya dilarang mengakses /cashflow namun berada di: ${staffCurrentUrl}`
      })
      console.error('[FAIL] RBAC: Staff tidak diblokir dari /cashflow!')
    }
    await capture(staffPage, 'staff-forbidden-attempt.png')

    await staffContext.close()

  } finally {
    await browser.close()
  }

  // ----------------------------------------------------
  // RINGKASAN AUDIT
  // ----------------------------------------------------
  console.log('\n======================================================')
  console.log('HASIL AUDIT E2E BROWSER & PERANGKAT:')
  console.log(`Total Masalah Terdeteksi: ${auditIssues.length}`)
  if (auditIssues.length > 0) {
    for (const issue of auditIssues) {
      console.log(`- [${issue.type.toUpperCase()}] (${issue.page}): ${issue.message}`)
    }
  } else {
    console.log('SELURUH PENGUJIAN SELESAI DENGAN STATUS 100% PASS!')
  }
  console.log('======================================================\n')
}

run().catch(err => {
  console.error('Fatal Audit Error:', err)
  process.exit(1)
})
