/**
 * DELETE /api/v1/observations/:id — soft-delete, by one of two actors:
 * an admin removing abuse, or the author retracting their own observation
 * after a mis-tap. Observations are never hard-deleted (DATABASE.md design
 * tenets); retracting the latest one simply revives the previous status.
 */

import { getSession, isAdmin } from "@/lib/auth";
import {
  softDeleteObservation,
  softDeleteOwnObservation,
} from "@/lib/db/observations";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession(request);
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (isAdmin(session)) {
    const deleted = await softDeleteObservation(id.toLowerCase());
    if (!deleted) {
      return Response.json({ error: "observation_not_found" }, { status: 404 });
    }
    return Response.json({ ok: true }, { status: 200 });
  }

  const result = await softDeleteOwnObservation(
    id.toLowerCase(),
    session.user.id,
  );
  if (result === "not_found") {
    return Response.json({ error: "observation_not_found" }, { status: 404 });
  }
  if (result === "forbidden") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  return Response.json({ ok: true }, { status: 200 });
}
