import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap'
})

const rawSiteUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://puput-lpg.vercel.app')

const siteUrl = rawSiteUrl.startsWith('http') ? rawSiteUrl : `https://${rawSiteUrl}`

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f2544'
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Puput LPG | Sistem Manajemen Distribusi & Pangkalan LPG',
    template: '%s | Puput LPG'
  },
  description:
    'Sistem manajemen operasional, stok tabung 4-keranjang, kasir surat jalan, piutang mitra, arus kas, dan penggajian terpadu untuk Pangkalan Puput LPG.',
  applicationName: 'Puput LPG',
  keywords: [
    'Puput LPG',
    'Pangkalan LPG',
    'Distribusi Gas LPG',
    'Manajemen Stok Tabung LPG',
    'Aplikasi Pangkalan Gas 3kg 12kg',
    'Pembukuan Agen LPG',
    'Surat Jalan LPG',
    'Laporan Laba Rugi Pangkalan LPG'
  ],
  authors: [{ name: 'Puput LPG' }],
  creator: 'Puput LPG',
  publisher: 'Puput LPG',
  alternates: {
    canonical: '/'
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1
    }
  },
  icons: {
    icon: [{ url: '/icon.png', sizes: '512x512', type: 'image/png' }],
    shortcut: ['/icon.png'],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }]
  },
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    url: siteUrl,
    siteName: 'Puput LPG',
    title: 'Puput LPG - Sistem Manajemen Distribusi & Pangkalan Gas LPG',
    description:
      'Pantau stok tabung LPG 4-keranjang, transaksi surat jalan mitra, piutang tempo, arus kas, dan laporan laba rugi dalam satu aplikasi terintegrasi.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Puput LPG - Sistem Manajemen Distribusi & Pangkalan Gas LPG',
        type: 'image/jpeg'
      },
      {
        url: '/logo-transparent.png',
        width: 960,
        height: 533,
        alt: 'Logo Transparan Puput LPG',
        type: 'image/png'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Puput LPG - Sistem Manajemen Distribusi & Pangkalan Gas LPG',
    description:
      'Pantau stok tabung LPG 4-keranjang, transaksi surat jalan mitra, piutang tempo, arus kas, dan laporan laba rugi dalam satu aplikasi terintegrasi.',
    images: ['/og-image.jpg']
  }
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Puput LPG',
    url: siteUrl,
    image: `${siteUrl}/og-image.jpg`,
    logo: `${siteUrl}/logo-transparent.png`,
    description:
      'Sistem manajemen operasional, stok tabung 4-keranjang, kasir surat jalan, piutang mitra, arus kas, dan penggajian terpadu untuk Pangkalan Puput LPG.',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'All',
    inLanguage: 'id-ID'
  }

  return (
    <html lang="id" className={inter.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900">
        {children}
      </body>
    </html>
  )
}
