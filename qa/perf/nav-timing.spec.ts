import { test } from '@playwright/test'
import { loadQaEnv } from '../lib/env'
import fs from 'node:fs'
import path from 'node:path'

const qa = loadQaEnv()

test('Measure navigation timing between routes', async ({ page }) => {
  test.setTimeout(180000)
  await page.goto(`${qa.baseUrl}/login`)
  await page.locator('#email').fill(qa.owner.email)
  await page.locator('#password').fill(qa.owner.password)
  await page.getByRole('button', { name: /masuk/i }).click()
  await page.waitForURL(/\/(dashboard|onboarding)/)

  const pairs = [
    { from: '/dashboard', to: '/transactions', name: 'Dashboard -> Transactions' },
    { from: '/transactions', to: '/stocks', name: 'Transactions -> Stocks' },
    { from: '/stocks', to: '/mitras', name: 'Stocks -> Mitras' },
    { from: '/mitras', to: '/products', name: 'Mitras -> Products' },
    { from: '/products', to: '/reports/profit-loss', name: 'Products -> Profit Loss' }
  ]

  const results: any[] = []

  for (const pair of pairs) {
    await page.goto(`${qa.baseUrl}${pair.from}`, { waitUntil: 'load' })
    const link = page.locator(`a[href="${pair.to}"]`).first()
    if (await link.count() === 0) continue

    const t0 = performance.now()
    await link.click()
    await page.waitForURL(new RegExp(pair.to))
    // wait for main content heading
    await page.locator('main').waitFor({ state: 'visible' })
    const totalMs = Math.round(performance.now() - t0)

    results.push({
      pair: pair.name,
      navMs: totalMs
    })
    console.log(`${pair.name}: ${totalMs} ms`)
  }

  const phase = process.env.PERF_PHASE || 'baseline'
  const outDir = path.join('docs', 'qa', 'evidence', phase)
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, '_nav_timing.json'), JSON.stringify(results, null, 2))
})
