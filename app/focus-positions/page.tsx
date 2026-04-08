"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type FocusPositionRow = {
  focus_position_id: number;
  telescope_description: string;
  position: number;
};

const iStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(0,0,0,0.35)",
  color: "white",
  boxSizing: "border-box",
  fontSize: 14,
};

const lStyle: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.6,
  marginBottom: 4,
  display: "block",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

export default function FocusPositionsPage() {
  const [rows,    setRows]    = useState<FocusPositionRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm,  setShowForm]  = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [desc,      setDesc]      = useState("");
  const [position,  setPosition]  = useState<number | "">("");
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  async function loadRows() {
    setLoading(true);
    const { data } = await supabase
      .from("focus_position")
      .select("focus_position_id, telescope_description, position")
      .order("telescope_description")
      .order("position");
    setRows((data as FocusPositionRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { loadRows(); }, []);

  function openNew() {
    setEditingId(null);
    setDesc("");
    setPosition("");
    setError(null);
    setShowForm(true);
  }

  function openEdit(row: FocusPositionRow) {
    setEditingId(row.focus_position_id);
    setDesc(row.telescope_description);
    setPosition(row.position);
    setError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setError(null);
  }

  function validate(): string | null {
    if (!desc.trim())                              return "Telescope description is required.";
    if (desc.trim().length > 50)                   return "Telescope description must be 50 characters or fewer.";
    if (position === "")                           return "Focus position is required.";
    if (!Number.isInteger(Number(position)))       return "Focus position must be a whole number.";
    if (Number(position) < 0)                      return "Focus position must be 0 or greater.";
    if (Number(position) > 99999)                  return "Focus position must be 99999 or less.";
    return null;
  }

  async function onSave() {
    const msg = validate();
    if (msg) { setError(msg); return; }

    setSaving(true);
    setError(null);

    const payload = {
      telescope_description: desc.trim(),
      position: Number(position),
    };

    if (editingId !== null) {
      const { error: err } = await supabase
        .from("focus_position")
        .update(payload)
        .eq("focus_position_id", editingId);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase
        .from("focus_position")
        .insert(payload);
      if (err) { setError(err.message); setSaving(false); return; }
    }

    closeForm();
    await loadRows();
    setSaving(false);
  }

  async function onDelete(row: FocusPositionRow) {
    if (!confirm(`Delete focus position for "${row.telescope_description}" (${row.position})?`)) return;
    const { error: err } = await supabase
      .from("focus_position")
      .delete()
      .eq("focus_position_id", row.focus_position_id);
    if (err) { alert(err.message); return; }
    await loadRows();
  }

  return (
    <main style={{ padding: "16px", maxWidth: 640, margin: "0 auto" }}>
      {/* Back link */}
      <div style={{ marginBottom: 16 }}>
        <Link href="/" style={{ fontSize: 13, opacity: 0.6, textDecoration: "none" }}>
          ← Home
        </Link>
      </div>

      <h1>Focus Positions</h1>

      <div style={{ margin: "12px 0 20px" }}>
        <button style={{ padding: "8px 14px" }} onClick={openNew}>
          + New Entry
        </button>
      </div>

      {/* ── Form ── */}
      {showForm && (
        <div style={{
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 12,
          padding: "20px 16px",
          marginBottom: 28,
          background: "rgba(255,255,255,0.03)",
        }}>
          <h2 style={{ marginTop: 0, marginBottom: 18, fontSize: 15 }}>
            {editingId === null ? "New Focus Position" : "Edit Focus Position"}
          </h2>

          <div style={{ marginBottom: 12 }}>
            <label style={lStyle}>Telescope Description *</label>
            <input
              type="text"
              maxLength={50}
              style={iStyle}
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="e.g. Esprit 100 ED"
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={lStyle}>Focus Position *</label>
            <input
              type="number"
              min={0}
              max={99999}
              step={1}
              style={iStyle}
              value={position}
              onChange={e => setPosition(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="e.g. 45230"
            />
          </div>

          {error && (
            <p style={{ color: "#f87171", margin: "10px 0 0", fontSize: 14 }}>{error}</p>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button style={{ padding: "8px 18px" }} onClick={onSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button style={{ padding: "8px 18px" }} onClick={closeForm} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── List ── */}
      {loading ? (
        <p>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ opacity: 0.6, fontSize: 14 }}>No focus positions saved yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Telescope Description", "Position", ""].map(h => (
                  <th key={h} style={{
                    textAlign: "left",
                    padding: "5px 8px",
                    borderBottom: "1px solid #333",
                    opacity: 0.5,
                    fontWeight: 500,
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.focus_position_id}>
                  <td style={{ padding: "7px 8px", borderBottom: "1px solid #1e1e1e" }}>
                    {r.telescope_description}
                  </td>
                  <td style={{ padding: "7px 8px", borderBottom: "1px solid #1e1e1e" }}>
                    {r.position}
                  </td>
                  <td style={{ padding: "7px 8px", borderBottom: "1px solid #1e1e1e" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button style={{ padding: "3px 9px", fontSize: 12 }} onClick={() => openEdit(r)}>Edit</button>
                      <button style={{ padding: "3px 9px", fontSize: 12 }} onClick={() => onDelete(r)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
