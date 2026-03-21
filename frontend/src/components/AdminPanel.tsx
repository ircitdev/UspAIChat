import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, Users, BarChart2, Shield, ShieldOff, Trash2,
  Crown, UserX, KeyRound, Search, RefreshCw, Key,
  MessageSquare, Eye, EyeOff, Check, Wallet, TrendingUp, TrendingDown, Plus
} from 'lucide-react';
import { format } from 'date-fns';
import api from '../services/api';
import clsx from 'clsx';

interface User {
  id: string;
  email: string;
  username: string;
  role: 'admin' | 'user';
  is_blocked: number;
  balance: number;
  conv_count: number;
  created_at: number;
}

interface Stats {
  totalUsers: number;
  adminUsers: number;
  blockedUsers: number;
  totalConvs: number;
  totalMessages: number;
  newToday: number;
  totalTopup: number;
  totalCharged: number;
  totalBalance: number;
}

interface Transaction {
  id: string;
  user_id: string;
  username: string;
  email: string;
  admin_username?: string;
  type: 'topup' | 'charge' | 'refund';
  amount: number;
  balance_after: number;
  description: string;
  provider?: string;
  model?: string;
  tokens?: number;
  created_at: number;
}

interface Props { onClose: () => void; currentUserId: string; }

export default function AdminPanel({ onClose, currentUserId }: Props) {
  const [tab, setTab] = useState<'stats' | 'users' | 'keys' | 'balance'>('stats');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [globalKeys, setGlobalKeys] = useState<Record<string, boolean>>({});
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [keySaved, setKeySaved] = useState<Record<string, boolean>>({});
  // Balance
  const [topupTarget, setTopupTarget] = useState<string | null>(null);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupDesc, setTopupDesc] = useState('');
  const [topupSaving, setTopupSaving] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  const PROVIDERS = [
    { id: 'anthropic', name: 'Anthropic Claude', color: 'text-orange-400', placeholder: 'sk-ant-api...' },
    { id: 'openai', name: 'OpenAI', color: 'text-green-400', placeholder: 'sk-...' },
    { id: 'gemini', name: 'Google Gemini', color: 'text-blue-400', placeholder: 'AIza...' },
  ];

  const loadStats = async () => {
    const { data } = await api.get('/admin/stats');
    setStats(data);
  };

  const loadUsers = async (q = '') => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/users', { params: q ? { q } : {} });
      setUsers(data);
    } finally { setLoading(false); }
  };

  const loadGlobalKeys = async () => {
    const { data } = await api.get('/admin/global-keys');
    setGlobalKeys(data);
  };

  const loadTransactions = async () => {
    setTxLoading(true);
    try {
      const { data } = await api.get('/admin/balance/transactions', { params: { limit: 100 } });
      setTransactions(data);
    } finally { setTxLoading(false); }
  };

  const doTopup = async (userId: string) => {
    const amount = parseFloat(topupAmount);
    if (!amount || amount <= 0) return;
    setTopupSaving(true);
    try {
      const { data } = await api.post('/admin/balance/topup', { user_id: userId, amount, description: topupDesc || undefined });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, balance: data.user.balance } : u));
      setTopupTarget(null);
      setTopupAmount('');
      setTopupDesc('');
      await loadStats();
      await loadTransactions();
    } finally { setTopupSaving(false); }
  };

  useEffect(() => {
    loadStats();
    loadUsers();
    loadGlobalKeys();
    loadTransactions();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadUsers(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const setRole = async (userId: string, role: 'admin' | 'user') => {
    const { data } = await api.patch(`/admin/users/${userId}/role`, { role });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...data } : u));
    loadStats();
  };

  const toggleBlock = async (user: User) => {
    const { data } = await api.patch(`/admin/users/${user.id}/block`, { is_blocked: !user.is_blocked });
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, ...data } : u));
    loadStats();
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Удалить пользователя и все его данные?')) return;
    await api.delete(`/admin/users/${userId}`);
    setUsers(prev => prev.filter(u => u.id !== userId));
    loadStats();
  };

  const resetPassword = async (userId: string) => {
    if (!newPassword || newPassword.length < 6) return;
    await api.patch(`/admin/users/${userId}/password`, { new_password: newPassword });
    setResetTarget(null);
    setNewPassword('');
  };

  const saveGlobalKey = async (provider: string) => {
    const key = keyInputs[provider];
    if (!key) return;
    await api.post('/admin/global-keys', { provider, api_key: key });
    setKeySaved(prev => ({ ...prev, [provider]: true }));
    setTimeout(() => setKeySaved(prev => ({ ...prev, [provider]: false })), 2000);
    await loadGlobalKeys();
  };

  const deleteGlobalKey = async (provider: string) => {
    await api.delete(`/admin/global-keys/${provider}`);
    await loadGlobalKeys();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#111122] border border-[#2d2d3f] rounded-2xl w-full max-w-2xl mx-4 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e2e] shrink-0">
          <div className="flex items-center gap-2">
            <Crown size={16} className="text-yellow-400" />
            <h2 className="text-base font-semibold text-slate-100">Панель администратора</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[#1e1e2e] rounded-lg text-slate-400">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 shrink-0">
          {[
            { id: 'stats', icon: BarChart2, label: 'Статистика' },
            { id: 'users', icon: Users, label: `Пользователи (${stats?.totalUsers ?? '…'})` },
            { id: 'balance', icon: Wallet, label: 'Баланс' },
            { id: 'keys', icon: Key, label: 'API ключи' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as never)}
              className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors',
                tab === t.id ? 'bg-violet-600 text-white' : 'text-slate-400 hover:bg-[#1e1e2e]')}>
              <t.icon size={12} /> {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── STATS ── */}
          {tab === 'stats' && stats && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { label: 'Всего пользователей', value: stats.totalUsers, icon: Users, color: 'text-violet-400' },
                  { label: 'Администраторов', value: stats.adminUsers, icon: Crown, color: 'text-yellow-400' },
                  { label: 'Заблокировано', value: stats.blockedUsers, icon: UserX, color: 'text-red-400' },
                  { label: 'Новых сегодня', value: stats.newToday, icon: Users, color: 'text-green-400' },
                  { label: 'Чатов', value: stats.totalConvs, icon: MessageSquare, color: 'text-blue-400' },
                  { label: 'Сообщений', value: stats.totalMessages, icon: MessageSquare, color: 'text-slate-400' },
                ].map(s => (
                  <div key={s.label} className="bg-[#1a1a2e] border border-[#2d2d3f] rounded-xl p-4">
                    <s.icon size={18} className={clsx('mb-2', s.color)} />
                    <div className="text-2xl font-bold text-slate-100">{s.value}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Пополнено всего', value: stats.totalTopup.toFixed(2) + ' кр.', icon: TrendingUp, color: 'text-green-400' },
                  { label: 'Списано всего', value: stats.totalCharged.toFixed(2) + ' кр.', icon: TrendingDown, color: 'text-red-400' },
                  { label: 'Баланс всех юзеров', value: stats.totalBalance.toFixed(2) + ' кр.', icon: Wallet, color: 'text-blue-400' },
                ].map(s => (
                  <div key={s.label} className="bg-[#1a1a2e] border border-[#2d2d3f] rounded-xl p-4">
                    <s.icon size={18} className={clsx('mb-2', s.color)} />
                    <div className="text-xl font-bold text-slate-100 font-mono">{s.value}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── USERS ── */}
          {tab === 'users' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Поиск по email или имени..."
                    className="w-full bg-[#1e1e2e] border border-[#2d2d3f] rounded-lg pl-8 pr-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-violet-500" />
                </div>
                <button onClick={() => loadUsers(search)} className="p-2 hover:bg-[#1e1e2e] rounded-lg text-slate-400">
                  <RefreshCw size={14} />
                </button>
              </div>

              {loading && <div className="text-center py-4 text-slate-500 text-sm">Загрузка...</div>}

              {users.map(user => (
                <div key={user.id} className={clsx(
                  'bg-[#1a1a2e] border rounded-xl p-3',
                  user.is_blocked ? 'border-red-500/30' : 'border-[#2d2d3f]'
                )}>
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className={clsx(
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                      user.role === 'admin' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-violet-500/20 text-violet-400'
                    )}>
                      {user.username[0].toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-200">{user.username}</span>
                        <span className={clsx('text-[10px] px-1.5 py-0.5 rounded font-medium',
                          user.role === 'admin' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-700 text-slate-400')}>
                          {user.role === 'admin' ? '👑 admin' : 'user'}
                        </span>
                        {!!user.is_blocked && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">заблокирован</span>
                        )}
                        {user.id === currentUserId && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400">вы</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                      <div className="text-[10px] text-slate-600 mt-0.5">
                        {user.conv_count} чатов • Зарегистрирован {format(new Date(user.created_at * 1000), 'dd.MM.yyyy')}
                      </div>
                    </div>

                    {/* Actions */}
                    {user.id !== currentUserId && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setTopupTarget(topupTarget === user.id ? null : user.id)}
                          title="Пополнить баланс"
                          className="p-1.5 hover:bg-[#2d2d3f] rounded-lg text-slate-500 hover:text-green-400 transition-colors">
                          <Plus size={13} />
                        </button>
                        <button onClick={() => setRole(user.id, user.role === 'admin' ? 'user' : 'admin')}
                          title={user.role === 'admin' ? 'Снять admin' : 'Назначить admin'}
                          className="p-1.5 hover:bg-[#2d2d3f] rounded-lg text-slate-500 hover:text-yellow-400 transition-colors">
                          <Crown size={13} />
                        </button>
                        <button onClick={() => toggleBlock(user)}
                          title={user.is_blocked ? 'Разблокировать' : 'Заблокировать'}
                          className={clsx('p-1.5 hover:bg-[#2d2d3f] rounded-lg transition-colors',
                            user.is_blocked ? 'text-green-400 hover:text-green-300' : 'text-slate-500 hover:text-red-400')}>
                          {user.is_blocked ? <Shield size={13} /> : <ShieldOff size={13} />}
                        </button>
                        <button onClick={() => setResetTarget(resetTarget === user.id ? null : user.id)}
                          title="Сбросить пароль"
                          className="p-1.5 hover:bg-[#2d2d3f] rounded-lg text-slate-500 hover:text-blue-400 transition-colors">
                          <KeyRound size={13} />
                        </button>
                        <button onClick={() => deleteUser(user.id)}
                          title="Удалить пользователя"
                          className="p-1.5 hover:bg-[#2d2d3f] rounded-lg text-slate-500 hover:text-red-400 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Balance display */}
                  {user.role !== 'admin' && (
                    <div className="pl-11 mt-1">
                      <span className={`text-xs font-mono ${user.balance < 1 ? 'text-red-400' : 'text-green-400'}`}>
                        Баланс: {user.balance?.toFixed(4) ?? '0.0000'} кр.
                      </span>
                    </div>
                  )}

                  {/* Topup form */}
                  {topupTarget === user.id && (
                    <div className="flex flex-col gap-2 mt-2 pl-11">
                      <div className="flex gap-2">
                        <input type="number" min="0.01" step="0.01" placeholder="Сумма (кр.)"
                          value={topupAmount} onChange={e => setTopupAmount(e.target.value)}
                          className="w-28 bg-[#0d0d1a] border border-[#2d2d3f] rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-green-500" />
                        <input type="text" placeholder="Комментарий (необязательно)"
                          value={topupDesc} onChange={e => setTopupDesc(e.target.value)}
                          className="flex-1 bg-[#0d0d1a] border border-[#2d2d3f] rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-green-500" />
                        <button onClick={() => doTopup(user.id)} disabled={topupSaving || !topupAmount}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg text-xs text-white transition-colors">
                          {topupSaving ? '...' : 'Пополнить'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Password reset form */}
                  {resetTarget === user.id && (
                    <div className="flex gap-2 mt-2 pl-11">
                      <div className="relative flex-1">
                        <input
                          type={showPass ? 'text' : 'password'}
                          placeholder="Новый пароль (мин. 6 символов)"
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          className="w-full bg-[#0d0d1a] border border-[#2d2d3f] rounded-lg px-3 pr-8 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500"
                        />
                        <button onClick={() => setShowPass(v => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500">
                          {showPass ? <EyeOff size={11} /> : <Eye size={11} />}
                        </button>
                      </div>
                      <button onClick={() => resetPassword(user.id)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs text-white transition-colors">
                        Сохранить
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── BALANCE HISTORY ── */}
          {tab === 'balance' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">Последние 100 транзакций всех пользователей</p>
                <button onClick={loadTransactions} className="p-1.5 hover:bg-[#1e1e2e] rounded-lg text-slate-400">
                  <RefreshCw size={13} />
                </button>
              </div>
              {txLoading && <div className="text-center py-4 text-slate-500 text-sm">Загрузка...</div>}
              {transactions.map(tx => (
                <div key={tx.id} className="flex items-start gap-3 bg-[#1a1a2e] border border-[#2d2d3f] rounded-xl px-3 py-2.5">
                  <div className={clsx('mt-0.5 shrink-0', tx.type === 'topup' ? 'text-green-400' : 'text-red-400')}>
                    {tx.type === 'topup' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-300 font-medium truncate">{tx.username}</span>
                      <span className={clsx('text-xs font-mono font-bold shrink-0 ml-2',
                        tx.type === 'topup' ? 'text-green-400' : 'text-red-400')}>
                        {tx.type === 'topup' ? '+' : ''}{tx.amount.toFixed(4)} кр.
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">{tx.description}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {tx.admin_username && (
                        <span className="text-[10px] text-yellow-500">от {tx.admin_username}</span>
                      )}
                      {tx.tokens ? <span className="text-[10px] text-slate-600">{tx.tokens} токенов</span> : null}
                      <span className="text-[10px] text-slate-600 ml-auto">
                        → {tx.balance_after.toFixed(4)} кр. • {format(new Date(tx.created_at * 1000), 'dd.MM HH:mm')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {!txLoading && transactions.length === 0 && (
                <div className="text-center py-8 text-slate-600 text-sm">Транзакций пока нет</div>
              )}
            </div>
          )}

          {/* ── GLOBAL KEYS ── */}
          {tab === 'keys' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 bg-[#1a1a2e] border border-[#2d2d3f] rounded-lg px-3 py-2">
                Глобальные ключи используются для всех пользователей, у которых нет собственного ключа для данного провайдера.
              </p>
              {PROVIDERS.map(p => (
                <div key={p.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={clsx('text-sm font-medium', p.color)}>{p.name}</span>
                    {globalKeys[p.id] && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-green-400 flex items-center gap-1"><Check size={10} /> Настроен</span>
                        <button onClick={() => deleteGlobalKey(p.id)} className="text-xs text-red-400 hover:text-red-300">Удалить</button>
                      </div>
                    )}
                  </div>
                  <input
                    type="password"
                    placeholder={p.placeholder}
                    value={keyInputs[p.id] || ''}
                    onChange={e => setKeyInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                    className="w-full bg-[#1e1e2e] border border-[#2d2d3f] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-violet-500"
                  />
                  <button onClick={() => saveGlobalKey(p.id)} disabled={!keyInputs[p.id]}
                    className={clsx('w-full py-1.5 rounded-lg text-xs font-medium transition-all',
                      keySaved[p.id] ? 'bg-green-600 text-white' :
                      keyInputs[p.id] ? 'bg-violet-600 hover:bg-violet-700 text-white' :
                      'bg-[#1e1e2e] text-slate-600 cursor-not-allowed')}>
                    {keySaved[p.id] ? '✓ Сохранено' : 'Сохранить глобальный ключ'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
