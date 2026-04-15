import { describe, expect, it } from "vitest";
import { avatarGradient, initials } from "../ui/avatarColor";

describe("avatarColor", () => {
  describe("avatarGradient", () => {
    it("returns a linear-gradient CSS string", () => {
      expect(avatarGradient("Ayşe Kaya")).toMatch(/^linear-gradient\(/);
    });

    it("returns the same gradient for the same name (deterministic)", () => {
      expect(avatarGradient("Murat Bilgin")).toBe(avatarGradient("Murat Bilgin"));
    });

    it("distributes across the palette for different names", () => {
      const names = ["Ada", "Bora", "Cem", "Deniz", "Ece", "Fuat", "Gizem", "Hakan"];
      const gradients = new Set(names.map(avatarGradient));
      expect(gradients.size).toBeGreaterThan(1);
    });

    it("handles empty string without throwing", () => {
      expect(() => avatarGradient("")).not.toThrow();
      expect(avatarGradient("")).toMatch(/^linear-gradient\(/);
    });
  });

  describe("initials", () => {
    it("returns two-letter initials for full name", () => {
      expect(initials("Ayşe Kaya")).toBe("AK");
    });

    it("returns first two letters for single name", () => {
      expect(initials("Ayşe")).toBe("AY");
    });

    it("uses first + last for 3+ word names", () => {
      expect(initials("Ali Can Özdemir")).toBe("AÖ");
    });

    it("applies Turkish uppercase rules", () => {
      expect(initials("ilker yılmaz")).toBe("İY");
    });

    it("returns ? for empty / falsy input", () => {
      expect(initials("")).toBe("?");
      expect(initials(null)).toBe("?");
      expect(initials(undefined)).toBe("?");
    });

    it("trims whitespace", () => {
      expect(initials("  Emre  Demir  ")).toBe("ED");
    });
  });
});
