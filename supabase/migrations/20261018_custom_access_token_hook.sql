-- ==============================================================================
-- MIGRATION: 20261018_custom_access_token_hook.sql
-- 1. Custom Access Token Hook for Zero-Query Middleware
-- 2. Aggregated RPC for Dashboard Summary (Single-Call Dashboard)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Custom Access Token Hook (Enriches JWT claims with user_role & status)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  user_role text;
  user_is_active boolean;
  app_onboarding_completed boolean;
BEGIN
  -- Fetch role and active status from public.users
  SELECT role, is_active INTO user_role, user_is_active
  FROM public.users
  WHERE id = (event->>'user_id')::uuid;

  SELECT onboarding_completed INTO app_onboarding_completed
  FROM public.app_settings
  WHERE id = 1;

  claims := event->'claims';

  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
    claims := jsonb_set(claims, '{user_status}', to_jsonb(CASE WHEN user_is_active THEN 'active' ELSE 'inactive' END));
    claims := jsonb_set(claims, '{onboarding_completed}', to_jsonb(COALESCE(app_onboarding_completed, false)));
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon, public;

-- ------------------------------------------------------------------------------
-- 2. Aggregated RPC: rpc_get_dashboard_summary
-- Menggabungkan seluruh data ringkasan dashboard dalam 1 query atomik di database
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_get_dashboard_summary(
  p_is_owner boolean DEFAULT false,
  p_month_prefix text DEFAULT to_char(CURRENT_DATE, 'YYYY-MM'),
  p_today text DEFAULT to_char(CURRENT_DATE, 'YYYY-MM-DD')
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stocks jsonb;
  v_receivables jsonb;
  v_financials jsonb := '{}'::jsonb;
  v_recent_transactions jsonb;
  v_kas_laci bigint := 0;
  v_kas_bank bigint := 0;
  v_omzet bigint := 0;
  v_kas_masuk bigint := 0;
  v_total_piutang bigint := 0;
  v_overdue_count int := 0;
  v_pending_count int := 0;
BEGIN
  -- 1. Ambil stok produk aktif
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'product_id', s.product_id,
        'gudang_isi', s.gudang_isi,
        'gudang_kosong', s.gudang_kosong,
        'gudang_bocor', s.gudang_bocor,
        'dipinjam_mitra', s.dipinjam_mitra,
        'products', jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'buy_price', p.buy_price,
          'sell_price', p.sell_price,
          'is_active', p.is_active
        )
      ) ORDER BY s.updated_at ASC
    ),
    '[]'::jsonb
  ) INTO v_stocks
  FROM public.stocks s
  JOIN public.products p ON p.id = s.product_id
  WHERE p.is_active = true;

  -- 2. Ringkasan Piutang Aktif
  SELECT
    COALESCE(SUM(total_amount - total_paid), 0),
    COUNT(*) FILTER (WHERE due_date < p_today::date),
    COUNT(*)
  INTO v_total_piutang, v_overdue_count, v_pending_count
  FROM public.transactions
  WHERE payment_status != 'lunas'
    AND voided_at IS NULL
    AND (total_amount - total_paid) > 0;

  v_receivables := jsonb_build_object(
    'total_piutang', v_total_piutang,
    'overdue_count', v_overdue_count,
    'pending_count', v_pending_count
  );

  -- 3. Finansial Khusus Owner
  IF p_is_owner THEN
    v_kas_laci := public.get_cash_balance('kas_laci');
    v_kas_bank := public.get_cash_balance('kas_bank');

    SELECT COALESCE(SUM(total_amount), 0)
    INTO v_omzet
    FROM public.transactions
    WHERE transaction_date >= (p_month_prefix || '-01')::DATE
      AND transaction_date <= (p_month_prefix || '-31')::DATE
      AND voided_at IS NULL
      AND is_legacy = false;

    SELECT COALESCE(SUM(p.amount), 0)
    INTO v_kas_masuk
    FROM public.payments p
    JOIN public.transactions t ON t.id = p.transaction_id
    WHERE p.payment_date >= (p_month_prefix || '-01')::DATE
      AND p.payment_date <= (p_month_prefix || '-31')::DATE
      AND t.voided_at IS NULL
      AND t.is_legacy = false;

    v_financials := jsonb_build_object(
      'kas_laci', v_kas_laci,
      'kas_bank', v_kas_bank,
      'omzet_bulan_ini', v_omzet,
      'kas_masuk_bulan_ini', v_kas_masuk
    );
  END IF;

  -- 4. 10 Transaksi Terbaru
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', sub.id,
        'invoice_number', sub.invoice_number,
        'transaction_date', sub.transaction_date,
        'total_amount', sub.total_amount,
        'total_paid', sub.total_paid,
        'payment_status', sub.payment_status,
        'due_date', sub.due_date,
        'voided_at', sub.voided_at,
        'is_legacy', sub.is_legacy,
        'mitras', CASE WHEN sub.mitra_name IS NOT NULL THEN jsonb_build_object('name', sub.mitra_name) ELSE NULL END
      )
    ),
    '[]'::jsonb
  ) INTO v_recent_transactions
  FROM (
    SELECT t.id, t.invoice_number, t.transaction_date, t.total_amount, t.total_paid,
           t.payment_status, t.due_date, t.voided_at, t.is_legacy, m.name AS mitra_name
    FROM public.transactions t
    LEFT JOIN public.mitras m ON m.id = t.mitra_id
    ORDER BY t.created_at DESC
    LIMIT 10
  ) sub;

  RETURN jsonb_build_object(
    'stocks', v_stocks,
    'receivables', v_receivables,
    'financials', v_financials,
    'recent_transactions', v_recent_transactions
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_dashboard_summary(boolean, text, text) TO authenticated, service_role;
