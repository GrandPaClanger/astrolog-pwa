"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type SPEvent = {
  name: string;
  date_from: string;
  date_to: string;
};

type PlanItem = {
  plan_item_id: number;
  status: string;
  loaded: boolean;
  container_id: number | null;
  star_party_item: { name: string; category: string; sub_category: string | null };
  star_party_container: { name: string } | null;
};

type Container = {
  container_id: number;
  name: string;
  star_party_container_type: { name: string };
};

const STATUS_LABEL: Record<string, string> = {
  to_pick: "To Pick",
  picked: "Picked",
  packed: "Packed",
};

function fmtDate(d: string) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function PrintPage() {
  const params = useParams();
  const id = params.id as string;

  const [event, setEvent] = useState<SPEvent | null>(null);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [evRes, piRes, cRes] = await Promise.all([
      supabase
        .from("star_party_event")
        .select("name, date_from, date_to")
        .eq("event_id", id)
        .single(),
      supabase
        .from("star_party_plan_item")
        .select("plan_item_id, status, loaded, container_id, star_party_item(name, category, sub_category), star_party_container(name)")
        .eq("event_id", id)
        .order("status"),
      supabase
        .from("star_party_container")
        .select("container_id, name, star_party_container_type(name)")
        .eq("event_id", id)
        .order("container_type_id")
        .order("number"),
    ]);
    setEvent(evRes.data as SPEvent ?? null);
    setPlanItems((piRes.data as unknown as PlanItem[]) ?? []);
    setContainers((cRes.data as unknown as Container[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  if (loading) return <main style={{ padding: 16 }}><p style={{ opacity: 0.6 }}>Loading…</p></main>;
  if (!event) return <main style={{ padding: 16 }}><p>Event not found.</p></main>;

  const itemsByContainer: Record<number, PlanItem[]> = {};
  const loosePackedItems: PlanItem[] = [];
  const toPickItems: PlanItem[] = [];
  const pickedItems: PlanItem[] = [];

  for (const pi of planItems) {
    if (pi.status === "to_pick") {
      toPickItems.push(pi);
    } else if (pi.status === "picked") {
      pickedItems.push(pi);
    } else if (pi.status === "packed" || pi.loaded) {
      if (pi.container_id !== null) {
        if (!itemsByContainer[pi.container_id]) itemsByContainer[pi.container_id] = [];
        itemsByContainer[pi.container_id].push(pi);
      } else {
        loosePackedItems.push(pi);
      }
    }
  }

  const statusDot = (pi: PlanItem): string => {
    if (pi.loaded) return "Loaded";
    return STATUS_LABEL[pi.status] ?? pi.status;
  };

  const sectionHeadingStyle: React.CSSProperties = {
    fontSize: 15,
    fontWeight: 700,
    color: "#93c5fd",
    margin: "20px 0 8px",
    paddingBottom: 6,
    borderBottom: "1px solid rgba(255,255,255,0.15)",
  };

  const itemRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 4px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    fontSize: 14,
  };

  const badgeStyle = (status: string, loaded: boolean): React.CSSProperties => {
    if (loaded) return { padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600, background: "rgba(34,197,94,0.2)", color: "#86efac" };
    if (status === "to_pick") return { padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600, background: "rgba(251,191,36,0.2)", color: "#fbbf24" };
    if (status === "picked") return { padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600, background: "rgba(59,130,246,0.2)", color: "#93c5fd" };
    return { padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600, background: "rgba(34,197,94,0.2)", color: "#86efac" };
  };

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          * { color: black !important; background: transparent !important; border-color: #ccc !important; }
        }
      `}</style>

      <main style={{ padding: "16px", maxWidth: 600, margin: "0 auto", paddingBottom: 40 }}>
        {/* Back + Print — hidden on print */}
        <div className="no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <Link href={`/star-party/events/${id}`} style={{ fontSize: 13, opacity: 0.6, textDecoration: "none" }}>← Required Items</Link>
          <button
            onClick={() => window.print()}
            style={{
              padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: "#3b82f6", color: "white", border: "none", cursor: "pointer",
            }}
          >
            Print / Save PDF
          </button>
        </div>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: "0 0 4px", fontSize: 22 }}>{event.name}</h1>
          <p style={{ margin: 0, fontSize: 13, opacity: 0.55 }}>
            {fmtDate(event.date_from)} – {fmtDate(event.date_to)}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.4 }}>
            Packing list printed {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>

        {/* Container sections */}
        {containers.map(c => {
          const items = itemsByContainer[c.container_id] ?? [];
          if (items.length === 0) return null;
          return (
            <div key={c.container_id}>
              <div style={sectionHeadingStyle}>{c.name}</div>
              {items.map(pi => (
                <div key={pi.plan_item_id} style={itemRowStyle}>
                  <span>{pi.star_party_item.name}</span>
                  <span style={badgeStyle(pi.status, pi.loaded)}>{statusDot(pi)}</span>
                </div>
              ))}
            </div>
          );
        })}

        {/* Loose packed items */}
        {loosePackedItems.length > 0 && (
          <div>
            <div style={sectionHeadingStyle}>Loose Items (no container)</div>
            {loosePackedItems.map(pi => (
              <div key={pi.plan_item_id} style={itemRowStyle}>
                <span>{pi.star_party_item.name}</span>
                <span style={badgeStyle(pi.status, pi.loaded)}>{statusDot(pi)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Picked items */}
        {pickedItems.length > 0 && (
          <div>
            <div style={{ ...sectionHeadingStyle, color: "#93c5fd" }}>Picked — Not Yet Packed ({pickedItems.length})</div>
            {pickedItems.map(pi => (
              <div key={pi.plan_item_id} style={itemRowStyle}>
                <span>{pi.star_party_item.name}</span>
                <span style={badgeStyle(pi.status, pi.loaded)}>{statusDot(pi)}</span>
              </div>
            ))}
          </div>
        )}

        {/* To pick items */}
        {toPickItems.length > 0 && (
          <div>
            <div style={{ ...sectionHeadingStyle, color: "#fbbf24" }}>Still To Pick ({toPickItems.length})</div>
            {toPickItems.map(pi => (
              <div key={pi.plan_item_id} style={itemRowStyle}>
                <span>{pi.star_party_item.name}</span>
                <span style={badgeStyle(pi.status, pi.loaded)}>{statusDot(pi)}</span>
              </div>
            ))}
          </div>
        )}

        {planItems.length === 0 && (
          <p style={{ opacity: 0.5, textAlign: "center", marginTop: 40 }}>No items on this plan.</p>
        )}
      </main>
    </>
  );
}
