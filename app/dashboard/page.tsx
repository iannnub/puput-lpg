import Link from 'next/link'
import { AppShell, getAuthenticatedContext } from '@/components/layout/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { formatRupiah, formatNumber } from '@/lib/utils/format-currency'
import { getWibTodayString, formatWibDate } from '@/lib/utils/date-wib'
import { Plus, ArrowRight, AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const { supabase, profile, isOwner, settings } = await getAuthenticatedContext()
  const todayWib = getWibTodayString()
  const monthPrefix = todayWib.slice(0, 7)

  // 1. Ambil seluruh data ringkasan dashboard dalam 1 RPC query teragregasi
  const { data: summaryData, error: summaryErr } = await supabase.rpc(
    'rpc_get_dashboard_summary',
    {
      p_is_owner: isOwner,
      p_month_prefix: monthPrefix,
      p_today: todayWib
    }
  )

  let stocks = ((summaryData as any)?.stocks ?? []) as Array<{
    product_id: string
    gudang_isi: number
    gudang_kosong: number
    gudang_bocor: number
    dipinjam_mitra: number
    products: {
      id: string
      name: string
      buy_price: number
      sell_price: number
      is_active: boolean
    }
  }>

  let totalPiutang = Number((summaryData as any)?.receivables?.total_piutang ?? 0)
  let overdueCount = Number((summaryData as any)?.receivables?.overdue_count ?? 0)
  let pendingCount = Number((summaryData as any)?.receivables?.pending_count ?? 0)
  let kasLaci = Number((summaryData as any)?.financials?.kas_laci ?? 0)
  let kasBank = Number((summaryData as any)?.financials?.kas_bank ?? 0)
  let omzetBulanIni = Number((summaryData as any)?.financials?.omzet_bulan_ini ?? 0)
  let kasMasukBulanIni = Number((summaryData as any)?.financials?.kas_masuk_bulan_ini ?? 0)
  let recentTransactions = ((summaryData as any)?.recent_transactions ?? []) as any[]

  // Fallback ke query bertahap jika RPC mengalami kendala
  if (summaryErr || !summaryData) {
    const { data: stocksData } = await supabase
      .from('stocks')
      .select('*, products!inner(id, name, buy_price, sell_price, is_active)')
      .eq('products.is_active', true)
      .order('updated_at', { ascending: true })

    const { data: activeReceivables } = await supabase
      .from('transactions')
      .select('id, total_amount, total_paid, due_date, payment_status')
      .neq('payment_status', 'lunas')
      .is('voided_at', null)

    totalPiutang = 0
    overdueCount = 0
    for (const tx of activeReceivables ?? []) {
      const remaining = Number(tx.total_amount) - Number(tx.total_paid)
      if (remaining > 0) {
        totalPiutang += remaining
        if (tx.due_date && tx.due_date < todayWib) {
          overdueCount += 1
        }
      }
    }
    pendingCount = (activeReceivables ?? []).length

    if (isOwner) {
      const [resLaci, resBank, resMonthSales, resMonthPayments] = await Promise.all([
        supabase.rpc('get_cash_balance', { p_source: 'kas_laci' }),
        supabase.rpc('get_cash_balance', { p_source: 'kas_bank' }),
        supabase
          .from('transactions')
          .select('total_amount')
          .gte('transaction_date', `${monthPrefix}-01`)
          .lte('transaction_date', `${monthPrefix}-31`)
          .is('voided_at', null)
          .eq('is_legacy', false),
        supabase
          .from('payments')
          .select('amount, transactions!inner(voided_at, is_legacy)')
          .gte('payment_date', `${monthPrefix}-01`)
          .lte('payment_date', `${monthPrefix}-31`)
          .is('transactions.voided_at', null)
          .eq('transactions.is_legacy', false)
      ])

      kasLaci = Number(resLaci.data ?? 0)
      kasBank = Number(resBank.data ?? 0)
      omzetBulanIni = (resMonthSales.data ?? []).reduce(
        (sum, row) => sum + Number(row.total_amount),
        0
      )
      kasMasukBulanIni = (resMonthPayments.data ?? []).reduce(
        (sum, row) => sum + Number(row.amount),
        0
      )
    }

    const { data: recents } = await supabase
      .from('transactions')
      .select(
        'id, invoice_number, transaction_date, total_amount, total_paid, payment_status, due_date, voided_at, is_legacy, mitras(name)'
      )
      .order('created_at', { ascending: false })
      .limit(10)

    recentTransactions = recents ?? []
    stocks = (stocksData ?? []) as any
  }

  return (
    <AppShell activePath="/dashboard">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard Utama</h1>
          <p className="text-sm text-slate-600">
            Ringkasan operasional gudang & distribusi per {formatWibDate(todayWib)} (User:{' '}
            <span className="font-semibold text-slate-900">{profile.full_name}</span>)
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/transactions/new">
            <Button>
              <Plus className="h-4 w-4" />
              <span>Buat Transaksi Baru</span>
            </Button>
          </Link>
          <Link href="/stocks/restock">
            <Button variant="outline">Restock Pertamina</Button>
          </Link>
        </div>
      </div>

      {params.error === 'forbidden' && (
        <Alert variant="destructive">
          <AlertTitle>Akses Ditolak</AlertTitle>
          <AlertDescription>
            Halaman yang Anda tuju dikhususkan untuk Owner pangkalan.
          </AlertDescription>
        </Alert>
      )}

      {isOwner && settings && !settings.onboarding_completed && (
        <Alert variant="warning">
          <AlertTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Setup Awal Sistem (Onboarding) Belum Dijalankan</span>
          </AlertTitle>
          <AlertDescription className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Anda dapat menginput saldo kas awal, stok fisik gudang awal, dan piutang/pinjaman
              tabung lama secara atomic sebelum memulai operasional.
            </span>
            <Link href="/onboarding">
              <Button size="sm" variant="warning">
                <span>Buka Setup Awal</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Baris Card Stok Fisik Gudang */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stocks.map(item => (
          <Card key={item.product_id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold uppercase tracking-wide text-slate-600">
                  STOK {item.products.name} ISI
                </CardTitle>
                <Badge variant={item.gudang_isi > 10 ? 'success' : 'destructive'}>
                  {item.gudang_isi > 10 ? 'Tersedia' : 'Stok Menipis'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums text-slate-900">
                {formatNumber(item.gudang_isi)} tabung
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium tabular-nums text-slate-600">
                <span>Kosong: {formatNumber(item.gudang_kosong)}</span>
                <span>|</span>
                <span className={item.gudang_bocor > 0 ? 'text-danger font-semibold' : ''}>
                  Bocor: {formatNumber(item.gudang_bocor)}
                </span>
                <span>|</span>
                <span>Dipinjam: {formatNumber(item.dipinjam_mitra)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Baris Card Finansial & Piutang */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase tracking-wide text-slate-600">
                TOTAL PIUTANG AKTIF
              </CardTitle>
              {overdueCount > 0 ? (
                <Badge variant="destructive">{overdueCount} Nota Overdue</Badge>
              ) : (
                <Badge variant="success">Aman</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-slate-900">
              {formatRupiah(totalPiutang)}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
              <span>{pendingCount} nota belum lunas</span>
              <Link
                href="/transactions/piutang"
                className="font-semibold text-secondary hover:underline"
              >
                Kelola Piutang
              </Link>
            </div>
          </CardContent>
        </Card>

        {isOwner && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wide text-slate-600">
                  OMZET BULAN INI (AKRUAL)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums text-slate-900">
                  {formatRupiah(omzetBulanIni)}
                </div>
                <div className="mt-2 text-xs font-medium tabular-nums text-slate-600">
                  Kas Masuk Periode Ini: {formatRupiah(kasMasukBulanIni)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wide text-slate-600">
                  POSISI KAS (OWNER ONLY)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Kas Tunai Laci:</span>
                  <span className="font-bold tabular-nums text-slate-900">
                    {formatRupiah(kasLaci)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Saldo Bank:</span>
                  <span className="font-bold tabular-nums text-slate-900">
                    {formatRupiah(kasBank)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Tabel Transaksi Terakhir */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Transaksi Terakhir</CardTitle>
            <p className="text-xs text-slate-600 mt-1">
              10 transaksi terbaru diurutkan dari yang paling baru dibuat
            </p>
          </div>
          <Link href="/transactions">
            <Button variant="outline" size="sm">
              Lihat Semua
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Mitra</TableHead>
                <TableHead className="text-right">Total Tagihan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(recentTransactions ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-slate-600">
                    Belum ada transaksi tercatat.
                  </TableCell>
                </TableRow>
              ) : (
                (recentTransactions ?? []).map(tx => {
                  const mitraObj = Array.isArray(tx.mitras) ? tx.mitras[0] : tx.mitras
                  const isVoided = Boolean(tx.voided_at)
                  const isOverdue =
                    !isVoided &&
                    tx.payment_status !== 'lunas' &&
                    tx.due_date &&
                    tx.due_date < todayWib

                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono font-semibold text-slate-900">
                        {tx.invoice_number}
                        {tx.is_legacy && (
                          <span className="ml-2 text-xs font-normal text-slate-500">
                            (Migrasi)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatWibDate(tx.transaction_date)}
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">
                        {mitraObj?.name ?? '-'}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatRupiah(Number(tx.total_amount))}
                      </TableCell>
                      <TableCell>
                        {isVoided ? (
                          <Badge variant="outline">VOID</Badge>
                        ) : isOverdue ? (
                          <Badge variant="destructive">OVERDUE</Badge>
                        ) : tx.payment_status === 'lunas' ? (
                          <Badge variant="success">LUNAS</Badge>
                        ) : tx.payment_status === 'partial' ? (
                          <Badge variant="warning">CICIL / PARTIAL</Badge>
                        ) : (
                          <Badge variant="secondary">TEMPO</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/transactions/${tx.id}`}>
                          <Button variant="outline" size="sm">
                            Detail
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  )
}
