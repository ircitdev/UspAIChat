import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Mail, Lock, Eye, EyeOff, Loader2, RefreshCw, Copy, Check, ChevronDown } from 'lucide-react';
import useAuthStore from '../store/authStore';
import api from '../services/api';
import clsx from 'clsx';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void; auto_select?: boolean }) => void;
          renderButton: (element: HTMLElement, config: { theme?: string; size?: string; width?: number; shape?: string; text?: string; locale?: string }) => void;
        };
      };
    };
    AppleID?: {
      auth: {
        init: (config: { clientId: string; scope: string; redirectURI: string; usePopup: boolean }) => void;
        signIn: () => Promise<{ authorization: { id_token: string }; user?: { name?: { firstName?: string; lastName?: string }; email?: string } }>;
      };
    };
  }
}

function GoogleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function AppleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
    </svg>
  );
}

function TelegramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.48 14.364l-2.95-.924c-.641-.203-.654-.641.136-.953l11.526-4.443c.537-.194 1.006.131.37.204z"/>
    </svg>
  );
}

interface TelegramState {
  code: string;
  botUsername: string;
  expiresAt: number;
}

export default function AuthScreen() {
  const { login, loginWithGoogle, loginWithApple, loading, error, clearError } = useAuthStore();
  const [mode, setMode] = useState<'main' | 'email' | 'telegram'>('main');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null);

  // Google
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [appleClientId, setAppleClientId] = useState<string | null>(null);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // Telegram
  const [tgState, setTgState] = useState<TelegramState | null>(null);
  const [tgStatus, setTgStatus] = useState<'idle' | 'waiting' | 'confirmed' | 'expired'>('idle');
  const [tgError, setTgError] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  useEffect(() => () => stopPolling(), []);

  // Fetch OAuth client IDs from backend
  useEffect(() => {
    api.get('/auth/oauth/config').then(({ data }) => {
      if (data.google_client_id) setGoogleClientId(data.google_client_id);
      if (data.apple_client_id) setAppleClientId(data.apple_client_id);
    }).catch(() => {});
  }, []);

  // Initialize Google Sign-In when SDK loads and clientId is available
  const initGoogleBtn = useCallback(() => {
    if (!window.google || !googleClientId || !googleBtnRef.current) return;
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: async (response) => {
        setOauthLoading('google');
        clearError();
        try {
          await loginWithGoogle(response.credential);
        } catch {} finally {
          setOauthLoading(null);
        }
      },
    });
    // Clear any previous rendered button
    googleBtnRef.current.innerHTML = '';
    window.google.accounts.id.renderButton(googleBtnRef.current, {
      theme: 'filled_black',
      size: 'large',
      width: 340,
      shape: 'pill',
      text: 'continue_with',
      locale: 'ru',
    });
  }, [googleClientId, loginWithGoogle, clearError]);

  useEffect(() => {
    if (mode !== 'main') return;
    // Try immediately; also set up an interval check in case SDK loads late
    initGoogleBtn();
    const check = setInterval(() => {
      if (window.google) { initGoogleBtn(); clearInterval(check); }
    }, 300);
    return () => clearInterval(check);
  }, [mode, initGoogleBtn]);

  // Apple Sign-In handler
  const handleAppleSignIn = async () => {
    if (!window.AppleID || !appleClientId) return;
    setOauthLoading('apple');
    clearError();
    try {
      window.AppleID.auth.init({
        clientId: appleClientId,
        scope: 'name email',
        redirectURI: window.location.origin,
        usePopup: true,
      });
      const res = await window.AppleID.auth.signIn();
      await loginWithApple(res.authorization.id_token, res.user);
    } catch {
      // User cancelled or error
    } finally {
      setOauthLoading(null);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await login(email, password);
    } catch {}
  };

  const initTelegram = async () => {
    setTgError('');
    setTgStatus('idle');
    stopPolling();
    try {
      const { data } = await api.post('/auth/telegram/init');
      const expiresAt = Date.now() + data.expires_in * 1000;
      setTgState({ code: data.code, botUsername: data.bot_username, expiresAt });
      setTgStatus('waiting');
      setTimeLeft(data.expires_in);
      setMode('telegram');

      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
          return prev - 1;
        });
      }, 1000);

      pollRef.current = setInterval(async () => {
        try {
          const { data: poll } = await api.get(`/auth/telegram/poll/${data.code}`);
          if (poll.status === 'confirmed') {
            stopPolling();
            setTgStatus('confirmed');
            const { default: apiInstance } = await import('../services/api');
            apiInstance.defaults.headers.common['Authorization'] = `Bearer ${poll.accessToken}`;
            localStorage.setItem('refreshToken', poll.refreshToken);
            useAuthStore.getState().updateBalance(poll.user.balance);
            useAuthStore.setState({ user: poll.user, accessToken: poll.accessToken });
          } else if (poll.status === 'expired' || poll.status === 'not_found') {
            stopPolling();
            setTgStatus('expired');
            setTgError('Kod expired. Request new one.');
          }
        } catch {}
      }, 2000);
    } catch {
      setTgError('Could not connect to bot. Try later.');
    }
  };

  const copyCode = () => {
    if (tgState) {
      navigator.clipboard.writeText(tgState.code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const goBack = () => {
    setMode('main');
    stopPolling();
    setTgStatus('idle');
    clearError();
  };

  return (
    <div className="min-h-screen bg-[#f8f9fc] dark:bg-[#0d0d1a] flex items-center justify-center px-4 transition-colors">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-800 flex items-center justify-center mb-3 shadow-lg shadow-violet-900/40">
            <img src="/logo_w.png" alt="" className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">UspAIChat</h1>
          <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
            {mode === 'telegram' ? 'Войти через Telegram' : mode === 'email' ? 'Войти по email' : 'Добро пожаловать!'}
          </p>
        </div>

        <div className="bg-white dark:bg-[#111122] border border-[#d1d8e4] dark:border-[#2d2d3f] rounded-2xl p-6 shadow-2xl dark:shadow-2xl shadow-slate-200/50 transition-colors">

          {/* -- MAIN: OAuth buttons -- */}
          {mode === 'main' && (
            <div className="space-y-3">
              {/* Google Sign-In (rendered by Google SDK) */}
              {googleClientId && (
                <div ref={googleBtnRef} className="flex justify-center [&>div]:!w-full" />
              )}

              {/* Apple Sign-In */}
              {appleClientId && (
                <button onClick={handleAppleSignIn}
                  disabled={oauthLoading === 'apple'}
                  className="w-full py-2.5 rounded-full bg-black dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-black text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                  {oauthLoading === 'apple' ? <Loader2 size={15} className="animate-spin" /> : <AppleIcon size={17} />}
                  Продолжить с Apple
                </button>
              )}

              {/* Telegram */}
              <button onClick={initTelegram}
                className="w-full py-2.5 rounded-full bg-[#2AABEE] hover:bg-[#229ED9] text-white text-sm font-semibold transition-all flex items-center justify-center gap-2">
                <TelegramIcon size={17} />
                Продолжить с Telegram
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 pt-1">
                <div className="flex-1 h-px bg-[#e2e8f0] dark:bg-[#2d2d3f]" />
                <span className="text-xs text-slate-400 dark:text-slate-600">или</span>
                <div className="flex-1 h-px bg-[#e2e8f0] dark:bg-[#2d2d3f]" />
              </div>

              {/* Email login link */}
              <button onClick={() => { setMode('email'); clearError(); }}
                className="w-full py-2.5 rounded-full bg-[#e8ecf2] dark:bg-[#1e1e2e] hover:bg-[#d1d8e4] dark:hover:bg-[#2d2d3f] border border-[#d1d8e4] dark:border-[#2d2d3f] text-slate-600 dark:text-slate-300 text-sm font-medium transition-all flex items-center justify-center gap-2">
                <Mail size={15} />
                Войти по email и паролю
              </button>

              <AnimatePresence>
                {error && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* -- EMAIL LOGIN FORM -- */}
          {mode === 'email' && (
            <div className="space-y-3">
              <button onClick={goBack}
                className="text-xs text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 mb-2">
                &larr; Назад
              </button>

              <form onSubmit={handleEmailLogin} className="space-y-3">
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required
                    className="w-full bg-[#f1f5f9] dark:bg-[#1e1e2e] border border-[#d1d8e4] dark:border-[#2d2d3f] rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-violet-500 transition-colors" />
                </div>

                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input type={showPassword ? 'text' : 'password'} placeholder="Пароль"
                    value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                    className="w-full bg-[#f1f5f9] dark:bg-[#1e1e2e] border border-[#d1d8e4] dark:border-[#2d2d3f] rounded-xl pl-9 pr-9 py-2.5 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-violet-500 transition-colors" />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                <button type="submit" disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2">
                  {loading && <Loader2 size={15} className="animate-spin" />}
                  Войти
                </button>
              </form>

              <p className="text-xs text-slate-400 dark:text-slate-600 text-center">
                Пароль можно задать в профиле после входа через Google или Apple
              </p>
            </div>
          )}

          {/* -- TELEGRAM FLOW -- */}
          {mode === 'telegram' && (
            <div className="space-y-4">
              <button onClick={goBack}
                className="text-xs text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1">
                &larr; Назад
              </button>

              {tgStatus === 'waiting' && tgState && (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                      Отправьте этот код боту{' '}
                      <a href={`https://t.me/${tgState.botUsername}`} target="_blank" rel="noopener noreferrer"
                        className="text-[#2AABEE] hover:underline">@{tgState.botUsername}</a>
                    </p>

                    <div className="relative inline-flex items-center gap-3 bg-[#f1f5f9] dark:bg-[#1a1a2e] border border-[#d1d8e4] dark:border-[#2d2d3f] rounded-2xl px-6 py-4">
                      <span className="text-4xl font-mono font-bold tracking-[0.3em] text-slate-800 dark:text-slate-100">
                        {tgState.code}
                      </span>
                      <button onClick={copyCode} className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                        {codeCopied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                      </button>
                    </div>

                    <p className={clsx('text-xs mt-3 font-mono', timeLeft < 60 ? 'text-red-400' : 'text-slate-400 dark:text-slate-500')}>
                      Истекает через {formatTime(timeLeft)}
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-500">
                    <div className="w-4 h-4 border-2 border-[#2AABEE] border-t-transparent rounded-full animate-spin" />
                    Ожидаю подтверждения...
                  </div>

                  <a href={`https://t.me/${tgState.botUsername}?start=${tgState.code}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#2AABEE] hover:bg-[#229ED9] text-white text-sm font-semibold transition-colors">
                    <TelegramIcon size={17} />
                    Открыть @{tgState.botUsername}
                  </a>
                </div>
              )}

              {tgStatus === 'expired' && (
                <div className="text-center space-y-3">
                  <p className="text-red-400 text-sm">{tgError}</p>
                  <button onClick={initTelegram}
                    className="flex items-center gap-2 mx-auto px-4 py-2 bg-[#e8ecf2] dark:bg-[#1e1e2e] hover:bg-[#d1d8e4] dark:hover:bg-[#2d2d3f] rounded-lg text-sm text-slate-600 dark:text-slate-300 transition-colors">
                    <RefreshCw size={14} /> Получить новый код
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-4">
          Данные синхронизируются между устройствами
        </p>
      </motion.div>
    </div>
  );
}
