import { useState, useEffect } from 'react';
import { X, CreditCard, Gift, Copy, Check, ExternalLink, Users, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import clsx from 'clsx';

interface Package {
  amount: number;
  credits: number;
  bonus: number;
  label: string;
}

interface PromoCheck {
  valid: boolean;
  code?: string;
  type?: string;
  value?: number;
  description?: string;
  error?: string;
}

interface ReferralInfo {
  referral_code: string;
  referral_link: string;
  telegram_link: string;
  total_referred: number;
  paid_referrals: number;
  total_earned: number;
  available_earnings: number;
  bonus_referrer: number;
  bonus_referred: number;
  bonus_percent: number;
}

interface PricingModel {
  id: string;
  name: string;
  pricePer1k: number;
}

export default function PaymentModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'pay' | 'history' | 'referral' | 'info'>('pay');
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState<PromoCheck | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [referral, setReferral] = useState<ReferralInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [pricing, setPricing] = useState<Record<string, PricingModel[]>>({});
  const user = useAuthStore(s => s.user);

  useEffect(() => {
    api.get('/payments/packages').then(r => {
      setPackages(r.data);
      if (r.data.length > 0) setSelectedPkg(r.data[0]);
    }).catch(() => {});
  }, []);

  const checkPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    try {
      const { data } = await api.get(`/promo/check/${promoCode.trim()}`);
      setPromoResult(data);
    } catch {
      setPromoResult({ valid: false, error: 'Ошибка проверки' });
    }
    setPromoLoading(false);
  };

  const handlePay = async () => {
    if (!selectedPkg) return;
    setLoading(true);
    try {
      const { data } = await api.post('/payments/create', {
        amount: selectedPkg.amount,
        promo_code: promoResult?.valid ? promoCode.trim() : undefined,
      });
      // Redirect to YooKassa
      window.location.href = data.confirmation_url;
    } catch (err: any) {
      alert(err.response?.data?.error || 'Ошибка создания платежа');
    }
    setLoading(false);
  };

  const loadHistory = async () => {
    try {
      const { data } = await api.get('/payments/history');
      setHistory(data);
    } catch {}
  };

  const loadReferral = async () => {
    try {
      const { data } = await api.get('/referral/info');
      setReferral(data);
    } catch {}
  };

  const withdrawReferral = async () => {
    try {
      await api.post('/referral/withdraw');
      loadReferral();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Ошибка');
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadPricing = async () => {
    try {
      const { data } = await api.get('/models/pricing');
      setPricing(data);
    } catch {}
  };

  useEffect(() => {
    if (tab === 'history') loadHistory();
    if (tab === 'referral') loadReferral();
    if (tab === 'info') loadPricing();
  }, [tab]);

  // Calculate total credits
  let totalCredits = selectedPkg ? selectedPkg.credits + selectedPkg.bonus : 0;
  let promoBonus = 0;
  if (promoResult?.valid && selectedPkg) {
    switch (promoResult.type) {
      case 'bonus': promoBonus = selectedPkg.credits * ((promoResult.value || 0) / 100); break;
      case 'discount': promoBonus = selectedPkg.credits * ((promoResult.value || 0) / 100); break;
      case 'fixed': promoBonus = promoResult.value || 0; break;
    }
    totalCredits += promoBonus;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative bg-white dark:bg-[#111122] border border-[#e2e8f0] dark:border-[#2d2d3f] rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2e8f0] dark:border-[#1e1e2e]">
          <div className="flex gap-1">
            {[
              { id: 'pay', icon: CreditCard, label: 'Пополнить' },
              { id: 'info', icon: Info, label: 'Тарифы' },
              { id: 'history', icon: Gift, label: 'История' },
              { id: 'referral', icon: Users, label: 'Рефералы' },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id as any)}
                className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors',
                  tab === t.id ? 'bg-violet-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-[#f1f5f9] dark:hover:bg-[#1e1e2e]')}>
                <t.icon size={12} /> {t.label}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
          {/* ── PAY TAB ── */}
          {tab === 'pay' && (
            <div className="space-y-4">
              <div className="text-sm text-slate-600 dark:text-slate-300 mb-3">Выберите пакет:</div>

              <div className="grid grid-cols-2 gap-2">
                {packages.map(pkg => (
                  <button key={pkg.amount} onClick={() => setSelectedPkg(pkg)}
                    className={clsx('p-3 rounded-xl border text-left transition-all',
                      selectedPkg?.amount === pkg.amount
                        ? 'border-violet-500 bg-violet-600/10 ring-1 ring-violet-500'
                        : 'border-[#e2e8f0] dark:border-[#2d2d3f] hover:border-violet-400')}>
                    <div className="text-lg font-bold text-slate-800 dark:text-white">{pkg.label}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {pkg.credits} кредитов
                      {pkg.bonus > 0 && <span className="text-green-500 ml-1">+{pkg.bonus}</span>}
                    </div>
                  </button>
                ))}
              </div>

              {/* Promo code */}
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Промо-код</div>
                <div className="flex gap-2">
                  <input
                    value={promoCode}
                    onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoResult(null); }}
                    placeholder="Введите код"
                    className="flex-1 px-3 py-2 rounded-lg bg-[#f1f5f9] dark:bg-[#1e1e2e] border border-[#e2e8f0] dark:border-[#2d2d3f] text-sm text-slate-800 dark:text-slate-200"
                  />
                  <button onClick={checkPromo} disabled={promoLoading || !promoCode.trim()}
                    className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm hover:bg-violet-700 disabled:opacity-50 transition-colors">
                    {promoLoading ? '...' : 'OK'}
                  </button>
                </div>
                {promoResult && (
                  <div className={clsx('text-xs mt-1', promoResult.valid ? 'text-green-500' : 'text-red-400')}>
                    {promoResult.valid ? promoResult.description : promoResult.error}
                  </div>
                )}
              </div>

              {/* Summary */}
              {selectedPkg && (
                <div className="bg-[#f8fafc] dark:bg-[#0d0d1a] rounded-xl p-4 space-y-1">
                  <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                    <span>Сумма</span>
                    <span>{selectedPkg.amount} ₽</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                    <span>Кредиты</span>
                    <span>{selectedPkg.credits}</span>
                  </div>
                  {selectedPkg.bonus > 0 && (
                    <div className="flex justify-between text-sm text-green-500">
                      <span>Бонус пакета</span>
                      <span>+{selectedPkg.bonus}</span>
                    </div>
                  )}
                  {promoBonus > 0 && (
                    <div className="flex justify-between text-sm text-green-500">
                      <span>Бонус промо</span>
                      <span>+{Math.round(promoBonus)}</span>
                    </div>
                  )}
                  <div className="border-t border-[#e2e8f0] dark:border-[#2d2d3f] pt-1 mt-1 flex justify-between text-sm font-bold text-slate-800 dark:text-white">
                    <span>Итого кредитов</span>
                    <span>{Math.round(totalCredits)}</span>
                  </div>
                </div>
              )}

              <button onClick={handlePay} disabled={loading || !selectedPkg}
                className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm disabled:opacity-50 transition-colors">
                {loading ? 'Создание платежа...' : `Оплатить ${selectedPkg?.amount || 0} ₽`}
              </button>

              <p className="text-[10px] text-center text-slate-400 dark:text-slate-600">
                Оплата через ЮKassa. После оплаты кредиты зачислятся автоматически.
              </p>
            </div>
          )}

          {/* ── HISTORY TAB ── */}
          {tab === 'history' && (
            <div className="space-y-2">
              {history.length === 0 && <div className="text-center text-sm text-slate-400 py-8">Нет платежей</div>}
              {history.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#f8fafc] dark:bg-[#0d0d1a]">
                  <div className={clsx('w-2 h-2 rounded-full', p.status === 'succeeded' ? 'bg-green-500' : p.status === 'pending' ? 'bg-yellow-500' : 'bg-red-400')} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-800 dark:text-white">{p.amount} ₽ → {Math.round(p.credits)} кр.</div>
                    <div className="text-[10px] text-slate-400">
                      {p.source === 'telegram' ? 'Telegram' : 'Web'}{p.promo_code ? ` | Промо: ${p.promo_code}` : ''}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">{new Date(p.created_at * 1000).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── INFO TAB ── */}
          {tab === 'info' && (
            <div className="space-y-4">
              {/* What are credits */}
              <div className="bg-violet-600/10 border border-violet-500/20 rounded-xl p-4 space-y-2">
                <div className="text-sm font-semibold text-violet-600 dark:text-violet-400">Что такое кредиты?</div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Кредиты — внутренняя валюта для оплаты ответов AI. Списание происходит только за <strong>выходные токены</strong> (текст,
                  который генерирует модель). Входные токены (ваш запрос) — бесплатно.
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  1 кредит = 1 рубль при пополнении. Администраторы не расходуют кредиты.
                </p>
              </div>

              {/* Smart Router savings */}
              <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">⚡</span>
                  <div className="text-sm font-semibold text-violet-600 dark:text-violet-400">Режим «Авто» экономит кредиты</div>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  <strong>Smart Router</strong> анализирует каждый запрос по 14 параметрам и подбирает оптимальную модель.
                  Простой вопрос → быстрая дешёвая модель. Сложная задача → мощная модель. Вы всегда видите, какая модель выбрана и почему.
                </p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-white/50 dark:bg-[#1a1a2e] rounded-lg p-2 text-center border border-green-500/20">
                    <div className="font-bold text-green-500">SIMPLE</div>
                    <div className="text-slate-500 dark:text-slate-400">от 0.2 кр/1K</div>
                    <div className="text-[10px] text-slate-400">Gemini Flash Lite</div>
                  </div>
                  <div className="bg-white/50 dark:bg-[#1a1a2e] rounded-lg p-2 text-center border border-amber-500/20">
                    <div className="font-bold text-amber-500">MEDIUM</div>
                    <div className="text-slate-500 dark:text-slate-400">от 0.5 кр/1K</div>
                    <div className="text-[10px] text-slate-400">Gemini 2.5 Flash</div>
                  </div>
                  <div className="bg-white/50 dark:bg-[#1a1a2e] rounded-lg p-2 text-center border border-orange-500/20">
                    <div className="font-bold text-orange-500">COMPLEX</div>
                    <div className="text-slate-500 dark:text-slate-400">от 3.5 кр/1K</div>
                    <div className="text-[10px] text-slate-400">Gemini 2.5 Pro</div>
                  </div>
                </div>
                <p className="text-[11px] text-violet-500 dark:text-violet-400 font-medium">
                  💡 В среднем экономия до 70% по сравнению с постоянным использованием топовых моделей
                </p>
              </div>

              {/* How many tokens is a message */}
              <div className="bg-[#f8fafc] dark:bg-[#0d0d1a] rounded-xl p-4 space-y-2">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">Сколько токенов в сообщении?</div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <div className="bg-white dark:bg-[#1a1a2e] rounded-lg p-2 border border-[#e2e8f0] dark:border-[#2d2d3f]">
                    <div className="font-mono text-slate-700 dark:text-slate-300">~750</div>
                    <div>токенов = 500 слов</div>
                  </div>
                  <div className="bg-white dark:bg-[#1a1a2e] rounded-lg p-2 border border-[#e2e8f0] dark:border-[#2d2d3f]">
                    <div className="font-mono text-slate-700 dark:text-slate-300">~150</div>
                    <div>токенов = короткий ответ</div>
                  </div>
                </div>
              </div>

              {/* Examples */}
              <div className="bg-[#f8fafc] dark:bg-[#0d0d1a] rounded-xl p-4 space-y-2">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">Примеры расхода</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1.5">
                  <div className="flex justify-between"><span>Простой вопрос (Claude Sonnet)</span><span className="font-mono text-amber-500">~0.5−1.5 кр</span></div>
                  <div className="flex justify-between"><span>Развёрнутый ответ (Claude Sonnet)</span><span className="font-mono text-amber-500">~2.5−7.5 кр</span></div>
                  <div className="flex justify-between"><span>Простой вопрос (GPT-4o mini)</span><span className="font-mono text-amber-500">~0.03−0.09 кр</span></div>
                  <div className="flex justify-between"><span>Длинный код (Claude Opus)</span><span className="font-mono text-amber-500">~25−75 кр</span></div>
                  <div className="flex justify-between"><span>Быстрый ответ (Gemini Flash)</span><span className="font-mono text-amber-500">~0.02−0.05 кр</span></div>
                  <div className="flex justify-between"><span>DeepSeek V3 (обычный запрос)</span><span className="font-mono text-amber-500">~0.04−0.12 кр</span></div>
                </div>
              </div>

              {/* Pricing table */}
              <div>
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Стоимость моделей (кредитов за 1K токенов)</div>
                <div className="border border-[#e2e8f0] dark:border-[#2d2d3f] rounded-xl overflow-hidden">
                  {Object.entries(pricing).map(([provider, models]) => (
                    <div key={provider}>
                      <div className="px-3 py-1.5 bg-[#f1f5f9] dark:bg-[#0d0d1a] text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {provider === 'anthropic' ? 'Anthropic (Claude)' : provider === 'openai' ? 'OpenAI' : provider === 'gemini' ? 'Google (Gemini)' : provider === 'deepseek' ? 'DeepSeek' : provider === 'kimi' ? 'Kimi' : provider}
                      </div>
                      {models.map(m => (
                        <div key={m.id} className="flex items-center justify-between px-3 py-1.5 border-t border-[#e2e8f0] dark:border-[#2d2d3f] text-xs">
                          <span className="text-slate-600 dark:text-slate-400">{m.name}</span>
                          <span className={clsx('font-mono', m.pricePer1k <= 0.5 ? 'text-green-500' : m.pricePer1k <= 3 ? 'text-amber-500' : m.pricePer1k <= 10 ? 'text-orange-500' : 'text-red-400')}>
                            {m.pricePer1k} кр
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
                Стоимость ответа = (количество токенов / 1000) × цена модели. Стоимость каждого ответа видна при наведении на сообщение.
              </p>
            </div>
          )}

          {/* ── REFERRAL TAB ── */}
          {tab === 'referral' && referral && (
            <div className="space-y-4">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Ваша реферальная ссылка</div>
                <div className="flex gap-2">
                  <input readOnly value={referral.referral_link}
                    className="flex-1 px-3 py-2 rounded-lg bg-[#f1f5f9] dark:bg-[#1e1e2e] border border-[#e2e8f0] dark:border-[#2d2d3f] text-xs text-slate-600 dark:text-slate-300" />
                  <button onClick={() => copyText(referral.referral_link)}
                    className="px-3 py-2 rounded-lg bg-violet-600 text-white text-xs hover:bg-violet-700 transition-colors">
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <a href={referral.telegram_link} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2AABEE]/10 border border-[#2AABEE]/30 text-[#2AABEE] text-xs hover:bg-[#2AABEE]/20 transition-colors">
                <ExternalLink size={12} /> Ссылка для Telegram
              </a>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#f8fafc] dark:bg-[#0d0d1a] rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-violet-500">{referral.total_referred}</div>
                  <div className="text-[10px] text-slate-500">Приглашено</div>
                </div>
                <div className="bg-[#f8fafc] dark:bg-[#0d0d1a] rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-green-500">{Math.round(referral.total_earned)}</div>
                  <div className="text-[10px] text-slate-500">Заработано</div>
                </div>
                <div className="bg-[#f8fafc] dark:bg-[#0d0d1a] rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-orange-400">{Math.round(referral.available_earnings)}</div>
                  <div className="text-[10px] text-slate-500">Доступно</div>
                </div>
              </div>

              {referral.available_earnings > 0 && (
                <button onClick={withdrawReferral}
                  className="w-full py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors">
                  Вывести {Math.round(referral.available_earnings)} кр. на баланс
                </button>
              )}

              <div className="bg-[#f8fafc] dark:bg-[#0d0d1a] rounded-xl p-3 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                <div>За каждого друга вы получите:</div>
                <div className="text-green-500 font-medium">{referral.bonus_referrer} кредитов + {referral.bonus_percent}% от первого пополнения</div>
                <div>Друг получит при регистрации: <span className="text-violet-500 font-medium">{referral.bonus_referred} кредитов</span></div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
