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
    expect(persona.name).toBe("MELCHIOR"); // builtin meta 유지
  });

  it("leaves provider undefined when not configured", async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "magi-"));
    const persona = await loadPersona(tmp, "melchior");
    expect(persona.provider).toBeUndefined();
  });
});
