import { AppShell, getAuthenticatedContext } from '@/components/layout/app-shell'
import { ProductsClient } from './products-client'

export const dynamic = 'force-dynamic'

export default async function ProductsPage() {
  const { supabase, isOwner } = await getAuthenticatedContext()

  const { data: products } = await supabase
    .from('products')
    .select('id, name, buy_price, sell_price, is_active')
    .order('created_at', { ascending: true })

  return (
    <AppShell activePath="/products">
      <ProductsClient products={products ?? []} isOwner={isOwner} />
    </AppShell>
  )
}
