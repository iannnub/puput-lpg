import { redirect } from 'next/navigation'
import { AppShell, getAuthenticatedContext } from '@/components/layout/app-shell'
import { EmployeesClient, type EmployeeRow, type SystemUserRow } from './employees-client'
import { getWibTodayString } from '@/lib/utils/date-wib'

export const dynamic = 'force-dynamic'

export default async function EmployeesPage() {
  const { supabase, isOwner, user } = await getAuthenticatedContext()

  if (!isOwner) {
    redirect('/dashboard?error=forbidden')
  }

  const [{ data: employees }, { data: activeKasbons }, { data: systemUsers }] = await Promise.all([
    supabase
      .from('employees')
      .select(
        'id, name, position, base_salary, allowance, bonus_per_tabung, join_date, is_active'
      )
      .order('name', { ascending: true }),
    supabase
      .from('kasbons')
      .select('employee_id, remaining_amount')
      .gt('remaining_amount', 0),
    supabase
      .from('users')
      .select('id, email, full_name, role, is_active, created_at')
      .order('created_at', { ascending: true })
  ])

  const kasbonMap = new Map<string, number>()
  for (const k of activeKasbons ?? []) {
    const prev = kasbonMap.get(k.employee_id) ?? 0
    kasbonMap.set(k.employee_id, prev + Number(k.remaining_amount))
  }

  const rows: EmployeeRow[] = (employees ?? []).map(emp => ({
    id: emp.id,
    name: emp.name,
    position: emp.position,
    base_salary: Number(emp.base_salary),
    allowance: Number(emp.allowance),
    bonus_per_tabung: Number(emp.bonus_per_tabung),
    join_date: emp.join_date ?? getWibTodayString(),
    is_active: emp.is_active,
    active_kasbon: kasbonMap.get(emp.id) ?? 0
  }))

  const userRows: SystemUserRow[] = (systemUsers ?? []).map(u => ({
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    role: u.role,
    is_active: u.is_active,
    created_at: u.created_at
  }))

  return (
    <AppShell activePath="/employees">
      <EmployeesClient
        employees={rows}
        systemUsers={userRows}
        currentUserId={user.id}
        defaultDate={getWibTodayString()}
      />
    </AppShell>
  )
}
