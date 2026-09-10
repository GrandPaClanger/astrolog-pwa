"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type EventMeta = { name: string; is_current: boolean };
type OptionRow = { id: number; name: string };

type PlannedTarget = {
  planned_target_id: number;
  target_name: string;
  description: string | null;
  telescope_id: number | null;
  camera_id: number | null;
  mount_id: number | null;
  filter_text: string | null;
  rating: number | null;
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
  rating: string;
};

const EMPTY_TARGET_FORM: PlannedTargetForm = {
  target_name: "",
  description: "",
  telescope_id: "",
  camera_id: "",
  mount_id: "",
  filter_text: "",
  rating: "",
};

const RATING_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

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

function ratingLabel(value: number) {
  return Number.isInteger(value) ? `${value}` : `${Math.floor(value)}.5`;
}

function RatingDisplay({ value }: { value: number }) {
  return (
    <span title={`${ratingLabel(value)} out of 5`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span aria-hidden="true" style={{ display: "inline-flex", gap: 1 }}>
        {[1, 2, 3, 4, 5].map(star => {
          const fillPercent = Math.max(0, Math.min(1, value - star + 1)) * 100;
          return (
            <span key={star} style={{ position: "relative", display: "inline-block", width: 14, height: 14, color: "rgba(255,255,255,0.22)", lineHeight: "14px", fontSize: 14 }}>
              ★
              <span style={{ position: "absolute", left: 0, top: 0, width: `${fillPercent}%`, overflow: "hidden", color: "#fbbf24" }}>
                ★
              </span>
            </span>
          );
        })}
      </span>
      <span style={{ color: "#dbeafe", fontSize: 12, fontWeight: 800 }}>{ratingLabel(value)}/5</span>
    </span>
  );
}

function RatingInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const rating = value ? Number(value) : null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <div role="radiogroup" aria-label="Rating" style={{ display: "inline-flex", gap: 2 }}>
        {[1, 2, 3, 4, 5].map(star => {
          const fillPercent = rating ? Math.max(0, Math.min(1, rating - star + 1)) * 100 : 0;
          const leftValue = star === 1 ? 1 : star - 0.5;
          const rightValue = star === 1 ? 1.5 : star;

          return (
            <span key={star} style={{ position: "relative", display: "inline-block", width: 26, height: 26, color: "rgba(255,255,255,0.24)", lineHeight: "26px", fontSize: 24 }}>
              ★
              <span style={{ position: "absolute", left: 0, top: 0, width: `${fillPercent}%`, overflow: "hidden", color: "#fbbf24", pointerEvents: "none" }}>
                ★
              </span>
              <button
                type="button"
                aria-label={`${ratingLabel(leftValue)} stars`}
                aria-pressed={rating === leftValue}
                onClick={() => onChange(String(leftValue))}
                style={{ position: "absolute", left: 0, top: 0, width: "50%", height: "100%", opacity: 0, border: 0, padding: 0, cursor: "pointer" }}
              />
              <button
                type="button"
                aria-label={`${ratingLabel(rightValue)} stars`}
                aria-pressed={rating === rightValue}
                onClick={() => onChange(String(rightValue))}
                style={{ position: "absolute", right: 0, top: 0, width: "50%", height: "100%", opacity: 0, border: 0, padding: 0, cursor: "pointer" }}
              />
            </span>
          );
        })}
      </div>
      {rating && <span style={{ color: "#dbeafe", fontSize: 13, fontWeight: 800 }}>{ratingLabel(rating)}/5</span>}
      {rating && (
        <button
          type="button"
          onClick={() => onChange("")}
          style={{ border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.75)", borderRadius: 8, padding: "6px 9px", fontSize: 12, cursor: "pointer" }}
        >
          Clear
        </button>
      )}
    </div>
  );
}

