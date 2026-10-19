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

  const [
    { data: products },
    { data: mitras },
    { data: stocks },
    { data: cashflows }
  ] = await Promise.all([
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
      .order('name', { ascending: true }),
    supabase
      .from('stocks')
      .select('product_id, gudang_isi, gudang_kosong, gudang_bocor'),
    supabase
      .from('cashflows')
      .select('source, amount')
      .eq('type', 'initial_balance')
  ])

  const defaultDate = getWibTodayString()
  const initialKasLaci = cashflows?.find(c => c.source === 'kas_laci')?.amount ?? 0
  const initialKasBank = cashflows?.find(c => c.source === 'kas_bank')?.amount ?? 0

  return (
    <AppShell activePath="/onboarding">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Pengaturan Saldo & Stok Awal
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Pencatatan kas awal, stok tabung fisik di gudang, dan saldo piutang lama sebelum operasional berjalan.
        </p>
      </div>

      {settings?.onboarding_completed ? (
        <Alert variant="default">
          <AlertTitle>Pengaturan Awal Tersimpan</AlertTitle>
          <AlertDescription>
            Data saldo kas dan stok fisik gudang sudah pernah dicatat. Jika terdapat angka yang keliru atau catatan yang perlu diperbaiki, Anda dapat memperbaruinya kapan saja melalui formulir di bawah ini.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="warning">
          <AlertTitle>Panduan Pengaturan Awal</AlertTitle>
          <AlertDescription>
            Masukkan posisi kas riil, jumlah tabung di gudang, dan catatan piutang mitra lama (jika ada). Anda tetap dapat menyesuaikan kembali data ini jika di kemudian hari terdapat catatan yang keliru.
          </AlertDescription>
        </Alert>
      )}

      <OnboardingWizard
        products={products ?? []}
        mitras={mitras ?? []}
        defaultDate={defaultDate}
        isCompleted={Boolean(settings?.onboarding_completed)}
        initialKasLaci={initialKasLaci}
        initialKasBank={initialKasBank}
        initialStocks={stocks ?? []}
      />
    </AppShell>
  )
}
