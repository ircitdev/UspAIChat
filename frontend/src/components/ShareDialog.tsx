import { useState, useEffect } from 'react';
import { X, Link2, Copy, Check, Eye, Lock, Unlock, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../services/api';
import { ShareStatus } from '../types';

interface Props {
  conversationId: string;
  conversationTitle: string;
  onClose: () => void;
}

export default function ShareDialog({ conversationId, conversationTitle, onClose }: Props) {
  const [status, setStatus] = useState<ShareStatus | null>(null);
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadStatus();
  }, [conversationId]);

  const loadStatus = async () => {
    try {
      const { data } = await api.get(`/share/status/${conversationId}`);
      setStatus(data);
      setUsePassword(!!data.has_password);
    } catch {}
  };

  const handleShare = async () => {
    setLoading(true);
    try {
      const { data } = await api.post(`/share/${conversationId}`, {
        password: usePassword ? password : undefined
      });
      setStatus({ shared: true, share_id: data.share_id, has_password: data.has_password, views: 0 });
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  const handleUnshare = async () => {
    setLoading(true);
    try {
      await api.delete(`/share/${conversationId}`);
      setStatus({ shared: false });
    } finally {
      setLoading(false);
    }
  };

  const shareUrl = status?.share_id ? `${window.location.origin}/shared/${status.share_id}` : '';

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-[#111122] border border-[#d1d8e4] dark:border-[#2d2d3f] rounded-2xl w-full max-w-md mx-4 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2e8f0] dark:border-[#1e1e2e]">
          <div className="flex items-center gap-2">
            <Link2 size={16} className="text-violet-500" />
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Поделиться</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[#f1f5f9] dark:hover:bg-[#1e1e2e] rounded-lg text-slate-400">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400 truncate">"{conversationTitle}"</p>

          {status?.shared ? (
            <>
              {/* Active share link */}
              <div className="flex items-center gap-2 bg-[#f1f5f9] dark:bg-[#1e1e2e] rounded-xl px-3 py-2.5">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 bg-transparent text-sm text-slate-700 dark:text-slate-200 outline-none truncate"
                />
                <button onClick={copyLink} className="shrink-0 text-violet-500 hover:text-violet-400 transition-colors">
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
                <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-slate-400 hover:text-violet-500 transition-colors">
                  <ExternalLink size={16} />
                </a>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                <span className="flex items-center gap-1">
                  <Eye size={12} /> {status.views || 0} просмотров
                </span>
                <span className="flex items-center gap-1">
                  {status.has_password ? <Lock size={12} /> : <Unlock size={12} />}
                  {status.has_password ? 'Защищено паролем' : 'Без пароля'}
                </span>
              </div>

              <button
                onClick={handleUnshare}
                disabled={loading}
                className="w-full py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 text-sm font-medium transition-colors"
              >
                Отключить ссылку
              </button>
            </>
          ) : (
            <>
              {/* Create share */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={usePassword}
                    onChange={e => setUsePassword(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-300">Защитить паролем</span>
                </label>

                {usePassword && (
                  <input
                    type="text"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Введите пароль..."
                    className="w-full bg-[#f1f5f9] dark:bg-[#1e1e2e] border border-[#d1d8e4] dark:border-[#2d2d3f] rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-violet-500"
                  />
                )}
              </div>

              <button
                onClick={handleShare}
                disabled={loading || (usePassword && !password.trim())}
                className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Создание...' : 'Создать ссылку'}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
