'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface PayrollItemInput {
  employee_id: string
  period_month: number
  period_year: number
  bonus_extra: number
  deduction_kasbon: number
  deduction_absence: number
  deduction_other: number
  paid_source: 'kas_laci' | 'kas_bank'
}

export interface PayrollProcessResult {
  employee_id: string
  employee_name: string
  status: 'processed' | 'already_processed'
  payroll_id: string
  gross_salary?: number
  net_salary?: number
}

export async function processPayrollBatchAction(items: PayrollItemInput[]) {
  const supabase = await createClient()

  const payload = items.map(item => ({
    employee_id: item.employee_id,
    period_month: Math.floor(item.period_month),
    period_year: Math.floor(item.period_year),
    bonus_extra: Math.max(0, Math.floor(item.bonus_extra || 0)),
    deduction_kasbon: Math.max(0, Math.floor(item.deduction_kasbon || 0)),
    deduction_absence: Math.max(0, Math.floor(item.deduction_absence || 0)),
    deduction_other: Math.max(0, Math.floor(item.deduction_other || 0)),
    paid_source: item.paid_source
  }))

  const { data, error } = await supabase.rpc('rpc_process_payroll', {
    p_payrolls: payload
  })

  if (error) {
    return { error: error.message }
  }

  const results = ((data as unknown) as PayrollProcessResult[]) ?? []
  const alreadyProcessed = results.filter(r => r.status === 'already_processed')
  const newlyProcessed = results.filter(r => r.status === 'processed')

  revalidatePath('/payroll/process')
  revalidatePath('/payroll/kasbon')
  revalidatePath('/employees')
  revalidatePath('/cashflow')
  revalidatePath('/reports/profit-loss')
  revalidatePath('/dashboard')

  return {
    results,
    newlyProcessedCount: newlyProcessed.length,
    alreadyProcessedCount: alreadyProcessed.length
  }
}
