import { AppShell, getAuthenticatedContext } from '@/components/layout/app-shell'
import { BocorForm } from './bocor-form'

export const dynamic = 'force-dynamic'

export default async function LaporBocorPage() {
  const { supabase } = await getAuthenticatedContext()

  const { data: stocksData } = await supabase
    .from('stocks')
    .select('product_id, gudang_isi, gudang_bocor, products!inner(name, is_active)')
    .eq('products.is_active', true)
    .order('updated_at', { ascending: true })

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
      <BocorForm products={products} />
    </AppShell>
  )
}
