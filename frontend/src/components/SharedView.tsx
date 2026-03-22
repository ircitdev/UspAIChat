import { useState, useEffect } from 'react';
import { Lock, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { SharedConversation } from '../types';

interface Props {
  shareId: string;
}

export default function SharedView({ shareId }: Props) {
  const [data, setData] = useState<SharedConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');

  const fetchShared = async (pwd?: string) => {
    setLoading(true);
    setError('');
    try {
      const params = pwd ? `?password=${encodeURIComponent(pwd)}` : '';
      const res = await fetch(`/api/share/public/${shareId}${params}`);
      const json = await res.json();
      if (res.status === 401 && json.needs_password) {
        setNeedsPassword(true);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError(json.error || 'Not found');
        setLoading(false);
        return;
      }
      setData(json);
      setNeedsPassword(false);
    } catch {
      setError('Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShared();
  }, [shareId]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchShared(password);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fc] dark:bg-[#0d0d1a] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div className="min-h-screen bg-[#f8f9fc] dark:bg-[#0d0d1a] flex items-center justify-center px-4">
        <form onSubmit={handlePasswordSubmit} className="bg-white dark:bg-[#111122] rounded-2xl border border-[#d1d8e4] dark:border-[#2d2d3f] p-6 w-full max-w-sm shadow-xl space-y-4">
          <div className="flex items-center gap-2 justify-center text-violet-500">
            <Lock size={20} />
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Защищённая беседа</h2>
          </div>
          <p className="text-sm text-center text-slate-400 dark:text-slate-500">Введите пароль для доступа</p>
          {error && <p className="text-sm text-center text-red-400">{error}</p>}
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Пароль"
            autoFocus
            className="w-full bg-[#f1f5f9] dark:bg-[#1e1e2e] border border-[#d1d8e4] dark:border-[#2d2d3f] rounded-xl px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-violet-500"
          />
          <button type="submit" className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors">
            Открыть
          </button>
        </form>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#f8f9fc] dark:bg-[#0d0d1a] flex items-center justify-center">
        <div className="text-center space-y-2">
          <MessageSquare size={32} className="text-slate-400 mx-auto" />
          <p className="text-slate-500 dark:text-slate-400">{error || 'Беседа не найдена'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fc] dark:bg-[#0d0d1a]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-[#111122]/80 backdrop-blur-md border-b border-[#e2e8f0] dark:border-[#1e1e2e] px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-800 flex items-center justify-center">
            <img src="/logo_w.png" alt="" className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{data.title}</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              by {data.author} &middot; {data.provider}/{data.model} &middot; {format(new Date(data.created_at * 1000), 'd MMM yyyy', { locale: ru })}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {data.system_prompt && (
          <div className="bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800/30 rounded-xl px-4 py-3 text-sm text-violet-700 dark:text-violet-300">
            <span className="font-medium">System:</span> {data.system_prompt}
          </div>
        )}

        {data.messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          return (
            <div key={idx} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 ${isUser ? 'bg-[#e2e8f0] dark:bg-[#2d2d3f]' : 'bg-gradient-to-br from-violet-600 to-purple-800'}`}>
                {isUser
                  ? <span className="text-xs text-slate-500 dark:text-slate-300 font-bold">U</span>
                  : <img src="/logo_w.png" alt="" className="w-4 h-4" />
                }
              </div>
              <div className={`flex-1 rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                isUser
                  ? 'bg-violet-600 text-white rounded-tr-sm'
                  : 'bg-[#f1f5f9] dark:bg-[#1a1a2e] text-slate-700 dark:text-slate-200 rounded-tl-sm'
              }`}>
                {isUser ? (
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-sm max-w-none prose-dark">
                    {msg.content}
                  </ReactMarkdown>
                )}
                <div className={`text-xs mt-1 ${isUser ? 'text-white/40' : 'text-slate-400 dark:text-slate-600'}`}>
                  {format(new Date(msg.created_at * 1000), 'HH:mm')}
                  {msg.model && <span className="ml-2">{msg.model}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="text-center py-6 text-xs text-slate-400 dark:text-slate-600">
        Shared via <a href="/" className="text-violet-500 hover:text-violet-400">UspAIChat</a>
      </div>
    </div>
  );
}
