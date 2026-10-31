"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CircleCheck,
  Download,
  FileSpreadsheet,
  GraduationCap,
  Navigation,
  Radar,
  Search,
  Settings2,
  Sparkles,
  Target,
  Trash,
} from "lucide-react";
import { ControlPanel } from "./ControlPanel";
import { ExecutionLog } from "./ExecutionLog";
import { LeadCard } from "./LeadCard";
import { CopyScriptButton, SettingsModal, type ServerStatus } from "./SettingsModal";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useLeadAgent } from "@/hooks/useLeadAgent";
import {
  DEFAULT_AI,
  DEFAULT_LEADS,
  DEFAULT_PARAMS,
  DEFAULT_SHEETS,
  STORAGE_KEYS,
  parseAi,
  parseLeads,
  parseParams,
  parseSheets,
} from "@/lib/clientStore";
import { SearchParamsSchema, FOCUS_AREAS, type FocusArea } from "@/lib/schema";
import { SHEET_HEADERS, leadToSheetRow } from "@/lib/sheetRow";

function StatCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-4 transition hover:border-line-2">
      <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-lime/5 blur-2xl transition group-hover:bg-lime/10" />
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-dim">
        <span className="text-lime">{icon}</span>
        {label}
      </div>
      <div className={`mt-2 font-mono text-2xl font-semibold tracking-tight ${accent ? "text-lime" : "text-fg"}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-dim">{sub}</div>}
    </div>
  );
}

function downloadCsv(rows: string[][]) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = "\uFEFF" + rows.map((r) => r.map(esc).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads-lutryx-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function Dashboard() {
  const [leads, setLeads] = useLocalStorage(STORAGE_KEYS.leads, DEFAULT_LEADS, parseLeads);
  const [sheets, setSheets] = useLocalStorage(STORAGE_KEYS.sheets, DEFAULT_SHEETS, parseSheets);
  const [ai, setAi] = useLocalStorage(STORAGE_KEYS.ai, DEFAULT_AI, parseAi);
  const [params, setParams, hydrated] = useLocalStorage(STORAGE_KEYS.params, DEFAULT_PARAMS, parseParams);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [server, setServer] = useState<ServerStatus | null>(null);
  const [query, setQuery] = useState("");
  const [focusFilter, setFocusFilter] = useState<FocusArea | "Todos">("Todos");
  const [formError, setFormError] = useState<string | null>(null);

  const agent = useLeadAgent({ sheets, ai, leads, setLeads });
  const running = agent.status === "running";

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json() as Promise<ServerStatus>)
      .then(setServer)
      .catch(() => setServer(null));
  }, []);

  const liveMode = Boolean(server?.geminiConfigured || ai.geminiApiKey);
  const sheetsReady =
    (sheets.method === "webhook" && sheets.webhookUrl.trim().length > 0) ||
    (sheets.method === "serviceAccount" &&
      (sheets.spreadsheetId || server?.spreadsheetIdConfigured) &&
      (sheets.serviceAccountJson || server?.serviceAccountConfigured));

  const stats = useMemo(() => {
    const synced = leads.filter((l) => l.sync.ok).length;
    const avgKm = leads.length ? Math.round(leads.reduce((s, l) => s + l.companyInfo.distanceFromOriginKm, 0) / leads.length) : 0;
    const byFocus = FOCUS_AREAS.map((f) => leads.filter((l) => l.systemNeeds.focusArea === f).length);
    return { synced, avgKm, byFocus };
  }, [leads]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (focusFilter !== "Todos" && l.systemNeeds.focusArea !== focusFilter) return false;
      if (!q) return true;
      return [l.companyInfo.companyName, l.companyInfo.sector, l.companyInfo.location, l.contactData.decisionMaker, l.systemNeeds.recommendedSystem]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [leads, query, focusFilter]);

  const handleStart = () => {
    const parsed = SearchParamsSchema.safeParse(params);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Parâmetros inválidos");
      return;
    }
    setFormError(null);
    void agent.start(parsed.data);
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* ---------------- Topbar ---------------- */}
      <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between gap-4 px-5">
          <div className="flex items-center gap-3">
            <div className="relative grid size-9 place-items-center rounded-xl bg-lime text-black shadow-[0_0_24px_-4px_rgb(163_230_53/0.7)]">
              <Radar className="size-5" strokeWidth={2.5} />
              {running && <span className="absolute inset-0 rounded-xl animate-pulse-ring" />}
            </div>
            <div className="leading-tight">
              <h1 className="text-[15px] font-bold tracking-tight">
                Lutryx <span className="text-lime">Júnior</span>
                <span className="ml-2 hidden font-normal text-dim sm:inline">· Captação de Leads com IA</span>
              </h1>
              <p className="flex items-center gap-1 text-[11px] text-dim">
                <GraduationCap className="size-3" /> Empresa Júnior de Tecnologia · UNIFEI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold md:inline-flex ${
                liveMode ? "border-lime/30 bg-lime/10 text-lime" : "border-amber-400/30 bg-amber-400/10 text-amber-300"
              }`}
            >
              <span className={`size-1.5 rounded-full ${liveMode ? "bg-lime" : "bg-amber-300"}`} />
              {liveMode ? `LIVE · ${ai.model || server?.model || "gemini"}` : "MODO DEMO"}
            </span>
            <button
              id="open-sheets-settings-button"
              type="button"
              onClick={() => setSettingsOpen(true)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                sheetsReady
                  ? "border-lime/30 bg-lime/5 text-lime hover:bg-lime/10"
                  : "border-line bg-surface text-muted hover:border-line-2 hover:text-fg"
              }`}
            >
              <FileSpreadsheet className="size-4" />
              <span className="hidden sm:inline">Google Sheets</span>
              {sheetsReady ? <CircleCheck className="size-3.5" /> : <span className="size-1.5 rounded-full bg-amber-300" />}
            </button>
            <button
              id="open-settings-button"
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="grid size-9 place-items-center rounded-lg border border-line bg-surface text-muted transition hover:border-line-2 hover:text-fg"
              aria-label="Configurações"
            >
              <Settings2 className="size-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        {/* ---------------- Sidebar ---------------- */}
        <aside className="border-b border-line bg-bg-2/60 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:w-[360px] lg:shrink-0 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
            <Sparkles className="size-4 text-lime" />
            <h2 className="text-sm font-semibold">Painel de Captação</h2>
          </div>
          <div className="lg:h-[calc(100%-49px)]">
            {hydrated ? (
              <ControlPanel params={params} onChange={setParams} running={running} onStart={handleStart} onStop={agent.stop} />
            ) : (
              <div className="space-y-4 p-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-surface" />
                ))}
              </div>
            )}
          </div>
          {formError && <p className="px-5 pb-4 text-xs text-rose-400">{formError}</p>}
        </aside>

        {/* ---------------- Área central ---------------- */}
        <main className="min-w-0 flex-1 space-y-5 p-5 lg:p-6">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard icon={<Target className="size-3.5" />} label="Leads captados" value={String(leads.length)} sub={running ? `Execução: ${agent.progress.found}/${agent.progress.target}` : "Total no histórico"} />
            <StatCard icon={<FileSpreadsheet className="size-3.5" />} label="No Google Sheets" value={`${stats.synced}`} sub={leads.length ? `${Math.round((stats.synced / leads.length) * 100)}% sincronizados` : "Nenhum ainda"} accent />
            <StatCard icon={<Navigation className="size-3.5" />} label="Distância média" value={`${stats.avgKm} km`} sub={`Raio atual: ${params.radiusKm} km`} />
            <StatCard icon={<Sparkles className="size-3.5" />} label="BI · Revenue · Sist." value={stats.byFocus.join(" · ")} sub="Distribuição por foco" />
          </div>

          <ExecutionLog logs={agent.logs} status={agent.status} progress={agent.progress} />

          {/* ---------------- Leads ---------------- */}
          <section aria-labelledby="leads-title" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 id="leads-title" className="text-lg font-semibold tracking-tight">Leads captados</h2>
                <span className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-xs text-muted">{filtered.length}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-dim" />
                  <input
                    id="lead-search-input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar empresa, cidade, decisor…"
                    className="h-9 w-56 rounded-lg border border-line bg-surface pl-8 pr-3 text-xs text-fg placeholder:text-dim focus:border-lime/50 focus:outline-none focus:ring-2 focus:ring-lime/15"
                  />
                </div>
                <div className="flex rounded-lg border border-line bg-surface p-0.5">
                  {(["Todos", ...FOCUS_AREAS] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFocusFilter(f)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                        focusFilter === f ? "bg-lime/15 text-lime" : "text-muted hover:text-fg"
                      }`}
                    >
                      {f === "Business Intelligence" ? "BI" : f === "Revenue Intelligence" ? "Revenue" : f === "Sistema Próprio" ? "Sistemas" : "Todos"}
                    </button>
                  ))}
                </div>
                <button
                  id="export-csv-button"
                  type="button"
                  disabled={!leads.length}
                  onClick={() => downloadCsv([[...SHEET_HEADERS], ...filtered.map(leadToSheetRow)])}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs text-muted transition hover:border-line-2 hover:text-fg disabled:opacity-40"
                >
                  <Download className="size-3.5" /> CSV
                </button>
                <button
                  id="clear-leads-button"
                  type="button"
                  disabled={!leads.length || running}
                  onClick={() => confirm("Limpar todos os leads da tela? (A planilha não é afetada)") && setLeads([])}
                  className="grid size-9 place-items-center rounded-lg border border-line bg-surface text-muted transition hover:border-rose-500/40 hover:text-rose-400 disabled:opacity-40"
                  aria-label="Limpar leads"
                >
                  <Trash className="size-3.5" />
                </button>
              </div>
            </div>

            {filtered.length ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {filtered.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} isNew={agent.newIds.has(lead.id)} onResync={agent.resync} />
                ))}
              </div>
            ) : (
              <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line bg-surface/40 px-6 py-16 text-center">
                {/* Radar animado */}
                <div className="relative mb-6 size-32">
                  <div className="absolute inset-0 rounded-full border border-lime/15" />
                  <div className="absolute inset-4 rounded-full border border-lime/15" />
                  <div className="absolute inset-8 rounded-full border border-lime/20" />
                  <div className="absolute inset-0 animate-spin rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,transparent_300deg,rgb(163_230_53/0.35)_360deg)] [animation-duration:3s]" />
                  <div className="absolute left-1/2 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime shadow-[0_0_12px_rgb(163_230_53)]" />
                  <div className="absolute left-[72%] top-[30%] size-1.5 animate-pulse rounded-full bg-lime/80" />
                  <div className="absolute left-[25%] top-[65%] size-1.5 animate-pulse rounded-full bg-lime/60 [animation-delay:0.7s]" />
                </div>
                <h3 className="text-base font-semibold">
                  {leads.length ? "Nenhum lead corresponde ao filtro" : "Nenhum lead captado ainda"}
                </h3>
                <p className="mt-1 max-w-md text-sm text-muted">
                  Defina nicho, ponto de referência e raio no painel e clique em{" "}
                  <span className="font-semibold text-lime">Captar Leads Agora</span>. Cada lead qualificado é salvo automaticamente no Google Sheets.
                </p>
                {!sheetsReady && (
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(true)}
                      className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold text-muted transition hover:border-line-2 hover:text-fg"
                    >
                      <FileSpreadsheet className="size-3.5" /> Conectar Google Sheets
                    </button>
                    <CopyScriptButton sheetName={sheets.sheetName} />
                  </div>
                )}
              </div>
            )}
          </section>
        </main>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        sheets={sheets}
        onSheetsChange={setSheets}
        ai={ai}
        onAiChange={setAi}
        server={server}
      />
    </div>
  );
}
