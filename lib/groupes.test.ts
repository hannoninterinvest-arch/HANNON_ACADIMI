import { describe, expect, it } from "vitest";
import { peutCreerGroupe, peutOuvrirPaiement } from "@/lib/groupes";

describe("groupes", () => {
  it("n’ouvre un groupe qu’une fois le minimum atteint", () => {
    expect(peutCreerGroupe(3, 4)).toBe(false);
    expect(peutCreerGroupe(4, 4)).toBe(true);
    expect(peutOuvrirPaiement(3, 4, false)).toBe(false);
    expect(peutOuvrirPaiement(4, 4, false)).toBe(true);
    expect(peutOuvrirPaiement(4, 4, true)).toBe(false);
  });
});
