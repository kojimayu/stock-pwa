/**
 * メール送信の安全ガードユーティリティ
 *
 * 開発環境やテストモードでメールが本番宛先に送信されることを防止する。
 */

export type EmailSafetyResult = {
    /** メール送信を許可するかどうか */
    allowed: boolean;
    /** テストモードかどうか */
    isTestMode: boolean;
    /** 実際に使用するメール宛先（テストモード時はリダイレクト先） */
    toEmail: string;
    /** CCリスト（テストモード時は空配列） */
    ccEmails: { email: string }[];
    /** ブロック理由（blockedの場合） */
    reason?: string;
};

/**
 * メール送信の安全チェックを行う。
 * - NODE_ENV=development → 自動テストモード
 * - TEST_MODE=true → テストモード
 * - テストモード時はTEST_EMAIL_OVERRIDEにリダイレクト、未設定ならブロック
 * - テストモード時はCC空化
 */
export function checkEmailSafety(params: {
    nodeEnv: string | undefined;
    testMode: string | undefined;
    testEmailOverride: string | undefined;
    originalToEmail: string;
    originalCcEmails: { email: string }[];
}): EmailSafetyResult {
    const { nodeEnv, testMode, testEmailOverride, originalToEmail, originalCcEmails } = params;

    const isDevMode = nodeEnv === "development";
    const isTestMode = isDevMode || testMode === "true";

    if (!isTestMode) {
        // 本番モード: そのまま送信
        return {
            allowed: true,
            isTestMode: false,
            toEmail: originalToEmail,
            ccEmails: originalCcEmails,
        };
    }

    // テストモード
    if (!testEmailOverride) {
        // リダイレクト先が未設定 → 送信ブロック
        return {
            allowed: false,
            isTestMode: true,
            toEmail: originalToEmail,
            ccEmails: [],
            reason: `テストモード: TEST_EMAIL_OVERRIDE が未設定のためメール送信をブロック (${isDevMode ? "開発環境" : "TEST_MODE=true"})`,
        };
    }

    // リダイレクト先が設定済み → テスト宛先に変更
    return {
        allowed: true,
        isTestMode: true,
        toEmail: testEmailOverride,
        ccEmails: [], // CC空化で安全確保
    };
}
