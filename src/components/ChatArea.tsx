import { useState, useRef, useEffect } from 'react'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const SUGGEST_CHIPS = [
  { label: '議事録を確認', prompt: '直近の議事録の要点を教えて' },
  { label: '状況を教えて', prompt: '今の商談・提案の状況をまとめて' },
  { label: '提案書作成をお願い', prompt: 'A社向けの提案書を作成して' },
  { label: 'アイデアが欲しい', prompt: '次のアクションのアイデアを出して' },
]

interface ChatAreaProps {
  messages: ChatMessage[]
  onSend: (text: string) => void
  isLoading: boolean
  inputPlaceholder?: string
  /** 親から入力欄にセットするテキスト（サイドでお気に入りクリック時） */
  presetInput?: string
  onPresetConsumed?: () => void
}

export default function ChatArea({
  messages,
  onSend,
  isLoading,
  inputPlaceholder = 'メッセージを入力...',
  presetInput,
  onPresetConsumed,
}: ChatAreaProps) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (presetInput) {
      setInput(presetInput)
      onPresetConsumed?.()
    }
  }, [presetInput, onPresetConsumed])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || isLoading) return
    onSend(text)
    setInput('')
  }

  const handleChipClick = (prompt: string) => {
    onSend(prompt)
  }

  const hasMessages = messages.length > 0

  return (
    <div className="flex flex-col h-full flex-1 min-0">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!hasMessages && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-4xl mb-4">💬</div>
            <p className="text-gray-600 text-sm leading-relaxed max-w-sm">
              何でも聞いてください。
              <br />
              議事録・提案書・商談状況、
              <br />
              お手伝いします。
            </p>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`
                max-w-[85%] rounded-lg px-4 py-2.5 text-sm
                ${m.role === 'user'
                  ? 'bg-park-navy text-white'
                  : 'bg-gray-100 text-gray-800 border border-gray-200'}
              `}
            >
              <span className="font-medium mr-2">{m.role === 'user' ? '👤' : '🤖'}</span>
              <span className="whitespace-pre-wrap">{m.content}</span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-500">
              🤖 考え中...
            </div>
          </div>
        )}

        {hasMessages && (
          <div className="flex flex-wrap gap-2 pt-2">
            {SUGGEST_CHIPS.map((chip) => (
              <button
                key={chip.prompt}
                type="button"
                onClick={() => handleChipClick(chip.prompt)}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-park-navy hover:bg-park-navy/10 border border-gray-200"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 bg-white flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={inputPlaceholder}
          disabled={isLoading}
          className="flex-1 min-w-0 px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-park-orange focus:border-transparent"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="shrink-0 w-10 h-10 rounded-lg bg-park-orange text-white flex items-center justify-center hover:bg-park-orangeHover disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="送信"
        >
          ➤
        </button>
      </form>
    </div>
  )
}
