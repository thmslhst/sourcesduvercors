/**
 * Account deletion — by anonymisation, not erasure.
 *
 * A hard delete is not available and would be the wrong thing anyway:
 * observations and reactions reference `user` with RESTRICT, and cascading
 * would destroy data other hikers depend on (a confirmed "à sec" would revert
 * to `unknown`, and other users' reactions would lose their target). That is
 * the append-only tenet doing its job — DATABASE.md § Design tenets.
 *
 * So we destroy the personal data on the row and keep the row: the email is
 * overwritten with an address that can never receive a magic link, the name is
 * blanked, and every session and OAuth account is dropped so all devices are
 * signed out. What remains is an observation attached to an opaque id, which
 * is no longer personal data. Nothing on the map changes — after the display
 * name was dropped there was never anything personal published there.
 */

import { prisma } from "./client";

/**
 * `.invalid` is reserved by RFC 2606 and can never resolve, so the address is
 * unusable by construction; the UUID keeps the UNIQUE constraint on email
 * satisfied across repeat deletions.
 */
function anonymousEmail(): string {
  return `deleted+${crypto.randomUUID()}@invalid`;
}

/**
 * Idempotent: anonymising an already-anonymised account is a no-op, so a
 * retried request can't churn a second address in.
 */
export async function anonymizeUser(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { deletedAt: true },
    });
    if (!user || user.deletedAt !== null) return;

    // Signs the account out everywhere. `account` holds the credential
    // records Better Auth would authenticate against.
    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });

    await tx.user.update({
      where: { id: userId },
      data: {
        email: anonymousEmail(),
        emailVerified: false,
        name: "",
        image: null,
        deletedAt: new Date(),
      },
    });
  });
}
