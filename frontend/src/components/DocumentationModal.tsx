import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, ChevronRight, ChevronDown, Search, ArrowUp } from 'lucide-react';
import useAppStore from '../store/appStore';
import api from '../services/api';

interface TocItem {
  id: string;
  text: string;
  level: number;
  children: TocItem[];
}

function buildToc(markdown: string): TocItem[] {
  const lines = markdown.split('\n');
  const root: TocItem[] = [];
  const stack: { level: number; item: TocItem }[] = [];

  for (const line of lines) {
    const match = line.match(/^(#{2,3})\s+(.+)/);
    if (!match) continue;
    const level = match[1].length;
    const text = match[2].replace(/[`*_~]/g, '').trim();
    const id = text
      .toLowerCase()
      .replace(/[^\wа-яё\s-]/gi, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    const item: TocItem = { id, text, level, children: [] };

    if (level === 2) {
      root.push(item);
      stack.length = 0;
      stack.push({ level, item });
    } else {
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }
      if (stack.length > 0) {
        stack[stack.length - 1].item.children.push(item);
      } else {
        root.push(item);
      }
      stack.push({ level, item });
    }
  }
  return root;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\wа-яё\s-]/gi, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function TocEntry({ item, activeId, onNavigate, depth = 0 }: {
  item: TocItem; activeId: string; onNavigate: (id: string) => void; depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const isActive = activeId === item.id;
  const hasChildren = item.children.length > 0;
  const isChildActive = item.children.some(c => c.id === activeId || c.children.some(cc => cc.id === activeId));

  return (
    <div>
      <div
        className={`group flex items-center gap-1 py-1 px-2 rounded-md cursor-pointer text-[13px] leading-snug transition-all duration-150
          ${isActive
            ? 'bg-violet-500/15 text-violet-600 dark:text-violet-400 font-semibold'
            : isChildActive
              ? 'text-slate-700 dark:text-slate-300 font-medium'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1e1e2e]'
          }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => { onNavigate(item.id); }}
      >
        {hasChildren && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="shrink-0 p-0.5 -ml-1 rounded hover:bg-slate-200 dark:hover:bg-[#2d2d3f] transition-colors"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        )}
        {!hasChildren && <span className="w-4 shrink-0" />}
        <span className="truncate">{item.text}</span>
      </div>
      {hasChildren && expanded && (
        <div>
          {item.children.map(child => (
            <TocEntry key={child.id} item={child} activeId={activeId} onNavigate={onNavigate} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DocumentationModal() {
  const { setDocsOpen } = useAppStore();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/documentation')
      .then(({ data }) => setContent(data.content))
      .catch(() => setContent('# Ошибка\nНе удалось загрузить документацию.'))
      .finally(() => setLoading(false));
  }, []);

  const toc = useMemo(() => buildToc(content), [content]);

  const filteredToc = useMemo(() => {
    if (!searchQuery.trim()) return toc;
    const q = searchQuery.toLowerCase();
    const filterItems = (items: TocItem[]): TocItem[] => {
      return items.reduce<TocItem[]>((acc, item) => {
        const childMatches = filterItems(item.children);
        if (item.text.toLowerCase().includes(q) || childMatches.length > 0) {
          acc.push({ ...item, children: childMatches.length > 0 ? childMatches : item.children.filter(c => c.text.toLowerCase().includes(q)) });
        }
        return acc;
      }, []);
    };
    return filterItems(toc);
  }, [toc, searchQuery]);

  // Track active heading on scroll
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onScroll = () => {
      setShowScrollTop(el.scrollTop > 400);
      const headings = el.querySelectorAll('h2[id], h3[id]');
      let current = '';
      for (const h of headings) {
        const rect = (h as HTMLElement).getBoundingClientRect();
        const containerRect = el.getBoundingClientRect();
        if (rect.top - containerRect.top <= 80) {
          current = h.id;
        }
      }
      if (current) setActiveId(current);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [loading]);

  const navigateTo = useCallback((id: string) => {
    const el = contentRef.current?.querySelector(`#${CSS.escape(id)}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
  }, []);

  const scrollToTop = useCallback(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Custom heading renderer that adds IDs
  const headingRenderer = useMemo(() => ({
    h2: ({ children, ...props }: any) => {
      const text = extractText(children);
      const id = slugify(text);
      return <h2 id={id} className="scroll-mt-4" {...props}>{children}</h2>;
    },
    h3: ({ children, ...props }: any) => {
      const text = extractText(children);
      const id = slugify(text);
      return <h3 id={id} className="scroll-mt-4" {...props}>{children}</h3>;
    },
    // Beautiful tables
    table: ({ children, ...props }: any) => (
      <div className="overflow-x-auto my-4 rounded-xl border border-slate-200 dark:border-[#2d2d3f] shadow-sm">
        <table className="min-w-full" {...props}>{children}</table>
      </div>
    ),
    thead: ({ children, ...props }: any) => (
      <thead className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-[#1a1a2e] dark:to-[#1e1e2e]" {...props}>{children}</thead>
    ),
    th: ({ children, ...props }: any) => (
      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-[#2d2d3f]" {...props}>{children}</th>
    ),
    td: ({ children, ...props }: any) => (
      <td className="px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-[#1e1e2e]" {...props}>{children}</td>
    ),
    tr: ({ children, ...props }: any) => (
      <tr className="hover:bg-slate-50/50 dark:hover:bg-[#1a1a2e]/50 transition-colors" {...props}>{children}</tr>
    ),
    // Beautiful code blocks
    pre: ({ children, ...props }: any) => (
      <pre className="bg-[#0d1117] dark:bg-[#0d0d1a] text-slate-200 rounded-xl p-4 overflow-x-auto my-4 border border-slate-800/50 shadow-inner text-sm leading-relaxed" {...props}>{children}</pre>
    ),
    code: ({ inline, className, children, ...props }: any) => {
      if (inline) {
        return <code className="px-1.5 py-0.5 rounded-md bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 text-[0.85em] font-mono border border-violet-200/50 dark:border-violet-500/20" {...props}>{children}</code>;
      }
      return <code className={className} {...props}>{children}</code>;
    },
    // Beautiful blockquotes
    blockquote: ({ children, ...props }: any) => (
      <blockquote className="border-l-4 border-violet-400 dark:border-violet-500 bg-violet-50/50 dark:bg-violet-500/5 pl-4 pr-4 py-3 my-4 rounded-r-lg text-slate-600 dark:text-slate-400 italic" {...props}>{children}</blockquote>
    ),
    // Lists
    ul: ({ children, ...props }: any) => (
      <ul className="space-y-1 my-3" {...props}>{children}</ul>
    ),
    li: ({ children, ...props }: any) => (
      <li className="text-slate-700 dark:text-slate-300 leading-relaxed" {...props}>{children}</li>
    ),
    // HR
    hr: () => (
      <hr className="my-8 border-0 h-px bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-600 to-transparent" />
    ),
    // Strong
    strong: ({ children, ...props }: any) => (
      <strong className="font-semibold text-slate-900 dark:text-white" {...props}>{children}</strong>
    ),
    // Links
    a: ({ children, href, ...props }: any) => (
      <a href={href} className="text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 underline decoration-violet-300/50 dark:decoration-violet-500/30 underline-offset-2 hover:decoration-violet-500 transition-colors" {...props}>{children}</a>
    ),
  }), []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setDocsOpen(false)}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
        className="bg-white dark:bg-[#141422] rounded-2xl shadow-2xl w-[96vw] max-w-7xl h-[92vh] flex flex-col overflow-hidden border border-[#e2e8f0] dark:border-[#2d2d3f]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[#e2e8f0] dark:border-[#2d2d3f] bg-gradient-to-r from-white to-slate-50/80 dark:from-[#141422] dark:to-[#1a1a2e]/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-white">UspAIChat Documentation</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">v1.3.0</p>
            </div>
          </div>
          <button onClick={() => setDocsOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-[#1e1e2e] rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body: TOC sidebar + Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* TOC Sidebar */}
          <div className="hidden md:flex w-72 shrink-0 flex-col border-r border-[#e2e8f0] dark:border-[#2d2d3f] bg-slate-50/50 dark:bg-[#0d0d1a]/50">
            {/* TOC Search */}
            <div className="p-3 border-b border-[#e2e8f0] dark:border-[#2d2d3f]">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Поиск по разделам..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#141422] border border-slate-200 dark:border-[#2d2d3f] text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-400 focus:border-violet-400 transition-all"
                />
              </div>
            </div>
            {/* TOC List */}
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <nav className="space-y-0.5">
                  {filteredToc.map(item => (
                    <TocEntry key={item.id} item={item} activeId={activeId} onNavigate={navigateTo} />
                  ))}
                </nav>
              )}
            </div>
          </div>

          {/* Main content */}
          <div ref={contentRef} className="flex-1 overflow-y-auto custom-scrollbar relative">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-3 border-violet-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-slate-400">Загрузка документации...</span>
                </div>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto px-8 py-6">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={headingRenderer}
                >
                  {content}
                </ReactMarkdown>
              </div>
            )}

            {/* Scroll to top button */}
            {showScrollTop && (
              <button
                onClick={scrollToTop}
                className="fixed bottom-8 right-8 z-10 p-2.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/30 transition-all hover:scale-110"
              >
                <ArrowUp size={18} />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function extractText(children: any): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(extractText).join('');
  if (children?.props?.children) return extractText(children.props.children);
  return '';
}
