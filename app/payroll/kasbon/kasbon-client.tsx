'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createKasbonAction } from './actions'
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
import { formatRupiah } from '@/lib/utils/format-currency'
import { formatWibDate } from '@/lib/utils/date-wib'
import { Plus, ArrowLeft } from 'lucide-react'

export interface KasbonItemRow {
  id: string
  employee_id: string
  employee_name: string
  employee_position: string
  amount: number
  remaining_amount: number
  kasbon_date: string
  notes: string | null
}

interface KasbonClientProps {
  employees: Array<{ id: string; name: string; position: string }>
  kasbons: KasbonItemRow[]
  defaultDate: string
}

export function KasbonClient({ employees, kasbons, defaultDate }: KasbonClientProps) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = React.useState(false)
  const [employeeId, setEmployeeId] = React.useState(employees[0]?.id ?? '')
  const [amount, setAmount] = React.useState<number>(200000)
  const [kasbonDate, setKasbonDate] = React.useState(defaultDate)
  const [source, setSource] = React.useState<'kas_laci' | 'kas_bank'>('kas_laci')
  const [notes, setNotes] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null)

  const activeKasbons = kasbons.filter(k => k.remaining_amount > 0)
  const totalOutstanding = activeKasbons.reduce((sum, k) => sum + k.remaining_amount, 0)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)
    if (!employeeId) {
      setErrorMsg('Pilih karyawan terlebih dahulu.')
      return
    }
    if (amount <= 0) {
      setErrorMsg('Nominal kasbon harus lebih dari Rp 0.')
      return
    }

    setLoading(true)
    try {
      const res = await createKasbonAction({
        employeeId,
        amount,
        kasbonDate,
        source,
        notes
      })
      if (res.error) {
        setErrorMsg(res.error)
      } else {
        setModalOpen(false)
        setAmount(200000)
        setNotes('')
        setSuccessMsg(
          `Kasbon sebesar ${formatRupiah(amount)} berhasil dicatat dan dipotong dari ${
            source === 'kas_laci' ? 'Kas Laci' : 'Saldo Bank'
          }.`
        )
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/payroll/process">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" />
              <span>Ke Proses Gaji</span>
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Kasbon Karyawan (FIFO Cicilan)
            </h1>
            <p className="text-sm text-slate-600">
              Pinjaman uang tengah bulan yang dipotong penuh atau dicicil FIFO saat penggajian.
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => {
            setErrorMsg(null)
            setModalOpen(true)
          }}
        >
          <Plus className="h-4 w-4" />
          <span>Tambah Kasbon Baru</span>
        </Button>
      </div>

      {successMsg && (
        <Alert variant="success">
          <AlertTitle>Kasbon Berhasil Dicatat</AlertTitle>
          <AlertDescription>{successMsg}</AlertDescription>
        </Alert>
      )}

      {/* Ringkasan Saldo Kasbon Aktif per Karyawan */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-slate-600">
              TOTAL SISA KASBON AKTIF
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-amber-700">
              {formatRupiah(totalOutstanding)}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              Dari {activeKasbons.length} pencairan kasbon yang belum lunas
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabel Riwayat & Sisa Kasbon */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Kasbon Karyawan (Diurutkan FIFO dari Terlama)</CardTitle>
          <CardDescription>
            Saat penggajian diproses, potongan kasbon akan melunasi baris kasbon terlama terlebih
            dahulu dan mencatatnya ke tabel <code>kasbon_repayments</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal Kasbon</TableHead>
                <TableHead>Nama Karyawan</TableHead>
                <TableHead>Jabatan</TableHead>
                <TableHead className="text-right">Nominal Awal</TableHead>
                <TableHead className="text-right">Sisa Belum Lunas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Catatan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kasbons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-slate-600">
                    Belum ada riwayat kasbon karyawan.
                  </TableCell>
                </TableRow>
              ) : (
                kasbons.map(k => (
                  <TableRow key={k.id}>
                    <TableCell className="tabular-nums">
                      {formatWibDate(k.kasbon_date)}
                    </TableCell>
                    <TableCell className="font-bold text-slate-900">
                      {k.employee_name}
                    </TableCell>
                    <TableCell>{k.employee_position}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatRupiah(k.amount)}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums text-slate-900">
                      {formatRupiah(k.remaining_amount)}
                    </TableCell>
                    <TableCell>
                      {k.remaining_amount === 0 ? (
                        <Badge variant="success">LUNAS</Badge>
                      ) : k.remaining_amount < k.amount ? (
                        <Badge variant="warning">CICILAN AKTIF</Badge>
                      ) : (
                        <Badge variant="danger">BELUM DIPOTONG</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {k.notes || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Tambah Kasbon */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Catat Pencairan Kasbon Karyawan</DialogTitle>
            <DialogDescription>
              Catat pinjaman kasbon karyawan dan otomatis memotong saldo kas yang dipilih.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4">
            {errorMsg && (
              <Alert variant="destructive">
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="empSelect">Pilih Karyawan</Label>
              <Select
                id="empSelect"
                value={employeeId}
                onChange={e => setEmployeeId(e.target.value)}
              >
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.position})
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="kasbonAmt">Nominal Pinjaman Kasbon (Rp)</Label>
                <Input
                  id="kasbonAmt"
                  type="number"
                  min={1}
                  value={amount === 0 ? '' : amount}
                  placeholder="0"
                  onChange={e => {
                    const raw = e.target.value.replace(/^0+(?=\d)/, '')
                    setAmount(raw === '' ? 0 : Number(raw))
                  }}
                  className="tabular-nums"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="kasbonDt">Tanggal Pencairan (WIB)</Label>
                <Input
                  id="kasbonDt"
                  type="date"
                  max={defaultDate}
                  value={kasbonDate}
                  onChange={e => setKasbonDate(e.target.value)}
                  className="tabular-nums"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="kasbonSrc">Sumber Dana Pencairan</Label>
              <Select
                id="kasbonSrc"
                value={source}
                onChange={e => setSource(e.target.value as 'kas_laci' | 'kas_bank')}
              >
                <option value="kas_laci">Kas Tunai di Laci</option>
                <option value="kas_bank">Saldo Rekening Bank (Transfer)</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="kasbonNote">Keperluan / Catatan</Label>
              <Textarea
                id="kasbonNote"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Contoh: Keperluan biaya sekolah anak..."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Menyimpan...' : 'Simpan & Cairkan Kasbon'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
