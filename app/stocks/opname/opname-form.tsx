'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { submitOpnameAction } from '../actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

interface OpnameProductRow {
  product_id: string
  name: string
  gudang_isi: number
  gudang_kosong: number
  gudang_bocor: number
}

export function OpnameForm({ products }: { products: OpnameProductRow[] }) {
  const router = useRouter()
  const [fisikMap, setFisikMap] = React.useState<
    Record<string, { isi: number; kosong: number; bocor: number }>
  >(() => {
    const init: Record<string, { isi: number; kosong: number; bocor: number }> = {}
    for (const p of products) {
      init[p.product_id] = {
        isi: p.gudang_isi,
        kosong: p.gudang_kosong,
        bocor: p.gudang_bocor
      }
    }
    return init
  })
  const [alasan, setAlasan] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    if (!alasan.trim()) {
      setErrorMsg('Alasan stock opname wajib diisi untuk pencatatan Audit Log.')
      return
    }

    setLoading(true)
    try {
      const items = products.map(p => ({
        product_id: p.product_id,
        fisik_isi: fisikMap[p.product_id]?.isi ?? p.gudang_isi,
        fisik_kosong: fisikMap[p.product_id]?.kosong ?? p.gudang_kosong,
        fisik_bocor: fisikMap[p.product_id]?.bocor ?? p.gudang_bocor
      }))

      const res = await submitOpnameAction(items, alasan)
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
            Stock Opname Fisik Gudang (Owner Only)
          </h1>
          <p className="text-sm text-slate-600">
            Sesuaikan angka sistem dengan hasil perhitungan fisik gudang. Selisih kurang otomatis
            tercatat di Laporan Laba Rugi.
          </p>
        </div>
      </div>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertTitle>Gagal Menyimpan Stock Opname</AlertTitle>
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tabel Perhitungan Fisik vs Sistem</CardTitle>
          <CardDescription>
            Seluruh perubahan dicatat ke <code>stock_movements</code> (tipe <code>opname</code>)
            dan <code>audit_logs</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-right">Sistem (Isi / Kosong / Bocor)</TableHead>
                  <TableHead className="text-right">Fisik Isi</TableHead>
                  <TableHead className="text-right">Fisik Kosong</TableHead>
                  <TableHead className="text-right">Fisik Bocor</TableHead>
                  <TableHead className="text-right">Selisih Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map(p => {
                  const current = fisikMap[p.product_id] ?? {
                    isi: p.gudang_isi,
                    kosong: p.gudang_kosong,
                    bocor: p.gudang_bocor
                  }
                  const diffIsi = current.isi - p.gudang_isi
                  const diffKosong = current.kosong - p.gudang_kosong
                  const diffBocor = current.bocor - p.gudang_bocor
                  const totalDiff = diffIsi + diffKosong + diffBocor

                  return (
                    <TableRow key={p.product_id}>
                      <TableCell className="font-bold text-slate-900">{p.name}</TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums text-slate-700">
                        {formatNumber(p.gudang_isi)} / {formatNumber(p.gudang_kosong)} /{' '}
                        {formatNumber(p.gudang_bocor)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          value={current.isi}
                          onChange={e =>
                            setFisikMap(prev => ({
                              ...prev,
                              [p.product_id]: { ...current, isi: Number(e.target.value) }
                            }))
                          }
                          className="ml-auto w-28 text-right tabular-nums"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          value={current.kosong}
                          onChange={e =>
                            setFisikMap(prev => ({
                              ...prev,
                              [p.product_id]: { ...current, kosong: Number(e.target.value) }
                            }))
                          }
                          className="ml-auto w-28 text-right tabular-nums"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          value={current.bocor}
                          onChange={e =>
                            setFisikMap(prev => ({
                              ...prev,
                              [p.product_id]: { ...current, bocor: Number(e.target.value) }
                            }))
                          }
                          className="ml-auto w-28 text-right tabular-nums"
                        />
                      </TableCell>
                      <TableCell
                        className={`text-right font-bold tabular-nums ${
                          totalDiff < 0
                            ? 'text-danger'
                            : totalDiff > 0
                            ? 'text-emerald-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {totalDiff > 0 ? `+${totalDiff}` : totalDiff}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>

            <div className="space-y-2">
              <Label htmlFor="alasanOpname">Alasan / Berita Acara Stock Opname (Wajib)</Label>
              <Textarea
                id="alasanOpname"
                value={alasan}
                onChange={e => setAlasan(e.target.value)}
                placeholder="Contoh: Pemeriksaan fisik rutin akhir pekan bersama kepala gudang..."
                required
              />
            </div>

            <div className="flex justify-end gap-3">
              <Link href="/stocks">
                <Button type="button" variant="outline">
                  Batal
                </Button>
              </Link>
              <Button type="submit" disabled={loading}>
                {loading ? 'Menyimpan Penyesuaian...' : 'Simpan Hasil Stock Opname'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
