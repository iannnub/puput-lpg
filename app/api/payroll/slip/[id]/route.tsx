import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 10 },
  title: { fontSize: 14, fontWeight: 'bold', marginBottom: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottom: '1pt solid #e2e8f0'
  }
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: payroll, error } = await supabase
    .from('payrolls')
    .select('*, employees(name, position)')
    .eq('id', id)
    .single()

  if (error || !payroll) {
    return NextResponse.json({ error: 'Payroll not found' }, { status: 404 })
  }

  const empObj = Array.isArray(payroll.employees)
    ? payroll.employees[0]
    : payroll.employees

  const SlipDocument = () => (
    <Document>
      <Page size="A5" style={styles.page}>
        <Text style={styles.title}>SLIP GAJI KARYAWAN</Text>
        <Text>
          Nama: {empObj?.name || '-'} ({empObj?.position || '-'})
        </Text>
        <Text style={{ marginBottom: 12 }}>
          Periode: {payroll.period_month}/{payroll.period_year}
        </Text>

        <View style={styles.row}>
          <Text>Gaji Pokok</Text>
          <Text>Rp {Number(payroll.base_salary).toLocaleString('id-ID')}</Text>
        </View>
        <View style={styles.row}>
          <Text>Tunjangan</Text>
          <Text>Rp {Number(payroll.allowance).toLocaleString('id-ID')}</Text>
        </View>
        <View style={styles.row}>
          <Text>Bonus Pengiriman Tabung</Text>
          <Text>Rp {Number(payroll.bonus_delivery).toLocaleString('id-ID')}</Text>
        </View>
        <View style={styles.row}>
          <Text>Bonus Tambahan</Text>
          <Text>Rp {Number(payroll.bonus_extra).toLocaleString('id-ID')}</Text>
        </View>
        <View style={styles.row}>
          <Text>Potongan Absen / Alpha</Text>
          <Text>- Rp {Number(payroll.deduction_absence).toLocaleString('id-ID')}</Text>
        </View>
        <View style={[styles.row, { fontWeight: 'bold' }]}>
          <Text>Gaji Bruto</Text>
          <Text>Rp {Number(payroll.gross_salary).toLocaleString('id-ID')}</Text>
        </View>
        <View style={styles.row}>
          <Text>Potongan Kasbon</Text>
          <Text>- Rp {Number(payroll.deduction_kasbon).toLocaleString('id-ID')}</Text>
        </View>
        <View style={styles.row}>
          <Text>Potongan Karyawan Lainnya</Text>
          <Text>- Rp {Number(payroll.deduction_other).toLocaleString('id-ID')}</Text>
        </View>
        <View style={[styles.row, { fontWeight: 'bold', marginTop: 8 }]}>
          <Text>GAJI BERSIH DITERIMA (NET)</Text>
          <Text>Rp {Number(payroll.net_salary).toLocaleString('id-ID')}</Text>
        </View>
      </Page>
    </Document>
  )

  const buffer = await renderToBuffer(<SlipDocument />)
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Slip-Gaji-${payroll.period_year}-${payroll.period_month}.pdf"`
    }
  })
}
