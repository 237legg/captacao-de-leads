import "server-only";
import { google } from "googleapis";
import type { Lead, SheetsConfig, SyncResult } from "@/lib/schema";
import { SHEET_HEADERS, leadToSheetRow } from "@/lib/sheetRow";

/* ------------------------------------------------------------------ */
/*  Formato da linha                                                   */
/* ------------------------------------------------------------------ */

// Formato [Data/Hora, Nome da Empresa, Nicho, Cidade, Distância (km), Decisor, Telefone/WhatsApp,
// E-mail, Área (BI/Revenue), Gargalo, Sistema Recomendado, Pitch Lutryx, Status, ...complementares]
export { SHEET_HEADERS, leadToSheetRow };

/* ------------------------------------------------------------------ */
/*  Webhook (Apps Script / n8n / Make)                                 */
/* ------------------------------------------------------------------ */

async function syncViaWebhook(lead: Lead, row: string[], url: string): Promise<SyncResult> {
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, method: "webhook", message: "URL de Webhook inválida." };
  }

  const { companyInfo: c, contactData: ct, systemNeeds: s } = lead;
  const dateTime = new Date(lead.capturedAt).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });

  // Campos planos com todos os aliases comuns (pt-BR e en) para compatibilidade
  // com qualquer script customizado de Google Apps Script / CRM
  const flatFields = {
    // Empresa
    empresa: c.companyName,
    companyName: c.companyName,
    company: c.companyName,
    nomeEmpresa: c.companyName,
    name: c.companyName,

    // Nicho / Setor
    setor: c.sector,
    sector: c.sector,
    nicho: c.sector,
    segmento: c.sector,

    // Localização / Cidade
    cidade: c.location,
    location: c.location,
    localizacao: c.location,
    endereco: c.location,
    address: c.location,
    city: c.location,

    // Distância
    distancia: c.distanceFromOriginKm,
    distanciaKm: c.distanceFromOriginKm,
    distanceFromOriginKm: c.distanceFromOriginKm,
    distanciaOrigem: `${Math.round(c.distanceFromOriginKm)} km`,

    // Decisor / Contato / Responsável
    responsavel: ct.decisionMaker,
    decisor: ct.decisionMaker,
    decisionMaker: ct.decisionMaker,
    contato: ct.decisionMaker,
    nome: ct.decisionMaker,
    cargo: ct.decisionMaker,

    // Telefone / WhatsApp
    telefone: ct.phoneOrWhatsapp,
    whatsapp: ct.phoneOrWhatsapp,
    phone: ct.phoneOrWhatsapp,
    phoneOrWhatsapp: ct.phoneOrWhatsapp,

    // E-mail
    email: ct.email,
    e_mail: ct.email,
    mail: ct.email,

    // Links digitais / Site
    site: ct.digitalLinks[0] || "",
    website: ct.digitalLinks[0] || "",
    links: ct.digitalLinks.join(" | "),
    digitalLinks: ct.digitalLinks.join(" | "),

    // Foco / Área
    area: s.focusArea,
    foco: s.focusArea,
    focusArea: s.focusArea,

    // Gargalo / Dor
    gargalo: s.identifiedPainPoint,
    dor: s.identifiedPainPoint,
    painPoint: s.identifiedPainPoint,
    identifiedPainPoint: s.identifiedPainPoint,

    // Sistema Recomendado
    sistema: s.recommendedSystem,
    sistemaRecomendado: s.recommendedSystem,
    solucao: s.recommendedSystem,
    recommendedSystem: s.recommendedSystem,

    // Pitch
    pitch: s.unifeiPitch,
    unifeiPitch: s.unifeiPitch,
    proposta: s.unifeiPitch,

    // Contexto e Meta
    contexto: c.companyContext,
    companyContext: c.companyContext,
    status: lead.isDemo ? "Novo (Demo)" : "Novo",
    score: 100,
    pontuacao: 100,
    origem: lead.origin,
    origin: lead.origin,
    data: dateTime,
    dataHora: dateTime,
    dateTime: dateTime,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...flatFields,
      event: "lead.captured",
      headers: SHEET_HEADERS,
      row,
      lead,
      data: flatFields,
    }),
    redirect: "follow", // Apps Script responde com 302 para googleusercontent.com
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      method: "webhook",
      message: `Webhook respondeu ${res.status}: ${body.slice(0, 160)}`,
    };
  }

  const text = await res.text().catch(() => "");

  // Se o Google redirecionou para tela de login (ocorre quando "Quem pode acessar" não está como "Qualquer pessoa")
  if (
    text.includes("<!DOCTYPE") ||
    text.includes("<html") ||
    text.includes("accounts.google.com") ||
    text.includes("ServiceLogin")
  ) {
    return {
      ok: false,
      method: "webhook",
      message:
        "Apps Script bloqueado pelo Google. Na implantação do Apps Script, defina 'Quem pode acessar' como 'Qualquer pessoa'.",
    };
  }

  try {
    const json = JSON.parse(text) as { ok?: boolean; error?: string; row?: number; sheet?: string };
    if (json.ok === false) {
      return { ok: false, method: "webhook", message: json.error ?? "Webhook retornou erro." };
    }
    if (json.ok && json.sheet) {
      return { ok: true, method: "webhook", message: `Sincronizado na aba "${json.sheet}" (linha ${json.row})` };
    }
  } catch {
    /* resposta não-JSON: se o status foi 2xx, continua */
  }

  return { ok: true, method: "webhook", message: "Sincronizado via Webhook" };
}

