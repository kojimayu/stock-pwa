"use client";

import { useState, useEffect, useCallback } from "react";

export function useOnlineStatus() {
    const [isOnline, setIsOnline] = useState(true);

    // 連続失敗カウント
    const [failureCount, setFailureCount] = useState(0);

    const checkServerConnection = useCallback(async () => {
        try {
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
                setFailureCount(0); // 成功したらリセット
            } else {
                // サーバーエラー等は失敗とみなす
                handleFailure();
            }
        } catch (e) {
            // ネットワークエラーやタイムアウト
            handleFailure();
        }
    }, [failureCount]); // failureCountへの依存は避けたほうがいいが、setFailureCount(prev => ...)を使うのでOK

    const handleFailure = () => {
        setFailureCount((prev) => {
            const newCount = prev + 1;
            // 2回連続失敗でオフライン判定
            if (newCount >= 2) {
                setIsOnline(false);
            }
            return newCount;
        });
    };

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
