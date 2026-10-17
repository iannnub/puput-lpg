import { notFound } from 'next/navigation'
import { AppShell, getAuthenticatedContext } from '@/components/layout/app-shell'
import { MitraDetailClient } from './mitra-detail-client'
import { getWibTodayString } from '@/lib/utils/date-wib'

export const dynamic = 'force-dynamic'

export default async function MitraDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, isOwner } = await getAuthenticatedContext()
  const todayWib = getWibTodayString()

  const [
    { data: mitra },
    { data: products },
    { data: settings },
    { data: balances },
    { data: transactions }
  ] = await Promise.all([
    supabase
      .from('mitras')
      .select(
        'id, name, phone, address, credit_limit, max_pending_invoices, is_system, status'
      )
      .eq('id', id)
      .single(),
    supabase
      .from('products')
      .select('id, name, buy_price, sell_price')
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    supabase
      .from('mitra_product_settings')
      .select('product_id, custom_sell_price')
      .eq('mitra_id', id),
    supabase
      .from('mitra_product_balances')
      .select('product_id, borrowed_qty')
      .eq('mitra_id', id),
    supabase
      .from('transactions')
      .select(
        'id, invoice_number, transaction_date, total_amount, total_paid, payment_status, due_date, voided_at, is_legacy'
      )
      .eq('mitra_id', id)
      .order('created_at', { ascending: false })
      .limit(25)
  ])

  if (!mitra) {
    notFound()
  }

  const customPrices: Record<string, number> = {}
  for (const s of settings ?? []) {
    customPrices[s.product_id] = Number(s.custom_sell_price)
  }

  const borrowedBalances: Record<string, number> = {}
  for (const b of balances ?? []) {
    borrowedBalances[b.product_id] = Number(b.borrowed_qty)
  }

  return (
    <AppShell activePath="/mitras">
      <MitraDetailClient
        mitra={{
          id: mitra.id,
          name: mitra.name,
          phone: mitra.phone,
          address: mitra.address,
          credit_limit: Number(mitra.credit_limit),
          max_open_invoices: mitra.max_pending_invoices,
          is_system: mitra.is_system,
          is_active: mitra.status === 'active'
        }}
        products={products ?? []}
        customPrices={customPrices}
        borrowedBalances={borrowedBalances}
        transactions={transactions ?? []}
        isOwner={isOwner}
        todayWib={todayWib}
      />
    </AppShell>
  )
}
