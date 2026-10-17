import { config } from 'dotenv'
import { chromium } from 'playwright-core'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

config({ path: '.env.local' })

const APP_URL = 'http://localhost:3000'
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const ARTIFACT_DIR = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\43e14fe9-6de7-4c85-8c6f-331ce1748742'
const LOCAL_SCREENSHOT_DIR = path.join(process.cwd(), 'docs', 'screenshots')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ownerEmail = process.env.SEED_OWNER_EMAIL || 'owner@pangkalan.local'
const ownerPassword = process.env.SEED_OWNER_PASSWORD!
const staffEmail = process.env.SEED_STAFF_EMAIL || 'staff@pangkalan.local'
const staffPassword = process.env.SEED_STAFF_PASSWORD!

interface RouteAuditResult {
  route: string
  role: 'owner' | 'staff'
  finalUrl: string
  httpStatus: number
  ttfbMs: number
  fcpMs: number
  lcpMs: number
  cls: number
  loadTimeMs: number
  gradientElements: number
  emojiInHeadings: number
  sub16pxInputs: string[]
  consoleErrors: string[]
  failedRequests: string[]
}

const SAMPLE_WEBP_BASE64 =
  'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA='

async function ensureSampleData() {
  console.log('[1/4] Menyiapkan data sampel operasional untuk audit E2E...')
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const ownerClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
  await ownerClient.auth.signInWithPassword({ email: ownerEmail, password: ownerPassword })

  const { data: products } = await admin.from('products').select('id, name, sell_price').order('name')
  if (!products || products.length === 0) throw new Error('Produk belum di-seed')

  const prod3kg = products.find(p => p.name === '3kg')!
  const prod12kg = products.find(p => p.name === '12kg') || prod3kg
  const prod55kg = products.find(p => p.name.includes('5.5')) || prod3kg

  let { data: mitraBerkah } = await admin
    .from('mitras')
    .select('id, name')
    .eq('name', 'Warung Berkah Jaya')
    .maybeSingle()

  if (!mitraBerkah) {
    const { data: insertedMitra, error: mErr } = await admin
      .from('mitras')
      .insert({
        name: 'Warung Berkah Jaya',
        address: 'Jl. Kalimantan No. 45, Sumbersari, Jember',
        phone: '081234567801',
        credit_limit: 15000000,
        max_pending_invoices: 5,
        status: 'active',
        is_system: false
      })
      .select('id, name')
      .single()
    if (mErr) throw new Error(`Gagal seed mitra: ${mErr.message}`)
    mitraBerkah = insertedMitra
  }

  let { data: driverBudi } = await admin
    .from('employees')
    .select('id, name')
    .eq('name', 'Budi Santoso')
    .maybeSingle()

  if (!driverBudi) {
    const { data: insertedDriver, error: dErr } = await admin
      .from('employees')
      .insert({
        name: 'Budi Santoso',
        position: 'supir',
        base_salary: 2800000,
        allowance: 450000,
        bonus_per_tabung: 1000,
        is_active: true
      })
      .select('id, name')
      .single()
    if (dErr) throw new Error(`Gagal seed supir: ${dErr.message}`)
    driverBudi = insertedDriver
  }

  const { data: settings } = await admin
    .from('app_settings')
    .select('onboarding_completed')
    .eq('id', 1)
    .single()

  const todayWib = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())

  if (!settings?.onboarding_completed) {
    const { error: onbErr } = await ownerClient.rpc('rpc_onboarding_setup', {
      p_kas_laci: 15000000,
      p_kas_bank: 45000000,
      p_tanggal: todayWib,
      p_stok_awal: [
        { product_id: prod3kg.id, isi: 180, kosong: 40, bocor: 2 },
        { product_id: prod12kg.id, isi: 45, kosong: 15, bocor: 0 },
        { product_id: prod55kg.id, isi: 35, kosong: 10, bocor: 0 }
      ],
      p_piutang_lama: [],
      p_catatan: 'Setup awal operasional Pangkalan LPG'
    })
    if (onbErr) throw new Error(`Gagal onboarding: ${onbErr.message}`)
  }

  const webpBuffer = Buffer.from(SAMPLE_WEBP_BASE64, 'base64')
  const txProofPath = `audit-sample/nota-${Date.now()}.webp`
  const payProofPath = `audit-sample/payment-${Date.now()}.webp`

  const { error: upErr1 } = await ownerClient.storage
    .from('transaction-proofs')
    .upload(txProofPath, webpBuffer, { contentType: 'image/webp', upsert: true })
  if (upErr1) throw new Error(`Upload transaction-proofs gagal: ${upErr1.message}`)

  const { error: upErr2 } = await ownerClient.storage
    .from('payment-proofs')
    .upload(payProofPath, webpBuffer, { contentType: 'image/webp', upsert: true })
  if (upErr2) throw new Error(`Upload payment-proofs gagal: ${upErr2.message}`)

  const { data: signedTxUrl, error: sErr1 } = await ownerClient.storage
    .from('transaction-proofs')
    .createSignedUrl(txProofPath, 3600)
  const { data: signedPayUrl, error: sErr2 } = await ownerClient.storage
    .from('payment-proofs')
    .createSignedUrl(payProofPath, 3600)

  if (sErr1 || !signedTxUrl?.signedUrl) throw new Error('Gagal generate Signed URL transaction-proofs')
  if (sErr2 || !signedPayUrl?.signedUrl) throw new Error('Gagal generate Signed URL payment-proofs')

  const { data: existingTx } = await admin
    .from('transactions')
    .select('id')
    .is('voided_at', null)
    .eq('is_legacy', false)
    .limit(1)
    .maybeSingle()

  let sampleTxId = existingTx?.id

  if (!sampleTxId) {
    const { data: newTxId, error: txErr } = await ownerClient.rpc('rpc_create_transaction_sale', {
      p_mitra_id: mitraBerkah.id,
      p_driver_id: driverBudi.id,
      p_items: [
        {
          product_id: prod3kg.id,
          qty_sent_isi: 25,
          qty_returned_kosong: 20,
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
      p_dp_amount: 500000,
      p_dp_method: 'tunai_laci',
      p_due_date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      ),
      p_transaction_date: todayWib,
      p_recipient_name: 'H. Rahmat (Warung Berkah)',
      p_photo_url: txProofPath,
      p_notes: 'Pengiriman rutin mingguan'
    })
    if (txErr) throw new Error(`Gagal buat transaksi sampel: ${txErr.message}`)
    sampleTxId = String(newTxId)

    await ownerClient.rpc('rpc_pay_receivable', {
      p_transaction_id: sampleTxId,
      p_amount: 250000,
      p_payment_date: todayWib,
      p_method: 'transfer_bank',
      p_proof_url: payProofPath,
      p_notes: 'Cicilan pertama via transfer BCA'
    })

    await ownerClient.rpc('rpc_create_operational_expense', {
      p_amount: 150000,
      p_source: 'kas_laci',
      p_description: 'Pengisian BBM Solar Armada Pickup L300'
    })
  }

  const lastMonthDate = new Date()
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1)
  const prevMonth = lastMonthDate.getMonth() + 1
  const prevYear = lastMonthDate.getFullYear()

  const { data: existingPayroll } = await admin
    .from('payrolls')
    .select('id')
    .eq('employee_id', driverBudi.id)
    .eq('period_month', prevMonth)
    .eq('period_year', prevYear)
    .maybeSingle()

  let samplePayrollId = existingPayroll?.id

  if (!samplePayrollId) {
    const { data: pRes, error: pErr } = await ownerClient.rpc('rpc_process_payroll', {
      p_payrolls: [
        {
          employee_id: driverBudi.id,
          period_month: prevMonth,
          period_year: prevYear,
          bonus_extra: 100000,
          deduction_absence: 0,
          deduction_kasbon: 0,
          deduction_other: 0,
          paid_source: 'kas_laci'
        }
      ]
    })
    if (pErr) throw new Error(`Gagal buat sampel payroll: ${pErr.message}`)
    const arr = pRes as Array<{ payroll_id: string }>
    samplePayrollId = arr[0]?.payroll_id
  }

  console.log('[1/4] Data sampel siap:', { sampleTxId, samplePayrollId })

  return {
    mitraId: mitraBerkah.id,
    driverId: driverBudi.id,
    sampleTxId: sampleTxId!,
    samplePayrollId: samplePayrollId!,
    signedTxUrl: signedTxUrl.signedUrl,
    signedPayUrl: signedPayUrl.signedUrl
  }
}

