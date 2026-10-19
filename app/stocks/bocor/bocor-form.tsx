'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { laporBocorAction } from '../actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { formatNumber } from '@/lib/utils/format-currency'
import { ArrowLeft } from 'lucide-react'

interface BocorProductOption {
  product_id: string
  name: string
  gudang_isi: number
  gudang_bocor: number
}

export function BocorForm({ products }: { products: BocorProductOption[] }) {
  const router = useRouter()
  const [productId, setProductId] = React.useState<string>(products[0]?.product_id ?? '')
  const [qty, setQty] = React.useState<number>(1)
  const [alasan, setAlasan] = React.useState<string>('')
  const [loading, setLoading] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  const selected = products.find(p => p.product_id === productId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    if (!alasan.trim()) {
      setErrorMsg('Alasan / keterangan bocor wajib diisi.')
      return
    }
    if (qty <= 0) {
      setErrorMsg('Jumlah tabung bocor harus lebih dari 0.')
      return
    }

    setLoading(true)
    try {
      const res = await laporBocorAction(productId, qty, alasan)
      if (res.error) {
        setErrorMsg(res.error)
      } else {
        router.push('/stocks')
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/stocks">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Stok</span>
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lapor Tabung Bocor di Gudang</h1>
          <p className="text-sm text-slate-600">
            Pindahkan catatan tabung dari Gudang Isi menjadi Gudang Bocor untuk persiapan klaim retur.
          </p>
        </div>
      </div>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertTitle>Gagal Melaporkan Tabung Bocor</AlertTitle>
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Formulir Lapor Tabung Bocor</CardTitle>
          <CardDescription>
            Tabung bocor akan masuk ke antrean retur/klaim garansi saat restock berikutnya ke agen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prodSelect">Pilih Produk</Label>
              <Select
                id="prodSelect"
                value={productId}
                onChange={e => setProductId(e.target.value)}
              >
                {products.map(p => (
                  <option key={p.product_id} value={p.product_id}>
                    {p.name} (Stok Isi: {formatNumber(p.gudang_isi)} | Bocor Saat Ini:{' '}
                    {formatNumber(p.gudang_bocor)})
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="qtyBocor">Jumlah Tabung Bocor</Label>
              <Input
                id="qtyBocor"
                type="number"
                min={1}
                max={selected?.gudang_isi ?? 9999}
                value={qty}
                onChange={e => setQty(Number(e.target.value))}
                className="max-w-xs tabular-nums"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="alasanBocor">Alasan / Kondisi Kerusakan (Wajib)</Label>
              <Textarea
                id="alasanBocor"
                value={alasan}
                onChange={e => setAlasan(e.target.value)}
                placeholder="Contoh: Katup valve mendesis saat pengecekan pagi di gudang..."
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Link href="/stocks">
                <Button type="button" variant="outline">
                  Batal
                </Button>
              </Link>
              <Button type="submit" variant="destructive" disabled={loading}>
                {loading ? 'Menyimpan...' : 'Catat Tabung Bocor'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
