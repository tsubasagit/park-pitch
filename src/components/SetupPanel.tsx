import { useState } from 'react'
import type { Company, Service } from '../types'
import ServiceFormModal from './ServiceFormModal'
import { deleteService } from '../api/client'

interface SetupPanelProps {
  company: Company | null
  services: Service[]
  onEditCompany: () => void
  onServicesChanged: () => void
}

export default function SetupPanel({ company, services, onEditCompany, onServicesChanged }: SetupPanelProps) {
  const [showModal, setShowModal] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)

  const handleDelete = async (id: string) => {
    if (!confirm('このテンプレートを削除しますか？')) return
    try {
      await deleteService(id)
      onServicesChanged()
    } catch {
      // ignore
    }
  }

  return (
    <div className="p-4 space-y-6">
      {/* Company card */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">会社情報</h2>
          <button
            type="button"
            onClick={onEditCompany}
            className="text-xs text-pitch-navy hover:underline"
          >
            編集
          </button>
        </div>
        {company ? (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              {company.logoPath && (
                <img src={`/api/uploads/${company.logoPath}`} alt="" className="w-8 h-8 object-contain rounded" />
              )}
              <div className="font-semibold text-sm text-gray-900">{company.name}</div>
            </div>
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{company.expertise}</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={onEditCompany}
            className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-pitch-navy hover:text-pitch-navy"
          >
            会社情報を設定する
          </button>
        )}
      </div>

      {/* Service templates */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          商品テンプレート
        </h2>
        <div className="space-y-1">
          {services.map((service) => (
            <div
              key={service.id}
              className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm shrink-0">{'\uD83D\uDCC4'}</span>
                <span className="text-sm text-gray-800 truncate">{service.name || '（未設定）'}</span>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setEditingService(service)
                    setShowModal(true)
                  }}
                  className="p-1 text-gray-400 hover:text-pitch-navy text-xs"
                  title="編集"
                >
                  {'\u270F\uFE0F'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(service.id)}
                  className="p-1 text-gray-400 hover:text-red-600 text-xs"
                  title="削除"
                >
                  {'\uD83D\uDDD1\uFE0F'}
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingService(null)
            setShowModal(true)
          }}
          className="mt-2 w-full py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-pitch-navy hover:text-pitch-navy"
        >
          + テンプレートを登録
        </button>
      </div>

      {showModal && (
        <ServiceFormModal
          editingService={editingService}
          onClose={() => {
            setShowModal(false)
            setEditingService(null)
          }}
          onSaved={() => {
            setShowModal(false)
            setEditingService(null)
            onServicesChanged()
          }}
        />
      )}
    </div>
  )
}
