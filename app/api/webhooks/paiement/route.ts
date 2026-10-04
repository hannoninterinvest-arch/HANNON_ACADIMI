import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaymentMode, getPaymentWebhookSecret, getStripeWebhookSecret } from "@/lib/env";
import { logger } from "@/lib/logger";
import { verifierSignatureHannon, verifierSignatureStripe } from "@/lib/paiement/signature";
import { evenementDepuisCorpsHannon, traiterEvenementPaiement, type EvenementPaiement } from "@/lib/paiement/traiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function evenementStripe(corps: string): EvenementPaiement | null {
  const event = JSON.parse(corps) as {
    type?: string;
    data?: {
      object?: {
        id?: string;
        payment_status?: string;
        client_reference_id?: string;
        payment_intent?: string;
        amount_total?: number;
        currency?: string;
        metadata?: { commandeId?: string };
      };
    };
  };
  const objet = event.data?.object;
  if (!objet) {
    return null;
  }
  if (event.type === "checkout.session.completed" && objet.payment_status === "paid") {
    const commandeId = objet.metadata?.commandeId || objet.client_reference_id;
    if (!commandeId) {
      return null;
    }
    return {
      type: "paiement.reussi",
      commandeId,
      reference: objet.payment_intent || objet.id || commandeId,
      montantCentimes: objet.amount_total ?? null,
      devise: objet.currency ?? null,
    };
  }
  if (event.type === "checkout.session.expired") {
    const commandeId = objet.metadata?.commandeId || objet.client_reference_id;
    if (!commandeId || !objet.id) {
      return null;
    }
    return { type: "paiement.annule", commandeId, reference: objet.id };
  }
  return null;
}

export async function POST(request: Request): Promise<NextResponse> {
  const corps = await request.text();
  const signatureHannon = request.headers.get("x-hannon-signature");
  const signatureStripe = request.headers.get("stripe-signature");

  try {
    let evenement: EvenementPaiement | null = null;
    if (signatureStripe && getPaymentMode() === "stripe") {
      if (!verifierSignatureStripe(getStripeWebhookSecret(), corps, signatureStripe)) {
        return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
      }
      const json = JSON.parse(corps) as { type?: string; data?: { object?: { payment_intent?: string } } };
      if (json.type === "charge.refunded" && json.data?.object?.payment_intent) {
        const commande = await prisma.commande.findFirst({
          where: { referenceFournisseur: json.data.object.payment_intent },
        });
        if (!commande) {
          return NextResponse.json({ ignore: true });
        }
        evenement = {
          type: "paiement.rembourse",
          commandeId: commande.id,
          reference: json.data.object.payment_intent,
        };
      } else {
        evenement = evenementStripe(corps);
      }
    } else {
      if (!verifierSignatureHannon(getPaymentWebhookSecret(), corps, signatureHannon)) {
        return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
      }
      evenement = evenementDepuisCorpsHannon(corps);
    }

    if (!evenement) {
      return NextResponse.json({ ignore: true });
    }
    const resultat = await traiterEvenementPaiement(evenement);
    return NextResponse.json(resultat);
  } catch (error) {
    logger.error("Webhook paiement refusé", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Événement illisible" }, { status: 400 });
  }
}
