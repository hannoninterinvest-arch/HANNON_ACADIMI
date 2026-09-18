import { createHmac, timingSafeEqual } from "node:crypto";
import type { ZoomWebhookEvent } from "@/lib/zoom.types";

export function computeZoomSignature(secretToken: string, timestamp: string, rawBody: string): string {
  const message = `v0:${timestamp}:${rawBody}`;
  const hash = createHmac("sha256", secretToken).update(message).digest("hex");
  return `v0=${hash}`;
}

export function signaturesMatch(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function verifyZoomWebhookSignature(params: {
  secretToken: string;
  timestamp: string | null;
  signature: string | null;
  rawBody: string;
  maxAgeSeconds?: number;
}): boolean {
  const { secretToken, timestamp, signature, rawBody, maxAgeSeconds = 5 * 60 } = params;
  if (!timestamp || !signature) {
    return false;
  }

  const ts = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) {
    return false;
  }
  const ageSeconds = Math.abs(Date.now() / 1000 - ts);
  if (ageSeconds > maxAgeSeconds) {
    return false;
  }

  const expected = computeZoomSignature(secretToken, timestamp, rawBody);
  return signaturesMatch(expected, signature);
}

export function computeCrcEncryptedToken(secretToken: string, plainToken: string): string {
  return createHmac("sha256", secretToken).update(plainToken).digest("hex");
}

export function parseZoomWebhookEvent(rawBody: string): ZoomWebhookEvent {
  const parsed: unknown = JSON.parse(rawBody);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Payload webhook Zoom invalide");
  }
  const record = parsed as Record<string, unknown>;
  if (typeof record.event !== "string" || typeof record.payload !== "object" || record.payload === null) {
    throw new Error("Payload webhook Zoom incomplet");
  }
  return parsed as ZoomWebhookEvent;
}

export function extractMeetingId(event: ZoomWebhookEvent): string | undefined {
  const id = event.payload.object?.id;
  if (id === undefined || id === null) {
    return undefined;
  }
  return String(id);
}
