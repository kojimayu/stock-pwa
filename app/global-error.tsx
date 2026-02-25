"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * グローバルエラーバウンダリ（ルートレベル）
 * - JSバンドル不一致、チャンク読み込み失敗などの致命的エラーをキャッチ
 * - 自動リロードで回復を試みる
 * 
 * Note: global-error.tsx は独自の <html><body> を持つ必要がある
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const [countdown, setCountdown] = useState(5);
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        console.error("[GlobalError]", error.message);
    }, [error]);

    // 5秒後に自動リロード
    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    // 3回リトライしてもダメなら強制フルリロード（キャッシュクリア）
                    if (retryCount >= 2) {
                        // Service Workerを解除してからリロード
                        if ("serviceWorker" in navigator) {
                            navigator.serviceWorker.getRegistrations().then(registrations => {
                                registrations.forEach(reg => reg.unregister());
                            }).finally(() => {
                                window.location.href = window.location.pathname + "?cache_bust=" + Date.now();
                            });
                        } else {
                            window.location.href = window.location.pathname + "?cache_bust=" + Date.now();
                        }
                    } else {
                        setRetryCount(r => r + 1);
                        reset();
                    }
                    return 5;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [reset, retryCount]);

    return (
        <html lang="ja">
            <body style={{
                margin: 0,
                fontFamily: "system-ui, -apple-system, sans-serif",
                backgroundColor: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "100vh",
            }}>
                <div style={{
                    textAlign: "center",
                    padding: "2rem",
                    maxWidth: "400px",
                }}>
                    <div style={{
                        width: "64px",
                        height: "64px",
                        margin: "0 auto 1.5rem",
                        backgroundColor: "#fef3c7",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "32px",
                    }}>
                        🔄
                    </div>
                    <h2 style={{
                        fontSize: "1.25rem",
                        fontWeight: "bold",
                        color: "#1e293b",
                        margin: "0 0 0.5rem",
                    }}>
                        画面を更新しています
                    </h2>
                    <p style={{
                        fontSize: "0.875rem",
                        color: "#64748b",
                        margin: "0 0 1.5rem",
                        lineHeight: 1.6,
                    }}>
                        システムが更新されました。
                        <br />
                        {countdown}秒後に自動的にリロードされます。
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            width: "100%",
                            padding: "12px 24px",
                            backgroundColor: "#0f172a",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            fontSize: "1rem",
                            fontWeight: 500,
                            cursor: "pointer",
                        }}
                    >
                        今すぐリロード
                    </button>
                    {retryCount > 0 && (
                        <p style={{
                            fontSize: "0.75rem",
                            color: "#94a3b8",
                            marginTop: "1rem",
                        }}>
                            リトライ: {retryCount}回目
                            {retryCount >= 2 && " (キャッシュクリア予定)"}
                        </p>
                    )}
                </div>
            </body>
        </html>
    );
}
