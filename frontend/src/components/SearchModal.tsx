import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import api from '../services/api';
import useAppStore from '../store/appStore';
import { SearchResult } from '../types';

export default function SearchModal() {
  const { t } = useTranslation();
  const { setSearchOpen, selectConversation } = useAppStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/conversations/search/query', { params: { q: query } });
        setResults(data);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = async (result: SearchResult) => {
    await selectConversation(result.conversation_id);
    setSearchOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
      onClick={() => setSearchOpen(false)}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#111122] border border-[#2d2d3f] rounded-2xl w-full max-w-xl mx-4 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1e1e2e]">
          <Search size={16} className="text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('search')}
            className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none"
          />
          {loading && <div className="w-3 h-3 border border-violet-400 border-t-transparent rounded-full animate-spin" />}
          <button onClick={() => setSearchOpen(false)} className="text-slate-500 hover:text-slate-300">
            <X size={14} />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {results.length === 0 && query && !loading && (
            <div className="py-8 text-center text-sm text-slate-600">Ничего не найдено</div>
          )}
          {results.map(result => (
            <button key={result.id} onClick={() => handleSelect(result)}
              className="w-full flex gap-3 px-4 py-3 hover:bg-[#1e1e2e] transition-colors text-left border-b border-[#1e1e2e]/50">
              <MessageSquare size={14} className="text-violet-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-violet-400 font-medium truncate">{result.conversation_title}</span>
                  <span className="text-xs text-slate-600 shrink-0 ml-2">{format(new Date(result.created_at * 1000), 'dd.MM')}</span>
                </div>
                <p className="text-sm text-slate-400 truncate">{result.content}</p>
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
