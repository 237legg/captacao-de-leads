import "server-only";
import type { FocusArea, Lead, SearchParams } from "@/lib/schema";
import { FOCUS_AREAS } from "@/lib/schema";
import { haversineKm, shortOriginLabel, type LatLng } from "@/lib/geo";

/**
 * Gerador de leads FICTÍCIOS para o modo Demo (sem GEMINI_API_KEY).
 * Permite testar todo o fluxo (UI, streaming, Google Sheets) sem custo.
 */

const UNIFEI: LatLng = { lat: -22.4135, lng: -45.4497 };

const SOUTH_MG_CITIES: Array<{ name: string; uf: string } & LatLng> = [
  { name: "Itajubá", uf: "MG", lat: -22.4256, lng: -45.4528 },
  { name: "Piranguinho", uf: "MG", lat: -22.395, lng: -45.5322 },
  { name: "Santa Rita do Sapucaí", uf: "MG", lat: -22.2522, lng: -45.7031 },
  { name: "Brazópolis", uf: "MG", lat: -22.4747, lng: -45.6064 },
  { name: "Cristina", uf: "MG", lat: -22.2082, lng: -45.2671 },
  { name: "Pouso Alegre", uf: "MG", lat: -22.2306, lng: -45.9364 },
  { name: "São Lourenço", uf: "MG", lat: -22.1161, lng: -45.0542 },
  { name: "Lorena", uf: "SP", lat: -22.7311, lng: -45.1247 },
  { name: "Guaratinguetá", uf: "SP", lat: -22.8164, lng: -45.1928 },
  { name: "Varginha", uf: "MG", lat: -21.5514, lng: -45.4303 },
  { name: "Três Corações", uf: "MG", lat: -21.6956, lng: -45.2553 },
  { name: "São José dos Campos", uf: "SP", lat: -23.1794, lng: -45.8869 },
  { name: "Taubaté", uf: "SP", lat: -23.0264, lng: -45.5553 },
  { name: "Poços de Caldas", uf: "MG", lat: -21.7878, lng: -46.5614 },
  { name: "Lavras", uf: "MG", lat: -21.2453, lng: -44.9997 },
  { name: "Campinas", uf: "SP", lat: -22.9056, lng: -47.0608 },
  { name: "Juiz de Fora", uf: "MG", lat: -21.7642, lng: -43.3503 },
  { name: "São Paulo", uf: "SP", lat: -23.5505, lng: -46.6333 },
  { name: "Rio de Janeiro", uf: "RJ", lat: -22.9068, lng: -43.1729 },
  { name: "Belo Horizonte", uf: "MG", lat: -19.9167, lng: -43.9345 },
];

const PREFIXES = ["Grupo", "Comercial", "Indústria", "Distribuidora", "Rede", "Central", "Nova", "Mega"];
const CORES = ["Serra", "Mantiqueira", "Sapucaí", "Horizonte", "Vale Sul", "Atlas", "Prisma", "Aurora", "Delta", "Vértice", "Ipê", "Pioneira"];
const FIRST = ["Mariana", "Rafael", "Juliana", "Carlos", "Fernanda", "Lucas", "Patrícia", "Eduardo", "Camila", "Rodrigo"];
const LAST = ["Andrade", "Ribeiro", "Mendes", "Carvalho", "Pereira", "Siqueira", "Moreira", "Teixeira"];
const ROLES = ["Sócio-Diretor", "Diretor Comercial", "Gestor Financeiro", "Gerente de Operações", "CEO / Fundador"];

const PAINS: Record<FocusArea, string[]> = {
  "Business Intelligence": [
    "Controle financeiro em planilhas desconectadas; DRE fechado manualmente só no dia 15 do mês seguinte.",
    "Falta de indicadores de margem por produto e giro de estoque, gerando compras no escuro.",
    "Relatórios gerenciais montados à mão a partir do ERP, sem visão consolidada por unidade.",
  ],
  "Revenue Intelligence": [
    "Perda de vendas por falta de acompanhamento do funil; orçamentos esquecidos no WhatsApp.",
    "Sem visibilidade de taxa de conversão por vendedor e por canal, metas definidas no feeling.",
    "Recompra de clientes não monitorada; churn de carteira percebido só quando o faturamento cai.",
  ],
  "Sistema Próprio": [
    "Processos de pedidos e ordens de serviço controlados em cadernos e planilhas compartilhadas.",
    "ERP genérico não atende ao fluxo da operação; equipe usa 4 ferramentas paralelas.",
    "Agendamentos e follow-ups feitos manualmente, sem histórico centralizado do cliente.",
  ],
};

