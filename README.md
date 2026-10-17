# puput-lpg

**Sistem Manajemen Distribusi, Stok 4-Keranjang, Piutang, Arus Kas, & Penggajian Pangkalan LPG**

Aplikasi web operasional dan akuntansi terintegrasi untuk Pangkalan / Agen Distribusi LPG. Dibangun menggunakan **Next.js 15 (App Router, Server Actions, TypeScript)** dan **Supabase PostgreSQL 16** dengan seluruh mutasi stok, piutang, kas, dan penggajian dieksekusi secara atomik melalui fungsi PostgreSQL RPC (`SECURITY DEFINER`) dan dilindungi oleh **Row Level Security (RLS)**.

---

## Daftar Isi

1. [Arsitektur & Prinsip Inti Sistem](#1-arsitektur--prinsip-inti-sistem)
2. [Fitur Utama (Flow 0 – Flow 6)](#2-fitur-utama-flow-0--flow-6)
3. [Hak Akses (RBAC) & Manajemen Akun Login](#3-hak-akses-rbac--manajemen-akun-login)
4. [Struktur Tabel & Fungsi RPC Database](#4-struktur-tabel--fungsi-rpc-database)
5. [Struktur Direktori Proyek](#5-struktur-direktori-proyek)
6. [Konfigurasi Environment Variables (`.env`)](#6-konfigurasi-environment-variables-env)
7. [Panduan Instalasi & Menjalankan Lokal](#7-panduan-instalasi--menjalankan-lokal)
8. [Panduan Deployment ke Vercel](#8-panduan-deployment-ke-vercel)
9. [Perintah Utilitas & Pengujian Otomatis](#9-perintah-utilitas--pengujian-otomatis)

---

## 1. Arsitektur & Prinsip Inti Sistem

- **Zero Direct Table Mutation pada Tabel Ledger & Stok:** Role `authenticated` di Supabase hanya memiliki izin `SELECT` pada tabel operasional (`stocks`, `transactions`, `transaction_items`, `payments`, `stock_movements`, `cashflows`, `payrolls`, `kasbons`, `audit_logs`). Seluruh transaksi bisnis wajib melewati prosedur tersimpan PostgreSQL (`RPC`) yang berjalan di dalam satu transaksi database (`BEGIN ... COMMIT`).
- **Pencegahan Race Condition (`FOR UPDATE` Locking):** Pengurangan stok tabung isi dan pembaruan saldo piutang mitra menggunakan row-level lock (`SELECT ... FOR UPDATE` dengan pengurutan `product_id ASC` untuk mencegah deadlock). Dua kasir yang menembakkan transaksi di milidetik yang sama tidak akan pernah menghasilkan stok negatif.
- **Konservasi Fisik Tabung 4-Keranjang:** Setiap produk LPG (`3kg`, `5.5kg`, `12kg`, `50kg`) dilacak di dalam 4 keranjang fisik secara real-time:
  1. `gudang_isi` — Tabung berisi gas siap jual di gudang.
  2. `gudang_kosong` — Tabung kosong di gudang siap ditukar ke agen/Pertamina.
  3. `gudang_bocor` — Tabung rusak/bocor di gudang yang menunggu klaim garansi ke agen/Pertamina.
  4. `dipinjam_mitra` — Tabung kosong yang masih dibawa/dipinjam oleh mitra di lapangan.
- **Pemisahan Akuntansi Kas vs Akrual:**
  - Pembayaran kas (`kas_laci` dan `kas_bank`) tercatat secara real-time pada `cashflows`.
  - Laporan Laba Rugi (`rpc_get_profit_loss_report`) menghitung Omzet Akrual, HPP berdasarkan snapshot harga beli saat transaksi, Beban Operasional (OPEX), Beban Gaji & Bonus Supir, Kerugian Bersih Tabung Bocor (dikurangi pemulihan klaim garansi), dan Selisih Stock Opname.
  - Saldo awal dan piutang migrasi (`is_legacy = true`) dipisahkan secara ketat agar tidak menggelembungkan omzet bulan berjalan.

---

## 2. Fitur Utama (Flow 0 – Flow 6)

### Flow 0 — Onboarding & Migrasi Saldo Awal (`/onboarding`)
- Hanya dapat dijalankan **satu kali** oleh **Owner** saat sistem pertama kali digunakan (`app_settings.onboarding_completed = false`).
- Mengatur nama, alamat, dan nomor telepon pangkalan.
- Mencatat saldo awal Kas Tunai Laci (`kas_laci`) dan Kas Rekening Bank (`kas_bank`).
- Mencatat stok fisik awal per produk (`gudang_isi`, `gudang_kosong`, `gudang_bocor`).
- Mencatat piutang uang lama dan pinjaman tabung kosong mitra dari pembukuan manual sebelumnya (`is_legacy = true`) yang otomatis menginkremen keranjang `dipinjam_mitra`.

### Flow 1 — Autentikasi & Proteksi Role (`/login` & `middleware.ts`)
- Autentikasi berbasis cookie SSR menggunakan `@supabase/ssr`.
- Proteksi rute otomatis di level Middleware Next.js dan validasi berlapis di dalam fungsi SQL RPC (`public.is_owner()` dan `public.is_staff_or_owner()`).

### Flow 2 — Master Data (`/products`, `/mitras`, `/employees`)
- **Master Produk (`/products`):** Pengelolaan harga beli agen (HPP), harga jual standar pangkalan, dan tambah ukuran tabung baru.
- **Master Mitra (`/mitras` & `/mitras/[id]`):** Pengaturan plafon kredit (`credit_limit`), batas maksimal nota belum lunas (`max_pending_invoices`), status mitra (`active` / `blocked`), serta pengaturan **Harga Jual Khusus per Mitra** (`mitra_product_settings`).
- **Master Karyawan & Akun Login (`/employees` - Khusus Owner):**
  - Pengelolaan karyawan operasional/supir (gaji pokok, tunjangan tetap, tarif bonus pengiriman per tabung).
  - Pengelolaan akun login aplikasi untuk menambah/mengubah user ber-role `owner` maupun `staff`, mereset password, atau memblokir akses login.

### Flow 3 — Manajemen Stok 4-Keranjang (`/stocks/*`)
- **Ringkasan Stok & Kartu Stok (`/stocks`):** Pantauan real-time 4 keranjang stok beserta riwayat mutasi (`stock_movements`).
- **Restock Agen / Pertamina (`/stocks/restock`):** Menukar tabung kosong menjadi tabung isi, mendukung **Klaim Garansi Tabung Bocor** (otomatis memotong tagihan restock sebesar nilai tabung bocor yang diklaim dan membalik flag `claimed_warranty`).
- **Lapor Tabung Bocor Gudang (`/stocks/bocor`):** Memindahkan stok dari `gudang_isi` ke `gudang_bocor`.
- **Tukar Guling Tabung Bocor Mitra (`/stocks/tukar-guling`):** Mengganti tabung bocor milik mitra dengan tabung isi baru dari gudang (`gudang_isi` berkurang, `gudang_bocor` bertambah).
- **Stock Opname Fisik (`/stocks/opname` - Khusus Owner):** Penyesuaian stok fisik dengan stok sistem disertai alasan wajib dan pencatatan nilai kerugian/keuntungan opname.

### Flow 4 — Kasir Penjualan, Surat Jalan, Piutang, Override Tempo, & Void (`/transactions/*`)
- **Kasir Multi-Produk (`/transactions/new`):**
  - Mendukung penjualan multi-item dalam satu nota.
  - Otomatis menerapkan harga khusus mitra jika terdaftar.
  - Aturan **Pelanggan Umum (Walk-In):** Wajib bayar lunas dan wajib mengembalikan tabung kosong 1:1 (`qty_returned_kosong = qty_sent_isi`).
  - **Auto-Lock Tempo:** Menolak transaksi Tempo/DP apabila mitra memiliki nota jatuh tempo (`overdue`), melewati jumlah nota gantung maksimal, atau melampaui plafon kredit.
  - **Override Tempo oleh Owner:** Jika kasir dipegang oleh Staff dan mitra terkunci tempo, Owner dapat mengotorisasi transaksi melalui modal verifikasi password Owner (`/api/auth/verify-owner`) tanpa mengubah sesi login Staff, disertai pencatatan alasan ke `audit_logs`.
  - Kompresi foto bukti serah terima otomatis ke format WebP di sisi browser sebelum diunggah ke private bucket `transaction-proofs`.
- **Cetak Nota / Invoice PDF A5 (`/api/invoice/[id]`):** Menghasilkan dokumen PDF setengah halaman A4 siap cetak untuk surat jalan dan bukti tagihan.
- **Pengembalian Tabung Kosong Susulan (`/transactions/susulan`):** Mencatat pengembalian tabung kosong yang sebelumnya dipinjam mitra (`dipinjam_mitra` berkurang, `gudang_kosong` bertambah).
- **Pelunasan Piutang & Cicilan (`/transactions/piutang`):** Pencatatan pembayaran piutang mitra (Tunai Laci atau Transfer Bank) beserta bukti transfer ke private bucket `payment-proofs`.
- **Void Transaksi Atomik (`/transactions/[id]` - Khusus Owner):** Membatalkan nota yang salah input secara atomik (mengembalikan stok 4-keranjang, membalik saldo pinjaman tabung mitra, membuat jurnal kas balik `out_void_refund`, dan menolak void apabila bonus supir periode tersebut sudah dibayarkan).

### Flow 5 — Kasbon FIFO, Penggajian Karyawan, & Buku Kas (`/payroll/*`, `/cashflow`)
- **Manajemen Kasbon Karyawan (`/payroll/kasbon`):** Pencairan kasbon karyawan dari Kas Laci atau Kas Bank.
- **Proses Gaji & Potong Kasbon FIFO (`/payroll/process`):**
  - Menghitung otomatis bonus pengiriman supir berdasarkan jumlah tabung isi yang dikirim pada transaksi sah (tidak di-void dan bukan data migrasi) selama bulan terpilih.
  - Memotong kasbon karyawan secara **FIFO (First-In, First-Out)** dari kasbon tertua melalui `rpc_pay_kasbon_fifo` dan mencatat rincian pelunasan di `kasbon_repayments`.
- **Arsip & Cetak Slip Gaji PDF (`/payroll/slips` & `/api/payroll/slip/[id]`):** Mengunduh slip gaji resmi berformat PDF A5.
- **Buku Arus Kas & Mutasi Internal (`/cashflow`):** Pemantauan saldo riil Kas Tunai Laci dan Kas Rekening Bank, pencatatan biaya operasional (OPEX: BBM, makan, perawatan armada), serta setor/tarik antar kas (`rpc_transfer_cash`).

### Flow 6 — Laporan Laba Rugi Bersih & Performa Mitra (`/reports/*`)
- **Laporan Laba Rugi (`/reports/profit-loss`):** Perhitungan laba rugi bersih berbasis periode tanggal dan ekspor laporan ke format `.xlsx` (ExcelJS).
- **Laporan Performa & Piutang Mitra (`/reports/mitras`):** Analisis volume pengambilan tabung, kontribusi omzet, sisa piutang terhadap limit kredit, dan jumlah tabung yang masih dipinjam per mitra.

---

## 3. Hak Akses (RBAC) & Manajemen Akun Login

Sistem membedakan dua level hak akses pengguna:

| Modul / Fitur | Role `owner` (Admin Utama) | Role `staff` (Kasir & Gudang) |
| :--- | :---: | :---: |
| Onboarding Saldo & Stok Awal (`/onboarding`) | Akses Penuh (1x) | Diblokir |
| Dashboard Operasional (`/dashboard`) | Akses Penuh (Stok, Piutang, Kas, Omzet) | Terbatas (Hanya Stok & Peringatan Operasional) |
| Kasir Penjualan, Susulan Tabung, & Pelunasan Piutang (`/transactions/*`) | Akses Penuh | Akses Penuh (Tanggal dibatasi maks. H-3) |
| Void Transaksi & Override Tempo Terkunci | Akses Penuh | Memerlukan Otorisasi Kredensial Owner |
| Stok 4-Keranjang, Restock, Bocor, Tukar Guling (`/stocks/*`) | Akses Penuh | Akses Penuh |
| Stock Opname Fisik (`/stocks/opname`) | Akses Penuh | Diblokir |
| Master Produk & Master Mitra (`/products`, `/mitras`) | Tambah, Ubah, & Lihat | Hanya Lihat (`Read-Only`) |
| Master Karyawan & Manajemen Akun Login (`/employees`) | Akses Penuh | Diblokir |
| Penggajian & Kasbon Karyawan (`/payroll/*`) | Akses Penuh | Diblokir |
| Buku Kas & Pengeluaran Operasional (`/cashflow`) | Akses Penuh | Diblokir |
| Laporan Laba Rugi & Performa Mitra (`/reports/*`) | Akses Penuh | Diblokir |

### Cara Membuat & Mengelola Akun Login Baru (`Staff` / `Owner`)
Pembuatan akun role lainnya dilakukan **langsung oleh Owner (Admin) dari dalam aplikasi web**:
1. Login menggunakan akun **Owner**.
2. Buka menu **Karyawan** (`/employees`) pada navigasi samping.
3. Gulir ke bagian **Manajemen Akun Login Aplikasi (Role Owner & Staff)**.
4. Klik tombol **Tambah Akun Login**, lalu masukkan:
   - Email Login (misal: `kasir2@pangkalan.local`)
   - Nama Lengkap Pengguna
   - Hak Akses Role (`Staff` untuk Kasir/Gudang, atau `Owner` untuk pemilik)
   - Password Login (minimal 6 karakter)
5. Untuk mereset password atau menonaktifkan akses login seorang Staff, klik tombol **Edit / Password** pada baris akun yang bersangkutan.

---

## 4. Struktur Tabel & Fungsi RPC Database

### 18 Tabel Utama (`public`)
1. `app_settings` — Konfigurasi profil pangkalan dan pengunci status `onboarding_completed`.
2. `users` — Profil pengguna aplikasi dan penentu role (`owner` | `staff`).
3. `products` — Master produk LPG (`3kg`, `12kg`, `Bright Gas 5.5kg`, dll.).
4. `stocks` — Saldo fisik 4-keranjang per produk (`gudang_isi`, `gudang_kosong`, `gudang_bocor`, `dipinjam_mitra`).
5. `mitras` — Master pelanggan/mitra pangkalan beserta limit kredit dan batas nota gantung.
6. `mitra_product_settings` — Harga jual khusus per mitra untuk produk tertentu.
7. `mitra_product_balances` — Saldo akumulasi tabung kosong yang sedang dipinjam oleh masing-masing mitra per produk.
8. `employees` — Data karyawan operasional/supir beserta komponen gaji pokok, tunjangan, dan tarif bonus per tabung.
9. `transactions` — Header nota penjualan, status pembayaran (`pending`, `partial`, `lunas`), jatuh tempo, dan status void.
10. `transaction_items` — Detail item penjualan beserta snapshot HPP, harga jual, dan tarif bonus supir saat transaksi terjadi.
11. `payments` — Riwayat pembayaran tunai/transfer (Lunas, DP, maupun Cicilan Piutang).
12. `stock_movements` — Buku besar mutasi stok 4-keranjang untuk audit fisik.
13. `payrolls` — Arsip pembayaran gaji bulanan karyawan.
14. `kasbons` — Catatan pinjaman/kasbon karyawan beserta sisa tagihan (`remaining_amount`).
15. `kasbon_repayments` — Rincian pemotongan kasbon secara FIFO yang tertaut ke slip gaji.
16. `cashflows` — Buku besar mutasi uang masuk, uang keluar, dan transfer antar kas (`kas_laci` & `kas_bank`).
17. `audit_logs` — Rekam jejak otorisasi sensitif (Override Tempo, Void Nota, Stock Opname).
18. `invoice_counters` — Penghitung nomor urut invoice harian (`INV-YYYYMMDD-XXXX`).

### 14 Fungsi PostgreSQL RPC Atomik
- `rpc_complete_onboarding`
- `rpc_process_restock`
- `rpc_report_warehouse_leak`
- `rpc_exchange_leaky_cylinder`
- `rpc_adjust_stock_opname`
- `rpc_create_transaction_sale`
- `rpc_return_empty_cylinders`
- `rpc_record_debt_payment`
- `rpc_void_transaction`
- `rpc_create_kasbon`
- `rpc_pay_kasbon_fifo`
- `rpc_process_payroll`
- `rpc_record_operational_expense`
- `rpc_transfer_cash`
- `rpc_get_profit_loss_report`
- `rpc_get_active_drivers`

---

## 5. Struktur Direktori Proyek

```text
├── app/
│   ├── api/
│   │   ├── auth/verify-owner/   # Endpoint verifikasi kredensial Owner untuk Override Tempo
│   │   ├── invoice/[id]/        # Generator PDF Invoice / Surat Jalan A5
│   │   └── payroll/slip/[id]/   # Generator PDF Slip Gaji Karyawan A5 (Owner-Only)
│   ├── cashflow/                # Buku Arus Kas Laci & Bank, OPEX, dan Mutasi Kas
│   ├── dashboard/               # Dashboard Operasional & Keuangan sesuai Role
│   ├── employees/               # Master Karyawan, Gaji/Bonus, & Manajemen Akun Login
│   ├── login/                   # Halaman Login Aplikasi
│   ├── mitras/                  # Master Mitra & Pengaturan Harga Khusus
│   ├── onboarding/              # Wizard Setup Awal Saldo Kas, Stok, & Migrasi (Flow 0)
│   ├── payroll/                 # Proses Gaji Bulanan, Kasbon FIFO, & Arsip Slip Gaji
│   ├── products/                # Master Produk LPG & Harga Standar
│   ├── reports/                 # Laporan Laba Rugi Bersih (.xlsx) & Performa Mitra
│   ├── stocks/                  # Stok 4-Keranjang, Restock, Bocor, Tukar Guling, Opname
│   └── transactions/            # Kasir Multi-Produk, Riwayat, Detail/Void, Susulan, Piutang
├── components/
│   ├── layout/                  # AppShell, Sidebar Desktop, & Bottom Navigation Mobile
│   ├── pdf/                     # Template dokumen PDF (@react-pdf/renderer)
│   └── ui/                      # Komponen UI Flat Solid Design System
├── lib/
│   ├── supabase/                # Klien Supabase (Browser, Server SSR, & Admin Server-Only)
│   ├── types/                   # Definisi tipe TypeScript skema database & RPC
│   └── utils/                   # Utilitas format Rupiah, zona waktu WIB, & kompresi WebP
├── scripts/
│   ├── apply-migration.ts       # Skrip eksekusi migrasi SQL & seed awal ke Supabase
│   ├── clean-dummy-data.ts      # Skrip pembersih data dummy pengujian
│   └── seed-users.ts            # Skrip inisialisasi akun login awal Owner & Staff
├── supabase/
│   ├── migrations/              # File DDL skema database, RLS policies, & fungsi RPC
│   └── seed.sql                 # Data awal produk standar & Pelanggan Umum (Walk-In)
└── middleware.ts                # Guard autentikasi & isolasi rute RBAC Owner vs Staff
```

---

## 6. Konfigurasi Environment Variables (`.env`)

Salin file `.env.example` menjadi `.env.local` (untuk pengembangan lokal) atau tambahkan variabel berikut pada pengaturan **Environment Variables** di Vercel:

| Nama Variabel | Sifat | Deskripsi |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Publik | URL Project Supabase (`https://<project-ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publik | Anon / Publishable Key dari Supabase API Settings |
| `SUPABASE_SERVICE_ROLE_KEY` | Rahasia (Server) | Service Role Key dari Supabase (diperlukan di server agar Owner dapat membuat/mengelola akun login Staff dari menu `/employees`) |
| `JWT_SECRET` | Rahasia (Server) | String acak minimal 32 karakter untuk penandatanganan token Override Tempo |
| `NEXT_PUBLIC_APP_URL` | Publik | URL aplikasi (misal `http://localhost:3000` atau URL produksi Vercel) |
| `NEXT_PUBLIC_BUSINESS_NAME` | Publik | Nama default pangkalan LPG |
| `NEXT_PUBLIC_BUSINESS_ADDRESS` | Publik | Alamat default pangkalan LPG |
| `NEXT_PUBLIC_BUSINESS_PHONE` | Publik | Nomor telepon default pangkalan LPG |

---

## 7. Panduan Instalasi & Menjalankan Lokal

1. **Instalasi Dependensi:**
   ```bash
   npm install
   ```

2. **Konfigurasi Environment:**
   Salin `.env.example` ke `.env.local` dan lengkapi kredensial Supabase Anda.

3. **Jalankan Migrasi Database & Seed Awal (Jika Database Baru):**
   ```bash
   npm run db:migrate
   npm run db:seed-users
   ```

4. **Jalankan Server Development:**
   ```bash
   npm run dev
   ```
   Buka `http://localhost:3000` di browser.

---

## 8. Panduan Deployment ke Vercel

1. Pastikan repositori telah ter-push ke GitHub (`https://github.com/iannnub/puput-lpg.git`).
2. Buka dashboard [Vercel](https://vercel.com) dan pilih **Add New... -> Project**.
3. Import repositori GitHub **`iannnub/puput-lpg`**.
4. Pada bagian **Environment Variables**, masukkan variabel berikut:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT_SECRET`
   - `NEXT_PUBLIC_BUSINESS_NAME`
   - `NEXT_PUBLIC_BUSINESS_ADDRESS`
   - `NEXT_PUBLIC_BUSINESS_PHONE`
5. Klik **Deploy**. Setelah proses build selesai, login menggunakan akun **Owner** untuk menyelesaikan **Flow 0 (`/onboarding`)** dengan data saldo kas dan stok fisik pangkalan yang sebenarnya.

---

## 9. Perintah Utilitas & Pengujian Otomatis

- `npm run typecheck` — Memeriksa validitas tipe TypeScript di seluruh proyek.
- `npm run lint` — Menjalankan pemeriksaan kode statis ESLint.
- `npm run build` — Membangun bundel produksi Next.js.
- `npm run db:clean` — Membersihkan seluruh data transaksi/pengujian dummy dan mengembalikan status `onboarding_completed = false`.
- `npm run test:race` — Menjalankan simulasi konkurensi 2 sesi paralel pada stok terbatas.
- `npm run test:suite` — Menjalankan pengujian integrasi end-to-end seluruh RPC database.
