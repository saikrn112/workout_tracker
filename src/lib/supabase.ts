import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database Types
export type Database = {
  public: {
    Tables: {
      workouts: {
        Row: {
          id: string
          created_at: string
          date: string
          template: string
          user_id?: string
        }
        Insert: {
          id?: string
          created_at?: string
          date: string
          template: string
          user_id?: string
        }
        Update: {
          id?: string
          created_at?: string
          date?: string
          template?: string
          user_id?: string
        }
      }
      sets: {
        Row: {
          id: string
          created_at: string
          workout_id: string
          exercise: string
          set_number: number
          weight: number
          reps: number
          notes?: string
        }
        Insert: {
          id?: string
          created_at?: string
          workout_id: string
          exercise: string
          set_number: number
          weight: number
          reps: number
          notes?: string
        }
        Update: {
          id?: string
          created_at?: string
          workout_id?: string
          exercise?: string
          set_number?: number
          weight?: number
          reps?: number
          notes?: string
        }
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