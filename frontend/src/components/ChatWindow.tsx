import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { PanelLeft, ArrowDown, Volume2, VolumeX, Settings2 } from 'lucide-react';
import clsx from 'clsx';
import useAppStore from '../store/appStore';
import useAuthStore from '../store/authStore';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import ModelBar from './ModelBar';
import SystemPromptModal from './SystemPromptModal';
import { Message, RoutingInfo } from '../types';
import { streamChat } from '../services/api';
import RoutingInfoModal from './RoutingInfoModal';
import { useVoiceChat } from '../hooks/useVoiceChat';
import { format, isToday, isYesterday } from 'date-fns';
import { ru } from 'date-fns/locale';

function formatDateGroup(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  if (isToday(date)) return 'Сегодня';
  if (isYesterday(date)) return 'Вчера';
  return format(date, 'd MMMM yyyy', { locale: ru });
}

function MessageSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map(i => (
        <div key={i} className={`flex gap-3 max-w-4xl mx-auto w-full ${i % 2 === 0 ? 'flex-row-reverse' : ''}`}>
          <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
          <div className={`flex-1 rounded-2xl px-4 py-3 ${i % 2 === 0 ? 'bg-violet-200 dark:bg-violet-900/30 rounded-tr-sm ml-16' : 'bg-slate-100 dark:bg-slate-800/50 rounded-tl-sm mr-16'}`}>
            <div className="space-y-2">
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
              {i === 1 && <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-5/6" />}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ChatWindow() {
  const { t } = useTranslation();
  const { updateBalance } = useAuthStore();
  const {
    activeConversationId, activeConversation, messages, messagesLoading,
    streaming, streamingContent, tokenCount, streamingRoutingInfo,
    setStreaming, setStreamingContent, setTokenCount, setStreamingRoutingInfo,
    addMessage, loadConversations,
    selectedProvider, selectedModel, sidebarOpen, setSidebarOpen,
    systemPromptOpen
  } = useAppStore();

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [pendingFiles, setPendingFiles] = useState<unknown[]>([]);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [routingModal, setRoutingModal] = useState<RoutingInfo | null>(null);
  const [voicePickerOpen, setVoicePickerOpen] = useState(false);

  // TTS for assistant messages
  const voice = useVoiceChat({ lang: 'ru-RU' });
  const prevMessagesLen = useRef(messages.length);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  // Auto-speak new assistant messages
  useEffect(() => {
    if (voice.autoSpeak && messages.length > prevMessagesLen.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.role === 'assistant' && !lastMsg.id.startsWith('err-')) {
        voice.speak(lastMsg.content);
      }
    }
    prevMessagesLen.current = messages.length;
  }, [messages.length, voice.autoSpeak]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distanceFromBottom > 200);
  }, []);

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
      onRoutingInfo: (info) => setStreamingRoutingInfo(info as any),
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
          content: `\u26A0\uFE0F ${error}`,
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
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-400 dark:text-slate-500 px-4">
        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)} className="absolute top-4 left-4 p-2 hover:bg-[#f1f5f9] dark:hover:bg-[#1e1e2e] rounded-lg transition-colors">
            <PanelLeft size={18} />
          </button>
        )}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-800 flex items-center justify-center">
          <img src="/logo_w.png" alt="" className="w-8 h-8" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-600 dark:text-slate-300 mb-1">UspAIChat</h2>
          <p className="text-sm">{t('startNewChat')}</p>
          <p className="text-xs mt-2 opacity-60 hidden sm:block">Ctrl+N -- new chat / Ctrl+K -- search / Ctrl+, -- settings</p>
        </div>
      </div>
    );
  }

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = [];
  let currentGroup: { date: string; messages: Message[] } | null = null;
  messages.forEach(msg => {
    const dateStr = formatDateGroup(msg.created_at);
    if (!currentGroup || currentGroup.date !== dateStr) {
      currentGroup = { date: dateStr, messages: [msg] };
      groupedMessages.push(currentGroup);
    } else {
      currentGroup.messages.push(msg);
    }
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ModelBar />

      {/* Messages area with conversation transition */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden py-4 scroll-smooth"
      >
        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)} className="fixed top-3 left-3 z-10 p-2.5 sm:p-2 bg-white/80 dark:bg-[#1e1e2e]/80 backdrop-blur-sm hover:bg-[#f1f5f9] dark:hover:bg-[#1e1e2e] rounded-xl sm:rounded-lg transition-colors text-slate-500 dark:text-slate-400 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
            <PanelLeft size={20} className="sm:w-[18px] sm:h-[18px]" />
          </button>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeConversationId}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="space-y-6 max-w-4xl mx-auto px-2 sm:px-4"
          >
            {messagesLoading ? (
              <MessageSkeleton />
            ) : (
              <>
                {groupedMessages.map((group) => (
                  <div key={group.date}>
                    {/* Date separator */}
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700/50" />
                      <span className="text-xs text-slate-400 dark:text-slate-600 whitespace-nowrap">{group.date}</span>
                      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700/50" />
                    </div>
                    <AnimatePresence initial={false}>
                      {group.messages.map(msg => (
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
                  </div>
                ))}
              </>
            )}

            {/* Streaming bubble */}
            {streaming && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                {streamingRoutingInfo && (
                  <RoutingBadge info={streamingRoutingInfo} />
                )}
                <StreamingBubble content={streamingContent} />
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Bottom action buttons */}
      <div className="absolute bottom-28 right-6 z-20 flex flex-col gap-2">
        {/* Voice settings */}
        {voice.supported && voice.voices.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setVoicePickerOpen(!voicePickerOpen)}
              className="w-9 h-9 rounded-full bg-white dark:bg-[#1e1e2e] border border-[#d1d8e4] dark:border-[#2d2d3f] shadow-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-violet-500 dark:hover:text-violet-400 transition-colors"
              title="Выбрать голос"
            >
              <Settings2 size={13} />
            </button>
            {voicePickerOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setVoicePickerOpen(false)} />
                <div className="absolute bottom-full right-0 mb-2 bg-white dark:bg-[#1e1e2e] border border-[#d1d8e4] dark:border-[#2d2d3f] rounded-xl shadow-2xl z-50 min-w-[220px] max-h-64 overflow-y-auto">
                  <div className="px-3 py-2 border-b border-[#e2e8f0] dark:border-[#2d2d3f] text-xs font-medium text-slate-600 dark:text-slate-300">Голос озвучки</div>
                  <button
                    onClick={() => { voice.setVoice(null); setVoicePickerOpen(false); }}
                    className={clsx('w-full text-left px-3 py-2 text-xs hover:bg-[#f1f5f9] dark:hover:bg-[#2d2d3f] transition-colors',
                      !voice.selectedVoice ? 'text-violet-500 bg-[#f1f5f9] dark:bg-[#2d2d3f]' : 'text-slate-600 dark:text-slate-400')}
                  >
                    Авто (по умолчанию)
                  </button>
                  {voice.voices.map(v => (
                    <button key={v.voiceURI}
                      onClick={() => { voice.setVoice(v.voiceURI); setVoicePickerOpen(false); voice.speak('Привет! Это мой голос.'); }}
                      className={clsx('w-full text-left px-3 py-1.5 text-xs hover:bg-[#f1f5f9] dark:hover:bg-[#2d2d3f] transition-colors',
                        voice.selectedVoice === v.voiceURI ? 'text-violet-500 bg-[#f1f5f9] dark:bg-[#2d2d3f]' : 'text-slate-600 dark:text-slate-400')}
                    >
                      <div className="truncate">{v.name}</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-600">{v.lang}{v.isGoogle ? ' (Google)' : ''}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        {/* Auto-speak toggle */}
        {voice.supported && (
          <button
            onClick={voice.autoSpeak ? () => { voice.toggleAutoSpeak(); voice.stopSpeaking(); } : voice.toggleAutoSpeak}
            className={clsx(
              'w-9 h-9 rounded-full border shadow-lg flex items-center justify-center transition-colors',
              voice.autoSpeak
                ? 'bg-violet-600 border-violet-500 text-white'
                : 'bg-white dark:bg-[#1e1e2e] border-[#d1d8e4] dark:border-[#2d2d3f] text-slate-500 dark:text-slate-400 hover:text-violet-500 dark:hover:text-violet-400'
            )}
            title={voice.autoSpeak ? 'Auto-speak: ON' : 'Auto-speak: OFF'}
          >
            {voice.autoSpeak ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
        )}

        {/* Scroll to bottom */}
        <AnimatePresence>
          {showScrollBtn && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              onClick={scrollToBottom}
              className="w-9 h-9 rounded-full bg-white dark:bg-[#1e1e2e] border border-[#d1d8e4] dark:border-[#2d2d3f] shadow-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-violet-500 dark:hover:text-violet-400 transition-colors"
            >
              <ArrowDown size={16} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Token counter */}
      {tokenCount > 0 && (
        <div className="max-w-4xl mx-auto px-4 pb-1 text-right">
          <span className="text-xs text-slate-400 dark:text-slate-600">{tokenCount} tokens</span>
        </div>
      )}

      <div className="max-w-4xl mx-auto w-full">
        <ChatInput onSend={handleSend} disabled={streaming} onFilesChange={setPendingFiles} />
      </div>

      {systemPromptOpen && <SystemPromptModal />}
      {routingModal && <RoutingInfoModal info={routingModal} onClose={() => setRoutingModal(null)} />}
    </div>
  );

  function RoutingBadge({ info }: { info: RoutingInfo }) {
    const tierColors: Record<string, string> = {
      SIMPLE: 'bg-green-500/15 text-green-500 border-green-500/30',
      MEDIUM: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30',
      COMPLEX: 'bg-orange-500/15 text-orange-500 border-orange-500/30',
    };
    return (
      <div className="flex gap-3 max-w-4xl mx-auto w-full mb-1">
        <div className="w-7 shrink-0" />
        <button
          onClick={() => setRoutingModal(info)}
          className="flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full border bg-[#f8fafc] dark:bg-[#1a1a2e]/50 border-slate-200 dark:border-slate-700/50 hover:border-violet-400 transition-colors cursor-pointer"
        >
          <span className={`px-1.5 py-0 rounded-full text-[9px] font-semibold border ${tierColors[info.tier] || tierColors.MEDIUM}`}>
            {info.tier}
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            {info.selectedModel}
          </span>
          {info.savings > 0 && (
            <span className="text-green-500 font-medium">-{info.savings}%</span>
          )}
          <span className="text-slate-400 dark:text-slate-600">подробнее</span>
        </button>
      </div>
    );
  }
}

function StreamingBubble({ content }: { content: string }) {
  return (
    <div className="flex gap-3 max-w-4xl mx-auto w-full">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-600 to-purple-800 flex items-center justify-center shrink-0 mt-1">
        <img src="/logo_w.png" alt="" className="w-4 h-4" />
      </div>
      <div className="flex-1 bg-[#f1f5f9] dark:bg-[#1a1a2e] rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-700 dark:text-slate-200 leading-relaxed transition-colors">
        {content ? (
          <span>
            {content}
            <span className="inline-block w-0.5 h-4 bg-violet-400 ml-0.5 animate-cursor align-middle" />
          </span>
        ) : (
          <span className="text-slate-400 dark:text-slate-500 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        )}
      </div>
    </div>
  );
}
