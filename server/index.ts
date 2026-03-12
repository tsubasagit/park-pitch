import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
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

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  console.error('GEMINI_API_KEY が未設定です。.env に設定してください。')
  process.exit(1)
}
const genAI = new GoogleGenerativeAI(apiKey)
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

app.post('/api/chat', async (req, res) => {
  try {
    const { message, contextSummary } = req.body as { message?: string; contextSummary?: string }
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'message は必須です' })
      return
    }

    const systemContext = `
あなたは営業支援AI「PARK」です。以下の議事録・商談メモを参照して、ユーザーの質問に答えてください。
答えるときは簡潔に、必要なら箇条書きや次のアクションを提案してください。
議事録にない内容は「議事録には記載がありません」と伝え、推測で書かないでください。

【参照用議事録】
${MINUTES_CONTEXT}
`.trim()

    const userContent = contextSummary
      ? `[会話で共有されたコンテキスト]\n${contextSummary}\n\n[ユーザーの質問]\n${message}`
      : message

    const prompt = `${systemContext}\n\n---\n\n${userContent}`

    const result = await model.generateContent(prompt)
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
