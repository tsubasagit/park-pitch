import { useState, useRef, useEffect } from 'react'
import MarkdownRenderer from './MarkdownRenderer'

export interface ChatMessageAttachment {
  name: string
  isImage: boolean
  url?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  attachments?: ChatMessageAttachment[]
}

/** アクションカード定義 */
const ACTION_CARDS = [
  { icon: '📋', label: '案件', sub: '一覧を見る', prompt: '案件一覧' },
  { icon: '🏢', label: '会社', sub: '一覧を見る', prompt: '会社一覧' },
  { icon: '📝', label: '議事録', sub: 'を確認する', prompt: '議事録一覧' },
  { icon: '📊', label: '商談状況', sub: 'を確認', prompt: '今の商談・提案の状況をまとめて' },
  { icon: '✏️', label: '提案書', sub: 'を作成する', prompt: 'A社向けの提案書を作成して' },
  { icon: '💡', label: '次の', sub: 'アクション', prompt: '次のアクションのアイデアを出して' },
]

/** サジェストチップ（営業アクション中心） */
const SUGGEST_CHIPS = [
  { label: 'A社の状況は？', prompt: 'A社の状況は？' },
  { label: '次のアクション', prompt: '次のアクションのアイデアを出して' },
  { label: '提案書を作って', prompt: '提案書を作成して' },
  { label: '週次サマリー', prompt: '今週の商談の進捗をサマリーにして' },
]

const ACCEPT_FILES = 'image/*,.pdf,.doc,.docx,.txt'

interface ChatAreaProps {
  messages: ChatMessage[]
  onSend: (text: string, files?: File[]) => void
  isLoading: boolean
  inputPlaceholder?: string
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
  const [attachments, setAttachments] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    setAttachments((prev) => [...prev, ...Array.from(files)].slice(0, 5))
    e.target.value = ''
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if ((!text && attachments.length === 0) || isLoading) return
    onSend(text || '（ファイルのみ送信）', attachments.length > 0 ? attachments : undefined)
    setInput('')
    setAttachments([])
  }

  const hasMessages = messages.length > 0

  return (
    <div className="flex flex-col h-full flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* === 空状態: アクションカード === */}
        {!hasMessages && (
          <div className="flex items-center justify-center h-full py-8">
            <div className="max-w-lg w-full text-center">
              <div className="w-14 h-14 rounded-2xl bg-park-navy/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-park-navy">P</span>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">PARK · 営業エディタ</h2>
              <p className="text-sm text-gray-500 mb-6">何をしますか？</p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {ACTION_CARDS.map((card) => (
                  <button
                    key={card.prompt}
                    type="button"
                    onClick={() => onSend(card.prompt)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:border-park-navy hover:shadow-sm transition-all text-left group"
                  >
                    <span className="text-xl shrink-0">{card.icon}</span>
                    <div>
                      <span className="text-sm font-semibold text-gray-800 group-hover:text-park-navy">
                        {card.label}
                      </span>
                      <span className="text-xs text-gray-400 block">{card.sub}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* === チャット履歴 === */}
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
              <div className="flex gap-2">
                <span className="font-medium shrink-0">{m.role === 'user' ? '👤' : '🤖'}</span>
                {m.role === 'assistant' ? (
                  <MarkdownRenderer content={m.content} />
                ) : (
                  <span className="whitespace-pre-wrap">{m.content}</span>
                )}
              </div>
              {m.attachments && m.attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.attachments.map((a, i) =>
                    a.isImage && a.url ? (
                      <img
                        key={i}
                        src={a.url}
                        alt={a.name}
                        className="max-h-24 rounded border border-white/20"
                      />
                    ) : (
                      <span key={i} className="text-xs opacity-90">
                        📎 {a.name}
                      </span>
                    ),
                  )}
                </div>
              )}
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

        {/* サジェストチップ（メッセージがある場合のみ） */}
        {hasMessages && (
          <div className="flex flex-wrap gap-2 pt-2">
            {SUGGEST_CHIPS.map((chip) => (
              <button
                key={chip.prompt}
                type="button"
                onClick={() => onSend(chip.prompt)}
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

      {/* 入力フォーム */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 bg-white">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs"
              >
                {f.type.startsWith('image/') ? (
                  <img
                    src={URL.createObjectURL(f)}
                    alt=""
                    className="h-10 w-10 object-cover rounded"
                  />
                ) : (
                  <span>📎 {f.name}</span>
                )}
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  className="text-gray-500 hover:text-red-600"
                  aria-label="削除"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_FILES}
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="shrink-0 w-10 h-10 rounded-lg border border-gray-300 text-gray-600 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50"
            title="ファイル・画像を添付"
            aria-label="添付"
          >
            📎
          </button>
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
            disabled={(!input.trim() && attachments.length === 0) || isLoading}
            className="shrink-0 w-10 h-10 rounded-lg bg-park-orange text-white flex items-center justify-center hover:bg-park-orangeHover disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="送信"
          >
            ➤
          </button>
        </div>
      </form>
    </div>
  )
}
