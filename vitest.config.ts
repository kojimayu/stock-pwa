import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        // テスト対象: __tests__ 配下のみ（e2e/Playwrightは除外）
        include: ['__tests__/**/*.test.ts'],
        exclude: ['node_modules', '.next', 'e2e'],
        // テスト環境: Node.js（サーバーアクションのため）
        environment: 'node',
        // グローバルAPIを有効化（describe, it, expect など）
        globals: true,
        // テストのタイムアウト（DB操作を含むため長めに設定）
        testTimeout: 30000,
        // ファイル間の並列実行を無効化（DB競合防止）
        fileParallelism: false,
        // テストの直列実行設定
        sequence: {
            concurrent: false,
        },
        // カバレッジ設定
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['lib/actions.ts', 'app/api/**/*.ts'],
            exclude: ['node_modules', '.next'],
        },
        // セットアップファイル（テスト前にDBリセット）
        globalSetup: './__tests__/setup/global-setup.ts',
        setupFiles: ['./__tests__/setup/setup.ts'],
    },
});
