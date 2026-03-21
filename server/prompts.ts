/**
 * テキスト入力 → 構造化データ抽出プロンプト
 * ユーザーのフリーテキストから提案書に必要な情報を抽出する
 */
export const TEXT_EXTRACTION_PROMPT = `あなたはB2B法人営業の情報抽出アシスタントです。
営業担当者が入力したテキストから、ノベルティ/ギフト商品の提案に必要な情報を構造化JSONで抽出してください。

出力は以下のJSON形式のみで返してください（説明文やマークダウンは不要）:

{
  "clientName": "提案先企業名（不明なら空文字）",
  "purpose": "用途・キャンペーン内容（不明なら空文字）",
  "quantity": null,
  "unitPriceMin": null,
  "unitPriceMax": null,
  "deliveryDate": "YYYY-MM-DD形式（不明ならnull）",
  "customization": "名入れ・印刷等の要望（不明なら空文字）",
  "keywords": ["商品検索に使えるキーワード"]
}

注意:
- 数量(quantity)は数値で返してください（例: 19300）
- 単価は円単位の数値で返してください（例: 250, 300）
- 「250-300円」のような表記はunitPriceMin: 250, unitPriceMax: 300として抽出
- 納期は可能な限りYYYY-MM-DD形式に変換（月だけなら末日を設定）
- keywordsは商品カタログ検索用（例: ["保冷バッグ", "エコバッグ", "夏"]）`

/**
 * 提案書生成プロンプト
 * 商品スペック中心のB2B製造提案書を構造化JSONで出力
 */
export function buildBloomingProposalPrompt(
  company: {
    name: string
    description: string
    philosophy: string
    strengths: string[]
    contactPerson: string
    email: string
  },
  products: Array<{
    id: string
    name: string
    brand: string
    price: number
    materials: string[]
    dimensions?: string
    colors: string[]
    category: string
    occasionTags: string[]
    aiSummary: string
    thumbnailUrl: string
  }>,
  request: {
    clientName: string
    purpose: string
    quantity?: number
    unitPriceMin?: number
    unitPriceMax?: number
    deliveryDate?: string
    customization?: string
  },
): string {
  const productText = products
    .map(
      (p, i) =>
        `### 商品${i + 1}: ${p.name}
- ID: ${p.id}
- ブランド: ${p.brand}
- 参考価格: ¥${p.price.toLocaleString()}
- 素材: ${p.materials.join('、') || '不明'}
- サイズ: ${p.dimensions || '不明'}
- カラー展開: ${p.colors.join('、') || '不明'}
- カテゴリ: ${p.category}
- タグ: ${p.occasionTags.join('、')}
- 概要: ${p.aiSummary || ''}
- 画像URL: ${p.thumbnailUrl || ''}`,
    )
    .join('\n\n')

  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })

  return `あなたはブルーミング中西のノベルティ/ギフト商品提案書を作成する営業支援AIです。
以下の情報から、提案書の構造化JSONを生成してください。

【自社情報】
- 会社名: ${company.name}
- 概要: ${company.description}
- 理念: ${company.philosophy}
- 強み: ${company.strengths.join('、')}
- 担当者: ${company.contactPerson}
- Email: ${company.email}

【提案商品】
${productText}

【提案先・要件】
- 企業名: ${request.clientName || '御社'}
- 用途: ${request.purpose || '（未指定）'}
- 数量: ${request.quantity ? `${request.quantity.toLocaleString()}個` : '（未指定）'}
- 単価帯: ${request.unitPriceMin || request.unitPriceMax ? `¥${request.unitPriceMin || '?'}〜¥${request.unitPriceMax || '?'}` : '（未指定）'}
- 納品希望: ${request.deliveryDate || '（未指定）'}
- カスタマイズ: ${request.customization || '（未指定）'}

【出力形式】
以下のJSON形式で出力してください。JSONのみで返してください:

{
  "cover": {
    "title": "提案書タイトル（例: 夏キャンペーン ノベルティご提案）",
    "subtitle": "サブタイトル（例: オリジナル保冷バッグのご提案）",
    "clientName": "${request.clientName || '御社'}",
    "companyName": "${company.name}",
    "contactPerson": "${company.contactPerson}",
    "date": "${today}"
  },
  "greeting": "ご挨拶文（2-3文、提案先の用途に合わせた導入文）",
  "products": [
    {
      "productId": "商品ID",
      "name": "商品名",
      "description": "商品の特徴・おすすめポイント（3-4文）",
      "imageUrl": "画像URL",
      "specs": {
        "material": "素材",
        "size": "サイズ",
        "colors": ["カラー1", "カラー2"],
        "customization": "名入れ方法（シルク印刷1色 等）",
        "unitPrice": "¥XXX",
        "quantity": "XX,XXX個",
        "deliveryDays": "約XX営業日"
      },
      "recommendation": "この商品が提案先に適している理由（1-2文）"
    }
  ],
  "comparison": {
    "comment": "商品比較のコメント（1-2文）",
    "table": [
      {
        "name": "商品名",
        "price": "¥XXX",
        "material": "素材",
        "size": "サイズ",
        "customization": "名入れ",
        "deliveryDays": "納期"
      }
    ]
  },
  "delivery": {
    "timeline": "納品スケジュール概要",
    "notes": ["注意事項1", "注意事項2"]
  },
  "pricing": {
    "summary": "お見積もり概要（1-2文）",
    "breakdown": [
      {
        "item": "商品名",
        "unitPrice": "¥XXX",
        "quantity": "XX,XXX個",
        "subtotal": "¥X,XXX,XXX"
      }
    ],
    "total": "¥X,XXX,XXX（税別）"
  },
  "companyInfo": {
    "name": "${company.name}",
    "description": "${company.description}",
    "strengths": ${JSON.stringify(company.strengths)},
    "contact": "${company.contactPerson}",
    "email": "${company.email}"
  }
}

注意:
- 各商品の仕様は提供された情報から正確に記述してください
- 数量・単価が指定されていれば計算に使ってください
- 名入れ方法は商品の素材に適した方法を提案してください（布→シルク印刷、合皮→箔押し 等）
- 納期は一般的なノベルティ製造の目安で記載してください
- 提案先企業の業種・用途に合わせたトーンで記述してください`
}

