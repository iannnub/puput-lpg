'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { bayarPiutangAction } from './actions'
import { ImageUploadField } from '@/components/shared/image-upload'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
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
import { formatRupiah } from '@/lib/utils/format-currency'
import { formatWibDate } from '@/lib/utils/date-wib'
import { ArrowLeft, Banknote } from 'lucide-react'

export interface PiutangRow {
  id: string
  invoice_number: string
  transaction_date: string
  due_date: string | null
  total_amount: number
  total_paid: number
  remaining: number
  payment_status: string
  is_legacy: boolean
  mitra_name: string
  mitra_phone: string | null
  daysOverdue: number
  agingStatus: 'danger' | 'warning' | 'success'
}

interface PiutangClientProps {
  items: PiutangRow[]
  defaultDate: string
}

export function PiutangClient({ items, defaultDate }: PiutangClientProps) {
  const router = useRouter()
  const [filter, setFilter] = React.useState<'all' | 'overdue' | 'upcoming'>('all')
  const [search, setSearch] = React.useState('')

  const [selectedTx, setSelectedTx] = React.useState<PiutangRow | null>(null)
  const [amount, setAmount] = React.useState<number>(0)
  const [paymentDate, setPaymentDate] = React.useState(defaultDate)
  const [method, setMethod] = React.useState<'tunai_laci' | 'transfer_bank'>('tunai_laci')
  const [proofPath, setProofPath] = React.useState<string | null>(null)
  const [notes, setNotes] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null)

  const filtered = items.filter(item => {
    if (filter === 'overdue' && item.daysOverdue <= 0) return false
    if (filter === 'upcoming' && (item.daysOverdue > 0 || item.daysOverdue < -7)) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        item.invoice_number.toLowerCase().includes(q) ||
        item.mitra_name.toLowerCase().includes(q)
      )
    }
    return true
  })

  const totalRemainingAll = items.reduce((s, i) => s + i.remaining, 0)
  const totalOverdueAmount = items
    .filter(i => i.daysOverdue > 0)
    .reduce((s, i) => s + i.remaining, 0)

  const openPayModal = (row: PiutangRow) => {
    setSelectedTx(row)
    setAmount(row.remaining)
    setPaymentDate(defaultDate)
    setMethod('tunai_laci')
    setProofPath(null)
    setNotes('')
    setErrorMsg(null)
    setSuccessMsg(null)
  }

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTx) return
    setErrorMsg(null)

    if (amount <= 0 || amount > selectedTx.remaining) {
      setErrorMsg(
        `Nominal pembayaran harus antara Rp 1 sampai ${formatRupiah(selectedTx.remaining)}.`
      )
      return
    }

    setSubmitting(true)
    try {
      const res = await bayarPiutangAction({
        transactionId: selectedTx.id,
        amount,
        paymentDate,
        method,
        proofPath,
        notes
      })
      if (res.error) {
        setErrorMsg(res.error)
      } else {
        setSuccessMsg(
          `Pembayaran ${formatRupiah(amount)} untuk nota ${selectedTx.invoice_number} berhasil dicatat.`
        )
        setSelectedTx(null)
        router.refresh()
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/transactions">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" />
              <span>Daftar Transaksi</span>
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Dashboard Piutang & Pembayaran Cicilan
            </h1>
            <p className="text-sm text-slate-600">
              Pantau umur piutang (aging) dan catat penerimaan cicilan maupun pelunasan nota.
            </p>
          </div>
        </div>
      </div>

      {successMsg && (
        <Alert variant="success">
          <AlertTitle>Pembayaran Piutang Berhasil</AlertTitle>
          <AlertDescription>{successMsg}</AlertDescription>
        </Alert>
      )}

      {/* Ringkasan Aging Piutang */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-slate-600">
              TOTAL PIUTANG BELUM LUNAS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-slate-900">
              {formatRupiah(totalRemainingAll)}
            </div>
            <div className="mt-1 text-xs text-slate-600">{items.length} nota aktif</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-danger">
              TOTAL LEWAT JATUH TEMPO (OVERDUE)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-danger">
              {formatRupiah(totalOverdueAmount)}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              {items.filter(i => i.daysOverdue > 0).length} nota overdue
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-amber-700">
              JATUH TEMPO 0 - 7 HARI KE DEPAN
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-amber-700">
              {formatRupiah(
                items
                  .filter(i => i.daysOverdue <= 0 && i.daysOverdue >= -7)
                  .reduce((s, i) => s + i.remaining, 0)
              )}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              {items.filter(i => i.daysOverdue <= 0 && i.daysOverdue >= -7).length} nota mendekati
              jatuh tempo
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Tabel Piutang */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
            >
              Semua Nota ({items.length})
            </Button>
            <Button
              type="button"
              size="sm"
              variant={filter === 'overdue' ? 'danger' : 'outline'}
              onClick={() => setFilter('overdue')}
            >
              Overdue ({items.filter(i => i.daysOverdue > 0).length})
            </Button>
            <Button
              type="button"
              size="sm"
              variant={filter === 'upcoming' ? 'warning' : 'outline'}
              onClick={() => setFilter('upcoming')}
            >
              Jatuh Tempo 0-7 Hari (
              {items.filter(i => i.daysOverdue <= 0 && i.daysOverdue >= -7).length})
            </Button>
          </div>

          <div className="w-full sm:w-64">
            <Input
              placeholder="Cari invoice atau mitra..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No Invoice</TableHead>
                <TableHead>Mitra</TableHead>
                <TableHead>Tgl Transaksi</TableHead>
                <TableHead>Jatuh Tempo</TableHead>
                <TableHead>Status Umur (Aging)</TableHead>
                <TableHead className="text-right">Total Tagihan</TableHead>
                <TableHead className="text-right">Sisa Piutang</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-slate-600">
                    Tidak ada nota piutang pada kategori ini.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(row => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono font-semibold text-slate-900">
                      <Link href={`/transactions/${row.id}`} className="hover:underline">
                        {row.invoice_number}
                      </Link>
                      {row.is_legacy && (
                        <span className="ml-1 text-xs font-normal text-slate-500">(Migrasi)</span>
                      )}
                    </TableCell>
                    <TableCell className="font-bold text-slate-900">{row.mitra_name}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatWibDate(row.transaction_date)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.due_date ? formatWibDate(row.due_date) : '-'}
                    </TableCell>
                    <TableCell>
                      {row.agingStatus === 'danger' ? (
                        <Badge variant="danger">Overdue {row.daysOverdue} hari</Badge>
                      ) : row.agingStatus === 'warning' ? (
                        <Badge variant="warning">
                          {row.daysOverdue === 0
                            ? 'Jatuh Tempo Hari Ini'
                            : `Jatuh Tempo ${Math.abs(row.daysOverdue)} hari lagi`}
                        </Badge>
                      ) : (
                        <Badge variant="success">
                          Aman ({Math.abs(row.daysOverdue)} hari lagi)
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-600">
                      {formatRupiah(row.total_amount)}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums text-slate-900">
                      {formatRupiah(row.remaining)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button type="button" size="sm" onClick={() => openPayModal(row)}>
                        <Banknote className="h-4 w-4" />
                        <span>Bayar</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Pembayaran Cicilan / Pelunasan */}
      <Dialog
        open={Boolean(selectedTx)}
        onOpenChange={open => {
          if (!open) setSelectedTx(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Terima Pembayaran Piutang: {selectedTx?.invoice_number}
            </DialogTitle>
            <DialogDescription>
              Mitra: <strong>{selectedTx?.mitra_name}</strong> | Sisa Tagihan:{' '}
              <strong>{formatRupiah(selectedTx?.remaining ?? 0)}</strong>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePaySubmit} className="space-y-4">
            {errorMsg && (
              <Alert variant="destructive">
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="payAmount">Nominal Dibayar (Rp)</Label>
                <Input
                  id="payAmount"
                  type="number"
                  min={1}
                  max={selectedTx?.remaining ?? 0}
                  value={amount}
                  onChange={e => setAmount(Number(e.target.value))}
                  className="tabular-nums"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payDate">Tanggal Bayar (WIB)</Label>
                <Input
                  id="payDate"
                  type="date"
                  max={defaultDate}
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  className="tabular-nums"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payMethod">Metode Pembayaran</Label>
              <Select
                id="payMethod"
                value={method}
                onChange={e => setMethod(e.target.value as 'tunai_laci' | 'transfer_bank')}
              >
                <option value="tunai_laci">Tunai (Masuk Kas Laci)</option>
                <option value="transfer_bank">Transfer Bank (Masuk Kas Bank)</option>
              </Select>
            </div>

            <ImageUploadField
              bucket="payment-proofs"
              label="Foto Bukti Transfer / Kwitansi (Opsional)"
              value={proofPath}
              onChange={setProofPath}
            />

            <div className="space-y-2">
              <Label htmlFor="payNotes">Catatan Pembayaran</Label>
              <Textarea
                id="payNotes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Contoh: Pelunasan via BCA an. Toko Sumber Rejeki..."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSelectedTx(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Memproses...' : 'Simpan Pembayaran'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
