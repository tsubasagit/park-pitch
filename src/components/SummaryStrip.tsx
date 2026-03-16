import { deals, dealStatusIcon } from '../data/mock'
import type { DealStatus } from '../data/mock'

const HEALTH_COLORS: Record<string, string> = {
  good: 'bg-green-100 text-green-700 border-green-200',
  warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  risk: 'bg-red-100 text-red-700 border-red-200',
}

function getDealHealth(status: DealStatus): 'good' | 'warning' | 'risk' {
  if (status === '受注' || status === '導入進行中') return 'good'
  if (status === '提案中' || status === '見積提出') return 'warning'
  if (status === '失注') return 'risk'
  return 'warning'
}

interface SummaryStripProps {
  onDealClick: (prompt: string) => void
}

export default function SummaryStrip({ onDealClick }: SummaryStripProps) {
  const totalDeals = deals.length
  const activeDeals = deals.filter(
    (d) => d.status !== '受注' && d.status !== '失注',
  ).length
  const goodCount = deals.filter((d) => getDealHealth(d.status) === 'good').length
  const warningCount = deals.filter((d) => getDealHealth(d.status) === 'warning').length
  const riskCount = deals.filter((d) => getDealHealth(d.status) === 'risk').length

  return (
    <div className="border-b border-gray-200 bg-white px-4 py-3 shrink-0">
      <div className="flex items-center gap-6 overflow-x-auto">
        {/* KPI */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-center px-3">
            <div className="text-2xl font-bold text-park-navy">{totalDeals}</div>
            <div className="text-xs text-gray-500">全商談</div>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div className="text-center px-3">
            <div className="text-2xl font-bold text-park-orange">{activeDeals}</div>
            <div className="text-xs text-gray-500">進行中</div>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div className="flex items-center gap-2 px-3">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
              {goodCount} Good
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
              {warningCount} Watch
            </span>
            {riskCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                {riskCount} Risk
              </span>
            )}
          </div>
        </div>

        <div className="h-8 w-px bg-gray-200 shrink-0" />

        {/* Deal Health Cards */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {deals.map((deal) => {
            const health = getDealHealth(deal.status)
            return (
              <button
                key={deal.id}
                type="button"
                onClick={() => onDealClick(deal.prompt)}
                className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all hover:shadow-sm ${HEALTH_COLORS[health]}`}
              >
                <span>{dealStatusIcon(deal.status)}</span>
                <span className="font-medium">{deal.company}</span>
                <span className="text-xs opacity-75">{deal.status}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
