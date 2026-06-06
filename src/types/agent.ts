export type AgentKey =
  | 'default' | 'devWeb' | 'backend' | 'analyst'
  | 'weather' | 'maps' | 'data' | 'files' | 'combat'

export type TaskStatus = 'pending' | 'executing' | 'done' | 'failed' | 'skipped'

export interface AgentTask {
  id: string
  title: string
  status: TaskStatus
  startedAt?: number
  completedAt?: number
  error?: string
  retryCount: number
}

export interface AgentMessage {
  id: string
  from_agent: 'jarvis' | 'zarith' | 'jadiel'
  to_agent: 'jarvis' | 'zarith' | 'jadiel' | 'all'
  type: 'message' | 'task' | 'file' | 'status' | 'approval_request'
  content: string
  file_url?: string
  status: 'sent' | 'read' | 'executing' | 'done' | 'failed'
  processed_at?: string
  priority: 'low' | 'normal' | 'high' | 'critical'
  metadata?: Record<string, unknown>
  parent_id?: string
  created_at: string
}

export interface ExecutionLogEntry {
  id: string
  type: 'IA' | 'GitHub' | 'Deploy' | 'Supabase' | 'Tool' | 'Telegram' | 'System'
  description: string
  status: 'success' | 'error' | 'warning' | 'info'
  modelUsed?: string
  executionTimeMs?: number
  timestamp: number
}

export interface RepositoryEntry {
  id: string
  owner: string
  name: string
  full_name: string
  url: string
  is_private: boolean
  language?: string
  description?: string
  last_analyzed_at?: string
  analysis_summary?: Record<string, unknown>
  known_issues?: unknown[]
}
