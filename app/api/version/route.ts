export const dynamic = "force-dynamic";

export async function GET() {
  const buildTag = process.env.NEXT_PUBLIC_BUILD_TAG ?? "dev";
  return Response.json(
    { buildTag, now: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
