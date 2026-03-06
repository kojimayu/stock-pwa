import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { readdirSync, statSync, existsSync } from 'fs';

/**
 * テーブルヘッダー固定(sticky)と折りたたみパネルの整合性テスト
 * - shadcn/ui TableHeader に sticky が適用されているか
 * - Table コンテナが overflow-x-clip で sticky を妨げないか
 * - ネイティブ <thead> にも sticky が適用されているか
 * - CollapsiblePanel コンポーネントが正しく定義されているか
 */

function walkDir(dir: string, ext: string): string[] {
    const results: string[] = [];
    if (!existsSync(dir)) return results;
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

const projectRoot = resolve(__dirname, '../../');

describe('テーブルヘッダー固定チェック', () => {
    it('shadcn/ui TableHeader に sticky が含まれていること', () => {
        const tableUi = resolve(projectRoot, 'components/ui/table.tsx');
        const content = readFileSync(tableUi, 'utf-8');

        // TableHeader の className に sticky が含まれているか
        expect(content).toContain('sticky');
        expect(content).toContain('top-0');
        expect(content).toContain('z-10');
        expect(content).toContain('bg-background');
    });

    it('Table コンテナがレスポンシブ overflow であること（モバイル: auto, PC: clip）', () => {
        const tableUi = resolve(projectRoot, 'components/ui/table.tsx');
        const content = readFileSync(tableUi, 'utf-8');

        // モバイルで横スクロール可能
        expect(content).toContain('overflow-x-auto');
        // PCではstickyヘッダーのためclip
        expect(content).toContain('md:overflow-x-clip');
    });

    it('ネイティブ <thead> を使うファイルにも sticky が適用されていること', () => {
        // shadcn/ui TableHeader ではなくネイティブ <thead> を使うファイルを検査
        const adminPages = [
            ...walkDir(resolve(projectRoot, 'app/(admin)'), '.tsx'),
        ];

        const violations: string[] = [];
        for (const file of adminPages) {
            const content = readFileSync(file, 'utf-8');
            // HTMLテンプレート文字列内の<thead>は対象外（manual等）
            if (file.includes('manual')) continue;
            // ネイティブ <thead> を含むファイルを検出
            const theadMatches = content.match(/<thead[\s>]/g);
            if (!theadMatches) continue;

            // <thead に sticky が含まれているか確認
            // <thead className="..." の中に sticky があるか
            const theadWithClass = content.match(/<thead\s+className="[^"]*"/g);
            if (theadWithClass) {
                for (const match of theadWithClass) {
                    if (!match.includes('sticky')) {
                        const relative = file.replace(projectRoot, '').replace(/\\/g, '/');
                        violations.push(`${relative}: ${match}`);
                    }
                }
            }

            // className なしの <thead> がある場合
            if (content.includes('<thead>')) {
                const relative = file.replace(projectRoot, '').replace(/\\/g, '/');
                violations.push(`${relative}: <thead> にstickyなし`);
            }
        }

        expect(violations, `ネイティブ<thead>にstickyが未適用:\n${violations.join('\n')}`).toEqual([]);
    });
});

describe('CollapsiblePanel コンポーネントチェック', () => {
    it('CollapsiblePanel が存在すること', () => {
        const panelPath = resolve(projectRoot, 'components/admin/collapsible-panel.tsx');
        expect(existsSync(panelPath)).toBe(true);
    });

    it('CollapsiblePanel が必要な props を受け取ること', () => {
        const panelPath = resolve(projectRoot, 'components/admin/collapsible-panel.tsx');
        const content = readFileSync(panelPath, 'utf-8');

        // 必要な props
        expect(content).toContain('title');
        expect(content).toContain('icon');
        expect(content).toContain('defaultOpen');
        expect(content).toContain('children');
    });

    it('CollapsiblePanel が use client であること', () => {
        const panelPath = resolve(projectRoot, 'components/admin/collapsible-panel.tsx');
        const content = readFileSync(panelPath, 'utf-8');

        expect(content).toContain('"use client"');
    });

    it('CollapsiblePanel が useState で開閉管理していること', () => {
        const panelPath = resolve(projectRoot, 'components/admin/collapsible-panel.tsx');
        const content = readFileSync(panelPath, 'utf-8');

        expect(content).toContain('useState');
        expect(content).toContain('setOpen');
    });

    it('在庫管理ページで CollapsiblePanel が使われていること', () => {
        const productsPage = resolve(projectRoot, 'app/(admin)/admin/products/page.tsx');
        const content = readFileSync(productsPage, 'utf-8');

        expect(content).toContain('CollapsiblePanel');
        // 少なくとも2箇所で使われていること（取り違え + 金額サマリー）
        const matches = content.match(/CollapsiblePanel/g);
        expect(matches!.length).toBeGreaterThanOrEqual(4); // 開始タグ×2 + 閉じタグ×2
    });
});

describe('在庫調整金額サマリー — ロジックチェック', () => {
    it('入荷取消し(Receipt Cancelled)を除外するフィルタがあること', () => {
        const productsPage = resolve(projectRoot, 'app/(admin)/admin/products/page.tsx');
        const content = readFileSync(productsPage, 'utf-8');

        expect(content).toContain('receipt cancelled');
        expect(content).toContain('order #');
        expect(content).toContain('continue');
    });

    it('金額計算で cost が使われていること', () => {
        const productsPage = resolve(projectRoot, 'app/(admin)/admin/products/page.tsx');
        const content = readFileSync(productsPage, 'utf-8');

        // cost フィールドを取得していること
        expect(content).toContain('cost: true');
        // 金額計算が存在すること
        expect(content).toContain('Math.abs(adj.quantity) * cost');
    });
});
