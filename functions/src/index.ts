import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import express from "express";
import cors from "cors";
import {GoogleGenerativeAI} from "@google/generative-ai";
import {buildProposalPrompt, PDF_EXTRACTION_PROMPT} from "./prompts";

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({origin: true}));
app.use(express.json({limit: "256kb"}));

// Gemini
function getModel() {
  const apiKey = process.env.GEMINI_API_KEY ||
    functions.config().gemini?.api_key || "";
  if (!apiKey) throw new Error("GEMINI_API_KEY が未設定です");
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelId = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  return genAI.getGenerativeModel({model: modelId});
}

// ─── Company ──────────────────────────────────────────

app.get("/api/company", async (_req, res) => {
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
