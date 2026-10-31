import "server-only";
import { z } from "zod";
import {
  FOCUS_AREAS,
  LeadSchema,
  type AgentEvent,
  type AgentRunRequest,
  type FocusArea,
  type Lead,
  type LogLevel,
  type SearchParams,
} from "@/lib/schema";
import { haversineKm, isValidLatLng, shortOriginLabel, type LatLng } from "@/lib/geo";
import { callGeminiWithSearch, extractJson, DEFAULT_GEMINI_MODEL, GeminiError } from "./gemini";
import { generateDemoLead } from "./demoLeads";
import { syncLeadToSheets } from "./googleSheetsService";

type Emit = (event: AgentEvent) => void;

const RESEARCH_CONCURRENCY = 3;
const MAX_DISCOVERY_ROUNDS = 6;
const RADIUS_TOLERANCE = 1.2; // tolera 20% (distância rodoviária x linha reta)

/* ------------------------------------------------------------------ */
/*  Schemas "tolerantes" para a saída bruta do LLM                     */
/* ------------------------------------------------------------------ */

const looseStr = z.preprocess(
  (v) => (v === null || v === undefined ? "" : typeof v === "string" ? v : String(v)),
  z.string(),
);
const looseNum = z.preprocess((v) => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(",", ".").replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}, z.number().optional());
const looseCoords = z
  .object({ lat: looseNum, lng: looseNum })
  .partial()
  .optional()
  .catch(undefined);

const DiscoverySchema = z.object({
  origin: looseCoords,
  companies: z
    .array(
      z.object({
        name: looseStr,
        city: looseStr,
        website: looseStr.optional(),
        lat: looseNum,
        lng: looseNum,
        estimatedDistanceKm: looseNum,
        whyFit: looseStr.optional(),
      }),
    )
    .default([]),
});
type Candidate = z.infer<typeof DiscoverySchema>["companies"][number];

const RawLeadSchema = z.object({
  companyName: looseStr,
  cnpj: looseStr.optional(),
  sector: looseStr,
  address: looseStr,
  city: looseStr,
  state: looseStr,
  lat: looseNum,
  lng: looseNum,
  estimatedDistanceKm: looseNum,
  companyContext: looseStr,
  decisionMakerName: looseStr,
  decisionMakerRole: looseStr,
  phoneOrWhatsapp: looseStr,
  email: looseStr,
  digitalLinks: z.array(looseStr).catch([]),
  focusArea: looseStr,
  identifiedPainPoint: looseStr,
  recommendedSystem: looseStr,
  unifeiPitch: looseStr,
  fitScore: looseNum,
});
type RawLead = z.infer<typeof RawLeadSchema>;

/* ------------------------------------------------------------------ */
/*  Prompts                                                            */
/* ------------------------------------------------------------------ */

const LUTRYX_CONTEXT = `A Lutryx Júnior (Lutryx Tecnologia Júnior) é a Empresa Júnior de tecnologia da UNIFEI (Universidade Federal de Itajubá).
Ela leva a visão técnica e atualizada dos estudantes da UNIFEI ao mercado, com preços mais acessíveis que consultorias tradicionais.
Áreas de atuação: Business Intelligence (BI), Revenue Intelligence e Desenvolvimento de Sistemas Próprios sob medida.
ICP: PMEs (≈10 a 500 funcionários) com operação comercial/financeira relevante, sinais de controles em planilhas, ERP genérico,
funil de vendas desestruturado, falta de indicadores ou processos manuais.`;

function focusInstruction(focus: SearchParams["focus"]): string {
  if (focus === "Todos") {
    return "Escolha a área mais aderente entre: Business Intelligence, Revenue Intelligence ou Sistema Próprio.";
  }
  return `O foco desta campanha é "${focus}". Priorize empresas com dor clara nessa área e use focusArea = "${focus}".`;
}

