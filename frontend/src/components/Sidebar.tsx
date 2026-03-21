import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Settings, MessageSquare, Pin, Trash2,
  PencilLine, ChevronLeft, ChevronRight, Bot, LogOut, Crown
} from 'lucide-react';
import { format } from 'date-fns';
import useAppStore from '../store/appStore';
import useAuthStore from '../store/authStore';
import AdminPanel from './AdminPanel';
import ProfileModal from './ProfileModal';
import { Conversation } from '../types';
import clsx from 'clsx';

export default function Sidebar() {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const [adminOpen, setAdminOpen] = useState(false);
  const {
    conversations, activeConversationId, sidebarOpen,
    createConversation, selectConversation, deleteConversation, updateConversation,
    setSidebarOpen, setSettingsOpen, setSearchOpen
  } = useAppStore();

  const [profileOpen, setProfileOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleRename = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const submitRename = async (id: string) => {
    if (editTitle.trim()) {
      await updateConversation(id, { title: editTitle.trim() });
    }
    setEditingId(null);
  };

  const pinned = conversations.filter(c => c.is_pinned);
  const unpinned = conversations.filter(c => !c.is_pinned);

  return (
    <>
      {/* Collapse toggle button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute top-1/2 -translate-y-1/2 z-50 bg-[#e8ecf2] dark:bg-[#1e1e2e] border border-[#d1d8e4] dark:border-[#2d2d3f] rounded-r-lg p-1 hover:bg-[#d1d8e4] dark:hover:bg-[#2d2d3f] transition-all text-slate-500 dark:text-slate-400"
        style={{ left: sidebarOpen ? '260px' : '0px' }}
      >
        {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>

      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col bg-white dark:bg-[#111122] border-r border-[#e2e8f0] dark:border-[#1e1e2e] overflow-hidden shrink-0 transition-colors"
          >
            {/* Header */}
            <div className="p-3 border-b border-[#e2e8f0] dark:border-[#1e1e2e]">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-purple-800 flex items-center justify-center">
                  <img src="/logo_w.png" alt="" className="w-4 h-4" />
                </div>
                <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">UspAIChat</span>
              </div>
              <button
                onClick={() => createConversation()}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
              >
                <Plus size={15} />
                {t('newChat')}
                <span className="ml-auto text-xs opacity-60">Ctrl+N</span>
              </button>
            </div>

            {/* Search button */}
            <button
              onClick={() => setSearchOpen(true)}
              className="mx-3 mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#f1f5f9] dark:bg-[#1e1e2e] hover:bg-[#e2e8f0] dark:hover:bg-[#2d2d3f] text-slate-500 dark:text-slate-400 text-sm transition-colors"
            >
              <Search size={14} />
              <span className="flex-1 text-left">{t('search')}</span>
              <span className="text-xs opacity-50">Ctrl+K</span>
            </button>

            {/* Conversations list */}
            <div className="flex-1 overflow-y-auto py-2 px-2">
              {conversations.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 text-slate-400 dark:text-slate-500 text-sm">
                  <MessageSquare size={24} className="mb-2 opacity-40" />
                  <p>{t('noConversations')}</p>
                </div>
              )}

              {pinned.length > 0 && (
                <div className="mb-1">
                  <p className="px-2 py-1 text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider">Pinned</p>
                  {pinned.map(conv => (
                    <ConvItem key={conv.id} conv={conv} active={conv.id === activeConversationId}
                      hovered={hoveredId === conv.id} editingId={editingId} editTitle={editTitle}
                      onSelect={() => selectConversation(conv.id)}
                      onHover={setHoveredId}
                      onRename={() => handleRename(conv)}
                      onDelete={() => deleteConversation(conv.id)}
                      onPin={() => updateConversation(conv.id, { is_pinned: conv.is_pinned ? 0 : 1 } as never)}
                      onEditTitle={setEditTitle}
                      onSubmitRename={() => submitRename(conv.id)}
                    />
                  ))}
                </div>
              )}

              {unpinned.map(conv => (
                <ConvItem key={conv.id} conv={conv} active={conv.id === activeConversationId}
                  hovered={hoveredId === conv.id} editingId={editingId} editTitle={editTitle}
                  onSelect={() => selectConversation(conv.id)}
                  onHover={setHoveredId}
                  onRename={() => handleRename(conv)}
                  onDelete={() => deleteConversation(conv.id)}
                  onPin={() => updateConversation(conv.id, { is_pinned: conv.is_pinned ? 0 : 1 } as never)}
                  onEditTitle={setEditTitle}
                  onSubmitRename={() => submitRename(conv.id)}
                />
              ))}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-[#e2e8f0] dark:border-[#1e1e2e] space-y-1">
              {user?.role === 'admin' && (
                <button
                  onClick={() => setAdminOpen(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 text-sm transition-colors"
                >
                  <Crown size={15} />
                  Панель администратора
                </button>
              )}
              <button
                onClick={() => setSettingsOpen(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#f1f5f9] dark:hover:bg-[#1e1e2e] text-slate-500 dark:text-slate-400 text-sm transition-colors"
              >
                <Settings size={15} />
                {t('settings')}
                <span className="ml-auto text-xs opacity-50">Ctrl+,</span>
              </button>
              {/* User info + balance + logout */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#f1f5f9] dark:bg-[#0d0d1a]">
                <button onClick={() => setProfileOpen(true)} title="Профиль"
                  className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white text-xs font-bold shrink-0 hover:ring-2 hover:ring-violet-400 transition-all">
                  {user?.username?.[0]?.toUpperCase() || '?'}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-600 dark:text-slate-300 truncate font-medium">{user?.username}</p>
                  {user?.role === 'admin' ? (
                    <p className="text-[10px] text-yellow-600 dark:text-yellow-500">&#8734; Admin</p>
                  ) : (
                    <p className={`text-[10px] font-mono ${(user?.balance ?? 0) < 1 ? 'text-red-400' : 'text-green-500 dark:text-green-400'}`}>
                      {(user?.balance ?? 0).toFixed(2)} кр.
                    </p>
                  )}
                </div>
                <button onClick={() => logout()} title="Выйти"
                  className="text-slate-400 dark:text-slate-600 hover:text-red-400 transition-colors shrink-0">
                  <LogOut size={13} />
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
      {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} currentUserId={user?.id || ''} />}
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </>
  );
}

function ConvItem({ conv, active, hovered, editingId, editTitle, onSelect, onHover, onRename, onDelete, onPin, onEditTitle, onSubmitRename }: {
  conv: Conversation;
  active: boolean;
  hovered: boolean;
  editingId: string | null;
  editTitle: string;
  onSelect: () => void;
  onHover: (id: string | null) => void;
  onRename: () => void;
  onDelete: () => void;
  onPin: () => void;
  onEditTitle: (v: string) => void;
  onSubmitRename: () => void;
}) {
  const isEditing = editingId === conv.id;

  return (
    <div
      className={clsx(
        'group relative flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer text-sm transition-colors mb-0.5',
        active ? 'bg-[#e8ecf2] dark:bg-[#2d2d3f] text-slate-800 dark:text-slate-100' : 'hover:bg-[#f1f5f9] dark:hover:bg-[#1e1e2e] text-slate-500 dark:text-slate-400'
      )}
      onClick={() => !isEditing && onSelect()}
      onMouseEnter={() => onHover(conv.id)}
      onMouseLeave={() => onHover(null)}
    >
      <MessageSquare size={14} className={clsx('shrink-0', active ? 'text-violet-500 dark:text-violet-400' : 'text-slate-400 dark:text-slate-500')} />

      {isEditing ? (
        <input
          autoFocus
          value={editTitle}
          onChange={e => onEditTitle(e.target.value)}
          onBlur={onSubmitRename}
          onKeyDown={e => {
            if (e.key === 'Enter') onSubmitRename();
            if (e.key === 'Escape') onSubmitRename();
            e.stopPropagation();
          }}
          className="flex-1 bg-white dark:bg-[#0d0d1a] border border-violet-500 rounded px-1 text-sm text-slate-800 dark:text-slate-100 outline-none"
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span className="flex-1 truncate">{conv.title}</span>
      )}

      {(hovered || active) && !isEditing && (
        <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
          <button onClick={onPin} className="p-1 hover:text-violet-500 dark:hover:text-violet-400 rounded transition-colors" title="Pin">
            <Pin size={11} className={conv.is_pinned ? 'text-violet-500 dark:text-violet-400' : ''} />
          </button>
          <button onClick={onRename} className="p-1 hover:text-slate-700 dark:hover:text-slate-200 rounded transition-colors">
            <PencilLine size={11} />
          </button>
          <button onClick={onDelete} className="p-1 hover:text-red-400 rounded transition-colors">
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </div>
  );
}
