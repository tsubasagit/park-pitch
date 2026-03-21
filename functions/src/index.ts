import * as v1 from "firebase-functions/v1";
import * as admin from "firebase-admin";
import express, {type Request, type Response, type NextFunction} from "express";
import cors from "cors";
import {GoogleGenerativeAI} from "@google/generative-ai";
import {buildProposalPrompt, PDF_EXTRACTION_PROMPT} from "./prompts";

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({origin: true}));
app.use(express.json({limit: "2mb"}));

// ─── Auth middleware ─────────────────────────────────
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({error: "認証が必要です"});
    return;
  }
  try {
    const token = header.split("Bearer ")[1];
    const decoded = await admin.auth().verifyIdToken(token);
    (req as Request & {uid: string}).uid = decoded.uid;
    next();
  } catch {
    res.status(401).json({error: "無効な認証トークンです"});
  }
}

app.use("/api", requireAuth);

// Gemini
function getModel() {
  const apiKey = process.env.GEMINI_API_KEY ||
    v1.config().gemini?.api_key || "";
  if (!apiKey) throw new Error("GEMINI_API_KEY が未設定です");
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelId = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  return genAI.getGenerativeModel({model: modelId});
}

// ─── Seed Data ───────────────────────────────────────
const SEED_SERVICES = [
  {
    name: "税務顧問サービス",
    category: "税務・会計",
    overview: "月次の記帳代行から決算・申告までをワンストップで対応する税務顧問サービスです。経営数値の見える化と節税対策を通じて、経営者の意思決定をサポートします。",
    targetClients: "中小企業の経営者、個人事業主",
    challengesSolved: [
      "経理業務に時間を取られ本業に集中できない",
      "税務リスクを把握できていない",
      "決算・申告の負担が大きい",
    ],
    deliverables: [
      {name: "月次記帳代行", description: "仕訳入力・帳簿作成を代行"},
      {name: "月次試算表作成", description: "毎月の経営数値をレポート"},
      {name: "決算・申告書作成", description: "法人税・消費税等の申告対応"},
      {name: "税務相談", description: "節税対策・税務判断のアドバイス"},
    ],
    expertType: "税理士",
    engagementType: "顧問契約（月額）",
    pdfFilename: "",
    pdfOriginalName: "",
  },
  {
    name: "労務管理・社会保険手続き代行",
    category: "労務・人事",
    overview: "社会保険・労働保険の各種届出から就業規則の作成・改定、給与計算まで、人事労務に関するバックオフィス業務をトータルでサポートします。",
    targetClients: "従業員を雇用する中小企業、スタートアップ",
    challengesSolved: [
      "社会保険手続きが煩雑で漏れが発生する",
      "労務トラブルのリスクを未然に防ぎたい",
      "就業規則が法改正に対応できていない",
    ],
    deliverables: [
      {name: "社会保険手続き代行", description: "入退社・算定基礎届等の届出"},
      {name: "就業規則作成・改定", description: "法改正対応・リスク低減"},
      {name: "給与計算", description: "毎月の給与・賞与計算"},
      {name: "労務相談", description: "ハラスメント対策・働き方改革対応"},
    ],
    expertType: "社会保険労務士",
    engagementType: "顧問契約（月額）",
    pdfFilename: "",
    pdfOriginalName: "",
  },
  {
    name: "経営コンサルティング・事業承継支援",
    category: "経営・コンサルティング",
    overview: "財務分析をベースにした経営改善コンサルティングと、次世代への円滑な事業承継を支援するサービスです。企業価値の向上と持続的な成長を実現します。",
    targetClients: "事業承継を検討する中小企業経営者、業績改善を目指す企業",
    challengesSolved: [
      "後継者育成・事業承継の準備が遅れている",
      "経営課題の優先順位が見えない",
      "財務体質の改善が必要",
    ],
    deliverables: [
      {name: "経営診断レポート", description: "財務分析・課題抽出・改善提案"},
      {name: "事業承継計画策定", description: "株式移転・後継者育成プラン作成"},
      {name: "月次経営会議", description: "KPIモニタリング・PDCAサポート"},
      {name: "補助金・助成金申請支援", description: "活用可能な制度の提案・申請代行"},
    ],
    expertType: "経営コンサルタント・中小企業診断士",
    engagementType: "プロジェクト型 / 顧問契約",
    pdfFilename: "",
    pdfOriginalName: "",
  },
];

