import { AppShell, getAuthenticatedContext } from '@/components/layout/app-shell'
import { NewTransactionForm } from './new-transaction-form'
import { getWibTodayString, addDaysWib } from '@/lib/utils/date-wib'

export const dynamic = 'force-dynamic'

export default async function NewTransactionPage() {
  const { supabase, isOwner } = await getAuthenticatedContext()
  const todayWib = getWibTodayString()
  const defaultDueDate = addDaysWib(todayWib, 14)

  const [
    { data: stocksData },
    { data: mitrasData },
    { data: driversData },
    { data: customSettings }
  ] = await Promise.all([
    supabase
      .from('stocks')
      .select('product_id, gudang_isi, products!inner(id, name, sell_price, is_active)')
      .eq('products.is_active', true)
      .order('updated_at', { ascending: true }),
    supabase
      .from('mitras')
      .select('id, name, credit_limit, max_pending_invoices, is_system, status')
      .eq('status', 'active')
      .order('is_system', { ascending: false })
      .order('name', { ascending: true }),
    supabase.rpc('rpc_get_active_drivers'),
    supabase.from('mitra_product_settings').select('mitra_id, product_id, custom_sell_price')
  ])

  const products = (stocksData ?? []).map(row => {
    const prod = Array.isArray(row.products) ? row.products[0] : row.products
    return {
      id: row.product_id,
      name: prod?.name ?? '-',
      sell_price: Number(prod?.sell_price ?? 0),
      gudang_isi: row.gudang_isi
    }
  })

  const customPrices: Record<string, Record<string, number>> = {}
  for (const s of customSettings ?? []) {
    if (!customPrices[s.mitra_id]) {
      customPrices[s.mitra_id] = {}
    }
    customPrices[s.mitra_id][s.product_id] = Number(s.custom_sell_price)
  }

  return (
    <AppShell activePath="/transactions">
      <NewTransactionForm
        products={products}
        mitras={(mitrasData ?? []).map(m => ({
          id: m.id,
          name: m.name,
          credit_limit: Number(m.credit_limit),
          max_pending_invoices: m.max_pending_invoices,
          is_system: m.is_system
        }))}
        drivers={driversData ?? []}
        customPrices={customPrices}
        defaultDate={todayWib}
        defaultDueDate={defaultDueDate}
        isOwner={isOwner}
      />
    </AppShell>
  )
}
