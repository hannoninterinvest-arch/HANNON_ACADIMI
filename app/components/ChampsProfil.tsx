import { NIVEAUX_ETUDE, SITUATIONS } from "@/lib/profil";

function dateIso(annees: number): string {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - annees);
  return date.toISOString().slice(0, 10);
}

export function ChampsProfil() {
  return (
    <>
      <div className="form-row">
        <label>
          Prénom
          <input name="prenom" required minLength={2} autoComplete="given-name" />
        </label>
        <label>
          Nom
          <input name="nom" required minLength={2} autoComplete="family-name" />
        </label>
      </div>
      <div className="form-row">
        <label>
          Téléphone
          <input name="telephone" required autoComplete="tel" placeholder="06 12 34 56 78" />
        </label>
        <label>
          Date de naissance
          <input type="date" name="dateNaissance" required min={dateIso(100)} max={dateIso(16)} />
        </label>
      </div>
      <label>
        Ville
        <input name="ville" required minLength={2} autoComplete="address-level2" />
      </label>
      <div className="form-row">
        <label>
          Niveau d’études
          <select name="niveauEtude" required defaultValue="">
            <option value="" disabled>
              Choisir
            </option>
            {NIVEAUX_ETUDE.map((niveau) => (
              <option key={niveau} value={niveau}>
                {niveau}
              </option>
            ))}
          </select>
        </label>
        <label>
          Situation
          <select name="situation" required defaultValue="">
            <option value="" disabled>
              Choisir
            </option>
            {SITUATIONS.map((situation) => (
              <option key={situation} value={situation}>
                {situation}
              </option>
            ))}
          </select>
        </label>
      </div>
    </>
  );
}
