"use client";

import { useEffect, useRef } from "react";
import { Terminal } from "lucide-react";
import type { LogLevel } from "@/lib/schema";
import type { LogEntry, RunStatus } from "@/hooks/useLeadAgent";

const LEVEL_STYLE: Record<LogLevel, { tag: string; color: string }> = {
  info: { tag: "INFO", color: "text-sky-300" },
  search: { tag: "BUSCA", color: "text-violet-300" },
  analyze: { tag: "ANÁLISE", color: "text-amber-300" },
  sync: { tag: "SHEETS", color: "text-emerald-300" },
  success: { tag: "OK", color: "text-lime" },
  warn: { tag: "AVISO", color: "text-orange-300" },
  error: { tag: "ERRO", color: "text-rose-400" },
};

type Props = {
  logs: LogEntry[];
  status: RunStatus;
  progress: { found: number; target: number };
};

export function ExecutionLog({ logs, status, progress }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [logs.length]);

  const pct = progress.target ? Math.min(100, (progress.found / progress.target) * 100) : 0;
  const running = status === "running";

  return (
    <section
      aria-label="Log de execução do agente"
      className="overflow-hidden rounded-2xl border border-line bg-[#0c0c0e] shadow-[0_20px_60px_-30px_rgb(0_0_0/0.9)]"
    >
      {/* Barra de título */}
      <header className="flex items-center justify-between border-b border-line bg-surface/60 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-[#3f3f46]" />
            <span className="size-2.5 rounded-full bg-[#3f3f46]" />
            <span className={`size-2.5 rounded-full ${running ? "bg-lime animate-pulse-ring" : "bg-[#3f3f46]"}`} />
          </div>
          <h2 className="flex items-center gap-1.5 font-mono text-xs text-muted">
            <Terminal className="size-3.5 text-lime" /> agente@lutryx:~/captacao
          </h2>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span className="text-dim">
            {progress.found}/{progress.target || "—"} leads
          </span>
          <span
            className={`rounded px-1.5 py-0.5 ${
              running
                ? "bg-lime/15 text-lime"
                : status === "error"
                  ? "bg-rose-500/15 text-rose-400"
                  : status === "done"
                    ? "bg-emerald-500/10 text-emerald-300"
                    : "bg-surface-2 text-dim"
            }`}
          >
            {running ? "● EXECUTANDO" : status === "error" ? "ERRO" : status === "done" ? "CONCLUÍDO" : "OCIOSO"}
          </span>
        </div>
      </header>

      {/* Progresso */}
      <div className="relative h-0.5 bg-line">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-lime-2 to-lime transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
        {running && <div className="absolute inset-y-0 w-24 animate-scan bg-gradient-to-r from-transparent via-lime/70 to-transparent" />}
      </div>

      <div ref={scrollRef} className="tech-grid h-64 overflow-y-auto px-4 py-3 font-mono text-[12px] leading-relaxed">
        {logs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-dim">
            <Terminal className="size-6 text-line-2" />
            <p>Configure os parâmetros e clique em <span className="text-lime">Captar Leads Agora</span>.</p>
            <p className="text-[11px]">O progresso do agente aparecerá aqui em tempo real.</p>
          </div>
        ) : (
          <ol className="space-y-0.5">
            {logs.map((l) => {
              const s = LEVEL_STYLE[l.level];
              return (
                <li key={l.id} className="flex animate-fade-up gap-2.5">
                  <time className="shrink-0 text-dim/70">
                    {new Date(l.at).toLocaleTimeString("pt-BR", { hour12: false })}
                  </time>
                  <span className={`w-16 shrink-0 font-semibold ${s.color}`}>[{s.tag}]</span>
                  <span className={l.level === "error" ? "text-rose-300" : l.level === "success" ? "text-lime" : "text-zinc-300"}>
                    {l.message}
                  </span>
                </li>
              );
            })}
            {running && (
              <li className="flex gap-2.5 pt-1 text-lime">
                <span className="inline-block h-4 w-2 animate-pulse bg-lime" />
              </li>
            )}
          </ol>
        )}
      </div>
    </section>
  );
}
