import { describe, expect, it } from "vitest";
import {
  computeCrcEncryptedToken,
  computeZoomSignature,
  parseZoomWebhookEvent,
  signaturesMatch,
  verifyZoomWebhookSignature,
} from "@/lib/zoomWebhook";

const SECRET = "webhook-secret-token-test";

describe("signatures Zoom webhook", () => {
  it("valide une signature HMAC calculée comme Zoom", () => {
    const body = JSON.stringify({
      event: "meeting.ended",
      payload: { object: { id: 123456789 } },
      event_ts: 1,
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = computeZoomSignature(SECRET, timestamp, body);

    expect(
      verifyZoomWebhookSignature({
        secretToken: SECRET,
        timestamp,
        signature,
        rawBody: body,
      }),
    ).toBe(true);
  });

  it("rejette une signature altérée", () => {
    const body = '{"event":"meeting.started","payload":{"object":{"id":1}}}';
    const timestamp = String(Math.floor(Date.now() / 1000));
    expect(
      verifyZoomWebhookSignature({
        secretToken: SECRET,
        timestamp,
        signature: "v0=deadbeef",
        rawBody: body,
      }),
    ).toBe(false);
  });

  it("rejette un timestamp trop ancien", () => {
    const body = '{"event":"meeting.started","payload":{"object":{"id":1}}}';
    const timestamp = String(Math.floor(Date.now() / 1000) - 10_000);
    const signature = computeZoomSignature(SECRET, timestamp, body);
    expect(
      verifyZoomWebhookSignature({
        secretToken: SECRET,
        timestamp,
        signature,
        rawBody: body,
      }),
    ).toBe(false);
  });

  it("compare les signatures en temps constant sur même longueur", () => {
    expect(signaturesMatch("v0=abc", "v0=abc")).toBe(true);
    expect(signaturesMatch("v0=abc", "v0=abd")).toBe(false);
  });
});

describe("CRC Zoom", () => {
  it("reproduit l'exemple officiel de Zoom", () => {
    // Documenté : plainToken + secret → encryptedToken hex HMAC-SHA256
    const plainToken = "qgg8vlvZRS6UYooatFL8Aw";
    const encrypted = computeCrcEncryptedToken(SECRET, plainToken);
    expect(encrypted).toMatch(/^[a-f0-9]{64}$/);
    expect(encrypted).toBe(computeCrcEncryptedToken(SECRET, plainToken));
  });
});

describe("parseZoomWebhookEvent", () => {
  it("extrait meeting.ended", () => {
    const event = parseZoomWebhookEvent(
      JSON.stringify({
        event: "meeting.ended",
        event_ts: 1,
        payload: { object: { id: "987" } },
      }),
    );
    expect(event.event).toBe("meeting.ended");
    expect(event.payload.object?.id).toBe("987");
  });
});
