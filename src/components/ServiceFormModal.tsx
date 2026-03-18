import { useState, type FormEvent } from 'react'
import type { Service, ServiceFeature } from '../types'
import { createService, updateService } from '../api/client'
import LoadingSpinner from './LoadingSpinner'

interface ServiceFormModalProps {
  editingService: Service | null
  onClose: () => void
  onSaved: () => void
}

export default function ServiceFormModal({ editingService, onClose, onSaved }: ServiceFormModalProps) {
  const isEdit = editingService !== null

  // Step state: 'upload' | 'edit'
  const [step, setStep] = useState<'upload' | 'edit'>(isEdit ? 'edit' : 'upload')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)

  // Form fields
  const [name, setName] = useState(editingService?.name ?? '')
  const [category, setCategory] = useState(editingService?.category ?? '')
  const [overview, setOverview] = useState(editingService?.overview ?? '')
  const [targetClients, setTargetClients] = useState(editingService?.targetClients ?? '')
  const [challengesSolved, setChallengesSolved] = useState(
    editingService?.challengesSolved.join('\n') ?? '',
  )
  const [deliverables, setDeliverables] = useState<ServiceFeature[]>(
    editingService?.deliverables ?? [{ name: '', description: '' }],
  )
  const [expertType, setExpertType] = useState(editingService?.expertType ?? '')
  const [engagementType, setEngagementType] = useState(editingService?.engagementType ?? '')
  const [serviceId, setServiceId] = useState(editingService?.id ?? '')

  const handleUpload = async () => {
    if (!pdfFile) return
    setUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('pdf', pdfFile)
      const service = await createService(formData)

      // Populate form with extracted data
      setServiceId(service.id)
      setName(service.name)
      setCategory(service.category)
      setOverview(service.overview)
      setTargetClients(service.targetClients)
      setChallengesSolved(service.challengesSolved.join('\n'))
      setDeliverables(
        service.deliverables.length > 0
          ? service.deliverables
          : [{ name: '', description: '' }],
      )
      setExpertType(service.expertType)
      setEngagementType(service.engagementType)
      setStep('edit')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'アップロードに失敗しました')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      await updateService(serviceId, {
        name,
        category,
        overview,
        targetClients,
        challengesSolved: challengesSolved.split('\n').map((s) => s.trim()).filter(Boolean),
        deliverables: deliverables.filter((d) => d.name || d.description),
        expertType,
        engagementType,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const addDeliverable = () => {
    setDeliverables([...deliverables, { name: '', description: '' }])
  }

  const updateDeliverable = (index: number, field: keyof ServiceFeature, value: string) => {
    const updated = [...deliverables]
    updated[index] = { ...updated[index], [field]: value }
    setDeliverables(updated)
  }

  const removeDeliverable = (index: number) => {
    if (deliverables.length <= 1) return
    setDeliverables(deliverables.filter((_, i) => i !== index))
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? 'サービスを編集' : step === 'upload' ? 'サービスを登録' : '抽出データを確認・編集'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 text-xl"
          >
            &times;
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          {step === 'upload' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                サービス紹介のPDFをアップロードすると、AIが内容を解析して構造化データを抽出します。
              </p>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                  className="text-sm text-gray-500"
                />
                {pdfFile && (
                  <p className="mt-2 text-sm text-gray-700">選択: {pdfFile.name}</p>
                )}
              </div>

              {uploading ? (
                <LoadingSpinner message="PDFを解析中... (15-30秒かかることがあります)" />
              ) : (
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={!pdfFile}
                  className="w-full py-2.5 bg-pitch-navy text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-semibold disabled:opacity-40"
                >
                  アップロードして解析
                </button>
              )}
            </div>
          )}

          {step === 'edit' && (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="サービス名" value={name} onChange={setName} required />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-navy/50"
                  >
                    <option value="">選択してください</option>
                    <option value="プロフェッショナルサービス">プロフェッショナルサービス</option>
                    <option value="実行支援">実行支援</option>
                    <option value="コンサルティング">コンサルティング</option>
                    <option value="アウトソーシング">アウトソーシング</option>
                    <option value="その他">その他</option>
                  </select>
                </div>
              </div>

              <FormField label="サービス概要" value={overview} onChange={setOverview} textarea />
              <FormField label="対象顧客" value={targetClients} onChange={setTargetClients} placeholder="例: 中小企業の経営者" />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">解決する課題（1行に1つ）</label>
                <textarea
                  value={challengesSolved}
                  onChange={(e) => setChallengesSolved(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-navy/50"
                  placeholder={"事業承継の準備が遅れている\n税務リスクを把握できていない"}
                />
              </div>

              {/* Deliverables */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">提供内容</label>
                {deliverables.map((d, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={d.name}
                      onChange={(e) => updateDeliverable(i, 'name', e.target.value)}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-navy/50"
                      placeholder="名前"
                    />
                    <input
                      type="text"
                      value={d.description}
                      onChange={(e) => updateDeliverable(i, 'description', e.target.value)}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-navy/50"
                      placeholder="説明"
                    />
                    <button
                      type="button"
                      onClick={() => removeDeliverable(i)}
                      className="p-2 text-gray-400 hover:text-red-500 text-sm"
                      title="削除"
                    >
                      &times;
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addDeliverable}
                  className="text-sm text-pitch-navy hover:underline"
                >
                  + 提供内容を追加
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="担当専門家種別" value={expertType} onChange={setExpertType} placeholder="例: 税理士、社労士" />
                <FormField label="契約形態" value={engagementType} onChange={setEngagementType} placeholder="例: 顧問契約、プロジェクト型" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-8 py-2 bg-pitch-navy text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-semibold disabled:opacity-50"
                >
                  {saving ? '保存中...' : '保存する'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function FormField({
  label,
  value,
  onChange,
  required,
  placeholder,
  textarea,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  placeholder?: string
  textarea?: boolean
}) {
  const cls =
    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-navy/50'
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className={cls} placeholder={placeholder} required={required} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={cls} placeholder={placeholder} required={required} />
      )}
    </div>
  )
}
