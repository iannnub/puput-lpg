import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoginForm } from './login-form'

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

  const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Pangkalan LPG'

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-md border-slate-300">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-md bg-primary text-lg font-bold text-white">
            LPG
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">
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
