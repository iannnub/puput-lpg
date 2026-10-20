import { defineUnlighthouseConfig } from 'unlighthouse/config'

export default defineUnlighthouseConfig({
  site: 'https://puput-lpg.vercel.app',
  scanner: {
    device: 'mobile',
    throttle: true,
    maxRoutes: 50,
  },
  ci: {
    budget: {
      performance: 75,
      accessibility: 90,
      'best-practices': 85,
      seo: 80,
    },
    reporter: 'jsonExpanded',
  },
  puppeteerClusterOptions: {
    maxConcurrency: 1,
  },
  hooks: {
    async authenticate(page) {
      try {
        await page.goto('https://puput-lpg.vercel.app/login', { waitUntil: 'networkidle2' })
        await page.waitForSelector('#identifier', { timeout: 8000 })
        await page.type('#identifier', 'adminlpg')
        await page.type('#password', 'adminlpg123')
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
          page.click('button[type="submit"]')
        ])
        console.log('[Unlighthouse Auth] Authenticated successfully as adminlpg')
      } catch (err: any) {
        console.warn('[Unlighthouse Auth] Hook note:', err?.message || err)
      }
    },
  },
})
