/**
 * 管理者名前解決ユーティリティ
 * .env の ADMIN_NAMES マッピングからメールアドレス→名前を解決
 * 
 * .env例: ADMIN_NAMES=user@example.com:小島,admin@example.com:田中
 */

// サーバーサイド: .envから名前マッピングを取得
export function getAdminNameMap(): Record<string, string> {
    const mapping = process.env.ADMIN_NAMES || "";
    const map: Record<string, string> = {};
    if (!mapping) return map;

    mapping.split(",").forEach(entry => {
        const [email, name] = entry.trim().split(":");
        if (email && name) {
            map[email.trim().toLowerCase()] = name.trim();
        }
    });
    return map;
}

// サーバーサイド: メールアドレスから名前を取得（見つからなければメールを返す）
export function resolveAdminName(email: string): string {
    if (!email) return "管理者";
    const map = getAdminNameMap();
    return map[email.toLowerCase()] || email;
}
