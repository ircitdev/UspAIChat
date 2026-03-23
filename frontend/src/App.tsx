import { useEffect, useState, lazy, Suspense } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import AuthScreen from './components/AuthScreen';
import useAppStore from './store/appStore';
import useAuthStore from './store/authStore';
import './store/themeStore'; // ensure theme is initialized

const SettingsModal = lazy(() => import('./components/SettingsModal'));
const SearchModal = lazy(() => import('./components/SearchModal'));
const SharedView = lazy(() => import('./components/SharedView'));
const DocumentationModal = lazy(() => import('./components/DocumentationModal'));

export default function App() {
  const { user, restoreSession } = useAuthStore();
  const [sessionChecked, setSessionChecked] = useState(false);

  const {
    loadConversations, loadModels, loadApiKeyStatus, loadFolders, loadPromptTemplates,
    sidebarOpen, setSidebarOpen,
    settingsOpen, setSettingsOpen,
    searchOpen, setSearchOpen,
    docsOpen, setDocsOpen,
    createConversation
  } = useAppStore();

  // Check if this is a shared link
  const shareMatch = window.location.pathname.match(/^\/shared\/([a-zA-Z0-9]+)$/);
  const isPaymentReturn = window.location.pathname === '/payment-success';

  // Store referral code from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      localStorage.setItem('referral_code', ref);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!shareMatch) {
      restoreSession().finally(() => setSessionChecked(true));
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadConversations();
      loadModels();
      loadApiKeyStatus();
      loadFolders();
      loadPromptTemplates();
    }
  }, [user]);

  useHotkeys('ctrl+n,meta+n', (e) => { e.preventDefault(); createConversation(); }, []);
  useHotkeys('ctrl+k,meta+k', (e) => { e.preventDefault(); setSearchOpen(true); }, []);
  useHotkeys('ctrl+comma,meta+comma', (e) => { e.preventDefault(); setSettingsOpen(true); }, []);
  useHotkeys('ctrl+b,meta+b', (e) => { e.preventDefault(); setSidebarOpen(!sidebarOpen); }, [sidebarOpen]);
  useHotkeys('escape', () => { setSearchOpen(false); setSettingsOpen(false); setDocsOpen(false); }, []);

  // Render shared view for public links
  if (shareMatch) {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-[#f8f9fc] dark:bg-[#0d0d1a] flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <SharedView shareId={shareMatch[1]} />
      </Suspense>
    );
  }

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

  // Payment return — redirect to main page with success message
  if (isPaymentReturn && user) {
    window.history.replaceState({}, '', '/');
    // Balance will auto-update via /auth/me
    restoreSession();
  }

  if (!user) return <AuthScreen />;

  return (
    <div className="flex h-screen bg-[#f8f9fc] dark:bg-[#0d0d1a] text-slate-800 dark:text-slate-100 overflow-hidden transition-colors">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <ChatWindow />
      </main>
      <Suspense fallback={null}>
        {settingsOpen && <SettingsModal />}
        {searchOpen && <SearchModal />}
        {docsOpen && <DocumentationModal />}
      </Suspense>
    </div>
  );
}