const SYSTEMS: Record<FocusArea, string[]> = {
  "Business Intelligence": [
    "Pipeline de BI Automatizado de DRE e Estoque (Power BI + ETL do ERP)",
    "Dashboard Executivo de Margem, Curva ABC e Fluxo de Caixa",
  ],
  "Revenue Intelligence": [
    "Dashboard de Revenue Intelligence integrado ao CRM",
    "Painel de Funil Comercial com previsão de receita e alertas de follow-up",
  ],
  "Sistema Próprio": [
    "Sistema Web Próprio de Gestão Comercial e Pedidos",
    "Plataforma Web de Ordens de Serviço com app mobile para equipe de campo",
  ],
};

const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];
const slug = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

export function generateDemoLead(params: SearchParams, index: number): Lead {
  const isUnifei = /itajub|unifei/i.test(params.origin);
  const label = shortOriginLabel(params.origin);

  let city: string;
  let distance: number;
  if (isUnifei) {
    const inRange = SOUTH_MG_CITIES.filter((c) => haversineKm(UNIFEI, c) <= params.radiusKm);
    const c = pick(inRange.length ? inRange : SOUTH_MG_CITIES.slice(0, 1));
    city = `${c.name} - ${c.uf}`;
    distance = Math.max(1, Math.round(haversineKm(UNIFEI, c)));
  } else {
    city = `Região de ${params.origin}`;
    distance = Math.max(1, Math.round(Math.random() * params.radiusKm));
  }

  const sector = pick(params.niches);
  const focus: FocusArea = params.focus === "Todos" ? pick(FOCUS_AREAS) : params.focus;
  const name = `${pick(PREFIXES)} ${pick(CORES)} ${sector.split(" ")[0]}`;
  const domain = `${slug(name)}.com.br`;
  const person = `${pick(FIRST)} ${pick(LAST)}`;
  const system = pick(SYSTEMS[focus]);

  return {
    id: `demo-${Date.now()}-${index}`,
    capturedAt: new Date().toISOString(),
    origin: params.origin,
    isDemo: true,
    companyInfo: {
      companyName: `${name} Ltda`,
      cnpj: `${Math.floor(10 + Math.random() * 89)}.${Math.floor(100 + Math.random() * 899)}.${Math.floor(100 + Math.random() * 899)}/0001-${Math.floor(10 + Math.random() * 89)}`,
      sector,
      location: `${city}`,
      distanceFromOriginKm: distance,
      companyContext: `PME do setor de ${sector.toLowerCase()} com ~${20 + Math.floor(Math.random() * 180)} colaboradores. Opera com ERP básico e controles paralelos em planilhas; decisões dependem de consolidação manual.`,
    },
    contactData: {
      decisionMaker: `${person} — ${pick(ROLES)}`,
      phoneOrWhatsapp: `(35) 9${Math.floor(1000 + Math.random() * 8999)}-${Math.floor(1000 + Math.random() * 8999)}`,
      email: `contato@${domain}`,
      digitalLinks: [`https://${domain}`, `https://instagram.com/${slug(name)}`],
    },
    systemNeeds: {
      focusArea: focus,
      identifiedPainPoint: pick(PAINS[focus]),
      recommendedSystem: system,
      unifeiPitch: `Olá, ${person.split(" ")[0]}! Somos a Lutryx Júnior, empresa júnior de tecnologia da UNIFEI. Vimos que a ${name} pode ganhar muito com um(a) ${system}. Nossos alunos de engenharia desenvolvem a solução sob medida, com acompanhamento de professores e custo bem abaixo de consultorias tradicionais. Topa uma conversa de 20 minutos para mostrarmos um protótipo?`,
    },
    sources: ["Modo Demo — dados fictícios"],
  };
}
