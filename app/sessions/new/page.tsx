"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type LookupRow = { id: number; name: string };
type FilterRow = { filter_id: number; name: string };

type FilterLineDraft = {
  filter_id: number | "";
  exposures: number;
  exposure_sec: number;
  notes?: string;
};

type RunDraft = {
  run_date: string; // YYYY-MM-DD
  panel_no: number;
  panel_name: string;
  notes?: string;
  lines: FilterLineDraft[];
};

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function NewSessionPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const targetFromQuery = sp.get("target_id");
  const [targets, setTargets] = useState<any[]>([]);
  const [telescopes, setTelescopes] = useState<LookupRow[]>([]);
  const [mounts, setMounts] = useState<LookupRow[]>([]);
  const [cameras, setCameras] = useState<LookupRow[]>([]);
  const [locations, setLocations] = useState<LookupRow[]>([]);
  const [filters, setFilters] = useState<FilterRow[]>([]);

  const [targetId, setTargetId] = useState<string>(targetFromQuery ?? "");
  const [newCatalog, setNewCatalog] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const [sessionDate, setSessionDate] = useState(todayISO());
  const [telescopeId, setTelescopeId] = useState<string>("");
  const [mountId, setMountId] = useState<string>("");
  const [cameraId, setCameraId] = useState<string>("");
  const [locationId, setLocationId] = useState<string>("");
  const [notes, setNotes] = useState("");

  const [runs, setRuns] = useState<RunDraft[]>([
    {
      run_date: todayISO(),
      panel_no: 1,
      panel_name: "Panel 1",
      lines: [{ filter_id: "", exposures: 0, exposure_sec: 0 }],
    },
  ]);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadLookups() {
      // Ensure person exists (RLS)
      await supabase.rpc("ensure_person");

      const [tRes, telRes, mRes, cRes, lRes, fRes] = await Promise.all([
        supabase.from("target").select("target_id,catalog_no,description").order("catalog_no", { ascending: true }),
        supabase.from("telescope").select("telescope_id,name").order("name", { ascending: true }),
        supabase.from("mount").select("mount_id,name").order("name", { ascending: true }),
        supabase.from("camera").select("camera_id,name").order("name", { ascending: true }),
        supabase.from("location").select("location_id,name").order("name", { ascending: true }),
        supabase.from("filter").select("filter_id,name,sort_order").order("sort_order", { ascending: true }),
      ]);

      if (tRes.error) console.error(tRes.error);
      if (telRes.error) console.error(telRes.error);
      if (mRes.error) console.error(mRes.error);
      if (cRes.error) console.error(cRes.error);
      if (lRes.error) console.error(lRes.error);
      if (fRes.error) console.error(fRes.error);

      setTargets((tRes.data as any[]) ?? []);
      setTelescopes(((telRes.data as any[]) ?? []).map((x) => ({ id: x.telescope_id, name: x.name })));
      setMounts(((mRes.data as any[]) ?? []).map((x) => ({ id: x.mount_id, name: x.name })));
      setCameras(((cRes.data as any[]) ?? []).map((x) => ({ id: x.camera_id, name: x.name })));
      setLocations(((lRes.data as any[]) ?? []).map((x) => ({ id: x.location_id, name: x.name })));
      setFilters(((fRes.data as any[]) ?? []).map((x) => ({ filter_id: x.filter_id, name: x.name })));
    }
    loadLookups();
  }, []);

  const addRun = () => {
    const nextNo = Math.min(9, runs.length + 1);
    setRuns([
      ...runs,
      { run_date: sessionDate, panel_no: nextNo, panel_name: `Panel ${nextNo}`, lines: [{ filter_id: "", exposures: 0, exposure_sec: 0 }] },
    ]);
  };

  const addLine = (runIdx: number) => {
    setRuns((prev) => {
      const copy = [...prev];
      const last = copy[runIdx].lines[copy[runIdx].lines.length - 1];
      copy[runIdx].lines.push({
        filter_id: "",
        exposures: last?.exposures ?? 0,
        exposure_sec: last?.exposure_sec ?? 0,
      });
      return copy;
    });
  };

  const updateRun = (idx: number, patch: Partial<RunDraft>) => {
    setRuns((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const updateLine = (runIdx: number, lineIdx: number, patch: Partial<FilterLineDraft>) => {
    setRuns((prev) =>
      prev.map((r, i) => {
        if (i !== runIdx) return r;
        return {
          ...r,
          lines: r.lines.map((l, j) => (j === lineIdx ? { ...l, ...patch } : l)),
        };
      })
    );
  };

  const canSave = useMemo(() => {
    const hasTarget = targetId || (newCatalog.trim().length > 0);
    return (
      !!hasTarget &&
      !!sessionDate &&
      !!telescopeId &&
      !!mountId &&
      !!cameraId &&
      !!locationId
    );
  }, [targetId, newCatalog, sessionDate, telescopeId, mountId, cameraId, locationId]);

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);

    try {
      let tid = targetId ? Number(targetId) : null;

      if (!tid) {
        const { data, error } = await supabase
          .from("target")
          .insert({ catalog_no: newCatalog.trim(), description: newDesc.trim() || null })
          .select("target_id")
          .single();

        if (error) throw error;
        tid = data.target_id;
      }

      const { data: sData, error: sErr } = await supabase
        .from("session")
        .insert({
          target_id: tid,
          session_date: sessionDate,
          telescope_id: Number(telescopeId),
          mount_id: Number(mountId),
          camera_id: Number(cameraId),
          location_id: Number(locationId),
          notes: notes || null,
        })
        .select("session_id")
        .single();

      if (sErr) throw sErr;
      const session_id = sData.session_id as number;

      // insert runs then filter lines
      for (const r of runs) {
        const { data: rData, error: rErr } = await supabase
          .from("image_run")
          .insert({
            session_id,
            run_date: r.run_date,
            panel_no: r.panel_no,
            panel_name: r.panel_name,
            notes: r.notes || null,
          })
          .select("image_run_id")
          .single();

        if (rErr) throw rErr;
        const image_run_id = rData.image_run_id as number;

        const payload = r.lines
          .filter((l) => l.filter_id !== "" && l.exposures >= 0 && l.exposure_sec >= 0)
          .map((l) => ({
            image_run_id,
            filter_id: Number(l.filter_id),
            exposures: Number(l.exposures),
            exposure_sec: Number(l.exposure_sec),
            notes: l.notes || null,
          }));

        if (payload.length) {
          const { error: lfErr } = await supabase.from("run_filter").insert(payload);
          if (lfErr) throw lfErr;
        }
      }

      router.push(`/targets/${tid}`);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <h1>New Session</h1>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <h2 style={{ marginTop: 0 }}>Target</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label>
            Existing target
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)} style={{ width: "100%", padding: 8 }}>
              <option value="">— Select —</option>
              {targets.map((t) => (
                <option key={t.target_id} value={t.target_id}>
                  {t.catalog_no} {t.description ? `— ${t.description}` : ""}
                </option>
              ))}
            </select>
          </label>

          <div />

          <label>
            Or create new (Catalog No)
            <input value={newCatalog} onChange={(e) => setNewCatalog(e.target.value)} style={{ width: "100%", padding: 8 }} />
          </label>

          <label>
            Description
            <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} style={{ width: "100%", padding: 8 }} />
          </label>
        </div>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <h2 style={{ marginTop: 0 }}>Session Header</h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          <label>
            Session date
            <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} style={{ width: "100%", padding: 8 }} />
          </label>

          <label>
            Location
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} style={{ width: "100%", padding: 8 }}>
              <option value="">— Select —</option>
              {locations.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Telescope
            <select value={telescopeId} onChange={(e) => setTelescopeId(e.target.value)} style={{ width: "100%", padding: 8 }}>
              <option value="">— Select —</option>
              {telescopes.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              (Add telescopes via Supabase table for now; we’ll add UI later.)
            </div>
          </label>

          <label>
            Mount
            <select value={mountId} onChange={(e) => setMountId(e.target.value)} style={{ width: "100%", padding: 8 }}>
              <option value="">— Select —</option>
              {mounts.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Camera
            <select value={cameraId} onChange={(e) => setCameraId(e.target.value)} style={{ width: "100%", padding: 8 }}>
              <option value="">— Select —</option>
              {cameras.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ gridColumn: "1 / -1" }}>
            Notes
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={{ width: "100%", padding: 8, minHeight: 70 }} />
          </label>
        </div>
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <h2 style={{ marginTop: 0 }}>Image Runs</h2>

        {runs.map((r, runIdx) => (
          <div key={runIdx} style={{ borderTop: runIdx ? "1px dashed #ddd" : "none", paddingTop: runIdx ? 12 : 0, marginTop: runIdx ? 12 : 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              <label>
                Run date
                <input type="date" value={r.run_date} onChange={(e) => updateRun(runIdx, { run_date: e.target.value })} style={{ width: "100%", padding: 8 }} />
              </label>

              <label>
                Panel No
                <select
                  value={r.panel_no}
                  onChange={(e) => {
                    const pn = Number(e.target.value);
                    updateRun(runIdx, { panel_no: pn, panel_name: `Panel ${pn}` });
                  }}
                  style={{ width: "100%", padding: 8 }}
                >
                  {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      Panel {n}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Panel name
                <input value={r.panel_name} onChange={(e) => updateRun(runIdx, { panel_name: e.target.value })} style={{ width: "100%", padding: 8 }} />
              </label>
            </div>

            <div style={{ marginTop: 10, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Filter", "No of Exposures", "Exposure (sec)", "Total Filter Integration"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: 6, borderBottom: "1px solid #eee" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.lines.map((l, lineIdx) => (
                    <tr key={lineIdx}>
                      <td style={{ padding: 6, borderBottom: "1px solid #f3f3f3" }}>
                        <select
                          value={l.filter_id}
                          onChange={(e) => updateLine(runIdx, lineIdx, { filter_id: e.target.value ? Number(e.target.value) : "" })}
                          style={{ width: "100%", padding: 6 }}
                        >
                          <option value="">—</option>
                          {filters.map((f) => (
                            <option key={f.filter_id} value={f.filter_id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: 6, borderBottom: "1px solid #f3f3f3" }}>
                        <input
                          type="number"
                          value={l.exposures}
                          onChange={(e) => updateLine(runIdx, lineIdx, { exposures: Number(e.target.value) })}
                          style={{ width: "100%", padding: 6 }}
                        />
                      </td>
                      <td style={{ padding: 6, borderBottom: "1px solid #f3f3f3" }}>
                        <input
                          type="number"
                          value={l.exposure_sec}
                          onChange={(e) => updateLine(runIdx, lineIdx, { exposure_sec: Number(e.target.value) })}
                          style={{ width: "100%", padding: 6 }}
                        />
                      </td>
                      <td style={{ padding: 6, borderBottom: "1px solid #f3f3f3" }}>
                        {Math.max(0, l.exposures) * Math.max(0, l.exposure_sec)} sec
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button onClick={() => addLine(runIdx)} style={{ marginTop: 8 }}>
                + Add filter line (copies exposures/time)
              </button>
            </div>
          </div>
        ))}

        <div style={{ marginTop: 10 }}>
          <button onClick={addRun}>+ Add image run</button>
        </div>
      </section>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => router.push("/targets")}>Cancel</button>
        <button onClick={save} disabled={!canSave || saving}>
          {saving ? "Saving…" : "Save session"}
        </button>
      </div>
    </main>
  );
}
