/** POST /api/v1/observations/:id/dispute — "no longer matches" (auth). */

import { handleReaction } from "@/lib/api/reaction-route";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handleReaction(request, id, "dispute");
}
