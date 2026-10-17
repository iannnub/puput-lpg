'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createMitraAction(data: {
  name: string
  phone: string
  address: string
  credit_limit: number
  max_open_invoices: number
}) {
  const supabase = await createClient()

  const { error } = await supabase.from('mitras').insert({
    name: data.name.trim(),
    phone: data.phone.trim() || null,
    address: data.address.trim() || null,
    credit_limit: Math.floor(data.credit_limit),
    max_pending_invoices: Math.max(1, Math.floor(data.max_open_invoices)),
    is_system: false,
    status: 'active'
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/mitras')
  revalidatePath('/onboarding')
  return { success: true }
}

export async function updateMitraAction(data: {
  id: string
  name: string
  phone: string
  address: string
  credit_limit: number
  max_open_invoices: number
  is_active: boolean
}) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('mitras')
    .update({
      name: data.name.trim(),
      phone: data.phone.trim() || null,
      address: data.address.trim() || null,
      credit_limit: Math.floor(data.credit_limit),
      max_pending_invoices: Math.max(1, Math.floor(data.max_open_invoices)),
      status: data.is_active ? 'active' : 'blocked',
      updated_at: new Date().toISOString()
    })
    .eq('id', data.id)
    .eq('is_system', false)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/mitras')
  revalidatePath(`/mitras/${data.id}`)
  return { success: true }
}

export async function setCustomPriceAction(
  mitraId: string,
  productId: string,
  customPrice: number
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('mitra_product_settings')
    .upsert(
      {
        mitra_id: mitraId,
        product_id: productId,
        custom_sell_price: Math.floor(customPrice),
        updated_at: new Date().toISOString()
      },
      { onConflict: 'mitra_id,product_id' }
    )

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/mitras/${mitraId}`)
  return { success: true }
}

export async function removeCustomPriceAction(mitraId: string, productId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('mitra_product_settings')
    .delete()
    .eq('mitra_id', mitraId)
    .eq('product_id', productId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/mitras/${mitraId}`)
  return { success: true }
}
