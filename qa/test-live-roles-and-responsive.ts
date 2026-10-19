import { chromium, type Page } from 'playwright-core'
import path from 'node:path'
import fs from 'node:fs'

const BASE_URL = 'https://puput-lpg.vercel.app'
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const ARTIFACT_DIR = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\43e14fe9-6de7-4c85-8c6f-331ce1748742'
const LOCAL_DIR = path.join(process.cwd(), 'docs', 'screenshots')
fs.mkdirSync(LOCAL_DIR, { recursive: true })

interface AuditLog {
  category: string
  status: 'PASS' | 'FAIL'
  details: string
}

const auditLogs: AuditLog[] = []

function logResult(category: string, status: 'PASS' | 'FAIL', details: string) {
  auditLogs.push({ category, status, details })
  console.log(`[${status}] ${category}: ${details}`)
}

async function captureScreen(page: Page, filename: string) {
  const localPath = path.join(LOCAL_DIR, filename)
  const artPath = path.join(ARTIFACT_DIR, filename)
  await page.screenshot({ path: localPath, fullPage: false })
  fs.copyFileSync(localPath, artPath)
  console.log(`Screenshot saved: ${filename}`)
}

async function runAudit() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME_PATH
  })

  // =========================================================================
  // 1. DESKTOP AUDIT: LOGIN WITH adminlpg / adminlpg123
  // =========================================================================
  const desktopCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  })
  const dPage = await desktopCtx.newPage()

  const consoleErrors: string[] = []
  dPage.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })

  console.log('\n--- 1. Testing Login as adminlpg / adminlpg123 ---')
  await dPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
  await captureScreen(dPage, 'live-login-page.png')

  const identifierInput = dPage.locator('#identifier')
  const placeholder = await identifierInput.getAttribute('placeholder')
  if (placeholder === 'adminlpg') {
    logResult('Login UI', 'PASS', 'Input identifier menampilkan placeholder "adminlpg"')
  } else {
    logResult('Login UI', 'FAIL', `Placeholder bukan "adminlpg": ${placeholder}`)
  }

  await identifierInput.fill('adminlpg')
  await dPage.locator('#password').fill('adminlpg123')
  await dPage.getByRole('button', { name: /masuk/i }).click()
  await dPage.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30000 })
  logResult('Auth Owner', 'PASS', `Berhasil login dengan username "adminlpg" -> mendarat di ${dPage.url()}`)

  // =========================================================================
  // 2. ONBOARDING / PENGATURAN AWAL AUDIT (OWNER)
  // =========================================================================
  console.log('\n--- 2. Testing Pengaturan Saldo & Stok Awal (/onboarding) ---')
  await dPage.goto(`${BASE_URL}/onboarding`, { waitUntil: 'networkidle' })
  await dPage.waitForTimeout(500)
  await captureScreen(dPage, 'live-onboarding-desktop.png')

  const headingText = await dPage.locator('h1').textContent()
  if (headingText?.includes('Pengaturan Saldo & Stok Awal')) {
    logResult('Onboarding Copy', 'PASS', `Judul halaman ramah pengguna: "${headingText?.trim()}"`)
  } else {
    logResult('Onboarding Copy', 'FAIL', `Judul halaman masih lama: "${headingText?.trim()}"`)
  }

  const pageContent = await dPage.content()
  const hasAtomic = pageContent.toLowerCase().includes('atomic')
  const hasPermanen = pageContent.toLowerCase().includes('dikunci permanen')
  if (!hasAtomic && !hasPermanen) {
    logResult('No-AI-Slop Copy', 'PASS', 'Halaman bebas dari kata "atomic" dan "dikunci permanen"')
  } else {
    logResult('No-AI-Slop Copy', 'FAIL', `Masih ditemukan jargon teknis (atomic: ${hasAtomic}, permanen: ${hasPermanen})`)
  }

  // =========================================================================
  // 3. DASHBOARD OWNER AUDIT
  // =========================================================================
  console.log('\n--- 3. Testing Owner Dashboard ---')
  await dPage.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' })
  await dPage.waitForTimeout(500)
  await captureScreen(dPage, 'live-dashboard-owner-desktop.png')

  const dashContent = await dPage.content()
  const dashHasAtomic = dashContent.toLowerCase().includes('secara atomic')
  if (!dashHasAtomic) {
    logResult('Dashboard Copy', 'PASS', 'Banner dan kartu dashboard bebas dari istilah teknis "secara atomic"')
  } else {
    logResult('Dashboard Copy', 'FAIL', 'Masih ditemukan istilah "secara atomic" di dashboard')
  }

  await desktopCtx.close()

  // =========================================================================
  // 4. STAFF LOGIN & RBAC AUDIT
  // =========================================================================
  console.log('\n--- 4. Testing Staff Login & RBAC Enforcement ---')
  const staffCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  })
  const sPage = await staffCtx.newPage()
  await sPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
  await sPage.locator('#identifier').fill('staff')
  await sPage.locator('#password').fill('staff123')
  await sPage.getByRole('button', { name: /masuk/i }).click()
  await sPage.waitForURL(/\/dashboard/, { timeout: 30000 })
  logResult('Auth Staff', 'PASS', 'Staff berhasil login dengan username "staff" dan password "staff123"')

  // Uji rute terlarang untuk Staff
  const forbiddenRoutes = ['/onboarding', '/reports/profit-loss', '/payroll/process', '/employees', '/cashflow']
  for (const r of forbiddenRoutes) {
    await sPage.goto(`${BASE_URL}${r}`, { waitUntil: 'networkidle' })
    const url = sPage.url()
    if (url.includes('/dashboard') || url.includes('forbidden') || url.includes('/login')) {
      logResult('RBAC Enforcement', 'PASS', `Staff dicegah mengakses ${r} (dialihkan ke ${url})`)
    } else {
      logResult('RBAC Enforcement', 'FAIL', `Staff berhasil menembus rute terlarang: ${url}`)
    }
  }

  await staffCtx.close()

  // =========================================================================
  // 5. RESPONSIVE DESIGN AUDIT (MOBILE & TABLET)
  // =========================================================================
  console.log('\n--- 5. Testing Responsive Layouts (Mobile & Tablet) ---')

  // A. Mobile Viewport (390 x 844 - iPhone 13/14)
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2
  })
  const mPage = await mobileCtx.newPage()
  await mPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
  await mPage.locator('#identifier').fill('adminlpg')
  await mPage.locator('#password').fill('adminlpg123')
  await mPage.getByRole('button', { name: /masuk/i }).click()
  await mPage.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30000 })

  await mPage.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' })
  await mPage.waitForTimeout(500)
  await captureScreen(mPage, 'live-mobile-dashboard.png')

  // Cek horizontal overflow
  const isOverflowing = await mPage.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth
  })
  if (!isOverflowing) {
    logResult('Mobile Responsive', 'PASS', 'Tidak ada horizontal layout overflow pada mobile (390px)')
  } else {
    logResult('Mobile Responsive', 'FAIL', 'Ditemukan horizontal overflow pada mobile (390px)')
  }

  // Buka drawer navigasi
  await mPage.getByRole('button', { name: /buka menu navigasi/i }).click()
  await mPage.waitForTimeout(300)
  await captureScreen(mPage, 'live-mobile-drawer-open.png')

  // Cek apakah item "Pengaturan Awal" ada di drawer
  const drawerLinks = await mPage.locator('nav a').allTextContents()
  const hasPengaturanAwal = drawerLinks.some(t => t.includes('Pengaturan Awal'))
  if (hasPengaturanAwal) {
    logResult('Mobile Drawer', 'PASS', 'Menu "Pengaturan Awal" tersedia dan dapat diakses Owner di drawer mobile')
  } else {
    logResult('Mobile Drawer', 'FAIL', 'Menu "Pengaturan Awal" tidak ditemukan di drawer mobile')
  }

  // Buka Pengaturan Awal di mobile
  await mPage.locator('nav a:visible', { hasText: 'Pengaturan Awal' }).click()
  await mPage.waitForURL(/\/onboarding/, { timeout: 15000 })
  await mPage.waitForTimeout(500)
  await captureScreen(mPage, 'live-mobile-onboarding.png')
  logResult('Mobile Navigation', 'PASS', 'Berhasil membuka halaman Pengaturan Awal via mobile drawer')

  // B. Tablet Viewport (768 x 1024 - iPad)
  const tabletCtx = await browser.newContext({
    viewport: { width: 768, height: 1024 }
  })
  const tPage = await tabletCtx.newPage()
  await tPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
  await tPage.locator('#identifier').fill('adminlpg')
  await tPage.locator('#password').fill('adminlpg123')
  await tPage.getByRole('button', { name: /masuk/i }).click()
  await tPage.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30000 })
  await tPage.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' })
  await tPage.waitForTimeout(500)
  await captureScreen(tPage, 'live-tablet-dashboard.png')

  const tabletOverflow = await tPage.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth
  })
  if (!tabletOverflow) {
    logResult('Tablet Responsive', 'PASS', 'Tidak ada horizontal layout overflow pada tablet (768px)')
  } else {
    logResult('Tablet Responsive', 'FAIL', 'Ditemukan horizontal overflow pada tablet (768px)')
  }

  await mobileCtx.close()
  await tabletCtx.close()
  await browser.close()

  console.log('\n======================================================')
  console.log('AUDIT SUMMARY:')
  console.log(`Total checks: ${auditLogs.length}`)
  console.log(`Passed: ${auditLogs.filter(a => a.status === 'PASS').length}`)
  console.log(`Failed: ${auditLogs.filter(a => a.status === 'FAIL').length}`)
  console.log('======================================================\n')

  fs.writeFileSync(
    path.join(LOCAL_DIR, 'audit-results.json'),
    JSON.stringify(auditLogs, null, 2)
  )
}

runAudit().catch(err => {
  console.error('Audit run failed:', err)
  process.exit(1)
})
