import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lutryx Júnior · Captação de Leads com IA",
  description:
    "Agente de prospecção B2B da Lutryx Júnior (UNIFEI): encontra e qualifica empresas para BI, Revenue Intelligence e Sistemas Próprios, sincronizando com o Google Sheets em tempo real.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${jetbrains.variable} h-full antialiased dark`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
