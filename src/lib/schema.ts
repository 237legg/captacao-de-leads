import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  Enums & constantes                                                 */
/* ------------------------------------------------------------------ */

export const FOCUS_AREAS = [
  "Business Intelligence",
  "Revenue Intelligence",
  "Sistema Próprio",
] as const;

export const FocusAreaSchema = z.enum(FOCUS_AREAS);
export type FocusArea = z.infer<typeof FocusAreaSchema>;

/** Filtro de foco na interface: "Todos" deixa o agente decidir a melhor área. */
export const FocusFilterSchema = z.enum(["Todos", ...FOCUS_AREAS]);
export type FocusFilter = z.infer<typeof FocusFilterSchema>;

export const DEFAULT_ORIGIN =
  "Universidade Federal de Itajubá - UNIFEI, Itajubá - MG";

export const NICHE_PRESETS = [
  "Varejo",
  "Indústria",
  "Logística",
  "Clínicas",
  "Distribuidoras",
  "E-commerce",
  "Serviços B2B",
  "Agronegócio",
  "Construção Civil",
  "Educação",
] as const;

/* ------------------------------------------------------------------ */
/*  Core Lead Schema                                                   */
/* ------------------------------------------------------------------ */

const nonEmpty = z.string().trim().min(1);

export const CompanyInfoSchema = z.object({
  companyName: nonEmpty, // Nome da empresa
  cnpj: z.string().trim().default(""), // CNPJ formatado se disponível
  sector: nonEmpty,
  location: nonEmpty, // Cidade, Estado e endereço
  distanceFromOriginKm: z.number().nonnegative(), // distância estimada em km
  companyContext: nonEmpty,
});

export const ContactDataSchema = z.object({
  decisionMaker: nonEmpty, // Nome e cargo
  phoneOrWhatsapp: nonEmpty,
  email: nonEmpty,
  digitalLinks: z.array(z.string().trim().min(1)).default([]),
});

export const SystemNeedsSchema = z.object({
  focusArea: FocusAreaSchema,
  identifiedPainPoint: nonEmpty,
  recommendedSystem: nonEmpty,
  unifeiPitch: nonEmpty,
});

export const LeadSchema = z.object({
  id: nonEmpty,
  capturedAt: z.string().datetime(),
  origin: nonEmpty,
  isDemo: z.boolean().default(false),
  companyInfo: CompanyInfoSchema,
  contactData: ContactDataSchema,
  systemNeeds: SystemNeedsSchema,
  sources: z.array(z.string()).default([]),
});

export type Lead = z.infer<typeof LeadSchema>;

/* ------------------------------------------------------------------ */
/*  Parâmetros de busca (painel de controle)                           */
/* ------------------------------------------------------------------ */

export const SearchParamsSchema = z.object({
  niches: z.array(nonEmpty).min(1, "Selecione ao menos um nicho"),
  origin: nonEmpty.default(DEFAULT_ORIGIN),
  radiusKm: z.number().int().min(1).max(1000),
  focus: FocusFilterSchema.default("Todos"),
  targetLeads: z.number().int().min(1).max(100),
});

export type SearchParams = z.infer<typeof SearchParamsSchema>;

/* ------------------------------------------------------------------ */
/*  Configuração do Google Sheets                                      */
/* ------------------------------------------------------------------ */

export const SheetsConfigSchema = z.object({
  method: z.enum(["webhook", "serviceAccount", "disabled"]).default("disabled"),
  webhookUrl: z.string().trim().default(""),
  spreadsheetId: z.string().trim().default(""),
  sheetName: z.string().trim().default("Leads Captados"),
  /** JSON da Service Account (opcional — se vazio, usa variáveis de ambiente). */
  serviceAccountJson: z.string().trim().default(""),
});

export type SheetsConfig = z.infer<typeof SheetsConfigSchema>;

export const AiConfigSchema = z.object({
  /** Chave Gemini opcional (se vazia, usa GEMINI_API_KEY do servidor). */
  geminiApiKey: z.string().trim().default(""),
  model: z.string().trim().default(""),
});

export type AiConfig = z.infer<typeof AiConfigSchema>;

export const AgentRunRequestSchema = z.object({
  params: SearchParamsSchema,
  sheets: SheetsConfigSchema,
  ai: AiConfigSchema.default({ geminiApiKey: "", model: "" }),
  /** Nomes de empresas já captadas (evita duplicidade entre execuções). */
  excludeCompanies: z.array(z.string()).default([]),
});

export type AgentRunRequest = z.infer<typeof AgentRunRequestSchema>;

/* ------------------------------------------------------------------ */
/*  Eventos de streaming (NDJSON)                                      */
/* ------------------------------------------------------------------ */

export type LogLevel = "info" | "search" | "analyze" | "sync" | "success" | "warn" | "error";

export type SyncResult = {
  ok: boolean;
  method: SheetsConfig["method"];
  message: string;
};

export type AgentEvent =
  | { type: "start"; mode: "live" | "demo"; model?: string }
  | { type: "log"; level: LogLevel; message: string; at: string }
  | { type: "progress"; found: number; target: number }
  | { type: "lead"; lead: Lead; sync: SyncResult }
  | { type: "done"; found: number; target: number; reason: string }
  | { type: "fatal"; message: string };