async function ensureSeedData() {
  const snap = await db.collection("services").limit(1).get();
  if (!snap.empty) return;

  const now = new Date().toISOString();
  const batch = db.batch();
  for (const svc of SEED_SERVICES) {
    const ref = db.collection("services").doc();
    batch.set(ref, {...svc, createdAt: now, updatedAt: now});
  }
  await batch.commit();
  console.log("[Seed] サンプルサービス3件を投入しました");
}

// ─── Company ──────────────────────────────────────────

app.get("/api/company", async (_req, res) => {
  await ensureSeedData();
  const doc = await db.collection("config").doc("company").get();
  res.json(doc.exists ? doc.data() : null);
});

app.post("/api/company", async (req, res) => {
  const body = req.body;
  const company = {
    name: body.name || "",
    industry: body.industry || "",
    description: body.description || "",
    philosophy: body.philosophy || "",
    expertise: body.expertise || "",
    offices: body.offices || "",
    strengths: Array.isArray(body.strengths) ? body.strengths :
      (body.strengths || "").split("\n").map((s: string) => s.trim())
        .filter(Boolean),
    contactPerson: body.contactPerson || "",
    email: body.email || "",
    logoPath: body.logoPath || "",
    updatedAt: new Date().toISOString(),
  };
  await db.collection("config").doc("company").set(company);
  res.json(company);
});

// ─── Services ─────────────────────────────────────────

interface ServiceFeature { name: string; description: string }
interface ServiceData {
  id: string; name: string; category: string;
  overview: string; targetClients: string;
  challengesSolved: string[]; deliverables: ServiceFeature[];
  expertType: string; engagementType: string;
  pdfFilename: string; pdfOriginalName: string;
  createdAt: string; updatedAt: string;
}

app.get("/api/services", async (_req, res) => {
  await ensureSeedData();
  const snap = await db.collection("services").orderBy("createdAt").get();
  const services = snap.docs.map((d) => ({id: d.id, ...d.data()}));
  res.json(services);
});

app.post("/api/services", async (req, res) => {
  try {
    const body = req.body;
    let extracted: Partial<ServiceData> = {};

    // If PDF base64 is provided, extract with Gemini
    if (body.pdfBase64) {
      try {
        const model = getModel();
        const result = await model.generateContent({
          contents: [{
            role: "user",
            parts: [
              {text: PDF_EXTRACTION_PROMPT},
              {inlineData: {mimeType: "application/pdf", data: body.pdfBase64}},
            ],
          }],
        });
        const text = result.response.text();
        const cleaned = text.replace(/```json\s*/g, "")
          .replace(/```\s*/g, "").trim();
        extracted = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error("[PDF抽出] パース失敗:", parseErr);
      }
    }

    const service: Omit<ServiceData, "id"> = {
      name: body.name || extracted.name || "",
      category: body.category || extracted.category || "",
      overview: body.overview || extracted.overview || "",
      targetClients: body.targetClients || extracted.targetClients || "",
      challengesSolved: body.challengesSolved ||
        extracted.challengesSolved || [],
      deliverables: body.deliverables || extracted.deliverables || [],
      expertType: body.expertType || extracted.expertType || "",
      engagementType: body.engagementType || extracted.engagementType || "",
      pdfFilename: "",
      pdfOriginalName: body.pdfOriginalName || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const ref = await db.collection("services").add(service);
    res.json({id: ref.id, ...service});
  } catch (err) {
    console.error("[POST /api/services]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "サービス登録に失敗しました",
    });
  }
});

