'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ExcelJS from 'exceljs'
import type { ProfitLossReportData } from './queries'
import { formatRupiah } from '@/lib/utils/format-currency'

interface ProfitLossClientProps {
  month: number
  year: number
  report: ProfitLossReportData
}

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember'
]

export function ProfitLossClient({ month, year, report }: ProfitLossClientProps) {
  const router = useRouter()
  const [selectedMonth, setSelectedMonth] = useState(month)
  const [selectedYear, setSelectedYear] = useState(year)

  const periodLabel = `${MONTH_NAMES[month - 1]} ${year}`

  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault()
    router.push(`/reports/profit-loss?month=${selectedMonth}&year=${selectedYear}`)
  }

  async function handleExportExcel() {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Laba Rugi')

    worksheet.columns = [
      { header: 'KOMPONEN LAPORAN', key: 'label', width: 44 },
      { header: 'NILAI (Rp)', key: 'value', width: 24 }
    ]

    const rows: Array<[string, number | string]> = [
      [`LAPORAN LABA RUGI PANGKALAN LPG (${periodLabel})`, ''],
      ['', ''],
      ['OMZET PENJUALAN (AKRUAL)', report.omzet_accrual],
      ['  - Kas Masuk pada Periode Ini', report.cash_collected_period],
      ['  - Sisa Piutang Nota Periode', report.piutang_remaining_from_period],
      ['HARGA POKOK PENJUALAN (HPP)', -report.hpp_total],
      ['LABA KOTOR', report.gross_profit],
      ['', ''],
      ['BEBAN OPERASIONAL & PENYESUAIAN STOK', ''],
      ['  - Biaya Operasional Harian', -report.operational_expense],
      ['  - Beban Gaji & Bonus (Bruto)', -report.salary_expense],
      ['  - Kerugian Tabung Bocor (Kotor)', -report.bocor_gross_loss],
      ['  - Pemulihan Klaim Garansi Restock', report.bocor_warranty_recovered],
      ['  - Kerugian Tabung Bocor (Net)', -report.bocor_net_loss],
      ['  - Kerugian Selisih Opname', -report.opname_loss],
      ['', ''],
      ['LABA BERSIH', report.net_profit]
    ]

    for (const [label, value] of rows) {
      worksheet.addRow({ label, value })
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const paddedMonth = String(month).padStart(2, '0')
    link.href = url
    link.download = `Laporan-Laba-Rugi-${year}-${paddedMonth}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const totalExpenses =
    report.operational_expense +
    report.salary_expense +
    report.bocor_net_loss +
    report.opname_loss

  return (
    <div className="space-y-6">
      {/* Filter & Export Bar */}
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <form onSubmit={handleFilterSubmit} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">
              Bulan
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-base text-slate-900 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">
              Tahun
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-base text-slate-900 tabular-nums focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              {[year - 2, year - 1, year, year + 1].map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="min-h-11 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
          >
            Tampilkan Periode
          </button>
        </form>

        <button
          type="button"
          onClick={handleExportExcel}
          className="min-h-11 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
        >
          Export Excel (.xlsx)
        </button>
      </div>

      {/* Main Profit/Loss Statement Card */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              LAPORAN LABA RUGI (Periode: {periodLabel})
            </h2>
            <p className="text-xs text-slate-500">
              Dihitung otomatis melalui agregasi server PostgreSQL (mengecualikan saldo piutang migrasi awal &amp; nota void)
            </p>
          </div>
          <span className="inline-flex items-center self-start sm:self-auto rounded bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-800">
            Akrual &amp; Kas Riil
          </span>
        </div>

        <div className="p-6 space-y-6">
          {/* Section 1: Pendapatan & HPP */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
              <span>OMZET PENJUALAN (AKRUAL)</span>
              <span className="tabular-nums text-base">{formatRupiah(report.omzet_accrual)}</span>
            </div>

            <div className="pl-4 border-l-2 border-slate-200 space-y-2 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span>Kas Masuk pada Periode Ini (Lunas, DP &amp; Cicilan Diterima)</span>
                <span className="tabular-nums font-medium text-emerald-700">
                  {formatRupiah(report.cash_collected_period)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Sisa Piutang Nota Periode Ini</span>
                <span className="tabular-nums font-medium text-amber-700">
                  {formatRupiah(report.piutang_remaining_from_period)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm font-medium text-slate-700 pt-1">
              <span>HARGA POKOK PENJUALAN (HPP)</span>
              <span className="tabular-nums text-red-600">
                ({formatRupiah(report.hpp_total)})
              </span>
            </div>

            <div className="border-t border-slate-300 pt-3 flex items-center justify-between text-base font-bold text-slate-900">
              <span>LABA KOTOR</span>
              <span className="tabular-nums text-slate-900">
                {formatRupiah(report.gross_profit)}
              </span>
            </div>
          </div>

          {/* Section 2: Beban Operasional & Penyesuaian Stok */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
              BEBAN OPERASIONAL &amp; PENYESUAIAN STOK
            </h3>

            <div className="space-y-2.5 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <span>- Biaya Operasional Harian</span>
                <span className="tabular-nums text-red-600">
                  ({formatRupiah(report.operational_expense)})
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span>- Beban Gaji &amp; Bonus (Bruto)</span>
                <span className="tabular-nums text-red-600">
                  ({formatRupiah(report.salary_expense)})
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span>- Kerugian Tabung Bocor (Net)</span>
                  <span className="tabular-nums text-red-600">
                    ({formatRupiah(report.bocor_net_loss)})
                  </span>
                </div>
                <div className="pl-4 text-xs text-slate-500 tabular-nums">
                  (Bocor Kotor: {formatRupiah(report.bocor_gross_loss)} &minus; Klaim Garansi Restock:{' '}
                  {formatRupiah(report.bocor_warranty_recovered)})
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span>- Kerugian Selisih Opname</span>
                <span className="tabular-nums text-red-600">
                  ({formatRupiah(report.opname_loss)})
                </span>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>Total Beban &amp; Penyesuaian</span>
              <span className="tabular-nums text-red-600">({formatRupiah(totalExpenses)})</span>
            </div>
          </div>

          {/* Section 3: Laba Bersih */}
          <div className="rounded-lg border border-slate-300 bg-slate-50 p-4 flex items-center justify-between">
            <div>
              <p className="text-base font-bold text-slate-900">LABA BERSIH</p>
              <p className="text-xs text-slate-500">
                Laba Kotor dikurangi seluruh Beban Operasional, Gaji Bruto, Bocor Net, dan Selisih Opname
              </p>
            </div>
            <p
              className={`text-2xl font-bold tabular-nums ${
                report.net_profit >= 0 ? 'text-emerald-700' : 'text-red-600'
              }`}
            >
              {report.net_profit >= 0
                ? formatRupiah(report.net_profit)
                : `(${formatRupiah(Math.abs(report.net_profit))})`}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
