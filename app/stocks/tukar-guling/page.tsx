import { AppShell, getAuthenticatedContext } from '@/components/layout/app-shell'
import { TukarGulingForm } from './tukar-guling-form'

export const dynamic = 'force-dynamic'

export default async function TukarGulingPage() {
  const { supabase } = await getAuthenticatedContext()

  const [{ data: mitras }, { data: stocksData }] = await Promise.all([
    supabase
      .from('mitras')
      .select('id, name')
      .eq('status', 'active')
      .order('is_system', { ascending: false })
      .order('name', { ascending: true }),
    supabase
      .from('stocks')
      .select('product_id, gudang_isi, gudang_bocor, products!inner(name, is_active)')
      .eq('products.is_active', true)
      .order('updated_at', { ascending: true })
  ])

  const products = (stocksData ?? []).map(row => {
    const prod = Array.isArray(row.products) ? row.products[0] : row.products
    return {
      product_id: row.product_id,
      name: prod?.name ?? '-',
      gudang_isi: row.gudang_isi,
      gudang_bocor: row.gudang_bocor
    }
  })

  return (
    <AppShell activePath="/stocks">
      <TukarGulingForm mitras={mitras ?? []} products={products} />
    </AppShell>
  )
}
