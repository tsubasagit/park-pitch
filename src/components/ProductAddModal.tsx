import { useState, type FormEvent } from 'react'
import { addBloomingProduct } from '../api/client'

interface ProductAddModalProps {
  onClose: () => void
  onAdded: () => void
}

export default function ProductAddModal({ onClose, onAdded }: ProductAddModalProps) {
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('')
  const [materials, setMaterials] = useState('')
  const [colors, setColors] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [occasionTags, setOccasionTags] = useState('')
  const [useCaseTags, setUseCaseTags] = useState('')
  const [aiSummary, setAiSummary] = useState('')
  const [giftScore, setGiftScore] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !brand.trim() || !price.trim()) {
      setError('商品名、ブランド、価格は必須です')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await addBloomingProduct({
        name: name.trim(),
        brand: brand.trim(),
        price: Number(price),
        category: category.trim() || undefined,
        materials: materials.trim() ? materials.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        colors: colors.trim() ? colors.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        occasionTags: occasionTags.trim() ? occasionTags.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        useCaseTags: useCaseTags.trim() ? useCaseTags.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        aiSummary: aiSummary.trim() || undefined,
        giftScore: giftScore ? Number(giftScore) : undefined,
        thumbnailUrl: thumbnailUrl.trim() || undefined,
      })
      onAdded()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '追加に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} aria-hidden />
      <div
        className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-50 overflow-y-auto"
        role="dialog"
        aria-modal
        aria-label="商品追加"
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-800">商品追加</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="閉じる"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">{error}</div>
          )}

          <Field label="商品名 *" value={name} onChange={setName} placeholder="例: ブルーミングハンカチ" />
          <Field label="ブランド *" value={brand} onChange={setBrand} placeholder="例: CLASSICS" />
          <Field label="価格（円）*" value={price} onChange={setPrice} placeholder="1100" type="number" />
          <Field label="カテゴリ" value={category} onChange={setCategory} placeholder="ハンカチ / タオル / ノベルティ" />
          <Field label="素材（カンマ区切り）" value={materials} onChange={setMaterials} placeholder="綿100%, ポリエステル" />
          <Field label="カラー（カンマ区切り）" value={colors} onChange={setColors} placeholder="ブルー, ホワイト, ピンク" />
          <Field label="画像URL" value={thumbnailUrl} onChange={setThumbnailUrl} placeholder="https://..." />
          <Field label="シーンタグ（カンマ区切り）" value={occasionTags} onChange={setOccasionTags} placeholder="お歳暮, ギフト, 記念品" />
          <Field label="用途タグ（カンマ区切り）" value={useCaseTags} onChange={setUseCaseTags} placeholder="販促品, ロゴ入れ" />
          <div>
            <label className="block text-xs text-gray-500 mb-1">AI概要</label>
            <textarea
              value={aiSummary}
              onChange={(e) => setAiSummary(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-pitch-navy/50 resize-none"
              placeholder="商品の特徴や魅力を入力..."
            />
          </div>
          <Field label="giftScore（1-10）" value={giftScore} onChange={setGiftScore} placeholder="5" type="number" />

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-6 py-2.5 bg-pitch-navy text-white rounded-lg text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-30"
            >
              {submitting ? '追加中...' : '商品を追加'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-pitch-navy/50"
        placeholder={placeholder}
      />
    </div>
  )
}
