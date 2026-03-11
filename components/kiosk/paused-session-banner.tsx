"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCartStore, getStoredPausedSessions, discardPausedSession, PausedSession } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Pause, Play, Trash2, ShoppingCart } from "lucide-react";

export function PausedSessionBanner() {
    const [sessions, setSessions] = useState<PausedSession[]>([]);
    const resumeSession = useCartStore((state) => state.resumeSession);
    const router = useRouter();

    useEffect(() => {
        setSessions(getStoredPausedSessions());
    }, []);

    if (sessions.length === 0) return null;

    const handleResume = (vendorId: number) => {
        const success = resumeSession(vendorId);
        if (success) {
            setSessions(getStoredPausedSessions());
            router.push("/shop");
        }
    };

    const handleDiscard = (vendorId: number) => {
        discardPausedSession(vendorId);
        setSessions(getStoredPausedSessions());
    };

    return (
        <div className="space-y-2">
            {sessions.map((session) => {
                const itemCount = session.items.reduce((sum, i) => sum + i.quantity, 0);
                const pausedTime = new Date(session.pausedAt);
                const timeStr = pausedTime.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });

                return (
                    <div
                        key={session.vendor.id}
                        className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 animate-in slide-in-from-top-2 duration-300"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="bg-amber-200 p-2 rounded-full">
                                <Pause className="w-5 h-5 text-amber-700" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-amber-900 text-lg">
                                    一時保存カートあり
                                </p>
                                <p className="text-amber-700 text-sm">
                                    <span className="font-medium">{session.vendor.name}</span>
                                    {session.vendorUser && ` (${session.vendorUser.name})`}
                                    {" · "}
                                    <ShoppingCart className="w-3.5 h-3.5 inline" />
                                    {" "}{session.items.length}種類 / {itemCount}点
                                    {" · "}{timeStr}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                className="flex-1 h-12 bg-amber-600 hover:bg-amber-700 text-white font-bold text-base"
                                onClick={() => handleResume(session.vendor.id)}
                            >
                                <Play className="w-5 h-5 mr-1" />
                                再開する
                            </Button>
                            <Button
                                variant="outline"
                                className="h-12 px-4 border-amber-400 text-amber-700 hover:bg-amber-100"
                                onClick={() => handleDiscard(session.vendor.id)}
                            >
                                <Trash2 className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
