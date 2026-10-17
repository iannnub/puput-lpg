'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { createProductAction, updateProductAction } from './actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { Plus, Pencil } from 'lucide-react'

export interface ProductRow {
  id: string
  name: string
  buy_price: number
  sell_price: number
  is_active: boolean
}

interface ProductsClientProps {
  products: ProductRow[]
  isOwner: boolean
}

export function ProductsClient({ products, isOwner }: ProductsClientProps) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ProductRow | null>(null)
  const [name, setName] = React.useState('')
  const [buyPrice, setBuyPrice] = React.useState<number>(0)
  const [sellPrice, setSellPrice] = React.useState<number>(0)
  const [isActive, setIsActive] = React.useState<boolean>(true)
  const [loading, setLoading] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  const openCreateModal = () => {
    setEditing(null)
    setName('')
    setBuyPrice(0)
    setSellPrice(0)
    setIsActive(true)
    setErrorMsg(null)
    setModalOpen(true)
  }

  const openEditModal = (product: ProductRow) => {
    setEditing(product)
    setName(product.name)
    setBuyPrice(Number(product.buy_price))
    setSellPrice(Number(product.sell_price))
    setIsActive(product.is_active)
    setErrorMsg(null)
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    if (!name.trim()) {
      setErrorMsg('Nama produk wajib diisi.')
      return
    }
    if (buyPrice < 0 || sellPrice < 0) {
      setErrorMsg('Harga beli dan harga jual tidak boleh negatif.')
      return
    }

    setLoading(true)
    try {
      const res = editing
        ? await updateProductAction({
            id: editing.id,
            name,
            buy_price: buyPrice,
            sell_price: sellPrice,
            is_active: isActive
          })
        : await createProductAction({
            name,
            buy_price: buyPrice,
            sell_price: sellPrice
          })

      if (res.error) {
        setErrorMsg(res.error)
      } else {
        setModalOpen(false)
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Master Produk Gas LPG</h1>
          <p className="text-sm text-slate-600">
            Daftar jenis tabung LPG beserta Harga Beli (HPP) dan Harga Jual standar pangkalan.
          </p>
        </div>
        {isOwner && (
          <Button type="button" onClick={openCreateModal}>
            <Plus className="h-4 w-4" />
            <span>Tambah Produk</span>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Produk</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Produk</TableHead>
                <TableHead className="text-right">Harga Beli (HPP)</TableHead>
                <TableHead className="text-right">Harga Jual Standar</TableHead>
                <TableHead className="text-right">Margin per Tabung</TableHead>
                <TableHead>Status</TableHead>
                {isOwner && <TableHead className="text-right">Aksi</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={isOwner ? 6 : 5}
                    className="py-8 text-center text-slate-600"
                  >
                    Belum ada produk terdaftar.
                  </TableCell>
                </TableRow>
              ) : (
                products.map(p => {
                  const margin = Number(p.sell_price) - Number(p.buy_price)
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-bold text-slate-900">{p.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatRupiah(Number(p.buy_price))}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatRupiah(Number(p.sell_price))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-700 font-medium">
                        {formatRupiah(margin)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.is_active ? 'success' : 'outline'}>
                          {p.is_active ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </TableCell>
                      {isOwner && (
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(p)}
                          >
                            <Pencil className="h-4 w-4" />
                            <span>Edit</span>
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit Produk: ${editing.name}` : 'Tambah Produk LPG Baru'}
            </DialogTitle>
            <DialogDescription>
              Produk baru otomatis diinisialisasi dengan stok awal 0 di tabel gudang melalui
              trigger database.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <Alert variant="destructive">
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="prodName">Nama Produk</Label>
              <Input
                id="prodName"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Contoh: 3kg / 12kg / Bright Gas 5.5kg"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="buyPrice">Harga Beli / HPP (Rp)</Label>
                <Input
                  id="buyPrice"
                  type="number"
                  min={0}
                  value={buyPrice}
                  onChange={e => setBuyPrice(Number(e.target.value))}
                  className="tabular-nums"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sellPrice">Harga Jual Standar (Rp)</Label>
                <Input
                  id="sellPrice"
                  type="number"
                  min={0}
                  value={sellPrice}
                  onChange={e => setSellPrice(Number(e.target.value))}
                  className="tabular-nums"
                  required
                />
              </div>
            </div>

            {editing && (
              <div className="space-y-2">
                <Label htmlFor="prodActive">Status Produk</Label>
                <Select
                  id="prodActive"
                  value={isActive ? 'true' : 'false'}
                  onChange={e => setIsActive(e.target.value === 'true')}
                >
                  <option value="true">Aktif</option>
                  <option value="false">Nonaktif</option>
                </Select>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Menyimpan...' : 'Simpan Produk'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
