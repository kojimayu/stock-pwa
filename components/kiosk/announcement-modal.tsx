"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Megaphone, CheckCircle, Volume2 } from "lucide-react";
import { getJSTDateString } from "@/lib/date-utils";

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
    const today = getJSTDateString();
    const key = `announcement_voice_${vendorUserId}_${today}`;
    return localStorage.getItem(key) === "done";
}

function markPlayedToday(vendorUserId: number | null | undefined): void {
    if (!vendorUserId) return;
    const today = getJSTDateString();
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
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const scrollAnimationRef = useRef<number | null>(null);

    useEffect(() => {
        fetch("/api/config/announcement")
            .then((res) => res.json())
            .then((data) => {
                setAnnouncement(data.value || "");
            })
            .catch(() => setAnnouncement(""))
            .finally(() => setLoading(false));
    }, []);

    // 読み上げ中の自動スクロール制御
    useEffect(() => {
        if (!isSpeaking || !contentRef.current) {
            if (scrollAnimationRef.current) {
                cancelAnimationFrame(scrollAnimationRef.current);
            }
            return;
        }

        const el = contentRef.current;
        const maxScroll = el.scrollHeight - el.clientHeight;

        if (maxScroll <= 0) return;

        // 文字数から大まかな読み上げ時間（ミリ秒）を推測
        const duration = Math.max((announcement?.length || 0) * 150, 3000);
        // 読み上げ開始から1秒待ってスクロール開始
        const startDelay = 1000;
        const startTime = performance.now() + startDelay;

        const animateScroll = (time: number) => {
            if (time > startTime) {
                const elapsed = time - startTime;
                const progress = Math.min(elapsed / Math.max(duration - startDelay, 1000), 1);
                el.scrollTop = progress * maxScroll;
            }
            if (isSpeaking) {
                scrollAnimationRef.current = requestAnimationFrame(animateScroll);
            }
        };

        scrollAnimationRef.current = requestAnimationFrame(animateScroll);

        return () => {
            if (scrollAnimationRef.current) {
                cancelAnimationFrame(scrollAnimationRef.current);
            }
        };
    }, [isSpeaking, announcement]);

    // 音声読み上げ開始（お知らせ取得完了後）
    useEffect(() => {
        if (loading || !announcement) return;
        if (hasPlayedToday(vendorUserId)) return;

        // 方式1: Fully Kiosk Browser の TTS API
        const fullyApi = (window as any).fully;
        if (fullyApi && typeof fullyApi.textToSpeech === "function") {
            const timer = setTimeout(() => {
                try {
                    markPlayedToday(vendorUserId); // TTS開始前にマーク（早期dismiss対策）
                    fullyApi.textToSpeech(announcement, "ja_JP");
                    setIsSpeaking(true);
                    const estimatedMs = Math.max(announcement.length * 150, 3000);
                    setTimeout(() => {
                        setIsSpeaking(false);
                    }, estimatedMs);
                } catch (e) {
                    console.error("Fully Kiosk TTS error:", e);
                    setIsSpeaking(false);
                }
            }, 500);
            return () => clearTimeout(timer);
        }

        // 方式2: Web Speech API フォールバック
        if (!("speechSynthesis" in window)) return;

        const startSpeech = () => {
            const utterance = new SpeechSynthesisUtterance(announcement);
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
            }

            utterance.onstart = () => {
                setIsSpeaking(true);
                markPlayedToday(vendorUserId); // TTS開始時にマーク（早期dismiss対策）
            };
            utterance.onend = () => {
                setIsSpeaking(false);
            };
            utterance.onerror = () => {
                setIsSpeaking(false);
            };

            utteranceRef.current = utterance;
            speechSynthesis.speak(utterance);
        };

        const timer = setTimeout(() => {
            const voices = speechSynthesis.getVoices();
            if (voices.length > 0) {
                startSpeech();
            } else {
                speechSynthesis.addEventListener("voiceschanged", startSpeech, { once: true });
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
                {/* ヘッダー: コンパクト化して1行に */}
                <div className="px-5 py-4 flex items-center justify-between border-b bg-blue-50/50 rounded-t-3xl shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2.5 rounded-full">
                            <Megaphone className="w-6 h-6 text-blue-600" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900">お知らせ</h2>
                    </div>
                    {/* 音声再生中インジケーター */}
                    {isSpeaking && (
                        <div className="flex items-center gap-2 text-blue-600 bg-blue-100/50 px-3 py-1.5 rounded-full border border-blue-100">
                            <Volume2 className="w-4 h-4 animate-pulse" />
                            <span className="text-sm font-bold">音声案内中</span>
                        </div>
                    )}
                </div>

                {/* 本文エリア */}
                <div
                    ref={contentRef}
                    className="flex-1 overflow-y-auto p-6 scroll-smooth"
                >
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
