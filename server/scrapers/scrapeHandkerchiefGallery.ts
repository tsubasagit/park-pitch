/**
 * Handkerchief Gallery スクレイパー
 * カテゴリページを巡回して商品情報を取得
 */
import * as cheerio from 'cheerio'
import fs from 'fs'
import { HG_BASE_URL, HG_CATEGORY_URLS, REQUEST_DELAY_MS, SCRAPED_HG_PATH, DATA_DIR, sleep } from './config'

interface HGRawProduct {
  id: string
  source: 'handkerchief-gallery'
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
    headers: { 'User-Agent': 'ParkPitch-Scraper/1.0 (product-catalog)' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
  return res.text()
}

/** カテゴリIDからgender/categoryを推定 */
function inferFromCategoryId(url: string): { gender: string; category: string } {
  if (url.includes('category_id=7')) return { gender: 'womens', category: 'ハンカチ' }
  if (url.includes('category_id=8')) return { gender: 'mens', category: 'ハンカチ' }
  if (url.includes('category_id=9')) return { gender: 'kids', category: 'ハンカチ' }
  if (url.includes('category_id=10')) return { gender: '', category: 'タオル' }
  if (url.includes('category_id=11')) return { gender: '', category: 'エコバッグ' }
  return { gender: '', category: 'その他' }
}

/** 一覧ページから商品URLリストを取得 */
async function getProductLinksFromPage(pageUrl: string): Promise<string[]> {
  const html = await fetchText(pageUrl)
  const $ = cheerio.load(html)
  const links: string[] = []

  // 商品リンクを検出（サイト構造に応じて調整）
  $('a[href*="/products/detail"]').each((_, el) => {
    const href = $(el).attr('href')
    if (href) {
      const fullUrl = href.startsWith('http') ? href : `${HG_BASE_URL}${href}`
      if (!links.includes(fullUrl)) links.push(fullUrl)
    }
  })

  // 代替パターン: 商品カードのリンク
  if (links.length === 0) {
    $('.product-item a, .product-card a, .item a').each((_, el) => {
      const href = $(el).attr('href')
      if (href && (href.includes('/products/') || href.includes('/detail/'))) {
        const fullUrl = href.startsWith('http') ? href : `${HG_BASE_URL}${href}`
        if (!links.includes(fullUrl)) links.push(fullUrl)
      }
    })
  }

  return links
}

/** 商品詳細ページからデータ抽出 */
async function scrapeProductDetail(url: string, defaults: { gender: string; category: string }): Promise<HGRawProduct | null> {
  try {
    const html = await fetchText(url)
    const $ = cheerio.load(html)

    const name = $('h1, .product-name, .item-name').first().text().trim()
    if (!name) return null

    // 価格
    const priceText = $('.price, .product-price, .item-price').first().text()
    const priceMatch = priceText.replace(/,/g, '').match(/(\d+)/)
    const price = priceMatch ? Number(priceMatch[1]) : 0

    // 画像
    const imageUrls: string[] = []
    $('img[src*="product"], img[src*="item"], .product-image img, .item-image img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src')
      if (src) {
        const fullSrc = src.startsWith('http') ? src : `${HG_BASE_URL}${src}`
        if (!imageUrls.includes(fullSrc)) imageUrls.push(fullSrc)
      }
    })

    // 素材・サイズ
    const bodyText = $('body').text()
    const materials: string[] = []
    const materialPatterns = ['綿', 'コットン', 'シルク', '絹', 'リネン', '麻', 'ポリエステル', 'ナイロン']
    for (const mat of materialPatterns) {
      if (bodyText.includes(mat)) materials.push(mat)
    }

    const dimMatch = bodyText.match(/(\d+)\s*[×x]\s*(\d+)\s*cm/i)
    const dimensions = dimMatch ? `${dimMatch[1]}×${dimMatch[2]}cm` : ''

    // ブランド推定
    let brand = 'ブルーミング中西'
    const brandPatterns = ['CLASSICS the Small Luxury', 'CSL', 'ブルーミング中西', 'blooming']
    for (const bp of brandPatterns) {
      if (bodyText.includes(bp)) { brand = bp; break }
    }

    // ID生成
    const urlHash = url.split('/').pop() || Date.now().toString()
    const id = `hg_${urlHash.replace(/[^a-zA-Z0-9]/g, '_')}`

