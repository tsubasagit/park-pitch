import type { ProposalJSON } from '../types'

interface ProposalRendererProps {
  data: ProposalJSON
}

export default function ProposalRenderer({ data }: ProposalRendererProps) {
  return (
    <div className="proposal-document space-y-0">
      {/* 表紙 */}
      <CoverPage cover={data.cover} />

      {/* ご挨拶 */}
      {data.greeting && <GreetingPage greeting={data.greeting} clientName={data.cover.clientName} />}

      {/* 商品ページ（1商品1ページ） */}
      {data.products?.map((product, i) => (
        <ProductPage key={product.productId || i} product={product} index={i} />
      ))}

      {/* 比較表 */}
      {data.comparison && <ComparisonPage comparison={data.comparison} />}

      {/* 納期・費用 */}
      {(data.delivery || data.pricing) && (
        <PricingPage delivery={data.delivery} pricing={data.pricing} />
      )}

      {/* 会社情報 */}
      {data.companyInfo && <CompanyPage info={data.companyInfo} />}
    </div>
  )
}

function CoverPage({ cover }: { cover: ProposalJSON['cover'] }) {
  return (
    <div className="proposal-page bg-gradient-to-br from-pitch-navy via-pitch-navyLight to-pitch-navy text-white flex flex-col items-center justify-center text-center min-h-[600px] rounded-xl mb-6 px-10 py-12">
      <div className="flex-1 flex flex-col items-center justify-center">
        <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
          {cover.title || 'ノベルティご提案'}
        </h1>
        {cover.subtitle && (
          <p className="text-lg md:text-xl text-white/80 mb-8">{cover.subtitle}</p>
        )}
        <div className="w-16 h-px bg-white/30 mb-8" />
        <p className="text-lg text-white/90 mb-2">
          {cover.clientName} 様
        </p>
      </div>
      <div className="text-sm text-white/60 space-y-1">
        <p>{cover.companyName}</p>
        <p>担当: {cover.contactPerson}</p>
        <p>{cover.date}</p>
      </div>
    </div>
  )
}

function GreetingPage({ greeting, clientName }: { greeting: string; clientName: string }) {
  return (
    <div className="proposal-page bg-white rounded-xl border border-gray-200 mb-6 px-10 py-10">
      <h2 className="text-xl font-bold text-pitch-navy mb-6 border-b-2 border-pitch-navy pb-2">
        {clientName} 様へのご提案
      </h2>
      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{greeting}</p>
    </div>
  )
}

