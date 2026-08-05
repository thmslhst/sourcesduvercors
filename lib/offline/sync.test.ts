/**
 * Replay classification. The distinction that matters: a 401 keeps the item
 * and reports "auth", because no retry can clear it — the UI has to ask for
 * a sign-in or the queue wedges forever (the pre-deferred-auth behaviour).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { flushOutbox } from "./sync";
import {
  listOutbox,
  reactionOutboxKey,
  removeOutboxItem,
  type OutboxItem,
} from "./outbox";

// Only the IDB-backed reads/writes are stubbed; the key helper is the real
// one, since the dedup invariant is exactly what it encodes.
vi.mock("./outbox", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./outbox")>()),
  listOutbox: vi.fn(),
  removeOutboxItem: vi.fn(async () => {}),
}));

const OBSERVATION: OutboxItem = {
  kind: "observation",
  id: "11111111-1111-4111-8111-111111111111",
  enqueuedAt: "2026-08-01T10:00:00.000Z",
  body: {
    id: "11111111-1111-4111-8111-111111111111",
    sourceId: "22222222-2222-4222-8222-222222222222",
    status: "flowing",
    observedAt: "2026-08-01T10:00:00.000Z",
  },
};

function respond(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.mocked(listOutbox).mockResolvedValue([OBSERVATION]);
  vi.mocked(removeOutboxItem).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("flushOutbox", () => {
  it("sends and removes an accepted item", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respond(201, { id: OBSERVATION.id })));

    const result = await flushOutbox();

    expect(result).toMatchObject({ sent: 1, remaining: 0, blockedBy: null });
    expect(result.dropped).toEqual([]);
    expect(removeOutboxItem).toHaveBeenCalledWith(OBSERVATION.id);
  });

  it("keeps the item and reports auth on 401 — only a sign-in clears it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respond(401, { error: "unauthorized" })),
    );

    const result = await flushOutbox();

    expect(result).toMatchObject({ sent: 0, remaining: 1, blockedBy: "auth" });
    expect(removeOutboxItem).not.toHaveBeenCalled();
  });

  it("keeps the item and reports offline when the fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    const result = await flushOutbox();

    expect(result).toMatchObject({ remaining: 1, blockedBy: "offline" });
    expect(removeOutboxItem).not.toHaveBeenCalled();
  });

  it("keeps the item and reports server on 5xx", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respond(500)));

    const result = await flushOutbox();

    expect(result).toMatchObject({ remaining: 1, blockedBy: "server" });
  });

  it("drops a stale observation as too_old, so the loss is reportable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respond(422, { error: "observed_at_too_old" })),
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await flushOutbox();

    expect(result).toMatchObject({ sent: 0, remaining: 0, blockedBy: null });
    expect(result.dropped).toEqual(["too_old"]);
    expect(removeOutboxItem).toHaveBeenCalledWith(OBSERVATION.id);
  });

  it("drops other terminal 4xx rather than wedging the queue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respond(409, { error: "id_conflict" })),
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await flushOutbox();

    expect(result.dropped).toEqual(["other"]);
    expect(removeOutboxItem).toHaveBeenCalledWith(OBSERVATION.id);
  });

  it("posts a reaction under its own UUID, not its outbox key", async () => {
    const observationId = "44444444-4444-4444-8444-444444444444";
    const reaction: OutboxItem = {
      kind: "reaction",
      // The key is derived from the observation, so it is deliberately not a
      // UUID and must never reach the API as the reaction's id.
      id: reactionOutboxKey(observationId),
      reactionId: "55555555-5555-4555-8555-555555555555",
      enqueuedAt: "2026-08-01T10:00:00.000Z",
      observationId,
      type: "confirm",
    };
    vi.mocked(listOutbox).mockResolvedValue([reaction]);
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
      async () => respond(200, { ok: true }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await flushOutbox();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`/api/v1/observations/${observationId}/confirm`);
    expect(JSON.parse(init.body as string)).toEqual({
      id: reaction.reactionId,
    });
  });

  it("falls back to the item id for reactions queued before the split", async () => {
    const legacy = {
      kind: "reaction",
      id: "66666666-6666-4666-8666-666666666666",
      enqueuedAt: "2026-08-01T10:00:00.000Z",
      observationId: "44444444-4444-4444-8444-444444444444",
      type: "dispute",
    } as unknown as OutboxItem; // no reactionId — persisted by an older build
    vi.mocked(listOutbox).mockResolvedValue([legacy]);
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
      async () => respond(200, { ok: true }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await flushOutbox();

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({ id: legacy.id });
  });

  it("gives one observation exactly one reaction slot", () => {
    const a = "44444444-4444-4444-8444-444444444444";
    const b = "77777777-7777-4777-8777-777777777777";
    // Same observation → same key, so idbPut (keyPath "id") replaces rather
    // than appends: re-tapping can't inflate the pending count.
    expect(reactionOutboxKey(a)).toBe(reactionOutboxKey(a));
    expect(reactionOutboxKey(a)).not.toBe(reactionOutboxKey(b));
  });

  it("stops at the first blocked item, preserving order", async () => {
    const second: OutboxItem = {
      ...OBSERVATION,
      id: "33333333-3333-4333-8333-333333333333",
      enqueuedAt: "2026-08-01T11:00:00.000Z",
    };
    vi.mocked(listOutbox).mockResolvedValue([OBSERVATION, second]);
    const fetchMock = vi.fn(async () => respond(401, { error: "unauthorized" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await flushOutbox();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ remaining: 2, blockedBy: "auth" });
  });
});
