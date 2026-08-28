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
    PostgrestVersion: "14.17"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          target_id: string
          target_owner_id: string | null
          target_snapshot: Json | null
          target_table: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          target_id: string
          target_owner_id?: string | null
          target_snapshot?: Json | null
          target_table: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          target_id?: string
          target_owner_id?: string | null
          target_snapshot?: Json | null
          target_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "aal_admin_id_profile_fk"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      advanced_proposals: {
        Row: {
          blueprint_id: string | null
          blueprint_version: number
          brand_profile_id: string | null
          client_id: string | null
          created_at: string
          current_section_index: number
          id: string
          organization_id: string
          owner_id: string
          status: string
          title: string
          total_sections: number
          updated_at: string
        }
        Insert: {
          blueprint_id?: string | null
          blueprint_version?: number
          brand_profile_id?: string | null
          client_id?: string | null
          created_at?: string
          current_section_index?: number
          id?: string
          organization_id: string
          owner_id: string
          status?: string
          title?: string
          total_sections?: number
          updated_at?: string
        }
        Update: {
          blueprint_id?: string | null
          blueprint_version?: number
          brand_profile_id?: string | null
          client_id?: string | null
          created_at?: string
          current_section_index?: number
          id?: string
          organization_id?: string
          owner_id?: string
          status?: string
          title?: string
          total_sections?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "advanced_proposals_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "proposal_blueprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advanced_proposals_brand_profile_id_fkey"
            columns: ["brand_profile_id"]
            isOneToOne: false
            referencedRelation: "company_brand_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advanced_proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advanced_proposals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      business_categories: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      catalog_items: {
        Row: {
          created_at: string
          id: string
          nome: string
          organization_id: string | null
          owner_id: string
          preco_unitario: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          organization_id?: string | null
          owner_id: string
          preco_unitario?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          organization_id?: string | null
          owner_id?: string
          preco_unitario?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          cargo: string | null
          created_at: string
          email: string | null
          empresa: string | null
          endereco: string | null
          estado_comercial: Database["public"]["Enums"]["crm_estado"] | null
          id: string
          nome: string
          notas: string | null
          nuit: string | null
          organization_id: string | null
          origem: Database["public"]["Enums"]["crm_origem"] | null
          owner_id: string
          proximo_contacto: string | null
          responsavel_id: string | null
          telefone: string | null
          tipo: string | null
          ultimo_contacto: string | null
          updated_at: string
          valor_potencial: number | null
          whatsapp: string | null
        }
        Insert: {
          cargo?: string | null
          created_at?: string
          email?: string | null
          empresa?: string | null
          endereco?: string | null
          estado_comercial?: Database["public"]["Enums"]["crm_estado"] | null
          id?: string
          nome: string
          notas?: string | null
          nuit?: string | null
          organization_id?: string | null
          origem?: Database["public"]["Enums"]["crm_origem"] | null
          owner_id: string
          proximo_contacto?: string | null
          responsavel_id?: string | null
          telefone?: string | null
          tipo?: string | null
          ultimo_contacto?: string | null
          updated_at?: string
          valor_potencial?: number | null
          whatsapp?: string | null
        }
        Update: {
          cargo?: string | null
          created_at?: string
          email?: string | null
          empresa?: string | null
          endereco?: string | null
          estado_comercial?: Database["public"]["Enums"]["crm_estado"] | null
          id?: string
          nome?: string
          notas?: string | null
          nuit?: string | null
          organization_id?: string | null
          origem?: Database["public"]["Enums"]["crm_origem"] | null
          owner_id?: string
          proximo_contacto?: string | null
          responsavel_id?: string | null
          telefone?: string | null
          tipo?: string | null
          ultimo_contacto?: string | null
          updated_at?: string
          valor_potencial?: number | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_brand_profiles: {
        Row: {
          accent_color: string | null
          created_at: string
          font_preference: string | null
          id: string
          logo_colors_extracted: Json
          organization_id: string
          primary_color: string | null
          secondary_color: string | null
          updated_at: string
          visual_style: Database["public"]["Enums"]["visual_style"] | null
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          font_preference?: string | null
          id?: string
          logo_colors_extracted?: Json
          organization_id: string
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
          visual_style?: Database["public"]["Enums"]["visual_style"] | null
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          font_preference?: string | null
          id?: string
          logo_colors_extracted?: Json
          organization_id?: string
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
          visual_style?: Database["public"]["Enums"]["visual_style"] | null
        }
        Relationships: [
          {
            foreignKeyName: "company_brand_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activities: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          id: string
          organization_id: string
          performed_at: string
          performed_by: string
          proposal_id: string | null
          title: string
          type: Database["public"]["Enums"]["crm_activity_type"]
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          organization_id: string
          performed_at?: string
          performed_by: string
          proposal_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["crm_activity_type"]
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          organization_id?: string
          performed_at?: string
          performed_by?: string
          proposal_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["crm_activity_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contact_tags: {
        Row: {
          client_id: string
          created_at: string
          tag_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          tag_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_contact_tags_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contact_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "crm_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_follow_ups: {
        Row: {
          client_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string
          description: string | null
          due_at: string
          id: string
          organization_id: string
          proposal_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_at: string
          id?: string
          organization_id: string
          proposal_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_at?: string
          id?: string
          organization_id?: string
          proposal_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_follow_ups_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_follow_ups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_follow_ups_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          nome: string
          ordem: number
          preco_unitario: number
          quantidade: number
          subtotal: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          nome: string
          ordem?: number
          preco_unitario?: number
          quantidade?: number
          subtotal?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          nome?: string
          ordem?: number
          preco_unitario?: number
          quantidade?: number
          subtotal?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          data_emissao: string
          data_vencimento: string | null
          id: string
          numero: string | null
          organization_id: string | null
          owner_id: string
          proposal_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          total: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          data_vencimento?: string | null
          id?: string
          numero?: string | null
          organization_id?: string | null
          owner_id: string
          proposal_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          data_vencimento?: string | null
          id?: string
          numero?: string | null
          organization_id?: string | null
          owner_id?: string
          proposal_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          nome: string | null
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          token: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          nome?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          token?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          nome?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          display_name: string | null
          id: string
          invited_by: string | null
          joined_at: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          display_name?: string | null
          id?: string
          invited_by?: string | null
          joined_at?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          display_name?: string | null
          id?: string
          invited_by?: string | null
          joined_at?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "om_user_id_profile_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          contact_email: string | null
          cor_primaria: string | null
          created_at: string
          geracoes_ia_mes_count: number
          geracoes_ia_mes_reset_at: string
          id: string
          last_proposal_created_at: string | null
          logo_url: string | null
          monthly_price: number | null
          nome: string
          notes: string | null
          nuit: string | null
          plano: Database["public"]["Enums"]["plan_tier"]
          propostas_mes_count: number
          propostas_mes_reset_at: string
          slug: string
          suspended_at: string | null
          suspension_reason: string | null
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          cor_primaria?: string | null
          created_at?: string
          geracoes_ia_mes_count?: number
          geracoes_ia_mes_reset_at?: string
          id?: string
          last_proposal_created_at?: string | null
          logo_url?: string | null
          monthly_price?: number | null
          nome: string
          notes?: string | null
          nuit?: string | null
          plano?: Database["public"]["Enums"]["plan_tier"]
          propostas_mes_count?: number
          propostas_mes_reset_at?: string
          slug: string
          suspended_at?: string | null
          suspension_reason?: string | null
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          cor_primaria?: string | null
          created_at?: string
          geracoes_ia_mes_count?: number
          geracoes_ia_mes_reset_at?: string
          id?: string
          last_proposal_created_at?: string | null
          logo_url?: string | null
          monthly_price?: number | null
          nome?: string
          notes?: string | null
          nuit?: string | null
          plano?: Database["public"]["Enums"]["plan_tier"]
          propostas_mes_count?: number
          propostas_mes_reset_at?: string
          slug?: string
          suspended_at?: string | null
          suspension_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pdf_templates: {
        Row: {
          created_at: string
          created_by: string
          descricao: string | null
          html: string
          id: string
          is_active: boolean
          is_system: boolean
          nome: string
          organization_id: string | null
          plan_tier: Database["public"]["Enums"]["plan_tier"] | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          descricao?: string | null
          html: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          nome: string
          organization_id?: string | null
          plan_tier?: Database["public"]["Enums"]["plan_tier"] | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          descricao?: string | null
          html?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          nome?: string
          organization_id?: string | null
          plan_tier?: Database["public"]["Enums"]["plan_tier"] | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdf_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_features: {
        Row: {
          created_at: string
          enabled: boolean
          feature_key: string
          limit_value: number | null
          plano: Database["public"]["Enums"]["plan_tier"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature_key: string
          limit_value?: number | null
          plano: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature_key?: string
          limit_value?: number | null
          plano?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      plan_limits: {
        Row: {
          clientes_max: number | null
          geracoes_ia_mes: number
          plano: Database["public"]["Enums"]["plan_tier"]
          propostas_mes: number
          templates_pdf: string[]
        }
        Insert: {
          clientes_max?: number | null
          geracoes_ia_mes?: number
          plano: Database["public"]["Enums"]["plan_tier"]
          propostas_mes: number
          templates_pdf?: string[]
        }
        Update: {
          clientes_max?: number | null
          geracoes_ia_mes?: number
          plano?: Database["public"]["Enums"]["plan_tier"]
          propostas_mes?: number
          templates_pdf?: string[]
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          active: boolean
          email: string
          granted_at: string
          granted_by: string | null
          notes: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          email: string
          granted_at?: string
          granted_by?: string | null
          notes?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          email?: string
          granted_at?: string
          granted_by?: string | null
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cargo: string | null
          contacto: string | null
          cor_primaria: string | null
          created_at: string
          dados_bancarios: Json
          email: string
          empresa: string | null
          endereco: string | null
          id: string
          last_seen_at: string | null
          logotipo_url: string | null
          mobile_money: Json
          nome: string | null
          nuit: string | null
          organization_id: string | null
          plano: Database["public"]["Enums"]["plan_tier"]
          propostas_mes_count: number
          propostas_mes_reset_at: string
          updated_at: string
        }
        Insert: {
          cargo?: string | null
          contacto?: string | null
          cor_primaria?: string | null
          created_at?: string
          dados_bancarios?: Json
          email: string
          empresa?: string | null
          endereco?: string | null
          id: string
          last_seen_at?: string | null
          logotipo_url?: string | null
          mobile_money?: Json
          nome?: string | null
          nuit?: string | null
          organization_id?: string | null
          plano?: Database["public"]["Enums"]["plan_tier"]
          propostas_mes_count?: number
          propostas_mes_reset_at?: string
          updated_at?: string
        }
        Update: {
          cargo?: string | null
          contacto?: string | null
          cor_primaria?: string | null
          created_at?: string
          dados_bancarios?: Json
          email?: string
          empresa?: string | null
          endereco?: string | null
          id?: string
          last_seen_at?: string | null
          logotipo_url?: string | null
          mobile_money?: Json
          nome?: string | null
          nuit?: string | null
          organization_id?: string | null
          plano?: Database["public"]["Enums"]["plan_tier"]
          propostas_mes_count?: number
          propostas_mes_reset_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_blueprints: {
        Row: {
          active: boolean
          business_category_id: string
          created_at: string
          created_by: string | null
          description: string | null
          estimated_pages: number | null
          id: string
          is_default: boolean
          name: string
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          business_category_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_pages?: number | null
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          business_category_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_pages?: number | null
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_blueprints_business_category_id_fkey"
            columns: ["business_category_id"]
            isOneToOne: false
            referencedRelation: "business_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_items: {
        Row: {
          created_at: string
          id: string
          nome: string
          ordem: number
          preco_unitario: number
          proposal_id: string
          quantidade: number
          subtotal: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          preco_unitario?: number
          proposal_id: string
          quantidade?: number
          subtotal?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          preco_unitario?: number
          proposal_id?: string
          quantidade?: number
          subtotal?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_section_answers: {
        Row: {
          advanced_proposal_id: string
          ai_content: string | null
          ai_model: string | null
          ai_tokens_used: number | null
          answers: Json
          content_status: string
          created_at: string
          edited_at: string | null
          edited_content: string | null
          error_message: string | null
          generated_at: string | null
          id: string
          section_id: string
          section_order: number
          section_title: string
          updated_at: string
        }
        Insert: {
          advanced_proposal_id: string
          ai_content?: string | null
          ai_model?: string | null
          ai_tokens_used?: number | null
          answers?: Json
          content_status?: string
          created_at?: string
          edited_at?: string | null
          edited_content?: string | null
          error_message?: string | null
          generated_at?: string | null
          id?: string
          section_id: string
          section_order?: number
          section_title?: string
          updated_at?: string
        }
        Update: {
          advanced_proposal_id?: string
          ai_content?: string | null
          ai_model?: string | null
          ai_tokens_used?: number | null
          answers?: Json
          content_status?: string
          created_at?: string
          edited_at?: string | null
          edited_content?: string | null
          error_message?: string | null
          generated_at?: string | null
          id?: string
          section_id?: string
          section_order?: number
          section_title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_section_answers_advanced_proposal_id_fkey"
            columns: ["advanced_proposal_id"]
            isOneToOne: false
            referencedRelation: "advanced_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_section_answers_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "proposal_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_sections: {
        Row: {
          blueprint_id: string
          content_rules: Json
          created_at: string
          id: string
          order: number
          required: boolean
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          blueprint_id: string
          content_rules?: Json
          created_at?: string
          id?: string
          order?: number
          required?: boolean
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          blueprint_id?: string
          content_rules?: Json
          created_at?: string
          id?: string
          order?: number
          required?: boolean
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_sections_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "proposal_blueprints"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          blueprint_id: string | null
          client_id: string
          cliente_snapshot: Json | null
          created_at: string
          created_by: string | null
          data: string
          desconto_tipo: Database["public"]["Enums"]["desconto_tipo"]
          desconto_valor: number
          id: string
          iva_percentual: number
          numero: string
          observacoes: string | null
          organization_id: string | null
          owner_id: string
          status: Database["public"]["Enums"]["proposal_status"]
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          blueprint_id?: string | null
          client_id: string
          cliente_snapshot?: Json | null
          created_at?: string
          created_by?: string | null
          data?: string
          desconto_tipo?: Database["public"]["Enums"]["desconto_tipo"]
          desconto_valor?: number
          id?: string
          iva_percentual?: number
          numero: string
          observacoes?: string | null
          organization_id?: string | null
          owner_id: string
          status?: Database["public"]["Enums"]["proposal_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          blueprint_id?: string | null
          client_id?: string
          cliente_snapshot?: Json | null
          created_at?: string
          created_by?: string | null
          data?: string
          desconto_tipo?: Database["public"]["Enums"]["desconto_tipo"]
          desconto_valor?: number
          id?: string
          iva_percentual?: number
          numero?: string
          observacoes?: string | null
          organization_id?: string | null
          owner_id?: string
          status?: Database["public"]["Enums"]["proposal_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "proposal_blueprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_ai: {
        Row: {
          cotacao_id: string
          created_at: string
          custo_usd: number | null
          edited_json: Json | null
          exportado_em: string | null
          gerado_em: string | null
          id: string
          input_json: Json | null
          mode: string
          modelo: string | null
          organization_id: string | null
          output_json: Json | null
          referencia: string | null
          sector: string | null
          tokens_usados: number | null
          tone: string
          user_id: string
        }
        Insert: {
          cotacao_id: string
          created_at?: string
          custo_usd?: number | null
          edited_json?: Json | null
          exportado_em?: string | null
          gerado_em?: string | null
          id?: string
          input_json?: Json | null
          mode?: string
          modelo?: string | null
          organization_id?: string | null
          output_json?: Json | null
          referencia?: string | null
          sector?: string | null
          tokens_usados?: number | null
          tone?: string
          user_id: string
        }
        Update: {
          cotacao_id?: string
          created_at?: string
          custo_usd?: number | null
          edited_json?: Json | null
          exportado_em?: string | null
          gerado_em?: string | null
          id?: string
          input_json?: Json | null
          mode?: string
          modelo?: string | null
          organization_id?: string | null
          output_json?: Json | null
          referencia?: string | null
          sector?: string | null
          tokens_usados?: number | null
          tone?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposta_ai_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_ai_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      section_questions: {
        Row: {
          created_at: string
          id: string
          order: number
          placeholder: string | null
          question_text: string
          question_type: string
          required: boolean
          section_id: string
          updated_at: string
          visibility_rules: Json
        }
        Insert: {
          created_at?: string
          id?: string
          order?: number
          placeholder?: string | null
          question_text: string
          question_type?: string
          required?: boolean
          section_id: string
          updated_at?: string
          visibility_rules?: Json
        }
        Update: {
          created_at?: string
          id?: string
          order?: number
          placeholder?: string | null
          question_text?: string
          question_type?: string
          required?: boolean
          section_id?: string
          updated_at?: string
          visibility_rules?: Json
        }
        Relationships: [
          {
            foreignKeyName: "section_questions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "proposal_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plano: Database["public"]["Enums"]["plan_tier"]
          provider: string
          provider_subscription_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plano?: Database["public"]["Enums"]["plan_tier"]
          provider?: string
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plano?: Database["public"]["Enums"]["plan_tier"]
          provider?: string
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_activity: {
        Row: {
          created_at: string
          id: string
          page: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          page?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          page?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: {
        Args: {
          p_invitation_id: string
          p_user_email: string
          p_user_id: string
        }
        Returns: undefined
      }
      admin_most_active_users: {
        Args: { p_days?: number; p_limit?: number }
        Returns: Json
      }
      admin_platform_metrics: { Args: never; Returns: Json }
      admin_remove_member: {
        Args: { p_member_id: string; p_org_id: string }
        Returns: undefined
      }
      admin_signups_by_day: { Args: { p_days?: number }; Returns: Json }
      admin_toggle_suspend: {
        Args: { p_org_id: string; p_reason?: string; p_suspend: boolean }
        Returns: undefined
      }
      cleanup_old_activity: { Args: never; Returns: undefined }
      count_ia_generations_this_month: {
        Args: { p_org_id: string }
        Returns: number
      }
      create_my_first_org: {
        Args: {
          p_nome: string
          p_plano: Database["public"]["Enums"]["plan_tier"]
        }
        Returns: {
          contact_email: string | null
          cor_primaria: string | null
          created_at: string
          geracoes_ia_mes_count: number
          geracoes_ia_mes_reset_at: string
          id: string
          last_proposal_created_at: string | null
          logo_url: string | null
          monthly_price: number | null
          nome: string
          notes: string | null
          nuit: string | null
          plano: Database["public"]["Enums"]["plan_tier"]
          propostas_mes_count: number
          propostas_mes_reset_at: string
          slug: string
          suspended_at: string | null
          suspension_reason: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_ia_limit: { Args: { p_user_id: string }; Returns: number }
      get_invitation_by_token: {
        Args: { p_token: string }
        Returns: {
          accepted_at: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          org_nome: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          token: string
        }[]
      }
      get_invitation_for_accept: {
        Args: { p_email: string; p_id: string }
        Returns: {
          accepted_at: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          token: string
        }[]
      }
      get_my_pending_invitations: {
        Args: { p_email: string }
        Returns: {
          accepted_at: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          org_nome: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          token: string
        }[]
      }
      get_plan_feature_limit: {
        Args: {
          p_feature_key: string
          p_plano: Database["public"]["Enums"]["plan_tier"]
        }
        Returns: number
      }
      get_plan_features: {
        Args: { p_plano: Database["public"]["Enums"]["plan_tier"] }
        Returns: {
          enabled: boolean
          feature_key: string
          limit_value: number
        }[]
      }
      has_org_role_min: {
        Args: {
          p_min_role: Database["public"]["Enums"]["org_role"]
          p_user_id: string
        }
        Returns: boolean
      }
      has_org_role_min_in_org: {
        Args: {
          p_min_role: Database["public"]["Enums"]["org_role"]
          p_org_id: string
        }
        Returns: boolean
      }
      has_plan_feature: {
        Args: {
          p_feature_key: string
          p_plano: Database["public"]["Enums"]["plan_tier"]
        }
        Returns: boolean
      }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | { Args: { p_role: string; p_user_id: string }; Returns: boolean }
      is_platform_admin_email: { Args: { p_email: string }; Returns: boolean }
      org_ia_generations_this_month: {
        Args: { _org_id: string }
        Returns: number
      }
      org_proposals_this_month: { Args: { _org_id: string }; Returns: number }
      organization_health_score: { Args: { p_org_id: string }; Returns: number }
      transfer_ownership: {
        Args: { p_current_owner_id: string; p_target_member_id: string }
        Returns: undefined
      }
      upsert_plan_feature: {
        Args: {
          p_enabled: boolean
          p_feature_key: string
          p_limit_value?: number
          p_plano: Database["public"]["Enums"]["plan_tier"]
        }
        Returns: undefined
      }
      user_belongs_to_org: { Args: { p_org_id: string }; Returns: boolean }
      user_role_in_org: {
        Args: { p_org_id: string }
        Returns: Database["public"]["Enums"]["org_role"]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      crm_activity_type:
        | "contacto"
        | "chamada"
        | "whatsapp"
        | "email"
        | "reuniao"
        | "nota"
        | "proposta_enviada"
        | "follow_up"
        | "outro"
      crm_estado:
        | "novo"
        | "contactado"
        | "qualificado"
        | "proposta_enviada"
        | "em_negociacao"
        | "ganho"
        | "perdido"
        | "inactivo"
      crm_origem:
        | "whatsapp"
        | "facebook"
        | "instagram"
        | "website"
        | "referencia"
        | "cliente_existente"
        | "outro"
      desconto_tipo: "percentual" | "valor"
      invoice_status: "pendente" | "paga" | "vencida" | "anulada"
      org_role: "owner" | "admin" | "member" | "viewer"
      plan_tier: "free" | "pro" | "business"
      proposal_status: "rascunho" | "enviada" | "aceite" | "rejeitada"
      subscription_status: "active" | "canceled" | "past_due" | "trialing"
      visual_style: "corporate" | "premium" | "minimal" | "technical"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "user"],
      crm_activity_type: [
        "contacto",
        "chamada",
        "whatsapp",
        "email",
        "reuniao",
        "nota",
        "proposta_enviada",
        "follow_up",
        "outro",
      ],
      crm_estado: [
        "novo",
        "contactado",
        "qualificado",
        "proposta_enviada",
        "em_negociacao",
        "ganho",
        "perdido",
        "inactivo",
      ],
      crm_origem: [
        "whatsapp",
        "facebook",
        "instagram",
        "website",
        "referencia",
        "cliente_existente",
        "outro",
      ],
      desconto_tipo: ["percentual", "valor"],
      invoice_status: ["pendente", "paga", "vencida", "anulada"],
      org_role: ["owner", "admin", "member", "viewer"],
      plan_tier: ["free", "pro", "business"],
      proposal_status: ["rascunho", "enviada", "aceite", "rejeitada"],
      subscription_status: ["active", "canceled", "past_due", "trialing"],
      visual_style: ["corporate", "premium", "minimal", "technical"],
    },
  },
} as const
