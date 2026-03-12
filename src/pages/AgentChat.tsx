import { useState, useCallback } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import ChatArea, { type ChatMessage, type ChatMessageAttachment } from '../components/ChatArea'
import { sendChatMessage } from '../api/chat'

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

export default function AgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [presetInput, setPresetInput] = useState<string | undefined>(undefined)

  const handleSend = useCallback(async (text: string, files?: File[]) => {
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

  const handlePresetConsumed = useCallback(() => {
    setPresetInput(undefined)
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
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
          onFavoriteClick={handleFavoriteClick}
          onMinutesClick={handleMinutesClick}
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
