"use client";

import { z } from "zod";
import {
  AiConfigSchema,
  DEFAULT_ORIGIN,
  LeadSchema,
  SheetsConfigSchema,
  type AiConfig,
  type Lead,
  type SearchParams,
  type SheetsConfig,
  type SyncResult,
} from "./schema";

export type StoredLead = Lead & { sync: SyncResult };

const StoredLeadSchema = LeadSchema.extend({
  sync: z.object({
    ok: z.boolean(),
    method: z.enum(["webhook", "serviceAccount", "disabled"]),
    message: z.string(),
  }),
});

export const STORAGE_KEYS = {
  leads: "lutryx.leads.v1",
  sheets: "lutryx.sheets.v1",
  ai: "lutryx.ai.v1",
  params: "lutryx.params.v1",
} as const;

export const MAX_STORED_LEADS = 500;

/* Defaults (referências estáveis para useLocalStorage) */
export const DEFAULT_LEADS: StoredLead[] = [];
export const DEFAULT_SHEETS: SheetsConfig = SheetsConfigSchema.parse({});
export const DEFAULT_AI: AiConfig = AiConfigSchema.parse({});
export const DEFAULT_PARAMS: SearchParams = {
  niches: ["Indústria", "Distribuidoras"],
  origin: DEFAULT_ORIGIN,
  radiusKm: 50,
  focus: "Todos",
  targetLeads: 10,
};

/* Parsers tolerantes */
export const parseLeads = (raw: unknown): StoredLead[] =>
  Array.isArray(raw)
    ? raw.flatMap((item) => {
        const r = StoredLeadSchema.safeParse(item);
        return r.success ? [r.data] : [];
      })
    : DEFAULT_LEADS;

export const parseSheets = (raw: unknown): SheetsConfig => {
  const r = SheetsConfigSchema.safeParse(raw);
  return r.success ? r.data : DEFAULT_SHEETS;
};

export const parseAi = (raw: unknown): AiConfig => {
  const r = AiConfigSchema.safeParse(raw);
  return r.success ? r.data : DEFAULT_AI;
};

export const parseParams = (raw: unknown): SearchParams => {
  if (!raw || typeof raw !== "object") return DEFAULT_PARAMS;
  return { ...DEFAULT_PARAMS, ...(raw as Partial<SearchParams>) };
};
