"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Item = {
  item_id: number;
  name: string;
  category: string;
  sub_category: string | null;
  sort_order: number;
};

type Category = { slug: string; label: string };
type EventMeta = { name: string; is_current: boolean };

export default function OffPlanPage() {
  const params = useParams();
  const id = params.id as string;

  const [event, setEvent] = useState<EventMeta | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    const [evRes, catRes, allItemsRes, planItemsRes] = await Promise.all([
      supabase.from("star_party_event").select("name, is_current").eq("event_id", id).single(),
      supabase.from("star_party_category").select("slug, label").order("sort_order"),
      supabase.from("star_party_item").select("item_id, name, category, sub_category, sort_order").order("category").order("sub_category", { nullsFirst: true }).order("name"),
      supabase.from("star_party_plan_item").select("item_id").eq("event_id", id),
    ]);
    setEvent(evRes.data as EventMeta ?? null);
    setCategories((catRes.data as Category[]) ?? []);
    const onPlanIds = new Set((planItemsRes.data ?? []).map((r: { item_id: number }) => r.item_id));
    const offPlan = ((allItemsRes.data as Item[]) ?? []).filter(i => !onPlanIds.has(i.item_id));
    setItems(offPlan);
    setSelected(new Set());
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  function toggleItem(itemId: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function selectAll() { setSelected(new Set(items.map(i => i.item_id))); }
  function selectNone() { setSelected(new Set()); }

  async function addToPlan() {
    if (selected.size === 0) return;
    setAdding(true);
    const { error: err } = await supabase.from("star_party_plan_item").insert(
      Array.from(selected).map(item_id => ({ event_id: Number(id), item_id, status: "to_pick" }))
    );
    if (err) { alert(err.message); setAdding(false); return; }
    await load();
    setAdding(false);
  }

  // Dynamic grouping: category slug → sub_category → items
  const catOrder = categories.map(c => c.slug);
  const grouped: Record<string, Record<string, Item[]>> = {};
  for (const item of items) {
    const cat = item.category;
    const sub = item.sub_category ?? "(No sub-category)";
    if (!grouped[cat]) grouped[cat] = {};
    if (!grouped[cat][sub]) grouped[cat][sub] = [];
    grouped[cat][sub].push(item);
  }
  // Sort categories by DB sort_order, unknown categories appended last
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

  const checkboxStyle = (chk: boolean): React.CSSProperties => ({
    width: 26, height: 26, borderRadius: 6,
    border: `2px solid ${chk ? "#3b82f6" : "rgba(255,255,255,0.3)"}`,
    background: chk ? "#3b82f6" : "transparent",
    flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
  });

  return (
    <main style={{ padding: "16px", maxWidth: 600, margin: "0 auto", paddingBottom: 100 }}>
      <div style={{ marginBottom: 14 }}>
        <Link href={`/star-party/events/${id}`} style={{ fontSize: 13, opacity: 0.6, textDecoration: "none" }}>← Required Items</Link>
      </div>

      <h1 style={{ marginBottom: 2 }}>Not on This Plan</h1>
      {event && <p style={{ fontSize: 13, opacity: 0.55, marginTop: 4, marginBottom: 16 }}>{event.name}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 20 }}>
        <Link href={`/star-party/events/${id}`} style={tabStyle(false)}>Required</Link>
        <Link href={`/star-party/events/${id}/pick`} style={tabStyle(false)}>To Pick</Link>
        <Link href={`/star-party/events/${id}/pack`} style={tabStyle(false)}>To Pack</Link>
        <span style={tabStyle(true)}>Not on Plan</span>
      </div>

      {loading ? (
        <p style={{ opacity: 0.6 }}>Loading…</p>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
          <p style={{ fontSize: 16, fontWeight: 600 }}>All items are on this plan!</p>
          <p style={{ fontSize: 13, opacity: 0.55 }}>Every item in your list has been added.</p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ fontSize: 13, opacity: 0.55, margin: 0 }}>
              {items.length} item{items.length !== 1 ? "s" : ""} not on this plan
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={selectAll} style={{ padding: "5px 10px", fontSize: 12, borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "white", cursor: "pointer" }}>All</button>
              <button onClick={selectNone} style={{ padding: "5px 10px", fontSize: 12, borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "white", cursor: "pointer" }}>None</button>
            </div>
          </div>

          {sortedCatSlugs.map(slug => {
            const catLabel = categories.find(c => c.slug === slug)?.label ?? slug;
            const subs = grouped[slug];
            const sortedSubs = Object.keys(subs).sort((a, b) =>
              a === "(No sub-category)" ? -1 : b === "(No sub-category)" ? 1 : a.localeCompare(b)
            );
            return (
              <div key={slug} style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#93c5fd", letterSpacing: "0.06em", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                  {catLabel}
                </div>
                {sortedSubs.map(sub => (
                  <div key={sub} style={{ marginBottom: sub === "(No sub-category)" ? 0 : 10 }}>
                    {sub !== "(No sub-category)" && (
                      <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.5, letterSpacing: "0.08em", padding: "6px 4px 2px", textTransform: "uppercase" }}>
                        {sub}
                      </div>
                    )}
                    {subs[sub].map(item => (
                      <div
                        key={item.item_id}
                        style={{ ...rowStyle, paddingLeft: sub !== "(No sub-category)" ? 16 : 4 }}
                        onClick={() => toggleItem(item.item_id)}
                      >
                        <div style={checkboxStyle(selected.has(item.item_id))}>
                          {selected.has(item.item_id) && <span style={{ color: "white", fontSize: 14, fontWeight: 700 }}>✓</span>}
                        </div>
                        <span style={{ fontSize: 16 }}>{item.name}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            );
          })}
        </>
      )}

      {/* Sticky add button */}
      {items.length > 0 && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "16px", background: "rgba(15,23,42,0.95)", borderTop: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(8px)" }}>
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <button
              onClick={addToPlan}
              disabled={selected.size === 0 || adding}
              style={{
                width: "100%", padding: "14px", borderRadius: 10, border: "none",
                background: selected.size === 0 ? "rgba(59,130,246,0.3)" : "#3b82f6",
                color: "white", fontSize: 16, fontWeight: 600,
                cursor: selected.size === 0 ? "not-allowed" : "pointer",
              }}
            >
              {adding ? "Adding…" : selected.size === 0 ? "Select items to add" : `Add ${selected.size} item${selected.size !== 1 ? "s" : ""} to Plan`}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
