import { AppShell, getAuthenticatedContext } from '@/components/layout/app-shell'
import { SusulanForm } from './susulan-form'

export const dynamic = 'force-dynamic'

export default async function SusulanPage() {
  const { supabase } = await getAuthenticatedContext()

  const [{ data: mitras }, { data: products }, { data: balances }] = await Promise.all([
    supabase
      .from('mitras')
      .select('id, name')
      .eq('status', 'active')
      .eq('is_system', false)
      .order('name', { ascending: true }),
    supabase
      .from('products')
      .select('id, name')
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    supabase
      .from('mitra_product_balances')
      .select('mitra_id, product_id, borrowed_qty')
  ])

  const borrowedByMitra: Record<string, Record<string, number>> = {}
  for (const b of balances ?? []) {
    if (!borrowedByMitra[b.mitra_id]) {
      borrowedByMitra[b.mitra_id] = {}
    }
    borrowedByMitra[b.mitra_id][b.product_id] = Number(b.borrowed_qty)
  }

  return (
    <AppShell activePath="/transactions">
      <SusulanForm
        mitras={mitras ?? []}
        products={products ?? []}
        borrowedByMitra={borrowedByMitra}
      />
    </AppShell>
  )
}
