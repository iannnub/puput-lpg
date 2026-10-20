import type { Metadata } from 'next'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoginForm } from './login-form'

export const metadata: Metadata = {
  title: 'Masuk ke Sistem | Puput LPG',
  description:
    'Portal autentikasi resmi sistem manajemen operasional pangkalan, kasir surat jalan, dan stok tabung gas Puput LPG.'
}

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  let initialError: string | undefined
  if (params.error === 'inactive') {
    initialError = 'Akun Anda sedang dinonaktifkan. Hubungi Owner.'
  }

  const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Puput LPG'

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-md border-slate-300">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex items-center justify-center">
            <Image
              src="/logo-transparent.png"
              alt="Logo Puput LPG"
              width={210}
              height={117}
              priority
              sizes="210px"
              className="h-auto w-[210px] object-contain"
            />
          </div>
          <CardTitle className="text-xl font-bold text-slate-900">
            SISTEM DISTRIBUSI GAS LPG
          </CardTitle>
          <CardDescription className="text-sm text-slate-600">
            {businessName}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <LoginForm initialError={initialError} />
        </CardContent>
      </Card>
    </div>
  )
}
