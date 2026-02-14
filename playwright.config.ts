
import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
require('dotenv').config();

// Use a separate test database
const TEST_DB_PATH = path.join(__dirname, 'prisma', 'test.db');
process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:3001',
        trace: 'on',
        video: 'on',
        screenshot: 'on',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    // Run your local dev server before starting the tests
    webServer: {
        command: 'npx cross-env APP_ENV=test dotenv -e .env.test -- npm run dev -- -p 3001',
        url: 'http://localhost:3001',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
    },
});
