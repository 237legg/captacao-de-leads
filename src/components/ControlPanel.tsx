"use client";

import { useState, type ReactNode } from "react";
import {
  BrainCircuit,
  ChartColumn,
  Check,
  Crosshair,
  Layers,
  LoaderCircle,
  MapPin,
  Plus,
  Play,
  RefreshCw,
  Square,
  Target,
  TrendingUp,
  CodeXml,
  X,
} from "lucide-react";
import { DEFAULT_ORIGIN, NICHE_PRESETS, type FocusFilter, type SearchParams } from "@/lib/schema";

const RADIUS_PRESETS = [10, 50, 100, 300];
const TARGET_PRESETS = [5, 10, 25, 50];

const FOCUS_OPTIONS: Array<{ value: FocusFilter; label: string; icon: ReactNode; hint: string }> = [
  { value: "Todos", label: "Todos", icon: <Layers className="size-3.5" />, hint: "IA decide" },
  { value: "Business Intelligence", label: "BI", icon: <ChartColumn className="size-3.5" />, hint: "Dashboards & KPIs" },
  { value: "Revenue Intelligence", label: "Revenue", icon: <TrendingUp className="size-3.5" />, hint: "Funil & receita" },
  { value: "Sistema Próprio", label: "Sistemas", icon: <CodeXml className="size-3.5" />, hint: "Software sob medida" },
];

type Props = {
  params: SearchParams;
  onChange: (p: SearchParams) => void;
  running: boolean;
  onStart: () => void;
  onStop: () => void;
};

