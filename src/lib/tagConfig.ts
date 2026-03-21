/**
 * タグ定義 + buildSearchParams ヘルパー
 * タグ駆動の商品検索UIで使用
 */

export interface TagDefinition {
  id: string
  label: string
  group: TagGroupKey
  /** occasion/useCase タグ → q パラメータに結合 */
  searchKeywords?: string[]
  /** category/brand/price タグ → 構造化フィルタに変換 */
  filterOverrides?: {
    category?: string
    brand?: string
    budgetMin?: number
    budgetMax?: number
  }
}

export type TagGroupKey = 'occasion' | 'useCase' | 'category' | 'brand' | 'budget'

export interface TagGroup {
  key: TagGroupKey
  label: string
  /** true = 同グループ内1つだけ選択可 (radio) */
  radio: boolean
}

export const TAG_GROUPS: TagGroup[] = [
  { key: 'occasion', label: 'シーン', radio: false },
  { key: 'useCase', label: '用途', radio: false },
  { key: 'category', label: 'カテゴリ', radio: true },
  { key: 'brand', label: 'ブランド', radio: true },
  { key: 'budget', label: '予算', radio: true },
]

export const TAGS: TagDefinition[] = [
  // シーン（複数選択OK → searchKeywords で OR 検索）
  { id: 'occ-oseibo', label: 'お歳暮', group: 'occasion', searchKeywords: ['お歳暮', 'ギフト', '冬'] },
  { id: 'occ-ochugen', label: 'お中元', group: 'occasion', searchKeywords: ['お中元', 'ギフト', '夏'] },
  { id: 'occ-shochumimai', label: '暑中見舞い', group: 'occasion', searchKeywords: ['暑中見舞い', '夏', 'ギフト'] },
  { id: 'occ-trend', label: 'トレンド', group: 'occasion', searchKeywords: ['トレンド', '人気'] },
  { id: 'occ-gift', label: 'ギフト', group: 'occasion', searchKeywords: ['ギフト', '贈答'] },
  { id: 'occ-kinen', label: '記念品', group: 'occasion', searchKeywords: ['記念品', '記念'] },
  { id: 'occ-oiwai', label: 'お祝い', group: 'occasion', searchKeywords: ['お祝い', '祝', 'ギフト'] },
  { id: 'occ-corp', label: '企業ギフト', group: 'occasion', searchKeywords: ['企業', 'ビジネス', 'ギフト', '法人'] },

  // 用途（複数選択OK → searchKeywords で OR 検索）
  { id: 'use-campaign', label: 'キャンペーン景品', group: 'useCase', searchKeywords: ['キャンペーン', '景品', '販促'] },
  { id: 'use-logo', label: '企業ロゴ入れ', group: 'useCase', searchKeywords: ['ロゴ', '名入れ', 'カスタマイズ'] },
  { id: 'use-raijo', label: '来場記念', group: 'useCase', searchKeywords: ['来場', '記念', 'イベント'] },
  { id: 'use-hansoku', label: '販促品', group: 'useCase', searchKeywords: ['販促', 'ノベルティ', 'プロモーション'] },

  // カテゴリ（ラジオ → filterOverrides.category）
  { id: 'cat-towel', label: 'タオル', group: 'category', filterOverrides: { category: 'タオル' } },
  { id: 'cat-handkerchief', label: 'ハンカチ', group: 'category', filterOverrides: { category: 'ハンカチ' } },
  { id: 'cat-novelty', label: 'ノベルティ', group: 'category', filterOverrides: { category: 'ノベルティ' } },

  // ブランド（ラジオ → filterOverrides.brand）
  { id: 'brand-classics', label: 'CLASSICS', group: 'brand', filterOverrides: { brand: 'CLASSICS' } },
  { id: 'brand-option', label: 'OPTION', group: 'brand', filterOverrides: { brand: 'OPTION' } },
  { id: 'brand-bloomies', label: "bloomie's", group: 'brand', filterOverrides: { brand: "bloomie's" } },
  { id: 'brand-swatow', label: '汕頭', group: 'brand', filterOverrides: { brand: '汕頭' } },

  // 予算（ラジオ → filterOverrides.budgetMin/budgetMax）
  { id: 'budget-low', label: '~¥770', group: 'budget', filterOverrides: { budgetMax: 770 } },
  { id: 'budget-mid', label: '¥880~¥1,980', group: 'budget', filterOverrides: { budgetMin: 880, budgetMax: 1980 } },
  { id: 'budget-high', label: '¥2,200~¥3,300', group: 'budget', filterOverrides: { budgetMin: 2200, budgetMax: 3300 } },
  { id: 'budget-premium', label: '¥3,850~', group: 'budget', filterOverrides: { budgetMin: 3850 } },
]

/** タグID → TagDefinition のルックアップ */
const TAG_MAP = new Map(TAGS.map((t) => [t.id, t]))

export type SortBy = 'giftScore' | 'price-asc' | 'price-desc'

