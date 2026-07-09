import { PrismaService } from '@/prisma/prisma.service';
import { BloodType } from '@/generated/prisma/enums';

export interface SeedBloodStockParams {
  healthStructureId: string;
  bloodType: BloodType;
  quantity: number;
}

/**
 * Crée (ou met à jour) un stock de sang directement en base pour une CNTS.
 * Aucun endpoint de gestion de stock n'étant testé ici, on utilise Prisma
 * directement — c'est du setup, pas le comportement testé.
 *
 * upsert plutôt que create : rend le seeder idempotent si jamais appelé
 * deux fois pour la même paire (healthStructureId, bloodType), ce qui
 * évite un échec de contrainte unique masquant la vraie cause d'un test.
 */
export async function seedBloodStock(
  prisma: PrismaService,
  params: SeedBloodStockParams,
) {
  return prisma.bloodStock.upsert({
    where: {
      healthStructureId_bloodType: {
        healthStructureId: params.healthStructureId,
        bloodType: params.bloodType,
      },
    },
    create: {
      healthStructureId: params.healthStructureId,
      bloodType: params.bloodType,
      quantity: params.quantity,
      level: params.quantity <= 2 ? 'CRITICAL' : 'ADEQUATE',
    },
    update: {
      quantity: params.quantity,
      level: params.quantity <= 2 ? 'CRITICAL' : 'ADEQUATE',
    },
  });
}
