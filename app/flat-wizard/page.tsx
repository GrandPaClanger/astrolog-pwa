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
  // joined names for display
  telescope_name?: string;
  camera_name?: string;
  filter_name?: string;
};

const MODE_LABELS: Record<string, string> = {
  dynamic_brightness: "Dynamic Brightness",
  dynamic_exposure:   "Dynamic Exposure",
};

const BLANK_FORM = {
  telescope_id: "" as number | "",
  camera_id:    "" as number | "",
  mode:         "dynamic_brightness" as "dynamic_brightness" | "dynamic_exposure",
  filter_id:    "" as number | "",
  min_exposure: "" as number | "",
  max_exposure: "" as number | "",
  brightness:   "" as number | "",
};

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(0,0,0,0.35)",
    color: "white",
    boxSizing: "border-box",
  };
}

function labelStyle(): React.CSSProperties {
  return { fontSize: 12, opacity: 0.7, marginBottom: 4, display: "block" };
}

export default function FlatWizardPage() {
  const [telescopes, setTelescopes] = useState<TelescopeOpt[]>([]);
  const [cameras,    setCameras]    = useState<CameraOpt[]>([]);
  const [filters,    setFilters]    = useState<FilterOpt[]>([]);
  const [rows,       setRows]       = useState<FlatWizardRow[]>([]);
  const [loading,    setLoading]    = useState(true);

  const [editingId,  setEditingId]  = useState<number | null>(null);   // null = new form
  const [showForm,   setShowForm]   = useState(false);
  const [form,       setForm]       = useState({ ...BLANK_FORM });
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // ── Load lookup options ──────────────────────────────────────────────
  useEffect(() => {
    async function loadLookups() {
      const [telRes, camRes, filRes] = await Promise.all([
        supabase.from("telescope").select("telescope_id, name").order("name"),
        supabase.from("camera").select("camera_id, name").order("name"),
        supabase.from("filter").select("filter_id, name, sort_order").order("sort_order"),
      ]);
      if (telRes.data) setTelescopes(telRes.data as TelescopeOpt[]);
      if (camRes.data) setCameras(camRes.data as CameraOpt[]);
      if (filRes.data) setFilters(filRes.data as FilterOpt[]);
    }
    loadLookups();
  }, []);

  // ── Load flat wizard rows ────────────────────────────────────────────
  async function loadRows() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("flat_wizard")
      .select("*")
      .order("telescope_id")
      .order("camera_id")
      .order("mode")
      .order("filter_id");

    if (err) {
      console.error(err);
      setRows([]);
    } else {
      setRows((data as FlatWizardRow[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { loadRows(); }, []);

  // ── Lookup helpers ───────────────────────────────────────────────────
  const telMap    = useMemo(() => Object.fromEntries(telescopes.map((t) => [t.telescope_id, t.name])), [telescopes]);
  const camMap    = useMemo(() => Object.fromEntries(cameras.map((c) => [c.camera_id, c.name])), [cameras]);
  const filterMap = useMemo(() => Object.fromEntries(filters.map((f) => [f.filter_id, f.name])), [filters]);

  // ── Form helpers ─────────────────────────────────────────────────────
  function openNew() {
    setEditingId(null);
    setForm({ ...BLANK_FORM });
    setError(null);
    setShowForm(true);
  }

  function openEdit(row: FlatWizardRow) {
    setEditingId(row.flat_wizard_id);
    setForm({
      telescope_id: row.telescope_id,
      camera_id:    row.camera_id,
      mode:         row.mode,
      filter_id:    row.filter_id,
      min_exposure: row.min_exposure,
      max_exposure: row.max_exposure,
      brightness:   row.brightness,
    });
    setError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setError(null);
  }

  function setField(key: keyof typeof BLANK_FORM, value: any) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── Validate ─────────────────────────────────────────────────────────
  function validate(): string | null {
    if (!form.telescope_id) return "Please select a telescope.";
    if (!form.camera_id)    return "Please select a camera.";
    if (!form.filter_id)    return "Please select a filter.";
    if (form.min_exposure === "" || Number(form.min_exposure) < 0) return "Min Exposure must be ≥ 0.";
    if (form.max_exposure === "" || Number(form.max_exposure) < 0) return "Max Exposure must be ≥ 0.";
    if (Number(form.max_exposure) < Number(form.min_exposure))     return "Max Exposure must be ≥ Min Exposure.";
    if (form.brightness === "" || Number(form.brightness) < 0)     return "Brightness must be ≥ 0.";
    return null;
  }

  // ── Save ──────────────────────────────────────────────────────────────
  async function onSave() {
    const msg = validate();
    if (msg) { setError(msg); return; }

    setSaving(true);
    setError(null);

    const payload = {
      telescope_id: Number(form.telescope_id),
      camera_id:    Number(form.camera_id),
      mode:         form.mode,
      filter_id:    Number(form.filter_id),
      min_exposure: Number(form.min_exposure),
      max_exposure: Number(form.max_exposure),
      brightness:   Number(form.brightness),
    };

    let err: any;

    if (editingId === null) {
      ({ error: err } = await supabase.from("flat_wizard").insert(payload));
    } else {
      ({ error: err } = await supabase.from("flat_wizard").update(payload).eq("flat_wizard_id", editingId));
    }

    if (err) {
      if (err.code === "23505") {
        setError("A setting for this telescope / camera / mode / filter combination already exists.");
      } else {
        setError(err.message);
      }
      setSaving(false);
      return;
    }

    closeForm();
    await loadRows();
    setSaving(false);
  }

  // ── Delete ────────────────────────────────────────────────────────────
  async function onDelete(row: FlatWizardRow) {
    const label = `${telMap[row.telescope_id] ?? row.telescope_id} / ${camMap[row.camera_id] ?? row.camera_id} / ${MODE_LABELS[row.mode]} / ${filterMap[row.filter_id] ?? row.filter_id}`;
    if (!confirm(`Delete flat wizard setting:\n${label}?`)) return;
    const { error: err } = await supabase.from("flat_wizard").delete().eq("flat_wizard_id", row.flat_wizard_id);
    if (err) { alert(err.message); return; }
    await loadRows();
  }

  // ── Grouped display ───────────────────────────────────────────────────
  // Group rows by telescope + camera for cleaner display
  const grouped = useMemo(() => {
    const map = new Map<string, { telescopeName: string; cameraName: string; rows: FlatWizardRow[] }>();
    for (const r of rows) {
      const key = `${r.telescope_id}_${r.camera_id}`;
      if (!map.has(key)) {
        map.set(key, {
          telescopeName: telMap[r.telescope_id] ?? String(r.telescope_id),
          cameraName:    camMap[r.camera_id]    ?? String(r.camera_id),
          rows: [],
        });
      }
      map.get(key)!.rows.push(r);
    }
    return Array.from(map.values());
  }, [rows, telMap, camMap]);

  // ─────────────────────────────────────────────────────────────────────

  return (
    <main style={{ padding: 16, maxWidth: 1000, margin: "0 auto" }}>
      <h1>Flat Wizard Settings</h1>

      {/* Action bar */}
      <div style={{ margin: "12px 0" }}>
        <button style={{ padding: "8px 14px" }} onClick={openNew}>
          + New Combination
        </button>
      </div>

      {/* ── Inline form ── */}
      {showForm && (
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 16 }}>
            {editingId === null ? "New Combination" : "Edit Combination"}
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
            {/* Telescope */}
            <div>
              <label style={labelStyle()}>Telescope *</label>
              <select
                style={inputStyle()}
                value={form.telescope_id}
                onChange={(e) => setField("telescope_id", e.target.value)}
              >
                <option value="">— select —</option>
                {telescopes.map((t) => (
                  <option key={t.telescope_id} value={t.telescope_id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Camera */}
            <div>
              <label style={labelStyle()}>Camera *</label>
              <select
                style={inputStyle()}
                value={form.camera_id}
                onChange={(e) => setField("camera_id", e.target.value)}
              >
                <option value="">— select —</option>
                {cameras.map((c) => (
                  <option key={c.camera_id} value={c.camera_id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Mode (spans 2 cols) */}
            <div style={{ gridColumn: "span 2" }}>
              <label style={labelStyle()}>Mode *</label>
              <div style={{ display: "flex", gap: 24, marginTop: 4 }}>
                {(["dynamic_brightness", "dynamic_exposure"] as const).map((m) => (
                  <label key={m} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="mode"
                      value={m}
                      checked={form.mode === m}
                      onChange={() => setField("mode", m)}
                    />
                    {MODE_LABELS[m]}
                  </label>
                ))}
              </div>
            </div>

            {/* Filter */}
            <div>
              <label style={labelStyle()}>Filter *</label>
              <select
                style={inputStyle()}
                value={form.filter_id}
                onChange={(e) => setField("filter_id", e.target.value)}
              >
                <option value="">— select —</option>
                {filters.map((f) => (
                  <option key={f.filter_id} value={f.filter_id}>{f.name}</option>
                ))}
              </select>
            </div>

            {/* Brightness */}
            <div>
              <label style={labelStyle()}>Brightness *</label>
              <input
                type="number"
                min={0}
                style={inputStyle()}
                value={form.brightness}
                onChange={(e) => setField("brightness", e.target.value)}
                placeholder="e.g. 20000"
              />
            </div>

            {/* Min Exposure */}
            <div>
              <label style={labelStyle()}>Min Exposure (s) *</label>
              <input
                type="number"
                min={0}
                step="0.01"
                style={inputStyle()}
                value={form.min_exposure}
                onChange={(e) => setField("min_exposure", e.target.value)}
                placeholder="e.g. 0.5"
              />
            </div>

            {/* Max Exposure */}
            <div>
              <label style={labelStyle()}>Max Exposure (s) *</label>
              <input
                type="number"
                min={0}
                step="0.01"
                style={inputStyle()}
                value={form.max_exposure}
                onChange={(e) => setField("max_exposure", e.target.value)}
                placeholder="e.g. 10"
              />
            </div>
          </div>

          {error && (
            <p style={{ color: "#f87171", marginTop: 12, marginBottom: 0 }}>{error}</p>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button style={{ padding: "8px 16px" }} onClick={onSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button style={{ padding: "8px 16px" }} onClick={closeForm} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Saved combinations ── */}
      {loading ? (
        <p>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ opacity: 0.6 }}>No flat wizard settings saved yet. Click "+ New Combination" to add one.</p>
      ) : (
        grouped.map((group) => (
          <div
            key={`${group.telescopeName}_${group.cameraName}`}
            style={{ marginBottom: 28 }}
          >
            <h2 style={{ fontSize: 15, marginBottom: 8, opacity: 0.9 }}>
              {group.telescopeName} &mdash; {group.cameraName}
            </h2>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr>
                    {["Mode", "Filter", "Min Exp (s)", "Max Exp (s)", "Brightness", "Actions"].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "6px 10px",
                          borderBottom: "1px solid #333",
                          opacity: 0.7,
                          fontWeight: 500,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((r) => (
                    <tr key={r.flat_wizard_id}>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #222" }}>
                        {MODE_LABELS[r.mode]}
                      </td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #222" }}>
                        {filterMap[r.filter_id] ?? r.filter_id}
                      </td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #222" }}>
                        {Number(r.min_exposure).toFixed(2)}
                      </td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #222" }}>
                        {Number(r.max_exposure).toFixed(2)}
                      </td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #222" }}>
                        {r.brightness}
                      </td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid #222" }}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button style={{ padding: "4px 10px" }} onClick={() => openEdit(r)}>
                            Edit
                          </button>
                          <button style={{ padding: "4px 10px" }} onClick={() => onDelete(r)}>
                            Delete
                          </button>
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
