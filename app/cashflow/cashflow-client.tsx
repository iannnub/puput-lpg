'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { transferCashAction, createOperationalExpenseAction } from './actions'
import { formatRupiah } from '@/lib/utils/format-currency'
import { formatWibDateTime } from '@/lib/utils/date-wib'
import { Input } from '@/components/ui/input'

export interface CashflowItem {
  id: string
  type: string
  direction: 'in' | 'out'
  source: 'kas_laci' | 'kas_bank'
  amount: number
  description: string | null
  created_at: string
}

interface CashflowClientProps {
  kasLaciBalance: number
  kasBankBalance: number
  initialCashflows: CashflowItem[]
}

const CASHFLOW_TYPE_LABELS: Record<string, string> = {
  modal_awal: 'Modal Awal',
  in_sale: 'Penjualan Tunai / DP',
  in_piutang: 'Cicilan Piutang',
  in_transfer: 'Mutasi Masuk',
  out_restock: 'Beli Stok (Agen)',
  out_operational: 'Biaya Operasional',
  out_kasbon: 'Pencairan Kasbon',
  out_salary: 'Pembayaran Gaji',
  out_transfer: 'Mutasi Keluar',
  out_void: 'Void / Batal Nota'
}

export function CashflowClient({
  kasLaciBalance,
  kasBankBalance,
  initialCashflows
}: CashflowClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Modal state for Transfer (Setor ke Bank / Tarik Tunai ke Laci)
  const [transferDirection, setTransferDirection] = useState<'laci_to_bank' | 'bank_to_laci' | null>(null)
  const [transferAmount, setTransferAmount] = useState('')
  const [transferDesc, setTransferDesc] = useState('')

  // Modal state for Operational Expense
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseSource, setExpenseSource] = useState<'kas_laci' | 'kas_bank'>('kas_laci')
  const [expenseDesc, setExpenseDesc] = useState('')

  // Filter state for table
  const [sourceFilter, setSourceFilter] = useState<'all' | 'kas_laci' | 'kas_bank'>('all')
  const [directionFilter, setDirectionFilter] = useState<'all' | 'in' | 'out'>('all')

  const filteredCashflows = initialCashflows.filter((row) => {
    if (sourceFilter !== 'all' && row.source !== sourceFilter) return false
    if (directionFilter !== 'all' && row.direction !== directionFilter) return false
    return true
  })

  function openTransferModal(mode: 'laci_to_bank' | 'bank_to_laci') {
    setErrorMsg(null)
    setSuccessMsg(null)
    setTransferDirection(mode)
    setTransferAmount('')
    setTransferDesc(
      mode === 'laci_to_bank'
        ? 'Setor kas tunai laci ke rekening bank'
        : 'Tarik tunai dari rekening bank ke kas laci'
    )
  }

  function handleTransferSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!transferDirection) return
    setErrorMsg(null)
    setSuccessMsg(null)

    const amountNum = Number(transferAmount)
    if (!amountNum || amountNum <= 0) {
      setErrorMsg('Nominal mutasi kas harus lebih dari Rp 0.')
      return
    }
    if (!transferDesc.trim()) {
      setErrorMsg('Deskripsi mutasi kas wajib diisi.')
      return
    }

    const fromSource = transferDirection === 'laci_to_bank' ? 'kas_laci' : 'kas_bank'
    const toSource = transferDirection === 'laci_to_bank' ? 'kas_bank' : 'kas_laci'

    startTransition(async () => {
      const res = await transferCashAction(amountNum, fromSource, toSource, transferDesc.trim())
      if (res.error) {
        setErrorMsg(res.error)
        return
      }
      setTransferDirection(null)
      setSuccessMsg('Mutasi kas berhasil dicatat.')
      router.refresh()
    })
  }

  function handleExpenseSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    const amountNum = Number(expenseAmount)
    if (!amountNum || amountNum <= 0) {
      setErrorMsg('Nominal biaya operasional harus lebih dari Rp 0.')
      return
    }
    if (!expenseDesc.trim()) {
      setErrorMsg('Keterangan biaya operasional wajib diisi.')
      return
    }

    startTransition(async () => {
      const res = await createOperationalExpenseAction(amountNum, expenseSource, expenseDesc.trim())
      if (res.error) {
        setErrorMsg(res.error)
        return
      }
      setShowExpenseModal(false)
      setExpenseAmount('')
      setExpenseDesc('')
      setSuccessMsg('Biaya operasional berhasil dicatat.')
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          {successMsg}
        </div>
      )}

      {/* Top Balance Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              KAS TUNAI LACI
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
              {formatRupiah(kasLaciBalance)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Saldo uang fisik di laci kasir pangkalan
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => openTransferModal('laci_to_bank')}
              className="min-h-11 w-full sm:w-auto rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 transition-colors"
            >
              Setor ke Bank
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              SALDO BANK
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
              {formatRupiah(kasBankBalance)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Saldo rekening bank operasional pangkalan
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => openTransferModal('bank_to_laci')}
              className="min-h-11 w-full sm:w-auto rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Tarik Tunai ke Laci
            </button>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Biaya Operasional Harian</h2>
          <p className="text-xs text-slate-500">
            Catat pengeluaran solar/bensin armada, listrik, konsumsi gudang, atau perawatan
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setErrorMsg(null)
            setSuccessMsg(null)
            setExpenseAmount('')
            setExpenseDesc('')
            setExpenseSource('kas_laci')
            setShowExpenseModal(true)
          }}
          className="min-h-11 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
        >
          + Catat Biaya Operasional
        </button>
      </div>

      {/* Mutasi Kas Terakhir */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">MUTASI KAS TERAKHIR</h2>
            <p className="text-xs text-slate-500">
              Menampilkan {filteredCashflows.length} riwayat aliran kas terbaru
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as 'all' | 'kas_laci' | 'kas_bank')}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              <option value="all">Semua Sumber Kas</option>
              <option value="kas_laci">Kas Tunai Laci</option>
              <option value="kas_bank">Saldo Bank</option>
            </select>
            <select
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value as 'all' | 'in' | 'out')}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              <option value="all">Semua Arah (In/Out)</option>
              <option value="in">Uang Masuk (IN)</option>
              <option value="out">Uang Keluar (OUT)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Tipe</th>
                <th className="px-4 py-3">Deskripsi</th>
                <th className="px-4 py-3">Sumber</th>
                <th className="px-4 py-3 text-right">Jumlah</th>
                <th className="px-4 py-3 text-center">Arah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredCashflows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    Belum ada riwayat mutasi kas pada filter ini.
                  </td>
                </tr>
              ) : (
                filteredCashflows.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600 tabular-nums">
                      {formatWibDateTime(item.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800">
                        {CASHFLOW_TYPE_LABELS[item.type] || item.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">
                      {item.description || '-'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-700">
                      {item.source === 'kas_laci' ? 'Kas Laci' : 'Rekening Bank'}
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-3 text-right text-sm font-semibold tabular-nums ${
                        item.direction === 'in' ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {item.direction === 'in' ? '+' : '-'} {formatRupiah(item.amount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      {item.direction === 'in' ? (
                        <span className="inline-flex items-center rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold uppercase text-emerald-800">
                          IN
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded bg-red-100 px-2 py-0.5 text-xs font-semibold uppercase text-red-800">
                          OUT
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Transfer Kas (Setor ke Bank / Tarik Tunai ke Laci) */}
      {transferDirection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-lg">
            <h3 className="text-lg font-bold text-slate-900">
              {transferDirection === 'laci_to_bank'
                ? 'Setor Kas Laci ke Bank'
                : 'Tarik Tunai Bank ke Laci'}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {transferDirection === 'laci_to_bank'
                ? `Saldo Kas Laci tersedia: ${formatRupiah(kasLaciBalance)}`
                : `Saldo Bank tersedia: ${formatRupiah(kasBankBalance)}`}
            </p>

            <form onSubmit={handleTransferSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nominal Mutasi (Rp)
                </label>
                <Input
                  type="number"
                  min={1}
                  required
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="Contoh: 5000000"
                  className="tabular-nums"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Keterangan Mutasi
                </label>
                <input
                  type="text"
                  required
                  value={transferDesc}
                  onChange={(e) => setTransferDesc(e.target.value)}
                  placeholder="Keterangan setor/tarik tunai"
                  className="w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setTransferDirection(null)}
                  className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="min-h-11 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  {isPending ? 'Memproses...' : 'Simpan Mutasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Catat Biaya Operasional */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-lg">
            <h3 className="text-lg font-bold text-slate-900">Catat Biaya Operasional</h3>
            <p className="mt-1 text-xs text-slate-500">
              Pengeluaran ini langsung memotong saldo kas dan tercatat sebagai beban di Laporan Laba Rugi.
            </p>

            <form onSubmit={handleExpenseSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Sumber Dana Kas
                </label>
                <select
                  value={expenseSource}
                  onChange={(e) => setExpenseSource(e.target.value as 'kas_laci' | 'kas_bank')}
                  className="w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600"
                >
                  <option value="kas_laci">
                    Kas Tunai Laci (Tersedia: {formatRupiah(kasLaciBalance)})
                  </option>
                  <option value="kas_bank">
                    Saldo Bank (Tersedia: {formatRupiah(kasBankBalance)})
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nominal Biaya (Rp)
                </label>
                <Input
                  type="number"
                  min={1}
                  required
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="Contoh: 150000"
                  className="tabular-nums"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Keterangan Pengeluaran
                </label>
                <input
                  type="text"
                  required
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  placeholder="Contoh: Beli solar mobil pickup L300"
                  className="w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setShowExpenseModal(false)}
                  className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="min-h-11 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {isPending ? 'Menyimpan...' : 'Simpan Pengeluaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
