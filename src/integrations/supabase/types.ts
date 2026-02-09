export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          org_id: string
          payload: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          org_id?: string
          payload?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          org_id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          org_id?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      business_expenses: {
        Row: {
          amount_cop: number
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          incurred_at: string | null
          operation_id: string | null
          org_id: string
          updated_at: string
          vendor_profile_id: string | null
          work_order_item_id: string | null
        }
        Insert: {
          amount_cop: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          incurred_at?: string | null
          operation_id?: string | null
          org_id?: string
          updated_at?: string
          vendor_profile_id?: string | null
          work_order_item_id?: string | null
        }
        Update: {
          amount_cop?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          incurred_at?: string | null
          operation_id?: string | null
          org_id?: string
          updated_at?: string
          vendor_profile_id?: string | null
          work_order_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_expenses_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operation_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_expenses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_expenses_vendor_profile_id_fkey"
            columns: ["vendor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_expenses_work_order_item_id_fkey"
            columns: ["work_order_item_id"]
            isOneToOne: false
            referencedRelation: "work_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          document_id: string | null
          email: string | null
          full_name: string
          id: string
          org_id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          email?: string | null
          full_name: string
          id?: string
          org_id?: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          document_id?: string | null
          email?: string | null
          full_name?: string
          id?: string
          org_id?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_documents: {
        Row: {
          created_at: string
          customer_id: string | null
          doc_type: string
          id: string
          org_id: string
          reservation_id: string | null
          sale_id: string | null
          storage_bucket: string
          storage_path: string
          uploaded_by: string | null
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          doc_type: string
          id?: string
          org_id?: string
          reservation_id?: string | null
          sale_id?: string | null
          storage_bucket: string
          storage_path: string
          uploaded_by?: string | null
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          doc_type?: string
          id?: string
          org_id?: string
          reservation_id?: string | null
          sale_id?: string | null
          storage_bucket?: string
          storage_path?: string
          uploaded_by?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_documents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_documents_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_documents_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_catalog: {
        Row: {
          category: string
          code: string
          created_at: string
          description: string | null
          financial_kind: string
          id: string
          is_active: boolean
          name: string
          org_id: string
          scope: string
          updated_at: string
        }
        Insert: {
          category?: string
          code: string
          created_at?: string
          description?: string | null
          financial_kind: string
          id?: string
          is_active?: boolean
          name: string
          org_id?: string
          scope: string
          updated_at?: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          description?: string | null
          financial_kind?: string
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operation_catalog_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          code: string
          created_at: string
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          created_at: string
          description: string | null
          key: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          branch_id: string | null
          created_at: string
          full_name: string | null
          id: string
          is_active: boolean
          org_id: string
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          is_active?: boolean
          org_id: string
          phone?: string | null
          role: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          org_id?: string
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_by: string | null
          customer_id: string
          deposit_amount_cop: number
          id: string
          notes: string | null
          org_id: string
          payment_method_code: string
          reserved_at: string
          status: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_by?: string | null
          customer_id: string
          deposit_amount_cop: number
          id?: string
          notes?: string | null
          org_id?: string
          payment_method_code: string
          reserved_at?: string
          status?: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_by?: string | null
          customer_id?: string
          deposit_amount_cop?: number
          id?: string
          notes?: string | null
          org_id?: string
          payment_method_code?: string
          reserved_at?: string
          status?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_payment_method_code_fkey"
            columns: ["payment_method_code"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "reservations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_key: string
          role: string
        }
        Insert: {
          permission_key: string
          role: string
        }
        Update: {
          permission_key?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      sale_payments: {
        Row: {
          amount_cop: number
          created_by: string | null
          direction: string
          id: string
          notes: string | null
          org_id: string
          paid_at: string
          payment_method_code: string
          sale_id: string
        }
        Insert: {
          amount_cop: number
          created_by?: string | null
          direction?: string
          id?: string
          notes?: string | null
          org_id?: string
          paid_at?: string
          payment_method_code: string
          sale_id: string
        }
        Update: {
          amount_cop?: number
          created_by?: string | null
          direction?: string
          id?: string
          notes?: string | null
          org_id?: string
          paid_at?: string
          payment_method_code?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_payments_payment_method_code_fkey"
            columns: ["payment_method_code"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          final_price_cop: number
          id: string
          notes: string | null
          org_id: string
          payment_method_code: string
          reservation_id: string | null
          return_stage_code: string | null
          sale_date: string
          status: string
          updated_at: string
          vehicle_id: string
          vehicle_snapshot: Json
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          final_price_cop: number
          id?: string
          notes?: string | null
          org_id?: string
          payment_method_code: string
          reservation_id?: string | null
          return_stage_code?: string | null
          sale_date?: string
          status?: string
          updated_at?: string
          vehicle_id: string
          vehicle_snapshot?: Json
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          final_price_cop?: number
          id?: string
          notes?: string | null
          org_id?: string
          payment_method_code?: string
          reservation_id?: string | null
          return_stage_code?: string | null
          sale_date?: string
          status?: string
          updated_at?: string
          vehicle_id?: string
          vehicle_snapshot?: Json
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_payment_method_code_fkey"
            columns: ["payment_method_code"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "sales_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_stage_code_fkey"
            columns: ["return_stage_code"]
            isOneToOne: false
            referencedRelation: "vehicle_stages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "sales_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permission_overrides: {
        Row: {
          allowed: boolean
          created_at: string
          permission_key: string
          user_id: string
        }
        Insert: {
          allowed: boolean
          created_at?: string
          permission_key: string
          user_id: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          permission_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_overrides_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "user_permission_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_compliance: {
        Row: {
          compliance_notes: string | null
          fines_amount_cop: number
          has_fines: boolean
          org_id: string
          soat_expires_at: string | null
          tecnomecanica_expires_at: string | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          compliance_notes?: string | null
          fines_amount_cop?: number
          has_fines?: boolean
          org_id: string
          soat_expires_at?: string | null
          tecnomecanica_expires_at?: string | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          compliance_notes?: string | null
          fines_amount_cop?: number
          has_fines?: boolean
          org_id?: string
          soat_expires_at?: string | null
          tecnomecanica_expires_at?: string | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_compliance_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_compliance_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: true
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_expenses: {
        Row: {
          amount_cop: number
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          incurred_at: string | null
          operation_id: string | null
          org_id: string
          phase_code: string
          updated_at: string
          vehicle_id: string
          vendor_profile_id: string | null
          work_order_item_id: string | null
        }
        Insert: {
          amount_cop: number
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          incurred_at?: string | null
          operation_id?: string | null
          org_id?: string
          phase_code: string
          updated_at?: string
          vehicle_id: string
          vendor_profile_id?: string | null
          work_order_item_id?: string | null
        }
        Update: {
          amount_cop?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          incurred_at?: string | null
          operation_id?: string | null
          org_id?: string
          phase_code?: string
          updated_at?: string
          vehicle_id?: string
          vendor_profile_id?: string | null
          work_order_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_expenses_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operation_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_expenses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_expenses_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_expenses_vendor_profile_id_fkey"
            columns: ["vendor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_expenses_work_order_item_id_fkey"
            columns: ["work_order_item_id"]
            isOneToOne: false
            referencedRelation: "work_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_files: {
        Row: {
          created_at: string
          doc_type: string | null
          expires_at: string | null
          file_kind: string
          file_name: string | null
          id: string
          mime_type: string | null
          org_id: string
          storage_bucket: string
          storage_path: string
          uploaded_by: string | null
          vehicle_id: string
          visibility: string
        }
        Insert: {
          created_at?: string
          doc_type?: string | null
          expires_at?: string | null
          file_kind: string
          file_name?: string | null
          id?: string
          mime_type?: string | null
          org_id?: string
          storage_bucket: string
          storage_path: string
          uploaded_by?: string | null
          vehicle_id: string
          visibility?: string
        }
        Update: {
          created_at?: string
          doc_type?: string | null
          expires_at?: string | null
          file_kind?: string
          file_name?: string | null
          id?: string
          mime_type?: string | null
          org_id?: string
          storage_bucket?: string
          storage_path?: string
          uploaded_by?: string | null
          vehicle_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_files_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_files_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_financials: {
        Row: {
          org_id: string
          purchase_date: string | null
          purchase_price_cop: number | null
          supplier_name: string | null
          tax_schema: Json
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          org_id: string
          purchase_date?: string | null
          purchase_price_cop?: number | null
          supplier_name?: string | null
          tax_schema?: Json
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          org_id?: string
          purchase_date?: string | null
          purchase_price_cop?: number | null
          supplier_name?: string | null
          tax_schema?: Json
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_financials_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_financials_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: true
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_listing: {
        Row: {
          field_mask: Json
          is_listed: boolean
          listed_price_cop: number | null
          org_id: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          field_mask?: Json
          is_listed?: boolean
          listed_price_cop?: number | null
          org_id: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          field_mask?: Json
          is_listed?: boolean
          listed_price_cop?: number | null
          org_id?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_listing_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_listing_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: true
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_property_card: {
        Row: {
          expiry_date: string | null
          import_date: string | null
          import_declaration: string | null
          issue_date: string | null
          mobility_restriction: string | null
          org_id: string
          owner_identification: string | null
          owner_name: string | null
          property_card_number: string | null
          property_limitation: string | null
          registration_date: string | null
          transit_agency: string | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          expiry_date?: string | null
          import_date?: string | null
          import_declaration?: string | null
          issue_date?: string | null
          mobility_restriction?: string | null
          org_id: string
          owner_identification?: string | null
          owner_name?: string | null
          property_card_number?: string | null
          property_limitation?: string | null
          registration_date?: string | null
          transit_agency?: string | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          expiry_date?: string | null
          import_date?: string | null
          import_declaration?: string | null
          issue_date?: string | null
          mobility_restriction?: string | null
          org_id?: string
          owner_identification?: string | null
          owner_name?: string | null
          property_card_number?: string | null
          property_limitation?: string | null
          registration_date?: string | null
          transit_agency?: string | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_property_card_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_property_card_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: true
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_stage_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_stage_code: string | null
          id: string
          metadata: Json
          note: string | null
          org_id: string
          to_stage_code: string
          vehicle_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_stage_code?: string | null
          id?: string
          metadata?: Json
          note?: string | null
          org_id: string
          to_stage_code: string
          vehicle_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_stage_code?: string | null
          id?: string
          metadata?: Json
          note?: string | null
          org_id?: string
          to_stage_code?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_stage_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_stage_history_from_stage_code_fkey"
            columns: ["from_stage_code"]
            isOneToOne: false
            referencedRelation: "vehicle_stages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "vehicle_stage_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_stage_history_to_stage_code_fkey"
            columns: ["to_stage_code"]
            isOneToOne: false
            referencedRelation: "vehicle_stages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "vehicle_stage_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_stages: {
        Row: {
          code: string
          created_at: string
          is_terminal: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          is_terminal?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          is_terminal?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          body_type: string | null
          branch_id: string | null
          brand: string
          capacity_passengers: number | null
          chassis_number: string | null
          color: string | null
          created_at: string
          doors: number | null
          engine_displacement_cc: number | null
          engine_number: string | null
          fuel_type: string | null
          horsepower_hp: number | null
          id: string
          is_archived: boolean
          license_plate: string | null
          line: string | null
          mileage_km: number | null
          model_year: number | null
          org_id: string
          serial_number: string | null
          service_type: string | null
          sold_at: string | null
          sold_by: string | null
          sold_sale_id: string | null
          stage_code: string
          transmission: string | null
          updated_at: string
          vehicle_class: string | null
          vin: string | null
        }
        Insert: {
          body_type?: string | null
          branch_id?: string | null
          brand: string
          capacity_passengers?: number | null
          chassis_number?: string | null
          color?: string | null
          created_at?: string
          doors?: number | null
          engine_displacement_cc?: number | null
          engine_number?: string | null
          fuel_type?: string | null
          horsepower_hp?: number | null
          id?: string
          is_archived?: boolean
          license_plate?: string | null
          line?: string | null
          mileage_km?: number | null
          model_year?: number | null
          org_id: string
          serial_number?: string | null
          service_type?: string | null
          sold_at?: string | null
          sold_by?: string | null
          sold_sale_id?: string | null
          stage_code: string
          transmission?: string | null
          updated_at?: string
          vehicle_class?: string | null
          vin?: string | null
        }
        Update: {
          body_type?: string | null
          branch_id?: string | null
          brand?: string
          capacity_passengers?: number | null
          chassis_number?: string | null
          color?: string | null
          created_at?: string
          doors?: number | null
          engine_displacement_cc?: number | null
          engine_number?: string | null
          fuel_type?: string | null
          horsepower_hp?: number | null
          id?: string
          is_archived?: boolean
          license_plate?: string | null
          line?: string | null
          mileage_km?: number | null
          model_year?: number | null
          org_id?: string
          serial_number?: string | null
          service_type?: string | null
          sold_at?: string | null
          sold_by?: string | null
          sold_sale_id?: string | null
          stage_code?: string
          transmission?: string | null
          updated_at?: string
          vehicle_class?: string | null
          vin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_sold_by_fkey"
            columns: ["sold_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_sold_sale_id_fkey"
            columns: ["sold_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_stage_code_fkey"
            columns: ["stage_code"]
            isOneToOne: false
            referencedRelation: "vehicle_stages"
            referencedColumns: ["code"]
          },
        ]
      }
      work_order_items: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          due_date: string | null
          id: string
          notes: string | null
          operation_id: string | null
          org_id: string
          status: string
          title: string
          updated_at: string
          work_order_id: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          operation_id?: string | null
          org_id?: string
          status?: string
          title: string
          updated_at?: string
          work_order_id: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          operation_id?: string | null
          org_id?: string
          status?: string
          title?: string
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_items_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_items_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operation_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_items_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string | null
          org_id: string
          scope: string
          status: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          org_id?: string
          scope: string
          status?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          org_id?: string
          scope?: string
          status?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      app_current_org_id: { Args: never; Returns: string }
      app_current_role: { Args: never; Returns: string }
      app_has_permission: { Args: { p_key: string }; Returns: boolean }
      app_is_admin: { Args: never; Returns: boolean }
      app_is_role: { Args: { role_name: string }; Returns: boolean }
      app_path_org_id: { Args: { object_name: string }; Returns: string }
      backfill_archive_sold: { Args: never; Returns: number }
      convert_reservation_to_sale: {
        Args: {
          p_final_price_cop: number
          p_notes?: string | null
          p_payment_method_code: string
          p_register_deposit_as_payment?: boolean
          p_reservation_id: string
        }
        Returns: string
      }
      mark_vehicle_sold: {
        Args: { p_sale_id: string; p_vehicle_id: string }
        Returns: undefined
      }
      transition_vehicle_stage: {
        Args: { p_target_stage: string; p_vehicle_id: string }
        Returns: undefined
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