async function runBrowserAudit() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
  fs.mkdirSync(LOCAL_SCREENSHOT_DIR, { recursive: true })

  const sample = await ensureSampleData()

  console.log('[2/4] Meluncurkan Google Chrome headless via Playwright-Core...')
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true
  })

  const auditResults: RouteAuditResult[] = []

  try {
    const ownerContext = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    })
    const ownerPage = await ownerContext.newPage()

    let currentConsoleErrors: string[] = []
    let currentFailedRequests: string[] = []

    ownerPage.on('console', msg => {
      if (msg.type() === 'error') {
        currentConsoleErrors.push(msg.text())
      }
    })
    ownerPage.on('pageerror', err => {
      currentConsoleErrors.push(`PageError: ${err.message}`)
    })
    ownerPage.on('response', res => {
      if (res.status() >= 400 && !res.url().includes('favicon.ico')) {
        currentFailedRequests.push(`${res.status()} ${res.url()}`)
      }
    })

    console.log('[2/4] Login sebagai Owner via /login...')
    await ownerPage.goto(`${APP_URL}/login`, { waitUntil: 'load' })
    await ownerPage.waitForTimeout(400)
    await ownerPage.fill('#email', ownerEmail)
    await ownerPage.fill('#password', ownerPassword)
    await ownerPage.click('button[type="submit"]')
    await ownerPage.waitForURL('**/dashboard**', { timeout: 15000 })
    console.log('[2/4] Login Owner berhasil!')

    const ownerRoutesToAudit = [
      { path: '/dashboard', screenshotName: 'dashboard-desktop.png' },
      { path: '/onboarding', screenshotName: null },
      { path: '/products', screenshotName: 'products-desktop.png' },
      { path: '/mitras', screenshotName: 'mitras-desktop.png' },
      { path: `/mitras/${sample.mitraId}`, screenshotName: null },
      { path: '/employees', screenshotName: 'employees-desktop.png' },
      { path: '/stocks', screenshotName: 'stocks-desktop.png' },
      { path: '/stocks/restock', screenshotName: null },
      { path: '/stocks/bocor', screenshotName: null },
      { path: '/stocks/tukar-guling', screenshotName: null },
      { path: '/stocks/opname', screenshotName: null },
      { path: '/transactions', screenshotName: 'transactions-desktop.png' },
      { path: '/transactions/new', screenshotName: 'transactions-new-desktop.png' },
      { path: `/transactions/${sample.sampleTxId}`, screenshotName: 'transaction-detail-desktop.png' },
      { path: '/transactions/susulan', screenshotName: null },
      { path: '/transactions/piutang', screenshotName: 'piutang-desktop.png' },
      { path: '/payroll/process', screenshotName: 'payroll-process-desktop.png' },
      { path: '/payroll/kasbon', screenshotName: 'payroll-kasbon-desktop.png' },
      { path: '/payroll/slips', screenshotName: null },
      { path: '/cashflow', screenshotName: 'cashflow-desktop.png' },
      { path: '/reports/profit-loss', screenshotName: 'profit-loss-desktop.png' },
      { path: '/reports/mitras', screenshotName: 'reports-mitras-desktop.png' }
    ]

    for (const item of ownerRoutesToAudit) {
      currentConsoleErrors = []
      currentFailedRequests = []
      const t0 = Date.now()
      const response = await ownerPage.goto(`${APP_URL}${item.path}`, { waitUntil: 'domcontentloaded' })
      await ownerPage.waitForTimeout(300)
      const loadTimeMs = Date.now() - t0

      const perfAndUi = await ownerPage.evaluate(async () => {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
        const paints = performance.getEntriesByType('paint')
        const fcpEntry = paints.find(p => p.name === 'first-contentful-paint')

        const lcpMs = await new Promise<number>(resolve => {
          let val = 0
          try {
            const po = new PerformanceObserver(list => {
              const entries = list.getEntries()
              if (entries.length > 0) {
                val = entries[entries.length - 1].startTime
              }
            })
            po.observe({ type: 'largest-contentful-paint', buffered: true })
            setTimeout(() => {
              po.disconnect()
              resolve(Math.round(val))
            }, 50)
          } catch {
            resolve(0)
          }
        })

        const cls = await new Promise<number>(resolve => {
          let totalCls = 0
          try {
            const po = new PerformanceObserver(list => {
              for (const entry of list.getEntries() as Array<PerformanceEntry & { hadRecentInput?: boolean; value?: number }>) {
                if (!entry.hadRecentInput && typeof entry.value === 'number') {
                  totalCls += entry.value
                }
              }
            })
            po.observe({ type: 'layout-shift', buffered: true })
            setTimeout(() => {
              po.disconnect()
              resolve(Number(totalCls.toFixed(4)))
            }, 50)
          } catch {
            resolve(0)
          }
        })

        const gradientElements = document.querySelectorAll('[class*="bg-gradient-"]').length

        const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u
        let emojiInHeadings = 0
        document.querySelectorAll('h1, h2, h3, label, button').forEach(el => {
          if (emojiRegex.test(el.textContent || '')) {
            emojiInHeadings += 1
          }
        })

        const sub16pxInputs: string[] = []
        document.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), select, textarea').forEach(el => {
          const style = window.getComputedStyle(el)
          const fontSize = parseFloat(style.fontSize)
          if (fontSize < 16) {
            sub16pxInputs.push(`${el.tagName.toLowerCase()} (${fontSize}px)`)
          }
        })

        return {
          ttfbMs: nav ? Math.round(nav.responseStart - nav.requestStart) : 0,
          fcpMs: fcpEntry ? Math.round(fcpEntry.startTime) : 0,
          lcpMs: lcpMs || (fcpEntry ? Math.round(fcpEntry.startTime) : 0),
          cls,
          gradientElements,
          emojiInHeadings,
          sub16pxInputs
        }
      })

      if (item.screenshotName) {
        const artifactPath = path.join(ARTIFACT_DIR, item.screenshotName)
        const localPath = path.join(LOCAL_SCREENSHOT_DIR, item.screenshotName)
        await ownerPage.screenshot({ path: artifactPath, fullPage: true })
        fs.copyFileSync(artifactPath, localPath)
      }

      console.log(`[Owner] ${item.path} -> ${new URL(ownerPage.url()).pathname} (${loadTimeMs}ms, CLS=${perfAndUi.cls}, LCP=${perfAndUi.lcpMs}ms, errors=${currentConsoleErrors.length})`)

      auditResults.push({
        route: item.path,
        role: 'owner',
        finalUrl: new URL(ownerPage.url()).pathname + new URL(ownerPage.url()).search,
        httpStatus: response?.status() ?? 200,
        ttfbMs: perfAndUi.ttfbMs,
        fcpMs: perfAndUi.fcpMs,
        lcpMs: perfAndUi.lcpMs,
        cls: perfAndUi.cls,
        loadTimeMs,
        gradientElements: perfAndUi.gradientElements,
        emojiInHeadings: perfAndUi.emojiInHeadings,
        sub16pxInputs: perfAndUi.sub16pxInputs,
        consoleErrors: [...currentConsoleErrors],
        failedRequests: [...currentFailedRequests]
      })
    }

    console.log('[3/4] Mengambil screenshot Mobile (390x844)...')
    await ownerPage.setViewportSize({ width: 390, height: 844 })
    const mobileScreens = [
      { path: '/dashboard', screenshotName: 'dashboard-mobile.png' },
      { path: '/transactions/new', screenshotName: 'transactions-new-mobile.png' },
      { path: '/stocks', screenshotName: 'stocks-mobile.png' },
      { path: '/reports/profit-loss', screenshotName: 'profit-loss-mobile.png' }
    ]
    for (const m of mobileScreens) {
      await ownerPage.goto(`${APP_URL}${m.path}`, { waitUntil: 'domcontentloaded' })
      await ownerPage.waitForTimeout(300)
      const artifactPath = path.join(ARTIFACT_DIR, m.screenshotName)
      const localPath = path.join(LOCAL_SCREENSHOT_DIR, m.screenshotName)
      await ownerPage.screenshot({ path: artifactPath, fullPage: true })
      fs.copyFileSync(artifactPath, localPath)
    }

    const invoicePdfRes = await ownerContext.request.get(`${APP_URL}/api/invoice/${sample.sampleTxId}`)
    const invoicePdfBytes = await invoicePdfRes.body()
    const invoicePdfHeader = invoicePdfBytes.subarray(0, 5).toString('ascii')

    const slipPdfRes = await ownerContext.request.get(`${APP_URL}/api/payroll/slip/${sample.samplePayrollId}`)
    const slipPdfBytes = await slipPdfRes.body()
    const slipPdfHeader = slipPdfBytes.subarray(0, 5).toString('ascii')

    const txStorageRes = await ownerContext.request.get(sample.signedTxUrl)
    const payStorageRes = await ownerContext.request.get(sample.signedPayUrl)

    await ownerContext.close()

    console.log('[4/4] Menguji sesi Staff & proteksi RBAC middleware...')
    const staffContext = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    })
    const staffPage = await staffContext.newPage()

    let staffConsoleErrors: string[] = []
    let staffFailedRequests: string[] = []

    staffPage.on('console', msg => {
      if (msg.type() === 'error') {
        staffConsoleErrors.push(msg.text())
      }
    })
    staffPage.on('pageerror', err => {
      staffConsoleErrors.push(`PageError: ${err.message}`)
    })
    staffPage.on('response', res => {
      if (res.status() >= 400 && !res.url().includes('favicon.ico')) {
        staffFailedRequests.push(`${res.status()} ${res.url()}`)
      }
    })

    await staffPage.goto(`${APP_URL}/login`, { waitUntil: 'load' })
    await staffPage.waitForTimeout(400)
    await staffPage.fill('#email', staffEmail)
    await staffPage.fill('#password', staffPassword)
    await staffPage.click('button[type="submit"]')
    await staffPage.waitForURL('**/dashboard**', { timeout: 15000 })

    const staffDashArtifact = path.join(ARTIFACT_DIR, 'dashboard-staff-desktop.png')
    const staffDashLocal = path.join(LOCAL_SCREENSHOT_DIR, 'dashboard-staff-desktop.png')
    await staffPage.screenshot({ path: staffDashArtifact, fullPage: true })
    fs.copyFileSync(staffDashArtifact, staffDashLocal)

    const staffRoutesToCheck = [
      '/dashboard',
      '/transactions/new',
      '/stocks',
      '/employees',
      '/payroll/process',
      '/cashflow',
      '/reports/profit-loss',
      '/stocks/opname'
    ]

    for (const sPath of staffRoutesToCheck) {
      staffConsoleErrors = []
      staffFailedRequests = []
      const t0 = Date.now()
      const res = await staffPage.goto(`${APP_URL}${sPath}`, { waitUntil: 'domcontentloaded' })
      await staffPage.waitForTimeout(200)
      const loadTimeMs = Date.now() - t0

      console.log(`[Staff] ${sPath} -> ${new URL(staffPage.url()).pathname + new URL(staffPage.url()).search} (${loadTimeMs}ms, errors=${staffConsoleErrors.length})`)

      auditResults.push({
        route: sPath,
        role: 'staff',
        finalUrl: new URL(staffPage.url()).pathname + new URL(staffPage.url()).search,
        httpStatus: res?.status() ?? 200,
        ttfbMs: 0,
        fcpMs: 0,
        lcpMs: 0,
        cls: 0,
        loadTimeMs,
        gradientElements: 0,
        emojiInHeadings: 0,
        sub16pxInputs: [],
        consoleErrors: [...staffConsoleErrors],
        failedRequests: [...staffFailedRequests]
      })
    }

    const staffSlipRes = await staffContext.request.get(`${APP_URL}/api/payroll/slip/${sample.samplePayrollId}`)
    const staffSlipStatus = staffSlipRes.status()

    await staffContext.close()

    const summary = {
      pdfEndpoints: {
        invoicePdf: {
          status: invoicePdfRes.status(),
          contentType: invoicePdfRes.headers()['content-type'],
          byteLength: invoicePdfBytes.length,
          header: invoicePdfHeader
        },
        payrollSlipPdf: {
          status: slipPdfRes.status(),
          contentType: slipPdfRes.headers()['content-type'],
          byteLength: slipPdfBytes.length,
          header: slipPdfHeader
        },
        staffBlockedFromSlipPdfStatus: staffSlipStatus
      },
      storageSignedUrls: {
        transactionProofsStatus: txStorageRes.status(),
        paymentProofsStatus: payStorageRes.status()
      },
      routes: auditResults
    }

    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'e2e-audit-results.json'),
      JSON.stringify(summary, null, 2)
    )
    console.log('=== AUDIT SELESAI ===')
  } finally {
    await browser.close()
  }
}

runBrowserAudit().catch(err => {
  console.error(err)
  process.exit(1)
})
