import { useRef, useState, useEffect, KeyboardEvent, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import TextareaAutosize from 'react-textarea-autosize';
import { Send, Paperclip, X, FileText, Sparkles, Mic, MicOff } from 'lucide-react';
import api from '../services/api';
import useAppStore from '../store/appStore';
import { useVoiceChat } from '../hooks/useVoiceChat';
import { PromptTemplate } from '../types';
import clsx from 'clsx';

interface UploadedFile {
  id: string;
  filename: string;
  path: string;
  mimetype: string;
  size: number;
  base64?: string | null;
}

interface Props {
  onSend: (text: string, files: UploadedFile[]) => void;
  disabled: boolean;
  onFilesChange: (files: UploadedFile[]) => void;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const { t } = useTranslation();
  const { activeConversationId, promptTemplates, loadPromptTemplates } = useAppStore();
  const [text, setText] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Voice input
  const voice = useVoiceChat({
    lang: 'ru-RU',
    onTranscript: (finalText) => {
      setText(prev => prev ? prev + ' ' + finalText : finalText);
    }
  });

  // Prompt templates popup
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateFilter, setTemplateFilter] = useState('');
  const [selectedTemplateIdx, setSelectedTemplateIdx] = useState(0);

  useEffect(() => {
    loadPromptTemplates();
  }, []);

  const filteredTemplates = promptTemplates.filter(t =>
    t.name.toLowerCase().includes(templateFilter.toLowerCase()) ||
    t.content.toLowerCase().includes(templateFilter.toLowerCase())
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Template navigation
    if (showTemplates) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedTemplateIdx(i => Math.min(i + 1, filteredTemplates.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedTemplateIdx(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey && filteredTemplates.length > 0) {
        e.preventDefault();
        insertTemplate(filteredTemplates[selectedTemplateIdx]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowTemplates(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextChange = (value: string) => {
    setText(value);
    // Show templates on / at start of line
    if (value === '/' || (value.startsWith('/') && !value.includes(' ') && value.length < 30)) {
      setShowTemplates(true);
      setTemplateFilter(value.slice(1));
      setSelectedTemplateIdx(0);
    } else {
      setShowTemplates(false);
    }
  };

  const insertTemplate = (template: PromptTemplate) => {
    setText(template.content);
    setShowTemplates(false);
    textareaRef.current?.focus();
  };

  const handleSend = () => {
    if ((!text.trim() && files.length === 0) || disabled) return;
    onSend(text, files);
    setText('');
    setFiles([]);
    setShowTemplates(false);
  };

  const uploadFiles = async (fileList: File[]) => {
    if (!fileList.length || !activeConversationId) return;
    setUploading(true);
    const formData = new FormData();
    fileList.forEach(f => formData.append('files', f));
    formData.append('conversation_id', activeConversationId);
    try {
      const { data } = await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFiles(prev => [...prev, ...data]);
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await uploadFiles(Array.from(e.target.files || []));
  };

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith('image/'));
    if (!imageItems.length) return;
    e.preventDefault();
    const imageFiles = imageItems
      .map(item => item.getAsFile())
      .filter((f): f is File => f !== null);
    await uploadFiles(imageFiles);
  }, [activeConversationId]);

  return (
    <div className="px-2 sm:px-4 pb-3 sm:pb-4 relative">
      {/* Prompt templates popup */}
      {showTemplates && filteredTemplates.length > 0 && (
        <div className="absolute bottom-full left-4 right-4 mb-2 bg-white dark:bg-[#1e1e2e] border border-[#d1d8e4] dark:border-[#2d2d3f] rounded-xl shadow-xl max-h-64 overflow-y-auto z-30">
          <div className="px-3 py-2 border-b border-[#e2e8f0] dark:border-[#1e1e2e] flex items-center gap-2">
            <Sparkles size={12} className="text-violet-500" />
            <span className="text-xs text-slate-400 dark:text-slate-500">Prompt templates — use arrows and Enter</span>
          </div>
          {filteredTemplates.map((tpl, idx) => (
            <button
              key={tpl.id}
              onClick={() => insertTemplate(tpl)}
              className={clsx(
                'w-full text-left px-3 py-2 text-sm transition-colors border-b border-[#e2e8f0]/50 dark:border-[#1e1e2e]/50 last:border-0',
                idx === selectedTemplateIdx
                  ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-300'
                  : 'hover:bg-[#f1f5f9] dark:hover:bg-[#1e1e2e] text-slate-600 dark:text-slate-300'
              )}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-xs">{tpl.name}</span>
                {tpl.category !== 'general' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400">{tpl.category}</span>
                )}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">{tpl.content.slice(0, 80)}...</p>
            </button>
          ))}
        </div>
      )}

      {/* File / image previews */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {files.map(f => (
            f.mimetype.startsWith('image/') && f.base64 ? (
              <div key={f.id} className="relative group/img">
                <img
                  src={`data:${f.mimetype};base64,${f.base64}`}
                  alt={f.filename}
                  className="h-20 w-20 object-cover rounded-xl border border-[#d1d8e4] dark:border-[#2d2d3f]"
                />
                <button
                  onClick={() => setFiles(prev => prev.filter(x => x.id !== f.id))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white dark:bg-[#1e1e2e] border border-[#d1d8e4] dark:border-[#2d2d3f] flex items-center justify-center text-slate-400 hover:text-red-400 opacity-0 group-hover/img:opacity-100 transition-all"
                >
                  <X size={10} />
                </button>
              </div>
            ) : (
              <div key={f.id} className="flex items-center gap-1.5 bg-[#e8ecf2] dark:bg-[#1e1e2e] border border-[#d1d8e4] dark:border-[#2d2d3f] rounded-lg px-2 py-1 text-xs text-slate-500 dark:text-slate-400">
                <FileText size={11} />
                <span className="max-w-[120px] truncate">{f.filename}</span>
                <button onClick={() => setFiles(prev => prev.filter(x => x.id !== f.id))} className="hover:text-red-400 transition-colors">
                  <X size={10} />
                </button>
              </div>
            )
          ))}
        </div>
      )}

      <div className={clsx(
        'flex items-end gap-2 bg-[#f1f5f9] dark:bg-[#1a1a2e] border rounded-2xl px-3 py-2 transition-all',
        disabled ? 'border-[#e2e8f0] dark:border-[#1e1e2e] opacity-75' : 'border-[#d1d8e4] dark:border-[#2d2d3f] focus-within:border-violet-500'
      )}>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-violet-500 dark:hover:text-violet-400 transition-colors shrink-0 mb-0.5"
          title={t('uploadFile')}
        >
          <Paperclip size={16} className={uploading ? 'animate-pulse' : ''} />
        </button>

        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInput}
          accept="image/*,.pdf,.docx,.txt,.md,.js,.ts,.py,.json,.csv,.xml,.html,.css" />

        {voice.supported && (
          <button
            onClick={voice.toggleListening}
            disabled={disabled}
            className={clsx(
              'p-1.5 transition-all shrink-0 mb-0.5 rounded-lg',
              voice.isListening
                ? 'text-red-500 bg-red-500/10 animate-pulse'
                : 'text-slate-400 dark:text-slate-500 hover:text-violet-500 dark:hover:text-violet-400'
            )}
            title={voice.isListening ? 'Stop recording' : 'Voice input'}
          >
            {voice.isListening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        )}

        <TextareaAutosize
          ref={textareaRef}
          value={text}
          onChange={e => handleTextChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={uploading ? 'Загрузка...' : `${t('typeMessage')} (/ for templates)`}
          disabled={disabled}
          minRows={1}
          maxRows={8}
          className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 resize-none outline-none py-1 leading-relaxed"
        />

        <button
          onClick={handleSend}
          disabled={(!text.trim() && files.length === 0) || disabled}
          className={clsx(
            'p-1.5 rounded-xl transition-all shrink-0 mb-0.5',
            (text.trim() || files.length > 0) && !disabled
              ? 'bg-violet-600 text-white hover:bg-violet-700'
              : 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
          )}
        >
          <Send size={15} />
        </button>
      </div>
      <p className="text-center text-xs text-slate-400 dark:text-slate-700 mt-1 hidden sm:block">Enter -- send / Shift+Enter -- new line / Ctrl+V -- paste / type / for templates</p>
    </div>
  );
}
