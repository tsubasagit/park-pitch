import express from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import multer from 'multer'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { readJSON, writeJSON, getUploadsDir } from './storage'
import { TEXT_EXTRACTION_PROMPT, buildBloomingProposalPrompt } from './prompts'
import bloomingRouter from './blooming'
import { loadBloomingProducts, searchCandidates } from './search'

dotenv.config()

const app = express()
const PORT = Number(process.env.PORT) || 3002

const CORS_ORIGIN = process.env.CORS_ORIGIN
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      if (CORS_ORIGIN) {
        const allowed = CORS_ORIGIN.split(',').map((o) => o.trim())
        if (allowed.includes(origin)) return callback(null, true)
        return callback(new Error('CORS not allowed'))
      }
      // Dev mode: allow localhost
      if (origin.startsWith('http://localhost:')) return callback(null, true)
      callback(new Error('CORS not allowed'))
    },
  }),
)
app.use(express.json({ limit: '256kb' }))

app.use('/api/blooming', bloomingRouter)

// Static uploads
app.use('/api/uploads', express.static(getUploadsDir()))

// Multer for logo uploads
const uploadLogo = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, getUploadsDir()),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname)
      cb(null, `logo${ext}`)
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
})

// Gemini
const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  console.error('GEMINI_API_KEY が未設定です。.env に設定してください。')
  process.exit(1)
}
const genAI = new GoogleGenerativeAI(apiKey)
const modelId = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const model = genAI.getGenerativeModel({ model: modelId })
console.log('[Park-Pitch] Gemini model:', modelId)

// ─── Company ──────────────────────────────────────────

interface CompanyData {
  name: string; industry: string; description: string
  philosophy: string; expertise: string; offices: string
  strengths: string[]; contactPerson: string; email: string
  logoPath?: string; updatedAt: string
}

app.get('/api/company', (_req, res) => {
  const data = readJSON<CompanyData>('company.json')
  res.json(data)
})

app.post('/api/company', uploadLogo.single('logo'), (req, res) => {
  const body = req.body as Record<string, string>
  const existing = readJSON<CompanyData>('company.json')

  const company: CompanyData = {
    name: body.name || '',
    industry: body.industry || '',
    description: body.description || '',
    philosophy: body.philosophy || '',
    expertise: body.expertise || '',
    offices: body.offices || '',
    strengths: (body.strengths || '').split('\n').map((s) => s.trim()).filter(Boolean),
    contactPerson: body.contactPerson || '',
    email: body.email || '',
    logoPath: req.file ? req.file.filename : existing?.logoPath,
    updatedAt: new Date().toISOString(),
  }

  writeJSON('company.json', company)
  res.json(company)
})

// ─── Parse Request (テキスト→構造化データ抽出 + 商品レコメンド) ───

app.post('/api/parse-request', async (req, res) => {
  try {
    const { text } = req.body as { text: string }
    if (!text?.trim()) {
      res.status(400).json({ error: 'テキストを入力してください' })
      return
    }

    // Gemini でテキストから構造化データ抽出
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `${TEXT_EXTRACTION_PROMPT}\n\n入力テキスト:\n${text}` }] }],
    })
    const responseText = result.response.text()
    const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()

    let parsed: {
      clientName: string
      purpose: string
      quantity: number | null
      unitPriceMin: number | null
      unitPriceMax: number | null
      deliveryDate: string | null
      customization: string
      keywords: string[]
    }

    try {
      parsed = JSON.parse(cleaned)
    } catch {
      parsed = {
        clientName: '',
        purpose: text,
        quantity: null,
        unitPriceMin: null,
        unitPriceMax: null,
        deliveryDate: null,
        customization: '',
        keywords: [],
      }
    }

    // 商品レコメンド: キーワードでカタログ検索
    const searchQuery = (parsed.keywords || []).join(' ')
    const filters = {
      budgetMin: parsed.unitPriceMin ?? undefined,
      budgetMax: parsed.unitPriceMax ?? undefined,
    }
    const candidates = searchCandidates(filters, searchQuery, 50)

    // スコアリング（簡易版）
    const terms = searchQuery.toLowerCase().split(/\s+/).filter(Boolean)
    const scored = candidates.map((p) => {
      let score = (p.giftScore ?? 5) / 10
      const matchedTags: string[] = []
      for (const t of terms) {
        if ((p.name || '').toLowerCase().includes(t)) { score += 0.2; matchedTags.push(t) }
        if ((p.aiSummary || '').toLowerCase().includes(t)) { score += 0.15 }
        for (const tag of p.occasionTags || []) {
          if (tag.toLowerCase().includes(t)) { score += 0.1; matchedTags.push(tag) }
        }
        if ((p.category || '').toLowerCase().includes(t)) { score += 0.15; matchedTags.push(p.category) }
      }
      return { product: p, score: Math.min(1, score), matchedTags: [...new Set(matchedTags)] }
    })
    scored.sort((a, b) => b.score - a.score)
    const recommendedProducts = scored.slice(0, 10).map((s, i) => ({
      ...s.product,
      rank: i + 1,
      score: s.score,
      matchedTags: s.matchedTags,
    }))

    res.json({
      parsed: {
        clientName: parsed.clientName || '',
        purpose: parsed.purpose || '',
        quantity: parsed.quantity,
        unitPriceMin: parsed.unitPriceMin,
        unitPriceMax: parsed.unitPriceMax,
        deliveryDate: parsed.deliveryDate,
        customization: parsed.customization || '',
      },
      recommendedProducts,
    })
  } catch (err) {
    console.error('[POST /api/parse-request]', err)
    res.status(500).json({
      error: err instanceof Error ? err.message : 'テキスト解析に失敗しました',
    })
  }
})

