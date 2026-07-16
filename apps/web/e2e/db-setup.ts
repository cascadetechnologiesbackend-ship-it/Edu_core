import { test as setup } from '@playwright/test';
import { execSync } from 'child_process';

setup('setup database', async () => {
  console.log('Running DB Reset and Seed for tests...');
  // Ensure we are in the correct directory. Playwright root is apps/web.
  // We can use the pnpm scripts from the workspace
  try {
    // Note: ensure NODE_ENV=test or similar is set if using a separate test DB
    execSync('npx tsx src/db/seed.ts', { stdio: 'inherit' });
    console.log('DB Seed successful.');
  } catch (error) {
    console.error('Failed to seed DB for tests:', error);
    throw error;
  }
});