app.put("/api/services/:id", async (req, res) => {
  const ref = db.collection("services").doc(req.params.id);
  const doc = await ref.get();
  if (!doc.exists) {
    res.status(404).json({error: "サービスが見つかりません"});
    return;
  }
  const updates = {
    ...req.body,
    updatedAt: new Date().toISOString(),
  };
  delete updates.id;
  delete updates.createdAt;
  await ref.update(updates);
  const updated = await ref.get();
  res.json({id: updated.id, ...updated.data()});
});

app.delete("/api/services/:id", async (req, res) => {
  const ref = db.collection("services").doc(req.params.id);
  const doc = await ref.get();
  if (!doc.exists) {
    res.status(404).json({error: "サービスが見つかりません"});
    return;
  }
  await ref.delete();
  res.json({ok: true});
});

// ─── Proposals ────────────────────────────────────────

app.post("/api/generate", async (req, res) => {
  try {
    const input = req.body;

    const companyDoc = await db.collection("config").doc("company").get();
    if (!companyDoc.exists) {
      res.status(400).json({
        error: "会社プロフィールが未設定です。先に設定してください。",
      });
      return;
    }
    const company = companyDoc.data()!;

    const serviceSnap = await db.collection("services").get();
    const allServices = serviceSnap.docs.map((d) => ({
      id: d.id, ...d.data(),
    })) as (ServiceData & {id: string})[];
    const selectedServices = allServices.filter((s) =>
      input.serviceIds.includes(s.id),
    );
    if (selectedServices.length === 0) {
      res.status(400).json({error: "サービスを1つ以上選択してください。"});
      return;
    }

    const prompt = buildProposalPrompt(
      company as Parameters<typeof buildProposalPrompt>[0],
      selectedServices,
      {
        clientName: input.clientName,
        challenge: input.challenge,
        budget: input.budget,
        timeline: input.timeline,
      },
    );

    const model = getModel();
    const result = await model.generateContent({
      contents: [{role: "user", parts: [{text: prompt}]}],
    });
    const markdown = result.response.text();

    const proposal = {
      serviceIds: input.serviceIds,
      serviceNames: selectedServices.map((s) => s.name),
      clientName: input.clientName || "御社",
      hearingInput: input,
      markdownContent: markdown,
      createdAt: new Date().toISOString(),
    };

    const ref = await db.collection("proposals").add(proposal);
    res.json({id: ref.id, ...proposal});
  } catch (err) {
    console.error("[POST /api/generate]", err);
    res.status(500).json({
      error: err instanceof Error ?
        err.message : "提案書の生成に失敗しました",
    });
  }
});

app.get("/api/proposals", async (_req, res) => {
  const snap = await db.collection("proposals")
    .orderBy("createdAt", "desc").get();
  const proposals = snap.docs.map((d) => {
    const data = d.data();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {markdownContent, ...rest} = data;
    return {id: d.id, ...rest};
  });
  res.json(proposals);
});

app.get("/api/proposals/:id", async (req, res) => {
  const doc = await db.collection("proposals").doc(req.params.id).get();
  if (!doc.exists) {
    res.status(404).json({error: "提案書が見つかりません"});
    return;
  }
  res.json({id: doc.id, ...doc.data()});
});

app.put("/api/proposals/:id", async (req, res) => {
  const ref = db.collection("proposals").doc(req.params.id);
  const doc = await ref.get();
  if (!doc.exists) {
    res.status(404).json({error: "提案書が見つかりません"});
    return;
  }
  const {markdownContent} = req.body;
  if (typeof markdownContent === "string") {
    await ref.update({markdownContent});
  }
  const updated = await ref.get();
  res.json({id: updated.id, ...updated.data()});
});

// ─── Blooming Products (Firestore) ───────────────────

interface BloomingProduct {
  id: string;
  source: string;
  sourceUrl: string;
  name: string;
  brand: string;
  price: number;
  materials: string[];
  colors: string[];
  category: string;
  gender: string;
  collections: string[];
  occasionTags: string[];
  useCaseTags: string[];
  priceSegment: string;
  giftScore: number;
  seasonality: string[];
  aiSummary: string;
  thumbnailUrl: string;
  imageUrls: string[];
  dimensions?: string;
  scrapedAt: string;
}

