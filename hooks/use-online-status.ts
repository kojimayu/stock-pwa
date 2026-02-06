"use client";

import { useState, useEffect, useCallback } from "react";

export function useOnlineStatus() {
    const [isOnline, setIsOnline] = useState(true);

    const checkServerConnection = useCallback(async () => {
        try {
            // タイムアウトを短めに設定して確認
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const res = await fetch('/api/health', {
                method: 'HEAD',
                cache: 'no-store',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (res.ok) {
                setIsOnline(true);
            } else {
                setIsOnline(false);
            }
        } catch (e) {
            setIsOnline(false);
        }
    }, []);

    useEffect(() => {
        if (typeof window !== "undefined") {
            // 初期チェック
            setIsOnline(navigator.onLine);
            checkServerConnection();

            // ブラウザのイベントリスナー（即時反応用）
            const handleOnline = () => {
                // ネットワークがつながってもサーバーにつながるとは限らないのでCheckする
                checkServerConnection();
            };
            const handleOffline = () => setIsOnline(false);

            window.addEventListener("online", handleOnline);
            window.addEventListener("offline", handleOffline);

            // 定期ポーリング（5秒ごと）
            const interval = setInterval(checkServerConnection, 5000);

            return () => {
                window.removeEventListener("online", handleOnline);
                window.removeEventListener("offline", handleOffline);
                clearInterval(interval);
            };
        }
    }, [checkServerConnection]);

    return isOnline;
}
