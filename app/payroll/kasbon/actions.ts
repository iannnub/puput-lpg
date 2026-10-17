'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createKasbonAction(data: {
  employeeId: string
  amount: number
  kasbonDate: string // 'YYYY-MM-DD'
  source: 'kas_laci' | 'kas_bank'
  notes: string
}) {
  const supabase = await createClient()

  const { data: kasbonId, error } = await supabase.rpc('rpc_create_kasbon', {
    p_employee_id: data.employeeId,
    p_amount: Math.floor(data.amount),
    p_kasbon_date: data.kasbonDate,
    p_source: data.source,
    p_notes: data.notes.trim()
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/payroll/kasbon')
  revalidatePath('/payroll/process')
  revalidatePath('/employees')
  revalidatePath('/cashflow')
  revalidatePath('/dashboard')

  return { success: true, kasbonId }
}