// ─── Blooming 商品レコメンド（既存）────────────────

export const PRODUCT_ENRICHMENT_PROMPT = `以下の商品データにAIエンリッチメントを付与してください。
各商品に対して: occasionTags（贈答シーン）, useCaseTags（用途）, seasonality（季節）, giftScore(1-10), priceSegment, aiSummary(30-50文字) を生成し、JSON配列で返してください。`

export function buildRecommendationPrompt(
  query: string,
  filters: { occasion?: string; budgetMin?: number; budgetMax?: number; gender?: string; category?: string },
  candidateSummaries: Array<{ id: string; name: string; price: number; brand: string; category: string; occasionTags: string[]; giftScore: number; aiSummary: string }>,
): string {
  const limit = 30
  const list = candidateSummaries.slice(0, limit).map(
    (p) => `- id: ${p.id}, 名前: ${p.name}, 価格: ${p.price}円, ブランド: ${p.brand}, カテゴリ: ${p.category}, タグ: ${(p.occasionTags || []).join(', ')}, ギフトスコア: ${p.giftScore}, 概要: ${p.aiSummary || ''}`,
  ).join('\n')

  return `営業マンからの依頼: 「${query}」
条件: ${JSON.stringify(filters)}

以下の候補商品から、依頼に最も適した5〜10件をランキングし、それぞれにおすすめ理由（reason）を付けてください。
出力はJSONのみで、次の形式にしてください:
{ "items": [ { "productId": "id", "rank": 1, "score": 0.9, "reason": "おすすめ理由（1〜2文）", "matchedTags": ["タグ1"] } ] }

候補商品:
${list}`
}
