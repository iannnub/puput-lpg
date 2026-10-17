'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { tukarGulingBocorAction } from '../actions'
import { ImageUploadField } from '@/components/shared/image-upload'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { formatNumber } from '@/lib/utils/format-currency'
import { ArrowLeft } from 'lucide-react'

interface TukarGulingFormProps {
  mitras: Array<{ id: string; name: string }>
  products: Array<{
    product_id: string
    name: string
    gudang_isi: number
    gudang_bocor: number
  }>
}

export function TukarGulingForm({ mitras, products }: TukarGulingFormProps) {
  const router = useRouter()
  const [mitraId, setMitraId] = React.useState<string>(mitras[0]?.id ?? '')
  const [productId, setProductId] = React.useState<string>(products[0]?.product_id ?? '')
  const [qty, setQty] = React.useState<number>(1)
  const [photoPath, setPhotoPath] = React.useState<string | null>(null)
  const [notes, setNotes] = React.useState<string>('')
  const [loading, setLoading] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  const selectedProduct = products.find(p => p.product_id === productId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    if (!mitraId) {
      setErrorMsg('Pilih mitra terlebih dahulu.')
      return
    }
    if (qty <= 0) {
      setErrorMsg('Jumlah tabung tukar guling harus lebih dari 0.')
      return
    }

    setLoading(true)
    try {
      const res = await tukarGulingBocorAction({
        mitraId,
        productId,
        qty,
        photoPath,
        notes
      })
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
          <h1 className="text-2xl font-bold text-slate-900">
            Tukar Guling Tabung Bocor dari Mitra
          </h1>
          <p className="text-sm text-slate-600">
            Mitra mengembalikan tabung bocor dan langsung diganti dengan tabung isi baru dari
            gudang.
          </p>
        </div>
      </div>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertTitle>Gagal Memproses Tukar Guling</AlertTitle>
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Formulir Tukar Guling Tabung Bocor</CardTitle>
          <CardDescription>
            Stok Gudang Isi berkurang dan Stok Gudang Bocor bertambah secara atomic tanpa mengubah
            saldo kas maupun piutang mitra.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="mitraSelect">Pilih Mitra</Label>
                <Select
                  id="mitraSelect"
                  value={mitraId}
                  onChange={e => setMitraId(e.target.value)}
                >
                  {mitras.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prodSelect">Pilih Produk</Label>
                <Select
                  id="prodSelect"
                  value={productId}
                  onChange={e => setProductId(e.target.value)}
                >
                  {products.map(p => (
                    <option key={p.product_id} value={p.product_id}>
                      {p.name} (Stok Isi Tersedia: {formatNumber(p.gudang_isi)})
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="qtyTukar">Jumlah Tabung Ditukar</Label>
              <Input
                id="qtyTukar"
                type="number"
                min={1}
                max={selectedProduct?.gudang_isi ?? 9999}
                value={qty}
                onChange={e => setQty(Number(e.target.value))}
                className="max-w-xs tabular-nums"
                required
              />
            </div>

            <ImageUploadField
              bucket="transaction-proofs"
              label="Foto Bukti Tabung Bocor dari Mitra (Opsional)"
              value={photoPath}
              onChange={setPhotoPath}
            />

            <div className="space-y-2">
              <Label htmlFor="notes">Catatan Tukar Guling</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Contoh: Segel bocor dibawa langsung oleh pemilik warung..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Link href="/stocks">
                <Button type="button" variant="outline">
                  Batal
                </Button>
              </Link>
              <Button type="submit" disabled={loading}>
                {loading ? 'Memproses...' : 'Simpan Tukar Guling'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
