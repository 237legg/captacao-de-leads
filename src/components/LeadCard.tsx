"use client";

import { useState } from "react";
import {
  Building,
  ChartColumn,
  Check,
  ChevronDown,
  CircleAlert,
  CloudOff,
  CodeXml,
  Copy,
  Globe,
  Lightbulb,
  LoaderCircle,
  Mail,
  MapPin,
  MessageSquareQuote,
  Navigation,
  Phone,
  RefreshCw,
  Cpu,
  TrendingUp,
  UserRound,
  CircleCheck,
} from "lucide-react";
import type { FocusArea } from "@/lib/schema";
import type { StoredLead } from "@/lib/clientStore";
import { shortOriginLabel } from "@/lib/geo";

const FOCUS_META: Record<FocusArea, { short: string; icon: typeof ChartColumn }> = {
  "Business Intelligence": { short: "BI", icon: ChartColumn },
  "Revenue Intelligence": { short: "Revenue", icon: TrendingUp },
  "Sistema Próprio": { short: "Sistema Próprio", icon: CodeXml },
};

const isNF = (v: string) => /^(não encontrado|-|n\/a)$/i.test(v.trim());

function toHref(link: string) {
  if (/^https?:\/\//i.test(link)) return link;
  if (link.startsWith("@")) return `https://instagram.com/${link.slice(1)}`;
  return `https://${link}`;
}

function prettyLink(link: string) {
  return link.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
}

function whatsappHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}`;
}

export function SyncBadge({ sync, onRetry, retrying }: { sync: StoredLead["sync"]; onRetry?: () => void; retrying?: boolean }) {
  if (sync.ok) {
    return (
      <span
        title={sync.message}
        className="inline-flex items-center gap-1 rounded-md border border-lime/30 bg-lime/10 px-2 py-0.5 font-mono text-[10px] font-medium text-lime"
      >
        <CircleCheck className="size-3" /> Sincronizado com Google Sheets ✓
      </span>
    );
  }
  if (sync.method === "disabled") {
    return (
      <button
        type="button"
        onClick={onRetry}
        title="Configure o Google Sheets e clique para enviar"
        className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-dim transition hover:border-line-2 hover:text-fg"
      >
        {retrying ? <LoaderCircle className="size-3 animate-spin" /> : <CloudOff className="size-3" />} Não sincronizado
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onRetry}
      title={sync.message}
      className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 font-mono text-[10px] text-rose-300 transition hover:bg-rose-500/20"
    >
      {retrying ? <LoaderCircle className="size-3 animate-spin" /> : <RefreshCw className="size-3" />} Falha · reenviar
    </button>
  );
}

function ContactRow({ icon: Icon, value, href, mono = true }: { icon: typeof Phone; value: string; href?: string | null; mono?: boolean }) {
  const missing = isNF(value);
  const content = (
    <span className={`truncate ${mono ? "font-mono text-[12px]" : "text-[13px]"} ${missing ? "italic text-dim" : "text-zinc-200"}`}>
      {value}
    </span>
  );
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Icon className={`size-3.5 shrink-0 ${missing ? "text-line-2" : "text-lime/80"}`} />
      {href && !missing ? (
        <a href={href} target="_blank" rel="noreferrer" className="min-w-0 truncate hover:underline hover:decoration-lime/50">
          {content}
        </a>
      ) : (
        content
      )}
    </div>
  );
}

type Props = {
  lead: StoredLead;
  isNew: boolean;
  onResync: (lead: StoredLead) => Promise<unknown>;
};

export function LeadCard({ lead, isNew, onResync }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const { companyInfo: c, contactData: ct, systemNeeds: s } = lead;
  const focus = FOCUS_META[s.focusArea];
  const FocusIcon = focus.icon;
  const wa = whatsappHref(ct.phoneOrWhatsapp);

  const copyPitch = async () => {
    await navigator.clipboard.writeText(s.unifeiPitch);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const retry = async () => {
    setRetrying(true);
    await onResync(lead);
    setRetrying(false);
  };

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-surface transition-all duration-300 hover:-translate-y-0.5 hover:border-line-2 hover:shadow-[0_18px_50px_-24px_rgb(163_230_53/0.25)] ${
        isNew ? "animate-fade-up border-lime/25" : "border-line"
      }`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime/40 to-transparent opacity-0 transition group-hover:opacity-100" />

      {/* Cabeçalho */}
      <header className="flex items-start gap-3 p-4 pb-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-bg-2 text-lime">
          <Building className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-fg">{c.companyName}</h3>
            {lead.isDemo && (
              <span className="shrink-0 rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-amber-300">
                DEMO
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span>{c.sector}</span>
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-lime">
              <Navigation className="size-3" />
              {Math.round(c.distanceFromOriginKm)} km da {shortOriginLabel(lead.origin)}
            </span>
          </div>
        </div>
      </header>

      <div className="flex items-center gap-1.5 px-4 text-[12px] text-muted">
        <MapPin className="size-3.5 shrink-0 text-dim" />
        <span className="truncate">{c.location}</span>
      </div>

      {/* Diagnóstico */}
      <div className="mx-4 mt-3 space-y-2 rounded-xl border border-line bg-bg-2/70 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-lime/10 px-2 py-0.5 text-[11px] font-semibold text-lime">
            <FocusIcon className="size-3.5" /> {focus.short}
          </span>
          <Cpu className="size-3.5 text-dim" />
        </div>
        <p className="flex gap-2 text-[12.5px] leading-relaxed text-zinc-300">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-orange-300/80" />
          <span className={open ? "" : "line-clamp-2"}>{s.identifiedPainPoint}</span>
        </p>
        <p className="flex gap-2 text-[12.5px] font-medium leading-relaxed text-fg">
          <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-lime" />
          {s.recommendedSystem}
        </p>
      </div>

      {/* Contato */}
      <div className="grid gap-1.5 px-4 pt-3">
        <ContactRow icon={UserRound} value={ct.decisionMaker} mono={false} />
        <ContactRow icon={Phone} value={ct.phoneOrWhatsapp} href={wa ?? `tel:${ct.phoneOrWhatsapp}`} />
        <ContactRow icon={Mail} value={ct.email} href={`mailto:${ct.email}`} />
      </div>

      {/* Detalhes expansíveis */}
      <div className={`grid transition-[grid-template-rows] duration-300 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="space-y-3 px-4 pt-3">
            <div>
              <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-dim">Contexto da empresa</h4>
              <p className="text-[12.5px] leading-relaxed text-zinc-300">{c.companyContext}</p>
            </div>

            {ct.digitalLinks.length > 0 && (
              <div>
                <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-dim">Links digitais</h4>
                <div className="flex flex-wrap gap-1.5">
                  {ct.digitalLinks.map((l) => (
                    <a
                      key={l}
                      href={toHref(l)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-full items-center gap-1 rounded-md border border-line bg-bg-2 px-2 py-0.5 font-mono text-[11px] text-muted transition hover:border-lime/40 hover:text-lime"
                    >
                      <Globe className="size-3 shrink-0" />
                      <span className="truncate">{prettyLink(l)}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="relative rounded-xl border border-lime/20 bg-lime/[0.04] p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-lime">
                  <MessageSquareQuote className="size-3.5" /> Pitch Lutryx · UNIFEI
                </h4>
                <button
                  type="button"
                  onClick={copyPitch}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-lime/80 transition hover:bg-lime/10 hover:text-lime"
                >
                  {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                  {copied ? "Copiado" : "Copiar"}
                </button>
              </div>
              <p className="text-[12.5px] leading-relaxed text-zinc-200">{s.unifeiPitch}</p>
            </div>

            {lead.sources.length > 0 && (
              <p className="font-mono text-[10px] leading-relaxed text-dim">
                Fontes: {lead.sources.slice(0, 5).join(" · ")}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="h-4" />
      {/* Rodapé */}
      <footer className="mt-auto flex items-center justify-between gap-2 border-t border-line/70 px-4 py-2.5">
        <SyncBadge sync={lead.sync} onRetry={retry} retrying={retrying} />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1 text-[11px] text-muted transition hover:text-lime"
          aria-expanded={open}
        >
          {open ? "Menos" : "Pitch & detalhes"}
          <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </footer>
    </article>
  );
}
