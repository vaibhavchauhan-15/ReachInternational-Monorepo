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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_deletion_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          role: string | null
          source: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          phone?: string | null
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_deletion_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_deletion_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_deletion_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_deletion_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_name: string | null
          actor_role: string | null
          after_state: Json | null
          before_state: Json | null
          category: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          severity: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          actor_name?: string | null
          actor_role?: string | null
          after_state?: Json | null
          before_state?: Json | null
          category?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          severity?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_name?: string | null
          actor_role?: string | null
          after_state?: Json | null
          before_state?: Json | null
          category?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          severity?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      business_profile: {
        Row: {
          address: string | null
          bank_details: string | null
          default_gst_rate: number
          default_terms_md: string | null
          default_validity_days: number
          email: string | null
          gstin: string | null
          id: boolean
          legal_name: string
          logo_path: string | null
          phone: string | null
          rfq_notify_emails: string[]
          state_code: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          bank_details?: string | null
          default_gst_rate?: number
          default_terms_md?: string | null
          default_validity_days?: number
          email?: string | null
          gstin?: string | null
          id?: boolean
          legal_name: string
          logo_path?: string | null
          phone?: string | null
          rfq_notify_emails?: string[]
          state_code?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          bank_details?: string | null
          default_gst_rate?: number
          default_terms_md?: string | null
          default_validity_days?: number
          email?: string | null
          gstin?: string | null
          id?: boolean
          legal_name?: string
          logo_path?: string | null
          phone?: string | null
          rfq_notify_emails?: string[]
          state_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_profile_state_code_fkey"
            columns: ["state_code"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["code"]
          },
        ]
      }
      cities: {
        Row: {
          created_at: string
          district_id: number
          id: number
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          district_id: number
          id: number
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          district_id?: number
          id?: number
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cities_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
      client_shift_codes: {
        Row: {
          client_id: string
          code: string
          created_at: string
          crosses_midnight: boolean
          display_order: number
          end_time: string
          id: string
          is_active: boolean
          name: string | null
          normal_minutes: number
          scheduled_minutes: number
          start_time: string
          updated_at: string
        }
        Insert: {
          client_id: string
          code: string
          created_at?: string
          crosses_midnight?: boolean
          display_order?: number
          end_time: string
          id?: string
          is_active?: boolean
          name?: string | null
          normal_minutes: number
          scheduled_minutes: number
          start_time: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          code?: string
          created_at?: string
          crosses_midnight?: boolean
          display_order?: number
          end_time?: string
          id?: string
          is_active?: boolean
          name?: string | null
          normal_minutes?: number
          scheduled_minutes?: number
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_shift_codes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_sites: {
        Row: {
          address_key: string | null
          city: string
          client_id: string
          created_at: string
          district: string
          id: string
          pincode: string
          site_code: string
          site_name: string
          state_id: number
          status: string
          street: string
          updated_at: string
        }
        Insert: {
          address_key?: string | null
          city: string
          client_id: string
          created_at?: string
          district: string
          id?: string
          pincode: string
          site_code?: string
          site_name: string
          state_id: number
          status?: string
          street: string
          updated_at?: string
        }
        Update: {
          address_key?: string | null
          city?: string
          client_id?: string
          created_at?: string
          district?: string
          id?: string
          pincode?: string
          site_code?: string
          site_name?: string
          state_id?: number
          status?: string
          street?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_sites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_sites_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      client_supervisors: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          client_id: string
          created_at: string
          id: string
          supervisor_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          client_id: string
          created_at?: string
          id?: string
          supervisor_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          client_id?: string
          created_at?: string
          id?: string
          supervisor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_supervisors_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_supervisors_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_supervisors_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_supervisors_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_supervisors_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          billing_address: string | null
          billing_city: string | null
          billing_district: string | null
          billing_pincode: string | null
          billing_state: string | null
          city: string
          client_id: string
          code: string
          company_name: string
          contact_person: string | null
          created_at: string
          deleted_at: string | null
          district: string | null
          gstin: string | null
          id: string
          is_billing_address_different: boolean
          maintenance_allowance_minutes: number
          pan_number: string | null
          phone: string | null
          pincode: string | null
          state: string
          status: string
          street: string
          supervisor_id: string | null
          supervisor_ids: string[] | null
          updated_at: string
        }
        Insert: {
          billing_address?: string | null
          billing_city?: string | null
          billing_district?: string | null
          billing_pincode?: string | null
          billing_state?: string | null
          city: string
          client_id: string
          code: string
          company_name: string
          contact_person?: string | null
          created_at?: string
          deleted_at?: string | null
          district?: string | null
          gstin?: string | null
          id?: string
          is_billing_address_different?: boolean
          maintenance_allowance_minutes?: number
          pan_number?: string | null
          phone?: string | null
          pincode?: string | null
          state: string
          status?: string
          street: string
          supervisor_id?: string | null
          supervisor_ids?: string[] | null
          updated_at?: string
        }
        Update: {
          billing_address?: string | null
          billing_city?: string | null
          billing_district?: string | null
          billing_pincode?: string | null
          billing_state?: string | null
          city?: string
          client_id?: string
          code?: string
          company_name?: string
          contact_person?: string | null
          created_at?: string
          deleted_at?: string | null
          district?: string | null
          gstin?: string | null
          id?: string
          is_billing_address_different?: boolean
          maintenance_allowance_minutes?: number
          pan_number?: string | null
          phone?: string | null
          pincode?: string | null
          state?: string
          status?: string
          street?: string
          supervisor_id?: string | null
          supervisor_ids?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          city: string | null
          created_at: string
          gstin: string | null
          id: string
          merged_into_id: string | null
          name: string
          name_key: string | null
          state_code: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          gstin?: string | null
          id?: string
          merged_into_id?: string | null
          name: string
          name_key?: string | null
          state_code?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          gstin?: string | null
          id?: string
          merged_into_id?: string | null
          name?: string
          name_key?: string | null
          state_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_state_code_fkey"
            columns: ["state_code"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["code"]
          },
        ]
      }
      contacts: {
        Row: {
          company_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      districts: {
        Row: {
          created_at: string
          id: number
          name: string
          state_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: number
          name: string
          state_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
          state_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "districts_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      email_outbox: {
        Row: {
          attachment_paths: string[]
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          payload: Json
          request_id: string | null
          send_after: string
          sent_at: string | null
          status: Database["public"]["Enums"]["outbox_status"]
          template: string
          to_emails: string[]
        }
        Insert: {
          attachment_paths?: string[]
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          payload?: Json
          request_id?: string | null
          send_after?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["outbox_status"]
          template: string
          to_emails: string[]
        }
        Update: {
          attachment_paths?: string[]
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          payload?: Json
          request_id?: string | null
          send_after?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["outbox_status"]
          template?: string
          to_emails?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "email_outbox_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_outbox_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "rfq_list"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_brands: {
        Row: {
          created_at: string
          dark_logo_url: string | null
          id: string
          is_partner: boolean
          logo_url: string | null
          name: string
          slug: string
          sort_order: number
          website: string | null
        }
        Insert: {
          created_at?: string
          dark_logo_url?: string | null
          id?: string
          is_partner?: boolean
          logo_url?: string | null
          name: string
          slug: string
          sort_order?: number
          website?: string | null
        }
        Update: {
          created_at?: string
          dark_logo_url?: string | null
          id?: string
          is_partner?: boolean
          logo_url?: string | null
          name?: string
          slug?: string
          sort_order?: number
          website?: string | null
        }
        Relationships: []
      }
      equipment_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_published: boolean
          name: string
          segment_id: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          name: string
          segment_id: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          name?: string
          segment_id?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_categories_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "equipment_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_documents: {
        Row: {
          created_at: string
          document_type: string
          equipment_id: string
          file_size_bytes: number
          file_url: string
          id: string
          is_published: boolean
          mime_type: string
          title: string
        }
        Insert: {
          created_at?: string
          document_type?: string
          equipment_id: string
          file_size_bytes?: number
          file_url: string
          id?: string
          is_published?: boolean
          mime_type?: string
          title: string
        }
        Update: {
          created_at?: string
          document_type?: string
          equipment_id?: string
          file_size_bytes?: number
          file_url?: string
          id?: string
          is_published?: boolean
          mime_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_documents_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_models"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_enquiries: {
        Row: {
          additional_requirements: string | null
          company_name: string | null
          created_at: string
          customer_name: string
          email: string
          equipment_id: string | null
          id: string
          ip_hash: string | null
          phone: string
          project_location: string
          rental_duration: string | null
          requirement_type: string
          source_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          additional_requirements?: string | null
          company_name?: string | null
          created_at?: string
          customer_name: string
          email: string
          equipment_id?: string | null
          id?: string
          ip_hash?: string | null
          phone: string
          project_location: string
          rental_duration?: string | null
          requirement_type: string
          source_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          additional_requirements?: string | null
          company_name?: string | null
          created_at?: string
          customer_name?: string
          email?: string
          equipment_id?: string | null
          id?: string
          ip_hash?: string | null
          phone?: string
          project_location?: string
          rental_duration?: string | null
          requirement_type?: string
          source_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_enquiries_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_models"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_media: {
        Row: {
          alt_text: string
          created_at: string
          equipment_id: string
          id: string
          is_primary: boolean
          media_type: string
          media_url: string
          sort_order: number
        }
        Insert: {
          alt_text: string
          created_at?: string
          equipment_id: string
          id?: string
          is_primary?: boolean
          media_type?: string
          media_url: string
          sort_order?: number
        }
        Update: {
          alt_text?: string
          created_at?: string
          equipment_id?: string
          id?: string
          is_primary?: boolean
          media_type?: string
          media_url?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "equipment_media_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_models"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_models: {
        Row: {
          applications: string[]
          brand_id: string
          capacity_kg: number | null
          category_id: string
          cover_blur: string | null
          cover_path: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description_md: string | null
          features: string[]
          full_description: string
          id: string
          indoor_use: boolean
          is_featured: boolean
          is_published: boolean
          max_platform_height_m: number | null
          max_working_height_m: number | null
          model_name: string
          model_number: string
          outdoor_use: boolean
          power: Database["public"]["Enums"]["power_type"]
          primary_capacity: string | null
          primary_image_url: string
          primary_power_source: string | null
          primary_working_height: string | null
          published_at: string | null
          purchase_available: boolean
          rental_available: boolean
          seo_description: string | null
          seo_title: string | null
          short_description: string
          slug: string
          sort_weight: number
          specs: Json
          status: Database["public"]["Enums"]["equipment_status"]
          subtype: string | null
          summary: string | null
          tagline: string | null
          tags: string[]
          updated_at: string
          updated_by: string | null
          version: number
          weight_kg: number | null
        }
        Insert: {
          applications?: string[]
          brand_id: string
          capacity_kg?: number | null
          category_id: string
          cover_blur?: string | null
          cover_path?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description_md?: string | null
          features?: string[]
          full_description: string
          id?: string
          indoor_use?: boolean
          is_featured?: boolean
          is_published?: boolean
          max_platform_height_m?: number | null
          max_working_height_m?: number | null
          model_name: string
          model_number: string
          outdoor_use?: boolean
          power?: Database["public"]["Enums"]["power_type"]
          primary_capacity?: string | null
          primary_image_url: string
          primary_power_source?: string | null
          primary_working_height?: string | null
          published_at?: string | null
          purchase_available?: boolean
          rental_available?: boolean
          seo_description?: string | null
          seo_title?: string | null
          short_description: string
          slug: string
          sort_weight?: number
          specs?: Json
          status?: Database["public"]["Enums"]["equipment_status"]
          subtype?: string | null
          summary?: string | null
          tagline?: string | null
          tags?: string[]
          updated_at?: string
          updated_by?: string | null
          version?: number
          weight_kg?: number | null
        }
        Update: {
          applications?: string[]
          brand_id?: string
          capacity_kg?: number | null
          category_id?: string
          cover_blur?: string | null
          cover_path?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description_md?: string | null
          features?: string[]
          full_description?: string
          id?: string
          indoor_use?: boolean
          is_featured?: boolean
          is_published?: boolean
          max_platform_height_m?: number | null
          max_working_height_m?: number | null
          model_name?: string
          model_number?: string
          outdoor_use?: boolean
          power?: Database["public"]["Enums"]["power_type"]
          primary_capacity?: string | null
          primary_image_url?: string
          primary_power_source?: string | null
          primary_working_height?: string | null
          published_at?: string | null
          purchase_available?: boolean
          rental_available?: boolean
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string
          slug?: string
          sort_weight?: number
          specs?: Json
          status?: Database["public"]["Enums"]["equipment_status"]
          subtype?: string | null
          summary?: string | null
          tagline?: string | null
          tags?: string[]
          updated_at?: string
          updated_by?: string | null
          version?: number
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_models_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "equipment_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_models_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "equipment_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_segments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      equipment_spec_definitions: {
        Row: {
          category_id: string | null
          code: string
          created_at: string
          group_name: string
          id: string
          name: string
          sort_order: number
          unit: string | null
        }
        Insert: {
          category_id?: string | null
          code: string
          created_at?: string
          group_name: string
          id?: string
          name: string
          sort_order?: number
          unit?: string | null
        }
        Update: {
          category_id?: string | null
          code?: string
          created_at?: string
          group_name?: string
          id?: string
          name?: string
          sort_order?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_spec_definitions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "equipment_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_specifications: {
        Row: {
          equipment_id: string
          id: string
          is_key_spec: boolean
          sort_order: number
          spec_definition_id: string
          spec_value: string
        }
        Insert: {
          equipment_id: string
          id?: string
          is_key_spec?: boolean
          sort_order?: number
          spec_definition_id: string
          spec_value: string
        }
        Update: {
          equipment_id?: string
          id?: string
          is_key_spec?: boolean
          sort_order?: number
          spec_definition_id?: string
          spec_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_specifications_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_specifications_spec_definition_id_fkey"
            columns: ["spec_definition_id"]
            isOneToOne: false
            referencedRelation: "equipment_spec_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          action_name: string
          created_at: string
          execution_token: string | null
          expires_at: string
          idempotency_key: string
          request_hash: string
          response_payload: Json | null
          status: string
          user_id: string | null
        }
        Insert: {
          action_name: string
          created_at?: string
          execution_token?: string | null
          expires_at?: string
          idempotency_key: string
          request_hash: string
          response_payload?: Json | null
          status?: string
          user_id?: string | null
        }
        Update: {
          action_name?: string
          created_at?: string
          execution_token?: string | null
          expires_at?: string
          idempotency_key?: string
          request_hash?: string
          response_payload?: Json | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "idempotency_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "idempotency_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          application_code: string
          assigned_to: string | null
          consent_given_at: string
          consent_version: string
          cover_note: string | null
          created_at: string
          current_city: string
          current_ctc: number | null
          deleted_at: string | null
          email: string
          expected_ctc: number | null
          full_name: string
          hr_notes: string | null
          id: string
          ip_hash: string | null
          job_id: string | null
          notice_period_days: number | null
          phone: string
          rating: number | null
          resume_file_name: string
          resume_mime: string
          resume_path: string
          resume_size_bytes: number
          source: string
          status: string
          status_changed_at: string
          total_experience_yrs: number
          updated_at: string
        }
        Insert: {
          application_code: string
          assigned_to?: string | null
          consent_given_at: string
          consent_version: string
          cover_note?: string | null
          created_at?: string
          current_city: string
          current_ctc?: number | null
          deleted_at?: string | null
          email: string
          expected_ctc?: number | null
          full_name: string
          hr_notes?: string | null
          id?: string
          ip_hash?: string | null
          job_id?: string | null
          notice_period_days?: number | null
          phone: string
          rating?: number | null
          resume_file_name: string
          resume_mime: string
          resume_path: string
          resume_size_bytes: number
          source?: string
          status?: string
          status_changed_at?: string
          total_experience_yrs: number
          updated_at?: string
        }
        Update: {
          application_code?: string
          assigned_to?: string | null
          consent_given_at?: string
          consent_version?: string
          cover_note?: string | null
          created_at?: string
          current_city?: string
          current_ctc?: number | null
          deleted_at?: string | null
          email?: string
          expected_ctc?: number | null
          full_name?: string
          hr_notes?: string | null
          id?: string
          ip_hash?: string | null
          job_id?: string | null
          notice_period_days?: number | null
          phone?: string
          rating?: number | null
          resume_file_name?: string
          resume_mime?: string
          resume_path?: string
          resume_size_bytes?: number
          source?: string
          status?: string
          status_changed_at?: string
          total_experience_yrs?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      job_departments: {
        Row: {
          created_at: string
          id: number
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: never
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: never
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      job_postings: {
        Row: {
          apply_by: string | null
          benefits: string[]
          city: string
          close_reason: string | null
          closed_at: string | null
          country_code: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          department_id: number
          description_md: string
          district: string | null
          employment_type: string
          experience_level: string
          id: string
          is_featured: boolean
          job_code: string
          max_experience_years: number | null
          min_experience_years: number
          nice_to_have: string[]
          openings: number
          published_at: string | null
          requirements: string[]
          responsibilities: string[]
          salary_currency: string
          salary_max: number | null
          salary_min: number | null
          salary_period: string
          search_vector: unknown
          seo_description: string | null
          seo_title: string | null
          show_salary: boolean
          site_note: string | null
          skills: string[]
          slug: string
          state_id: number | null
          status: string
          summary: string
          title: string
          updated_at: string
          updated_by: string | null
          workplace_type: string
        }
        Insert: {
          apply_by?: string | null
          benefits?: string[]
          city: string
          close_reason?: string | null
          closed_at?: string | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          department_id: number
          description_md: string
          district?: string | null
          employment_type: string
          experience_level: string
          id?: string
          is_featured?: boolean
          job_code: string
          max_experience_years?: number | null
          min_experience_years?: number
          nice_to_have?: string[]
          openings?: number
          published_at?: string | null
          requirements?: string[]
          responsibilities?: string[]
          salary_currency?: string
          salary_max?: number | null
          salary_min?: number | null
          salary_period?: string
          search_vector?: unknown
          seo_description?: string | null
          seo_title?: string | null
          show_salary?: boolean
          site_note?: string | null
          skills?: string[]
          slug: string
          state_id?: number | null
          status?: string
          summary: string
          title: string
          updated_at?: string
          updated_by?: string | null
          workplace_type?: string
        }
        Update: {
          apply_by?: string | null
          benefits?: string[]
          city?: string
          close_reason?: string | null
          closed_at?: string | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          department_id?: number
          description_md?: string
          district?: string | null
          employment_type?: string
          experience_level?: string
          id?: string
          is_featured?: boolean
          job_code?: string
          max_experience_years?: number | null
          min_experience_years?: number
          nice_to_have?: string[]
          openings?: number
          published_at?: string | null
          requirements?: string[]
          responsibilities?: string[]
          salary_currency?: string
          salary_max?: number | null
          salary_min?: number | null
          salary_period?: string
          search_vector?: unknown
          seo_description?: string | null
          seo_title?: string | null
          show_salary?: boolean
          site_note?: string | null
          skills?: string[]
          slug?: string
          state_id?: number | null
          status?: string
          summary?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          workplace_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_postings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_postings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_postings_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "job_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_postings_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_postings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_postings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_hour_logs: {
        Row: {
          breakdown_duration: string | null
          breakdown_end_time: string | null
          breakdown_hours: number | null
          breakdown_minutes: number | null
          breakdown_start_time: string | null
          client_id: string | null
          conflict_flag: boolean
          conflict_reason: string | null
          conflict_resolution_notes: string | null
          conflict_resolved_at: string | null
          conflict_resolved_by: string | null
          conflict_status: string | null
          created_at: string | null
          end_date: string | null
          end_datetime: string | null
          end_meter: number
          end_time: string | null
          entered_by: string | null
          entry_source: string | null
          id: string
          idempotency_key: string | null
          is_breakdown: boolean
          location: string | null
          log_date: string
          machine_condition: string | null
          machine_id: string
          maintenance_minutes: number
          normal_working_hours: number
          operator_id: string
          overtime_hours: number
          remarks: string | null
          running_hours: number | null
          shift: string | null
          shift_code: string | null
          shift_scheduled_minutes: number | null
          site_id: string | null
          start_datetime: string | null
          start_meter: number
          start_time: string | null
          supervisor_id: string | null
        }
        Insert: {
          breakdown_duration?: string | null
          breakdown_end_time?: string | null
          breakdown_hours?: number | null
          breakdown_minutes?: number | null
          breakdown_start_time?: string | null
          client_id?: string | null
          conflict_flag?: boolean
          conflict_reason?: string | null
          conflict_resolution_notes?: string | null
          conflict_resolved_at?: string | null
          conflict_resolved_by?: string | null
          conflict_status?: string | null
          created_at?: string | null
          end_date?: string | null
          end_datetime?: string | null
          end_meter?: number
          end_time?: string | null
          entered_by?: string | null
          entry_source?: string | null
          id?: string
          idempotency_key?: string | null
          is_breakdown?: boolean
          location?: string | null
          log_date?: string
          machine_condition?: string | null
          machine_id: string
          maintenance_minutes?: number
          normal_working_hours?: number
          operator_id: string
          overtime_hours?: number
          remarks?: string | null
          running_hours?: number | null
          shift?: string | null
          shift_code?: string | null
          shift_scheduled_minutes?: number | null
          site_id?: string | null
          start_datetime?: string | null
          start_meter?: number
          start_time?: string | null
          supervisor_id?: string | null
        }
        Update: {
          breakdown_duration?: string | null
          breakdown_end_time?: string | null
          breakdown_hours?: number | null
          breakdown_minutes?: number | null
          breakdown_start_time?: string | null
          client_id?: string | null
          conflict_flag?: boolean
          conflict_reason?: string | null
          conflict_resolution_notes?: string | null
          conflict_resolved_at?: string | null
          conflict_resolved_by?: string | null
          conflict_status?: string | null
          created_at?: string | null
          end_date?: string | null
          end_datetime?: string | null
          end_meter?: number
          end_time?: string | null
          entered_by?: string | null
          entry_source?: string | null
          id?: string
          idempotency_key?: string | null
          is_breakdown?: boolean
          location?: string | null
          log_date?: string
          machine_condition?: string | null
          machine_id?: string
          maintenance_minutes?: number
          normal_working_hours?: number
          operator_id?: string
          overtime_hours?: number
          remarks?: string | null
          running_hours?: number | null
          shift?: string | null
          shift_code?: string | null
          shift_scheduled_minutes?: number | null
          site_id?: string | null
          start_datetime?: string | null
          start_meter?: number
          start_time?: string | null
          supervisor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_hour_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_hour_logs_conflict_resolved_by_fkey"
            columns: ["conflict_resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_hour_logs_conflict_resolved_by_fkey"
            columns: ["conflict_resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_hour_logs_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_hour_logs_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_hour_logs_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_hour_logs_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_hour_logs_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_hour_logs_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_hour_logs_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mhl_site_fk"
            columns: ["site_id", "client_id"]
            isOneToOne: false
            referencedRelation: "client_sites"
            referencedColumns: ["id", "client_id"]
          },
        ]
      }
      machines: {
        Row: {
          city: string | null
          client_id: string | null
          created_at: string | null
          created_by: string | null
          current_operator_id: string | null
          current_supervisor_id: string | null
          customer_address: string | null
          customer_mobile: string | null
          customer_name: string | null
          engineer_id: string | null
          health_status: string
          hour_meter: number | null
          id: string
          machine_id: string
          machine_name: string
          manufacturer: string | null
          model: string | null
          notes: string | null
          operator_ids: string[] | null
          ownership_type: string | null
          serial_number: string | null
          site_id: string | null
          state: string | null
          status: string
          supervisor_ids: string[] | null
          updated_at: string | null
          year_of_mfg: number | null
        }
        Insert: {
          city?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_operator_id?: string | null
          current_supervisor_id?: string | null
          customer_address?: string | null
          customer_mobile?: string | null
          customer_name?: string | null
          engineer_id?: string | null
          health_status?: string
          hour_meter?: number | null
          id?: string
          machine_id: string
          machine_name: string
          manufacturer?: string | null
          model?: string | null
          notes?: string | null
          operator_ids?: string[] | null
          ownership_type?: string | null
          serial_number?: string | null
          site_id?: string | null
          state?: string | null
          status?: string
          supervisor_ids?: string[] | null
          updated_at?: string | null
          year_of_mfg?: number | null
        }
        Update: {
          city?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_operator_id?: string | null
          current_supervisor_id?: string | null
          customer_address?: string | null
          customer_mobile?: string | null
          customer_name?: string | null
          engineer_id?: string | null
          health_status?: string
          hour_meter?: number | null
          id?: string
          machine_id?: string
          machine_name?: string
          manufacturer?: string | null
          model?: string | null
          notes?: string | null
          operator_ids?: string[] | null
          ownership_type?: string | null
          serial_number?: string | null
          site_id?: string | null
          state?: string | null
          status?: string
          supervisor_ids?: string[] | null
          updated_at?: string | null
          year_of_mfg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "machines_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machines_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machines_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machines_current_operator_id_fkey"
            columns: ["current_operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machines_current_operator_id_fkey"
            columns: ["current_operator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machines_current_supervisor_id_fkey"
            columns: ["current_supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machines_current_supervisor_id_fkey"
            columns: ["current_supervisor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machines_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machines_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machines_site_fk"
            columns: ["site_id", "client_id"]
            isOneToOne: false
            referencedRelation: "client_sites"
            referencedColumns: ["id", "client_id"]
          },
        ]
      }
      notifications: {
        Row: {
          category: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          read_at: string | null
          severity: string
          title: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          read_at?: string | null
          severity?: string
          title: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          read_at?: string | null
          severity?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_machine_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          created_at: string
          crosses_midnight: boolean | null
          end_reason: string | null
          ended_at: string | null
          ended_by: string | null
          id: string
          is_active: boolean
          machine_id: string
          operator_id: string
          shift_code: string | null
          shift_end_time: string
          shift_start_time: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          created_at?: string
          crosses_midnight?: boolean | null
          end_reason?: string | null
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          is_active?: boolean
          machine_id: string
          operator_id: string
          shift_code?: string | null
          shift_end_time: string
          shift_start_time: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          created_at?: string
          crosses_midnight?: boolean | null
          end_reason?: string | null
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          is_active?: boolean
          machine_id?: string
          operator_id?: string
          shift_code?: string | null
          shift_end_time?: string
          shift_start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_machine_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_machine_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_machine_assignments_ended_by_fkey"
            columns: ["ended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_machine_assignments_ended_by_fkey"
            columns: ["ended_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_machine_assignments_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_machine_assignments_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_machine_assignments_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_payrolls: {
        Row: {
          additional_balance_salary: number
          advance_balance: number
          advance_deduction: number
          approved_by: string | null
          attended_amount: number
          attended_days: number
          balance_pay: number
          bank_account_number: string | null
          bank_ifsc_code: string | null
          basic_salary: number
          created_at: string
          daily_rate: number
          earned_basic: number
          gross_pay: number
          id: string
          loan_deduction: number
          net_pay: number
          night_travel_amount: number
          night_travel_days: number
          normal_hours: number
          notes: string | null
          operator_id: string
          ot_amount: number
          ot_days: number
          ot_hourly_rate: number
          ot_hours: number
          ot_pay: number
          other_deductions: number
          paid_at: string | null
          paid_quess: number
          paid_reach: number
          paid_ss: number
          payroll_month: string
          pl_adjusted: number
          pl_amount: number
          pl_balance: number
          pl_used_as_on_date: number
          regular_pay: number
          status: string
          total_days: number
          total_earned: number
          total_pay: number
          total_pl_quota: number
          updated_at: string
          work_days: number
          working_days: number
        }
        Insert: {
          additional_balance_salary?: number
          advance_balance?: number
          advance_deduction?: number
          approved_by?: string | null
          attended_amount?: number
          attended_days?: number
          balance_pay?: number
          bank_account_number?: string | null
          bank_ifsc_code?: string | null
          basic_salary?: number
          created_at?: string
          daily_rate?: number
          earned_basic?: number
          gross_pay?: number
          id?: string
          loan_deduction?: number
          net_pay?: number
          night_travel_amount?: number
          night_travel_days?: number
          normal_hours?: number
          notes?: string | null
          operator_id: string
          ot_amount?: number
          ot_days?: number
          ot_hourly_rate?: number
          ot_hours?: number
          ot_pay?: number
          other_deductions?: number
          paid_at?: string | null
          paid_quess?: number
          paid_reach?: number
          paid_ss?: number
          payroll_month: string
          pl_adjusted?: number
          pl_amount?: number
          pl_balance?: number
          pl_used_as_on_date?: number
          regular_pay?: number
          status?: string
          total_days?: number
          total_earned?: number
          total_pay?: number
          total_pl_quota?: number
          updated_at?: string
          work_days?: number
          working_days?: number
        }
        Update: {
          additional_balance_salary?: number
          advance_balance?: number
          advance_deduction?: number
          approved_by?: string | null
          attended_amount?: number
          attended_days?: number
          balance_pay?: number
          bank_account_number?: string | null
          bank_ifsc_code?: string | null
          basic_salary?: number
          created_at?: string
          daily_rate?: number
          earned_basic?: number
          gross_pay?: number
          id?: string
          loan_deduction?: number
          net_pay?: number
          night_travel_amount?: number
          night_travel_days?: number
          normal_hours?: number
          notes?: string | null
          operator_id?: string
          ot_amount?: number
          ot_days?: number
          ot_hourly_rate?: number
          ot_hours?: number
          ot_pay?: number
          other_deductions?: number
          paid_at?: string | null
          paid_quess?: number
          paid_reach?: number
          paid_ss?: number
          payroll_month?: string
          pl_adjusted?: number
          pl_amount?: number
          pl_balance?: number
          pl_used_as_on_date?: number
          regular_pay?: number
          status?: string
          total_days?: number
          total_earned?: number
          total_pay?: number
          total_pl_quota?: number
          updated_at?: string
          work_days?: number
          working_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "operator_payrolls_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_payrolls_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_payrolls_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_payrolls_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_shift_ranges: {
        Row: {
          assignment_id: string
          id: string
          is_active: boolean
          machine_id: string | null
          minute_range: unknown
          operator_id: string
        }
        Insert: {
          assignment_id: string
          id?: string
          is_active?: boolean
          machine_id?: string | null
          minute_range: unknown
          operator_id: string
        }
        Update: {
          assignment_id?: string
          id?: string
          is_active?: boolean
          machine_id?: string | null
          minute_range?: unknown
          operator_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_shift_ranges_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "operator_machine_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_shift_ranges_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_shift_ranges_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_shift_ranges_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_change_requests: {
        Row: {
          created_at: string
          current_data: Json
          id: string
          rejection_reason: string | null
          requested_data: Json
          requester_role: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_approver_role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_data: Json
          id?: string
          rejection_reason?: string | null
          requested_data: Json
          requester_role: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_approver_role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_data?: Json
          id?: string
          rejection_reason?: string | null
          requested_data?: Json
          requester_role?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_approver_role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_change_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_change_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_change_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_change_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          description: string
          discount_pct: number
          duration_value: number | null
          equipment_id: string | null
          gst_rate: number
          hsn_sac: string | null
          id: string
          kind: Database["public"]["Enums"]["quote_line_kind"]
          line_net_paise: number | null
          quantity: number
          quotation_id: string
          rate_unit: Database["public"]["Enums"]["duration_unit"] | null
          request_item_id: string | null
          sort_order: number
          tax_paise: number | null
          unit_price_paise: number
        }
        Insert: {
          description: string
          discount_pct?: number
          duration_value?: number | null
          equipment_id?: string | null
          gst_rate: number
          hsn_sac?: string | null
          id?: string
          kind: Database["public"]["Enums"]["quote_line_kind"]
          line_net_paise?: number | null
          quantity: number
          quotation_id: string
          rate_unit?: Database["public"]["Enums"]["duration_unit"] | null
          request_item_id?: string | null
          sort_order?: number
          tax_paise?: number | null
          unit_price_paise: number
        }
        Update: {
          description?: string
          discount_pct?: number
          duration_value?: number | null
          equipment_id?: string | null
          gst_rate?: number
          hsn_sac?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["quote_line_kind"]
          line_net_paise?: number | null
          quantity?: number
          quotation_id?: string
          rate_unit?: Database["public"]["Enums"]["duration_unit"] | null
          request_item_id?: string | null
          sort_order?: number
          tax_paise?: number | null
          unit_price_paise?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotation_totals"
            referencedColumns: ["quotation_id"]
          },
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_request_item_id_fkey"
            columns: ["request_item_id"]
            isOneToOne: false
            referencedRelation: "quote_request_items"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes_to_client: string | null
          pdf_path: string | null
          place_of_supply_state: string
          request_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["quotation_status"]
          terms_md: string
          updated_at: string
          valid_until: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes_to_client?: string | null
          pdf_path?: string | null
          place_of_supply_state: string
          request_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quotation_status"]
          terms_md: string
          updated_at?: string
          valid_until: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes_to_client?: string | null
          pdf_path?: string | null
          place_of_supply_state?: string
          request_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quotation_status"]
          terms_md?: string
          updated_at?: string
          valid_until?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_place_of_supply_state_fkey"
            columns: ["place_of_supply_state"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "quotations_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "rfq_list"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_request_items: {
        Row: {
          brand_id: string | null
          category_id: string | null
          custom_description: string | null
          duration_unit: Database["public"]["Enums"]["duration_unit"] | null
          duration_value: number | null
          equipment_id: string | null
          id: string
          min_capacity_kg: number | null
          min_height_m: number | null
          notes: string | null
          quantity: number
          request_id: string
          requirement_type: Database["public"]["Enums"]["rfq_requirement"]
          sort_order: number
        }
        Insert: {
          brand_id?: string | null
          category_id?: string | null
          custom_description?: string | null
          duration_unit?: Database["public"]["Enums"]["duration_unit"] | null
          duration_value?: number | null
          equipment_id?: string | null
          id?: string
          min_capacity_kg?: number | null
          min_height_m?: number | null
          notes?: string | null
          quantity: number
          request_id: string
          requirement_type: Database["public"]["Enums"]["rfq_requirement"]
          sort_order?: number
        }
        Update: {
          brand_id?: string | null
          category_id?: string | null
          custom_description?: string | null
          duration_unit?: Database["public"]["Enums"]["duration_unit"] | null
          duration_value?: number | null
          equipment_id?: string | null
          id?: string
          min_capacity_kg?: number | null
          min_height_m?: number | null
          notes?: string | null
          quantity?: number
          request_id?: string
          requirement_type?: Database["public"]["Enums"]["rfq_requirement"]
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_request_items_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "equipment_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_request_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "equipment_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_request_items_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "rfq_list"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_requests: {
        Row: {
          assigned_to: string | null
          attribution: Json | null
          client_notes: string | null
          closed_at: string | null
          company_id: string | null
          consent_at: string | null
          contact_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          follow_up_at: string | null
          id: string
          idempotency_key: string | null
          ip_hash: string | null
          last_activity_at: string
          lost_reason: Database["public"]["Enums"]["lost_reason"] | null
          priority: number
          project_city: string
          project_site_address: string | null
          project_state_code: string
          required_from: string | null
          rfq_number: string
          source: Database["public"]["Enums"]["rfq_source"]
          status: Database["public"]["Enums"]["rfq_status"]
          updated_at: string
          version: number
        }
        Insert: {
          assigned_to?: string | null
          attribution?: Json | null
          client_notes?: string | null
          closed_at?: string | null
          company_id?: string | null
          consent_at?: string | null
          contact_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          follow_up_at?: string | null
          id: string
          idempotency_key?: string | null
          ip_hash?: string | null
          last_activity_at?: string
          lost_reason?: Database["public"]["Enums"]["lost_reason"] | null
          priority?: number
          project_city: string
          project_site_address?: string | null
          project_state_code: string
          required_from?: string | null
          rfq_number?: string
          source?: Database["public"]["Enums"]["rfq_source"]
          status?: Database["public"]["Enums"]["rfq_status"]
          updated_at?: string
          version?: number
        }
        Update: {
          assigned_to?: string | null
          attribution?: Json | null
          client_notes?: string | null
          closed_at?: string | null
          company_id?: string | null
          consent_at?: string | null
          contact_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          follow_up_at?: string | null
          id?: string
          idempotency_key?: string | null
          ip_hash?: string | null
          last_activity_at?: string
          lost_reason?: Database["public"]["Enums"]["lost_reason"] | null
          priority?: number
          project_city?: string
          project_site_address?: string | null
          project_state_code?: string
          required_from?: string | null
          rfq_number?: string
          source?: Database["public"]["Enums"]["rfq_source"]
          status?: Database["public"]["Enums"]["rfq_status"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_requests_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_requests_project_state_code_fkey"
            columns: ["project_state_code"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["code"]
          },
        ]
      }
      rate_limit_hits: {
        Row: {
          at: string
          key: string
        }
        Insert: {
          at?: string
          key: string
        }
        Update: {
          at?: string
          key?: string
        }
        Relationships: []
      }
      rfq_attachments: {
        Row: {
          created_at: string
          id: string
          mime_type: string
          original_name: string
          request_id: string
          size_bytes: number
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type: string
          original_name: string
          request_id: string
          size_bytes: number
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string
          original_name?: string
          request_id?: string
          size_bytes?: number
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfq_attachments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_attachments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "rfq_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_counters: {
        Row: {
          last_value: number
          year: number
        }
        Insert: {
          last_value?: number
          year: number
        }
        Update: {
          last_value?: number
          year?: number
        }
        Relationships: []
      }
      rfq_events: {
        Row: {
          actor_id: string | null
          created_at: string
          data: Json
          id: number
          request_id: string
          type: Database["public"]["Enums"]["rfq_event_type"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          data?: Json
          id?: never
          request_id: string
          type: Database["public"]["Enums"]["rfq_event_type"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          data?: Json
          id?: never
          request_id?: string
          type?: Database["public"]["Enums"]["rfq_event_type"]
        }
        Relationships: [
          {
            foreignKeyName: "rfq_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "rfq_list"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_status_transitions: {
        Row: {
          from_status: Database["public"]["Enums"]["rfq_status"]
          to_status: Database["public"]["Enums"]["rfq_status"]
        }
        Insert: {
          from_status: Database["public"]["Enums"]["rfq_status"]
          to_status: Database["public"]["Enums"]["rfq_status"]
        }
        Update: {
          from_status?: Database["public"]["Enums"]["rfq_status"]
          to_status?: Database["public"]["Enums"]["rfq_status"]
        }
        Relationships: []
      }
      states: {
        Row: {
          code: string | null
          created_at: string
          gst_state_code: string | null
          id: number
          name: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          gst_state_code?: string | null
          id: number
          name: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          gst_state_code?: string | null
          id?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      towns: {
        Row: {
          created_at: string
          district_id: number
          id: number
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          district_id: number
          id: number
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          district_id?: number
          id?: number
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "towns_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_document_types: {
        Row: {
          allowed_mime_types: string[]
          code: string
          created_at: string
          label: string
          max_size_bytes: number
          visibility: string
        }
        Insert: {
          allowed_mime_types: string[]
          code: string
          created_at?: string
          label: string
          max_size_bytes: number
          visibility?: string
        }
        Update: {
          allowed_mime_types?: string[]
          code?: string
          created_at?: string
          label?: string
          max_size_bytes?: number
          visibility?: string
        }
        Relationships: []
      }
      user_documents: {
        Row: {
          created_at: string
          document_type_code: string
          file_name: string | null
          file_size_bytes: number
          id: string
          mime_type: string
          status: string
          storage_path: string
          updated_at: string
          uploaded_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          document_type_code: string
          file_name?: string | null
          file_size_bytes: number
          id?: string
          mime_type: string
          status?: string
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          document_type_code?: string
          file_name?: string | null
          file_size_bytes?: number
          id?: string
          mime_type?: string
          status?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_documents_document_type_code_fkey"
            columns: ["document_type_code"]
            isOneToOne: false
            referencedRelation: "user_document_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "user_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_supervisors: {
        Row: {
          created_at: string
          id: string
          supervisor_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          supervisor_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          supervisor_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_supervisors_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_supervisors_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_supervisors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_supervisors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          aadhaar_number: string | null
          bank_account_number: string | null
          bank_ifsc_code: string | null
          city: string
          complete_profile: boolean
          created_at: string | null
          daily_rate: number
          district: string
          doj: string | null
          email: string
          employee_id: string
          full_name: string
          id: string
          license_number: string | null
          monthly_salary: number | null
          ot_hourly_rate: number
          phone: string | null
          pl_used_as_on_date: number
          role: string
          shift_end_time: string | null
          shift_start_time: string | null
          state: string
          state_id: number | null
          status: string
          street: string | null
          supervisor_id: string | null
          total_pl_quota: number
          updated_at: string | null
        }
        Insert: {
          aadhaar_number?: string | null
          bank_account_number?: string | null
          bank_ifsc_code?: string | null
          city?: string
          complete_profile?: boolean
          created_at?: string | null
          daily_rate?: number
          district?: string
          doj?: string | null
          email: string
          employee_id: string
          full_name: string
          id: string
          license_number?: string | null
          monthly_salary?: number | null
          ot_hourly_rate?: number
          phone?: string | null
          pl_used_as_on_date?: number
          role?: string
          shift_end_time?: string | null
          shift_start_time?: string | null
          state?: string
          state_id?: number | null
          status?: string
          street?: string | null
          supervisor_id?: string | null
          total_pl_quota?: number
          updated_at?: string | null
        }
        Update: {
          aadhaar_number?: string | null
          bank_account_number?: string | null
          bank_ifsc_code?: string | null
          city?: string
          complete_profile?: boolean
          created_at?: string | null
          daily_rate?: number
          district?: string
          doj?: string | null
          email?: string
          employee_id?: string
          full_name?: string
          id?: string
          license_number?: string | null
          monthly_salary?: number | null
          ot_hourly_rate?: number
          phone?: string | null
          pl_used_as_on_date?: number
          role?: string
          shift_end_time?: string | null
          shift_start_time?: string | null
          state?: string
          state_id?: number | null
          status?: string
          street?: string | null
          supervisor_id?: string | null
          total_pl_quota?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      villages: {
        Row: {
          created_at: string
          district_id: number
          id: number
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          district_id: number
          id: number
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          district_id?: number
          id?: number
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "villages_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      operator_worked_hours: {
        Row: {
          daily_attendance_status: string | null
          employee_id: string | null
          first_punch_in: string | null
          last_punch_out: string | null
          log_date: string | null
          machine_ids_worked: string[] | null
          operator_id: string | null
          operator_name: string | null
          shift_codes_logged: string[] | null
          shifts_logged_count: number | null
          total_breakdown_hours: number | null
          total_machine_running_hours: number | null
          total_normal_hours: number | null
          total_overtime_hours: number | null
          total_worked_hours: number | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_hour_logs_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_hour_logs_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pg_all_foreign_keys: {
        Row: {
          fk_columns: unknown[] | null
          fk_constraint_name: unknown
          fk_schema_name: unknown
          fk_table_name: unknown
          fk_table_oid: unknown
          is_deferrable: boolean | null
          is_deferred: boolean | null
          match_type: string | null
          on_delete: string | null
          on_update: string | null
          pk_columns: unknown[] | null
          pk_constraint_name: unknown
          pk_index_name: unknown
          pk_schema_name: unknown
          pk_table_name: unknown
          pk_table_oid: unknown
        }
        Relationships: []
      }
      profiles: {
        Row: {
          aadhaar_number: string | null
          bank_account_number: string | null
          bank_ifsc_code: string | null
          city: string | null
          complete_profile: boolean | null
          created_at: string | null
          daily_rate: number | null
          district: string | null
          doj: string | null
          email: string | null
          employee_id: string | null
          full_name: string | null
          id: string | null
          license_number: string | null
          monthly_salary: number | null
          ot_hourly_rate: number | null
          phone: string | null
          pl_used_as_on_date: number | null
          role: string | null
          shift_end_time: string | null
          shift_start_time: string | null
          state: string | null
          state_id: number | null
          status: string | null
          street: string | null
          supervisor_id: string | null
          total_pl_quota: number | null
          updated_at: string | null
        }
        Insert: {
          aadhaar_number?: string | null
          bank_account_number?: string | null
          bank_ifsc_code?: string | null
          city?: string | null
          complete_profile?: boolean | null
          created_at?: string | null
          daily_rate?: number | null
          district?: string | null
          doj?: string | null
          email?: string | null
          employee_id?: string | null
          full_name?: string | null
          id?: string | null
          license_number?: string | null
          monthly_salary?: number | null
          ot_hourly_rate?: number | null
          phone?: string | null
          pl_used_as_on_date?: number | null
          role?: string | null
          shift_end_time?: string | null
          shift_start_time?: string | null
          state?: string | null
          state_id?: number | null
          status?: string | null
          street?: string | null
          supervisor_id?: string | null
          total_pl_quota?: number | null
          updated_at?: string | null
        }
        Update: {
          aadhaar_number?: string | null
          bank_account_number?: string | null
          bank_ifsc_code?: string | null
          city?: string | null
          complete_profile?: boolean | null
          created_at?: string | null
          daily_rate?: number | null
          district?: string | null
          doj?: string | null
          email?: string | null
          employee_id?: string | null
          full_name?: string | null
          id?: string | null
          license_number?: string | null
          monthly_salary?: number | null
          ot_hourly_rate?: number | null
          phone?: string | null
          pl_used_as_on_date?: number | null
          role?: string | null
          shift_end_time?: string | null
          shift_start_time?: string | null
          state?: string | null
          state_id?: number | null
          status?: string | null
          street?: string | null
          supervisor_id?: string | null
          total_pl_quota?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_totals: {
        Row: {
          is_inter_state: boolean | null
          quotation_id: string | null
          subtotal_paise: number | null
          tax_paise: number | null
          total_paise: number | null
        }
        Relationships: []
      }
      rfq_list: {
        Row: {
          assigned_to: string | null
          company_name: string | null
          contact_name: string | null
          created_at: string | null
          email: string | null
          follow_up_at: string | null
          headline: string | null
          id: string | null
          item_count: number | null
          last_activity_at: string | null
          phone: string | null
          priority: number | null
          project_city: string | null
          project_state_code: string | null
          rfq_number: string | null
          source: Database["public"]["Enums"]["rfq_source"] | null
          status: Database["public"]["Enums"]["rfq_status"] | null
          types: Database["public"]["Enums"]["rfq_requirement"][] | null
          version: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_requests_project_state_code_fkey"
            columns: ["project_state_code"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["code"]
          },
        ]
      }
      tap_funky: {
        Row: {
          args: string | null
          is_definer: boolean | null
          is_strict: boolean | null
          is_visible: boolean | null
          kind: unknown
          langoid: unknown
          name: unknown
          oid: unknown
          owner: unknown
          returns: string | null
          returns_set: boolean | null
          schema: unknown
          volatility: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _cleanup: { Args: never; Returns: boolean }
      _cleanup_duplicate_shift_logs: { Args: never; Returns: number }
      _contract_on: { Args: { "": string }; Returns: unknown }
      _currtest: { Args: never; Returns: number }
      _db_privs: { Args: never; Returns: unknown[] }
      _extensions: { Args: never; Returns: unknown[] }
      _get: { Args: { "": string }; Returns: number }
      _get_latest: { Args: { "": string }; Returns: number[] }
      _get_note: { Args: { "": string }; Returns: string }
      _is_verbose: { Args: never; Returns: boolean }
      _prokind: { Args: { p_oid: unknown }; Returns: unknown }
      _query: { Args: { "": string }; Returns: string }
      _refine_vol: { Args: { "": string }; Returns: string }
      _retval: { Args: { "": string }; Returns: string }
      _table_privs: { Args: never; Returns: unknown[] }
      _temptypes: { Args: { "": string }; Returns: string }
      _todo: { Args: never; Returns: string }
      activate_machine_for_assignment: {
        Args: { p_actor_id?: string; p_machine_id: string }
        Returns: Json
      }
      admin_reset_user_password: {
        Args: { new_password: string; target_user_id: string }
        Returns: Json
      }
      assign_client_supervisor_atomic: {
        Args: {
          p_assigned_by?: string
          p_client_id: string
          p_supervisor_id: string
        }
        Returns: Json
      }
      assign_client_supervisors_atomic: {
        Args: {
          p_assigned_by?: string
          p_client_id: string
          p_supervisor_ids: string[]
        }
        Returns: Json
      }
      assign_machine_operator_atomic: {
        Args: {
          p_assigned_by?: string
          p_machine_id: string
          p_operator_id?: string
        }
        Returns: Json
      }
      assign_operator_machine_atomic: {
        Args: {
          p_assigned_by?: string
          p_machine_id: string
          p_notes?: string
          p_operator_id: string
          p_shift_code?: string
          p_shift_end?: string
          p_shift_end_time?: string
          p_shift_start?: string
          p_shift_start_time?: string
        }
        Returns: Json
      }
      bulk_delete_or_deactivate_users_atomic: {
        Args: { p_user_ids: string[] }
        Returns: Json
      }
      bulk_update_operator_payroll_rates:
        | { Args: { p_updates: Json }; Returns: Json }
        | { Args: { p_payroll_month?: string; p_updates: Json }; Returns: Json }
      can_manage_operator_shift_log: {
        Args: { p_actor_id: string; p_operator_id: string }
        Returns: boolean
      }
      can_manage_rfq: { Args: never; Returns: boolean }
      check_dos_protection_settings: {
        Args: never
        Returns: {
          setting_name: string
          setting_value: string
        }[]
      }
      check_user_can_access_client:
        | { Args: { p_client_id: string }; Returns: boolean }
        | {
            Args: { p_client_id: string; p_user_id?: string }
            Returns: boolean
          }
      check_user_can_access_machine:
        | { Args: { p_machine_id: string }; Returns: boolean }
        | {
            Args: { p_machine_id: string; p_user_id?: string }
            Returns: boolean
          }
      clean_dev_seed_data: { Args: never; Returns: undefined }
      close_expired_job_postings: { Args: never; Returns: number }
      col_is_null:
        | {
            Args: {
              column_name: unknown
              description?: string
              schema_name: unknown
              table_name: unknown
            }
            Returns: string
          }
        | {
            Args: {
              column_name: unknown
              description?: string
              table_name: unknown
            }
            Returns: string
          }
      col_not_null:
        | {
            Args: {
              column_name: unknown
              description?: string
              schema_name: unknown
              table_name: unknown
            }
            Returns: string
          }
        | {
            Args: {
              column_name: unknown
              description?: string
              table_name: unknown
            }
            Returns: string
          }
      complete_user_onboarding_atomic: {
        Args: {
          p_aadhaar_number?: string
          p_address: string
          p_city: string
          p_district: string
          p_full_name: string
          p_license_number?: string
          p_phone: string
          p_role: string
          p_shift_time: string
          p_state: string
          p_state_id?: number
          p_user_id: string
        }
        Returns: Json
      }
      current_user_role: { Args: never; Returns: string }
      deactivate_user_atomic: {
        Args: { p_target_user_id: string }
        Returns: Json
      }
      delete_or_deactivate_user_atomic: {
        Args: { p_force_permanent?: boolean; p_target_user_id: string }
        Returns: Json
      }
      diag:
        | {
            Args: { msg: unknown }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { msg: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      diag_test_name: { Args: { "": string }; Returns: string }
      do_shifts_overlap: {
        Args: {
          p_end1: string
          p_end2: string
          p_start1: string
          p_start2: string
        }
        Returns: boolean
      }
      do_tap:
        | { Args: never; Returns: string[] }
        | { Args: { "": string }; Returns: string[] }
      end_operator_machine_assignment_atomic: {
        Args: {
          p_assignment_id: string
          p_end_reason?: string
          p_ended_by?: string
        }
        Returns: Json
      }
      fail:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      find_similar_sites: {
        Args: { p_client_id: string; p_pincode: string; p_street: string }
        Returns: {
          id: string
          similarity: number
          site_name: string
          street: string
        }[]
      }
      findfuncs: { Args: { "": string }; Returns: string[] }
      finish: { Args: { exception_on_failure?: boolean }; Returns: string[] }
      format_type_string: { Args: { "": string }; Returns: string }
      get_active_supervisors_public: {
        Args: never
        Returns: {
          full_name: string
          id: string
        }[]
      }
      get_admin_dashboard: { Args: never; Returns: Json }
      get_attendance_daily_detail:
        | {
            Args: { p_employee_id: string; p_month: number; p_year: number }
            Returns: Json
          }
        | {
            Args: {
              p_employee_id: string
              p_month: number
              p_page: number
              p_page_size: number
              p_year: number
            }
            Returns: Json
          }
      get_attendance_monthly_summary: {
        Args: {
          p_month: number
          p_overtime?: string
          p_page?: number
          p_page_size?: number
          p_role?: string
          p_search?: string
          p_sort_by?: string
          p_state?: string
          p_status?: string
          p_year: number
        }
        Returns: Json
      }
      get_clients_directory_summary: { Args: never; Returns: Json }
      get_eligible_client_supervisors: {
        Args: never
        Returns: {
          email: string
          employee_id: string
          full_name: string
          id: string
          phone: string
        }[]
      }
      get_hiring_summary: { Args: never; Returns: Json }
      get_hr_dashboard: { Args: never; Returns: Json }
      get_hr_payroll_summary: {
        Args: { p_payroll_month?: string }
        Returns: Json
      }
      get_machines_directory_summary:
        | {
            Args: { p_operator_id?: string; p_supervisor_id?: string }
            Returns: Json
          }
        | {
            Args: {
              p_client_id?: string
              p_operator_id?: string
              p_supervisor_id?: string
            }
            Returns: Json
          }
      get_manager_dashboard: { Args: never; Returns: Json }
      get_operation_logs: {
        Args: {
          breakdown_only?: boolean
          client_id?: string
          cursor?: string
          end_date?: string
          limit?: number
          machine_id?: string
          operator_id?: string
          p_breakdown_only?: boolean
          p_client_id?: string
          p_cursor?: string
          p_end_date?: string
          p_limit?: number
          p_machine_id?: string
          p_operator_id?: string
          p_page?: number
          p_search?: string
          p_shift?: string
          p_site?: string
          p_start_date?: string
          p_view?: string
          page?: number
          search?: string
          shift?: string
          site?: string
          start_date?: string
          view?: string
        }
        Returns: Json
      }
      get_operations_summary: {
        Args: {
          p_client_id?: string
          p_end_date?: string
          p_machine_id?: string
          p_operator_id?: string
          p_site?: string
          p_start_date?: string
        }
        Returns: Json
      }
      get_operator_dashboard: {
        Args: { p_operator_id?: string }
        Returns: Json
      }
      get_operator_entry_context: {
        Args: { p_operator_id?: string }
        Returns: Json
      }
      get_public_job_by_slug: { Args: { p_slug: string }; Returns: Json }
      get_public_job_filters: { Args: never; Returns: Json }
      get_public_job_slugs: {
        Args: never
        Returns: {
          slug: string
          updated_at: string
        }[]
      }
      get_public_jobs: {
        Args: {
          p_department?: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_state_id?: number
          p_type?: string
          p_workplace?: string
        }
        Returns: Json
      }
      get_super_admin_dashboard: { Args: never; Returns: Json }
      get_supervisor_dashboard: {
        Args: { p_supervisor_id?: string }
        Returns: Json
      }
      get_today_shift_log_monitor: {
        Args: {
          p_actor_id: string
          p_client_id?: string
          p_log_date?: string
          p_search?: string
        }
        Returns: {
          client_city: string
          client_code: string
          client_id: string
          client_name: string
          current_meter: number
          end_meter: number
          entered_by: string
          entered_by_name: string
          entry_source: string
          log_date: string
          log_id: string
          machine_code: string
          machine_health_status: string
          machine_id: string
          machine_model: string
          machine_serial_number: string
          machine_status: string
          operator_employee_id: string
          operator_id: string
          operator_name: string
          operator_phone: string
          remarks: string
          running_hours: number
          shift_code: string
          shift_end: string
          shift_name: string
          shift_start: string
          site_name: string
          start_meter: number
          status: string
        }[]
      }
      get_today_shift_log_monitor_paginated: {
        Args: {
          p_actor_id: string
          p_client_id?: string
          p_log_date?: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_shift_code?: string
          p_sort?: string
          p_status?: string
        }
        Returns: Json
      }
      get_today_shift_log_monitor_v1: {
        Args: { p_actor_id: string; p_log_date?: string; p_search?: string }
        Returns: {
          client_code: string
          client_id: string
          client_name: string
          current_meter: number
          end_meter: number
          entered_by: string
          entered_by_name: string
          entry_source: string
          log_date: string
          log_id: string
          machine_code: string
          machine_id: string
          machine_model: string
          machine_serial_number: string
          operator_id: string
          operator_name: string
          operator_phone: string
          remarks: string
          running_hours: number
          shift_code: string
          shift_end: string
          shift_name: string
          shift_start: string
          start_meter: number
          status: string
        }[]
      }
      get_today_shift_monitor_summary: {
        Args: { p_actor_id: string; p_client_id?: string; p_log_date?: string }
        Returns: Json
      }
      get_unread_notifications: {
        Args: { p_user_id?: string }
        Returns: {
          category: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json
          severity: string
          title: string
          user_id: string
        }[]
      }
      get_user_aggregates: { Args: never; Returns: Json }
      get_users_directory_summary: {
        Args: { p_supervisor_id?: string }
        Returns: Json
      }
      has_unique: { Args: { "": string }; Returns: string }
      in_todo: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_empty: { Args: { "": string }; Returns: string }
      is_marketing: { Args: never; Returns: boolean }
      is_operator_under_supervisor: {
        Args: { p_operator_id: string; p_supervisor_id: string }
        Returns: boolean
      }
      is_supervisor_or_admin: { Args: never; Returns: boolean }
      isnt_empty: { Args: { "": string }; Returns: string }
      like_escape: { Args: { t: string }; Returns: string }
      lives_ok: { Args: { "": string }; Returns: string }
      mark_notifications_read: {
        Args: { p_notification_ids: string[] }
        Returns: undefined
      }
      next_rfq_number: { Args: never; Returns: string }
      no_plan: { Args: never; Returns: boolean[] }
      norm_text: { Args: { t: string }; Returns: string }
      num_failed: { Args: never; Returns: number }
      os_name: { Args: never; Returns: string }
      pass:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      pg_version: { Args: never; Returns: string }
      pg_version_num: { Args: never; Returns: number }
      pgtap_version: { Args: never; Returns: number }
      recompute_maintenance: {
        Args: { p_client: string; p_machine: string; p_month: string }
        Returns: undefined
      }
      remove_client_supervisor_atomic: {
        Args: {
          p_client_id: string
          p_removed_by?: string
          p_supervisor_id: string
        }
        Returns: Json
      }
      resolve_hour_log_conflict_atomic: {
        Args: {
          p_action: string
          p_adjusted_end_time?: string
          p_log_id: string
          p_notes?: string
          p_resolved_by?: string
          p_resolver_id?: string
        }
        Returns: Json
      }
      rfq_add_note: {
        Args: { p_id: string; p_text: string }
        Returns: {
          actor_id: string | null
          created_at: string
          data: Json
          id: number
          request_id: string
          type: Database["public"]["Enums"]["rfq_event_type"]
        }
        SetofOptions: {
          from: "*"
          to: "rfq_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rfq_assign: {
        Args: { p_expected_version: number; p_id: string; p_user: string }
        Returns: {
          assigned_to: string | null
          attribution: Json | null
          client_notes: string | null
          closed_at: string | null
          company_id: string | null
          consent_at: string | null
          contact_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          follow_up_at: string | null
          id: string
          idempotency_key: string | null
          ip_hash: string | null
          last_activity_at: string
          lost_reason: Database["public"]["Enums"]["lost_reason"] | null
          priority: number
          project_city: string
          project_site_address: string | null
          project_state_code: string
          required_from: string | null
          rfq_number: string
          source: Database["public"]["Enums"]["rfq_source"]
          status: Database["public"]["Enums"]["rfq_status"]
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "quote_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rfq_create_quotation_version: {
        Args: { p_request_id: string }
        Returns: {
          created_at: string
          created_by: string | null
          id: string
          notes_to_client: string | null
          pdf_path: string | null
          place_of_supply_state: string
          request_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["quotation_status"]
          terms_md: string
          updated_at: string
          valid_until: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "quotations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rfq_dashboard: { Args: { p_from: string; p_to: string }; Returns: Json }
      rfq_log_contact: {
        Args: { p_channel: string; p_id: string; p_summary: string }
        Returns: {
          actor_id: string | null
          created_at: string
          data: Json
          id: number
          request_id: string
          type: Database["public"]["Enums"]["rfq_event_type"]
        }
        SetofOptions: {
          from: "*"
          to: "rfq_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rfq_merge_company: {
        Args: { p_from_company_id: string; p_to_company_id: string }
        Returns: Json
      }
      rfq_reopen: {
        Args: { p_id: string }
        Returns: {
          assigned_to: string | null
          attribution: Json | null
          client_notes: string | null
          closed_at: string | null
          company_id: string | null
          consent_at: string | null
          contact_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          follow_up_at: string | null
          id: string
          idempotency_key: string | null
          ip_hash: string | null
          last_activity_at: string
          lost_reason: Database["public"]["Enums"]["lost_reason"] | null
          priority: number
          project_city: string
          project_site_address: string | null
          project_state_code: string
          required_from: string | null
          rfq_number: string
          source: Database["public"]["Enums"]["rfq_source"]
          status: Database["public"]["Enums"]["rfq_status"]
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "quote_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rfq_search: {
        Args: { p_limit?: number; q: string }
        Returns: {
          assigned_to: string | null
          company_name: string | null
          contact_name: string | null
          created_at: string | null
          email: string | null
          follow_up_at: string | null
          headline: string | null
          id: string | null
          item_count: number | null
          last_activity_at: string | null
          phone: string | null
          priority: number | null
          project_city: string | null
          project_state_code: string | null
          rfq_number: string | null
          source: Database["public"]["Enums"]["rfq_source"] | null
          status: Database["public"]["Enums"]["rfq_status"] | null
          types: Database["public"]["Enums"]["rfq_requirement"][] | null
          version: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "rfq_list"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      rfq_send_quotation: {
        Args: { p_quotation_id: string }
        Returns: {
          created_at: string
          created_by: string | null
          id: string
          notes_to_client: string | null
          pdf_path: string | null
          place_of_supply_state: string
          request_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["quotation_status"]
          terms_md: string
          updated_at: string
          valid_until: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "quotations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rfq_set_follow_up: {
        Args: { p_follow_up_at: string; p_id: string }
        Returns: {
          assigned_to: string | null
          attribution: Json | null
          client_notes: string | null
          closed_at: string | null
          company_id: string | null
          consent_at: string | null
          contact_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          follow_up_at: string | null
          id: string
          idempotency_key: string | null
          ip_hash: string | null
          last_activity_at: string
          lost_reason: Database["public"]["Enums"]["lost_reason"] | null
          priority: number
          project_city: string
          project_site_address: string | null
          project_state_code: string
          required_from: string | null
          rfq_number: string
          source: Database["public"]["Enums"]["rfq_source"]
          status: Database["public"]["Enums"]["rfq_status"]
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "quote_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rfq_set_status: {
        Args: {
          p_expected_version: number
          p_id: string
          p_lost_reason?: Database["public"]["Enums"]["lost_reason"]
          p_note?: string
          p_to: Database["public"]["Enums"]["rfq_status"]
        }
        Returns: {
          assigned_to: string | null
          attribution: Json | null
          client_notes: string | null
          closed_at: string | null
          company_id: string | null
          consent_at: string | null
          contact_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          follow_up_at: string | null
          id: string
          idempotency_key: string | null
          ip_hash: string | null
          last_activity_at: string
          lost_reason: Database["public"]["Enums"]["lost_reason"] | null
          priority: number
          project_city: string
          project_site_address: string | null
          project_state_code: string
          required_from: string | null
          rfq_number: string
          source: Database["public"]["Enums"]["rfq_source"]
          status: Database["public"]["Enums"]["rfq_status"]
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "quote_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      runtests:
        | { Args: never; Returns: string[] }
        | { Args: { "": string }; Returns: string[] }
      shift_to_ranges: {
        Args: { p_end: string; p_start: string }
        Returns: unknown[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      skip:
        | { Args: { "": string }; Returns: string }
        | { Args: { how_many: number; why: string }; Returns: string }
      submit_job_application_atomic: {
        Args: {
          p_consent_version: string
          p_cover_note: string
          p_current_city: string
          p_current_ctc: number
          p_email: string
          p_expected_ctc: number
          p_full_name: string
          p_ip_hash: string
          p_job_id: string
          p_notice_period_days: number
          p_phone: string
          p_resume_file_name: string
          p_resume_mime: string
          p_resume_path: string
          p_resume_size_bytes: number
          p_total_experience_yrs: number
        }
        Returns: Json
      }
      submit_operator_hour_log_atomic: {
        Args: {
          p_breakdown_duration?: string
          p_breakdown_end_time?: string
          p_breakdown_hours?: number
          p_breakdown_start_time?: string
          p_client_id?: string
          p_end_date?: string
          p_end_datetime?: string
          p_end_meter?: number
          p_end_time?: string
          p_entered_by?: string
          p_idempotency_key?: string
          p_is_breakdown?: boolean
          p_location?: string
          p_log_date?: string
          p_machine_condition?: string
          p_machine_id: string
          p_normal_working_hours?: number
          p_operator_id: string
          p_overtime_hours?: number
          p_remarks?: string
          p_shift?: string
          p_shift_code?: string
          p_start_datetime?: string
          p_start_meter?: number
          p_start_time?: string
        }
        Returns: Json
      }
      submit_rfq: { Args: { p: Json }; Returns: Json }
      test_check_auth_access: { Args: never; Returns: boolean }
      throws_ok: { Args: { "": string }; Returns: string }
      todo:
        | { Args: { how_many: number }; Returns: boolean[] }
        | { Args: { how_many: number; why: string }; Returns: boolean[] }
        | { Args: { why: string }; Returns: boolean[] }
        | { Args: { how_many: number; why: string }; Returns: boolean[] }
      todo_end: { Args: never; Returns: boolean[] }
      todo_start:
        | { Args: never; Returns: boolean[] }
        | { Args: { "": string }; Returns: boolean[] }
      toggle_user_status_atomic: {
        Args: { p_requested_status?: string; p_target_user_id: string }
        Returns: Json
      }
      update_operator_payroll_rates:
        | {
            Args: {
              p_daily_rate: number
              p_operator_id: string
              p_ot_hourly_rate: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_daily_rate: number
              p_operator_id: string
              p_ot_hourly_rate: number
              p_payroll_month?: string
            }
            Returns: Json
          }
      update_operator_salary_statement: {
        Args: { p_fields: Json; p_operator_id: string; p_payroll_month: string }
        Returns: Json
      }
      upsert_user_document: {
        Args: {
          p_document_type_code: string
          p_file_name?: string
          p_file_size_bytes: number
          p_mime_type: string
          p_storage_path: string
          p_user_id: string
        }
        Returns: {
          created_at: string
          document_type_code: string
          file_name: string | null
          file_size_bytes: number
          id: string
          mime_type: string
          status: string
          storage_path: string
          updated_at: string
          uploaded_by: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verify_operations_rls_policies: { Args: never; Returns: Json }
    }
    Enums: {
      duration_unit: "day" | "week" | "month"
      equipment_status: "draft" | "published" | "archived"
      lost_reason:
        | "price"
        | "availability"
        | "competitor"
        | "no_response"
        | "project_cancelled"
        | "client_cancelled"
        | "not_serviceable"
        | "other"
      outbox_status: "pending" | "sending" | "sent" | "failed"
      power_type: "electric" | "diesel" | "hybrid" | "bi_energy" | "manual"
      quotation_status:
        | "draft"
        | "sent"
        | "accepted"
        | "rejected"
        | "expired"
        | "superseded"
      quote_line_kind: "rental" | "sale" | "transport" | "operator" | "other"
      rfq_event_type:
        | "created"
        | "status_changed"
        | "assigned"
        | "note"
        | "contacted"
        | "follow_up_set"
        | "attachment_added"
        | "quotation_created"
        | "quotation_revised"
        | "quotation_sent"
        | "email_sent"
        | "merged"
        | "reopened"
      rfq_requirement: "rental" | "purchase"
      rfq_source:
        | "website"
        | "equipment_page"
        | "phone"
        | "whatsapp"
        | "email"
        | "walk_in"
        | "referral"
      rfq_status:
        | "new"
        | "under_review"
        | "contacted"
        | "quotation_prepared"
        | "quotation_sent"
        | "on_hold"
        | "converted"
        | "lost"
        | "spam"
    }
    CompositeTypes: {
      _time_trial_type: {
        a_time: number | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      duration_unit: ["day", "week", "month"],
      equipment_status: ["draft", "published", "archived"],
      lost_reason: [
        "price",
        "availability",
        "competitor",
        "no_response",
        "project_cancelled",
        "client_cancelled",
        "not_serviceable",
        "other",
      ],
      outbox_status: ["pending", "sending", "sent", "failed"],
      power_type: ["electric", "diesel", "hybrid", "bi_energy", "manual"],
      quotation_status: [
        "draft",
        "sent",
        "accepted",
        "rejected",
        "expired",
        "superseded",
      ],
      quote_line_kind: ["rental", "sale", "transport", "operator", "other"],
      rfq_event_type: [
        "created",
        "status_changed",
        "assigned",
        "note",
        "contacted",
        "follow_up_set",
        "attachment_added",
        "quotation_created",
        "quotation_revised",
        "quotation_sent",
        "email_sent",
        "merged",
        "reopened",
      ],
      rfq_requirement: ["rental", "purchase"],
      rfq_source: [
        "website",
        "equipment_page",
        "phone",
        "whatsapp",
        "email",
        "walk_in",
        "referral",
      ],
      rfq_status: [
        "new",
        "under_review",
        "contacted",
        "quotation_prepared",
        "quotation_sent",
        "on_hold",
        "converted",
        "lost",
        "spam",
      ],
    },
  },
} as const
