export type Role = "user" | "assistant" | "system";

export interface Chat {
  id: string;
  title: string;
  model: string;
  summary?: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  role: Role;
  content: string;
  created_at: string;
}

export interface ChatWithMessages extends Chat {
  messages: Message[];
}

export interface LLMModel {
  id: string;
  name: string;
  description?: string;
  context_size: number;
}

export interface ModelsResponse {
  default: string;
  models: LLMModel[];
}
