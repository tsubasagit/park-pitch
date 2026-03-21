import { useState, type FormEvent } from 'react'
import type { Proposal, ProposalJSON } from '../types'
import { generateProposal } from '../api/client'
import ProposalRenderer from './ProposalRenderer'

interface EditorViewProps {
  proposal: Proposal
  onNew: () => void
  onProposalGenerated: (proposal: Proposal) => void
}

export default function EditorView({ proposal, onNew, onProposalGenerated }: EditorViewProps) {
  const [previewTab, setPreviewTab] = useState<'preview' | 'json'>('preview')
  const [chatInput, setChatInput] = useState('')
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)

  const proposalData = proposal.jsonContent as ProposalJSON
  const req = proposal.proposalRequest

  const handleRegenerate = async (e: FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim()) return
    setGenerating(true)
    setError('')
    try {
      const newProposal = await generateProposal({
        freeText: `${req.freeText}\n\n追加リクエスト: ${chatInput}`,
        clientName: req.clientName,
        purpose: req.purpose,
        productIds: req.productIds,
        quantity: req.quantity,
        unitPriceMin: req.unitPriceMin,
        unitPriceMax: req.unitPriceMax,
        deliveryDate: req.deliveryDate,
        customization: req.customization,
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
      {/* Left panel */}
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* 要件サマリー */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs font-semibold text-gray-400 uppercase mb-2">提案内容</div>
            <div className="space-y-1.5 text-sm text-gray-700">
              {req.purpose && (
                <div>
                  <span className="text-xs text-gray-400">用途:</span>
                  <p className="text-sm">{req.purpose}</p>
                </div>
              )}
              {req.quantity && (
                <div>
                  <span className="text-xs text-gray-400">数量:</span>
                  <span className="ml-1">{req.quantity.toLocaleString()}個</span>
                </div>
              )}
              {(req.unitPriceMin || req.unitPriceMax) && (
                <div>
                  <span className="text-xs text-gray-400">単価:</span>
                  <span className="ml-1">
                    ¥{req.unitPriceMin || '?'}〜¥{req.unitPriceMax || '?'}
                  </span>
                </div>
              )}
              {req.deliveryDate && (
                <div>
                  <span className="text-xs text-gray-400">納期:</span>
                  <span className="ml-1">{req.deliveryDate}</span>
                </div>
              )}
              {req.customization && (
                <div>
                  <span className="text-xs text-gray-400">カスタマイズ:</span>
                  <span className="ml-1">{req.customization}</span>
                </div>
              )}
            </div>
          </div>

          {/* 選択商品 */}
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase mb-2">
              選択商品（{proposal.productNames.length}件）
            </div>
            <div className="space-y-2">
              {proposal.productNames.map((name, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded text-sm text-gray-600 bg-gray-50">
                  <span className="text-xs text-pitch-navy font-medium w-4 text-right">{i + 1}</span>
                  <span className="truncate">{name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ページ構成 */}
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase mb-2">ページ構成</div>
            <div className="space-y-1 text-sm text-gray-600">
              <PageOutlineItem label="表紙" />
              {proposalData.greeting && <PageOutlineItem label="ご挨拶" />}
              {proposalData.products?.map((p, i) => (
                <PageOutlineItem key={i} label={`商品 ${i + 1}: ${p.name}`} />
              ))}
              {proposalData.comparison && <PageOutlineItem label="商品比較" />}
              {(proposalData.delivery || proposalData.pricing) && <PageOutlineItem label="納期・費用" />}
              {proposalData.companyInfo && <PageOutlineItem label="会社紹介" />}
            </div>
          </div>
        </div>

        {/* Chat input */}
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
                placeholder="修正リクエストを入力..."
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

      {/* Right panel — proposal preview */}
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
              onClick={() => setPreviewTab('json')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                previewTab === 'json'
                  ? 'bg-pitch-navy/10 text-pitch-navy'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              JSON
            </button>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg"
          >
            印刷 / PDF
          </button>
        </div>

        {/* Content */}
        {previewTab === 'preview' ? (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="max-w-[900px] mx-auto proposal-content">
              <ProposalRenderer data={proposalData} />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-4">
            <pre className="bg-white rounded-lg border border-gray-200 p-4 text-sm text-gray-800 whitespace-pre-wrap font-mono">
              {JSON.stringify(proposalData, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

function PageOutlineItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50">
      <span className="w-1.5 h-1.5 rounded-full bg-pitch-navy/40" />
      <span className="truncate text-sm">{label}</span>
    </div>
  )
}