function Section({ icon, title, right, children }: { icon: ReactNode; title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          <span className="text-lime">{icon}</span>
          {title}
        </h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function ControlPanel({ params, onChange, running, onStart, onStop }: Props) {
  const [customNiche, setCustomNiche] = useState("");
  const set = <K extends keyof SearchParams>(key: K, value: SearchParams[K]) => onChange({ ...params, [key]: value });

  const toggleNiche = (n: string) => {
    const has = params.niches.includes(n);
    set("niches", has ? params.niches.filter((x) => x !== n) : [...params.niches, n]);
  };

  const addCustom = () => {
    const v = customNiche.trim();
    if (v && !params.niches.includes(v)) set("niches", [...params.niches, v]);
    setCustomNiche("");
  };

  const customNiches = params.niches.filter((n) => !(NICHE_PRESETS as readonly string[]).includes(n));
  const radiusFill = `${((Math.min(params.radiusKm, 500) - 5) / (500 - 5)) * 100}%`;
  const canStart = params.niches.length > 0 && params.origin.trim().length > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        {/* Nicho */}
        <Section
          icon={<Target className="size-3.5" />}
          title="Nicho / Setor alvo"
          right={<span className="font-mono text-[11px] text-dim">{params.niches.length} sel.</span>}
        >
          <div className="flex flex-wrap gap-1.5">
            {[...NICHE_PRESETS, ...customNiches].map((n) => {
              const active = params.niches.includes(n);
              return (
                <button
                  key={n}
                  id={`niche-${n.toLowerCase().replace(/\s+/g, "-")}`}
                  type="button"
                  disabled={running}
                  onClick={() => toggleNiche(n)}
                  className={`group inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-all duration-200 disabled:opacity-50 ${
                    active
                      ? "border-lime/50 bg-lime/10 text-lime shadow-[0_0_12px_-4px_rgb(163_230_53/0.6)]"
                      : "border-line bg-bg-2 text-muted hover:border-line-2 hover:text-fg"
                  }`}
                >
                  {active && <Check className="size-3" />}
                  {n}
                </button>
              );
            })}
          </div>
          <div className="flex gap-1.5">
            <input
              id="custom-niche-input"
              value={customNiche}
              disabled={running}
              onChange={(e) => setCustomNiche(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())}
              placeholder="Outro nicho (ex: Laticínios)"
              className="h-8 flex-1 rounded-md border border-line bg-bg-2 px-2.5 text-xs text-fg placeholder:text-dim focus:border-lime/50 focus:outline-none focus:ring-2 focus:ring-lime/15"
            />
            <button
              type="button"
              onClick={addCustom}
              disabled={running || !customNiche.trim()}
              className="grid size-8 place-items-center rounded-md border border-line bg-bg-2 text-muted transition hover:border-lime/50 hover:text-lime disabled:opacity-40"
              aria-label="Adicionar nicho"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </Section>

        {/* Ponto de referência */}
        <Section
          icon={<MapPin className="size-3.5" />}
          title="Ponto de referência"
          right={
            params.origin !== DEFAULT_ORIGIN && (
              <button
                type="button"
                disabled={running}
                onClick={() => set("origin", DEFAULT_ORIGIN)}
                className="inline-flex items-center gap-1 text-[11px] text-dim transition hover:text-lime"
              >
                <RefreshCw className="size-3" /> UNIFEI
              </button>
            )
          }
        >
          <div className="relative">
            <Crosshair className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-lime/70" />
            <input
              id="origin-input"
              value={params.origin}
              disabled={running}
              onChange={(e) => set("origin", e.target.value)}
              placeholder="Cidade, endereço ou referência"
              className="h-10 w-full rounded-lg border border-line bg-bg-2 pl-8 pr-8 text-sm text-fg placeholder:text-dim focus:border-lime/50 focus:outline-none focus:ring-2 focus:ring-lime/15"
            />
            {params.origin && !running && (
              <button
                type="button"
                onClick={() => set("origin", "")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-dim hover:text-fg"
                aria-label="Limpar"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </Section>

        {/* Raio */}
        <Section
          icon={<Crosshair className="size-3.5" />}
          title="Raio de distância"
          right={
            <div className="flex items-baseline gap-1 rounded-md border border-lime/30 bg-lime/5 px-2 py-0.5">
              <input
                id="radius-input"
                type="number"
                min={1}
                max={1000}
                value={params.radiusKm}
                disabled={running}
                onChange={(e) => set("radiusKm", Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
                className="w-12 bg-transparent text-right font-mono text-sm font-semibold text-lime focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="font-mono text-[11px] text-lime/70">km</span>
            </div>
          }
        >
          <input
            id="radius-slider"
            type="range"
            min={5}
            max={500}
            step={5}
            value={Math.min(params.radiusKm, 500)}
            disabled={running}
            onChange={(e) => set("radiusKm", Number(e.target.value))}
            className="range-lime"
            style={{ ["--fill" as string]: radiusFill }}
          />
          <div className="grid grid-cols-4 gap-1.5">
            {RADIUS_PRESETS.map((r) => (
              <button
                key={r}
                type="button"
                disabled={running}
                onClick={() => set("radiusKm", r)}
                className={`rounded-md border py-1 font-mono text-[11px] transition ${
                  params.radiusKm === r
                    ? "border-lime/50 bg-lime/10 text-lime"
                    : "border-line bg-bg-2 text-dim hover:border-line-2 hover:text-fg"
                }`}
              >
                {r}km
              </button>
            ))}
          </div>
        </Section>

        {/* Foco */}
        <Section icon={<BrainCircuit className="size-3.5" />} title="Foco da solução">
          <div className="grid grid-cols-2 gap-1.5">
            {FOCUS_OPTIONS.map((o) => {
              const active = params.focus === o.value;
              return (
                <button
                  key={o.value}
                  id={`focus-${o.label.toLowerCase()}`}
                  type="button"
                  disabled={running}
                  onClick={() => set("focus", o.value)}
                  className={`flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-all duration-200 ${
                    active
                      ? "border-lime/50 bg-lime/10 shadow-[inset_0_0_0_1px_rgb(163_230_53/0.15)]"
                      : "border-line bg-bg-2 hover:border-line-2"
                  }`}
                >
                  <span className={`flex items-center gap-1.5 text-xs font-semibold ${active ? "text-lime" : "text-fg"}`}>
                    {o.icon}
                    {o.label}
                  </span>
                  <span className="text-[10px] text-dim">{o.hint}</span>
                </button>
              );
            })}
          </div>
        </Section>

        {/* Meta */}
        <Section
          icon={<Target className="size-3.5" />}
          title="Meta de leads"
          right={<span className="font-mono text-sm font-semibold text-fg">{params.targetLeads}</span>}
        >
          <div className="grid grid-cols-4 gap-1.5">
            {TARGET_PRESETS.map((t) => (
              <button
                key={t}
                id={`target-${t}`}
                type="button"
                disabled={running}
                onClick={() => set("targetLeads", t)}
                className={`rounded-md border py-1.5 font-mono text-xs font-semibold transition ${
                  params.targetLeads === t
                    ? "border-lime/50 bg-lime/10 text-lime"
                    : "border-line bg-bg-2 text-muted hover:border-line-2 hover:text-fg"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </Section>
      </div>

      {/* CTA */}
      <div className="border-t border-line bg-bg-2/80 p-5 backdrop-blur">
        {running ? (
          <button
            id="stop-capture-button"
            type="button"
            onClick={onStop}
            className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl border border-lime/40 bg-lime/10 text-sm font-semibold text-lime transition hover:bg-lime/15"
          >
            <span className="absolute inset-y-0 left-0 w-1/2 animate-scan bg-gradient-to-r from-transparent via-lime/15 to-transparent" />
            <LoaderCircle className="size-4 animate-spin" />
            Captando… <span className="text-lime/60">|</span>
            <Square className="size-3.5 fill-current" /> Parar
          </button>
        ) : (
          <button
            id="start-capture-button"
            type="button"
            onClick={onStart}
            disabled={!canStart}
            className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-lime text-sm font-bold text-black transition-all duration-200 hover:bg-[#b5f04a] hover:shadow-[0_8px_32px_-6px_rgb(163_230_53/0.7)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 glow-lime"
          >
            <Play className="size-4 fill-current transition-transform group-hover:scale-110" />
            Captar Leads Agora
          </button>
        )}
        <p className="mt-2.5 text-center font-mono text-[10px] text-dim">
          {params.niches.length} nicho(s) · {params.radiusKm} km · meta {params.targetLeads}
        </p>
      </div>
    </div>
  );
}
