import { useEffect, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Bot } from 'lucide-react';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import SettingsModal from './components/SettingsModal';
import SearchModal from './components/SearchModal';
import AuthScreen from './components/AuthScreen';
import useAppStore from './store/appStore';
import useAuthStore from './store/authStore';
import './store/themeStore'; // ensure theme is initialized

export default function App() {
  const { user, restoreSession } = useAuthStore();
  const [sessionChecked, setSessionChecked] = useState(false);

  const {
    loadConversations, loadModels, loadApiKeyStatus,
    sidebarOpen, setSidebarOpen,
    settingsOpen, setSettingsOpen,
    searchOpen, setSearchOpen,
    createConversation
  } = useAppStore();

  useEffect(() => {
    restoreSession().finally(() => setSessionChecked(true));
  }, []);

  useEffect(() => {
    if (user) {
      loadConversations();
      loadModels();
      loadApiKeyStatus();
    }
  }, [user]);

  useHotkeys('ctrl+n,meta+n', (e) => { e.preventDefault(); createConversation(); }, []);
  useHotkeys('ctrl+k,meta+k', (e) => { e.preventDefault(); setSearchOpen(true); }, []);
  useHotkeys('ctrl+comma,meta+comma', (e) => { e.preventDefault(); setSettingsOpen(true); }, []);
  useHotkeys('ctrl+b,meta+b', (e) => { e.preventDefault(); setSidebarOpen(!sidebarOpen); }, [sidebarOpen]);
  useHotkeys('escape', () => { setSearchOpen(false); setSettingsOpen(false); }, []);

  if (!sessionChecked) {
    return (
      <div className="min-h-screen bg-[#f8f9fc] dark:bg-[#0d0d1a] flex items-center justify-center transition-colors">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-800 flex items-center justify-center">
            <img src="/logo_w.png" alt="" className="w-6 h-6" />
          </div>
          <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  return (
    <div className="flex h-screen bg-[#f8f9fc] dark:bg-[#0d0d1a] text-slate-800 dark:text-slate-100 overflow-hidden transition-colors">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <ChatWindow />
      </main>
      {settingsOpen && <SettingsModal />}
      {searchOpen && <SearchModal />}
    </div>
  );
}
