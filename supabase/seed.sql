-- Seed Produk (Stok 0 otomatis dibuat oleh trigger after_product_insert_init_stock)
INSERT INTO public.products (name, buy_price, sell_price) VALUES
  ('3kg', 20000, 25000),
  ('12kg', 85000, 95000),
  ('Bright Gas 5.5kg', 75000, 85000)
ON CONFLICT (name) DO NOTHING;

-- Seed Pelanggan Umum (Walk-In)
INSERT INTO public.mitras (name, address, phone, credit_limit, max_pending_invoices, status, is_system)
SELECT 'Pelanggan Umum (Walk-In)', '-', '-', 0, 0, 'active', TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.mitras WHERE is_system = TRUE);
