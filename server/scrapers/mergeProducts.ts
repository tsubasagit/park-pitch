/**
 * 3ソースの商品データをマージ・重複排除
 * CSL (Shopify) → HG → 楽天 の優先度でマージ
 */
import fs from 'fs'
import { SCRAPED_CSL_PATH, SCRAPED_HG_PATH, SCRAPED_RAKUTEN_PATH, MERGED_PRODUCTS_PATH, DATA_DIR } from './config'

interface RawProduct {
  id: string
  source: string
  sourceUrl: string
  name: string
  brand: string
  price: number
  materials: string[]
  dimensions: string
  colors: string[]
  category: string
  gender: string
  collections: string[]
  thumbnailUrl: string
  imageUrls: string[]
  scrapedAt: string
}

interface MergedProduct extends RawProduct {
  mergedId: string
  sources: Array<{ source: string; sourceUrl: string; price: number }>
}

/** 商品名を正規化して比較キーを作成 */
function normalizeProductName(name: string): string {
  return name
    .replace(/[\s\u3000]+/g, '') // 全角・半角スペース除去
    .replace(/[【】\[\]()（）「」『』]/g, '') // 括弧除去
    .replace(/[！!？?。、.,]/g, '') // 句読点除去
    .toLowerCase()
    .trim()
}

/** 2商品が同一かどうかを判定 */
function isSameProduct(a: RawProduct, b: RawProduct): boolean {
  const nameA = normalizeProductName(a.name)
  const nameB = normalizeProductName(b.name)

  // 完全一致
  if (nameA === nameB) return true

  // 片方がもう片方を含む（かつ長い方の70%以上）
  if (nameA.includes(nameB) || nameB.includes(nameA)) {
    const shorter = Math.min(nameA.length, nameB.length)
    const longer = Math.max(nameA.length, nameB.length)
    if (shorter / longer > 0.7) return true
  }

  // 名前が似ていて価格が同じ
  if (a.price > 0 && a.price === b.price) {
    // レーベンシュタイン距離の簡易版: 共通文字数比率
    const commonChars = [...nameA].filter((c) => nameB.includes(c)).length
    const similarity = commonChars / Math.max(nameA.length, nameB.length)
    if (similarity > 0.8) return true
  }

  return false
}

/** ソース優先度: CSL > HG > 楽天 */
function sourcePriority(source: string): number {
  if (source === 'classics') return 3
  if (source === 'handkerchief-gallery') return 2
  if (source === 'rakuten') return 1
  return 0
}

function loadJSON<T>(path: string): T[] {
  if (!fs.existsSync(path)) {
    console.log(`[Merge] File not found, skipping: ${path}`)
    return []
  }
  const data = JSON.parse(fs.readFileSync(path, 'utf-8'))
  return Array.isArray(data) ? data : []
}

export function mergeProducts(): MergedProduct[] {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

  // 全ソースを読み込み
  const cslProducts = loadJSON<RawProduct>(SCRAPED_CSL_PATH)
  const hgProducts = loadJSON<RawProduct>(SCRAPED_HG_PATH)
  const rakutenProducts = loadJSON<RawProduct>(SCRAPED_RAKUTEN_PATH)

  console.log(`[Merge] Sources: CSL=${cslProducts.length}, HG=${hgProducts.length}, Rakuten=${rakutenProducts.length}`)

  // 全商品を優先度順に並べる
  const allProducts = [
    ...cslProducts,
    ...hgProducts,
    ...rakutenProducts,
  ].sort((a, b) => sourcePriority(b.source) - sourcePriority(a.source))

  const merged: MergedProduct[] = []
  const used = new Set<number>()

  for (let i = 0; i < allProducts.length; i++) {
    if (used.has(i)) continue
    used.add(i)

    const primary = allProducts[i]
    const sources = [{ source: primary.source, sourceUrl: primary.sourceUrl, price: primary.price }]

    // 重複を探す
    for (let j = i + 1; j < allProducts.length; j++) {
      if (used.has(j)) continue
      if (isSameProduct(primary, allProducts[j])) {
        used.add(j)
        const dup = allProducts[j]
        sources.push({ source: dup.source, sourceUrl: dup.sourceUrl, price: dup.price })

        // 足りない情報を補完
        if (primary.materials.length === 0 && dup.materials.length > 0) {
          primary.materials = dup.materials
        }
        if (!primary.dimensions && dup.dimensions) {
          primary.dimensions = dup.dimensions
        }
        if (primary.colors.length === 0 && dup.colors.length > 0) {
          primary.colors = dup.colors
        }
        if (!primary.gender && dup.gender) {
          primary.gender = dup.gender
        }
        if (primary.imageUrls.length === 0 && dup.imageUrls.length > 0) {
          primary.imageUrls = dup.imageUrls
          primary.thumbnailUrl = dup.thumbnailUrl
        }
      }
    }

    const mergedId = `bloom_${String(merged.length + 1).padStart(5, '0')}`
    merged.push({
      ...primary,
      mergedId,
      sources,
    })
  }

  const dupCount = allProducts.length - merged.length
  console.log(`[Merge] Result: ${merged.length} unique products (${dupCount} duplicates removed)`)

  // 統計
  const bySource: Record<string, number> = {}
  for (const p of merged) {
    bySource[p.source] = (bySource[p.source] || 0) + 1
  }
  console.log('[Merge] By primary source:', bySource)

  const multiSource = merged.filter((p) => p.sources.length > 1).length
  console.log(`[Merge] Multi-source products: ${multiSource}`)

  // 保存
  fs.writeFileSync(MERGED_PRODUCTS_PATH, JSON.stringify(merged, null, 2), 'utf-8')
  console.log(`[Merge] Saved to ${MERGED_PRODUCTS_PATH}`)

  return merged
}

// CLI実行
if (process.argv[1]?.endsWith('mergeProducts.ts')) {
  mergeProducts()
}
