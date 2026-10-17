import { createClient } from '@/lib/supabase/server'
import { getWibTodayString } from '@/lib/utils/date-wib'

export function calculateDaysOverdue(dueDateStr: string | null): number {
  if (!dueDateStr) return 0
  const todayMs = new Date(`${getWibTodayString()}T00:00:00+07:00`).getTime()
  const dueMs = new Date(`${dueDateStr}T00:00:00+07:00`).getTime()
  return Math.floor((todayMs - dueMs) / (1000 * 60 * 60 * 24))
}

export async function getPiutangList(filter: 'all' | 'overdue' | 'upcoming') {
  const supabase = await createClient()
  const todayWib = getWibTodayString()

  let query = supabase
    .from('transactions')
    .select('*, mitras(name, phone)')
    .neq('payment_status', 'lunas')
    .is('voided_at', null)
    .order('due_date', { ascending: true })

  if (filter === 'overdue') {
    query = query.lt('due_date', todayWib)
  } else if (filter === 'upcoming') {
    const sevenDaysLater = new Date(`${todayWib}T00:00:00+07:00`)
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)
    const maxDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(
      sevenDaysLater
    )
    query = query.gte('due_date', todayWib).lte('due_date', maxDateStr)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map(t => {
    const daysOverdue = calculateDaysOverdue(t.due_date)
    const agingStatus: 'danger' | 'warning' | 'success' =
      daysOverdue > 0 ? 'danger' : daysOverdue >= -7 ? 'warning' : 'success'

    const mitraObj = Array.isArray(t.mitras) ? t.mitras[0] : t.mitras

    return {
      id: t.id,
      invoice_number: t.invoice_number,
      transaction_date: t.transaction_date,
      due_date: t.due_date,
      total_amount: Number(t.total_amount),
      total_paid: Number(t.total_paid),
      remaining: Number(t.total_amount) - Number(t.total_paid),
      payment_status: t.payment_status,
      is_legacy: t.is_legacy,
      mitra_name: mitraObj?.name ?? '-',
      mitra_phone: mitraObj?.phone ?? null,
      daysOverdue,
      agingStatus
    }
  })
}
