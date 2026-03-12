"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * 新しいビルドが検出されたら、安全なタイミングで自動リロードするフック
 *
 * 条件（全て満たした時のみリロード）:
 * - 新しいビルド（commitHash変更）が検出された
 * - 30秒以上操作がない（タッチ/クリック/スクロールなし）
 * - isIdle が trueと外部から指定されている（ホーム画面・カート空など）
 *
 * @param isIdle 現在のページが安全にリロード可能な状態か
 * @param checkIntervalMs チェック間隔（ミリ秒、デフォルト60秒）
 * @param idleTimeoutMs 無操作判定時間（ミリ秒、デフォルト30秒）
 */
export function useAutoReload(
    isIdle: boolean,
    checkIntervalMs = 60_000,
    idleTimeoutMs = 30_000
) {
    const knownCommitRef = useRef<string | null>(null);
    const newBuildDetectedRef = useRef(false);
    const lastActivityRef = useRef(Date.now());

    // ユーザー操作を検知してタイマーリセット
    useEffect(() => {
        const resetActivity = () => {
            lastActivityRef.current = Date.now();
        };
        const events = ["touchstart", "mousedown", "keydown", "scroll"];
        events.forEach(e => window.addEventListener(e, resetActivity, true));
        return () => {
            events.forEach(e => window.removeEventListener(e, resetActivity, true));
        };
    }, []);

    // バージョンチェック＆リロード判定
    const checkAndReload = useCallback(async () => {
        try {
            const res = await fetch("/api/version", { cache: "no-store" });
            if (!res.ok) return;
            const data = await res.json();
            const serverCommit = data.commitHash;

            if (!serverCommit || serverCommit === "unknown") return;

            // 初回は現在のバージョンを記録するだけ
            if (knownCommitRef.current === null) {
                knownCommitRef.current = serverCommit;
                return;
            }

            // 新しいビルドを検出
            if (serverCommit !== knownCommitRef.current) {
                newBuildDetectedRef.current = true;
                console.log(
                    `[AutoReload] 新ビルド検出: ${knownCommitRef.current} → ${serverCommit}`
                );
            }

            // リロード条件チェック
            if (newBuildDetectedRef.current && isIdle) {
                const idleMs = Date.now() - lastActivityRef.current;
                if (idleMs >= idleTimeoutMs) {
                    console.log(
                        `[AutoReload] リロード実行（無操作${Math.round(idleMs / 1000)}秒、ホーム画面待機中）`
                    );
                    window.location.reload();
                }
            }
        } catch {
            // ネットワークエラーは無視（オフライン時など）
        }
    }, [isIdle, idleTimeoutMs]);

    // 定期チェック
    useEffect(() => {
        // 初回チェック
        checkAndReload();

        const interval = setInterval(checkAndReload, checkIntervalMs);
        return () => clearInterval(interval);
    }, [checkAndReload, checkIntervalMs]);
}
