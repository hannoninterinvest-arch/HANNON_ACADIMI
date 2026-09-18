import { afterEach, describe, expect, it, vi } from "vitest";
import { authorizeCron } from "@/lib/cronAuth";

describe("authorizeCron", () => {
  const original = process.env.CRON_SECRET;

  afterEach(() => {
    process.env.CRON_SECRET = original;
    vi.unstubAllEnvs();
  });

  it("accepte le Bearer secret", () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret-value");
    const request = new Request("http://localhost/api/cron/generer-sessions", {
      headers: { Authorization: "Bearer test-cron-secret-value" },
    });
    expect(authorizeCron(request)).toBe(true);
  });

  it("refuse un secret incorrect", () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret-value");
    const request = new Request("http://localhost/api/cron/generer-sessions", {
      headers: { Authorization: "Bearer autre" },
    });
    expect(authorizeCron(request)).toBe(false);
  });

  it("refuse l'absence de header", () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret-value");
    const request = new Request("http://localhost/api/cron/generer-sessions");
    expect(authorizeCron(request)).toBe(false);
  });
});
