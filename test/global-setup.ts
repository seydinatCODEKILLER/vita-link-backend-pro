import { execSync } from 'child_process';
import { config } from 'dotenv';
import { resolve } from 'path';

export default function globalSetup(): void {
  // Charge .env.test AVANT tout — dotenv ne réécrit pas une variable déjà
  // définie, donc ceci doit s'exécuter avant que prisma.config.ts ne fasse
  // son propre `import 'dotenv/config'` (qui chargerait sinon le .env de dev).
  config({ path: resolve(__dirname, '../.env.test'), override: true });

  const dbUrl = process.env.DATABASE_URL ?? '';

  // Garde-fou critique : le db-helper fait un TRUNCATE CASCADE.
  // On refuse de continuer si l'URL ne ressemble pas clairement à la DB de test.
  if (!dbUrl.includes('5433') || !dbUrl.includes('app_test')) {
    throw new Error(
      `[e2e] DATABASE_URL suspecte pour les tests: "${dbUrl}".\n` +
        `Attendu un pattern contenant "5433" et "app_test". ` +
        `Vérifie .env.test pour éviter de toucher une base de dev/prod.`,
    );
  }

  console.log('\n[e2e] Application des migrations Prisma sur la DB de test...');
  console.log(`[e2e] DATABASE_URL: ${dbUrl}`);

  // CHANGEMENT ICI : npx remplacé par pnpm
  execSync('pnpm prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DIRECT_URL: dbUrl, DATABASE_URL: dbUrl },
  });

  console.log('[e2e] Migrations appliquées.\n');
}
