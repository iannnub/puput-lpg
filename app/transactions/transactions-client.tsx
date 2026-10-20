'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { voidTransactionAction } from './actions'
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
import { Plus, Eye, Ban, Banknote, PackageCheck } from 'lucide-react'

export interface TransactionListItem {
  id: string
  invoice_number: string
  transaction_date: string
  total_amount: number
  total_paid: number
  payment_status: string
  due_date: string | null
  voided_at: string | null
  is_legacy: boolean
  mitra_name: string
}

interface TransactionsClientProps {
  transactions: TransactionListItem[]
  isOwner: boolean
  todayWib: string
}

export function TransactionsClient({
  transactions,
  isOwner,
  todayWib
}: TransactionsClientProps) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = React.useState<string>('all')
  const [search, setSearch] = React.useState('')

  const [voidTarget, setVoidTarget] = React.useState<TransactionListItem | null>(null)
  const [voidReason, setVoidReason] = React.useState('')
  const [voiding, setVoiding] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null)

  const filtered = transactions.filter(tx => {
    const isVoid = Boolean(tx.voided_at)
    if (statusFilter === 'void' && !isVoid) return false
    if (statusFilter !== 'all' && statusFilter !== 'void') {
      if (isVoid) return false
      if (tx.payment_status !== statusFilter) return false
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        tx.invoice_number.toLowerCase().includes(q) ||
        tx.mitra_name.toLowerCase().includes(q)
      )
    }
    return true
  })

  const handleVoidSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!voidTarget) return
    setErrorMsg(null)
    if (!voidReason.trim()) {
      setErrorMsg('Alasan pembatalan (void) wajib diisi.')
      return
    }

    setVoiding(true)
    try {
      const res = await voidTransactionAction(voidTarget.id, voidReason)
      if (res.error) {
        setErrorMsg(res.error)
      } else {
        setSuccessMsg(
          `Transaksi ${voidTarget.invoice_number} berhasil dibatalkan. Stok, pinjaman tabung, dan catatan pembayaran telah dipulihkan.`
        )
        setVoidTarget(null)
        setVoidReason('')
        router.refresh()
      }
    } finally {
      setVoiding(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Daftar Transaksi & Piutang
          </h1>
          <p className="text-sm text-slate-600">
            Riwayat seluruh penjualan. Jika ada kekeliruan nota, transaksi dapat dibatalkan melalui fitur Pembatalan (Void).
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/transactions/new">
            <Button>
              <Plus className="h-4 w-4" />
              <span>Transaksi Baru</span>
            </Button>
          </Link>
          <Link href="/transactions/piutang">
            <Button variant="secondary">
              <Banknote className="h-4 w-4" />
              <span>Dashboard Piutang</span>
            </Button>
          </Link>
          <Link href="/transactions/susulan">
            <Button variant="outline">
              <PackageCheck className="h-4 w-4" />
              <span>Terima Susulan Tabung</span>
            </Button>
          </Link>
        </div>
      </div>

      {successMsg && (
        <Alert variant="success">
          <AlertTitle>Void Transaksi Berhasil</AlertTitle>
          <AlertDescription>{successMsg}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Riwayat Transaksi ({filtered.length})</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full sm:w-48"
            >
              <option value="all">Semua Status</option>
              <option value="lunas">Lunas</option>
              <option value="partial">Cicil / Partial</option>
              <option value="pending">Tempo / Belum Bayar</option>
              <option value="void">Dibatalkan (Void)</option>
            </Select>
            <Input
              placeholder="Cari nomor invoice atau mitra..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full sm:w-64"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Mitra</TableHead>
                <TableHead className="text-right">Total Tagihan</TableHead>
                <TableHead className="text-right">Sisa Piutang</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-slate-600">
                    Tidak ada transaksi yang sesuai filter.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(tx => {
                  const isVoided = Boolean(tx.voided_at)
                  const remaining = isVoided
                    ? 0
                    : Number(tx.total_amount) - Number(tx.total_paid)
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
                          <span className="ml-1 text-xs font-normal text-slate-500">
                            (Migrasi)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatWibDate(tx.transaction_date)}
                      </TableCell>
                      <TableCell className="font-bold text-slate-900">{tx.mitra_name}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatRupiah(tx.total_amount)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatRupiah(remaining)}
                      </TableCell>
                      <TableCell>
                        {isVoided ? (
                          <Badge variant="outline">VOID</Badge>
                        ) : isOverdue ? (
                          <Badge variant="danger">OVERDUE</Badge>
                        ) : tx.payment_status === 'lunas' ? (
                          <Badge variant="success">LUNAS</Badge>
                        ) : tx.payment_status === 'partial' ? (
                          <Badge variant="warning">PARTIAL</Badge>
                        ) : (
                          <Badge variant="secondary">TEMPO</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/transactions/${tx.id}`}>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4" />
                              <span>Detail</span>
                            </Button>
                          </Link>
                          {isOwner && !isVoided && !tx.is_legacy && (
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
                              onClick={() => {
                                setErrorMsg(null)
                                setVoidReason('')
                                setVoidTarget(tx)
                              }}
                            >
                              <Ban className="h-4 w-4" />
                              <span>Void</span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Konfirmasi Void Transaksi (Owner Only) */}
      <Dialog
        open={Boolean(voidTarget)}
        onOpenChange={open => {
          if (!open) setVoidTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void Transaksi: {voidTarget?.invoice_number}</DialogTitle>
            <DialogDescription>
              Tindakan ini akan membatalkan nota ini dan tidak dapat dipulihkan kembali. Seluruh
              mutasi stok isi, tabung kosong, dan catatan kas terkait akan otomatis dibalikkan ke
              kondisi sebelum transaksi.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleVoidSubmit} className="space-y-4">
            {errorMsg && (
              <Alert variant="destructive">
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="voidReason">Alasan Pembatalan / Void (Wajib)</Label>
              <Textarea
                id="voidReason"
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                placeholder="Contoh: Salah input jumlah tabung 12kg, akan dibuat ulang..."
                required
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setVoidTarget(null)}>
                Batal
              </Button>
              <Button type="submit" variant="danger" disabled={voiding}>
                {voiding ? 'Memproses Void...' : 'Konfirmasi Void Transaksi'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
