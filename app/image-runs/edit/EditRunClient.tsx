"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type RunRow = {
  image_run_id: number;
  session_id: number;
  run_date: string | null;
  panel_no: number | null;
  panel_name: string | null;
  notes: string | null;
};

type FilterOpt = { filter_id: number; name: string };

type RunFilterLine = {
  filter_id: number | null;
  exposures: number;
  exposure_sec: number;
  gain: number | null;
  camera_offset: number | null;
  bin: number | null;
  notes: string | null;
};

function fmtHMS(totalSec: number) {
  const sec = Math.max(0, Math.floor(totalSec || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s
    .toString()
    .padStart(2, "0")}`;
}

export default function EditRunClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const runId = Number(sp.get("image_run_id") || 0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [row, setRow] = useState<RunRow | null>(null);
  const [targetId, setTargetId] = useState<number | null>(null);

  const [filters, setFilters] = useState<FilterOpt[]>([]);
  const [lines, setLines] = useState<RunFilterLine[]>([
    { filter_id: null, exposures: 0, exposure_sec: 0, gain: null, camera_offset: null, bin: null, notes: null },
  ]);

  useEffect(() => {
    (async () => {
      if (!runId) return;

      const r = await supabase
        .from("image_run")
        .select("image_run_id,session_id,run_date,panel_no,panel_name,notes")
        .eq("image_run_id", runId)
        .single();

      if (r.error) {
        alert(r.error.message);
        setLoading(false);
        return;
      }
      const rr = r.data as RunRow;
      setRow(rr);

      const s = await supabase.from("session").select("target_id").eq("session_id", rr.session_id).single();
      if (!s.error) setTargetId((s.data as any).target_id);

      const f = await supabase.from("filter").select("filter_id,name").order("name");
      if (!f.error) setFilters(((f.data as any) ?? []) as FilterOpt[]);

      const rf = await supabase
        .from("run_filter")
        .select("filter_id,exposures,exposure_sec,gain,camera_offset,bin,notes")
        .eq("image_run_id", runId)
        .order("filter_id", { ascending: true, nullsFirst: false });

      if (rf.error) {
        alert(rf.error.message);
      } else {
        const got = ((rf.data as any) ?? []) as RunFilterLine[];
        setLines(
          got.length
            ? got.map((x) => ({
                filter_id: x.filter_id ?? null,
                exposures: Number(x.exposures ?? 0),
                exposure_sec: Number(x.exposure_sec ?? 0),
                gain: x.gain ?? null,
                camera_offset: x.camera_offset ?? null,
                bin: x.bin ?? null,
                notes: x.notes ?? null,
              }))
            : [
                {
                  filter_id: null,
                  exposures: 0,
                  exposure_sec: 0,
                  gain: null,
                  camera_offset: null,
                  bin: null,
                  notes: null,
                },
              ]
        );
      }

      setLoading(false);
    })();
  }, [runId]);

  const totalSec = useMemo(
    () => lines.reduce((sum, l) => sum + Number(l.exposures || 0) * Number(l.exposure_sec || 0), 0),
    [lines]
  );

  function updateLine(i: number, patch: Partial<RunFilterLine>) {
    setLines((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  function addLineCopyPrev() {
    setLines((prev) => {
      const last = prev[prev.length - 1];
      return [...prev, { ...last }];
    });
  }

  function removeLine(i: number) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  async function save() {
    if (!row) return;

    for (const l of lines) {
      if (!l.filter_id) return alert("Each filter line needs a filter selected.");
    }

    setSaving(true);

    const up = await supabase
      .from("image_run")
      .update({
        run_date: row.run_date,
        panel_no: row.panel_no,
        panel_name: row.panel_name,
        notes: row.notes,
      })
      .eq("image_run_id", row.image_run_id);

    if (up.error) {
      setSaving(false);
      return alert(up.error.message);
    }

    const del = await supabase.from("run_filter").delete().eq("image_run_id", row.image_run_id);
    if (del.error) {
      setSaving(false);
      return alert(del.error.message);
    }

    const payload = lines.map((l) => ({
      image_run_id: row.image_run_id,
      filter_id: l.filter_id,
      exposures: Number(l.exposures || 0),
      exposure_sec: Number(l.exposure_sec || 0),
      gain: l.gain,
      camera_offset: l.camera_offset,
      bin: l.bin,
      notes: l.notes,
    }));

    const ins = await supabase.from("run_filter").insert(payload);
    if (ins.error) {
      setSaving(false);
      return alert(ins.error.message);
    }

    setSaving(false);

    if (targetId) router.push(`/targets/${targetId}`);
    else router.back();
    router.refresh();
  }

  if (loading) return <div>Loading…</div>;
  if (!row) return <div>Not found</div>;

  return (
    <>
      <h1>Edit Image Run #{row.image_run_id}</h1>

      <div style={{ margin: "8px 0 14px", opacity: 0.85 }}>
        Total integration: <b>{fmtHMS(totalSec)}</b>
      </div>

      <label>Run date</label>
      <input
        value={row.run_date ?? ""}
        onChange={(e) => setRow({ ...row, run_date: e.target.value || null })}
        placeholder="YYYY-MM-DD"
        style={{ width: "100%", margin: "6px 0 12px" }}
      />

      <label>Panel no</label>
      <input
        type="number"
        value={row.panel_no ?? ""}
        onChange={(e) => setRow({ ...row, panel_no: e.target.value === "" ? null : Number(e.target.value) })}
        style={{ width: "100%", margin: "6px 0 12px" }}
      />

      <label>Panel name</label>
      <input
        value={row.panel_name ?? ""}
        onChange={(e) => setRow({ ...row, panel_name: e.target.value || null })}
        style={{ width: "100%", margin: "6px 0 12px" }}
      />

      <label>Notes</label>
      <textarea
        value={row.notes ?? ""}
        onChange={(e) => setRow({ ...row, notes: e.target.value || null })}
        rows={4}
        style={{ width: "100%", margin: "6px 0 12px" }}
      />

      <h2 style={{ marginTop: 14 }}>Filters</h2>

      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Filter</th>
              <th>No. Exposures</th>
              <th>Exposure (sec)</th>
              <th style={{ width: 80 }}>Gain</th>
              <th style={{ width: 80 }}>Offset</th>
              <th style={{ width: 65 }}>Bin</th>
              <th>Line Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const lineSec = Number(l.exposures || 0) * Number(l.exposure_sec || 0);
              return (
                <tr key={i}>
                  <td>
                    <select
                      value={l.filter_id ?? ""}
                      onChange={(e) => updateLine(i, { filter_id: e.target.value ? Number(e.target.value) : null })}
                    >
                      <option value="">—</option>
                      {filters.map((f) => (
                        <option key={f.filter_id} value={f.filter_id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td>
                    <input
                      type="number"
                      value={l.exposures}
                      onChange={(e) => updateLine(i, { exposures: Number(e.target.value) })}
                      style={{ width: 110 }}
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      value={l.exposure_sec}
                      onChange={(e) => updateLine(i, { exposure_sec: Number(e.target.value) })}
                      style={{ width: 130 }}
                    />
                  </td>

                  {/* 20% smaller */}
                  <td>
                    <input
                      type="number"
                      value={l.gain ?? ""}
                      onChange={(e) => updateLine(i, { gain: e.target.value === "" ? null : Number(e.target.value) })}
                      style={{ width: 72 }}
                    />
                  </td>

                  {/* 20% smaller */}
                  <td>
                    <input
                      type="number"
                      value={l.camera_offset ?? ""}
                      onChange={(e) =>
                        updateLine(i, { camera_offset: e.target.value === "" ? null : Number(e.target.value) })
                      }
                      style={{ width: 72 }}
                    />
                  </td>

                  {/* 20% smaller */}
                  <td>
                    <input
                      type="number"
                      value={l.bin ?? ""}
                      onChange={(e) => updateLine(i, { bin: e.target.value === "" ? null : Number(e.target.value) })}
                      style={{ width: 56 }}
                    />
                  </td>

                  <td>{fmtHMS(lineSec)}</td>

                  <td>
                    <button onClick={() => removeLine(i)} style={{ padding: "4px 8px" }}>
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={addLineCopyPrev}>Add filter line</button>
        <button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={() => router.back()} disabled={saving}>
          Cancel
        </button>
      </div>
    </>
  );
}
