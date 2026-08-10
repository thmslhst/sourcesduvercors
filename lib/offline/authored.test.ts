/**
 * The device's memory of what it filed — the only answer to "is this my
 * observation?" available to a signed-out or offline sheet, and the guard
 * that stops it offering a confirmation the server refuses.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  isAuthoredHere,
  rememberAuthored,
  resetAuthoredCache,
} from "./authored";

function stubLocalStorage(): Map<string, string> {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  return store;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  stubLocalStorage();
  resetAuthoredCache();
});

describe("authored observations", () => {
  it("recognises an observation this device filed", () => {
    expect(isAuthoredHere("a")).toBe(false);
    rememberAuthored("a");
    expect(isAuthoredHere("a")).toBe(true);
    expect(isAuthoredHere("b")).toBe(false);
  });

  /** Sign-out clears the session, not the fact that we wrote it. */
  it("survives a reload, which is when the sheet needs it most", () => {
    rememberAuthored("a");
    resetAuthoredCache(); // as if the tab had been reopened
    expect(isAuthoredHere("a")).toBe(true);
  });

  it("keeps working when storage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    });
    resetAuthoredCache();

    expect(() => rememberAuthored("a")).not.toThrow();
    // In memory for this session at least; the server's own refusal is
    // still the real guard.
    expect(isAuthoredHere("a")).toBe(true);
  });

  it("ignores a corrupted store rather than throwing at render time", () => {
    const store = stubLocalStorage();
    store.set("sdv-authored-observations", "{not json");
    resetAuthoredCache();

    expect(isAuthoredHere("a")).toBe(false);
  });

  it("stays bounded, dropping the oldest ids first", () => {
    for (let i = 0; i < 250; i++) rememberAuthored(`id-${i}`);
    resetAuthoredCache();

    expect(isAuthoredHere("id-0")).toBe(false);
    expect(isAuthoredHere("id-249")).toBe(true);
  });
});