// ─── Proposals ────────────────────────────────────────

interface ProposalData {
  id: string
  productIds: string[]
  productNames: string[]
  clientName: string
  proposalRequest: {
    freeText: string
    clientName: string
    purpose: string
    productIds: string[]
    quantity?: number
    unitPriceMin?: number
    unitPriceMax?: number
    deliveryDate?: string
    customization?: string
  }
  jsonContent: Record<string, unknown>
  createdAt: string
}

function getProposals(): ProposalData[] {
  return readJSON<ProposalData[]>('proposals.json') || []
}

function saveProposals(proposals: ProposalData[]) {
  writeJSON('proposals.json', proposals)
}

app.post('/api/generate', async (req, res) => {
  try {
    const input = req.body as {
      freeText: string
      clientName: string
      purpose: string
      productIds: string[]
      quantity?: number
      unitPriceMin?: number
      unitPriceMax?: number
      deliveryDate?: string
      customization?: string
    }

    const company = readJSON<CompanyData>('company.json')
    if (!company) {
      res.status(400).json({ error: '会社プロフィールが未設定です。先に設定してください。' })
      return
    }

    if (!input.productIds || input.productIds.length === 0) {
      res.status(400).json({ error: '商品を1つ以上選択してください。' })
      return
    }

    // 選択された商品をカタログから取得
    const allProducts = loadBloomingProducts()
    const selectedProducts = allProducts.filter((p) => input.productIds.includes(p.id))
    if (selectedProducts.length === 0) {
      res.status(400).json({ error: '選択された商品が見つかりません。' })
      return
    }

    const prompt = buildBloomingProposalPrompt(company, selectedProducts, {
      clientName: input.clientName,
      purpose: input.purpose,
      quantity: input.quantity,
      unitPriceMin: input.unitPriceMin,
      unitPriceMax: input.unitPriceMax,
      deliveryDate: input.deliveryDate,
      customization: input.customization,
    })

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })
    const responseText = result.response.text()
    const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()

    let jsonContent: Record<string, unknown>
    try {
      jsonContent = JSON.parse(cleaned)
    } catch {
      // JSON解析失敗時はフォールバック
      jsonContent = {
        cover: {
          title: `${input.clientName || '御社'} 向けノベルティご提案`,
          subtitle: input.purpose || '',
          clientName: input.clientName || '御社',
          companyName: company.name,
          contactPerson: company.contactPerson,
          date: new Date().toLocaleDateString('ja-JP'),
        },
        greeting: responseText.slice(0, 200),
        products: selectedProducts.map((p) => ({
          productId: p.id,
          name: p.name,
          description: p.aiSummary || '',
          imageUrl: p.thumbnailUrl || '',
          specs: {
            material: p.materials.join('、'),
            size: p.dimensions || '',
            colors: p.colors,
            customization: input.customization || '',
            unitPrice: `¥${p.price.toLocaleString()}`,
            quantity: input.quantity ? `${input.quantity.toLocaleString()}個` : '',
            deliveryDays: '',
          },
          recommendation: '',
        })),
        delivery: { timeline: '', notes: [] },
        pricing: { summary: '' },
        companyInfo: {
          name: company.name,
          description: company.description,
          strengths: company.strengths,
          contact: company.contactPerson,
          email: company.email,
        },
      }
    }

    const id = `prop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const proposal: ProposalData = {
      id,
      productIds: input.productIds,
      productNames: selectedProducts.map((p) => p.name),
      clientName: input.clientName || '御社',
      proposalRequest: input,
      jsonContent,
      createdAt: new Date().toISOString(),
    }

    const proposals = getProposals()
    proposals.unshift(proposal)
    saveProposals(proposals)

    res.json(proposal)
  } catch (err) {
    console.error('[POST /api/generate]', err)
    res.status(500).json({
      error: err instanceof Error ? err.message : '提案書の生成に失敗しました',
    })
  }
})

app.get('/api/proposals', (_req, res) => {
  const proposals = getProposals().map(({ jsonContent: _, ...rest }) => rest)
  res.json(proposals)
})

app.get('/api/proposals/:id', (req, res) => {
  const proposals = getProposals()
  const proposal = proposals.find((p) => p.id === req.params.id)
  if (!proposal) {
    res.status(404).json({ error: '提案書が見つかりません' })
    return
  }
  res.json(proposal)
})

app.put('/api/proposals/:id', (req, res) => {
  const proposals = getProposals()
  const idx = proposals.findIndex((p) => p.id === req.params.id)
  if (idx === -1) {
    res.status(404).json({ error: '提案書が見つかりません' })
    return
  }
  const { jsonContent } = req.body as { jsonContent: Record<string, unknown> }
  if (jsonContent) {
    proposals[idx].jsonContent = jsonContent
  }
  saveProposals(proposals)
  res.json(proposals[idx])
})

// ─── Start ────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Park-Pitch server running at http://0.0.0.0:${PORT}`)
})
