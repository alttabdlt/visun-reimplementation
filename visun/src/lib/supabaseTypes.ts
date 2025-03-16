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
      chat_messages: {
        Row: {
          ai_response: Json
          animation_status: string | null
          animation_url: Json | null
          created_at: string | null
          id: number
          session_id: string
          user_query: string
        }
        Insert: {
          ai_response: Json
          animation_status?: string | null
          animation_url?: Json | null
          created_at?: string | null
          id?: number
          session_id: string
          user_query: string
        }
        Update: {
          ai_response?: Json
          animation_status?: string | null
          animation_url?: Json | null
          created_at?: string | null
          id?: number
          session_id?: string
          user_query?: string
        }
        Relationships: []
      }
      chat_sessions: {
        Row: {
          created_at: string
          first_message: string
          id: number
          session_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          first_message: string
          id?: number
          session_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          first_message?: string
          id?: number
          session_id?: string
          updated_at?: string | null
        }
        Relationships: []
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