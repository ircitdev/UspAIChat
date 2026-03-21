import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Key, Check, Eye, EyeOff, Globe, Keyboard, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import useAppStore from '../store/appStore';
import api from '../services/api';
import i18n from '../i18n/i18n';
import clsx from 'clsx';
import { Provider } from '../types';

const PROVIDERS: { id: Provider; name: string; color: string; placeholder: string }[] = [
  { id: 'anthropic', name: 'Anthropic Claude', color: 'text-orange-400', placeholder: 'sk-ant-api...' },
  { id: 'openai', name: 'OpenAI', color: 'text-green-400', placeholder: 'sk-...' },
  { id: 'gemini', name: 'Google Gemini', color: 'text-blue-400', placeholder: 'AIza...' },
  { id: 'deepseek', name: 'DeepSeek', color: 'text-cyan-400', placeholder: 'sk-...' },
  { id: 'kimi', name: 'Kimi (Moonshot AI)', color: 'text-purple-400', placeholder: 'sk-...' },
];

const LANGUAGES = [
  { code: 'ru', name: 'Русский' },
  { code: 'en', name: 'English' },
  { code: 'zh', name: '中文' }
];

const SHORTCUTS = [
  { keys: 'Ctrl+N', desc: 'Новый чат' },
  { keys: 'Ctrl+K', desc: 'Поиск' },
  { keys: 'Ctrl+,', desc: 'Настройки' },
  { keys: 'Ctrl+B', desc: 'Скрыть боковую панель' },
  { keys: 'Enter', desc: 'Отправить сообщение' },
  { keys: 'Shift+Enter', desc: 'Новая строка' },
  { keys: 'Escape', desc: 'Закрыть окно' },
];

export default function SettingsModal() {
  const { t } = useTranslation();
  const { setSettingsOpen, apiKeyStatus, loadApiKeyStatus } = useAppStore();
  const [tab, setTab] = useState<'keys' | 'language' | 'shortcuts'>('keys');
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [baseUrls, setBaseUrls] = useState<Record<string, string>>({});
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [lang, setLang] = useState(i18n.language);

  const saveKey = async (provider: string) => {
    if (!keys[provider]) return;
    await api.post('/models/keys', {
      provider,
      api_key: keys[provider],
      base_url: baseUrls[provider] || undefined
    });
    setSaved(prev => ({ ...prev, [provider]: true }));
    setTimeout(() => setSaved(prev => ({ ...prev, [provider]: false })), 2000);
    await loadApiKeyStatus();
  };

  const deleteKey = async (provider: string) => {
    await api.delete(`/models/keys/${provider}`);
    setKeys(prev => ({ ...prev, [provider]: '' }));
    await loadApiKeyStatus();
  };

  const changeLanguage = (code: string) => {
    setLang(code);
    i18n.changeLanguage(code);
    localStorage.setItem('language', code);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#111122] border border-[#2d2d3f] rounded-2xl w-full max-w-lg mx-4 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e2e]">
          <h2 className="text-base font-semibold text-slate-100">{t('settings')}</h2>
          <button onClick={() => setSettingsOpen(false)} className="p-1.5 hover:bg-[#1e1e2e] rounded-lg transition-colors text-slate-400">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3">
          {[
            { id: 'keys', icon: Key, label: 'API Keys' },
            { id: 'language', icon: Globe, label: t('language') },
            { id: 'shortcuts', icon: Keyboard, label: t('shortcuts') }
          ].map(tab_ => (
            <button key={tab_.id} onClick={() => setTab(tab_.id as 'keys' | 'language' | 'shortcuts')}
              className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors',
                tab === tab_.id ? 'bg-violet-600 text-white' : 'text-slate-400 hover:bg-[#1e1e2e]')}>
              <tab_.icon size={12} />
              {tab_.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {tab === 'keys' && PROVIDERS.map(p => (
            <div key={p.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <label className={clsx('text-sm font-medium', p.color)}>{p.name}</label>
                {apiKeyStatus[p.id]?.configured && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-green-400 flex items-center gap-1"><Check size={10} /> Настроен</span>
                    <button onClick={() => deleteKey(p.id)} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                      <Trash2 size={10} /> Удалить
                    </button>
                  </div>
                )}
              </div>
              <div className="relative">
                <input
                  type={show[p.id] ? 'text' : 'password'}
                  placeholder={p.placeholder}
                  value={keys[p.id] || ''}
                  onChange={e => setKeys(prev => ({ ...prev, [p.id]: e.target.value }))}
                  className="w-full bg-[#1e1e2e] border border-[#2d2d3f] rounded-lg px-3 py-2 pr-8 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-violet-500 transition-colors"
                />
                <button onClick={() => setShow(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {show[p.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              {p.id === 'openai' && (
                <input
                  type="text"
                  placeholder="Base URL (optional, for proxies)"
                  value={baseUrls[p.id] || ''}
                  onChange={e => setBaseUrls(prev => ({ ...prev, [p.id]: e.target.value }))}
                  className="w-full bg-[#1e1e2e] border border-[#2d2d3f] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-violet-500 transition-colors"
                />
              )}
              <button
                onClick={() => saveKey(p.id)}
                disabled={!keys[p.id]}
                className={clsx('w-full py-1.5 rounded-lg text-xs font-medium transition-all',
                  saved[p.id] ? 'bg-green-600 text-white' :
                  keys[p.id] ? 'bg-violet-600 hover:bg-violet-700 text-white' :
                  'bg-[#1e1e2e] text-slate-600 cursor-not-allowed')}
              >
                {saved[p.id] ? `✓ Saved` : t('save')}
              </button>
            </div>
          ))}

          {tab === 'language' && (
            <div className="space-y-2">
              {LANGUAGES.map(l => (
                <button key={l.code} onClick={() => changeLanguage(l.code)}
                  className={clsx('w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors',
                    lang === l.code ? 'bg-violet-600/20 border border-violet-500 text-violet-300' : 'bg-[#1e1e2e] hover:bg-[#2d2d3f] text-slate-300')}>
                  {l.name}
                  {lang === l.code && <Check size={14} />}
                </button>
              ))}
            </div>
          )}

          {tab === 'shortcuts' && (
            <div className="space-y-2">
              {SHORTCUTS.map(s => (
                <div key={s.keys} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-slate-400">{s.desc}</span>
                  <kbd className="bg-[#1e1e2e] border border-[#2d2d3f] rounded px-2 py-0.5 text-xs text-slate-300 font-mono">{s.keys}</kbd>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
