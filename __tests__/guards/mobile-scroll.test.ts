import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * モバイル横スクロール ガードテスト
 * table.tsx のレスポンシブクラスを検証:
 * - モバイル: overflow-x-auto（横スクロール可能）
 * - PC (md以上): overflow-x-clip（sticky ヘッダー維持）
 */

const projectRoot = resolve(__dirname, '../../');

describe('モバイル横スクロール ガードテスト', () => {
    it('table.tsx にレスポンシブ overflow クラスがあること', () => {
        const tableUi = resolve(projectRoot, 'components/ui/table.tsx');
        const content = readFileSync(tableUi, 'utf-8');

        // モバイル: overflow-x-auto, PC: overflow-x-clip
        expect(content).toContain('overflow-x-auto');
        expect(content).toContain('md:overflow-x-clip');
    });

    it('table.tsx に sticky ヘッダーがあること', () => {
        const tableUi = resolve(projectRoot, 'components/ui/table.tsx');
        const content = readFileSync(tableUi, 'utf-8');
        expect(content).toContain('sticky');
        expect(content).toContain('top-0');
        expect(content).toContain('z-10');
    });
});
