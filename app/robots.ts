import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const rawEnvUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'https://puput-lpg.vercel.app')

  let cleanUrl = rawEnvUrl.trim()
  if (cleanUrl.includes('=')) {
    cleanUrl = cleanUrl.split('=').pop()?.trim() || cleanUrl
  }
  const siteUrl = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/']
    },
    sitemap: `${siteUrl}/sitemap.xml`
  }
}
