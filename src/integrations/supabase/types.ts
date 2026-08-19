// ============================================================
// AUTO-GENERATED TYPES — regenerated from live BD on 2026-08-19
// DO NOT EDIT MANUALLY — run scripts/regenerate_types.py instead
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql: {
    Tables: {[key: string]: { Row: any; Insert: any; Update: any; Relationships: any[] }}
    Functions: {
      graphql_public: {
        Args: { 'operation': string; 'variables': Json }
        Returns: Json
      }
    }
    Enums: { [key: string]: string }
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          id: string
          admin_id: string
          action: string
          target_table: string
          target_id: string
          target_owner_id: string | null
          target_snapshot: Json | null
          created_at: string
        }
        Insert: {
          id?: string | null
          target_owner_id?: string | null
          target_snapshot?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string | null
          admin_id?: string | null
          action?: string | null
          target_table?: string | null
          target_id?: string | null
          target_owner_id?: string | null
          target_snapshot?: Json | null
          created_at?: string | null
        }
        Relationships: []
      }
      advanced_proposals: {
        Row: {
          id: string
          organization_id: string
          owner_id: string
          client_id: string | null
          blueprint_id: string | null
          blueprint_version: number
          title: string
          status: string
          brand_profile_id: string | null
          current_section_index: number
          total_sections: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          client_id?: string | null
          blueprint_id?: string | null
          blueprint_version?: number | null
          title?: string | null
          status?: string | null
          brand_profile_id?: string | null
          current_section_index?: number | null
          total_sections?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          organization_id?: string | null
          owner_id?: string | null
          client_id?: string | null
          blueprint_id?: string | null
          blueprint_version?: number | null
          title?: string | null
          status?: string | null
          brand_profile_id?: string | null
          current_section_index?: number | null
          total_sections?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      business_categories: {
        Row: {
          id: string
          name: string
          description: string | null
          slug: string
          icon: string | null
          sort_order: number
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          description?: string | null
          icon?: string | null
          sort_order?: number | null
          active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          name?: string | null
          description?: string | null
          slug?: string | null
          icon?: string | null
          sort_order?: number | null
          active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      catalog_items: {
        Row: {
          id: string
          owner_id: string
          nome: string
          preco_unitario: number
          created_at: string
          updated_at: string
          organization_id: string | null
        }
        Insert: {
          id?: string | null
          preco_unitario?: number | null
          created_at?: string | null
          updated_at?: string | null
          organization_id?: string | null
        }
        Update: {
          id?: string | null
          owner_id?: string | null
          nome?: string | null
          preco_unitario?: number | null
          created_at?: string | null
          updated_at?: string | null
          organization_id?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          id: string
          owner_id: string
          nome: string
          email: string | null
          telefone: string | null
          empresa: string | null
          nuit: string | null
          endereco: string | null
          created_at: string
          updated_at: string
          organization_id: string | null
          cargo: string | null
          whatsapp: string | null
          origem: Database['public']['Enums']['crm_origem'] | null
          tipo: string | null
          estado_comercial: Database['public']['Enums']['crm_estado'] | null
          valor_potencial: number | null
          ultimo_contacto: string | null
          proximo_contacto: string | null
          responsavel_id: string | null
          notas: string | null
        }
        Insert: {
          id?: string | null
          email?: string | null
          telefone?: string | null
          empresa?: string | null
          nuit?: string | null
          endereco?: string | null
          created_at?: string | null
          updated_at?: string | null
          organization_id?: string | null
          cargo?: string | null
          whatsapp?: string | null
          origem?: Database['public']['Enums']['crm_origem'] | null
          tipo?: string | null
          estado_comercial?: Database['public']['Enums']['crm_estado'] | null
          valor_potencial?: number | null
          ultimo_contacto?: string | null
          proximo_contacto?: string | null
          responsavel_id?: string | null
          notas?: string | null
        }
        Update: {
          id?: string | null
          owner_id?: string | null
          nome?: string | null
          email?: string | null
          telefone?: string | null
          empresa?: string | null
          nuit?: string | null
          endereco?: string | null
          created_at?: string | null
          updated_at?: string | null
          organization_id?: string | null
          cargo?: string | null
          whatsapp?: string | null
          origem?: Database['public']['Enums']['crm_origem'] | null
          tipo?: string | null
          estado_comercial?: Database['public']['Enums']['crm_estado'] | null
          valor_potencial?: number | null
          ultimo_contacto?: string | null
          proximo_contacto?: string | null
          responsavel_id?: string | null
          notas?: string | null
        }
        Relationships: []
      }
      company_brand_profiles: {
        Row: {
          id: string
          organization_id: string
          primary_color: string | null
          secondary_color: string | null
          accent_color: string | null
          font_preference: string | null
          visual_style: Database['public']['Enums']['visual_style'] | null
          logo_colors_extracted: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          accent_color?: string | null
          font_preference?: string | null
          visual_style?: Database['public']['Enums']['visual_style'] | null
          logo_colors_extracted?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          organization_id?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          accent_color?: string | null
          font_preference?: string | null
          visual_style?: Database['public']['Enums']['visual_style'] | null
          logo_colors_extracted?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      crm_activities: {
        Row: {
          id: string
          organization_id: string
          client_id: string
          proposal_id: string | null
          type: Database['public']['Enums']['crm_activity_type']
          title: string
          description: string | null
          performed_by: string
          performed_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          proposal_id?: string | null
          type?: Database['public']['Enums']['crm_activity_type'] | null
          title?: string | null
          description?: string | null
          performed_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          organization_id?: string | null
          client_id?: string | null
          proposal_id?: string | null
          type?: Database['public']['Enums']['crm_activity_type'] | null
          title?: string | null
          description?: string | null
          performed_by?: string | null
          performed_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      crm_contact_tags: {
        Row: {
          client_id: string
          tag_id: string
          created_at: string
        }
        Insert: {
          created_at?: string | null
        }
        Update: {
          client_id?: string | null
          tag_id?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      crm_follow_ups: {
        Row: {
          id: string
          organization_id: string
          client_id: string
          proposal_id: string | null
          title: string
          description: string | null
          due_at: string
          completed_at: string | null
          completed_by: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          proposal_id?: string | null
          description?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          organization_id?: string | null
          client_id?: string | null
          proposal_id?: string | null
          title?: string | null
          description?: string | null
          due_at?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      crm_tags: {
        Row: {
          id: string
          organization_id: string
          name: string
          color: string | null
          created_at: string
        }
        Insert: {
          id?: string | null
          color?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string | null
          organization_id?: string | null
          name?: string | null
          color?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          id: string
          invoice_id: string
          nome: string
          quantidade: number
          preco_unitario: number
          subtotal: number
          ordem: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          quantidade?: number | null
          preco_unitario?: number | null
          subtotal?: number | null
          ordem?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          invoice_id?: string | null
          nome?: string | null
          quantidade?: number | null
          preco_unitario?: number | null
          subtotal?: number | null
          ordem?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          id: string
          owner_id: string
          proposal_id: string | null
          client_id: string
          numero: string | null
          data_emissao: string
          data_vencimento: string | null
          total: number
          status: Database['public']['Enums']['invoice_status']
          created_at: string
          updated_at: string
          organization_id: string | null
          created_by: string | null
        }
        Insert: {
          id?: string | null
          proposal_id?: string | null
          numero?: string | null
          data_emissao?: string | null
          data_vencimento?: string | null
          total?: number | null
          status?: Database['public']['Enums']['invoice_status'] | null
          created_at?: string | null
          updated_at?: string | null
          organization_id?: string | null
          created_by?: string | null
        }
        Update: {
          id?: string | null
          owner_id?: string | null
          proposal_id?: string | null
          client_id?: string | null
          numero?: string | null
          data_emissao?: string | null
          data_vencimento?: string | null
          total?: number | null
          status?: Database['public']['Enums']['invoice_status'] | null
          created_at?: string | null
          updated_at?: string | null
          organization_id?: string | null
          created_by?: string | null
        }
        Relationships: []
      }
      organization_invitations: {
        Row: {
          id: string
          organization_id: string
          email: string
          role: Database['public']['Enums']['org_role']
          invited_by: string
          accepted_at: string | null
          expires_at: string
          created_at: string
          token: string | null
          nome: string | null
        }
        Insert: {
          id?: string | null
          role?: Database['public']['Enums']['org_role'] | null
          accepted_at?: string | null
          expires_at?: string | null
          created_at?: string | null
          token?: string | null
          nome?: string | null
        }
        Update: {
          id?: string | null
          organization_id?: string | null
          email?: string | null
          role?: Database['public']['Enums']['org_role'] | null
          invited_by?: string | null
          accepted_at?: string | null
          expires_at?: string | null
          created_at?: string | null
          token?: string | null
          nome?: string | null
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          role: Database['public']['Enums']['org_role']
          joined_at: string
          invited_by: string | null
          display_name: string | null
        }
        Insert: {
          id?: string | null
          role?: Database['public']['Enums']['org_role'] | null
          joined_at?: string | null
          invited_by?: string | null
          display_name?: string | null
        }
        Update: {
          id?: string | null
          organization_id?: string | null
          user_id?: string | null
          role?: Database['public']['Enums']['org_role'] | null
          joined_at?: string | null
          invited_by?: string | null
          display_name?: string | null
        }
        Relationships: []
      }
      organizations: {
        Row: {
          id: string
          nome: string
          slug: string
          logo_url: string | null
          cor_primaria: string | null
          plano: Database['public']['Enums']['plan_tier']
          propostas_mes_count: number
          propostas_mes_reset_at: string
          geracoes_ia_mes_count: number
          geracoes_ia_mes_reset_at: string
          created_at: string
          updated_at: string
          contact_email: string | null
          nuit: string | null
          suspended_at: string | null
          suspension_reason: string | null
          monthly_price: number | null
          notes: string | null
          last_proposal_created_at: string | null
        }
        Insert: {
          id?: string | null
          logo_url?: string | null
          cor_primaria?: string | null
          plano?: Database['public']['Enums']['plan_tier'] | null
          propostas_mes_count?: number | null
          propostas_mes_reset_at?: string | null
          geracoes_ia_mes_count?: number | null
          geracoes_ia_mes_reset_at?: string | null
          created_at?: string | null
          updated_at?: string | null
          contact_email?: string | null
          nuit?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          monthly_price?: number | null
          notes?: string | null
          last_proposal_created_at?: string | null
        }
        Update: {
          id?: string | null
          nome?: string | null
          slug?: string | null
          logo_url?: string | null
          cor_primaria?: string | null
          plano?: Database['public']['Enums']['plan_tier'] | null
          propostas_mes_count?: number | null
          propostas_mes_reset_at?: string | null
          geracoes_ia_mes_count?: number | null
          geracoes_ia_mes_reset_at?: string | null
          created_at?: string | null
          updated_at?: string | null
          contact_email?: string | null
          nuit?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          monthly_price?: number | null
          notes?: string | null
          last_proposal_created_at?: string | null
        }
        Relationships: []
      }
      plan_features: {
        Row: {
          plano: Database['public']['Enums']['plan_tier']
          feature_key: string
          enabled: boolean
          limit_value: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean | null
          limit_value?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          plano?: Database['public']['Enums']['plan_tier'] | null
          feature_key?: string | null
          enabled?: boolean | null
          limit_value?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      plan_limits: {
        Row: {
          plano: Database['public']['Enums']['plan_tier']
          propostas_mes: number
          clientes_max: number | null
          templates_pdf: any[]
          geracoes_ia_mes: number
        }
        Insert: {
          clientes_max?: number | null
          templates_pdf?: any[] | null
          geracoes_ia_mes?: number | null
        }
        Update: {
          plano?: Database['public']['Enums']['plan_tier'] | null
          propostas_mes?: number | null
          clientes_max?: number | null
          templates_pdf?: any[] | null
          geracoes_ia_mes?: number | null
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          user_id: string
          email: string
          granted_by: string | null
          granted_at: string
          active: boolean
          notes: string | null
        }
        Insert: {
          granted_by?: string | null
          granted_at?: string | null
          active?: boolean | null
          notes?: string | null
        }
        Update: {
          user_id?: string | null
          email?: string | null
          granted_by?: string | null
          granted_at?: string | null
          active?: boolean | null
          notes?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          email: string
          nome: string | null
          cargo: string | null
          empresa: string | null
          contacto: string | null
          nuit: string | null
          endereco: string | null
          logotipo_url: string | null
          cor_primaria: string | null
          dados_bancarios: Json
          mobile_money: Json
          plano: Database['public']['Enums']['plan_tier']
          propostas_mes_count: number
          propostas_mes_reset_at: string
          created_at: string
          updated_at: string
          last_seen_at: string | null
          organization_id: string | null
        }
        Insert: {
          nome?: string | null
          cargo?: string | null
          empresa?: string | null
          contacto?: string | null
          nuit?: string | null
          endereco?: string | null
          logotipo_url?: string | null
          cor_primaria?: string | null
          dados_bancarios?: Json | null
          mobile_money?: Json | null
          plano?: Database['public']['Enums']['plan_tier'] | null
          propostas_mes_count?: number | null
          propostas_mes_reset_at?: string | null
          created_at?: string | null
          updated_at?: string | null
          last_seen_at?: string | null
          organization_id?: string | null
        }
        Update: {
          id?: string | null
          email?: string | null
          nome?: string | null
          cargo?: string | null
          empresa?: string | null
          contacto?: string | null
          nuit?: string | null
          endereco?: string | null
          logotipo_url?: string | null
          cor_primaria?: string | null
          dados_bancarios?: Json | null
          mobile_money?: Json | null
          plano?: Database['public']['Enums']['plan_tier'] | null
          propostas_mes_count?: number | null
          propostas_mes_reset_at?: string | null
          created_at?: string | null
          updated_at?: string | null
          last_seen_at?: string | null
          organization_id?: string | null
        }
        Relationships: []
      }
      proposal_blueprints: {
        Row: {
          id: string
          name: string
          description: string | null
          business_category_id: string
          version: number
          is_default: boolean
          active: boolean
          estimated_pages: number | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          description?: string | null
          version?: number | null
          is_default?: boolean | null
          active?: boolean | null
          estimated_pages?: number | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          name?: string | null
          description?: string | null
          business_category_id?: string | null
          version?: number | null
          is_default?: boolean | null
          active?: boolean | null
          estimated_pages?: number | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      proposal_items: {
        Row: {
          id: string
          proposal_id: string
          nome: string
          quantidade: number
          preco_unitario: number
          subtotal: number
          ordem: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          quantidade?: number | null
          preco_unitario?: number | null
          subtotal?: number | null
          ordem?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          proposal_id?: string | null
          nome?: string | null
          quantidade?: number | null
          preco_unitario?: number | null
          subtotal?: number | null
          ordem?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      proposal_section_answers: {
        Row: {
          id: string
          advanced_proposal_id: string
          section_id: string
          section_title: string
          section_order: number
          answers: Json
          ai_content: string | null
          ai_model: string | null
          ai_tokens_used: number | null
          edited_content: string | null
          content_status: string
          error_message: string | null
          generated_at: string | null
          edited_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          section_title?: string | null
          section_order?: number | null
          answers?: Json | null
          ai_content?: string | null
          ai_model?: string | null
          ai_tokens_used?: number | null
          edited_content?: string | null
          content_status?: string | null
          error_message?: string | null
          generated_at?: string | null
          edited_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          advanced_proposal_id?: string | null
          section_id?: string | null
          section_title?: string | null
          section_order?: number | null
          answers?: Json | null
          ai_content?: string | null
          ai_model?: string | null
          ai_tokens_used?: number | null
          edited_content?: string | null
          content_status?: string | null
          error_message?: string | null
          generated_at?: string | null
          edited_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      proposal_sections: {
        Row: {
          id: string
          blueprint_id: string
          type: string
          title: string
          order: number
          required: boolean
          content_rules: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          type?: string | null
          order?: number | null
          required?: boolean | null
          content_rules?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          blueprint_id?: string | null
          type?: string | null
          title?: string | null
          order?: number | null
          required?: boolean | null
          content_rules?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      proposals: {
        Row: {
          id: string
          owner_id: string
          client_id: string
          numero: string
          data: string
          subtotal: number
          desconto_tipo: Database['public']['Enums']['desconto_tipo']
          desconto_valor: number
          iva_percentual: number
          total: number
          observacoes: string | null
          status: Database['public']['Enums']['proposal_status']
          cliente_snapshot: Json | null
          created_at: string
          updated_at: string
          organization_id: string | null
          created_by: string | null
          blueprint_id: string | null
        }
        Insert: {
          id?: string | null
          data?: string | null
          subtotal?: number | null
          desconto_tipo?: Database['public']['Enums']['desconto_tipo'] | null
          desconto_valor?: number | null
          iva_percentual?: number | null
          total?: number | null
          observacoes?: string | null
          status?: Database['public']['Enums']['proposal_status'] | null
          cliente_snapshot?: Json | null
          created_at?: string | null
          updated_at?: string | null
          organization_id?: string | null
          created_by?: string | null
          blueprint_id?: string | null
        }
        Update: {
          id?: string | null
          owner_id?: string | null
          client_id?: string | null
          numero?: string | null
          data?: string | null
          subtotal?: number | null
          desconto_tipo?: Database['public']['Enums']['desconto_tipo'] | null
          desconto_valor?: number | null
          iva_percentual?: number | null
          total?: number | null
          observacoes?: string | null
          status?: Database['public']['Enums']['proposal_status'] | null
          cliente_snapshot?: Json | null
          created_at?: string | null
          updated_at?: string | null
          organization_id?: string | null
          created_by?: string | null
          blueprint_id?: string | null
        }
        Relationships: []
      }
      proposta_ai: {
        Row: {
          id: string
          cotacao_id: string
          user_id: string
          referencia: string | null
          mode: string
          tone: string
          sector: string | null
          input_json: Json | null
          output_json: Json | null
          edited_json: Json | null
          modelo: string | null
          tokens_usados: number | null
          custo_usd: number | null
          gerado_em: string | null
          exportado_em: string | null
          created_at: string
          organization_id: string | null
        }
        Insert: {
          id?: string | null
          referencia?: string | null
          mode?: string | null
          tone?: string | null
          sector?: string | null
          input_json?: Json | null
          output_json?: Json | null
          edited_json?: Json | null
          modelo?: string | null
          tokens_usados?: number | null
          custo_usd?: number | null
          gerado_em?: string | null
          exportado_em?: string | null
          created_at?: string | null
          organization_id?: string | null
        }
        Update: {
          id?: string | null
          cotacao_id?: string | null
          user_id?: string | null
          referencia?: string | null
          mode?: string | null
          tone?: string | null
          sector?: string | null
          input_json?: Json | null
          output_json?: Json | null
          edited_json?: Json | null
          modelo?: string | null
          tokens_usados?: number | null
          custo_usd?: number | null
          gerado_em?: string | null
          exportado_em?: string | null
          created_at?: string | null
          organization_id?: string | null
        }
        Relationships: []
      }
      section_questions: {
        Row: {
          id: string
          section_id: string
          question_text: string
          placeholder: string | null
          order: number
          required: boolean
          question_type: string
          visibility_rules: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          placeholder?: string | null
          order?: number | null
          required?: boolean | null
          question_type?: string | null
          visibility_rules?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          section_id?: string | null
          question_text?: string | null
          placeholder?: string | null
          order?: number | null
          required?: boolean | null
          question_type?: string | null
          visibility_rules?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          plano: Database['public']['Enums']['plan_tier']
          status: Database['public']['Enums']['subscription_status']
          provider: string
          provider_subscription_id: string | null
          current_period_start: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          plano?: Database['public']['Enums']['plan_tier'] | null
          status?: Database['public']['Enums']['subscription_status'] | null
          provider?: string | null
          provider_subscription_id?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          user_id?: string | null
          plano?: Database['public']['Enums']['plan_tier'] | null
          status?: Database['public']['Enums']['subscription_status'] | null
          provider?: string | null
          provider_subscription_id?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_activity: {
        Row: {
          id: string
          user_id: string
          page: string
          created_at: string
        }
        Insert: {
          id?: string | null
          page?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string | null
          user_id?: string | null
          page?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: Database['public']['Enums']['app_role']
          created_at: string
        }
        Insert: {
          id?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string | null
          user_id?: string | null
          role?: Database['public']['Enums']['app_role'] | null
          created_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_invitation: { Args: { p_invitation_id: string, p_user_id: string, p_user_email: string }; Returns: void }
      admin_most_active_users: { Args: { p_days: number, p_limit: number }; Returns: Json }
      admin_platform_metrics: { Args: {  }; Returns: Json }
      admin_remove_member: { Args: { p_member_id: string, p_org_id: string }; Returns: void }
      admin_signups_by_day: { Args: { p_days: number }; Returns: Json }
      admin_toggle_suspend: { Args: { p_org_id: string, p_suspend: boolean, p_reason: string }; Returns: void }
      cleanup_old_activity: { Args: {  }; Returns: void }
      count_ia_generations_this_month: { Args: { p_org_id: string }; Returns: number }
      create_my_first_org: { Args: { p_nome: string, p_plano: Database['public']['Enums']['plan_tier'], org_id: string, member_id: string }; Returns: any }
      enforce_ia_suspended: { Args: {  }; Returns: any }
      enforce_proposal_limit: { Args: {  }; Returns: any }
      get_ia_limit: { Args: { p_user_id: string }; Returns: number }
      get_invitation_by_token: { Args: { p_token: string, id: string, organization_id: string, email: string, role: Database['public']['Enums']['org_role'], token: string, invited_by: string, accepted_at: string, expires_at: string, created_at: string, org_nome: string }; Returns: any }
      get_invitation_for_accept: { Args: { p_id: string, p_email: string, id: string, organization_id: string, email: string, role: Database['public']['Enums']['org_role'], token: string, invited_by: string, accepted_at: string, expires_at: string, created_at: string }; Returns: any }
      get_my_pending_invitations: { Args: { p_email: string, id: string, organization_id: string, email: string, role: Database['public']['Enums']['org_role'], token: string, invited_by: string, accepted_at: string, expires_at: string, created_at: string, org_nome: string }; Returns: any }
      get_plan_feature_limit: { Args: { p_plano: Database['public']['Enums']['plan_tier'], p_feature_key: string }; Returns: number }
      get_plan_features: { Args: { p_plano: Database['public']['Enums']['plan_tier'], feature_key: string, enabled: boolean, limit_value: number }; Returns: any }
      handle_new_user: { Args: {  }; Returns: any }
      has_org_role_min: { Args: { p_org_id: string, p_user_id: string, p_min_role: Database['public']['Enums']['org_role'], p_min_role: Database['public']['Enums']['org_role'] }; Returns: boolean }
      has_org_role_min_in_org: { Args: { p_org_id: string, p_min_role: Database['public']['Enums']['org_role'] }; Returns: boolean }
      has_plan_feature: { Args: { p_plano: Database['public']['Enums']['plan_tier'], p_feature_key: string }; Returns: boolean }
      has_role: { Args: { _user_id: string, p_user_id: string, _role: Database['public']['Enums']['app_role'], p_role: string }; Returns: boolean }
      has_role: { Args: { _user_id: string, p_user_id: string, _role: Database['public']['Enums']['app_role'], p_role: string }; Returns: boolean }
      is_platform_admin_email: { Args: { p_email: string }; Returns: boolean }
      log_admin_deletion: { Args: {  }; Returns: any }
      org_ia_generations_this_month: { Args: { _org_id: string }; Returns: number }
      org_proposals_this_month: { Args: { _org_id: string }; Returns: number }
      organization_health_score: { Args: { p_org_id: string }; Returns: number }
      set_invoice_numero: { Args: {  }; Returns: any }
      set_proposal_numero: { Args: {  }; Returns: any }
      set_updated_at: { Args: {  }; Returns: any }
      transfer_ownership: { Args: { p_current_owner_id: string, p_target_member_id: string }; Returns: void }
      upsert_plan_feature: { Args: { p_plano: Database['public']['Enums']['plan_tier'], p_feature_key: string, p_enabled: boolean, p_limit_value: number }; Returns: void }
      user_belongs_to_org: { Args: { p_org_id: string }; Returns: boolean }
      user_role_in_org: { Args: { p_org_id: string }; Returns: Database['public']['Enums']['org_role'] }
    }
    Enums: {
        app_role: 'admin' | 'user'
        crm_activity_type: 'contacto' | 'chamada' | 'whatsapp' | 'email' | 'reuniao' | 'nota' | 'proposta_enviada' | 'follow_up' | 'outro'
        crm_estado: 'novo' | 'contactado' | 'qualificado' | 'proposta_enviada' | 'em_negociacao' | 'ganho' | 'perdido' | 'inactivo'
        crm_origem: 'whatsapp' | 'facebook' | 'instagram' | 'website' | 'referencia' | 'cliente_existente' | 'outro'
        desconto_tipo: 'percentual' | 'valor'
        invoice_status: 'pendente' | 'paga' | 'vencida' | 'anulada'
        org_role: 'owner' | 'admin' | 'member' | 'viewer'
        plan_tier: 'free' | 'pro' | 'business'
        proposal_status: 'rascunho' | 'enviada' | 'aceite' | 'rejeitada'
        subscription_status: 'active' | 'canceled' | 'past_due' | 'trialing'
        visual_style: 'corporate' | 'premium' | 'minimal' | 'technical'
    }
  }
}

type SupabaseClient = import('@supabase/supabase-js').SupabaseClient<Database>

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
export type Functions<T extends keyof Database['public']['Functions']> = Database['public']['Functions'][T]['Returns']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]