"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type PickedItem = {
  plan_item_id: number;
  star_party_item: { item_id: number; name: string; category: string; sub_category: string | null };
};

type PackedItem = {
  plan_item_id: number;
  container_id: number | null;
  star_party_item: { name: string };
};

type Container = {
  container_id: number;
  container_type_id: number;
  number: number;
  name: string;
  star_party_container_type: { name: string };
};

type ContainerType = { container_type_id: number; name: string };
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

export default function ToPackPage() {
  const params = useParams();
  const id = params.id as string;

  const [event, setEvent] = useState<EventMeta | null>(null);
  const [pickedItems, setPickedItems] = useState<PickedItem[]>([]);
  const [packedItems, setPackedItems] = useState<PackedItem[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [containerTypes, setContainerTypes] = useState<ContainerType[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedContainerId, setExpandedContainerId] = useState<number | null>(null);
  const [expandedPackedItemId, setExpandedPackedItemId] = useState<number | null>(null);
  const [editingContainerId, setEditingContainerId] = useState<number | null>(null);
  const [containerNameDraft, setContainerNameDraft] = useState("");
  const [packing, setPacking] = useState<Set<number>>(new Set());

  async function loadPacked() {
    const [packedRes, containersRes] = await Promise.all([
      supabase
        .from("star_party_plan_item")
        .select("plan_item_id, container_id, star_party_item(name)")
        .eq("event_id", id)
        .eq("status", "packed"),
      supabase
        .from("star_party_container")
        .select("container_id, container_type_id, number, name, star_party_container_type(name)")
        .eq("event_id", id)
        .order("container_type_id")
        .order("number"),
    ]);
    setPackedItems((packedRes.data as unknown as PackedItem[]) ?? []);
    setContainers((containersRes.data as unknown as Container[]) ?? []);
  }

  async function load() {
    setLoading(true);
    const [evRes, pickedRes, typesRes] = await Promise.all([
      supabase.from("star_party_event").select("name").eq("event_id", id).single(),
      supabase
        .from("star_party_plan_item")
        .select("plan_item_id, star_party_item(item_id, name, category, sub_category)")
        .eq("event_id", id)
        .eq("status", "picked"),
      supabase
        .from("star_party_container_type")
        .select("container_type_id, name")
        .order("sort_order"),
    ]);
    setEvent(evRes.data as EventMeta ?? null);
    setPickedItems((pickedRes.data as unknown as PickedItem[]) ?? []);
    setContainerTypes((typesRes.data as ContainerType[]) ?? []);
    await loadPacked();
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function createContainer(typeId: number, typeName: string): Promise<number | null> {
    const { data: maxData } = await supabase
      .from("star_party_container")
      .select("number")
      .eq("event_id", Number(id))
      .eq("container_type_id", typeId)
      .order("number", { ascending: false })
      .limit(1);
    const nextNum = (maxData?.[0]?.number ?? 0) + 1;
    const { data, error } = await supabase
      .from("star_party_container")
      .insert({ event_id: Number(id), container_type_id: typeId, number: nextNum, name: `${typeName} ${nextNum}` })
      .select("container_id")
      .single();
    if (error) { alert(error.message); return null; }
    return data.container_id;
  }

  async function resetToPick(planItemId: number) {
    setPickedItems(prev => prev.filter(p => p.plan_item_id !== planItemId));
    setExpandedId(null);
    const { error } = await supabase
      .from("star_party_plan_item")
      .update({ status: "to_pick", container_id: null, loaded: false })
      .eq("plan_item_id", planItemId);
    if (error) { alert(error.message); await load(); }
  }

  async function packItem(planItemId: number, containerId: number | null) {
    setPacking(prev => new Set(prev).add(planItemId));
    setPickedItems(prev => prev.filter(p => p.plan_item_id !== planItemId));
    setExpandedId(null);
    const { error } = await supabase
      .from("star_party_plan_item")
      .update({ status: "packed", container_id: containerId })
      .eq("plan_item_id", planItemId);
    if (error) { alert(error.message); }
    await loadPacked();
    setPacking(prev => { const n = new Set(prev); n.delete(planItemId); return n; });
  }

  async function handleChipTap(planItemId: number, chip: "loose" | { containerId: number } | { typeId: number; typeName: string }) {
    if (chip === "loose") {
      await packItem(planItemId, null);
    } else if ("containerId" in chip) {
      await packItem(planItemId, chip.containerId);
    } else {
      // New container
      const newId = await createContainer(chip.typeId, chip.typeName);
      if (newId !== null) {
        await packItem(planItemId, newId);
      }
    }
  }

  async function saveContainerName(containerId: number, name: string) {
    if (!name.trim()) return;
    await supabase.from("star_party_container").update({ name: name.trim() }).eq("container_id", containerId);
    setContainers(prev => prev.map(c => c.container_id === containerId ? { ...c, name: name.trim() } : c));
  }

  async function reassignItem(planItemId: number, chip: "loose" | { containerId: number } | { typeId: number; typeName: string }) {
    setExpandedPackedItemId(null);
    let newContainerId: number | null = null;
    if (chip === "loose") {
      newContainerId = null;
    } else if ("containerId" in chip) {
      newContainerId = chip.containerId;
    } else {
      const newId = await createContainer(chip.typeId, chip.typeName);
      if (newId === null) return;
      newContainerId = newId;
    }
    const { error } = await supabase
      .from("star_party_plan_item")
      .update({ container_id: newContainerId })
      .eq("plan_item_id", planItemId);
    if (error) { alert(error.message); }
    await loadPacked();
  }

  if (loading) return <main style={{ padding: 16 }}><p style={{ opacity: 0.6 }}>Loading…</p></main>;

  // Group packed items by container_id
  const loosePackedItems = packedItems.filter(p => p.container_id === null);
  const itemsByContainer: Record<number, PackedItem[]> = {};
  for (const pi of packedItems) {
    if (pi.container_id !== null) {
      if (!itemsByContainer[pi.container_id]) itemsByContainer[pi.container_id] = [];
      itemsByContainer[pi.container_id].push(pi);
    }
  }

  return (
    <main style={{ padding: "16px", maxWidth: 600, margin: "0 auto", paddingBottom: 40 }}>
      <div style={{ marginBottom: 14 }}>
        <Link href={`/star-party/events/${id}`} style={{ fontSize: 13, opacity: 0.6, textDecoration: "none" }}>← Required Items</Link>
      </div>

      <h1 style={{ marginBottom: 2 }}>To Pack</h1>
      {event && <p style={{ fontSize: 13, opacity: 0.55, marginTop: 4, marginBottom: 16 }}>{event.name}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 20 }}>
        <Link href={`/star-party/events/${id}`} style={tabStyle(false)}>Required</Link>
        <Link href={`/star-party/events/${id}/pick`} style={tabStyle(false)}>To Pick</Link>
        <span style={tabStyle(true)}>To Pack</span>
        <Link href={`/star-party/events/${id}/load`} style={tabStyle(false)}>To Load</Link>
        <Link href={`/star-party/events/${id}/off-plan`} style={tabStyle(false)}>Off Plan</Link>
      </div>

      {/* TO PACK SECTION */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#93c5fd", letterSpacing: "0.06em", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          To Pack ({pickedItems.length})
        </div>

        {pickedItems.length === 0 ? (
          <div style={{ padding: "24px 0", textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
            <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>All items packed!</p>
            <p style={{ fontSize: 13, opacity: 0.55, margin: 0 }}>No picked items waiting to be packed.</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13, opacity: 0.55, marginBottom: 12 }}>
              Tap an item to choose where to pack it.
            </p>
            {pickedItems.map(pi => {
              const isExpanded = expandedId === pi.plan_item_id;
              const isBusy = packing.has(pi.plan_item_id);
              return (
                <div key={pi.plan_item_id}>
                  <div
                    onClick={() => !isBusy && setExpandedId(isExpanded ? null : pi.plan_item_id)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "13px 4px", borderBottom: isExpanded ? "none" : "1px solid rgba(255,255,255,0.07)",
                      cursor: isBusy ? "default" : "pointer", minHeight: 52,
                      userSelect: "none", WebkitTapHighlightColor: "transparent",
                      opacity: isBusy ? 0.5 : 1,
                    }}
                  >
                    <span style={{ fontSize: 15, flex: 1 }}>{pi.star_party_item.name}</span>
                    <button
                      onClick={e => { e.stopPropagation(); resetToPick(pi.plan_item_id); }}
                      title="Return to pick list"
                      style={{ background: "none", border: "none", color: "#f87171", fontSize: 18, cursor: "pointer", padding: "4px 6px", opacity: 0.75, flexShrink: 0 }}
                    >↩</button>
                    <span style={{ fontSize: 18, opacity: 0.5, transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}>›</span>
                  </div>

                  {isExpanded && (
                    <div style={{
                      padding: "10px 4px 14px",
                      borderBottom: "1px solid rgba(255,255,255,0.07)",
                      overflowX: "auto",
                    }}>
                      <div style={{ display: "flex", gap: 8, paddingBottom: 4, minWidth: "max-content" }}>
                        {/* Pack Loose */}
                        <button
                          onClick={() => handleChipTap(pi.plan_item_id, "loose")}
                          style={{
                            padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600,
                            border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.08)",
                            color: "white", cursor: "pointer", whiteSpace: "nowrap",
                          }}
                        >
                          Pack Loose
                        </button>

                        {/* Existing containers */}
                        {containers.map(c => (
                          <button
                            key={c.container_id}
                            onClick={() => handleChipTap(pi.plan_item_id, { containerId: c.container_id })}
                            style={{
                              padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600,
                              border: "1px solid rgba(99,179,237,0.5)", background: "rgba(59,130,246,0.15)",
                              color: "#93c5fd", cursor: "pointer", whiteSpace: "nowrap",
                            }}
                          >
                            {c.name}
                          </button>
                        ))}

                        {/* New container buttons per type */}
                        {containerTypes.map(ct => (
                          <button
                            key={ct.container_type_id}
                            onClick={() => handleChipTap(pi.plan_item_id, { typeId: ct.container_type_id, typeName: ct.name })}
                            style={{
                              padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600,
                              border: "1px dashed rgba(134,239,172,0.5)", background: "rgba(34,197,94,0.1)",
                              color: "#86efac", cursor: "pointer", whiteSpace: "nowrap",
                            }}
                          >
                            + New {ct.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* PACKED SECTION */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#86efac", letterSpacing: "0.06em", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          Packed ({packedItems.length})
        </div>

        {packedItems.length === 0 ? (
          <p style={{ fontSize: 13, opacity: 0.5, padding: "8px 0" }}>Nothing packed yet.</p>
        ) : (
          <>
            {/* Container cards */}
            {containers.map(c => {
              const cItems = itemsByContainer[c.container_id] ?? [];
              const isEditingName = editingContainerId === c.container_id;
              const isOpen = expandedContainerId === c.container_id;
              return (
                <div
                  key={c.container_id}
                  style={{
                    borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.04)", marginBottom: 10, overflow: "hidden",
                  }}
                >
                  {/* Card header */}
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", cursor: "pointer" }}
                    onClick={() => {
                      if (isEditingName) return;
                      setExpandedContainerId(isOpen ? null : c.container_id);
                      setExpandedPackedItemId(null);
                    }}
                  >
                    {isEditingName ? (
                      <input
                        autoFocus
                        value={containerNameDraft}
                        onClick={e => e.stopPropagation()}
                        onChange={e => setContainerNameDraft(e.target.value)}
                        onBlur={() => { saveContainerName(c.container_id, containerNameDraft); setEditingContainerId(null); }}
                        onKeyDown={e => {
                          if (e.key === "Enter") { saveContainerName(c.container_id, containerNameDraft); setEditingContainerId(null); }
                          else if (e.key === "Escape") setEditingContainerId(null);
                        }}
                        style={{ flex: 1, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(59,130,246,0.5)", borderRadius: 6, padding: "4px 8px", color: "white", fontSize: 15, fontWeight: 600, outline: "none" }}
                      />
                    ) : (
                      <span style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>{c.name}</span>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); setEditingContainerId(c.container_id); setContainerNameDraft(c.name); }}
                      title="Rename"
                      style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", color: "rgba(255,255,255,0.45)", fontSize: 14, flexShrink: 0 }}
                    >✏️</button>
                    <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: "rgba(34,197,94,0.2)", color: "#86efac", flexShrink: 0 }}>
                      {cItems.length} item{cItems.length !== 1 ? "s" : ""}
                    </span>
                    <span style={{ fontSize: 16, opacity: 0.4, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}>›</span>
                  </div>

                  {/* Expanded items */}
                  {isOpen && (
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      {cItems.length === 0 ? (
                        <p style={{ fontSize: 12, opacity: 0.45, margin: "10px 14px 10px", fontStyle: "italic" }}>
                          No items yet — tap an item in &ldquo;To Pack&rdquo; above and select this container.
                        </p>
                      ) : (
                        <p style={{ fontSize: 12, opacity: 0.5, margin: "8px 14px 4px" }}>Tap an item to move it.</p>
                      )}
                      {cItems.map(pi => {
                        const itemExpanded = expandedPackedItemId === pi.plan_item_id;
                        return (
                          <div key={pi.plan_item_id}>
                            <div
                              onClick={() => setExpandedPackedItemId(itemExpanded ? null : pi.plan_item_id)}
                              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", minHeight: 48, userSelect: "none" }}
                            >
                              <span style={{ fontSize: 14 }}>{pi.star_party_item.name}</span>
                              <span style={{ fontSize: 16, opacity: 0.4, transform: itemExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>›</span>
                            </div>
                            {itemExpanded && (
                              <div style={{ padding: "10px 14px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", overflowX: "auto" }}>
                                <div style={{ display: "flex", gap: 8, paddingBottom: 4, minWidth: "max-content" }}>
                                  <button onClick={() => reassignItem(pi.plan_item_id, "loose")}
                                    style={{ padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.08)", color: "white", cursor: "pointer", whiteSpace: "nowrap" }}>
                                    Loose
                                  </button>
                                  {containers.filter(oc => oc.container_id !== c.container_id).map(oc => (
                                    <button key={oc.container_id} onClick={() => reassignItem(pi.plan_item_id, { containerId: oc.container_id })}
                                      style={{ padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600, border: "1px solid rgba(99,179,237,0.5)", background: "rgba(59,130,246,0.15)", color: "#93c5fd", cursor: "pointer", whiteSpace: "nowrap" }}>
                                      {oc.name}
                                    </button>
                                  ))}
                                  {containerTypes.map(ct => (
                                    <button key={ct.container_type_id} onClick={() => reassignItem(pi.plan_item_id, { typeId: ct.container_type_id, typeName: ct.name })}
                                      style={{ padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600, border: "1px dashed rgba(134,239,172,0.5)", background: "rgba(34,197,94,0.1)", color: "#86efac", cursor: "pointer", whiteSpace: "nowrap" }}>
                                      + New {ct.name}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Loose items */}
            {loosePackedItems.length > 0 && (
              <div style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", marginBottom: 10, overflow: "hidden" }}>
                <div
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", cursor: "pointer" }}
                  onClick={() => { setExpandedContainerId(expandedContainerId === -1 ? null : -1); setExpandedPackedItemId(null); }}
                >
                  <span style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>Loose Items</span>
                  <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: "rgba(251,191,36,0.2)", color: "#fbbf24", flexShrink: 0 }}>
                    {loosePackedItems.length} item{loosePackedItems.length !== 1 ? "s" : ""}
                  </span>
                  <span style={{ fontSize: 16, opacity: 0.4, transform: expandedContainerId === -1 ? "rotate(90deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}>›</span>
                </div>
                {expandedContainerId === -1 && (
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <p style={{ fontSize: 12, opacity: 0.5, margin: "8px 14px 4px" }}>Tap an item to assign it to a container.</p>
                    {loosePackedItems.map(pi => {
                      const itemExpanded = expandedPackedItemId === pi.plan_item_id;
                      return (
                        <div key={pi.plan_item_id}>
                          <div
                            onClick={() => setExpandedPackedItemId(itemExpanded ? null : pi.plan_item_id)}
                            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", minHeight: 48, userSelect: "none" }}
                          >
                            <span style={{ fontSize: 14 }}>{pi.star_party_item.name}</span>
                            <span style={{ fontSize: 16, opacity: 0.4, transform: itemExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>›</span>
                          </div>
                          {itemExpanded && (
                            <div style={{ padding: "10px 14px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", overflowX: "auto" }}>
                              <div style={{ display: "flex", gap: 8, paddingBottom: 4, minWidth: "max-content" }}>
                                {containers.map(c => (
                                  <button key={c.container_id} onClick={() => reassignItem(pi.plan_item_id, { containerId: c.container_id })}
                                    style={{ padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600, border: "1px solid rgba(99,179,237,0.5)", background: "rgba(59,130,246,0.15)", color: "#93c5fd", cursor: "pointer", whiteSpace: "nowrap" }}>
                                    {c.name}
                                  </button>
                                ))}
                                {containerTypes.map(ct => (
                                  <button key={ct.container_type_id} onClick={() => reassignItem(pi.plan_item_id, { typeId: ct.container_type_id, typeName: ct.name })}
                                    style={{ padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600, border: "1px dashed rgba(134,239,172,0.5)", background: "rgba(34,197,94,0.1)", color: "#86efac", cursor: "pointer", whiteSpace: "nowrap" }}>
                                    + New {ct.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
