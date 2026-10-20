'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  updateMitraAction,
  setCustomPriceAction,
  removeCustomPriceAction
} from '../actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { formatRupiah, formatNumber } from '@/lib/utils/format-currency'
import { formatWibDate } from '@/lib/utils/date-wib'
import { ArrowLeft, Save, RotateCcw } from 'lucide-react'

interface MitraDetailClientProps {
  mitra: {
    id: string
    name: string
    phone: string | null
    address: string | null
    credit_limit: number
    max_open_invoices: number
    is_system: boolean
    is_active: boolean
  }
  products: Array<{
    id: string
    name: string
    buy_price: number
    sell_price: number
  }>
  customPrices: Record<string, number>
  borrowedBalances: Record<string, number>
  transactions: Array<{
    id: string
    invoice_number: string
    transaction_date: string
    total_amount: number
    total_paid: number
    payment_status: string
    due_date: string | null
    voided_at: string | null
    is_legacy: boolean
  }>
  isOwner: boolean
  todayWib: string
}

export function MitraDetailClient({
  mitra,
  products,
  customPrices,
  borrowedBalances,
  transactions,
  isOwner,
  todayWib
}: MitraDetailClientProps) {
  const router = useRouter()
  const [name, setName] = React.useState(mitra.name)
  const [phone, setPhone] = React.useState(mitra.phone ?? '')
  const [address, setAddress] = React.useState(mitra.address ?? '')
  const [creditLimit, setCreditLimit] = React.useState<number>(Number(mitra.credit_limit))
  const [maxInvoices, setMaxInvoices] = React.useState<number>(mitra.max_open_invoices)
  const [isActive, setIsActive] = React.useState<boolean>(mitra.is_active)
  const [savingMitra, setSavingMitra] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null)

  const [priceInputs, setPriceInputs] = React.useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const p of products) {
      init[p.id] = customPrices[p.id] !== undefined ? String(customPrices[p.id]) : ''
    }
    return init
  })
  const [savingProductId, setSavingProductId] = React.useState<string | null>(null)

  const handleSaveMitra = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)
    setSavingMitra(true)
    try {
      const res = await updateMitraAction({
        id: mitra.id,
        name,
        phone,
        address,
        credit_limit: creditLimit,
        max_open_invoices: maxInvoices,
        is_active: isActive
      })
      if (res.error) {
        setErrorMsg(res.error)
      } else {
        setSuccessMsg('Profil mitra berhasil diperbarui.')
        router.refresh()
      }
    } finally {
      setSavingMitra(false)
    }
  }

  const handleSetCustomPrice = async (productId: string) => {
    const raw = priceInputs[productId]?.trim()
    if (!raw || Number(raw) <= 0) {
      setErrorMsg('Masukkan nominal harga khusus yang valid (> 0).')
      return
    }
    setErrorMsg(null)
    setSuccessMsg(null)
    setSavingProductId(productId)
    try {
      const res = await setCustomPriceAction(mitra.id, productId, Number(raw))
      if (res.error) {
        setErrorMsg(res.error)
      } else {
        setSuccessMsg('Harga khusus berhasil disimpan.')
        router.refresh()
      }
    } finally {
      setSavingProductId(null)
    }
  }

  const handleResetCustomPrice = async (productId: string) => {
    setErrorMsg(null)
    setSuccessMsg(null)
    setSavingProductId(productId)
    try {
      const res = await removeCustomPriceAction(mitra.id, productId)
      if (res.error) {
        setErrorMsg(res.error)
      } else {
        setPriceInputs(prev => ({ ...prev, [productId]: '' }))
        setSuccessMsg('Harga dikembalikan ke harga jual standar.')
        router.refresh()
      }
    } finally {
      setSavingProductId(null)
    }
  }

  const activeDebtTotal = transactions
    .filter(tx => !tx.voided_at && tx.payment_status !== 'lunas')
    .reduce((sum, tx) => sum + (Number(tx.total_amount) - Number(tx.total_paid)), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/mitras">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" />
              <span>Kembali</span>
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{mitra.name}</h1>
            <p className="text-sm text-slate-600">
              Detail profil mitra, harga khusus per produk, pinjaman tabung, dan riwayat nota.
            </p>
          </div>
        </div>
        <Badge variant={mitra.is_active ? 'success' : 'outline'}>
          {mitra.is_active ? 'MITRA AKTIF' : 'NONAKTIF'}
        </Badge>
      </div>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}
      {successMsg && (
        <Alert variant="success">
          <AlertDescription>{successMsg}</AlertDescription>
        </Alert>
      )}

      {/* Ringkasan Pinjaman Tabung & Piutang */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-slate-600">
              TOTAL PIUTANG AKTIF
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold tabular-nums text-slate-900">
              {formatRupiah(activeDebtTotal)}
            </div>
            <div className="mt-1 text-xs tabular-nums text-slate-600">
              Limit: {mitra.is_system ? 'Tunai' : formatRupiah(Number(mitra.credit_limit))}
            </div>
          </CardContent>
        </Card>

        {products.map(p => (
          <Card key={p.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold uppercase text-slate-600">
                PINJAMAN TABUNG {p.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold tabular-nums text-slate-900">
                {formatNumber(borrowedBalances[p.id] ?? 0)} tabung
              </div>
              <div className="mt-1 text-xs text-slate-600">
                Tabung kosong di lokasi mitra
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pengaturan Harga Khusus Mitra */}
      <Card>
        <CardHeader>
          <CardTitle>Pengaturan Harga Jual Khusus Mitra</CardTitle>
          <CardDescription>
            Jika diisi, form penjualan akan otomatis memilih harga khusus ini saat mitra dipilih.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead className="text-right">Harga Beli (HPP)</TableHead>
                <TableHead className="text-right">Harga Jual Standar</TableHead>
                <TableHead className="text-right">Harga Khusus Mitra (Rp)</TableHead>
                {isOwner && <TableHead className="text-right">Aksi</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map(p => {
                const hasCustom = customPrices[p.id] !== undefined
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-bold text-slate-900">{p.name}</TableCell>
                    <TableCell className="text-right tabular-nums text-slate-600">
                      {formatRupiah(Number(p.buy_price))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatRupiah(Number(p.sell_price))}
                    </TableCell>
                    <TableCell className="text-right">
                      {isOwner ? (
                        <div className="flex justify-end">
                          <Input
                            type="number"
                            min={0}
                            placeholder={String(p.sell_price)}
                            value={priceInputs[p.id] ?? ''}
                            onChange={e =>
                              setPriceInputs(prev => ({
                                ...prev,
                                [p.id]: e.target.value
                              }))
                            }
                            className="w-40 text-right tabular-nums"
                          />
                        </div>
                      ) : hasCustom ? (
                        <span className="font-bold tabular-nums text-primary">
                          {formatRupiah(customPrices[p.id])}
                        </span>
                      ) : (
                        <span className="text-slate-500">Standar</span>
                      )}
                    </TableCell>
                    {isOwner && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={savingProductId === p.id}
                            onClick={() => handleSetCustomPrice(p.id)}
                          >
                            <Save className="h-4 w-4" />
                            <span>Simpan</span>
                          </Button>
                          {hasCustom && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={savingProductId === p.id}
                              onClick={() => handleResetCustomPrice(p.id)}
                              title="Kembalikan ke harga standar"
                            >
                              <RotateCcw className="h-4 w-4" />
                              <span>Reset</span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Form Edit Profil Mitra (Owner Only & Non-System) */}
      {isOwner && !mitra.is_system && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Pengaturan & Plafon Kredit Mitra</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveMitra} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="editName">Nama Mitra</Label>
                  <Input
                    id="editName"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editPhone">Nomor Telepon</Label>
                  <Input
                    id="editPhone"
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/[^\d]/g, ''))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="editAddr">Alamat Lengkap</Label>
                <Textarea
                  id="editAddr"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="editLimit">Plafon Limit Kredit (Rp)</Label>
                  <Input
                    id="editLimit"
                    type="number"
                    min={0}
                    value={creditLimit}
                    onChange={e => setCreditLimit(Number(e.target.value))}
                    className="tabular-nums"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editMaxInv">Maks Nota Gantung</Label>
                  <Input
                    id="editMaxInv"
                    type="number"
                    min={1}
                    value={maxInvoices}
                    onChange={e => setMaxInvoices(Number(e.target.value))}
                    className="tabular-nums"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editStatus">Status Mitra</Label>
                  <Select
                    id="editStatus"
                    value={isActive ? 'true' : 'false'}
                    onChange={e => setIsActive(e.target.value === 'true')}
                  >
                    <option value="true">Aktif</option>
                    <option value="false">Nonaktif</option>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={savingMitra}>
                  {savingMitra ? 'Menyimpan...' : 'Simpan Perubahan Mitra'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Riwayat Transaksi Mitra */}
      <Card>
        <CardHeader>
          <CardTitle>Riwayat Transaksi Mitra (25 Terakhir)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead className="text-right">Total Tagihan</TableHead>
                <TableHead className="text-right">Sisa Piutang</TableHead>
                <TableHead>Jatuh Tempo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-slate-600">
                    Belum ada transaksi untuk mitra ini.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map(tx => {
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
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatWibDate(tx.transaction_date)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatRupiah(Number(tx.total_amount))}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatRupiah(remaining)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {tx.due_date ? formatWibDate(tx.due_date) : '-'}
                      </TableCell>
                      <TableCell>
                        {isVoided ? (
                          <Badge variant="outline">VOID</Badge>
                        ) : isOverdue ? (
                          <Badge variant="destructive">OVERDUE</Badge>
                        ) : tx.payment_status === 'lunas' ? (
                          <Badge variant="success">LUNAS</Badge>
                        ) : tx.payment_status === 'partial' ? (
                          <Badge variant="warning">CICIL</Badge>
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
    </div>
  )
}
