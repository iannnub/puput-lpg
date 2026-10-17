import { notFound } from 'next/navigation'
import { AppShell, getAuthenticatedContext } from '@/components/layout/app-shell'
import { TransactionDetailClient } from './transaction-detail-client'
import { getWibTodayString } from '@/lib/utils/date-wib'

export const dynamic = 'force-dynamic'

export default async function TransactionDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, isOwner } = await getAuthenticatedContext()
  const todayWib = getWibTodayString()

  const [
    { data: tx },
    { data: itemsData },
    { data: paymentsData },
    { data: driversData }
  ] = await Promise.all([
    supabase
      .from('transactions')
      .select('*, mitras(name, address, phone)')
      .eq('id', id)
      .single(),
    supabase
      .from('transaction_items')
      .select('id, qty_sent_isi, qty_returned_kosong, sell_price_snapshot, subtotal, products(name)')
      .eq('transaction_id', id),
    supabase
      .from('payments')
      .select('id, amount, payment_date, method, proof_url, notes, created_at')
      .eq('transaction_id', id)
      .order('created_at', { ascending: true }),
    supabase.rpc('rpc_get_active_drivers')
  ])

  if (!tx) {
    notFound()
  }

  const mitraObj = Array.isArray(tx.mitras) ? tx.mitras[0] : tx.mitras
  const driverObj = (driversData ?? []).find(d => d.id === tx.driver_id)

  // Generate signed URL for delivery note photo if present
  let signedPhotoUrl: string | null = null
  if (tx.photo_url) {
    const { data: signed } = await supabase.storage
      .from('transaction-proofs')
      .createSignedUrl(tx.photo_url, 3600)
    signedPhotoUrl = signed?.signedUrl ?? null
  }

  // Generate signed URLs for payment proofs if present
  const paymentsWithSignedUrl = await Promise.all(
    (paymentsData ?? []).map(async p => {
      let signedProofUrl: string | null = null
      if (p.proof_url) {
        const { data: signed } = await supabase.storage
          .from('payment-proofs')
          .createSignedUrl(p.proof_url, 3600)
        signedProofUrl = signed?.signedUrl ?? null
      }
      return {
        id: p.id,
        amount: Number(p.amount),
        payment_date: p.payment_date,
        method: p.method,
        notes: p.notes,
        created_at: p.created_at,
        signed_proof_url: signedProofUrl
      }
    })
  )

  const items = (itemsData ?? []).map(item => {
    const prod = Array.isArray(item.products) ? item.products[0] : item.products
    return {
      id: item.id,
      product_name: prod?.name ?? '-',
      qty_sent_isi: item.qty_sent_isi,
      qty_returned_kosong: item.qty_returned_kosong,
      sell_price_snapshot: Number(item.sell_price_snapshot),
      subtotal: Number(item.subtotal)
    }
  })

  return (
    <AppShell activePath="/transactions">
      <TransactionDetailClient
        transaction={{
          id: tx.id,
          invoice_number: tx.invoice_number,
          transaction_date: tx.transaction_date,
          total_amount: Number(tx.total_amount),
          total_paid: Number(tx.total_paid),
          payment_status: tx.payment_status,
          due_date: tx.due_date,
          recipient_name: tx.recipient_name,
          notes: tx.notes,
          is_legacy: tx.is_legacy,
          override_reason: tx.override_reason,
          voided_at: tx.voided_at,
          void_reason: tx.void_reason,
          created_at: tx.created_at,
          mitra_name: mitraObj?.name ?? '-',
          mitra_address: mitraObj?.address ?? null,
          mitra_phone: mitraObj?.phone ?? null,
          driver_name: driverObj ? `${driverObj.name} (${driverObj.position})` : null,
          signed_photo_url: signedPhotoUrl
        }}
        items={items}
        payments={paymentsWithSignedUrl}
        isOwner={isOwner}
        todayWib={todayWib}
      />
    </AppShell>
  )
}
