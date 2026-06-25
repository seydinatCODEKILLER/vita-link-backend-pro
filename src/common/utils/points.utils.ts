export const POINTS_CONFIG = {
  DONATION_BASE: 50,
  DONATION_VITAL: 100,
  REACTION_FAST: 20,
  RARE_BLOOD_BONUS: 50,
} as const;

export const GRADE_THRESHOLDS = {
  ASPIRANT: 0,
  SENTINELLE: 200,
  AMBASSADEUR: 500,
} as const;

export const ELIGIBILITY_DAYS = {
  MALE: 90,
  FEMALE: 120,
} as const;

export const calculateDonationPoints = ({
  urgencyLevel,
  bloodType,
  etaMinutes,
}: {
  urgencyLevel: string;
  bloodType: string;
  etaMinutes?: number | null;
}): number => {
  let points =
    urgencyLevel === 'VITAL'
      ? POINTS_CONFIG.DONATION_VITAL
      : POINTS_CONFIG.DONATION_BASE;

  if (['O_NEG', 'AB_NEG'].includes(bloodType)) {
    points += POINTS_CONFIG.RARE_BLOOD_BONUS;
  }

  if (etaMinutes && etaMinutes <= 60) {
    points += POINTS_CONFIG.REACTION_FAST;
  }

  return points;
};

export const calculateGrade = (
  totalPoints: number,
): 'ASPIRANT' | 'SENTINELLE' | 'AMBASSADEUR' => {
  if (totalPoints >= GRADE_THRESHOLDS.AMBASSADEUR) return 'AMBASSADEUR';
  if (totalPoints >= GRADE_THRESHOLDS.SENTINELLE) return 'SENTINELLE';
  return 'ASPIRANT';
};

export const calculateNextEligibility = (gender: string): Date => {
  const days =
    gender === 'FEMALE' ? ELIGIBILITY_DAYS.FEMALE : ELIGIBILITY_DAYS.MALE;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
};

export const isDonorEligible = (nextEligibilityAt: Date | null): boolean => {
  if (!nextEligibilityAt) return true;
  return new Date() >= new Date(nextEligibilityAt);
};
