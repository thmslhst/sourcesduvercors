/**
 * DELETE /api/v1/account — the signed-in user deletes their own account.
 *
 * "Delete" means anonymise (lib/db/users.ts): the personal data is destroyed
 * and every device is signed out, while the observations stay on the map
 * under an opaque id. Observations are append-only — DATABASE.md § Design
 * tenets — and removing them would degrade the answer for everyone else.
 */

import { getSession } from "@/lib/auth";
import { anonymizeUser } from "@/lib/db/users";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  await anonymizeUser(session.user.id);
  return Response.json({ ok: true }, { status: 200 });
}
