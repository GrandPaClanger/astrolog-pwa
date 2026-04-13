"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type ContainerItem = {
  plan_item_id: number;
  container_id: number;
  star_party_item: { name: string };
};

type AvailableItem = {
  plan_item_id: number;
  star_party_item: { name: string };
};

type Container = {
  container_id: number;
  container_type_id: number;
  number: number;
  name: string;
  description: string | null;
  star_party_container_type: { name: string };
  items: ContainerItem[];
};

type ContainerType = { container_type_id: number; name: string };
type EventMeta = { name: string };

function sortContainers(cs: Container[]): Container[] {
  return [...cs].sort((a, b) => {
    if (a.name === "Loose" && b.name !== "Loose") return 1;
    if (b.name === "Loose" && a.name !== "Loose") return -1;
    return a.container_type_id - b.container_type_id || a.number - b.number;
  });
}

export default function ManageContainersPage() {
  const params = useParams();
  const id = params.id as string;

  const [event, setEvent] = useState<EventMeta | null>(null);
  const [containers, setContainers] = useState<Container[]>([]);
  const [containerTypes, setContainerTypes] = useState<ContainerType[]>([]);
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [addingToId, setAddingToId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState<Set<number>>(new Set());
  const [descDraft, setDescDraft] = useState<Record<number, string>>({});
  const [savingDesc, setSavingDesc] = useState<Set<number>>(new Set());
  const [removingItem, setRemovingItem] = useState<Set<number>>(new Set());
  const [addingItem, setAddingItem] = useState<Set<number>>(new Set());
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [creatingType, setCreatingType] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const [evRes, containersRes, typesRes, pickedRes] = await Promise.all([
      supabase.from("star_party_event").select("name").eq("event_id", id).single(),
      supabase
        .from("star_party_container")
        .select("container_id, container_type_id, number, name, description, star_party_container_type(name)")
        .eq("event_id", id)
        .order("container_type_id")
        .order("number"),
      supabase
        .from("star_party_container_type")
        .select("container_type_id, name")
        .order("sort_order"),
      supabase
        .from("star_party_plan_item")
        .select("plan_item_id, container_id, star_party_item(name)")
        .eq("event_id", id)
        .eq("status", "packed")
        .not("container_id", "is", null),
    ]);

    const rawContainers = (containersRes.data ?? []) as unknown as Omit<Container, "items">[];
    const rawItems = (pickedRes.data ?? []) as unknown as (ContainerItem)[];

    const itemsByContainer: Record<number, ContainerItem[]> = {};
    for (const item of rawItems) {
      if (!itemsByContainer[item.container_id]) itemsByContainer[item.container_id] = [];
      itemsByContainer[item.container_id].push(item);
    }

    setEvent(evRes.data as EventMeta ?? null);
    setContainerTypes((typesRes.data as ContainerType[]) ?? []);

    // Available items = picked (not yet packed)
    const { data: pickedItemsData } = await supabase
      .from("star_party_plan_item")
      .select("plan_item_id, star_party_item(name)")
      .eq("event_id", id)
      .eq("status", "picked");
    setAvailableItems(
      ((pickedItemsData ?? []) as unknown as AvailableItem[]).sort((a, b) =>
        a.star_party_item.name.localeCompare(b.star_party_item.name)
      )
    );

    setContainers(sortContainers(rawContainers.map(c => ({
      ...c,
      items: (itemsByContainer[c.container_id] ?? []).sort((a, b) =>
        a.star_party_item.name.localeCompare(b.star_party_item.name)
      ),
    }))));
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function createContainer(typeId: number, typeName: string) {
    setCreatingType(typeId);
    // Max among non-Loose containers of this type
    const { data: maxData } = await supabase
      .from("star_party_container")
      .select("number")
      .eq("event_id", Number(id))
      .eq("container_type_id", typeId)
      .neq("name", "Loose")
      .order("number", { ascending: false })
      .limit(1);
    const nextNum = (maxData?.[0]?.number ?? 0) + 1;
    const { error } = await supabase
      .from("star_party_container")
      .insert({ event_id: Number(id), container_type_id: typeId, number: nextNum, name: `${typeName} ${nextNum}` });
    if (error) { alert(error.message); }
    else { await load(); }
    setCreatingType(null);
  }

  async function saveName(containerId: number) {
    const trimmed = nameDraft.trim();
    if (!trimmed) { setEditingId(null); return; }
    setSavingName(prev => new Set(prev).add(containerId));
    const { error } = await supabase
      .from("star_party_container")
      .update({ name: trimmed })
      .eq("container_id", containerId);
    if (error) { alert(error.message); }
    else {
      setContainers(prev => sortContainers(prev.map(c =>
        c.container_id === containerId ? { ...c, name: trimmed } : c
      )));
    }
    setSavingName(prev => { const n = new Set(prev); n.delete(containerId); return n; });
    setEditingId(null);
  }

  async function saveDescription(containerId: number, value: string) {
    const trimmed = value.trim();
    setSavingDesc(prev => new Set(prev).add(containerId));
    await supabase
      .from("star_party_container")
      .update({ description: trimmed || null })
      .eq("container_id", containerId);
    setContainers(prev => prev.map(c =>
      c.container_id === containerId ? { ...c, description: trimmed || null } : c
    ));
    setSavingDesc(prev => { const n = new Set(prev); n.delete(containerId); return n; });
  }

  async function removeItem(planItemId: number, containerId: number) {
    setRemovingItem(prev => new Set(prev).add(planItemId));
    // Optimistic
    setContainers(prev => prev.map(c =>
      c.container_id === containerId
        ? { ...c, items: c.items.filter(i => i.plan_item_id !== planItemId) }
        : c
    ));
    const { error } = await supabase
      .from("star_party_plan_item")
      .update({ container_id: null })
      .eq("plan_item_id", planItemId);
    if (error) { alert(error.message); await load(); }
    setRemovingItem(prev => { const n = new Set(prev); n.delete(planItemId); return n; });
  }

  async function addItem(planItemId: number, containerId: number, itemName: string) {
    setAddingItem(prev => new Set(prev).add(planItemId));
    // Optimistic: add to container items, remove from available
    setAvailableItems(prev => prev.filter(i => i.plan_item_id !== planItemId));
    setContainers(prev => prev.map(c =>
      c.container_id === containerId
        ? {
            ...c,
            items: [...c.items, { plan_item_id: planItemId, container_id: containerId, star_party_item: { name: itemName } }]
              .sort((a, b) => a.star_party_item.name.localeCompare(b.star_party_item.name)),
          }
        : c
    ));
    const { error } = await supabase
      .from("star_party_plan_item")
      .update({ status: "packed", container_id: containerId })
      .eq("plan_item_id", planItemId);
    if (error) { alert(error.message); await load(); }
    setAddingItem(prev => { const n = new Set(prev); n.delete(planItemId); return n; });
  }

  async function deleteContainer(containerId: number) {
    const c = containers.find(c => c.container_id === containerId);
    if (!c || c.items.length > 0) return;
    setDeletingId(containerId);
    const { error } = await supabase
      .from("star_party_container")
      .delete()
      .eq("container_id", containerId);
    if (error) {
      alert(error.message);
      setDeletingId(null);
      return;
    }
    setContainers(prev => prev.filter(c => c.container_id !== containerId));
    if (expandedId === containerId) setExpandedId(null);
    setDeletingId(null);
  }

  if (loading) return <main style={{ padding: 16 }}><p style={{ opacity: 0.6 }}>Loading…</p></main>;

  return (
    <main style={{ padding: "16px", maxWidth: 600, margin: "0 auto", paddingBottom: 40 }}>
      <div style={{ marginBottom: 14 }}>
        <Link href={`/star-party/events/${id}/pack`} style={{ fontSize: 13, opacity: 0.6, textDecoration: "none" }}>← To Pack</Link>
      </div>

      <h1 style={{ marginBottom: 2 }}>Manage Containers</h1>
      {event && <p style={{ fontSize: 13, opacity: 0.55, marginTop: 4, marginBottom: 20 }}>{event.name}</p>}

      {/* New container buttons */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 8, fontWeight: 600, letterSpacing: "0.05em" }}>CREATE NEW</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {containerTypes.map(ct => (
            <button
              key={ct.container_type_id}
              onClick={() => createContainer(ct.container_type_id, ct.name)}
              disabled={creatingType === ct.container_type_id}
              style={{
                padding: "9px 20px", borderRadius: 8, fontSize: 14, fontWeight: 600,
                border: "1px dashed rgba(134,239,172,0.5)", background: "rgba(34,197,94,0.08)",
                color: "#86efac", cursor: creatingType ? "default" : "pointer",
                opacity: creatingType === ct.container_type_id ? 0.5 : 1,
              }}
            >
              {creatingType === ct.container_type_id ? "Creating…" : `+ New ${ct.name}`}
            </button>
          ))}
        </div>
      </div>

      {containers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 20px" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📦</div>
          <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>No containers yet</p>
          <p style={{ fontSize: 13, opacity: 0.55, margin: 0 }}>Use the buttons above to create one.</p>
        </div>
      ) : (
        <div>
          {containers.map(c => {
            const isOpen = expandedId === c.container_id;
            const isEditing = editingId === c.container_id;
            const isSaving = savingName.has(c.container_id);
            const isDeleting = deletingId === c.container_id;
            const isEmpty = c.items.length === 0;
            const isAdding = addingToId === c.container_id;
            const isLoose = c.name === "Loose";

            return (
              <div
                key={c.container_id}
                style={{
                  borderRadius: 10,
                  border: isLoose ? "1px solid rgba(255,255,255,0.18)" : "1px solid rgba(255,255,255,0.12)",
                  background: isLoose ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.04)",
                  marginBottom: 12, overflow: "hidden",
                }}
              >
                {/* Header */}
                <div
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: isEditing ? "default" : "pointer" }}
                  onClick={() => {
                    if (!isEditing) {
                      const opening = !isOpen;
                      setExpandedId(opening ? c.container_id : null);
                      if (opening) setDescDraft(prev => ({ ...prev, [c.container_id]: c.description ?? "" }));
                    }
                  }}
                >
                  {isEditing ? (
                    <input
                      autoFocus
                      value={nameDraft}
                      onClick={e => e.stopPropagation()}
                      onChange={e => setNameDraft(e.target.value)}
                      onBlur={() => saveName(c.container_id)}
                      onKeyDown={e => {
                        if (e.key === "Enter") saveName(c.container_id);
                        else if (e.key === "Escape") setEditingId(null);
                      }}
                      disabled={isSaving}
                      style={{
                        flex: 1, background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(59,130,246,0.5)", borderRadius: 6,
                        padding: "4px 8px", color: "white", fontSize: 15, fontWeight: 600, outline: "none",
                      }}
                    />
                  ) : (
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>
                        {c.name}
                        {isLoose && <span style={{ fontSize: 11, opacity: 0.45, marginLeft: 8, fontWeight: 400 }}>default</span>}
                      </div>
                      {c.description && (
                        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 1 }}>{c.description}</div>
                      )}
                      <div style={{ fontSize: 11, opacity: 0.4, marginTop: 1 }}>
                        {c.star_party_container_type.name} · {c.items.length} item{c.items.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                  )}

                  {!isEditing && (
                    <>
                      <button
                        onClick={e => { e.stopPropagation(); setEditingId(c.container_id); setNameDraft(c.name); }}
                        title="Rename"
                        style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 6px", color: "rgba(255,255,255,0.5)", fontSize: 15, flexShrink: 0 }}
                      >✏️</button>

                      {!isLoose && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            if (!isEmpty) return;
                            if (confirm(`Delete "${c.name}"? This cannot be undone.`)) {
                              deleteContainer(c.container_id);
                            }
                          }}
                          disabled={!isEmpty || isDeleting}
                          title={isEmpty ? "Delete container" : "Remove all items first to delete"}
                          style={{
                            background: "none", border: "none",
                            cursor: isEmpty ? "pointer" : "not-allowed",
                            padding: "4px 6px", fontSize: 15, flexShrink: 0,
                            color: isEmpty ? "#f87171" : "rgba(255,255,255,0.2)",
                            opacity: isDeleting ? 0.5 : 1,
                          }}
                        >🗑</button>
                      )}

                      <span style={{ fontSize: 16, opacity: 0.4, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}>›</span>
                    </>
                  )}
                </div>

                {/* Expanded body */}
                {isOpen && (
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>

                    {/* Description field */}
                    <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <label style={{ fontSize: 11, opacity: 0.5, fontWeight: 600, letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
                        DESCRIPTION
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Cooking equipment, Warm clothing…"
                        value={descDraft[c.container_id] ?? ""}
                        onChange={e => setDescDraft(prev => ({ ...prev, [c.container_id]: e.target.value }))}
                        onBlur={() => saveDescription(c.container_id, descDraft[c.container_id] ?? "")}
                        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        disabled={savingDesc.has(c.container_id)}
                        style={{
                          width: "100%", boxSizing: "border-box",
                          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)",
                          borderRadius: 8, padding: "9px 12px", color: "white", fontSize: 14,
                          outline: "none", opacity: savingDesc.has(c.container_id) ? 0.5 : 1,
                        }}
                        onFocus={e => (e.target.style.borderColor = "rgba(59,130,246,0.6)")}
                      />
                    </div>

                    {/* Items in container */}
                    {isEmpty ? (
                      <p style={{ fontSize: 13, opacity: 0.45, margin: "12px 14px 4px", fontStyle: "italic" }}>
                        This container is empty.
                      </p>
                    ) : (
                      <>
                        <p style={{ fontSize: 12, opacity: 0.45, margin: "8px 14px 2px" }}>
                          Removing an item sends it back to To Pack.
                        </p>
                        {c.items.map(item => {
                          const isBusy = removingItem.has(item.plan_item_id);
                          return (
                            <div
                              key={item.plan_item_id}
                              style={{
                                display: "flex", alignItems: "center", gap: 12,
                                padding: "11px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)",
                                opacity: isBusy ? 0.4 : 1,
                              }}
                            >
                              <span style={{ fontSize: 14, flex: 1 }}>{item.star_party_item.name}</span>
                              <button
                                onClick={() => !isBusy && removeItem(item.plan_item_id, c.container_id)}
                                disabled={isBusy}
                                style={{
                                  background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
                                  borderRadius: 6, color: "#f87171", fontSize: 12, fontWeight: 600,
                                  padding: "4px 10px", cursor: isBusy ? "default" : "pointer",
                                  flexShrink: 0, whiteSpace: "nowrap",
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          );
                        })}
                      </>
                    )}

                    {/* Add items toggle */}
                    {availableItems.length > 0 && (
                      <div style={{ padding: "10px 14px", borderTop: isEmpty ? "none" : "1px solid rgba(255,255,255,0.06)" }}>
                        <button
                          onClick={() => setAddingToId(isAdding ? null : c.container_id)}
                          style={{
                            padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                            border: "1px dashed rgba(99,179,237,0.5)",
                            background: isAdding ? "rgba(59,130,246,0.15)" : "transparent",
                            color: "#93c5fd", cursor: "pointer",
                          }}
                        >
                          {isAdding ? "▲ Hide" : `▼ Add items (${availableItems.length} available)`}
                        </button>
                      </div>
                    )}

                    {/* Available items list */}
                    {isAdding && (
                      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(59,130,246,0.05)" }}>
                        <p style={{ fontSize: 12, opacity: 0.5, margin: "8px 14px 4px" }}>Tap to add to {c.name}:</p>
                        {availableItems.map(item => {
                          const isBusy = addingItem.has(item.plan_item_id);
                          return (
                            <div
                              key={item.plan_item_id}
                              onClick={() => !isBusy && addItem(item.plan_item_id, c.container_id, item.star_party_item.name)}
                              style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "11px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)",
                                cursor: isBusy ? "default" : "pointer", opacity: isBusy ? 0.4 : 1,
                                userSelect: "none", WebkitTapHighlightColor: "transparent",
                              }}
                            >
                              <span style={{ fontSize: 14 }}>{item.star_party_item.name}</span>
                              <span style={{ fontSize: 13, color: "#86efac", fontWeight: 600, flexShrink: 0 }}>
                                {isBusy ? "…" : "+ Add"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
