import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, User, Copy, Check, RefreshCw, Lock, Eye, EyeOff, Sun, Moon, Monitor } from 'lucide-react';
import useAuthStore from '../store/authStore';
import useThemeStore from '../store/themeStore';
import api from '../services/api';
import clsx from 'clsx';

function TelegramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.48 14.364l-2.95-.924c-.641-.203-.654-.641.136-.953l11.526-4.443c.537-.194 1.006.131.37.204z"/>
    </svg>
  );
}

interface LinkState {
  code: string;
  botUsername: string;
  expiresAt: number;
}

const THEME_OPTIONS = [
  { value: 'dark' as const, label: 'Dark', icon: Moon },
  { value: 'light' as const, label: 'Light', icon: Sun },
  { value: 'system' as const, label: 'System', icon: Monitor },
];

export default function ProfileModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuthStore();
  const { mode: themeMode, setMode: setThemeMode } = useThemeStore();
  const [linkState, setLinkState] = useState<LinkState | null>(null);
  const [linkStatus, setLinkStatus] = useState<'idle' | 'waiting' | 'confirmed' | 'expired'>('idle');
  const [timeLeft, setTimeLeft] = useState(0);
  const [codeCopied, setCodeCopied] = useState(false);
  const [error, setError] = useState('');
  const [unlinking, setUnlinking] = useState(false);

  // Password section
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);

  useEffect(() => {
    api.get('/auth/me').then(({ data }) => {
      setHasPassword(!!data.user.has_password);
    }).catch(() => {});
  }, []);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  useEffect(() => () => stopPolling(), []);

  const initLink = async () => {
    setError('');
    setLinkStatus('idle');
    stopPolling();
    try {
      const { data } = await api.post('/auth/telegram/link/init');
      const expiresAt = Date.now() + data.expires_in * 1000;
      setLinkState({ code: data.code, botUsername: data.bot_username, expiresAt });
      setLinkStatus('waiting');
      setTimeLeft(data.expires_in);

      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
          return prev - 1;
        });
      }, 1000);

      pollRef.current = setInterval(async () => {
        try {
          const { data: poll } = await api.get(`/auth/telegram/link/poll/${data.code}`);
          if (poll.status === 'confirmed') {
            stopPolling();
            setLinkStatus('confirmed');
            useAuthStore.setState({ user: poll.user });
          } else if (poll.status === 'expired' || poll.status === 'not_found') {
            stopPolling();
            setLinkStatus('expired');
            setError('Code expired. Request a new one.');
          }
        } catch {}
      }, 2000);
    } catch {
      setError('Could not initiate linking. Try again later.');
    }
  };

  const handleUnlink = async () => {
    if (!confirm('Unlink Telegram from account?')) return;
    setUnlinking(true);
    try {
      await api.delete('/auth/telegram/unlink');
      useAuthStore.setState({ user: user ? { ...user, telegram_id: null, telegram_username: null } : user });
    } catch {
      setError('Error unlinking.');
    } finally {
      setUnlinking(false);
    }
  };

  const copyCode = () => {
    if (linkState) {
      navigator.clipboard.writeText(linkState.code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const isLinked = !!user?.telegram_id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm bg-white dark:bg-[#111122] border border-[#d1d8e4] dark:border-[#2d2d3f] rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] overflow-y-auto transition-colors"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2e8f0] dark:border-[#1e1e2e]">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Profile</h2>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Avatar + name */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white text-lg font-bold shrink-0">
              {user?.username?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <p className="text-slate-800 dark:text-slate-100 font-semibold">{user?.username}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{user?.role === 'admin' ? '\uD83D\uDC51 Administrator' : 'User'}</p>
            </div>
          </div>

          {/* Theme selector */}
          <div className="border border-[#d1d8e4] dark:border-[#2d2d3f] rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-[#f1f5f9] dark:bg-[#0d0d1a]">
              <Sun size={15} className="text-slate-500 dark:text-slate-400" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Theme</span>
            </div>
            <div className="px-4 py-3">
              <div className="flex gap-2">
                {THEME_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setThemeMode(opt.value)}
                    className={clsx(
                      'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all',
                      themeMode === opt.value
                        ? 'bg-violet-600 text-white shadow-md'
                        : 'bg-[#e8ecf2] dark:bg-[#1e1e2e] hover:bg-[#d1d8e4] dark:hover:bg-[#2d2d3f] text-slate-500 dark:text-slate-400'
                    )}
                  >
                    <opt.icon size={13} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Info fields */}
          <div className="space-y-2">
            {user?.email && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-[#f1f5f9] dark:bg-[#1e1e2e] rounded-xl">
                <Mail size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
                <span className="text-sm text-slate-600 dark:text-slate-300 truncate">{user.email}</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-2.5 bg-[#f1f5f9] dark:bg-[#1e1e2e] rounded-xl">
              <User size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
              <span className="text-sm text-slate-600 dark:text-slate-300">{user?.username}</span>
            </div>
          </div>

          {/* Password section */}
          <div className="border border-[#d1d8e4] dark:border-[#2d2d3f] rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-[#f1f5f9] dark:bg-[#0d0d1a]">
              <Lock size={15} className="text-slate-500 dark:text-slate-400" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Login password</span>
              <span className={clsx('ml-auto text-xs px-2 py-0.5 rounded-full',
                hasPassword ? 'bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400')}>
                {hasPassword ? 'Set' : 'Not set'}
              </span>
            </div>

            <div className="px-4 py-3 space-y-3">
              {!showPasswordSection ? (
                <button onClick={() => setShowPasswordSection(true)}
                  className="w-full py-2 rounded-lg bg-[#e8ecf2] dark:bg-[#1e1e2e] hover:bg-[#d1d8e4] dark:hover:bg-[#2d2d3f] border border-[#d1d8e4] dark:border-[#2d2d3f] text-sm text-slate-600 dark:text-slate-300 transition-colors">
                  {hasPassword ? 'Change password' : 'Set password'}
                </button>
              ) : (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  setPasswordError('');
                  setPasswordSuccess('');
                  if (newPassword.length < 6) { setPasswordError('Minimum 6 characters'); return; }
                  if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match'); return; }
                  setSavingPassword(true);
                  try {
                    await api.post('/auth/set-password', {
                      currentPassword: hasPassword ? currentPassword : undefined,
                      newPassword,
                    });
                    setPasswordSuccess('Password saved!');
                    setHasPassword(true);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setShowPasswordSection(false);
                    setTimeout(() => setPasswordSuccess(''), 3000);
                  } catch (err: unknown) {
                    const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Error';
                    setPasswordError(msg);
                  } finally {
                    setSavingPassword(false);
                  }
                }} className="space-y-2">
                  {hasPassword && (
                    <div className="relative">
                      <input type={showCurrentPw ? 'text' : 'password'} placeholder="Current password"
                        value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required
                        className="w-full bg-[#f1f5f9] dark:bg-[#1a1a2e] border border-[#d1d8e4] dark:border-[#2d2d3f] rounded-lg px-3 pr-9 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-violet-500 transition-colors" />
                      <button type="button" onClick={() => setShowCurrentPw(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                        {showCurrentPw ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  )}
                  <div className="relative">
                    <input type={showNewPw ? 'text' : 'password'} placeholder="New password"
                      value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6}
                      className="w-full bg-[#f1f5f9] dark:bg-[#1a1a2e] border border-[#d1d8e4] dark:border-[#2d2d3f] rounded-lg px-3 pr-9 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-violet-500 transition-colors" />
                    <button type="button" onClick={() => setShowNewPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                      {showNewPw ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                  <input type="password" placeholder="Confirm password"
                    value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6}
                    className="w-full bg-[#f1f5f9] dark:bg-[#1a1a2e] border border-[#d1d8e4] dark:border-[#2d2d3f] rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-violet-500 transition-colors" />

                  {passwordError && <p className="text-xs text-red-400">{passwordError}</p>}

                  <div className="flex gap-2">
                    <button type="submit" disabled={savingPassword}
                      className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                      {savingPassword ? 'Saving...' : 'Save'}
                    </button>
                    <button type="button" onClick={() => { setShowPasswordSection(false); setPasswordError(''); }}
                      className="px-3 py-2 rounded-lg bg-[#e8ecf2] dark:bg-[#1e1e2e] hover:bg-[#d1d8e4] dark:hover:bg-[#2d2d3f] text-sm text-slate-500 dark:text-slate-400 transition-colors">
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {passwordSuccess && (
                <p className="text-xs text-green-500 dark:text-green-400 text-center">{passwordSuccess}</p>
              )}
              <p className="text-xs text-slate-400 dark:text-slate-600">
                {hasPassword ? 'You can log in with email and password' : 'Set a password to log in with email'}
              </p>
            </div>
          </div>

          {/* Google section */}
          <div className="border border-[#d1d8e4] dark:border-[#2d2d3f] rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-[#f1f5f9] dark:bg-[#0d0d1a]">
              <svg width={15} height={15} viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Google</span>
              <span className={clsx('ml-auto text-xs px-2 py-0.5 rounded-full',
                user?.google_id ? 'bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-slate-200 dark:bg-slate-700/50 text-slate-500')}>
                {user?.google_id ? 'Linked' : 'Not linked'}
              </span>
            </div>
            <div className="px-4 py-3">
              {user?.google_id ? (
                <p className="text-xs text-slate-400 dark:text-slate-500">Google account linked to profile</p>
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500">Sign in with Google on login screen to link</p>
              )}
            </div>
          </div>

          {/* Apple section */}
          <div className="border border-[#d1d8e4] dark:border-[#2d2d3f] rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-[#f1f5f9] dark:bg-[#0d0d1a]">
              <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor" className="text-slate-600 dark:text-slate-300">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Apple</span>
              <span className={clsx('ml-auto text-xs px-2 py-0.5 rounded-full',
                user?.apple_id ? 'bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-slate-200 dark:bg-slate-700/50 text-slate-500')}>
                {user?.apple_id ? 'Linked' : 'Not linked'}
              </span>
            </div>
            <div className="px-4 py-3">
              {user?.apple_id ? (
                <p className="text-xs text-slate-400 dark:text-slate-500">Apple account linked to profile</p>
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500">Sign in with Apple on login screen to link</p>
              )}
            </div>
          </div>

          {/* Telegram section */}
          <div className="border border-[#d1d8e4] dark:border-[#2d2d3f] rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-[#f1f5f9] dark:bg-[#0d0d1a]">
              <TelegramIcon size={15} />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Telegram</span>
              <span className={clsx('ml-auto text-xs px-2 py-0.5 rounded-full',
                isLinked ? 'bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-slate-200 dark:bg-slate-700/50 text-slate-500')}>
                {isLinked ? 'Linked' : 'Not linked'}
              </span>
            </div>

            <div className="px-4 py-3 space-y-3">
              {isLinked ? (
                <>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Account: {user?.telegram_username ? `@${user.telegram_username}` : `ID ${user?.telegram_id}`}
                  </p>
                  <button onClick={handleUnlink} disabled={unlinking}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50">
                    {unlinking ? 'Unlinking...' : 'Unlink Telegram'}
                  </button>
                </>
              ) : (
                <>
                  {linkStatus === 'idle' && (
                    <button onClick={initLink}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[#2AABEE] hover:bg-[#229ED9] text-white text-sm font-semibold transition-colors">
                      <TelegramIcon size={15} />
                      Link Telegram
                    </button>
                  )}

                  {linkStatus === 'waiting' && linkState && (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                        Send this code to bot{' '}
                        <a href={`https://t.me/${linkState.botUsername}`} target="_blank" rel="noopener noreferrer"
                          className="text-[#2AABEE] hover:underline">@{linkState.botUsername}</a>
                      </p>
                      <div className="flex items-center justify-center gap-3 bg-[#f1f5f9] dark:bg-[#1a1a2e] border border-[#d1d8e4] dark:border-[#2d2d3f] rounded-xl px-5 py-3">
                        <span className="text-3xl font-mono font-bold tracking-[0.25em] text-slate-800 dark:text-slate-100">
                          {linkState.code}
                        </span>
                        <button onClick={copyCode} className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                          {codeCopied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                        </button>
                      </div>
                      <p className={clsx('text-xs text-center font-mono', timeLeft < 60 ? 'text-red-400' : 'text-slate-400 dark:text-slate-500')}>
                        Expires in {formatTime(timeLeft)}
                      </p>
                      <div className="flex items-center justify-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                        <div className="w-3 h-3 border-2 border-[#2AABEE] border-t-transparent rounded-full animate-spin" />
                        Waiting for confirmation...
                      </div>
                      <a href={`https://t.me/${linkState.botUsername}?start=${linkState.code}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-[#2AABEE] hover:bg-[#229ED9] text-white text-xs font-semibold transition-colors">
                        <TelegramIcon size={14} />
                        Open @{linkState.botUsername}
                      </a>
                    </div>
                  )}

                  {linkStatus === 'confirmed' && (
                    <p className="text-sm text-green-500 dark:text-green-400 text-center py-1">Telegram linked successfully!</p>
                  )}

                  {linkStatus === 'expired' && (
                    <div className="text-center space-y-2">
                      <p className="text-xs text-red-400">{error}</p>
                      <button onClick={initLink}
                        className="flex items-center gap-1.5 mx-auto px-3 py-1.5 bg-[#e8ecf2] dark:bg-[#1e1e2e] hover:bg-[#d1d8e4] dark:hover:bg-[#2d2d3f] rounded-lg text-xs text-slate-600 dark:text-slate-300 transition-colors">
                        <RefreshCw size={12} /> Get new code
                      </button>
                    </div>
                  )}
                </>
              )}

              <AnimatePresence>
                {error && linkStatus !== 'expired' && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-xs text-red-400 text-center">{error}</motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
