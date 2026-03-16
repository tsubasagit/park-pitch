import { useState, useCallback, useEffect } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import SettingsModal from '../components/SettingsModal'
import ChatArea, { type ChatMessage, type ChatMessageAttachment } from '../components/ChatArea'
import { sendChatMessage } from '../api/chat'
import { parseCommand } from '../utils/commandParser'

function generateId() {
  return Math.random().toString(36).slice(2, 11)
}

function filesToAttachments(files: File[]): ChatMessageAttachment[] {
  return files.map((f) => ({
    name: f.name,
    isImage: f.type.startsWith('image/'),
    url: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
  }))
}

const STORAGE_KEY = 'park-agent-messages'
const MAX_MESSAGES = 100

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ChatMessage[]
    return parsed.map((m) => ({ id: m.id, role: m.role, content: m.content }))
  } catch {
    return []
  }
}

function saveMessages(messages: ChatMessage[]): void {
  try {
    const slim = messages.slice(-MAX_MESSAGES).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
    }))
    const json = JSON.stringify(slim)
    if (json.length > 1_000_000) {
      const half = slim.slice(Math.floor(slim.length / 2))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(half))
    } else {
      localStorage.setItem(STORAGE_KEY, json)
    }
  } catch { /* quota exceeded — silently ignore */ }
}

export default function AgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessages())
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [presetInput, setPresetInput] = useState<string | undefined>(undefined)

  useEffect(() => { saveMessages(messages) }, [messages])

  const handleClearHistory = useCallback(() => {
    setMessages([])
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const handleSend = useCallback(async (text: string, files?: File[]) => {
    // コマンド判定（ファイル添付がない場合のみ）
    if (!files?.length) {
      const cmd = parseCommand(text)
      if (cmd.type === 'navigate' && cmd.content) {
        const userMsg: ChatMessage = { id: generateId(), role: 'user', content: cmd.label || text }
        const assistantMsg: ChatMessage = { id: generateId(), role: 'assistant', content: cmd.content }
        setMessages((prev) => [...prev, userMsg, assistantMsg])
        return
      }
    }

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      attachments: files?.length ? filesToAttachments(files) : undefined,
    }
    setMessages((prev) => [...prev, userMsg])
    setIsLoading(true)
    try {
      const reply = await sendChatMessage(text, files)
      const assistantMsg: ChatMessage = { id: generateId(), role: 'assistant', content: reply }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: err instanceof Error ? `エラー: ${err.message}` : 'エラーが発生しました',
      }
      setMessages((prev) => [...prev, assistantMsg])
    } finally {
      setIsLoading(false)
    }
  }, [])

  /** サイドバーのナビボタン → handleSend を直接呼ぶ */
  const handleNavAction = useCallback((prompt: string) => {
    handleSend(prompt)
  }, [handleSend])

  const handleFavoriteClick = useCallback((prompt: string) => {
    setPresetInput(prompt)
    setSidebarOpen(false)
  }, [])

  const handleMinutesClick = useCallback((summary: string) => {
    const assistantMsg: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: summary,
    }
    setMessages((prev) => [...prev, assistantMsg])
    setSidebarOpen(false)
  }, [])

  const handleDealClick = useCallback((prompt: string) => {
    setPresetInput(prompt)
    setSidebarOpen(false)
  }, [])

  const handlePresetConsumed = useCallback(() => {
    setPresetInput(undefined)
  }, [])

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <Header onSettingsClick={() => setSettingsOpen(true)} onNavAction={handleNavAction} />
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onClearHistory={handleClearHistory} />
      <div className="flex flex-1 min-h-0">
        {/* モバイル: サイド開閉ボタン */}
        <button
          type="button"
          onClick={() => setSidebarOpen((o) => !o)}
          className="lg:hidden fixed bottom-4 left-4 z-10 w-10 h-10 rounded-full bg-park-navy text-white shadow-lg flex items-center justify-center"
          aria-label="メニュー"
        >
          ☰
        </button>

        <Sidebar
          onNavAction={handleNavAction}
          onFavoriteClick={handleFavoriteClick}
          onMinutesClick={handleMinutesClick}
          onDealClick={handleDealClick}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="flex-1 flex flex-col min-w-0 bg-white">
          <ChatArea
            messages={messages}
            onSend={handleSend}
            isLoading={isLoading}
            presetInput={presetInput}
            onPresetConsumed={handlePresetConsumed}
          />
        </main>
      </div>
    </div>
  )
}
