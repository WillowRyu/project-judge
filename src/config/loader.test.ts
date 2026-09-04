import { afterEach, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { loadConfig } from "./loader";
import { MagiConfigSchema } from "./schema";

let tmp: string | undefined;

function workspace(files: Record<string, string>): string {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "magi-config-"));
  for (const [relativePath, content] of Object.entries(files)) {
    const target = path.join(tmp, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return tmp;
}

afterEach(() => {
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  tmp = undefined;
});

describe("loadConfig", () => {
  it("discovers the first supported config path and applies documented defaults", async () => {
    const root = workspace({
      ".magi.yml": "output:\n  language: en\n",
      ".github/magi.yaml": "output:\n  language: ko\n",
    });

    const config = await loadConfig(root);

    expect(config.output.language).toBe("ko");
    expect(config.voting.total_voters).toBe(3);
    expect(config.optimization.max_diff_tokens).toBe(30000);
    expect(config.optimization.max_tokens_per_file).toBe(2500);
    expect(config.ignore.files).toContain("pnpm-lock.yaml");
  });

  it("rejects an explicit missing configuration file instead of silently using defaults", async () => {
    const root = workspace({});

    await expect(loadConfig(root, ".github/missing.yml")).rejects.toThrow(
      "Configuration file not found",
    );
  });

  it("allows deliberate replacement of default ignore patterns", async () => {
    const root = workspace({
      ".magi.yml": "ignore:\n  use_defaults: false\n  files:\n    - custom/**\n",
    });

    const config = await loadConfig(root);

    expect(config.ignore.files).toEqual(["custom/**"]);
  });

  it("rejects config paths that escape the workspace", async () => {
    const root = workspace({});

    await expect(loadConfig(root, "../outside.yml")).rejects.toThrow(
      "Unsafe workspace-relative path",
    );
  });

  it("rejects a discovered config symlink that resolves outside the workspace", async () => {
    const root = workspace({});
    const outside = path.join(os.tmpdir(), `magi-outside-${Date.now()}.yml`);
    fs.writeFileSync(outside, "version: 1\n");
    fs.mkdirSync(path.join(root, ".github"), { recursive: true });
    fs.symlinkSync(outside, path.join(root, ".github", "magi.yml"));

    await expect(loadConfig(root)).rejects.toThrow("resolves outside the workspace");
    fs.rmSync(outside, { force: true });
  });
});

describe("MagiConfigSchema", () => {
  it("rejects unknown keys, wrong versions, and invalid numeric settings", () => {
    for (const value of [
      { unknown: true },
      { version: 2 },
      { provider: { type: "openai", model: "" } },
      { optimization: { max_diff_tokens: 0 } },
      { debate: { max_rounds: 6 } },
    ]) {
      expect(() => MagiConfigSchema.parse(value)).toThrow();
    }
  });

  it("rejects empty or duplicate persona definitions and invalid quorum metadata", () => {
    for (const value of [
      { personas: [] },
      { personas: [{ id: "security" }, { id: "security" }], voting: { required_approvals: 1 } },
      { personas: [{ id: "security" }], voting: { required_approvals: 2 } },
      { personas: [{ id: "security" }], voting: { required_approvals: 1, total_voters: 3 } },
      { personas: [{ id: "../security" }], voting: { required_approvals: 1 } },
    ]) {
      expect(() => MagiConfigSchema.parse(value)).toThrow();
    }
  });
});
