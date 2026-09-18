#!/usr/bin/env bash
set -euo pipefail

npx prisma generate

if [[ -z "${DIRECT_URL:-}" && -n "${DATABASE_URL:-}" ]]; then
  export DIRECT_URL="${DATABASE_URL}"
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  npx prisma migrate deploy
  npx prisma db seed || echo "Seed ignoré (base déjà peuplée ou seed indisponible)."
else
  echo "DATABASE_URL absente : migrations ignorées (le runtime affichera la config manquante)."
fi

npx next build
