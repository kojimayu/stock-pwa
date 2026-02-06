"use client";

import { useOnlineStatus } from "@/hooks/use-online-status";
import { WifiOff, AlertTriangle } from "lucide-react";

export function OfflineAlert() {
    const isOnline = useOnlineStatus();

    if (isOnline) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-red-600 text-white p-4 z-50 shadow-lg animate-in slide-in-from-bottom duration-300">
            <div className="container mx-auto flex items-center justify-center gap-3">
                <WifiOff className="w-6 h-6 animate-pulse" />
                <div className="flex flex-col md:flex-row items-center gap-1 md:gap-4 text-center">
                    <span className="font-bold text-lg">インターネット接続が切断されました</span>
                    <span className="flex items-center text-sm md:text-base bg-red-700 px-3 py-1 rounded-full">
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        データを保持するため、ページを再読み込み・移動しないでください
                    </span>
                </div>
            </div>
        </div>
    );
}
