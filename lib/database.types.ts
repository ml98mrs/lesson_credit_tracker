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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      allocations: {
        Row: {
          created_at: string
          credit_lot_id: string
          id: string
          lesson_id: string
          minutes_allocated: number
        }
        Insert: {
          created_at?: string
          credit_lot_id: string
          id?: string
          lesson_id: string
          minutes_allocated: number
        }
        Update: {
          created_at?: string
          credit_lot_id?: string
          id?: string
          lesson_id?: string
          minutes_allocated?: number
        }
        Relationships: [
          {
            foreignKeyName: "allocations_credit_lot_id_fkey"
            columns: ["credit_lot_id"]
            isOneToOne: false
            referencedRelation: "credit_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_credit_lot_id_fkey"
            columns: ["credit_lot_id"]
            isOneToOne: false
            referencedRelation: "v_credit_lot_remaining"
            referencedColumns: ["credit_lot_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_length_hazards"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_length_hazards_raw"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_margin_detail"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_margin_with_drinks_detail"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_margin_with_drinks_with_names"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_snc_overuse_hazards"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_snc_overuse_hazards_raw"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_student_lessons"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_student_snc_lessons"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_lesson_earnings_detail"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      award_reasons: {
        Row: {
          code: string
          label: string
        }
        Insert: {
          code: string
          label: string
        }
        Update: {
          code?: string
          label?: string
        }
        Relationships: []
      }
      credit_lot_events: {
        Row: {
          actor_id: string | null
          created_at: string
          credit_lot_id: string
          details: Json
          event_type: string
          id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          credit_lot_id: string
          details: Json
          event_type: string
          id?: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          credit_lot_id?: string
          details?: Json
          event_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_lot_events_credit_lot_id_fkey"
            columns: ["credit_lot_id"]
            isOneToOne: false
            referencedRelation: "credit_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_lot_events_credit_lot_id_fkey"
            columns: ["credit_lot_id"]
            isOneToOne: false
            referencedRelation: "v_credit_lot_remaining"
            referencedColumns: ["credit_lot_id"]
          },
        ]
      }
      credit_lots: {
        Row: {
          amount_pennies: number | null
          award_reason_code: string | null
          created_at: string
          delivery_restriction: Database["public"]["Enums"]["delivery"] | null
          expiry_date: string | null
          expiry_policy: Database["public"]["Enums"]["expiry_policy"]
          external_ref: string | null
          external_ref_norm: string | null
          id: string
          length_restriction: Database["public"]["Enums"]["length_cat"] | null
          minutes_granted: number
          source_type: string
          start_date: string
          state: Database["public"]["Enums"]["credit_lot_state"]
          student_id: string
          tier_restriction: Database["public"]["Enums"]["tier"] | null
        }
        Insert: {
          amount_pennies?: number | null
          award_reason_code?: string | null
          created_at?: string
          delivery_restriction?: Database["public"]["Enums"]["delivery"] | null
          expiry_date?: string | null
          expiry_policy?: Database["public"]["Enums"]["expiry_policy"]
          external_ref?: string | null
          external_ref_norm?: string | null
          id?: string
          length_restriction?: Database["public"]["Enums"]["length_cat"] | null
          minutes_granted: number
          source_type: string
          start_date: string
          state?: Database["public"]["Enums"]["credit_lot_state"]
          student_id: string
          tier_restriction?: Database["public"]["Enums"]["tier"] | null
        }
        Update: {
          amount_pennies?: number | null
          award_reason_code?: string | null
          created_at?: string
          delivery_restriction?: Database["public"]["Enums"]["delivery"] | null
          expiry_date?: string | null
          expiry_policy?: Database["public"]["Enums"]["expiry_policy"]
          external_ref?: string | null
          external_ref_norm?: string | null
          id?: string
          length_restriction?: Database["public"]["Enums"]["length_cat"] | null
          minutes_granted?: number
          source_type?: string
          start_date?: string
          state?: Database["public"]["Enums"]["credit_lot_state"]
          student_id?: string
          tier_restriction?: Database["public"]["Enums"]["tier"] | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_lots_award_reason_code_fkey"
            columns: ["award_reason_code"]
            isOneToOne: false
            referencedRelation: "award_reasons"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
        ]
      }
      credit_write_offs: {
        Row: {
          accounting_period: string
          created_at: string
          created_by: string | null
          credit_lot_id: string | null
          direction: Database["public"]["Enums"]["credit_write_off_direction"]
          id: string
          minutes: number
          note: string | null
          reason_code: Database["public"]["Enums"]["credit_write_off_reason"]
          student_id: string
        }
        Insert: {
          accounting_period: string
          created_at?: string
          created_by?: string | null
          credit_lot_id?: string | null
          direction: Database["public"]["Enums"]["credit_write_off_direction"]
          id?: string
          minutes: number
          note?: string | null
          reason_code?: Database["public"]["Enums"]["credit_write_off_reason"]
          student_id: string
        }
        Update: {
          accounting_period?: string
          created_at?: string
          created_by?: string | null
          credit_lot_id?: string | null
          direction?: Database["public"]["Enums"]["credit_write_off_direction"]
          id?: string
          minutes?: number
          note?: string | null
          reason_code?: Database["public"]["Enums"]["credit_write_off_reason"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_write_offs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_write_offs_credit_lot_id_fkey"
            columns: ["credit_lot_id"]
            isOneToOne: false
            referencedRelation: "credit_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_write_offs_credit_lot_id_fkey"
            columns: ["credit_lot_id"]
            isOneToOne: false
            referencedRelation: "v_credit_lot_remaining"
            referencedColumns: ["credit_lot_id"]
          },
          {
            foreignKeyName: "credit_write_offs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_write_offs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "credit_write_offs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "credit_write_offs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "credit_write_offs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "credit_write_offs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "credit_write_offs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
        ]
      }
      hazard_resolutions: {
        Row: {
          allocation_id: string | null
          hazard_type: Database["public"]["Enums"]["hazard_type"]
          id: string
          lesson_id: string | null
          note: string | null
          resolved_at: string
          resolved_by: string | null
        }
        Insert: {
          allocation_id?: string | null
          hazard_type: Database["public"]["Enums"]["hazard_type"]
          id?: string
          lesson_id?: string | null
          note?: string | null
          resolved_at?: string
          resolved_by?: string | null
        }
        Update: {
          allocation_id?: string | null
          hazard_type?: Database["public"]["Enums"]["hazard_type"]
          id?: string
          lesson_id?: string | null
          note?: string | null
          resolved_at?: string
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hazard_resolutions_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hazard_resolutions_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "v_allocation_delivery_hazards"
            referencedColumns: ["allocation_id"]
          },
          {
            foreignKeyName: "hazard_resolutions_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "v_allocation_delivery_hazards_raw"
            referencedColumns: ["allocation_id"]
          },
          {
            foreignKeyName: "hazard_resolutions_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "v_allocation_length_restriction_hazards"
            referencedColumns: ["allocation_id"]
          },
          {
            foreignKeyName: "hazard_resolutions_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "v_allocation_length_restriction_hazards_raw"
            referencedColumns: ["allocation_id"]
          },
          {
            foreignKeyName: "hazard_resolutions_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "v_overdraft_allocation_hazards"
            referencedColumns: ["allocation_id"]
          },
          {
            foreignKeyName: "hazard_resolutions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hazard_resolutions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_length_hazards"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "hazard_resolutions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_length_hazards_raw"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "hazard_resolutions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_margin_detail"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "hazard_resolutions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_margin_with_drinks_detail"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "hazard_resolutions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_margin_with_drinks_with_names"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "hazard_resolutions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_snc_overuse_hazards"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "hazard_resolutions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_snc_overuse_hazards_raw"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "hazard_resolutions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_student_lessons"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "hazard_resolutions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_student_snc_lessons"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "hazard_resolutions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_lesson_earnings_detail"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "hazard_resolutions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hazard_resolutions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          created_at: string
          created_by: string | null
          delivery: Database["public"]["Enums"]["delivery"]
          duration_min: number
          id: string
          is_snc: boolean
          length_cat: Database["public"]["Enums"]["length_cat"]
          notes: string | null
          occurred_at: string
          snc_mode: Database["public"]["Enums"]["snc_mode"]
          state: Database["public"]["Enums"]["lesson_state"]
          student_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delivery: Database["public"]["Enums"]["delivery"]
          duration_min: number
          id?: string
          is_snc?: boolean
          length_cat?: Database["public"]["Enums"]["length_cat"]
          notes?: string | null
          occurred_at: string
          snc_mode?: Database["public"]["Enums"]["snc_mode"]
          state?: Database["public"]["Enums"]["lesson_state"]
          student_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delivery?: Database["public"]["Enums"]["delivery"]
          duration_min?: number
          id?: string
          is_snc?: boolean
          length_cat?: Database["public"]["Enums"]["length_cat"]
          notes?: string | null
          occurred_at?: string
          snc_mode?: Database["public"]["Enums"]["snc_mode"]
          state?: Database["public"]["Enums"]["lesson_state"]
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          preferred_name: string | null
          role: string
          timezone: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          preferred_name?: string | null
          role?: string
          timezone?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          preferred_name?: string | null
          role?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_timezone_fkey"
            columns: ["timezone"]
            isOneToOne: false
            referencedRelation: "timezones"
            referencedColumns: ["code"]
          },
        ]
      }
      student_status_events: {
        Row: {
          created_at: string
          id: number
          is_auto: boolean
          new_status: Database["public"]["Enums"]["student_status"]
          old_status: Database["public"]["Enums"]["student_status"]
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_auto?: boolean
          new_status: Database["public"]["Enums"]["student_status"]
          old_status: Database["public"]["Enums"]["student_status"]
          student_id: string
        }
        Update: {
          created_at?: string
          id?: number
          is_auto?: boolean
          new_status?: Database["public"]["Enums"]["student_status"]
          old_status?: Database["public"]["Enums"]["student_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_status_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_status_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_status_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_status_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_status_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_status_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_status_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
        ]
      }
      student_teacher: {
        Row: {
          created_at: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          student_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_teacher_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_teacher_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_teacher_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_teacher_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_teacher_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_teacher_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_teacher_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_teacher_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_teacher_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "student_teacher_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "student_teacher_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          status: Database["public"]["Enums"]["student_status"]
          tier: Database["public"]["Enums"]["tier"] | null
          time_zone: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          status?: Database["public"]["Enums"]["student_status"]
          tier?: Database["public"]["Enums"]["tier"] | null
          time_zone?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          status?: Database["public"]["Enums"]["student_status"]
          tier?: Database["public"]["Enums"]["tier"] | null
          time_zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_expenses: {
        Row: {
          amount_pennies: number
          category: string
          created_at: string
          description: string | null
          id: number
          incurred_at: string
          status: string
          student_id: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          amount_pennies: number
          category?: string
          created_at?: string
          description?: string | null
          id?: number
          incurred_at: string
          status: string
          student_id?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          amount_pennies?: number
          category?: string
          created_at?: string
          description?: string | null
          id?: number
          incurred_at?: string
          status?: string
          student_id?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_expenses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_expenses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "teacher_expenses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "teacher_expenses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "teacher_expenses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "teacher_expenses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "teacher_expenses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "teacher_expenses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_expenses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "teacher_expenses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "teacher_expenses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      teacher_invoices: {
        Row: {
          created_at: string
          id: number
          invoice_ref: string | null
          month_start: string
          paid_at: string | null
          status: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          invoice_ref?: string | null
          month_start: string
          paid_at?: string | null
          status: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: number
          invoice_ref?: string | null
          month_start?: string
          paid_at?: string | null
          status?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_invoices_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_invoices_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "teacher_invoices_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "teacher_invoices_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      teacher_rates: {
        Row: {
          created_at: string
          default_online_rate_pennies: number
          f2f_basic_rate_pennies: number
          f2f_premium_rate_pennies: number
          id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_online_rate_pennies: number
          f2f_basic_rate_pennies: number
          f2f_premium_rate_pennies: number
          id?: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_online_rate_pennies?: number
          f2f_basic_rate_pennies?: number
          f2f_premium_rate_pennies?: number
          id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_rates_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: true
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_rates_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: true
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "teacher_rates_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: true
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "teacher_rates_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: true
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      teacher_status_events: {
        Row: {
          created_at: string
          id: number
          is_auto: boolean
          new_status: Database["public"]["Enums"]["teacher_status"]
          old_status: Database["public"]["Enums"]["teacher_status"]
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_auto?: boolean
          new_status: Database["public"]["Enums"]["teacher_status"]
          old_status: Database["public"]["Enums"]["teacher_status"]
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: number
          is_auto?: boolean
          new_status?: Database["public"]["Enums"]["teacher_status"]
          old_status?: Database["public"]["Enums"]["teacher_status"]
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_status_events_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_status_events_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "teacher_status_events_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "teacher_status_events_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      teacher_student_f2f_overrides: {
        Row: {
          created_at: string
          f2f_rate_pennies: number
          student_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          f2f_rate_pennies: number
          student_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          f2f_rate_pennies?: number
          student_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_student_f2f_overrides_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_student_f2f_overrides_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "teacher_student_f2f_overrides_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "teacher_student_f2f_overrides_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "teacher_student_f2f_overrides_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "teacher_student_f2f_overrides_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "teacher_student_f2f_overrides_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "teacher_student_f2f_overrides_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_student_f2f_overrides_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "teacher_student_f2f_overrides_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "teacher_student_f2f_overrides_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      teachers: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          status: Database["public"]["Enums"]["teacher_status"]
          time_zone: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          status?: Database["public"]["Enums"]["teacher_status"]
          time_zone?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          status?: Database["public"]["Enums"]["teacher_status"]
          time_zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teachers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      timezones: {
        Row: {
          code: string
          label: string
        }
        Insert: {
          code: string
          label: string
        }
        Update: {
          code?: string
          label?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_allocation_delivery_hazards: {
        Row: {
          allocation_id: string | null
          credit_lot_id: string | null
          hazard_type: Database["public"]["Enums"]["hazard_type"] | null
          lesson_delivery: Database["public"]["Enums"]["delivery"] | null
          lesson_id: string | null
          lot_delivery_restriction:
            | Database["public"]["Enums"]["delivery"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "allocations_credit_lot_id_fkey"
            columns: ["credit_lot_id"]
            isOneToOne: false
            referencedRelation: "credit_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_credit_lot_id_fkey"
            columns: ["credit_lot_id"]
            isOneToOne: false
            referencedRelation: "v_credit_lot_remaining"
            referencedColumns: ["credit_lot_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_length_hazards"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_length_hazards_raw"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_margin_detail"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_margin_with_drinks_detail"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_margin_with_drinks_with_names"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_snc_overuse_hazards"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_snc_overuse_hazards_raw"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_student_lessons"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_student_snc_lessons"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_lesson_earnings_detail"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      v_allocation_delivery_hazards_raw: {
        Row: {
          allocation_id: string | null
          credit_lot_id: string | null
          hazard_type: Database["public"]["Enums"]["hazard_type"] | null
          lesson_delivery: Database["public"]["Enums"]["delivery"] | null
          lesson_id: string | null
          lot_delivery_restriction:
            | Database["public"]["Enums"]["delivery"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "allocations_credit_lot_id_fkey"
            columns: ["credit_lot_id"]
            isOneToOne: false
            referencedRelation: "credit_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_credit_lot_id_fkey"
            columns: ["credit_lot_id"]
            isOneToOne: false
            referencedRelation: "v_credit_lot_remaining"
            referencedColumns: ["credit_lot_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_length_hazards"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_length_hazards_raw"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_margin_detail"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_margin_with_drinks_detail"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_margin_with_drinks_with_names"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_snc_overuse_hazards"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_snc_overuse_hazards_raw"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_student_lessons"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_student_snc_lessons"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_lesson_earnings_detail"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      v_allocation_length_restriction_hazards: {
        Row: {
          allocation_id: string | null
          credit_lot_id: string | null
          hazard_type: Database["public"]["Enums"]["hazard_type"] | null
          lesson_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "allocations_credit_lot_id_fkey"
            columns: ["credit_lot_id"]
            isOneToOne: false
            referencedRelation: "credit_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_credit_lot_id_fkey"
            columns: ["credit_lot_id"]
            isOneToOne: false
            referencedRelation: "v_credit_lot_remaining"
            referencedColumns: ["credit_lot_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_length_hazards"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_length_hazards_raw"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_margin_detail"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_margin_with_drinks_detail"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_margin_with_drinks_with_names"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_snc_overuse_hazards"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_snc_overuse_hazards_raw"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_student_lessons"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_student_snc_lessons"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_lesson_earnings_detail"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      v_allocation_length_restriction_hazards_raw: {
        Row: {
          allocation_id: string | null
          credit_lot_id: string | null
          duration_min: number | null
          hazard_type: Database["public"]["Enums"]["hazard_type"] | null
          length_restriction: Database["public"]["Enums"]["length_cat"] | null
          lesson_id: string | null
          threshold_min: number | null
        }
        Relationships: [
          {
            foreignKeyName: "allocations_credit_lot_id_fkey"
            columns: ["credit_lot_id"]
            isOneToOne: false
            referencedRelation: "credit_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_credit_lot_id_fkey"
            columns: ["credit_lot_id"]
            isOneToOne: false
            referencedRelation: "v_credit_lot_remaining"
            referencedColumns: ["credit_lot_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_length_hazards"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_length_hazards_raw"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_margin_detail"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_margin_with_drinks_detail"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_margin_with_drinks_with_names"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_snc_overuse_hazards"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_snc_overuse_hazards_raw"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_student_lessons"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_student_snc_lessons"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_lesson_earnings_detail"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      v_credit_expiry_by_month: {
        Row: {
          delivery_restriction: Database["public"]["Enums"]["delivery"] | null
          expiry_policy: Database["public"]["Enums"]["expiry_policy"] | null
          length_restriction: Database["public"]["Enums"]["length_cat"] | null
          minutes_expired_unused: number | null
          minutes_granted_total: number | null
          minutes_used_total: number | null
          month_start: string | null
          source_type: string | null
          student_id: string | null
          student_name: string | null
          tier_restriction: Database["public"]["Enums"]["tier"] | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
        ]
      }
      v_credit_lot_remaining: {
        Row: {
          award_reason_code: string | null
          created_at: string | null
          credit_lot_id: string | null
          days_to_expiry: number | null
          delivery_restriction: Database["public"]["Enums"]["delivery"] | null
          expiry_date: string | null
          expiry_policy: Database["public"]["Enums"]["expiry_policy"] | null
          expiry_within_30d: boolean | null
          external_ref: string | null
          is_overdrawn: boolean | null
          length_restriction: Database["public"]["Enums"]["length_cat"] | null
          minutes_allocated: number | null
          minutes_granted: number | null
          minutes_remaining: number | null
          source_type: string | null
          start_date: string | null
          state: Database["public"]["Enums"]["credit_lot_state"] | null
          student_id: string | null
          tier_restriction: Database["public"]["Enums"]["tier"] | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_lots_award_reason_code_fkey"
            columns: ["award_reason_code"]
            isOneToOne: false
            referencedRelation: "award_reasons"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
        ]
      }
      v_lesson_hazards: {
        Row: {
          allocation_id: string | null
          hazard_type: Database["public"]["Enums"]["hazard_type"] | null
          lesson_id: string | null
          severity: string | null
        }
        Relationships: []
      }
      v_lesson_length_hazards: {
        Row: {
          duration_min: number | null
          hazard_type: Database["public"]["Enums"]["hazard_type"] | null
          length_cat: Database["public"]["Enums"]["length_cat"] | null
          lesson_id: string | null
          student_id: string | null
          teacher_id: string | null
          threshold_min: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      v_lesson_length_hazards_raw: {
        Row: {
          duration_min: number | null
          hazard_type: Database["public"]["Enums"]["hazard_type"] | null
          length_cat: Database["public"]["Enums"]["length_cat"] | null
          lesson_id: string | null
          student_id: string | null
          teacher_id: string | null
          threshold_min: number | null
        }
        Insert: {
          duration_min?: number | null
          hazard_type?: never
          length_cat?: Database["public"]["Enums"]["length_cat"] | null
          lesson_id?: string | null
          student_id?: string | null
          teacher_id?: string | null
          threshold_min?: never
        }
        Update: {
          duration_min?: number | null
          hazard_type?: never
          length_cat?: Database["public"]["Enums"]["length_cat"] | null
          lesson_id?: string | null
          student_id?: string | null
          teacher_id?: string | null
          threshold_min?: never
        }
        Relationships: [
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      v_lesson_margin_detail: {
        Row: {
          delivery: Database["public"]["Enums"]["delivery"] | null
          duration_min: number | null
          hourly_rate_pennies: number | null
          is_snc: boolean | null
          lesson_id: string | null
          margin_pct: number | null
          margin_pennies: number | null
          revenue_pennies: number | null
          snc_mode: Database["public"]["Enums"]["snc_mode"] | null
          start_at: string | null
          state: Database["public"]["Enums"]["lesson_state"] | null
          student_id: string | null
          student_tier: Database["public"]["Enums"]["tier"] | null
          teacher_earnings_pennies: number | null
          teacher_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      v_lesson_margin_with_drinks_detail: {
        Row: {
          delivery: Database["public"]["Enums"]["delivery"] | null
          drinks_allocated_pennies: number | null
          duration_min: number | null
          hourly_rate_pennies: number | null
          is_snc: boolean | null
          length_cat: Database["public"]["Enums"]["length_cat"] | null
          lesson_id: string | null
          margin_after_drinks_pct: number | null
          margin_after_drinks_pennies: number | null
          margin_before_drinks_pennies: number | null
          month_start: string | null
          revenue_pennies: number | null
          snc_mode: Database["public"]["Enums"]["snc_mode"] | null
          start_at: string | null
          state: Database["public"]["Enums"]["lesson_state"] | null
          student_id: string | null
          student_tier: Database["public"]["Enums"]["tier"] | null
          teacher_earnings_pennies: number | null
          teacher_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      v_lesson_margin_with_drinks_with_names: {
        Row: {
          delivery: Database["public"]["Enums"]["delivery"] | null
          drinks_allocated_pennies: number | null
          duration_min: number | null
          hourly_rate_pennies: number | null
          is_snc: boolean | null
          length_cat: Database["public"]["Enums"]["length_cat"] | null
          lesson_id: string | null
          margin_after_drinks_pct: number | null
          margin_after_drinks_pennies: number | null
          margin_before_drinks_pennies: number | null
          month_start: string | null
          revenue_pennies: number | null
          snc_mode: Database["public"]["Enums"]["snc_mode"] | null
          start_at: string | null
          state: Database["public"]["Enums"]["lesson_state"] | null
          student_full_name: string | null
          student_id: string | null
          student_name: string | null
          student_tier: Database["public"]["Enums"]["tier"] | null
          teacher_earnings_pennies: number | null
          teacher_full_name: string | null
          teacher_id: string | null
          teacher_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      v_lesson_revenue_detail: {
        Row: {
          lesson_id: string | null
          revenue_pennies: number | null
        }
        Relationships: [
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_length_hazards"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_length_hazards_raw"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_margin_detail"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_margin_with_drinks_detail"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_margin_with_drinks_with_names"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_snc_overuse_hazards"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_snc_overuse_hazards_raw"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_student_lessons"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_student_snc_lessons"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_lesson_earnings_detail"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      v_overdraft_allocation_hazards: {
        Row: {
          allocation_id: string | null
          hazard_type: Database["public"]["Enums"]["hazard_type"] | null
          lesson_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_length_hazards"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_length_hazards_raw"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_margin_detail"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_margin_with_drinks_detail"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_lesson_margin_with_drinks_with_names"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_snc_overuse_hazards"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_snc_overuse_hazards_raw"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_student_lessons"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_student_snc_lessons"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_lesson_earnings_detail"
            referencedColumns: ["lesson_id"]
          },
          {
            foreignKeyName: "allocations_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      v_past_students_cleanup_candidates: {
        Row: {
          last_activity_at: string | null
          remaining_minutes: number | null
          student_id: string | null
        }
        Relationships: []
      }
      v_snc_overuse_hazards: {
        Row: {
          hazard_type: Database["public"]["Enums"]["hazard_type"] | null
          lesson_id: string | null
          month_start: string | null
          snc_count: number | null
          student_id: string | null
          teacher_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      v_snc_overuse_hazards_raw: {
        Row: {
          hazard_type: Database["public"]["Enums"]["hazard_type"] | null
          lesson_id: string | null
          month_start: string | null
          occurred_at: string | null
          snc_count: number | null
          student_id: string | null
          teacher_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      v_snc_stats_by_month: {
        Row: {
          charged_snc_lesson_count: number | null
          charged_snc_margin_after_drinks_pennies: number | null
          charged_snc_minutes_total: number | null
          charged_snc_revenue_pennies: number | null
          charged_snc_teacher_pay_pennies: number | null
          free_snc_lesson_count: number | null
          free_snc_margin_after_drinks_pennies: number | null
          free_snc_minutes_total: number | null
          free_snc_revenue_pennies: number | null
          free_snc_teacher_pay_pennies: number | null
          lesson_count_total: number | null
          lesson_minutes_total: number | null
          month_start: string | null
          snc_lesson_count: number | null
          snc_margin_after_drinks_pennies: number | null
          snc_minutes_total: number | null
          snc_rate_pct: number | null
          snc_revenue_pennies: number | null
          snc_teacher_pay_pennies: number | null
          student_id: string | null
          student_tier: Database["public"]["Enums"]["tier"] | null
          teacher_id: string | null
          total_margin_after_drinks_pennies: number | null
          total_revenue_pennies: number | null
          total_teacher_pay_pennies: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      v_snc_stats_by_month_with_names: {
        Row: {
          charged_snc_lesson_count: number | null
          charged_snc_margin_after_drinks_pennies: number | null
          charged_snc_minutes_total: number | null
          charged_snc_revenue_pennies: number | null
          charged_snc_teacher_pay_pennies: number | null
          free_snc_lesson_count: number | null
          free_snc_margin_after_drinks_pennies: number | null
          free_snc_minutes_total: number | null
          free_snc_revenue_pennies: number | null
          free_snc_teacher_pay_pennies: number | null
          lesson_count_total: number | null
          lesson_minutes_total: number | null
          month_start: string | null
          snc_lesson_count: number | null
          snc_margin_after_drinks_pennies: number | null
          snc_minutes_total: number | null
          snc_rate_pct: number | null
          snc_revenue_pennies: number | null
          snc_teacher_pay_pennies: number | null
          student_id: string | null
          student_name: string | null
          student_tier: Database["public"]["Enums"]["tier"] | null
          teacher_id: string | null
          teacher_name: string | null
          total_margin_after_drinks_pennies: number | null
          total_revenue_pennies: number | null
          total_teacher_pay_pennies: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      v_student_award_reason_summary: {
        Row: {
          award_reason_code: string | null
          granted_award_min: number | null
          remaining_award_min: number | null
          student_id: string | null
          used_award_min: number | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_lots_award_reason_code_fkey"
            columns: ["award_reason_code"]
            isOneToOne: false
            referencedRelation: "award_reasons"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
        ]
      }
      v_student_cohort_base: {
        Row: {
          active_0_12m: boolean | null
          active_0_3m: boolean | null
          active_0_6m: boolean | null
          cohort_month: string | null
          current_status: Database["public"]["Enums"]["student_status"] | null
          first_lesson_at: string | null
          first_teacher_id: string | null
          has_long_gap_history: boolean | null
          minutes_0_12m: number | null
          minutes_0_3m: number | null
          minutes_0_6m: number | null
          reactivated: boolean | null
          student_id: string | null
          student_tier: Database["public"]["Enums"]["tier"] | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["first_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["first_teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["first_teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["first_teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      v_student_cohort_summary: {
        Row: {
          active_0_12m_count: number | null
          active_0_12m_pct: number | null
          active_0_3m_count: number | null
          active_0_3m_pct: number | null
          active_0_6m_count: number | null
          active_0_6m_pct: number | null
          cohort_month: string | null
          cohort_size: number | null
          first_teacher_id: string | null
          first_teacher_name: string | null
          minutes_0_12m_avg: number | null
          minutes_0_12m_total: number | null
          minutes_0_3m_avg: number | null
          minutes_0_3m_total: number | null
          minutes_0_6m_avg: number | null
          minutes_0_6m_total: number | null
          reactivated_count: number | null
          student_tier: Database["public"]["Enums"]["tier"] | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["first_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["first_teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["first_teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["first_teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      v_student_credit_delivery_summary: {
        Row: {
          awarded_min: number | null
          purchased_f2f_min: number | null
          purchased_min: number | null
          purchased_online_min: number | null
          remaining_f2f_min: number | null
          remaining_min: number | null
          remaining_online_min: number | null
          student_id: string | null
          used_f2f_min: number | null
          used_min: number | null
          used_online_min: number | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "credit_lots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
        ]
      }
      v_student_credit_summary: {
        Row: {
          days_to_next_expiry: number | null
          expiry_within_30d: boolean | null
          low_credit: boolean | null
          next_expiry_date: string | null
          student_id: string | null
          total_allocated_min: number | null
          total_granted_min: number | null
          total_remaining_min: number | null
        }
        Relationships: []
      }
      v_student_dynamic_credit_alerts: {
        Row: {
          avg_month_hours: number | null
          buffer_hours: number | null
          is_dynamic_low: boolean | null
          is_generic_low: boolean | null
          is_low_any: boolean | null
          remaining_hours: number | null
          remaining_minutes: number | null
          student_id: string | null
        }
        Relationships: []
      }
      v_student_dynamic_credit_alerts_by_delivery: {
        Row: {
          avg_month_hours: number | null
          buffer_hours: number | null
          delivery: Database["public"]["Enums"]["delivery"] | null
          is_dynamic_low: boolean | null
          is_generic_low: boolean | null
          is_low_any: boolean | null
          is_zero_purchased: boolean | null
          remaining_hours: number | null
          remaining_minutes: number | null
          student_id: string | null
        }
        Relationships: []
      }
      v_student_last_activity: {
        Row: {
          last_activity_at: string | null
          student_id: string | null
        }
        Insert: {
          last_activity_at?: never
          student_id?: string | null
        }
        Update: {
          last_activity_at?: never
          student_id?: string | null
        }
        Relationships: []
      }
      v_student_lessons: {
        Row: {
          allocation_summary: string | null
          created_at: string | null
          delivery: Database["public"]["Enums"]["delivery"] | null
          duration_min: number | null
          is_snc: boolean | null
          length_cat: Database["public"]["Enums"]["length_cat"] | null
          lesson_id: string | null
          occurred_at: string | null
          snc_mode: Database["public"]["Enums"]["snc_mode"] | null
          state: Database["public"]["Enums"]["lesson_state"] | null
          student_id: string | null
          teacher_full_name: string | null
          teacher_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      v_student_lifecycle_summary: {
        Row: {
          current: number | null
          dormant: number | null
          past: number | null
        }
        Relationships: []
      }
      v_student_names: {
        Row: {
          display_name: string | null
          full_name: string | null
          student_id: string | null
        }
        Relationships: []
      }
      v_student_snc_lessons: {
        Row: {
          delivery: Database["public"]["Enums"]["delivery"] | null
          duration_min: number | null
          is_charged: boolean | null
          is_snc: boolean | null
          lesson_id: string | null
          occurred_at: string | null
          snc_mode: Database["public"]["Enums"]["snc_mode"] | null
          student_id: string | null
          teacher_id: string | null
        }
        Insert: {
          delivery?: Database["public"]["Enums"]["delivery"] | null
          duration_min?: number | null
          is_charged?: never
          is_snc?: boolean | null
          lesson_id?: string | null
          occurred_at?: string | null
          snc_mode?: Database["public"]["Enums"]["snc_mode"] | null
          student_id?: string | null
          teacher_id?: string | null
        }
        Update: {
          delivery?: Database["public"]["Enums"]["delivery"] | null
          duration_min?: number | null
          is_charged?: never
          is_snc?: boolean | null
          lesson_id?: string | null
          occurred_at?: string | null
          snc_mode?: Database["public"]["Enums"]["snc_mode"] | null
          student_id?: string | null
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      v_student_snc_status_by_month: {
        Row: {
          charged_sncs: number | null
          free_sncs: number | null
          has_free_snc_used: boolean | null
          month_start: string | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
        ]
      }
      v_student_snc_status_previous_month: {
        Row: {
          charged_sncs: number | null
          free_sncs: number | null
          has_free_snc_used: boolean | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
        ]
      }
      v_student_teacher_rate_summary: {
        Row: {
          effective_f2f_rate_pennies: number | null
          effective_online_rate_pennies: number | null
          f2f_source: string | null
          has_override: boolean | null
          student_id: string | null
          student_tier: Database["public"]["Enums"]["tier"] | null
          teacher_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_teacher_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_teacher_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_teacher_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_teacher_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_teacher_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_teacher_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_teacher_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "student_teacher_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_teacher_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "student_teacher_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "student_teacher_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      v_student_usage_last_3m: {
        Row: {
          avg_month_hours: number | null
          avg_month_minutes: number | null
          avg_week_hours: number | null
          is_heavy_user: boolean | null
          minutes_last_3m: number | null
          months_count: number | null
          student_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
        ]
      }
      v_teacher_drinks_expenses_by_student_month: {
        Row: {
          drinks_approved_pennies: number | null
          drinks_pending_pennies: number | null
          drinks_rejected_pennies: number | null
          month_start: string | null
          student_id: string | null
          teacher_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_expenses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_expenses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "teacher_expenses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "teacher_expenses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "teacher_expenses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "teacher_expenses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "teacher_expenses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "teacher_expenses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_expenses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "teacher_expenses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "teacher_expenses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      v_teacher_expenses_detail_by_month: {
        Row: {
          amount_pennies: number | null
          category: string | null
          created_at: string | null
          description: string | null
          id: number | null
          incurred_at: string | null
          month_start: string | null
          status: string | null
          student_full_name: string | null
          student_id: string | null
          student_name: string | null
          teacher_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_expenses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_expenses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "teacher_expenses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "teacher_expenses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "teacher_expenses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "teacher_expenses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "teacher_expenses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "teacher_expenses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_expenses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "teacher_expenses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "teacher_expenses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      v_teacher_expenses_summary: {
        Row: {
          approved_pennies: number | null
          month_start: string | null
          pending_pennies: number | null
          rejected_pennies: number | null
          teacher_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_expenses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_expenses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "teacher_expenses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "teacher_expenses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      v_teacher_invoice_summary: {
        Row: {
          expenses_pennies: number | null
          lesson_gross_pennies: number | null
          month_start: string | null
          status: string | null
          teacher_id: string | null
          total_pennies: number | null
        }
        Relationships: []
      }
      v_teacher_last_activity: {
        Row: {
          last_activity_at: string | null
          teacher_id: string | null
        }
        Relationships: []
      }
      v_teacher_lesson_earnings_by_month: {
        Row: {
          gross_pennies: number | null
          lesson_minutes_total: number | null
          month_start: string | null
          snc_charged_minutes: number | null
          snc_free_minutes: number | null
          teacher_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      v_teacher_lesson_earnings_by_student_month: {
        Row: {
          gross_pennies: number | null
          lesson_minutes_total: number | null
          month_start: string | null
          student_id: string | null
          student_name: string | null
          teacher_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      v_teacher_lesson_earnings_detail: {
        Row: {
          delivery: Database["public"]["Enums"]["delivery"] | null
          duration_min: number | null
          gross_pennies: number | null
          hourly_rate_pennies: number | null
          is_snc: boolean | null
          lesson_id: string | null
          snc_mode: Database["public"]["Enums"]["snc_mode"] | null
          start_at: string | null
          state: Database["public"]["Enums"]["lesson_state"] | null
          student_id: string | null
          student_tier: Database["public"]["Enums"]["tier"] | null
          teacher_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      v_teacher_lesson_earnings_last_month: {
        Row: {
          gross_pennies: number | null
          lesson_minutes_total: number | null
          month_start: string | null
          snc_charged_minutes: number | null
          snc_free_minutes: number | null
          teacher_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      v_teacher_lesson_margin_by_student_month: {
        Row: {
          lesson_minutes_total: number | null
          margin_pct: number | null
          margin_pennies: number | null
          month_start: string | null
          revenue_pennies: number | null
          student_id: string | null
          student_name: string | null
          teacher_earnings_pennies: number | null
          teacher_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      v_teacher_lesson_revenue_by_month: {
        Row: {
          month_start: string | null
          revenue_pennies: number | null
          teacher_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      v_teacher_lesson_stats_by_month: {
        Row: {
          confirmed_minutes_f2f: number | null
          confirmed_minutes_online: number | null
          confirmed_minutes_total: number | null
          lesson_count_total: number | null
          month_start: string | null
          snc_charged_count: number | null
          snc_free_count: number | null
          teacher_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      v_teacher_lessons: {
        Row: {
          duration_min: number | null
          id: string | null
          start_at: string | null
          state: Database["public"]["Enums"]["lesson_state"] | null
          student_id: string | null
          student_name: string | null
          teacher_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_past_students_cleanup_candidates"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_cohort_base"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_credit_summary"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_dynamic_credit_alerts"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_last_activity"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "v_student_names"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
      v_teacher_margin_by_month: {
        Row: {
          expenses_approved_pennies: number | null
          expenses_pending_pennies: number | null
          expenses_rejected_pennies: number | null
          lesson_minutes_total: number | null
          margin_after_expenses_pct: number | null
          margin_after_expenses_pennies: number | null
          margin_before_expenses_pct: number | null
          margin_before_expenses_pennies: number | null
          month_start: string | null
          revenue_pennies: number | null
          snc_charged_minutes: number | null
          snc_free_minutes: number | null
          teacher_earnings_pennies: number | null
          teacher_id: string | null
        }
        Relationships: []
      }
      v_teacher_margin_by_month_with_names: {
        Row: {
          expenses_approved_pennies: number | null
          expenses_pending_pennies: number | null
          expenses_rejected_pennies: number | null
          lesson_minutes_total: number | null
          margin_after_expenses_pct: number | null
          margin_after_expenses_pennies: number | null
          margin_before_expenses_pct: number | null
          margin_before_expenses_pennies: number | null
          month_start: string | null
          revenue_pennies: number | null
          snc_charged_minutes: number | null
          snc_free_minutes: number | null
          teacher_earnings_pennies: number | null
          teacher_full_name: string | null
          teacher_id: string | null
          teacher_name: string | null
        }
        Relationships: []
      }
      v_teacher_names: {
        Row: {
          display_name: string | null
          full_name: string | null
          teacher_id: string | null
        }
        Relationships: []
      }
      v_teacher_rate_summary: {
        Row: {
          default_online_rate_pennies: number | null
          f2f_basic_rate_pennies: number | null
          f2f_premium_rate_pennies: number | null
          max_override_rate_pennies: number | null
          min_override_rate_pennies: number | null
          num_f2f_overrides: number | null
          teacher_id: string | null
        }
        Relationships: []
      }
      v_teacher_usage_last_3m: {
        Row: {
          avg_month_hours: number | null
          is_heavy_user: boolean | null
          teacher_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_last_activity"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_names"
            referencedColumns: ["teacher_id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "v_teacher_rate_summary"
            referencedColumns: ["teacher_id"]
          },
        ]
      }
    }
    Functions: {
      auth_is_admin: { Args: never; Returns: boolean }
      fn_delivery_hazard_type: {
        Args: {
          p_lesson_delivery: Database["public"]["Enums"]["delivery"]
          p_lot_delivery_restriction: Database["public"]["Enums"]["delivery"]
        }
        Returns: string
      }
      fn_get_overdraft_deficit: {
        Args: { p_student_id: string }
        Returns: number
      }
      fn_is_delivery_mismatch: {
        Args: {
          p_lesson_delivery: Database["public"]["Enums"]["delivery"]
          p_lot_delivery_restriction: Database["public"]["Enums"]["delivery"]
        }
        Returns: boolean
      }
      fn_is_length_restriction_mismatch: {
        Args: {
          p_duration_min: number
          p_lot_length: Database["public"]["Enums"]["length_cat"]
        }
        Returns: boolean
      }
      fn_is_length_too_short: {
        Args: {
          p_duration_min: number
          p_length_cat: Database["public"]["Enums"]["length_cat"]
        }
        Returns: boolean
      }
      fn_length_threshold: {
        Args: { p_length_cat: Database["public"]["Enums"]["length_cat"] }
        Returns: number
      }
      fn_plan_lesson_allocation: {
        Args: { p_admin_override: boolean; p_lesson_id: string }
        Returns: Json
      }
      get_or_create_overdraft_lot: {
        Args: { p_student_id: string }
        Returns: string
      }
      is_current_student: { Args: { s_id: string }; Returns: boolean }
      is_teacher_assigned_to_student: {
        Args: { s_id: string }
        Returns: boolean
      }
      rpc_admin_assign_student_teacher: {
        Args: { p_student_id: string; p_teacher_id: string }
        Returns: undefined
      }
      rpc_admin_create_student: {
        Args: {
          p_auth_user_id: string
          p_full_name: string
          p_preferred_name: string
          p_teacher_id: string
          p_tier: Database["public"]["Enums"]["tier"]
          p_timezone: string
        }
        Returns: string
      }
      rpc_admin_unassign_student_teacher: {
        Args: { p_student_id: string; p_teacher_id: string }
        Returns: undefined
      }
      rpc_auto_dormant_students: {
        Args: { p_inactive_interval: unknown }
        Returns: Json
      }
      rpc_award_minutes: {
        Args: {
          p_award_reason_code: string
          p_minutes_granted: number
          p_start_date: string
          p_student_id: string
        }
        Returns: {
          amount_pennies: number | null
          award_reason_code: string | null
          created_at: string
          delivery_restriction: Database["public"]["Enums"]["delivery"] | null
          expiry_date: string | null
          expiry_policy: Database["public"]["Enums"]["expiry_policy"]
          external_ref: string | null
          external_ref_norm: string | null
          id: string
          length_restriction: Database["public"]["Enums"]["length_cat"] | null
          minutes_granted: number
          source_type: string
          start_date: string
          state: Database["public"]["Enums"]["credit_lot_state"]
          student_id: string
          tier_restriction: Database["public"]["Enums"]["tier"] | null
        }
        SetofOptions: {
          from: "*"
          to: "credit_lots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rpc_award_overdraft: {
        Args: {
          p_award_reason_code: string
          p_note?: string
          p_student_id: string
        }
        Returns: Json
      }
      rpc_cleanup_past_students_lessons: {
        Args: { p_dry_run?: boolean; p_min_age?: unknown }
        Returns: Json
      }
      rpc_confirm_lesson: {
        Args: {
          p_admin_override: boolean
          p_lesson_id: string
          p_override_reason: string
          p_reallocate: boolean
        }
        Returns: Json
      }
      rpc_decline_lesson: {
        Args: { p_lesson_id: string; p_reason?: string }
        Returns: Json
      }
      rpc_import_invoice: {
        Args: {
          p_amount_pennies: number
          p_buffer?: number
          p_delivery_restriction?: string
          p_duration_per_lesson_mins?: number
          p_expiry_date?: string
          p_expiry_policy?: Database["public"]["Enums"]["expiry_policy"]
          p_external_ref: string
          p_length_restriction?: Database["public"]["Enums"]["length_cat"]
          p_lessons_per_month?: number
          p_minutes_granted: number
          p_start_date: string
          p_student_id: string
          p_tier_restriction?: string
        }
        Returns: {
          amount_pennies: number | null
          award_reason_code: string | null
          created_at: string
          delivery_restriction: Database["public"]["Enums"]["delivery"] | null
          expiry_date: string | null
          expiry_policy: Database["public"]["Enums"]["expiry_policy"]
          external_ref: string | null
          external_ref_norm: string | null
          id: string
          length_restriction: Database["public"]["Enums"]["length_cat"] | null
          minutes_granted: number
          source_type: string
          start_date: string
          state: Database["public"]["Enums"]["credit_lot_state"]
          student_id: string
          tier_restriction: Database["public"]["Enums"]["tier"] | null
        }
        SetofOptions: {
          from: "*"
          to: "credit_lots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rpc_invoice_overdraft: {
        Args: { p_invoice_ref: string; p_note?: string; p_student_id: string }
        Returns: Json
      }
      rpc_log_lesson: {
        Args: {
          p_delivery: Database["public"]["Enums"]["delivery"]
          p_duration_min: number
          p_is_snc?: boolean
          p_notes?: string
          p_occurred_at: string
          p_student_id: string
        }
        Returns: Json
      }
      rpc_log_teacher_expense: {
        Args: {
          p_amount_pennies: number
          p_category: string
          p_description?: string
          p_incurred_at: string
          p_student_id: string
        }
        Returns: {
          amount_pennies: number
          category: string
          created_at: string
          description: string | null
          id: number
          incurred_at: string
          status: string
          student_id: string | null
          teacher_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "teacher_expenses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rpc_mark_students_dormant: {
        Args: { p_inactive_interval?: unknown }
        Returns: Json
      }
      rpc_preview_lesson_allocation: {
        Args: { p_admin_override: boolean; p_lesson_id: string }
        Returns: Json
      }
      rpc_refresh_teacher_statuses: { Args: never; Returns: undefined }
      rpc_resolve_hazard: {
        Args: {
          p_allocation_id?: string
          p_hazard_type: string
          p_lesson_id?: string
          p_note?: string
        }
        Returns: Json
      }
      rpc_update_invoice_lot_minutes: {
        Args: { p_credit_lot_id: string; p_new_minutes_granted: number }
        Returns: {
          amount_pennies: number | null
          award_reason_code: string | null
          created_at: string
          delivery_restriction: Database["public"]["Enums"]["delivery"] | null
          expiry_date: string | null
          expiry_policy: Database["public"]["Enums"]["expiry_policy"]
          external_ref: string | null
          external_ref_norm: string | null
          id: string
          length_restriction: Database["public"]["Enums"]["length_cat"] | null
          minutes_granted: number
          source_type: string
          start_date: string
          state: Database["public"]["Enums"]["credit_lot_state"]
          student_id: string
          tier_restriction: Database["public"]["Enums"]["tier"] | null
        }
        SetofOptions: {
          from: "*"
          to: "credit_lots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rpc_write_off_overdraft: {
        Args: {
          p_accounting_period?: string
          p_note?: string
          p_reason_code: string
          p_student_id: string
        }
        Returns: Json
      }
      rpc_write_off_overdraft_credit: {
        Args: {
          p_accounting_period?: string
          p_note?: string
          p_reason_code?: Database["public"]["Enums"]["credit_write_off_reason"]
          p_student_id: string
        }
        Returns: Json
      }
      rpc_write_off_remaining_credit: {
        Args: {
          p_accounting_period?: string
          p_note?: string
          p_reason_code?: Database["public"]["Enums"]["credit_write_off_reason"]
          p_student_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      credit_lot_state: "open" | "closed" | "expired" | "cancelled"
      credit_write_off_direction: "positive" | "negative"
      credit_write_off_reason:
        | "manual_write_off"
        | "expired_credit"
        | "overdraft_write_off"
        | "adjustment"
      delivery: "online" | "f2f"
      expiry_policy: "none" | "mandatory" | "advisory"
      hazard_type:
        | "delivery_f2f_on_online"
        | "delivery_online_on_f2f"
        | "length_restriction_mismatch"
        | "negative_balance"
        | "mandatory_expiry_breached"
        | "snc_overuse"
        | "length_too_short"
        | "overdraft_allocation"
        | "expiry_mandatory_breached"
      length_cat: "60" | "90" | "120" | "none"
      lesson_state: "pending" | "confirmed" | "declined" | "cancelled_snc"
      snc_mode: "none" | "free" | "charged"
      student_status: "current" | "dormant" | "past"
      teacher_status: "current" | "inactive" | "potential" | "past"
      tier: "basic" | "premium" | "elite"
      user_role: "student" | "teacher" | "admin"
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
      credit_lot_state: ["open", "closed", "expired", "cancelled"],
      credit_write_off_direction: ["positive", "negative"],
      credit_write_off_reason: [
        "manual_write_off",
        "expired_credit",
        "overdraft_write_off",
        "adjustment",
      ],
      delivery: ["online", "f2f"],
      expiry_policy: ["none", "mandatory", "advisory"],
      hazard_type: [
        "delivery_f2f_on_online",
        "delivery_online_on_f2f",
        "length_restriction_mismatch",
        "negative_balance",
        "mandatory_expiry_breached",
        "snc_overuse",
        "length_too_short",
        "overdraft_allocation",
        "expiry_mandatory_breached",
      ],
      length_cat: ["60", "90", "120", "none"],
      lesson_state: ["pending", "confirmed", "declined", "cancelled_snc"],
      snc_mode: ["none", "free", "charged"],
      student_status: ["current", "dormant", "past"],
      teacher_status: ["current", "inactive", "potential", "past"],
      tier: ["basic", "premium", "elite"],
      user_role: ["student", "teacher", "admin"],
    },
  },
} as const
