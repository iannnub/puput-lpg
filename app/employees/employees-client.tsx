'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  createEmployeeAction,
  updateEmployeeAction,
  createSystemUserAction,
  updateSystemUserAction
} from './actions'
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
import { formatWibDate } from '@/lib/utils/date-wib'
import { Plus, Pencil, UserPlus, KeyRound } from 'lucide-react'

export interface EmployeeRow {
  id: string
  name: string
  position: string
  base_salary: number
  allowance: number
  bonus_per_tabung: number
  join_date: string
  is_active: boolean
  active_kasbon: number
}

export interface SystemUserRow {
  id: string
  email: string
  full_name: string
  role: 'owner' | 'staff'
  is_active: boolean
  created_at: string
}

interface EmployeesClientProps {
  employees: EmployeeRow[]
  systemUsers: SystemUserRow[]
  currentUserId: string
  defaultDate: string
}

export function EmployeesClient({
  employees,
  systemUsers,
  currentUserId,
  defaultDate
}: EmployeesClientProps) {
  const router = useRouter()

  // State Modal Karyawan (Payroll & Supir)
  const [modalOpen, setModalOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<EmployeeRow | null>(null)
  const [name, setName] = React.useState('')
  const [position, setPosition] = React.useState('Supir Pengiriman')
  const [baseSalary, setBaseSalary] = React.useState<number>(2500000)
  const [allowance, setAllowance] = React.useState<number>(500000)
  const [bonusPerTabung, setBonusPerTabung] = React.useState<number>(1000)
  const [joinDate, setJoinDate] = React.useState(defaultDate)
  const [isActive, setIsActive] = React.useState(true)
  const [loading, setLoading] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  // State Modal Akun Login Sistem (Owner / Staff)
  const [userModalOpen, setUserModalOpen] = React.useState(false)
  const [editingUser, setEditingUser] = React.useState<SystemUserRow | null>(null)
  const [userEmail, setUserEmail] = React.useState('')
  const [userFullName, setUserFullName] = React.useState('')
  const [userRole, setUserRole] = React.useState<'owner' | 'staff'>('staff')
  const [userPassword, setUserPassword] = React.useState('')
  const [userIsActive, setUserIsActive] = React.useState(true)
  const [userLoading, setUserLoading] = React.useState(false)
  const [userErrorMsg, setUserErrorMsg] = React.useState<string | null>(null)

  const openCreateModal = () => {
    setEditing(null)
    setName('')
    setPosition('Supir Pengiriman')
    setBaseSalary(2500000)
    setAllowance(500000)
    setBonusPerTabung(1000)
    setJoinDate(defaultDate)
    setIsActive(true)
    setErrorMsg(null)
    setModalOpen(true)
  }

  const openEditModal = (emp: EmployeeRow) => {
    setEditing(emp)
    setName(emp.name)
    setPosition(emp.position)
    setBaseSalary(Number(emp.base_salary))
    setAllowance(Number(emp.allowance))
    setBonusPerTabung(Number(emp.bonus_per_tabung))
    setJoinDate(emp.join_date)
    setIsActive(emp.is_active)
    setErrorMsg(null)
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    if (!name.trim() || !position.trim()) {
      setErrorMsg('Nama dan jabatan karyawan wajib diisi.')
      return
    }

    setLoading(true)
    try {
      const res = editing
        ? await updateEmployeeAction({
            id: editing.id,
            name,
            position,
            base_salary: baseSalary,
            allowance,
            bonus_per_tabung: bonusPerTabung,
            join_date: joinDate,
            is_active: isActive
          })
        : await createEmployeeAction({
            name,
            position,
            base_salary: baseSalary,
            allowance,
            bonus_per_tabung: bonusPerTabung,
            join_date: joinDate
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

  const openCreateUserModal = () => {
    setEditingUser(null)
    setUserEmail('')
    setUserFullName('')
    setUserRole('staff')
    setUserPassword('')
    setUserIsActive(true)
    setUserErrorMsg(null)
    setUserModalOpen(true)
  }

  const openEditUserModal = (u: SystemUserRow) => {
    setEditingUser(u)
    setUserEmail(u.email)
    setUserFullName(u.full_name)
    setUserRole(u.role)
    setUserPassword('')
    setUserIsActive(u.is_active)
    setUserErrorMsg(null)
    setUserModalOpen(true)
  }

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setUserErrorMsg(null)

    setUserLoading(true)
    try {
      const res = editingUser
        ? await updateSystemUserAction({
            id: editingUser.id,
            full_name: userFullName,
            role: userRole,
            is_active: userIsActive,
            new_password: userPassword
          })
        : await createSystemUserAction({
            email: userEmail,
            password: userPassword,
            full_name: userFullName,
            role: userRole
          })

      if (res.error) {
        setUserErrorMsg(res.error)
      } else {
        setUserModalOpen(false)
        router.refresh()
      }
    } finally {
      setUserLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Bagian 1: Master Karyawan & Pengaturan Gaji */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Master Karyawan & Pengaturan Gaji (Owner Only)
            </h1>
            <p className="text-sm text-slate-600">
              Data gaji pokok, tunjangan, dan tarif bonus per tabung diproteksi khusus untuk Owner.
            </p>
          </div>

          <Button type="button" onClick={openCreateModal}>
            <Plus className="h-4 w-4" />
            <span>Tambah Karyawan</span>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Daftar Karyawan Operasional & Supir ({employees.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Karyawan</TableHead>
                  <TableHead>Jabatan</TableHead>
                  <TableHead className="text-right">Gaji Pokok</TableHead>
                  <TableHead className="text-right">Tunjangan</TableHead>
                  <TableHead className="text-right">Bonus / Tabung</TableHead>
                  <TableHead className="text-right">Kasbon Aktif</TableHead>
                  <TableHead>Mulai Kerja</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-slate-600">
                      Belum ada data karyawan terdaftar.
                    </TableCell>
                  </TableRow>
                ) : (
                  employees.map(emp => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-bold text-slate-900">{emp.name}</TableCell>
                      <TableCell>{emp.position}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatRupiah(emp.base_salary)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatRupiah(emp.allowance)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium text-emerald-700">
                        {formatRupiah(emp.bonus_per_tabung)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {emp.active_kasbon > 0 ? (
                          <span className="text-amber-700">{formatRupiah(emp.active_kasbon)}</span>
                        ) : (
                          <span className="text-slate-500">Rp 0</span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatWibDate(emp.join_date)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={emp.is_active ? 'success' : 'outline'}>
                          {emp.is_active ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(emp)}
                        >
                          <Pencil className="h-4 w-4" />
                          <span>Edit</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Bagian 2: Manajemen Akun Login Sistem (Owner & Staff) */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Manajemen Akun Login Aplikasi (Role Owner & Staff)
            </h2>
            <p className="text-sm text-slate-600">
              Kelola akun pengguna yang dapat login ke sistem kasir, gudang, atau panel Owner.
            </p>
          </div>

          <Button type="button" variant="secondary" onClick={openCreateUserModal}>
            <UserPlus className="h-4 w-4" />
            <span>Tambah Akun Login</span>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Daftar Akun Login Sistem ({systemUsers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Pengguna</TableHead>
                  <TableHead>Email Login</TableHead>
                  <TableHead>Hak Akses (Role)</TableHead>
                  <TableHead>Status Akun</TableHead>
                  <TableHead>Tanggal Dibuat</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {systemUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-slate-600">
                      Belum ada akun login terdaftar.
                    </TableCell>
                  </TableRow>
                ) : (
                  systemUsers.map(u => (
                    <TableRow key={u.id}>
                      <TableCell className="font-bold text-slate-900">
                        {u.full_name}
                        {u.id === currentUserId && (
                          <span className="ml-2 text-xs font-normal text-blue-700">(Akun Anda)</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-slate-700">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === 'owner' ? 'default' : 'secondary'}>
                          {u.role === 'owner' ? 'OWNER (Akses Penuh)' : 'STAFF (Kasir & Gudang)'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.is_active ? 'success' : 'destructive'}>
                          {u.is_active ? 'Aktif' : 'Diblokir'}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums text-slate-600">
                        {formatWibDate(u.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditUserModal(u)}
                        >
                          <KeyRound className="h-4 w-4" />
                          <span>Edit / Password</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Modal Tambah/Edit Karyawan Operasional */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit Karyawan: ${editing.name}` : 'Tambah Karyawan Baru'}
            </DialogTitle>
            <DialogDescription>
              Atur komponen gaji pokok, tunjangan tetap, dan insentif bonus pengiriman per tabung.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <Alert variant="destructive">
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="empName">Nama Lengkap</Label>
                <Input
                  id="empName"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="empPos">Jabatan</Label>
                <Input
                  id="empPos"
                  value={position}
                  onChange={e => setPosition(e.target.value)}
                  placeholder="Supir Pengiriman / Admin Gudang"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="baseSalary">Gaji Pokok (Rp)</Label>
                <Input
                  id="baseSalary"
                  type="number"
                  min={0}
                  value={baseSalary}
                  onChange={e => setBaseSalary(Number(e.target.value))}
                  className="tabular-nums"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="allowance">Tunjangan Tetap (Rp)</Label>
                <Input
                  id="allowance"
                  type="number"
                  min={0}
                  value={allowance}
                  onChange={e => setAllowance(Number(e.target.value))}
                  className="tabular-nums"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bonusPerTabung">Bonus / Tabung (Rp)</Label>
                <Input
                  id="bonusPerTabung"
                  type="number"
                  min={0}
                  value={bonusPerTabung}
                  onChange={e => setBonusPerTabung(Number(e.target.value))}
                  className="tabular-nums"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="joinDate">Tanggal Mulai Kerja</Label>
                <Input
                  id="joinDate"
                  type="date"
                  value={joinDate}
                  onChange={e => setJoinDate(e.target.value)}
                  className="tabular-nums"
                  required
                />
              </div>

              {editing && (
                <div className="space-y-2">
                  <Label htmlFor="empActive">Status Karyawan</Label>
                  <Select
                    id="empActive"
                    value={isActive ? 'true' : 'false'}
                    onChange={e => setIsActive(e.target.value === 'true')}
                  >
                    <option value="true">Aktif</option>
                    <option value="false">Nonaktif</option>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Menyimpan...' : 'Simpan Karyawan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Tambah/Edit Akun Login Sistem */}
      <Dialog open={userModalOpen} onOpenChange={setUserModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUser
                ? `Edit Akun Login: ${editingUser.email}`
                : 'Tambah Akun Login Sistem Baru'}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? 'Ubah nama, hak akses role, status aktif, atau isi password baru untuk mereset password.'
                : 'Buat akun baru untuk Staff Gudang/Kasir atau Owner tambahan.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUserSubmit} className="space-y-4">
            {userErrorMsg && (
              <Alert variant="destructive">
                <AlertDescription>{userErrorMsg}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="sysUserEmail">Email Login</Label>
              <Input
                id="sysUserEmail"
                type="email"
                value={userEmail}
                onChange={e => setUserEmail(e.target.value)}
                placeholder="Contoh: kasir2@pangkalan.local"
                disabled={Boolean(editingUser)}
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sysUserFullName">Nama Lengkap Pengguna</Label>
                <Input
                  id="sysUserFullName"
                  value={userFullName}
                  onChange={e => setUserFullName(e.target.value)}
                  placeholder="Contoh: Andi Kasir"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sysUserRole">Hak Akses (Role)</Label>
                <Select
                  id="sysUserRole"
                  value={userRole}
                  onChange={e => setUserRole(e.target.value as 'owner' | 'staff')}
                  disabled={editingUser?.id === currentUserId}
                >
                  <option value="staff">Staff (Kasir & Operasional Gudang)</option>
                  <option value="owner">Owner (Akses Penuh Keuangan & Master)</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sysUserPassword">
                  {editingUser ? 'Password Baru (Kosongkan jika tetap)' : 'Password Login'}
                </Label>
                <Input
                  id="sysUserPassword"
                  type="password"
                  value={userPassword}
                  onChange={e => setUserPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  required={!editingUser}
                />
              </div>

              {editingUser && (
                <div className="space-y-2">
                  <Label htmlFor="sysUserActive">Status Login</Label>
                  <Select
                    id="sysUserActive"
                    value={userIsActive ? 'true' : 'false'}
                    onChange={e => setUserIsActive(e.target.value === 'true')}
                    disabled={editingUser.id === currentUserId}
                  >
                    <option value="true">Aktif (Diizinkan Login)</option>
                    <option value="false">Diblokir (Tidak Bisa Login)</option>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUserModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={userLoading}>
                {userLoading ? 'Menyimpan...' : 'Simpan Akun Login'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
