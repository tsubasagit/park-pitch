import type { BloomingRecommendationItem } from '../../types'
import ProductCard from './ProductCard'

interface RecommendationResultsProps {
  items: BloomingRecommendationItem[]
  onSelectProduct: (item: BloomingRecommendationItem) => void
}

export default function RecommendationResults({ items, onSelectProduct }: RecommendationResultsProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        該当する商品がありません。条件やキーワードを変えて検索してください。
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map((item) => (
        <ProductCard
          key={item.productId}
          item={item}
          onClick={() => onSelectProduct(item)}
        />
      ))}
    </div>
  )
}
