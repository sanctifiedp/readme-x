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
      announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      attempt_answers: {
        Row: {
          attempt_id: string
          chosen_index: number | null
          id: string
          is_correct: boolean | null
          question_id: string
        }
        Insert: {
          attempt_id: string
          chosen_index?: number | null
          id?: string
          is_correct?: boolean | null
          question_id: string
        }
        Update: {
          attempt_id?: string
          chosen_index?: number | null
          id?: string
          is_correct?: boolean | null
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempt_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_attempts: {
        Row: {
          answers: Json | null
          challenge_id: string
          expires_at: string
          id: string
          score: number | null
          started_at: string
          submitted_at: string | null
          user_id: string
          wrong: number | null
        }
        Insert: {
          answers?: Json | null
          challenge_id: string
          expires_at: string
          id?: string
          score?: number | null
          started_at?: string
          submitted_at?: string | null
          user_id: string
          wrong?: number | null
        }
        Update: {
          answers?: Json | null
          challenge_id?: string
          expires_at?: string
          id?: string
          score?: number | null
          started_at?: string
          submitted_at?: string | null
          user_id?: string
          wrong?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "challenge_attempts_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          accepted_at: string | null
          challenger_id: string
          completed_at: string | null
          course_id: string
          created_at: string
          duration_seconds: number
          id: string
          opponent_id: string
          question_count: number
          question_ids: Json
          status: string
          winner_user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          challenger_id: string
          completed_at?: string | null
          course_id: string
          created_at?: string
          duration_seconds?: number
          id?: string
          opponent_id: string
          question_count?: number
          question_ids: Json
          status?: string
          winner_user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          challenger_id?: string
          completed_at?: string | null
          course_id?: string
          created_at?: string
          duration_seconds?: number
          id?: string
          opponent_id?: string
          question_count?: number
          question_ids?: Json
          status?: string
          winner_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenges_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          room_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          room_id?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_archived: boolean
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          name?: string
        }
        Relationships: []
      }
      course_bookmarks: {
        Row: {
          course_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_bookmarks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_materials: {
        Row: {
          content: string
          course_id: string
          created_at: string
          id: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          content: string
          course_id: string
          created_at?: string
          id?: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          content?: string
          course_id?: string
          created_at?: string
          id?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_materials_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          code: string
          created_at: string
          department: string | null
          description: string | null
          id: string
          level: string | null
          school: string | null
          title: string
        }
        Insert: {
          code: string
          created_at?: string
          department?: string | null
          description?: string | null
          id?: string
          level?: string | null
          school?: string | null
          title: string
        }
        Update: {
          code?: string
          created_at?: string
          department?: string | null
          description?: string | null
          id?: string
          level?: string | null
          school?: string | null
          title?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string
          id: string
          name: string
          school_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          school_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      device_fingerprints: {
        Row: {
          created_at: string
          fingerprint_hash: string
          id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          fingerprint_hash: string
          id?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          fingerprint_hash?: string
          id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      donations: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          donor_name: string
          id: string
          message: string | null
          reference: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          donor_name: string
          id?: string
          message?: string | null
          reference?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          donor_name?: string
          id?: string
          message?: string | null
          reference?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      exam_attempts: {
        Row: {
          course_id: string | null
          duration_seconds: number
          exam_id: string | null
          expires_at: string | null
          id: string
          question_ids: Json
          score: number | null
          started_at: string
          submitted_at: string | null
          total: number
          user_id: string
        }
        Insert: {
          course_id?: string | null
          duration_seconds?: number
          exam_id?: string | null
          expires_at?: string | null
          id?: string
          question_ids: Json
          score?: number | null
          started_at?: string
          submitted_at?: string | null
          total?: number
          user_id: string
        }
        Update: {
          course_id?: string | null
          duration_seconds?: number
          exam_id?: string | null
          expires_at?: string | null
          id?: string
          question_ids?: Json
          score?: number | null
          started_at?: string
          submitted_at?: string | null
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_attempts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_attempts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          course_id: string | null
          created_at: string
          created_by: string | null
          department: string | null
          description: string | null
          id: string
          level: string | null
          school: string | null
          title: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          id?: string
          level?: string | null
          school?: string | null
          title: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          id?: string
          level?: string | null
          school?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          accepted_at: string | null
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          course_code: string | null
          created_at: string
          department: string | null
          description: string | null
          file_path: string | null
          id: string
          level: string | null
          link: string | null
          school: string | null
          title: string
          uploaded_by: string | null
        }
        Insert: {
          course_code?: string | null
          created_at?: string
          department?: string | null
          description?: string | null
          file_path?: string | null
          id?: string
          level?: string | null
          link?: string | null
          school?: string | null
          title: string
          uploaded_by?: string | null
        }
        Update: {
          course_code?: string | null
          created_at?: string
          department?: string | null
          description?: string | null
          file_path?: string | null
          id?: string
          level?: string | null
          link?: string | null
          school?: string | null
          title?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          email: string | null
          full_name: string | null
          id: string
          level: string | null
          matric_no: string | null
          phone: string | null
          phone_verified: boolean
          school: string | null
          verification_document_url: string | null
          verification_rejected_reason: string | null
          verification_reviewed_at: string | null
          verification_reviewed_by: string | null
          verification_status: string
          verification_submitted_at: string | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          level?: string | null
          matric_no?: string | null
          phone?: string | null
          phone_verified?: boolean
          school?: string | null
          verification_document_url?: string | null
          verification_rejected_reason?: string | null
          verification_reviewed_at?: string | null
          verification_reviewed_by?: string | null
          verification_status?: string
          verification_submitted_at?: string | null
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          level?: string | null
          matric_no?: string | null
          phone?: string | null
          phone_verified?: boolean
          school?: string | null
          verification_document_url?: string | null
          verification_rejected_reason?: string | null
          verification_reviewed_at?: string | null
          verification_reviewed_by?: string | null
          verification_status?: string
          verification_submitted_at?: string | null
        }
        Relationships: []
      }
      questions: {
        Row: {
          correct_index: number
          course_id: string | null
          created_at: string
          exam_id: string | null
          hint: string | null
          id: string
          options: Json
          prompt: string
          source_material_id: string | null
        }
        Insert: {
          correct_index: number
          course_id?: string | null
          created_at?: string
          exam_id?: string | null
          hint?: string | null
          id?: string
          options: Json
          prompt: string
          source_material_id?: string | null
        }
        Update: {
          correct_index?: number
          course_id?: string | null
          created_at?: string
          exam_id?: string | null
          hint?: string | null
          id?: string
          options?: Json
          prompt?: string
          source_material_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_source_material_id_fkey"
            columns: ["source_material_id"]
            isOneToOne: false
            referencedRelation: "course_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          author: string
          id: string
          text: string
        }
        Insert: {
          author?: string
          id?: string
          text: string
        }
        Update: {
          author?: string
          id?: string
          text?: string
        }
        Relationships: []
      }
      schools: {
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
      tournament_attempts: {
        Row: {
          duration_used_seconds: number | null
          expires_at: string
          id: string
          question_ids: Json
          score: number | null
          started_at: string
          submitted_at: string | null
          tournament_id: string
          user_id: string
          wrong_count: number | null
        }
        Insert: {
          duration_used_seconds?: number | null
          expires_at: string
          id?: string
          question_ids: Json
          score?: number | null
          started_at?: string
          submitted_at?: string | null
          tournament_id: string
          user_id: string
          wrong_count?: number | null
        }
        Update: {
          duration_used_seconds?: number | null
          expires_at?: string
          id?: string
          question_ids?: Json
          score?: number | null
          started_at?: string
          submitted_at?: string | null
          tournament_id?: string
          user_id?: string
          wrong_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_attempts_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_registrations: {
        Row: {
          created_at: string
          id: string
          snapshot_department: string | null
          snapshot_level: string | null
          snapshot_school: string | null
          tournament_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          snapshot_department?: string | null
          snapshot_level?: string | null
          snapshot_school?: string | null
          tournament_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          snapshot_department?: string | null
          snapshot_level?: string | null
          snapshot_school?: string | null
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_registrations_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_winners: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          decided_at: string
          id: string
          payout_details: Json | null
          payout_status: string
          prize_amount: number
          tournament_id: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          decided_at?: string
          id?: string
          payout_details?: Json | null
          payout_status?: string
          prize_amount: number
          tournament_id: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          decided_at?: string
          id?: string
          payout_details?: Json | null
          payout_status?: string
          prize_amount?: number
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_winners_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          description: string | null
          duration_seconds: number
          ends_at: string | null
          id: string
          min_donation_pool: number
          min_participants: number
          prize_amount: number
          question_count: number
          registration_open: boolean
          starts_at: string | null
          status: string
          target_department: string
          target_level: string
          target_school: string
          title: string
          winner_decided_at: string | null
          winner_user_id: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number
          ends_at?: string | null
          id?: string
          min_donation_pool?: number
          min_participants?: number
          prize_amount: number
          question_count?: number
          registration_open?: boolean
          starts_at?: string | null
          status?: string
          target_department: string
          target_level: string
          target_school: string
          title: string
          winner_decided_at?: string | null
          winner_user_id?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number
          ends_at?: string | null
          id?: string
          min_donation_pool?: number
          min_participants?: number
          prize_amount?: number
          question_count?: number
          registration_open?: boolean
          starts_at?: string | null
          status?: string
          target_department?: string
          target_level?: string
          target_school?: string
          title?: string
          winner_decided_at?: string | null
          winner_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "student" | "super_admin"
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
    Enums: {
      app_role: ["admin", "student", "super_admin"],
    },
  },
} as const
