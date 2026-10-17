'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { voidTransactionAction } from '../actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { formatRupiah, formatNumber } from '@/lib/utils/format-currency'
import { formatWibDate, formatWibDateTime } from '@/lib/utils/date-wib'
import { ArrowLeft, Printer, Ban, ExternalLink } from 'lucide-react'

interface TransactionDetailClientProps {
  transaction: {
    id: string
    invoice_number: string
    transaction_date: string
    total_amount: number
    total_paid: number
    payment_status: string
    due_date: string | null
    recipient_name: string | null
    notes: string | null
    is_legacy: boolean
    override_reason: string | null
    voided_at: string | null
    void_reason: string | null
    created_at: string
    mitra_name: string
    mitra_address: string | null
    mitra_phone: string | null
    driver_name: string | null
    signed_photo_url: string | null
  }
  items: Array<{
    id: string
    product_name: string
    qty_sent_isi: number
    qty_returned_kosong: number
    sell_price_snapshot: number
    subtotal: number
  }>
  payments: Array<{
    id: string
    amount: number
    payment_date: string
    method: string
    notes: string | null
    created_at: string
    signed_proof_url: string | null
  }>
  isOwner: boolean
  todayWib: string
}

export function TransactionDetailClient({
  transaction,
  items,
  payments,
  isOwner,
  todayWib
}: TransactionDetailClientProps) {
  const router = useRouter()
  const [voidModalOpen, setVoidModalOpen] = React.useState(false)
  const [voidReason, setVoidReason] = React.useState('')
  const [voiding, setVoiding] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  const isVoided = Boolean(transaction.voided_at)
  const remaining = isVoided
    ? 0
    : Number(transaction.total_amount) - Number(transaction.total_paid)
  const isOverdue =
    !isVoided &&
    transaction.payment_status !== 'lunas' &&
    transaction.due_date &&
    transaction.due_date < todayWib

  const handleVoid = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    if (!voidReason.trim()) {
      setErrorMsg('Alasan pembatalan (void) wajib diisi.')
      return
    }
    setVoiding(true)
    try {
      const res = await voidTransactionAction(transaction.id, voidReason)
      if (res.error) {
        setErrorMsg(res.error)
      } else {
        setVoidModalOpen(false)
        router.refresh()
      }
    } finally {
      setVoiding(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/transactions">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" />
              <span>Kembali</span>
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold font-mono text-slate-900">
                {transaction.invoice_number}
              </h1>
              {isVoided ? (
                <Badge variant="outline">VOID / DIBATALKAN</Badge>
              ) : isOverdue ? (
                <Badge variant="danger">OVERDUE</Badge>
              ) : transaction.payment_status === 'lunas' ? (
                <Badge variant="success">LUNAS</Badge>
              ) : transaction.payment_status === 'partial' ? (
                <Badge variant="warning">CICIL / PARTIAL</Badge>
              ) : (
                <Badge variant="secondary">TEMPO</Badge>
              )}
            </div>
            <p className="text-sm text-slate-600">
              Tanggal Transaksi: {formatWibDate(transaction.transaction_date)} | Dibuat:{' '}
              {formatWibDateTime(transaction.created_at)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/invoice/${transaction.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button type="button" variant="secondary">
              <Printer className="h-4 w-4" />
              <span>Unduh PDF Invoice</span>
            </Button>
          </a>
          {isOwner && !isVoided && !transaction.is_legacy && (
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                setErrorMsg(null)
                setVoidModalOpen(true)
              }}
            >
              <Ban className="h-4 w-4" />
              <span>Void Transaksi</span>
            </Button>
          )}
        </div>
      </div>

      {isVoided && (
        <Alert variant="destructive">
          <AlertTitle>Transaksi Telah Di-Void (Dibatalkan)</AlertTitle>
          <AlertDescription>
            Waktu Void: {transaction.voided_at ? formatWibDateTime(transaction.voided_at) : '-'} |
            Alasan: <strong>{transaction.void_reason || '-'}</strong>
          </AlertDescription>
        </Alert>
      )}

      {transaction.override_reason && (
        <Alert variant="warning">
          <AlertTitle>Transaksi Tempo dengan Otorisasi Override Owner</AlertTitle>
          <AlertDescription>
            Alasan Override: <strong>{transaction.override_reason}</strong>
          </AlertDescription>
        </Alert>
      )}

      {/* Ringkasan Mitra & Tagihan */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-slate-600">
              TUJUAN MITRA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="font-bold text-slate-900">{transaction.mitra_name}</div>
            <div className="text-slate-600">{transaction.mitra_phone || '-'}</div>
            <div className="text-xs text-slate-600">{transaction.mitra_address || '-'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-slate-600">
              PENGIRIMAN & SERAH TERIMA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>
              <span className="text-slate-600">Supir: </span>
              <span className="font-semibold text-slate-900">
                {transaction.driver_name || 'Tanpa Supir (Ambil Sendiri)'}
              </span>
            </div>
            <div>
              <span className="text-slate-600">Penerima: </span>
              <span className="font-semibold text-slate-900">
                {transaction.recipient_name || '-'}
              </span>
            </div>
            <div>
              <span className="text-slate-600">Jatuh Tempo: </span>
              <span className="font-semibold tabular-nums text-slate-900">
                {transaction.due_date ? formatWibDate(transaction.due_date) : 'Lunas'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-slate-600">
              POSISI TAGIHAN & PEMBAYARAN
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm tabular-nums">
            <div className="flex justify-between">
              <span className="text-slate-600">Total Tagihan:</span>
              <span className="font-bold text-slate-900">
                {formatRupiah(transaction.total_amount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Sudah Dibayar:</span>
              <span className="font-semibold text-emerald-700">
                {formatRupiah(transaction.total_paid)}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1">
              <span className="font-semibold text-slate-700">Sisa Piutang:</span>
              <span className="font-bold text-danger">{formatRupiah(remaining)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabel Rincian Item */}
      <Card>
        <CardHeader>
          <CardTitle>Rincian Produk yang Dikirim</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead className="text-right">Kirim Isi</TableHead>
                <TableHead className="text-right">Kembali Kosong</TableHead>
                <TableHead className="text-right">Dipinjam Mitra</TableHead>
                <TableHead className="text-right">Harga Satuan</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-slate-600">
                    {transaction.is_legacy
                      ? 'Nota saldo migrasi awal (tanpa item pengiriman baru).'
                      : 'Tidak ada item.'}
                  </TableCell>
                </TableRow>
              ) : (
                items.map(item => {
                  const borrowed = Math.max(0, item.qty_sent_isi - item.qty_returned_kosong)
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-bold text-slate-900">
                        {item.product_name}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(item.qty_sent_isi)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(item.qty_returned_kosong)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatNumber(borrowed)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatRupiah(item.sell_price_snapshot)}
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums text-slate-900">
                        {formatRupiah(item.subtotal)}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Bukti Foto Serah Terima & Riwayat Pembayaran */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Foto Bukti Serah Terima & Catatan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-slate-700">
              <span className="font-semibold">Catatan: </span>
              {transaction.notes || '-'}
            </div>
            {transaction.signed_photo_url ? (
              <div className="space-y-2">
                <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={transaction.signed_photo_url}
                    alt="Bukti serah terima"
                    className="max-h-72 w-auto object-contain"
                  />
                </div>
                <a
                  href={transaction.signed_photo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-secondary hover:underline"
                >
                  <span>Buka Foto Ukuran Penuh (Signed URL 1 Jam)</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            ) : (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                Tidak ada lampiran foto nota serah terima.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Riwayat Pembayaran ({payments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Metode</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                  <TableHead>Bukti</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-slate-600">
                      Belum ada pembayaran tercatat.
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="tabular-nums">
                        {formatWibDate(p.payment_date)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {p.method === 'tunai_laci' ? 'Tunai Laci' : 'Transfer Bank'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums text-emerald-700">
                        {formatRupiah(p.amount)}
                      </TableCell>
                      <TableCell>
                        {p.signed_proof_url ? (
                          <a
                            href={p.signed_proof_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-secondary hover:underline"
                          >
                            <span>Lihat Bukti</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-slate-500">{p.notes || '-'}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Modal Void */}
      <Dialog open={voidModalOpen} onOpenChange={setVoidModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void Transaksi: {transaction.invoice_number}</DialogTitle>
            <DialogDescription>
              Stok gudang, saldo pinjaman tabung mitra, dan mutasi kas akan dikembalikan secara
              atomic.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleVoid} className="space-y-4">
            {errorMsg && (
              <Alert variant="destructive">
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="voidReasonInput">Alasan Pembatalan / Void (Wajib)</Label>
              <Textarea
                id="voidReasonInput"
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setVoidModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" variant="danger" disabled={voiding}>
                {voiding ? 'Memproses...' : 'Konfirmasi Void'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
