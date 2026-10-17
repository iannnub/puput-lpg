import { createClient } from '@/lib/supabase/server'

export interface ProfitLossReportData {
  omzet_accrual: number
  cash_collected_period: number
  piutang_remaining_from_period: number
  hpp_total: number
  gross_profit: number
  operational_expense: number
  salary_expense: number
  bocor_gross_loss: number
  bocor_warranty_recovered: number
  bocor_net_loss: number
  opname_loss: number
  net_profit: number
}

export async function getProfitLossReport(month: number, year: number): Promise<ProfitLossReportData> {
  const supabase = await createClient()

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data, error } = await supabase.rpc('rpc_get_profit_loss_report', {
    p_start_date: startDate,
    p_end_date: endDate
  })

  if (error) throw new Error(error.message)

  const raw = (data ?? {}) as Record<string, unknown>

  return {
    omzet_accrual: Number(raw.omzet_accrual ?? 0),
    cash_collected_period: Number(raw.cash_collected_period ?? 0),
    piutang_remaining_from_period: Number(raw.piutang_remaining_from_period ?? 0),
    hpp_total: Number(raw.hpp_total ?? 0),
    gross_profit: Number(raw.gross_profit ?? 0),
    operational_expense: Number(raw.operational_expense ?? 0),
    salary_expense: Number(raw.salary_expense ?? 0),
    bocor_gross_loss: Number(raw.bocor_gross_loss ?? 0),
    bocor_warranty_recovered: Number(raw.bocor_warranty_recovered ?? 0),
    bocor_net_loss: Number(raw.bocor_net_loss ?? 0),
    opname_loss: Number(raw.opname_loss ?? 0),
    net_profit: Number(raw.net_profit ?? 0)
  }
}
