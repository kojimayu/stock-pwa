/**
 * 関東機材の送料チェック・出荷日計算ユーティリティ
 *
 * - 送料無料ライン: ¥30,000（税抜仕入値ベース）
 * - 注文締切: 営業日 11:00
 * - 営業日: 月〜金（祝日除く）
 */

// 日本の祝日（2026〜2027年分、必要に応じて追加）
// 参考: https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html
const JAPANESE_HOLIDAYS: string[] = [
    // 2026年
    "2026-01-01", // 元日
    "2026-01-12", // 成人の日
    "2026-02-11", // 建国記念の日
    "2026-02-23", // 天皇誕生日
    "2026-03-20", // 春分の日
    "2026-04-29", // 昭和の日
    "2026-05-03", // 憲法記念日
    "2026-05-04", // みどりの日
    "2026-05-05", // こどもの日
    "2026-05-06", // 振替休日
    "2026-07-20", // 海の日
    "2026-08-11", // 山の日
    "2026-09-21", // 敬老の日
    "2026-09-22", // 秋分の日 (予測)
    "2026-09-23", // 国民の休日
    "2026-10-12", // スポーツの日
    "2026-11-03", // 文化の日
    "2026-11-23", // 勤労感謝の日
    // 2027年
    "2027-01-01", // 元日
    "2027-01-11", // 成人の日
    "2027-02-11", // 建国記念の日
    "2027-02-23", // 天皇誕生日
    "2027-03-21", // 春分の日 (予測)
    "2027-04-29", // 昭和の日
    "2027-05-03", // 憲法記念日
    "2027-05-04", // みどりの日
    "2027-05-05", // こどもの日
    "2027-07-19", // 海の日
    "2027-08-11", // 山の日
    "2027-09-20", // 敬老の日
    "2027-09-23", // 秋分の日 (予測)
    "2027-10-11", // スポーツの日
    "2027-11-03", // 文化の日
    "2027-11-23", // 勤労感謝の日
];

const holidaySet = new Set(JAPANESE_HOLIDAYS);

/** 送料無料の閾値（税抜仕入値ベース） */
export const FREE_SHIPPING_THRESHOLD = 30000;

/** 注文締切時間（24h形式） */
export const ORDER_CUTOFF_HOUR = 11;

/** 送料チェック対象の仕入先名 */
export const SHIPPING_CHECK_SUPPLIERS = ["関東機材"];

/**
 * 指定日がJST日本の祝日かどうか
 */
export function isJapaneseHoliday(date: Date): boolean {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return holidaySet.has(`${yyyy}-${mm}-${dd}`);
}

/**
 * 営業日かどうか（月〜金 かつ 祝日でない）
 */
export function isBusinessDay(date: Date): boolean {
    const day = date.getDay();
    if (day === 0 || day === 6) return false; // 土日
    return !isJapaneseHoliday(date);
}

/**
 * 翌営業日を返す
 */
export function getNextBusinessDay(date: Date): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    while (!isBusinessDay(next)) {
        next.setDate(next.getDate() + 1);
    }
    return next;
}

/**
 * 現在時刻から出荷予定日を計算する
 *
 * - 営業日の11:00前 → 当日出荷
 * - 営業日の11:00以降 → 翌営業日出荷
 * - 非営業日 → 翌営業日出荷
 *
 * @param now JSTの現在時刻
 * @returns 出荷予定日
 */
export function getShippingDate(now: Date): Date {
    if (isBusinessDay(now) && now.getHours() < ORDER_CUTOFF_HOUR) {
        return now;
    }
    return getNextBusinessDay(now);
}

/**
 * 出荷情報を取得する
 */
export function getShippingInfo(now: Date): {
    shippingDate: Date;
    isSameDay: boolean;
    cutoffPassed: boolean;
} {
    const isBizDay = isBusinessDay(now);
    const beforeCutoff = now.getHours() < ORDER_CUTOFF_HOUR;
    const isSameDay = isBizDay && beforeCutoff;

    return {
        shippingDate: getShippingDate(now),
        isSameDay,
        cutoffPassed: isBizDay && !beforeCutoff,
    };
}

/**
 * 送料判定
 */
export function checkShippingFee(totalCost: number): {
    isFreeShipping: boolean;
    shortage: number;
} {
    const isFree = totalCost >= FREE_SHIPPING_THRESHOLD;
    return {
        isFreeShipping: isFree,
        shortage: isFree ? 0 : FREE_SHIPPING_THRESHOLD - totalCost,
    };
}

/**
 * 仕入先が送料チェック対象かどうか
 */
export function isShippingCheckTarget(supplier: string | null | undefined): boolean {
    if (!supplier) return false;
    return SHIPPING_CHECK_SUPPLIERS.some(s => supplier.includes(s));
}
