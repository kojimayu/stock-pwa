/**
 * メール安全ガードテスト
 * 
 * 開発環境やテストモードでメールが本番宛先に送信されないことを保証する。
 * 実際にメールが飛んでしまった事故が過去にあったため、このテストは重要。
 */

import { describe, it, expect } from 'vitest';
import { checkEmailSafety } from '@/lib/email-safety';

const REAL_EMAIL = 'supplier@real-company.co.jp';
const REAL_CC = [
    { email: 'cc1@real-company.co.jp' },
    { email: 'cc2@real-company.co.jp' },
];
const TEST_EMAIL = 'test@example.com';

// ═══════════════════════════════════════════════════════════════
// 1. 本番環境 (production) — メールがそのまま送信される
// ═══════════════════════════════════════════════════════════════
describe('本番環境 — メール安全ガード', () => {
    it('✅ NODE_ENV=production → メールがそのまま送信される', () => {
        const result = checkEmailSafety({
            nodeEnv: 'production',
            testMode: undefined,
            testEmailOverride: undefined,
            originalToEmail: REAL_EMAIL,
            originalCcEmails: REAL_CC,
        });

        expect(result.allowed).toBe(true);
        expect(result.isTestMode).toBe(false);
        expect(result.toEmail).toBe(REAL_EMAIL);
        expect(result.ccEmails).toEqual(REAL_CC);
    });

    it('✅ NODE_ENV=production + TEST_MODE=false → 本番として送信', () => {
        const result = checkEmailSafety({
            nodeEnv: 'production',
            testMode: 'false',
            testEmailOverride: TEST_EMAIL,
            originalToEmail: REAL_EMAIL,
            originalCcEmails: REAL_CC,
        });

        expect(result.allowed).toBe(true);
        expect(result.isTestMode).toBe(false);
        expect(result.toEmail).toBe(REAL_EMAIL);
    });
});

// ═══════════════════════════════════════════════════════════════
// 2. 開発環境 (development) — 絶対に本番宛先に送信しない
// ═══════════════════════════════════════════════════════════════
describe('開発環境 — メール安全ガード', () => {
    it('🔒 NODE_ENV=development + TEST_EMAIL_OVERRIDE未設定 → 送信ブロック', () => {
        const result = checkEmailSafety({
            nodeEnv: 'development',
            testMode: undefined,
            testEmailOverride: undefined,
            originalToEmail: REAL_EMAIL,
            originalCcEmails: REAL_CC,
        });

        expect(result.allowed).toBe(false);
        expect(result.isTestMode).toBe(true);
        expect(result.reason).toContain('ブロック');
    });

    it('🔒 NODE_ENV=development → 本番メールアドレスには絶対に送信しない', () => {
        const result = checkEmailSafety({
            nodeEnv: 'development',
            testMode: undefined,
            testEmailOverride: TEST_EMAIL,
            originalToEmail: REAL_EMAIL,
            originalCcEmails: REAL_CC,
        });

        expect(result.allowed).toBe(true);
        expect(result.isTestMode).toBe(true);
        expect(result.toEmail).toBe(TEST_EMAIL); // テスト宛先にリダイレクト
        expect(result.toEmail).not.toBe(REAL_EMAIL); // 本番宛先ではない
    });

    it('🔒 NODE_ENV=development → CCは空になる', () => {
        const result = checkEmailSafety({
            nodeEnv: 'development',
            testMode: undefined,
            testEmailOverride: TEST_EMAIL,
            originalToEmail: REAL_EMAIL,
            originalCcEmails: REAL_CC,
        });

        expect(result.ccEmails).toEqual([]); // CC空化
    });
});

// ═══════════════════════════════════════════════════════════════
// 3. TEST_MODE=true (明示的テストモード)
// ═══════════════════════════════════════════════════════════════
describe('TEST_MODE=true — メール安全ガード', () => {
    it('🔒 TEST_MODE=true + TEST_EMAIL_OVERRIDE未設定 → 送信ブロック', () => {
        const result = checkEmailSafety({
            nodeEnv: 'production', // 本番環境でもTEST_MODEが優先
            testMode: 'true',
            testEmailOverride: undefined,
            originalToEmail: REAL_EMAIL,
            originalCcEmails: REAL_CC,
        });

        expect(result.allowed).toBe(false);
        expect(result.isTestMode).toBe(true);
        expect(result.reason).toContain('ブロック');
    });

    it('🔒 TEST_MODE=true + TEST_EMAIL_OVERRIDE設定 → テスト宛先にリダイレクト', () => {
        const result = checkEmailSafety({
            nodeEnv: 'production',
            testMode: 'true',
            testEmailOverride: TEST_EMAIL,
            originalToEmail: REAL_EMAIL,
            originalCcEmails: REAL_CC,
        });

        expect(result.allowed).toBe(true);
        expect(result.isTestMode).toBe(true);
        expect(result.toEmail).toBe(TEST_EMAIL);
        expect(result.ccEmails).toEqual([]);
    });
});

// ═══════════════════════════════════════════════════════════════
// 4. Vitestテスト環境 (NODE_ENV=test) — テストで絶対にメールが飛ばない
// ═══════════════════════════════════════════════════════════════
describe('テスト環境 — メール事故防止', () => {
    it('🔒 現在の環境ではメールが本番宛先に送信されない', () => {
        // Vitestでは NODE_ENV は "test" のため development ではないが、
        // テスト実行中にメール送信関数が呼ばれた場合の安全確認
        const currentNodeEnv = process.env.NODE_ENV;

        // development or test → テストモードとして扱うべき
        const result = checkEmailSafety({
            nodeEnv: currentNodeEnv,
            testMode: 'true', // テスト実行時はTEST_MODE=trueを推奨
            testEmailOverride: undefined,
            originalToEmail: REAL_EMAIL,
            originalCcEmails: REAL_CC,
        });

        // テスト環境では送信がブロックされるべき
        expect(result.allowed).toBe(false);
        expect(result.isTestMode).toBe(true);
    });

    it('🔒 メール宛先が本番アドレスのまま返ることは絶対にない（dev+override設定時）', () => {
        const result = checkEmailSafety({
            nodeEnv: 'development',
            testMode: undefined,
            testEmailOverride: TEST_EMAIL,
            originalToEmail: REAL_EMAIL,
            originalCcEmails: REAL_CC,
        });

        // 返されるtoEmailが本番メールと異なることを保証
        expect(result.toEmail).not.toBe(REAL_EMAIL);
        expect(result.toEmail).toBe(TEST_EMAIL);

        // CCにも本番メールが含まれないことを保証
        const allEmails = [result.toEmail, ...result.ccEmails.map(c => c.email)];
        expect(allEmails).not.toContain(REAL_EMAIL);
        expect(allEmails).not.toContain('cc1@real-company.co.jp');
        expect(allEmails).not.toContain('cc2@real-company.co.jp');
    });
});
