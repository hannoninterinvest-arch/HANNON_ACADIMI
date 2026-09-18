/**
 * Planificateur optionnel pour un VPS Node (alternative au cron système).
 *
 *   npx tsx scripts/scheduler.ts
 *
 * Par défaut, un cron système est préférable :
 *   15 2 * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *     "$NEXT_PUBLIC_APP_URL/api/cron/generer-sessions"
 */
import { DateTime } from "luxon";
import { genererSessionsAVenir } from "../lib/genererSessions";
import { logger } from "../lib/logger";

const DEFAULT_CRON = "15 2 * * *";

async function run(): Promise<void> {
  logger.info("Scheduler : génération manuelle (une fois)", {
    now: DateTime.now().toISO(),
    hint: `Pour une récurrence, utilisez crontab : ${DEFAULT_CRON}`,
  });
  const resultat = await genererSessionsAVenir();
  logger.info("Scheduler : terminé", resultat);
  if (resultat.echecs.length > 0 && resultat.creees === 0) {
    process.exitCode = 1;
  }
}

run().catch((error: unknown) => {
  logger.error("Scheduler en échec", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
