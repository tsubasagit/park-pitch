import { useState, useEffect, type FormEvent } from 'react'
import { getCompany, saveCompany } from '../api/client'
import type { Company } from '../types'

interface CompanySlideOverProps {
  open: boolean
  isOnboarding: boolean
  onClose: () => void
  onSaved: (company: Company) => void
}

export default function CompanySlideOver({ open, isOnboarding, onClose, onSaved }: CompanySlideOverProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [name, setName] = useState('')
  const [industry, setIndustry] = useState('')
  const [philosophy, setPhilosophy] = useState('')
  const [description, setDescription] = useState('')
  const [expertise, setExpertise] = useState('')
  const [offices, setOffices] = useState('')
  const [strengths, setStrengths] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [email, setEmail] = useState('')
  const [logo, setLogo] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setMessage('')
    getCompany()
      .then((data) => {
        if (data) {
          setName(data.name)
          setIndustry(data.industry)
          setPhilosophy(data.philosophy)
          setDescription(data.description)
          setExpertise(data.expertise)
          setOffices(data.offices)
          setStrengths(data.strengths.join('\n'))
          setContactPerson(data.contactPerson)
          setEmail(data.email)
          if (data.logoPath) setLogoPreview(`/api/uploads/${data.logoPath}`)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open])

  const handleLogoChange = (file: File | null) => {
    setLogo(file)
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => setLogoPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      const formData = new FormData()
      formData.append('name', name)
      formData.append('industry', industry)
      formData.append('philosophy', philosophy)
      formData.append('description', description)
      formData.append('expertise', expertise)
      formData.append('offices', offices)
      formData.append('strengths', strengths)
      formData.append('contactPerson', contactPerson)
      formData.append('email', email)
      if (logo) formData.append('logo', logo)

      const company = await saveCompany(formData)
      onSaved(company)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={isOnboarding ? undefined : onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-xl z-50 overflow-y-auto animate-slide-in">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-gray-900">
            {isOnboarding ? 'ようこそ Park-Pitch へ' : '会社プロフィール'}
          </h2>
          {!isOnboarding && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 text-xl"
            >
              &times;
            </button>
          )}
        </div>

        <div className="p-6">
          {isOnboarding && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                まず、会社プロフィールを入力してください。提案書に自動的に反映されます。
              </p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-pitch-navy/20 border-t-pitch-navy rounded-full animate-spin" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Logo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">会社ロゴ（任意）</label>
                <div className="flex items-center gap-4">
                  {logoPreview && (
                    <img src={logoPreview} alt="ロゴ" className="w-12 h-12 object-contain border rounded" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleLogoChange(e.target.files?.[0] ?? null)}
                    className="text-sm text-gray-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="会社名" value={name} onChange={setName} required />
                <Field label="業種" value={industry} onChange={setIndustry} required placeholder="例: 士業コンサルティング" />
              </div>

              <Field label="企業理念" value={philosophy} onChange={setPhilosophy} textarea placeholder="例: 中小企業の成長を支える..." />
              <Field label="会社概要" value={description} onChange={setDescription} textarea placeholder="例: 徳島県を拠点に..." />
              <Field label="専門家体制" value={expertise} onChange={setExpertise} textarea placeholder="例: 税理士10名、公認会計士1名..." />
              <Field label="拠点情報" value={offices} onChange={setOffices} textarea placeholder="例: 本社（徳島市）、東京オフィス..." />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">強み（1行に1つ）</label>
                <textarea
                  value={strengths}
                  onChange={(e) => setStrengths(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pitch-navy/50"
                  placeholder={"ワンストップで複合的なサービス提供\n業界特化の深い知見"}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="担当者名" value={contactPerson} onChange={setContactPerson} required placeholder="例: 山田太郎" />
                <Field label="メールアドレス" value={email} onChange={setEmail} required placeholder="例: info@example.com" type="email" />
              </div>

              <div className="flex items-center gap-4 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-8 py-2.5 bg-pitch-navy text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-semibold disabled:opacity-50"
                >
                  {saving ? '保存中...' : '保存する'}
                </button>
                {message && (
                  <span className="text-sm text-red-600">{message}</span>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  )
}

function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
  textarea,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  placeholder?: string
  textarea?: boolean
  type?: string
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
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={cls} placeholder={placeholder} required={required} />
      )}
    </div>
  )
}
