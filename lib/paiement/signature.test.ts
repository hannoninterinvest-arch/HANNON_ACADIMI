import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signerCorps, verifierSignatureHannon, verifierSignatureStripe } from "@/lib/paiement/signature";

describe("signatures de paiement", () => {
  it("accepte uniquement un corps signé avec le secret", () => {
    const corps = JSON.stringify({ type: "paiement.reussi", commandeId: "c1" });
    const signature = signerCorps("secret", corps);
    expect(verifierSignatureHannon("secret", corps, signature)).toBe(true);
    expect(verifierSignatureHannon("secret", corps, "abcd")).toBe(false);
    expect(verifierSignatureHannon("autre", corps, signature)).toBe(false);
    expect(verifierSignatureHannon("secret", `${corps} `, signature)).toBe(false);
  });

  it("vérifie l'en-tête Stripe v1 et refuse un horodatage trop ancien", () => {
    const corps = "{\"id\":\"evt_1\"}";
    const temps = 1_700_000_000;
    const v1 = createHmac("sha256", "whsec").update(`${temps}.${corps}`).digest("hex");
    expect(verifierSignatureStripe("whsec", corps, `t=${temps},v1=${v1}`, temps * 1000)).toBe(true);
    expect(verifierSignatureStripe("whsec", corps, `t=${temps},v1=${v1}`, (temps + 10_000) * 1000)).toBe(
      false,
    );
  });
});