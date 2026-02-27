"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export function useOnlineStatus() {
    const [isOnline, setIsOnline] = useState(true);

    // 連続失敗カウント（refにしてコールバックの依存からはずす）
    const failureCountRef = useRef(0);

    const checkServerConnection = useCallback(async () => {
        // ページ非表示中はチェックをスキップ（タブ切替時の誤検知防止）
        if (typeof document !== "undefined" && document.visibilityState === "hidden") {
            return;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const res = await fetch('/api/health', {
                method: 'HEAD',
                cache: 'no-store',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (res.ok) {
                setIsOnline(true);
                failureCountRef.current = 0;
            } else {
                handleFailure();
            }
        } catch (e) {
            handleFailure();
        }
    }, []);

    const handleFailure = () => {
        failureCountRef.current += 1;
        // 3回連続失敗でオフライン判定（誤検知防止）
        if (failureCountRef.current >= 3) {
            setIsOnline(false);
        }
    };

    useEffect(() => {
        if (typeof window !== "undefined") {
            // 初期チェック
            setIsOnline(navigator.onLine);
            checkServerConnection();

            // ブラウザのイベントリスナー（即時反応用）
            const handleOnline = () => {
                checkServerConnection();
            };
            const handleOffline = () => setIsOnline(false);

            // ページ復帰時にチェック（タブ切替から戻った時）
            const handleVisibilityChange = () => {
                if (document.visibilityState === "visible") {
                    // 復帰時は一旦リセットしてから確認
                    failureCountRef.current = 0;
                    checkServerConnection();
                }
            };

            window.addEventListener("online", handleOnline);
            window.addEventListener("offline", handleOffline);
            document.addEventListener("visibilitychange", handleVisibilityChange);

            // 定期ポーリング（15秒ごと — 誤検知防止のため5秒から延長）
            const interval = setInterval(checkServerConnection, 15000);

            return () => {
                window.removeEventListener("online", handleOnline);
                window.removeEventListener("offline", handleOffline);
                document.removeEventListener("visibilitychange", handleVisibilityChange);
                clearInterval(interval);
            };
        }
    }, [checkServerConnection]);

    return isOnline;
}

