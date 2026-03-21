export interface Conversation {
  id: string;
  title: string;
  provider: Provider;
  model: string;
  system_prompt: string;
  created_at: number;
  updated_at: number;
  token_count: number;
  is_pinned: number;
  last_message?: string;
  message_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: number;
  token_count: number;
  provider?: string;
  model?: string;
  files: FileAttachment[];
}

export interface FileAttachment {
  id: string;
  filename: string;
  path: string;
  mimetype: string;
  size: number;
}

export type Provider = 'anthropic' | 'openai' | 'gemini' | 'deepseek' | 'kimi';

export interface ModelInfo {
  id: string;
  name: string;
  context: number;
}

export interface ModelsMap {
  anthropic: ModelInfo[];
  openai: ModelInfo[];
  gemini: ModelInfo[];
  deepseek: ModelInfo[];
  kimi: ModelInfo[];
}

export interface ApiKeyStatus {
  [provider: string]: {
    configured: boolean;
    base_url?: string;
    updated_at?: number;
  };
}

export interface SearchResult {
  id: string;
  conversation_id: string;
  conversation_title: string;
  role: string;
  content: string;
  created_at: number;
}
