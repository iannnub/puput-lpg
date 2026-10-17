import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AppShell, getAuthenticatedContext } from '@/components/layout/app-shell'
import { getWibCurrentMonthYear } from '@/lib/utils/date-wib'
import { getProfitLossReport } from './queries'
import { ProfitLossClient } from './profit-loss-client'

export const dynamic = 'force-dynamic'

interface ProfitLossPageProps {
  searchParams: Promise<{
    month?: string
    year?: string
  }>
}

export default async function ProfitLossPage({ searchParams }: ProfitLossPageProps) {
  const { isOwner } = await getAuthenticatedContext()

  if (!isOwner) {
    redirect('/dashboard?error=forbidden')
  }

  const resolvedParams = await searchParams
  const current = getWibCurrentMonthYear()

  const parsedMonth = Number(resolvedParams.month)
  const parsedYear = Number(resolvedParams.year)

  const month = parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth : current.month
  const year = parsedYear >= 2020 && parsedYear <= 2100 ? parsedYear : current.year

  const report = await getProfitLossReport(month, year)

  return (
    <AppShell activePath="/reports/profit-loss">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">LAPORAN LABA RUGI</h1>
            <p className="mt-1 text-sm text-slate-600">
              Rekapitulasi performa keuangan bulanan pangkalan LPG mencakup omzet akrual, penerimaan kas riil, HPP, biaya operasional, beban gaji, serta penyesuaian kerugian stok.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/reports/profit-loss"
              className="inline-flex min-h-11 items-center rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Laporan Laba Rugi
            </Link>
            <Link
              href="/reports/mitras"
              className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Analisis Mitra
            </Link>
          </div>
        </div>

        <ProfitLossClient month={month} year={year} report={report} />
      </div>
    </AppShell>
  )
}
