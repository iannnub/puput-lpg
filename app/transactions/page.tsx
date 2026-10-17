import { AppShell, getAuthenticatedContext } from '@/components/layout/app-shell'
import { TransactionsClient, type TransactionListItem } from './transactions-client'
import { getWibTodayString } from '@/lib/utils/date-wib'

export const dynamic = 'force-dynamic'

export default async function TransactionsPage() {
  const { supabase, isOwner } = await getAuthenticatedContext()
  const todayWib = getWibTodayString()

  const { data: rows } = await supabase
    .from('transactions')
    .select(
      'id, invoice_number, transaction_date, total_amount, total_paid, payment_status, due_date, voided_at, is_legacy, mitras(name)'
    )
    .order('created_at', { ascending: false })
    .limit(100)

  const transactions: TransactionListItem[] = (rows ?? []).map(tx => {
    const mitraObj = Array.isArray(tx.mitras) ? tx.mitras[0] : tx.mitras
    return {
      id: tx.id,
      invoice_number: tx.invoice_number,
      transaction_date: tx.transaction_date,
      total_amount: Number(tx.total_amount),
      total_paid: Number(tx.total_paid),
      payment_status: tx.payment_status,
      due_date: tx.due_date,
      voided_at: tx.voided_at,
      is_legacy: tx.is_legacy,
      mitra_name: mitraObj?.name ?? '-'
    }
  })

  return (
    <AppShell activePath="/transactions">
      <TransactionsClient
        transactions={transactions}
        isOwner={isOwner}
        todayWib={todayWib}
      />
    </AppShell>
  )
}
