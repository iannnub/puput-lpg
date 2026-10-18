import { chromium } from 'playwright-core'
import path from 'node:path'
import fs from 'node:fs'
import { loadQaEnv } from './lib/env'

const qa = loadQaEnv()
const ARTIFACT_DIR = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\43e14fe9-6de7-4c85-8c6f-331ce1748742'
const LOCAL_DIR = path.join(process.cwd(), 'docs', 'screenshots')
fs.mkdirSync(LOCAL_DIR, { recursive: true })

async function login(page: any, email: string, pass: string) {
  await page.goto(`${qa.baseUrl}/login`, { waitUntil: 'networkidle' })
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(pass)
  await page.getByRole('button', { name: /masuk/i }).click()
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30000 })
}

async function capture() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: qa.chromePath
  })

  // 1. Desktop Session (Owner)
  const desktopCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1
  })
  const dPage = await desktopCtx.newPage()
  await login(dPage, qa.owner.email, qa.owner.password)

  const desktopRoutes = [
    { name: 'post-dashboard-desktop.png', path: '/dashboard' },
    { name: 'post-transactions-new-desktop.png', path: '/transactions/new' },
    { name: 'post-stocks-desktop.png', path: '/stocks' },
    { name: 'post-profit-loss-desktop.png', path: '/reports/profit-loss' }
  ]

  for (const r of desktopRoutes) {
    await dPage.goto(`${qa.baseUrl}${r.path}`, { waitUntil: 'networkidle' })
    await dPage.waitForTimeout(500)
    const localPath = path.join(LOCAL_DIR, r.name)
    const artPath = path.join(ARTIFACT_DIR, r.name)
    await dPage.screenshot({ path: localPath, fullPage: false })
    fs.copyFileSync(localPath, artPath)
    console.log('Saved', r.name)
  }

  // 2. Mobile Session (Owner)
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2
  })
  const mPage = await mobileCtx.newPage()
  await login(mPage, qa.owner.email, qa.owner.password)

  const mobileRoutes = [
    { name: 'post-dashboard-mobile.png', path: '/dashboard' },
    { name: 'post-transactions-new-mobile.png', path: '/transactions/new' },
    { name: 'post-stocks-mobile.png', path: '/stocks' },
    { name: 'post-profit-loss-mobile.png', path: '/reports/profit-loss' }
  ]

  for (const r of mobileRoutes) {
    await mPage.goto(`${qa.baseUrl}${r.path}`, { waitUntil: 'networkidle' })
    await mPage.waitForTimeout(500)
    const localPath = path.join(LOCAL_DIR, r.name)
    const artPath = path.join(ARTIFACT_DIR, r.name)
    await mPage.screenshot({ path: localPath, fullPage: false })
    fs.copyFileSync(localPath, artPath)
    console.log('Saved', r.name)
  }

  // Mobile Drawer opened
  await mPage.goto(`${qa.baseUrl}/dashboard`, { waitUntil: 'networkidle' })
  await mPage.getByRole('button', { name: /buka menu navigasi/i }).click()
  await mPage.waitForTimeout(300)
  const drawerLocal = path.join(LOCAL_DIR, 'post-mobile-drawer-open.png')
  const drawerArt = path.join(ARTIFACT_DIR, 'post-mobile-drawer-open.png')
  await mPage.screenshot({ path: drawerLocal, fullPage: false })
  fs.copyFileSync(drawerLocal, drawerArt)
  console.log('Saved post-mobile-drawer-open.png')

  // 3. Staff Desktop Dashboard
  const staffCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  })
  const sPage = await staffCtx.newPage()
  await login(sPage, qa.staff.email, qa.staff.password)
  await sPage.goto(`${qa.baseUrl}/dashboard`, { waitUntil: 'networkidle' })
  await sPage.waitForTimeout(500)
  const staffLocal = path.join(LOCAL_DIR, 'post-dashboard-staff-desktop.png')
  const staffArt = path.join(ARTIFACT_DIR, 'post-dashboard-staff-desktop.png')
  await sPage.screenshot({ path: staffLocal, fullPage: false })
  fs.copyFileSync(staffLocal, staffArt)
  console.log('Saved post-dashboard-staff-desktop.png')

  await browser.close()
  console.log('All screenshots captured successfully.')
}

capture().catch(err => {
  console.error(err)
  process.exit(1)
})
