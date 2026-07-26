/**
 * GET /api/v1/sources — full snapshot of active sources + derived status.
 * The offline sync payload (ARCHITECTURE.md): clients fetch it whole and,
 * from Phase 3, persist it to IndexedDB. ETag/If-None-Match keeps the
 * periodic re-fetch cheap when nothing changed.
 */

import { createHash } from "node:crypto";
import { listSourcesSnapshot } from "@/lib/db/sources-snapshot";
import { OSM_ATTRIBUTION, type SourcesSnapshot } from "@/lib/domain/snapshot";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const snapshot: SourcesSnapshot = {
    region: "vercors",
    attribution: OSM_ATTRIBUTION,
    sources: await listSourcesSnapshot(),
  };

  const body = JSON.stringify(snapshot);
  const etag = `"${createHash("sha256").update(body).digest("base64url")}"`;

  const headers = {
    ETag: etag,
    // Clients must revalidate, but a 304 costs nothing.
    "Cache-Control": "no-cache",
    "Content-Type": "application/json; charset=utf-8",
  };

  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(body, { status: 200, headers });
}
