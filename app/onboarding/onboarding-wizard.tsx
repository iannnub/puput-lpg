'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { submitOnboardingAction } from './actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { formatRupiah } from '@/lib/utils/format-currency'
import { Plus, Trash2, CheckCircle2 } from 'lucide-react'

interface ProductItem {
  id: string
  name: string
}

interface MitraItem {
  id: string
  name: string
}

interface OnboardingWizardProps {
  products: ProductItem[]
  mitras: MitraItem[]
  defaultDate: string
  isCompleted?: boolean
  initialKasLaci?: number
  initialKasBank?: number
  initialStocks?: Array<{
    product_id: string
    gudang_isi: number
    gudang_kosong: number
    gudang_bocor: number
  }>
}

export function OnboardingWizard({
  products,
  mitras,
  defaultDate,
  isCompleted = false,
  initialKasLaci = 0,
  initialKasBank = 0,
  initialStocks = []
}: OnboardingWizardProps) {
  const router = useRouter()
  const [step, setStep] = React.useState<1 | 2 | 3>(1)
  const [submitting, setSubmitting] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  // Step 1: Kas Awal
  const [kasLaci, setKasLaci] = React.useState<number>(initialKasLaci)
  const [kasBank, setKasBank] = React.useState<number>(initialKasBank)
  const [tanggal, setTanggal] = React.useState<string>(defaultDate)
  const [catatan, setCatatan] = React.useState<string>('Pencatatan saldo dan stok awal')

  // Step 2: Stok Awal
  const [stokMap, setStokMap] = React.useState<
    Record<string, { isi: number; kosong: number; bocor: number }>
  >(() => {
    const init: Record<string, { isi: number; kosong: number; bocor: number }> = {}
    for (const p of products) {
      const found = initialStocks.find(s => s.product_id === p.id)
      init[p.id] = {
        isi: found?.gudang_isi ?? 0,
        kosong: found?.gudang_kosong ?? 0,
        bocor: found?.gudang_bocor ?? 0
      }
    }
    return init
  })

  // Step 3: Piutang & Pinjaman Tabung Lama
  const [piutangList, setPiutangList] = React.useState<
    Array<{
      mitra_id: string
      hutang_uang: number
      due_date: string
      catatan: string
      tabung: Record<string, number>
    }>
  >([])

  const addPiutangRow = () => {
    if (mitras.length === 0) return
    const defaultTabung: Record<string, number> = {}
    for (const p of products) {
      defaultTabung[p.id] = 0
    }
    setPiutangList(prev => [
      ...prev,
      {
        mitra_id: mitras[0].id,
        hutang_uang: 0,
        due_date: defaultDate,
        catatan: 'Saldo piutang & pinjaman tabung migrasi awal',
        tabung: defaultTabung
      }
    ])
  }

  const removePiutangRow = (idx: number) => {
    setPiutangList(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async () => {
    setErrorMsg(null)
    if (kasLaci < 0 || kasBank < 0) {
      setErrorMsg('Saldo kas awal tidak boleh bernilai negatif.')
      return
    }
    if (tanggal > defaultDate) {
      setErrorMsg('Tanggal cut-off mulai sistem tidak boleh di masa depan.')
      return
    }

    setSubmitting(true)
    try {
      const stokAwal = products.map(p => ({
        product_id: p.id,
        isi: Math.max(0, Math.floor(stokMap[p.id]?.isi ?? 0)),
        kosong: Math.max(0, Math.floor(stokMap[p.id]?.kosong ?? 0)),
        bocor: Math.max(0, Math.floor(stokMap[p.id]?.bocor ?? 0))
      }))

      const piutangLama = piutangList.map(row => ({
        mitra_id: row.mitra_id,
        hutang_uang: Math.max(0, Math.floor(row.hutang_uang)),
        due_date: row.due_date || defaultDate,
        catatan: row.catatan.trim(),
        tabung: products.map(p => ({
          product_id: p.id,
          qty: Math.max(0, Math.floor(row.tabung[p.id] ?? 0))
        }))
      }))

      const res = await submitOnboardingAction({
        kasLaci: Math.floor(kasLaci),
        kasBank: Math.floor(kasBank),
        tanggal,
        catatan: catatan.trim(),
        stokAwal,
        piutangLama
      })

      if (res.error) {
        setErrorMsg(res.error)
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan setup.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Stepper Header */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {[
          { num: 1, title: 'Langkah 1: Kas Awal' },
          { num: 2, title: 'Langkah 2: Stok Fisik Gudang' },
          { num: 3, title: 'Langkah 3: Piutang & Tabung Lama' }
        ].map(item => (
          <button
            key={item.num}
            type="button"
            onClick={() => setStep(item.num as 1 | 2 | 3)}
            className={`flex min-h-11 items-center justify-between rounded-md border px-4 py-2 text-left text-sm font-semibold transition-colors ${
              step === item.num
                ? 'border-primary bg-primary text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span>{item.title}</span>
            {step > item.num && <CheckCircle2 className="h-4 w-4 shrink-0" />}
          </button>
        ))}
      </div>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertTitle>Validasi Setup Gagal</AlertTitle>
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {/* LANGKAH 1 */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Langkah 1: Input Saldo Kas Awal</CardTitle>
            <CardDescription>
              Masukkan posisi uang tunai fisik di laci dan saldo rekening bank saat cut-off migrasi.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="kasLaci">Saldo Kas Tunai di Laci (Rp)</Label>
                <Input
                  id="kasLaci"
                  type="number"
                  min={0}
                  value={kasLaci}
                  onChange={e => setKasLaci(Number(e.target.value))}
                  className="tabular-nums"
                />
                <p className="text-xs font-medium tabular-nums text-slate-600">
                  Preview: {formatRupiah(kasLaci || 0)}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="kasBank">Saldo Kas di Rekening Bank (Rp)</Label>
                <Input
                  id="kasBank"
                  type="number"
                  min={0}
                  value={kasBank}
                  onChange={e => setKasBank(Number(e.target.value))}
                  className="tabular-nums"
                />
                <p className="text-xs font-medium tabular-nums text-slate-600">
                  Preview: {formatRupiah(kasBank || 0)}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tanggal">Tanggal Cut-Off Mulai Sistem (WIB)</Label>
              <Input
                id="tanggal"
                type="date"
                max={defaultDate}
                value={tanggal}
                onChange={e => setTanggal(e.target.value)}
                className="max-w-xs tabular-nums"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="catatan">Catatan Umum Onboarding</Label>
              <Textarea
                id="catatan"
                value={catatan}
                onChange={e => setCatatan(e.target.value)}
                placeholder="Catatan migrasi awal..."
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button type="button" onClick={() => setStep(2)}>
                Lanjut ke Langkah 2: Stok Awal
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* LANGKAH 2 */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Langkah 2: Input Stok Fisik Gudang Awal</CardTitle>
            <CardDescription>
              Hitung fisik tabung Isi, Kosong, dan Bocor yang ada di dalam gudang pangkalan saat ini.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              {products.map(product => {
                const current = stokMap[product.id] ?? { isi: 0, kosong: 0, bocor: 0 }
                return (
                  <div
                    key={product.id}
                    className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-3"
                  >
                    <div className="text-base font-bold text-slate-900">
                      Tabung LPG {product.name}
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label>Tabung Isi di Gudang</Label>
                        <Input
                          type="number"
                          min={0}
                          value={current.isi}
                          onChange={e =>
                            setStokMap(prev => ({
                              ...prev,
                              [product.id]: { ...current, isi: Number(e.target.value) }
                            }))
                          }
                          className="bg-white tabular-nums"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Tabung Kosong di Gudang</Label>
                        <Input
                          type="number"
                          min={0}
                          value={current.kosong}
                          onChange={e =>
                            setStokMap(prev => ({
                              ...prev,
                              [product.id]: { ...current, kosong: Number(e.target.value) }
                            }))
                          }
                          className="bg-white tabular-nums"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Tabung Bocor di Gudang</Label>
                        <Input
                          type="number"
                          min={0}
                          value={current.bocor}
                          onChange={e =>
                            setStokMap(prev => ({
                              ...prev,
                              [product.id]: { ...current, bocor: Number(e.target.value) }
                            }))
                          }
                          className="bg-white tabular-nums"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                Kembali ke Langkah 1
              </Button>
              <Button type="button" onClick={() => setStep(3)}>
                Lanjut ke Langkah 3: Piutang & Tabung Lama
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* LANGKAH 3 */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Langkah 3: Input Piutang & Pinjaman Tabung Lama per Mitra</CardTitle>
                <CardDescription>
                  Opsional. Masukkan sisa hutang uang (piutang lama) dan tabung kosong yang masih
                  dipinjam mitra dari pembukuan manual. Piutang lama otomatis ditandai{' '}
                  <code>is_legacy = true</code> agar tidak menggelembungkan Omzet periode berjalan.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={addPiutangRow}
                disabled={mitras.length === 0}
              >
                <Plus className="h-4 w-4" />
                <span>Tambah Mitra</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {mitras.length === 0 && (
              <Alert variant="warning">
                <AlertDescription>
                  Belum ada mitra reguler terdaftar (selain Pelanggan Umum). Anda dapat langsung
                  menyimpan setup awal atau menambahkan mitra terlebih dahulu di menu Mitra.
                </AlertDescription>
              </Alert>
            )}

            {piutangList.length === 0 ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
                Tidak ada piutang atau pinjaman tabung lama yang ditambahkan. Klik &quot;Tambah
                Mitra&quot; di atas bila ada saldo lama dari mitra.
              </div>
            ) : (
              <div className="space-y-4">
                {piutangList.map((row, idx) => (
                  <div
                    key={idx}
                    className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-slate-900">
                        Data Migrasi Mitra #{idx + 1}
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removePiutangRow(idx)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Hapus</span>
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label>Pilih Mitra</Label>
                        <Select
                          value={row.mitra_id}
                          onChange={e =>
                            setPiutangList(prev =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, mitra_id: e.target.value } : item
                              )
                            )
                          }
                          className="bg-white"
                        >
                          {mitras.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label>Sisa Hutang Uang / Piutang Lama (Rp)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={row.hutang_uang}
                          onChange={e =>
                            setPiutangList(prev =>
                              prev.map((item, i) =>
                                i === idx
                                  ? { ...item, hutang_uang: Number(e.target.value) }
                                  : item
                              )
                            )
                          }
                          className="bg-white tabular-nums"
                        />
                        <p className="text-xs tabular-nums text-slate-600">
                          {formatRupiah(row.hutang_uang || 0)}
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <Label>Tanggal Jatuh Tempo</Label>
                        <Input
                          type="date"
                          value={row.due_date}
                          onChange={e =>
                            setPiutangList(prev =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, due_date: e.target.value } : item
                              )
                            )
                          }
                          className="bg-white tabular-nums"
                        />
                        <p className="text-xs text-slate-600">
                          Boleh tanggal lewat (overdue), hari ini, atau masa depan.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-700">
                        Pinjaman Tabung Kosong Belum Dikembalikan
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {products.map(p => (
                          <div key={p.id} className="space-y-1">
                            <Label className="text-xs">Tabung {p.name} (qty)</Label>
                            <Input
                              type="number"
                              min={0}
                              value={row.tabung[p.id] ?? 0}
                              onChange={e =>
                                setPiutangList(prev =>
                                  prev.map((item, i) =>
                                    i === idx
                                      ? {
                                          ...item,
                                          tabung: {
                                            ...item.tabung,
                                            [p.id]: Number(e.target.value)
                                          }
                                        }
                                      : item
                                  )
                                )
                              }
                              className="bg-white tabular-nums"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="outline" onClick={() => setStep(2)}>
                Kembali ke Langkah 2
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={submitting}>
                {submitting
                  ? 'Menyimpan Data...'
                  : isCompleted
                  ? 'Simpan Perubahan Pengaturan'
                  : 'Simpan Pengaturan Awal'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
