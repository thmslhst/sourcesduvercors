/**
 * E2E database hygiene: everything the offline spec creates hangs off one
 * dedicated user (a .test email that can never be a real hiker), and is
 * hard-deleted here before and after each run. This is test-data cleanup,
 * not a product path — the append-only rule applies to real observations.
 */

import { PrismaClient } from "@prisma/client";

export async function cleanupE2eUser(email: string): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.observationReaction.deleteMany({
        where: {
          OR: [{ userId: user.id }, { observation: { userId: user.id } }],
        },
      });
      await prisma.observation.deleteMany({ where: { userId: user.id } });
      // Sessions and accounts cascade with the user row.
      await prisma.user.delete({ where: { id: user.id } });
    }
    await prisma.verification.deleteMany({
      where: { identifier: { contains: email } },
    });
  } finally {
    await prisma.$disconnect();
  }
}
