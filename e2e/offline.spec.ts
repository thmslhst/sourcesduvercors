/**
 * ROADMAP Phase 3 exit criteria, as one scenario: a phone in airplane mode
 * can browse sources with statuses and queue an observation that syncs
 * later. "Airplane mode" is real here — the server process is killed, so
 * page fetches AND service-worker fetches fail alike.
 *
 * Requires a production build with NEXT_PUBLIC_E2E=1 (the __selectSource
 * hook) — `npm run test:e2e` does both.
 */

import { test, expect, type Page } from "@playwright/test";

import { cleanupE2eUser } from "./db";
import { AppServer, loadDotEnv } from "./helpers";

const PORT = 3210;
const E2E_EMAIL = "e2e-offline@sources-du-vercors.test";

let server: AppServer;

test.beforeAll(async () => {
  loadDotEnv();
  await cleanupE2eUser(E2E_EMAIL); // leftovers from an aborted run
  server = new AppServer(PORT);
  await server.start();
});

test.afterAll(async () => {
  await server.stop();
  await cleanupE2eUser(E2E_EMAIL);
});

/** Drive selection through the e2e hook — no flaky canvas-pixel clicks. */
async function selectSource(page: Page, id: string | null): Promise<void> {
  await page.waitForFunction(() => "__selectSource" in window);
  await page.evaluate(
    (sourceId) =>
      (
        window as unknown as {
          __selectSource: (id: string | null) => void;
        }
      ).__selectSource(sourceId),
    id,
  );
}

/** Polled via waitForFunction: is the sources snapshot persisted locally? */
const snapshotInIdb = () =>
  new Promise<boolean>((resolve) => {
    const req = indexedDB.open("sdv-offline");
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("snapshot")) {
        db.close();
        resolve(false);
        return;
      }
      const get = db
        .transaction("snapshot")
        .objectStore("snapshot")
        .get("current");
      get.onsuccess = () => {
        db.close();
        resolve(get.result != null);
      };
      get.onerror = () => {
        db.close();
        resolve(false);
      };
    };
    req.onerror = () => resolve(false);
  });

test("mode avion : consulter, signaler, reconnecter, synchroniser", async ({
  page,
}) => {
  // --- Online first visit: SW installs the app shell, snapshot lands in IDB.
  await page.goto(server.baseURL);
  await page.waitForFunction(
    () => navigator.serviceWorker.controller !== null,
    undefined,
    { timeout: 30_000 },
  );
  await page.waitForFunction(snapshotInIdb, undefined, { timeout: 15_000 });

  // A real source to act on (the snapshot is the source of truth).
  const res = await page.request.get(`${server.baseURL}/api/v1/sources`);
  const snapshot = (await res.json()) as { sources: { id: string }[] };
  const sourceId = snapshot.sources[0].id;

  // --- Magic-link sign-in; without RESEND_API_KEY the link goes to stdout.
  await selectSource(page, sourceId);
  await page.getByPlaceholder("Votre e-mail").fill(E2E_EMAIL);
  await page.getByPlaceholder(/Nom affiché/).fill("E2E hors ligne");
  await page.getByRole("button", { name: /Recevoir le lien/ }).click();
  const link = await server.waitForLog(
    /Lien de connexion pour \S+ : (http\S+)/,
  );
  await page.goto(link[1]); // verifies the token, redirects to /
  await selectSource(page, sourceId);
  await expect(page.getByText(/Signaler l.état actuel/)).toBeVisible();
  // Session mirror + snapshot must both be persisted before going dark.
  await page.waitForFunction(
    () => localStorage.getItem("sdv-session-user") !== null,
  );
  await page.waitForFunction(snapshotInIdb);

  // --- Download the basemap for offline use: size is shown *before* the
  // download starts (ROADMAP Phase 3), then the archive lands in Cache
  // Storage. Close the sheet first — it covers the corner button on mobile.
  await selectSource(page, null);
  await page.getByRole("button", { name: "Carte hors ligne" }).click();
  const downloadButton = page.getByRole("button", { name: /^Télécharger \(\d+ Mo\)$/ });
  await expect(downloadButton).toBeVisible();
  await downloadButton.click();
  await expect(page.getByText(/Fond de carte disponible hors ligne/)).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole("button", { name: "Carte hors ligne" }).click(); // close

  // --- Airplane mode.
  await server.stop();
  await page.reload();

  // The service worker serves the downloaded archive to MapLibre's Range
  // requests even with the server gone.
  const rangeStatus = await page.evaluate(async () => {
    const res = await fetch("/basemap/vercors.pmtiles", {
      headers: { Range: "bytes=0-16383" },
    });
    return res.status;
  });
  expect(rangeStatus).toBe(206);

  // Shell and data render from cache — and say so honestly.
  await expect(page.getByText("Sources du Vercors").first()).toBeVisible();
  await expect(page.getByText(/Hors ligne — données/)).toBeVisible();

  // Browse offline, then queue an observation (form still there thanks to
  // the mirrored session).
  await selectSource(page, sourceId);
  await page.getByRole("button", { name: "Coule bien" }).click();
  await page.getByRole("button", { name: "Envoyer", exact: true }).click();
  await expect(page.getByText(/Enregistrée hors ligne/)).toBeVisible();
  await expect(page.getByText("1 contribution à envoyer")).toBeVisible();

  // --- Reconnect: app focus is a sync trigger (the iOS-safe one).
  await server.start();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText(/contribution(s)? à envoyer/)).toHaveCount(0, {
    timeout: 30_000,
  });

  // The observation is really on the server: history shows it as ours,
  // and the staleness indicator is gone after the post-sync re-fetch.
  await selectSource(page, null);
  await selectSource(page, sourceId);
  await expect(page.getByText("votre observation")).toBeVisible();
  await expect(page.getByText(/Hors ligne — données/)).toHaveCount(0);
});
