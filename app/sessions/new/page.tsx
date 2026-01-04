"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Target = { target_id: number; catalog_no: string; description: string | null };
type OptionRow = { id: number; name: string };
type FilterOpt = { filter_id: number; name: string };

type FilterLine = {
  filter_id: number | null;
  exposures: number;
  exposure_sec: number;
  gain: number | null;
  camera_offset: number | null;
  bin: number | null;
  notes: string | null;
};

const PANEL_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1); // 1..20

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Display only (keep DB as ISO)
function formatUkDate(iso: string | null | undefined) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC" }).format(dt); // DD/MM/YYYY
}

function fmtHMS(totalSec: number) {
  const sec = Math.max(0, Math.floor(totalSec || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s
    .toString()
    .padStart(2, "0")}`;
}

export default function NewSessionPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const targetIdParam = Number(sp.get("target_id") || 0);
  const existingSessionId = sp.get("session_id") ? Number(sp.get("session_id")) : null;

  const [targets, setTargets] = useState<Target[]>([]);
  const [filters, setFilters] = useState<FilterOpt[]>([]);

  const [locations, setLocations] = useState<OptionRow[]>([]);
  const [telescopes, setTelescopes] = useState<OptionRow[]>([]);
  const [mounts, setMounts] = useState<OptionRow[]>([]);
  const [cameras, setCameras] = useState<OptionRow[]>([]);

  const [targetId, setTargetId] = useState<number>(targetIdParam || 0);

  // Create-new-target fields (only when not adding to an existing session)
  const [newCatalogNo, setNewCatalogNo] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // Session header fields (only used when creating a NEW session)
  const [sessionDate, setSessionDate] = useState<string>(todayIso());
  const [locationId, setLocationId] = useState<number | null>(null);
  const [telescopeId, setTelescopeId] = useState<number | null>(null);
  const [mountId, setMountId] = useState<number | null>(null);
  const [cameraId, setCameraId] = useState<number | null>(null);
  const [sessionNotes, setSessionNotes] = useState<string>("");

  // Image run fields (always used)
  const [runDate, setRunDate] = useState<string>(todayIso());
  const [panelNo, setPanelNo] = useState<number | null>(1);
  const [panelName, setPanelName] = useState<string>("Panel 1");
  const [runNotes, setRunNotes] = useState<string>("");

  const [lines, setLines] = useState<FilterLine[]>([
    { filter_id: null, exposures: 0, exposure_sec: 0, gain: null, camera_offset: null, bin: null, notes: null },
  ]);

  useEffect(() => {
    (async () => {
      const [t, l, tel, m, c, f] = await Promise.all([
        supabase.from("target").select("target_id,catalog_no,description").order("catalog_no"),
        supabase.from("location").select("location_id,name").order("name"),
        supabase.from("telescope").select("telescope_id,name").order("name"),
        supabase.from("mount").select("mount_id,name").order("name"),
        supabase.from("camera").select("camera_id,name").order("name"),
        // IMPORTANT: order by filter_id
        supabase.from("filter").select("filter_id,name").order("filter_id", { ascending: true }),
      ]);

      if (!t.error) setTargets((t.data as any) ?? []);
      if (!f.error) setFilters((f.data as any) ?? []);

      if (!l.error) setLocations(((l.data as any) ?? []).map((x: any) => ({ id: x.location_id, name: x.name })));
      if (!tel.error) setTelescopes(((tel.data as any) ?? []).map((x: any) => ({ id: x.telescope_id, name: x.name })));
      if (!m.error) setMounts(((m.data as any) ?? []).map((x: any) => ({ id: x.mount_id, name: x.name })));
      if (!c.error) setCameras(((c.data as any) ?? []).map((x: any) => ({ id: x.camera_id, name: x.name })));

      // If adding run to an existing session, load its target/session defaults
      if (existingSessionId) {
        const s = await supabase
          .from("session")
          .select("target_id,session_date,location_id,telescope_id,mount_id,camera_id,notes")
          .eq("session_id", existingSessionId)
          .single();

        if (!s.error) {
          const sd = s.data as any;
          setTargetId(Number(sd.target_id));
          if (sd.session_date) setRunDate(todayIso());
          setSessionDate(sd.session_date ?? todayIso());
          setLocationId(sd.location_id ?? null);
          setTelescopeId(sd.telescope_id ?? null);
          setMountId(sd.mount_id ?? null);
          setCameraId(sd.camera_id ?? null);
          setSessionNotes(sd.notes ?? "");
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalSec = useMemo(
    () => lines.reduce((sum, l) => sum + Number(l.exposures || 0) * Number(l.exposure_sec || 0), 0),
    [lines]
  );

  function updateLine(i: number, patch: Partial<FilterLine>) {
    setLines((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  // Only adds when the button is pressed (no auto-add anywhere)
  function addLineCopyPrev() {
    setLines((prev) => {
      const last = prev[prev.length - 1];
      return [...prev, { ...last }];
    });
  }

  function removeLine(idx: number) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  async function ensureTargetId(): Promise<number> {
    const cat = newCatalogNo.trim();

    if (!existingSessionId && cat) {
      const ins = await supabase
        .from("target")
        .insert({
          catalog_no: cat,
          description: newDescription.trim() || null,
        })
        .select("target_id")
        .single();

      if (ins.error) throw new Error(ins.error.message);
      return (ins.data as any).target_id as number;
    }

    if (!targetId) throw new Error("Pick a target.");
    return targetId;
  }

  async function save() {
    try {
      for (const l of lines) {
        if (!l.filter_id) return alert("Each filter line needs a filter selected.");
      }

      const finalTargetId = await ensureTargetId();
      setTargetId(finalTargetId);

      let session_id: number;

      if (existingSessionId) {
        session_id = existingSessionId;
      } else {
        const ins = await supabase
          .from("session")
          .insert({
            target_id: finalTargetId,
            session_date: sessionDate || null,
            location_id: locationId,
            telescope_id: telescopeId,
            mount_id: mountId,
            camera_id: cameraId,
            notes: sessionNotes || null,
          })
          .select("session_id")
          .single();

        if (ins.error) return alert(ins.error.message);
        session_id = (ins.data as any).session_id;
      }

      const runIns = await supabase
        .from("image_run")
        .insert({
          session_id,
          run_date: runDate || null,
          panel_no: panelNo,
          panel_name: panelName || null,
          notes: runNotes || null,
        })
        .select("image_run_id")
        .single();

      if (runIns.error) return alert(runIns.error.message);
      const image_run_id = (runIns.data as any).image_run_id;

      const payload = lines.map((l) => ({
        image_run_id,
        filter_id: l.filter_id,
        exposures: Number(l.exposures || 0),
        exposure_sec: Number(l.exposure_sec || 0),
        gain: l.gain,
        camera_offset: l.camera_offset,
        bin: l.bin,
        notes: l.notes,
      }));

      const rf = await supabase.from("run_filter").insert(payload);
      if (rf.error) return alert(rf.error.message);

      router.push(`/targets/${finalTargetId}`);
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

  return (
    <main style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <h1>{existingSessionId ? "Add Image Run" : "New Session"}</h1>

      <label>Target</label>
      <select
        value={targetId}
        disabled={!!existingSessionId}
        onChange={(e) => setTargetId(Number(e.target.value))}
        style={{ width: "100%", margin: "6px 0 12px" }}
      >
        <option value={0}>Select…</option>
        {targets.map((t) => (
          <option key={t.target_id} value={t.target_id}>
            {t.catalog_no} {t.description ? `— ${t.description}` : ""}
          </option>
        ))}
      </select>

      {!existingSessionId && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label>Or create new (Catalog No)</label>
              <input
                value={newCatalogNo}
                onChange={(e) => setNewCatalogNo(e.target.value)}
                style={{ width: "100%", margin: "6px 0 12px" }}
              />
            </div>
            <div>
              <label>Description</label>
              <input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                style={{ width: "100%", margin: "6px 0 12px" }}
              />
            </div>
          </div>

          <h2>Session Header</h2>

          <label>Session date</label>
          <input
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            style={{ width: "100%", margin: "6px 0 4px" }}
          />
          <div style={{ opacity: 0.75, fontSize: 12, marginBottom: 12 }}>{formatUkDate(sessionDate)}</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label>Location</label>
              <select
                value={locationId ?? ""}
                onChange={(e) => setLocationId(e.target.value ? Number(e.target.value) : null)}
                style={{ width: "100%", margin: "6px 0 12px" }}
              >
                <option value="">— Select —</option>
                {locations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Telescope</label>
              <select
                value={telescopeId ?? ""}
                onChange={(e) => setTelescopeId(e.target.value ? Number(e.target.value) : null)}
                style={{ width: "100%", margin: "6px 0 12px" }}
              >
                <option value="">— Select —</option>
                {telescopes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Mount</label>
              <select
                value={mountId ?? ""}
                onChange={(e) => setMountId(e.target.value ? Number(e.target.value) : null)}
                style={{ width: "100%", margin: "6px 0 12px" }}
              >
                <option value="">— Select —</option>
                {mounts.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Camera</label>
              <select
                value={cameraId ?? ""}
                onChange={(e) => setCameraId(e.target.value ? Number(e.target.value) : null)}
                style={{ width: "100%", margin: "6px 0 12px" }}
              >
                <option value="">— Select —</option>
                {cameras.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label>Notes</label>
          <textarea
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
            rows={4}
            style={{ width: "100%", margin: "6px 0 12px" }}
          />
        </>
      )}

      <h2>Image Run</h2>

      <label>Run date</label>
      <input
        type="date"
        value={runDate}
        onChange={(e) => setRunDate(e.target.value)}
        style={{ width: "100%", margin: "6px 0 4px" }}
      />
      <div style={{ opacity: 0.75, fontSize: 12, marginBottom: 12 }}>{formatUkDate(runDate)}</div>

      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12 }}>
        <div>
          <label>Panel no</label>
          <select
            value={panelNo ?? ""}
            onChange={(e) => {
              const v = e.target.value === "" ? null : Number(e.target.value);
              setPanelNo(v);
              if (v && (!panelName || panelName.startsWith("Panel "))) setPanelName(`Panel ${v}`);
            }}
            style={{ width: "100%", margin: "6px 0 12px" }}
          >
            <option value="">—</option>
            {PANEL_OPTIONS.map((n) => (
              <option key={n} value={n}>
                Panel {n}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Panel name</label>
          <input
            value={panelName}
            onChange={(e) => setPanelName(e.target.value)}
            style={{ width: "100%", margin: "6px 0 12px" }}
          />
        </div>
      </div>

      <label>Run Notes</label>
      <textarea
        value={runNotes}
        onChange={(e) => setRunNotes(e.target.value)}
        rows={3}
        style={{ width: "100%", margin: "6px 0 12px" }}
      />

      <h2>Filters</h2>
      <div style={{ margin: "6px 0 10px", opacity: 0.85 }}>
        Total integration: <b>{fmtHMS(totalSec)}</b>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Filter</th>
              <th>No. Exposures</th>
              <th>Exposure (sec)</th>
              <th>Gain</th>
              <th>Offset</th>
              <th>Bin</th>
              <th>Line Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, idx) => {
              const lineSec = Number(l.exposures || 0) * Number(l.exposure_sec || 0);
              return (
                <tr key={idx}>
                  <td>
                    <select
                      value={l.filter_id ?? ""}
                      onChange={(e) => updateLine(idx, { filter_id: e.target.value ? Number(e.target.value) : null })}
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
                      onChange={(e) => updateLine(idx, { exposures: Number(e.target.value) })}
                      style={{ width: 110 }}
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      value={l.exposure_sec}
                      onChange={(e) => updateLine(idx, { exposure_sec: Number(e.target.value) })}
                      style={{ width: 130 }}
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      value={l.gain ?? ""}
                      onChange={(e) => updateLine(idx, { gain: e.target.value === "" ? null : Number(e.target.value) })}
                      style={{ width: 72 }}
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      value={l.camera_offset ?? ""}
                      onChange={(e) =>
                        updateLine(idx, { camera_offset: e.target.value === "" ? null : Number(e.target.value) })
                      }
                      style={{ width: 72 }}
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      value={l.bin ?? ""}
                      onChange={(e) => updateLine(idx, { bin: e.target.value === "" ? null : Number(e.target.value) })}
                      style={{ width: 56 }}
                    />
                  </td>

                  <td>{fmtHMS(lineSec)}</td>

                  <td>
                    <button onClick={() => removeLine(idx)} style={{ padding: "4px 8px" }}>
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
        <button onClick={addLineCopyPrev}>Add filter line (copy last)</button>
        <button onClick={save}>Save</button>
        <button onClick={() => router.back()}>Cancel</button>
      </div>
    </main>
  );
}
