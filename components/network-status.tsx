"use client";

import { useState, useEffect } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

export function NetworkStatus() {
    const [isOnline, setIsOnline] = useState(true);
    const [showBanner, setShowBanner] = useState(false);

    useEffect(() => {
        setIsOnline(navigator.onLine);

        const handleOnline = () => {
            setIsOnline(true);
            setShowBanner(true);
            setTimeout(() => setShowBanner(false), 3000);
        };

        const handleOffline = () => {
            setIsOnline(false);
            setShowBanner(true);
        };

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    if (!showBanner && isOnline) return null;

    return (
        <div
            className={cn(
                "fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white transition-all duration-500",
                isOnline ? "bg-green-600 translate-y-0" : "bg-red-600 translate-y-0"
            )}
        >
            {isOnline ? (
                <>
                    <Wifi className="h-4 w-4" />
                    <span>オンラインに復帰しました</span>
                </>
            ) : (
                <>
                    <WifiOff className="h-4 w-4" />
                    <span>オフラインモード（画面の更新を控えてください）</span>
                </>
            )}
        </div>
    );
}
