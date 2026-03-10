import { describe, it, expect, vi, afterEach } from 'vitest';
import { getJSTDateString } from '@/lib/date-utils';

describe('getJSTDateString', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('UTC 15:00 (JST 翌日0:00) は翌日の日付を返す', () => {
        // 2026-03-09 15:00 UTC = 2026-03-10 00:00 JST
        vi.setSystemTime(new Date('2026-03-09T15:00:00Z'));
        expect(getJSTDateString()).toBe('2026-03-10');
    });

    it('UTC 14:59 (JST 当日23:59) は当日の日付を返す', () => {
        // 2026-03-09 14:59 UTC = 2026-03-09 23:59 JST
        vi.setSystemTime(new Date('2026-03-09T14:59:00Z'));
        expect(getJSTDateString()).toBe('2026-03-09');
    });

    it('UTC 23:44 (JST 翌日8:44) は翌日の日付を返す — 音声バグの再現ケース', () => {
        // 2026-03-09 23:44 UTC = 2026-03-10 08:44 JST
        // 以前のバグ: toISOString().slice(0,10) が "2026-03-09" を返していた
        vi.setSystemTime(new Date('2026-03-09T23:44:00Z'));
        expect(getJSTDateString()).toBe('2026-03-10');
    });

    it('UTC 00:00 (JST 9:00) は当日の日付を返す', () => {
        // 2026-03-10 00:00 UTC = 2026-03-10 09:00 JST
        vi.setSystemTime(new Date('2026-03-10T00:00:00Z'));
        expect(getJSTDateString()).toBe('2026-03-10');
    });

    it('年またぎ: 12月31日 UTC 15:00 = 1月1日 JST', () => {
        vi.setSystemTime(new Date('2025-12-31T15:00:00Z'));
        expect(getJSTDateString()).toBe('2026-01-01');
    });

    it('引数にDateを渡すとそのDateのJST日付を返す', () => {
        const date = new Date('2026-06-15T22:30:00Z'); // JST = 6/16 07:30
        expect(getJSTDateString(date)).toBe('2026-06-16');
    });

    it('YYYY-MM-DD 形式の文字列を返す', () => {
        vi.setSystemTime(new Date('2026-03-05T00:00:00Z'));
        const result = getJSTDateString();
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});
