'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createTransactionSaleAction } from './actions'
import { checkMitraCreditStatus } from './check-mitra'
import { ImageUploadField } from '@/components/shared/image-upload'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { formatRupiah, formatNumber } from '@/lib/utils/format-currency'
import { ArrowLeft, Plus, Trash2, Lock, Unlock } from 'lucide-react'

interface ProductOption {
  id: string
  name: string
  sell_price: number
  gudang_isi: number
}

interface MitraOption {
  id: string
  name: string
  credit_limit: number
  max_pending_invoices: number
  is_system: boolean
}

interface DriverOption {
  id: string
  name: string
  position: string
}

interface NewTransactionFormProps {
  products: ProductOption[]
  mitras: MitraOption[]
  drivers: DriverOption[]
  customPrices: Record<string, Record<string, number>>
  defaultDate: string
  defaultDueDate: string
  isOwner: boolean
}

export function NewTransactionForm({
  products,
  mitras,
  drivers,
  customPrices,
  defaultDate,
  defaultDueDate,
  isOwner
}: NewTransactionFormProps) {
  const router = useRouter()
  const [transactionDate, setTransactionDate] = React.useState(defaultDate)
  const [mitraId, setMitraId] = React.useState(mitras[0]?.id ?? '')
  const [driverId, setDriverId] = React.useState<string>(drivers[0]?.id ?? '')

  const getEffectivePrice = React.useCallback(
    (mId: string, pId: string) => {
      const custom = customPrices[mId]?.[pId]
      if (custom !== undefined) return custom
      const prod = products.find(p => p.id === pId)
      return prod?.sell_price ?? 0
    },
    [customPrices, products]
  )

  const [items, setItems] = React.useState<
    Array<{
      product_id: string
      qty_sent_isi: number
      qty_returned_kosong: number
      sell_price: number
    }>
  >(() => {
    const firstProd = products[0]
    const firstMitra = mitras[0]
    if (!firstProd) return []
    return [
      {
        product_id: firstProd.id,
        qty_sent_isi: 10,
        qty_returned_kosong: 10,
        sell_price:
          customPrices[firstMitra?.id ?? '']?.[firstProd.id] ?? firstProd.sell_price
      }
    ]
  })

  const [paymentType, setPaymentType] = React.useState<
    'lunas_tunai' | 'lunas_transfer' | 'tempo'
  >('lunas_tunai')
  const [dueDate, setDueDate] = React.useState(defaultDueDate)
  const [dpAmount, setDpAmount] = React.useState<number>(0)
  const [dpMethod, setDpMethod] = React.useState<'tunai_laci' | 'transfer_bank'>('tunai_laci')
  const [recipientName, setRecipientName] = React.useState('')
  const [photoPath, setPhotoPath] = React.useState<string | null>(null)
  const [notes, setNotes] = React.useState('')

  // Credit status state
  const [creditStatus, setCreditStatus] = React.useState<{
    isBlocked: boolean
    isSystemWalkIn: boolean
    isOverdue: boolean
    overdueCount: number
    totalPiutang: number
    creditLimit: number
    availableCredit: number
    maxPendingInvoices: number
    currentPendingCount: number
  } | null>(null)

  // Override Tempo state
  const [overrideToken, setOverrideToken] = React.useState<string | null>(null)
  const [overrideReason, setOverrideReason] = React.useState<string>('')
  const [overrideModalOpen, setOverrideModalOpen] = React.useState(false)
  const [ownerEmail, setOwnerEmail] = React.useState('')
  const [ownerPassword, setOwnerPassword] = React.useState('')
  const [modalReason, setModalReason] = React.useState('')
  const [verifyingOwner, setVerifyingOwner] = React.useState(false)
  const [overrideError, setOverrideError] = React.useState<string | null>(null)

  const [submitting, setSubmitting] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  // Refresh credit status & custom prices when mitra changes
  React.useEffect(() => {
    if (!mitraId) return
    setOverrideToken(null)
    checkMitraCreditStatus(mitraId)
      .then(status => {
        setCreditStatus(status)
        if (status.isSystemWalkIn && paymentType === 'tempo') {
          setPaymentType('lunas_tunai')
        }
      })
      .catch(() => {
        setCreditStatus(null)
      })

    setItems(prev =>
      prev.map(row => ({
        ...row,
        sell_price: getEffectivePrice(mitraId, row.product_id)
      }))
    )
  }, [mitraId, getEffectivePrice, paymentType])

  const handleAddProductRow = () => {
    const usedIds = new Set(items.map(i => i.product_id))
    const availableProd = products.find(p => !usedIds.has(p.id))
    if (!availableProd) return
    setItems(prev => [
      ...prev,
      {
        product_id: availableProd.id,
        qty_sent_isi: 5,
        qty_returned_kosong: 5,
        sell_price: getEffectivePrice(mitraId, availableProd.id)
      }
    ])
  }

  const handleRemoveProductRow = (idx: number) => {
    if (items.length <= 1) return
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  const totalTagihan = items.reduce(
    (sum, item) => sum + item.qty_sent_isi * item.sell_price,
    0
  )
  const totalReturnedKosong = items.reduce(
    (sum, item) => sum + item.qty_returned_kosong,
    0
  )
  const totalBorrowedNew = items.reduce(
    (sum, item) => sum + Math.max(0, item.qty_sent_isi - item.qty_returned_kosong),
    0
  )

  const newDebtAmount =
    paymentType === 'tempo' ? Math.max(0, totalTagihan - (dpAmount || 0)) : 0

  const isTempoLocked =
    paymentType === 'tempo' &&
    creditStatus !== null &&
    !creditStatus.isSystemWalkIn &&
    (creditStatus.isBlocked ||
      creditStatus.isOverdue ||
      creditStatus.currentPendingCount >= creditStatus.maxPendingInvoices ||
      creditStatus.totalPiutang + newDebtAmount > creditStatus.creditLimit)

  const handleVerifyOwner = async (e: React.FormEvent) => {
    e.preventDefault()
    setOverrideError(null)
    setVerifyingOwner(true)
    try {
      const res = await fetch('/api/auth/verify-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: ownerEmail,
          password: ownerPassword,
          mitraId,
          reason: modalReason
        })
      })
      const json = await res.json()
      if (!res.ok) {
        setOverrideError(json.error || 'Gagal verifikasi Owner')
      } else {
        setOverrideToken(json.temporaryToken)
        setOverrideReason(modalReason.trim())
        setOverrideModalOpen(false)
        setOwnerPassword('')
      }
    } catch {
      setOverrideError('Terjadi kesalahan jaringan saat verifikasi Owner.')
    } finally {
      setVerifyingOwner(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (items.length === 0) {
      setErrorMsg('Tambahkan minimal 1 produk untuk dikirim.')
      return
    }

    for (const item of items) {
      if (item.qty_sent_isi <= 0) {
        setErrorMsg('Jumlah kirim isi harus lebih dari 0.')
        return
      }
      if (item.qty_returned_kosong < 0 || item.qty_returned_kosong > item.qty_sent_isi) {
        setErrorMsg(
          'Jumlah kembali kosong saat pengiriman tidak boleh melebihi jumlah kirim isi. Gunakan menu Terima Susulan untuk pengembalian tabung lama.'
        )
        return
      }
    }

    if (isTempoLocked) {
      if (isOwner && !overrideReason.trim()) {
        setErrorMsg('Mitra sedang terkena kunci kredit/overdue. Isi Alasan Override Owner.')
        return
      }
      if (!isOwner && !overrideToken) {
        setErrorMsg(
          'Mitra sedang terkena kunci kredit/overdue. Minta Otorisasi Override dari Owner terlebih dahulu.'
        )
        return
      }
    }

    setSubmitting(true)
    try {
      const res = await createTransactionSaleAction({
        mitra_id: mitraId,
        driver_id: driverId || null,
        transaction_date: transactionDate,
        items,
        payment_type: paymentType,
        dp_amount: paymentType === 'tempo' ? dpAmount : 0,
        dp_method: dpMethod,
        due_date: paymentType === 'tempo' ? dueDate : null,
        recipient_name: recipientName,
        photo_path: photoPath,
        notes,
        override_token: overrideToken,
        override_reason: overrideReason || null
      })

      if (res.error) {
        setErrorMsg(res.error)
      } else if (res.transactionId) {
        router.push(`/transactions/${res.transactionId}`)
        router.refresh()
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/transactions">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Daftar Transaksi</span>
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transaksi Penjualan Baru</h1>
          <p className="text-sm text-slate-600">
            Catat pengiriman barang, serah terima tabung kosong, dan pembayaran lunas atau tempo.
          </p>
        </div>
      </div>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertTitle>Transaksi Ditolak</AlertTitle>
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bagian 1: Tanggal, Mitra, & Supir */}
        <Card>
          <CardHeader>
            <CardTitle>Informasi Pengiriman & Mitra</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="txDate">Tanggal Transaksi (WIB)</Label>
                <Input
                  id="txDate"
                  type="date"
                  max={defaultDate}
                  value={transactionDate}
                  onChange={e => setTransactionDate(e.target.value)}
                  className="tabular-nums"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mitraSelect">Pilih Mitra Tujuan</Label>
                <Select
                  id="mitraSelect"
                  value={mitraId}
                  onChange={e => setMitraId(e.target.value)}
                >
                  {mitras.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.is_system ? '— Wajib Lunas' : ''}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="driverSelect">Supir Pengiriman (Opsional)</Label>
                <Select
                  id="driverSelect"
                  value={driverId}
                  onChange={e => setDriverId(e.target.value)}
                >
                  <option value="">-- Tanpa Supir (Ambil Sendiri di Gudang) --</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.position})
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {creditStatus && !creditStatus.isSystemWalkIn && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-medium tabular-nums text-slate-700">
                <div>
                  Limit Kredit:{' '}
                  <span className="font-bold text-slate-900">
                    {formatRupiah(creditStatus.creditLimit)}
                  </span>
                </div>
                <div>
                  Piutang Saat Ini:{' '}
                  <span className="font-bold text-slate-900">
                    {formatRupiah(creditStatus.totalPiutang)}
                  </span>
                </div>
                <div>
                  Nota Gantung:{' '}
                  <span className="font-bold text-slate-900">
                    {creditStatus.currentPendingCount} / {creditStatus.maxPendingInvoices} nota
                  </span>
                </div>
                <div>
                  {creditStatus.isOverdue ? (
                    <Badge variant="destructive">
                      Overdue ({creditStatus.overdueCount} nota lewat jatuh tempo)
                    </Badge>
                  ) : creditStatus.isBlocked ? (
                    <Badge variant="destructive">Mitra Diblokir</Badge>
                  ) : (
                    <Badge variant="success">Status Kredit Aman</Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bagian 2: Daftar Barang yang Dikirim */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Daftar Barang yang Dikirim</CardTitle>
              <CardDescription>
                Harga otomatis mengikuti Harga Khusus Mitra bila sudah diatur.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddProductRow}
              disabled={items.length >= products.length}
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Produk</span>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-right">Kirim Isi (Qty)</TableHead>
                  <TableHead className="text-right">Kembali Kosong (Qty)</TableHead>
                  <TableHead className="text-right">Harga Jual (Rp)</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row, idx) => {
                  const subtotal = row.qty_sent_isi * row.sell_price
                  return (
                    <TableRow key={idx}>
                      <TableCell>
                        <Select
                          value={row.product_id}
                          onChange={e => {
                            const newProdId = e.target.value
                            const newPrice = getEffectivePrice(mitraId, newProdId)
                            setItems(prev =>
                              prev.map((item, i) =>
                                i === idx
                                  ? { ...item, product_id: newProdId, sell_price: newPrice }
                                  : item
                              )
                            )
                          }}
                          className="w-48"
                        >
                          {products.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} (Stok: {formatNumber(p.gudang_isi)})
                            </option>
                          ))}
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={1}
                          value={row.qty_sent_isi}
                          onChange={e =>
                            setItems(prev =>
                              prev.map((item, i) =>
                                i === idx
                                  ? { ...item, qty_sent_isi: Number(e.target.value) }
                                  : item
                              )
                            )
                          }
                          className="ml-auto w-24 text-right tabular-nums"
                          required
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          max={row.qty_sent_isi}
                          value={row.qty_returned_kosong}
                          onChange={e =>
                            setItems(prev =>
                              prev.map((item, i) =>
                                i === idx
                                  ? { ...item, qty_returned_kosong: Number(e.target.value) }
                                  : item
                              )
                            )
                          }
                          className="ml-auto w-24 text-right tabular-nums"
                          required
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          value={row.sell_price}
                          onChange={e =>
                            setItems(prev =>
                              prev.map((item, i) =>
                                i === idx
                                  ? { ...item, sell_price: Number(e.target.value) }
                                  : item
                              )
                            )
                          }
                          className="ml-auto w-32 text-right tabular-nums"
                          required
                        />
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums text-slate-900">
                        {formatRupiah(subtotal)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={items.length <= 1}
                          onClick={() => handleRemoveProductRow(idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>

            <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1 text-xs font-medium tabular-nums text-slate-700">
                <div>
                  Ringkasan Tabung: +{formatNumber(totalReturnedKosong)} Kosong masuk gudang | +
                  {formatNumber(totalBorrowedNew)} Dipinjam mitra
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold uppercase text-slate-600">Total Tagihan</div>
                <div className="text-2xl font-bold tabular-nums text-slate-900">
                  {formatRupiah(totalTagihan)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bagian 3: Bukti Serah Terima & Pembayaran */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Bukti Serah Terima</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recipientName">Nama Penerima di Lokasi</Label>
                <Input
                  id="recipientName"
                  value={recipientName}
                  onChange={e => setRecipientName(e.target.value)}
                  placeholder="Contoh: Pak Andi / Ibu Sari"
                />
              </div>

              <ImageUploadField
                bucket="transaction-proofs"
                label="Upload Foto Nota Tanda Tangan (Opsional, Kompresi WebP)"
                value={photoPath}
                onChange={setPhotoPath}
              />

              <div className="space-y-2">
                <Label htmlFor="txNotes">Catatan Pengiriman</Label>
                <Textarea
                  id="txNotes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Catatan tambahan pengiriman..."
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Metode Pembayaran</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="paymentType">Status Pembayaran</Label>
                <Select
                  id="paymentType"
                  value={paymentType}
                  onChange={e =>
                    setPaymentType(
                      e.target.value as 'lunas_tunai' | 'lunas_transfer' | 'tempo'
                    )
                  }
                >
                  <option value="lunas_tunai">Lunas Tunai (Masuk Kas Laci)</option>
                  <option value="lunas_transfer">Lunas Transfer Bank (Masuk Kas Bank)</option>
                  {!creditStatus?.isSystemWalkIn && (
                    <option value="tempo">Tempo / Piutang Mitra</option>
                  )}
                </Select>
              </div>

              {paymentType === 'tempo' && (
                <div className="space-y-4 rounded-md border border-slate-200 bg-slate-50 p-4">
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Tanggal Jatuh Tempo</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      min={transactionDate}
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      className="bg-white tabular-nums"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="dpAmount">DP / Uang Muka (Opsional, Rp)</Label>
                      <Input
                        id="dpAmount"
                        type="number"
                        min={0}
                        max={totalTagihan}
                        value={dpAmount}
                        onChange={e => setDpAmount(Number(e.target.value))}
                        className="bg-white tabular-nums"
                      />
                    </div>

                    {dpAmount > 0 && (
                      <div className="space-y-2">
                        <Label htmlFor="dpMethod">Metode Penerimaan DP</Label>
                        <Select
                          id="dpMethod"
                          value={dpMethod}
                          onChange={e =>
                            setDpMethod(e.target.value as 'tunai_laci' | 'transfer_bank')
                          }
                          className="bg-white"
                        >
                          <option value="tunai_laci">Tunai (Masuk Kas Laci)</option>
                          <option value="transfer_bank">Transfer (Masuk Kas Bank)</option>
                        </Select>
                      </div>
                    )}
                  </div>

                  <div className="text-xs font-semibold tabular-nums text-slate-800">
                    Sisa Piutang Baru: {formatRupiah(newDebtAmount)}
                  </div>

                  {/* Proteksi Auto-Lock Overdue / Limit Kredit */}
                  {isTempoLocked && (
                    <div className="rounded-md border border-red-300 bg-red-50 p-3 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-red-900">
                        <Lock className="h-4 w-4 shrink-0" />
                        <span>Transaksi Tempo Terkunci Otomatis</span>
                      </div>
                      <p className="text-xs text-red-800">
                        Mitra ini memiliki nota overdue atau melebihi plafon limit kredit / batas
                        nota gantung. Diperlukan otorisasi Override dari Owner.
                      </p>

                      {isOwner ? (
                        <div className="space-y-1.5">
                          <Label className="text-xs text-red-900">
                            Alasan Override Owner (Wajib untuk Audit Log)
                          </Label>
                          <Input
                            value={overrideReason}
                            onChange={e => setOverrideReason(e.target.value)}
                            placeholder="Contoh: Disetujui karena mitra janji lunas besok pagi..."
                            className="bg-white"
                            required
                          />
                        </div>
                      ) : overrideToken ? (
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                          <Unlock className="h-4 w-4 shrink-0" />
                          <span>
                            Token Otorisasi Owner Aktif (Alasan: {overrideReason})
                          </span>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setOverrideError(null)
                            setOverrideModalOpen(true)
                          }}
                        >
                          <Unlock className="h-4 w-4" />
                          <span>Buka Kunci Tempo (Otorisasi Owner)</span>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/transactions">
            <Button type="button" variant="outline">
              Batal
            </Button>
          </Link>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Menyimpan Transaksi...' : 'Simpan Transaksi'}
          </Button>
        </div>
      </form>

      {/* Modal Verifikasi Owner untuk Staff */}
      <Dialog open={overrideModalOpen} onOpenChange={setOverrideModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Otorisasi Override Tempo oleh Owner</DialogTitle>
            <DialogDescription>
              Verifikasi kredensial Owner dilakukan secara stateless tanpa mengubah sesi login
              Staff. Token berlaku sekali pakai selama 5 menit.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleVerifyOwner} className="space-y-4">
            {overrideError && (
              <Alert variant="destructive">
                <AlertDescription>{overrideError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="ownerEmail">Email Owner</Label>
              <Input
                id="ownerEmail"
                type="email"
                value={ownerEmail}
                onChange={e => setOwnerEmail(e.target.value)}
                placeholder="owner@pangkalan.local"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ownerPassword">Password Owner</Label>
              <Input
                id="ownerPassword"
                type="password"
                value={ownerPassword}
                onChange={e => setOwnerPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modalReason">Alasan Override (Wajib Dicatat di Audit Log)</Label>
              <Textarea
                id="modalReason"
                value={modalReason}
                onChange={e => setModalReason(e.target.value)}
                placeholder="Alasan memberikan izin tempo khusus..."
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOverrideModalOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={verifyingOwner}>
                {verifyingOwner ? 'Memverifikasi...' : 'Terbitkan Token Override'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
