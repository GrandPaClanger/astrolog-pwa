"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type TableKey = "camera" | "filter" | "location" | "mount" | "telescope" | "object_catalog";

type Config = {
  key: TableKey;
  title: string;
  pk: string;
  editable: string[];
  orderBy: { col: string; asc: boolean };
  searchable?: boolean;
  requiresPerson?: boolean;
};

const CONFIGS: Config[] = [
  { key: "camera",   title: "Camera",   pk: "camera_id",   editable: ["name"],                    orderBy: { col: "name",       asc: true } },
  { key: "filter",   title: "Filter",   pk: "filter_id",   editable: ["name", "sort_order"],      orderBy: { col: "sort_order", asc: true } },
  { key: "location", title: "Location", pk: "location_id", editable: ["name"],                    orderBy: { col: "name",       asc: true } },
  { key: "mount",    title: "Mount",    pk: "mount_id",    editable: ["name"],                    orderBy: { col: "name",       asc: true } },
  { key: "telescope",title: "Telescope",pk: "telescope_id",editable: ["name", "notes"],           orderBy: { col: "name",       asc: true }, requiresPerson: true },
  { key: "object_catalog", title: "Object catalog", pk: "object_id", editable: ["catalog_no", "description"], orderBy: { col: "catalog_no", asc: true }, searchable: true },
];

export default function MaintenancePage() {
  const sb = supabase as any;

  const [table, setTable]   = useState<TableKey>("camera");
  const cfg = useMemo(() => CONFIGS.find((c) => c.key === table)!, [table]);

  const [rows, setRows]     = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [personId, setPersonId] = useState<number | null>(null);

  const [q, setQ]           = useState("");
  const [draft, setDraft]   = useState<Record<string, any>>({});

  // Ensure person exists and cache their ID
  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.rpc("ensure_person");
      if (!error && data) setPersonId(Number(data));
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

      for (const k of Object.keys(payload)) {
        if (typeof payload[k] === "string") payload[k] = payload[k].trim() || null;
      }

      // Telescope is user-owned — person_id is filled by the DB trigger (set_person_id_from_auth)
      // but we need ensure_person to have run first so the person row exists.
      if (cfg.requiresPerson && !personId) {
        alert("User profile not ready yet. Please wait a moment and try again.");
        return;
      }

      const { error } = await sb.from(cfg.key).insert(payload);
      if (error) {
        // Give a friendlier message for the common unique-name violation
        if (error.code === "23505") {
          alert(`A ${cfg.title.toLowerCase()} with that name already exists.`);
        } else {
          alert(error.message);
        }
        return;
      }

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
      if (error) {
        if (error.code === "23505") {
          alert(`A ${cfg.title.toLowerCase()} with that name already exists.`);
        } else {
          alert(error.message);
        }
        return;
      }

      await load();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

  return (
    <div className="page-wrapper">
      <div className="flex items-center gap-4 mb-6">
        <h1 style={{ margin: 0 }}>Maintenance</h1>
        <Link href="/" className="btn-ghost ml-auto">
          ← Home
        </Link>
      </div>

      {/* Star Party Items shortcut */}
      <Link
        href="/star-party/items"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px",
          borderRadius: 10,
          border: "1px solid rgba(59,130,246,0.35)",
          background: "rgba(59,130,246,0.07)",
          textDecoration: "none",
          color: "white",
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>Star Party Checklist Items</div>
          <div style={{ fontSize: 12, opacity: 0.55, marginTop: 2 }}>Add, edit and remove items from your packing checklist</div>
        </div>
        <span style={{ fontSize: 18, opacity: 0.5 }}>›</span>
      </Link>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label>Table</label>
          <select
            value={table}
            onChange={(e) => setTable(e.target.value as TableKey)}
            className="input"
          >
            {CONFIGS.map((c) => (
              <option key={c.key} value={c.key}>{c.title}</option>
            ))}
          </select>
        </div>

        {cfg.searchable ? (
          <div>
            <label>Search</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type 2+ chars to filter results…"
              className="input"
            />
          </div>
        ) : (
          <div />
        )}
      </div>

      <h2 style={{ marginTop: 0 }}>{cfg.title}</h2>

      <div className="text-slate-500 text-sm mb-3">
        {loading ? "Loading…" : `${rows.length} rows`}
      </div>

      {/* Add row */}
      <div className="card mb-6">
        <div className="font-semibold text-slate-200 mb-3">Add new</div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cfg.editable.length}, 1fr)`, gap: 10 }}>
          {cfg.editable.map((col) => (
            <div key={col}>
              <label>{col}</label>
              <input
                value={draft[col] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [col]: e.target.value }))}
                className="input"
              />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="btn-primary" onClick={addRow}>
            Add
          </button>
        </div>
      </div>

      {/* Rows */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {cfg.editable.map((c) => (
                <th key={c}>
                  {c}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <RowEditor
                key={String(r[cfg.pk])}
                row={r}
                pkValue={r[cfg.pk]}
                cfg={cfg}
                onSave={saveRow}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowEditor(props: {
  row: any;
  pkValue: any;
  cfg: Config;
  onSave: (pkValue: any, patch: Record<string, any>) => Promise<void>;
}) {
  const { row, pkValue, cfg, onSave } = props;

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
      {cfg.editable.map((c) => (
        <td key={c}>
          <input
            value={edit[c] ?? ""}
            onChange={(e) => setEdit((p) => ({ ...p, [c]: e.target.value }))}
            className="input-sm"
            style={{ width: "100%" }}
          />
        </td>
      ))}
      <td style={{ textAlign: "right" }}>
        <button className="btn-sm" onClick={() => onSave(pkValue, edit)}>
          Save
        </button>
      </td>
    </tr>
  );
}
