import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hannon Acadimi",
  description: "Plateforme e-learning — sessions Zoom automatisées",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
