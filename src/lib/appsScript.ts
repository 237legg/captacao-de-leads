import { SHEET_HEADERS } from "./sheetRow";

/**
 * Código pronto de Google Apps Script configurado especificamente para a aba "Leads Captados"
 * e para a estrutura de 16 colunas (A até P) da Lutryx Júnior.
 */
export function buildAppsScript(sheetName = "Leads Captados"): string {
  const headers = JSON.stringify(SHEET_HEADERS);
  return `/**
 * Lutryx Júnior — Receptor Oficial de Leads (Google Apps Script)
 * 1. Na planilha: Extensões > Apps Script > cole este código > Salvar (Ctrl+S).
 * 2. Clique em "Implantar" > "Gerenciar implantações".
 *    Edite a implantação (lápis) > mude para "Nova versão" > "Implantar".
 * 3. Copie a URL gerada (termina em /exec) e cole no painel da Lutryx.
 */
const SHEET_NAME = ${JSON.stringify(sheetName)};
const HEADERS = ${headers};

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Procura a aba "Leads Captados" ou cria se não existir
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

    // Se a aba estiver totalmente vazia (sem cabeçalho), adiciona o cabeçalho oficial
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length)
        .setFontWeight("bold")
        .setBackground("#1D3557")
        .setFontColor("#FFFFFF");
      sheet.setFrozenRows(1);
    }

    // Se o backend enviou a linha montada (row), usa diretamente (colunas A até P)
    let row;
    if (Array.isArray(payload.row) && payload.row.length > 0) {
      row = payload.row;
    } else {
      row = rowFromLead_(payload);
    }

    sheet.appendRow(row);

    return ContentService.createTextOutput(JSON.stringify({ 
      ok: true, 
      row: sheet.getLastRow(), 
      sheet: sheet.getName() 
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, message: "Webhook Lutryx Júnior Ativo na aba " + SHEET_NAME }))
    .setMimeType(ContentService.MimeType.JSON);
}

function rowFromLead_(p) {
  var d = p.data || p;
  var c = p.companyInfo || {};
  var ct = p.contactData || {};
  var s = p.systemNeeds || {};

  var focus = (s.focusArea === "Business Intelligence" || d.area === "Business Intelligence") ? "BI" :
              (s.focusArea === "Revenue Intelligence" || d.area === "Revenue Intelligence") ? "Revenue" : "Sistema Próprio";

  var dist = d.distanciaKm || d.distancia || c.distanceFromOriginKm || 0;
  var distFormatted = typeof dist === "number" ? Math.round(dist) + " km" : dist;

  return [
    d.dataHora || Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm"), // A: Data/Hora da Captação
    d.empresa || d.companyName || c.companyName || "Não informado",                           // B: Nome da Empresa
    d.cnpj || c.cnpj || "Não informado",                                                      // C: CNPJ
    d.setor || d.nicho || c.sector || "Não informado",                                        // D: Nicho / Setor
    d.cidade || d.location || c.location || "Não informado",                                  // E: Cidade / UF
    distFormatted,                                                                            // F: Distância da Referência (km)
    d.contexto || c.companyContext || "",                                                     // G: Contexto e Sistemas Atuais
    d.decisor || d.responsavel || ct.decisionMaker || "Não informado",                         // H: Decisor (Nome e Cargo)
    d.telefone || d.whatsapp || ct.phoneOrWhatsapp || "Não informado",                        // I: Telefone / WhatsApp
    d.email || ct.email || "Não informado",                                                   // J: E-mail Corporativo
    d.links || (ct.digitalLinks ? ct.digitalLinks.join(" | ") : ""),                          // K: Links Digitais (Site / LinkedIn)
    focus,                                                                                    // L: Foco da Solução
    d.gargalo || d.dor || s.identifiedPainPoint || "Não informado",                           // M: Gargalo Identificado (Pain Point)
    d.sistema || s.recommendedSystem || "Não informado",                                      // N: Sistema Recomendado (Lutryx Jr.)
    d.pitch || s.unifeiPitch || "Não informado",                                              // O: Pitch de Abordagem (UNIFEI)
    "Novo Lead"                                                                               // P: Status Comercial
  ];
}
`;
}
