import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * モバイル横スクロール ガードテスト
 * テーブルを直接表示する画面に overflow-x-auto が適用されていることを保証する。
 * table.tsx の overflow-x-clip (sticky ヘッダーに必要) はそのまま維持しつつ、
 * 各ページの親コンテナで overflow-x-auto を設定することで横スクロールを実現する。
 */

const projectRoot = resolve(__dirname, '../../');

// テーブルを直接モバイルで表示する画面一覧
// カードUIにフォールバックする画面 (product-list, order-list, order-detail, logs-client) は除外
const pagesWithDirectTable: { file: string; description: string }[] = [
    { file: 'components/admin/transaction-list.tsx', description: '取引履歴' },
    { file: 'components/admin/vendor-list.tsx', description: '仕入先一覧' },
    { file: 'components/admin/pricing-dashboard.tsx', description: '価格設定' },
    { file: 'app/(admin)/admin/page.tsx', description: 'ダッシュボード' },
    { file: 'app/(admin)/admin/logs/login/page.tsx', description: 'ログイン履歴' },
    { file: 'app/(admin)/admin/aircon-logs/page.tsx', description: 'エアコンログ' },
    { file: 'app/(admin)/admin/aircon-orders/settings/page.tsx', description: 'エアコン発注設定' },
    { file: 'app/(admin)/analysis/page.tsx', description: '利益分析' },
];

describe('モバイル横スクロール ガードテスト', () => {
    it('table.tsx は overflow-x-clip を維持していること（sticky ヘッダーに必要）', () => {
        const tableUi = resolve(projectRoot, 'components/ui/table.tsx');
        const content = readFileSync(tableUi, 'utf-8');
        expect(content).toContain('overflow-x-clip');
    });

    pagesWithDirectTable.forEach(({ file, description }) => {
        it(`${description} (${file}) に overflow-x-auto があること`, () => {
            const filePath = resolve(projectRoot, file);
            const content = readFileSync(filePath, 'utf-8');
            expect(content).toContain('overflow-x-auto');
        });
    });
});
