/**
 * GET /api/v1/sources/:id — source detail + recent observation history
 * (ARCHITECTURE.md § API). Reading requires no account; a session only
 * adds the viewer's own reaction state to each history entry.
 */

import { getSession } from "@/lib/auth";
import { listObservationHistory } from "@/lib/db/observations";
import { getSourceSnapshot } from "@/lib/db/sources-snapshot";
import type { SourceDetail } from "@/lib/domain/detail";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  if (!UUID_RE.test(rawId)) {
    return Response.json({ error: "invalid_id" }, { status: 422 });
  }
  const id = rawId.toLowerCase();

  const [session, source] = await Promise.all([
    getSession(request),
    getSourceSnapshot(id),
  ]);
  if (!source) {
    return Response.json({ error: "source_not_found" }, { status: 404 });
  }

  const detail: SourceDetail = {
    source,
    observations: await listObservationHistory(
      id,
      session?.user.id ?? null,
    ),
  };
  return Response.json(detail, {
    headers: { "Cache-Control": "no-store" },
  });
}
