"use client";

import { useCallback, useRef, useState } from "react";
import {
  LeadSchema,
  type AgentEvent,
  type AiConfig,
  type Lead,
  type LogLevel,
  type SearchParams,
  type SheetsConfig,
  type SyncResult,
} from "@/lib/schema";
import { MAX_STORED_LEADS, type StoredLead } from "@/lib/clientStore";

export type LogEntry = { id: number; level: LogLevel; message: string; at: string };
export type RunStatus = "idle" | "running" | "done" | "error";

type Options = {
  sheets: SheetsConfig;
  ai: AiConfig;
  leads: StoredLead[];
  setLeads: (v: StoredLead[] | ((prev: StoredLead[]) => StoredLead[])) => void;
};

let logSeq = 0;

/** Orquestra a execução do agente no cliente: streaming NDJSON, logs, progresso e leads. */
export function useLeadAgent({ sheets, ai, leads, setLeads }: Options) {
  const [status, setStatus] = useState<RunStatus>("idle");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState({ found: 0, target: 0 });
  const [mode, setMode] = useState<"live" | "demo" | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  const pushLog = useCallback((level: LogLevel, message: string, at = new Date().toISOString()) => {
    setLogs((prev) => [...prev.slice(-400), { id: ++logSeq, level, message, at }]);
  }, []);

  const handleEvent = useCallback(
    (event: AgentEvent) => {
      switch (event.type) {
        case "start":
          setMode(event.mode);
          break;
        case "log":
          pushLog(event.level, event.message, event.at);
          break;
        case "progress":
          setProgress({ found: event.found, target: event.target });
          break;
        case "lead": {
          const parsed = LeadSchema.safeParse(event.lead); // validação Zod também no cliente
          if (!parsed.success) {
            pushLog("error", "Lead recebido com formato inválido (Zod) — descartado.");
            return;
          }
          const stored: StoredLead = { ...parsed.data, sync: event.sync };
          setLeads((prev) => [stored, ...prev].slice(0, MAX_STORED_LEADS));
          setNewIds((prev) => new Set(prev).add(stored.id));
          break;
        }
        case "done":
          pushLog("success", `Execução finalizada: ${event.found}/${event.target} leads · ${event.reason}`);
          setStatus("done");
          break;
        case "fatal":
          pushLog("error", event.message);
          setStatus("error");
          break;
      }
    },
    [pushLog, setLeads],
  );

  const start = useCallback(
    async (params: SearchParams) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus("running");
      setLogs([]);
      setNewIds(new Set());
      setProgress({ found: 0, target: params.targetLeads });
      pushLog("info", `Iniciando captação · meta de ${params.targetLeads} leads · raio de ${params.radiusKm} km`);

      try {
        const res = await fetch("/api/agent/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            params,
            sheets,
            ai,
            excludeCompanies: leads.filter((l) => !l.isDemo).map((l) => l.companyInfo.companyName),
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? `Erro HTTP ${res.status}`);
        }

        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        let finished = false;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const evt = JSON.parse(line) as AgentEvent;
              if (evt.type === "done" || evt.type === "fatal") finished = true;
              handleEvent(evt);
            } catch {
              /* linha parcial/inválida */
            }
          }
        }
        if (!finished) setStatus("done");
      } catch (err) {
        if (controller.signal.aborted) {
          pushLog("warn", "Captação interrompida pelo usuário.");
          setStatus("idle");
        } else {
          pushLog("error", err instanceof Error ? err.message : String(err));
          setStatus("error");
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [ai, sheets, leads, handleEvent, pushLog],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const resync = useCallback(
    async (lead: StoredLead): Promise<SyncResult> => {
      const { sync: _omit, ...pure } = lead;
      void _omit;
      let result: SyncResult;
      try {
        const res = await fetch("/api/sheets/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: sheets, lead: pure as Lead }),
        });
        result = (await res.json()) as SyncResult;
      } catch (err) {
        result = { ok: false, method: sheets.method, message: err instanceof Error ? err.message : "Erro de rede" };
      }
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, sync: result } : l)));
      return result;
    },
    [sheets, setLeads],
  );

  return { status, logs, progress, mode, newIds, start, stop, resync };
}
