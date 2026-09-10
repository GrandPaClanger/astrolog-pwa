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
type OptionRow = { id: number; name: string };

type PlannedTarget = {
  planned_target_id: number;
  target_name: string;
  description: string | null;
  telescope_id: number | null;
  camera_id: number | null;
  mount_id: number | null;
  filter_text: string | null;
  telescope: { name: string } | null;
  camera: { name: string } | null;
  mount: { name: string } | null;
};

type PlannedTargetForm = {
  target_name: string;
  description: string;
  telescope_id: string;
  camera_id: string;
  mount_id: string;
  filter_text: string;
};

const EMPTY_TARGET_FORM: PlannedTargetForm = {
  target_name: "",
  description: "",
  telescope_id: "",
  camera_id: "",
  mount_id: "",
  filter_text: "",
};

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
  const [plannedTargets, setPlannedTargets] = useState<PlannedTarget[]>([]);
  const [telescopes, setTelescopes] = useState<OptionRow[]>([]);
  const [cameras, setCameras] = useState<OptionRow[]>([]);
  const [mounts, setMounts] = useState<OptionRow[]>([]);
  const [targetForm, setTargetForm] = useState<PlannedTargetForm>(EMPTY_TARGET_FORM);
  const [editingTargetId, setEditingTargetId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingTarget, setSavingTarget] = useState(false);
  const [deletingTargetId, setDeletingTargetId] = useState<number | null>(null);
  const [updating, setUpdating] = useState<Set<number>>(new Set());
  const [removing, setRemoving] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"to_pick" | "picked" | "packed" | "loaded" | null>(null);
  const [filterCat, setFilterCat] = useState("");
  const [filterSub, setFilterSub] = useState("");

  async function load() {
    setLoading(true);
    const [evRes, catRes, piRes, subRes, ptRes, telRes, camRes, mountRes] = await Promise.all([
      supabase.from("star_party_event").select("event_id, name, date_from, date_to, is_current").eq("event_id", id).single(),
      supabase.from("star_party_category").select("slug, label").order("sort_order"),
      supabase
        .from("star_party_plan_item")
        .select("plan_item_id, status, loaded, container_id, star_party_item(item_id, name, category, sub_category, sort_order), star_party_container(name)")
        .eq("event_id", id)
        .order("status"),
      supabase.from("star_party_sub_category").select("sub_category_id, category_slug, name").order("sort_order").order("name"),
      supabase
        .from("star_party_planned_target")
        .select("planned_target_id, target_name, description, telescope_id, camera_id, mount_id, filter_text, telescope(name), camera(name), mount(name)")
        .eq("event_id", id)
        .order("target_name"),
      supabase.from("telescope").select("telescope_id, name").order("name"),
      supabase.from("camera").select("camera_id, name").order("name"),
      supabase.from("mount").select("mount_id, name").order("name"),
    ]);
    setEvent(evRes.data as SPEvent ?? null);
    setCategories((catRes.data as Category[]) ?? []);
    setSubCategories((subRes.data as SubCategory[]) ?? []);
    setPlanItems((piRes.data as unknown as PlanItem[]) ?? []);
    setPlannedTargets((ptRes.data as unknown as PlannedTarget[]) ?? []);
    setTelescopes(((telRes.data as any[]) ?? []).map(t => ({ id: t.telescope_id, name: t.name })));
    setCameras(((camRes.data as any[]) ?? []).map(c => ({ id: c.camera_id, name: c.name })));
    setMounts(((mountRes.data as any[]) ?? []).map(m => ({ id: m.mount_id, name: m.name })));
    setLoading(false);
  }

  function updateTargetForm(patch: Partial<PlannedTargetForm>) {
    setTargetForm(form => ({ ...form, ...patch }));
  }

  function resetTargetForm() {
    setTargetForm(EMPTY_TARGET_FORM);
    setEditingTargetId(null);
  }

  function editTarget(target: PlannedTarget) {
    setEditingTargetId(target.planned_target_id);
    setTargetForm({
      target_name: target.target_name,
      description: target.description ?? "",
      telescope_id: target.telescope_id ? String(target.telescope_id) : "",
      camera_id: target.camera_id ? String(target.camera_id) : "",
      mount_id: target.mount_id ? String(target.mount_id) : "",
      filter_text: target.filter_text ?? "",
    });
  }

  function targetPayload() {
    const name = targetForm.target_name.trim();
    const filterText = targetForm.filter_text.trim();
    if (!name) throw new Error("Target name is required.");
    if (name.length > 50) throw new Error("Target name must be 50 characters or fewer.");
    if (filterText.length > 250) throw new Error("Filter must be 250 characters or fewer.");

    return {
      event_id: Number(id),
      target_name: name,
      description: targetForm.description.trim() || null,
      telescope_id: targetForm.telescope_id ? Number(targetForm.telescope_id) : null,
      camera_id: targetForm.camera_id ? Number(targetForm.camera_id) : null,
      mount_id: targetForm.mount_id ? Number(targetForm.mount_id) : null,
      filter_text: filterText || null,
    };
  }

  async function saveTarget() {
    if (savingTarget) return;
    try {
      const payload = targetPayload();
      setSavingTarget(true);
      const query = editingTargetId
        ? supabase.from("star_party_planned_target").update(payload).eq("planned_target_id", editingTargetId)
        : supabase.from("star_party_planned_target").insert(payload);
      const { error } = await query;
      if (error) throw new Error(error.message);
      resetTargetForm();
      await load();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setSavingTarget(false);
    }
  }

  async function deleteTarget(target: PlannedTarget) {
    if (!confirm(`Delete planned target "${target.target_name}"?`)) return;
    setDeletingTargetId(target.planned_target_id);
    const previous = plannedTargets;
    setPlannedTargets(items => items.filter(t => t.planned_target_id !== target.planned_target_id));
    const { error } = await supabase
      .from("star_party_planned_target")
      .delete()
      .eq("planned_target_id", target.planned_target_id);
    if (error) {
      setPlannedTargets(previous);
      alert(error.message);
    }
    if (editingTargetId === target.planned_target_id) resetTargetForm();
    setDeletingTargetId(null);
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

      <section style={{ marginBottom: 26 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Planned Targets</h2>
          <span style={{ fontSize: 12, opacity: 0.5 }}>
            {plannedTargets.length} target{plannedTargets.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div style={{
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 10,
          padding: 12,
          background: "rgba(255,255,255,0.035)",
          marginBottom: 12,
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, opacity: 0.6, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Target Name
              </label>
              <input
                value={targetForm.target_name}
                onChange={e => updateTargetForm({ target_name: e.target.value.slice(0, 50) })}
                maxLength={50}
                placeholder="M31, Veil Nebula, Saturn..."
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.16)",
                  borderRadius: 8, padding: "9px 10px", color: "white", fontSize: 15,
                }}
              />
              <div style={{ marginTop: 4, fontSize: 11, opacity: 0.45 }}>{targetForm.target_name.length}/50</div>
            </div>

            <div>
              <label style={{ fontSize: 11, opacity: 0.6, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Description
              </label>
              <textarea
                value={targetForm.description}
                onChange={e => updateTargetForm({ description: e.target.value })}
                rows={3}
                placeholder="Notes, framing ideas, observing plan..."
                style={{
                  width: "100%", boxSizing: "border-box", resize: "vertical",
                  background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.16)",
                  borderRadius: 8, padding: "9px 10px", color: "white", fontSize: 14,
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
              <div>
                <label style={{ fontSize: 11, opacity: 0.6, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Telescope
                </label>
                <select
                  value={targetForm.telescope_id}
                  onChange={e => updateTargetForm({ telescope_id: e.target.value })}
                  style={{ width: "100%", boxSizing: "border-box", padding: "8px 9px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.16)", background: "rgba(0,0,0,0.35)", color: "white", fontSize: 13 }}
                >
                  <option value="">Select...</option>
                  {telescopes.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, opacity: 0.6, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Camera
                </label>
                <select
                  value={targetForm.camera_id}
                  onChange={e => updateTargetForm({ camera_id: e.target.value })}
                  style={{ width: "100%", boxSizing: "border-box", padding: "8px 9px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.16)", background: "rgba(0,0,0,0.35)", color: "white", fontSize: 13 }}
                >
                  <option value="">Select...</option>
                  {cameras.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, opacity: 0.6, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Mount
                </label>
                <select
                  value={targetForm.mount_id}
                  onChange={e => updateTargetForm({ mount_id: e.target.value })}
                  style={{ width: "100%", boxSizing: "border-box", padding: "8px 9px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.16)", background: "rgba(0,0,0,0.35)", color: "white", fontSize: 13 }}
                >
                  <option value="">Select...</option>
                  {mounts.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, opacity: 0.6, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Filter
              </label>
              <input
                value={targetForm.filter_text}
                onChange={e => updateTargetForm({ filter_text: e.target.value.slice(0, 250) })}
                maxLength={250}
                placeholder="Type filter details..."
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.16)",
                  borderRadius: 8, padding: "9px 10px", color: "white", fontSize: 14,
                }}
              />
              <div style={{ marginTop: 4, fontSize: 11, opacity: 0.45 }}>{targetForm.filter_text.length}/250</div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              {editingTargetId && (
                <button
                  onClick={resetTargetForm}
                  disabled={savingTarget}
                  style={{ border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.05)", color: "white", borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}
                >
                  Cancel
                </button>
              )}
              <button
                onClick={saveTarget}
                disabled={savingTarget}
                style={{ border: "none", background: "#3b82f6", color: "white", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: savingTarget ? 0.6 : 1 }}
              >
                {savingTarget ? "Saving..." : editingTargetId ? "Save Target" : "Add Target"}
              </button>
            </div>
          </div>
        </div>

        {plannedTargets.length === 0 ? (
          <p style={{ margin: 0, opacity: 0.55, fontSize: 13 }}>No planned targets yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {plannedTargets.map(t => {
              const equipment = [
                t.telescope?.name ? `Scope: ${t.telescope.name}` : null,
                t.camera?.name ? `Camera: ${t.camera.name}` : null,
                t.mount?.name ? `Mount: ${t.mount.name}` : null,
                t.filter_text ? `Filter: ${t.filter_text}` : null,
              ].filter(Boolean);
              return (
                <div
                  key={t.planned_target_id}
                  style={{
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.025)",
                    padding: 12,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{t.target_name}</div>
                      {t.description && (
                        <div style={{ fontSize: 13, opacity: 0.72, marginTop: 4, whiteSpace: "pre-wrap" }}>{t.description}</div>
                      )}
                      {equipment.length > 0 && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                          {equipment.map(bit => (
                            <span key={bit} style={{ fontSize: 11, color: "#93c5fd", background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.22)", borderRadius: 6, padding: "3px 7px" }}>
                              {bit}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => editTarget(t)}
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#93c5fd", borderRadius: 7, padding: "5px 8px", fontSize: 12, cursor: "pointer" }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteTarget(t)}
                        disabled={deletingTargetId === t.planned_target_id}
                        style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.22)", color: "#f87171", borderRadius: 7, padding: "5px 8px", fontSize: 12, cursor: "pointer", opacity: deletingTargetId === t.planned_target_id ? 0.5 : 1 }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

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
