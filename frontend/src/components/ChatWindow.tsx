import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, PanelLeft } from 'lucide-react';
import useAppStore from '../store/appStore';
import useAuthStore from '../store/authStore';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import ModelBar from './ModelBar';
import SystemPromptModal from './SystemPromptModal';
import { Message } from '../types';
import { streamChat } from '../services/api';

export default function ChatWindow() {
  const { t } = useTranslation();
  const { updateBalance } = useAuthStore();
  const {
    activeConversationId, activeConversation, messages,
    streaming, streamingContent, tokenCount,
    setStreaming, setStreamingContent, setTokenCount,
    addMessage, loadConversations,
    selectedProvider, selectedModel, sidebarOpen, setSidebarOpen,
    systemPromptOpen
  } = useAppStore();

  const bottomRef = useRef<HTMLDivElement>(null);
  const [pendingFiles, setPendingFiles] = useState<unknown[]>([]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSend = async (text: string, files: unknown[]) => {
    if (!activeConversationId || !text.trim() || streaming) return;

    setStreaming(true);
    setStreamingContent('');
    setTokenCount(0);

    let accum = '';

    await streamChat({
      conversation_id: activeConversationId,
      message: text,
      provider: selectedProvider,
      model: selectedModel,
      system_prompt: activeConversation?.system_prompt,
      files,
      onChunk: (chunk) => {
        accum += chunk;
        setStreamingContent(accum);
      },
      onTokens: (count) => setTokenCount(count),
      onDone: async (_msgId, _fullContent, balanceAfter) => {
        setStreaming(false);
        setStreamingContent('');
        if (balanceAfter !== null && balanceAfter !== undefined) {
          updateBalance(balanceAfter);
        }
        const { loadMessages } = useAppStore.getState();
        await loadMessages(activeConversationId);
        await loadConversations();
      },
      onError: (error) => {
        setStreaming(false);
        setStreamingContent('');
        const errMsg: Message = {
          id: 'err-' + Date.now(),
          conversation_id: activeConversationId,
          role: 'assistant',
          content: `⚠️ ${error}`,
          created_at: Date.now() / 1000,
          token_count: 0,
          files: []
        };
        addMessage(errMsg);
      }
    });
  };

  if (!activeConversationId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-500">
        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)} className="absolute top-4 left-4 p-2 hover:bg-[#1e1e2e] rounded-lg transition-colors">
            <PanelLeft size={18} />
          </button>
        )}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-800 flex items-center justify-center">
          <img src="/logo_w.png" alt="" className="w-8 h-8" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-300 mb-1">UspAIChat</h2>
          <p className="text-sm">{t('startNewChat')}</p>
          <p className="text-xs mt-2 opacity-60">Ctrl+N — новый чат • Ctrl+K — поиск • Ctrl+, — настройки</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ModelBar />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)} className="fixed top-4 left-4 z-10 p-2 hover:bg-[#1e1e2e] rounded-lg transition-colors text-slate-400">
            <PanelLeft size={18} />
          </button>
        )}

        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
            >
              <MessageBubble message={msg} />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Streaming bubble */}
        {streaming && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <StreamingBubble content={streamingContent} />
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Token counter */}
      {tokenCount > 0 && (
        <div className="px-4 pb-1 text-right">
          <span className="text-xs text-slate-600">{tokenCount} tokens</span>
        </div>
      )}

      <ChatInput onSend={handleSend} disabled={streaming} onFilesChange={setPendingFiles} />

      {systemPromptOpen && <SystemPromptModal />}
    </div>
  );
}

function StreamingBubble({ content }: { content: string }) {
  return (
    <div className="flex gap-3 max-w-3xl mx-auto w-full">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-600 to-purple-800 flex items-center justify-center shrink-0 mt-1">
        <img src="/logo_w.png" alt="" className="w-4 h-4" />
      </div>
      <div className="flex-1 bg-[#1a1a2e] rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-200 leading-relaxed">
        {content ? (
          <span>
            {content}
            <span className="inline-block w-0.5 h-4 bg-violet-400 ml-0.5 animate-cursor align-middle" />
          </span>
        ) : (
          <span className="text-slate-500 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        )}
      </div>
    </div>
  );
}
