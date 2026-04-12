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

type Category = { slug: string; label: string };
type EventMeta = { name: string; is_current: boolean };

export default function ToPackPage() {
  const params = useParams();
  const id = params.id as string;

  const [event, setEvent] = useState<EventMeta | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<Set<number>>(new Set());

  async function load() {
    setLoading(true);
    const [evRes, catRes, piRes] = await Promise.all([
      supabase.from("star_party_event").select("name, is_current").eq("event_id", id).single(),
      supabase.from("star_party_category").select("slug, label").order("sort_order"),
      supabase
        .from("star_party_plan_item")
        .select("plan_item_id, status, star_party_item(item_id, name, category, sub_category, sort_order)")
        .eq("event_id", id)
        .eq("status", "picked"),
    ]);
    setEvent(evRes.data as EventMeta ?? null);
    setCategories((catRes.data as Category[]) ?? []);
    setItems((piRes.data as unknown as PlanItem[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function markPacked(pi: PlanItem) {
    setUpdating(prev => new Set(prev).add(pi.plan_item_id));
    setItems(prev => prev.filter(p => p.plan_item_id !== pi.plan_item_id));
    const { error: err } = await supabase
      .from("star_party_plan_item")
      .update({ status: "packed" })
      .eq("plan_item_id", pi.plan_item_id);
    if (err) {
      setItems(prev => [...prev, pi].sort((a, b) => a.star_party_item.sort_order - b.star_party_item.sort_order));
      alert(err.message);
    }
    setUpdating(prev => { const n = new Set(prev); n.delete(pi.plan_item_id); return n; });
  }

  // Dynamic grouping
  const catOrder = categories.map(c => c.slug);
  const grouped: Record<string, Record<string, PlanItem[]>> = {};
  for (const pi of items) {
    const cat = pi.star_party_item.category;
    const sub = pi.star_party_item.sub_category ?? "(No sub-category)";
    if (!grouped[cat]) grouped[cat] = {};
    if (!grouped[cat][sub]) grouped[cat][sub] = [];
    grouped[cat][sub].push(pi);
  }
  for (const cat of Object.keys(grouped)) {
    for (const sub of Object.keys(grouped[cat])) {
      grouped[cat][sub].sort((a, b) => a.star_party_item.sort_order - b.star_party_item.sort_order);
    }
  }
  const sortedCatSlugs = Object.keys(grouped).sort((a, b) => {
    const ai = catOrder.indexOf(a);
    const bi = catOrder.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

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

      <h1 style={{ marginBottom: 2 }}>To Pack</h1>
      {event && <p style={{ fontSize: 13, opacity: 0.55, marginTop: 4, marginBottom: 16 }}>{event.name}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 20 }}>
        <Link href={`/star-party/events/${id}`} style={tabStyle(false)}>Required</Link>
        <Link href={`/star-party/events/${id}/pick`} style={tabStyle(false)}>To Pick</Link>
        <span style={tabStyle(true)}>To Pack</span>
        <Link href={`/star-party/events/${id}/off-plan`} style={tabStyle(false)}>Not on Plan</Link>
      </div>

      {loading ? (
        <p style={{ opacity: 0.6 }}>Loading…</p>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
          <p style={{ fontSize: 16, fontWeight: 600 }}>All packed!</p>
          <p style={{ fontSize: 13, opacity: 0.55, marginBottom: 20 }}>No picked items waiting to be packed. Pick some items first.</p>
          <Link href={`/star-party/events/${id}`} style={{ display: "inline-block", padding: "12px 24px", borderRadius: 10, background: "#3b82f6", color: "white", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
            View Required Items
          </Link>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 13, opacity: 0.55, marginBottom: 16 }}>
            Tap an item to mark it as packed. It will disappear from this list.
          </p>

          {sortedCatSlugs.map(slug => {
            const catLabel = categories.find(c => c.slug === slug)?.label ?? slug;
            const subs = grouped[slug];
            const catTotal = Object.values(subs).reduce((n, arr) => n + arr.length, 0);
            const sortedSubs = Object.keys(subs).sort((a, b) =>
              a === "(No sub-category)" ? -1 : b === "(No sub-category)" ? 1 : a.localeCompare(b)
            );
            return (
              <div key={slug} style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#93c5fd", letterSpacing: "0.06em", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                  {catLabel} ({catTotal})
                </div>
                {sortedSubs.map(sub => (
                  <div key={sub} style={{ marginBottom: 10 }}>
                    {sub !== "(No sub-category)" && (
                      <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.5, letterSpacing: "0.08em", padding: "6px 4px 2px", textTransform: "uppercase" }}>
                        {sub}
                      </div>
                    )}
                    {subs[sub].map(pi => (
                      <div
                        key={pi.plan_item_id}
                        style={{ ...rowStyle, paddingLeft: sub !== "(No sub-category)" ? 16 : 4 }}
                        onClick={() => markPacked(pi)}
                      >
                        <div style={{
                          width: 26, height: 26, borderRadius: 6,
                          border: "2px solid #3b82f6",
                          background: "rgba(59,130,246,0.15)", flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          opacity: updating.has(pi.plan_item_id) ? 0.4 : 1,
                        }}>
                          <span style={{ color: "#93c5fd", fontSize: 14, fontWeight: 700 }}>✓</span>
                        </div>
                        <span style={{ fontSize: 16 }}>{pi.star_party_item.name}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            );
          })}
        </>
      )}
    </main>
  );
}
