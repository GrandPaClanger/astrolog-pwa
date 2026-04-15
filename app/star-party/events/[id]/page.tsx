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
  loaded: boolean;
  container_id: number | null;
  star_party_item: {
    item_id: number;
    name: string;
    category: string;
    sub_category: string | null;
    sort_order: number;
  };
  star_party_container: { name: string } | null;
};

type Category = { slug: string; label: string };
type SubCategory = { sub_category_id: number; category_slug: string; name: string };

function fmtDate(d: string) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_LABEL: Record<string, string> = {
  to_pick: "To Pick",
  picked: "Picked",
  packed: "Packed",
  loaded: "Loaded",
};

const STATUS_COLOR: Record<string, React.CSSProperties> = {
  to_pick: { background: "rgba(251,191,36,0.2)", color: "#fbbf24" },
  picked: { background: "rgba(59,130,246,0.2)", color: "#93c5fd" },
  packed: { background: "rgba(34,197,94,0.2)", color: "#86efac" },
  loaded: { background: "rgba(167,139,250,0.2)", color: "#a78bfa" },
};

const PREV_STATUS: Record<string, "to_pick" | "picked"> = {
  picked: "to_pick",
  packed: "picked",
};

const UNDO_LABEL: Record<string, string> = {
  picked: "Un-pick",
  packed: "Un-pack",
  loaded: "Un-load",
};

