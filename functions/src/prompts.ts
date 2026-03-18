export const PDF_EXTRACTION_PROMPT = `あなたはプロフェッショナルサービス企業のサービス情報抽出の専門家です。
以下のPDFから、サービスの構造化情報をJSON形式で抽出してください。

出力は以下のJSON形式のみで返してください（説明文やマークダウンは不要）:

{
  "name": "サービス名",
  "category": "カテゴリ（例: プロフェッショナルサービス, 実行支援, コンサルティング）",
  "overview": "サービス概要（2-3文）",
  "targetClients": "対象顧客（例: 中小企業の経営者）",
  "challengesSolved": ["解決する課題1", "解決する課題2"],
  "deliverables": [
    {"name": "提供内容の名前", "description": "提供内容の説明"}
  ],
  "expertType": "担当専門家種別（例: 税理士、社労士、コンサルタント）",
  "engagementType": "契約形態（例: 顧問契約、プロジェクト型、スポット）"
}

PDFの内容から読み取れない項目は空文字列または空配列で返してください。`;

export function buildProposalPrompt(
  company: {
    name: string;
    philosophy: string;
    expertise: string;
    offices: string;
    strengths: string[];
    contactPerson: string;
    description: string;
  },
  services: Array<{
    name: string;
    overview: string;
    challengesSolved: string[];
    deliverables: Array<{ name: string; description: string }>;
    expertType: string;
    engagementType: string;
  }>,
  hearing: {
    clientName?: string;
    challenge: string;
    budget: string;
    timeline: string;
  },
): string {
  const serviceText = services
    .map(
      (s, i) =>
        `### サービス${i + 1}: ${s.name}
- 概要: ${s.overview}
- 解決する課題: ${s.challengesSolved.join("、")}
- 提供内容: ${s.deliverables.map((d) => `${d.name}（${d.description}）`).join("、")}
- 担当専門家: ${s.expertType}
- 契約形態: ${s.engagementType}`,
    )
    .join("\n\n");

  const clientLabel = hearing.clientName || "御社";

  return `あなたは法人営業の提案書作成の専門家です。
以下の「自社情報」「提案サービス（複数）」「ヒアリング情報」から、
提案書をMarkdown形式で生成してください。

【自社情報】
- 会社名: ${company.name}
- 企業理念: ${company.philosophy}
- 会社概要: ${company.description}
- 専門家体制: ${company.expertise}
- 拠点: ${company.offices}
- 強み: ${company.strengths.join("、")}
- 担当者: ${company.contactPerson}

【提案サービス】
${serviceText}

【提案先】
- 企業名: ${clientLabel}

【ヒアリング情報】
- 課題: ${hearing.challenge}
- 予算感: ${hearing.budget}
- 導入時期: ${hearing.timeline}

【出力形式】
各セクションは --- で区切ってください。ページ数は固定せず、内容に応じて適切なボリュームで生成してください。
必須セクション（順序はあなたの判断で最適化してください）:
- 表紙（提案タイトル、提案先企業名、自社名、担当者名、日付）
- ${clientLabel}の現状と課題の整理（ヒアリング情報ベース）
- ご提案サービスと解決アプローチ（複数サービスを課題に紐づけて説明）
- 支援体制・スケジュール・概算費用（担当専門家はサービスから自動推定）
- 会社紹介・ご挨拶・連絡先

サービス数や課題の複雑さに応じてセクションを追加・分割してください。
提案先企業の立場に立ち、具体的かつ説得力のある内容にしてください。`;
}