function discoveryPrompt(p: SearchParams, count: number, exclude: string[]): string {
  return `${LUTRYX_CONTEXT}

TAREFA: Use a Pesquisa Google para encontrar ${count} empresas REAIS e ATIVAS, dos nichos [${p.niches.join(", ")}],
localizadas num raio de até ${p.radiusKm} km de "${p.origin}".
${focusInstruction(p.focus)}

Regras:
- Somente empresas que realmente existem (com site, perfil no Google Maps, Instagram, LinkedIn ou CNPJ ativo).
- Varie as cidades dentro do raio; não repita filiais da mesma empresa.
- Evite multinacionais e grandes redes nacionais; priorize PMEs regionais.
${exclude.length ? `- NÃO inclua estas empresas (já captadas): ${exclude.slice(-80).join("; ")}.` : ""}

Responda APENAS com JSON válido, sem comentários, neste formato:
{"origin":{"lat":number,"lng":number},
 "companies":[{"name":"string","city":"Cidade - UF","website":"string","lat":number,"lng":number,"estimatedDistanceKm":number,"whyFit":"string curta"}]}`;
}

function researchPrompt(p: SearchParams, c: Candidate): string {
  return `${LUTRYX_CONTEXT}

TAREFA: Pesquise na web (Pesquisa Google) a empresa "${c.name}" (${c.city}${c.website ? `, site: ${c.website}` : ""})
e monte um lead qualificado para a Lutryx Júnior. Ponto de referência: "${p.origin}" (raio de ${p.radiusKm} km).
${focusInstruction(p.focus)}

Pesquise: site oficial, Google Maps, Instagram, LinkedIn, dados públicos de CNPJ (quadro societário) e notícias.

Regras CRÍTICAS:
- NUNCA invente telefone, e-mail, CNPJ ou nome de pessoa. Se não encontrar, use exatamente "Não encontrado".
- decisionMaker: sócio/diretor/gestor comercial, financeiro ou de operações (ex: sócio-administrador do QSA do CNPJ).
- companyContext: porte estimado, como opera hoje e quais sistemas/planilhas parece usar (cite evidências).
- identifiedPainPoint: gargalo concreto e plausível com base nas evidências.
- recommendedSystem: nome do sistema exato que a Lutryx deve desenvolver (ex: "Dashboard de Revenue Intelligence integrado ao CRM").
- unifeiPitch: mensagem curta (3-5 frases) de primeiro contato, personalizada, destacando a solução desenvolvida
  pelos alunos da UNIFEI com custo-benefício acessível. Tom profissional e próximo, em português do Brasil.
- fitScore: 0 a 100 de aderência ao ICP.

Responda APENAS com JSON válido neste formato:
{"companyName":"string","cnpj":"string","sector":"string","address":"string","city":"string","state":"UF",
 "lat":number,"lng":number,"estimatedDistanceKm":number,"companyContext":"string",
 "decisionMakerName":"string","decisionMakerRole":"string","phoneOrWhatsapp":"string","email":"string",
 "digitalLinks":["url"],"focusArea":"Business Intelligence | Revenue Intelligence | Sistema Próprio",
 "identifiedPainPoint":"string","recommendedSystem":"string","unifeiPitch":"string","fitScore":number}`;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const normalizeName = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(ltda|me|epp|eireli|s\.?a\.?|grupo|cia)\b/g, "")
    .replace(/[^a-z0-9]/g, "");

const NF = "Não encontrado";
const orNF = (s: string) => (s.trim() ? s.trim() : NF);

function coerceFocus(raw: string, filter: SearchParams["focus"]): FocusArea {
  if (filter !== "Todos") return filter;
  const r = raw.toLowerCase();
  if (r.includes("revenue")) return "Revenue Intelligence";
  if (r.includes("sistema") || r.includes("próprio") || r.includes("proprio")) return "Sistema Próprio";
  if (r.includes("business") || r.includes("bi")) return "Business Intelligence";
  return FOCUS_AREAS[0];
}

function resolveDistance(origin: LatLng | null, raw: { lat?: number; lng?: number }, estimate?: number) {
  const point = { lat: raw.lat, lng: raw.lng };
  if (origin && isValidLatLng(point)) return Math.round(haversineKm(origin, point));
  if (typeof estimate === "number" && estimate >= 0) return Math.round(estimate);
  return null;
}

