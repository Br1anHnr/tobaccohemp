import type { Metadata } from "next";
import { Archivo_Black, Inter } from "next/font/google";
import { Providers } from "@/components/layout/Providers";
import { Header } from "@/components/layout/Header";
import { UtilityBar } from "@/components/layout/UtilityBar";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";
const display = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});
export const metadata: Metadata = {
  title: { default: "Tobacco Hemp | Loja", template: "%s | Tobacco Hemp" },
  description:
    "Acessórios para acompanhar seu estilo. Explore cases, shoulder bags, bandejas e organizadores na Tobacco Hemp.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${display.variable} ${body.variable}`}>
        <Providers>
          <a href="#main-content" className="skip-link">
            Pular para o conteúdo
          </a>
          <UtilityBar />
          <Header />
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
