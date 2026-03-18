import express from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import multer from 'multer'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { readJSON, writeJSON, deleteFile, getUploadsDir } from './storage'
import { PDF_EXTRACTION_PROMPT, buildProposalPrompt } from './prompts'
import fs from 'fs'

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

// Static uploads
app.use('/api/uploads', express.static(getUploadsDir()))

// Multer for PDF uploads
const pdfStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, getUploadsDir()),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
  },
})
const uploadPdf = multer({
  storage: pdfStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true)
    else cb(new Error('PDFファイルのみアップロード可能です'))
  },
})

// Multer for logo uploads (memory)
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

// ─── Services ─────────────────────────────────────────

interface ServiceFeature { name: string; description: string }
interface ServiceData {
  id: string; name: string; category: string
  overview: string; targetClients: string
  challengesSolved: string[]; deliverables: ServiceFeature[]
  expertType: string; engagementType: string
  pdfFilename: string; pdfOriginalName: string
  createdAt: string; updatedAt: string
}

function getServices(): ServiceData[] {
  return readJSON<ServiceData[]>('services.json') || []
}

function saveServices(services: ServiceData[]) {
  writeJSON('services.json', services)
}

app.get('/api/services', (_req, res) => {
  res.json(getServices())
})

app.post('/api/services', uploadPdf.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'PDFファイルが必要です' })
      return
    }

    // Read PDF and send to Gemini for extraction
    const pdfBuffer = fs.readFileSync(req.file.path)
    const pdfBase64 = pdfBuffer.toString('base64')

    let extracted: Partial<ServiceData> = {}
    try {
      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              { text: PDF_EXTRACTION_PROMPT },
              { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
            ],
          },
        ],
      })
      const text = result.response.text()
      // Remove markdown code fences if present
      const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      extracted = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error('[PDF抽出] パース失敗、空フィールドで返却:', parseErr)
    }

    const id = `svc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const service: ServiceData = {
      id,
      name: extracted.name || '',
      category: extracted.category || '',
      overview: extracted.overview || '',
      targetClients: extracted.targetClients || '',
      challengesSolved: extracted.challengesSolved || [],
      deliverables: extracted.deliverables || [],
      expertType: extracted.expertType || '',
      engagementType: extracted.engagementType || '',
      pdfFilename: req.file.filename,
      pdfOriginalName: req.file.originalname,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const services = getServices()
    services.push(service)
    saveServices(services)

    res.json(service)
  } catch (err) {
    console.error('[POST /api/services]', err)
    res.status(500).json({
      error: err instanceof Error ? err.message : 'サービス登録に失敗しました',
    })
  }
})

app.put('/api/services/:id', (req, res) => {
  const services = getServices()
  const idx = services.findIndex((s) => s.id === req.params.id)
  if (idx === -1) {
    res.status(404).json({ error: 'サービスが見つかりません' })
    return
  }

  const updates = req.body as Partial<ServiceData>
  services[idx] = {
    ...services[idx],
    ...updates,
    id: services[idx].id,
    pdfFilename: services[idx].pdfFilename,
    pdfOriginalName: services[idx].pdfOriginalName,
    createdAt: services[idx].createdAt,
    updatedAt: new Date().toISOString(),
  }

  saveServices(services)
  res.json(services[idx])
})

app.delete('/api/services/:id', (req, res) => {
  const services = getServices()
  const idx = services.findIndex((s) => s.id === req.params.id)
  if (idx === -1) {
    res.status(404).json({ error: 'サービスが見つかりません' })
    return
  }

  const service = services[idx]
  // Delete PDF file
  if (service.pdfFilename) {
    deleteFile(path.join(getUploadsDir(), service.pdfFilename))
  }

  services.splice(idx, 1)
  saveServices(services)
  res.json({ ok: true })
})

// ─── Proposals ────────────────────────────────────────

interface ProposalData {
  id: string; serviceIds: string[]; serviceNames: string[]
  clientName: string
  hearingInput: {
    clientName?: string
    serviceIds: string[]; challenge: string; budget: string
    timeline: string
  }
  markdownContent: string; createdAt: string
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
      clientName?: string
      serviceIds: string[]; challenge: string; budget: string
      timeline: string
    }

    const company = readJSON<CompanyData>('company.json')
    if (!company) {
      res.status(400).json({ error: '会社プロフィールが未設定です。先に設定してください。' })
      return
    }

    const allServices = getServices()
    const selectedServices = allServices.filter((s) => input.serviceIds.includes(s.id))
    if (selectedServices.length === 0) {
      res.status(400).json({ error: 'サービスを1つ以上選択してください。' })
      return
    }

    const prompt = buildProposalPrompt(company, selectedServices, {
      clientName: input.clientName,
      challenge: input.challenge,
      budget: input.budget,
      timeline: input.timeline,
    })

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })
    const markdown = result.response.text()

    const id = `prop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const proposal: ProposalData = {
      id,
      serviceIds: input.serviceIds,
      serviceNames: selectedServices.map((s) => s.name),
      clientName: input.clientName || '御社',
      hearingInput: input,
      markdownContent: markdown,
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
  const proposals = getProposals().map(({ markdownContent: _, ...rest }) => rest)
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
  const { markdownContent } = req.body as { markdownContent: string }
  if (typeof markdownContent === 'string') {
    proposals[idx].markdownContent = markdownContent
  }
  saveProposals(proposals)
  res.json(proposals[idx])
})

// ─── Start ────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Park-Pitch server running at http://0.0.0.0:${PORT}`)
})