function ProductPage({ product, index }: { product: ProposalJSON['products'][number]; index: number }) {
  const specs = product.specs
  return (
    <div className="proposal-page bg-white rounded-xl border border-gray-200 mb-6 px-10 py-10">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-xs font-medium text-pitch-navy bg-pitch-navy/10 px-2.5 py-1 rounded-full">
          商品 {index + 1}
        </span>
        <h2 className="text-xl font-bold text-gray-900">{product.name}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* 左: 商品写真 + 色見本 */}
        <div>
          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                画像なし
              </div>
            )}
          </div>

          {/* 色見本バッジ */}
          {specs.colors && specs.colors.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">カラー展開</h4>
              <div className="flex flex-wrap gap-2">
                {specs.colors.map((color) => (
                  <span
                    key={color}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-full text-xs text-gray-700"
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-gray-300"
                      style={{ backgroundColor: colorToHex(color) }}
                    />
                    {color}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 右: 仕様カード */}
        <div>
          <p className="text-sm text-gray-700 leading-relaxed mb-6">{product.description}</p>

          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">仕様</h4>
            <SpecRow label="素材" value={specs.material} />
            <SpecRow label="サイズ" value={specs.size} />
            <SpecRow label="名入れ" value={specs.customization} />
            <div className="border-t border-gray-200 pt-3 mt-3">
              <SpecRow label="単価" value={specs.unitPrice} bold />
              <SpecRow label="数量" value={specs.quantity} />
              <SpecRow label="納期" value={specs.deliveryDays} />
            </div>
          </div>

          {product.recommendation && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <p className="text-xs font-semibold text-blue-600 mb-1">おすすめポイント</p>
              <p className="text-sm text-blue-800">{product.recommendation}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ComparisonPage({ comparison }: { comparison: NonNullable<ProposalJSON['comparison']> }) {
  return (
    <div className="proposal-page bg-white rounded-xl border border-gray-200 mb-6 px-10 py-10">
      <h2 className="text-xl font-bold text-pitch-navy mb-4 border-b-2 border-pitch-navy pb-2">
        商品比較
      </h2>
      {comparison.comment && (
        <p className="text-sm text-gray-700 mb-6">{comparison.comment}</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-pitch-navy/5">
              <th className="text-left px-4 py-3 font-semibold text-gray-700 border-b-2 border-pitch-navy/20">商品名</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700 border-b-2 border-pitch-navy/20">単価</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700 border-b-2 border-pitch-navy/20">素材</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700 border-b-2 border-pitch-navy/20">サイズ</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700 border-b-2 border-pitch-navy/20">名入れ</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700 border-b-2 border-pitch-navy/20">納期</th>
            </tr>
          </thead>
          <tbody>
            {comparison.table.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="px-4 py-3 font-medium text-gray-900 border-b border-gray-100">{row.name}</td>
                <td className="px-4 py-3 text-gray-700 border-b border-gray-100">{row.price}</td>
                <td className="px-4 py-3 text-gray-700 border-b border-gray-100">{row.material}</td>
                <td className="px-4 py-3 text-gray-700 border-b border-gray-100">{row.size}</td>
                <td className="px-4 py-3 text-gray-700 border-b border-gray-100">{row.customization}</td>
                <td className="px-4 py-3 text-gray-700 border-b border-gray-100">{row.deliveryDays}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PricingPage({
  delivery,
  pricing,
}: {
  delivery?: ProposalJSON['delivery']
  pricing?: ProposalJSON['pricing']
}) {
  return (
    <div className="proposal-page bg-white rounded-xl border border-gray-200 mb-6 px-10 py-10">
      {/* 納期 */}
      {delivery && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-pitch-navy mb-4 border-b-2 border-pitch-navy pb-2">
            納品スケジュール
          </h2>
          {delivery.timeline && (
            <p className="text-sm text-gray-700 mb-4">{delivery.timeline}</p>
          )}
          {delivery.notes && delivery.notes.length > 0 && (
            <ul className="space-y-2">
              {delivery.notes.map((note, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-pitch-navy mt-0.5">*</span>
                  {note}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 費用 */}
      {pricing && (
        <div>
          <h2 className="text-xl font-bold text-pitch-navy mb-4 border-b-2 border-pitch-navy pb-2">
            お見積もり
          </h2>
          {pricing.summary && (
            <p className="text-sm text-gray-700 mb-4">{pricing.summary}</p>
          )}
          {pricing.breakdown && pricing.breakdown.length > 0 && (
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-pitch-navy/5">
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 border-b-2 border-pitch-navy/20">品目</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700 border-b-2 border-pitch-navy/20">単価</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700 border-b-2 border-pitch-navy/20">数量</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700 border-b-2 border-pitch-navy/20">小計</th>
                  </tr>
                </thead>
                <tbody>
                  {pricing.breakdown.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-4 py-3 text-gray-900 border-b border-gray-100">{row.item}</td>
                      <td className="px-4 py-3 text-gray-700 text-right border-b border-gray-100">{row.unitPrice}</td>
                      <td className="px-4 py-3 text-gray-700 text-right border-b border-gray-100">{row.quantity}</td>
                      <td className="px-4 py-3 text-gray-900 font-medium text-right border-b border-gray-100">{row.subtotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pricing.total && (
            <div className="flex justify-end">
              <div className="bg-pitch-navy/5 px-6 py-3 rounded-lg">
                <span className="text-sm text-gray-600">合計: </span>
                <span className="text-lg font-bold text-pitch-navy">{pricing.total}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CompanyPage({ info }: { info: ProposalJSON['companyInfo'] }) {
  return (
    <div className="proposal-page bg-white rounded-xl border border-gray-200 mb-6 px-10 py-10">
      <h2 className="text-xl font-bold text-pitch-navy mb-6 border-b-2 border-pitch-navy pb-2">
        会社紹介
      </h2>
      <h3 className="text-lg font-bold text-gray-900 mb-3">{info.name}</h3>
      <p className="text-sm text-gray-700 mb-6 leading-relaxed">{info.description}</p>

      {info.strengths && info.strengths.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">当社の強み</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {info.strengths.map((s, i) => (
              <div key={i} className="flex items-start gap-2 p-3 bg-pitch-navy/5 rounded-lg">
                <span className="text-pitch-navy font-bold text-sm mt-0.5">{i + 1}.</span>
                <span className="text-sm text-gray-700">{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-gray-200 pt-4 mt-4">
        <p className="text-sm text-gray-600">
          担当: <span className="font-medium">{info.contact}</span>
        </p>
        <p className="text-sm text-gray-600">
          Email: <a href={`mailto:${info.email}`} className="text-pitch-navy hover:underline">{info.email}</a>
        </p>
      </div>
    </div>
  )
}

function SpecRow({ label, value, bold }: { label: string; value?: string; bold?: boolean }) {
  if (!value) return null
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={bold ? 'font-bold text-gray-900' : 'text-gray-700'}>{value}</span>
    </div>
  )
}

function colorToHex(colorName: string): string {
  const map: Record<string, string> = {
    'ホワイト': '#ffffff',
    '白': '#ffffff',
    'ブラック': '#1a1a1a',
    '黒': '#1a1a1a',
    'ネイビー': '#1e3a5f',
    '紺': '#1e3a5f',
    'ブルー': '#3b82f6',
    '青': '#3b82f6',
    'レッド': '#ef4444',
    '赤': '#ef4444',
    'ピンク': '#ec4899',
    'グリーン': '#22c55e',
    '緑': '#22c55e',
    'イエロー': '#eab308',
    '黄': '#eab308',
    'ベージュ': '#d4b896',
    'グレー': '#9ca3af',
    '灰': '#9ca3af',
    'ブラウン': '#92400e',
    '茶': '#92400e',
    'オレンジ': '#f97316',
    'パープル': '#a855f7',
    '紫': '#a855f7',
  }
  return map[colorName] || '#d4d4d4'
}