/**
 * クライアント側フィルタリング: 全商品配列からタグ・テキスト・お気に入りで絞り込み＆ソート
 */
export function filterProducts(
  products: import('../types').BloomingProduct[],
  selectedTags: Set<string>,
  searchText: string,
  sortBy: SortBy,
  favoritesOnly: boolean,
  favorites: Set<string>,
): import('../types').BloomingProduct[] {
  let result = products

  // お気に入りフィルタ
  if (favoritesOnly) {
    result = result.filter((p) => favorites.has(p.id))
  }

  // タグフィルタ
  for (const tagId of selectedTags) {
    const tag = TAG_MAP.get(tagId)
    if (!tag) continue

    if (tag.filterOverrides) {
      const o = tag.filterOverrides
      if (o.category) {
        result = result.filter((p) => p.category === o.category)
      }
      if (o.brand) {
        result = result.filter((p) => p.brand.includes(o.brand!))
      }
      if (o.budgetMin != null) {
        result = result.filter((p) => p.price >= o.budgetMin!)
      }
      if (o.budgetMax != null) {
        result = result.filter((p) => p.price <= o.budgetMax!)
      }
    }

    if (tag.searchKeywords && tag.searchKeywords.length > 0) {
      const kws = tag.searchKeywords.map((k) => k.toLowerCase())
      result = result.filter((p) => {
        const allTags = [...(p.occasionTags || []), ...(p.useCaseTags || [])].map((t) => t.toLowerCase())
        const searchable = [
          p.name.toLowerCase(),
          p.aiSummary?.toLowerCase() || '',
          ...allTags,
        ]
        return kws.some((kw) => searchable.some((s) => s.includes(kw)))
      })
    }
  }

  // テキストフィルタ（全語 AND マッチ）
  if (searchText.trim()) {
    const terms = searchText.trim().toLowerCase().split(/\s+/).filter(Boolean)
    result = result.filter((p) => {
      const name = p.name.toLowerCase()
      const brand = p.brand.toLowerCase()
      const summary = (p.aiSummary || '').toLowerCase()
      const cat = p.category.toLowerCase()
      const tags = [...(p.occasionTags || []), ...(p.useCaseTags || [])].map((t) => t.toLowerCase())
      return terms.every(
        (t) => name.includes(t) || brand.includes(t) || summary.includes(t) || cat.includes(t) || tags.some((tag) => tag.includes(t)),
      )
    })
  }

  // ソート
  result = [...result]
  if (sortBy === 'price-asc') {
    result.sort((a, b) => a.price - b.price)
  } else if (sortBy === 'price-desc') {
    result.sort((a, b) => b.price - a.price)
  } else {
    result.sort((a, b) => (b.giftScore ?? 0) - (a.giftScore ?? 0))
  }

  return result
}

export interface SearchParams {
  q?: string
  /** タグ由来のキーワード（occasion/useCase）— q とは別に OR フィルタとして適用 */
  keywords?: string
  category?: string
  brand?: string
  budgetMin?: number
  budgetMax?: number
  sort?: string
}

/**
 * 選択中タグ + テキスト入力 → API クエリパラメータに変換
 *
 * - occasion/useCase タグ → `keywords` パラメータ（OR フィルタ）
 * - テキスト入力 → `q` パラメータ（AND テキスト検索）
 * - category/brand/budget タグ → 構造化フィルタ（AND）
 *
 * サーバー側: keywords OR フィルタ → AND category/brand/budget → AND q テキスト検索
 */
export function buildSearchParams(
  selectedTags: Set<string>,
  searchText: string,
  sortBy: string,
): SearchParams {
  const params: SearchParams = {}

  const tagKeywords: string[] = []
  let category: string | undefined
  let brand: string | undefined
  let budgetMin: number | undefined
  let budgetMax: number | undefined

  for (const tagId of selectedTags) {
    const tag = TAG_MAP.get(tagId)
    if (!tag) continue

    if (tag.searchKeywords) {
      tagKeywords.push(...tag.searchKeywords)
    }
    if (tag.filterOverrides) {
      if (tag.filterOverrides.category) category = tag.filterOverrides.category
      if (tag.filterOverrides.brand) brand = tag.filterOverrides.brand
      if (tag.filterOverrides.budgetMin != null) budgetMin = tag.filterOverrides.budgetMin
      if (tag.filterOverrides.budgetMax != null) budgetMax = tag.filterOverrides.budgetMax
    }
  }

  // テキスト入力 → q（AND検索）
  if (searchText.trim()) params.q = searchText.trim()
  // タグ由来キーワード → keywords（ORフィルタ、q とは独立）
  if (tagKeywords.length > 0) params.keywords = [...new Set(tagKeywords)].join(' ')

  if (category) params.category = category
  if (brand) params.brand = brand
  if (budgetMin != null) params.budgetMin = budgetMin
  if (budgetMax != null) params.budgetMax = budgetMax
  if (sortBy) params.sort = sortBy

  return params
}
