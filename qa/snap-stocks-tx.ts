import { chromium } from 'playwright-core'
import path from 'node:path'
import fs from 'node:fs'

const BASE_URL = 'https://puput-lpg.vercel.app'
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const LOCAL_DIR = path.join(process.cwd(), 'docs', 'screenshots')
const ARTIFACT_DIR = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\43e14fe9-6de7-4c85-8c6f-331ce1748742'

async function snap() {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH })
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
  await page.locator('#identifier').fill('adminlpg')
  await page.locator('#password').fill('adminlpg123')
  await page.getByRole('button', { name: /masuk/i }).click()
  await page.waitForURL(/\/dashboard/)

  // Capture stocks page
  await page.goto(`${BASE_URL}/stocks`, { waitUntil: 'networkidle' })
  const stocksPath = path.join(LOCAL_DIR, 'final-stocks-page.png')
  await page.screenshot({ path: stocksPath })
  fs.copyFileSync(stocksPath, path.join(ARTIFACT_DIR, 'final-stocks-page.png'))

  // Capture transactions page
  await page.goto(`${BASE_URL}/transactions`, { waitUntil: 'networkidle' })
  const txPath = path.join(LOCAL_DIR, 'final-transactions-page.png')
  await page.screenshot({ path: txPath })
  fs.copyFileSync(txPath, path.join(ARTIFACT_DIR, 'final-transactions-page.png'))

  await browser.close()
  console.log('Final stocks and transactions snapshots captured.')
}

snap().catch(console.error)
