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

export async function cleanDatabase(prisma: PrismaService): Promise<void> {
  const dbUrl = process.env.DATABASE_URL ?? '';

  if (!dbUrl.includes('5433') || !dbUrl.includes('app_test')) {
    throw new Error(
      `[e2e] Refus de TRUNCATE : DATABASE_URL ne pointe pas vers la DB de test ("${dbUrl}").`,
    );
  }

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLE_NAMES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`,
  );
}
