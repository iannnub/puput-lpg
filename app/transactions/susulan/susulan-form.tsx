'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { terimaSusulanAction } from './actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { formatNumber } from '@/lib/utils/format-currency'
import { ArrowLeft } from 'lucide-react'

interface SusulanFormProps {
  mitras: Array<{ id: string; name: string }>
  products: Array<{ id: string; name: string }>
  borrowedByMitra: Record<string, Record<string, number>>
}

export function SusulanForm({ mitras, products, borrowedByMitra }: SusulanFormProps) {
  const router = useRouter()
  const [mitraId, setMitraId] = React.useState<string>(mitras[0]?.id ?? '')
  const [returnMap, setReturnMap] = React.useState<Record<string, number>>({})
  const [catatan, setCatatan] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null)

  const currentBorrowed = borrowedByMitra[mitraId] ?? {}

  const handleMitraChange = (newId: string) => {
    setMitraId(newId)
    setReturnMap({})
    setErrorMsg(null)
    setSuccessMsg(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    const returns = products.map(p => ({
      product_id: p.id,
      qty: returnMap[p.id] ?? 0
    }))

    setLoading(true)
    try {
      const res = await terimaSusulanAction(mitraId, returns, catatan)
      if (res.error) {
        setErrorMsg(res.error)
      } else {
        setSuccessMsg(
          'Pengembalian tabung kosong susulan berhasil dicatat ke gudang dan mengurangi saldo pinjaman mitra.'
        )
        setReturnMap({})
        setCatatan('')
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/transactions">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Transaksi</span>
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Terima Susulan Tabung Kosong dari Mitra
          </h1>
          <p className="text-sm text-slate-600">
            Catat pengembalian tabung kosong yang dipinjam mitra di luar jadwal pengiriman baru.
          </p>
        </div>
      </div>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertTitle>Gagal Mencatat Susulan</AlertTitle>
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}
      {successMsg && (
        <Alert variant="success">
          <AlertTitle>Susulan Berhasil Dicatat</AlertTitle>
          <AlertDescription>{successMsg}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Formulir Pengembalian Tabung Kosong Susulan</CardTitle>
          <CardDescription>
            Stok Gudang Kosong bertambah dan Saldo Pinjaman Mitra berkurang secara atomic melalui{' '}
            <code>rpc_receive_susulan</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2 max-w-md">
              <Label htmlFor="mitraSelect">Pilih Mitra</Label>
              <Select
                id="mitraSelect"
                value={mitraId}
                onChange={e => handleMitraChange(e.target.value)}
              >
                {mitras.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk Tabung</TableHead>
                  <TableHead className="text-right">Pinjaman Aktif di Mitra</TableHead>
                  <TableHead className="text-right">Qty Dikembalikan Sekarang</TableHead>
                  <TableHead className="text-right">Sisa Pinjaman Setelah Susulan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map(p => {
                  const borrowed = currentBorrowed[p.id] ?? 0
                  const retQty = returnMap[p.id] ?? 0
                  const remaining = Math.max(0, borrowed - retQty)

                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-bold text-slate-900">{p.name}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatNumber(borrowed)} tabung
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          max={borrowed}
                          disabled={borrowed === 0}
                          value={retQty}
                          onChange={e =>
                            setReturnMap(prev => ({
                              ...prev,
                              [p.id]: Number(e.target.value)
                            }))
                          }
                          className="ml-auto w-28 text-right tabular-nums"
                        />
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-slate-700">
                        {formatNumber(remaining)} tabung
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>

            <div className="space-y-2">
              <Label htmlFor="catatanSusulan">Catatan Pengembalian</Label>
              <Textarea
                id="catatanSusulan"
                value={catatan}
                onChange={e => setCatatan(e.target.value)}
                placeholder="Contoh: Diantar oleh karyawan mitra ke gudang sore hari..."
              />
            </div>

            <div className="flex justify-end gap-3">
              <Link href="/transactions">
                <Button type="button" variant="outline">
                  Batal
                </Button>
              </Link>
              <Button type="submit" disabled={loading}>
                {loading ? 'Menyimpan...' : 'Simpan Pengembalian Susulan'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
