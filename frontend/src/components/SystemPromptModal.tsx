import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, BookOpen, Wand2 } from 'lucide-react';
import { motion } from 'framer-motion';
import TextareaAutosize from 'react-textarea-autosize';
import useAppStore from '../store/appStore';

const PRESETS = [
  { name: '\uD83E\uDDD1\u200D\uD83D\uDCBB Senior Developer', prompt: 'You are a senior software engineer with 15+ years of experience. Provide concise, production-ready code with best practices. Focus on performance, security, and maintainability.' },
  { name: '\uD83D\uDCDD Technical Writer', prompt: 'You are a technical writer who creates clear, structured documentation. Use bullet points, headers, and examples. Write for a developer audience.' },
  { name: '\uD83C\uDFAF Product Manager', prompt: 'You are an experienced product manager. Help define requirements, prioritize features, and think about user needs and business impact.' },
  { name: '\uD83D\uDD2C Researcher', prompt: 'You are a research assistant. Provide detailed, accurate information with sources when possible. Think critically and present multiple perspectives.' },
  { name: '\uD83D\uDDE3\uFE0F Translator (RU\u2194EN)', prompt: 'You are a professional translator specializing in Russian and English. Translate text accurately while preserving tone and style. If unclear, ask for context.' },
];

export default function SystemPromptModal() {
  const { t } = useTranslation();
  const { activeConversation, updateConversation, setSystemPromptOpen } = useAppStore();
  const [prompt, setPrompt] = useState(activeConversation?.system_prompt || '');

  const handleSave = async () => {
    if (activeConversation) {
      await updateConversation(activeConversation.id, { system_prompt: prompt });
    }
    setSystemPromptOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-[#111122] border border-[#d1d8e4] dark:border-[#2d2d3f] rounded-2xl w-full max-w-lg mx-4 shadow-2xl overflow-hidden transition-colors"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2e8f0] dark:border-[#1e1e2e]">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-violet-500 dark:text-violet-400" />
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{t('systemPrompt')}</h2>
          </div>
          <button onClick={() => setSystemPromptOpen(false)} className="p-1.5 hover:bg-[#f1f5f9] dark:hover:bg-[#1e1e2e] rounded-lg text-slate-400">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Presets */}
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-2 flex items-center gap-1"><Wand2 size={11} /> Ready-made personas</p>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map(p => (
                <button key={p.name} onClick={() => setPrompt(p.prompt)}
                  className="px-2.5 py-1 bg-[#f1f5f9] dark:bg-[#1e1e2e] hover:bg-[#e2e8f0] dark:hover:bg-[#2d2d3f] border border-[#d1d8e4] dark:border-[#2d2d3f] rounded-lg text-xs text-slate-500 dark:text-slate-400 transition-colors">
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Text area */}
          <TextareaAutosize
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="You are an assistant that..."
            minRows={6}
            maxRows={12}
            className="w-full bg-[#f1f5f9] dark:bg-[#1e1e2e] border border-[#d1d8e4] dark:border-[#2d2d3f] rounded-xl px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-violet-500 resize-none transition-colors"
          />

          <div className="flex gap-2">
            <button onClick={() => setPrompt('')}
              className="flex-1 py-2 rounded-xl bg-[#f1f5f9] dark:bg-[#1e1e2e] hover:bg-[#e2e8f0] dark:hover:bg-[#2d2d3f] text-sm text-slate-500 dark:text-slate-400 transition-colors">
              Clear
            </button>
            <button onClick={handleSave}
              className="flex-1 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm text-white font-medium transition-colors">
              {t('save')}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
