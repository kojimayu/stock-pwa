/**
 * JST (UTC+9) の日付ユーティリティ
 *
 * toISOString() は UTC を返すため、朝9時 JST 前に呼ぶと「前日」の日付になる。
 * 日本時間で日付境界（0:00 JST）を正しく扱うためにこのユーティリティを使用する。
 */

/** JST (UTC+9) の YYYY-MM-DD 文字列を返す */
export function getJSTDateString(date?: Date): string {
    const d = date ?? new Date();
    const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return jst.toISOString().slice(0, 10);
}
