import { describe, it, expect } from 'vitest';
import {
    isBusinessDay,
    isJapaneseHoliday,
    getNextBusinessDay,
    getShippingDate,
    getShippingInfo,
    checkShippingFee,
    isShippingCheckTarget,
    FREE_SHIPPING_THRESHOLD,
} from '@/lib/shipping-utils';

// ヘルパー: JST日時を作成
function jst(year: number, month: number, day: number, hour: number = 0, minute: number = 0): Date {
    return new Date(year, month - 1, day, hour, minute);
}

describe('isBusinessDay', () => {
    it('月曜日は営業日', () => {
        expect(isBusinessDay(jst(2026, 3, 9))).toBe(true); // 月曜
    });

    it('金曜日は営業日', () => {
        expect(isBusinessDay(jst(2026, 3, 13))).toBe(true); // 金曜
    });

    it('土曜日は非営業日', () => {
        expect(isBusinessDay(jst(2026, 3, 14))).toBe(false); // 土曜
    });

    it('日曜日は非営業日', () => {
        expect(isBusinessDay(jst(2026, 3, 15))).toBe(false); // 日曜
    });

    it('祝日（春分の日）は非営業日', () => {
        expect(isBusinessDay(jst(2026, 3, 20))).toBe(false); // 春分の日
    });

    it('元日は非営業日', () => {
        expect(isBusinessDay(jst(2026, 1, 1))).toBe(false);
    });
});

describe('isJapaneseHoliday', () => {
    it('元日は祝日', () => {
        expect(isJapaneseHoliday(jst(2026, 1, 1))).toBe(true);
    });

    it('通常の営業日は祝日ではない', () => {
        expect(isJapaneseHoliday(jst(2026, 3, 9))).toBe(false);
    });
});

describe('getNextBusinessDay', () => {
    it('金曜日の翌営業日は月曜日', () => {
        const result = getNextBusinessDay(jst(2026, 3, 13)); // 金曜
        expect(result.getDay()).toBe(1); // 月曜
        expect(result.getDate()).toBe(16);
    });

    it('土曜日の翌営業日は月曜日', () => {
        const result = getNextBusinessDay(jst(2026, 3, 14)); // 土曜
        expect(result.getDay()).toBe(1);
        expect(result.getDate()).toBe(16);
    });

    it('祝日前日の翌営業日は祝日の翌日', () => {
        // 2026-03-19(木) → 2026-03-20(金・春分の日) はスキップ → 2026-03-23(月)
        const result = getNextBusinessDay(jst(2026, 3, 19)); // 木曜
        expect(result.getDate()).toBe(23); // 月曜
    });
});

describe('getShippingDate', () => {
    it('営業日の10:00 → 当日出荷', () => {
        const now = jst(2026, 3, 9, 10, 0); // 月曜10:00
        const result = getShippingDate(now);
        expect(result.getDate()).toBe(9);
    });

    it('営業日の10:59 → 当日出荷', () => {
        const now = jst(2026, 3, 9, 10, 59);
        const result = getShippingDate(now);
        expect(result.getDate()).toBe(9);
    });

    it('営業日の11:00 → 翌営業日出荷（締切後）', () => {
        const now = jst(2026, 3, 9, 11, 0); // 月曜11:00
        const result = getShippingDate(now);
        expect(result.getDate()).toBe(10); // 火曜
    });

    it('営業日の11:01 → 翌営業日出荷', () => {
        const now = jst(2026, 3, 9, 11, 1);
        const result = getShippingDate(now);
        expect(result.getDate()).toBe(10);
    });

    it('金曜15:00 → 翌月曜出荷', () => {
        const now = jst(2026, 3, 13, 15, 0); // 金曜15:00
        const result = getShippingDate(now);
        expect(result.getDate()).toBe(16); // 月曜
    });

    it('土曜 → 翌月曜出荷', () => {
        const now = jst(2026, 3, 14, 9, 0); // 土曜
        const result = getShippingDate(now);
        expect(result.getDate()).toBe(16); // 月曜
    });

    it('日曜 → 翌月曜出荷', () => {
        const now = jst(2026, 3, 15, 9, 0); // 日曜
        const result = getShippingDate(now);
        expect(result.getDate()).toBe(16);
    });

    it('祝日（春分の日・金曜）→ 翌月曜出荷', () => {
        const now = jst(2026, 3, 20, 9, 0); // 春分の日（金曜）
        const result = getShippingDate(now);
        expect(result.getDate()).toBe(23); // 月曜
    });
});

describe('getShippingInfo', () => {
    it('営業日10:00 → 当日出荷, cutoffPassed=false', () => {
        const info = getShippingInfo(jst(2026, 3, 9, 10, 0));
        expect(info.isSameDay).toBe(true);
        expect(info.cutoffPassed).toBe(false);
    });

    it('営業日14:00 → 翌営業日出荷, cutoffPassed=true', () => {
        const info = getShippingInfo(jst(2026, 3, 9, 14, 0));
        expect(info.isSameDay).toBe(false);
        expect(info.cutoffPassed).toBe(true);
    });

    it('土曜 → 翌営業日出荷, cutoffPassed=false', () => {
        const info = getShippingInfo(jst(2026, 3, 14, 9, 0));
        expect(info.isSameDay).toBe(false);
        expect(info.cutoffPassed).toBe(false);
    });
});

describe('checkShippingFee', () => {
    it('¥30,000以上 → 送料無料', () => {
        const result = checkShippingFee(30000);
        expect(result.isFreeShipping).toBe(true);
        expect(result.shortage).toBe(0);
    });

    it('¥50,000 → 送料無料', () => {
        const result = checkShippingFee(50000);
        expect(result.isFreeShipping).toBe(true);
    });

    it('¥29,999 → 送料あり、不足¥1', () => {
        const result = checkShippingFee(29999);
        expect(result.isFreeShipping).toBe(false);
        expect(result.shortage).toBe(1);
    });

    it('¥0 → 送料あり、不足¥30,000', () => {
        const result = checkShippingFee(0);
        expect(result.isFreeShipping).toBe(false);
        expect(result.shortage).toBe(FREE_SHIPPING_THRESHOLD);
    });
});

describe('isShippingCheckTarget', () => {
    it('関東機材は対象', () => {
        expect(isShippingCheckTarget('関東機材')).toBe(true);
    });

    it('株式会社関東機材も対象（部分一致）', () => {
        expect(isShippingCheckTarget('株式会社関東機材')).toBe(true);
    });

    it('他の仕入先は対象外', () => {
        expect(isShippingCheckTarget('ABC商事')).toBe(false);
    });

    it('nullは対象外', () => {
        expect(isShippingCheckTarget(null)).toBe(false);
    });

    it('undefinedは対象外', () => {
        expect(isShippingCheckTarget(undefined)).toBe(false);
    });
});
