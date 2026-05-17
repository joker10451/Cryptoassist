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
      achievements: {
        Row: {
          created_at: string | null
          criteria: Json | null
          description: string | null
          icon: string | null
          id: string
          name: string
          rarity: string | null
          slug: string
          xp_reward: number | null
        }
        Insert: {
          created_at?: string | null
          criteria?: Json | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          rarity?: string | null
          slug: string
          xp_reward?: number | null
        }
        Update: {
          created_at?: string | null
          criteria?: Json | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          rarity?: string | null
          slug?: string
          xp_reward?: number | null
        }
        Relationships: []
      }
      ai_analyses: {
        Row: {
          analysis_type: string | null
          created_at: string | null
          id: string
          input_data: Json | null
          output_data: Json | null
          project_id: string | null
          user_id: string | null
          wallet_id: string | null
        }
        Insert: {
          analysis_type?: string | null
          created_at?: string | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          project_id?: string | null
          user_id?: string | null
          wallet_id?: string | null
        }
        Update: {
          analysis_type?: string | null
          created_at?: string | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          project_id?: string | null
          user_id?: string | null
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_analyses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analyses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analyses_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      missed_opportunities: {
        Row: {
          completion_percentage: number | null
          detected_at: string | null
          estimated_lost_value: number | null
          id: string
          is_dismissed: boolean | null
          project_id: string | null
          reason: string | null
          user_id: string | null
        }
        Insert: {
          completion_percentage?: number | null
          detected_at?: string | null
          estimated_lost_value?: number | null
          id?: string
          is_dismissed?: boolean | null
          project_id?: string | null
          reason?: string | null
          user_id?: string | null
        }
        Update: {
          completion_percentage?: number | null
          detected_at?: string | null
          estimated_lost_value?: number | null
          id?: string
          is_dismissed?: boolean | null
          project_id?: string | null
          reason?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "missed_opportunities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missed_opportunities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          ai_summary: string | null
          category: string | null
          created_at: string | null
          deadline: string | null
          description: string | null
          discord_url: string | null
          docs_url: string | null
          ecosystem: string | null
          estimated_reward_max: number | null
          estimated_reward_min: number | null
          farming_cost: number | null
          farming_difficulty: number | null
          funding_amount: number | null
          funding_currency: string | null
          github_url: string | null
          id: string
          investors: string[] | null
          name: string
          probability_score: number | null
          risk_score: number | null
          slug: string
          snapshot_date: string | null
          snapshot_status: string | null
          status: string | null
          telegram_url: string | null
          token_status: string | null
          twitter_url: string | null
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          ai_summary?: string | null
          category?: string | null
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          discord_url?: string | null
          docs_url?: string | null
          ecosystem?: string | null
          estimated_reward_max?: number | null
          estimated_reward_min?: number | null
          farming_cost?: number | null
          farming_difficulty?: number | null
          funding_amount?: number | null
          funding_currency?: string | null
          github_url?: string | null
          id?: string
          investors?: string[] | null
          name: string
          probability_score?: number | null
          risk_score?: number | null
          slug: string
          snapshot_date?: string | null
          snapshot_status?: string | null
          status?: string | null
          telegram_url?: string | null
          token_status?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          ai_summary?: string | null
          category?: string | null
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          discord_url?: string | null
          docs_url?: string | null
          ecosystem?: string | null
          estimated_reward_max?: number | null
          estimated_reward_min?: number | null
          farming_cost?: number | null
          farming_difficulty?: number | null
          funding_amount?: number | null
          funding_currency?: string | null
          github_url?: string | null
          id?: string
          investors?: string[] | null
          name?: string
          probability_score?: number | null
          risk_score?: number | null
          slug?: string
          snapshot_date?: string | null
          snapshot_status?: string | null
          status?: string | null
          telegram_url?: string | null
          token_status?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      reminders: {
        Row: {
          channel: string | null
          created_at: string | null
          id: string
          is_recurring: boolean | null
          message: string | null
          project_id: string | null
          recurrence_rule: string | null
          scheduled_at: string
          sent_at: string | null
          task_id: string | null
          title: string
          type: string | null
          user_id: string | null
        }
        Insert: {
          channel?: string | null
          created_at?: string | null
          id?: string
          is_recurring?: boolean | null
          message?: string | null
          project_id?: string | null
          recurrence_rule?: string | null
          scheduled_at: string
          sent_at?: string | null
          task_id?: string | null
          title: string
          type?: string | null
          user_id?: string | null
        }
        Update: {
          channel?: string | null
          created_at?: string | null
          id?: string
          is_recurring?: boolean | null
          message?: string | null
          project_id?: string | null
          recurrence_rule?: string | null
          scheduled_at?: string
          sent_at?: string | null
          task_id?: string | null
          title?: string
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string | null
          deadline: string | null
          description: string | null
          difficulty: number | null
          estimated_time_minutes: number | null
          id: string
          is_recurring: boolean | null
          platform: string | null
          project_id: string | null
          recurrence_interval: string | null
          requirement_type: string | null
          status: string | null
          target_unit: string | null
          target_value: number | null
          task_type: string | null
          title: string
          url: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          difficulty?: number | null
          estimated_time_minutes?: number | null
          id?: string
          is_recurring?: boolean | null
          platform?: string | null
          project_id?: string | null
          recurrence_interval?: string | null
          requirement_type?: string | null
          status?: string | null
          target_unit?: string | null
          target_value?: number | null
          task_type?: string | null
          title: string
          url?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          difficulty?: number | null
          estimated_time_minutes?: number | null
          id?: string
          is_recurring?: boolean | null
          platform?: string | null
          project_id?: string | null
          recurrence_interval?: string | null
          requirement_type?: string | null
          status?: string | null
          target_unit?: string | null
          target_value?: number | null
          task_type?: string | null
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string | null
          id: string
          unlocked_at: string | null
          user_id: string | null
        }
        Insert: {
          achievement_id?: string | null
          id?: string
          unlocked_at?: string | null
          user_id?: string | null
        }
        Update: {
          achievement_id?: string | null
          id?: string
          unlocked_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_projects: {
        Row: {
          completed_at: string | null
          id: string
          notes: string | null
          progress: number | null
          project_id: string | null
          reminder_enabled: boolean | null
          started_at: string | null
          status: string | null
          user_id: string | null
          wallet_id: string | null
        }
        Insert: {
          completed_at?: string | null
          id?: string
          notes?: string | null
          progress?: number | null
          project_id?: string | null
          reminder_enabled?: boolean | null
          started_at?: string | null
          status?: string | null
          user_id?: string | null
          wallet_id?: string | null
        }
        Update: {
          completed_at?: string | null
          id?: string
          notes?: string | null
          progress?: number | null
          project_id?: string | null
          reminder_enabled?: boolean | null
          started_at?: string | null
          status?: string | null
          user_id?: string | null
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_projects_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tasks: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          proof_url: string | null
          status: string | null
          task_id: string | null
          user_id: string | null
          wallet_id: string | null
          xp_reward: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          proof_url?: string | null
          status?: string | null
          task_id?: string | null
          user_id?: string | null
          wallet_id?: string | null
          xp_reward?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          proof_url?: string | null
          status?: string | null
          task_id?: string | null
          user_id?: string | null
          wallet_id?: string | null
          xp_reward?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tasks_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          farmer_level: number | null
          id: string
          last_active: string | null
          plan: string | null
          streak_days: number | null
          updated_at: string | null
          username: string
          xp: number | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          farmer_level?: number | null
          id?: string
          last_active?: string | null
          plan?: string | null
          streak_days?: number | null
          updated_at?: string | null
          username: string
          xp?: number | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          farmer_level?: number | null
          id?: string
          last_active?: string | null
          plan?: string | null
          streak_days?: number | null
          updated_at?: string | null
          username?: string
          xp?: number | null
        }
        Relationships: []
      }
      wallets: {
        Row: {
          address: string
          chain: string | null
          created_at: string | null
          id: string
          label: string | null
          tags: string[] | null
          user_id: string | null
        }
        Insert: {
          address: string
          chain?: string | null
          created_at?: string | null
          id?: string
          label?: string | null
          tags?: string[] | null
          user_id?: string | null
        }
        Update: {
          address?: string
          chain?: string | null
          created_at?: string | null
          id?: string
          label?: string | null
          tags?: string[] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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

