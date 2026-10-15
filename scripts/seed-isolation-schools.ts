import { ISOLATION_IDS, seedIsolationSchools } from "../backend/src/lib/isolationFixtures";

export { ISOLATION_IDS, seedIsolationSchools };

if (process.argv[1] && process.argv[1].includes("seed-isolation-schools")) {
  seedIsolationSchools().catch((err) => {
    console.error("❌ Failed to seed isolation schools:", err);
    process.exit(1);
  });
}
