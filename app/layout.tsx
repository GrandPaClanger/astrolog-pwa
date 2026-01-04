import "./globals.css";
import type { Metadata } from "next";
import { ClientShell } from "@/components/ClientShell";
import VersionGate from "@/components/VersionGate";

export const metadata: Metadata = {
  title: "astrolog-pwa",
  description: "Astrophotography session log PWA",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <VersionGate />
          <ClientShell>{children}</ClientShell>
        </div>
      </body>
    </html>
  );
}
