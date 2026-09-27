import { describe, expect, it } from "vitest";
import { formatAgeMyr } from "../src/circumstellar/model/formatAge.js";

describe("formatAgeMyr", () => {
  it("formats catalog ages (Myr) as Gy above 1000 Myr", () => {
    expect(formatAgeMyr(13_247, "{{value}} Gy", "{{value}} My")).toBe("13.2 Gy");
  });

  it("formats sub-Gyr ages in My", () => {
    expect(formatAgeMyr(250, "{{value}} Gy", "{{value}} My")).toBe("250 My");
    expect(formatAgeMyr(2.5, "{{value}} Gy", "{{value}} My")).toBe("2.5 My");
  });
});
