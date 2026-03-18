import { useState, useRef, useEffect, type FormEvent } from 'react'
import type { Service, Proposal } from '../types'
import { generateProposal } from '../api/client'
import SlidePresentation from './SlidePresentation'

interface EditorViewProps {
  proposal: Proposal
  services: Service[]
  onNew: () => void
  onProposalGenerated: (proposal: Proposal) => void
}

export default function EditorView({ proposal, services: _services, onNew, onProposalGenerated }: EditorViewProps) {
  const [previewTab, setPreviewTab] = useState<'preview' | 'markdown'>('preview')
  const [chatInput, setChatInput] = useState('')
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const pages = proposal.markdownContent
    .split(/\n---\n/)
    .map((s) => s.trim())
    .filter(Boolean)

  // Build summary of what was generated
  const hearingInfo = proposal.hearingInput

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [proposal])

  const handleRegenerate = async (e: FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim()) return
    setGenerating(true)
    setError('')
    try {
      const newProposal = await generateProposal({
        clientName: proposal.clientName || undefined,
        serviceIds: proposal.serviceIds,
        challenge: `${hearingInfo.challenge}\n\n追加リクエスト: ${chatInput}`,
        budget: hearingInfo.budget,
        timeline: hearingInfo.timeline,
      })
      setChatInput('')
      onProposalGenerated(newProposal)
    } catch (err) {
      setError(err instanceof Error ? err.message : '再生成に失敗しました')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left panel — text / chat */}
      <div className="w-96 border-r border-gray-200 bg-white flex flex-col shrink-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onNew}
              className="text-gray-400 hover:text-gray-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-sm font-semibold text-gray-900 truncate">
              {proposal.clientName || '御社'} 向け提案書
            </h2>
          </div>
        </div>

        {/* Content history */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Hearing summary */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs font-semibold text-gray-400 uppercase mb-2">入力情報</div>
            <div className="space-y-1.5 text-sm text-gray-700">
              <div>
                <span className="text-xs text-gray-400">課題:</span>
                <p className="text-sm">{hearingInfo.challenge}</p>
              </div>
              {hearingInfo.budget && (
                <div>
                  <span className="text-xs text-gray-400">予算:</span>
                  <span className="ml-1">{hearingInfo.budget}</span>
                </div>
              )}
              {hearingInfo.timeline && (
                <div>
                  <span className="text-xs text-gray-400">時期:</span>
                  <span className="ml-1">{hearingInfo.timeline}</span>
                </div>
              )}
              <div>
                <span className="text-xs text-gray-400">サービス:</span>
                <span className="ml-1">{proposal.serviceNames.join('、')}</span>
              </div>
            </div>
          </div>

          {/* Generated content outline */}
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase mb-2">
              スライド構成（{pages.length}枚）
            </div>
            <div className="space-y-1">
              {pages.map((page, i) => {
                const firstLine = page.split('\n').find((l) => l.trim())?.replace(/^#+\s*/, '') || `スライド ${i + 1}`
                return (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded text-sm text-gray-600 hover:bg-gray-50">
                    <span className="text-xs text-gray-400 w-4 text-right">{i + 1}</span>
                    <span className="truncate">{firstLine}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div ref={chatEndRef} />
        </div>

        {/* Chat input at bottom */}
        <div className="border-t border-gray-200 p-3">
          {error && (
            <div className="mb-2 p-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
              {error}
            </div>
          )}
          <form onSubmit={handleRegenerate} className="flex gap-2">
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={generating}
                className="w-full px-3 py-2 text-sm bg-transparent border-0 focus:outline-none"
                placeholder="スライドのリクエストを入力してください"
              />
            </div>
            <button
              type="submit"
              disabled={!chatInput.trim() || generating}
              className="w-8 h-8 shrink-0 rounded-lg bg-pitch-navy text-white flex items-center justify-center hover:opacity-90 disabled:opacity-30 self-center"
            >
              {generating ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Right panel — slide preview */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-100">
        {/* Tabs */}
        <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPreviewTab('preview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                previewTab === 'preview'
                  ? 'bg-pitch-navy/10 text-pitch-navy'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              プレビュー
            </button>
            <button
              type="button"
              onClick={() => setPreviewTab('markdown')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                previewTab === 'markdown'
                  ? 'bg-pitch-navy/10 text-pitch-navy'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              コード
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg"
            >
              印刷
            </button>
          </div>
        </div>

        {/* Content */}
        {previewTab === 'preview' ? (
          <SlidePresentation
            proposal={proposal}
            onNew={onNew}
            embedded
            onProposalUpdated={onProposalGenerated}
          />
        ) : (
          <div className="flex-1 overflow-auto p-4">
            <pre className="bg-white rounded-lg border border-gray-200 p-4 text-sm text-gray-800 whitespace-pre-wrap font-mono">
              {proposal.markdownContent}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
