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
  proposalCount: number
}

type Step = 'input' | 'confirm' | 'generating'

export default function HomeView({ cartIds, onToggleCart, onClearCart, onProposalGenerated, proposalCount }: HomeViewProps) {
  const [step, setStep] = useState<Step>('input')
  const [error, setError] = useState('')
  const [showProposalModal, setShowProposalModal] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('park-pitch-onboarding-dismissed')
  })

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

  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false)
    localStorage.setItem('park-pitch-onboarding-dismissed', '1')
  }, [])

  // モーダルから生成を開始
  const handleOpenProposalModal = () => {
    if (cartIds.size === 0) {
      setError('商品を1つ以上選択してください')
      return
    }
    setError('')
    setShowProposalModal(true)
  }

  // 提案書生成
  const handleGenerate = async () => {
    if (cartIds.size === 0) {
      setError('商品を1つ以上選択してください')
      return
    }
    setShowProposalModal(false)
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
      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        <div className="w-12 h-12 border-[3px] border-[#e0e0e0] border-t-[#222] rounded-full animate-spin" />
        <div className="text-center">
          <h2 className="text-lg font-semibold text-[#222] tracking-tight">提案書を生成中...</h2>
          <p className="text-sm text-[#aaa] mt-2">AIが最適な提案書を作成しています（15-30秒）</p>
        </div>
      </div>
    )
  }

  // おまかせモード: 確認画面
  if (step === 'confirm' && aiMode && parsed) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 pt-10 pb-10">
          <button
            type="button"
            onClick={() => setStep('input')}
            className="flex items-center gap-1.5 text-[13px] text-[#aaa] hover:text-[#555] transition-opacity mb-6"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            全体検索に戻る
          </button>

          <h2 className="text-lg font-semibold text-[#222] tracking-tight mb-8">AI解析結果</h2>

          {/* AI推奨商品 */}
          <div className="mb-8">
            <h3 className="text-[13px] font-medium text-[#555] mb-4">
              おすすめ商品（{aiProducts.length}件）
              <span className="text-[#aaa] ml-2">選択中: {cartIds.size}件</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {aiProducts.map((product) => (
                <ProductSelectCard
                  key={product.id}
                  product={product}
                  selected={cartIds.has(product.id)}
                  favorited={isFavorite(product.id)}
                  onToggleFavorite={() => toggleFavorite(product.id)}
                  onToggleCart={() => onToggleCart(product.id)}
                  onClick={() => setSelectedProduct(product)}
                  badge={`#${product.rank}`}
                  tags={product.matchedTags}
                />
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50/80 border border-red-100 text-red-600 text-[13px] rounded-md">{error}</div>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setStep('input')} className="px-5 py-2 border border-[#e0e0e0] text-[#555] rounded-md text-[13px] font-medium hover:bg-[#f5f5f5] transition-colors">
              全体検索に戻る
            </button>
            <button type="button" onClick={handleOpenProposalModal} disabled={cartIds.size === 0} className="px-6 py-2 bg-[#222] text-white rounded-md text-[13px] font-medium hover:opacity-80 transition-opacity disabled:opacity-20">
              提案書を生成（{cartIds.size}件）
            </button>
          </div>
        </div>

        {/* 提案先情報モーダル */}
        {showProposalModal && (
          <ProposalInfoModal
            clientName={clientName}
            purpose={purpose}
            onClientNameChange={setClientName}
            onPurposeChange={setPurpose}
            onGenerate={handleGenerate}
            onClose={() => setShowProposalModal(false)}
            cartCount={cartIds.size}
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
                  className={`flex-1 px-4 py-2.5 rounded-md text-[13px] font-medium transition-all ${
                    cartIds.has(selectedProduct.id)
                      ? 'bg-[#fef2f2] text-red-500 border border-red-100 hover:bg-red-50'
                      : 'bg-[#222] text-white hover:opacity-80'
                  }`}
                >
                  {cartIds.has(selectedProduct.id) ? '提案から外す' : '提案に追加'}
                </button>
                <button
                  type="button"
                  onClick={() => toggleFavorite(selectedProduct.id)}
                  className={`px-3 py-2.5 rounded-md border transition-colors ${
                    isFavorite(selectedProduct.id)
                      ? 'bg-pink-50 border-pink-200 text-pink-500'
                      : 'border-[#e0e0e0] text-[#ccc] hover:text-pink-500'
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
      <div className="max-w-4xl mx-auto px-6 pt-10 pb-32">
        <h1 className="text-xl font-semibold text-center text-[#222] tracking-tight mb-1">Park-Pitch</h1>
        <p className="text-center text-[#aaa] text-[13px] mb-8">ノベルティ提案書ジェネレーター</p>

        {/* 初回オンボーディングガイド */}
        {showOnboarding && proposalCount === 0 && (
          <div className="mb-8 bg-white border border-[#e8e8e8] rounded-lg p-6 shadow-card">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-[13px] font-semibold text-[#222]">Park-Pitchの使い方</h3>
              <button
                type="button"
                onClick={dismissOnboarding}
                className="text-[#ccc] hover:text-[#888] transition-colors"
                aria-label="閉じる"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#222] text-white flex items-center justify-center text-[11px] font-semibold shrink-0">1</div>
                <div>
                  <p className="text-[13px] font-medium text-[#222]">商品を選ぶ</p>
                  <p className="text-[12px] text-[#aaa] mt-1 leading-relaxed">テキスト検索で探すか、「おまかせ」で自動選定</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#222] text-white flex items-center justify-center text-[11px] font-semibold shrink-0">2</div>
                <div>
                  <p className="text-[13px] font-medium text-[#222]">提案先情報を入力</p>
                  <p className="text-[12px] text-[#aaa] mt-1 leading-relaxed">企業名・用途を入力（AI解析なら自動入力）</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#222] text-white flex items-center justify-center text-[11px] font-semibold shrink-0">3</div>
                <div>
                  <p className="text-[13px] font-medium text-[#222]">提案書を自動生成</p>
                  <p className="text-[12px] text-[#aaa] mt-1 leading-relaxed">AIが数十秒で提案書を作成。PDF出力も可能</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 検索バー（セグメントコントロール統合） */}
        <form onSubmit={aiMode ? handleAiParse : (e) => e.preventDefault()} className="mb-5">
          <div className={`bg-white border rounded-lg shadow-card overflow-hidden transition-shadow ${
            aiMode ? 'border-[#d4a853]' : 'border-[#e8e8e8]'
          }`}>
            {/* セグメントコントロール */}
            <div className="flex border-b border-[#eee]">
              <button
                type="button"
                onClick={() => setAiMode(false)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-[13px] font-medium transition-colors ${
                  !aiMode
                    ? 'text-[#222] border-b-2 border-[#222]'
                    : 'text-[#aaa] hover:text-[#555]'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                テキスト検索
              </button>
              <button
                type="button"
                onClick={() => setAiMode(true)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-[13px] font-medium transition-colors ${
                  aiMode
                    ? 'text-[#8b6914] border-b-2 border-[#d4a853]'
                    : 'text-[#aaa] hover:text-[#555]'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  className="w-full px-4 pt-3 pb-2 text-[13px] text-[#222] resize-none border-0 focus:outline-none placeholder:text-[#ccc]"
                  placeholder="提案内容をテキストで入力してください...&#10;例: GODIVA様 夏のクーラーバッグキャンペーン 19,300個 単価250-300円 5月納品 ロゴ入れ"
                />
              ) : (
                <div className="flex items-center">
                  <svg className="w-4 h-4 text-[#ccc] ml-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="w-full px-3 py-3 text-[13px] text-[#222] border-0 focus:outline-none placeholder:text-[#ccc]"
                    placeholder="商品を絞り込み...（例: 海島綿、ハンドタオル、エコバッグ）"
                  />
                </div>
              )}
            </div>

            {/* AIモード時のみ送信ボタン */}
            {aiMode && (
              <div className="flex items-center justify-end px-3 py-2 border-t border-[#f0f0f0]">
                <button
                  type="submit"
                  disabled={!searchText.trim() || parsing}
                  className="flex items-center gap-2 px-5 py-2 rounded-md bg-[#222] text-white text-[13px] font-medium hover:opacity-80 transition-opacity disabled:opacity-20"
                >
                  {parsing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      解析中...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <div className="mt-3 p-2.5 bg-red-50/80 border border-red-100 text-red-600 text-[12px] rounded-md">{error}</div>
          )}
        </form>

        {/* タグセクション + お気に入りトグル（AIモードOFF時のみ） */}
        {!aiMode && (
          <div className="mb-5">
            {/* お気に入りトグル */}
            <div className="mb-2.5">
              <button
                type="button"
                onClick={() => setFavoritesOnly(!favoritesOnly)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                  favoritesOnly
                    ? 'bg-pink-50 text-pink-500 border border-pink-200'
                    : 'bg-[#f0f0f0] text-[#888] hover:bg-[#e8e8e8]'
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
            <span className="text-[12px] text-[#aaa] shrink-0">絞り込み:</span>
            {Array.from(selectedTags).map((tagId) => {
              const tag = TAGS.find((t) => t.id === tagId)
              if (!tag) return null
              return (
                <button
                  key={tagId}
                  type="button"
                  onClick={() => handleTagToggle(tagId, tag.group)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#222]/8 text-[#222] text-[12px] font-medium rounded-md hover:bg-[#222]/12 transition-colors"
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
              className="text-[12px] text-[#ccc] hover:text-red-500 transition-colors ml-1"
            >
              すべてクリア
            </button>
          </div>
        )}

        {/* ソート + 結果件数 */}
        {!aiMode && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[13px] font-medium text-[#555]">
              {hasActiveFilters || searchText.trim() || favoritesOnly
                ? `検索結果（${displayProducts.length}件）`
                : `人気ランキング（${displayProducts.length}件）`}
            </h3>
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="text-[12px] border border-[#e0e0e0] rounded-md px-2.5 py-1.5 text-[#555] focus:outline-none focus:ring-1 focus:ring-[#222]/20 bg-white"
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
              <div className="text-center py-16">
                <div className="w-8 h-8 border-[3px] border-[#e0e0e0] border-t-[#222] rounded-full animate-spin mx-auto mb-4" />
                <p className="text-[#aaa] text-[13px]">商品を読み込んでいます...</p>
              </div>
            ) : displayProducts.length === 0 ? (
              <div className="text-center py-16 text-[#aaa] text-[13px]">
                {hasActiveFilters || searchText.trim() || favoritesOnly
                  ? '該当する商品が見つかりませんでした'
                  : '商品がありません'}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {displayProducts.map((product) => (
                  <ProductSelectCard
                    key={product.id}
                    product={product}
                    selected={cartIds.has(product.id)}
                    favorited={isFavorite(product.id)}
                    onToggleFavorite={() => toggleFavorite(product.id)}
                    onToggleCart={() => onToggleCart(product.id)}
                    onClick={() => setSelectedProduct(product)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* フローティング提案バー（シンプル版） */}
      {cartIds.size > 0 && step === 'input' && (
        <FloatingProposalBar
          cartCount={cartIds.size}
          onGenerate={handleOpenProposalModal}
          onClear={onClearCart}
          error={error}
        />
      )}

      {/* 提案先情報モーダル */}
      {showProposalModal && (
        <ProposalInfoModal
          clientName={clientName}
          purpose={purpose}
          onClientNameChange={setClientName}
          onPurposeChange={setPurpose}
          onGenerate={handleGenerate}
          onClose={() => setShowProposalModal(false)}
          cartCount={cartIds.size}
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
                className={`flex-1 px-4 py-2.5 rounded-md text-[13px] font-medium transition-all ${
                  cartIds.has(selectedProduct.id)
                    ? 'bg-[#fef2f2] text-red-500 border border-red-100 hover:bg-red-50'
                    : 'bg-[#222] text-white hover:opacity-80'
                }`}
              >
                {cartIds.has(selectedProduct.id) ? '提案から外す' : '提案に追加'}
              </button>
              <button
                type="button"
                onClick={() => toggleFavorite(selectedProduct.id)}
                className={`px-3 py-2.5 rounded-md border transition-colors ${
                  isFavorite(selectedProduct.id)
                    ? 'bg-pink-50 border-pink-200 text-pink-500'
                    : 'border-[#e0e0e0] text-[#ccc] hover:text-pink-500'
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
    <div className="bg-white border border-[#e8e8e8] rounded-lg p-4 space-y-2.5 shadow-card">
      {TAG_GROUPS.map((group) => {
        const groupTags = TAGS.filter((t) => t.group === group.key)
        if (groupTags.length === 0) return null
        return (
          <div key={group.key} className="flex items-start gap-2">
            <span className="text-[12px] text-[#aaa] font-medium w-16 shrink-0 pt-0.5">{group.label}:</span>
            <div className="flex flex-wrap gap-1.5">
              {groupTags.map((tag) => {
                const isSelected = selectedTags.has(tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => onToggle(tag.id, tag.group)}
                    className={`px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors ${
                      isSelected
                        ? 'bg-[#222] text-white'
                        : 'bg-[#f5f5f5] text-[#555] hover:bg-[#eee]'
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

// --- フローティング提案バー（シンプル版） ---
function FloatingProposalBar({
  cartCount,
  onGenerate, onClear, error,
}: {
  cartCount: number
  onGenerate: () => void; onClear: () => void; error: string
}) {
  return (
    <div className="fixed bottom-0 left-14 right-0 z-30 print:hidden">
      <div className="bg-white/95 backdrop-blur-md border-t border-[#e8e8e8] shadow-bar">
        {error && (
          <div className="max-w-4xl mx-auto px-6 pt-2">
            <div className="p-2 bg-red-50/80 border border-red-100 text-red-600 text-[12px] rounded-md">{error}</div>
          </div>
        )}
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-[#222]">
              <span className="w-5 h-5 rounded-full bg-[#222] text-white flex items-center justify-center text-[11px] font-semibold">{cartCount}</span>
              件選択中
            </span>
            <button type="button" onClick={onClear} className="text-[12px] text-[#ccc] hover:text-red-500 transition-colors">
              クリア
            </button>
          </div>
          <button
            type="button"
            onClick={onGenerate}
            className="px-6 py-2 bg-[#222] text-white rounded-md text-[13px] font-medium hover:opacity-80 transition-opacity"
          >
            提案書を生成
          </button>
        </div>
      </div>
    </div>
  )
}

// --- 提案先情報モーダル ---
function ProposalInfoModal({
  clientName, purpose,
  onClientNameChange, onPurposeChange,
  onGenerate, onClose, cartCount,
}: {
  clientName: string; purpose: string
  onClientNameChange: (v: string) => void; onPurposeChange: (v: string) => void
  onGenerate: () => void; onClose: () => void; cartCount: number
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-modal w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-semibold text-[#222]">提案先情報</h3>
            <button type="button" onClick={onClose} className="text-[#ccc] hover:text-[#888] transition-colors" aria-label="閉じる">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-[12px] text-[#aaa] mt-1">提案書に反映される情報を入力してください（任意）</p>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-[12px] text-[#888] mb-1.5">提案先企業名</label>
            <input type="text" value={clientName} onChange={(e) => onClientNameChange(e.target.value)} className="w-full border border-[#e0e0e0] rounded-md px-3 py-2.5 text-[13px] text-[#222] focus:outline-none focus:border-[#222] transition-colors placeholder:text-[#ccc]" placeholder="例: GODIVA様" />
          </div>
          <div>
            <label className="block text-[12px] text-[#888] mb-1.5">用途</label>
            <input type="text" value={purpose} onChange={(e) => onPurposeChange(e.target.value)} className="w-full border border-[#e0e0e0] rounded-md px-3 py-2.5 text-[13px] text-[#222] focus:outline-none focus:border-[#222] transition-colors placeholder:text-[#ccc]" placeholder="夏のクーラーバッグキャンペーン等" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#f0f0f0] flex items-center justify-between">
          <span className="text-[12px] text-[#aaa]">{cartCount}件の商品を含む提案書</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-[#e0e0e0] text-[#555] rounded-md text-[13px] font-medium hover:bg-[#f5f5f5] transition-colors">
              キャンセル
            </button>
            <button type="button" onClick={onGenerate} className="px-6 py-2 bg-[#222] text-white rounded-md text-[13px] font-medium hover:opacity-80 transition-opacity">
              生成する
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
  onToggleCart,
  onClick,
  badge,
  tags,
}: {
  product: BloomingProduct
  selected: boolean
  favorited: boolean
  onToggleFavorite: () => void
  onToggleCart?: () => void
  onClick: () => void
  badge?: string
  tags?: string[]
}) {
  return (
    <div
      className={`relative bg-white border rounded-lg overflow-hidden transition-all hover:shadow-card-hover ${
        selected ? 'border-[#222] ring-1 ring-[#222]/10' : 'border-[#e8e8e8]'
      }`}
    >
      {/* カート状態（右上） */}
      {selected && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#222] flex items-center justify-center z-10">
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

      <div className="cursor-pointer" onClick={onClick}>
        <div className="aspect-square bg-[#f7f7f7] flex items-center justify-center">
          {product.thumbnailUrl ? (
            <img src={product.thumbnailUrl} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <span className="text-[#ccc] text-[12px]">画像なし</span>
          )}
        </div>

        <div className="p-3">
          {badge && (
            <span className="text-[10px] font-medium text-[#222] bg-[#f0f0f0] px-1.5 py-0.5 rounded mr-1">
              {badge}
            </span>
          )}
          <span className="text-[10px] text-[#aaa]">{product.category}</span>
          <h4 className="text-[12px] font-medium text-[#222] mt-0.5 line-clamp-2 leading-snug">{trimLeadingDash(product.name)}</h4>
          <p className="text-[11px] text-[#aaa] mt-0.5">{product.brand}</p>
          <p className="text-[13px] font-semibold text-[#222] mt-1.5">¥{product.price.toLocaleString()}</p>
          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {tags.slice(0, 3).map((tag) => (
                <span key={tag} className="text-[10px] bg-[#f0f5ff] text-[#4a7ab5] px-1.5 py-0.5 rounded">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 提案に追加/外すボタン（カード内部下部） */}
      {onToggleCart && (
        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleCart() }}
            className={`w-full px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
              selected
                ? 'bg-[#fef2f2] text-red-500 border border-red-100 hover:bg-red-50'
                : 'bg-[#222] text-white hover:opacity-80'
            }`}
          >
            {selected ? '提案から外す' : '提案に追加'}
          </button>
        </div>
      )}
    </div>
  )
}

// --- ヘルパー ---
function trimLeadingDash(name: string) {
  return name.replace(/^ー\s*/, '')
}
