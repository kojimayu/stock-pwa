// Access DB連携を許可する業者と、Access上での検索用キーワードのマッピング定義
// Key: Webアプリ上のVendor.name
// Value: Access DB上で検索するキーワード（会社名の一部など）

export const ACCESS_VENDOR_MAP: Record<string, string> = {
    // 開発/テスト用
    //"Test Vendor": "メルテック", 
    "株式会社サンプル": "サンプル",

    // 本番運用用（必要に応じて追加してください）
    // "Web上の名前": "Access上の名前(部分一致用)",
};

/**
 * ベンダー名からAccess検索用キーワードを取得する
 * リストにない場合は null を返す（＝Access連携権限なし）
 */
export function getAccessSearchKeyword(webVendorName: string): string | null {
    return ACCESS_VENDOR_MAP[webVendorName] || null;
}
