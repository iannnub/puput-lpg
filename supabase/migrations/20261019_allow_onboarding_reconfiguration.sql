-- Migration: Mengizinkan pembaruan pengaturan saldo dan stok awal agar Owner dapat memperbaiki data
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
    RAISE EXCEPTION 'Akses ditolak: Hanya Owner yang dapat mengelola pengaturan awal';
  END IF;

  SELECT onboarding_completed INTO v_done
  FROM public.app_settings
  WHERE id = 1
  FOR UPDATE;

  IF p_kas_laci < 0 OR p_kas_bank < 0 THEN
    RAISE EXCEPTION 'Saldo kas awal tidak boleh bernilai negatif';
  END IF;

  -- Hapus saldo kas awal sebelumnya jika sedang memperbarui, agar tidak terduplikasi
  DELETE FROM public.cashflows
  WHERE type = 'initial_balance';

  IF p_kas_laci > 0 THEN
    INSERT INTO public.cashflows (type, amount, direction, source, description, created_by)
    VALUES ('initial_balance', p_kas_laci, 'in', 'kas_laci', 'Saldo kas laci awal (' || COALESCE(p_tanggal, public.wib_today()) || '): ' || COALESCE(p_catatan, ''), v_user_id);
  END IF;

  IF p_kas_bank > 0 THEN
    INSERT INTO public.cashflows (type, amount, direction, source, description, created_by)
    VALUES ('initial_balance', p_kas_bank, 'in', 'kas_bank', 'Saldo kas bank awal (' || COALESCE(p_tanggal, public.wib_today()) || '): ' || COALESCE(p_catatan, ''), v_user_id);
  END IF;

  -- Update stok fisik gudang
  FOR v_stok IN SELECT * FROM jsonb_array_elements(COALESCE(p_stok_awal, '[]'::JSONB))
  LOOP
    v_product_id := (v_stok->>'product_id')::UUID;
    v_isi := COALESCE((v_stok->>'isi')::INT, 0);
    v_kosong := COALESCE((v_stok->>'kosong')::INT, 0);
    v_bocor := COALESCE((v_stok->>'bocor')::INT, 0);

    IF v_isi < 0 OR v_kosong < 0 OR v_bocor < 0 THEN
      RAISE EXCEPTION 'Jumlah stok tidak boleh bernilai negatif';
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
      'Pengaturan stok awal: Isi=' || v_isi || ', Kosong=' || v_kosong || ', Bocor=' || v_bocor || '. ' || COALESCE(p_catatan, ''),
      v_user_id
    );
  END LOOP;

  -- Input piutang lama migrasi jika ada
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
        'SALDO-AWAL-' || TO_CHAR(COALESCE(p_tanggal, public.wib_today()), 'YYYYMMDD') || '-' || LPAD(v_leg_seq::TEXT, 3, '0'),
        COALESCE(p_tanggal, public.wib_today()),
        v_hutang, 0, 'pending', v_due_date, 'Saldo Piutang Awal',
        'Piutang awal: ' || COALESCE(v_piutang->>'catatan', ''),
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
  VALUES (v_user_id, 'onboarding_setup', 'app_settings', COALESCE(p_catatan, 'Pembaruan pengaturan awal sistem'));
END;
$$;
