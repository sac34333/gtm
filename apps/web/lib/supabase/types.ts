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
      available_models: {
        Row: {
          context_window: number | null
          cost_tier: string
          created_at: string
          default_for_step_key: string[] | null
          display_name: string
          id: string
          is_active: boolean
          is_recommended: boolean
          key_source: string
          max_output_tokens: number | null
          modality: string
          model_id: string
          notes: string | null
          provider_key: string
          recommendation_order: number | null
          updated_at: string
        }
        Insert: {
          context_window?: number | null
          cost_tier: string
          created_at?: string
          default_for_step_key?: string[] | null
          display_name: string
          id?: string
          is_active?: boolean
          is_recommended?: boolean
          key_source: string
          max_output_tokens?: number | null
          modality: string
          model_id: string
          notes?: string | null
          provider_key: string
          recommendation_order?: number | null
          updated_at?: string
        }
        Update: {
          context_window?: number | null
          cost_tier?: string
          created_at?: string
          default_for_step_key?: string[] | null
          display_name?: string
          id?: string
          is_active?: boolean
          is_recommended?: boolean
          key_source?: string
          max_output_tokens?: number | null
          modality?: string
          model_id?: string
          notes?: string | null
          provider_key?: string
          recommendation_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "available_models_provider_key_fkey"
            columns: ["provider_key"]
            isOneToOne: false
            referencedRelation: "model_providers"
            referencedColumns: ["provider_key"]
          },
        ]
      }
      brand_contexts: {
        Row: {
          active_themes: Json | null
          anti_reference_images: Json | null
          brand_colours: Json | null
          brand_context_embedding: string | null
          brand_guidelines_text: string | null
          brand_guidelines_url: string | null
          busy_minimal: string | null
          company_name: string | null
          company_size: string | null
          competitor_names: Json | null
          country_code: string | null
          created_at: string
          cta_style: string | null
          dark_light_preference: string | null
          decision_maker_titles: Json | null
          emoji_usage: string | null
          extended_description: string | null
          founding_year: number | null
          human_faces: boolean | null
          id: string
          industry_sector: string | null
          jargon_level: string | null
          last_icp_criteria: Json | null
          location_style: string | null
          logo_url: string | null
          one_sentence_pitch: string | null
          org_id: string
          phrases_to_avoid: Json | null
          posts_per_week: number | null
          primary_platform: string | null
          products_services: Json | null
          reference_images: Json | null
          revenue_model: string | null
          secondary_platform: string | null
          sensitivities: string | null
          sentence_length: string | null
          target_company_sizes: Json | null
          target_geographies: Json | null
          target_industries: Json | null
          timezone: string | null
          tone_bold: number | null
          tone_educational: number | null
          tone_formal: number | null
          tone_inspirational: number | null
          tone_playful: number | null
          topics_to_avoid: Json | null
          updated_at: string
          visual_style: string | null
          visual_styles_to_avoid: Json | null
          voice_examples: Json | null
          website_url: string | null
        }
        Insert: {
          active_themes?: Json | null
          anti_reference_images?: Json | null
          brand_colours?: Json | null
          brand_context_embedding?: string | null
          brand_guidelines_text?: string | null
          brand_guidelines_url?: string | null
          busy_minimal?: string | null
          company_name?: string | null
          company_size?: string | null
          competitor_names?: Json | null
          country_code?: string | null
          created_at?: string
          cta_style?: string | null
          dark_light_preference?: string | null
          decision_maker_titles?: Json | null
          emoji_usage?: string | null
          extended_description?: string | null
          founding_year?: number | null
          human_faces?: boolean | null
          id?: string
          industry_sector?: string | null
          jargon_level?: string | null
          last_icp_criteria?: Json | null
          location_style?: string | null
          logo_url?: string | null
          one_sentence_pitch?: string | null
          org_id: string
          phrases_to_avoid?: Json | null
          posts_per_week?: number | null
          primary_platform?: string | null
          products_services?: Json | null
          reference_images?: Json | null
          revenue_model?: string | null
          secondary_platform?: string | null
          sensitivities?: string | null
          sentence_length?: string | null
          target_company_sizes?: Json | null
          target_geographies?: Json | null
          target_industries?: Json | null
          timezone?: string | null
          tone_bold?: number | null
          tone_educational?: number | null
          tone_formal?: number | null
          tone_inspirational?: number | null
          tone_playful?: number | null
          topics_to_avoid?: Json | null
          updated_at?: string
          visual_style?: string | null
          visual_styles_to_avoid?: Json | null
          voice_examples?: Json | null
          website_url?: string | null
        }
        Update: {
          active_themes?: Json | null
          anti_reference_images?: Json | null
          brand_colours?: Json | null
          brand_context_embedding?: string | null
          brand_guidelines_text?: string | null
          brand_guidelines_url?: string | null
          busy_minimal?: string | null
          company_name?: string | null
          company_size?: string | null
          competitor_names?: Json | null
          country_code?: string | null
          created_at?: string
          cta_style?: string | null
          dark_light_preference?: string | null
          decision_maker_titles?: Json | null
          emoji_usage?: string | null
          extended_description?: string | null
          founding_year?: number | null
          human_faces?: boolean | null
          id?: string
          industry_sector?: string | null
          jargon_level?: string | null
          last_icp_criteria?: Json | null
          location_style?: string | null
          logo_url?: string | null
          one_sentence_pitch?: string | null
          org_id?: string
          phrases_to_avoid?: Json | null
          posts_per_week?: number | null
          primary_platform?: string | null
          products_services?: Json | null
          reference_images?: Json | null
          revenue_model?: string | null
          secondary_platform?: string | null
          sensitivities?: string | null
          sentence_length?: string | null
          target_company_sizes?: Json | null
          target_geographies?: Json | null
          target_industries?: Json | null
          timezone?: string | null
          tone_bold?: number | null
          tone_educational?: number | null
          tone_formal?: number | null
          tone_inspirational?: number | null
          tone_playful?: number | null
          topics_to_avoid?: Json | null
          updated_at?: string
          visual_style?: string | null
          visual_styles_to_avoid?: Json | null
          voice_examples?: Json | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_contexts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_briefs: {
        Row: {
          brief_pdf_url: string | null
          brief_text: string | null
          created_at: string
          id: string
          job_id: string | null
          org_id: string
          signal_ids: Json | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          brief_pdf_url?: string | null
          brief_text?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          org_id: string
          signal_ids?: Json | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          brief_pdf_url?: string | null
          brief_text?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          org_id?: string
          signal_ids?: Json | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_briefs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "generation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_briefs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_configs: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_active: boolean
          last_fetched_at: string | null
          org_id: string
          source_type: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          last_fetched_at?: string | null
          org_id: string
          source_type: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          last_fetched_at?: string | null
          org_id?: string
          source_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_configs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_feedback: {
        Row: {
          created_at: string
          feedback_text: string | null
          id: string
          job_id: string
          org_id: string
          rating: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feedback_text?: string | null
          id?: string
          job_id: string
          org_id: string
          rating?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          feedback_text?: string | null
          id?: string
          job_id?: string
          org_id?: string
          rating?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_feedback_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "generation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_feedback_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          model_id: string
          org_id: string
          parent_job_id: string | null
          poll_count: number
          prompt_payload: Json | null
          provider_key: string
          result_metadata: Json | null
          result_url: string | null
          started_at: string | null
          status: string
          step_key: string
          updated_at: string
          version: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          model_id: string
          org_id: string
          parent_job_id?: string | null
          poll_count?: number
          prompt_payload?: Json | null
          provider_key: string
          result_metadata?: Json | null
          result_url?: string | null
          started_at?: string | null
          status?: string
          step_key: string
          updated_at?: string
          version?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          model_id?: string
          org_id?: string
          parent_job_id?: string | null
          poll_count?: number
          prompt_payload?: Json | null
          provider_key?: string
          result_metadata?: Json | null
          result_url?: string | null
          started_at?: string | null
          status?: string
          step_key?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "generation_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_jobs_parent_job_id_fkey"
            columns: ["parent_job_id"]
            isOneToOne: false
            referencedRelation: "generation_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      llm_usage_events: {
        Row: {
          completion_tokens: number | null
          cost_usd: number | null
          created_at: string
          id: string
          job_id: string | null
          langfuse_trace_id: string | null
          latency_ms: number | null
          model_id: string
          org_id: string
          prompt_tokens: number | null
          provider_key: string
          step_key: string
          total_tokens: number | null
        }
        Insert: {
          completion_tokens?: number | null
          cost_usd?: number | null
          created_at?: string
          id?: string
          job_id?: string | null
          langfuse_trace_id?: string | null
          latency_ms?: number | null
          model_id: string
          org_id: string
          prompt_tokens?: number | null
          provider_key: string
          step_key: string
          total_tokens?: number | null
        }
        Update: {
          completion_tokens?: number | null
          cost_usd?: number | null
          created_at?: string
          id?: string
          job_id?: string | null
          langfuse_trace_id?: string | null
          latency_ms?: number | null
          model_id?: string
          org_id?: string
          prompt_tokens?: number | null
          provider_key?: string
          step_key?: string
          total_tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "llm_usage_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "generation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_usage_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      model_providers: {
        Row: {
          base_url: string
          created_at: string
          id: string
          is_active: boolean
          models_endpoint: string | null
          name: string
          platform_key_available: boolean
          provider_key: string
          updated_at: string
        }
        Insert: {
          base_url: string
          created_at?: string
          id?: string
          is_active?: boolean
          models_endpoint?: string | null
          name: string
          platform_key_available?: boolean
          provider_key: string
          updated_at?: string
        }
        Update: {
          base_url?: string
          created_at?: string
          id?: string
          is_active?: boolean
          models_endpoint?: string | null
          name?: string
          platform_key_available?: boolean
          provider_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      org_api_keys: {
        Row: {
          created_at: string
          encrypted_value: string
          id: string
          key_name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          encrypted_value: string
          id?: string
          key_name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          encrypted_value?: string
          id?: string
          key_name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_api_keys_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_model_preferences: {
        Row: {
          created_at: string
          id: string
          model_id: string
          org_id: string
          provider_key: string
          step_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          model_id: string
          org_id: string
          provider_key: string
          step_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          model_id?: string
          org_id?: string
          provider_key?: string
          step_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_model_preferences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_provider_api_keys: {
        Row: {
          created_at: string
          encrypted_key: string
          id: string
          org_id: string
          provider_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          encrypted_key: string
          id?: string
          org_id: string
          provider_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          encrypted_key?: string
          id?: string
          org_id?: string
          provider_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_provider_api_keys_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      orgs: {
        Row: {
          created_at: string
          dodo_customer_id: string | null
          dodo_subscription_id: string | null
          id: string
          image_quota: number
          image_used: number
          last_signal_ingestion_at: string | null
          name: string
          onboarding_complete: boolean
          plan_tier: string
          quota_reset_at: string | null
          seat_limit: number
          signal_ingestion_enabled: boolean
          signal_ingestion_frequency: string
          slug: string
          updated_at: string
          video_quota: number
          video_used: number
        }
        Insert: {
          created_at?: string
          dodo_customer_id?: string | null
          dodo_subscription_id?: string | null
          id?: string
          image_quota?: number
          image_used?: number
          last_signal_ingestion_at?: string | null
          name: string
          onboarding_complete?: boolean
          plan_tier?: string
          quota_reset_at?: string | null
          seat_limit?: number
          signal_ingestion_enabled?: boolean
          signal_ingestion_frequency?: string
          slug: string
          updated_at?: string
          video_quota?: number
          video_used?: number
        }
        Update: {
          created_at?: string
          dodo_customer_id?: string | null
          dodo_subscription_id?: string | null
          id?: string
          image_quota?: number
          image_used?: number
          last_signal_ingestion_at?: string | null
          name?: string
          onboarding_complete?: boolean
          plan_tier?: string
          quota_reset_at?: string | null
          seat_limit?: number
          signal_ingestion_enabled?: boolean
          signal_ingestion_frequency?: string
          slug?: string
          updated_at?: string
          video_quota?: number
          video_used?: number
        }
        Relationships: []
      }
      outreach_copies: {
        Row: {
          body: string
          created_at: string
          id: string
          job_id: string | null
          org_id: string
          personalisation_data: Json | null
          platform: string | null
          prospect_id: string | null
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          job_id?: string | null
          org_id: string
          personalisation_data?: Json | null
          platform?: string | null
          prospect_id?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          job_id?: string | null
          org_id?: string
          personalisation_data?: Json | null
          platform?: string | null
          prospect_id?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_copies_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "generation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_copies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_copies_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          company_description: string | null
          company_name: string | null
          company_size: string | null
          created_at: string
          email: string | null
          enrichment_data: Json | null
          first_name: string | null
          icp_fit_reason: string | null
          icp_score: number | null
          id: string
          industry: string | null
          job_title: string | null
          last_name: string | null
          linkedin_url: string | null
          location: string | null
          org_id: string
          updated_at: string
        }
        Insert: {
          company_description?: string | null
          company_name?: string | null
          company_size?: string | null
          created_at?: string
          email?: string | null
          enrichment_data?: Json | null
          first_name?: string | null
          icp_fit_reason?: string | null
          icp_score?: number | null
          id?: string
          industry?: string | null
          job_title?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          location?: string | null
          org_id: string
          updated_at?: string
        }
        Update: {
          company_description?: string | null
          company_name?: string | null
          company_size?: string | null
          created_at?: string
          email?: string | null
          enrichment_data?: Json | null
          first_name?: string | null
          icp_fit_reason?: string | null
          icp_score?: number | null
          id?: string
          industry?: string | null
          job_title?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          location?: string | null
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      signals: {
        Row: {
          author: string | null
          created_at: string
          feed_config_id: string | null
          headline: string | null
          id: string
          is_archived: boolean
          org_id: string
          published_at: string | null
          raw_payload: Json | null
          relevance_score: number | null
          source_type: string
          summary: string | null
          updated_at: string
          url: string | null
          url_hash: string
        }
        Insert: {
          author?: string | null
          created_at?: string
          feed_config_id?: string | null
          headline?: string | null
          id?: string
          is_archived?: boolean
          org_id: string
          published_at?: string | null
          raw_payload?: Json | null
          relevance_score?: number | null
          source_type: string
          summary?: string | null
          updated_at?: string
          url?: string | null
          url_hash: string
        }
        Update: {
          author?: string | null
          created_at?: string
          feed_config_id?: string | null
          headline?: string | null
          id?: string
          is_archived?: boolean
          org_id?: string
          published_at?: string | null
          raw_payload?: Json | null
          relevance_score?: number | null
          source_type?: string
          summary?: string | null
          updated_at?: string
          url?: string | null
          url_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "signals_feed_config_id_fkey"
            columns: ["feed_config_id"]
            isOneToOne: false
            referencedRelation: "feed_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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

