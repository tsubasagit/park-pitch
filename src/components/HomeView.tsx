import { useState, useEffect, useCallback, useMemo, type FormEvent } from 'react'
import type { Proposal, BloomingProduct, ParsedRequest } from '../types'
import { parseRequest, generateProposal, getBloomingProducts } from '../api/client'
import { TAG_GROUPS, TAGS, filterProducts, type TagGroupKey, type SortBy } from '../lib/tagConfig'
import { useFavorites } from '../hooks/useFavorites'
import ProductDetailModal from './blooming/ProductDetailModal'

interface HomeViewProps {
  cartIds: Set<string>
  onToggleCart: (id: string) => void
  onClearCart: () => void
  onProposalGenerated: (proposal: Proposal) => void
}

type Step = 'input' | 'confirm' | 'generating'

export default function HomeView({ cartIds, onToggleCart, onClearCart, onProposalGenerated }: HomeViewProps) {
  const [step, setStep] = useState<Step>('input')
  const [error, setError] = useState('')

  // 全商品（初回ロード）
  const [allProducts, setAllProducts] = useState<BloomingProduct[]>([])
  const [loading, setLoading] = useState(true)

  // フィルタ
  const [searchText, setSearchText] = useState('')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<SortBy>('giftScore')
  const [favoritesOnly, setFavoritesOnly] = useState(false)

  // お気に入り
  const { favorites, toggleFavorite, isFavorite } = useFavorites()

  // 詳細モーダル
  const [selectedProduct, setSelectedProduct] = useState<BloomingProduct | null>(null)

  // おまかせモード（AI解析）
  const [aiMode, setAiMode] = useState(false)
  const [parsed, setParsed] = useState<ParsedRequest | null>(null)
  const [aiProducts, setAiProducts] = useState<(BloomingProduct & { rank: number; score: number; matchedTags: string[] })[]>([])
  const [parsing, setParsing] = useState(false)

  // 提案先情報（手入力）
  const [clientName, setClientName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unitPriceMin, setUnitPriceMin] = useState('')
  const [unitPriceMax, setUnitPriceMax] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [customization, setCustomization] = useState('')

  // 初回: 全商品をロード
  const loadAllProducts = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getBloomingProducts({ perPage: 500, sort: 'giftScore' })
      setAllProducts(data.items)
    } catch {
      setAllProducts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAllProducts()
  }, [loadAllProducts])

  // クライアント側フィルタ（即時）
  const displayProducts = useMemo(
    () => filterProducts(allProducts, selectedTags, searchText, sortBy, favoritesOnly, favorites),
    [allProducts, selectedTags, searchText, sortBy, favoritesOnly, favorites],
  )

  // タグトグル（グループ内ラジオ/複数選択を制御）
  const handleTagToggle = useCallback((tagId: string, group: TagGroupKey) => {
    setSelectedTags((prev) => {
      const next = new Set(prev)
      const groupDef = TAG_GROUPS.find((g) => g.key === group)

      if (next.has(tagId)) {
        next.delete(tagId)
      } else if (groupDef?.radio) {
        const groupTagIds = TAGS.filter((t) => t.group === group).map((t) => t.id)
        for (const id of groupTagIds) next.delete(id)
        next.add(tagId)
      } else {
        next.add(tagId)
      }
      return next
    })
  }, [])

  // おまかせモード: AI parse
  const handleAiParse = async (e: FormEvent) => {
    e.preventDefault()
    if (!searchText.trim()) return
    setParsing(true)
    setError('')
    try {
      const result = await parseRequest(searchText)
      setParsed(result.parsed)
      setAiProducts(result.recommendedProducts)
      if (result.parsed.clientName && !clientName) setClientName(result.parsed.clientName)
      if (result.parsed.purpose && !purpose) setPurpose(result.parsed.purpose)
      if (result.parsed.quantity && !quantity) setQuantity(String(result.parsed.quantity))
      if (result.parsed.unitPriceMin && !unitPriceMin) setUnitPriceMin(String(result.parsed.unitPriceMin))
      if (result.parsed.unitPriceMax && !unitPriceMax) setUnitPriceMax(String(result.parsed.unitPriceMax))
      if (result.parsed.deliveryDate && !deliveryDate) setDeliveryDate(result.parsed.deliveryDate)
      if (result.parsed.customization && !customization) setCustomization(result.parsed.customization)
      result.recommendedProducts.slice(0, 3).forEach((p) => {
        if (!cartIds.has(p.id)) onToggleCart(p.id)
      })
      setStep('confirm')
    } catch (err) {
      setError(err instanceof Error ? err.message : '解析に失敗しました')
    } finally {
      setParsing(false)
    }
  }

  // 提案書生成
  const handleGenerate = async () => {
    if (cartIds.size === 0) {
      setError('商品を1つ以上選択してください')
      return
    }
    setStep('generating')
    setError('')
    try {
      const proposal = await generateProposal({
        freeText: searchText,
        clientName,
        purpose,
        productIds: Array.from(cartIds),
        quantity: quantity ? Number(quantity) : undefined,
        unitPriceMin: unitPriceMin ? Number(unitPriceMin) : undefined,
        unitPriceMax: unitPriceMax ? Number(unitPriceMax) : undefined,
        deliveryDate: deliveryDate || undefined,
        customization: customization || undefined,
      })
      onProposalGenerated(proposal)
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成に失敗しました')
      setStep(aiMode && parsed ? 'confirm' : 'input')
    }
  }

  // 生成中画面
  if (step === 'generating') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <div className="w-14 h-14 border-4 border-pitch-navy/20 border-t-pitch-navy rounded-full animate-spin" />
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">提案書を生成中...</h2>
          <p className="text-sm text-gray-500 mt-2">AIが最適な提案書を作成しています（15-30秒）</p>
        </div>
      </div>
    )
  }

  // おまかせモード: 確認画面
  if (step === 'confirm' && aiMode && parsed) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 pt-8 pb-8">
          <button
            type="button"
            onClick={() => setStep('input')}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            全体検索に戻る
          </button>

          <h2 className="text-xl font-bold text-gray-900 mb-6">AI解析結果</h2>

          {/* AI推奨商品 */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              おすすめ商品（{aiProducts.length}件）
              <span className="text-xs font-normal text-gray-400 ml-2">カート: {cartIds.size}件</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {aiProducts.map((product) => (
                <div key={product.id} className="flex flex-col">
                  <ProductSelectCard
                    product={product}
                    selected={cartIds.has(product.id)}
                    favorited={isFavorite(product.id)}
                    onToggleFavorite={() => toggleFavorite(product.id)}
                    onClick={() => setSelectedProduct(product)}
                    badge={`#${product.rank}`}
                    tags={product.matchedTags}
                  />
                  <button
                    type="button"
                    onClick={() => onToggleCart(product.id)}
                    className={`mt-1.5 w-full px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                      cartIds.has(product.id)
                        ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                        : 'bg-pitch-navy text-white hover:opacity-90'
                    }`}
                  >
                    {cartIds.has(product.id) ? 'カートから削除' : 'カートに追加'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setStep('input')} className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
              全体検索に戻る
            </button>
            <button type="button" onClick={handleGenerate} disabled={cartIds.size === 0} className="px-8 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-bold shadow-md hover:bg-orange-600 transition-colors disabled:opacity-30">
              提案書を生成（{cartIds.size}件）
            </button>
          </div>
        </div>

        {/* 詳細モーダル */}
        {selectedProduct && (
          <ProductDetailModal
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
            cartAction={
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onToggleCart(selectedProduct.id)}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                    cartIds.has(selectedProduct.id)
                      ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                      : 'bg-pitch-navy text-white hover:opacity-90'
                  }`}
                >
                  {cartIds.has(selectedProduct.id) ? 'カートから削除' : 'カートに追加'}
                </button>
                <button
                  type="button"
                  onClick={() => toggleFavorite(selectedProduct.id)}
                  className={`px-3 py-2.5 rounded-lg border transition-colors ${
                    isFavorite(selectedProduct.id)
                      ? 'bg-pink-50 border-pink-200 text-pink-500'
                      : 'border-gray-200 text-gray-400 hover:text-pink-500'
                  }`}
                  aria-label="お気に入り"
                >
                  <svg className="w-5 h-5" fill={isFavorite(selectedProduct.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
              </div>
            }
          />
        )}
      </div>
    )
  }

  // メイン入力画面
  const hasActiveFilters = selectedTags.size > 0

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 pt-8 pb-32">
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-1">Park-Pitch</h1>
        <p className="text-center text-gray-500 text-sm mb-6">ノベルティ提案書ジェネレーター</p>

        {/* 検索バー（セグメントコントロール統合） */}
        <form onSubmit={aiMode ? handleAiParse : (e) => e.preventDefault()} className="mb-4">
          <div className={`bg-white border rounded-xl shadow-sm overflow-hidden ${
            aiMode ? 'border-amber-300 ring-2 ring-amber-100' : 'border-gray-200'
          }`}>
            {/* セグメントコントロール */}
            <div className="flex border-b border-gray-200">
              <button
                type="button"
                onClick={() => setAiMode(false)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-colors ${
                  !aiMode
                    ? 'text-pitch-navy border-b-2 border-pitch-navy bg-pitch-navy/5'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                テキスト検索
              </button>
              <button
                type="button"
                onClick={() => setAiMode(true)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-colors ${
                  aiMode
                    ? 'text-amber-700 border-b-2 border-amber-500 bg-amber-50/50'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                おまかせ（AI解析）
              </button>
            </div>

            {/* 入力エリア */}
            <div className="relative">
              {aiMode ? (
                <textarea
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  rows={4}
                  className="w-full px-4 pt-3 pb-2 text-sm resize-none border-0 focus:outline-none"
                  placeholder="提案内容をテキストで入力してください...&#10;例: GODIVA様 夏のクーラーバッグキャンペーン 19,300個 単価250-300円 5月納品 ロゴ入れ"
                />
              ) : (
                <div className="flex items-center">
                  <svg className="w-4 h-4 text-gray-400 ml-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="w-full px-3 py-3 text-sm border-0 focus:outline-none"
                    placeholder="表示中の商品を絞り込み...（例: 海島綿、ハンドタオル、エコバッグ）"
                  />
                </div>
              )}
            </div>

            {/* AIモード時のみ送信ボタン */}
            {aiMode && (
              <div className="flex items-center justify-end px-3 py-2 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={!searchText.trim() || parsing}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-600 text-white text-sm font-bold shadow-md hover:bg-amber-700 transition-colors disabled:opacity-30"
                >
                  {parsing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      解析中...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      AIにおまかせ
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-3 p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">{error}</div>
          )}
        </form>

        {/* タグセクション + お気に入りトグル（AIモードOFF時のみ） */}
        {!aiMode && (
          <div className="mb-4">
            {/* お気に入りトグル */}
            <div className="mb-2">
              <button
                type="button"
                onClick={() => setFavoritesOnly(!favoritesOnly)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  favoritesOnly
                    ? 'bg-pink-50 text-pink-600 border border-pink-200'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill={favoritesOnly ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                お気に入りのみ{favorites.size > 0 && `（${favorites.size}）`}
              </button>
            </div>

            <TagSelector
              selectedTags={selectedTags}
              onToggle={handleTagToggle}
            />
          </div>
        )}

        {/* 絞り込みバー: 選択中タグ + クリア */}
        {!aiMode && hasActiveFilters && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-xs text-gray-500 shrink-0">絞り込み:</span>
            {Array.from(selectedTags).map((tagId) => {
              const tag = TAGS.find((t) => t.id === tagId)
              if (!tag) return null
              return (
                <button
                  key={tagId}
                  type="button"
                  onClick={() => handleTagToggle(tagId, tag.group)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-pitch-navy/10 text-pitch-navy text-xs font-medium rounded-full hover:bg-pitch-navy/20 transition-colors"
                >
                  {tag.label}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setSelectedTags(new Set())}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors ml-1"
            >
              すべてクリア
            </button>
          </div>
        )}

        {/* ソート + 結果件数 */}
        {!aiMode && (
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">
              {hasActiveFilters || searchText.trim() || favoritesOnly
                ? `検索結果（${displayProducts.length}件）`
                : `人気ランキング（${displayProducts.length}件）`}
            </h3>
            <div className="flex items-center gap-2">
              {displayProducts.length > 0 && (
                <span className="text-xs text-gray-400 hidden sm:inline">クリックで詳細を表示</span>
              )}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-pitch-navy/50 bg-white"
              >
                <option value="giftScore">おすすめ順</option>
                <option value="price-asc">価格安い順</option>
                <option value="price-desc">価格高い順</option>
              </select>
            </div>
          </div>
        )}

        {/* 商品グリッド */}
        {!aiMode && (
          <>
            {loading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-3 border-pitch-navy/20 border-t-pitch-navy rounded-full animate-spin mx-auto mb-3" />
                <p className="text-gray-400 text-sm">商品を読み込んでいます...</p>
              </div>
            ) : displayProducts.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                {hasActiveFilters || searchText.trim() || favoritesOnly
                  ? '該当する商品が見つかりませんでした'
                  : '商品がありません'}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {displayProducts.map((product) => (
                  <ProductSelectCard
                    key={product.id}
                    product={product}
                    selected={cartIds.has(product.id)}
                    favorited={isFavorite(product.id)}
                    onToggleFavorite={() => toggleFavorite(product.id)}
                    onClick={() => setSelectedProduct(product)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* フローティング提案バー */}
      {cartIds.size > 0 && step === 'input' && (
        <FloatingProposalBar
          cartCount={cartIds.size}
          clientName={clientName}
          purpose={purpose}
          quantity={quantity}
          unitPriceMin={unitPriceMin}
          unitPriceMax={unitPriceMax}
          deliveryDate={deliveryDate}
          customization={customization}
          onClientNameChange={setClientName}
          onPurposeChange={setPurpose}
          onQuantityChange={setQuantity}
          onUnitPriceMinChange={setUnitPriceMin}
          onUnitPriceMaxChange={setUnitPriceMax}
          onDeliveryDateChange={setDeliveryDate}
          onCustomizationChange={setCustomization}
          onGenerate={handleGenerate}
          onClear={onClearCart}
          error={error}
        />
      )}

      {/* 詳細モーダル */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          cartAction={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onToggleCart(selectedProduct.id)}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                  cartIds.has(selectedProduct.id)
                    ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                    : 'bg-pitch-navy text-white hover:opacity-90'
                }`}
              >
                {cartIds.has(selectedProduct.id) ? 'カートから削除' : 'カートに追加'}
              </button>
              <button
                type="button"
                onClick={() => toggleFavorite(selectedProduct.id)}
                className={`px-3 py-2.5 rounded-lg border transition-colors ${
                  isFavorite(selectedProduct.id)
                    ? 'bg-pink-50 border-pink-200 text-pink-500'
                    : 'border-gray-200 text-gray-400 hover:text-pink-500'
                }`}
                aria-label="お気に入り"
              >
                <svg className="w-5 h-5" fill={isFavorite(selectedProduct.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
            </div>
          }
        />
      )}

    </div>
  )
}

// --- タグセレクター ---
function TagSelector({
  selectedTags,
  onToggle,
}: {
  selectedTags: Set<string>
  onToggle: (tagId: string, group: TagGroupKey) => void
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2.5">
      {TAG_GROUPS.map((group) => {
        const groupTags = TAGS.filter((t) => t.group === group.key)
        if (groupTags.length === 0) return null
        return (
          <div key={group.key} className="flex items-start gap-2">
            <span className="text-xs text-gray-500 font-medium w-16 shrink-0 pt-1">{group.label}:</span>
            <div className="flex flex-wrap gap-1.5">
              {groupTags.map((tag) => {
                const isSelected = selectedTags.has(tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => onToggle(tag.id, tag.group)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      isSelected
                        ? 'bg-pitch-navy text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tag.label}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// --- フローティング提案バー ---
function FloatingProposalBar({
  cartCount,
  clientName, purpose, quantity, unitPriceMin, unitPriceMax, deliveryDate, customization,
  onClientNameChange, onPurposeChange, onQuantityChange, onUnitPriceMinChange, onUnitPriceMaxChange, onDeliveryDateChange, onCustomizationChange,
  onGenerate, onClear, error,
}: {
  cartCount: number
  clientName: string; purpose: string; quantity: string; unitPriceMin: string; unitPriceMax: string; deliveryDate: string; customization: string
  onClientNameChange: (v: string) => void; onPurposeChange: (v: string) => void; onQuantityChange: (v: string) => void
  onUnitPriceMinChange: (v: string) => void; onUnitPriceMaxChange: (v: string) => void; onDeliveryDateChange: (v: string) => void; onCustomizationChange: (v: string) => void
  onGenerate: () => void; onClear: () => void; error: string
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="fixed bottom-0 left-14 right-0 z-30 print:hidden">
      <div className="bg-white border-t border-gray-200 shadow-lg">
        {/* 展開時: 提案先情報フォーム */}
        {expanded && (
          <div className="max-w-4xl mx-auto px-4 pt-4 pb-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">提案先企業名</label>
                <input type="text" value={clientName} onChange={(e) => onClientNameChange(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-pitch-navy/50" placeholder="例: GODIVA様" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">用途</label>
                <input type="text" value={purpose} onChange={(e) => onPurposeChange(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-pitch-navy/50" placeholder="キャンペーン等" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">数量</label>
                <input type="number" value={quantity} onChange={(e) => onQuantityChange(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-pitch-navy/50" placeholder="19300" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">納品希望日</label>
                <input type="date" value={deliveryDate} onChange={(e) => onDeliveryDateChange(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-pitch-navy/50" />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">単価下限（円）</label>
                <input type="number" value={unitPriceMin} onChange={(e) => onUnitPriceMinChange(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-pitch-navy/50" placeholder="250" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">単価上限（円）</label>
                <input type="number" value={unitPriceMax} onChange={(e) => onUnitPriceMaxChange(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-pitch-navy/50" placeholder="300" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">カスタマイズ要望</label>
                <input type="text" value={customization} onChange={(e) => onCustomizationChange(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-pitch-navy/50" placeholder="ロゴ入れ等" />
              </div>
            </div>
            {error && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">{error}</div>
            )}
          </div>
        )}

        {/* メインバー */}
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <svg className="w-5 h-5 text-pitch-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              {cartCount}件選択中
            </span>
            <button type="button" onClick={onClear} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
              クリア
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              提案先情報
            </button>
            <button
              type="button"
              onClick={onGenerate}
              className="px-6 py-2 bg-orange-500 text-white rounded-lg text-sm font-bold shadow-md hover:bg-orange-600 transition-colors"
            >
              提案書を生成
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- 商品選択カード ---
function ProductSelectCard({
  product,
  selected,
  favorited,
  onToggleFavorite,
  onClick,
  badge,
  tags,
}: {
  product: BloomingProduct
  selected: boolean
  favorited: boolean
  onToggleFavorite: () => void
  onClick: () => void
  badge?: string
  tags?: string[]
}) {
  return (
    <div
      onClick={onClick}
      className={`relative bg-white border rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-md ${
        selected ? 'border-pitch-navy ring-2 ring-pitch-navy/20' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* カート状態（右上） */}
      {selected && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-pitch-navy border-2 border-pitch-navy flex items-center justify-center z-10">
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* お気に入りハート（左上） */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleFavorite() }}
        className={`absolute top-2 left-2 z-10 p-1 rounded-full transition-colors ${
          favorited ? 'text-pink-500' : 'text-white/70 hover:text-pink-400'
        }`}
        aria-label="お気に入り"
        style={{ filter: favorited ? 'none' : 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
      >
        <svg className="w-4 h-4" fill={favorited ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      </button>

      <div className="aspect-square bg-gray-100 flex items-center justify-center">
        {product.thumbnailUrl ? (
          <img src={product.thumbnailUrl} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span className="text-gray-400 text-xs">画像なし</span>
        )}
      </div>

      <div className="p-2.5">
        {badge && (
          <span className="text-[10px] font-medium text-pitch-navy bg-pitch-navy/10 px-1.5 py-0.5 rounded mr-1">
            {badge}
          </span>
        )}
        <span className="text-[10px] text-gray-400">{product.category}</span>
        <h4 className="text-xs font-semibold text-gray-900 mt-0.5 line-clamp-2 leading-tight">{product.name}</h4>
        <p className="text-[11px] text-gray-500 mt-0.5">{product.brand}</p>
        <p className="text-sm font-medium text-gray-800 mt-1">¥{product.price.toLocaleString()}</p>
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// --- ヘルパー ---
