'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface OnboardingPayload {
  kasLaci: number
  kasBank: number
  tanggal: string // 'YYYY-MM-DD'
  catatan: string
  stokAwal: Array<{
    product_id: string
    isi: number
    kosong: number
    bocor: number
  }>
  piutangLama: Array<{
    mitra_id: string
    hutang_uang: number
    due_date: string // 'YYYY-MM-DD'
    catatan: string
    tabung: Array<{ product_id: string; qty: number }>
  }>
}

export async function submitOnboardingAction(payload: OnboardingPayload) {
  const supabase = await createClient()

  const { error } = await supabase.rpc('rpc_onboarding_setup', {
    p_kas_laci: payload.kasLaci,
    p_kas_bank: payload.kasBank,
    p_tanggal: payload.tanggal,
    p_stok_awal: payload.stokAwal,
    p_piutang_lama: payload.piutangLama,
    p_catatan: payload.catatan
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/stocks')
  revalidatePath('/mitras')
  return { success: true }
}
