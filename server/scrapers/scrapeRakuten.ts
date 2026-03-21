/**
 * 楽天 CSL商品 スクレイパー
 * 楽天市場の検索結果ページからCSL商品の補完データを取得
 */
import * as cheerio from 'cheerio'
import fs from 'fs'
import { RAKUTEN_SEARCH_URL, RAKUTEN_SHOP_KEYWORD, REQUEST_DELAY_MS, SCRAPED_RAKUTEN_PATH, DATA_DIR, sleep } from './config'

interface RakutenRawProduct {
  id: string
  source: 'rakuten'
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

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
  return res.text()
}

/** 検索結果ページから商品情報を抽出 */
function parseSearchResults(html: string): RakutenRawProduct[] {
  const $ = cheerio.load(html)
  const products: RakutenRawProduct[] = []

  // 楽天の検索結果アイテム
  $('.searchresultitem, .dui-card, [data-ratid]').each((_, el) => {
    try {
      const $el = $(el)

      // 商品名
      const nameEl = $el.find('.content.title a, h2 a, .title a').first()
      const name = nameEl.text().trim()
      if (!name) return

      // URL
      const sourceUrl = nameEl.attr('href') || ''

      // 価格
      const priceText = $el.find('.important, .price, .price--OX_YW').first().text()
      const priceMatch = priceText.replace(/,/g, '').match(/(\d+)/)
      const price = priceMatch ? Number(priceMatch[1]) : 0

      // 画像
      const imgEl = $el.find('img').first()
      const thumbnailUrl = imgEl.attr('src') || imgEl.attr('data-src') || ''

      // カテゴリ・性別推定
      const nameLower = name.toLowerCase()
      let category = 'ハンカチ'
      if (nameLower.includes('タオル')) category = 'タオル'
      else if (nameLower.includes('エコバッグ') || nameLower.includes('bag')) category = 'エコバッグ'
      else if (nameLower.includes('ノベルティ')) category = 'ノベルティ'

      let gender = ''
      if (nameLower.includes('メンズ') || nameLower.includes('紳士')) gender = 'mens'
      else if (nameLower.includes('レディース') || nameLower.includes('婦人')) gender = 'womens'
      else if (nameLower.includes('キッズ') || nameLower.includes('子供')) gender = 'kids'

      // 素材推定
      const materials: string[] = []
      const materialPatterns = ['綿', 'コットン', 'シルク', '絹', 'リネン', '麻', 'ポリエステル', 'ナイロン', 'レーヨン']
      for (const mat of materialPatterns) {
        if (name.includes(mat)) materials.push(mat)
      }

      // ID生成
      const urlHash = sourceUrl.match(/\/([^/]+)\/?$/)?.[1] || Date.now().toString()
      const id = `rakuten_${urlHash.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)}`

      products.push({
        id,
        source: 'rakuten',
        sourceUrl,
        name,
        brand: 'CLASSICS the Small Luxury',
        price,
        materials,
        dimensions: '',
        colors: [],
        category,
        gender,
        collections: [],
        thumbnailUrl,
        imageUrls: thumbnailUrl ? [thumbnailUrl] : [],
        scrapedAt: new Date().toISOString(),
      })
    } catch {
      // skip malformed items
    }
  })

  return products
}

/** 検索結果の最大ページ数を取得 */
function getMaxPage(html: string): number {
  const $ = cheerio.load(html)
  let maxPage = 1

  // ページネーションからページ数取得
  $('.item.-next, .pagination a, [class*="pager"] a').each((_, el) => {
    const href = $(el).attr('href') || ''
    const match = href.match(/p=(\d+)/)
    if (match) {
      const p = Number(match[1])
      if (p > maxPage && p < 100) maxPage = p
    }
  })

  // 検索結果件数からも推定（45件/ページ）
  const countText = $('.count, .result-count, [class*="count"]').text()
  const countMatch = countText.replace(/,/g, '').match(/(\d+)\s*件/)
  if (countMatch) {
    const total = Number(countMatch[1])
    const estimated = Math.ceil(total / 45)
    if (estimated > maxPage && estimated < 100) maxPage = estimated
  }

  return Math.min(maxPage, 10) // 最大10ページまで
}

