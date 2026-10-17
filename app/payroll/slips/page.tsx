import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AppShell, getAuthenticatedContext } from '@/components/layout/app-shell'
import { formatRupiah } from '@/lib/utils/format-currency'
import { formatWibDate } from '@/lib/utils/date-wib'

export const dynamic = 'force-dynamic'

export default async function PayrollSlipsPage() {
  const { supabase, isOwner } = await getAuthenticatedContext()

  if (!isOwner) {
    redirect('/dashboard?error=forbidden')
  }

  const { data: payrollsData } = await supabase
    .from('payrolls')
    .select(
      'id, employee_id, period_month, period_year, base_salary, allowance, bonus_delivery, bonus_extra, deduction_absence, deduction_kasbon, deduction_other, gross_salary, net_salary, paid_source, paid_date, employees(name, position)'
    )
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })
    .order('created_at', { ascending: false })

  const slips = (payrollsData ?? []).map(p => {
    const emp = Array.isArray(p.employees) ? p.employees[0] : p.employees
    return {
      id: p.id,
      employee_name: emp?.name ?? '-',
      employee_position: emp?.position ?? '-',
      period_month: p.period_month,
      period_year: p.period_year,
      gross_salary: Number(p.gross_salary),
      deduction_kasbon: Number(p.deduction_kasbon),
      deduction_other: Number(p.deduction_other),
      net_salary: Number(p.net_salary),
      paid_source: p.paid_source,
      paid_date: p.paid_date
    }
  })

  return (
    <AppShell activePath="/payroll/process">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">ARSIP SLIP GAJI KARYAWAN</h1>
            <p className="mt-1 text-sm text-slate-600">
              Daftar seluruh slip gaji bulanan yang telah diproses beserta tautan unduh PDF ukuran A5.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/payroll/process"
              className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Proses Gaji Bulanan
            </Link>
            <Link
              href="/payroll/kasbon"
              className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Kelola Kasbon
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <th className="px-4 py-3">Periode</th>
                  <th className="px-4 py-3">Karyawan</th>
                  <th className="px-4 py-3">Tanggal Bayar</th>
                  <th className="px-4 py-3 text-right">Gaji Bruto</th>
                  <th className="px-4 py-3 text-right">Potongan Kasbon</th>
                  <th className="px-4 py-3 text-right">Gaji Bersih (Net)</th>
                  <th className="px-4 py-3 text-center">Slip PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {slips.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                      Belum ada riwayat slip gaji yang diproses.
                    </td>
                  </tr>
                ) : (
                  slips.map(slip => (
                    <tr key={slip.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900 tabular-nums">
                        {String(slip.period_month).padStart(2, '0')}/{slip.period_year}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{slip.employee_name}</div>
                        <div className="text-xs text-slate-500 uppercase">{slip.employee_position}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600 tabular-nums">
                        {formatWibDate(slip.paid_date)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-800">
                        {formatRupiah(slip.gross_salary)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-red-600">
                        - {formatRupiah(slip.deduction_kasbon)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-emerald-700">
                        {formatRupiah(slip.net_salary)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        <a
                          href={`/api/payroll/slip/${slip.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-11 items-center rounded-lg bg-green-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-green-700"
                        >
                          Unduh PDF A5
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
