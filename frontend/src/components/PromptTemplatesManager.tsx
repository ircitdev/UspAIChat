import { useState } from 'react';
import { Plus, Trash2, Edit3, X, Check, Sparkles, Tag } from 'lucide-react';
import useAppStore from '../store/appStore';
import { PromptTemplate } from '../types';
import api from '../services/api';
import clsx from 'clsx';

const CATEGORIES = ['general', 'coding', 'writing', 'analysis', 'translation', 'creative'];

export default function PromptTemplatesManager() {
  const { promptTemplates, loadPromptTemplates, createPromptTemplate, deletePromptTemplate } = useAppStore();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('general');
  const [filterCat, setFilterCat] = useState<string | null>(null);

  const filtered = filterCat
    ? promptTemplates.filter(t => t.category === filterCat)
    : promptTemplates;

  const resetForm = () => {
    setName('');
    setContent('');
    setCategory('general');
    setShowForm(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!name.trim() || !content.trim()) return;

    if (editingId) {
      await api.put(`/prompt-templates/${editingId}`, { name: name.trim(), content: content.trim(), category });
      await loadPromptTemplates();
    } else {
      await createPromptTemplate({ name: name.trim(), content: content.trim(), category });
    }
    resetForm();
  };

  const handleEdit = (tpl: PromptTemplate) => {
    setEditingId(tpl.id);
    setName(tpl.name);
    setContent(tpl.content);
    setCategory(tpl.category);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить шаблон?')) return;
    await deletePromptTemplate(id);
  };

  const uniqueCategories = [...new Set(promptTemplates.map(t => t.category))];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-violet-500" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Шаблоны промптов</h3>
          <span className="text-xs text-slate-400">({promptTemplates.length})</span>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium transition-colors"
        >
          <Plus size={12} />
          Новый
        </button>
      </div>

      {/* Category filter */}
      {uniqueCategories.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterCat(null)}
            className={clsx('px-2 py-1 rounded-lg text-xs transition-colors',
              filterCat === null
                ? 'bg-violet-600 text-white'
                : 'bg-[#f1f5f9] dark:bg-[#1e1e2e] text-slate-500 dark:text-slate-400 hover:bg-[#e2e8f0] dark:hover:bg-[#2d2d3f]'
            )}
          >
            Все
          </button>
          {uniqueCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCat(filterCat === cat ? null : cat)}
              className={clsx('px-2 py-1 rounded-lg text-xs transition-colors',
                filterCat === cat
                  ? 'bg-violet-600 text-white'
                  : 'bg-[#f1f5f9] dark:bg-[#1e1e2e] text-slate-500 dark:text-slate-400 hover:bg-[#e2e8f0] dark:hover:bg-[#2d2d3f]'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Create/Edit form */}
      {showForm && (
        <div className="bg-[#f1f5f9] dark:bg-[#1e1e2e] rounded-xl p-3 space-y-3 border border-[#d1d8e4] dark:border-[#2d2d3f]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {editingId ? 'Редактировать' : 'Новый шаблон'}
            </span>
            <button onClick={resetForm} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <X size={14} />
            </button>
          </div>

          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Название шаблона..."
            className="w-full bg-white dark:bg-[#0d0d1a] border border-[#d1d8e4] dark:border-[#2d2d3f] rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-violet-500"
          />

          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Текст промпта..."
            rows={4}
            className="w-full bg-white dark:bg-[#0d0d1a] border border-[#d1d8e4] dark:border-[#2d2d3f] rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-violet-500 resize-none"
          />

          <div className="flex items-center gap-2">
            <Tag size={12} className="text-slate-400" />
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="bg-white dark:bg-[#0d0d1a] border border-[#d1d8e4] dark:border-[#2d2d3f] rounded-lg px-2 py-1.5 text-xs text-slate-600 dark:text-slate-300 outline-none"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button onClick={resetForm}
              className="flex-1 py-2 rounded-lg bg-white dark:bg-[#0d0d1a] border border-[#d1d8e4] dark:border-[#2d2d3f] text-sm text-slate-500 hover:bg-[#e2e8f0] dark:hover:bg-[#2d2d3f] transition-colors">
              Отмена
            </button>
            <button onClick={handleSave}
              disabled={!name.trim() || !content.trim()}
              className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
              <Check size={14} className="inline mr-1" />
              {editingId ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </div>
      )}

      {/* Templates list */}
      <div className="space-y-1.5">
        {filtered.length === 0 && (
          <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">
            Нет шаблонов. Нажмите "Новый" чтобы создать.
          </p>
        )}
        {filtered.map(tpl => (
          <div
            key={tpl.id}
            className="group flex items-start gap-2 bg-white dark:bg-[#0d0d1a] border border-[#e2e8f0] dark:border-[#1e1e2e] rounded-xl px-3 py-2.5 hover:border-violet-300 dark:hover:border-violet-800 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{tpl.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#f1f5f9] dark:bg-[#1e1e2e] text-slate-400">{tpl.category}</span>
                {tpl.is_global === 1 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600">global</span>}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">{tpl.content.slice(0, 100)}</p>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button onClick={() => handleEdit(tpl)} className="p-1 text-slate-400 hover:text-violet-500 transition-colors">
                <Edit3 size={12} />
              </button>
              <button onClick={() => handleDelete(tpl.id)} className="p-1 text-slate-400 hover:text-red-400 transition-colors">
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-600 text-center">
        Используйте <kbd className="px-1 py-0.5 bg-[#e2e8f0] dark:bg-[#1e1e2e] rounded text-[10px]">/</kbd> в поле ввода для быстрого доступа
      </p>
    </div>
  );
}
