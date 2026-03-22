import { useState, memo, lazy, Suspense } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { User, Copy, Check, Trash2, Volume2 } from 'lucide-react';
import { format } from 'date-fns';
import { Message, RoutingInfo } from '../types';
import useAppStore from '../store/appStore';
import RoutingInfoModal from './RoutingInfoModal';
import clsx from 'clsx';

const SyntaxHighlighter = lazy(() =>
  import('react-syntax-highlighter/dist/esm/prism-light').then(mod => ({ default: mod.default }))
);
const oneDarkImport = import('react-syntax-highlighter/dist/esm/styles/prism/one-dark').then(mod => mod.default);
let oneDarkStyle: Record<string, unknown> | null = null;
oneDarkImport.then(s => { oneDarkStyle = s; });

interface Props { message: Message; }

const TIER_COLORS: Record<string, string> = {
  SIMPLE: 'bg-green-500/15 text-green-500 border-green-500/30',
  MEDIUM: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30',
  COMPLEX: 'bg-orange-500/15 text-orange-500 border-orange-500/30',
};

const MessageBubble = memo(function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showRoutingModal, setShowRoutingModal] = useState(false);
  const { deleteMessage } = useAppStore();

  const copyMessage = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    await deleteMessage(message.conversation_id, message.id);
  };

  return (
    <div className={clsx(
      'flex gap-3 max-w-3xl mx-auto w-full group',
      isUser && 'flex-row-reverse'
    )}>
      {/* Avatar */}
      <div className={clsx(
        'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1',
        isUser ? 'bg-[#e2e8f0] dark:bg-[#2d2d3f]' : 'bg-gradient-to-br from-violet-600 to-purple-800'
      )}>
        {isUser ? <User size={14} className="text-slate-500 dark:text-slate-300" /> : <img src="/logo_w.png" alt="" className="w-4 h-4" />}
      </div>

      {/* Content */}
      <div className={clsx(
        'relative flex-1 rounded-2xl px-3 sm:px-4 py-3 text-sm leading-relaxed transition-colors overflow-hidden min-w-0',
        isUser
          ? 'bg-violet-600 text-white rounded-tr-sm'
          : 'bg-[#f1f5f9] dark:bg-[#1a1a2e] text-slate-700 dark:text-slate-200 rounded-tl-sm'
      )}>
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            className="prose prose-invert prose-sm max-w-none prose-dark"
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const inline = !match;
                if (inline) {
                  return <code className="bg-[#e2e8f0] dark:bg-[#0d0d1a] text-violet-600 dark:text-violet-300 px-1.5 py-0.5 rounded text-xs" {...props}>{children}</code>;
                }
                return (
                  <div className="relative group/code my-3">
                    <div className="flex items-center justify-between bg-[#e2e8f0] dark:bg-[#0d0d1a] px-3 py-1.5 rounded-t-lg border border-[#d1d8e4] dark:border-[#2d2d3f] border-b-0">
                      <span className="text-xs text-slate-500 dark:text-slate-500">{match[1]}</span>
                      <CopyButton text={String(children)} />
                    </div>
                    <Suspense fallback={
                      <pre className="bg-[#282c34] rounded-b-lg p-4 text-xs text-slate-300 overflow-x-auto"><code>{String(children).replace(/\n$/, '')}</code></pre>
                    }>
                      <LazyCodeBlock language={match[1]}>{String(children).replace(/\n$/, '')}</LazyCodeBlock>
                    </Suspense>
                  </div>
                );
              },
              table({ children }) {
                return <div className="overflow-x-auto my-3"><table className="border-collapse w-full text-xs">{children}</table></div>;
              },
              th({ children }) {
                return <th className="border border-[#d1d8e4] dark:border-[#2d2d3f] bg-[#e2e8f0] dark:bg-[#0d0d1a] px-3 py-1.5 text-left text-slate-600 dark:text-slate-300">{children}</th>;
              },
              td({ children }) {
                return <td className="border border-[#d1d8e4] dark:border-[#2d2d3f] px-3 py-1.5 text-slate-500 dark:text-slate-400">{children}</td>;
              }
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}

        {/* Files / images */}
        {message.files?.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.files.filter((f: { mimetype: string }) => f.mimetype?.startsWith('image/')).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {message.files
                  .filter((f: { mimetype: string }) => f.mimetype?.startsWith('image/'))
                  .map((f: { id: string; filename: string; path: string; mimetype: string; base64?: string }) => (
                    <a key={f.id} href={f.path} target="_blank" rel="noopener noreferrer">
                      {f.base64 ? (
                        <img src={`data:${f.mimetype};base64,${f.base64}`} alt={f.filename}
                          className="h-32 max-w-xs object-cover rounded-xl border border-[#d1d8e4] dark:border-[#2d2d3f] hover:opacity-90 transition-opacity" />
                      ) : (
                        <img src={f.path} alt={f.filename}
                          className="h-32 max-w-xs object-cover rounded-xl border border-[#d1d8e4] dark:border-[#2d2d3f] hover:opacity-90 transition-opacity" />
                      )}
                    </a>
                  ))}
              </div>
            )}
            <div className="flex flex-wrap gap-1">
              {message.files
                .filter((f: { mimetype: string }) => !f.mimetype?.startsWith('image/'))
                .map((f: { id: string; filename: string; path: string }) => (
                  <a key={f.id} href={f.path} target="_blank" rel="noopener noreferrer"
                    className="text-xs bg-[#e2e8f0] dark:bg-[#0d0d1a] px-2 py-0.5 rounded border border-[#d1d8e4] dark:border-[#2d2d3f] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                    \uD83D\uDCCE {f.filename}
                  </a>
                ))}
            </div>
          </div>
        )}

        {/* Timestamp + actions */}
        <div className={clsx(
          'flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity',
          isUser ? 'justify-start flex-row-reverse' : 'justify-end'
        )}>
          <span className="text-xs text-slate-400 dark:text-slate-600">
            {format(new Date(message.created_at * 1000), 'HH:mm')}
          </span>
          {!isUser && (
            <>
              <button onClick={copyMessage} className="text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" title="Copy">
                {copied ? <Check size={11} /> : <Copy size={11} />}
              </button>
              <button
                onClick={() => {
                  const synth = window.speechSynthesis;
                  if (synth.speaking) { synth.cancel(); return; }
                  const clean = message.content.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]+`/g, '').replace(/[#*_~>|]/g, '').replace(/\n+/g, '. ');
                  const u = new SpeechSynthesisUtterance(clean);
                  u.lang = 'ru-RU';
                  const voices = synth.getVoices();
                  const v = voices.find(v => v.lang.startsWith('ru') && v.name.includes('Google')) || voices.find(v => v.lang.startsWith('ru'));
                  if (v) u.voice = v;
                  synth.speak(u);
                }}
                className="text-slate-400 dark:text-slate-600 hover:text-violet-500 dark:hover:text-violet-400 transition-colors"
                title="Speak"
              >
                <Volume2 size={11} />
              </button>
            </>
          )}
          {isUser && (
            <button onClick={copyMessage} className="text-white/50 hover:text-white/80 transition-colors" title="Copy">
              {copied ? <Check size={11} /> : <Copy size={11} />}
            </button>
          )}
          <button
            onClick={handleDelete}
            className={clsx(
              'transition-colors',
              confirmDelete
                ? 'text-red-400 hover:text-red-300'
                : isUser
                  ? 'text-white/50 hover:text-red-300'
                  : 'text-slate-400 dark:text-slate-600 hover:text-red-400'
            )}
            title={confirmDelete ? 'Click again to confirm' : 'Delete'}
          >
            <Trash2 size={11} />
          </button>
          {message.model && (
            <span className="text-xs text-slate-400 dark:text-slate-700">{message.model}</span>
          )}
        </div>

        {/* Routing info badge */}
        {!isUser && message.routing_info && (
          <button
            onClick={() => setShowRoutingModal(true)}
            className="flex items-center gap-1.5 mt-1.5 text-[10px] px-2 py-0.5 rounded-full border bg-[#f8fafc] dark:bg-[#0d0d1a]/50 border-slate-200 dark:border-slate-700/50 hover:border-violet-400 dark:hover:border-violet-500 transition-colors cursor-pointer w-fit"
          >
            <span className={`px-1.5 py-0 rounded-full text-[9px] font-semibold border ${TIER_COLORS[message.routing_info.tier] || TIER_COLORS.MEDIUM}`}>
              {message.routing_info.tier}
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              {message.routing_info.selectedModel}
            </span>
            {message.routing_info.savings > 0 && (
              <span className="text-green-500 font-medium">-{message.routing_info.savings}%</span>
            )}
          </button>
        )}

        {showRoutingModal && message.routing_info && (
          <RoutingInfoModal info={message.routing_info} onClose={() => setShowRoutingModal(false)} />
        )}
      </div>
    </div>
  );
});

export default MessageBubble;

function LazyCodeBlock({ language, children }: { language: string; children: string }) {
  return (
    <Suspense fallback={<pre className="bg-[#282c34] rounded-b-lg p-4 text-xs text-slate-300 overflow-x-auto"><code>{children}</code></pre>}>
      <SyntaxHighlighterWrapper language={language}>{children}</SyntaxHighlighterWrapper>
    </Suspense>
  );
}

function SyntaxHighlighterWrapper({ language, children }: { language: string; children: string }) {
  return (
    <SyntaxHighlighter
      style={oneDarkStyle || {}}
      language={language}
      PreTag="div"
      customStyle={{ margin: 0, borderRadius: '0 0 8px 8px', border: '1px solid', borderColor: 'var(--tw-border-opacity, 1) ? #2d2d3f : #d1d8e4', borderTop: 0 }}
    >
      {children}
    </SyntaxHighlighter>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