/* ------------------------------------------------------------------ */
/*  Google Sheets API oficial (Service Account)                        */
/* ------------------------------------------------------------------ */

type ServiceAccountCreds = { client_email: string; private_key: string };

function resolveServiceAccount(config: SheetsConfig): ServiceAccountCreds | null {
  if (config.serviceAccountJson) {
    try {
      const parsed = JSON.parse(config.serviceAccountJson) as Partial<ServiceAccountCreds>;
      if (parsed.client_email && parsed.private_key) {
        return { client_email: parsed.client_email, private_key: parsed.private_key };
      }
    } catch {
      return null;
    }
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (email && key) {
    return { client_email: email, private_key: key.replace(/\\n/g, "\n") };
  }
  return null;
}

/** Cache simples para não verificar o cabeçalho a cada linha. */
const headerEnsured = new Set<string>();

async function syncViaServiceAccount(row: string[], config: SheetsConfig): Promise<SyncResult> {
  const spreadsheetId = config.spreadsheetId || process.env.SPREADSHEET_ID || "";
  if (!spreadsheetId) {
    return { ok: false, method: "serviceAccount", message: "SPREADSHEET_ID não configurado." };
  }

  const creds = resolveServiceAccount(config);
  if (!creds) {
    return {
      ok: false,
      method: "serviceAccount",
      message:
        "Credenciais da Service Account ausentes (cole o JSON nas configurações ou defina GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY).",
    };
  }

  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const sheetName = config.sheetName || "Leads";
  const cacheKey = `${spreadsheetId}::${sheetName}`;

  if (!headerEnsured.has(cacheKey)) {
    // Cria a aba se não existir
    const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
    const exists = meta.data.sheets?.some((s) => s.properties?.title === sheetName);
    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] },
      });
    }

    const head = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!A1:A1`,
    });
    if (!head.data.values?.length) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sheetName}'!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [[...SHEET_HEADERS]] },
      });
    }
    headerEnsured.add(cacheKey);
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${sheetName}'!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });

  return { ok: true, method: "serviceAccount", message: "Sincronizado via Google Sheets API" };
}

/* ------------------------------------------------------------------ */
/*  Ponto de entrada único                                             */
/* ------------------------------------------------------------------ */

/**
 * Envia o lead para o Google Sheets usando o método configurado.
 * Nunca lança exceção: sempre retorna um SyncResult.
 */
export async function syncLeadToSheets(lead: Lead, config: SheetsConfig): Promise<SyncResult> {
  if (config.method === "disabled") {
    return { ok: false, method: "disabled", message: "Sincronização desativada" };
  }

  try {
    const row = leadToSheetRow(lead);
    if (config.method === "webhook") {
      return await syncViaWebhook(lead, row, config.webhookUrl);
    }
    return await syncViaServiceAccount(row, config);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, method: config.method, message: message.slice(0, 240) };
  }
}
