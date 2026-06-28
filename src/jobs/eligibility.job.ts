import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { Gender } from '@/generated/prisma/enums';

const ELIGIBILITY_DAYS: Record<Gender, number> = {
  [Gender.MALE]: 90,
  [Gender.FEMALE]: 120,
};

@Injectable()
export class EligibilityJob {
  private readonly logger = new Logger(EligibilityJob.name);

  constructor(private readonly prisma: PrismaService) {}

  // Tous les dimanches à 04h00 — recalcule les éligibilités (en cas de
  // modifications manuelles ayant désynchronisé nextEligibilityAt)
  @Cron('0 4 * * 0')
  async run(): Promise<void> {
    try {
      // Une seule requête avec `include` au lieu d'une requête
      // prisma.user.findUnique par profil dans une boucle (N+1 query) —
      // le code Express d'origine faisait une requête séparée par
      // donneur, ce qui aurait pu devenir très lent avec une base de
      // donneurs importante.
      const profiles = await this.prisma.jambaarsProfile.findMany({
        where: { lastDonationAt: { not: null } },
        select: {
          id: true,
          lastDonationAt: true,
          nextEligibilityAt: true,
          user: { select: { gender: true } },
        },
      });

      const updates: { id: string; nextEligibilityAt: Date }[] = [];

      for (const profile of profiles) {
        const gender = profile.user.gender;
        if (!gender || !profile.lastDonationAt) continue;

        const days = ELIGIBILITY_DAYS[gender] ?? 90;
        const correctDate = new Date(profile.lastDonationAt);
        correctDate.setDate(correctDate.getDate() + days);

        const currentNext = profile.nextEligibilityAt?.getTime();
        if (currentNext !== correctDate.getTime()) {
          updates.push({ id: profile.id, nextEligibilityAt: correctDate });
        }
      }

      if (updates.length === 0) return;

      await Promise.all(
        updates.map((u) =>
          this.prisma.jambaarsProfile.update({
            where: { id: u.id },
            data: { nextEligibilityAt: u.nextEligibilityAt },
          }),
        ),
      );

      this.logger.log(
        `CRON_ELIGIBILITY_RECALCULATED — updatedCount: ${updates.length}`,
      );
    } catch (err) {
      this.logger.error('Erreur CRON eligibility', err);
    }
  }
}
