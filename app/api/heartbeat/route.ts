import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ua = req.headers.get("user-agent") ?? "";
  const isVercelCron = ua.includes("vercel-cron/1.0");

  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET ?? "";
  const expected = secret ? `Bearer ${secret}` : "";

  // Allow either:
  //  - Vercel Cron (User-Agent vercel-cron/1.0)
  //  - Authenticated ping with Bearer CRON_SECRET (GitHub Actions / manual)
  if (!isVercelCron && (!expected || auth !== expected)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!url || !anon) {
    return new Response("Missing Supabase env vars", { status: 500 });
  }

  // Lightweight REST call to record activity
  const res = await fetch(`${url}/rest/v1/target?select=target_id&limit=1`, {
    headers: {
      apikey: anon,
      authorization: `Bearer ${anon}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    return new Response(`Supabase ping failed: ${res.status} ${text}`, { status: 500 });
  }

  return Response.json({
    ok: true,
    supabase_status: res.status, // proof we reached Supabase
    ts: new Date().toISOString(),
  });
}
