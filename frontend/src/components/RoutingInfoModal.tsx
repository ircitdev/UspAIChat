import { X } from 'lucide-react';
import { motion } from 'framer-motion';
import { RoutingInfo } from '../types';

const TIER_META: Record<string, { label: string; color: string; bgColor: string; description: string }> = {
  SIMPLE: {
    label: 'Простой',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20 border-green-500/40',
    description: 'Фактический вопрос, перевод, простая задача'
  },
  MEDIUM: {
    label: 'Средний',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20 border-yellow-500/40',
    description: 'Анализ, структурированный ответ, работа с контекстом'
  },
  COMPLEX: {
    label: 'Сложный',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20 border-orange-500/40',
    description: 'Код, рассуждения, многошаговый анализ'
  },
};

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: 'text-orange-400',
  openai: 'text-green-400',
  gemini: 'text-blue-400',
  deepseek: 'text-cyan-400',
  kimi: 'text-purple-400',
};

const DIMENSION_LABELS: Record<string, string> = {
  tokens: 'Объём текста',
  code: 'Наличие кода',
  reasoning: 'Рассуждения',
  technical: 'Техническая терминология',
  creative: 'Творчество',
  simple: 'Простота',
  multiStep: 'Многошаговость',
  questionComplexity: 'Сложность вопроса',
  imperative: 'Императивные команды',
  constraints: 'Ограничения',
  outputFormat: 'Форматирование',
  references: 'Ссылки/источники',
  negation: 'Отрицания',
  domain: 'Специализация',
};

interface Props {
  info: RoutingInfo;
  onClose: () => void;
}

export default function RoutingInfoModal({ info, onClose }: Props) {
  const tierMeta = TIER_META[info.tier] || TIER_META.MEDIUM;
  const providerColor = PROVIDER_COLORS[info.selectedProvider] || 'text-violet-400';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative bg-white dark:bg-[#111122] border border-[#e2e8f0] dark:border-[#2d2d3f] rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2e8f0] dark:border-[#1e1e2e]">
          <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100">Smart Router — Обоснование выбора</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Selected model */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-800 flex items-center justify-center">
              <span className="text-white text-lg">⚡</span>
            </div>
            <div>
              <div className={`text-sm font-semibold ${providerColor}`}>
                {info.selectedProvider?.toUpperCase()}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{info.selectedModel}</div>
            </div>
          </div>

          {/* Tier badge */}
          <div className={`px-4 py-3 rounded-xl border ${tierMeta.bgColor}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-sm font-bold ${tierMeta.color}`}>{tierMeta.label}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">({info.tier})</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{tierMeta.description}</p>
          </div>

          {/* Reasoning */}
          <div>
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Почему эта модель</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{info.reasoning}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#f8fafc] dark:bg-[#0d0d1a] rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-violet-500">{Math.round(info.confidence * 100)}%</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-500">Уверенность</div>
            </div>
            <div className="bg-[#f8fafc] dark:bg-[#0d0d1a] rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-green-500">
                {info.savings > 0 ? `-${info.savings}%` : '—'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-500">Экономия</div>
            </div>
            <div className="bg-[#f8fafc] dark:bg-[#0d0d1a] rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-slate-600 dark:text-slate-300">{info.score}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-500">Сложность</div>
            </div>
          </div>

          {/* Dimensions breakdown */}
          {info.dimensions && (
            <div>
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Анализ промпта (14 измерений)</div>
              <div className="space-y-1.5">
                {Object.entries(info.dimensions)
                  .filter(([, val]) => val > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 w-32 shrink-0">
                        {DIMENSION_LABELS[key] || key}
                      </span>
                      <div className="flex-1 h-1.5 bg-[#e2e8f0] dark:bg-[#1e1e2e] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-violet-500 rounded-full transition-all"
                          style={{ width: `${Math.round(val * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-600 w-8 text-right">
                        {Math.round(val * 100)}%
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