function buildLead(raw: RawLead, p: SearchParams, distance: number, sources: string[]): Lead {
  const cnpjClean = raw.cnpj && raw.cnpj.trim() && !/não encontrado/i.test(raw.cnpj) ? raw.cnpj.trim() : "";
  const companyNameClean = raw.companyName.trim();
  const location = [raw.address, [raw.city, raw.state].filter((s) => s.trim()).join(" - ")]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" · ");
  const dm = [raw.decisionMakerName, raw.decisionMakerRole].map((s) => s.trim()).filter((s) => s && !/não encontrado/i.test(s));

  return LeadSchema.parse({
    id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    capturedAt: new Date().toISOString(),
    origin: p.origin,
    isDemo: false,
    companyInfo: {
      companyName: companyNameClean,
      cnpj: cnpjClean,
      sector: orNF(raw.sector || p.niches[0]),
      location: orNF(location),
      distanceFromOriginKm: distance,
      companyContext: orNF(raw.companyContext),
    },
    contactData: {
      decisionMaker: dm.length ? dm.join(" — ") : NF,
      phoneOrWhatsapp: orNF(raw.phoneOrWhatsapp),
      email: orNF(raw.email),
      digitalLinks: raw.digitalLinks.map((l) => l.trim()).filter((l) => l && !/não encontrado/i.test(l)),
    },
    systemNeeds: {
      focusArea: coerceFocus(raw.focusArea, p.focus),
      identifiedPainPoint: orNF(raw.identifiedPainPoint),
      recommendedSystem: orNF(raw.recommendedSystem),
      unifeiPitch: orNF(raw.unifeiPitch),
    },
    sources: sources.slice(0, 8),
  });
}