// メモリキャッシュ（Cold start 対策）
let cachedProducts: BloomingProduct[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5分

async function loadProducts(): Promise<BloomingProduct[]> {
  if (cachedProducts && Date.now() - cacheTime < CACHE_TTL) {
    return cachedProducts;
  }
  const snap = await db.collection("blooming_products").get();
  cachedProducts = snap.docs.map((d) => ({id: d.id, ...d.data()} as BloomingProduct));
  cacheTime = Date.now();
  return cachedProducts;
}

// GET /api/blooming/products
app.get("/api/blooming/products", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const perPage = Math.min(500, Math.max(1, Number(req.query.perPage) || 20));
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const category = typeof req.query.category === "string" ? req.query.category.trim() : "";
    const brand = typeof req.query.brand === "string" ? req.query.brand.trim() : "";
    const budgetMin = req.query.budgetMin ? Number(req.query.budgetMin) : undefined;
    const budgetMax = req.query.budgetMax ? Number(req.query.budgetMax) : undefined;
    const sort = typeof req.query.sort === "string" ? req.query.sort.trim() : "giftScore";

    let products = await loadProducts();

    // フィルタ
    if (category) products = products.filter((p) => p.category === category);
    if (brand) products = products.filter((p) => p.brand === brand);
    if (budgetMin != null && !isNaN(budgetMin)) products = products.filter((p) => p.price >= budgetMin);
    if (budgetMax != null && !isNaN(budgetMax)) products = products.filter((p) => p.price <= budgetMax);

    // テキスト検索
    if (q) {
      const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
      products = products.filter((p) => {
        const name = (p.name || "").toLowerCase();
        const summary = (p.aiSummary || "").toLowerCase();
        const cat = (p.category || "").toLowerCase();
        const br = (p.brand || "").toLowerCase();
        const tags = [...(p.occasionTags || []), ...(p.useCaseTags || [])].map((t) => t.toLowerCase());
        return terms.every(
          (t) => name.includes(t) || summary.includes(t) || cat.includes(t) || br.includes(t) || tags.some((tag) => tag.includes(t)),
        );
      });
    }

    // ソート
    if (sort === "price-asc") {
      products.sort((a, b) => a.price - b.price);
    } else if (sort === "price-desc") {
      products.sort((a, b) => b.price - a.price);
    } else {
      products.sort((a, b) => (b.giftScore ?? 0) - (a.giftScore ?? 0));
    }

    const total = products.length;
    const start = (page - 1) * perPage;
    const items = products.slice(start, start + perPage);
    res.json({items, total, page, perPage});
  } catch (err) {
    console.error("[GET /api/blooming/products]", err);
    res.status(500).json({error: "商品の取得に失敗しました"});
  }
});

// GET /api/blooming/products/:id
app.get("/api/blooming/products/:id", async (req, res) => {
  try {
    const doc = await db.collection("blooming_products").doc(req.params.id).get();
    if (!doc.exists) {
      res.status(404).json({error: "商品が見つかりません"});
      return;
    }
    res.json({id: doc.id, ...doc.data()});
  } catch (err) {
    console.error("[GET /api/blooming/products/:id]", err);
    res.status(500).json({error: "商品の取得に失敗しました"});
  }
});