export default function RequiredItemsPage() {
  const params = useParams();
  const id = params.id as string;

  const [event, setEvent] = useState<SPEvent | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<Set<number>>(new Set());
  const [removing, setRemoving] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"to_pick" | "picked" | "packed" | "loaded" | null>(null);
  const [filterCat, setFilterCat] = useState("");
  const [filterSub, setFilterSub] = useState("");

  async function load() {
    setLoading(true);
    const [evRes, catRes, piRes, subRes] = await Promise.all([
      supabase.from("star_party_event").select("event_id, name, date_from, date_to, is_current").eq("event_id", id).single(),
      supabase.from("star_party_category").select("slug, label").order("sort_order"),
      supabase
        .from("star_party_plan_item")
        .select("plan_item_id, status, loaded, container_id, star_party_item(item_id, name, category, sub_category, sort_order), star_party_container(name)")
        .eq("event_id", id)
        .order("status"),
      supabase.from("star_party_sub_category").select("sub_category_id, category_slug, name").order("sort_order").order("name"),
    ]);
    setEvent(evRes.data as SPEvent ?? null);
    setCategories((catRes.data as Category[]) ?? []);
    setSubCategories((subRes.data as SubCategory[]) ?? []);
    setPlanItems((piRes.data as unknown as PlanItem[]) ?? []);
    setLoading(false);
  }

  async function removeItem(pi: PlanItem) {
    if (pi.status !== "to_pick") return;
    setRemoving(s => new Set(s).add(pi.plan_item_id));
    setPlanItems(items => items.filter(p => p.plan_item_id !== pi.plan_item_id));
    const { error: err } = await supabase
      .from("star_party_plan_item")
      .delete()
      .eq("plan_item_id", pi.plan_item_id);
    if (err) {
      setPlanItems(items => [...items, pi]);
      alert(err.message);
    }
    setRemoving(s => { const n = new Set(s); n.delete(pi.plan_item_id); return n; });
  }

  async function undoLoaded(pi: PlanItem) {
    setUpdating(s => new Set(s).add(pi.plan_item_id));
    setPlanItems(items => items.map(p => p.plan_item_id === pi.plan_item_id ? { ...p, loaded: false } : p));
    const { error: err } = await supabase
      .from("star_party_plan_item")
      .update({ loaded: false })
      .eq("plan_item_id", pi.plan_item_id);
    if (err) {
      setPlanItems(items => items.map(p => p.plan_item_id === pi.plan_item_id ? { ...p, loaded: true } : p));
      alert(err.message);
    }
    setUpdating(s => { const n = new Set(s); n.delete(pi.plan_item_id); return n; });
  }

  async function undoStatus(pi: PlanItem) {
    const prev = PREV_STATUS[pi.status];
    if (!prev) return;
    setUpdating(s => new Set(s).add(pi.plan_item_id));
    setPlanItems(items => items.map(p => p.plan_item_id === pi.plan_item_id ? { ...p, status: prev, loaded: false } : p));
    const { error: err } = await supabase
      .from("star_party_plan_item")
      .update({ status: prev, loaded: false })
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
  const packed = planItems.filter(p => p.status === "packed" && !p.loaded).length;
  const loaded = planItems.filter(p => p.status === "packed" && p.loaded).length;

  const filterSubOptions = filterCat
    ? subCategories.filter(s => s.category_slug === filterCat)
    : subCategories;

  // Apply cat/sub pre-filter (used for both grouped view and as base for flat view)
  const catSubFiltered = (filterCat || filterSub)
    ? planItems.filter(pi => {
        if (filterCat && pi.star_party_item.category !== filterCat) return false;
        if (filterSub && (pi.star_party_item.sub_category ?? "") !== filterSub) return false;
        return true;
      })
    : planItems;

  // Dynamic grouping: category slug → sub_category → items
  const catOrder = categories.map(c => c.slug);
  const grouped: Record<string, Record<string, PlanItem[]>> = {};
  for (const pi of catSubFiltered) {
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
    padding: "8px 2px",
    borderRadius: 8,
    border: `1px solid ${active ? "rgba(59,130,246,0.6)" : "rgba(255,255,255,0.15)"}`,
    background: active ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.04)",
    color: active ? "#93c5fd" : "white",
    fontSize: 11,
    fontWeight: active ? 700 : 500,
    textAlign: "center" as const,
    textDecoration: "none",
    display: "block",
  });

  return (
    <main style={{ padding: "16px", maxWidth: 600, margin: "0 auto", paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <Link href="/star-party" style={{ fontSize: 13, opacity: 0.6, textDecoration: "none" }}>← Star Parties</Link>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Link href="/star-party/items" style={{ fontSize: 13, opacity: 0.6, textDecoration: "none" }}>✏️ Manage Items</Link>
          <Link href={`/star-party/events/${id}/print`} style={{ fontSize: 13, opacity: 0.6, textDecoration: "none" }}>🖨 Packing List</Link>
        </div>
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 20 }}>
        <span style={tabStyle(true)}>Required</span>
        <Link href={`/star-party/events/${id}/pick`} style={tabStyle(false)}>To Pick</Link>
        <Link href={`/star-party/events/${id}/pack`} style={tabStyle(false)}>To Pack</Link>
        <Link href={`/star-party/events/${id}/load`} style={tabStyle(false)}>To Load</Link>
        <Link href={`/star-party/events/${id}/off-plan`} style={tabStyle(false)}>Off Plan</Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 24 }}>
        {([
          { key: "to_pick" as const, label: "To Pick", count: toPick, color: "#fbbf24", border: "rgba(251,191,36,0.5)" },
          { key: "picked" as const, label: "Picked", count: picked, color: "#93c5fd", border: "rgba(99,179,237,0.5)" },
          { key: "packed" as const, label: "Packed", count: packed, color: "#86efac", border: "rgba(134,239,172,0.5)" },
          { key: "loaded" as const, label: "Loaded", count: loaded, color: "#a78bfa", border: "rgba(167,139,250,0.5)" },
        ]).map(s => {
          const active = filterStatus === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setFilterStatus(active ? null : s.key)}
              style={{
                borderRadius: 10,
                border: `1px solid ${active ? s.border : "rgba(255,255,255,0.1)"}`,
                background: active ? `rgba(${s.key === "to_pick" ? "251,191,36" : s.key === "picked" ? "59,130,246" : s.key === "packed" ? "34,197,94" : "167,139,250"},0.12)` : "rgba(255,255,255,0.03)",
                padding: "12px 4px", textAlign: "center", cursor: "pointer",
                width: "100%",
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.count}</div>
              <div style={{ fontSize: 11, opacity: active ? 0.9 : 0.6, marginTop: 2, color: active ? s.color : "inherit" }}>{s.label}</div>
            </button>
          );
        })}
      </div>

      {/* Category & Sub-Category Filters */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        <div>
          <label style={{ fontSize: 11, opacity: 0.6, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Category</label>
          <select
            value={filterCat}
            onChange={e => { setFilterCat(e.target.value); setFilterSub(""); }}
            style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.35)", color: "white", fontSize: 14 }}
          >
            <option value="">All categories</option>
            {categories.map(c => (
              <option key={c.slug} value={c.slug}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, opacity: 0.6, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Sub-Category</label>
          <select
            value={filterSub}
            onChange={e => setFilterSub(e.target.value)}
            disabled={filterSubOptions.length === 0}
            style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.35)", color: "white", fontSize: 14, opacity: filterSubOptions.length === 0 ? 0.4 : 1 }}
          >
            <option value="">All sub-categories</option>
            {filterSubOptions.map(s => (
              <option key={s.sub_category_id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 20 }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16, opacity: 0.4, pointerEvents: "none" }}>🔍</span>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search items…"
          style={{
            width: "100%", boxSizing: "border-box",
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 10, padding: "10px 38px 10px 38px", color: "white",
            fontSize: 16, outline: "none",
          }}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 18, cursor: "pointer", padding: "4px 6px" }}
          >×</button>
        )}
      </div>

      {planItems.length === 0 ? (
        <p style={{ opacity: 0.6 }}>No items on this plan.</p>
      ) : (() => {
        // Apply status filter (on top of cat/sub pre-filter)
        const statusFiltered = filterStatus ? catSubFiltered.filter(pi => {
          if (filterStatus === "to_pick") return pi.status === "to_pick";
          if (filterStatus === "picked") return pi.status === "picked";
          if (filterStatus === "packed") return pi.status === "packed" && !pi.loaded;
          if (filterStatus === "loaded") return pi.status === "packed" && pi.loaded;
          return true;
        }) : catSubFiltered;

        // Apply text search on top
        const q = search.trim().toLowerCase();
        const flatItems = q ? statusFiltered.filter(p => p.star_party_item.name.toLowerCase().includes(q)) : statusFiltered;

        // Helper: render a single item row
        const renderRow = (pi: PlanItem, indented = false) => (
          <div
            key={pi.plan_item_id}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: `11px 4px 11px ${indented ? 16 : 4}px`, borderBottom: "1px solid rgba(255,255,255,0.06)", minHeight: 48 }}
          >
            <div>
              <div style={{ fontSize: 15 }}>{pi.star_party_item.name}</div>
              {pi.status === "packed" && (
                <div style={{ fontSize: 11, opacity: 0.45, marginTop: 2 }}>
                  {pi.star_party_container ? pi.star_party_container.name : "Loose"}
                </div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              {pi.status === "to_pick" && (
                <button
                  onClick={() => removeItem(pi)}
                  disabled={removing.has(pi.plan_item_id)}
                  title="Remove from plan"
                  style={{ background: "none", border: "none", color: "#f87171", fontSize: 16, cursor: "pointer", padding: "2px 4px", opacity: removing.has(pi.plan_item_id) ? 0.4 : 0.6, lineHeight: 1 }}
                >✕</button>
              )}
              {pi.status === "to_pick" ? (
                <span style={{ ...STATUS_COLOR["to_pick"], padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>To Pick</span>
              ) : pi.status === "packed" && pi.loaded ? (
                <button onClick={() => undoLoaded(pi)} disabled={updating.has(pi.plan_item_id)} title="Un-load"
                  style={{ ...STATUS_COLOR["loaded"], padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, opacity: updating.has(pi.plan_item_id) ? 0.5 : 1 }}>
                  Loaded <span style={{ fontSize: 13, opacity: 0.7 }}>↩</span>
                </button>
              ) : (
                <button onClick={() => undoStatus(pi)} disabled={updating.has(pi.plan_item_id)} title={UNDO_LABEL[pi.status]}
                  style={{ ...STATUS_COLOR[pi.status], padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, opacity: updating.has(pi.plan_item_id) ? 0.5 : 1 }}>
                  {STATUS_LABEL[pi.status]} <span style={{ fontSize: 13, opacity: 0.7 }}>↩</span>
                </button>
              )}
            </div>
          </div>
        );

        // Filtered view: search or any filter active — grouped with category/sub headers
        if (search.trim() || filterStatus) {
          if (flatItems.length === 0) return (
            <p style={{ opacity: 0.55, textAlign: "center", padding: "24px 0" }}>No items match.</p>
          );
          // Group filtered items by category → sub-category
          const fg: Record<string, Record<string, PlanItem[]>> = {};
          for (const pi of flatItems) {
            const cat = pi.star_party_item.category;
            const sub = pi.star_party_item.sub_category ?? "(No sub-category)";
            if (!fg[cat]) fg[cat] = {};
            if (!fg[cat][sub]) fg[cat][sub] = [];
            fg[cat][sub].push(pi);
          }
          for (const cat of Object.keys(fg))
            for (const sub of Object.keys(fg[cat]))
              fg[cat][sub].sort((a, b) => a.star_party_item.name.localeCompare(b.star_party_item.name));
          const fgSlugs = Object.keys(fg).sort((a, b) => {
            const ai = catOrder.indexOf(a); const bi = catOrder.indexOf(b);
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
          });
          return (
            <>
              {fgSlugs.map(slug => {
                const catLabel = categories.find(c => c.slug === slug)?.label ?? slug;
                const subs = fg[slug];
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
                        {subs[sub].map(pi => renderRow(pi, sub !== "(No sub-category)"))}
                      </div>
                    ))}
                  </div>
                );
              })}
            </>
          );
        }

        // Grouped view: no filter, no search
        return (
          <>
            {sortedCatSlugs.map(slug => {
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
                      {subs[sub].map(pi => renderRow(pi, sub !== "(No sub-category)"))}
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        );
      })()}
    </main>
  );
}

