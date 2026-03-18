import { describe, it, expect } from "vitest";
import { Fluxstudio } from "../src/core.js";
describe("Fluxstudio", () => {
  it("init", () => { expect(new Fluxstudio().getStats().ops).toBe(0); });
  it("op", async () => { const c = new Fluxstudio(); await c.process(); expect(c.getStats().ops).toBe(1); });
  it("reset", async () => { const c = new Fluxstudio(); await c.process(); c.reset(); expect(c.getStats().ops).toBe(0); });
});
