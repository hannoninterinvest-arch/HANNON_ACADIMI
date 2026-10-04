# HANNON ACADIMI

Plateforme de formation Next.js : catalogue, sessions datées, achats B2C / B2B / B2G, affectation des places et espace apprenant. Les formateurs animent en visio sans recevoir les identifiants des licences Zoom ; le lien de chaque session commerciale est saisi manuellement par l'administrateur.

## Parcours

- Catalogue et fiche formation : tarifs, dates, places restantes, conditions de remise.
- Particulier : compte, achat d'une place, planning, Zoom, ressources, certificats.
- Organisation (entreprise ou organisme public) : achat d'un lot, invitations, import CSV, affectation dans la limite des places payées.
- Administrateur : sessions, capacité, lien Zoom, tarifs, commandes, demandes, documents.
- Le paiement n'est confirmé que par webhook signé. `PAYMENT_MODE=test` simule le prestataire sans prélèvement. `PAYMENT_MODE=stripe` utilise Stripe Checkout (`sk_test_…` = mode test).

Cron supplémentaire pour libérer les réservations expirées :

```cron
*/10 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "$NEXT_PUBLIC_APP_URL/api/cron/expirer-reservations"
```

## Démarrage

```bash
cp .env.example .env
# renseigner DATABASE_URL / DIRECT_URL Neon (pooled + direct)
# renseigner ZOOM_* et RESEND_*
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Cron VPS (recommandé) :

```cron
15 2 * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "$NEXT_PUBLIC_APP_URL/api/cron/generer-sessions"
```

Scopes Zoom Server-to-Server à activer : `meeting:write:admin`, `meeting:read:admin`, `user:write:admin`, `user:read:admin`.

Webhook : `https://<domaine>/api/webhooks/zoom` — événements `meeting.started` et `meeting.ended`.

Plateforme : https://hannon-acadimi.vercel.app

## Déploiement Vercel

Ce projet est une app **Next.js (App Router)**, pas un site statique. Dans Vercel → Project Settings → Build & Development :

- **Framework Preset** : Next.js (forcé aussi par `vercel.json`)
- **Output Directory** : laisser **vide** (ne pas mettre `public`)
- **Build Command** : laisser le défaut (`next build` / celui de `vercel.json`)

Copier toutes les variables de `.env.example` dans Vercel → Settings → Environment Variables (Production + Preview), y compris `DATABASE_URL` (Neon pooled) et `DIRECT_URL` (Neon direct).
