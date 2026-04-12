"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type SPEvent = {
  event_id: number;
  name: string;
  date_from: string;
  date_to: string;
  is_current: boolean;
};

type PlanItem = {
  plan_item_id: number;
  status: "to_pick" | "picked" | "packed";
  star_party_item: {
    item_id: number;
    name: string;
    category: string;
    sub_category: string | null;
    sort_order: number;
  };
};

type Category = { slug: string; label: string };

function fmtDate(d: string) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_LABEL: Record<string, string> = {
  to_pick: "To Pick",
  picked: "Picked",
  packed: "Packed",
};

const STATUS_COLOR: Record<string, React.CSSProperties> = {
  to_pick: { background: "rgba(251,191,36,0.2)", color: "#fbbf24" },
  picked: { background: "rgba(59,130,246,0.2)", color: "#93c5fd" },
  packed: { background: "rgba(34,197,94,0.2)", color: "#86efac" },
};

const PREV_STATUS: Record<string, "to_pick" | "picked"> = {
  picked: "to_pick",
  packed: "picked",
};

const UNDO_LABEL: Record<string, string> = {
  picked: "Un-pick",
  packed: "Un-pack",
};

export default function RequiredItemsPage() {
  const params = useParams();
  const id = params.id as string;

  const [event, setEvent] = useState<SPEvent | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<Set<number>>(new Set());

  async function load() {
    setLoading(true);
    const [evRes, catRes, piRes] = await Promise.all([
      supabase.from("star_party_event").select("event_id, name, date_from, date_to, is_current").eq("event_id", id).single(),
      supabase.from("star_party_category").select("slug, label").order("sort_order"),
      supabase
        .from("star_party_plan_item")
        .select("plan_item_id, status, star_party_item(item_id, name, category, sub_category, sort_order)")
        .eq("event_id", id)
        .order("status"),
    ]);
    setEvent(evRes.data as SPEvent ?? null);
    setCategories((catRes.data as Category[]) ?? []);
    setPlanItems((piRes.data as unknown as PlanItem[]) ?? []);
    setLoading(false);
  }

  async function undoStatus(pi: PlanItem) {
    const prev = PREV_STATUS[pi.status];
    if (!prev) return;
    setUpdating(s => new Set(s).add(pi.plan_item_id));
    setPlanItems(items => items.map(p => p.plan_item_id === pi.plan_item_id ? { ...p, status: prev } : p));
    const { error: err } = await supabase
      .from("star_party_plan_item")
      .update({ status: prev })
      .eq("plan_item_id", pi.plan_item_id);
    if (err) {
      setPlanItems(items => items.map(p => p.plan_item_id === pi.plan_item_id ? { ...p, status: pi.status } : p));
      alert(err.message);
    }
    setUpdating(s => { const n = new Set(s); n.delete(pi.plan_item_id); return n; });
  }

  useEffect(() => { load(); }, [id]);

  if (loading) return <main style={{ padding: 16 }}><p style={{ opacity: 0.6 }}>Loading…</p></main>;
  if (!event) return <main style={{ padding: 16 }}><p>Event not found.</p></main>;

  const toPick = planItems.filter(p => p.status === "to_pick").length;
  const picked = planItems.filter(p => p.status === "picked").length;
  const packed = planItems.filter(p => p.status === "packed").length;

  // Dynamic grouping: category slug → sub_category → items
  const catOrder = categories.map(c => c.slug);
  const grouped: Record<string, Record<string, PlanItem[]>> = {};
  for (const pi of planItems) {
    const cat = pi.star_party_item.category;
    const sub = pi.star_party_item.sub_category ?? "(No sub-category)";
    if (!grouped[cat]) grouped[cat] = {};
    if (!grouped[cat][sub]) grouped[cat][sub] = [];
    grouped[cat][sub].push(pi);
  }
  for (const cat of Object.keys(grouped)) {
    for (const sub of Object.keys(grouped[cat])) {
      grouped[cat][sub].sort((a, b) => a.star_party_item.name.localeCompare(b.star_party_item.name));
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

  return (
    <main style={{ padding: "16px", maxWidth: 600, margin: "0 auto", paddingBottom: 40 }}>
      <div style={{ marginBottom: 14 }}>
        <Link href="/star-party" style={{ fontSize: 13, opacity: 0.6, textDecoration: "none" }}>← Star Parties</Link>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>{event.name}</h1>
          <span style={{
            display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: event.is_current ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.1)",
            color: event.is_current ? "#93c5fd" : "#94a3b8",
          }}>
            {event.is_current ? "CURRENT" : "HISTORICAL"}
          </span>
        </div>
        <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.55 }}>
          {fmtDate(event.date_from)} – {fmtDate(event.date_to)}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 20 }}>
        <span style={tabStyle(true)}>Required</span>
        <Link href={`/star-party/events/${id}/pick`} style={tabStyle(false)}>To Pick</Link>
        <Link href={`/star-party/events/${id}/pack`} style={tabStyle(false)}>To Pack</Link>
        <Link href={`/star-party/events/${id}/off-plan`} style={tabStyle(false)}>Not on Plan</Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 24 }}>
        {[
          { label: "To Pick", count: toPick, color: "#fbbf24" },
          { label: "Picked", count: picked, color: "#93c5fd" },
          { label: "Packed", count: packed, color: "#86efac" },
        ].map(s => (
          <div key={s.label} style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", padding: "12px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {planItems.length === 0 ? (
        <p style={{ opacity: 0.6 }}>No items on this plan.</p>
      ) : (
        sortedCatSlugs.map(slug => {
          const catLabel = categories.find(c => c.slug === slug)?.label ?? slug;
          const subs = grouped[slug];
          const sortedSubs = Object.keys(subs).sort((a, b) =>
            a === "(No sub-category)" ? -1 : b === "(No sub-category)" ? 1 : a.localeCompare(b)
          );
          return (
            <div key={slug} style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#93c5fd", letterSpacing: "0.06em", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                {catLabel}
              </div>
              {sortedSubs.map(sub => (
                <div key={sub} style={{ marginBottom: 12 }}>
                  {sub !== "(No sub-category)" && (
                    <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.5, letterSpacing: "0.08em", padding: "6px 4px 4px", textTransform: "uppercase" }}>
                      {sub}
                    </div>
                  )}
                  {subs[sub].map(pi => (
                    <div
                      key={pi.plan_item_id}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: `11px 4px 11px ${sub !== "(No sub-category)" ? 16 : 4}px`, borderBottom: "1px solid rgba(255,255,255,0.06)", minHeight: 48 }}
                    >
                      <span style={{ fontSize: 15 }}>{pi.star_party_item.name}</span>
                      {pi.status === "to_pick" ? (
                        <span style={{ ...STATUS_COLOR[pi.status], padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                          {STATUS_LABEL[pi.status]}
                        </span>
                      ) : (
                        <button
                          onClick={() => undoStatus(pi)}
                          disabled={updating.has(pi.plan_item_id)}
                          title={UNDO_LABEL[pi.status]}
                          style={{ ...STATUS_COLOR[pi.status], padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, opacity: updating.has(pi.plan_item_id) ? 0.5 : 1 }}
                        >
                          {STATUS_LABEL[pi.status]}
                          <span style={{ fontSize: 13, opacity: 0.7 }}>↩</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          );
        })
      )}
    </main>
  );
}
