import { useState, type FormEvent } from 'react'
import type { Service, Proposal } from '../types'
import { generateProposal } from '../api/client'
import SlidePresentation from './SlidePresentation'

interface GeneratePanelProps {
  services: Service[]
  activeProposal: Proposal | null
  onProposalGenerated: (proposal: Proposal) => void
  onNewProposal: () => void
}

export default function GeneratePanel({
  services,
  activeProposal,
  onProposalGenerated,
  onNewProposal,
}: GeneratePanelProps) {
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  const [clientName, setClientName] = useState('')
  const [challenge, setChallenge] = useState('')
  const [budget, setBudget] = useState('')
  const [timeline, setTimeline] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')


  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
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

  const handleNew = () => {
    setSelectedServiceIds([])
    setClientName('')
    setChallenge('')
    setBudget('')
    setTimeline('')
    setError('')
    onNewProposal()
  }

  // Preview mode — Slide presentation
  if (activeProposal) {
    return (
      <SlidePresentation
        proposal={activeProposal}
        onNew={handleNew}
      />
    )
  }

  // Generating state
  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <div className="w-12 h-12 border-4 border-pitch-navy/20 border-t-pitch-navy rounded-full animate-spin" />
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-900">提案書を生成中...</h2>
          <p className="text-sm text-gray-500 mt-1">AIが最適な提案書を作成しています（15-30秒）</p>
        </div>
      </div>
    )
  }

  // Form mode
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-lg font-bold text-gray-900 mb-6">提案書を作成</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Service selection */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">提案サービスを選択</h3>
          {services.length === 0 ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              サービスが未登録です。左パネルからテンプレートを登録してください。
            </div>
          ) : (
            <div className="space-y-2">
              {services.map((service) => (
                <label
                  key={service.id}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedServiceIds.includes(service.id)
                      ? 'border-pitch-navy bg-pitch-navy/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedServiceIds.includes(service.id)}
                    onChange={() => toggleService(service.id)}
                    className="accent-pitch-navy"
                  />
                  <div className="min-w-0">
                    <span className="font-medium text-sm text-gray-900">{service.name}</span>
                    {service.overview && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{service.overview}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </section>

        {/* Hearing fields */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">ヒアリング情報</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                課題 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={challenge}
                onChange={(e) => setChallenge(e.target.value)}
                rows={4}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-navy/50"
                placeholder="創業者が高齢で事業承継を検討中。後継者候補はいるが..."
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  予算（万円） <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    required
                    min="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-navy/50"
                    placeholder="200"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">万円</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  導入希望時期 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={timeline}
                  onChange={(e) => setTimeline(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-navy/50"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Optional client name */}
        <section>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              提案先企業名（任意）
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-navy/50"
              placeholder="未入力の場合「御社」で生成されます"
            />
          </div>
        </section>

        <button
          type="submit"
          disabled={services.length === 0}
          className="w-full py-3 bg-pitch-navy text-white rounded-lg hover:opacity-90 transition-opacity text-base font-semibold disabled:opacity-40"
        >
          提案書を生成する
        </button>
      </form>
    </div>
  )
}
