/**
 * E2E infrastructure. The offline scenario needs *genuine* offline — the
 * service worker fetches from its own context, which browser-side network
 * emulation doesn't reliably cover — so the spec owns a real `next start`
 * process and kills/restarts it to simulate airplane mode.
 */

import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** Minimal .env loader (Playwright doesn't load it; Next and Prisma do). */
export function loadDotEnv(): void {
  let text: string;
  try {
    text = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class AppServer {
  private proc: ChildProcess | null = null;
  private logs = "";

  constructor(private readonly port: number) {}

  get baseURL(): string {
    return `http://localhost:${this.port}`;
  }

  async start(): Promise<void> {
    this.logs = "";
    const nextBin = path.join(process.cwd(), "node_modules", ".bin", "next");
    this.proc = spawn(nextBin, ["start", "-p", String(this.port)], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        // Magic links must point at this port, not the .env dev URL.
        BETTER_AUTH_URL: this.baseURL,
        // Force console delivery of the magic link (lib/email.ts).
        RESEND_API_KEY: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    this.proc.stdout?.on("data", (d: Buffer) => (this.logs += d.toString()));
    this.proc.stderr?.on("data", (d: Buffer) => (this.logs += d.toString()));

    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      try {
        await fetch(this.baseURL, { method: "HEAD" });
        return; // any HTTP answer means the port is up
      } catch {
        await sleep(250);
      }
    }
    throw new Error(`next start not ready on :${this.port}\n${this.logs}`);
  }

  /** Airplane mode: connections to the origin now fail outright. */
  async stop(): Promise<void> {
    const proc = this.proc;
    this.proc = null;
    if (proc && proc.exitCode === null) {
      await new Promise<void>((resolve) => {
        proc.once("exit", () => resolve());
        proc.kill("SIGKILL");
      });
    }
    // Don't return before the port actually refuses connections.
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      try {
        await fetch(this.baseURL, { method: "HEAD" });
        await sleep(200);
      } catch {
        return;
      }
    }
    throw new Error(`port :${this.port} still answering after stop()`);
  }

  /**
   * Wait for a line, and consume the log up to it. Magic links are
   * single-use while the buffer spans the whole run — without consuming,
   * a second sign-in would be handed the first one's already spent token
   * and silently stay signed out.
   */
  async waitForLog(re: RegExp, timeoutMs = 20_000): Promise<RegExpExecArray> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const m = re.exec(this.logs);
      if (m) {
        this.logs = this.logs.slice(m.index + m[0].length);
        return m;
      }
      await sleep(200);
    }
    throw new Error(`log never matched ${re}\n--- server logs ---\n${this.logs}`);
  }
}
