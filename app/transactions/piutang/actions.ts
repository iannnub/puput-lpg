'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function bayarPiutangAction(data: {
  transactionId: string
  amount: number
  paymentDate: string // 'YYYY-MM-DD'
  method: 'tunai_laci' | 'transfer_bank'
  proofPath: string | null
  notes: string
}) {
  const supabase = await createClient()

  const { data: result, error } = await supabase.rpc('rpc_pay_receivable', {
    p_transaction_id: data.transactionId,
    p_amount: Math.floor(data.amount),
    p_payment_date: data.paymentDate,
    p_method: data.method,
    p_proof_url: data.proofPath || null,
    p_notes: data.notes.trim()
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/transactions/piutang')
  revalidatePath('/transactions')
  revalidatePath(`/transactions/${data.transactionId}`)
  revalidatePath('/mitras')
  revalidatePath('/dashboard')
  revalidatePath('/cashflow')

  return { success: true, result }
}
