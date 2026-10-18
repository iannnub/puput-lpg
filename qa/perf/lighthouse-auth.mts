// Lighthouse terautentikasi (preset mobile bawaan: Slow 4G tersimulasi, CPU 4x).
// Jalankan: npx tsx qa/perf/lighthouse-auth.mts [label] ; env RUNS (default 3), ROLE (owner|staff|all)
import { chromium, type Page } from 'playwright-core'
import lighthouse from 'lighthouse'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { loadQaEnv } from '../lib/env'

const qa = loadQaEnv()
const LABEL = process.argv[2] || 'baseline'
const RUNS = Number(process.env.RUNS || 3)
const ROLE = (process.env.ROLE || 'all') as 'owner' | 'staff' | 'all'
const ONLY = process.env.ROUTES ? process.env.ROUTES.split(',') : null
const OUT_DIR = path.join('docs', 'qa', 'evidence', LABEL)
fs.mkdirSync(OUT_DIR, { recursive: true })

const ROUTES_OWNER = [
  '/dashboard', '/transactions', '/transactions/new', '/transactions/piutang',
  '/transactions/susulan', '/stocks', '/stocks/restock', '/mitras', '/products',
  '/employees', '/payroll/process', '/cashflow', '/reports/profit-loss', '/reports/mitras'
]
const ROUTES_STAFF = ['/dashboard', '/transactions', '/transactions/new', '/transactions/piutang', '/stocks']

async function login(page: Page, email: string, password: string) {
  await page.goto(`${qa.baseUrl}/login`, { waitUntil: 'networkidle' })
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: /masuk/i }).click()
  try {
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 45000 })
  } catch (e) {
    const alertText = await page.locator('[role="alert"]').textContent().catch(() => '')
    console.error(`Login error for ${email}: ${alertText}`)
    throw new Error(`Login failed for ${email}: ${alertText || 'URL wait timeout'}`)
  }
}

const median = (xs: number[]) => {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

type Row = { role: string; route: string; valid: number; lcp: number; tbt: number; cls: number; ttfb: number; score: number; bytes: number; lcpEl: string; invalid: string[] }

async function measureRole(role: 'owner' | 'staff' | 'anon', routes: string[], port: number): Promise<Row[]> {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), `qa-lh-${role}-`))
  const ctx = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    executablePath: qa.chromePath,
    args: [`--remote-debugging-port=${port}`]
  })
  const page = ctx.pages()[0] ?? (await ctx.newPage())
  if (role !== 'anon') {
    const cred = role === 'owner' ? qa.owner : qa.staff
    await login(page, cred.email, cred.password)
  }
  const rows: Row[] = []
  for (const route of routes) {
    const runs: Omit<Row, 'role' | 'route' | 'valid' | 'invalid'>[] = []
    const invalid: string[] = []
    // pemanasan 1x agar fungsi serverless tidak cold start
    await page.goto(`${qa.baseUrl}${route}`, { waitUntil: 'load' }).catch(() => {})
    for (let i = 0; i < RUNS; i++) {
      const result = await lighthouse(`${qa.baseUrl}${route}`, {
        port,
        output: 'json',
        logLevel: 'error',
        disableStorageReset: true,
        onlyCategories: ['performance']
      })
      if (!result) continue
      const lhr = result.lhr
      const finalPath = new URL(lhr.finalDisplayedUrl).pathname
      const safe = `${role}${route.replace(/\//g, '_')}-${i}`
      fs.writeFileSync(path.join(OUT_DIR, `${safe}.json`), JSON.stringify(lhr))
      if (finalPath !== route) {
        invalid.push(`run${i}: ${finalPath}`)
        continue
      }
      const lcpItem: any = (lhr.audits['largest-contentful-paint-element'] as any)?.details?.items?.[0]
      const lcpNode = lcpItem?.items?.[0]?.node ?? lcpItem?.node
      runs.push({
        lcp: lhr.audits['largest-contentful-paint'].numericValue ?? NaN,
        tbt: lhr.audits['total-blocking-time'].numericValue ?? NaN,
        cls: lhr.audits['cumulative-layout-shift'].numericValue ?? NaN,
        ttfb: lhr.audits['server-response-time'].numericValue ?? NaN,
        score: (lhr.categories.performance.score ?? 0) * 100,
        bytes: lhr.audits['total-byte-weight'].numericValue ?? NaN,
        lcpEl: lcpNode?.snippet ? String(lcpNode.snippet).slice(0, 90) : '-'
      })
    }
    const row: Row = {
      role, route, valid: runs.length,
      lcp: median(runs.map(r => r.lcp)),
      tbt: median(runs.map(r => r.tbt)),
      cls: median(runs.map(r => r.cls)),
      ttfb: median(runs.map(r => r.ttfb)),
      score: median(runs.map(r => r.score)),
      bytes: median(runs.map(r => r.bytes)),
      lcpEl: runs[0]?.lcpEl ?? '-',
      invalid
    }
    rows.push(row)
    console.log(JSON.stringify(row))
  }
  await ctx.close()
  return rows
}

const env = {
  commit: execSync('git rev-parse --short HEAD').toString().trim(),
  date: new Date().toISOString(),
  url: qa.baseUrl,
  runs: RUNS,
  preset: 'lighthouse default mobile (simulated Slow 4G, CPU 4x)',
  os: `${os.type()} ${os.release()}`,
  lighthouse: JSON.parse(fs.readFileSync('node_modules/lighthouse/package.json', 'utf8')).version
}

const all: Row[] = []
const pick = (rs: string[]) => (ONLY ? rs.filter(r => ONLY.includes(r)) : rs)

const saveSummary = () => {
  fs.writeFileSync(path.join(OUT_DIR, `_summary-${ROLE}.json`), JSON.stringify({ env, rows: all }, null, 2))
  console.log('SUMMARY_WRITTEN', path.join(OUT_DIR, `_summary-${ROLE}.json`))
}

if (ROLE === 'all' || ROLE === 'owner') {
  if (pick(['/login']).length) {
    all.push(...(await measureRole('anon', ['/login'], 9301)))
    saveSummary()
  }
  all.push(...(await measureRole('owner', pick(ROUTES_OWNER), 9302)))
  saveSummary()
}
if (ROLE === 'all' || ROLE === 'staff') {
  all.push(...(await measureRole('staff', pick(ROUTES_STAFF), 9303)))
  saveSummary()
}
