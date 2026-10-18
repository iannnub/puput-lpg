import { test, expect } from '@playwright/test'
import { loadQaEnv } from '../lib/env'

const qa = loadQaEnv()

import * as fs from 'node:fs'
import * as path from 'node:path'

test.describe('INP Probe & Nav Timing', () => {
  test.setTimeout(180000)

  test('Calibration: busy loop 300ms measures > 250ms', async ({ page }) => {
    await page.setContent(`
      <button id="btn" style="padding: 20px; font-size: 20px;">Click Me</button>
      <script>
        window.__events = [];
        const po = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.interactionId) {
              window.__events.push({
                name: entry.name,
                duration: entry.duration,
                interactionId: entry.interactionId
              });
            }
          }
        });
        po.observe({ type: 'event', buffered: true, durationThreshold: 16 });

        document.getElementById('btn').addEventListener('click', () => {
          const start = performance.now();
          while (performance.now() - start < 300) {}
        });
      </script>
    `)

    await page.click('#btn')
    await page.waitForTimeout(100)

    const events = await page.evaluate(() => (window as any).__events)
    expect(events.length).toBeGreaterThan(0)
    const maxDuration = Math.max(...events.map((e: any) => e.duration))
    expect(maxDuration).toBeGreaterThan(250)
  })

  test('Interaction probe on production (read-only interactions)', async ({ page }) => {
    // 1. Login first without throttling to save time
    await page.goto(`${qa.baseUrl}/login`)
    await page.locator('#email').fill(qa.owner.email)
    await page.locator('#password').fill(qa.owner.password)
    await page.getByRole('button', { name: /masuk/i }).click()
    await page.waitForURL(/\/(dashboard|onboarding)/)

    // CDPSession throttling (CPU 4x, Slow 4G latency 150ms)
    const client = await page.context().newCDPSession(page)
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8
    })

    // Navigate to /transactions/new
    await page.goto(`${qa.baseUrl}/transactions/new`, { waitUntil: 'networkidle' })

    // Helper to measure next interaction
    await page.evaluate(() => {
      ;(window as any).__events = []
      const po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (entry.interactionId) {
            ;(window as any).__events.push({
              name: entry.name,
              duration: entry.duration,
              target: entry.target ? entry.target.tagName : '',
              interactionId: entry.interactionId
            })
          }
        }
      })
      po.observe({ type: 'event', buffered: true, durationThreshold: 16 } as any)
    })

    // Interaction A: Click "Tambah Produk"
    const addBtn = page.getByRole('button', { name: /tambah produk/i })
    if (await addBtn.isVisible()) {
      await addBtn.click()
      await page.waitForTimeout(400)
    }

    // Interaction B: Change input quantity
    const spinInputs = page.locator('input[type="number"]')
    if (await spinInputs.count() > 0) {
      await spinInputs.first().fill('15')
      await page.waitForTimeout(400)
    }

    // Read recorded interaction durations
    const events: Array<{ name: string; duration: number; target: string; interactionId: number }> =
      await page.evaluate(() => (window as any).__events || [])

    console.log('Recorded interaction events count:', events.length)
    const phase = process.env.PERF_PHASE || 'baseline'
    const outDir = path.resolve(process.cwd(), 'docs/qa/evidence', phase)
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
    fs.writeFileSync(path.join(outDir, '_inp.json'), JSON.stringify(events, null, 2))
  })
})
