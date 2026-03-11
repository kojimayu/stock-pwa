"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { loadPickingItems, clearPickingItems, PickingItem } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { CheckCircle, Package, Volume2 } from "lucide-react";

// Fully Kiosk Browser API型
declare global {
    interface Window {
        fully?: {
            textToSpeech: (text: string, locale: string) => void;
        };
    }
}

export default function PickingPage() {
    const router = useRouter();
    const [items, setItems] = useState<PickingItem[]>([]);
    const [loaded, setLoaded] = useState(false);
    const lastActivityRef = useRef<number>(Date.now());
    const reminderTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const hasSpokenRef = useRef(false);

    // ピッキングアイテムの読み込み
    useEffect(() => {
        const pickingItems = loadPickingItems();
        if (!pickingItems || pickingItems.length === 0) {
            // データがなければ完了画面へ
            router.replace("/shop/complete");
            return;
        }
        setItems(pickingItems);
        setLoaded(true);
    }, [router]);

    // 進捗計算
    const pickedCount = items.filter(i => i.picked).length;
    const totalCount = items.length;
    const allPicked = totalCount > 0 && pickedCount === totalCount;
    const progressPercent = totalCount > 0 ? (pickedCount / totalCount) * 100 : 0;

    // アイテムのチェック切り替え
    const togglePicked = useCallback((productId: number) => {
        setItems(prev => prev.map(item =>
            item.productId === productId
                ? { ...item, picked: !item.picked }
                : item
        ));
        lastActivityRef.current = Date.now();
        hasSpokenRef.current = false; // リマインドリセット
    }, []);

    // 確認完了 → 完了画面へ
    const handleComplete = useCallback(() => {
        clearPickingItems();
        router.push("/shop/complete");
    }, [router]);

    // --- 音声リマインド（30秒無操作） ---
    const speakReminder = useCallback(() => {
        const unpicked = items.filter(i => !i.picked);
        if (unpicked.length === 0) return;

        const names = unpicked.map(i => i.name).slice(0, 3).join("、");
        const suffix = unpicked.length > 3 ? `、他${unpicked.length - 3}点` : "";
        const text = `まだ取っていない商品があります。${names}${suffix}。`;

        // Fully Kiosk TTS 優先
        if (window.fully && typeof window.fully.textToSpeech === "function") {
            try {
                window.fully.textToSpeech(text, "ja_JP");
                return;
            } catch { /* フォールバック */ }
        }

        // Web Speech API
        if ("speechSynthesis" in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = "ja-JP";
            utterance.rate = 0.9;
            const voices = speechSynthesis.getVoices();
            const jaVoice = voices.find(v => v.lang.startsWith("ja"));
            if (jaVoice) utterance.voice = jaVoice;
            speechSynthesis.speak(utterance);
        }
    }, [items]);

    // 30秒無操作チェック
    useEffect(() => {
        if (!loaded || allPicked) return;

        const checkIdle = () => {
            const elapsed = Date.now() - lastActivityRef.current;
            if (elapsed >= 30000 && !hasSpokenRef.current) {
                hasSpokenRef.current = true;
                speakReminder();
            }
        };

        reminderTimerRef.current = setInterval(checkIdle, 5000);

        // タッチ/クリックでタイマーリセット
        const resetActivity = () => {
            lastActivityRef.current = Date.now();
        };
        const events = ["touchstart", "mousedown", "scroll"];
        events.forEach(e => window.addEventListener(e, resetActivity, true));

        return () => {
            if (reminderTimerRef.current) clearInterval(reminderTimerRef.current);
            events.forEach(e => window.removeEventListener(e, resetActivity, true));
        };
    }, [loaded, allPicked, speakReminder]);

    if (!loaded) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-slate-500">読み込み中...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-blue-50 flex flex-col">
            {/* ヘッダー */}
            <header className="bg-white border-b border-blue-200 p-4 shadow-sm sticky top-0 z-10">
                <div className="max-w-2xl mx-auto">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Package className="w-6 h-6 text-blue-600" />
                            <h1 className="text-xl font-bold text-slate-900">
                                ピッキングリスト
                            </h1>
                        </div>
                        <div className="text-sm text-slate-500">
                            棚から商品を取ってください
                        </div>
                    </div>

                    {/* プログレスバー */}
                    <div className="mt-3">
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-blue-700 font-medium">
                                {pickedCount} / {totalCount} 完了
                            </span>
                            <span className="text-slate-400">
                                {Math.round(progressPercent)}%
                            </span>
                        </div>
                        <div className="w-full bg-blue-100 rounded-full h-2.5">
                            <div
                                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>
                </div>
            </header>

            {/* ピッキングリスト */}
            <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
                <div className="space-y-3">
                    {items.map((item) => (
                        <button
                            key={item.productId}
                            onClick={() => togglePicked(item.productId)}
                            className={`w-full text-left rounded-2xl p-4 shadow-sm border-2 transition-all duration-200 ${item.picked
                                    ? "bg-green-50 border-green-400 scale-[0.98]"
                                    : "bg-white border-slate-200 hover:border-blue-300 active:scale-[0.97]"
                                }`}
                        >
                            <div className="flex items-center gap-4">
                                {/* チェックアイコン */}
                                <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all ${item.picked
                                        ? "bg-green-500 text-white"
                                        : "bg-slate-100 text-slate-400"
                                    }`}>
                                    <CheckCircle className={`w-7 h-7 ${item.picked ? "" : "opacity-30"}`} />
                                </div>

                                {/* 商品情報 */}
                                <div className="flex-1 min-w-0">
                                    <p className={`font-bold text-lg leading-tight ${item.picked ? "text-green-700 line-through" : "text-slate-900"
                                        }`}>
                                        {item.name}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                        {item.code && (
                                            <span className="text-xs text-slate-400">{item.code}</span>
                                        )}
                                        {item.category && (
                                            <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
                                                {item.category}
                                                {item.subCategory && ` / ${item.subCategory}`}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* 数量 */}
                                <div className={`text-right flex-shrink-0 ${item.picked ? "text-green-600" : "text-slate-900"
                                    }`}>
                                    <span className="text-2xl font-bold">
                                        {item.quantity}
                                    </span>
                                    <span className="text-sm ml-1">
                                        {item.unit || "個"}
                                    </span>
                                </div>
                            </div>

                            {/* ステータスバー */}
                            {item.picked && (
                                <div className="mt-2 text-center text-sm text-green-600 font-medium">
                                    ✅ 取得済み
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </main>

            {/* フッター：確認完了ボタン */}
            <footer className="bg-white border-t border-blue-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] sticky bottom-0">
                <div className="max-w-2xl mx-auto">
                    <Button
                        size="lg"
                        className={`w-full h-16 text-xl font-bold shadow-lg transition-all ${allPicked
                                ? "bg-green-600 hover:bg-green-700 text-white"
                                : "bg-slate-300 text-slate-500 cursor-not-allowed"
                            }`}
                        onClick={handleComplete}
                        disabled={!allPicked}
                    >
                        <CheckCircle className="w-6 h-6 mr-2" />
                        {allPicked
                            ? "全品取得完了 — 確認する"
                            : `あと ${totalCount - pickedCount} 品を取ってください`}
                    </Button>
                </div>
            </footer>
        </div>
    );
}
