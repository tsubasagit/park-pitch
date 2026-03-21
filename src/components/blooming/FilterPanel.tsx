import type { BloomingSearchFilters } from '../../types'

interface FilterPanelProps {
  filters: BloomingSearchFilters
  onChange: (f: BloomingSearchFilters) => void
  categories: string[]
  occasions: string[]
}

export default function FilterPanel({ filters, onChange, categories, occasions }: FilterPanelProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
      <h3 className="text-sm font-semibold text-slate-800">条件で絞り込み</h3>

      <div>
        <label className="block text-xs text-slate-500 mb-1">用途・シーン</label>
        <select
          value={filters.occasion ?? ''}
          onChange={(e) => onChange({ ...filters, occasion: e.target.value || undefined })}
          className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">指定なし</option>
          {occasions.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-slate-500 mb-1">カテゴリ</label>
        <select
          value={filters.category ?? ''}
          onChange={(e) => onChange({ ...filters, category: e.target.value || undefined })}
          className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">指定なし</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-slate-500 mb-1">性別</label>
        <select
          value={filters.gender ?? ''}
          onChange={(e) => onChange({ ...filters, gender: e.target.value || undefined })}
          className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">指定なし</option>
          <option value="womens">レディース</option>
          <option value="mens">メンズ</option>
          <option value="kids">キッズ</option>
          <option value="unisex">ユニセックス</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-slate-500 mb-1">予算最小（円）</label>
          <input
            type="number"
            min={0}
            value={filters.budgetMin ?? ''}
            onChange={(e) =>
              onChange({ ...filters, budgetMin: e.target.value ? Number(e.target.value) : undefined })
            }
            placeholder="0"
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">予算最大（円）</label>
          <input
            type="number"
            min={0}
            value={filters.budgetMax ?? ''}
            onChange={(e) =>
              onChange({ ...filters, budgetMax: e.target.value ? Number(e.target.value) : undefined })
            }
            placeholder="なし"
            className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </div>
    </div>
  )
}
