import {
  getAppUrl,
  getPaymentMode,
  getStripeSecretKey,
  stripeEstEnModeTest,
} from "@/lib/env";

export type SessionPaiement = {
  url: string;
  fournisseur: "test" | "stripe";
  modeTest: boolean;
};

export async function creerSessionPaiement(commande: {
  id: string;
  quantite: number;
  totalCentimes: number;
  remiseUnitaireCentimes: number;
  prixUnitaireCentimes: number;
  titre: string;
}): Promise<SessionPaiement> {
  const mode = getPaymentMode();
  if (mode === "test") {
    return {
      url: `/paiement/test/${commande.id}`,
      fournisseur: "test",
      modeTest: true,
    };
  }

  const secret = getStripeSecretKey();
  const net = commande.prixUnitaireCentimes - commande.remiseUnitaireCentimes;
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${getAppUrl()}/paiement/retour?commande=${commande.id}`);
  params.set("cancel_url", `${getAppUrl()}/paiement/retour?commande=${commande.id}`);
  params.set("client_reference_id", commande.id);
  params.set("metadata[commandeId]", commande.id);
  params.set("line_items[0][quantity]", String(commande.quantite));
  params.set("line_items[0][price_data][currency]", "eur");
  params.set("line_items[0][price_data][unit_amount]", String(net));
  params.set("line_items[0][price_data][product_data][name]", commande.titre.slice(0, 120));

  const reponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const json = (await reponse.json()) as { url?: string; error?: { message?: string } };
  if (!reponse.ok || !json.url) {
    throw new Error(json.error?.message ?? "Stripe n'a pas ouvert la session de paiement.");
  }
  return { url: json.url, fournisseur: "stripe", modeTest: stripeEstEnModeTest() };
}
