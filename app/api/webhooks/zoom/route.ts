import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getZoomWebhookSecret, hasZoomWebhookSecret } from "@/lib/env";
import {
  computeCrcEncryptedToken,
  extractMeetingId,
  parseZoomWebhookEvent,
  verifyZoomWebhookSignature,
} from "@/lib/zoomWebhook";
import { libererCompte, occuperCompte } from "@/lib/licencePool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  if (!hasZoomWebhookSecret()) {
    logger.error("ZOOM_WEBHOOK_SECRET_TOKEN manquant — webhook refusé");
    return NextResponse.json(
      { error: "ZOOM_WEBHOOK_SECRET_TOKEN manquant" },
      { status: 500 },
    );
  }

  const secret = getZoomWebhookSecret();
  const rawBody = await request.text();
  const timestamp = request.headers.get("x-zm-request-timestamp");
  const signature = request.headers.get("x-zm-signature");

  const valide = verifyZoomWebhookSignature({
    secretToken: secret,
    timestamp,
    signature,
    rawBody,
  });

  if (!valide) {
    logger.warn("Webhook Zoom rejeté : signature invalide", { timestamp });
    return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  }

  let event;
  try {
    event = parseZoomWebhookEvent(rawBody);
  } catch (error) {
    logger.error("Webhook Zoom : payload illisible", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
  }

  if (event.event === "endpoint.url_validation") {
    const plainToken = event.payload.plainToken;
    if (!plainToken) {
      return NextResponse.json({ error: "plainToken manquant" }, { status: 400 });
    }
    return NextResponse.json({
      plainToken,
      encryptedToken: computeCrcEncryptedToken(secret, plainToken),
    });
  }

  const meetingId = extractMeetingId(event);
  if (!meetingId) {
    logger.warn("Webhook Zoom sans meeting id", { event: event.event });
    return NextResponse.json({ ok: true, ignored: true });
  }

  const session = await prisma.session.findFirst({
    where: { zoomMeetingId: meetingId },
  });

  if (!session) {
    logger.warn("Webhook Zoom : session inconnue pour ce meeting", {
      event: event.event,
      meetingId,
    });
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    if (event.event === "meeting.started") {
      if (session.statut === "ANNULEE") {
        logger.warn("meeting.started reçu pour une session annulée", {
          sessionId: session.id,
          meetingId,
        });
        return NextResponse.json({ ok: true });
      }
      await prisma.session.update({
        where: { id: session.id },
        data: { statut: "EN_COURS" },
      });
      if (session.licenceZoomId) {
        await occuperCompte({ licenceId: session.licenceZoomId, sessionId: session.id });
      }
      logger.info("Session passée EN_COURS", { sessionId: session.id, meetingId });
    } else if (event.event === "meeting.ended") {
      await prisma.session.update({
        where: { id: session.id },
        data: { statut: "TERMINEE" },
      });
      await libererCompte(session.id);
      logger.info("Session passée TERMINEE, licence libérée", {
        sessionId: session.id,
        meetingId,
      });
    } else {
      logger.info("Webhook Zoom ignoré (événement non géré)", { event: event.event });
    }
  } catch (error) {
    logger.error("Traitement webhook Zoom en échec", {
      event: event.event,
      meetingId,
      sessionId: session.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
