import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import { Header } from "./Header";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "Hannon Acadimi",
  description: "Formations professionnelles en visioconférence pour les particuliers, les entreprises et les organismes publics.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${manrope.variable} ${fraunces.variable}`}>
        <a className="skip-link" href="#contenu">
          Aller au contenu
        </a>
        <Header />
        <div id="contenu">{children}</div>
        <footer className="site-footer">Hannon Acadimi — formations en direct, places limitées, accès personnel.</footer>
      </body>
    </html>
  );
}
