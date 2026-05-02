"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type TelescopeOpt = { telescope_id: number; name: string };
type CameraOpt    = { camera_id: number; name: string };
type FilterOpt    = { filter_id: number; name: string; sort_order: number };

type FlatWizardRow = {
  flat_wizard_id: number;
  telescope_id: number;
  camera_id: number;
  mode: "dynamic_brightness" | "dynamic_exposure";
  filter_id: number;
  min_exposure: number;
  max_exposure: number;
  brightness: number;
};

type FilterLine = {
  key: number; // local key for React
  filter_id: number | "";
  min_exposure: number | "";
  max_exposure: number | "";
  brightness: number | "";
};

const MODE_LABELS: Record<string, string> = {
  dynamic_brightness: "Dynamic Brightness",
  dynamic_exposure:   "Dynamic Exposure",
};

let lineKey = 0;
function newLine(): FilterLine {
  return { key: ++lineKey, filter_id: "", min_exposure: "", max_exposure: "", brightness: "" };
}

// ── Styles ──────────────────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────────────────────────────

export default function FlatWizardPage() {
  const [telescopes, setTelescopes] = useState<TelescopeOpt[]>([]);
  const [cameras,    setCameras]    = useState<CameraOpt[]>([]);
  const [filters,    setFilters]    = useState<FilterOpt[]>([]);
  const [rows,       setRows]       = useState<FlatWizardRow[]>([]);
  const [loading,    setLoading]    = useState(true);

  // Form state
  const [showForm,   setShowForm]   = useState(false);
  const [editingId,  setEditingId]  = useState<number | null>(null); // null = new
  const [telescope,  setTelescope]  = useState<number | "">("");
  const [camera,     setCamera]     = useState<number | "">("");
  const [mode,       setMode]       = useState<"dynamic_brightness" | "dynamic_exposure">("dynamic_brightness");
  const [lines,      setLines]      = useState<FilterLine[]>([newLine()]);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [copyKey,    setCopyKey]    = useState<string>("");

  // ── Load lookups ───────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      supabase.from("telescope").select("telescope_id, name").order("name"),
      supabase.from("camera").select("camera_id, name").order("name"),
      supabase.from("filter").select("filter_id, name, sort_order").order("sort_order"),
    ]).then(([t, c, f]) => {
      if (t.data) setTelescopes(t.data as TelescopeOpt[]);
      if (c.data) setCameras(c.data as CameraOpt[]);
      if (f.data) setFilters(f.data as FilterOpt[]);
    });
  }, []);

  // ── Load rows ──────────────────────────────────────────────────────────────
  async function loadRows() {
    setLoading(true);
    const { data } = await supabase
      .from("flat_wizard")
      .select("*")
      .order("telescope_id")
      .order("camera_id")
      .order("mode")
      .order("filter_id");
    setRows((data as FlatWizardRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { loadRows(); }, []);

  // ── Maps ───────────────────────────────────────────────────────────────────
  const telMap    = useMemo(() => Object.fromEntries(telescopes.map(t => [t.telescope_id, t.name])), [telescopes]);
  const camMap    = useMemo(() => Object.fromEntries(cameras.map(c => [c.camera_id, c.name])), [cameras]);
  const filterMap = useMemo(() => Object.fromEntries(filters.map(f => [f.filter_id, f.name])), [filters]);

  // ── Open new form ──────────────────────────────────────────────────────────
  function openNew() {
    setEditingId(null);
    setTelescope("");
    setCamera("");
    setMode("dynamic_brightness");
    setLines([newLine()]);
    setCopyKey("");
    setError(null);
    setShowForm(true);
  }

  // ── Copy from an existing group into the form ──────────────────────────────
  function applyGroupCopy(key: string) {
    setCopyKey(key);
    if (!key) return;
    const group = grouped.find(g => `${g.telescopeName}_${g.cameraName}_${g.mode}` === key);
    if (!group) return;
    setTelescope(group.rows[0].telescope_id);
    setCamera(group.rows[0].camera_id);
    setMode(group.rows[0].mode);
    setLines(group.rows.map(r => ({
      key: ++lineKey,
      filter_id:    r.filter_id,
      min_exposure: r.min_exposure,
      max_exposure: r.max_exposure,
      brightness:   r.brightness,
    })));
    setError(null);
  }

  // ── Open edit form (single row) ────────────────────────────────────────────
  function openEdit(row: FlatWizardRow) {
    setEditingId(row.flat_wizard_id);
    setTelescope(row.telescope_id);
    setCamera(row.camera_id);
    setMode(row.mode);
    setLines([{
      key: ++lineKey,
      filter_id:    row.filter_id,
      min_exposure: row.min_exposure,
      max_exposure: row.max_exposure,
      brightness:   row.brightness,
    }]);
    setError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setError(null);
  }

  // ── Line helpers ───────────────────────────────────────────────────────────
  function updateLine(key: number, field: keyof Omit<FilterLine, "key">, value: any) {
    setLines(prev => prev.map(l => l.key === key ? { ...l, [field]: value } : l));
  }

  function removeLine(key: number) {
    setLines(prev => prev.length > 1 ? prev.filter(l => l.key !== key) : prev);
  }

  // ── Validate ───────────────────────────────────────────────────────────────
  function validate(): string | null {
    if (!telescope) return "Please select a telescope.";
    if (!camera)    return "Please select a camera.";
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const n = lines.length > 1 ? ` (row ${i + 1})` : "";
      if (!l.filter_id)                                            return `Please select a filter${n}.`;
      if (l.min_exposure === "" || Number(l.min_exposure) < 0)    return `Min Exposure must be ≥ 0${n}.`;
      if (l.max_exposure === "" || Number(l.max_exposure) < 0)    return `Max Exposure must be ≥ 0${n}.`;
      if (Number(l.max_exposure) < Number(l.min_exposure))        return `Max Exposure must be ≥ Min Exposure${n}.`;
      if (l.brightness === "" || Number(l.brightness) < 0)        return `Brightness must be ≥ 0${n}.`;
    }
    // Check for duplicate filters within the form
    const ids = lines.map(l => l.filter_id);
    if (new Set(ids).size !== ids.length) return "Duplicate filters in this form.";
    return null;
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function onSave() {
    const msg = validate();
    if (msg) { setError(msg); return; }

    setSaving(true);
    setError(null);

    if (editingId !== null) {
      // Single-row update
      const l = lines[0];
      const { error: err } = await supabase.from("flat_wizard").update({
        telescope_id: Number(telescope),
        camera_id:    Number(camera),
        mode,
        filter_id:    Number(l.filter_id),
        min_exposure: Number(l.min_exposure),
        max_exposure: Number(l.max_exposure),
        brightness:   Number(l.brightness),
      }).eq("flat_wizard_id", editingId);

      if (err) {
        setError(err.code === "23505"
          ? "A setting for this telescope / camera / mode / filter combination already exists."
          : err.message);
        setSaving(false);
        return;
      }
    } else {
      // Multi-row insert
      const payload = lines.map(l => ({
        telescope_id: Number(telescope),
        camera_id:    Number(camera),
        mode,
        filter_id:    Number(l.filter_id),
        min_exposure: Number(l.min_exposure),
        max_exposure: Number(l.max_exposure),
        brightness:   Number(l.brightness),
      }));

      const { error: err } = await supabase.from("flat_wizard").insert(payload);
      if (err) {
        setError(err.code === "23505"
          ? "One or more of these filter combinations already exists for this telescope / camera / mode."
          : err.message);
        setSaving(false);
        return;
      }
    }

    closeForm();
    await loadRows();
    setSaving(false);
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function onDelete(row: FlatWizardRow) {
    const label = `${telMap[row.telescope_id]} / ${camMap[row.camera_id]} / ${MODE_LABELS[row.mode]} / ${filterMap[row.filter_id]}`;
    if (!confirm(`Delete:\n${label}?`)) return;
    const { error: err } = await supabase.from("flat_wizard").delete().eq("flat_wizard_id", row.flat_wizard_id);
    if (err) { alert(err.message); return; }
    await loadRows();
  }

  // ── Group rows by telescope + camera + mode ────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<string, { telescopeName: string; cameraName: string; mode: string; rows: FlatWizardRow[] }>();
    for (const r of rows) {
      const key = `${r.telescope_id}_${r.camera_id}_${r.mode}`;
      if (!map.has(key)) {
        map.set(key, {
          telescopeName: telMap[r.telescope_id] ?? `#${r.telescope_id}`,
          cameraName:    camMap[r.camera_id]    ?? `#${r.camera_id}`,
          mode:          r.mode,
          rows: [],
        });
      }
      map.get(key)!.rows.push(r);
    }
    return Array.from(map.values());
  }, [rows, telMap, camMap]);

  // ──────────────────────────────────────────────────────────────────────────

  return (
    <main style={{ padding: "16px", maxWidth: 700, margin: "0 auto" }}>
      <h1>Flat Wizard Settings</h1>

      <div style={{ margin: "12px 0 20px" }}>
        <button style={{ padding: "8px 14px" }} onClick={openNew}>
          + New Combination
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
            {editingId === null ? "New Combination" : "Edit Filter Row"}
          </h2>

          {/* Copy from existing — only when creating new */}
          {editingId === null && grouped.length > 0 && (
            <div style={{
              marginBottom: 20,
              padding: "12px 14px",
              borderRadius: 8,
              background: "rgba(59,130,246,0.08)",
              border: "1px solid rgba(59,130,246,0.2)",
            }}>
              <label style={{ ...lStyle, color: "#93c5fd", opacity: 1, marginBottom: 8 }}>
                Copy from existing combination
              </label>
              <select
                style={{ ...iStyle, borderColor: "rgba(59,130,246,0.3)" }}
                value={copyKey}
                onChange={e => applyGroupCopy(e.target.value)}
              >
                <option value="">— select to copy —</option>
                {grouped.map(g => {
                  const key = `${g.telescopeName}_${g.cameraName}_${g.mode}`;
                  return (
                    <option key={key} value={key}>
                      {g.telescopeName} · {g.cameraName} · {MODE_LABELS[g.mode]}
                    </option>
                  );
                })}
              </select>
              {copyKey && (
                <p style={{ fontSize: 12, opacity: 0.55, margin: "8px 0 0" }}>
                  Fields pre-filled — adjust as needed then save.
                </p>
              )}
            </div>
          )}

          {/* Telescope */}
          <div style={{ marginBottom: 12 }}>
            <label style={lStyle}>Telescope *</label>
            <select style={iStyle} value={telescope} onChange={e => setTelescope(e.target.value as any)}>
              <option value="">— select —</option>
              {telescopes.map(t => <option key={t.telescope_id} value={t.telescope_id}>{t.name}</option>)}
            </select>
          </div>

          {/* Camera */}
          <div style={{ marginBottom: 12 }}>
            <label style={lStyle}>Camera *</label>
            <select style={iStyle} value={camera} onChange={e => setCamera(e.target.value as any)}>
              <option value="">— select —</option>
              {cameras.map(c => <option key={c.camera_id} value={c.camera_id}>{c.name}</option>)}
            </select>
          </div>

          {/* Mode */}
          <div style={{ marginBottom: 16 }}>
            <label style={lStyle}>Mode *</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
              {(["dynamic_brightness", "dynamic_exposure"] as const).map(m => (
                <label key={m} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14 }}>
                  <input
                    type="radio"
                    name="fw-mode"
                    value={m}
                    checked={mode === m}
                    onChange={() => setMode(m)}
                    style={{ width: 16, height: 16, flexShrink: 0, cursor: "pointer" }}
                  />
                  <span>{MODE_LABELS[m]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Filter lines */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ ...lStyle, marginBottom: 8 }}>
              Filters * {editingId === null && <span style={{ opacity: 0.5, fontWeight: 400, textTransform: "none" }}>(add one or more)</span>}
            </label>

            {lines.map((l, idx) => (
              <div key={l.key} style={{
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding: "12px 10px",
                marginBottom: 8,
                background: "rgba(0,0,0,0.2)",
              }}>
                {lines.length > 1 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, opacity: 0.5 }}>Filter {idx + 1}</span>
                    <button
                      style={{ padding: "2px 8px", fontSize: 12 }}
                      onClick={() => removeLine(l.key)}
                    >
                      Remove
                    </button>
                  </div>
                )}

                {/* Filter select */}
                <div style={{ marginBottom: 8 }}>
                  <label style={lStyle}>Filter</label>
                  <select
                    style={iStyle}
                    value={l.filter_id}
                    onChange={e => updateLine(l.key, "filter_id", e.target.value)}
                  >
                    <option value="">— select —</option>
                    {filters.map(f => <option key={f.filter_id} value={f.filter_id}>{f.name}</option>)}
                  </select>
                </div>

                {/* Brightness / Min / Max in a 3-col grid — collapses to 1 on narrow screens */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  <div>
                    <label style={lStyle}>Brightness</label>
                    <input
                      type="number"
                      min={0}
                      style={iStyle}
                      value={l.brightness}
                      onChange={e => updateLine(l.key, "brightness", e.target.value)}
                      placeholder="e.g. 20000"
                    />
                  </div>
                  <div>
                    <label style={lStyle}>Min Exp (s)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      style={iStyle}
                      value={l.min_exposure}
                      onChange={e => updateLine(l.key, "min_exposure", e.target.value)}
                      placeholder="0.1"
                    />
                  </div>
                  <div>
                    <label style={lStyle}>Max Exp (s)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      style={iStyle}
                      value={l.max_exposure}
                      onChange={e => updateLine(l.key, "max_exposure", e.target.value)}
                      placeholder="10"
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Only show Add Filter button when creating new */}
            {editingId === null && (
              <button
                style={{ padding: "6px 12px", fontSize: 13, marginTop: 4 }}
                onClick={() => setLines(prev => [...prev, newLine()])}
              >
                + Add Filter
              </button>
            )}
          </div>

          {error && <p style={{ color: "#f87171", margin: "10px 0 0", fontSize: 14 }}>{error}</p>}

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

      {/* ── Saved combinations ── */}
      {loading ? (
        <p>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ opacity: 0.6, fontSize: 14 }}>No flat wizard settings saved yet.</p>
      ) : (
        grouped.map(group => (
          <div key={`${group.telescopeName}_${group.cameraName}_${group.mode}`} style={{ marginBottom: 24 }}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{group.telescopeName}</span>
              <span style={{ opacity: 0.4, margin: "0 6px" }}>·</span>
              <span style={{ fontSize: 14 }}>{group.cameraName}</span>
              <span style={{ opacity: 0.4, margin: "0 6px" }}>·</span>
              <span style={{
                fontSize: 11,
                padding: "2px 7px",
                borderRadius: 4,
                background: "rgba(59,130,246,0.2)",
                color: "#93c5fd",
              }}>
                {MODE_LABELS[group.mode]}
              </span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["Filter", "Min Exp (s)", "Max Exp (s)", "Brightness", ""].map(h => (
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
                  {group.rows.map(r => (
                    <tr key={r.flat_wizard_id}>
                      <td style={{ padding: "7px 8px", borderBottom: "1px solid #1e1e1e" }}>
                        {filterMap[r.filter_id] ?? r.filter_id}
                      </td>
                      <td style={{ padding: "7px 8px", borderBottom: "1px solid #1e1e1e" }}>
                        {Number(r.min_exposure).toFixed(2)}
                      </td>
                      <td style={{ padding: "7px 8px", borderBottom: "1px solid #1e1e1e" }}>
                        {Number(r.max_exposure).toFixed(2)}
                      </td>
                      <td style={{ padding: "7px 8px", borderBottom: "1px solid #1e1e1e" }}>
                        {r.brightness}
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
          </div>
        ))
      )}
    </main>
  );
}
