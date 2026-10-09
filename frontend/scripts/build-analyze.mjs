import { execSync } from "child_process";

process.env.ANALYZE = "true";

try {
  execSync("pnpm exec next build", {
    stdio: "inherit",
    env: process.env,
  });
} catch (error) {
  process.exit(1);
}
