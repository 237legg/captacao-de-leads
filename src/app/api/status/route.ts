import { connection } from "next/server";
import { DEFAULT_GEMINI_MODEL } from "@/services/gemini";

/** Informa ao cliente quais integrações estão configuradas no servidor (sem expor segredos). */
export async function GET() {
  await connection(); // garante leitura de env em tempo de requisição (Cache Components)

  return Response.json({
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    serviceAccountConfigured: Boolean(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY,
    ),
    spreadsheetIdConfigured: Boolean(process.env.SPREADSHEET_ID),
  });
}
