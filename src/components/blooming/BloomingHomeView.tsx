import { useState, useEffect, useCallback } from 'react'
import type { BloomingProduct, BloomingSearchFilters } from '../../types'
import {
  getBloomingProducts,
  getBloomingFilters,
} from '../../api/client'
import FilterPanel from './FilterPanel'
import ProductDetailModal from './ProductDetailModal'
import ProductAddModal from '../ProductAddModal'

const PER_PAGE = 24

interface BloomingHomeViewProps {
  cartIds: Set<string>
  onToggleCart: (id: string) => void
  onGoHome: () => void
}

export default function BloomingHomeView({ cartIds, onToggleCart, onGoHome }: BloomingHomeViewProps) {
  const [products, setProducts] = useState<BloomingProduct[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [filters, setFilters] = useState<BloomingSearchFilters>({})
  const [categories, setCategories] = useState<string[]>([])
  const [occasions, setOccasions] = useState<string[]>([])
  const [detailProduct, setDetailProduct] = useState<BloomingProduct | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  const loadProducts = useCallback(async (p: number, q?: string) => {
    setLoading(true)
    try {
      const data = await getBloomingProducts({ page: p, perPage: PER_PAGE, q: q || undefined })
      setProducts(data.items)
      setTotal(data.total)
    } catch {
      setProducts([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadFilters = useCallback(async () => {
    try {
      const data = await getBloomingFilters()
      setCategories(data.categories || [])
      setOccasions(data.occasions || [])
    } catch {
      setCategories([])
      setOccasions([])
    }
  }, [])

  useEffect(() => {
    loadProducts(1)
    loadFilters()
  }, [loadProducts, loadFilters])

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    loadProducts(newPage, activeSearch || undefined)
  }

  const handleSearch = () => {
    const q = searchText.trim()
    setActiveSearch(q)
    setPage(1)
    loadProducts(1, q || undefined)
  }

  const handleClearSearch = () => {
    setSearchText('')
    setActiveSearch('')
    setPage(1)
    loadProducts(1)
  }

  // Client-side filtering (filters only — search is now server-side via q param)
  const filteredProducts = products.filter((p) => {
    if (filters.category && p.category !== filters.category) return false
    if (filters.budgetMin && p.price < filters.budgetMin) return false
    if (filters.budgetMax && p.price > filters.budgetMax) return false
    if (filters.gender && p.gender !== filters.gender) return false
    return true
  })

  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-800">商品カタログ</h1>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1 px-2.5 py-1 bg-pitch-navy/10 text-pitch-navy text-xs font-medium rounded-lg hover:bg-pitch-navy/20 transition-colors"
                title="商品追加"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                商品追加
              </button>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              全 {total} 件の商品
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="商品名・素材・カテゴリで検索..."
              className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-800 placeholder-slate-400 pr-8"
            />
            {activeSearch && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleSearch}
            className="bg-pitch-navy hover:opacity-90 text-white px-5 py-2 rounded-lg text-sm font-medium transition-opacity"
          >
            検索
          </button>
        </div>

        {activeSearch && (
          <div className="mt-2 text-xs text-slate-500">
            「{activeSearch}」の検索結果: {filteredProducts.length} 件
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Filters sidebar */}
        <aside className="hidden md:block w-52 shrink-0 p-4 overflow-y-auto border-r border-slate-200 bg-white">
          <FilterPanel
            filters={filters}
            onChange={(f) => { setFilters(f); setPage(1) }}
            categories={categories}
            occasions={occasions}
          />
        </aside>

        {/* Product grid */}
        <main className="flex-1 overflow-y-auto p-4 pb-24">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-pitch-navy/20 border-t-pitch-navy rounded-full animate-spin" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              該当する商品がありません
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredProducts.map((product) => {
                  const inCart = cartIds.has(product.id)
                  return (
                    <div key={product.id} className="relative group">
                      <button
                        type="button"
                        onClick={() => setDetailProduct(product)}
                        className={`w-full text-left bg-white rounded-lg border overflow-hidden hover:shadow-md transition-all ${
                          inCart ? 'border-pitch-navy ring-2 ring-pitch-navy/20' : 'border-slate-200 hover:border-pitch-navy'
                        }`}
                      >
                        <div className="aspect-square bg-slate-100 flex items-center justify-center">
                          {product.thumbnailUrl ? (
                            <img
                              src={product.thumbnailUrl}
                              alt={product.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <span className="text-slate-400 text-xs">画像なし</span>
                          )}
                        </div>
                        <div className="p-2.5">
                          <span className="text-[10px] text-slate-400">{product.category}</span>
                          <h3 className="text-xs font-semibold text-slate-800 mt-0.5 line-clamp-2 leading-tight">
                            {product.name}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">{product.brand}</p>
                          <p className="text-sm font-medium text-slate-800 mt-1">
                            ¥{product.price.toLocaleString()}
                          </p>
                        </div>
                      </button>

                      {/* カートに追加/削除ボタン */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onToggleCart(product.id) }}
                        className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-all z-10 ${
                          inCart
                            ? 'bg-pitch-navy text-white shadow-md'
                            : 'bg-white/90 text-gray-400 border border-gray-200 opacity-0 group-hover:opacity-100 hover:text-pitch-navy hover:border-pitch-navy'
                        }`}
                        title={inCart ? 'カートから削除' : 'カートに追加'}
                      >
                        {inCart ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6 pb-4">
                  <button
                    type="button"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-30 hover:bg-slate-50"
                  >
                    前へ
                  </button>
                  <div className="flex items-center gap-1">
                    {generatePageNumbers(page, totalPages).map((p, i) =>
                      p === '...' ? (
                        <span key={`dot-${i}`} className="px-1 text-slate-400">...</span>
                      ) : (
                        <button
                          key={p}
                          type="button"
                          onClick={() => handlePageChange(Number(p))}
                          className={`w-8 h-8 text-sm rounded-lg ${
                            Number(p) === page
                              ? 'bg-pitch-navy text-white'
                              : 'border border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          {p}
                        </button>
                      ),
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-30 hover:bg-slate-50"
                  >
                    次へ
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* フローティングバー: カートに商品がある場合 */}
      {cartIds.size > 0 && (
        <div className="shrink-0 bg-white border-t border-slate-200 px-4 py-3 flex items-center justify-between shadow-lg">
          <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <svg className="w-5 h-5 text-pitch-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
            {cartIds.size}件選択中
          </span>
          <button
            type="button"
            onClick={onGoHome}
            className="px-6 py-2 bg-pitch-navy text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            提案書を作成
          </button>
        </div>
      )}

      {showAddModal && (
        <ProductAddModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => { loadProducts(page, activeSearch || undefined) }}
        />
      )}

      <ProductDetailModal
        product={detailProduct}
        onClose={() => setDetailProduct(null)}
        cartAction={detailProduct ? (
          <button
            type="button"
            onClick={() => { if (detailProduct) onToggleCart(detailProduct.id) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              detailProduct && cartIds.has(detailProduct.id)
                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                : 'bg-pitch-navy text-white hover:opacity-90'
            }`}
          >
            {detailProduct && cartIds.has(detailProduct.id) ? 'カートから削除' : 'カートに追加'}
          </button>
        ) : undefined}
      />
    </div>
  )
}

function generatePageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | string)[] = [1]
  if (current > 3) pages.push('...')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i)
  }
  if (current < total - 2) pages.push('...')
  pages.push(total)
  return pages
}
