import { LeadSchema, type Lead } from "./schema";

/**
 * Colunas exatas da planilha da Lutryx Júnior (A até P - 16 colunas).
 */
export const SHEET_HEADERS = [
  "Data/Hora da Captação",
  "Nome da Empresa",
  "CNPJ",
  "Nicho / Setor",
  "Cidade / UF",
  "Distância da Referência (km)",
  "Contexto e Sistemas Atuais",
  "Decisor (Nome e Cargo)",
  "Telefone / WhatsApp",
  "E-mail Corporativo",
  "Links Digitais (Site / LinkedIn)",
  "Foco da Solução (BI / Revenue / Sistema Próprio)",
  "Gargalo Identificado (Pain Point)",
  "Sistema Recomendado (Lutryx Jr.)",
  "Pitch de Abordagem (UNIFEI)",
  "Status Comercial",
] as const;

/**
 * Converte um lead (validado pelo Zod) em uma linha de planilha, na ordem exata de A a P.
 */
export function leadToSheetRow(input: Lead): string[] {
  const lead = LeadSchema.parse(input);
  const { companyInfo: c, contactData: ct, systemNeeds: s } = lead;

  const date = new Date(lead.capturedAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateTime = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;

  // Extrai CNPJ caso esteja embutido no nome da empresa
  let cleanName = c.companyName;
  let cnpj = c.cnpj || "";
  const cnpjMatch = cleanName.match(/\(CNPJ\s*([^)]+)\)/i);
  if (cnpjMatch) {
    if (!cnpj) cnpj = cnpjMatch[1].trim();
    cleanName = cleanName.replace(/\(CNPJ\s*[^)]+\)/i, "").trim();
  }

  // Foco formatado exatamente como na planilha (BI, Revenue, Sistema Próprio)
  const focusFormatted =
    s.focusArea === "Business Intelligence"
      ? "BI"
      : s.focusArea === "Revenue Intelligence"
        ? "Revenue"
        : "Sistema Próprio";

  // Distância com " km" (ex: "65 km")
  const distanceFormatted = `${Math.round(c.distanceFromOriginKm)} km`;

  return [
    dateTime,                                      // A: Data/Hora da Captação
    cleanName,                                     // B: Nome da Empresa
    cnpj || "Não informado",                       // C: CNPJ
    c.sector,                                      // D: Nicho / Setor
    c.location,                                    // E: Cidade / UF
    distanceFormatted,                             // F: Distância da Referência (km)
    c.companyContext,                              // G: Contexto e Sistemas Atuais
    ct.decisionMaker,                              // H: Decisor (Nome e Cargo)
    ct.phoneOrWhatsapp,                            // I: Telefone / WhatsApp
    ct.email,                                      // J: E-mail Corporativo
    ct.digitalLinks.join(" | "),                   // K: Links Digitais (Site / LinkedIn)
    focusFormatted,                                // L: Foco da Solução (BI / Revenue / Sistema Próprio)
    s.identifiedPainPoint,                         // M: Gargalo Identificado (Pain Point)
    s.recommendedSystem,                           // N: Sistema Recomendado (Lutryx Jr.)
    s.unifeiPitch,                                 // O: Pitch de Abordagem (UNIFEI)
    "Novo Lead",                                   // P: Status Comercial
  ];
}
