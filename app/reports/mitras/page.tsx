import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AppShell, getAuthenticatedContext } from '@/components/layout/app-shell'
import { formatRupiah } from '@/lib/utils/format-currency'

export const dynamic = 'force-dynamic'

export default async function ReportsMitrasPage() {
  const { supabase, isOwner } = await getAuthenticatedContext()

  if (!isOwner) {
    redirect('/dashboard?error=forbidden')
  }

  const [{ data: mitras }, { data: transactions }, { data: balances }] = await Promise.all([
    supabase
      .from('mitras')
      .select('id, name, phone, credit_limit, max_pending_invoices, status, is_system')
      .order('is_system', { ascending: false })
      .order('name', { ascending: true }),
    supabase
      .from('transactions')
      .select('mitra_id, total_amount, total_paid, payment_status, is_legacy, voided_at')
      .is('voided_at', null),
    supabase
      .from('mitra_product_balances')
      .select('mitra_id, borrowed_qty')
  ])

  const borrowedMap = new Map<string, number>()
  for (const b of balances ?? []) {
    borrowedMap.set(b.mitra_id, (borrowedMap.get(b.mitra_id) ?? 0) + Number(b.borrowed_qty))
  }

  const statsMap = new Map<
    string,
    {
      txCount: number
      totalOmzet: number
      totalPaid: number
      totalPiutang: number
      pendingInvoices: number
    }
  >()

  for (const t of transactions ?? []) {
    const cur = statsMap.get(t.mitra_id) ?? {
      txCount: 0,
      totalOmzet: 0,
      totalPaid: 0,
      totalPiutang: 0,
      pendingInvoices: 0
    }
    const amt = Number(t.total_amount)
    const paid = Number(t.total_paid)
    const rem = Math.max(0, amt - paid)

    if (!t.is_legacy) {
      cur.txCount += 1
      cur.totalOmzet += amt
      cur.totalPaid += paid
    }
    if (rem > 0) {
      cur.totalPiutang += rem
      cur.pendingInvoices += 1
    }
    statsMap.set(t.mitra_id, cur)
  }

  const rows = (mitras ?? []).map(m => {
    const st = statsMap.get(m.id) ?? {
      txCount: 0,
      totalOmzet: 0,
      totalPaid: 0,
      totalPiutang: 0,
      pendingInvoices: 0
    }
    return {
      id: m.id,
      name: m.name,
      phone: m.phone,
      status: m.status,
      is_system: m.is_system,
      credit_limit: Number(m.credit_limit),
      txCount: st.txCount,
      totalOmzet: st.totalOmzet,
      totalPaid: st.totalPaid,
      totalPiutang: st.totalPiutang,
      pendingInvoices: st.pendingInvoices,
      borrowedTabung: borrowedMap.get(m.id) ?? 0
    }
  })

  return (
    <AppShell activePath="/reports/profit-loss">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">ANALISIS PERFORMA MITRA</h1>
            <p className="mt-1 text-sm text-slate-600">
              Rekapitulasi volume transaksi, total pembelian, sisa piutang berjalan, dan pinjaman tabung kosong per mitra.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/reports/profit-loss"
              className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Laporan Laba Rugi
            </Link>
            <Link
              href="/reports/mitras"
              className="inline-flex min-h-11 items-center rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Analisis Mitra
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <th className="px-4 py-3">Nama Mitra</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Jumlah Nota</th>
                  <th className="px-4 py-3 text-right">Total Omzet</th>
                  <th className="px-4 py-3 text-right">Sisa Piutang</th>
                  <th className="px-4 py-3 text-right">Pinjam Tabung</th>
                  <th className="px-4 py-3 text-center">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{row.name}</div>
                      <div className="text-xs text-slate-500">
                        {row.is_system ? 'Akun Sistem Walk-In' : `Limit: ${formatRupiah(row.credit_limit)}`}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      {row.status === 'active' ? (
                        <span className="inline-flex items-center rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold uppercase text-emerald-800">
                          AKTIF
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded bg-red-100 px-2 py-0.5 text-xs font-semibold uppercase text-red-800">
                          BLOKIR
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-800">
                      {row.txCount} nota
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                      {formatRupiah(row.totalOmzet)}
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums ${
                        row.totalPiutang > 0 ? 'text-amber-700' : 'text-slate-600'
                      }`}
                    >
                      {formatRupiah(row.totalPiutang)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-slate-800">
                      {row.borrowedTabung} tbg
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      <Link
                        href={`/mitras/${row.id}`}
                        className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Buka Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
