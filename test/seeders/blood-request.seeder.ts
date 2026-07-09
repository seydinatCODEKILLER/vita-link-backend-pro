import { INestApplication } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { BloodType } from '@/generated/prisma/enums';
import { seedVerifiedCntsDirector, SeedCntsOptions } from './cnts.seeder';
import { seedHospitalAgent, SeedHospitalOptions } from './hospital.seeder';
import { seedBloodStock } from './blood-stock.seeder';

export interface SeedHospitalCntsPairOptions {
  bloodType?: BloodType;
  stockQuantity?: number;
  cnts?: SeedCntsOptions;
  hospital?: Omit<SeedHospitalOptions, 'affiliatedCntsId'>;
}

/**
 * Bundle composite : CNTS vérifiée + hôpital affilié + stock de sang.
 * Couvre le setup nécessaire pour la quasi-totalité des tests
 * blood-requests / purchase-orders / alerts d'escalade.
 *
 * Composé uniquement à partir des seeders élémentaires (cnts, hospital,
 * blood-stock) — n'ajoute aucune logique propre au-delà de leur
 * assemblage.
 */
export async function seedHospitalCntsPair(
  app: INestApplication,
  prisma: PrismaService,
  opts: SeedHospitalCntsPairOptions = {},
) {
  const cnts = await seedVerifiedCntsDirector(app, prisma, opts.cnts);
  const hospital = await seedHospitalAgent(app, {
    ...opts.hospital,
    affiliatedCntsId: cnts.structureId,
  });

  const bloodType = opts.bloodType ?? BloodType.O_NEG;
  const stockQuantity = opts.stockQuantity ?? 10;

  const stock = await seedBloodStock(prisma, {
    healthStructureId: cnts.structureId,
    bloodType,
    quantity: stockQuantity,
  });

  return { cnts, hospital, stock, bloodType };
}
