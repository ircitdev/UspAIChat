import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X } from 'lucide-react';
import useAppStore from '../store/appStore';
import api from '../services/api';

export default function DocumentationModal() {
  const { setDocsOpen } = useAppStore();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/documentation')
      .then(({ data }) => setContent(data.content))
      .catch(() => setContent('# Ошибка\nНе удалось загрузить документацию.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-[#141422] rounded-2xl shadow-2xl w-[95vw] max-w-5xl h-[90vh] flex flex-col overflow-hidden border border-[#e2e8f0] dark:border-[#2d2d3f]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8f0] dark:border-[#2d2d3f]">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Документация</h2>
          <button onClick={() => setDocsOpen(false)} className="p-1.5 hover:bg-[#f1f5f9] dark:hover:bg-[#1e1e2e] rounded-lg text-slate-400">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:scroll-mt-4 prose-table:text-sm prose-th:bg-slate-100 dark:prose-th:bg-[#1e1e2e] prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 prose-pre:bg-[#1e1e2e] prose-pre:text-slate-200 prose-code:text-violet-600 dark:prose-code:text-violet-400 prose-code:before:content-none prose-code:after:content-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
