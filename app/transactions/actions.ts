'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function voidTransactionAction(
  transactionId: string,
  voidReason: string
) {
  const supabase = await createClient()

  const { error } = await supabase.rpc('rpc_void_transaction', {
    p_transaction_id: transactionId,
    p_void_reason: voidReason.trim()
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/transactions')
  revalidatePath(`/transactions/${transactionId}`)
  revalidatePath('/transactions/piutang')
  revalidatePath('/stocks')
  revalidatePath('/mitras')
  revalidatePath('/dashboard')
  revalidatePath('/cashflow')

  return { success: true }
}
