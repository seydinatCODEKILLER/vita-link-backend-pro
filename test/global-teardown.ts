// test/global-teardown.ts
export default async function globalTeardown(): Promise<void> {
  // Rien à fermer globalement ; chaque suite ferme sa propre connexion
  // Prisma/Nest dans son afterAll().
}
