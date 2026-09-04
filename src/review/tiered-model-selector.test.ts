import { describe, expect, it } from "vitest";
import { selectModelForDiff } from "./tiered-model-selector";

describe("selectModelForDiff", () => {
  it("uses stable Gemini 3.5 models for automatic tiers", () => {
    expect(selectModelForDiff(1, "api-key").model).toBe("gemini-3.5-flash-lite");
    expect(selectModelForDiff(50, "api-key").model).toBe("gemini-3.5-flash");
    expect(selectModelForDiff(500, "gcp").model).toBe("gemini-3.5-flash");
  });
});