    return {
      id,
      source: 'handkerchief-gallery',
      sourceUrl: url,
      name,
      brand,
      price,
      materials,
      dimensions,
      colors: [],
      category: defaults.category,
      gender: defaults.gender,
      collections: [],
      thumbnailUrl: imageUrls[0] || '',
      imageUrls,
      scrapedAt: new Date().toISOString(),
    }
  } catch {
    return null
  }
}

/** ページネーションの最大ページ数を取得 */
async function getMaxPages(categoryUrl: string): Promise<number> {
  try {
    const html = await fetchText(categoryUrl)
    const $ = cheerio.load(html)
    let maxPage = 1

    // ページネーションリンクからページ数を推定
    $('a[href*="pageno="], a[href*="page="]').each((_, el) => {
      const href = $(el).attr('href') || ''
      const match = href.match(/page(?:no)?=(\d+)/)
      if (match) {
        const p = Number(match[1])
        if (p > maxPage) maxPage = p
      }
    })

    // テキストからも推定
    const pageText = $('.pager, .pagination, nav').text()
    const pageNums = pageText.match(/\d+/g)
    if (pageNums) {
      for (const n of pageNums) {
        const p = Number(n)
        if (p > maxPage && p < 200) maxPage = p
      }
    }

    return maxPage
  } catch {
    return 1
  }
}

/** モック用サンプルデータを出力（ネットワーク不要） */
function writeMockHG(): HGRawProduct[] {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  const now = new Date().toISOString()
  const products: HGRawProduct[] = [
    { id: 'hg_mock_1', source: 'handkerchief-gallery', sourceUrl: 'https://handkerchief-gallery.com/products/detail/1', name: 'レディースハンカチ 桜', brand: 'ブルーミング中西', price: 1980, materials: ['綿'], dimensions: '35×35cm', colors: [], category: 'ハンカチ', gender: 'womens', collections: [], thumbnailUrl: '', imageUrls: [], scrapedAt: now },
    { id: 'hg_mock_2', source: 'handkerchief-gallery', sourceUrl: 'https://handkerchief-gallery.com/products/detail/2', name: '法人向けタオル 刺繍', brand: 'ブルーミング中西', price: 550, materials: ['綿'], dimensions: '30×30cm', colors: [], category: 'タオル', gender: '', collections: [], thumbnailUrl: '', imageUrls: [], scrapedAt: now },
  ]
  fs.writeFileSync(SCRAPED_HG_PATH, JSON.stringify(products, null, 2), 'utf-8')
  console.log(`[HG] Mock: wrote ${products.length} samples to ${SCRAPED_HG_PATH}`)
  return products
}

export async function scrapeHandkerchiefGallery(): Promise<HGRawProduct[]> {
  const useMock = process.env.MOCK === '1' || process.argv.includes('--mock')
  if (useMock) return writeMockHG()

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

  const products: HGRawProduct[] = []
  const seenUrls = new Set<string>()

  for (const categoryUrl of HG_CATEGORY_URLS) {
    const defaults = inferFromCategoryId(categoryUrl)
    console.log(`[HG] Scraping category: ${categoryUrl} (${defaults.category} / ${defaults.gender})`)

    const maxPages = await getMaxPages(categoryUrl)
    console.log(`[HG] Max pages: ${maxPages}`)

    for (let page = 1; page <= maxPages; page++) {
      const pageUrl = page === 1 ? categoryUrl : `${categoryUrl}&pageno=${page}`

      try {
        const productLinks = await getProductLinksFromPage(pageUrl)
        console.log(`[HG] Page ${page}/${maxPages}: ${productLinks.length} products found`)

        for (const link of productLinks) {
          if (seenUrls.has(link)) continue
          seenUrls.add(link)

          const product = await scrapeProductDetail(link, defaults)
          if (product) products.push(product)
          await sleep(REQUEST_DELAY_MS)
        }
      } catch (err) {
        console.error(`[HG] Error on page ${page}:`, (err as Error).message)
      }

      await sleep(REQUEST_DELAY_MS)
    }
  }

  console.log(`[HG] Done: ${products.length} products scraped`)
  fs.writeFileSync(SCRAPED_HG_PATH, JSON.stringify(products, null, 2), 'utf-8')
  console.log(`[HG] Saved to ${SCRAPED_HG_PATH}`)

  return products
}

// CLI実行
if (process.argv[1]?.endsWith('scrapeHandkerchiefGallery.ts')) {
  scrapeHandkerchiefGallery().catch(console.error)
}
