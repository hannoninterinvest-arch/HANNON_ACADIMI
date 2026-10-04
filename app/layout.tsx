import type { Metadata } from "next";
import { Cormorant_Garamond, Outfit } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Header } from "./Header";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-sans" });
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Hannon Academy",
  description: "Formations professionnelles en présentiel, à distance et en intra-entreprise.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${outfit.variable} ${cormorant.variable}`}>
        <a className="skip-link" href="#contenu">
          Aller au contenu
        </a>
        <Header />
        <div id="contenu">{children}</div>
        <footer className="site-footer">
          <div className="footer-grid">
            <div>
              <img className="footer-logo" src="/marque-hannon.png" alt="" />
              <p>Hannon Academy forme les particuliers, les entreprises et les organismes publics.</p>
            </div>
            <div>
              <h2>Formations</h2>
              <p><Link href="/catalogue">Catalogue</Link></p>
              <p><Link href="/demande">Session intra-entreprise</Link></p>
              <p><Link href="/inscription">Compte particulier</Link></p>
            </div>
            <div>
              <h2>Espaces</h2>
              <p><Link href="/connexion">Connexion</Link></p>
              <p><Link href="/connexion">Espace organisation</Link></p>
              <p><Link href="/espace">Mon espace</Link></p>
            </div>
          </div>
          <div className="wrap legal">Hannon Academy — places limitées, accès personnel, certificat nominatif.</div>
        </footer>
      </body>
    </html>
  );
}
