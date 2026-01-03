"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Target = {
  target_id: number;
  catalog_no: string;
  description: string | null;
  notes: string | null;
  target_type: string | null;
  constellation: string | null;
};

export default function EditTargetPage() {
  const { targetId } = useParams<{ targetId: string }>();
  const id = Number(targetId);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [t, setT] = useState<Target | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("target")
        .select("target_id,catalog_no,description,notes,target_type,constellation")
        .eq("target_id", id)
        .single();

      if (error) {
        alert(error.message);
        setLoading(false);
        return;
      }

      setT(data as Target);
      setLoading(false);
    })();
  }, [id]);

  async function save() {
    if (!t) return;

    const { error } = await supabase
      .from("target")
      .update({
        catalog_no: t.catalog_no.trim(),
        description: t.description,
        notes: t.notes,
        target_type: t.target_type,
        constellation: t.constellation,
      })
      .eq("target_id", id);

    if (error) return alert(error.message);

    router.push("/targets");
    router.refresh();
  }

  if (loading) return <div>Loading…</div>;
  if (!t) return <div>Not found</div>;

  return (
    <div style={{ maxWidth: 720 }}>
      <h1>Edit Target</h1>

      <label>Catalog No</label>
      <input value={t.catalog_no} onChange={(e) => setT({ ...t, catalog_no: e.target.value })} />

      <label>Description</label>
      <input value={t.description ?? ""} onChange={(e) => setT({ ...t, description: e.target.value })} />

      <label>Type</label>
      <input value={t.target_type ?? ""} onChange={(e) => setT({ ...t, target_type: e.target.value })} />

      <label>Constellation</label>
      <input value={t.constellation ?? ""} onChange={(e) => setT({ ...t, constellation: e.target.value })} />

      <label>Notes</label>
      <textarea rows={6} value={t.notes ?? ""} onChange={(e) => setT({ ...t, notes: e.target.value })} />

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={save}>Save</button>
        <button onClick={() => router.back()}>Cancel</button>
      </div>
    </div>
  );
}
