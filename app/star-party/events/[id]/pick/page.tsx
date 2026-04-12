"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type PlanItem = {
  plan_item_id: number;
  status: string;
  star_party_item: {
    item_id: number;
    name: string;
    category: string;
    sub_category: string | null;
    sort_order: number;
  };
};

type EventMeta = { name: string; is_current: boolean };

export default function ToPickPage() {
  const params = useParams();
  const id = params.id as string;

  const [event, setEvent] = useState<EventMeta | null>(null);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<Set<number>>(new Set());

  async function load() {
    setLoading(true);
    const [evRes, piRes] = await Promise.all([
      supabase.from("star_party_event").select("name, is_current").eq("event_id", id).single(),
      supabase
        .from("star_party_plan_item")
        .select("plan_item_id, status, star_party_item(item_id, name, category, sub_category, sort_order)")
        .eq("event_id", id)
        .eq("status", "to_pick"),
    ]);
    setEvent(evRes.data as EventMeta ?? null);
    setItems((piRes.data as unknown as PlanItem[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function markPicked(pi: PlanItem) {
    setUpdating(prev => new Set(prev).add(pi.plan_item_id));
    // Optimistic removal
    setItems(prev => prev.filter(p => p.plan_item_id !== pi.plan_item_id));
    const { error: err } = await supabase
      .from("star_party_plan_item")
      .update({ status: "picked" })
      .eq("plan_item_id", pi.plan_item_id);
    if (err) {
      // Restore on error
      setItems(prev => [...prev, pi].sort((a, b) => a.star_party_item.sort_order - b.star_party_item.sort_order));
      alert(err.message);
    }
    setUpdating(prev => { const n = new Set(prev); n.delete(pi.plan_item_id); return n; });
  }

  // Group
  const camping = items.filter(p => p.star_party_item.category === "camping")
    .sort((a, b) => a.star_party_item.sort_order - b.star_party_item.sort_order);
  const astroItems = items.filter(p => p.star_party_item.category === "astro");
  const astroSubs: Record<string, PlanItem[]> = {};
  for (const pi of astroItems) {
    const sub = pi.star_party_item.sub_category ?? "General";
    if (!astroSubs[sub]) astroSubs[sub] = [];
    astroSubs[sub].push(pi);
  }
  for (const sub of Object.keys(astroSubs)) {
    astroSubs[sub].sort((a, b) => a.star_party_item.sort_order - b.star_party_item.sort_order);
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "10px 4px",
    borderRadius: 8,
    border: `1px solid ${active ? "rgba(59,130,246,0.6)" : "rgba(255,255,255,0.15)"}`,
    background: active ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.04)",
    color: active ? "#93c5fd" : "white",
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    textAlign: "center" as const,
    textDecoration: "none",
    display: "block",
  });

  const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 4px",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    cursor: "pointer",
    minHeight: 56,
    userSelect: "none",
    WebkitTapHighlightColor: "transparent",
  };

  return (
    <main style={{ padding: "16px", maxWidth: 600, margin: "0 auto", paddingBottom: 40 }}>
      <div style={{ marginBottom: 14 }}>
        <Link href={`/star-party/events/${id}`} style={{ fontSize: 13, opacity: 0.6, textDecoration: "none" }}>← Required Items</Link>
      </div>

      <h1 style={{ marginBottom: 2 }}>To Pick</h1>
      {event && <p style={{ fontSize: 13, opacity: 0.55, marginTop: 4, marginBottom: 16 }}>{event.name}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 20 }}>
        <Link href={`/star-party/events/${id}`} style={tabStyle(false)}>Required</Link>
        <span style={tabStyle(true)}>To Pick</span>
        <Link href={`/star-party/events/${id}/pack`} style={tabStyle(false)}>To Pack</Link>
        <Link href={`/star-party/events/${id}/off-plan`} style={tabStyle(false)}>Off Plan</Link>
      </div>

      {loading ? (
        <p style={{ opacity: 0.6 }}>Loading…</p>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
          <p style={{ fontSize: 16, fontWeight: 600 }}>All items picked!</p>
          <p style={{ fontSize: 13, opacity: 0.55, marginBottom: 20 }}>Nothing left to pick.</p>
          <Link href={`/star-party/events/${id}`} style={{ display: "inline-block", padding: "12px 24px", borderRadius: 10, background: "#3b82f6", color: "white", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
            View Required Items
          </Link>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 13, opacity: 0.55, marginBottom: 16 }}>
            Tap an item to mark it as picked. It will disappear from this list.
          </p>

          {/* Camping Gear */}
          {camping.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#93c5fd", letterSpacing: "0.06em", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                Camping Gear ({camping.length})
              </div>
              {camping.map(pi => (
                <div key={pi.plan_item_id} style={rowStyle} onClick={() => markPicked(pi)}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 6,
                    border: "2px solid rgba(255,255,255,0.35)",
                    background: "transparent", flexShrink: 0,
                    opacity: updating.has(pi.plan_item_id) ? 0.4 : 1,
                  }} />
                  <span style={{ fontSize: 16 }}>{pi.star_party_item.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Astro Gear */}
          {Object.keys(astroSubs).length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#93c5fd", letterSpacing: "0.06em", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                Astro Gear ({astroItems.length})
              </div>
              {Object.entries(astroSubs).map(([sub, subItems]) => (
                <div key={sub} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.5, letterSpacing: "0.08em", padding: "6px 4px 2px", textTransform: "uppercase" }}>
                    {sub}
                  </div>
                  {subItems.map(pi => (
                    <div key={pi.plan_item_id} style={{ ...rowStyle, paddingLeft: 16 }} onClick={() => markPicked(pi)}>
                      <div style={{
                        width: 26, height: 26, borderRadius: 6,
                        border: "2px solid rgba(255,255,255,0.35)",
                        background: "transparent", flexShrink: 0,
                        opacity: updating.has(pi.plan_item_id) ? 0.4 : 1,
                      }} />
                      <span style={{ fontSize: 16 }}>{pi.star_party_item.name}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
