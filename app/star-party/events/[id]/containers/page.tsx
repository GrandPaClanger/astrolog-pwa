"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type ContainerItem = {
  plan_item_id: number;
  status: string;
  star_party_item: { name: string };
};

type Container = {
  container_id: number;
  name: string;
  star_party_container_type: { name: string };
  items: ContainerItem[];
};

type EventMeta = { name: string };

export default function ManageContainersPage() {
  const params = useParams();
  const id = params.id as string;

  const [event, setEvent] = useState<EventMeta | null>(null);
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState<Set<number>>(new Set());
  const [removingItem, setRemovingItem] = useState<Set<number>>(new Set());
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const [evRes, containersRes, itemsRes] = await Promise.all([
      supabase.from("star_party_event").select("name").eq("event_id", id).single(),
      supabase
        .from("star_party_container")
        .select("container_id, name, star_party_container_type(name)")
        .eq("event_id", id)
        .order("container_type_id")
        .order("number"),
      supabase
        .from("star_party_plan_item")
        .select("plan_item_id, status, container_id, star_party_item(name)")
        .eq("event_id", id)
        .eq("status", "packed")
        .not("container_id", "is", null),
    ]);

    const rawContainers = (containersRes.data ?? []) as unknown as Omit<Container, "items">[];
    const rawItems = (itemsRes.data ?? []) as unknown as (ContainerItem & { container_id: number })[];

    const itemsByContainer: Record<number, ContainerItem[]> = {};
    for (const item of rawItems) {
      if (!itemsByContainer[item.container_id]) itemsByContainer[item.container_id] = [];
      itemsByContainer[item.container_id].push(item);
    }

    setEvent(evRes.data as EventMeta ?? null);
    setContainers(rawContainers.map(c => ({
      ...c,
      items: (itemsByContainer[c.container_id] ?? []).sort((a, b) =>
        a.star_party_item.name.localeCompare(b.star_party_item.name)
      ),
    })));
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

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
      setContainers(prev => prev.map(c =>
        c.container_id === containerId ? { ...c, name: trimmed } : c
      ));
    }
    setSavingName(prev => { const n = new Set(prev); n.delete(containerId); return n; });
    setEditingId(null);
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
    if (error) {
      alert(error.message);
      await load();
    }
    setRemovingItem(prev => { const n = new Set(prev); n.delete(planItemId); return n; });
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
      {event && <p style={{ fontSize: 13, opacity: 0.55, marginTop: 4, marginBottom: 24 }}>{event.name}</p>}

      {containers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 20px" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📦</div>
          <p style={{ fontSize: 16, fontWeight: 600, margin: "0 0 6px" }}>No containers yet</p>
          <p style={{ fontSize: 13, opacity: 0.55, margin: "0 0 20px" }}>Containers are created when you pack items on the To Pack screen.</p>
          <Link
            href={`/star-party/events/${id}/pack`}
            style={{ display: "inline-block", padding: "10px 22px", borderRadius: 8, background: "#3b82f6", color: "white", textDecoration: "none", fontSize: 14, fontWeight: 600 }}
          >
            Go to To Pack
          </Link>
        </div>
      ) : (
        <div>
          {containers.map(c => {
            const isOpen = expandedId === c.container_id;
            const isEditing = editingId === c.container_id;
            const isSaving = savingName.has(c.container_id);
            const isDeleting = deletingId === c.container_id;
            const isEmpty = c.items.length === 0;

            return (
              <div
                key={c.container_id}
                style={{
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.04)",
                  marginBottom: 12,
                  overflow: "hidden",
                }}
              >
                {/* Header */}
                <div
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: isEditing ? "default" : "pointer" }}
                  onClick={() => { if (!isEditing) setExpandedId(isOpen ? null : c.container_id); }}
                >
                  {/* Name / edit input */}
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
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: 11, opacity: 0.45, marginTop: 1 }}>
                        {c.star_party_container_type.name} · {c.items.length} item{c.items.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  {!isEditing && (
                    <>
                      {/* Rename */}
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setEditingId(c.container_id);
                          setNameDraft(c.name);
                        }}
                        title="Rename"
                        style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 6px", color: "rgba(255,255,255,0.5)", fontSize: 15, flexShrink: 0 }}
                      >
                        ✏️
                      </button>

                      {/* Delete — only enabled when empty */}
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          if (!isEmpty) return;
                          if (confirm(`Delete "${c.name}"? This cannot be undone.`)) {
                            deleteContainer(c.container_id);
                          }
                        }}
                        disabled={!isEmpty || isDeleting}
                        title={isEmpty ? "Delete container" : "Remove all items first"}
                        style={{
                          background: "none", border: "none", cursor: isEmpty ? "pointer" : "not-allowed",
                          padding: "4px 6px", fontSize: 15, flexShrink: 0,
                          color: isEmpty ? "#f87171" : "rgba(255,255,255,0.2)",
                          opacity: isDeleting ? 0.5 : 1,
                        }}
                      >
                        🗑
                      </button>

                      {/* Expand chevron */}
                      <span style={{ fontSize: 16, opacity: 0.4, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}>›</span>
                    </>
                  )}
                </div>

                {/* Item list */}
                {isOpen && (
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    {isEmpty ? (
                      <p style={{ fontSize: 13, opacity: 0.45, margin: "12px 14px", fontStyle: "italic" }}>
                        This container is empty.
                      </p>
                    ) : (
                      <>
                        <p style={{ fontSize: 12, opacity: 0.45, margin: "8px 14px 2px" }}>
                          Removing an item returns it to loose packed — reassign it on the Pack screen.
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
                                title="Remove from container"
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
