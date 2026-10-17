'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function terimaSusulanAction(
  mitraId: string,
  returns: Array<{ product_id: string; qty: number }>,
  catatan: string
) {
  const supabase = await createClient()

  const filteredReturns = returns
    .map(r => ({
      product_id: r.product_id,
      qty: Math.floor(r.qty)
    }))
    .filter(r => r.qty > 0)

  if (filteredReturns.length === 0) {
    return { error: 'Masukkan minimal 1 tabung kosong yang dikembalikan.' }
  }

  const { error } = await supabase.rpc('rpc_receive_susulan', {
    p_mitra_id: mitraId,
    p_returns: filteredReturns,
    p_notes: catatan.trim()
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/transactions')
  revalidatePath('/transactions/susulan')
  revalidatePath('/stocks')
  revalidatePath('/mitras')
  revalidatePath('/dashboard')

  return { success: true }
}
