import { redirect } from 'next/navigation'
import { AppShell, getAuthenticatedContext } from '@/components/layout/app-shell'
import { OnboardingWizard } from './onboarding-wizard'
import { getWibTodayString } from '@/lib/utils/date-wib'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const { supabase, isOwner, settings } = await getAuthenticatedContext()

  if (!isOwner) {
    redirect('/dashboard?error=forbidden')
  }

  if (settings?.onboarding_completed) {
    redirect('/dashboard')
  }

  const [{ data: products }, { data: mitras }] = await Promise.all([
    supabase
      .from('products')
      .select('id, name')
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    supabase
      .from('mitras')
      .select('id, name')
      .eq('status', 'active')
      .eq('is_system', false)
      .order('name', { ascending: true })
  ])

  const defaultDate = getWibTodayString()

  return (
    <AppShell activePath="/onboarding">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Setup Awal Sistem - Migrasi Data Manual
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Halaman ini hanya dijalankan sekali oleh Owner saat pertama kali menggunakan sistem.
        </p>
      </div>

      <Alert variant="warning">
        <AlertTitle>Perhatian: Eksekusi Satu Kali (Atomic Transaction)</AlertTitle>
        <AlertDescription>
          Setelah Anda menyimpan Setup Awal ini, halaman onboarding akan dikunci permanen. Seluruh
          saldo kas awal, stok gudang awal, dan piutang migrasi disimpan sekaligus dalam satu
          transaksi database.
        </AlertDescription>
      </Alert>

      <OnboardingWizard
        products={products ?? []}
        mitras={mitras ?? []}
        defaultDate={defaultDate}
      />
    </AppShell>
  )
}
