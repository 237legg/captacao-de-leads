"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  BrainCircuit,
  Check,
  CircleAlert,
  CircleCheck,
  CloudOff,
  Copy,
  FileSpreadsheet,
  Info,
  KeyRound,
  LoaderCircle,
  Sheet,
  ShieldCheck,
  Webhook,
  X,
  Zap,
} from "lucide-react";
import type { AiConfig, SheetsConfig, SyncResult } from "@/lib/schema";
import { buildAppsScript } from "@/lib/appsScript";

export type ServerStatus = {
  geminiConfigured: boolean;
  model: string;
  serviceAccountConfigured: boolean;
  spreadsheetIdConfigured: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  sheets: SheetsConfig;
  onSheetsChange: (c: SheetsConfig) => void;
  ai: AiConfig;
  onAiChange: (c: AiConfig) => void;
  server: ServerStatus | null;
  initialTab?: Tab;
};

type Tab = "sheets" | "ai";

const inputCls =
  "h-10 w-full rounded-lg border border-line bg-bg-2 px-3 text-sm text-fg placeholder:text-dim focus:border-lime/50 focus:outline-none focus:ring-2 focus:ring-lime/15";

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="block text-[11px] leading-relaxed text-dim">{hint}</span>}
    </label>
  );
}

export function CopyScriptButton({ sheetName, className = "" }: { sheetName: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      id="copy-apps-script-button"
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(buildAppsScript(sheetName || "Leads"));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
        copied ? "border-lime/50 bg-lime/15 text-lime" : "border-lime/30 bg-lime/5 text-lime hover:bg-lime/10"
      } ${className}`}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Script copiado!" : "Copiar Script para Google Sheets"}
    </button>
  );
}

export function SettingsModal({ open, onClose, sheets, onSheetsChange, ai, onAiChange, server, initialTab = "sheets" }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<SyncResult | null>(null);
  const [showScript, setShowScript] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const setS = <K extends keyof SheetsConfig>(k: K, v: SheetsConfig[K]) => {
    setTestResult(null);
    onSheetsChange({ ...sheets, [k]: v });
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/sheets/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: sheets, test: true }),
      });
      setTestResult((await res.json()) as SyncResult);
    } catch (err) {
      setTestResult({ ok: false, method: sheets.method, message: err instanceof Error ? err.message : "Erro de rede" });
    } finally {
      setTesting(false);
    }
  };

  const methods: Array<{ id: SheetsConfig["method"]; title: string; desc: string; icon: ReactNode }> = [
    { id: "webhook", title: "Webhook URL", desc: "Apps Script · n8n · Make", icon: <Webhook className="size-4" /> },
    { id: "serviceAccount", title: "Sheets API", desc: "googleapis · Service Account", icon: <ShieldCheck className="size-4" /> },
    { id: "disabled", title: "Desativado", desc: "Apenas na tela", icon: <CloudOff className="size-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className="absolute inset-0 animate-[fade-up_0.2s_ease] bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex max-h-[90vh] w-full max-w-2xl animate-fade-up flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_40px_120px_-20px_rgb(0_0_0/0.9)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime/60 to-transparent" />

        <header className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h2 id="settings-title" className="text-base font-semibold">Configurações</h2>
            <p className="text-xs text-dim">Salvas localmente neste navegador.</p>
          </div>
          <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg" aria-label="Fechar">
            <X className="size-4" />
          </button>
        </header>

        <nav className="flex gap-1 border-b border-line px-6">
          {([
            ["sheets", "Google Sheets", <FileSpreadsheet key="s" className="size-3.5" />],
            ["ai", "Agente de IA", <BrainCircuit key="a" className="size-3.5" />],
          ] as const).map(([id, label, icon]) => (
            <button
              key={id}
              id={`settings-tab-${id}`}
              type="button"
              onClick={() => setTab(id)}
              className={`relative flex items-center gap-1.5 px-3 py-3 text-sm font-medium transition ${tab === id ? "text-lime" : "text-muted hover:text-fg"}`}
            >
              {icon} {label}
              {tab === id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-lime" />}
            </button>
          ))}
        </nav>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {tab === "sheets" ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                {methods.map((m) => {
                  const active = sheets.method === m.id;
                  return (
                    <button
                      key={m.id}
                      id={`sheets-method-${m.id}`}
                      type="button"
                      onClick={() => setS("method", m.id)}
                      className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${
                        active ? "border-lime/50 bg-lime/10" : "border-line bg-bg-2 hover:border-line-2"
                      }`}
                    >
                      <span className={active ? "text-lime" : "text-muted"}>{m.icon}</span>
                      <span className={`text-sm font-semibold ${active ? "text-lime" : "text-fg"}`}>{m.title}</span>
                      <span className="text-[11px] text-dim">{m.desc}</span>
                    </button>
                  );
                })}
              </div>

              {sheets.method === "webhook" && (
                <div className="space-y-4">
                  <Field
                    label="URL do Webhook"
                    hint="Cada lead é enviado via POST com { event, headers, row, lead }."
                  >
                    <input
                      id="webhook-url-input"
                      className={`${inputCls} font-mono text-xs`}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      value={sheets.webhookUrl}
                      onChange={(e) => setS("webhookUrl", e.target.value)}
                    />
                  </Field>
                  <Field label="Nome da aba (usado no script)">
                    <input className={inputCls} value={sheets.sheetName} onChange={(e) => setS("sheetName", e.target.value)} />
                  </Field>

                  <div className="rounded-xl border border-line bg-bg-2 p-4">
                    <div className="mb-3 flex items-start gap-3">
                      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-lime/10 text-lime">
                        <Zap className="size-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold">Integração em 1 minuto com Apps Script</h3>
                        <ol className="mt-1.5 list-decimal space-y-0.5 pl-4 text-[12px] leading-relaxed text-muted">
                          <li>Na sua planilha: <b className="text-fg">Extensões → Apps Script</b>.</li>
                          <li>Apague o conteúdo e cole o script copiado abaixo. Salve.</li>
                          <li><b className="text-fg">Implantar → Nova implantação → App da Web</b>.</li>
                          <li>Executar como <b className="text-fg">Eu</b> · Acesso: <b className="text-fg">Qualquer pessoa</b>.</li>
                          <li>Cole a URL <span className="font-mono text-lime">/exec</span> no campo acima.</li>
                        </ol>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <CopyScriptButton sheetName={sheets.sheetName} />
                      <button
                        type="button"
                        onClick={() => setShowScript((s) => !s)}
                        className="rounded-lg border border-line px-3 py-2 text-xs text-muted transition hover:border-line-2 hover:text-fg"
                      >
                        {showScript ? "Ocultar código" : "Ver código"}
                      </button>
                    </div>
                    {showScript && (
                      <pre className="mt-3 max-h-64 overflow-auto rounded-lg border border-line bg-[#0c0c0e] p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
                        {buildAppsScript(sheets.sheetName || "Leads")}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              {sheets.method === "serviceAccount" && (
                <div className="space-y-4">
                  <Field
                    label="SPREADSHEET_ID"
                    hint={
                      <>
                        Trecho da URL entre <span className="font-mono">/d/</span> e <span className="font-mono">/edit</span>.
                        {server?.spreadsheetIdConfigured && <span className="text-lime"> Vazio = usa SPREADSHEET_ID do servidor.</span>}
                      </>
                    }
                  >
                    <input
                      id="spreadsheet-id-input"
                      className={`${inputCls} font-mono text-xs`}
                      placeholder="1AbC...xyz"
                      value={sheets.spreadsheetId}
                      onChange={(e) => setS("spreadsheetId", e.target.value)}
                    />
                  </Field>
                  <Field label="Nome da aba" hint="Criada automaticamente com cabeçalho se não existir.">
                    <input className={inputCls} value={sheets.sheetName} onChange={(e) => setS("sheetName", e.target.value)} />
                  </Field>
                  <Field
                    label="JSON da Service Account (opcional)"
                    hint={
                      server?.serviceAccountConfigured ? (
                        <span className="text-lime">✓ Credenciais já configuradas no servidor (.env). Deixe vazio para usá-las.</span>
                      ) : (
                        <>Recomendado: defina <span className="font-mono">GOOGLE_SERVICE_ACCOUNT_EMAIL</span> e <span className="font-mono">GOOGLE_PRIVATE_KEY</span> no <span className="font-mono">.env.local</span>. Compartilhe a planilha com o e-mail da Service Account como Editor.</>
                      )
                    }
                  >
                    <textarea
                      id="service-account-json-input"
                      rows={4}
                      className={`${inputCls} h-auto py-2 font-mono text-[11px]`}
                      placeholder='{"type":"service_account","client_email":"...","private_key":"-----BEGIN PRIVATE KEY-----..."}'
                      value={sheets.serviceAccountJson}
                      onChange={(e) => setS("serviceAccountJson", e.target.value)}
                    />
                  </Field>
                  <p className="flex gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-[11px] leading-relaxed text-amber-200/80">
                    <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                    O JSON colado fica no localStorage deste navegador. Para uso compartilhado, prefira variáveis de ambiente.
                  </p>
                </div>
              )}

              {sheets.method === "disabled" && (
                <p className="flex gap-2 rounded-lg border border-line bg-bg-2 p-4 text-sm text-muted">
                  <Info className="mt-0.5 size-4 shrink-0 text-dim" />
                  Os leads serão exibidos apenas na tela (e podem ser exportados em CSV). Você pode reenviá-los depois de configurar.
                </p>
              )}

              {sheets.method !== "disabled" && (
                <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
                  <button
                    id="test-sheets-connection-button"
                    type="button"
                    onClick={testConnection}
                    disabled={testing}
                    className="inline-flex items-center gap-2 rounded-lg bg-lime px-4 py-2 text-xs font-bold text-black transition hover:bg-[#b5f04a] disabled:opacity-50"
                  >
                    {testing ? <LoaderCircle className="size-3.5 animate-spin" /> : <Sheet className="size-3.5" />}
                    Testar conexão
                  </button>
                  {testResult && (
                    <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] ${testResult.ok ? "text-lime" : "text-rose-400"}`}>
                      {testResult.ok ? <CircleCheck className="size-3.5" /> : <CircleAlert className="size-3.5" />}
                      {testResult.ok ? "Linha de teste enviada ✓" : testResult.message}
                    </span>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div
                className={`flex gap-3 rounded-xl border p-4 ${
                  server?.geminiConfigured || ai.geminiApiKey ? "border-lime/30 bg-lime/5" : "border-amber-400/25 bg-amber-400/5"
                }`}
              >
                <BrainCircuit className={`size-5 shrink-0 ${server?.geminiConfigured || ai.geminiApiKey ? "text-lime" : "text-amber-300"}`} />
                <div className="text-[12.5px] leading-relaxed">
                  {server?.geminiConfigured || ai.geminiApiKey ? (
                    <p className="text-zinc-200">
                      <b className="text-lime">Modo LIVE.</b> O agente usa o Gemini com <b>Google Search grounding</b> para encontrar empresas reais,
                      pesquisar contatos e gerar o diagnóstico.
                    </p>
                  ) : (
                    <p className="text-zinc-200">
                      <b className="text-amber-300">Modo DEMO.</b> Sem chave do Gemini, o agente gera leads fictícios para testar o fluxo.
                      Obtenha uma chave gratuita em <a className="text-lime underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>.
                    </p>
                  )}
                </div>
              </div>

              <Field
                label="Gemini API Key (opcional)"
                hint={server?.geminiConfigured ? "✓ GEMINI_API_KEY configurada no servidor. Preencha apenas para sobrescrever." : "Recomendado: defina GEMINI_API_KEY no .env.local."}
              >
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dim" />
                  <input
                    id="gemini-key-input"
                    type="password"
                    className={`${inputCls} pl-9 font-mono text-xs`}
                    placeholder="AIza..."
                    value={ai.geminiApiKey}
                    onChange={(e) => onAiChange({ ...ai, geminiApiKey: e.target.value })}
                  />
                </div>
              </Field>

              <Field label="Modelo" hint={`Padrão do servidor: ${server?.model ?? "gemini-2.5-flash"}. Precisa suportar a ferramenta google_search.`}>
                <input
                  id="gemini-model-input"
                  className={`${inputCls} font-mono text-xs`}
                  placeholder={server?.model ?? "gemini-2.5-flash"}
                  value={ai.model}
                  onChange={(e) => onAiChange({ ...ai, model: e.target.value })}
                />
              </Field>
            </div>
          )}
        </div>

        <footer className="flex justify-end border-t border-line px-6 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-xs font-medium text-muted transition hover:border-line-2 hover:text-fg">
            Concluir
          </button>
        </footer>
      </div>
    </div>
  );
}