// POST /api/blooming/products
app.post("/api/blooming/products", async (req, res) => {
  try {
    const body = req.body;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const br = typeof body.brand === "string" ? body.brand.trim() : "";
    const price = typeof body.price === "number" ? body.price : NaN;

    if (!name || !br || isNaN(price)) {
      res.status(400).json({error: "name, brand, price は必須です"});
      return;
    }

    const product: Omit<BloomingProduct, "id"> = {
      source: "custom",
      sourceUrl: "",
      name,
      brand: br,
      price,
      materials: Array.isArray(body.materials) ? body.materials : [],
      colors: Array.isArray(body.colors) ? body.colors : [],
      category: typeof body.category === "string" ? body.category : "",
      gender: typeof body.gender === "string" ? body.gender : "",
      collections: [],
      occasionTags: Array.isArray(body.occasionTags) ? body.occasionTags : [],
      useCaseTags: Array.isArray(body.useCaseTags) ? body.useCaseTags : [],
      priceSegment: price <= 770 ? "budget" : price <= 1980 ? "mid" : price <= 3300 ? "premium" : "luxury",
      giftScore: typeof body.giftScore === "number" ? body.giftScore : 5,
      seasonality: [],
      aiSummary: typeof body.aiSummary === "string" ? body.aiSummary : "",
      thumbnailUrl: typeof body.thumbnailUrl === "string" ? body.thumbnailUrl : "",
      imageUrls: Array.isArray(body.imageUrls) ? body.imageUrls : [],
      scrapedAt: new Date().toISOString(),
    };

    const ref = await db.collection("blooming_products").add(product);
    cachedProducts = null; // キャッシュ無効化
    res.status(201).json({id: ref.id, ...product});
  } catch (err) {
    console.error("[POST /api/blooming/products]", err);
    res.status(500).json({error: "商品の追加に失敗しました"});
  }
});

// GET /api/blooming/filters
app.get("/api/blooming/filters", async (_req, res) => {
  try {
    const products = await loadProducts();
    const categories = [...new Set(products.map((p) => p.category).filter(Boolean))].sort();
    const brands = [...new Set(products.map((p) => p.brand).filter(Boolean))].sort();
    const occasions = [...new Set(products.flatMap((p) => p.occasionTags || []).filter(Boolean))].sort();
    res.json({categories, brands, occasions});
  } catch (err) {
    console.error("[GET /api/blooming/filters]", err);
    res.status(500).json({error: "フィルタの取得に失敗しました"});
  }
});

// POST /api/blooming/recommend
app.post("/api/blooming/recommend", async (req, res) => {
  try {
    const body = req.body as {query?: string; filters?: Record<string, unknown>};
    const query = typeof body.query === "string" ? body.query : "";
    let products = await loadProducts();

    // フィルタ適用
    const f = body.filters || {};
    if (f.category) products = products.filter((p) => p.category === f.category);
    if (f.budgetMin) products = products.filter((p) => p.price >= Number(f.budgetMin));
    if (f.budgetMax) products = products.filter((p) => p.price <= Number(f.budgetMax));

    // スコアリング
    const terms = query.trim() ? query.trim().toLowerCase().split(/\s+/) : [];
    const scored = products.map((p) => {
      let score = (p.giftScore ?? 5) / 10;
      const matchedTags: string[] = [];
      for (const t of terms) {
        if ((p.name || "").toLowerCase().includes(t)) { score += 0.2; matchedTags.push(p.name); }
        if ((p.aiSummary || "").toLowerCase().includes(t)) { score += 0.15; }
        for (const tag of p.occasionTags || []) {
          if (tag.toLowerCase().includes(t)) { score += 0.1; matchedTags.push(tag); }
        }
      }
      return {product: p, score: Math.min(1, score), matchedTags: [...new Set(matchedTags)].slice(0, 5)};
    });
    scored.sort((a, b) => b.score - a.score);

    const results = scored.slice(0, 10).map((s, i) => ({
      productId: s.product.id,
      product: s.product,
      rank: i + 1,
      score: s.score,
      reason: s.product.aiSummary || `${s.product.brand}の${s.product.category}です。`,
      matchedTags: s.matchedTags,
    }));

    const id = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    res.json({id, query, filters: f, results, createdAt: new Date().toISOString()});
  } catch (err) {
    console.error("[POST /api/blooming/recommend]", err);
    res.status(500).json({error: "レコメンドに失敗しました"});
  }
});

// GET /api/blooming/recommendations (stub)
app.get("/api/blooming/recommendations", (_req, res) => {
  res.json([]);
});

// Export
export const api = v1.https.onRequest(app);
