import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import multer from 'multer'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { MINUTES_CONTEXT } from './minutesMock'

dotenv.config()

const app = express()
const PORT = Number(process.env.PORT) || 3002

const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5179'
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || CORS_ORIGIN.split(',').map((o) => o.trim()).includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error('CORS not allowed'))
      }
    },
  }),
)
app.use(express.json({ limit: '256kb' }))

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
})

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  console.error('GEMINI_API_KEY が未設定です。.env に設定してください。')
  process.exit(1)
}
const genAI = new GoogleGenerativeAI(apiKey)
const modelId = process.env.GEMINI_MODEL || 'gemini-1.5-flash'
const model = genAI.getGenerativeModel({ model: modelId })
console.log('[PARK Agent] Gemini model:', modelId)

const SYSTEM_PROMPT = `
あなたは営業支援AI「PARK」です。以下の議事録・商談メモを参照して、ユーザーの質問に答えてください。
答えるときは簡潔に、必要なら箇条書きや次のアクションを提案してください。
議事録にない内容は「議事録には記載がありません」と伝え、推測で書かないでください。
ユーザーが画像やPDFを添付した場合は、その内容も踏まえて回答してください。

【参照用議事録】
${MINUTES_CONTEXT}
`.trim()

function buildGeminiParts(
  message: string,
  files?: Express.Multer.File[],
): Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> {
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: `${SYSTEM_PROMPT}\n\n---\n\n[ユーザー]\n${message}` },
  ]
  if (files?.length) {
    const supportedImages = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    const supportedPdf = 'application/pdf'
    for (const f of files) {
      const mime = f.mimetype
      if (supportedImages.includes(mime) || mime === supportedPdf) {
        parts.push({
          inlineData: {
            mimeType: mime,
            data: f.buffer.toString('base64'),
          },
        })
      }
    }
  }
  return parts
}

app.post('/api/chat', upload.array('files', 5), async (req, res) => {
  try {
    const message = (req.body as { message?: string }).message
    const files = (req.files as Express.Multer.File[] | undefined) || []
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'message は必須です' })
      return
    }

    const parts = buildGeminiParts(message, files.length > 0 ? files : undefined)
    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
    })
    const text = result.response.text()

    res.json({ reply: text || '申し訳ありません。応答を生成できませんでした。' })
  } catch (err) {
    console.error('[api/chat]', err)
    res.status(500).json({
      error: err instanceof Error ? err.message : '応答の生成に失敗しました',
    })
  }
})

app.listen(PORT, () => {
  console.log(`PARK Agent server running at http://0.0.0.0:${PORT}`)
})
