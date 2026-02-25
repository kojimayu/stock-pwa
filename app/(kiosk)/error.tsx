"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, WifiOff, AlertTriangle } from "lucide-react";

/**
 * Kiosk用エラーバウンダリ
 * - サーバー再起動やビルド変更中のエラーを自動回復
 * - 10秒ごとに自動リトライ
 * - 手動リトライボタンも表示
 */
export default function KioskError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const [retryCount, setRetryCount] = useState(0);
    const [countdown, setCountdown] = useState(10);
    const [isRetrying, setIsRetrying] = useState(false);

    const handleRetry = useCallback(async () => {
        setIsRetrying(true);
        try {
            // サーバーが復帰しているか確認
            const res = await fetch("/api/version", { cache: "no-store" });
            if (res.ok) {
                // サーバー復帰 → リセット試行
                reset();
                return;
            }
        } catch {
            // まだサーバーダウン中
        }
        setIsRetrying(false);
        setRetryCount(prev => prev + 1);
        setCountdown(10);
    }, [reset]);

    // 自動リトライ（10秒ごと）
    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    handleRetry();
                    return 10;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [handleRetry]);

    // 20回リトライ失敗したらページごとリロード
    useEffect(() => {
        if (retryCount >= 20) {
            window.location.reload();
        }
    }, [retryCount]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
            <div className="max-w-md w-full text-center space-y-6">
                <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                    {isRetrying ? (
                        <RefreshCw className="w-8 h-8 text-amber-600 animate-spin" />
                    ) : (
                        <WifiOff className="w-8 h-8 text-amber-600" />
                    )}
                </div>

                <div>
                    <h2 className="text-xl font-bold text-slate-800">
                        接続を確認しています
                    </h2>
                    <p className="text-slate-500 mt-2 text-sm">
                        サーバーとの通信が一時的にできなくなっています。
                        <br />
                        自動的に再接続を試みます。
                    </p>
                </div>

                <div className="bg-white rounded-lg border p-4 space-y-2">
                    <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
                        <RefreshCw className={`w-4 h-4 ${isRetrying ? "animate-spin" : ""}`} />
                        <span>
                            {isRetrying
                                ? "再接続中..."
                                : `${countdown}秒後に自動リトライ`
                            }
                        </span>
                    </div>
                    {retryCount > 0 && (
                        <p className="text-xs text-slate-400">
                            リトライ回数: {retryCount}
                        </p>
                    )}
                </div>

                <Button
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className="w-full"
                    size="lg"
                >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isRetrying ? "animate-spin" : ""}`} />
                    今すぐ再接続
                </Button>

                <details className="text-left">
                    <summary className="text-xs text-slate-400 cursor-pointer">
                        技術情報
                    </summary>
                    <div className="mt-2 p-3 bg-slate-100 rounded text-xs text-slate-500 break-all">
                        <div className="flex items-center gap-1 mb-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span className="font-medium">エラー内容:</span>
                        </div>
                        {error.message}
                    </div>
                </details>
            </div>
        </div>
    );
}
