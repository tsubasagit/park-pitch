import type { BloomingProduct } from '../../types'

interface ProductDetailModalProps {
  product: BloomingProduct | null
  onClose: () => void
  cartAction?: React.ReactNode
}

export default function ProductDetailModal({ product, onClose, cartAction }: ProductDetailModalProps) {
  if (!product) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} aria-hidden />
      <div
        className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-50 overflow-y-auto"
        role="dialog"
        aria-modal
        aria-label="商品詳細"
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-800">商品詳細</h2>
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
        <div className="p-4 space-y-4">
          {product.thumbnailUrl ? (
            <img
              src={product.thumbnailUrl}
              alt={product.name}
              className="w-full aspect-square object-cover rounded-lg"
            />
          ) : (
            <div className="w-full aspect-square bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
              画像なし
            </div>
          )}
          <div>
            <h3 className="text-xl font-semibold text-slate-800">{product.name}</h3>
            <p className="text-slate-600">{product.brand}</p>
            <p className="text-lg font-bold text-slate-800 mt-2">¥{product.price.toLocaleString()}</p>
          </div>
          {product.aiSummary && (
            <p className="text-sm text-slate-600">{product.aiSummary}</p>
          )}
          <dl className="grid grid-cols-1 gap-2 text-sm">
            <div>
              <dt className="text-slate-500">カテゴリ</dt>
              <dd className="text-slate-800">{product.category}</dd>
            </div>
            {product.materials?.length > 0 && (
              <div>
                <dt className="text-slate-500">素材</dt>
                <dd className="text-slate-800">{product.materials.join('、')}</dd>
              </div>
            )}
            {product.dimensions && (
              <div>
                <dt className="text-slate-500">サイズ</dt>
                <dd className="text-slate-800">{product.dimensions}</dd>
              </div>
            )}
            {product.colors?.length > 0 && (
              <div>
                <dt className="text-slate-500">カラー</dt>
                <dd className="text-slate-800">{product.colors.join('、')}</dd>
              </div>
            )}
            {product.occasionTags?.length > 0 && (
              <div>
                <dt className="text-slate-500">シーン</dt>
                <dd className="text-slate-800">{product.occasionTags.join('、')}</dd>
              </div>
            )}
          </dl>
          {cartAction && (
            <div className="pt-2">{cartAction}</div>
          )}
          <a
            href={product.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[#538bb0] font-semibold hover:underline"
          >
            元のサイトで見る
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </>
  )
}
