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
  folder_id: string | null;
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
  routing_info?: RoutingInfo | null;
}

export interface FileAttachment {
  id: string;
  filename: string;
  path: string;
  mimetype: string;
  size: number;
}

export type Provider = 'auto' | 'anthropic' | 'openai' | 'gemini' | 'deepseek' | 'kimi';

export interface ModelInfo {
  id: string;
  name: string;
  context: number;
  description?: string;
}

export interface ModelsMap {
  auto: ModelInfo[];
  anthropic: ModelInfo[];
  openai: ModelInfo[];
  gemini: ModelInfo[];
  deepseek: ModelInfo[];
  kimi: ModelInfo[];
}

export interface RoutingInfo {
  selectedModel: string;
  selectedModelId: string;
  selectedProvider: string;
  tier: 'SIMPLE' | 'MEDIUM' | 'COMPLEX';
  confidence: number;
  reasoning: string;
  costPer1k: number;
  savings: number;
  score: number;
  dimensions?: Record<string, number>;
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

export interface Folder {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: number;
}

export interface PromptTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  is_global: number;
  created_at: number;
  updated_at: number;
}

export interface ShareStatus {
  shared: boolean;
  share_id?: string;
  has_password?: boolean;
  views?: number;
}

export interface SharedConversation {
  title: string;
  provider: string;
  model: string;
  system_prompt: string;
  created_at: number;
  author: string;
  messages: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    created_at: number;
    model?: string;
    files: FileAttachment[];
  }[];
}
