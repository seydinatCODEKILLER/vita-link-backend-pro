/**
 * Extrait les valeurs d'un enum Prisma pour être utilisé avec @IsIn()
 * Les enums Prisma sont des objets const, pas de vrais enums TS.
 */
export const getEnumValues = <T extends Record<string, string>>(
  enumObject: T,
): string[] => {
  return Object.values(enumObject);
};
