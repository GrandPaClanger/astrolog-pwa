"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type TableKey = "camera" | "filter" | "location" | "mount" | "telescope" | "object_catalog";

type Config = {
  key: TableKey;
  title: string;
  pk: string;
  editable: string[]; // fields user can edit
  orderBy: { col: string; asc: boolean };
  searchable?: boolean; // show search box (used for object_catalog)
};

const CONFIGS: Config[] = [
  { key: "camera", title: "Camera", pk: "camera_id", editable: ["name"], orderBy: { col: "name", asc: true } },
  {
    key: "filter",
    title: "Filter",
    pk: "filter_id",
    editable: ["name", "sort_order"],
    orderBy: { col: "sort_order", asc: true },
  },
  { key: "location", title: "Location", pk: "location_id", editable: ["name"], orderBy: { col: "name", asc: true } },
  { key: "mount", title: "Mount", pk: "mount_id", editable: ["name"], orderBy: { col: "name", asc: true } },
  { key: "telescope", title: "Telescope", pk: "telescope_id", editable: ["name", "notes"], orderBy: { col: "name", asc: true } },
  {
    key: "object_catalog",
    title: "Object catalog",
    pk: "object_id",
    editable: ["catalog_no", "description"],
    orderBy: { col: "catalog_no", asc: true },
    searchable: true,
  },
];

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(0,0,0,0.35)",
    color: "white",
  };
}

export default function MaintenancePage() {
  // IMPORTANT: avoid TS "excessively deep" inference on dynamic table names
  const sb = supabase as any;

  const [table, setTable] = useState<TableKey>("camera");
  const cfg = useMemo(() => CONFIGS.find((c) => c.key === table)!, [table]);

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // object_catalog search
  const [q, setQ] = useState("");

  // add row draft
  const [draft, setDraft] = useState<Record<string, any>>({});

  useEffect(() => {
    // Ensure person exists for tables that use triggers / RLS
    void (async () => {
      await supabase.rpc("ensure_person");
    })();
  }, []);

  async function load() {
    setLoading(true);

    let query = sb.from(cfg.key).select("*");

    if (cfg.key === "object_catalog" && q.trim().length >= 2) {
      const like = `%${q.trim()}%`;
      query = query.or(`catalog_no.ilike.${like},description.ilike.${like}`);
    }

    const { data, error } = await query
      .order(cfg.orderBy.col, { ascending: cfg.orderBy.asc })
      .limit(500);

    setLoading(false);

    if (error) {
      alert(error.message);
      setRows([]);
      return;
    }

    setRows(data ?? []);
  }

  useEffect(() => {
    // reset state on table change
    setRows([]);
    setDraft({});
    setQ("");
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.key]);

  useEffect(() => {
    if (cfg.key !== "object_catalog") return;
    const t = setTimeout(() => load(), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function addRow() {
    try {
      const payload: Record<string, any> = {};
      for (const col of cfg.editable) payload[col] = draft[col] ?? null;

      // basic cleaning
      for (const k of Object.keys(payload)) {
        if (typeof payload[k] === "string") payload[k] = payload[k].trim() || null;
      }

      const { error } = await sb.from(cfg.key).insert(payload);
      if (error) return alert(error.message);

      setDraft({});
      await load();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

  async function saveRow(pkValue: any, patch: Record<string, any>) {
    try {
      const payload: Record<string, any> = {};
      for (const col of cfg.editable) {
        if (col in patch) payload[col] = patch[col];
      }

      for (const k of Object.keys(payload)) {
        if (typeof payload[k] === "string") payload[k] = payload[k].trim() || null;
      }

      const { error } = await sb.from(cfg.key).update(payload).eq(cfg.pk, pkValue);

      if (error) return alert(error.message);

      await load();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

  return (
    <main style={{ padding: 16, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Maintenance</h1>
        <Link href="/targets" style={{ marginLeft: "auto" }}>
          Back to Targets
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ display: "block", marginBottom: 6 }}>Table</label>
          <select value={table} onChange={(e) => setTable(e.target.value as TableKey)} style={{ ...inputStyle() }}>
            {CONFIGS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        {cfg.searchable ? (
          <div>
            <label style={{ display: "block", marginBottom: 6 }}>Search</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type 2+ chars to filter results…"
              style={inputStyle()}
            />
          </div>
        ) : (
          <div />
        )}
      </div>

      <h2 style={{ marginTop: 0 }}>{cfg.title}</h2>

      <div style={{ marginBottom: 12, opacity: 0.85 }}>{loading ? "Loading…" : `${rows.length} rows`}</div>

      {/* Add row */}
      <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Add new</div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cfg.editable.length}, 1fr)`, gap: 10 }}>
          {cfg.editable.map((col) => (
            <div key={col}>
              <label style={{ display: "block", marginBottom: 6 }}>{col}</label>
              <input
                value={draft[col] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [col]: e.target.value }))}
                style={inputStyle()}
              />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <button onClick={addRow} style={{ padding: "8px 12px" }}>
            Add
          </button>
        </div>
      </div>

      {/* Rows */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
                {cfg.pk}
              </th>
              {cfg.editable.map((c) => (
                <th key={c} style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
                  {c}
                </th>
              ))}
              <th style={{ padding: 8, borderBottom: "1px solid rgba(255,255,255,0.15)" }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <RowEditor key={String(r[cfg.pk])} row={r} cfg={cfg} onSave={saveRow} />
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function RowEditor(props: { row: any; cfg: Config; onSave: (pkValue: any, patch: Record<string, any>) => Promise<void> }) {
  const { row, cfg, onSave } = props;
  const pkValue = row[cfg.pk];

  const [edit, setEdit] = useState<Record<string, any>>(() => {
    const x: Record<string, any> = {};
    for (const c of cfg.editable) x[c] = row[c] ?? "";
    return x;
  });

  useEffect(() => {
    const x: Record<string, any> = {};
    for (const c of cfg.editable) x[c] = row[c] ?? "";
    setEdit(x);
  }, [row, cfg.editable]);

  return (
    <tr>
      <td style={{ padding: 8, borderBottom: "1px solid rgba(255,255,255,0.08)", opacity: 0.85 }}>{String(pkValue)}</td>

      {cfg.editable.map((c) => (
        <td key={c} style={{ padding: 8, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <input
            value={edit[c] ?? ""}
            onChange={(e) => setEdit((p) => ({ ...p, [c]: e.target.value }))}
            style={{
              width: "100%",
              padding: "6px 8px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(0,0,0,0.35)",
              color: "white",
            }}
          />
        </td>
      ))}

      <td style={{ padding: 8, borderBottom: "1px solid rgba(255,255,255,0.08)", textAlign: "right" }}>
        <button onClick={() => onSave(pkValue, edit)} style={{ padding: "6px 10px" }}>
          Save
        </button>
      </td>
    </tr>
  );
}
