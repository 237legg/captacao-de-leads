import { AgentRunRequestSchema, type AgentEvent } from "@/lib/schema";
import { runLeadAgent } from "@/services/leadAgent";

export const maxDuration = 800;

/**
 * Dispara o agente de captação e transmite os eventos em tempo real (NDJSON).
 * Cada linha da resposta é um AgentEvent serializado.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = AgentRunRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Parâmetros inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit = (event: AgentEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          closed = true;
        }
      };

      try {
        await runLeadAgent(parsed.data, emit, abort.signal);
      } catch (err) {
        if (!abort.signal.aborted) {
          emit({ type: "fatal", message: err instanceof Error ? err.message : String(err) });
        }
      } finally {
        if (!closed) {
          closed = true;
          controller.close();
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
