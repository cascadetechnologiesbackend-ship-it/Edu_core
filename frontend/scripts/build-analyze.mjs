import { execSync } from "child_process";

process.env.ANALYZE = "true";

try {
  execSync("npx next build", {
    stdio: "inherit",
    env: process.env,
    shell: true,
  });
} catch (error) {
  console.error("build:analyze execution error:", error?.message || error);
  process.exit(1);
}
