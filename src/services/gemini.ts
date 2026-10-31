import "server-only";

export type GeminiResult = {
  text: string;
  sources: string[];
  queries: string[];
};

export class GeminiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly fatal: boolean,
  ) {
    super(message);
  }
}

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
    groundingMetadata?: {
      webSearchQueries?: string[];
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
    };
  }>;
  error?: { message?: string; status?: string };
};

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new Error("aborted"));
    });
  });

/**
 * Chama o Gemini com Google Search grounding habilitado (busca web em tempo real).
 * Faz retry com backoff para 429/5xx.
 */
export async function callGeminiWithSearch(opts: {
  apiKey: string;
  model: string;
  prompt: string;
  signal?: AbortSignal;
  temperature?: number;
}): Promise<GeminiResult> {
  const { apiKey, model, prompt, signal, temperature = 0.3 } = opts;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent`;

  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature },
  });

  let lastError: GeminiError | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (signal?.aborted) throw new Error("aborted");

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body,
      signal,
    });

    const json = (await res.json().catch(() => ({}))) as GeminiResponse;

    if (!res.ok) {
      const msg = json.error?.message ?? `HTTP ${res.status}`;
      const retryable = res.status === 429 || res.status >= 500;
      const fatal = res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404;
      lastError = new GeminiError(msg, res.status, fatal);
      if (retryable && attempt < 2) {
        await sleep(2000 * 2 ** attempt + Math.random() * 1000, signal);
        continue;
      }
      throw lastError;
    }

    const candidate = json.candidates?.[0];
    const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
    const meta = candidate?.groundingMetadata;
    const sources = Array.from(
      new Set(
        (meta?.groundingChunks ?? [])
          .map((c) => c.web?.title || c.web?.uri || "")
          .filter(Boolean),
      ),
    );

    if (!text) {
      lastError = new GeminiError(
        `Resposta vazia do modelo (${candidate?.finishReason ?? "sem motivo"})`,
        200,
        false,
      );
      if (attempt < 2) continue;
      throw lastError;
    }

    return { text, sources, queries: meta?.webSearchQueries ?? [] };
  }

  throw lastError ?? new GeminiError("Falha desconhecida no Gemini", 500, false);
}

/** Extrai o primeiro objeto/array JSON de um texto (tolera ```json fences e texto extra). */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    /* continua */
  }

  const start = cleaned.search(/[[{]/);
  if (start === -1) throw new Error("Nenhum JSON encontrado na resposta do modelo");
  const open = cleaned[start];
  const close = open === "{" ? "}" : "]";
  const end = cleaned.lastIndexOf(close);
  if (end <= start) throw new Error("JSON incompleto na resposta do modelo");

  const slice = cleaned
    .slice(start, end + 1)
    .replace(/,\s*([}\]])/g, "$1"); // remove vírgulas finais
  return JSON.parse(slice);
}
