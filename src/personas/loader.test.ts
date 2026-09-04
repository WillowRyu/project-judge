import { afterEach, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { loadPersona } from "./loader";

let tmp: string | undefined;

afterEach(() => {
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  tmp = undefined;
});

describe("loadPersona", () => {
  it("passes through provider and model from config", async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "magi-"));
    const persona = await loadPersona(tmp, "melchior", {
      id: "melchior",
      provider: "openai",
      model: "gpt-5.2-pro",
    });
    expect(persona.provider).toBe("openai");
    expect(persona.model).toBe("gpt-5.2-pro");
    expect(persona.name).toBe("MELCHIOR");
  });

  it("applies configured metadata to a builtin persona", async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "magi-"));

    const persona = await loadPersona(tmp, "melchior", {
      id: "melchior",
      name: "Architecture reviewer",
      emoji: "🏗️",
      role: "Architecture",
    });

    expect(persona.name).toBe("Architecture reviewer");
    expect(persona.emoji).toBe("🏗️");
    expect(persona.role).toBe("Architecture");
  });

  it("uses an explicit guideline before a convention file and appends common guidance once", async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "magi-"));
    fs.mkdirSync(path.join(tmp, ".magi"), { recursive: true });
    fs.mkdirSync(path.join(tmp, "policies"), { recursive: true });
    fs.writeFileSync(path.join(tmp, ".magi", "security.md"), "convention guidance");
    fs.writeFileSync(path.join(tmp, ".magi", "common.md"), "shared guidance");
    fs.writeFileSync(path.join(tmp, "policies", "security.md"), "explicit guidance");

    const persona = await loadPersona(tmp, "security", {
      id: "security",
      guideline_file: "policies/security.md",
      builtin: false,
    });

    expect(persona.guideline).toContain("explicit guidance");
    expect(persona.guideline).not.toContain("convention guidance");
    expect(persona.guideline.match(/shared guidance/g)).toHaveLength(1);
  });

  it("does not fall back to a builtin when builtin is disabled", async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "magi-"));

    await expect(
      loadPersona(tmp, "melchior", { id: "melchior", builtin: false }),
    ).rejects.toThrow("No custom guideline found");
  });

  it("requires an explicitly configured guideline file to exist", async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "magi-"));

    await expect(
      loadPersona(tmp, "security", {
        id: "security",
        guideline_file: "policies/missing.md",
        builtin: false,
      }),
    ).rejects.toThrow("Guideline file not found");
  });

  it("rejects explicit guideline paths that escape the workspace", async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "magi-"));

    await expect(
      loadPersona(tmp, "security", {
        id: "security",
        guideline_file: "../outside.md",
        builtin: false,
      }),
    ).rejects.toThrow("Unsafe workspace-relative path");
  });

  it("rejects convention guidance symlinks that escape the workspace", async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "magi-"));
    const outside = path.join(os.tmpdir(), `magi-outside-${Date.now()}.md`);
    fs.writeFileSync(outside, "outside guidance");
    fs.mkdirSync(path.join(tmp, ".magi"), { recursive: true });
    fs.symlinkSync(outside, path.join(tmp, ".magi", "security.md"));

    await expect(loadPersona(tmp, "security")).rejects.toThrow(
      "resolves outside the workspace",
    );
    fs.rmSync(outside, { force: true });
  });

  it("provides neutral focused builtins with the shared review response contract", async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "magi-"));

    for (const [id, name] of [["security", "Security Reviewer"], ["backend", "Backend Reviewer"], ["frontend", "Frontend Reviewer"]] as const) {
      const persona = await loadPersona(tmp, id);
      expect(persona.name).toBe(name);
      expect(persona.guideline).toContain('"details": "evidence-based analysis"');
      expect(persona.guideline).toContain('"suggestions": [');
    }
  });

  it("leaves language selection to the review prompt for the default MAGI personas", async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "magi-"));

    for (const id of ["melchior", "balthasar", "casper"]) {
      const persona = await loadPersona(tmp, id);
      expect(persona.guideline).not.toContain("MUST be written in Korean");
    }
  });

  it("leaves provider undefined when not configured", async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "magi-"));
    const persona = await loadPersona(tmp, "melchior");
    expect(persona.provider).toBeUndefined();
  });
});
