import type { BloomingRecommendationItem } from '../../types'

interface ProductCardProps {
  item: BloomingRecommendationItem
  onClick: () => void
  onAddToProposal?: (productId: string) => void
}

export default function ProductCard({ item, onClick, onAddToProposal }: ProductCardProps) {
  const { product, rank, reason } = item
  return (
    <div className="text-left bg-white rounded-lg border border-slate-200 overflow-hidden hover:border-[#538bb0] hover:shadow-md transition-all">
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left"
      >
        <div className="aspect-square bg-slate-100 flex items-center justify-center">
          {product.thumbnailUrl ? (
            <img
              src={product.thumbnailUrl}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-slate-400 text-sm">画像なし</span>
          )}
        </div>
        <div className="p-3">
          <span className="text-xs font-medium text-[#538bb0]">#{rank}</span>
          <h3 className="font-semibold text-slate-800 mt-0.5 line-clamp-2">{product.name}</h3>
          <p className="text-sm text-slate-600 mt-1">{product.brand}</p>
          <p className="text-sm font-medium text-slate-800 mt-1">¥{product.price.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-2 line-clamp-2">{reason}</p>
        </div>
      </button>

      {onAddToProposal && (
        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onAddToProposal(product.id)
            }}
            className="w-full py-1.5 text-xs font-medium text-[#538bb0] border border-[#538bb0] rounded-lg hover:bg-[#538bb0] hover:text-white transition-colors"
          >
            提案書に追加
          </button>
        </div>
      )}
    </div>
  )
}
