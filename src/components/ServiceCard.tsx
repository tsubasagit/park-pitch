import type { Service } from '../types'

interface ServiceCardProps {
  service: Service
  onEdit: (service: Service) => void
  onDelete: (id: string) => void
}

export default function ServiceCard({ service, onEdit, onDelete }: ServiceCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{service.name || '（未設定）'}</h3>
          <span className="inline-block mt-1 text-xs bg-pitch-navy/10 text-pitch-navy px-2 py-0.5 rounded">
            {service.category || 'カテゴリ未設定'}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onEdit(service)}
            className="p-1.5 text-gray-400 hover:text-pitch-navy rounded hover:bg-gray-100 text-sm"
            title="編集"
          >
            ✏️
          </button>
          <button
            type="button"
            onClick={() => onDelete(service.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-gray-100 text-sm"
            title="削除"
          >
            🗑️
          </button>
        </div>
      </div>

      {service.overview && (
        <p className="mt-2 text-sm text-gray-600 line-clamp-2">{service.overview}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {service.expertType && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
            {service.expertType}
          </span>
        )}
        {service.engagementType && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
            {service.engagementType}
          </span>
        )}
      </div>

      <div className="mt-3 text-xs text-gray-400 flex items-center gap-1">
        <span>📄</span>
        <span className="truncate">{service.pdfOriginalName}</span>
      </div>
    </div>
  )
}
