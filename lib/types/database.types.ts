export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: number
          business_name: string
          business_address: string
          business_phone: string
          onboarding_completed: boolean
          onboarding_completed_at: string | null
          onboarding_completed_by: string | null
          updated_at: string
        }
        Insert: {
          id?: number
          business_name?: string
          business_address?: string
          business_phone?: string
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          onboarding_completed_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: number
          business_name?: string
          business_address?: string
          business_phone?: string
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          onboarding_completed_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          id: string
          email: string
          role: 'owner' | 'staff'
          full_name: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id: string
          email: string
          role: 'owner' | 'staff'
          full_name: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: 'owner' | 'staff'
          full_name?: string
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          name: string
          buy_price: number
          sell_price: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          buy_price: number
          sell_price: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          buy_price?: number
          sell_price?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      mitras: {
        Row: {
          id: string
          name: string
          address: string | null
          phone: string | null
          credit_limit: number
          max_pending_invoices: number
          status: 'active' | 'blocked'
          is_system: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          phone?: string | null
          credit_limit?: number
          max_pending_invoices?: number
          status?: 'active' | 'blocked'
          is_system?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          phone?: string | null
          credit_limit?: number
          max_pending_invoices?: number
          status?: 'active' | 'blocked'
          is_system?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      mitra_product_settings: {
        Row: {
          id: string
          mitra_id: string
          product_id: string
          custom_sell_price: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          mitra_id: string
          product_id: string
          custom_sell_price: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          mitra_id?: string
          product_id?: string
          custom_sell_price?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'mitra_product_settings_mitra_id_fkey'
            columns: ['mitra_id']
            isOneToOne: false
            referencedRelation: 'mitras'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mitra_product_settings_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          }
        ]
      }
      stocks: {
        Row: {
          product_id: string
          gudang_isi: number
          gudang_kosong: number
          gudang_bocor: number
          dipinjam_mitra: number
          updated_at: string
        }
        Insert: {
          product_id: string
          gudang_isi?: number
          gudang_kosong?: number
          gudang_bocor?: number
          dipinjam_mitra?: number
          updated_at?: string
        }
        Update: {
          product_id?: string
          gudang_isi?: number
          gudang_kosong?: number
          gudang_bocor?: number
          dipinjam_mitra?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'stocks_product_id_fkey'
            columns: ['product_id']
            isOneToOne: true
            referencedRelation: 'products'
            referencedColumns: ['id']
          }
        ]
      }
      mitra_product_balances: {
        Row: {
          id: string
          mitra_id: string
          product_id: string
          borrowed_qty: number
          updated_at: string
        }
        Insert: {
          id?: string
          mitra_id: string
          product_id: string
          borrowed_qty?: number
          updated_at?: string
        }
        Update: {
          id?: string
          mitra_id?: string
          product_id?: string
          borrowed_qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'mitra_product_balances_mitra_id_fkey'
            columns: ['mitra_id']
            isOneToOne: false
            referencedRelation: 'mitras'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mitra_product_balances_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          }
        ]
      }
      employees: {
        Row: {
          id: string
          name: string
          position: string
          base_salary: number
          allowance: number
          bonus_per_tabung: number
          join_date: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          position: string
          base_salary?: number
          allowance?: number
          bonus_per_tabung?: number
          join_date?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          position?: string
          base_salary?: number
          allowance?: number
          bonus_per_tabung?: number
          join_date?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          id: string
          mitra_id: string
          invoice_number: string
          transaction_date: string
          total_amount: number
          total_paid: number
          payment_status: 'pending' | 'partial' | 'lunas'
          due_date: string | null
          driver_id: string | null
          recipient_name: string | null
          photo_url: string | null
          notes: string | null
          is_legacy: boolean
          override_by: string | null
          override_reason: string | null
          created_by: string
          voided_at: string | null
          voided_by: string | null
          void_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          mitra_id: string
          invoice_number: string
          transaction_date?: string
          total_amount: number
          total_paid?: number
          payment_status?: 'pending' | 'partial' | 'lunas'
          due_date?: string | null
          driver_id?: string | null
          recipient_name?: string | null
          photo_url?: string | null
          notes?: string | null
          is_legacy?: boolean
          override_by?: string | null
          override_reason?: string | null
          created_by: string
          voided_at?: string | null
          voided_by?: string | null
          void_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          mitra_id?: string
          invoice_number?: string
          transaction_date?: string
          total_amount?: number
          total_paid?: number
          payment_status?: 'pending' | 'partial' | 'lunas'
          due_date?: string | null
          driver_id?: string | null
          recipient_name?: string | null
          photo_url?: string | null
          notes?: string | null
          is_legacy?: boolean
          override_by?: string | null
          override_reason?: string | null
          created_by?: string
          voided_at?: string | null
          voided_by?: string | null
          void_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'transactions_mitra_id_fkey'
            columns: ['mitra_id']
            isOneToOne: false
            referencedRelation: 'mitras'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'transactions_driver_id_fkey'
            columns: ['driver_id']
            isOneToOne: false
            referencedRelation: 'employees'
            referencedColumns: ['id']
          }
        ]
      }
      transaction_items: {
        Row: {
          id: string
          transaction_id: string
          product_id: string
          qty_sent_isi: number
          qty_returned_kosong: number
          buy_price_snapshot: number
          sell_price_snapshot: number
          bonus_snapshot_per_qty: number
          subtotal: number
          created_at: string
        }
        Insert: {
          id?: string
          transaction_id: string
          product_id: string
          qty_sent_isi: number
          qty_returned_kosong?: number
          buy_price_snapshot: number
          sell_price_snapshot: number
          bonus_snapshot_per_qty?: number
          subtotal: number
          created_at?: string
        }
        Update: {
          id?: string
          transaction_id?: string
          product_id?: string
          qty_sent_isi?: number
          qty_returned_kosong?: number
          buy_price_snapshot?: number
          sell_price_snapshot?: number
          bonus_snapshot_per_qty?: number
          subtotal?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'transaction_items_transaction_id_fkey'
            columns: ['transaction_id']
            isOneToOne: false
            referencedRelation: 'transactions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'transaction_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          }
        ]
      }
      payments: {
        Row: {
          id: string
          transaction_id: string
          amount: number
          payment_date: string
          method: 'tunai_laci' | 'transfer_bank'
          proof_url: string | null
          notes: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          transaction_id: string
          amount: number
          payment_date?: string
          method: 'tunai_laci' | 'transfer_bank'
          proof_url?: string | null
          notes?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          transaction_id?: string
          amount?: number
          payment_date?: string
          method?: 'tunai_laci' | 'transfer_bank'
          proof_url?: string | null
          notes?: string | null
          created_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'payments_transaction_id_fkey'
            columns: ['transaction_id']
            isOneToOne: false
            referencedRelation: 'transactions'
            referencedColumns: ['id']
          }
        ]
      }
      stock_movements: {
        Row: {
          id: string
          type:
            | 'in_from_supplier'
            | 'out_to_mitra'
            | 'return_from_mitra'
            | 'return_susulan'
            | 'bocor_gudang'
            | 'bocor_tukar_guling'
            | 'opname'
            | 'void_rollback'
          product_id: string
          quantity: number
          cost: number | null
          claimed_warranty: boolean
          linked_transaction_id: string | null
          notes: string | null
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          type:
            | 'in_from_supplier'
            | 'out_to_mitra'
            | 'return_from_mitra'
            | 'return_susulan'
            | 'bocor_gudang'
            | 'bocor_tukar_guling'
            | 'opname'
            | 'void_rollback'
          product_id: string
          quantity: number
          cost?: number | null
          claimed_warranty?: boolean
          linked_transaction_id?: string | null
          notes?: string | null
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          type?:
            | 'in_from_supplier'
            | 'out_to_mitra'
            | 'return_from_mitra'
            | 'return_susulan'
            | 'bocor_gudang'
            | 'bocor_tukar_guling'
            | 'opname'
            | 'void_rollback'
          product_id?: string
          quantity?: number
          cost?: number | null
          claimed_warranty?: boolean
          linked_transaction_id?: string | null
          notes?: string | null
          user_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'stock_movements_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'stock_movements_linked_transaction_id_fkey'
            columns: ['linked_transaction_id']
            isOneToOne: false
            referencedRelation: 'transactions'
            referencedColumns: ['id']
          }
        ]
      }
      payrolls: {
        Row: {
          id: string
          employee_id: string
          period_month: number
          period_year: number
          base_salary: number
          allowance: number
          bonus_delivery: number
          bonus_extra: number
          deduction_absence: number
          deduction_kasbon: number
          deduction_other: number
          gross_salary: number
          net_salary: number
          paid_source: 'kas_laci' | 'kas_bank'
          paid_date: string
          slip_pdf_url: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          period_month: number
          period_year: number
          base_salary: number
          allowance?: number
          bonus_delivery?: number
          bonus_extra?: number
          deduction_absence?: number
          deduction_kasbon?: number
          deduction_other?: number
          gross_salary: number
          net_salary: number
          paid_source: 'kas_laci' | 'kas_bank'
          paid_date?: string
          slip_pdf_url?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          period_month?: number
          period_year?: number
          base_salary?: number
          allowance?: number
          bonus_delivery?: number
          bonus_extra?: number
          deduction_absence?: number
          deduction_kasbon?: number
          deduction_other?: number
          gross_salary?: number
          net_salary?: number
          paid_source?: 'kas_laci' | 'kas_bank'
          paid_date?: string
          slip_pdf_url?: string | null
          created_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'payrolls_employee_id_fkey'
            columns: ['employee_id']
            isOneToOne: false
            referencedRelation: 'employees'
            referencedColumns: ['id']
          }
        ]
      }
      kasbons: {
        Row: {
          id: string
          employee_id: string
          amount: number
          remaining_amount: number
          kasbon_date: string
          notes: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          amount: number
          remaining_amount: number
          kasbon_date?: string
          notes?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          amount?: number
          remaining_amount?: number
          kasbon_date?: string
          notes?: string | null
          created_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'kasbons_employee_id_fkey'
            columns: ['employee_id']
            isOneToOne: false
            referencedRelation: 'employees'
            referencedColumns: ['id']
          }
        ]
      }
      kasbon_repayments: {
        Row: {
          id: string
          kasbon_id: string
          payroll_id: string
          amount: number
          created_at: string
        }
        Insert: {
          id?: string
          kasbon_id: string
          payroll_id: string
          amount: number
          created_at?: string
        }
        Update: {
          id?: string
          kasbon_id?: string
          payroll_id?: string
          amount?: number
          created_at?: string
        }
        Relationships: []
      }
      cashflows: {
        Row: {
          id: string
          type:
            | 'initial_balance'
            | 'in_sale'
            | 'in_payment'
            | 'out_supplier'
            | 'out_salary'
            | 'out_kasbon'
            | 'out_operational'
            | 'out_void_refund'
            | 'transfer'
          amount: number
          direction: 'in' | 'out'
          source: 'kas_laci' | 'kas_bank'
          transfer_group_id: string | null
          description: string
          reference_id: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          type:
            | 'initial_balance'
            | 'in_sale'
            | 'in_payment'
            | 'out_supplier'
            | 'out_salary'
            | 'out_kasbon'
            | 'out_operational'
            | 'out_void_refund'
            | 'transfer'
          amount: number
          direction: 'in' | 'out'
          source: 'kas_laci' | 'kas_bank'
          transfer_group_id?: string | null
          description: string
          reference_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          type?:
            | 'initial_balance'
            | 'in_sale'
            | 'in_payment'
            | 'out_supplier'
            | 'out_salary'
            | 'out_kasbon'
            | 'out_operational'
            | 'out_void_refund'
            | 'transfer'
          amount?: number
          direction?: 'in' | 'out'
          source?: 'kas_laci' | 'kas_bank'
          transfer_group_id?: string | null
          description?: string
          reference_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string
          target_table: string | null
          target_id: string | null
          old_value: Json | null
          new_value: Json | null
          reason: string | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          target_table?: string | null
          target_id?: string | null
          old_value?: Json | null
          new_value?: Json | null
          reason?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          target_table?: string | null
          target_id?: string | null
          old_value?: Json | null
          new_value?: Json | null
          reason?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Relationships: []
      }
      invoice_counters: {
        Row: {
          date: string
          counter: number
        }
        Insert: {
          date: string
          counter?: number
        }
        Update: {
          date?: string
          counter?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      wib_today: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_my_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_owner: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_staff_or_owner: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      get_cash_balance: {
        Args: { p_source: string }
        Returns: number
      }
      rpc_get_active_drivers: {
        Args: Record<PropertyKey, never>
        Returns: Array<{
          id: string
          name: string
          position: string
        }>
      }
      rpc_onboarding_setup: {
        Args: {
          p_kas_laci: number
          p_kas_bank: number
          p_tanggal: string
          p_stok_awal: Json
          p_piutang_lama: Json
          p_catatan?: string
        }
        Returns: undefined
      }
      rpc_create_transaction_sale: {
        Args: {
          p_mitra_id: string
          p_driver_id: string | null
          p_items: Json
          p_payment_method: string
          p_dp_amount?: number
          p_dp_method?: string
          p_due_date?: string | null
          p_transaction_date?: string | null
          p_recipient_name?: string | null
          p_photo_url?: string | null
          p_notes?: string | null
          p_override_token?: string | null
          p_override_reason?: string | null
        }
        Returns: string
      }
      rpc_restock_from_supplier: {
        Args: {
          p_product_id: string
          p_qty_isi_datang: number
          p_qty_kosong_diserahkan: number
          p_qty_bocor_retur: number
          p_bocor_klaim_garansi: boolean
          p_source: string
          p_notes?: string
        }
        Returns: number
      }
      rpc_report_bocor: {
        Args: {
          p_product_id: string
          p_qty: number
          p_notes: string
        }
        Returns: undefined
      }
      rpc_tukar_guling: {
        Args: {
          p_mitra_id: string
          p_product_id: string
          p_qty: number
          p_photo_url?: string | null
          p_notes?: string
        }
        Returns: undefined
      }
      rpc_stock_opname: {
        Args: {
          p_items: Json
          p_reason: string
        }
        Returns: undefined
      }
      rpc_receive_susulan: {
        Args: {
          p_mitra_id: string
          p_returns: Json
          p_notes?: string
        }
        Returns: undefined
      }
      rpc_pay_receivable: {
        Args: {
          p_transaction_id: string
          p_amount: number
          p_payment_date?: string | null
          p_method?: string
          p_proof_url?: string | null
          p_notes?: string
        }
        Returns: Json
      }
      rpc_void_transaction: {
        Args: {
          p_transaction_id: string
          p_void_reason: string
        }
        Returns: undefined
      }
      rpc_create_kasbon: {
        Args: {
          p_employee_id: string
          p_amount: number
          p_kasbon_date?: string | null
          p_source?: string
          p_notes?: string
        }
        Returns: string
      }
      rpc_process_payroll: {
        Args: {
          p_payrolls: Json
        }
        Returns: Json
      }
      rpc_cash_transfer: {
        Args: {
          p_amount: number
          p_from_source: string
          p_to_source: string
          p_description?: string
        }
        Returns: string
      }
      rpc_create_operational_expense: {
        Args: {
          p_amount: number
          p_source: string
          p_description: string
        }
        Returns: string
      }
      rpc_get_profit_loss_report: {
        Args: {
          p_start_date: string
          p_end_date: string
        }
        Returns: {
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
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
