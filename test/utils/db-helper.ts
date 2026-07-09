// test/utils/db-helper.ts
import { PrismaService } from '@/prisma/prisma.service';

const TABLE_NAMES = [
  'purchase_orders',
  'blood_requests',
  'donation_day_registrations',
  'donation_days',
  'audit_logs',
  'notifications',
  'blood_stocks',
  'coupons',
  'rewards',
  'partners',
  'user_badges',
  'badges',
  'jambars_profiles',
  'donations',
  'alert_responses',
  'alerts',
  'otp_codes',
  'health_structures',
  'users',
];

const POSTGRES_DEADLOCK_CODE = '40P01';

export async function cleanDatabase(prisma: PrismaService): Promise<void> {
  const dbUrl = process.env.DATABASE_URL ?? '';

  if (!dbUrl.includes('5433') || !dbUrl.includes('app_test')) {
    throw new Error(
      `[e2e] Refus de TRUNCATE : DATABASE_URL ne pointe pas vers la DB de test ("${dbUrl}").`,
    );
  }

  const truncateSql = `TRUNCATE TABLE ${TABLE_NAMES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`;

  // Un TRUNCATE peut entrer en deadlock avec une transaction encore en
  // cours issue d'un listener asynchrone du test précédent (ex: écritures
  // concurrentes sur blood_requests via des @OnEvent parallèles côté app).
  // On retente quelques fois avant d'abandonner, plutôt que de faire
  // échouer tout le test suivant à cause d'un résidu du précédent.
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await prisma.$executeRawUnsafe(truncateSql);
      return;
    } catch (err) {
      const isDeadlock =
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code?: string }).code === POSTGRES_DEADLOCK_CODE;

      if (!isDeadlock || attempt === MAX_ATTEMPTS) throw err;

      await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
    }
  }
}
