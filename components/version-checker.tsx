"use client";

import { useEffect, useRef, useCallback } from "react";

// ビルド時のバージョン（クライアント側に埋め込まれる）
const CLIENT_BUILD_DATE = process.env.NEXT_PUBLIC_BUILD_DATE || "unknown";

// チェック間隔（5分）
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * PWA自動更新チェッカー
 * - ページ読み込み時にService Workerの更新をチェック
 * - 5分ごとに /api/version と比較
 * - 入力中（フォーカスがinput/textarea/select）はリロードしない
 * - 入力が終了した後に安全にリロード
 */
export function VersionChecker() {
    const pendingUpdate = useRef(false);

    // ユーザーが入力中かどうかを判定
    const isUserTyping = useCallback(() => {
        const activeEl = document.activeElement;
        if (!activeEl) return false;
        const tag = activeEl.tagName.toLowerCase();
        // input, textarea, select, contenteditable にフォーカスがある場合
        if (tag === "input" || tag === "textarea" || tag === "select") return true;
        if (activeEl.getAttribute("contenteditable") === "true") return true;
        return false;
    }, []);

    // 安全にリロード（入力中でなければすぐ、入力中なら待機）
    const safeReload = useCallback(() => {
        if (isUserTyping()) {
            // 入力中はフラグを立てて、フォーカスが外れた時にリロード
            pendingUpdate.current = true;
            console.log("[VersionChecker] 更新待機中（入力中のためリロードを遅延）");
            return;
        }
        console.log("[VersionChecker] 新しいバージョンを検出、リロードします");
        window.location.reload();
    }, [isUserTyping]);

    useEffect(() => {
        // フォーカスが外れた時に、保留中の更新があればリロード
        const handleBlur = () => {
            // 少し待ってからチェック（別のinputに移動する可能性があるため）
            setTimeout(() => {
                if (pendingUpdate.current && !isUserTyping()) {
                    console.log("[VersionChecker] 入力完了、保留中の更新をリロードします");
                    window.location.reload();
                }
            }, 1000);
        };

        document.addEventListener("focusout", handleBlur);
        return () => document.removeEventListener("focusout", handleBlur);
    }, [isUserTyping]);

    useEffect(() => {
        // 1. Service Worker の更新チェック
        const checkSW = async () => {
            if ("serviceWorker" in navigator) {
                try {
                    const registration = await navigator.serviceWorker.getRegistration();
                    if (registration) {
                        await registration.update();
                        console.log("[VersionChecker] SW更新チェック完了");
                    }
                } catch (err) {
                    console.warn("[VersionChecker] SW更新チェック失敗:", err);
                }
            }
        };

        // 2. バージョンAPIとの比較チェック
        const checkVersion = async () => {
            try {
                const res = await fetch("/api/version", { cache: "no-store" });
                if (!res.ok) return;
                const data = await res.json();

                if (
                    CLIENT_BUILD_DATE !== "unknown" &&
                    data.buildDate !== "unknown" &&
                    data.buildDate !== CLIENT_BUILD_DATE
                ) {
                    console.log("[VersionChecker] バージョン不一致",
                        "クライアント:", CLIENT_BUILD_DATE,
                        "サーバー:", data.buildDate
                    );
                    safeReload();
                }
            } catch {
                // ネットワークエラーは無視（オフライン時など）
            }
        };

        // 初回チェック（3秒後に開始、読み込み直後は避ける）
        const initialTimer = setTimeout(() => {
            checkSW();
            checkVersion();
        }, 3000);

        // 定期チェック（5分ごと）
        const interval = setInterval(() => {
            checkSW();
            checkVersion();
        }, CHECK_INTERVAL_MS);

        // ページが再表示された時（タブ切り替え・スリープ復帰）にもチェック
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                checkSW();
                checkVersion();
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            clearTimeout(initialTimer);
            clearInterval(interval);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [safeReload]);

    // UIは不要（バックグラウンドで動作）
    return null;
}
