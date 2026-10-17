import { AppShell, getAuthenticatedContext } from '@/components/layout/app-shell'
import { RestockForm } from './restock-form'

export const dynamic = 'force-dynamic'

export default async function RestockPage() {
  const { supabase } = await getAuthenticatedContext()

  const { data: stocksData } = await supabase
    .from('stocks')
    .select('product_id, gudang_isi, gudang_kosong, gudang_bocor, products!inner(name, buy_price, is_active)')
    .eq('products.is_active', true)
    .order('updated_at', { ascending: true })

  const products = (stocksData ?? []).map(row => {
    const prod = Array.isArray(row.products) ? row.products[0] : row.products
    return {
      product_id: row.product_id,
      name: prod?.name ?? '-',
      buy_price: Number(prod?.buy_price ?? 0),
      gudang_isi: row.gudang_isi,
      gudang_kosong: row.gudang_kosong,
      gudang_bocor: row.gudang_bocor
    }
  })

  return (
    <AppShell activePath="/stocks">
      <RestockForm products={products} />
    </AppShell>
  )
}
