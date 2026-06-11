// types/index.ts — All TypeScript types for Jarvis Nexus

export type MessageRole = "user" | "assistant" | "tool";
export type AgentStatus = "idle" | "thinking" | "streaming" | "error";
export type MemoryCategory = "preference" | "decision" | "credential" | "context" | "todo" | "project";
export type ToolStatus = "running" | "done" | "error";
export type PlanStepStatus = "pending" | "running" | "done" | "error" | "skipped";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  narrations?: Narration[];
  plan?: Plan;
  streaming?: boolean;
  created_at?: string;
  tokens_used?: number;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: ToolStatus;
  output?: unknown;
}

export interface Narration {
  after_index: number;
  text: string;
}

export interface Plan {
  task_title: string;
  steps: PlanStep[];
}

export interface PlanStep {
  text: string;
  status: PlanStepStatus;
  note?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  pinned?: boolean;
  created_at: number;
  updated_at: number;
}

export interface Memory {
  id: string;
  content: string;
  category: MemoryCategory;
  project?: string;
  tags?: string[];
  created_at: string;
  accessed_at: string;
  access_count: number;
  score?: number;
}

export interface EvolutionEntry {
  at: string;
  type: "conversation" | "memory_saved" | "tool_used" | "autonomous";
  summary: string;
  tools_used?: number;
}

export interface Toast {
  id: number;
  message: string;
  type: "info" | "success" | "error";
  out?: boolean;
}

export interface JarvisConfig {
  anthropicKey?: string;
  githubToken?: string;
  vercelToken?: string;
  tavilyKey?: string;
  tgComandoToken?: string;
  tgAlertsToken?: string;
  tgDevToken?: string;
  tgAdminId?: string;
  openaiKey?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export interface SSEEvent {
  type: "tool_use" | "tool_result" | "thinking" | "response" | "done" | "error" | "plan" | "plan_update";
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: string;
  message?: string;
  plan?: Plan;
  step_index?: number;
  status?: PlanStepStatus;
  note?: string;
}
