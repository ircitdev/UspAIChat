import { create } from 'zustand';
import { Conversation, Message, Provider, ModelsMap, ApiKeyStatus } from '../types';
import api from '../services/api';

interface AppState {
  // Conversations
  conversations: Conversation[];
  activeConversationId: string | null;
  activeConversation: Conversation | null;
  messages: Message[];

  // UI
  sidebarOpen: boolean;
  settingsOpen: boolean;
  searchOpen: boolean;
  systemPromptOpen: boolean;
  streaming: boolean;
  streamingContent: string;
  tokenCount: number;

  // Models
  models: ModelsMap | null;
  apiKeyStatus: ApiKeyStatus;
  selectedProvider: Provider;
  selectedModel: string;

  // Actions
  loadConversations: () => Promise<void>;
  createConversation: () => Promise<string>;
  selectConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  updateConversation: (id: string, data: Partial<Conversation>) => Promise<void>;
  loadMessages: (convId: string) => Promise<void>;
  addMessage: (msg: Message) => void;
  setStreamingContent: (content: string) => void;
  setStreaming: (val: boolean) => void;
  setTokenCount: (n: number) => void;
  setSidebarOpen: (val: boolean) => void;
  setSettingsOpen: (val: boolean) => void;
  setSearchOpen: (val: boolean) => void;
  setSystemPromptOpen: (val: boolean) => void;
  setSelectedProvider: (p: Provider) => void;
  setSelectedModel: (m: string) => void;
  loadModels: () => Promise<void>;
  loadApiKeyStatus: () => Promise<void>;
}

const useAppStore = create<AppState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  activeConversation: null,
  messages: [],
  sidebarOpen: true,
  settingsOpen: false,
  searchOpen: false,
  systemPromptOpen: false,
  streaming: false,
  streamingContent: '',
  tokenCount: 0,
  models: null,
  apiKeyStatus: {},
  selectedProvider: 'openai',
  selectedModel: 'gpt-4o',

  loadConversations: async () => {
    const { data } = await api.get('/conversations');
    set({ conversations: data });
  },

  createConversation: async () => {
    const { selectedProvider, selectedModel } = get();
    const { data } = await api.post('/conversations', {
      title: 'New Chat',
      provider: selectedProvider,
      model: selectedModel
    });
    set(s => ({ conversations: [data, ...s.conversations] }));
    await get().selectConversation(data.id);
    return data.id;
  },

  selectConversation: async (id: string) => {
    const conv = get().conversations.find(c => c.id === id);
    set({
      activeConversationId: id,
      activeConversation: conv || null,
      selectedProvider: (conv?.provider as Provider) || get().selectedProvider,
      selectedModel: conv?.model || get().selectedModel,
    });
    await get().loadMessages(id);
  },

  deleteConversation: async (id: string) => {
    await api.delete(`/conversations/${id}`);
    const { activeConversationId, conversations } = get();
    const remaining = conversations.filter(c => c.id !== id);
    set({ conversations: remaining });
    if (activeConversationId === id) {
      if (remaining.length > 0) {
        await get().selectConversation(remaining[0].id);
      } else {
        set({ activeConversationId: null, activeConversation: null, messages: [] });
      }
    }
  },

  updateConversation: async (id: string, data: Partial<Conversation>) => {
    const { data: updated } = await api.put(`/conversations/${id}`, data);
    set(s => ({
      conversations: s.conversations.map(c => c.id === id ? { ...c, ...updated } : c),
      activeConversation: s.activeConversationId === id ? { ...s.activeConversation!, ...updated } : s.activeConversation
    }));
  },

  loadMessages: async (convId: string) => {
    const { data } = await api.get(`/conversations/${convId}/messages`);
    set({ messages: data });
  },

  addMessage: (msg: Message) => {
    set(s => ({ messages: [...s.messages, msg] }));
  },

  setStreamingContent: (content: string) => set({ streamingContent: content }),
  setStreaming: (val: boolean) => set({ streaming: val, streamingContent: val ? '' : '' }),
  setTokenCount: (n: number) => set({ tokenCount: n }),
  setSidebarOpen: (val: boolean) => set({ sidebarOpen: val }),
  setSettingsOpen: (val: boolean) => set({ settingsOpen: val }),
  setSearchOpen: (val: boolean) => set({ searchOpen: val }),
  setSystemPromptOpen: (val: boolean) => set({ systemPromptOpen: val }),
  setSelectedProvider: (p: Provider) => set({ selectedProvider: p }),
  setSelectedModel: (m: string) => set({ selectedModel: m }),

  loadModels: async () => {
    const { data } = await api.get('/models');
    set({ models: data });
  },

  loadApiKeyStatus: async () => {
    const { data } = await api.get('/models/keys');
    set({ apiKeyStatus: data });
  }
}));

export default useAppStore;
