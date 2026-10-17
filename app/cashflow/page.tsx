import { redirect } from 'next/navigation'
import { AppShell, getAuthenticatedContext } from '@/components/layout/app-shell'
import { CashflowClient, type CashflowItem } from './cashflow-client'

export const dynamic = 'force-dynamic'

export default async function CashflowPage() {
  const { supabase, isOwner } = await getAuthenticatedContext()

  if (!isOwner) {
    redirect('/dashboard?error=forbidden')
  }

  const [
    { data: laciBalance },
    { data: bankBalance },
    { data: cashflowsData }
  ] = await Promise.all([
    supabase.rpc('get_cash_balance', { p_source: 'kas_laci' }),
    supabase.rpc('get_cash_balance', { p_source: 'kas_bank' }),
    supabase
      .from('cashflows')
      .select('id, type, direction, source, amount, description, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
  ])

  const initialCashflows: CashflowItem[] = (cashflowsData ?? []).map((c) => ({
    id: c.id,
    type: c.type,
    direction: c.direction as 'in' | 'out',
    source: c.source as 'kas_laci' | 'kas_bank',
    amount: Number(c.amount),
    description: c.description,
    created_at: c.created_at
  }))

  return (
    <AppShell activePath="/cashflow">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">DASHBOARD KAS &amp; MUTASI</h1>
          <p className="mt-1 text-sm text-slate-600">
            Pantau saldo uang fisik laci kasir dan saldo rekening bank, setor/tarik tunai, serta catat pengeluaran operasional harian.
          </p>
        </div>

        <CashflowClient
          kasLaciBalance={Number(laciBalance ?? 0)}
          kasBankBalance={Number(bankBalance ?? 0)}
          initialCashflows={initialCashflows}
        />
      </div>
    </AppShell>
  )
}
