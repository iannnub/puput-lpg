'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createMitraAction } from './actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { formatRupiah, formatNumber } from '@/lib/utils/format-currency'
import { Plus, Eye } from 'lucide-react'

export interface MitraSummaryRow {
  id: string
  name: string
  phone: string | null
  address: string | null
  credit_limit: number
  max_open_invoices: number
  is_system: boolean
  is_active: boolean
  current_debt: number
  open_invoices_count: number
  has_overdue: boolean
  total_borrowed_qty: number
}

interface MitrasClientProps {
  mitras: MitraSummaryRow[]
}

export function MitrasClient({ mitras }: MitrasClientProps) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')

  const [name, setName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [address, setAddress] = React.useState('')
  const [creditLimit, setCreditLimit] = React.useState<number>(10000000)
  const [maxOpenInvoices, setMaxOpenInvoices] = React.useState<number>(5)
  const [loading, setLoading] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  const filtered = mitras.filter(
    m =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.phone && m.phone.toLowerCase().includes(search.toLowerCase()))
  )

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    if (!name.trim()) {
      setErrorMsg('Nama mitra wajib diisi.')
      return
    }

    setLoading(true)
    try {
      const res = await createMitraAction({
        name,
        phone,
        address,
        credit_limit: creditLimit,
        max_open_invoices: maxOpenInvoices
      })

      if (res.error) {
        setErrorMsg(res.error)
      } else {
        setModalOpen(false)
        setName('')
        setPhone('')
        setAddress('')
        setCreditLimit(10000000)
        setMaxOpenInvoices(5)
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
          <h1 className="text-2xl font-bold text-slate-900">Master Mitra & Agen</h1>
          <p className="text-sm text-slate-600">
            Kelola mitra pangkalan, plafon kredit tempo, pinjaman tabung, dan harga jual khusus.
          </p>
        </div>

        <Button type="button" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          <span>Tambah Mitra Baru</span>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Daftar Mitra ({filtered.length})</CardTitle>
          <div className="w-full sm:w-72">
            <Input
              placeholder="Cari nama atau telepon mitra..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Mitra</TableHead>
                <TableHead>Telepon</TableHead>
                <TableHead className="text-right">Piutang Aktif</TableHead>
                <TableHead className="text-right">Limit Kredit</TableHead>
                <TableHead className="text-center">Nota Belum Lunas</TableHead>
                <TableHead className="text-right">Pinjam Tabung</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-slate-600">
                    Tidak ada mitra yang ditemukan.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(m => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="font-bold text-slate-900">{m.name}</div>
                      {m.is_system && (
                        <span className="text-xs text-slate-500">
                          Mitra Sistem (Wajib Tunai / Transfer Lunas)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums text-slate-700">
                      {m.phone || '-'}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-slate-900">
                      {formatRupiah(m.current_debt)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-600">
                      {m.is_system ? '-' : formatRupiah(m.credit_limit)}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {m.is_system
                        ? '-'
                        : `${m.open_invoices_count} / ${m.max_open_invoices}`}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatNumber(m.total_borrowed_qty)} tbg
                    </TableCell>
                    <TableCell>
                      {!m.is_active ? (
                        <Badge variant="outline">Nonaktif</Badge>
                      ) : m.has_overdue ? (
                        <Badge variant="destructive">Overdue Lock</Badge>
                      ) : m.open_invoices_count >= m.max_open_invoices && !m.is_system ? (
                        <Badge variant="warning">Limit Nota Penuh</Badge>
                      ) : (
                        <Badge variant="success">Aktif</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/mitras/${m.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4" />
                          <span>Detail & Harga</span>
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Mitra Baru</DialogTitle>
            <DialogDescription>
              Atur identitas mitra beserta batas maksimal piutang (credit limit) dan maksimal nota
              gantung.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4">
            {errorMsg && (
              <Alert variant="destructive">
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="mitraName">Nama Toko / Agen Mitra</Label>
              <Input
                id="mitraName"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Contoh: Toko Sumber Rejeki"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mitraPhone">Nomor Telepon / WhatsApp</Label>
              <Input
                id="mitraPhone"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="0812xxxxxxxx"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mitraAddress">Alamat Pengiriman</Label>
              <Textarea
                id="mitraAddress"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Alamat lengkap mitra..."
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="creditLimit">Plafon Limit Kredit (Rp)</Label>
                <Input
                  id="creditLimit"
                  type="number"
                  min={0}
                  value={creditLimit}
                  onChange={e => setCreditLimit(Number(e.target.value))}
                  className="tabular-nums"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxInvoices">Maks Nota Tempo Aktif</Label>
                <Input
                  id="maxInvoices"
                  type="number"
                  min={1}
                  value={maxOpenInvoices}
                  onChange={e => setMaxOpenInvoices(Number(e.target.value))}
                  className="tabular-nums"
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Menyimpan...' : 'Simpan Mitra'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
