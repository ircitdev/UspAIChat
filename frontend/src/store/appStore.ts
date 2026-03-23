import { create } from 'zustand';
import { Conversation, Message, Provider, ModelsMap, ApiKeyStatus, Folder, PromptTemplate, RoutingInfo } from '../types';
import api from '../services/api';

interface AppState {
  // Conversations
  conversations: Conversation[];
  activeConversationId: string | null;
  activeConversation: Conversation | null;
  messages: Message[];
  messagesLoading: boolean;

  // Folders
  folders: Folder[];

  // Prompt templates
  promptTemplates: PromptTemplate[];

  // UI
  sidebarOpen: boolean;
  settingsOpen: boolean;
  searchOpen: boolean;
  docsOpen: boolean;
  systemPromptOpen: boolean;
  streaming: boolean;
  streamingContent: string;
  tokenCount: number;
  streamingRoutingInfo: RoutingInfo | null;
  pendingMessage: string | null;

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
  deleteMessage: (convId: string, msgId: string) => Promise<void>;
  setStreamingContent: (content: string) => void;
  setStreaming: (val: boolean) => void;
  setTokenCount: (n: number) => void;
  setStreamingRoutingInfo: (info: RoutingInfo | null) => void;
  setSidebarOpen: (val: boolean) => void;
  setSettingsOpen: (val: boolean) => void;
  setSearchOpen: (val: boolean) => void;
  setDocsOpen: (val: boolean) => void;
  setSystemPromptOpen: (val: boolean) => void;
  setSelectedProvider: (p: Provider) => void;
  setSelectedModel: (m: string) => void;
  setPendingMessage: (msg: string | null) => void;
  loadModels: () => Promise<void>;
  loadApiKeyStatus: () => Promise<void>;

  // Folders
  loadFolders: () => Promise<void>;
  createFolder: (name: string, color?: string) => Promise<void>;
  updateFolder: (id: string, data: Partial<Folder>) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;

  // Prompt templates
  loadPromptTemplates: () => Promise<void>;
  createPromptTemplate: (data: { name: string; content: string; category?: string; is_global?: boolean }) => Promise<void>;
  deletePromptTemplate: (id: string) => Promise<void>;
}

const useAppStore = create<AppState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  activeConversation: null,
  messages: [],
  messagesLoading: false,
  folders: [],
  promptTemplates: [],
  sidebarOpen: true,
  settingsOpen: false,
  searchOpen: false,
  docsOpen: false,
  systemPromptOpen: false,
  streaming: false,
  streamingContent: '',
  tokenCount: 0,
  models: null,
  apiKeyStatus: {},
  selectedProvider: 'auto',
  selectedModel: 'auto',
  streamingRoutingInfo: null,
  pendingMessage: null,

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
      messagesLoading: true,
    });
    await get().loadMessages(id);
    set({ messagesLoading: false });
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

  deleteMessage: async (convId: string, msgId: string) => {
    await api.delete(`/conversations/${convId}/messages/${msgId}`);
    set(s => ({ messages: s.messages.filter(m => m.id !== msgId) }));
  },

  setStreamingContent: (content: string) => set({ streamingContent: content }),
  setStreaming: (val: boolean) => set({ streaming: val, streamingContent: val ? '' : '', streamingRoutingInfo: val ? null : get().streamingRoutingInfo }),
  setTokenCount: (n: number) => set({ tokenCount: n }),
  setStreamingRoutingInfo: (info: RoutingInfo | null) => set({ streamingRoutingInfo: info }),
  setSidebarOpen: (val: boolean) => set({ sidebarOpen: val }),
  setSettingsOpen: (val: boolean) => set({ settingsOpen: val }),
  setSearchOpen: (val: boolean) => set({ searchOpen: val }),
  setDocsOpen: (val: boolean) => set({ docsOpen: val }),
  setSystemPromptOpen: (val: boolean) => set({ systemPromptOpen: val }),
  setSelectedProvider: (p: Provider) => set({ selectedProvider: p }),
  setSelectedModel: (m: string) => set({ selectedModel: m }),
  setPendingMessage: (msg: string | null) => set({ pendingMessage: msg }),

  loadModels: async () => {
    const { data } = await api.get('/models');
    set({ models: data });
  },

  loadApiKeyStatus: async () => {
    const { data } = await api.get('/models/keys');
    set({ apiKeyStatus: data });
  },

  // Folders
  loadFolders: async () => {
    const { data } = await api.get('/folders');
    set({ folders: data });
  },

  createFolder: async (name: string, color?: string) => {
    const { data } = await api.post('/folders', { name, color });
    set(s => ({ folders: [...s.folders, data] }));
  },

  updateFolder: async (id: string, data: Partial<Folder>) => {
    const { data: updated } = await api.put(`/folders/${id}`, data);
    set(s => ({ folders: s.folders.map(f => f.id === id ? { ...f, ...updated } : f) }));
  },

  deleteFolder: async (id: string) => {
    await api.delete(`/folders/${id}`);
    set(s => ({ folders: s.folders.filter(f => f.id !== id) }));
    await get().loadConversations();
  },

  // Prompt templates
  loadPromptTemplates: async () => {
    const { data } = await api.get('/prompt-templates');
    set({ promptTemplates: data });
  },

  createPromptTemplate: async (tplData) => {
    const { data } = await api.post('/prompt-templates', tplData);
    set(s => ({ promptTemplates: [...s.promptTemplates, data] }));
  },

  deletePromptTemplate: async (id: string) => {
    await api.delete(`/prompt-templates/${id}`);
    set(s => ({ promptTemplates: s.promptTemplates.filter(t => t.id !== id) }));
  }
}));

export default useAppStore;
