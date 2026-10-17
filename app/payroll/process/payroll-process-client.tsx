'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { processPayrollBatchAction } from './actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { formatRupiah } from '@/lib/utils/format-currency'
import { Printer, Wallet, CheckCircle2 } from 'lucide-react'

export interface EmployeePayrollCandidate {
  id: string
  name: string
  position: string
  base_salary: number
  allowance: number
  bonus_delivery: number
  active_kasbon: number
  existing_payroll_id: string | null
  existing_gross_salary: number | null
  existing_net_salary: number | null
}

interface PayrollProcessClientProps {
  month: number
  year: number
  candidates: EmployeePayrollCandidate[]
}

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember'
]

export function PayrollProcessClient({
  month,
  year,
  candidates
}: PayrollProcessClientProps) {
  const router = useRouter()
  const [selectedMonth, setSelectedMonth] = React.useState(month)
  const [selectedYear, setSelectedYear] = React.useState(year)
  const [paidSource, setPaidSource] = React.useState<'kas_laci' | 'kas_bank'>('kas_bank')
  const [loading, setLoading] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null)

  const [adjustments, setAdjustments] = React.useState<
    Record<
      string,
      {
        bonus_extra: number
        deduction_absence: number
        deduction_kasbon: number
        deduction_other: number
      }
    >
  >(() => {
    const init: Record<
      string,
      {
        bonus_extra: number
        deduction_absence: number
        deduction_kasbon: number
        deduction_other: number
      }
    > = {}
    for (const c of candidates) {
      init[c.id] = {
        bonus_extra: 0,
        deduction_absence: 0,
        deduction_kasbon: c.active_kasbon,
        deduction_other: 0
      }
    }
    return init
  })

  // Reset adjustments when candidates or period changes
  React.useEffect(() => {
    const next: Record<
      string,
      {
        bonus_extra: number
        deduction_absence: number
        deduction_kasbon: number
        deduction_other: number
      }
    > = {}
    for (const c of candidates) {
      next[c.id] = {
        bonus_extra: 0,
        deduction_absence: 0,
        deduction_kasbon: c.active_kasbon,
        deduction_other: 0
      }
    }
    setAdjustments(next)
  }, [candidates])

  const handleChangePeriod = () => {
    router.push(`/payroll/process?month=${selectedMonth}&year=${selectedYear}`)
  }

  const unprocessedCandidates = candidates.filter(c => !c.existing_payroll_id)

  const handleSubmitBatch = async () => {
    setErrorMsg(null)
    setSuccessMsg(null)

    if (unprocessedCandidates.length === 0) {
      setErrorMsg('Seluruh karyawan aktif pada periode ini sudah diproses gajinya.')
      return
    }

    for (const c of unprocessedCandidates) {
      const adj = adjustments[c.id] ?? {
        bonus_extra: 0,
        deduction_absence: 0,
        deduction_kasbon: 0,
        deduction_other: 0
      }
      const gross =
        c.base_salary +
        c.allowance +
        c.bonus_delivery +
        adj.bonus_extra -
        adj.deduction_absence
      const net = gross - adj.deduction_kasbon - adj.deduction_other

      if (adj.deduction_kasbon > c.active_kasbon) {
        setErrorMsg(
          `Potongan kasbon untuk ${c.name} melebihi sisa kasbon aktif (${formatRupiah(
            c.active_kasbon
          )}).`
        )
        return
      }
      if (gross < 0 || net < 0) {
        setErrorMsg(`Gaji bruto atau gaji bersih untuk ${c.name} tidak boleh negatif.`)
        return
      }
    }

    setLoading(true)
    try {
      const items = unprocessedCandidates.map(c => {
        const adj = adjustments[c.id] ?? {
          bonus_extra: 0,
          deduction_absence: 0,
          deduction_kasbon: 0,
          deduction_other: 0
        }
        return {
          employee_id: c.id,
          period_month: month,
          period_year: year,
          bonus_extra: adj.bonus_extra,
          deduction_absence: adj.deduction_absence,
          deduction_kasbon: adj.deduction_kasbon,
          deduction_other: adj.deduction_other,
          paid_source: paidSource
        }
      })

      const res = await processPayrollBatchAction(items)
      if (res.error) {
        setErrorMsg(res.error)
      } else {
        setSuccessMsg(
          `Penggajian periode ${MONTH_NAMES[month - 1]} ${year} berhasil diproses untuk ${
            res.newlyProcessedCount
          } karyawan.`
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
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Proses Gaji Bulanan & Potongan Kasbon FIFO
          </h1>
          <p className="text-sm text-slate-600">
            Periode Aktif: <strong>{MONTH_NAMES[month - 1]} {year}</strong>. Setelah gaji diproses,
            periode pengiriman supir tersebut dikunci otomatis.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/payroll/slips">
            <Button variant="outline">
              <Printer className="h-4 w-4" />
              <span>Arsip Slip Gaji</span>
            </Button>
          </Link>
          <Link href="/payroll/kasbon">
            <Button variant="secondary">
              <Wallet className="h-4 w-4" />
              <span>Kelola Kasbon Karyawan</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Pemilih Periode Gaji */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="monthSelect">Bulan Periode</Label>
              <Select
                id="monthSelect"
                value={String(selectedMonth)}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                className="w-44"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx + 1} value={String(idx + 1)}>
                    {name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="yearSelect">Tahun Periode</Label>
              <Input
                id="yearSelect"
                type="number"
                min={2020}
                max={2100}
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="w-32 tabular-nums"
              />
            </div>

            <Button type="button" variant="outline" onClick={handleChangePeriod}>
              Tampilkan Periode
            </Button>
          </div>
        </CardContent>
      </Card>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertTitle>Gagal Memproses Gaji</AlertTitle>
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {successMsg && (
        <Alert variant="success">
          <AlertTitle>Penggajian Selesai</AlertTitle>
          <AlertDescription>{successMsg}</AlertDescription>
        </Alert>
      )}

      {/* Tabel Perhitungan Gaji Karyawan */}
      <Card>
        <CardHeader>
          <CardTitle>
            Daftar Perhitungan Gaji ({MONTH_NAMES[month - 1]} {year})
          </CardTitle>
          <CardDescription>
            <strong>Potongan Absen</strong> mengurangi Gaji Bruto (beban perusahaan), sedangkan{' '}
            <strong>Potongan Kasbon</strong> dan <strong>Potongan Lainnya</strong> hanya mengurangi
            Gaji Bersih yang diterima karyawan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Karyawan</TableHead>
                <TableHead className="text-right">Pokok & Tunjangan</TableHead>
                <TableHead className="text-right">Bonus Kirim</TableHead>
                <TableHead className="text-right">Bonus Extra (Rp)</TableHead>
                <TableHead className="text-right">Potong Absen (Rp)</TableHead>
                <TableHead className="text-right">Gaji Bruto</TableHead>
                <TableHead className="text-right">Sisa Kasbon</TableHead>
                <TableHead className="text-right">Potong Kasbon (Rp)</TableHead>
                <TableHead className="text-right">Potong Lain (Rp)</TableHead>
                <TableHead className="text-right">Gaji Bersih (Net)</TableHead>
                <TableHead className="text-right">Status / Slip</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="py-8 text-center text-slate-600">
                    Belum ada karyawan aktif terdaftar.
                  </TableCell>
                </TableRow>
              ) : (
                candidates.map(c => {
                  const isProcessed = Boolean(c.existing_payroll_id)
                  const adj = adjustments[c.id] ?? {
                    bonus_extra: 0,
                    deduction_absence: 0,
                    deduction_kasbon: 0,
                    deduction_other: 0
                  }
                  const gross = isProcessed
                    ? Number(c.existing_gross_salary ?? 0)
                    : c.base_salary +
                      c.allowance +
                      c.bonus_delivery +
                      adj.bonus_extra -
                      adj.deduction_absence
                  const net = isProcessed
                    ? Number(c.existing_net_salary ?? 0)
                    : gross - adj.deduction_kasbon - adj.deduction_other

                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-bold text-slate-900">{c.name}</div>
                        <div className="text-xs text-slate-500">{c.position}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        <div>Pokok: {formatRupiah(c.base_salary)}</div>
                        <div className="text-slate-600">Tunj: {formatRupiah(c.allowance)}</div>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-emerald-700">
                        {formatRupiah(c.bonus_delivery)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          disabled={isProcessed}
                          value={adj.bonus_extra}
                          onChange={e =>
                            setAdjustments(prev => ({
                              ...prev,
                              [c.id]: { ...adj, bonus_extra: Number(e.target.value) }
                            }))
                          }
                          className="ml-auto w-28 text-right tabular-nums"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          disabled={isProcessed}
                          value={adj.deduction_absence}
                          onChange={e =>
                            setAdjustments(prev => ({
                              ...prev,
                              [c.id]: { ...adj, deduction_absence: Number(e.target.value) }
                            }))
                          }
                          className="ml-auto w-28 text-right tabular-nums"
                        />
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums text-slate-900">
                        {formatRupiah(gross)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-amber-700">
                        {formatRupiah(c.active_kasbon)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          max={c.active_kasbon}
                          disabled={isProcessed || c.active_kasbon === 0}
                          value={adj.deduction_kasbon}
                          onChange={e =>
                            setAdjustments(prev => ({
                              ...prev,
                              [c.id]: { ...adj, deduction_kasbon: Number(e.target.value) }
                            }))
                          }
                          className="ml-auto w-28 text-right tabular-nums"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          disabled={isProcessed}
                          value={adj.deduction_other}
                          onChange={e =>
                            setAdjustments(prev => ({
                              ...prev,
                              [c.id]: { ...adj, deduction_other: Number(e.target.value) }
                            }))
                          }
                          className="ml-auto w-28 text-right tabular-nums"
                        />
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums text-primary">
                        {formatRupiah(net)}
                      </TableCell>
                      <TableCell className="text-right">
                        {isProcessed ? (
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant="success" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Sudah Diproses</span>
                            </Badge>
                            <a
                              href={`/api/payroll/slip/${c.existing_payroll_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button type="button" variant="outline" size="sm">
                                <Printer className="h-3.5 w-3.5" />
                                <span>Slip PDF</span>
                              </Button>
                            </a>
                          </div>
                        ) : (
                          <Badge variant="secondary">Belum Diproses</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>

          <div className="flex flex-col gap-4 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Label htmlFor="paidSourceSelect" className="whitespace-nowrap">
                Sumber Kas Pembayaran Gaji:
              </Label>
              <Select
                id="paidSourceSelect"
                value={paidSource}
                onChange={e => setPaidSource(e.target.value as 'kas_laci' | 'kas_bank')}
                className="w-56"
              >
                <option value="kas_bank">Saldo Rekening Bank (Transfer)</option>
                <option value="kas_laci">Kas Tunai di Laci</option>
              </Select>
            </div>

            <Button
              type="button"
              disabled={loading || unprocessedCandidates.length === 0}
              onClick={handleSubmitBatch}
            >
              {loading
                ? 'Memproses Gaji & Potongan Kasbon FIFO...'
                : `Simpan & Proses Gaji (${unprocessedCandidates.length} Karyawan)`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
