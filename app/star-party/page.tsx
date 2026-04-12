"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type SPEvent = {
  event_id: number;
  name: string;
  date_from: string;
  date_to: string;
  is_current: boolean;
};

function fmtDate(d: string) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const S = {
  card: {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.04)",
    padding: "16px",
    marginBottom: 12,
  } as React.CSSProperties,
  currentCard: {
    borderRadius: 12,
    border: "1px solid rgba(59,130,246,0.5)",
    background: "rgba(59,130,246,0.08)",
    padding: "18px 16px",
    marginBottom: 20,
  } as React.CSSProperties,
  badge: (current: boolean): React.CSSProperties => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.05em",
    background: current ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.1)",
    color: current ? "#93c5fd" : "#94a3b8",
    marginLeft: 8,
  }),
  navBtn: {
    display: "block",
    padding: "12px 14px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 500,
    textAlign: "center" as const,
    flex: 1,
  } as React.CSSProperties,
  btn: {
    display: "block",
    width: "100%",
    padding: "14px",
    borderRadius: 10,
    border: "none",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "center" as const,
    textDecoration: "none",
  } as React.CSSProperties,
};

export default function StarPartyPage() {
  const [events, setEvents] = useState<SPEvent[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("star_party_event")
      .select("event_id, name, date_from, date_to, is_current")
      .order("is_current", { ascending: false })
      .order("date_from", { ascending: false });
    setEvents((data as SPEvent[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleCurrent(ev: SPEvent) {
    const newVal = !ev.is_current;
    if (newVal) {
      await supabase.from("star_party_event").update({ is_current: false }).eq("is_current", true);
    }
    await supabase.from("star_party_event").update({ is_current: newVal }).eq("event_id", ev.event_id);
    await load();
  }

  async function deleteEvent(ev: SPEvent) {
    if (!confirm(`Delete "${ev.name}"? This will remove all plan items.`)) return;
    await supabase.from("star_party_event").delete().eq("event_id", ev.event_id);
    await load();
  }

  const current = events.find(e => e.is_current);

  return (
    <main style={{ padding: "16px", maxWidth: 600, margin: "0 auto", paddingBottom: 40 }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/" style={{ fontSize: 13, opacity: 0.6, textDecoration: "none" }}>← Home</Link>
      </div>

      <h1 style={{ marginBottom: 6 }}>Star Parties</h1>
      <p style={{ opacity: 0.5, fontSize: 13, marginBottom: 24 }}>Packing checklists for star party events</p>

      {loading ? (
        <p style={{ opacity: 0.6 }}>Loading…</p>
      ) : (
        <>
          {/* Current Plan */}
          {current && (
            <div style={S.currentCard}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#93c5fd", letterSpacing: "0.08em", marginBottom: 6 }}>
                CURRENT PLAN
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>{current.name}</div>
              <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 16 }}>
                {fmtDate(current.date_from)} – {fmtDate(current.date_to)}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Link href={`/star-party/events/${current.event_id}`} style={{ ...S.navBtn, background: "rgba(59,130,246,0.2)", borderColor: "rgba(59,130,246,0.4)" }}>
                  Required Items
                </Link>
                <Link href={`/star-party/events/${current.event_id}/pick`} style={S.navBtn}>
                  To Pick
                </Link>
                <Link href={`/star-party/events/${current.event_id}/pack`} style={S.navBtn}>
                  To Pack
                </Link>
                <Link href={`/star-party/events/${current.event_id}/off-plan`} style={S.navBtn}>
                  Not on Plan
                </Link>
              </div>
            </div>
          )}

          {/* No events */}
          {events.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px", opacity: 0.6 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⭐</div>
              <p style={{ fontSize: 15 }}>No star party plans yet.</p>
              <p style={{ fontSize: 13 }}>Create your first plan to get started.</p>
            </div>
          )}

          {/* All Events */}
          {events.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.5, letterSpacing: "0.08em", marginBottom: 10 }}>
                ALL EVENTS
              </div>
              {events.map(ev => (
                <div key={ev.event_id} style={S.card}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                        <Link href={`/star-party/events/${ev.event_id}`} style={{ color: "inherit", textDecoration: "none" }}>
                          {ev.name}
                        </Link>
                        <span style={S.badge(ev.is_current)}>{ev.is_current ? "CURRENT" : "HISTORICAL"}</span>
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.55, marginTop: 3 }}>
                        {fmtDate(ev.date_from)} – {fmtDate(ev.date_to)}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => toggleCurrent(ev)}
                        style={{ padding: "5px 10px", fontSize: 12, borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "white", cursor: "pointer" }}
                      >
                        {ev.is_current ? "Set Historical" : "Set Current"}
                      </button>
                      <button
                        onClick={() => deleteEvent(ev)}
                        style={{ padding: "5px 10px", fontSize: 12, borderRadius: 6, border: "1px solid rgba(248,113,113,0.3)", background: "transparent", color: "#f87171", cursor: "pointer" }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Link href="/star-party/events/new" style={{ ...S.btn, background: "#3b82f6", color: "white" }}>
              + New Star Party Plan
            </Link>
            <Link href="/star-party/items" style={{ ...S.btn, background: "rgba(255,255,255,0.08)", color: "white", border: "1px solid rgba(255,255,255,0.15)" }}>
              Manage Items
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
