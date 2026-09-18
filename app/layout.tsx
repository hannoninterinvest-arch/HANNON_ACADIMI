import type { Metadata } from "next";
import "./globals.css";
import { Header } from "./Header";

export const metadata: Metadata = {
  title: "Hannon Acadimi",
  description: "Plateforme e-learning — formations live Zoom, B2C et entreprises",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}
