import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { loadSettings, saveSettings, DEFAULT_CHIPS } from "./settings";

describe("loadSettings", () => {
  let dir: string;
  let path: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "casino-test-"));
    path = join(dir, "settings.json");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  test("returns defaults when file does not exist", () => {
    expect(loadSettings(path)).toEqual({ chips: DEFAULT_CHIPS });
  });

  test("returns defaults on corrupted JSON", () => {
    Bun.write(path, "not json{{{");
    expect(loadSettings(path)).toEqual({ chips: DEFAULT_CHIPS });
  });

  test("returns defaults when chips is not an array", () => {
    Bun.write(path, JSON.stringify({ chips: "nope" }));
    expect(loadSettings(path)).toEqual({ chips: DEFAULT_CHIPS });
  });

  test("returns defaults when chips has wrong length", () => {
    Bun.write(path, JSON.stringify({ chips: [10, 25, 50] }));
    expect(loadSettings(path)).toEqual({ chips: DEFAULT_CHIPS });
  });

  test("returns defaults when chips contains non-integers", () => {
    Bun.write(path, JSON.stringify({ chips: [10.5, 25, 50, 100] }));
    expect(loadSettings(path)).toEqual({ chips: DEFAULT_CHIPS });
  });

  test("returns defaults when chips contains values < 1", () => {
    Bun.write(path, JSON.stringify({ chips: [0, 25, 50, 100] }));
    expect(loadSettings(path)).toEqual({ chips: DEFAULT_CHIPS });
  });

  test("loads valid settings", () => {
    Bun.write(path, JSON.stringify({ chips: [5, 20, 75, 200] }));
    expect(loadSettings(path)).toEqual({ chips: [5, 20, 75, 200] });
  });
});

describe("saveSettings", () => {
  let dir: string;
  let path: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "casino-test-"));
    path = join(dir, "settings.json");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  test("writes settings to disk", () => {
    saveSettings({ chips: [5, 20, 75, 200] }, path);
    expect(JSON.parse(readFileSync(path, "utf-8"))).toEqual({ chips: [5, 20, 75, 200] });
  });

  test("roundtrips correctly", () => {
    const settings = { chips: [1, 50, 100, 500] };
    saveSettings(settings, path);
    expect(loadSettings(path)).toEqual(settings);
  });
});
