import { describe, expect, it } from "vitest";
import { explainPrismaError } from "@/lib/prismaErrors";

describe("explainPrismaError", () => {
  it("détecte DIRECT_URL manquante", () => {
    const explained = explainPrismaError(
      new Error("error: Environment variable not found: DIRECT_URL."),
    );
    expect(explained.title).toMatch(/DIRECT_URL/);
  });

  it("détecte une base injoignable", () => {
    const explained = explainPrismaError({
      name: "PrismaClientInitializationError",
      message: "Can't reach database server at ep-xxx.neon.tech:5432",
      code: "P1001",
    });
    expect(explained.title).toMatch(/injoignable/);
    expect(explained.code).toBe("P1001");
  });
});
