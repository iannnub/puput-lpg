'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function transferCashAction(
  amount: number,
  fromSource: 'kas_laci' | 'kas_bank',
  toSource: 'kas_laci' | 'kas_bank',
  description: string
) {
  const supabase = await createClient()

  const { error } = await supabase.rpc('rpc_cash_transfer', {
    p_amount: amount,
    p_from_source: fromSource,
    p_to_source: toSource,
    p_description: description
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/cashflow')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function createOperationalExpenseAction(
  amount: number,
  source: 'kas_laci' | 'kas_bank',
  description: string
) {
  const supabase = await createClient()

  const { error } = await supabase.rpc('rpc_create_operational_expense', {
    p_amount: amount,
    p_source: source,
    p_description: description
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/cashflow')
  revalidatePath('/dashboard')
  revalidatePath('/reports/profit-loss')
  return { success: true }
}
