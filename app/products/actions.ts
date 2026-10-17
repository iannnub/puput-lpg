'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createProductAction(data: {
  name: string
  buy_price: number
  sell_price: number
}) {
  const supabase = await createClient()

  const { error } = await supabase.from('products').insert({
    name: data.name.trim(),
    buy_price: Math.floor(data.buy_price),
    sell_price: Math.floor(data.sell_price),
    is_active: true
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/products')
  revalidatePath('/stocks')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateProductAction(data: {
  id: string
  name: string
  buy_price: number
  sell_price: number
  is_active: boolean
}) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('products')
    .update({
      name: data.name.trim(),
      buy_price: Math.floor(data.buy_price),
      sell_price: Math.floor(data.sell_price),
      is_active: data.is_active,
      updated_at: new Date().toISOString()
    })
    .eq('id', data.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/products')
  revalidatePath('/stocks')
  revalidatePath('/dashboard')
  return { success: true }
}
