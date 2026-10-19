import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function check() {
  const { data: b } = await admin.from('mitra_product_balances').select('*, mitras(name), products(name)')
  console.log('BALANCES:', JSON.stringify(b, null, 2))

  const { data: tx } = await admin.from('transactions').select('id, invoice_number, total_amount, mitra_id, mitras(name)')
  console.log('TRANSACTIONS:', JSON.stringify(tx, null, 2))

  const { data: items } = await admin.from('transaction_items').select('*')
  console.log('ITEMS:', JSON.stringify(items, null, 2))
}

check()
