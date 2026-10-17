import { redirect } from 'next/navigation'
import { AppShell, getAuthenticatedContext } from '@/components/layout/app-shell'
import { OpnameForm } from './opname-form'

export const dynamic = 'force-dynamic'

export default async function StockOpnamePage() {
  const { supabase, isOwner } = await getAuthenticatedContext()

  if (!isOwner) {
    redirect('/dashboard?error=forbidden')
  }

  const { data: stocksData } = await supabase
    .from('stocks')
    .select(
      'product_id, gudang_isi, gudang_kosong, gudang_bocor, products!inner(name, is_active)'
    )
    .eq('products.is_active', true)
    .order('updated_at', { ascending: true })

  const products = (stocksData ?? []).map(row => {
    const prod = Array.isArray(row.products) ? row.products[0] : row.products
    return {
      product_id: row.product_id,
      name: prod?.name ?? '-',
      gudang_isi: row.gudang_isi,
      gudang_kosong: row.gudang_kosong,
      gudang_bocor: row.gudang_bocor
    }
  })

  return (
    <AppShell activePath="/stocks">
      <OpnameForm products={products} />
    </AppShell>
  )
}
