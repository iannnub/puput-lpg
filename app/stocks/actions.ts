'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function submitRestockAction(data: {
  product_id: string
  qty_isi_datang: number
  qty_kosong_diserahkan: number
  qty_bocor_retur: number
  klaim_garansi: boolean
  source: 'kas_laci' | 'kas_bank'
  notes: string
}) {
  const supabase = await createClient()

  const { data: totalBayar, error } = await supabase.rpc('rpc_restock_from_supplier', {
    p_product_id: data.product_id,
    p_qty_isi_datang: Math.floor(data.qty_isi_datang),
    p_qty_kosong_diserahkan: Math.floor(data.qty_kosong_diserahkan),
    p_qty_bocor_retur: Math.floor(data.qty_bocor_retur),
    p_bocor_klaim_garansi: data.klaim_garansi,
    p_source: data.source,
    p_notes: data.notes.trim()
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/stocks')
  revalidatePath('/dashboard')
  revalidatePath('/cashflow')
  return { success: true, totalBayar: Number(totalBayar ?? 0) }
}

export async function laporBocorAction(
  productId: string,
  qty: number,
  alasan: string
) {
  const supabase = await createClient()

  const { error } = await supabase.rpc('rpc_report_bocor', {
    p_product_id: productId,
    p_qty: Math.floor(qty),
    p_notes: alasan.trim()
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/stocks')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function tukarGulingBocorAction(data: {
  mitraId: string
  productId: string
  qty: number
  photoPath: string | null
  notes: string
}) {
  const supabase = await createClient()

  const { error } = await supabase.rpc('rpc_tukar_guling', {
    p_mitra_id: data.mitraId,
    p_product_id: data.productId,
    p_qty: Math.floor(data.qty),
    p_photo_url: data.photoPath,
    p_notes: data.notes.trim()
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/stocks')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function submitOpnameAction(
  items: Array<{
    product_id: string
    fisik_isi: number
    fisik_kosong: number
    fisik_bocor: number
  }>,
  alasan: string
) {
  const supabase = await createClient()

  const { error } = await supabase.rpc('rpc_stock_opname', {
    p_items: items.map(item => ({
      product_id: item.product_id,
      fisik_isi: Math.max(0, Math.floor(item.fisik_isi)),
      fisik_kosong: Math.max(0, Math.floor(item.fisik_kosong)),
      fisik_bocor: Math.max(0, Math.floor(item.fisik_bocor))
    })),
    p_reason: alasan.trim()
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/stocks')
  revalidatePath('/dashboard')
  return { success: true }
}
