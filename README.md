# Pitch - 提案書ジェネレーター

自社サービス特化の提案書AI自動生成ツール。PDFからサービス情報を構造化抽出し、ヒアリング情報と組み合わせて提案書をワンクリック生成。

## 構成

- **フロント**: Vite + React + TypeScript + Tailwind + React Router
- **バックエンド**: Express + Gemini API
- **データ**: JSON永続化（server/data/）

## セットアップ

```bash
npm install
cp .env.example .env
# .env に GEMINI_API_KEY を設定
npm run dev
```

- フロント: http://localhost:5179
- API: http://localhost:3002

## 画面構成

| 画面 | パス | 概要 |
|---|---|---|
| 会社プロフィール | `/settings` | 初回オンボーディング＋会社情報編集 |
| サービス管理 | `/services` | PDF登録→AI構造化抽出→編集 |
| 提案書作成 | `/generate` | 提案先＋サービス選択＋ヒアリング→生成 |
| 提案書履歴 | `/proposals` | 過去の提案書一覧・プレビュー・印刷 |

## API

| Method | Path | 用途 |
|---|---|---|
| GET/POST | `/api/company` | 会社プロフィール |
| GET/POST/PUT/DELETE | `/api/services` | サービスCRUD |
| POST | `/api/generate` | 提案書生成 |
| GET | `/api/proposals` | 提案書履歴 |
| GET | `/api/blooming/products` | Blooming 商品一覧 |
| GET | `/api/blooming/products/:id` | Blooming 商品詳細 |
| POST | `/api/blooming/recommend` | Blooming レコメンド検索 |
| GET | `/api/blooming/filters` | Blooming フィルタ選択肢 |
| GET | `/api/blooming/recommendations` | Blooming レコメンド履歴 |

## Blooming 商品レコメンド（モック優先）

- サイドバーの「Blooming」でモード切替。キーワード＋フィルタで商品をおすすめ表示。
- **モック切替ポイント**:
  - ランキング: `server/blooming.ts` の `mockRank` を、`server/prompts.ts` の `buildRecommendationPrompt` + Gemini 呼び出しに差し替え可。
  - エンリッチメント: `server/scrapers/enrichProducts.ts` は `GEMINI_API_KEY` 未設定時はモックでタグ付与。設定時は実APIでエンリッチ。
- データ投入: `npm run seed:blooming` でモックスクレイプ → マージ → エンリッチを一括実行（`server/data/blooming_products.json` を生成）。
