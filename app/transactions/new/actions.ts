'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface CreateSaleInput {
  mitra_id: string
  driver_id: string | null
  transaction_date: string // 'YYYY-MM-DD'
  items: Array<{
    product_id: string
    qty_sent_isi: number
    qty_returned_kosong: number
    sell_price: number
  }>
  payment_type: 'lunas_tunai' | 'lunas_transfer' | 'tempo'
  dp_amount: number
  dp_method: 'tunai_laci' | 'transfer_bank'
  due_date: string | null
  recipient_name: string
  photo_path: string | null
  notes: string
  override_token: string | null
  override_reason: string | null
}

export async function createTransactionSaleAction(input: CreateSaleInput) {
  const supabase = await createClient()

  let paymentMethod: 'lunas_tunai_laci' | 'lunas_transfer_bank' | 'tempo_with_dp' | 'tempo'
  if (input.payment_type === 'lunas_tunai') {
    paymentMethod = 'lunas_tunai_laci'
  } else if (input.payment_type === 'lunas_transfer') {
    paymentMethod = 'lunas_transfer_bank'
  } else if (input.dp_amount > 0) {
    paymentMethod = 'tempo_with_dp'
  } else {
    paymentMethod = 'tempo'
  }

  const { data: transactionId, error } = await supabase.rpc('rpc_create_transaction_sale', {
    p_mitra_id: input.mitra_id,
    p_driver_id: input.driver_id || null,
    p_items: input.items.map(item => ({
      product_id: item.product_id,
      qty_sent_isi: Math.floor(item.qty_sent_isi),
      qty_returned_kosong: Math.floor(item.qty_returned_kosong),
      sell_price: Math.floor(item.sell_price)
    })),
    p_payment_method: paymentMethod,
    p_dp_amount: Math.floor(input.dp_amount || 0),
    p_dp_method: input.dp_method || 'tunai_laci',
    p_due_date: input.payment_type === 'tempo' ? input.due_date : null,
    p_transaction_date: input.transaction_date,
    p_recipient_name: input.recipient_name.trim() || null,
    p_photo_url: input.photo_path || null,
    p_notes: input.notes.trim() || null,
    p_override_token: input.override_token || null,
    p_override_reason: input.override_reason?.trim() || null
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/transactions')
  revalidatePath('/transactions/piutang')
  revalidatePath('/stocks')
  revalidatePath('/mitras')
  revalidatePath('/dashboard')

  return { transactionId }
}
