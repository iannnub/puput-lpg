import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 10 },
  header: { marginBottom: 20, textAlign: 'center' },
  companyName: { fontSize: 16, fontWeight: 'bold' },
  table: { display: 'flex', width: '100%', marginTop: 10 },
  tableRow: { flexDirection: 'row', borderBottom: '1pt solid #cccccc' },
  tableCell: { padding: 5, flex: 1 },
  footer: { marginTop: 30, fontSize: 9 }
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  // Verifikasi autentikasi secara eksplisit
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: transaction, error } = await supabase
    .from('transactions')
    .select(
      `
      *,
      mitras(name, address, phone),
      transaction_items(*, products(name))
    `
    )
    .eq('id', id)
    .single()

  if (error || !transaction) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  }

  const mitraObj = Array.isArray(transaction.mitras)
    ? transaction.mitras[0]
    : transaction.mitras
  const itemsList = (transaction.transaction_items ?? []) as Array<{
    qty_sent_isi: number
    qty_returned_kosong: number
    sell_price_snapshot: number
    subtotal: number
    products: { name: string } | Array<{ name: string }> | null
  }>

  const InvoiceDocument = () => (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.companyName}>
            {process.env.NEXT_PUBLIC_BUSINESS_NAME || 'Pangkalan LPG'}
          </Text>
          <Text>{process.env.NEXT_PUBLIC_BUSINESS_ADDRESS || '-'}</Text>
          <Text>{process.env.NEXT_PUBLIC_BUSINESS_PHONE || '-'}</Text>
        </View>

        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontWeight: 'bold', fontSize: 14 }}>
            INVOICE {transaction.voided_at ? '(VOID / BATAL)' : ''}
          </Text>
          <Text>No: {transaction.invoice_number}</Text>
          <Text>Tanggal: {transaction.transaction_date}</Text>
          <Text>Jatuh Tempo: {transaction.due_date || 'Lunas'}</Text>
        </View>

        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontWeight: 'bold' }}>Kepada:</Text>
          <Text>{mitraObj?.name || '-'}</Text>
          <Text>{mitraObj?.address || '-'}</Text>
          <Text>{mitraObj?.phone || '-'}</Text>
        </View>

        <View style={styles.table}>
          <View style={[styles.tableRow, { fontWeight: 'bold', backgroundColor: '#f1f5f9' }]}>
            <Text style={[styles.tableCell, { flex: 2 }]}>Produk</Text>
            <Text style={styles.tableCell}>Kirim Isi</Text>
            <Text style={styles.tableCell}>Kembali Kosong</Text>
            <Text style={styles.tableCell}>Harga</Text>
            <Text style={styles.tableCell}>Subtotal</Text>
          </View>
          {itemsList.map((item, idx) => {
            const prod = Array.isArray(item.products) ? item.products[0] : item.products
            return (
              <View key={idx} style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 2 }]}>{prod?.name || '-'}</Text>
                <Text style={styles.tableCell}>{item.qty_sent_isi}</Text>
                <Text style={styles.tableCell}>{item.qty_returned_kosong}</Text>
                <Text style={styles.tableCell}>
                  Rp {Number(item.sell_price_snapshot).toLocaleString('id-ID')}
                </Text>
                <Text style={styles.tableCell}>
                  Rp {Number(item.subtotal).toLocaleString('id-ID')}
                </Text>
              </View>
            )
          })}
        </View>

        <View style={{ marginTop: 16, alignItems: 'flex-end' }}>
          <Text style={{ fontWeight: 'bold', fontSize: 12 }}>
            Total Tagihan: Rp {Number(transaction.total_amount).toLocaleString('id-ID')}
          </Text>
          <Text>
            Sudah Dibayar: Rp {Number(transaction.total_paid).toLocaleString('id-ID')}
          </Text>
          <Text style={{ fontWeight: 'bold' }}>
            Sisa Piutang: Rp{' '}
            {(Number(transaction.total_amount) - Number(transaction.total_paid)).toLocaleString(
              'id-ID'
            )}
          </Text>
        </View>

        <View style={styles.footer}>
          <Text>Penerima: {transaction.recipient_name || '-'}</Text>
          <Text>Catatan: {transaction.notes || '-'}</Text>
        </View>
      </Page>
    </Document>
  )

  const pdfBuffer = await renderToBuffer(<InvoiceDocument />)

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Invoice-${transaction.invoice_number}.pdf"`
    }
  })
}
