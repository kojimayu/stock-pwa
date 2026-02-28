import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { readdirSync, statSync } from 'fs';

/**
 * SessionProvider未使用プロジェクトで useSession() を誤って使うと
 * 無限ループ（global-error → リロード → 再クラッシュ）が発生する。
 * このテストでソースコード全体をスキャンして防止する。
 */

// 再帰的にファイル一覧を取得
function walkDir(dir: string, ext: string): string[] {
    const results: string[] = [];
    for (const entry of readdirSync(dir)) {
        const fullPath = resolve(dir, entry);
        if (entry === 'node_modules' || entry === '.next' || entry === '__tests__') continue;
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
            results.push(...walkDir(fullPath, ext));
        } else if (fullPath.endsWith(ext)) {
            results.push(fullPath);
        }
    }
    return results;
}

describe('SessionProvider安全チェック', () => {
    const projectRoot = resolve(__dirname, '../../');

    it('useSession を使用しているファイルがないこと（SessionProvider未使用プロジェクト）', () => {
        const tsxFiles = [
            ...walkDir(resolve(projectRoot, 'app'), '.tsx'),
            ...walkDir(resolve(projectRoot, 'components'), '.tsx'),
        ];

        const violations: string[] = [];

        for (const file of tsxFiles) {
            const content = readFileSync(file, 'utf-8');
            if (content.includes('useSession')) {
                const relative = file.replace(projectRoot, '').replace(/\\/g, '/');
                violations.push(relative);
            }
        }

        expect(violations, `useSession() はこのプロジェクトで使用禁止です（SessionProvider未設定）。\n違反ファイル:\n${violations.join('\n')}`).toEqual([]);
    });

    it('SessionProvider 未使用を確認', () => {
        // layout.tsx に SessionProvider が追加されたらこのテストは不要になるが、
        // それまでは useSession の誤使用を防ぐ
        const layoutFiles = walkDir(resolve(projectRoot, 'app'), '.tsx')
            .filter(f => f.includes('layout'));

        let hasSessionProvider = false;
        for (const file of layoutFiles) {
            const content = readFileSync(file, 'utf-8');
            if (content.includes('SessionProvider')) {
                hasSessionProvider = true;
                break;
            }
        }

        if (hasSessionProvider) {
            console.log('⚠️ SessionProviderが追加されました。useSession禁止テストは不要になる可能性があります。');
        } else {
            expect(hasSessionProvider).toBe(false);
        }
    });
});