async function runPool<T>(items: T[], size: number, worker: (item: T) => Promise<void>, shouldStop: () => boolean) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(size, queue.length) }, async () => {
    while (queue.length && !shouldStop()) {
      const item = queue.shift()!;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

/* ------------------------------------------------------------------ */
/*  Agente principal                                                   */
/* ------------------------------------------------------------------ */

export async function runLeadAgent(req: AgentRunRequest, emit: Emit, signal: AbortSignal): Promise<void> {
  const p = req.params;
  const log = (level: LogLevel, message: string) =>
    emit({ type: "log", level, message, at: new Date().toISOString() });

  const apiKey = req.ai.geminiApiKey || process.env.GEMINI_API_KEY || "";
  const model = req.ai.model || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const label = shortOriginLabel(p.origin);
  let found = 0;
  let reserved = 0; // vagas reservadas por workers paralelos (evita ultrapassar a meta)

  const deliver = async (lead: Lead) => {
    log("sync", `Salvando "${lead.companyInfo.companyName}" no Google Sheets...`);
    const sync = await syncLeadToSheets(lead, req.sheets);
    found++;
    emit({ type: "lead", lead, sync });
    emit({ type: "progress", found, target: p.targetLeads });
    if (sync.ok) log("success", `✓ Lead #${found} sincronizado (${sync.message}).`);
    else if (sync.method === "disabled") log("warn", `Lead #${found} captado — sincronização com Sheets desativada.`);
    else log("error", `Falha ao sincronizar lead #${found}: ${sync.message}`);
  };

  /* ---------------- MODO DEMO ---------------- */
  if (!apiKey) {
    emit({ type: "start", mode: "demo" });
    log("warn", "GEMINI_API_KEY não configurada — executando em MODO DEMO com dados fictícios.");
    log("search", `Buscando empresas de ${p.niches.join(", ")} num raio de ${p.radiusKm} km de ${label}...`);
    for (let i = 0; i < p.targetLeads && !signal.aborted; i++) {
      await new Promise((r) => setTimeout(r, 700 + Math.random() * 600));
      const lead = generateDemoLead(p, i);
      log("analyze", `Analisando necessidade de ${lead.systemNeeds.focusArea} em "${lead.companyInfo.companyName}"...`);
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));
      await deliver(lead);
    }
    emit({ type: "done", found, target: p.targetLeads, reason: signal.aborted ? "Interrompido pelo usuário" : "Meta atingida (demo)" });
    return;
  }

  /* ---------------- MODO LIVE (Gemini + Google Search) ---------------- */
  emit({ type: "start", mode: "live", model });
  log("info", `Agente iniciado com ${model} + Google Search grounding.`);

  const seen = new Set(req.excludeCompanies.map(normalizeName));
  const excludeNames = [...req.excludeCompanies];
  let originCoords: LatLng | null = null;
  let emptyRounds = 0;
  const stop = () => signal.aborted || reserved >= p.targetLeads;

  for (let round = 1; round <= MAX_DISCOVERY_ROUNDS && !stop(); round++) {
    const remaining = p.targetLeads - found;
    const batch = Math.min(12, Math.max(3, Math.ceil(remaining * 1.5)));

    log("search", `Rodada ${round}: buscando ${batch} empresas de ${p.niches.join(", ")} num raio de ${p.radiusKm} km de ${label}...`);

    let candidates: Candidate[] = [];
    try {
      const res = await callGeminiWithSearch({
        apiKey,
        model,
        prompt: discoveryPrompt(p, batch, excludeNames),
        signal,
        temperature: 0.6,
      });
      const parsed = DiscoverySchema.parse(extractJson(res.text));
      if (!originCoords && parsed.origin && isValidLatLng(parsed.origin)) {
        originCoords = parsed.origin as LatLng;
        log("info", `Ponto de referência geolocalizado: ${originCoords.lat.toFixed(4)}, ${originCoords.lng.toFixed(4)}`);
      }
      if (res.queries.length) log("search", `Consultas: ${res.queries.slice(0, 3).join(" · ")}`);
      candidates = parsed.companies.filter((c) => {
        const key = normalizeName(c.name);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        excludeNames.push(c.name);
        return true;
      });
    } catch (err) {
      if (signal.aborted) break;
      if (err instanceof GeminiError && err.fatal) {
        emit({ type: "fatal", message: `Gemini: ${err.message}` });
        return;
      }
      log("error", `Falha na descoberta: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!candidates.length) {
      emptyRounds++;
      log("warn", "Nenhuma empresa nova encontrada nesta rodada.");
      if (emptyRounds >= 2) break;
      continue;
    }
    emptyRounds = 0;
    log("info", `${candidates.length} empresas candidatas encontradas. Iniciando qualificação...`);

    await runPool(
      candidates,
      RESEARCH_CONCURRENCY,
      async (c) => {
        const preDistance = resolveDistance(originCoords, c, c.estimatedDistanceKm);
        if (preDistance !== null && preDistance > p.radiusKm * RADIUS_TOLERANCE) {
          log("warn", `Descartada "${c.name}" — ${preDistance} km (fora do raio de ${p.radiusKm} km).`);
          return;
        }

        log("analyze", `Analisando necessidade de BI / Revenue / Sistema em "${c.name}" (${c.city})...`);
        try {
          const res = await callGeminiWithSearch({ apiKey, model, prompt: researchPrompt(p, c), signal, temperature: 0.3 });
          const raw = RawLeadSchema.parse(extractJson(res.text));
          if (stop()) return;

          const distance =
            resolveDistance(originCoords, raw, raw.estimatedDistanceKm) ?? preDistance ?? 0;
          if (distance > p.radiusKm * RADIUS_TOLERANCE) {
            log("warn", `Descartada "${c.name}" — ${distance} km do ponto de referência.`);
            return;
          }
          if (!raw.companyName.trim()) raw.companyName = c.name;

          const lead = buildLead(raw, p, distance, res.sources);
          if (typeof raw.fitScore === "number") {
            log("analyze", `Fit ICP de "${c.name}": ${Math.round(raw.fitScore)}/100 · ${lead.systemNeeds.focusArea}`);
          }
          if (stop() || reserved >= p.targetLeads) return;
          reserved++;
          await deliver(lead);
        } catch (err) {
          if (signal.aborted) return;
          const msg = err instanceof z.ZodError ? "dados incompletos (validação Zod)" : err instanceof Error ? err.message : String(err);
          log("error", `Não foi possível qualificar "${c.name}": ${msg.slice(0, 160)}`);
        }
      },
      stop,
    );
  }

  const reason = signal.aborted
    ? "Interrompido pelo usuário"
    : found >= p.targetLeads
      ? "Meta atingida"
      : "Busca esgotada — tente ampliar o raio ou os nichos";
  emit({ type: "done", found, target: p.targetLeads, reason });
}
