import { useState, useEffect, memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Settings, MessageSquare, Pin, Trash2,
  PencilLine, ChevronLeft, ChevronRight, LogOut, Crown,
  FolderOpen, FolderPlus, Download, ChevronDown, ChevronUp, X, Share2
} from 'lucide-react';
import useAppStore from '../store/appStore';
import useAuthStore from '../store/authStore';
import AdminPanel from './AdminPanel';
import ProfileModal from './ProfileModal';
import ShareDialog from './ShareDialog';
import PaymentModal from './PaymentModal';
import { Conversation, Folder } from '../types';
import api from '../services/api';
import clsx from 'clsx';

export default function Sidebar() {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const [adminOpen, setAdminOpen] = useState(false);
  const {
    conversations, activeConversationId, sidebarOpen, folders,
    createConversation, selectConversation, deleteConversation, updateConversation,
    setSidebarOpen, setSettingsOpen, setSearchOpen,
    loadFolders, createFolder, deleteFolder
  } = useAppStore();

  const [profileOpen, setProfileOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [shareConv, setShareConv] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    loadFolders();
  }, []);

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

  const handleCreateFolder = async () => {
    if (newFolderName.trim()) {
      await createFolder(newFolderName.trim());
      setNewFolderName('');
      setShowNewFolder(false);
    }
  };

  const toggleFolderCollapse = (folderId: string) => {
    setCollapsedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const handleExport = async (convId: string, format: 'md' | 'json' | 'txt') => {
    setExportingId(null);
    try {
      const response = await api.get(`/conversations/${convId}/export`, {
        params: { format },
        responseType: 'blob'
      });
      const blob = new Blob([response.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const conv = conversations.find(c => c.id === convId);
      a.download = `${conv?.title || 'chat'}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  const moveToFolder = async (convId: string, folderId: string | null) => {
    await updateConversation(convId, { folder_id: folderId } as Partial<Conversation>);
  };

  const pinned = conversations.filter(c => c.is_pinned);
  const unfolderedUnpinned = conversations.filter(c => !c.is_pinned && !c.folder_id);
  const folderConvs = (folderId: string) => conversations.filter(c => c.folder_id === folderId && !c.is_pinned);

  const sidebarContent = (
    <motion.aside
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 280, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col bg-white dark:bg-[#111122] border-r border-[#e2e8f0] dark:border-[#1e1e2e] overflow-hidden shrink-0 transition-colors h-full"
    >
      {/* Header */}
      <div className="p-3 border-b border-[#e2e8f0] dark:border-[#1e1e2e]">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-purple-800 flex items-center justify-center">
            <img src="/logo_w.png" alt="" className="w-4 h-4" />
          </div>
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">UspAIChat</span>
          {/* Mobile close */}
          <button onClick={() => setSidebarOpen(false)} className="ml-auto md:hidden p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X size={16} />
          </button>
        </div>
        <button
          onClick={() => createConversation()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
        >
          <Plus size={15} />
          {t('newChat')}
          <span className="ml-auto text-xs opacity-60 hidden sm:inline">Ctrl+N</span>
        </button>
      </div>

      {/* Search button */}
      <button
        onClick={() => setSearchOpen(true)}
        className="mx-3 mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#f1f5f9] dark:bg-[#1e1e2e] hover:bg-[#e2e8f0] dark:hover:bg-[#2d2d3f] text-slate-500 dark:text-slate-400 text-sm transition-colors"
      >
        <Search size={14} />
        <span className="flex-1 text-left">{t('search')}</span>
        <span className="text-xs opacity-50 hidden sm:inline">Ctrl+K</span>
      </button>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-slate-400 dark:text-slate-500 text-sm">
            <MessageSquare size={24} className="mb-2 opacity-40" />
            <p>{t('noConversations')}</p>
          </div>
        )}

        {/* Pinned */}
        {pinned.length > 0 && (
          <div className="mb-1">
            <p className="px-2 py-1 text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider">Pinned</p>
            {pinned.map(conv => (
              <ConvItem key={conv.id} conv={conv} active={conv.id === activeConversationId}
                hovered={hoveredId === conv.id} editingId={editingId} editTitle={editTitle}
                exportingId={exportingId}
                onSelect={() => { selectConversation(conv.id); if (window.innerWidth < 768) setSidebarOpen(false); }}
                onHover={setHoveredId}
                onRename={() => handleRename(conv)}
                onDelete={() => deleteConversation(conv.id)}
                onPin={() => updateConversation(conv.id, { is_pinned: conv.is_pinned ? 0 : 1 } as never)}
                onEditTitle={setEditTitle}
                onSubmitRename={() => submitRename(conv.id)}
                onExportClick={() => setExportingId(exportingId === conv.id ? null : conv.id)}
                onExport={(fmt) => handleExport(conv.id, fmt)}
                onShare={() => setShareConv({ id: conv.id, title: conv.title })}
                folders={folders}
                onMoveToFolder={(fid) => moveToFolder(conv.id, fid)}
              />
            ))}
          </div>
        )}

        {/* Folders */}
        {folders.map(folder => {
          const fConvs = folderConvs(folder.id);
          const collapsed = collapsedFolders.has(folder.id);
          return (
            <div key={folder.id} className="mb-1">
              <div className="flex items-center gap-1 px-2 py-1 group/folder">
                <button onClick={() => toggleFolderCollapse(folder.id)} className="flex items-center gap-1 flex-1 text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                  <FolderOpen size={12} style={{ color: folder.color }} />
                  <span className="truncate">{folder.name}</span>
                  <span className="text-[10px] opacity-50">({fConvs.length})</span>
                  {collapsed ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
                </button>
                <button
                  onClick={() => deleteFolder(folder.id)}
                  className="opacity-0 group-hover/folder:opacity-100 p-0.5 text-slate-400 hover:text-red-400 transition-all"
                  title="Delete folder"
                >
                  <Trash2 size={10} />
                </button>
              </div>
              {!collapsed && fConvs.map(conv => (
                <ConvItem key={conv.id} conv={conv} active={conv.id === activeConversationId}
                  hovered={hoveredId === conv.id} editingId={editingId} editTitle={editTitle}
                  exportingId={exportingId}
                  onSelect={() => { selectConversation(conv.id); if (window.innerWidth < 768) setSidebarOpen(false); }}
                  onHover={setHoveredId}
                  onRename={() => handleRename(conv)}
                  onDelete={() => deleteConversation(conv.id)}
                  onPin={() => updateConversation(conv.id, { is_pinned: conv.is_pinned ? 0 : 1 } as never)}
                  onEditTitle={setEditTitle}
                  onSubmitRename={() => submitRename(conv.id)}
                  onExportClick={() => setExportingId(exportingId === conv.id ? null : conv.id)}
                  onExport={(fmt) => handleExport(conv.id, fmt)}
                  onShare={() => setShareConv({ id: conv.id, title: conv.title })}
                  folders={folders}
                  onMoveToFolder={(fid) => moveToFolder(conv.id, fid)}
                />
              ))}
            </div>
          );
        })}

        {/* Unfolderd conversations */}
        {unfolderedUnpinned.map(conv => (
          <ConvItem key={conv.id} conv={conv} active={conv.id === activeConversationId}
            hovered={hoveredId === conv.id} editingId={editingId} editTitle={editTitle}
            exportingId={exportingId}
            onSelect={() => { selectConversation(conv.id); if (window.innerWidth < 768) setSidebarOpen(false); }}
            onHover={setHoveredId}
            onRename={() => handleRename(conv)}
            onDelete={() => deleteConversation(conv.id)}
            onPin={() => updateConversation(conv.id, { is_pinned: conv.is_pinned ? 0 : 1 } as never)}
            onEditTitle={setEditTitle}
            onSubmitRename={() => submitRename(conv.id)}
            onExportClick={() => setExportingId(exportingId === conv.id ? null : conv.id)}
            onExport={(fmt) => handleExport(conv.id, fmt)}
            onShare={() => setShareConv({ id: conv.id, title: conv.title })}
            folders={folders}
            onMoveToFolder={(fid) => moveToFolder(conv.id, fid)}
          />
        ))}

        {/* New folder button */}
        <div className="mt-2 px-1">
          {showNewFolder ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowNewFolder(false); }}
                placeholder="Folder name..."
                className="flex-1 bg-[#f1f5f9] dark:bg-[#1e1e2e] border border-violet-500 rounded px-2 py-1 text-xs text-slate-800 dark:text-slate-100 outline-none"
              />
              <button onClick={handleCreateFolder} className="p-1 text-violet-500 hover:text-violet-400">
                <Plus size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewFolder(true)}
              className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-slate-400 dark:text-slate-500 hover:text-violet-500 dark:hover:text-violet-400 transition-colors"
            >
              <FolderPlus size={12} />
              New folder
            </button>
          )}
        </div>
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
          <span className="ml-auto text-xs opacity-50 hidden sm:inline">Ctrl+,</span>
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
              <div className="flex items-center gap-1">
                <p className={`text-[10px] font-mono ${(user?.balance ?? 0) < 1 ? 'text-red-400' : 'text-green-500 dark:text-green-400'}`}>
                  {(user?.balance ?? 0).toFixed(2)} кр.
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); setPaymentOpen(true); }}
                  className="text-[9px] px-1.5 py-0 rounded bg-violet-600 hover:bg-violet-700 text-white transition-colors leading-4"
                  title="Пополнить"
                >+</button>
              </div>
            )}
          </div>
          <button onClick={() => logout()} title="Выйти"
            className="text-slate-400 dark:text-slate-600 hover:text-red-400 transition-colors shrink-0">
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </motion.aside>
  );

  return (
    <>
      {/* Desktop: collapse toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="hidden md:block absolute top-1/2 -translate-y-1/2 z-50 bg-[#e8ecf2] dark:bg-[#1e1e2e] border border-[#d1d8e4] dark:border-[#2d2d3f] rounded-r-lg p-1 hover:bg-[#d1d8e4] dark:hover:bg-[#2d2d3f] transition-all text-slate-500 dark:text-slate-400"
        style={{ left: sidebarOpen ? '280px' : '0px' }}
      >
        {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>

      {/* Desktop sidebar */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <div className="hidden md:flex">
            {sidebarContent}
          </div>
        )}
      </AnimatePresence>

      {/* Mobile drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="md:hidden fixed left-0 top-0 bottom-0 z-50 w-[280px]"
            >
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} currentUserId={user?.id || ''} />}
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
      {paymentOpen && <PaymentModal onClose={() => setPaymentOpen(false)} />}
      {shareConv && <ShareDialog conversationId={shareConv.id} conversationTitle={shareConv.title} onClose={() => setShareConv(null)} />}
    </>
  );
}

const ConvItem = memo(function ConvItem({ conv, active, hovered, editingId, editTitle, exportingId, onSelect, onHover, onRename, onDelete, onPin, onEditTitle, onSubmitRename, onExportClick, onExport, onShare, folders, onMoveToFolder }: {
  conv: Conversation;
  active: boolean;
  hovered: boolean;
  editingId: string | null;
  editTitle: string;
  exportingId: string | null;
  onSelect: () => void;
  onHover: (id: string | null) => void;
  onRename: () => void;
  onDelete: () => void;
  onPin: () => void;
  onEditTitle: (v: string) => void;
  onSubmitRename: () => void;
  onExportClick: () => void;
  onExport: (format: 'md' | 'json' | 'txt') => void;
  onShare: () => void;
  folders: Folder[];
  onMoveToFolder: (folderId: string | null) => void;
}) {
  const isEditing = editingId === conv.id;
  const isExporting = exportingId === conv.id;

  return (
    <div className="relative">
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
            <button onClick={onExportClick} className="p-1 hover:text-violet-500 dark:hover:text-violet-400 rounded transition-colors" title="Export">
              <Download size={11} />
            </button>
            <button onClick={onShare} className="p-1 hover:text-violet-500 dark:hover:text-violet-400 rounded transition-colors" title="Share">
              <Share2 size={11} />
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

      {/* Export / Move dropdown */}
      {isExporting && (
        <div className="absolute right-2 top-full z-50 bg-white dark:bg-[#1e1e2e] border border-[#d1d8e4] dark:border-[#2d2d3f] rounded-lg shadow-xl overflow-hidden min-w-[140px]" onClick={e => e.stopPropagation()}>
          <p className="px-3 py-1.5 text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Export as</p>
          <button onClick={() => onExport('md')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#f1f5f9] dark:hover:bg-[#2d2d3f] text-slate-600 dark:text-slate-300 transition-colors">Markdown</button>
          <button onClick={() => onExport('json')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#f1f5f9] dark:hover:bg-[#2d2d3f] text-slate-600 dark:text-slate-300 transition-colors">JSON</button>
          <button onClick={() => onExport('txt')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#f1f5f9] dark:hover:bg-[#2d2d3f] text-slate-600 dark:text-slate-300 transition-colors">Text</button>
          {folders.length > 0 && (
            <>
              <div className="border-t border-[#e2e8f0] dark:border-[#2d2d3f] my-1" />
              <p className="px-3 py-1.5 text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Move to folder</p>
              {conv.folder_id && (
                <button onClick={() => { onMoveToFolder(null); onExportClick(); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#f1f5f9] dark:hover:bg-[#2d2d3f] text-slate-500 dark:text-slate-400 transition-colors italic">
                  Remove from folder
                </button>
              )}
              {folders.map(f => (
                <button key={f.id} onClick={() => { onMoveToFolder(f.id); onExportClick(); }}
                  className={clsx('w-full text-left px-3 py-1.5 text-xs hover:bg-[#f1f5f9] dark:hover:bg-[#2d2d3f] transition-colors flex items-center gap-1.5',
                    conv.folder_id === f.id ? 'text-violet-500' : 'text-slate-600 dark:text-slate-300')}>
                  <FolderOpen size={10} style={{ color: f.color }} />
                  {f.name}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
});
