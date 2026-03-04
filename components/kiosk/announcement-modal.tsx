"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Megaphone, CheckCircle } from "lucide-react";

interface AnnouncementModalProps {
    onDismiss: () => void;
}

export function AnnouncementModal({ onDismiss }: AnnouncementModalProps) {
    const [announcement, setAnnouncement] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/config/announcement")
            .then((res) => res.json())
            .then((data) => {
                setAnnouncement(data.value || "");
            })
            .catch(() => setAnnouncement(""))
            .finally(() => setLoading(false));
    }, []);

    // ロード中 or お知らせ文が空 → 表示しない
    if (loading) return null;
    if (!announcement) {
        // お知らせなしなら即座にdismiss
        onDismiss();
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-300">
                {/* ヘッダー */}
                <div className="p-6 text-center border-b">
                    <div className="bg-blue-100 p-4 rounded-full inline-block mb-3">
                        <Megaphone className="w-10 h-10 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">📋 お知らせ</h2>
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
