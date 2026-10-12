import { describe, expect, it } from "vitest";
import { plural, slugify } from "./text";

describe("plural", () => {
  it("uses the singular only for exactly one", () => {
    expect(plural(1, "session")).toBe("1 session");
    expect(plural(0, "session")).toBe("0 sessions");
    expect(plural(2, "session")).toBe("2 sessions");
  });

  it("takes an irregular plural form", () => {
    expect(plural(3, "person", "people")).toBe("3 people");
    expect(plural(1, "person", "people")).toBe("1 person");
  });
});

describe("slugify", () => {
  it("matches the API's slug rule", () => {
    expect(slugify("  Dr. Lena-Maria Hartmann! ")).toBe("dr-lena-maria-hartmann");
    expect(slugify("Ömer Çelik Danışmanlık")).toBe("omer-celik-danismanlik");
    expect(slugify("Praxis Großmann")).toBe("praxis-grossmann");
  });
});
