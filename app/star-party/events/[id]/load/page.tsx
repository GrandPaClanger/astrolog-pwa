"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type ContainerPlanItem = {
  plan_item_id: number;
  loaded: boolean;
  status: string;
  star_party_item: { name: string };
};

type ContainerWithItems = {
  container_id: number;
  name: string;
  description: string | null;
  star_party_container_type: { name: string };
  star_party_plan_item: ContainerPlanItem[];
};

type LooseItem = {
  plan_item_id: number;
  loaded: boolean;
  star_party_item: { name: string };
};

type EventMeta = { name: string };

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

export default function ToLoadPage() {
  const params = useParams();
  const id = params.id as string;

  const [event, setEvent] = useState<EventMeta | null>(null);
  const [containers, setContainers] = useState<ContainerWithItems[]>([]);
  const [looseItems, setLooseItems] = useState<LooseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingContainer, setLoadingContainer] = useState<Set<number>>(new Set());
  const [togglingItem, setTogglingItem] = useState<Set<number>>(new Set());
  const [expandedContainerId, setExpandedContainerId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const [evRes, containersRes, looseRes] = await Promise.all([
      supabase.from("star_party_event").select("name").eq("event_id", id).single(),
      supabase
        .from("star_party_container")
        .select(`container_id, name, description, number, star_party_container_type(name), star_party_plan_item(plan_item_id, loaded, status, star_party_item(name))`)
        .eq("event_id", id)
        .order("container_type_id")
        .order("number"),
      supabase
        .from("star_party_plan_item")
        .select("plan_item_id, loaded, star_party_item(name)")
        .eq("event_id", id)
        .eq("status", "packed")
        .is("container_id", null),
    ]);
    setEvent(evRes.data as EventMeta ?? null);
    setContainers((containersRes.data as unknown as ContainerWithItems[]) ?? []);
    setLooseItems((looseRes.data as unknown as LooseItem[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function toggleContainer(c: ContainerWithItems) {
    const packedItems = c.star_party_plan_item.filter(p => p.status === "packed");
    const itemIds = packedItems.map(p => p.plan_item_id);
    if (itemIds.length === 0) return;
    const allLoaded = packedItems.every(p => p.loaded);
    const newLoaded = !allLoaded;
    setLoadingContainer(prev => new Set(prev).add(c.container_id));

    // Optimistic
    setContainers(prev => prev.map(con =>
      con.container_id === c.container_id
        ? { ...con, star_party_plan_item: con.star_party_plan_item.map(p => ({ ...p, loaded: newLoaded })) }
        : con
    ));

    const { error } = await supabase
      .from("star_party_plan_item")
      .update({ loaded: newLoaded })
      .in("plan_item_id", itemIds);
    if (error) {
      alert(error.message);
      // Revert
      setContainers(prev => prev.map(con =>
        con.container_id === c.container_id
          ? { ...con, star_party_plan_item: c.star_party_plan_item }
          : con
      ));
    }
    setLoadingContainer(prev => { const n = new Set(prev); n.delete(c.container_id); return n; });
  }

  async function resetToPick(planItemIds: number[]) {
    const { error } = await supabase
      .from("star_party_plan_item")
      .update({ status: "to_pick", container_id: null, loaded: false })
      .in("plan_item_id", planItemIds);
    if (error) { alert(error.message); return; }
    await load();
  }

  async function toggleLooseItem(item: LooseItem) {
    const newLoaded = !item.loaded;
    setTogglingItem(prev => new Set(prev).add(item.plan_item_id));

    // Optimistic
    setLooseItems(prev => prev.map(li =>
      li.plan_item_id === item.plan_item_id ? { ...li, loaded: newLoaded } : li
    ));

    const { error } = await supabase
      .from("star_party_plan_item")
      .update({ loaded: newLoaded })
      .eq("plan_item_id", item.plan_item_id);
    if (error) {
      alert(error.message);
      // Revert
      setLooseItems(prev => prev.map(li =>
        li.plan_item_id === item.plan_item_id ? { ...li, loaded: item.loaded } : li
      ));
    }
    setTogglingItem(prev => { const n = new Set(prev); n.delete(item.plan_item_id); return n; });
  }

  if (loading) return <main style={{ padding: 16 }}><p style={{ opacity: 0.6 }}>Loading…</p></main>;

  // Only count packed items (status='packed') in containers
  const totalItems =
    containers.reduce((sum, c) => sum + c.star_party_plan_item.filter(p => p.status === "packed").length, 0) +
    looseItems.length;
  const loadedItems =
    containers.reduce((sum, c) => sum + c.star_party_plan_item.filter(p => p.status === "packed" && p.loaded).length, 0) +
    looseItems.filter(li => li.loaded).length;

  const hasAnything = containers.some(c => c.star_party_plan_item.some(p => p.status === "packed")) || looseItems.length > 0;

  return (
    <main style={{ padding: "16px", maxWidth: 600, margin: "0 auto", paddingBottom: 40 }}>
      <div style={{ marginBottom: 14 }}>
        <Link href={`/star-party/events/${id}`} style={{ fontSize: 13, opacity: 0.6, textDecoration: "none" }}>← Required Items</Link>
      </div>

      <h1 style={{ marginBottom: 2 }}>To Load</h1>
      {event && <p style={{ fontSize: 13, opacity: 0.55, marginTop: 4, marginBottom: 16 }}>{event.name}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 20 }}>
        <Link href={`/star-party/events/${id}`} style={tabStyle(false)}>Required</Link>
        <Link href={`/star-party/events/${id}/pick`} style={tabStyle(false)}>To Pick</Link>
        <Link href={`/star-party/events/${id}/pack`} style={tabStyle(false)}>To Pack</Link>
        <span style={tabStyle(true)}>To Load</span>
        <Link href={`/star-party/events/${id}/off-plan`} style={tabStyle(false)}>Off Plan</Link>
      </div>

      {!hasAnything ? (
        <div style={{ textAlign: "center", padding: "48px 20px" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📦</div>
          <p style={{ fontSize: 16, fontWeight: 600, margin: "0 0 6px" }}>Nothing to load yet</p>
          <p style={{ fontSize: 13, opacity: 0.55, margin: 0 }}>Pack your items first, then come back here to load them into the car.</p>
        </div>
      ) : (
        <>
          {/* Summary bar */}
          <div style={{
            borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)",
            background: loadedItems === totalItems && totalItems > 0
              ? "rgba(34,197,94,0.12)"
              : "rgba(255,255,255,0.04)",
            padding: "14px 16px", marginBottom: 20,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: loadedItems === totalItems && totalItems > 0 ? "#86efac" : "white" }}>
                {loadedItems} / {totalItems}
              </div>
              <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>items loaded into car</div>
            </div>
            {loadedItems === totalItems && totalItems > 0 && (
              <div style={{ fontSize: 28 }}>✓</div>
            )}
          </div>

          {/* Container cards */}
          {containers.some(c => c.star_party_plan_item.some(p => p.status === "packed")) && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#93c5fd", letterSpacing: "0.06em", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                Containers
              </div>
              {containers.map(c => {
                const packedPlanItems = c.star_party_plan_item.filter(p => p.status === "packed");
                if (packedPlanItems.length === 0) return null;
                const total = packedPlanItems.length;
                const loaded = packedPlanItems.filter(p => p.loaded).length;
                const allLoaded = total > 0 && loaded === total;
                const isBusy = loadingContainer.has(c.container_id);
                const isOpen = expandedContainerId === c.container_id;
                return (
                  <div
                    key={c.container_id}
                    style={{
                      borderRadius: 10,
                      border: `1px solid ${allLoaded ? "rgba(34,197,94,0.35)" : "rgba(255,255,255,0.12)"}`,
                      background: allLoaded ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.04)",
                      marginBottom: 10, overflow: "hidden",
                    }}
                  >
                    {/* Card header — tappable to expand */}
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", cursor: "pointer" }}
                      onClick={() => setExpandedContainerId(isOpen ? null : c.container_id)}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 600 }}>{c.name}</div>
                        {c.description && (
                          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 1 }}>{c.description}</div>
                        )}
                        <div style={{ fontSize: 12, opacity: 0.5, marginTop: 2 }}>
                          {loaded} / {total} item{total !== 1 ? "s" : ""} loaded
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); if (!isBusy) toggleContainer(c); }}
                        disabled={isBusy}
                        style={{
                          padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                          border: allLoaded ? "1px solid rgba(34,197,94,0.4)" : "none",
                          cursor: isBusy ? "default" : "pointer",
                          background: allLoaded ? "rgba(34,197,94,0.15)" : "#3b82f6",
                          color: allLoaded ? "#86efac" : "white",
                          opacity: isBusy ? 0.6 : 1,
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {isBusy ? "Updating…" : allLoaded ? "Loaded ✓" : "Load into Car"}
                      </button>
                      <span style={{ fontSize: 16, opacity: 0.4, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}>›</span>
                    </div>

                    {/* Drill-down: items in this container */}
                    {isOpen && (
                      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                        {packedPlanItems
                          .slice()
                          .sort((a, b) => a.star_party_item.name.localeCompare(b.star_party_item.name))
                          .map(p => (
                            <div key={p.plan_item_id} style={{
                              display: "flex", alignItems: "center", gap: 12,
                              padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)",
                            }}>
                              <div style={{
                                width: 22, height: 22, borderRadius: 5, flexShrink: 0,
                                border: `2px solid ${p.loaded ? "#22c55e" : "rgba(255,255,255,0.3)"}`,
                                background: p.loaded ? "rgba(34,197,94,0.25)" : "transparent",
                                display: "flex", alignItems: "center", justifyContent: "center",
                              }}>
                                {p.loaded && <span style={{ color: "#86efac", fontSize: 12, fontWeight: 700 }}>✓</span>}
                              </div>
                              <span style={{ fontSize: 14, flex: 1, opacity: p.loaded ? 0.55 : 1, textDecoration: p.loaded ? "line-through" : "none" }}>
                                {p.star_party_item.name}
                              </span>
                            </div>
                          ))}
                        <div style={{ padding: "8px 14px" }}>
                          <button
                            onClick={() => resetToPick(packedPlanItems.map(p => p.plan_item_id))}
                            disabled={isBusy}
                            style={{
                              padding: "6px 0", fontSize: 12,
                              background: "none", border: "none", color: "#f87171",
                              cursor: "pointer", opacity: 0.75, textAlign: "left",
                            }}
                          >
                            ↩ Return all to pick list
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Loose items */}
          {looseItems.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24", letterSpacing: "0.06em", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                Loose Items ({looseItems.length})
              </div>
              {looseItems.map(li => {
                const isBusy = togglingItem.has(li.plan_item_id);
                return (
                  <div
                    key={li.plan_item_id}
                    style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "13px 4px", borderBottom: "1px solid rgba(255,255,255,0.07)",
                      minHeight: 52, opacity: isBusy ? 0.5 : 1,
                    }}
                  >
                    {/* Tap checkbox/name to toggle loaded */}
                    <div
                      onClick={() => !isBusy && toggleLooseItem(li)}
                      style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, cursor: isBusy ? "default" : "pointer", userSelect: "none", WebkitTapHighlightColor: "transparent" }}
                    >
                      <div style={{
                        width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                        border: `2px solid ${li.loaded ? "#22c55e" : "rgba(255,255,255,0.3)"}`,
                        background: li.loaded ? "rgba(34,197,94,0.25)" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {li.loaded && <span style={{ color: "#86efac", fontSize: 14, fontWeight: 700 }}>✓</span>}
                      </div>
                      <span style={{ fontSize: 15, textDecoration: li.loaded ? "line-through" : "none", opacity: li.loaded ? 0.55 : 1 }}>
                        {li.star_party_item.name}
                      </span>
                    </div>
                    {/* Reset to pick list */}
                    <button
                      onClick={() => !isBusy && resetToPick([li.plan_item_id])}
                      disabled={isBusy}
                      title="Return to pick list"
                      style={{ background: "none", border: "none", color: "#f87171", fontSize: 18, cursor: "pointer", padding: "4px 6px", flexShrink: 0, opacity: 0.75 }}
                    >
                      ↩
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
}
