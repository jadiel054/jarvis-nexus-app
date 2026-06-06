export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      conversations: {
        Row: {
          id: string
          user_id: string
          title: string
          messages: Json
          agent_key: string
          created_at: string
          updated_at: string
        }
      }
      jarvis_logs: {
        Row: {
          id: string
          user_id: string
          type: string
          description: string
          status: string
          model_used: string | null
          execution_time_ms: number | null
          metadata: Json
          created_at: string
        }
      }
      agent_messages: {
        Row: {
          id: string
          from_agent: string
          to_agent: string
          type: string
          content: string
          status: string
          priority: string
          metadata: Json
          parent_id: string | null
          created_at: string
          processed_at: string | null
        }
      }
      digital_assets: {
        Row: {
          id: string
          user_id: string
          name: string
          url: string | null
          type: string | null
          asking_price: number
          paid_price: number | null
          monthly_revenue: number
          status: string
          score: number | null
          analysis: Json
          notes: string | null
          created_at: string
          updated_at: string
        }
      }
      repository_registry: {
        Row: {
          id: string
          user_id: string
          owner: string
          name: string
          full_name: string
          url: string
          is_private: boolean
          language: string | null
          description: string | null
          last_analyzed_at: string | null
          analysis_summary: Json
          known_issues: Json
          metadata: Json
          created_at: string
          updated_at: string
        }
      }
    }
  }
}
