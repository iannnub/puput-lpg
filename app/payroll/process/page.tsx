import { redirect } from 'next/navigation'
import { AppShell, getAuthenticatedContext } from '@/components/layout/app-shell'
import {
  PayrollProcessClient,
  type EmployeePayrollCandidate
} from './payroll-process-client'
import { getWibCurrentMonthYear } from '@/lib/utils/date-wib'

export const dynamic = 'force-dynamic'

export default async function PayrollProcessPage({
  searchParams
}: {
  searchParams: Promise<{ month?: string; year?: string }>
}) {
  const params = await searchParams
  const { supabase, isOwner } = await getAuthenticatedContext()

  if (!isOwner) {
    redirect('/dashboard?error=forbidden')
  }

  const currentWib = getWibCurrentMonthYear()
  const month = params.month ? Math.min(12, Math.max(1, Number(params.month))) : currentWib.month
  const year = params.year ? Math.max(2020, Number(params.year)) : currentWib.year

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const [
    { data: employees },
    { data: kasbons },
    { data: existingPayrolls },
    { data: deliveryItems }
  ] = await Promise.all([
    supabase
      .from('employees')
      .select('id, name, position, base_salary, allowance')
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase
      .from('kasbons')
      .select('employee_id, remaining_amount')
      .gt('remaining_amount', 0),
    supabase
      .from('payrolls')
      .select('id, employee_id, gross_salary, net_salary')
      .eq('period_month', month)
      .eq('period_year', year),
    supabase
      .from('transaction_items')
      .select(
        'qty_sent_isi, bonus_snapshot_per_qty, transactions!inner(driver_id, transaction_date, voided_at, is_legacy)'
      )
      .gte('transactions.transaction_date', startDate)
      .lte('transactions.transaction_date', endDate)
      .is('transactions.voided_at', null)
      .eq('transactions.is_legacy', false)
  ])

  const kasbonMap = new Map<string, number>()
  for (const k of kasbons ?? []) {
    const prev = kasbonMap.get(k.employee_id) ?? 0
    kasbonMap.set(k.employee_id, prev + Number(k.remaining_amount))
  }

  const bonusMap = new Map<string, number>()
  for (const row of deliveryItems ?? []) {
    const txObj = Array.isArray(row.transactions) ? row.transactions[0] : row.transactions
    const driverId = txObj?.driver_id
    if (!driverId) continue
    const bonus = Number(row.qty_sent_isi) * Number(row.bonus_snapshot_per_qty)
    bonusMap.set(driverId, (bonusMap.get(driverId) ?? 0) + bonus)
  }

  const existingMap = new Map<
    string,
    { id: string; gross_salary: number; net_salary: number }
  >()
  for (const p of existingPayrolls ?? []) {
    existingMap.set(p.employee_id, {
      id: p.id,
      gross_salary: Number(p.gross_salary),
      net_salary: Number(p.net_salary)
    })
  }

  const candidates: EmployeePayrollCandidate[] = (employees ?? []).map(emp => {
    const existing = existingMap.get(emp.id)
    return {
      id: emp.id,
      name: emp.name,
      position: emp.position,
      base_salary: Number(emp.base_salary),
      allowance: Number(emp.allowance),
      bonus_delivery: bonusMap.get(emp.id) ?? 0,
      active_kasbon: kasbonMap.get(emp.id) ?? 0,
      existing_payroll_id: existing?.id ?? null,
      existing_gross_salary: existing?.gross_salary ?? null,
      existing_net_salary: existing?.net_salary ?? null
    }
  })

  return (
    <AppShell activePath="/payroll/process">
      <PayrollProcessClient
        month={month}
        year={year}
        candidates={candidates}
      />
    </AppShell>
  )
}
