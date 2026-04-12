"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const NAV_CARDS = [
  { href: "/targets",          label: "Targets",          desc: "Browse and manage your astronomical targets" },
  { href: "/sessions/new",     label: "New Session",      desc: "Log a new imaging session" },
  { href: "/maintenance",      label: "Maintenance",      desc: "Manage equipment lists and lookup data" },
  { href: "/flat-wizard",      label: "Flat Wizard",      desc: "NINA flat wizard settings by telescope and camera" },
  { href: "/focus-positions",  label: "Focus Positions",  desc: "Record focuser positions by telescope" },
  { href: "/star-party",       label: "Star Parties",     desc: "Packing checklists for star party events" },
];

export default function HomePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
      } else {
        setReady(true);
      }
    });
  }, [router]);

  if (!ready) {
    return (
      <main style={{ padding: 16 }}>
        <p style={{ opacity: 0.8 }}>Loading…</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 16, maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 24 }}>astrolog</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        {NAV_CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            style={{
              display: "block",
              padding: "20px 18px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.04)",
              textDecoration: "none",
              color: "inherit",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.09)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.04)")
            }
          >
            <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 6 }}>{card.label}</div>
            <div style={{ opacity: 0.6, fontSize: 13 }}>{card.desc}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
