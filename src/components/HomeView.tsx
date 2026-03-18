import { useState, type FormEvent } from 'react'
import type { Service, Proposal } from '../types'
import { generateProposal, deleteService } from '../api/client'
import ServiceFormModal from './ServiceFormModal'

interface HomeViewProps {
  services: Service[]
  onServicesChanged: () => void
  onProposalGenerated: (proposal: Proposal) => void
}

export default function HomeView({ services, onServicesChanged, onProposalGenerated }: HomeViewProps) {
  const [challenge, setChallenge] = useState('')
  const [clientName, setClientName] = useState('')
  const [budget, setBudget] = useState('')
  const [timeline, setTimeline] = useState('')
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!challenge.trim()) return
    if (selectedServiceIds.length === 0) {
      setError('サービスを1つ以上選択してください')
      return
    }
    setGenerating(true)
    setError('')
    try {
      const formattedBudget = budget ? `${budget}万円` : ''
      const formattedTimeline = timeline
        ? new Date(timeline).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })
        : ''
      const proposal = await generateProposal({
        clientName: clientName || undefined,
        serviceIds: selectedServiceIds,
        challenge,
        budget: formattedBudget,
        timeline: formattedTimeline,
      })
      onProposalGenerated(proposal)
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成に失敗しました')
    } finally {
      setGenerating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このテンプレートを削除しますか？')) return
    try {
      await deleteService(id)
      onServicesChanged()
    } catch {
      // ignore
    }
  }

  if (generating) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <div className="w-14 h-14 border-4 border-pitch-navy/20 border-t-pitch-navy rounded-full animate-spin" />
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">提案書を生成中...</h2>
          <p className="text-sm text-gray-500 mt-2">AIが最適な提案書を作成しています（15-30秒）</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 pt-16 pb-8">
        {/* Title */}
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">
          Park-Pitch
        </h1>

        {/* Chat input area */}
        <form onSubmit={handleSubmit} className="mb-10">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <textarea
              value={challenge}
              onChange={(e) => setChallenge(e.target.value)}
              rows={3}
              className="w-full px-4 pt-4 pb-2 text-sm resize-none border-0 focus:outline-none"
              placeholder="提案先の課題・要望を入力してください..."
            />

            {/* Detail fields toggle */}
            {showDetails && (
              <div className="px-4 pb-3 space-y-3 border-t border-gray-100 pt-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">提案先企業名</label>
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-pitch-navy/50"
                      placeholder="省略時「御社」"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">予算（万円）</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        min="0"
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-pitch-navy/50"
                        placeholder="200"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">万円</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">導入希望時期</label>
                    <input
                      type="date"
                      value={timeline}
                      onChange={(e) => setTimeline(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-pitch-navy/50"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Bottom bar */}
            <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowDetails(!showDetails)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    showDetails ? 'bg-pitch-navy/10 text-pitch-navy' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  詳細設定
                </button>
              </div>
              <button
                type="submit"
                disabled={!challenge.trim() || selectedServiceIds.length === 0}
                className="w-8 h-8 rounded-lg bg-pitch-navy text-white flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-30"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-3 p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
              {error}
            </div>
          )}
        </form>

        {/* Service templates section */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-sm font-semibold text-gray-700">提案サービスを選択</h2>
          </div>

          {services.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              サービスが未登録です。テンプレートを追加してください。
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {services.map((service) => {
                const selected = selectedServiceIds.includes(service.id)
                return (
                  <div
                    key={service.id}
                    onClick={() => toggleService(service.id)}
                    className={`relative group bg-white border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${
                      selected
                        ? 'border-pitch-navy ring-2 ring-pitch-navy/20'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {/* Selection indicator */}
                    <div
                      className={`absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        selected ? 'bg-pitch-navy border-pitch-navy' : 'border-gray-300'
                      }`}
                    >
                      {selected && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>

                    <div className="pr-6">
                      <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded-full mb-2">
                        {service.category}
                      </span>
                      <h3 className="font-semibold text-sm text-gray-900 mb-1">{service.name}</h3>
                      <p className="text-xs text-gray-500 line-clamp-2">{service.overview}</p>
                    </div>

                    {/* Hover actions */}
                    <div className="absolute bottom-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingService(service)
                          setShowServiceModal(true)
                        }}
                        className="p-1 text-gray-400 hover:text-pitch-navy text-xs rounded hover:bg-gray-100"
                        title="編集"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(service.id)
                        }}
                        className="p-1 text-gray-400 hover:text-red-600 text-xs rounded hover:bg-gray-100"
                        title="削除"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              })}

              {/* Add template card */}
              <div
                onClick={() => {
                  setEditingService(null)
                  setShowServiceModal(true)
                }}
                className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-pitch-navy hover:text-pitch-navy text-gray-400 transition-colors min-h-[120px]"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-xs font-medium">テンプレートを追加</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {showServiceModal && (
        <ServiceFormModal
          editingService={editingService}
          onClose={() => {
            setShowServiceModal(false)
            setEditingService(null)
          }}
          onSaved={() => {
            setShowServiceModal(false)
            setEditingService(null)
            onServicesChanged()
          }}
        />
      )}
    </div>
  )
}
