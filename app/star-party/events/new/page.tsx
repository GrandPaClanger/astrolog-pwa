"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { DEFAULT_STAR_PARTY_ITEMS } from "@/lib/star-party-defaults";

export const dynamic = "force-dynamic";

type Item = {
  item_id: number;
  name: string;
  category: string;
  sub_category: string | null;
  sort_order: number;
};

type Category = { slug: string; label: string };

type PastEvent = {
  event_id: number;
  name: string;
  date_from: string;
};

const iStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(0,0,0,0.35)",
  color: "white",
  fontSize: 16,
  boxSizing: "border-box",
};

const lStyle: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.6,
  marginBottom: 4,
  display: "block",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

function fmtYear(d: string) {
  return new Date(d + "T00:00:00").getFullYear();
}

export default function NewEventPage() {
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [pastEvents, setPastEvents] = useState<PastEvent[]>([]);
  const [copyFromId, setCopyFromId] = useState<string>("");
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingCopy, setLoadingCopy] = useState(false);

  const [eventName, setEventName] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isCurrent, setIsCurrent] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    setLoadingItems(true);
    const [catRes, evRes] = await Promise.all([
      supabase.from("star_party_category").select("slug, label").order("sort_order"),
      supabase.from("star_party_event").select("event_id, name, date_from").order("date_from", { ascending: false }),
    ]);
    setCategories((catRes.data as Category[]) ?? []);
    setPastEvents((evRes.data as PastEvent[]) ?? []);

    let { data } = await supabase
      .from("star_party_item")
      .select("item_id, name, category, sub_category, sort_order")
      .order("category")
      .order("sub_category", { nullsFirst: true })
      .order("name");

    let rows = (data as Item[]) ?? [];

    // Auto-init defaults if empty
    if (rows.length === 0) {
      const { error: err } = await supabase.from("star_party_item").insert(
        DEFAULT_STAR_PARTY_ITEMS.map(d => ({
          name: d.name,
          category: d.category,
          sub_category: d.sub_category,
          sort_order: d.sort_order,
        }))
      );
      if (!err) {
        const { data: d2 } = await supabase
          .from("star_party_item")
          .select("item_id, name, category, sub_category, sort_order")
          .order("category")
          .order("sub_category", { nullsFirst: true })
          .order("name");
        rows = (d2 as Item[]) ?? [];
      }
    }

    setItems(rows);
    setChecked(new Set(rows.map(i => i.item_id)));
    setLoadingItems(false);
  }

  useEffect(() => { loadAll(); }, []);

  async function handleCopyFrom(eventId: string) {
    setCopyFromId(eventId);
    if (!eventId) {
      // Revert to all checked
      setChecked(new Set(items.map(i => i.item_id)));
      return;
    }
    setLoadingCopy(true);
    const { data } = await supabase
      .from("star_party_plan_item")
      .select("item_id")
      .eq("event_id", Number(eventId));
    const ids = new Set((data ?? []).map((r: { item_id: number }) => r.item_id));
    // Only keep ids that exist in the current master item list
    const validIds = new Set(items.filter(i => ids.has(i.item_id)).map(i => i.item_id));
    setChecked(validIds);
    setLoadingCopy(false);
  }

  function toggleItem(id: number) {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCategory(slug: string, check: boolean) {
    setChecked(prev => {
      const next = new Set(prev);
      items.filter(i => i.category === slug).forEach(i => {
        if (check) next.add(i.item_id);
        else next.delete(i.item_id);
      });
      return next;
    });
  }

  async function onSave() {
    if (!eventName.trim()) { setError("Event name is required."); return; }
    if (!dateFrom) { setError("Start date is required."); return; }
    if (!dateTo) { setError("End date is required."); return; }
    if (dateTo < dateFrom) { setError("End date must be on or after start date."); return; }
    if (checked.size === 0) { setError("Please select at least one item."); return; }

    setSaving(true);
    setError(null);

    if (isCurrent) {
      await supabase.from("star_party_event").update({ is_current: false }).eq("is_current", true);
    }

    const { data: ev, error: evErr } = await supabase
      .from("star_party_event")
      .insert({ name: eventName.trim(), date_from: dateFrom, date_to: dateTo, is_current: isCurrent })
      .select("event_id")
      .single();

    if (evErr || !ev) { setError(evErr?.message ?? "Failed to create event."); setSaving(false); return; }

    const { error: piErr } = await supabase.from("star_party_plan_item").insert(
      Array.from(checked).map(item_id => ({ event_id: ev.event_id, item_id, status: "to_pick" }))
    );
    if (piErr) { setError(piErr.message); setSaving(false); return; }

    router.push(`/star-party/events/${ev.event_id}`);
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
  const sortedCatSlugs = Object.keys(grouped).sort((a, b) => {
    const ai = catOrder.indexOf(a);
    const bi = catOrder.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const checkboxStyle = (chk: boolean): React.CSSProperties => ({
    width: 22,
    height: 22,
    borderRadius: 5,
    border: `2px solid ${chk ? "#3b82f6" : "rgba(255,255,255,0.3)"}`,
    background: chk ? "#3b82f6" : "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    cursor: "pointer",
  });

  return (
    <main style={{ padding: "16px", maxWidth: 600, margin: "0 auto", paddingBottom: 60 }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/star-party" style={{ fontSize: 13, opacity: 0.6, textDecoration: "none" }}>← Star Parties</Link>
      </div>

      <h1 style={{ marginBottom: 20 }}>New Star Party Plan</h1>

      {/* Event Details */}
      <div style={{ border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: "20px 16px", marginBottom: 24, background: "rgba(255,255,255,0.03)" }}>
        <div style={{ marginBottom: 14 }}>
          <label style={lStyle}>Event Name *</label>
          <input type="text" style={iStyle} value={eventName} onChange={e => setEventName(e.target.value)} placeholder="e.g. Kelling Heath 2026" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={lStyle}>Date From *</label>
            <input type="date" style={iStyle} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label style={lStyle}>Date To *</label>
            <input type="date" style={iStyle} value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
          <div style={checkboxStyle(isCurrent)} onClick={() => setIsCurrent(v => !v)}>
            {isCurrent && <span style={{ color: "white", fontSize: 14, fontWeight: 700, lineHeight: 1 }}>✓</span>}
          </div>
          <span style={{ fontSize: 14 }}>Mark as Current Plan</span>
        </label>
      </div>

      {/* Copy from previous event */}
      {pastEvents.length > 0 && (
        <div style={{ border: "1px solid rgba(59,130,246,0.3)", borderRadius: 12, padding: "16px", marginBottom: 24, background: "rgba(59,130,246,0.05)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Copy items from a previous event</div>
          <div style={{ fontSize: 12, opacity: 0.55, marginBottom: 12 }}>
            Pre-select the same items as a past trip, then adjust as needed.
          </div>
          <select
            style={iStyle}
            value={copyFromId}
            onChange={e => handleCopyFrom(e.target.value)}
            disabled={loadingItems}
          >
            <option value="">— Start with all items selected —</option>
            {pastEvents.map(ev => (
              <option key={ev.event_id} value={String(ev.event_id)}>
                {ev.name} ({fmtYear(ev.date_from)})
              </option>
            ))}
          </select>
          {loadingCopy && <p style={{ fontSize: 12, opacity: 0.6, marginTop: 8, marginBottom: 0 }}>Loading items from previous event…</p>}
        </div>
      )}

      {/* Item Selection */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Select Items for this Plan</div>
        <div style={{ fontSize: 12, opacity: 0.55, marginBottom: 16 }}>
          {copyFromId
            ? "Items from the selected event are pre-checked. Adjust as needed."
            : "All items are included by default. Uncheck anything you don't need."}
        </div>

        {loadingItems ? (
          <p style={{ opacity: 0.6 }}>Loading items…</p>
        ) : (
          sortedCatSlugs.map(slug => {
            const catLabel = categories.find(c => c.slug === slug)?.label ?? slug;
            const subs = grouped[slug];
            const catItems = items.filter(i => i.category === slug);
            const allChecked = catItems.length > 0 && catItems.every(i => checked.has(i.item_id));
            const sortedSubs = Object.keys(subs).sort((a, b) =>
              a === "(No sub-category)" ? -1 : b === "(No sub-category)" ? 1 : a.localeCompare(b)
            );
            return (
              <div key={slug} style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#93c5fd" }}>{catLabel}</span>
                  <button
                    onClick={() => toggleCategory(slug, !allChecked)}
                    style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "white", cursor: "pointer" }}
                  >
                    {allChecked ? "Uncheck All" : "Check All"}
                  </button>
                </div>
                {sortedSubs.map(sub => (
                  <div key={sub} style={{ marginBottom: 12 }}>
                    {sub !== "(No sub-category)" && (
                      <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.5, letterSpacing: "0.08em", padding: "6px 4px 4px", textTransform: "uppercase" }}>
                        {sub}
                      </div>
                    )}
                    {subs[sub].map(item => (
                      <div
                        key={item.item_id}
                        onClick={() => toggleItem(item.item_id)}
                        style={{ display: "flex", alignItems: "center", gap: 12, padding: `11px 4px 11px ${sub !== "(No sub-category)" ? 16 : 4}px`, borderBottom: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", minHeight: 48 }}
                      >
                        <div style={checkboxStyle(checked.has(item.item_id))}>
                          {checked.has(item.item_id) && <span style={{ color: "white", fontSize: 14, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                        </div>
                        <span style={{ fontSize: 15 }}>{item.name}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>

      <div style={{ fontSize: 13, opacity: 0.55, marginBottom: 12 }}>
        {checked.size} of {items.length} items selected
      </div>

      {error && <p style={{ color: "#f87171", fontSize: 14, marginBottom: 12 }}>{error}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          onClick={onSave}
          disabled={saving || loadingItems}
          style={{ padding: "14px", borderRadius: 10, border: "none", background: "#3b82f6", color: "white", fontSize: 16, fontWeight: 600, cursor: "pointer" }}
        >
          {saving ? "Saving…" : "Save Plan"}
        </button>
        <Link href="/star-party" style={{ display: "block", padding: "14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "white", fontSize: 16, textAlign: "center", textDecoration: "none" }}>
          Cancel
        </Link>
      </div>
    </main>
  );
}
