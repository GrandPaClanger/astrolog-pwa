"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

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

function MagnifierIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      style={{ opacity: 0.75 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10.5 18.5C14.6421 18.5 18 15.1421 18 11C18 6.85786 14.6421 3.5 10.5 3.5C6.35786 3.5 3 6.85786 3 11C3 15.1421 6.35786 18.5 10.5 18.5Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M21 21L16.65 16.65"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

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
    }, 250);

    return () => clearTimeout(handle);
  }, [query, open]);

  const pick = (it: CatalogItem) => {
    onPick({
      catalog_no: (it.catalog_no ?? "").trim(),
      description: (it.description ?? "").trim(),
    });
    setQ("");
    setOpen(false);
  };

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <label style={{ display: "block", marginBottom: 6 }}>Catalog Search</label>

      <div style={{ position: "relative" }}>
        <div
          style={{
            position: "absolute",
            left: 10,
            top: "50%",
            transform: "translateY(-50%)",
          }}
        >
          <MagnifierIcon />
        </div>

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
            <div style={{ padding: 12, opacity: 0.8 }}>Type 2+ characters…</div>
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
                <div style={{ opacity: 0.85, fontSize: 13 }}>{it.description}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
