import { redirect } from 'next/navigation'
import { AppShell, getAuthenticatedContext } from '@/components/layout/app-shell'
import { KasbonClient, type KasbonItemRow } from './kasbon-client'
import { getWibTodayString } from '@/lib/utils/date-wib'

export const dynamic = 'force-dynamic'

export default async function KasbonPage() {
  const { supabase, isOwner } = await getAuthenticatedContext()

  if (!isOwner) {
    redirect('/dashboard?error=forbidden')
  }

  const [{ data: employees }, { data: kasbonsData }] = await Promise.all([
    supabase
      .from('employees')
      .select('id, name, position')
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase
      .from('kasbons')
      .select('id, employee_id, amount, remaining_amount, kasbon_date, notes, employees(name, position)')
      .order('kasbon_date', { ascending: true })
  ])

  const rows: KasbonItemRow[] = (kasbonsData ?? []).map(k => {
    const emp = Array.isArray(k.employees) ? k.employees[0] : k.employees
    return {
      id: k.id,
      employee_id: k.employee_id,
      employee_name: emp?.name ?? '-',
      employee_position: emp?.position ?? '-',
      amount: Number(k.amount),
      remaining_amount: Number(k.remaining_amount),
      kasbon_date: k.kasbon_date,
      notes: k.notes
    }
  })

  return (
    <AppShell activePath="/payroll/process">
      <KasbonClient
        employees={employees ?? []}
        kasbons={rows}
        defaultDate={getWibTodayString()}
      />
    </AppShell>
  )
}
