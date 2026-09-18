# HANNON ACADIMI

Plateforme e-learning Next.js : les formateurs animent des cours Zoom sans jamais recevoir les identifiants des licences. Un pool de comptes Zoom est mutualisé ; chaque formateur reçoit uniquement le **host key** pour revendiquer l'animation.

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

## Déploiement Vercel

Ce projet est une app **Next.js (App Router)**, pas un site statique. Dans Vercel → Project Settings → Build & Development :

- **Framework Preset** : Next.js (forcé aussi par `vercel.json`)
- **Output Directory** : laisser **vide** (ne pas mettre `public`)
- **Build Command** : laisser le défaut (`next build` / celui de `vercel.json`)

Copier toutes les variables de `.env.example` dans Vercel → Settings → Environment Variables (Production + Preview), y compris `DATABASE_URL` (Neon pooled) et `DIRECT_URL` (Neon direct).
