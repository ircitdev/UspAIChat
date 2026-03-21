import { useTranslation } from 'react-i18next';
import { ChevronDown, Zap, BookOpen } from 'lucide-react';
import { useState } from 'react';
import useAppStore from '../store/appStore';
import { Provider } from '../types';
import clsx from 'clsx';

const PROVIDER_COLORS: Record<Provider, string> = {
  anthropic: 'text-orange-400',
  openai: 'text-green-400',
  gemini: 'text-blue-400',
  deepseek: 'text-cyan-400',
  kimi: 'text-purple-400',
};

const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Google',
  deepseek: 'DeepSeek',
  kimi: 'Kimi',
};

export default function ModelBar() {
  const { t } = useTranslation();
  const {
    selectedProvider, selectedModel, models, tokenCount,
    setSelectedProvider, setSelectedModel,
    activeConversationId, updateConversation, activeConversation,
    setSystemPromptOpen
  } = useAppStore();

  const [providerOpen, setProviderOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);

  const currentModels = models?.[selectedProvider] || [];

  const handleProviderChange = (p: Provider) => {
    setSelectedProvider(p);
    const firstModel = models?.[p]?.[0]?.id || '';
    setSelectedModel(firstModel);
    if (activeConversationId) {
      updateConversation(activeConversationId, { provider: p, model: firstModel });
    }
    setProviderOpen(false);
  };

  const handleModelChange = (m: string) => {
    setSelectedModel(m);
    if (activeConversationId) {
      updateConversation(activeConversationId, { model: m });
    }
    setModelOpen(false);
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-[#1e1e2e] bg-[#111122]">
      {/* Provider selector */}
      <div className="relative">
        <button
          onClick={() => { setProviderOpen(!providerOpen); setModelOpen(false); }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1e1e2e] hover:bg-[#2d2d3f] text-xs transition-colors"
        >
          <span className={PROVIDER_COLORS[selectedProvider]}>{PROVIDER_LABELS[selectedProvider]}</span>
          <ChevronDown size={11} className="text-slate-500" />
        </button>
        {providerOpen && (
          <div className="absolute top-full left-0 mt-1 bg-[#1e1e2e] border border-[#2d2d3f] rounded-lg shadow-xl z-50 overflow-hidden min-w-[130px]">
            {(['anthropic', 'openai', 'gemini', 'deepseek', 'kimi'] as Provider[]).map(p => (
              <button key={p} onClick={() => handleProviderChange(p)}
                className={clsx('w-full text-left px-3 py-2 text-xs hover:bg-[#2d2d3f] transition-colors', PROVIDER_COLORS[p])}>
                {PROVIDER_LABELS[p]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Model selector */}
      <div className="relative">
        <button
          onClick={() => { setModelOpen(!modelOpen); setProviderOpen(false); }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1e1e2e] hover:bg-[#2d2d3f] text-xs text-slate-300 transition-colors"
        >
          <Zap size={11} className="text-violet-400" />
          <span className="max-w-[150px] truncate">{currentModels.find(m => m.id === selectedModel)?.name || selectedModel}</span>
          <ChevronDown size={11} className="text-slate-500" />
        </button>
        {modelOpen && (
          <div className="absolute top-full left-0 mt-1 bg-[#1e1e2e] border border-[#2d2d3f] rounded-lg shadow-xl z-50 overflow-hidden min-w-[200px] max-h-64 overflow-y-auto">
            {currentModels.map(m => (
              <button key={m.id} onClick={() => handleModelChange(m.id)}
                className={clsx('w-full text-left px-3 py-2 text-xs hover:bg-[#2d2d3f] transition-colors',
                  m.id === selectedModel ? 'text-violet-400' : 'text-slate-300')}>
                <div>{m.name}</div>
                <div className="text-slate-600 text-[10px]">{(m.context / 1000).toFixed(0)}K context</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* System prompt */}
      <button
        onClick={() => setSystemPromptOpen(true)}
        className={clsx(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors',
          activeConversation?.system_prompt
            ? 'bg-violet-600/20 text-violet-400 hover:bg-violet-600/30'
            : 'bg-[#1e1e2e] text-slate-500 hover:bg-[#2d2d3f] hover:text-slate-300'
        )}
      >
        <BookOpen size={11} />
        {t('systemPrompt')}
      </button>

      {/* Token counter */}
      {tokenCount > 0 && (
        <div className="ml-auto text-xs text-slate-600">
          <span className="text-violet-400">{tokenCount}</span> {t('tokens')}
        </div>
      )}

      {/* Close dropdowns */}
      {(providerOpen || modelOpen) && (
        <div className="fixed inset-0 z-40" onClick={() => { setProviderOpen(false); setModelOpen(false); }} />
      )}
    </div>
  );
}