export default function PlannedTargetsPage() {
  const params = useParams();
  const id = params.id as string;

  const [event, setEvent] = useState<EventMeta | null>(null);
  const [plannedTargets, setPlannedTargets] = useState<PlannedTarget[]>([]);
  const [telescopes, setTelescopes] = useState<OptionRow[]>([]);
  const [cameras, setCameras] = useState<OptionRow[]>([]);
  const [mounts, setMounts] = useState<OptionRow[]>([]);
  const [targetForm, setTargetForm] = useState<PlannedTargetForm>(EMPTY_TARGET_FORM);
  const [editingTargetId, setEditingTargetId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingTarget, setSavingTarget] = useState(false);
  const [deletingTargetId, setDeletingTargetId] = useState<number | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);
  const targetNameRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    setLoading(true);
    const [evRes, ptRes, telRes, camRes, mountRes] = await Promise.all([
      supabase.from("star_party_event").select("name, is_current").eq("event_id", id).single(),
      supabase
        .from("star_party_planned_target")
        .select("planned_target_id, target_name, description, telescope_id, camera_id, mount_id, filter_text, rating, telescope(name), camera(name), mount(name)")
        .eq("event_id", id)
        .order("target_name"),
      supabase.from("telescope").select("telescope_id, name").order("name"),
      supabase.from("camera").select("camera_id, name").order("name"),
      supabase.from("mount").select("mount_id, name").order("name"),
    ]);
    setEvent(evRes.data as EventMeta ?? null);
    setPlannedTargets((ptRes.data as unknown as PlannedTarget[]) ?? []);
    setTelescopes(((telRes.data as any[]) ?? []).map(t => ({ id: t.telescope_id, name: t.name })));
    setCameras(((camRes.data as any[]) ?? []).map(c => ({ id: c.camera_id, name: c.name })));
    setMounts(((mountRes.data as any[]) ?? []).map(m => ({ id: m.mount_id, name: m.name })));
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

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
      rating: target.rating ? String(target.rating) : "",
    });
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      targetNameRef.current?.focus();
    }, 0);
  }

  function targetPayload() {
    const name = targetForm.target_name.trim();
    const filterText = targetForm.filter_text.trim();
    const rating = targetForm.rating ? Number(targetForm.rating) : null;
    if (!name) throw new Error("Target name is required.");
    if (name.length > 50) throw new Error("Target name must be 50 characters or fewer.");
    if (filterText.length > 250) throw new Error("Filter must be 250 characters or fewer.");
    if (rating !== null && (!RATING_OPTIONS.includes(rating))) {
      throw new Error("Rating must be between 1 and 5 stars in half-star steps.");
    }

    return {
      event_id: Number(id),
      target_name: name,
      description: targetForm.description.trim() || null,
      telescope_id: targetForm.telescope_id ? Number(targetForm.telescope_id) : null,
      camera_id: targetForm.camera_id ? Number(targetForm.camera_id) : null,
      mount_id: targetForm.mount_id ? Number(targetForm.mount_id) : null,
      filter_text: filterText || null,
      rating,
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

  if (loading) return <main style={{ padding: 16 }}><p style={{ opacity: 0.6 }}>Loading…</p></main>;

  return (
    <main style={{ padding: "16px", maxWidth: 600, margin: "0 auto", paddingBottom: 40 }}>
      <div style={{ marginBottom: 14 }}>
        <Link href={`/star-party/events/${id}`} style={{ fontSize: 13, opacity: 0.6, textDecoration: "none" }}>← Required Items</Link>
      </div>

      <h1 style={{ marginBottom: 2 }}>Targets</h1>
      {event && <p style={{ fontSize: 13, opacity: 0.55, marginTop: 4, marginBottom: 16 }}>{event.name}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, marginBottom: 20 }}>
        <Link href={`/star-party/events/${id}`} style={tabStyle(false)}>Required</Link>
        <Link href={`/star-party/events/${id}/pick`} style={tabStyle(false)}>To Pick</Link>
        <Link href={`/star-party/events/${id}/pack`} style={tabStyle(false)}>To Pack</Link>
        <Link href={`/star-party/events/${id}/load`} style={tabStyle(false)}>To Load</Link>
        <Link href={`/star-party/events/${id}/off-plan`} style={tabStyle(false)}>Off Plan</Link>
        <span style={tabStyle(true)}>Targets</span>
      </div>

      <section>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Planned Targets</h2>
          <span style={{ fontSize: 12, opacity: 0.5 }}>
            {plannedTargets.length} target{plannedTargets.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div ref={formRef} style={{
          scrollMarginTop: 12,
          border: `1px solid ${editingTargetId ? "rgba(59,130,246,0.5)" : "rgba(255,255,255,0.12)"}`,
          borderRadius: 10,
          padding: 12,
          background: editingTargetId ? "rgba(59,130,246,0.07)" : "rgba(255,255,255,0.035)",
          marginBottom: 12,
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
            {editingTargetId && (
              <div style={{ fontSize: 12, fontWeight: 700, color: "#93c5fd" }}>
                Editing target
              </div>
            )}
            <div>
              <label style={{ fontSize: 11, opacity: 0.6, marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Target Name
              </label>
              <input
                ref={targetNameRef}
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

            <div>
              <label style={{ fontSize: 11, opacity: 0.6, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Rating
              </label>
              <RatingInput value={targetForm.rating} onChange={rating => updateTargetForm({ rating })} />
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
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>{t.target_name}</div>
                        {t.rating && (
                          <RatingDisplay value={t.rating} />
                        )}
                      </div>
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
    </main>
  );
}
