import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Bot, User, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import { Message } from '../types';
import clsx from 'clsx';

interface Props { message: Message; }

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const copyMessage = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={clsx(
      'flex gap-3 max-w-3xl mx-auto w-full group',
      isUser && 'flex-row-reverse'
    )}>
      {/* Avatar */}
      <div className={clsx(
        'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1',
        isUser ? 'bg-[#2d2d3f]' : 'bg-gradient-to-br from-violet-600 to-purple-800'
      )}>
        {isUser ? <User size={14} className="text-slate-300" /> : <Bot size={14} className="text-white" />}
      </div>

      {/* Content */}
      <div className={clsx(
        'relative flex-1 rounded-2xl px-4 py-3 text-sm leading-relaxed',
        isUser
          ? 'bg-violet-600 text-white rounded-tr-sm'
          : 'bg-[#1a1a2e] text-slate-200 rounded-tl-sm'
      )}>
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            className="prose prose-invert prose-sm max-w-none prose-dark"
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const inline = !match;
                if (inline) {
                  return <code className="bg-[#0d0d1a] text-violet-300 px-1.5 py-0.5 rounded text-xs" {...props}>{children}</code>;
                }
                return (
                  <div className="relative group/code my-3">
                    <div className="flex items-center justify-between bg-[#0d0d1a] px-3 py-1.5 rounded-t-lg border border-[#2d2d3f] border-b-0">
                      <span className="text-xs text-slate-500">{match[1]}</span>
                      <CopyButton text={String(children)} />
                    </div>
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                      customStyle={{ margin: 0, borderRadius: '0 0 8px 8px', border: '1px solid #2d2d3f', borderTop: 0 }}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  </div>
                );
              },
              table({ children }) {
                return <div className="overflow-x-auto my-3"><table className="border-collapse w-full text-xs">{children}</table></div>;
              },
              th({ children }) {
                return <th className="border border-[#2d2d3f] bg-[#0d0d1a] px-3 py-1.5 text-left text-slate-300">{children}</th>;
              },
              td({ children }) {
                return <td className="border border-[#2d2d3f] px-3 py-1.5 text-slate-400">{children}</td>;
              }
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}

        {/* Files / images */}
        {message.files?.length > 0 && (
          <div className="mt-2 space-y-1">
            {/* Images grid */}
            {message.files.filter((f: { mimetype: string }) => f.mimetype?.startsWith('image/')).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {message.files
                  .filter((f: { mimetype: string }) => f.mimetype?.startsWith('image/'))
                  .map((f: { id: string; filename: string; path: string; mimetype: string; base64?: string }) => (
                    <a key={f.id} href={f.path} target="_blank" rel="noopener noreferrer">
                      {f.base64 ? (
                        <img
                          src={`data:${f.mimetype};base64,${f.base64}`}
                          alt={f.filename}
                          className="h-32 max-w-xs object-cover rounded-xl border border-[#2d2d3f] hover:opacity-90 transition-opacity"
                        />
                      ) : (
                        <img
                          src={f.path}
                          alt={f.filename}
                          className="h-32 max-w-xs object-cover rounded-xl border border-[#2d2d3f] hover:opacity-90 transition-opacity"
                        />
                      )}
                    </a>
                  ))}
              </div>
            )}
            {/* Other files */}
            <div className="flex flex-wrap gap-1">
              {message.files
                .filter((f: { mimetype: string }) => !f.mimetype?.startsWith('image/'))
                .map((f: { id: string; filename: string; path: string }) => (
                  <a key={f.id} href={f.path} target="_blank" rel="noopener noreferrer"
                    className="text-xs bg-[#0d0d1a] px-2 py-0.5 rounded border border-[#2d2d3f] text-slate-400 hover:text-slate-200 transition-colors">
                    📎 {f.filename}
                  </a>
                ))}
            </div>
          </div>
        )}

        {/* Timestamp + copy */}
        <div className={clsx(
          'flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity',
          isUser ? 'justify-start flex-row-reverse' : 'justify-end'
        )}>
          <span className="text-xs text-slate-600">
            {format(new Date(message.created_at * 1000), 'HH:mm')}
          </span>
          {!isUser && (
            <button onClick={copyMessage} className="text-slate-600 hover:text-slate-300 transition-colors">
              {copied ? <Check size={11} /> : <Copy size={11} />}
            </button>
          )}
          {message.model && (
            <span className="text-xs text-slate-700">{message.model}</span>
          )}
        </div>
      </div>
    </div>
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
    <button onClick={copy} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
