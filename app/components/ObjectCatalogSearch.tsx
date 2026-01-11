"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Search } from "lucide-react";

type CatalogItem = {
  catalog_no: string;
  description: string | null;
};

type Props = {
  valueCatalogNo: string;
  valueDescription: string;
  onPick: (item: { catalog_no: string; description: string }) => void;
  placeholder?: string;
};

export default function ObjectCatalogSearch({
  valueCatalogNo,
  valueDescription,
  onPick,
  placeholder = "Search catalog (e.g. M57, IC 2359, Thor...)",
}: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);

  const boxRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const query = useMemo(() => q.trim(), [q]);

  useEffect(() => {
    if (!open) return;

    const handle = setTimeout(async () => {
      if (query.length < 2) {
        setItems([]);
        return;
      }

      setLoading(true);
      const like = `%${query}%`;

      const { data, error } = await supabase
        .from("object_catalog")
        .select("catalog_no,description")
        .or(`catalog_no.ilike.${like},description.ilike.${like}`)
        .order("catalog_no", { ascending: true })
        .limit(25);

      setLoading(false);

      if (error) {
        console.error(error);
        setItems([]);
        return;
      }

      setItems((data ?? []) as CatalogItem[]);
    }, 250); // debounce

    return () => clearTimeout(handle);
  }, [query, open]);

  const pick = (it: CatalogItem) => {
    const description = (it.description ?? "").trim();
    onPick({ catalog_no: it.catalog_no.trim(), description });
    setQ("");
    setOpen(false);
  };

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <label style={{ display: "block", marginBottom: 6 }}>Catalog Search</label>

      <div style={{ position: "relative" }}>
        <Search
          size={18}
          style={{
            position: "absolute",
            left: 10,
            top: "50%",
            transform: "translateY(-50%)",
            opacity: 0.7,
          }}
        />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          style={{
            width: "100%",
            padding: "10px 12px 10px 36px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(0,0,0,0.35)",
            color: "white",
          }}
        />
      </div>

      {/* Selected preview (optional) */}
      {(valueCatalogNo || valueDescription) && (
        <div style={{ marginTop: 8, opacity: 0.9, fontSize: 13 }}>
          <div>
            <strong>{valueCatalogNo}</strong>
          </div>
          <div>{valueDescription}</div>
        </div>
      )}

      {open && (
        <div
          style={{
            position: "absolute",
            zIndex: 50,
            width: "100%",
            marginTop: 8,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(0,0,0,0.95)",
            maxHeight: 320,
            overflow: "auto",
          }}
        >
          {query.length < 2 ? (
            <div style={{ padding: 12, opacity: 0.8 }}>
              Type 2+ characters…
            </div>
          ) : loading ? (
            <div style={{ padding: 12, opacity: 0.8 }}>Searching…</div>
          ) : items.length === 0 ? (
            <div style={{ padding: 12, opacity: 0.8 }}>No matches.</div>
          ) : (
            items.map((it) => (
              <button
                key={it.catalog_no}
                type="button"
                onClick={() => pick(it)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: 12,
                  border: 0,
                  background: "transparent",
                  color: "white",
                  cursor: "pointer",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div style={{ fontWeight: 700 }}>{it.catalog_no}</div>
                <div style={{ opacity: 0.85, fontSize: 13 }}>
                  {it.description}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
