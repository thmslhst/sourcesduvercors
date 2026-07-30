/**
 * Observation & reaction persistence. Observations are append-only facts:
 * create + soft-delete only. Soft-delete has two actors — an admin removing
 * abuse, and an author retracting their own mis-tap — and neither rewrites
 * the record. A reaction is the one editable record: a user may change
 * their mind (confirm ⇄ dispute) on the same observation.
 */

import { Prisma } from "@prisma/client";

import { prisma } from "./client";
import type { ReactionType } from "../domain/constants";
import type { ObservationHistoryItem } from "../domain/detail";
import type { ObservationInput } from "../domain/observation-input";

export type CreateObservationResult =
  | { outcome: "created" | "already_exists" }
  | { outcome: "source_not_found" | "id_conflict" };

/**
 * Idempotent create keyed on the client-generated UUID: replaying the same
 * observation (offline outbox, Phase 3) is a no-op; the same id from a
 * different user is a conflict.
 */
export async function createObservation(
  input: ObservationInput,
  userId: string,
): Promise<CreateObservationResult> {
  const source = await prisma.waterSource.findUnique({
    where: { id: input.sourceId },
    select: { isActive: true },
  });
  if (!source?.isActive) {
    return { outcome: "source_not_found" };
  }

  const existing = await prisma.observation.findUnique({
    where: { id: input.id },
    select: { userId: true },
  });
  if (existing) {
    return existing.userId === userId
      ? { outcome: "already_exists" }
      : { outcome: "id_conflict" };
  }

  try {
    await prisma.observation.create({
      data: {
        id: input.id,
        sourceId: input.sourceId,
        userId,
        status: input.status,
        tags: input.tags,
        observedAt: input.observedAt,
      },
    });
  } catch (e) {
    // Concurrent replay of the same UUID: unique violation → idempotent OK.
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { outcome: "already_exists" };
    }
    throw e;
  }
  return { outcome: "created" };
}

export type ReactResult =
  | { outcome: "ok" }
  | { outcome: "observation_not_found" | "own_observation" };

/**
 * Upsert the viewer's reaction on an observation (one per user per
 * observation — UNIQUE in DATABASE.md). Reacting to your own observation
 * would be self-inflation; refused.
 */
export async function reactToObservation(
  reactionId: string,
  observationId: string,
  userId: string,
  type: ReactionType,
): Promise<ReactResult> {
  const observation = await prisma.observation.findUnique({
    where: { id: observationId },
    select: { userId: true, deletedAt: true },
  });
  if (!observation || observation.deletedAt !== null) {
    return { outcome: "observation_not_found" };
  }
  if (observation.userId === userId) {
    return { outcome: "own_observation" };
  }

  await prisma.observationReaction.upsert({
    where: { observationId_userId: { observationId, userId } },
    create: { id: reactionId, observationId, userId, type },
    // Changing confirm ⇄ dispute is the one permitted update; a re-reaction
    // also revives a moderation-deleted one (the user re-stated an opinion).
    update: { type, deletedAt: null },
  });
  return { outcome: "ok" };
}

/** Latest non-deleted observations of a source, newest first. */
export async function listObservationHistory(
  sourceId: string,
  viewerUserId: string | null,
  limit = 10,
): Promise<ObservationHistoryItem[]> {
  const observations = await prisma.observation.findMany({
    where: { sourceId, deletedAt: null },
    orderBy: { observedAt: "desc" },
    take: limit,
    include: {
      // No author join: observations are attributable internally (userId),
      // never published under a name — DOMAIN.md § Users & trust.
      reactions: {
        where: { deletedAt: null },
        select: { userId: true, type: true },
      },
    },
  });

  return observations.map((o) => ({
    id: o.id,
    status: o.status,
    tags: o.tags,
    observedAt: o.observedAt.toISOString(),
    confirmationCount: o.reactions.filter((r) => r.type === "confirm").length,
    disputeCount: o.reactions.filter((r) => r.type === "dispute").length,
    isMine: o.userId === viewerUserId,
    myReaction:
      viewerUserId === null
        ? null
        : (o.reactions.find((r) => r.userId === viewerUserId)?.type ?? null),
  }));
}

/** Moderation soft-delete (admin only — checked by the route). */
export async function softDeleteObservation(id: string): Promise<boolean> {
  const { count } = await prisma.observation.updateMany({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  return count > 0;
}

export type RetractResult = "ok" | "not_found" | "forbidden";

/**
 * Author retraction: withdrawing your own observation after a mis-tap.
 * Still a soft-delete, so the record is never rewritten — and because the
 * derived status reads the latest *non-deleted* observation, retracting the
 * newest one simply revives the previous answer with no extra work.
 */
export async function softDeleteOwnObservation(
  id: string,
  userId: string,
): Promise<RetractResult> {
  const observation = await prisma.observation.findUnique({
    where: { id },
    select: { userId: true, deletedAt: true },
  });
  if (!observation || observation.deletedAt !== null) return "not_found";
  if (observation.userId !== userId) return "forbidden";

  await prisma.observation.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return "ok";
}
