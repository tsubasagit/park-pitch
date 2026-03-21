import * as functions from "firebase-functions";
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
    functions.config().gemini?.api_key || "";
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

// Export
export const api = functions.https.onRequest(app);
