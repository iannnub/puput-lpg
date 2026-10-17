import { createClient } from '@/lib/supabase/client'
import { getWibTodayString } from '@/lib/utils/date-wib'

export async function getActiveDrivers() {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('rpc_get_active_drivers')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function checkMitraCreditStatus(mitraId: string) {
  const supabase = createClient()
  const todayWib = getWibTodayString()

  const { data: mitra, error: mitraErr } = await supabase
    .from('mitras')
    .select('id, name, credit_limit, max_pending_invoices, status, is_system')
    .eq('id', mitraId)
    .single()

  if (mitraErr || !mitra) throw new Error('Mitra tidak ditemukan')

  const { data: openTransactions, error: trxErr } = await supabase
    .from('transactions')
    .select('id, total_amount, total_paid, due_date')
    .eq('mitra_id', mitraId)
    .neq('payment_status', 'lunas')
    .is('voided_at', null)

  if (trxErr) throw new Error(trxErr.message)

  const list = openTransactions ?? []
  const overdueCount = list.filter(t => t.due_date && t.due_date < todayWib).length
  const totalPiutang = list.reduce(
    (sum, t) => sum + (Number(t.total_amount) - Number(t.total_paid)),
    0
  )
  const currentPendingCount = list.length

  return {
    isBlocked: mitra.status === 'blocked',
    isSystemWalkIn: mitra.is_system,
    isOverdue: overdueCount > 0,
    overdueCount,
    totalPiutang,
    creditLimit: Number(mitra.credit_limit),
    availableCredit: Number(mitra.credit_limit) - totalPiutang,
    maxPendingInvoices: mitra.max_pending_invoices,
    currentPendingCount
  }
}
