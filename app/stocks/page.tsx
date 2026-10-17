import Link from 'next/link'
import { AppShell, getAuthenticatedContext } from '@/components/layout/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { formatNumber } from '@/lib/utils/format-currency'
import { formatWibDateTime } from '@/lib/utils/date-wib'
import { Truck, AlertOctagon, RefreshCw, ClipboardCheck } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function StocksDashboardPage() {
  const { supabase, isOwner } = await getAuthenticatedContext()

  const [{ data: stocksData }, { data: movementsData }] = await Promise.all([
    supabase
      .from('stocks')
      .select('*, products!inner(id, name, buy_price, sell_price, is_active)')
      .eq('products.is_active', true)
      .order('updated_at', { ascending: true }),
    supabase
      .from('stock_movements')
      .select('id, type, quantity, claimed_warranty, notes, created_at, products(name)')
      .order('created_at', { ascending: false })
      .limit(30)
  ])

  const stocks = (stocksData ?? []) as Array<{
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

  const movementLabel: Record<string, string> = {
    in_from_supplier: 'Restock Agen/Pertamina',
    out_to_mitra: 'Kirim ke Mitra (Penjualan)',
    return_from_mitra: 'Kembali Kosong Saat Kirim',
    return_susulan: 'Kembali Kosong Susulan',
    bocor_gudang: 'Lapor Bocor di Gudang',
    bocor_tukar_guling: 'Tukar Guling Bocor Mitra',
    opname: 'Penyesuaian Stock Opname',
    void_rollback: 'Rollback Void Transaksi'
  }

  return (
    <AppShell activePath="/stocks">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manajemen Stok Gudang Real-Time</h1>
          <p className="text-sm text-slate-600">
            Seluruh mutasi stok isi, kosong, bocor, dan pinjaman mitra dicatat secara atomic.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/stocks/restock">
            <Button>
              <Truck className="h-4 w-4" />
              <span>Restock Pertamina</span>
            </Button>
          </Link>
          <Link href="/stocks/bocor">
            <Button variant="outline">
              <AlertOctagon className="h-4 w-4" />
              <span>Lapor Bocor Gudang</span>
            </Button>
          </Link>
          <Link href="/stocks/tukar-guling">
            <Button variant="outline">
              <RefreshCw className="h-4 w-4" />
              <span>Tukar Guling Mitra</span>
            </Button>
          </Link>
          {isOwner && (
            <Link href="/stocks/opname">
              <Button variant="secondary">
                <ClipboardCheck className="h-4 w-4" />
                <span>Stock Opname</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Kartu Posisi Stok 4 Kategori per Produk */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {stocks.map(s => {
          const totalFisikGudang = s.gudang_isi + s.gudang_kosong + s.gudang_bocor
          const totalAsetTabung = totalFisikGudang + s.dipinjam_mitra

          return (
            <Card key={s.product_id}>
              <CardHeader className="border-b border-slate-200 pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold text-slate-900">
                    Tabung {s.products.name}
                  </CardTitle>
                  <Badge variant={s.gudang_isi > 10 ? 'success' : 'destructive'}>
                    Isi: {formatNumber(s.gudang_isi)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase text-slate-600">
                      Gudang Isi
                    </div>
                    <div className="mt-1 text-xl font-bold tabular-nums text-emerald-700">
                      {formatNumber(s.gudang_isi)}
                    </div>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase text-slate-600">
                      Gudang Kosong
                    </div>
                    <div className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                      {formatNumber(s.gudang_kosong)}
                    </div>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase text-slate-600">
                      Gudang Bocor
                    </div>
                    <div className="mt-1 text-xl font-bold tabular-nums text-danger">
                      {formatNumber(s.gudang_bocor)}
                    </div>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase text-slate-600">
                      Dipinjam Mitra
                    </div>
                    <div className="mt-1 text-xl font-bold tabular-nums text-secondary">
                      {formatNumber(s.dipinjam_mitra)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-xs font-medium tabular-nums text-slate-600">
                  <span>Total di Gudang: {formatNumber(totalFisikGudang)} tbg</span>
                  <span>Total Aset Tabung: {formatNumber(totalAsetTabung)} tbg</span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Tabel Riwayat Pergerakan Stok */}
      <Card>
        <CardHeader>
          <CardTitle>Riwayat Mutasi Stok Terakhir (30 Log Terbaru)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu (WIB)</TableHead>
                <TableHead>Produk</TableHead>
                <TableHead>Jenis Mutasi</TableHead>
                <TableHead className="text-right">Perubahan Qty</TableHead>
                <TableHead>Keterangan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(movementsData ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-slate-600">
                    Belum ada riwayat pergerakan stok.
                  </TableCell>
                </TableRow>
              ) : (
                (movementsData ?? []).map(m => {
                  const prodObj = Array.isArray(m.products) ? m.products[0] : m.products
                  const qty = Number(m.quantity)
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="tabular-nums text-xs text-slate-600">
                        {formatWibDateTime(m.created_at)}
                      </TableCell>
                      <TableCell className="font-bold text-slate-900">
                        {prodObj?.name ?? '-'}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-900">
                          {movementLabel[m.type] ?? m.type}
                        </div>
                        {m.claimed_warranty && (
                          <Badge variant="success" className="mt-1">
                            Klaim Garansi
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell
                        className={`text-right font-bold tabular-nums ${
                          qty > 0
                            ? 'text-emerald-700'
                            : qty < 0
                            ? 'text-danger'
                            : 'text-slate-600'
                        }`}
                      >
                        {qty > 0 ? `+${formatNumber(qty)}` : formatNumber(qty)}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {m.notes || '-'}
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
