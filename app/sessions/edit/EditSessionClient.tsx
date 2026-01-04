"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type SessionRow = {
  session_id: number;
  target_id: number;
  session_date: string | null;
  location_id: number | null;
  telescope_id: number | null;
  mount_id: number | null;
  camera_id: number | null;
  notes: string | null;
};

type OptionRow = { id: number; name: string };

export default function EditSessionClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const sessionId = Number(sp.get("session_id") || 0);

  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<SessionRow | null>(null);

  const [locations, setLocations] = useState<OptionRow[]>([]);
  const [telescopes, setTelescopes] = useState<OptionRow[]>([]);
  const [mounts, setMounts] = useState<OptionRow[]>([]);
  const [cameras, setCameras] = useState<OptionRow[]>([]);

  useEffect(() => {
    (async () => {
      if (!sessionId) return;

      const s = await supabase
        .from("session")
        .select(
          "session_id,target_id,session_date,location_id,telescope_id,mount_id,camera_id,notes"
        )
        .eq("session_id", sessionId)
        .single();

      if (s.error) {
        alert(s.error.message);
        setLoading(false);
        return;
      }
      setRow(s.data as SessionRow);

      const [l, t, m, c] = await Promise.all([
        supabase.from("location").select("location_id,name").order("name"),
        supabase.from("telescope").select("telescope_id,name").order("name"),
        supabase.from("mount").select("mount_id,name").order("name"),
        supabase.from("camera").select("camera_id,name").order("name"),
      ]);

      if (!l.error) setLocations(((l.data as any) ?? []).map((x: any) => ({ id: x.location_id, name: x.name })));
      if (!t.error) setTelescopes(((t.data as any) ?? []).map((x: any) => ({ id: x.telescope_id, name: x.name })));
      if (!m.error) setMounts(((m.data as any) ?? []).map((x: any) => ({ id: x.mount_id, name: x.name })));
      if (!c.error) setCameras(((c.data as any) ?? []).map((x: any) => ({ id: x.camera_id, name: x.name })));

      setLoading(false);
    })();
  }, [sessionId]);

  async function save() {
    if (!row) return;

    const { error } = await supabase
      .from("session")
      .update({
        session_date: row.session_date,
        location_id: row.location_id,
        telescope_id: row.telescope_id,
        mount_id: row.mount_id,
        camera_id: row.camera_id,
        notes: row.notes,
      })
      .eq("session_id", row.session_id);

    if (error) return alert(error.message);

    router.push(`/targets/${row.target_id}`);
    router.refresh();
  }

  if (loading) return <div>Loading…</div>;
  if (!row) return <div>Not found</div>;

  return (
    <>
      <h1>Edit Session #{row.session_id}</h1>

      <label>Session date</label>
      <input
        value={row.session_date ?? ""}
        onChange={(e) => setRow({ ...row, session_date: e.target.value || null })}
        placeholder="YYYY-MM-DD"
        style={{ width: "100%", margin: "6px 0 12px" }}
      />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 240px" }}>
          <label>Location</label>
          <select
            value={row.location_id ?? ""}
            onChange={(e) =>
              setRow({ ...row, location_id: e.target.value ? Number(e.target.value) : null })
            }
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

        <div style={{ flex: "1 1 240px" }}>
          <label>Telescope</label>
          <select
            value={row.telescope_id ?? ""}
            onChange={(e) =>
              setRow({ ...row, telescope_id: e.target.value ? Number(e.target.value) : null })
            }
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

        <div style={{ flex: "1 1 240px" }}>
          <label>Mount</label>
          <select
            value={row.mount_id ?? ""}
            onChange={(e) =>
              setRow({ ...row, mount_id: e.target.value ? Number(e.target.value) : null })
            }
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

        <div style={{ flex: "1 1 240px" }}>
          <label>Camera</label>
          <select
            value={row.camera_id ?? ""}
            onChange={(e) =>
              setRow({ ...row, camera_id: e.target.value ? Number(e.target.value) : null })
            }
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
        value={row.notes ?? ""}
        onChange={(e) => setRow({ ...row, notes: e.target.value || null })}
        rows={6}
        style={{ width: "100%", margin: "6px 0 12px" }}
      />

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={save}>Save</button>
        <button onClick={() => router.back()}>Cancel</button>
      </div>
    </>
  );
}
