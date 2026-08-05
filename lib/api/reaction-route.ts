/**
 * Handler behind POST /api/v1/observations/:id/confirm. Confirmation is the
 * only reaction: the dispute half was retired in August 2026 (DOMAIN.md
 * § Confirmation), leaving this as the one shape of "+1".
 */

import { randomUUID } from "node:crypto";

import { getSession } from "@/lib/auth";
import { reactToObservation } from "@/lib/db/observations";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handleReaction(
  request: Request,
  observationId: string,
): Promise<Response> {
  const session = await getSession(request);
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!UUID_RE.test(observationId)) {
    return Response.json({ error: "invalid_id" }, { status: 422 });
  }

  // Optional client UUID (offline outbox idempotency); server-side otherwise.
  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
  } | null;
  const reactionId =
    typeof body?.id === "string" && UUID_RE.test(body.id)
      ? body.id.toLowerCase()
      : randomUUID();

  const result = await reactToObservation(
    reactionId,
    observationId.toLowerCase(),
    session.user.id,
  );
  switch (result.outcome) {
    case "ok":
      return Response.json({ ok: true }, { status: 200 });
    case "observation_not_found":
      return Response.json({ error: "observation_not_found" }, { status: 404 });
    case "own_observation":
      return Response.json({ error: "own_observation" }, { status: 403 });
  }
}
