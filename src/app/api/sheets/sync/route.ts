import { z } from "zod";
import { DEFAULT_ORIGIN, LeadSchema, SheetsConfigSchema, type Lead } from "@/lib/schema";
import { syncLeadToSheets } from "@/services/googleSheetsService";

const SyncRequestSchema = z.object({
  config: SheetsConfigSchema,
  /** Lead a sincronizar. Se omitido com test=true, envia uma linha de teste. */
  lead: LeadSchema.optional(),
  test: z.boolean().optional(),
});

function testLead(): Lead {
  return LeadSchema.parse({
    id: `test-${Date.now()}`,
    capturedAt: new Date().toISOString(),
    origin: DEFAULT_ORIGIN,
    isDemo: true,
    companyInfo: {
      companyName: "TecnoVale Componentes Eletrônicos Ltda.",
      cnpj: "24.891.430/0001-52",
      sector: "Indústria Eletroeletrônica / Manufatura",
      location: "Santa Rita do Sapucaí - MG",
      distanceFromOriginKm: 42,
      companyContext: "Chão de fábrica operando com apontamentos manuais em papel e planilhas Excel dispersas.",
    },
    contactData: {
      decisionMaker: "Mariana Prado Ramos (Gerente Geral Industrial)",
      phoneOrWhatsapp: "(35) 99123-8840",
      email: "mariana.prado@tecnovalecomp.com.br",
      digitalLinks: [
        "https://tecnovalecomp.com.br",
        "https://linkedin.com/company/tecnovale-componentes",
      ],
    },
    systemNeeds: {
      focusArea: "Business Intelligence",
      identifiedPainPoint: "Fechamento mensal de DRE financeiro e OEE fabril demora mais de 10 dias úteis.",
      recommendedSystem: "Pipeline de BI Automatizado para Consolidação de DRE e Indicadores de Produção (OEE).",
      unifeiPitch: "Olá Mariana, somos da Lutryx Júnior, consultoria de engenharia e tecnologia da UNIFEI em Itajubá. Vemos forte potencial na TecnoVale e auxiliamos indústrias do Vale da Eletrônica a automatizarem relatórios de chão de fábrica e DRE.",
    },
    sources: [],
  });
}

/**
 * Sincroniza um lead com o Google Sheets (Service Account ou Webhook).
 * Usado para reenvio manual e para testar a conexão.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = SyncRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, message: "Requisição inválida", issues: parsed.error.issues }, { status: 400 });
  }

  const { config, lead, test } = parsed.data;
  const target = lead ?? (test ? testLead() : null);
  if (!target) {
    return Response.json({ ok: false, message: "Informe um lead ou test=true" }, { status: 400 });
  }

  const result = await syncLeadToSheets(target, config);
  return Response.json(result, { status: result.ok || result.method === "disabled" ? 200 : 502 });
}
