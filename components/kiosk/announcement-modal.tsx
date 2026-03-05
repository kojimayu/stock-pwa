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
                // キーからの日付部分を取得
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
    const [autoPlayFailed, setAutoPlayFailed] = useState(false);
    const [hasPlayed, setHasPlayed] = useState(false);
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

    // 音声を再生する共通関数（自動再生・ボタン再生の両方で使用）
    const speakAnnouncement = (text: string) => {
        // Fully Kiosk Browser の API を試す
        const fullyApi = (window as any).fully;
        if (fullyApi && typeof fullyApi.textToSpeech === "function") {
            try {
                fullyApi.textToSpeech(text, "ja_JP");
                setIsSpeaking(true);
                setHasPlayed(true);
                setAutoPlayFailed(false);
                const estimatedMs = Math.max(text.length * 150, 3000);
                setTimeout(() => {
                    setIsSpeaking(false);
                    markPlayedToday(vendorUserId);
                }, estimatedMs);
                return true;
            } catch (e) {
                console.error("Fully Kiosk TTS error:", e);
            }
        }

        // Web Speech API
        if ("speechSynthesis" in window) {
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
            if (preferredVoice) utterance.voice = preferredVoice;

            utterance.onstart = () => {
                setIsSpeaking(true);
                setHasPlayed(true);
                setAutoPlayFailed(false);
            };
            utterance.onend = () => {
                setIsSpeaking(false);
                markPlayedToday(vendorUserId);
            };
            utterance.onerror = (e) => {
                console.error("SpeechSynthesis error:", e);
                setIsSpeaking(false);
                // 自動再生が拒否された場合、ボタンを表示
                setAutoPlayFailed(true);
            };

            utteranceRef.current = utterance;
            speechSynthesis.speak(utterance);
            return true;
        }

        return false;
    };

    // 自動再生を試みる
    useEffect(() => {
        if (loading || !announcement) return;
        if (hasPlayedToday(vendorUserId)) {
            setHasPlayed(true);
            return;
        }

        const timer = setTimeout(() => {
            if ("speechSynthesis" in window) {
                const voices = speechSynthesis.getVoices();
                if (voices.length > 0) {
                    speakAnnouncement(announcement);
                } else {
                    speechSynthesis.addEventListener("voiceschanged", () => {
                        speakAnnouncement(announcement);
                    }, { once: true });
                    // voiceschangedが来なかった場合のフォールバック
                    setTimeout(() => {
                        if (!isSpeaking && !hasPlayed) {
                            setAutoPlayFailed(true);
                        }
                    }, 2000);
                }
            } else {
                // Web Speech API非対応 → ボタン表示
                setAutoPlayFailed(true);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [loading, announcement, vendorUserId]);

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
                    {/* 自動再生失敗時の手動ボタン */}
                    {autoPlayFailed && !isSpeaking && (
                        <button
                            className="mt-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full text-sm font-medium flex items-center gap-2 mx-auto transition-colors"
                            onClick={() => speakAnnouncement(announcement)}
                        >
                            <Volume2 className="w-4 h-4" />
                            🔊 読み上げる
                        </button>
                    )}
                </div>

                {/* 本文 */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="text-lg leading-relaxed whitespace-pre-wrap text-slate-700">
                        {announcement}
                    </div>
                </div>

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
