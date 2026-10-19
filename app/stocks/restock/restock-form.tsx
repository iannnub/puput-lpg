'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { submitRestockAction } from '../actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { formatRupiah, formatNumber } from '@/lib/utils/format-currency'
import { ArrowLeft } from 'lucide-react'

interface StockProductOption {
  product_id: string
  name: string
  buy_price: number
  gudang_isi: number
  gudang_kosong: number
  gudang_bocor: number
}

interface RestockFormProps {
  products: StockProductOption[]
}

export function RestockForm({ products }: RestockFormProps) {
  const router = useRouter()
  const [productId, setProductId] = React.useState<string>(products[0]?.product_id ?? '')
  const [qtyIsiDatang, setQtyIsiDatang] = React.useState<number>(50)
  const [qtyKosongDiserahkan, setQtyKosongDiserahkan] = React.useState<number>(50)
  const [qtyBocorRetur, setQtyBocorRetur] = React.useState<number>(0)
  const [klaimGaransi, setKlaimGaransi] = React.useState<boolean>(true)
  const [source, setSource] = React.useState<'kas_laci' | 'kas_bank'>('kas_bank')
  const [notes, setNotes] = React.useState<string>('')
  const [loading, setLoading] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  const selected = products.find(p => p.product_id === productId)
  const buyPrice = Number(selected?.buy_price ?? 0)
  const billableQty = klaimGaransi
    ? Math.max(0, qtyIsiDatang - qtyBocorRetur)
    : Math.max(0, qtyIsiDatang)
  const estimatedTotal = billableQty * buyPrice

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    if (!productId) {
      setErrorMsg('Pilih produk terlebih dahulu.')
      return
    }
    if (qtyIsiDatang <= 0) {
      setErrorMsg('Jumlah tabung isi datang harus lebih dari 0.')
      return
    }

    setLoading(true)
    try {
      const res = await submitRestockAction({
        product_id: productId,
        qty_isi_datang: qtyIsiDatang,
        qty_kosong_diserahkan: qtyKosongDiserahkan,
        qty_bocor_retur: qtyBocorRetur,
        klaim_garansi: klaimGaransi,
        source,
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
            Restock Tabung dari Agen / Pertamina
          </h1>
          <p className="text-sm text-slate-600">
            Catat kedatangan tabung isi, penyerahan tabung kosong, retur bocor, dan pembayaran HPP.
          </p>
        </div>
      </div>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertTitle>Restock Gagal</AlertTitle>
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Formulir Restock Gudang</CardTitle>
          <CardDescription>
            Catat pasokan tabung baru, tukar tabung kosong, atau klaim garansi tabung bocor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="productId">Pilih Produk LPG</Label>
              <Select
                id="productId"
                value={productId}
                onChange={e => setProductId(e.target.value)}
              >
                {products.map(p => (
                  <option key={p.product_id} value={p.product_id}>
                    {p.name} - HPP: {formatRupiah(p.buy_price)} (Kosong: {p.gudang_kosong} | Bocor:{' '}
                    {p.gudang_bocor})
                  </option>
                ))}
              </Select>
            </div>

            {selected && (
              <div className="grid grid-cols-3 gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs font-medium tabular-nums text-slate-700">
                <div>Stok Isi Saat Ini: {formatNumber(selected.gudang_isi)} tbg</div>
                <div>Stok Kosong Saat Ini: {formatNumber(selected.gudang_kosong)} tbg</div>
                <div>Stok Bocor Saat Ini: {formatNumber(selected.gudang_bocor)} tbg</div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="qtyIsi">Qty Tabung Isi Datang</Label>
                <Input
                  id="qtyIsi"
                  type="number"
                  min={1}
                  value={qtyIsiDatang}
                  onChange={e => setQtyIsiDatang(Number(e.target.value))}
                  className="tabular-nums"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="qtyKosong">Qty Tabung Kosong Diserahkan</Label>
                <Input
                  id="qtyKosong"
                  type="number"
                  min={0}
                  value={qtyKosongDiserahkan}
                  onChange={e => setQtyKosongDiserahkan(Number(e.target.value))}
                  className="tabular-nums"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="qtyBocor">Qty Tabung Bocor Diretur</Label>
                <Input
                  id="qtyBocor"
                  type="number"
                  min={0}
                  value={qtyBocorRetur}
                  onChange={e => setQtyBocorRetur(Number(e.target.value))}
                  className="tabular-nums"
                  required
                />
              </div>
            </div>

            {qtyBocorRetur > 0 && (
              <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                <Label htmlFor="klaimGaransi">Perlakuan Retur Tabung Bocor ke Agen</Label>
                <Select
                  id="klaimGaransi"
                  value={klaimGaransi ? 'true' : 'false'}
                  onChange={e => setKlaimGaransi(e.target.value === 'true')}
                  className="bg-white"
                >
                  <option value="true">
                    Klaim Garansi Diterima (Potong Tagihan Sebesar {qtyBocorRetur} Tabung)
                  </option>
                  <option value="false">
                    Tidak Diklaim / Dianggap Tabung Kosong Biasa (Bayar Penuh {qtyIsiDatang} Tabung)
                  </option>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="source">Sumber Kas Pembayaran Restock</Label>
                <Select
                  id="source"
                  value={source}
                  onChange={e => setSource(e.target.value as 'kas_laci' | 'kas_bank')}
                >
                  <option value="kas_bank">Saldo Rekening Bank (Transfer)</option>
                  <option value="kas_laci">Kas Tunai di Laci</option>
                </Select>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 flex flex-col justify-center">
                <div className="text-xs font-semibold uppercase text-slate-600">
                  Estimasi Total Pembayaran HPP
                </div>
                <div className="text-xl font-bold tabular-nums text-slate-900">
                  {formatRupiah(estimatedTotal)}
                </div>
                <div className="text-xs tabular-nums text-slate-600">
                  ({formatNumber(billableQty)} tabung x {formatRupiah(buyPrice)})
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Catatan DO / Surat Jalan Agen</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Contoh: DO Pertamina #8812, Supir Truk Pak Herman..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Link href="/stocks">
                <Button type="button" variant="outline">
                  Batal
                </Button>
              </Link>
              <Button type="submit" disabled={loading}>
                {loading ? 'Memproses Restock...' : 'Simpan Restock & Potong Kas'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
