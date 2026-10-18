// Sampler TTFB + header region. Jalankan: npx tsx qa/perf/ttfb-sampler.mts [label]
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'
import { loadQaEnv } from '../lib/env'

const qa = loadQaEnv()
const LABEL = process.argv[2] || 'baseline'
const N = Number(process.env.SAMPLES || 20)
const OUT_DIR = path.join('docs', 'qa', 'evidence', LABEL)
fs.mkdirSync(OUT_DIR, { recursive: true })

const ROUTES = {
  owner: ['/dashboard', '/transactions', '/transactions/new', '/transactions/piutang', '/stocks'],
  staff: ['/dashboard', '/transactions', '/transactions/new', '/transactions/piutang', '/stocks']
}

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]
}

async function cookieHeader(email: string, password: string) {
  const browser = await chromium.launch({ headless: true, executablePath: qa.chromePath })
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(`${qa.baseUrl}/login`)
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: /masuk/i }).click()
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30000 })
  const cookies = await ctx.cookies()
  await browser.close()
  return cookies.map(c => `${c.name}=${c.value}`).join('; ')
}

async function sample(url: string, cookie: string) {
  const t0 = performance.now()
  const res = await fetch(url, { headers: { cookie }, redirect: 'manual' })
  const t = performance.now() - t0
  await res.arrayBuffer()
  return {
    ms: t,
    status: res.status,
    vercelId: res.headers.get('x-vercel-id') ?? '',
    cache: res.headers.get('x-vercel-cache') ?? '',
    serverTiming: res.headers.get('server-timing') ?? ''
  }
}

const out: any[] = []
for (const role of ['owner', 'staff'] as const) {
  const cred = role === 'owner' ? qa.owner : qa.staff
  const cookie = await cookieHeader(cred.email, cred.password)
  for (const route of ROUTES[role]) {
    const url = `${qa.baseUrl}${route}`
    for (let i = 0; i < 3; i++) await sample(url, cookie)
    const xs: number[] = []
    const statuses = new Set<number>()
    let vercelId = ''
    let cache = ''
    for (let i = 0; i < N; i++) {
      const s = await sample(url, cookie)
      xs.push(s.ms)
      statuses.add(s.status)
      vercelId = s.vercelId
      cache = s.cache
    }
    const row = {
      role, route,
      statuses: [...statuses],
      p50: Math.round(pct(xs, 50)),
      p75: Math.round(pct(xs, 75)),
      p95: Math.round(pct(xs, 95)),
      region: vercelId.split('::').slice(0, -1).join('::'),
      cache
    }
    out.push(row)
    console.log(JSON.stringify(row))
  }
}
fs.writeFileSync(path.join(OUT_DIR, '_ttfb.json'), JSON.stringify({ date: new Date().toISOString(), samples: N, rows: out }, null, 2))
