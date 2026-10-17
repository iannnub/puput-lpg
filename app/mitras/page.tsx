import { AppShell, getAuthenticatedContext } from '@/components/layout/app-shell'
import { MitrasClient, type MitraSummaryRow } from './mitras-client'
import { getWibTodayString } from '@/lib/utils/date-wib'

export const dynamic = 'force-dynamic'

export default async function MitrasPage() {
  const { supabase } = await getAuthenticatedContext()
  const todayWib = getWibTodayString()

  const [{ data: mitras }, { data: activeDebts }, { data: balances }] = await Promise.all([
    supabase
      .from('mitras')
      .select(
        'id, name, phone, address, credit_limit, max_pending_invoices, is_system, status'
      )
      .order('is_system', { ascending: false })
      .order('name', { ascending: true }),
    supabase
      .from('transactions')
      .select('mitra_id, total_amount, total_paid, due_date, payment_status')
      .neq('payment_status', 'lunas')
      .is('voided_at', null),
    supabase.from('mitra_product_balances').select('mitra_id, borrowed_qty')
  ])

  const debtMap = new Map<
    string,
    { debt: number; count: number; overdue: boolean }
  >()
  for (const tx of activeDebts ?? []) {
    const remaining = Number(tx.total_amount) - Number(tx.total_paid)
    if (remaining <= 0) continue
    const prev = debtMap.get(tx.mitra_id) ?? { debt: 0, count: 0, overdue: false }
    const isOverdue = Boolean(tx.due_date && tx.due_date < todayWib)
    debtMap.set(tx.mitra_id, {
      debt: prev.debt + remaining,
      count: prev.count + 1,
      overdue: prev.overdue || isOverdue
    })
  }

  const borrowedMap = new Map<string, number>()
  for (const b of balances ?? []) {
    const prev = borrowedMap.get(b.mitra_id) ?? 0
    borrowedMap.set(b.mitra_id, prev + Number(b.borrowed_qty))
  }

  const rows: MitraSummaryRow[] = (mitras ?? []).map(m => {
    const d = debtMap.get(m.id) ?? { debt: 0, count: 0, overdue: false }
    return {
      id: m.id,
      name: m.name,
      phone: m.phone,
      address: m.address,
      credit_limit: Number(m.credit_limit),
      max_open_invoices: m.max_pending_invoices,
      is_system: m.is_system,
      is_active: m.status === 'active',
      current_debt: d.debt,
      open_invoices_count: d.count,
      has_overdue: d.overdue,
      total_borrowed_qty: borrowedMap.get(m.id) ?? 0
    }
  })

  return (
    <AppShell activePath="/mitras">
      <MitrasClient mitras={rows} />
    </AppShell>
  )
}
