/**
 * Generated from the live Supabase PostgREST OpenAPI schema.
 * Run `npm run db:types` after database migrations.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      admin_users: {
        Row: {
          active: boolean
          created_at: string
          email: string
          id: string
          last_login_at: string | null
          phone_e164: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          id?: string
          last_login_at?: string | null
          phone_e164?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          id?: string
          last_login_at?: string | null
          phone_e164?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      app_errors: {
        Row: {
          context: string | null
          created_at: string
          id: string
          level: string
          message: string
          metadata: Json | null
          source: string | null
          stack: string | null
          user_id: string | null
        }
        Insert: {
          context?: string | null
          created_at?: string
          id?: string
          level?: string
          message: string
          metadata?: Json | null
          source?: string | null
          stack?: string | null
          user_id?: string | null
        }
        Update: {
          context?: string | null
          created_at?: string
          id?: string
          level?: string
          message?: string
          metadata?: Json | null
          source?: string | null
          stack?: string | null
          user_id?: string | null
        }
        Relationships: [

        ]
      }
      bookings: {
        Row: {
          cancellation_type: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          confirmed_at: string | null
          created_at: string
          id: string
          lead_id: string
          no_show_marked: boolean
          no_show_marked_at: string | null
          scheduled_at: string
          service_id: string
          status: string
          user_id: string
        }
        Insert: {
          cancellation_type?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          lead_id: string
          no_show_marked?: boolean
          no_show_marked_at?: string | null
          scheduled_at: string
          service_id: string
          status?: string
          user_id: string
        }
        Update: {
          cancellation_type?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          no_show_marked?: boolean
          no_show_marked_at?: string | null
          scheduled_at?: string
          service_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_lead_id_fkey"
            columns: ["lead_id"]
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      brreg_entities: {
        Row: {
          antall_ansatte: number | null
          category: string | null
          forretningsadresse_adresse: Array<string> | null
          forretningsadresse_postnummer: string | null
          forretningsadresse_poststed: string | null
          naeringskode1_kode: string | null
          navn: string
          orgnr: string
          quality_score: number | null
          relevance_score: number | null
          verified: boolean | null
        }
        Insert: {
          antall_ansatte?: number | null
          category?: string | null
          forretningsadresse_adresse?: Array<string> | null
          forretningsadresse_postnummer?: string | null
          forretningsadresse_poststed?: string | null
          naeringskode1_kode?: string | null
          navn: string
          orgnr: string
          quality_score?: number | null
          relevance_score?: number | null
          verified?: boolean | null
        }
        Update: {
          antall_ansatte?: number | null
          category?: string | null
          forretningsadresse_adresse?: Array<string> | null
          forretningsadresse_postnummer?: string | null
          forretningsadresse_poststed?: string | null
          naeringskode1_kode?: string | null
          navn?: string
          orgnr?: string
          quality_score?: number | null
          relevance_score?: number | null
          verified?: boolean | null
        }
        Relationships: [

        ]
      }
      brreg_import_log: {
        Row: {
          completed_at: string | null
          id: number | null
          started_at: string | null
          status: string | null
          total_imported: number | null
        }
        Insert: {
          completed_at?: string | null
          id?: number | null
          started_at?: string | null
          status?: string | null
          total_imported?: number | null
        }
        Update: {
          completed_at?: string | null
          id?: number | null
          started_at?: string | null
          status?: string | null
          total_imported?: number | null
        }
        Relationships: [

        ]
      }
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [

        ]
      }
      city_refresh_log: {
        Row: {
          city: string
          last_refreshed_at: string
          refresh_count: number
        }
        Insert: {
          city: string
          last_refreshed_at?: string
          refresh_count?: number
        }
        Update: {
          city?: string
          last_refreshed_at?: string
          refresh_count?: number
        }
        Relationships: [

        ]
      }
      content_categories: {
        Row: {
          created_at: string
          description: string | null
          is_active: boolean
          key: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          is_active?: boolean
          key: string
          label: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          is_active?: boolean
          key?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [

        ]
      }
      content_category_listings: {
        Row: {
          address: string | null
          category_key: string | null
          city: string | null
          description: string | null
          goals: Array<string> | null
          lat: number | null
          lon: number | null
          offering_id: string | null
          offering_name: string | null
          price_level: string | null
          provider_id: string | null
          provider_kind: string | null
          provider_name: string | null
          quality_score: number | null
          tags: Array<string> | null
          venue_id: string | null
          venue_kind: string | null
          venue_name: string | null
        }
        Insert: {
          address?: string | null
          category_key?: string | null
          city?: string | null
          description?: string | null
          goals?: Array<string> | null
          lat?: number | null
          lon?: number | null
          offering_id?: string | null
          offering_name?: string | null
          price_level?: string | null
          provider_id?: string | null
          provider_kind?: string | null
          provider_name?: string | null
          quality_score?: number | null
          tags?: Array<string> | null
          venue_id?: string | null
          venue_kind?: string | null
          venue_name?: string | null
        }
        Update: {
          address?: string | null
          category_key?: string | null
          city?: string | null
          description?: string | null
          goals?: Array<string> | null
          lat?: number | null
          lon?: number | null
          offering_id?: string | null
          offering_name?: string | null
          price_level?: string | null
          provider_id?: string | null
          provider_kind?: string | null
          provider_name?: string | null
          quality_score?: number | null
          tags?: Array<string> | null
          venue_id?: string | null
          venue_kind?: string | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_category_listings_category_key_fkey"
            columns: ["category_key"]
            referencedRelation: "content_categories"
            referencedColumns: ["key"]
          }
        ]
      }
      content_migration_runs: {
        Row: {
          completed_at: string | null
          counters: Json
          error_message: string | null
          id: string
          plan_hash: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          counters: Json
          error_message?: string | null
          id?: string
          plan_hash: string
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          counters?: Json
          error_message?: string | null
          id?: string
          plan_hash?: string
          started_at?: string
          status?: string
        }
        Relationships: [

        ]
      }
      content_review_queue: {
        Row: {
          created_at: string
          id: string
          reasons: Array<string>
          resolved_at: string | null
          service_id: string
          status: string
          suggested_action: Json
        }
        Insert: {
          created_at?: string
          id?: string
          reasons: Array<string>
          resolved_at?: string | null
          service_id: string
          status?: string
          suggested_action: Json
        }
        Update: {
          created_at?: string
          id?: string
          reasons?: Array<string>
          resolved_at?: string | null
          service_id?: string
          status?: string
          suggested_action?: Json
        }
        Relationships: [
          {
            foreignKeyName: "content_review_queue_service_id_fkey"
            columns: ["service_id"]
            referencedRelation: "services"
            referencedColumns: ["id"]
          }
        ]
      }
      content_sources: {
        Row: {
          confidence: number
          entity_type: string
          external_id: string
          imported_at: string
          offering_id: string | null
          provider_id: string | null
          source: string
          source_updated_at: string | null
          venue_id: string | null
        }
        Insert: {
          confidence?: number
          entity_type: string
          external_id: string
          imported_at?: string
          offering_id?: string | null
          provider_id?: string | null
          source: string
          source_updated_at?: string | null
          venue_id?: string | null
        }
        Update: {
          confidence?: number
          entity_type?: string
          external_id?: string
          imported_at?: string
          offering_id?: string | null
          provider_id?: string | null
          source?: string
          source_updated_at?: string | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_sources_provider_id_fkey"
            columns: ["provider_id"]
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_sources_venue_id_fkey"
            columns: ["venue_id"]
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_sources_offering_id_fkey"
            columns: ["offering_id"]
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          }
        ]
      }
      content_sync_state: {
        Row: {
          attempt_count: number
          last_error: string | null
          last_synced_at: string | null
          service_id: string
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          last_error?: string | null
          last_synced_at?: string | null
          service_id: string
          status: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          last_error?: string | null
          last_synced_at?: string | null
          service_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [

        ]
      }
      deletion_requests: {
        Row: {
          completed_at: string | null
          id: string
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deletion_requests_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      destinations: {
        Row: {
          created_at: string
          destination_type: string
          elevation_m: number | null
          geom: Json
          id: string
          lat: number
          lon: number
          name: string
          osm_tags: Json | null
          source: string
          source_id: string | null
        }
        Insert: {
          created_at?: string
          destination_type: string
          elevation_m?: number | null
          geom: Json
          id?: string
          lat: number
          lon: number
          name: string
          osm_tags?: Json | null
          source?: string
          source_id?: string | null
        }
        Update: {
          created_at?: string
          destination_type?: string
          elevation_m?: number | null
          geom?: Json
          id?: string
          lat?: number
          lon?: number
          name?: string
          osm_tags?: Json | null
          source?: string
          source_id?: string | null
        }
        Relationships: [

        ]
      }
      email_events: {
        Row: {
          created_at: string
          id: string
          lead_id: string | null
          recipient_email: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id?: string | null
          recipient_email: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string | null
          recipient_email?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_events_lead_id_fkey"
            columns: ["lead_id"]
            referencedRelation: "leads"
            referencedColumns: ["id"]
          }
        ]
      }
      events: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          service_id: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          service_id?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          service_id?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [

        ]
      }
      feedback: {
        Row: {
          created_at: string
          id: string
          message: string
          page: string | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          page?: string | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          page?: string | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      group_sessions: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          creator_user_id: string
          description: string | null
          duration_minutes: number | null
          id: string
          is_active: boolean
          is_free: boolean
          lat: number | null
          location_notes: string | null
          lon: number | null
          main_category: string
          max_participants: number | null
          payment_info: string | null
          price: number | null
          recurrence_ends_at: string | null
          recurrence_type: string | null
          session_type: string
          starts_at: string
          status: string
          tags: Array<string>
          title: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          creator_user_id: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          is_free?: boolean
          lat?: number | null
          location_notes?: string | null
          lon?: number | null
          main_category?: string
          max_participants?: number | null
          payment_info?: string | null
          price?: number | null
          recurrence_ends_at?: string | null
          recurrence_type?: string | null
          session_type: string
          starts_at: string
          status?: string
          tags: Array<string>
          title: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          creator_user_id?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          is_free?: boolean
          lat?: number | null
          location_notes?: string | null
          lon?: number | null
          main_category?: string
          max_participants?: number | null
          payment_info?: string | null
          price?: number | null
          recurrence_ends_at?: string | null
          recurrence_type?: string | null
          session_type?: string
          starts_at?: string
          status?: string
          tags?: Array<string>
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_sessions_creator_user_id_fkey"
            columns: ["creator_user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      lead_messages: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          message: string
          sender_role: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          message: string
          sender_role: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          message?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_messages_lead_id_fkey"
            columns: ["lead_id"]
            referencedRelation: "leads"
            referencedColumns: ["id"]
          }
        ]
      }
      lead_time_suggestions: {
        Row: {
          id: string
          lead_id: string
          suggested_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          suggested_at: string
        }
        Update: {
          id?: string
          lead_id?: string
          suggested_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_time_suggestions_lead_id_fkey"
            columns: ["lead_id"]
            referencedRelation: "leads"
            referencedColumns: ["id"]
          }
        ]
      }
      leads: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          service_id: string
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message?: string
          name: string
          service_id: string
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          service_id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_service_id_fkey"
            columns: ["service_id"]
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      legacy_service_map: {
        Row: {
          confidence: number
          migrated_at: string
          migration_run_id: string | null
          offering_id: string | null
          provider_id: string | null
          reasons: Array<string>
          service_id: string
          status: string
          venue_id: string | null
        }
        Insert: {
          confidence: number
          migrated_at?: string
          migration_run_id?: string | null
          offering_id?: string | null
          provider_id?: string | null
          reasons: Array<string>
          service_id: string
          status: string
          venue_id?: string | null
        }
        Update: {
          confidence?: number
          migrated_at?: string
          migration_run_id?: string | null
          offering_id?: string | null
          provider_id?: string | null
          reasons?: Array<string>
          service_id?: string
          status?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legacy_service_map_service_id_fkey"
            columns: ["service_id"]
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legacy_service_map_provider_id_fkey"
            columns: ["provider_id"]
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legacy_service_map_venue_id_fkey"
            columns: ["venue_id"]
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legacy_service_map_offering_id_fkey"
            columns: ["offering_id"]
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legacy_service_map_migration_run_id_fkey"
            columns: ["migration_run_id"]
            referencedRelation: "content_migration_runs"
            referencedColumns: ["id"]
          }
        ]
      }
      locations: {
        Row: {
          city: string | null
          country: string | null
          created_at: string | null
          id: string
          label: string
          lat: number
          lon: number
          source: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          label: string
          lat: number
          lon: number
          source: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          label?: string
          lat?: number
          lon?: number
          source?: string
        }
        Relationships: [

        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_booking_cancelled: boolean
          email_booking_confirmed: boolean
          email_lead_created: boolean
          email_provider_replied: boolean
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email_booking_cancelled?: boolean
          email_booking_confirmed?: boolean
          email_lead_created?: boolean
          email_provider_replied?: boolean
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email_booking_cancelled?: boolean
          email_booking_confirmed?: boolean
          email_lead_created?: boolean
          email_provider_replied?: boolean
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      offering_categories: {
        Row: {
          category_key: string
          is_primary: boolean
          offering_id: string
          sync_managed: boolean
        }
        Insert: {
          category_key: string
          is_primary?: boolean
          offering_id: string
          sync_managed?: boolean
        }
        Update: {
          category_key?: string
          is_primary?: boolean
          offering_id?: string
          sync_managed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "offering_categories_offering_id_fkey"
            columns: ["offering_id"]
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offering_categories_category_key_fkey"
            columns: ["category_key"]
            referencedRelation: "content_categories"
            referencedColumns: ["key"]
          }
        ]
      }
      offering_venues: {
        Row: {
          is_primary: boolean
          offering_id: string
          sync_managed: boolean
          venue_id: string
        }
        Insert: {
          is_primary?: boolean
          offering_id: string
          sync_managed?: boolean
          venue_id: string
        }
        Update: {
          is_primary?: boolean
          offering_id?: string
          sync_managed?: boolean
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offering_venues_offering_id_fkey"
            columns: ["offering_id"]
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offering_venues_venue_id_fkey"
            columns: ["venue_id"]
            referencedRelation: "venues"
            referencedColumns: ["id"]
          }
        ]
      }
      offerings: {
        Row: {
          created_at: string
          delivery_mode: string
          description: string | null
          goals: Array<string>
          id: string
          is_active: boolean
          name: string
          price_level: string | null
          provider_id: string | null
          tags: Array<string>
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_mode?: string
          description?: string | null
          goals: Array<string>
          id: string
          is_active?: boolean
          name: string
          price_level?: string | null
          provider_id?: string | null
          tags: Array<string>
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_mode?: string
          description?: string | null
          goals?: Array<string>
          id?: string
          is_active?: boolean
          name?: string
          price_level?: string | null
          provider_id?: string | null
          tags?: Array<string>
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offerings_provider_id_fkey"
            columns: ["provider_id"]
            referencedRelation: "providers"
            referencedColumns: ["id"]
          }
        ]
      }
      organization_lead_stats: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          organization_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_lead_stats_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_lead_stats_lead_id_fkey"
            columns: ["lead_id"]
            referencedRelation: "leads"
            referencedColumns: ["id"]
          }
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          join_code: string | null
          name: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          join_code?: string | null
          name: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          join_code?: string | null
          name?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
        }
        Relationships: [

        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_pro: boolean
          phone: string | null
          phone_verified_at: string | null
          pro_verified_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_pro?: boolean
          phone?: string | null
          phone_verified_at?: string | null
          pro_verified_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_pro?: boolean
          phone?: string | null
          phone_verified_at?: string | null
          pro_verified_at?: string | null
        }
        Relationships: [

        ]
      }
      provider_availability: {
        Row: {
          end_time: string
          service_id: string
          start_time: string
          weekday: number
        }
        Insert: {
          end_time: string
          service_id: string
          start_time: string
          weekday: number
        }
        Update: {
          end_time?: string
          service_id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "provider_availability_service_id_fkey"
            columns: ["service_id"]
            referencedRelation: "services"
            referencedColumns: ["id"]
          }
        ]
      }
      provider_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          created_by: string | null
          email: string
          id: string
          service_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          service_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          service_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_invites_service_id_fkey"
            columns: ["service_id"]
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_invites_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      providers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          legal_name: string | null
          name: string
          orgnr: string | null
          owner_user_id: string | null
          phone: string | null
          provider_kind: string
          quality_score: number
          updated_at: string
          verification_status: string
          website: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          is_active?: boolean
          legal_name?: string | null
          name: string
          orgnr?: string | null
          owner_user_id?: string | null
          phone?: string | null
          provider_kind: string
          quality_score?: number
          updated_at?: string
          verification_status?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          name?: string
          orgnr?: string | null
          owner_user_id?: string | null
          phone?: string | null
          provider_kind?: string
          quality_score?: number
          updated_at?: string
          verification_status?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "providers_owner_user_id_fkey"
            columns: ["owner_user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      quality_events: {
        Row: {
          booking_id: string | null
          created_at: string
          id: string
          service_id: string
          type: string
          user_id: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          id?: string
          service_id: string
          type: string
          user_id?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          id?: string
          service_id?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_events_service_id_fkey"
            columns: ["service_id"]
            referencedRelation: "services"
            referencedColumns: ["id"]
          }
        ]
      }
      reviews: {
        Row: {
          comment: string
          created_at: string
          id: string
          lead_id: string | null
          rating: number
          service_id: string
          user_id: string
        }
        Insert: {
          comment?: string
          created_at?: string
          id?: string
          lead_id?: string | null
          rating: number
          service_id: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          lead_id?: string | null
          rating?: number
          service_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_lead_id_fkey"
            columns: ["lead_id"]
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_service_id_fkey"
            columns: ["service_id"]
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      search_cache: {
        Row: {
          cache_key: string
          created_at: string | null
          expires_at: string
          response: Json
        }
        Insert: {
          cache_key: string
          created_at?: string | null
          expires_at: string
          response: Json
        }
        Update: {
          cache_key?: string
          created_at?: string | null
          expires_at?: string
          response?: Json
        }
        Relationships: [

        ]
      }
      service_cache: {
        Row: {
          payload: Json
          service_id: string
          updated_at: string | null
        }
        Insert: {
          payload: Json
          service_id: string
          updated_at?: string | null
        }
        Update: {
          payload?: Json
          service_id?: string
          updated_at?: string | null
        }
        Relationships: [

        ]
      }
      service_categories: {
        Row: {
          category_id: string
          service_id: string
        }
        Insert: {
          category_id: string
          service_id: string
        }
        Update: {
          category_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_categories_service_id_fkey"
            columns: ["service_id"]
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_categories_category_id_fkey"
            columns: ["category_id"]
            referencedRelation: "categories"
            referencedColumns: ["id"]
          }
        ]
      }
      service_coverage: {
        Row: {
          city: string | null
          created_at: string | null
          id: string
          radius_center: Json | null
          radius_km: number | null
          region: string | null
          service_id: string
          type: string
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          id?: string
          radius_center?: Json | null
          radius_km?: number | null
          region?: string | null
          service_id: string
          type: string
        }
        Update: {
          city?: string | null
          created_at?: string | null
          id?: string
          radius_center?: Json | null
          radius_km?: number | null
          region?: string | null
          service_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_coverage_service_id_fkey"
            columns: ["service_id"]
            referencedRelation: "services"
            referencedColumns: ["id"]
          }
        ]
      }
      service_reports: {
        Row: {
          created_at: string | null
          id: string
          reason: string | null
          reporter_ip_hash: string | null
          service_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          reason?: string | null
          reporter_ip_hash?: string | null
          service_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          reason?: string | null
          reporter_ip_hash?: string | null
          service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_reports_service_id_fkey"
            columns: ["service_id"]
            referencedRelation: "services"
            referencedColumns: ["id"]
          }
        ]
      }
      service_types: {
        Row: {
          is_primary: boolean
          service_id: string
          type: string
        }
        Insert: {
          is_primary?: boolean
          service_id: string
          type: string
        }
        Update: {
          is_primary?: boolean
          service_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_types_service_id_fkey"
            columns: ["service_id"]
            referencedRelation: "services"
            referencedColumns: ["id"]
          }
        ]
      }
      services: {
        Row: {
          address: string | null
          base_location: Json | null
          cancellation_hours: number
          city: string | null
          cover_image_url: string | null
          coverage: Json
          created_at: string
          description: string
          email: string | null
          featured_rank: number | null
          goals: Array<string>
          id: string
          is_active: boolean
          is_featured: boolean | null
          lat: number | null
          logo_image_url: string | null
          lon: number | null
          main_category: string | null
          name: string
          orgnr: string | null
          oslo_bydel: string | null
          owner_user_id: string | null
          phone: string | null
          price_level: string
          provider_type: string
          rating_avg: number
          rating_count: number
          reported_at: string | null
          search_text: string | null
          stripe_customer_id: string | null
          subscription_status: string | null
          tags: Array<string>
          type: string
          venues: Array<string>
          website: string | null
        }
        Insert: {
          address?: string | null
          base_location?: Json | null
          cancellation_hours?: number
          city?: string | null
          cover_image_url?: string | null
          coverage: Json
          created_at?: string
          description?: string
          email?: string | null
          featured_rank?: number | null
          goals: Array<string>
          id?: string
          is_active?: boolean
          is_featured?: boolean | null
          lat?: number | null
          logo_image_url?: string | null
          lon?: number | null
          main_category?: string | null
          name: string
          orgnr?: string | null
          oslo_bydel?: string | null
          owner_user_id?: string | null
          phone?: string | null
          price_level?: string
          provider_type?: string
          rating_avg?: number
          rating_count?: number
          reported_at?: string | null
          search_text?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          tags: Array<string>
          type?: string
          venues: Array<string>
          website?: string | null
        }
        Update: {
          address?: string | null
          base_location?: Json | null
          cancellation_hours?: number
          city?: string | null
          cover_image_url?: string | null
          coverage?: Json
          created_at?: string
          description?: string
          email?: string | null
          featured_rank?: number | null
          goals?: Array<string>
          id?: string
          is_active?: boolean
          is_featured?: boolean | null
          lat?: number | null
          logo_image_url?: string | null
          lon?: number | null
          main_category?: string | null
          name?: string
          orgnr?: string | null
          oslo_bydel?: string | null
          owner_user_id?: string | null
          phone?: string | null
          price_level?: string
          provider_type?: string
          rating_avg?: number
          rating_count?: number
          reported_at?: string | null
          search_text?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          tags?: Array<string>
          type?: string
          venues?: Array<string>
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_owner_user_id_fkey"
            columns: ["owner_user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      session_participants: {
        Row: {
          id: string
          joined_at: string
          session_id: string
          status: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          session_id: string
          status?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          session_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_participants_session_id_fkey"
            columns: ["session_id"]
            referencedRelation: "group_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participants_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      settlements: {
        Row: {
          county: string | null
          created_at: string
          geom: Json
          id: string
          is_city: boolean
          municipality: string | null
          name: string | null
          population: number | null
          source: string
          source_local_id: string | null
        }
        Insert: {
          county?: string | null
          created_at?: string
          geom: Json
          id?: string
          is_city?: boolean
          municipality?: string | null
          name?: string | null
          population?: number | null
          source?: string
          source_local_id?: string | null
        }
        Update: {
          county?: string | null
          created_at?: string
          geom?: Json
          id?: string
          is_city?: boolean
          municipality?: string | null
          name?: string | null
          population?: number | null
          source?: string
          source_local_id?: string | null
        }
        Relationships: [

        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: [

        ]
      }
      trails: {
        Row: {
          created_at: string
          difficulty: string | null
          end_point: Json | null
          geom: Json
          id: string
          length_km: number | null
          maintainer: string | null
          marked: boolean | null
          municipality: string | null
          name: string | null
          source: string
          source_local_id: string | null
          start_point: Json | null
          trail_type: string
        }
        Insert: {
          created_at?: string
          difficulty?: string | null
          end_point?: Json | null
          geom: Json
          id?: string
          length_km?: number | null
          maintainer?: string | null
          marked?: boolean | null
          municipality?: string | null
          name?: string | null
          source?: string
          source_local_id?: string | null
          start_point?: Json | null
          trail_type: string
        }
        Update: {
          created_at?: string
          difficulty?: string | null
          end_point?: Json | null
          geom?: Json
          id?: string
          length_km?: number | null
          maintainer?: string | null
          marked?: boolean | null
          municipality?: string | null
          name?: string | null
          source?: string
          source_local_id?: string | null
          start_point?: Json | null
          trail_type?: string
        }
        Relationships: [

        ]
      }
      user_consents: {
        Row: {
          accepted_at: string
          consent_type: string
          id: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          consent_type: string
          id?: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          consent_type?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_consents_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      user_preferences: {
        Row: {
          last_budget: string | null
          last_goal: string | null
          last_lat: number | null
          last_location_label: string | null
          last_lon: number | null
          last_service_type: string | null
          last_venue: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          last_budget?: string | null
          last_goal?: string | null
          last_lat?: number | null
          last_location_label?: string | null
          last_lon?: number | null
          last_service_type?: string | null
          last_venue?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          last_budget?: string | null
          last_goal?: string | null
          last_lat?: number | null
          last_location_label?: string | null
          last_lon?: number | null
          last_service_type?: string | null
          last_venue?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      venues: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          email: string | null
          id: string
          lat: number | null
          lon: number | null
          municipality_code: string | null
          name: string
          phone: string | null
          postcode: string | null
          provider_id: string | null
          quality_score: number
          status: string
          updated_at: string
          venue_kind: string
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id: string
          lat?: number | null
          lon?: number | null
          municipality_code?: string | null
          name: string
          phone?: string | null
          postcode?: string | null
          provider_id?: string | null
          quality_score?: number
          status?: string
          updated_at?: string
          venue_kind: string
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lat?: number | null
          lon?: number | null
          municipality_code?: string | null
          name?: string
          phone?: string | null
          postcode?: string | null
          provider_id?: string | null
          quality_score?: number
          status?: string
          updated_at?: string
          venue_kind?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venues_provider_id_fkey"
            columns: ["provider_id"]
            referencedRelation: "providers"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: string | null
          f_table_catalog: string | null
          f_table_name: string | null
          f_table_schema: string | null
          srid: number | null
          type: string | null
        }
        Relationships: [

        ]
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: string | null
          f_table_catalog: string | null
          f_table_name: string | null
          f_table_schema: string | null
          srid: number | null
          type: string | null
        }
        Relationships: [

        ]
      }
    }
    Functions: {
      find_trail_route: {
        Args: {
        p_dest_lat: number | null
        p_dest_lon: number | null
        p_max_depth?: number | null
        p_user_lat: number | null
        p_user_lon: number | null
        }
        Returns: unknown
      }
      get_content_sync_health: {
        Args: {
        [_ in never]: never
        }
        Returns: unknown
      }
      get_destinations_in_bbox: {
        Args: {
        p_limit?: number | null
        p_max_lat: number | null
        p_max_lon: number | null
        p_min_lat: number | null
        p_min_lon: number | null
        p_types?: Array<string> | null
        }
        Returns: unknown
      }
      get_nearest_destinations: {
        Args: {
        p_lat: number | null
        p_limit?: number | null
        p_lon: number | null
        p_radius_km?: number | null
        p_types?: Array<string> | null
        }
        Returns: unknown
      }
      get_nearest_trails: {
        Args: {
        p_lat: number | null
        p_limit?: number | null
        p_lon: number | null
        p_radius_km: number | null
        }
        Returns: unknown
      }
      get_settlements_in_bbox: {
        Args: {
        p_limit?: number | null
        p_max_lat: number | null
        p_max_lon: number | null
        p_min_lat: number | null
        p_min_lon: number | null
        }
        Returns: unknown
      }
      get_trails_in_bbox: {
        Args: {
        p_limit?: number | null
        p_max_lat: number | null
        p_max_lon: number | null
        p_min_lat: number | null
        p_min_lon: number | null
        }
        Returns: unknown
      }
      is_org_admin: {
        Args: {
        org_id: string | null
        }
        Returns: unknown
      }
      search_services: {
        Args: {
        p_borough?: string | null
        p_budget: string | null
        p_city: string | null
        p_goal: string | null
        p_lat: number | null
        p_limit: number | null
        p_lon: number | null
        p_main_category?: string | null
        p_offset?: number | null
        p_query: string | null
        p_radius_km?: number | null
        p_service_type: string | null
        p_sort: string | null
        p_tag?: string | null
        p_tags?: Array<string> | null
        p_venue: string | null
        }
        Returns: unknown
      }
      search_content_category_services: {
        Args: {
        p_lat: number | null
        p_limit?: number | null
        p_lon: number | null
        p_main_category: string | null
        p_offset?: number | null
        p_radius_km?: number | null
        }
        Returns: unknown
      }
      search_content_services: {
        Args: {
        p_lat: number | null
        p_limit: number | null
        p_lon: number | null
        p_main_category: string | null
        p_offset: number | null
        p_query: string | null
        p_radius_km: number | null
        p_service_type: string | null
        p_sort: string | null
        p_tags: Array<string> | null
        p_venue: string | null
        }
        Returns: unknown
      }
      search_services_unanchored: {
        Args: {
        p_lat?: number | null
        p_limit?: number | null
        p_lon?: number | null
        p_query: string | null
        p_tags?: Array<string> | null
        }
        Returns: unknown
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
};
