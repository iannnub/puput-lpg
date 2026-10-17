-- ============================================================================
-- 02. DATABASE SCHEMA AND SUPABASE RPC (PostgreSQL 15/16)
-- Total: 18 Tabel + 6 Helper Functions + 16 RPC Functions + 2 Private Buckets
-- ============================================================================

-- 1. EXTENSIONS & TIMEZONE HELPER
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Helper 1: Tanggal Hari Ini dalam Zona Waktu WIB (Asia/Jakarta)
CREATE OR REPLACE FUNCTION public.wib_today()
RETURNS DATE
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE;
$$;

COMMENT ON FUNCTION public.wib_today IS 'Mengembalikan tanggal hari ini sesuai zona waktu Asia/Jakarta (WIB)';

-- ============================================================================
-- 2. DDL SQL - CREATE TABLES (18 TABEL SESUAI URUTAN DEPENDENSI FK)
-- ============================================================================

-- 3.1 Table: app_settings
CREATE TABLE IF NOT EXISTS public.app_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  business_name TEXT NOT NULL DEFAULT 'Pangkalan LPG',
  business_address TEXT NOT NULL DEFAULT '-',
  business_phone VARCHAR(30) NOT NULL DEFAULT '-',
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_completed_at TIMESTAMPTZ,
  onboarding_completed_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.app_settings (id, business_name, onboarding_completed)
VALUES (1, 'Pangkalan LPG', FALSE)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.app_settings IS 'Pengaturan global aplikasi (singleton id=1) dan kunci status onboarding satu kali';

-- 3.2 Table: users
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'staff')),
  full_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

COMMENT ON TABLE public.users IS 'Profil user yang terhubung 1:1 dengan auth.users untuk RBAC';

-- Helper 2: Ambil role user yang sedang login
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid() AND is_active = TRUE;
$$;

-- Helper 3: Cek apakah pemanggil adalah Owner aktif
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.get_my_role() = 'owner', FALSE);
$$;

-- Helper 4: Cek apakah pemanggil adalah Staff atau Owner aktif
CREATE OR REPLACE FUNCTION public.is_staff_or_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.get_my_role() IN ('owner', 'staff'), FALSE);
$$;

-- 3.3 Table: products
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  buy_price BIGINT NOT NULL CHECK (buy_price >= 0),
  sell_price BIGINT NOT NULL CHECK (sell_price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active);

