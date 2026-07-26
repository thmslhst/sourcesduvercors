/**
 * POST /api/v1/observations — create an observation (auth required).
 * Idempotent by client-generated UUID: the Phase 3 outbox replays blindly
 * and must be able to re-send without duplicating (ARCHITECTURE.md).
 */

import { getSession } from "@/lib/auth";
import { createObservation } from "@/lib/db/observations";
import { parseObservationInput } from "@/lib/domain/observation-input";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = parseObservationInput(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 422 });
  }

  const result = await createObservation(parsed.value, session.user.id);
  switch (result.outcome) {
    case "created":
      return Response.json({ id: parsed.value.id }, { status: 201 });
    case "already_exists": // idempotent replay
      return Response.json({ id: parsed.value.id }, { status: 200 });
    case "source_not_found":
      return Response.json({ error: "source_not_found" }, { status: 404 });
    case "id_conflict":
      return Response.json({ error: "id_conflict" }, { status: 409 });
  }
}
