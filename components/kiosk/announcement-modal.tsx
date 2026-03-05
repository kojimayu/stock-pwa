"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Megaphone, CheckCircle, Volume2 } from "lucide-react";

interface AnnouncementModalProps {
    onDismiss: () => void;
    vendorUserId?: number | null;
}

/**
 * localStorage キー: announcement_voice_{vendorUserId}_{YYYY-MM-DD}
 * 1日1回/担当者 の読み上げ制御に使用
 */
function hasPlayedToday(vendorUserId: number | null | undefined): boolean {
    if (!vendorUserId) return false;
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const key = `announcement_voice_${vendorUserId}_${today}`;
    return localStorage.getItem(key) === "done";
}

function markPlayedToday(vendorUserId: number | null | undefined): void {
    if (!vendorUserId) return;
    const today = new Date().toISOString().slice(0, 10);
    const key = `announcement_voice_${vendorUserId}_${today}`;
    localStorage.setItem(key, "done");

    // 古いキーを掃除（3日前以前のものを削除）
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith("announcement_voice_") && k !== key) {
                const datePart = k.split("_").pop();
                if (datePart && datePart < today) {
                    localStorage.removeItem(k);
                }
            }
        }
    } catch {
        // 掃除に失敗しても問題なし
    }
}

export function AnnouncementModal({ onDismiss, vendorUserId }: AnnouncementModalProps) {
    const [announcement, setAnnouncement] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [debugInfo, setDebugInfo] = useState<string>(""); // 一時デバッグ用
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    useEffect(() => {
        fetch("/api/config/announcement")
            .then((res) => res.json())
            .then((data) => {
                setAnnouncement(data.value || "");
            })
            .catch(() => setAnnouncement(""))
            .finally(() => setLoading(false));
    }, []);

    // 音声読み上げ開始（お知らせ取得完了後）
    useEffect(() => {
        if (loading || !announcement) return;
        if (hasPlayedToday(vendorUserId)) {
            setDebugInfo("⏭ 本日再生済み（スキップ）");
            return;
        }

        const debug: string[] = [];

        // 1. Fully Kiosk Browser の API をチェック
        const fullyApi = (window as any).fully;
        const hasFullyObj = !!fullyApi;
        const hasFullyTts = hasFullyObj && typeof fullyApi.textToSpeech === "function";
        debug.push(`fully: ${hasFullyObj ? "✅あり" : "❌なし"}`);
        debug.push(`fully.tts: ${hasFullyTts ? "✅あり" : "❌なし"}`);

        // 2. Web Speech API をチェック
        const hasSpeechSynth = "speechSynthesis" in window;
        debug.push(`speechSynthesis: ${hasSpeechSynth ? "✅あり" : "❌なし"}`);

        // 方式1: Fully Kiosk TTS
        if (hasFullyTts) {
            const timer = setTimeout(() => {
                try {
                    fullyApi.textToSpeech(announcement, "ja_JP");
                    setIsSpeaking(true);
                    debug.push("🔊 fully.tts 呼び出し成功");
                    setDebugInfo(debug.join(" | "));
                    const estimatedMs = Math.max(announcement.length * 150, 3000);
                    setTimeout(() => {
                        setIsSpeaking(false);
                        markPlayedToday(vendorUserId);
                    }, estimatedMs);
                } catch (e: any) {
                    debug.push(`❌ fully.tts エラー: ${e?.message || e}`);
                    setDebugInfo(debug.join(" | "));
                    // フォールバック: Web Speech APIを試す
                    if (hasSpeechSynth) {
                        tryWebSpeech(announcement, debug);
                    }
                }
            }, 500);
            setDebugInfo(debug.join(" | "));
            return () => clearTimeout(timer);
        }

        // 方式2: Web Speech API
        if (hasSpeechSynth) {
            const timer = setTimeout(() => {
                const voices = speechSynthesis.getVoices();
                debug.push(`voices: ${voices.length}件`);
                if (voices.length > 0) {
                    tryWebSpeech(announcement, debug);
                } else {
                    debug.push("⏳ voiceschanged待ち...");
                    setDebugInfo(debug.join(" | "));
                    speechSynthesis.addEventListener("voiceschanged", () => {
                        const v = speechSynthesis.getVoices();
                        debug.push(`voices(再取得): ${v.length}件`);
                        tryWebSpeech(announcement, debug);
                    }, { once: true });
                    // 3秒待っても来なければ諦め
                    setTimeout(() => {
                        if (!isSpeaking) {
                            debug.push("⚠ voiceschanged タイムアウト");
                            setDebugInfo(debug.join(" | "));
                        }
                    }, 3000);
                }
            }, 500);
            setDebugInfo(debug.join(" | "));
            return () => clearTimeout(timer);
        }

        debug.push("❌ 音声API非対応");
        setDebugInfo(debug.join(" | "));
    }, [loading, announcement, vendorUserId]);

    const tryWebSpeech = (text: string, debug: string[]) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "ja-JP";
        utterance.rate = 0.9;
        utterance.pitch = 1.0;

        const voices = speechSynthesis.getVoices();
        const preferredVoice =
            voices.find((v) => v.name.includes("Google") && v.lang.startsWith("ja")) ||
            voices.find((v) => v.name.includes("Nanami")) ||
            voices.find((v) => v.lang === "ja-JP") ||
            voices.find((v) => v.lang.startsWith("ja"));
        if (preferredVoice) {
            utterance.voice = preferredVoice;
            debug.push(`voice: ${preferredVoice.name}`);
        }

        utterance.onstart = () => {
            setIsSpeaking(true);
            debug.push("🔊 再生開始");
            setDebugInfo(debug.join(" | "));
        };
        utterance.onend = () => {
            setIsSpeaking(false);
            markPlayedToday(vendorUserId);
            debug.push("✅ 再生完了");
            setDebugInfo(debug.join(" | "));
        };
        utterance.onerror = (e) => {
            setIsSpeaking(false);
            debug.push(`❌ エラー: ${e.error}`);
            setDebugInfo(debug.join(" | "));
        };

        utteranceRef.current = utterance;
        speechSynthesis.speak(utterance);
        debug.push("speak() 呼び出し済み");
        setDebugInfo(debug.join(" | "));
    };

    // ロード中 or お知らせ文が空 → 表示しない
    if (loading) return null;
    if (!announcement) {
        onDismiss();
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-300">
                {/* ヘッダー */}
                <div className="p-6 text-center border-b">
                    <div className="bg-blue-100 p-4 rounded-full inline-block mb-3">
                        <Megaphone className="w-10 h-10 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">📋 お知らせ</h2>
                    {/* 音声再生中インジケーター */}
                    {isSpeaking && (
                        <div className="flex items-center justify-center gap-2 mt-2 text-blue-600">
                            <Volume2 className="w-4 h-4 animate-pulse" />
                            <span className="text-sm font-medium">音声案内中...</span>
                        </div>
                    )}
                </div>

                {/* 本文 */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="text-lg leading-relaxed whitespace-pre-wrap text-slate-700">
                        {announcement}
                    </div>
                </div>

                {/* デバッグ情報（一時的 - 原因特定後に削除） */}
                {debugInfo && (
                    <div className="px-6 py-2 bg-slate-100 text-xs text-slate-500 font-mono border-t">
                        🐛 {debugInfo}
                    </div>
                )}

                {/* 確認ボタン */}
                <div className="p-6 border-t">
                    <Button
                        className="w-full h-16 text-xl font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg"
                        onClick={onDismiss}
                    >
                        <CheckCircle className="w-6 h-6 mr-2" />
                        確認しました
                    </Button>
                </div>
            </div>
        </div>
    );
}