-- 3.4 Table: mitras
CREATE TABLE IF NOT EXISTS public.mitras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  credit_limit BIGINT NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  max_pending_invoices INT NOT NULL DEFAULT 5 CHECK (max_pending_invoices >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mitras_status ON public.mitras(status);
CREATE INDEX IF NOT EXISTS idx_mitras_is_system ON public.mitras(is_system);

-- 3.5 Table: mitra_product_settings
CREATE TABLE IF NOT EXISTS public.mitra_product_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mitra_id UUID NOT NULL REFERENCES public.mitras(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  custom_sell_price BIGINT NOT NULL CHECK (custom_sell_price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(mitra_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_mitra_product_settings_mitra ON public.mitra_product_settings(mitra_id);
CREATE INDEX IF NOT EXISTS idx_mitra_product_settings_product ON public.mitra_product_settings(product_id);

-- 3.6 Table: stocks
CREATE TABLE IF NOT EXISTS public.stocks (
  product_id UUID PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  gudang_isi BIGINT NOT NULL DEFAULT 0 CHECK (gudang_isi >= 0),
  gudang_kosong BIGINT NOT NULL DEFAULT 0 CHECK (gudang_kosong >= 0),
  gudang_bocor BIGINT NOT NULL DEFAULT 0 CHECK (gudang_bocor >= 0),
  dipinjam_mitra BIGINT NOT NULL DEFAULT 0 CHECK (dipinjam_mitra >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.trg_init_product_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.stocks (product_id, gudang_isi, gudang_kosong, gudang_bocor, dipinjam_mitra)
  VALUES (NEW.id, 0, 0, 0, 0)
  ON CONFLICT (product_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_product_insert_init_stock ON public.products;
CREATE TRIGGER after_product_insert_init_stock
AFTER INSERT ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.trg_init_product_stock();

-- 3.7 Table: mitra_product_balances
CREATE TABLE IF NOT EXISTS public.mitra_product_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mitra_id UUID NOT NULL REFERENCES public.mitras(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  borrowed_qty BIGINT NOT NULL DEFAULT 0 CHECK (borrowed_qty >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(mitra_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_mitra_product_balances_mitra ON public.mitra_product_balances(mitra_id);
CREATE INDEX IF NOT EXISTS idx_mitra_product_balances_product ON public.mitra_product_balances(product_id);

-- 3.8 Table: employees (Owner-Only untuk Melindungi Privasi Gaji)
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position VARCHAR(50) NOT NULL,
  base_salary BIGINT NOT NULL DEFAULT 0 CHECK (base_salary >= 0),
  allowance BIGINT NOT NULL DEFAULT 0 CHECK (allowance >= 0),
  bonus_per_tabung BIGINT NOT NULL DEFAULT 0 CHECK (bonus_per_tabung >= 0),
  join_date DATE DEFAULT public.wib_today(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_active ON public.employees(is_active);
CREATE INDEX IF NOT EXISTS idx_employees_position ON public.employees(position);

COMMENT ON TABLE public.employees IS 'Master karyawan (Owner-only RLS). Dropdown supir untuk Staff disediakan via rpc_get_active_drivers() tanpa mengekspos gaji.';

-- 3.9 Table: transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mitra_id UUID NOT NULL REFERENCES public.mitras(id) ON DELETE RESTRICT,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  transaction_date DATE NOT NULL DEFAULT public.wib_today(),
  total_amount BIGINT NOT NULL CHECK (total_amount >= 0),
  total_paid BIGINT NOT NULL DEFAULT 0 CHECK (total_paid >= 0),
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'lunas')),
  due_date DATE,
  driver_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  recipient_name TEXT,
  photo_url TEXT,
  notes TEXT,
  is_legacy BOOLEAN NOT NULL DEFAULT FALSE,
  override_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  override_reason TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  voided_at TIMESTAMPTZ,
  voided_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  void_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_total_paid_not_exceed CHECK (total_paid <= total_amount)
);

CREATE INDEX IF NOT EXISTS idx_transactions_mitra ON public.transactions(mitra_id);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_status ON public.transactions(payment_status);
CREATE INDEX IF NOT EXISTS idx_transactions_due_date ON public.transactions(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_voided ON public.transactions(voided_at);
CREATE INDEX IF NOT EXISTS idx_transactions_legacy ON public.transactions(is_legacy);
CREATE INDEX IF NOT EXISTS idx_transactions_driver ON public.transactions(driver_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(transaction_date);

-- 3.10 Table: transaction_items
CREATE TABLE IF NOT EXISTS public.transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  qty_sent_isi INT NOT NULL CHECK (qty_sent_isi > 0),
  qty_returned_kosong INT NOT NULL DEFAULT 0 CHECK (qty_returned_kosong >= 0 AND qty_returned_kosong <= qty_sent_isi),
  buy_price_snapshot BIGINT NOT NULL CHECK (buy_price_snapshot >= 0),
  sell_price_snapshot BIGINT NOT NULL CHECK (sell_price_snapshot >= 0),
  bonus_snapshot_per_qty BIGINT NOT NULL DEFAULT 0 CHECK (bonus_snapshot_per_qty >= 0),
  subtotal BIGINT NOT NULL CHECK (subtotal >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(transaction_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction ON public.transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_product ON public.transaction_items(product_id);

-- 3.11 Table: payments
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT public.wib_today(),
  method VARCHAR(20) NOT NULL CHECK (method IN ('tunai_laci', 'transfer_bank')),
  proof_url TEXT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_transaction ON public.payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_method ON public.payments(method);

-- 3.12 Table: stock_movements
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(30) NOT NULL CHECK (type IN (
    'in_from_supplier', 'out_to_mitra', 'return_from_mitra', 'return_susulan',
    'bocor_gudang', 'bocor_tukar_guling', 'opname', 'void_rollback'
  )),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity BIGINT NOT NULL,
  cost BIGINT CHECK (cost >= 0),
  claimed_warranty BOOLEAN NOT NULL DEFAULT FALSE,
  linked_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  notes TEXT,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON public.stock_movements(type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON public.stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_linked_trx ON public.stock_movements(linked_transaction_id) WHERE linked_transaction_id IS NOT NULL;

-- 3.13 Table: payrolls (Dibuat Sebelum kasbons & kasbon_repayments)
CREATE TABLE IF NOT EXISTS public.payrolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period_month INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INT NOT NULL CHECK (period_year >= 2020),
  base_salary BIGINT NOT NULL CHECK (base_salary >= 0),
  allowance BIGINT NOT NULL DEFAULT 0 CHECK (allowance >= 0),
  bonus_delivery BIGINT NOT NULL DEFAULT 0 CHECK (bonus_delivery >= 0),
  bonus_extra BIGINT NOT NULL DEFAULT 0 CHECK (bonus_extra >= 0),
  deduction_absence BIGINT NOT NULL DEFAULT 0 CHECK (deduction_absence >= 0),
  deduction_kasbon BIGINT NOT NULL DEFAULT 0 CHECK (deduction_kasbon >= 0),
  deduction_other BIGINT NOT NULL DEFAULT 0 CHECK (deduction_other >= 0),
  gross_salary BIGINT NOT NULL CHECK (gross_salary >= 0),
  net_salary BIGINT NOT NULL CHECK (net_salary >= 0),
  paid_source VARCHAR(20) NOT NULL CHECK (paid_source IN ('kas_laci', 'kas_bank')),
  paid_date DATE NOT NULL DEFAULT public.wib_today(),
  slip_pdf_url TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, period_month, period_year)
);

CREATE INDEX IF NOT EXISTS idx_payrolls_employee ON public.payrolls(employee_id);
CREATE INDEX IF NOT EXISTS idx_payrolls_period ON public.payrolls(period_year, period_month);

-- 3.14 Table: kasbons
CREATE TABLE IF NOT EXISTS public.kasbons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL CHECK (amount > 0),
  remaining_amount BIGINT NOT NULL CHECK (remaining_amount >= 0),
  kasbon_date DATE NOT NULL DEFAULT public.wib_today(),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_kasbon_remaining CHECK (remaining_amount <= amount)
);

CREATE INDEX IF NOT EXISTS idx_kasbons_employee ON public.kasbons(employee_id);
CREATE INDEX IF NOT EXISTS idx_kasbons_unpaid ON public.kasbons(employee_id, kasbon_date) WHERE remaining_amount > 0;

-- 3.15 Table: kasbon_repayments
CREATE TABLE IF NOT EXISTS public.kasbon_repayments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kasbon_id UUID NOT NULL REFERENCES public.kasbons(id) ON DELETE CASCADE,
  payroll_id UUID NOT NULL REFERENCES public.payrolls(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kasbon_repayments_kasbon ON public.kasbon_repayments(kasbon_id);
CREATE INDEX IF NOT EXISTS idx_kasbon_repayments_payroll ON public.kasbon_repayments(payroll_id);

-- 3.16 Table: cashflows & Helper Saldo Kas (Internal vs Owner-Only)
CREATE TABLE IF NOT EXISTS public.cashflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(30) NOT NULL CHECK (type IN (
    'initial_balance', 'in_sale', 'in_payment', 'out_supplier', 'out_salary',
    'out_kasbon', 'out_operational', 'out_void_refund', 'transfer'
  )),
  amount BIGINT NOT NULL CHECK (amount > 0),
  direction VARCHAR(3) NOT NULL CHECK (direction IN ('in', 'out')),
  source VARCHAR(20) NOT NULL CHECK (source IN ('kas_laci', 'kas_bank')),
  transfer_group_id UUID,
  description TEXT NOT NULL,
  reference_id UUID,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cashflows_type ON public.cashflows(type);
CREATE INDEX IF NOT EXISTS idx_cashflows_source ON public.cashflows(source);
CREATE INDEX IF NOT EXISTS idx_cashflows_direction ON public.cashflows(direction);
CREATE INDEX IF NOT EXISTS idx_cashflows_date ON public.cashflows(created_at);
CREATE INDEX IF NOT EXISTS idx_cashflows_transfer_group ON public.cashflows(transfer_group_id) WHERE transfer_group_id IS NOT NULL;

-- Helper 5 (Internal Only - REVOKE dari semua role client)
CREATE OR REPLACE FUNCTION public._internal_get_cash_balance(p_source VARCHAR(20))
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END),
    0
  )::BIGINT
  FROM public.cashflows
  WHERE source = p_source;
$$;

-- Helper 6 (Publik Khusus Owner)
CREATE OR REPLACE FUNCTION public.get_cash_balance(p_source VARCHAR(20))
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Unauthorized: Hanya Owner yang dapat melihat saldo kas';
  END IF;
  RETURN public._internal_get_cash_balance(p_source);
END;
$$;

-- 3.17 Table: audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  target_table VARCHAR(50),
  target_id UUID,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON public.audit_logs(target_table, target_id);

-- 3.18 Table: invoice_counters
CREATE TABLE IF NOT EXISTS public.invoice_counters (
  date DATE PRIMARY KEY,
  counter INT NOT NULL DEFAULT 0 CHECK (counter >= 0)
);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) & STORAGE POLICIES
-- ============================================================================

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mitras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mitra_product_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mitra_product_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payrolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kasbons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kasbon_repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;

-- 1. app_settings
DROP POLICY IF EXISTS "Read app_settings" ON public.app_settings;
CREATE POLICY "Read app_settings" ON public.app_settings
  FOR SELECT USING (public.is_staff_or_owner());

DROP POLICY IF EXISTS "Owner update app_settings" ON public.app_settings;
CREATE POLICY "Owner update app_settings" ON public.app_settings
  FOR UPDATE USING (public.is_owner()) WITH CHECK (public.is_owner());

-- 2. users
DROP POLICY IF EXISTS "Users read own profile" ON public.users;
CREATE POLICY "Users read own profile" ON public.users
  FOR SELECT USING (id = auth.uid() OR public.is_owner());

DROP POLICY IF EXISTS "Owner manage users" ON public.users;
CREATE POLICY "Owner manage users" ON public.users
  FOR ALL USING (public.is_owner()) WITH CHECK (public.is_owner());

-- 3. products
DROP POLICY IF EXISTS "Read products" ON public.products;
CREATE POLICY "Read products" ON public.products
  FOR SELECT USING (public.is_staff_or_owner());

DROP POLICY IF EXISTS "Owner manage products" ON public.products;
CREATE POLICY "Owner manage products" ON public.products
  FOR ALL USING (public.is_owner()) WITH CHECK (public.is_owner());

-- 4. mitras
DROP POLICY IF EXISTS "Read mitras" ON public.mitras;
CREATE POLICY "Read mitras" ON public.mitras
  FOR SELECT USING (public.is_staff_or_owner());

DROP POLICY IF EXISTS "Owner insert mitras" ON public.mitras;
CREATE POLICY "Owner insert mitras" ON public.mitras
  FOR INSERT WITH CHECK (public.is_owner() AND is_system = FALSE);

DROP POLICY IF EXISTS "Owner update mitras" ON public.mitras;
CREATE POLICY "Owner update mitras" ON public.mitras
  FOR UPDATE USING (public.is_owner() AND is_system = FALSE)
  WITH CHECK (public.is_owner() AND is_system = FALSE);

DROP POLICY IF EXISTS "Owner delete non-system mitras" ON public.mitras;
CREATE POLICY "Owner delete non-system mitras" ON public.mitras
  FOR DELETE USING (public.is_owner() AND is_system = FALSE);

-- 5. mitra_product_settings
DROP POLICY IF EXISTS "Read mitra_product_settings" ON public.mitra_product_settings;
CREATE POLICY "Read mitra_product_settings" ON public.mitra_product_settings
  FOR SELECT USING (public.is_staff_or_owner());

DROP POLICY IF EXISTS "Owner manage mitra_product_settings" ON public.mitra_product_settings;
CREATE POLICY "Owner manage mitra_product_settings" ON public.mitra_product_settings
  FOR ALL USING (public.is_owner()) WITH CHECK (public.is_owner());

-- 6. employees (OWNER-ONLY)
DROP POLICY IF EXISTS "Owner manage employees" ON public.employees;
CREATE POLICY "Owner manage employees" ON public.employees
  FOR ALL USING (public.is_owner()) WITH CHECK (public.is_owner());

-- 7. Tabel Operasional & Ledger (READ-ONLY dari REST API; semua mutasi via RPC)
DROP POLICY IF EXISTS "Read stocks" ON public.stocks;
CREATE POLICY "Read stocks" ON public.stocks
  FOR SELECT USING (public.is_staff_or_owner());

DROP POLICY IF EXISTS "Read mitra_product_balances" ON public.mitra_product_balances;
CREATE POLICY "Read mitra_product_balances" ON public.mitra_product_balances
  FOR SELECT USING (public.is_staff_or_owner());

DROP POLICY IF EXISTS "Read transactions" ON public.transactions;
CREATE POLICY "Read transactions" ON public.transactions
  FOR SELECT USING (public.is_staff_or_owner());

DROP POLICY IF EXISTS "Read transaction_items" ON public.transaction_items;
CREATE POLICY "Read transaction_items" ON public.transaction_items
  FOR SELECT USING (public.is_staff_or_owner());

DROP POLICY IF EXISTS "Read payments" ON public.payments;
CREATE POLICY "Read payments" ON public.payments
  FOR SELECT USING (public.is_staff_or_owner());

DROP POLICY IF EXISTS "Read stock_movements" ON public.stock_movements;
CREATE POLICY "Read stock_movements" ON public.stock_movements
  FOR SELECT USING (public.is_staff_or_owner());

-- 8. Tabel Keuangan & Audit (READ-ONLY khusus Owner)
DROP POLICY IF EXISTS "Owner read payrolls" ON public.payrolls;
CREATE POLICY "Owner read payrolls" ON public.payrolls
  FOR SELECT USING (public.is_owner());

DROP POLICY IF EXISTS "Owner read kasbons" ON public.kasbons;
CREATE POLICY "Owner read kasbons" ON public.kasbons
  FOR SELECT USING (public.is_owner());

DROP POLICY IF EXISTS "Owner read kasbon_repayments" ON public.kasbon_repayments;
CREATE POLICY "Owner read kasbon_repayments" ON public.kasbon_repayments
  FOR SELECT USING (public.is_owner());

DROP POLICY IF EXISTS "Owner read cashflows" ON public.cashflows;
CREATE POLICY "Owner read cashflows" ON public.cashflows
  FOR SELECT USING (public.is_owner());

DROP POLICY IF EXISTS "Owner read audit_logs" ON public.audit_logs;
CREATE POLICY "Owner read audit_logs" ON public.audit_logs
  FOR SELECT USING (public.is_owner());

-- 4.3 Supabase Storage Buckets & Policies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('transaction-proofs', 'transaction-proofs', FALSE, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png']),
  ('payment-proofs', 'payment-proofs', FALSE, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE
SET public = FALSE,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'image/png'];

DROP POLICY IF EXISTS "Staff and owner read proofs" ON storage.objects;
CREATE POLICY "Staff and owner read proofs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('transaction-proofs', 'payment-proofs')
    AND public.is_staff_or_owner()
  );

DROP POLICY IF EXISTS "Staff and owner upload proofs" ON storage.objects;
CREATE POLICY "Staff and owner upload proofs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('transaction-proofs', 'payment-proofs')
    AND public.is_staff_or_owner()
  );

DROP POLICY IF EXISTS "Owner delete proofs" ON storage.objects;
CREATE POLICY "Owner delete proofs" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('transaction-proofs', 'payment-proofs')
    AND public.is_owner()
  );

-- ============================================================================
-- 5. RPC FUNCTIONS (16 FUNCTIONS)
-- ============================================================================

-- 5.1 RPC Internal: rpc_generate_invoice_number
CREATE OR REPLACE FUNCTION public.rpc_generate_invoice_number(p_date DATE DEFAULT public.wib_today())
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_counter INT;
BEGIN
  INSERT INTO public.invoice_counters (date, counter)
  VALUES (p_date, 0)
  ON CONFLICT (date) DO NOTHING;

  UPDATE public.invoice_counters
  SET counter = counter + 1
  WHERE date = p_date
  RETURNING counter INTO v_counter;

  RETURN 'INV-' || TO_CHAR(p_date, 'YYYYMMDD') || '-' || LPAD(v_counter::TEXT, 3, '0');
END;
$$;

-- 5.2 RPC Dropdown Supir: rpc_get_active_drivers
CREATE OR REPLACE FUNCTION public.rpc_get_active_drivers()
RETURNS TABLE (
  id UUID,
  name TEXT,
  "position" VARCHAR(50)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff_or_owner() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT e.id, e.name, e.position
  FROM public.employees e
  WHERE e.is_active = TRUE
  ORDER BY e.name ASC;
END;
$$;

-- 5.3 RPC Flow 0: rpc_onboarding_setup
CREATE OR REPLACE FUNCTION public.rpc_onboarding_setup(
  p_kas_laci BIGINT,
  p_kas_bank BIGINT,
  p_tanggal DATE,
  p_stok_awal JSONB,
  p_piutang_lama JSONB,
  p_catatan TEXT DEFAULT ''
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_done BOOLEAN;
  v_stok JSONB;
  v_piutang JSONB;
  v_tabung JSONB;
  v_product_id UUID;
  v_mitra_id UUID;
  v_isi INT;
  v_kosong INT;
  v_bocor INT;
  v_hutang BIGINT;
  v_due_date DATE;
  v_qty INT;
  v_leg_seq INT := 0;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Unauthorized: Hanya Owner yang dapat menjalankan setup awal';
  END IF;

  SELECT onboarding_completed INTO v_done
  FROM public.app_settings
  WHERE id = 1
  FOR UPDATE;

  IF v_done THEN
    RAISE EXCEPTION 'Setup awal (Onboarding) sudah pernah diselesaikan dan tidak dapat dijalankan ulang';
  END IF;

  IF p_kas_laci < 0 OR p_kas_bank < 0 THEN
    RAISE EXCEPTION 'Saldo kas awal tidak boleh negatif';
  END IF;

  IF p_kas_laci > 0 THEN
    INSERT INTO public.cashflows (type, amount, direction, source, description, created_by)
    VALUES ('initial_balance', p_kas_laci, 'in', 'kas_laci', 'Saldo kas laci awal (' || COALESCE(p_tanggal, public.wib_today()) || '): ' || COALESCE(p_catatan, ''), v_user_id);
  END IF;

  IF p_kas_bank > 0 THEN
    INSERT INTO public.cashflows (type, amount, direction, source, description, created_by)
    VALUES ('initial_balance', p_kas_bank, 'in', 'kas_bank', 'Saldo kas bank awal (' || COALESCE(p_tanggal, public.wib_today()) || '): ' || COALESCE(p_catatan, ''), v_user_id);
  END IF;

  FOR v_stok IN SELECT * FROM jsonb_array_elements(COALESCE(p_stok_awal, '[]'::JSONB))
  LOOP
    v_product_id := (v_stok->>'product_id')::UUID;
    v_isi := COALESCE((v_stok->>'isi')::INT, 0);
    v_kosong := COALESCE((v_stok->>'kosong')::INT, 0);
    v_bocor := COALESCE((v_stok->>'bocor')::INT, 0);

    IF v_isi < 0 OR v_kosong < 0 OR v_bocor < 0 THEN
      RAISE EXCEPTION 'Jumlah stok awal tidak boleh negatif';
    END IF;

    UPDATE public.stocks
    SET gudang_isi = v_isi,
        gudang_kosong = v_kosong,
        gudang_bocor = v_bocor,
        updated_at = NOW()
    WHERE product_id = v_product_id;

    INSERT INTO public.stock_movements (type, product_id, quantity, cost, notes, user_id)
    VALUES (
      'opname', v_product_id, v_isi + v_kosong + v_bocor, 0,
      'Stok awal onboarding: Isi=' || v_isi || ', Kosong=' || v_kosong || ', Bocor=' || v_bocor || '. ' || COALESCE(p_catatan, ''),
      v_user_id
    );
  END LOOP;

  FOR v_piutang IN SELECT * FROM jsonb_array_elements(COALESCE(p_piutang_lama, '[]'::JSONB))
  LOOP
    v_mitra_id := (v_piutang->>'mitra_id')::UUID;
    v_hutang := COALESCE((v_piutang->>'hutang_uang')::BIGINT, 0);
    v_due_date := COALESCE((v_piutang->>'due_date')::DATE, public.wib_today());

    IF v_hutang > 0 THEN
      v_leg_seq := v_leg_seq + 1;
      INSERT INTO public.transactions (
        mitra_id, invoice_number, transaction_date, total_amount, total_paid,
        payment_status, due_date, recipient_name, notes, is_legacy, created_by
      ) VALUES (
        v_mitra_id,
        'LEGACY-' || TO_CHAR(COALESCE(p_tanggal, public.wib_today()), 'YYYYMMDD') || '-' || LPAD(v_leg_seq::TEXT, 3, '0'),
        COALESCE(p_tanggal, public.wib_today()),
        v_hutang, 0, 'pending', v_due_date, 'Migrasi Data Lama',
        'Piutang lama migrasi: ' || COALESCE(v_piutang->>'catatan', ''),
        TRUE, v_user_id
      );
    END IF;

    FOR v_tabung IN SELECT * FROM jsonb_array_elements(COALESCE(v_piutang->'tabung', '[]'::JSONB))
    LOOP
      v_product_id := (v_tabung->>'product_id')::UUID;
      v_qty := COALESCE((v_tabung->>'qty')::INT, 0);

      IF v_qty > 0 THEN
        INSERT INTO public.mitra_product_balances (mitra_id, product_id, borrowed_qty)
        VALUES (v_mitra_id, v_product_id, v_qty)
        ON CONFLICT (mitra_id, product_id)
        DO UPDATE SET borrowed_qty = public.mitra_product_balances.borrowed_qty + EXCLUDED.borrowed_qty,
                      updated_at = NOW();

        UPDATE public.stocks
        SET dipinjam_mitra = dipinjam_mitra + v_qty,
            updated_at = NOW()
        WHERE product_id = v_product_id;
      END IF;
    END LOOP;
  END LOOP;

  UPDATE public.app_settings
  SET onboarding_completed = TRUE,
      onboarding_completed_at = NOW(),
      onboarding_completed_by = v_user_id,
      updated_at = NOW()
  WHERE id = 1;

  INSERT INTO public.audit_logs (user_id, action, target_table, reason)
  VALUES (v_user_id, 'onboarding_setup', 'app_settings', COALESCE(p_catatan, 'Initial onboarding setup'));
END;
$$;

-- 5.4 RPC Flow 4: rpc_create_transaction_sale
CREATE OR REPLACE FUNCTION public.rpc_create_transaction_sale(
  p_mitra_id UUID,
  p_driver_id UUID,
  p_items JSONB,
  p_payment_method VARCHAR(20),
  p_dp_amount BIGINT DEFAULT 0,
  p_dp_method VARCHAR(20) DEFAULT 'tunai_laci',
  p_due_date DATE DEFAULT NULL,
  p_transaction_date DATE DEFAULT NULL,
  p_recipient_name TEXT DEFAULT NULL,
  p_photo_url TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_override_token TEXT DEFAULT NULL,
  p_override_reason TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_role TEXT := public.get_my_role();
  v_today DATE := public.wib_today();
  v_trx_date DATE := COALESCE(p_transaction_date, public.wib_today());
  v_mitra RECORD;
  v_driver_bonus BIGINT := 0;
  v_invoice_number TEXT;
  v_transaction_id UUID;
  v_total_amount BIGINT := 0;
  v_total_paid BIGINT := 0;
  v_payment_status VARCHAR(20);
  v_pay_method VARCHAR(20);
  v_cash_source VARCHAR(20);
  v_overdue_count INT := 0;
  v_pending_count INT := 0;
  v_current_piutang BIGINT := 0;
  v_override_by UUID := NULL;
  v_override_log_id UUID := NULL;
  v_agg RECORD;
  v_stock RECORD;
  v_product RECORD;
BEGIN
  IF v_user_role NOT IN ('owner', 'staff') THEN
    RAISE EXCEPTION 'Unauthorized: Hanya Owner atau Staff yang dapat membuat transaksi';
  END IF;

  -- 1. Validasi Tanggal Transaksi
  IF v_trx_date > v_today THEN
    RAISE EXCEPTION 'Tanggal transaksi tidak boleh di masa depan (% > %)', v_trx_date, v_today;
  END IF;

  IF v_user_role = 'staff' AND v_trx_date < (v_today - 3) THEN
    RAISE EXCEPTION 'Staff hanya dapat menginput transaksi maksimal 3 hari ke belakang. Hubungi Owner untuk transaksi tanggal lampau.';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Daftar barang transaksi tidak boleh kosong';
  END IF;

  IF p_payment_method NOT IN ('lunas_tunai_laci', 'lunas_transfer_bank', 'tempo', 'tempo_with_dp') THEN
    RAISE EXCEPTION 'Metode pembayaran tidak valid';
  END IF;

  -- 2. Lock baris mitra
  SELECT * INTO v_mitra FROM public.mitras WHERE id = p_mitra_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mitra tidak ditemukan';
  END IF;

  IF v_mitra.status = 'blocked' THEN
    RAISE EXCEPTION 'Mitra % sedang diblokir dan tidak dapat bertransaksi', v_mitra.name;
  END IF;

  IF v_mitra.is_system AND p_payment_method IN ('tempo', 'tempo_with_dp') THEN
    RAISE EXCEPTION 'Pelanggan Umum (Walk-In) wajib menggunakan pembayaran Lunas';
  END IF;

  -- 3. Validasi Supir & Cek Apakah Payroll Periode Tanggal Transaksi Sudah Ditutup
  IF p_driver_id IS NOT NULL THEN
    SELECT bonus_per_tabung INTO v_driver_bonus
    FROM public.employees
    WHERE id = p_driver_id AND is_active = TRUE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Supir tidak ditemukan atau sudah tidak aktif';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.payrolls
      WHERE employee_id = p_driver_id
        AND period_month = EXTRACT(MONTH FROM v_trx_date)::INT
        AND period_year = EXTRACT(YEAR FROM v_trx_date)::INT
    ) THEN
      RAISE EXCEPTION 'Gaji supir untuk periode %/% sudah diproses. Transaksi tidak dapat ditambahkan ke periode tersebut.',
        EXTRACT(MONTH FROM v_trx_date)::INT, EXTRACT(YEAR FROM v_trx_date)::INT;
    END IF;
  END IF;

  -- 4. Agregasi item per product_id & lock stocks berurutan
  FOR v_agg IN
    SELECT
      (elem->>'product_id')::UUID AS product_id,
      SUM((elem->>'qty_sent_isi')::INT)::INT AS qty_sent,
      SUM(COALESCE((elem->>'qty_returned_kosong')::INT, 0))::INT AS qty_returned,
      MAX((elem->>'sell_price')::BIGINT)::BIGINT AS sell_price,
      COUNT(*) AS row_count
    FROM jsonb_array_elements(p_items) AS elem
    GROUP BY (elem->>'product_id')::UUID
    ORDER BY (elem->>'product_id')::UUID
  LOOP
    IF v_agg.row_count > 1 THEN
      RAISE EXCEPTION 'Produk tidak boleh duplikat dalam satu transaksi yang sama';
    END IF;

    IF v_agg.qty_sent <= 0 THEN
      RAISE EXCEPTION 'Jumlah kirim isi harus lebih dari 0';
    END IF;

    IF v_agg.qty_returned < 0 OR v_agg.qty_returned > v_agg.qty_sent THEN
      RAISE EXCEPTION 'Jumlah kembali kosong harus antara 0 dan jumlah kirim isi';
    END IF;

    IF v_mitra.is_system AND v_agg.qty_returned != v_agg.qty_sent THEN
      RAISE EXCEPTION 'Pelanggan Umum (Walk-In) wajib mengembalikan tabung kosong sejumlah yang dikirim';
    END IF;

    IF v_agg.sell_price < 0 THEN
      RAISE EXCEPTION 'Harga jual tidak boleh negatif';
    END IF;

    SELECT * INTO v_product FROM public.products WHERE id = v_agg.product_id;
    IF NOT FOUND OR NOT v_product.is_active THEN
      RAISE EXCEPTION 'Produk tidak ditemukan atau sudah dinonaktifkan';
    END IF;

    SELECT * INTO v_stock FROM public.stocks WHERE product_id = v_agg.product_id FOR UPDATE;
    IF v_stock.gudang_isi < v_agg.qty_sent THEN
      RAISE EXCEPTION 'Stok % tidak cukup (tersedia: %, diminta: %)',
        v_product.name, v_stock.gudang_isi, v_agg.qty_sent;
    END IF;

    v_total_amount := v_total_amount + (v_agg.qty_sent * v_agg.sell_price);
  END LOOP;

  -- 5. Tentukan status pembayaran
  IF p_payment_method IN ('lunas_tunai_laci', 'lunas_transfer_bank') THEN
    v_payment_status := 'lunas';
    v_total_paid := v_total_amount;
  ELSIF p_payment_method = 'tempo_with_dp' THEN
    IF p_dp_amount <= 0 OR p_dp_amount >= v_total_amount THEN
      RAISE EXCEPTION 'Nominal DP harus lebih dari 0 dan kurang dari total tagihan';
    END IF;
    IF p_dp_method NOT IN ('tunai_laci', 'transfer_bank') THEN
      RAISE EXCEPTION 'Metode pembayaran DP tidak valid';
    END IF;
    v_payment_status := 'partial';
    v_total_paid := p_dp_amount;
  ELSE
    v_payment_status := 'pending';
    v_total_paid := 0;
  END IF;

  -- 6. Validasi Tempo (Overdue, Credit Limit, Max Pending Invoices) & Override Token
  IF p_payment_method IN ('tempo', 'tempo_with_dp') THEN
    IF p_due_date IS NULL THEN
      RAISE EXCEPTION 'Tanggal jatuh tempo wajib diisi untuk transaksi Tempo';
    END IF;

    SELECT
      COUNT(*) FILTER (WHERE due_date < v_today),
      COUNT(*),
      COALESCE(SUM(total_amount - total_paid), 0)
    INTO v_overdue_count, v_pending_count, v_current_piutang
    FROM public.transactions
    WHERE mitra_id = p_mitra_id
      AND payment_status != 'lunas'
      AND voided_at IS NULL;

    IF v_overdue_count > 0
       OR (v_current_piutang + (v_total_amount - v_total_paid)) > v_mitra.credit_limit
       OR v_pending_count >= v_mitra.max_pending_invoices
    THEN
      IF v_user_role = 'owner' AND COALESCE(TRIM(p_override_reason), '') != '' THEN
        v_override_by := v_user_id;
      ELSIF p_override_token IS NOT NULL THEN
        SELECT id, user_id INTO v_override_log_id, v_override_by
        FROM public.audit_logs
        WHERE action = 'issue_override_token'
          AND target_table = 'mitras'
          AND target_id = p_mitra_id
          AND (new_value->>'requested_by')::UUID = v_user_id
          AND (new_value->>'used')::BOOLEAN = FALSE
          AND (new_value->>'expires_at')::TIMESTAMPTZ > NOW()
          AND (new_value->>'token_hash') = encode(extensions.digest(p_override_token::text, 'sha256'::text), 'hex')
        FOR UPDATE;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Token override Owner tidak valid, bukan milik sesi Anda, atau sudah kedaluwarsa';
        END IF;

        UPDATE public.audit_logs
        SET new_value = jsonb_set(new_value, '{used}', 'true'::JSONB)
        WHERE id = v_override_log_id;
      ELSE
        IF v_overdue_count > 0 THEN
          RAISE EXCEPTION 'Mitra memiliki % nota jatuh tempo (overdue). Butuh otorisasi Override Owner.', v_overdue_count;
        ELSIF (v_current_piutang + (v_total_amount - v_total_paid)) > v_mitra.credit_limit THEN
          RAISE EXCEPTION 'Transaksi melebihi limit kredit mitra (Sisa limit: Rp %). Butuh otorisasi Override Owner.',
            (v_mitra.credit_limit - v_current_piutang);
        ELSE
          RAISE EXCEPTION 'Mitra sudah mencapai batas maksimal % nota gantung. Butuh otorisasi Override Owner.',
            v_mitra.max_pending_invoices;
        END IF;
      END IF;
    END IF;
  END IF;

  -- 7. Generate nomor invoice & insert transaksi
  v_invoice_number := public.rpc_generate_invoice_number(v_trx_date);

  INSERT INTO public.transactions (
    mitra_id, invoice_number, transaction_date, total_amount, total_paid,
    payment_status, due_date, driver_id, recipient_name, photo_url, notes,
    override_by, override_reason, created_by
  ) VALUES (
    p_mitra_id, v_invoice_number, v_trx_date, v_total_amount, v_total_paid,
    v_payment_status, CASE WHEN p_payment_method IN ('tempo', 'tempo_with_dp') THEN p_due_date ELSE NULL END,
    p_driver_id, p_recipient_name, p_photo_url, p_notes,
    v_override_by, p_override_reason, v_user_id
  ) RETURNING id INTO v_transaction_id;

  -- 8. Insert items & update stocks
  FOR v_agg IN
    SELECT
      (elem->>'product_id')::UUID AS product_id,
      (elem->>'qty_sent_isi')::INT AS qty_sent,
      COALESCE((elem->>'qty_returned_kosong')::INT, 0) AS qty_returned,
      (elem->>'sell_price')::BIGINT AS sell_price
    FROM jsonb_array_elements(p_items) AS elem
    ORDER BY (elem->>'product_id')::UUID
  LOOP
    SELECT * INTO v_product FROM public.products WHERE id = v_agg.product_id;

    INSERT INTO public.transaction_items (
      transaction_id, product_id, qty_sent_isi, qty_returned_kosong,
      buy_price_snapshot, sell_price_snapshot, bonus_snapshot_per_qty, subtotal
    ) VALUES (
      v_transaction_id, v_agg.product_id, v_agg.qty_sent, v_agg.qty_returned,
      v_product.buy_price, v_agg.sell_price, v_driver_bonus, (v_agg.qty_sent * v_agg.sell_price)
    );

    UPDATE public.stocks
    SET gudang_isi = gudang_isi - v_agg.qty_sent,
        gudang_kosong = gudang_kosong + v_agg.qty_returned,
        dipinjam_mitra = dipinjam_mitra + (v_agg.qty_sent - v_agg.qty_returned),
        updated_at = NOW()
    WHERE product_id = v_agg.product_id;

    IF (v_agg.qty_sent - v_agg.qty_returned) > 0 THEN
      INSERT INTO public.mitra_product_balances (mitra_id, product_id, borrowed_qty)
      VALUES (p_mitra_id, v_agg.product_id, v_agg.qty_sent - v_agg.qty_returned)
      ON CONFLICT (mitra_id, product_id)
      DO UPDATE SET borrowed_qty = public.mitra_product_balances.borrowed_qty + EXCLUDED.borrowed_qty,
                    updated_at = NOW();
    END IF;

    INSERT INTO public.stock_movements (
      type, product_id, quantity, linked_transaction_id, notes, user_id
    ) VALUES (
      'out_to_mitra', v_agg.product_id, -v_agg.qty_sent, v_transaction_id,
      'Kirim isi ke ' || v_mitra.name || ' (' || v_invoice_number || ')', v_user_id
    );

    IF v_agg.qty_returned > 0 THEN
      INSERT INTO public.stock_movements (
        type, product_id, quantity, linked_transaction_id, notes, user_id
      ) VALUES (
        'return_from_mitra', v_agg.product_id, v_agg.qty_returned, v_transaction_id,
        'Terima tabung kosong saat pengiriman dari ' || v_mitra.name || ' (' || v_invoice_number || ')', v_user_id
      );
    END IF;
  END LOOP;

  -- 9. Catat payments & cashflows (Lunas maupun DP Tempo)
  IF v_total_paid > 0 THEN
    v_pay_method := CASE
      WHEN p_payment_method = 'lunas_tunai_laci' THEN 'tunai_laci'
      WHEN p_payment_method = 'lunas_transfer_bank' THEN 'transfer_bank'
      ELSE p_dp_method
    END;

    v_cash_source := CASE
      WHEN v_pay_method = 'tunai_laci' THEN 'kas_laci'
      ELSE 'kas_bank'
    END;

    INSERT INTO public.payments (
      transaction_id, amount, payment_date, method, notes, created_by
    ) VALUES (
      v_transaction_id, v_total_paid, v_trx_date, v_pay_method,
      CASE WHEN p_payment_method = 'tempo_with_dp' THEN 'DP Transaksi ' || v_invoice_number ELSE 'Pelunasan ' || v_invoice_number END,
      v_user_id
    );

    INSERT INTO public.cashflows (
      type, amount, direction, source, description, reference_id, created_by
    ) VALUES (
      'in_sale', v_total_paid, 'in', v_cash_source,
      CASE WHEN p_payment_method = 'tempo_with_dp' THEN 'Uang muka (DP) penjualan: ' || v_invoice_number ELSE 'Penjualan lunas: ' || v_invoice_number END,
      v_transaction_id, v_user_id
    );
  END IF;

  IF v_override_by IS NOT NULL THEN
    INSERT INTO public.audit_logs (
      user_id, action, target_table, target_id, reason, new_value
    ) VALUES (
      v_override_by, 'override_tempo', 'transactions', v_transaction_id,
      COALESCE(p_override_reason, 'Override tempo disetujui Owner'),
      jsonb_build_object('invoice_number', v_invoice_number, 'created_by', v_user_id, 'overdue_count', v_overdue_count)
    );
  END IF;

  RETURN v_transaction_id;
END;
$$;

-- 5.5 RPC Flow 3: rpc_restock_from_supplier
CREATE OR REPLACE FUNCTION public.rpc_restock_from_supplier(
  p_product_id UUID,
  p_qty_isi_datang INT,
  p_qty_kosong_diserahkan INT,
  p_qty_bocor_retur INT,
  p_bocor_klaim_garansi BOOLEAN,
  p_source VARCHAR(20),
  p_notes TEXT DEFAULT ''
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_owner BOOLEAN := public.is_owner();
  v_product RECORD;
  v_stock RECORD;
  v_total_bayar BIGINT;
  v_cash_balance BIGINT;
BEGIN
  IF NOT public.is_staff_or_owner() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_qty_isi_datang <= 0 OR p_qty_kosong_diserahkan < 0 OR p_qty_bocor_retur < 0 THEN
    RAISE EXCEPTION 'Jumlah tabung tidak valid';
  END IF;

  IF p_bocor_klaim_garansi AND p_qty_bocor_retur > p_qty_isi_datang THEN
    RAISE EXCEPTION 'Jumlah bocor klaim garansi tidak boleh melebihi jumlah tabung isi datang';
  END IF;

  IF p_source NOT IN ('kas_laci', 'kas_bank') THEN
    RAISE EXCEPTION 'Sumber kas harus kas_laci atau kas_bank';
  END IF;

  SELECT * INTO v_product FROM public.products WHERE id = p_product_id;
  IF NOT FOUND OR NOT v_product.is_active THEN
    RAISE EXCEPTION 'Produk tidak ditemukan atau nonaktif';
  END IF;

  SELECT * INTO v_stock FROM public.stocks WHERE product_id = p_product_id FOR UPDATE;
  IF v_stock.gudang_kosong < p_qty_kosong_diserahkan THEN
    RAISE EXCEPTION 'Stok tabung kosong % di gudang tidak cukup (tersedia: %, diserahkan: %)',
      v_product.name, v_stock.gudang_kosong, p_qty_kosong_diserahkan;
  END IF;

  IF v_stock.gudang_bocor < p_qty_bocor_retur THEN
    RAISE EXCEPTION 'Stok tabung bocor % di gudang tidak cukup (tersedia: %, diretur: %)',
      v_product.name, v_stock.gudang_bocor, p_qty_bocor_retur;
  END IF;

  IF p_bocor_klaim_garansi THEN
    v_total_bayar := (p_qty_isi_datang - p_qty_bocor_retur) * v_product.buy_price;
  ELSE
    v_total_bayar := p_qty_isi_datang * v_product.buy_price;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('cashflow_' || p_source));
  v_cash_balance := public._internal_get_cash_balance(p_source);
  IF v_cash_balance < v_total_bayar THEN
    IF v_is_owner THEN
      RAISE EXCEPTION 'Saldo % tidak mencukupi (tersedia: Rp %, dibutuhkan: Rp %)',
        p_source, v_cash_balance, v_total_bayar;
    ELSE
      RAISE EXCEPTION 'Saldo % tidak mencukupi untuk pembayaran restock sebesar Rp %. Hubungi Owner.',
        p_source, v_total_bayar;
    END IF;
  END IF;

  UPDATE public.stocks
  SET gudang_isi = gudang_isi + p_qty_isi_datang,
      gudang_kosong = gudang_kosong - p_qty_kosong_diserahkan,
      gudang_bocor = gudang_bocor - p_qty_bocor_retur,
      updated_at = NOW()
  WHERE product_id = p_product_id;

  INSERT INTO public.stock_movements (
    type, product_id, quantity, cost, claimed_warranty, notes, user_id
  ) VALUES (
    'in_from_supplier', p_product_id, p_qty_isi_datang,
    CASE WHEN p_bocor_klaim_garansi THEN (p_qty_bocor_retur * v_product.buy_price) ELSE 0 END,
    p_bocor_klaim_garansi,
    COALESCE(p_notes, '') || ' | Kosong diserahkan: ' || p_qty_kosong_diserahkan || ' | Bocor retur: ' || p_qty_bocor_retur,
    v_user_id
  );

  IF v_total_bayar > 0 THEN
    INSERT INTO public.cashflows (
      type, amount, direction, source, description, created_by
    ) VALUES (
      'out_supplier', v_total_bayar, 'out', p_source,
      'Tebus gas ' || v_product.name || ' (' || p_qty_isi_datang || ' tabung) dari Pertamina',
      v_user_id
    );
  END IF;

  RETURN v_total_bayar;
END;
$$;

-- 5.6 RPC Flow 3: rpc_report_bocor
CREATE OR REPLACE FUNCTION public.rpc_report_bocor(
  p_product_id UUID,
  p_qty INT,
  p_notes TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_product RECORD;
  v_stock RECORD;
BEGIN
  IF NOT public.is_staff_or_owner() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'Jumlah tabung bocor harus lebih dari 0';
  END IF;

  SELECT * INTO v_product FROM public.products WHERE id = p_product_id;
  SELECT * INTO v_stock FROM public.stocks WHERE product_id = p_product_id FOR UPDATE;

  IF v_stock.gudang_isi < p_qty THEN
    RAISE EXCEPTION 'Stok isi % tidak mencukupi (tersedia: %)', v_product.name, v_stock.gudang_isi;
  END IF;

  UPDATE public.stocks
  SET gudang_isi = gudang_isi - p_qty,
      gudang_bocor = gudang_bocor + p_qty,
      updated_at = NOW()
  WHERE product_id = p_product_id;

  INSERT INTO public.stock_movements (
    type, product_id, quantity, cost, claimed_warranty, notes, user_id
  ) VALUES (
    'bocor_gudang', p_product_id, -p_qty, p_qty * v_product.buy_price, FALSE, p_notes, v_user_id
  );
END;
$$;

-- 5.7 RPC Flow 3: rpc_tukar_guling
CREATE OR REPLACE FUNCTION public.rpc_tukar_guling(
  p_mitra_id UUID,
  p_product_id UUID,
  p_qty INT,
  p_photo_url TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT ''
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_mitra_name TEXT;
  v_product RECORD;
  v_stock RECORD;
BEGIN
  IF NOT public.is_staff_or_owner() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'Jumlah tukar guling harus lebih dari 0';
  END IF;

  SELECT name INTO v_mitra_name FROM public.mitras WHERE id = p_mitra_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mitra tidak ditemukan';
  END IF;

  SELECT * INTO v_product FROM public.products WHERE id = p_product_id;
  SELECT * INTO v_stock FROM public.stocks WHERE product_id = p_product_id FOR UPDATE;

  IF v_stock.gudang_isi < p_qty THEN
    RAISE EXCEPTION 'Stok isi % tidak cukup untuk tukar guling (tersedia: %)', v_product.name, v_stock.gudang_isi;
  END IF;

  UPDATE public.stocks
  SET gudang_isi = gudang_isi - p_qty,
      gudang_bocor = gudang_bocor + p_qty,
      updated_at = NOW()
  WHERE product_id = p_product_id;

  INSERT INTO public.stock_movements (
    type, product_id, quantity, cost, claimed_warranty, notes, user_id
  ) VALUES (
    'bocor_tukar_guling', p_product_id, -p_qty, p_qty * v_product.buy_price, FALSE,
    'Tukar guling mitra ' || v_mitra_name || ': ' || COALESCE(p_notes, '') || COALESCE(' [Foto: ' || p_photo_url || ']', ''),
    v_user_id
  );
END;
$$;

-- 5.8 RPC Flow 3: rpc_stock_opname
CREATE OR REPLACE FUNCTION public.rpc_stock_opname(
  p_items JSONB,
  p_reason TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_item JSONB;
  v_product RECORD;
  v_fisik_isi BIGINT;
  v_fisik_kosong BIGINT;
  v_fisik_bocor BIGINT;
  v_current RECORD;
  v_diff_isi BIGINT;
  v_diff_kosong BIGINT;
  v_diff_bocor BIGINT;
  v_opname_loss BIGINT := 0;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Unauthorized: Hanya Owner yang dapat melakukan Stock Opname';
  END IF;

  IF COALESCE(TRIM(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Alasan stock opname wajib diisi';
  END IF;

  FOR v_item IN
    SELECT * FROM jsonb_array_elements(p_items)
    ORDER BY (value->>'product_id')::UUID
  LOOP
    SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::UUID;
    v_fisik_isi := (v_item->>'fisik_isi')::BIGINT;
    v_fisik_kosong := (v_item->>'fisik_kosong')::BIGINT;
    v_fisik_bocor := (v_item->>'fisik_bocor')::BIGINT;

    IF v_fisik_isi < 0 OR v_fisik_kosong < 0 OR v_fisik_bocor < 0 THEN
      RAISE EXCEPTION 'Stok fisik tidak boleh negatif';
    END IF;

    SELECT * INTO v_current FROM public.stocks WHERE product_id = v_product.id FOR UPDATE;

    v_diff_isi := v_fisik_isi - v_current.gudang_isi;
    v_diff_kosong := v_fisik_kosong - v_current.gudang_kosong;
    v_diff_bocor := v_fisik_bocor - v_current.gudang_bocor;

    IF v_diff_isi != 0 OR v_diff_kosong != 0 OR v_diff_bocor != 0 THEN
      IF (v_diff_isi + GREATEST(v_diff_bocor, 0)) < 0 THEN
        v_opname_loss := ABS(v_diff_isi + GREATEST(v_diff_bocor, 0)) * v_product.buy_price;
      ELSE
        v_opname_loss := 0;
      END IF;

      UPDATE public.stocks
      SET gudang_isi = v_fisik_isi,
          gudang_kosong = v_fisik_kosong,
          gudang_bocor = v_fisik_bocor,
          updated_at = NOW()
      WHERE product_id = v_product.id;

      INSERT INTO public.stock_movements (type, product_id, quantity, cost, notes, user_id)
      VALUES (
        'opname', v_product.id, v_diff_isi + v_diff_kosong + v_diff_bocor, v_opname_loss,
        FORMAT('Opname: Isi %s, Kosong %s, Bocor %s. Alasan: %s', v_diff_isi, v_diff_kosong, v_diff_bocor, p_reason),
        v_user_id
      );

      INSERT INTO public.audit_logs (
        user_id, action, target_table, target_id, old_value, new_value, reason
      ) VALUES (
        v_user_id, 'stock_opname', 'stocks', v_product.id,
        to_jsonb(v_current),
        jsonb_build_object('gudang_isi', v_fisik_isi, 'gudang_kosong', v_fisik_kosong, 'gudang_bocor', v_fisik_bocor, 'opname_loss', v_opname_loss),
        p_reason
      );
    END IF;
  END LOOP;
END;
$$;

-- 5.9 RPC Flow 4: rpc_receive_susulan
CREATE OR REPLACE FUNCTION public.rpc_receive_susulan(
  p_mitra_id UUID,
  p_returns JSONB,
  p_notes TEXT DEFAULT ''
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_mitra_name TEXT;
  v_item JSONB;
  v_product_id UUID;
  v_qty INT;
  v_balance RECORD;
BEGIN
  IF NOT public.is_staff_or_owner() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT name INTO v_mitra_name FROM public.mitras WHERE id = p_mitra_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mitra tidak ditemukan';
  END IF;

  FOR v_item IN
    SELECT * FROM jsonb_array_elements(p_returns)
    ORDER BY (value->>'product_id')::UUID
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := COALESCE((v_item->>'qty')::INT, 0);

    IF v_qty <= 0 THEN
      CONTINUE;
    END IF;

    PERFORM 1 FROM public.stocks WHERE product_id = v_product_id FOR UPDATE;
    SELECT * INTO v_balance
    FROM public.mitra_product_balances
    WHERE mitra_id = p_mitra_id AND product_id = v_product_id
    FOR UPDATE;

    IF NOT FOUND OR v_balance.borrowed_qty < v_qty THEN
      RAISE EXCEPTION 'Jumlah pengembalian melebihi pinjaman tabung mitra saat ini';
    END IF;

    UPDATE public.stocks
    SET gudang_kosong = gudang_kosong + v_qty,
        dipinjam_mitra = dipinjam_mitra - v_qty,
        updated_at = NOW()
    WHERE product_id = v_product_id;

    UPDATE public.mitra_product_balances
    SET borrowed_qty = borrowed_qty - v_qty,
        updated_at = NOW()
    WHERE id = v_balance.id;

    INSERT INTO public.stock_movements (type, product_id, quantity, notes, user_id)
    VALUES ('return_susulan', v_product_id, v_qty, 'Susulan tabung kosong dari ' || v_mitra_name || ': ' || COALESCE(p_notes, ''), v_user_id);
  END LOOP;
END;
$$;

-- 5.10 RPC Flow 4: rpc_pay_receivable
CREATE OR REPLACE FUNCTION public.rpc_pay_receivable(
  p_transaction_id UUID,
  p_amount BIGINT,
  p_payment_date DATE DEFAULT NULL,
  p_method VARCHAR(20) DEFAULT 'tunai_laci',
  p_proof_url TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT ''
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_trx RECORD;
  v_new_paid BIGINT;
  v_new_status VARCHAR(20);
  v_cash_source VARCHAR(20);
  v_payment_id UUID;
BEGIN
  IF NOT public.is_staff_or_owner() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal pembayaran harus lebih dari 0';
  END IF;

  IF p_method NOT IN ('tunai_laci', 'transfer_bank') THEN
    RAISE EXCEPTION 'Metode pembayaran tidak valid';
  END IF;

  SELECT * INTO v_trx FROM public.transactions WHERE id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaksi tidak ditemukan';
  END IF;

  IF v_trx.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'Transaksi yang sudah di-void tidak dapat menerima pembayaran';
  END IF;

  IF v_trx.payment_status = 'lunas' THEN
    RAISE EXCEPTION 'Transaksi ini sudah lunas';
  END IF;

  IF p_amount > (v_trx.total_amount - v_trx.total_paid) THEN
    RAISE EXCEPTION 'Nominal pembayaran melebihi sisa tagihan (Rp %)', (v_trx.total_amount - v_trx.total_paid);
  END IF;

  v_new_paid := v_trx.total_paid + p_amount;
  v_new_status := CASE WHEN v_new_paid = v_trx.total_amount THEN 'lunas' ELSE 'partial' END;
  v_cash_source := CASE WHEN p_method = 'tunai_laci' THEN 'kas_laci' ELSE 'kas_bank' END;

  INSERT INTO public.payments (
    transaction_id, amount, payment_date, method, proof_url, notes, created_by
  ) VALUES (
    p_transaction_id, p_amount, COALESCE(p_payment_date, public.wib_today()), p_method, p_proof_url, p_notes, v_user_id
  ) RETURNING id INTO v_payment_id;

  UPDATE public.transactions
  SET total_paid = v_new_paid,
      payment_status = v_new_status,
      updated_at = NOW()
  WHERE id = p_transaction_id;

  INSERT INTO public.cashflows (
    type, amount, direction, source, description, reference_id, created_by
  ) VALUES (
    'in_payment', p_amount, 'in', v_cash_source,
    'Pembayaran piutang ' || v_trx.invoice_number || ': ' || COALESCE(p_notes, ''),
    p_transaction_id, v_user_id
  );

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'new_status', v_new_status,
    'remaining', v_trx.total_amount - v_new_paid
  );
END;
$$;

-- 5.11 RPC Flow 4: rpc_void_transaction
CREATE OR REPLACE FUNCTION public.rpc_void_transaction(
  p_transaction_id UUID,
  p_void_reason TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_trx RECORD;
  v_item RECORD;
  v_stock RECORD;
  v_balance RECORD;
  v_payment RECORD;
  v_cash_source VARCHAR(20);
  v_cash_balance BIGINT;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Unauthorized: Hanya Owner yang dapat membatalkan (void) transaksi';
  END IF;

  IF COALESCE(TRIM(p_void_reason), '') = '' THEN
    RAISE EXCEPTION 'Alasan void wajib diisi';
  END IF;

  SELECT * INTO v_trx FROM public.transactions WHERE id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaksi tidak ditemukan';
  END IF;

  IF v_trx.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'Transaksi % sudah pernah di-void sebelumnya', v_trx.invoice_number;
  END IF;

  IF v_trx.driver_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.payrolls
    WHERE employee_id = v_trx.driver_id
      AND period_month = EXTRACT(MONTH FROM v_trx.transaction_date)::INT
      AND period_year = EXTRACT(YEAR FROM v_trx.transaction_date)::INT
  ) THEN
    RAISE EXCEPTION 'Gagal void: Gaji & bonus supir untuk periode %/% sudah dibayarkan.',
      EXTRACT(MONTH FROM v_trx.transaction_date)::INT, EXTRACT(YEAR FROM v_trx.transaction_date)::INT;
  END IF;

  IF NOT v_trx.is_legacy THEN
    FOR v_item IN
      SELECT * FROM public.transaction_items
      WHERE transaction_id = p_transaction_id
      ORDER BY product_id
    LOOP
      SELECT * INTO v_stock FROM public.stocks WHERE product_id = v_item.product_id FOR UPDATE;

      IF v_stock.gudang_kosong < v_item.qty_returned_kosong THEN
        RAISE EXCEPTION 'Gagal void: Stok tabung kosong di gudang sudah terpakai restock sehingga tidak cukup untuk dikembalikan';
      END IF;

      IF (v_item.qty_sent_isi - v_item.qty_returned_kosong) > 0 THEN
        SELECT * INTO v_balance
        FROM public.mitra_product_balances
        WHERE mitra_id = v_trx.mitra_id AND product_id = v_item.product_id
        FOR UPDATE;

        IF NOT FOUND OR v_balance.borrowed_qty < (v_item.qty_sent_isi - v_item.qty_returned_kosong) THEN
          RAISE EXCEPTION 'Gagal void: Pinjaman tabung dari transaksi ini sudah dikembalikan lewat menu Susulan';
        END IF;

        UPDATE public.mitra_product_balances
        SET borrowed_qty = borrowed_qty - (v_item.qty_sent_isi - v_item.qty_returned_kosong),
            updated_at = NOW()
        WHERE id = v_balance.id;
      END IF;

      UPDATE public.stocks
      SET gudang_isi = gudang_isi + v_item.qty_sent_isi,
          gudang_kosong = gudang_kosong - v_item.qty_returned_kosong,
          dipinjam_mitra = dipinjam_mitra - (v_item.qty_sent_isi - v_item.qty_returned_kosong),
          updated_at = NOW()
      WHERE product_id = v_item.product_id;

      INSERT INTO public.stock_movements (
        type, product_id, quantity, linked_transaction_id, notes, user_id
      ) VALUES (
        'void_rollback', v_item.product_id, v_item.qty_sent_isi, p_transaction_id,
        'Rollback void transaksi: ' || v_trx.invoice_number, v_user_id
      );
    END LOOP;
  END IF;

  FOR v_payment IN
    SELECT * FROM public.payments WHERE transaction_id = p_transaction_id ORDER BY created_at
  LOOP
    v_cash_source := CASE
      WHEN v_payment.method = 'tunai_laci' THEN 'kas_laci'
      ELSE 'kas_bank'
    END;

    PERFORM pg_advisory_xact_lock(hashtext('cashflow_' || v_cash_source));
    v_cash_balance := public._internal_get_cash_balance(v_cash_source);
    IF v_cash_balance < v_payment.amount THEN
      RAISE EXCEPTION 'Gagal void: Saldo % (Rp %) tidak cukup untuk mengembalikan pembayaran sebesar Rp %',
        v_cash_source, v_cash_balance, v_payment.amount;
    END IF;

    INSERT INTO public.cashflows (
      type, amount, direction, source, description, reference_id, created_by
    ) VALUES (
      'out_void_refund', v_payment.amount, 'out', v_cash_source,
      'Pengembalian dana void transaksi: ' || v_trx.invoice_number,
      p_transaction_id, v_user_id
    );
  END LOOP;

  UPDATE public.transactions
  SET voided_at = NOW(),
      voided_by = v_user_id,
      void_reason = p_void_reason,
      updated_at = NOW()
  WHERE id = p_transaction_id;

  INSERT INTO public.audit_logs (
    user_id, action, target_table, target_id, reason, old_value
  ) VALUES (
    v_user_id, 'void_transaction', 'transactions', p_transaction_id, p_void_reason, to_jsonb(v_trx)
  );
END;
$$;

-- 5.12 RPC Flow 5: rpc_create_kasbon
CREATE OR REPLACE FUNCTION public.rpc_create_kasbon(
  p_employee_id UUID,
  p_amount BIGINT,
  p_kasbon_date DATE DEFAULT NULL,
  p_source VARCHAR(20) DEFAULT 'kas_laci',
  p_notes TEXT DEFAULT ''
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_emp_name TEXT;
  v_kasbon_id UUID;
  v_cash_balance BIGINT;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Unauthorized: Hanya Owner yang dapat mencatat kasbon';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal kasbon harus lebih dari 0';
  END IF;

  IF p_source NOT IN ('kas_laci', 'kas_bank') THEN
    RAISE EXCEPTION 'Sumber kas tidak valid';
  END IF;

  SELECT name INTO v_emp_name FROM public.employees WHERE id = p_employee_id AND is_active = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Karyawan tidak ditemukan atau sudah tidak aktif';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('cashflow_' || p_source));
  v_cash_balance := public._internal_get_cash_balance(p_source);
  IF v_cash_balance < p_amount THEN
    RAISE EXCEPTION 'Saldo % tidak mencukupi (tersedia: Rp %)', p_source, v_cash_balance;
  END IF;

  INSERT INTO public.kasbons (
    employee_id, amount, remaining_amount, kasbon_date, notes, created_by
  ) VALUES (
    p_employee_id, p_amount, p_amount, COALESCE(p_kasbon_date, public.wib_today()), p_notes, v_user_id
  ) RETURNING id INTO v_kasbon_id;

  INSERT INTO public.cashflows (
    type, amount, direction, source, description, reference_id, created_by
  ) VALUES (
    'out_kasbon', p_amount, 'out', p_source,
    'Kasbon ' || v_emp_name || ': ' || COALESCE(p_notes, ''),
    v_kasbon_id, v_user_id
  );

  RETURN v_kasbon_id;
END;
$$;

-- 5.13 RPC Flow 5: rpc_process_payroll
CREATE OR REPLACE FUNCTION public.rpc_process_payroll(
  p_payrolls JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_payroll JSONB;
  v_emp RECORD;
  v_existing_id UUID;
  v_period_month INT;
  v_period_year INT;
  v_bonus_delivery BIGINT;
  v_bonus_extra BIGINT;
  v_deduction_absence BIGINT;
  v_deduction_kasbon BIGINT;
  v_deduction_other BIGINT;
  v_gross_salary BIGINT;
  v_net_salary BIGINT;
  v_paid_source VARCHAR(20);
  v_unpaid_kasbon BIGINT;
  v_rem_deduction BIGINT;
  v_kasbon RECORD;
  v_cut BIGINT;
  v_payroll_id UUID;
  v_cash_balance BIGINT;
  v_result JSONB := '[]'::JSONB;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Unauthorized: Hanya Owner yang dapat memproses penggajian';
  END IF;

  FOR v_payroll IN SELECT * FROM jsonb_array_elements(p_payrolls)
  LOOP
    SELECT * INTO v_emp FROM public.employees WHERE id = (v_payroll->>'employee_id')::UUID FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Karyawan tidak ditemukan';
    END IF;

    v_period_month := (v_payroll->>'period_month')::INT;
    v_period_year := (v_payroll->>'period_year')::INT;
    v_bonus_extra := COALESCE((v_payroll->>'bonus_extra')::BIGINT, 0);
    v_deduction_absence := COALESCE((v_payroll->>'deduction_absence')::BIGINT, 0);
    v_deduction_kasbon := COALESCE((v_payroll->>'deduction_kasbon')::BIGINT, 0);
    v_deduction_other := COALESCE((v_payroll->>'deduction_other')::BIGINT, 0);
    v_paid_source := COALESCE(v_payroll->>'paid_source', 'kas_laci');

    IF v_paid_source NOT IN ('kas_laci', 'kas_bank') THEN
      RAISE EXCEPTION 'Sumber pembayaran gaji tidak valid';
    END IF;

    SELECT id INTO v_existing_id
    FROM public.payrolls
    WHERE employee_id = v_emp.id AND period_month = v_period_month AND period_year = v_period_year;

    IF FOUND THEN
      v_result := v_result || jsonb_build_object(
        'status', 'already_processed',
        'payroll_id', v_existing_id,
        'employee_id', v_emp.id,
        'employee_name', v_emp.name
      );
      CONTINUE;
    END IF;

    SELECT COALESCE(SUM(ti.qty_sent_isi * ti.bonus_snapshot_per_qty), 0)
    INTO v_bonus_delivery
    FROM public.transaction_items ti
    JOIN public.transactions t ON t.id = ti.transaction_id
    WHERE t.driver_id = v_emp.id
      AND t.voided_at IS NULL
      AND t.is_legacy = FALSE
      AND EXTRACT(MONTH FROM t.transaction_date) = v_period_month
      AND EXTRACT(YEAR FROM t.transaction_date) = v_period_year;

    SELECT COALESCE(SUM(remaining_amount), 0) INTO v_unpaid_kasbon
    FROM public.kasbons
    WHERE employee_id = v_emp.id AND remaining_amount > 0;

    IF v_deduction_kasbon < 0 OR v_deduction_kasbon > v_unpaid_kasbon THEN
      RAISE EXCEPTION 'Potongan kasbon % (Rp %) melebihi sisa kasbon aktif (Rp %)',
        v_emp.name, v_deduction_kasbon, v_unpaid_kasbon;
    END IF;

    v_gross_salary := v_emp.base_salary + v_emp.allowance + v_bonus_delivery + v_bonus_extra - v_deduction_absence;
    v_net_salary := v_gross_salary - v_deduction_kasbon - v_deduction_other;

    IF v_gross_salary < 0 OR v_net_salary < 0 THEN
      RAISE EXCEPTION 'Gaji bersih untuk % bernilai negatif (Rp %). Sesuaikan nominal potongan.', v_emp.name, v_net_salary;
    END IF;

    IF v_net_salary > 0 THEN
      PERFORM pg_advisory_xact_lock(hashtext('cashflow_' || v_paid_source));
      v_cash_balance := public._internal_get_cash_balance(v_paid_source);
      IF v_cash_balance < v_net_salary THEN
        RAISE EXCEPTION 'Saldo % tidak mencukupi untuk membayar gaji % (tersedia: Rp %, dibutuhkan: Rp %)',
          v_paid_source, v_emp.name, v_cash_balance, v_net_salary;
      END IF;
    END IF;

    INSERT INTO public.payrolls (
      employee_id, period_month, period_year, base_salary, allowance,
      bonus_delivery, bonus_extra, deduction_absence, deduction_kasbon, deduction_other,
      gross_salary, net_salary, paid_source, paid_date, created_by
    ) VALUES (
      v_emp.id, v_period_month, v_period_year, v_emp.base_salary, v_emp.allowance,
      v_bonus_delivery, v_bonus_extra, v_deduction_absence, v_deduction_kasbon, v_deduction_other,
      v_gross_salary, v_net_salary, v_paid_source, public.wib_today(), v_user_id
    ) RETURNING id INTO v_payroll_id;

    IF v_deduction_kasbon > 0 THEN
      v_rem_deduction := v_deduction_kasbon;
      FOR v_kasbon IN
        SELECT id, remaining_amount
        FROM public.kasbons
        WHERE employee_id = v_emp.id AND remaining_amount > 0
        ORDER BY kasbon_date ASC, created_at ASC
        FOR UPDATE
      LOOP
        EXIT WHEN v_rem_deduction <= 0;
        v_cut := LEAST(v_kasbon.remaining_amount, v_rem_deduction);

        UPDATE public.kasbons
        SET remaining_amount = remaining_amount - v_cut
        WHERE id = v_kasbon.id;

        INSERT INTO public.kasbon_repayments (kasbon_id, payroll_id, amount)
        VALUES (v_kasbon.id, v_payroll_id, v_cut);

        v_rem_deduction := v_rem_deduction - v_cut;
      END LOOP;
    END IF;

    IF v_net_salary > 0 THEN
      INSERT INTO public.cashflows (
        type, amount, direction, source, description, reference_id, created_by
      ) VALUES (
        'out_salary', v_net_salary, 'out', v_paid_source,
        'Gaji ' || v_emp.name || ' periode ' || v_period_month || '/' || v_period_year,
        v_payroll_id, v_user_id
      );
    END IF;

    v_result := v_result || jsonb_build_object(
      'status', 'processed',
      'payroll_id', v_payroll_id,
      'employee_id', v_emp.id,
      'employee_name', v_emp.name,
      'gross_salary', v_gross_salary,
      'net_salary', v_net_salary
    );
  END LOOP;

  INSERT INTO public.audit_logs (user_id, action, target_table, reason, new_value)
  VALUES (v_user_id, 'process_payroll', 'payrolls', 'Batch proses gaji bulanan', v_result);

  RETURN v_result;
END;
$$;

-- 5.14 RPC Flow 6: rpc_cash_transfer
CREATE OR REPLACE FUNCTION public.rpc_cash_transfer(
  p_amount BIGINT,
  p_from_source VARCHAR(20),
  p_to_source VARCHAR(20),
  p_description TEXT DEFAULT ''
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_group_id UUID := gen_random_uuid();
  v_balance BIGINT;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Unauthorized: Hanya Owner yang dapat melakukan mutasi kas';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal mutasi harus lebih dari 0';
  END IF;

  IF p_from_source NOT IN ('kas_laci', 'kas_bank') OR p_to_source NOT IN ('kas_laci', 'kas_bank') OR p_from_source = p_to_source THEN
    RAISE EXCEPTION 'Sumber dan tujuan kas tidak valid';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('cashflow_' || p_from_source));
  v_balance := public._internal_get_cash_balance(p_from_source);
  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Saldo % tidak mencukupi (tersedia: Rp %)', p_from_source, v_balance;
  END IF;

  INSERT INTO public.cashflows (type, amount, direction, source, transfer_group_id, description, created_by)
  VALUES
    ('transfer', p_amount, 'out', p_from_source, v_group_id, COALESCE(NULLIF(TRIM(p_description), ''), 'Mutasi keluar ke ' || p_to_source), v_user_id),
    ('transfer', p_amount, 'in', p_to_source, v_group_id, COALESCE(NULLIF(TRIM(p_description), ''), 'Mutasi masuk dari ' || p_from_source), v_user_id);

  RETURN v_group_id;
END;
$$;

-- 5.15 RPC Flow 6: rpc_create_operational_expense
CREATE OR REPLACE FUNCTION public.rpc_create_operational_expense(
  p_amount BIGINT,
  p_source VARCHAR(20),
  p_description TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_balance BIGINT;
  v_cashflow_id UUID;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Unauthorized: Hanya Owner yang dapat mencatat biaya operasional';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal biaya harus lebih dari 0';
  END IF;

  IF p_source NOT IN ('kas_laci', 'kas_bank') THEN
    RAISE EXCEPTION 'Sumber kas tidak valid';
  END IF;

  IF COALESCE(TRIM(p_description), '') = '' THEN
    RAISE EXCEPTION 'Keterangan biaya operasional wajib diisi';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('cashflow_' || p_source));
  v_balance := public._internal_get_cash_balance(p_source);
  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Saldo % tidak mencukupi (tersedia: Rp %)', p_source, v_balance;
  END IF;

  INSERT INTO public.cashflows (type, amount, direction, source, description, created_by)
  VALUES ('out_operational', p_amount, 'out', p_source, p_description, v_user_id)
  RETURNING id INTO v_cashflow_id;

  RETURN v_cashflow_id;
END;
$$;

-- 5.16 RPC Flow 6: rpc_get_profit_loss_report
CREATE OR REPLACE FUNCTION public.rpc_get_profit_loss_report(
  p_start_date DATE,
  p_end_date DATE
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_omzet_accrual BIGINT := 0;
  v_cash_collected_period BIGINT := 0;
  v_piutang_from_period_sales BIGINT := 0;
  v_hpp_total BIGINT := 0;
  v_operational_expense BIGINT := 0;
  v_salary_expense BIGINT := 0;
  v_bocor_gross_loss BIGINT := 0;
  v_bocor_warranty_recovered BIGINT := 0;
  v_bocor_net_loss BIGINT := 0;
  v_opname_loss BIGINT := 0;
  v_gross_profit BIGINT := 0;
  v_net_profit BIGINT := 0;
  v_start_ts TIMESTAMPTZ := (p_start_date::TEXT || ' 00:00:00+07:00')::TIMESTAMPTZ;
  v_end_ts TIMESTAMPTZ := (p_end_date::TEXT || ' 23:59:59.999999+07:00')::TIMESTAMPTZ;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Unauthorized: Hanya Owner yang dapat mengakses Laporan Laba Rugi';
  END IF;

  SELECT
    COALESCE(SUM(total_amount), 0),
    COALESCE(SUM(total_amount - total_paid), 0)
  INTO v_omzet_accrual, v_piutang_from_period_sales
  FROM public.transactions
  WHERE voided_at IS NULL
    AND is_legacy = FALSE
    AND transaction_date BETWEEN p_start_date AND p_end_date;

  SELECT COALESCE(SUM(p.amount), 0)
  INTO v_cash_collected_period
  FROM public.payments p
  JOIN public.transactions t ON t.id = p.transaction_id
  WHERE t.voided_at IS NULL
    AND t.is_legacy = FALSE
    AND p.payment_date BETWEEN p_start_date AND p_end_date;

  SELECT COALESCE(SUM(ti.qty_sent_isi * ti.buy_price_snapshot), 0)
  INTO v_hpp_total
  FROM public.transaction_items ti
  JOIN public.transactions t ON t.id = ti.transaction_id
  WHERE t.voided_at IS NULL
    AND t.is_legacy = FALSE
    AND t.transaction_date BETWEEN p_start_date AND p_end_date;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_operational_expense
  FROM public.cashflows
  WHERE type = 'out_operational'
    AND created_at BETWEEN v_start_ts AND v_end_ts;

  SELECT COALESCE(SUM(gross_salary), 0)
  INTO v_salary_expense
  FROM public.payrolls
  WHERE make_date(period_year, period_month, 1) BETWEEN date_trunc('month', p_start_date)::DATE AND date_trunc('month', p_end_date)::DATE;

  SELECT COALESCE(SUM(COALESCE(sm.cost, ABS(sm.quantity) * p.buy_price)), 0)
  INTO v_bocor_gross_loss
  FROM public.stock_movements sm
  JOIN public.products p ON p.id = sm.product_id
  WHERE sm.type IN ('bocor_gudang', 'bocor_tukar_guling')
    AND sm.created_at BETWEEN v_start_ts AND v_end_ts;

  SELECT COALESCE(SUM(sm.cost), 0)
  INTO v_bocor_warranty_recovered
  FROM public.stock_movements sm
  WHERE sm.type = 'in_from_supplier'
    AND sm.claimed_warranty = TRUE
    AND sm.created_at BETWEEN v_start_ts AND v_end_ts;

  v_bocor_net_loss := GREATEST(v_bocor_gross_loss - v_bocor_warranty_recovered, 0);

  SELECT COALESCE(SUM(cost), 0)
  INTO v_opname_loss
  FROM public.stock_movements
  WHERE type = 'opname'
    AND COALESCE(cost, 0) > 0
    AND created_at BETWEEN v_start_ts AND v_end_ts;

  v_gross_profit := v_omzet_accrual - v_hpp_total;
  v_net_profit := v_gross_profit - v_operational_expense - v_salary_expense - v_bocor_net_loss - v_opname_loss;

  RETURN jsonb_build_object(
    'omzet_accrual', v_omzet_accrual,
    'cash_collected_period', v_cash_collected_period,
    'piutang_remaining_from_period', v_piutang_from_period_sales,
    'hpp_total', v_hpp_total,
    'gross_profit', v_gross_profit,
    'operational_expense', v_operational_expense,
    'salary_expense', v_salary_expense,
    'bocor_gross_loss', v_bocor_gross_loss,
    'bocor_warranty_recovered', v_bocor_warranty_recovered,
    'bocor_net_loss', v_bocor_net_loss,
    'opname_loss', v_opname_loss,
    'net_profit', v_net_profit
  );
END;
$$;

-- 5.17 Hardening Permission Fungsi (REVOKE & GRANT)
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.rpc_generate_invoice_number(DATE) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public._internal_get_cash_balance(VARCHAR) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.wib_today() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_or_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cash_balance(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_active_drivers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_onboarding_setup(BIGINT, BIGINT, DATE, JSONB, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_create_transaction_sale(UUID, UUID, JSONB, VARCHAR, BIGINT, VARCHAR, DATE, DATE, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_restock_from_supplier(UUID, INT, INT, INT, BOOLEAN, VARCHAR, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_report_bocor(UUID, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_tukar_guling(UUID, UUID, INT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_stock_opname(JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_receive_susulan(UUID, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_pay_receivable(UUID, BIGINT, DATE, VARCHAR, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_void_transaction(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_create_kasbon(UUID, BIGINT, DATE, VARCHAR, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_process_payroll(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_cash_transfer(BIGINT, VARCHAR, VARCHAR, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_create_operational_expense(BIGINT, VARCHAR, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_profit_loss_report(DATE, DATE) TO authenticated;