/** モック用サンプルデータを出力（ネットワーク不要） */
function writeMockRakuten(): RakutenRawProduct[] {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  const now = new Date().toISOString()
  const products: RakutenRawProduct[] = [
    { id: 'rakuten_mock_1', source: 'rakuten', sourceUrl: 'https://item.rakuten.co.jp/csl/sample1/', name: '10周年記念 ハンカチセット', brand: 'CLASSICS the Small Luxury', price: 3300, materials: ['綿'], dimensions: '', colors: [], category: 'ハンカチ', gender: 'unisex', collections: [], thumbnailUrl: '', imageUrls: [], scrapedAt: now },
  ]
  fs.writeFileSync(SCRAPED_RAKUTEN_PATH, JSON.stringify(products, null, 2), 'utf-8')
  console.log(`[Rakuten] Mock: wrote ${products.length} samples to ${SCRAPED_RAKUTEN_PATH}`)
  return products
}

export async function scrapeRakuten(): Promise<RakutenRawProduct[]> {
  const useMock = process.env.MOCK === '1' || process.argv.includes('--mock')
  if (useMock) return writeMockRakuten()

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

  const products: RakutenRawProduct[] = []
  const seenNames = new Set<string>()

  // CSL の楽天ショップ検索
  const searchUrl = `${RAKUTEN_SEARCH_URL}/${encodeURIComponent(RAKUTEN_SHOP_KEYWORD)}/?p=1`
  console.log('[Rakuten] Fetching first page:', searchUrl)

  let firstHtml: string
  try {
    firstHtml = await fetchText(searchUrl)
  } catch (err) {
    console.error('[Rakuten] Failed to fetch search page:', (err as Error).message)
    console.log('[Rakuten] Saving empty result (rakuten is supplementary data)')
    fs.writeFileSync(SCRAPED_RAKUTEN_PATH, JSON.stringify([], null, 2), 'utf-8')
    return []
  }

  const maxPage = getMaxPage(firstHtml)
  console.log(`[Rakuten] Max pages: ${maxPage}`)

  // 1ページ目を解析
  const firstPageProducts = parseSearchResults(firstHtml)
  for (const p of firstPageProducts) {
    if (!seenNames.has(p.name)) {
      seenNames.add(p.name)
      products.push(p)
    }
  }
  console.log(`[Rakuten] Page 1: ${firstPageProducts.length} products`)

  // 2ページ目以降
  for (let page = 2; page <= maxPage; page++) {
    await sleep(REQUEST_DELAY_MS * 2) // 楽天は遅めに

    const pageUrl = `${RAKUTEN_SEARCH_URL}/${encodeURIComponent(RAKUTEN_SHOP_KEYWORD)}/?p=${page}`
    try {
      const html = await fetchText(pageUrl)
      const pageProducts = parseSearchResults(html)

      for (const p of pageProducts) {
        if (!seenNames.has(p.name)) {
          seenNames.add(p.name)
          products.push(p)
        }
      }

      console.log(`[Rakuten] Page ${page}/${maxPage}: ${pageProducts.length} products (total: ${products.length})`)
    } catch (err) {
      console.error(`[Rakuten] Error on page ${page}:`, (err as Error).message)
    }
  }

  console.log(`[Rakuten] Done: ${products.length} products scraped`)
  fs.writeFileSync(SCRAPED_RAKUTEN_PATH, JSON.stringify(products, null, 2), 'utf-8')
  console.log(`[Rakuten] Saved to ${SCRAPED_RAKUTEN_PATH}`)

  return products
}

// CLI実行
if (process.argv[1]?.endsWith('scrapeRakuten.ts')) {
  scrapeRakuten().catch(console.error)
}
