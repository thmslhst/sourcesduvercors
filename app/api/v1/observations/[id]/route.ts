/**
 * DELETE /api/v1/observations/:id — moderation soft-delete (admin only).
 * Observations are never hard-deleted (DATABASE.md design tenets).
 */

import { getSession, isAdmin } from "@/lib/auth";
import { softDeleteObservation } from "@/lib/db/observations";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession(request);
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const deleted = await softDeleteObservation(id.toLowerCase());
  if (!deleted) {
    return Response.json({ error: "observation_not_found" }, { status: 404 });
  }
  return Response.json({ ok: true }, { status: 200 });
}
