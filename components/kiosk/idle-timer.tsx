"use client";

import { useEffect, useRef } from "react";
import { useCartStore } from "@/lib/store";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export function IdleTimer() {
    const vendor = useCartStore((state) => state.vendor);
    const clearSession = useCartStore((state) => state.clearSession);
    const router = useRouter();
    const pathname = usePathname();
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const logout = () => {
        // Check if still logged in to avoid double-toast or weird loops
        // We use a ref mechanism inside useEffect to capture latest state if needed,
        // but here we just blindly clear if the timer fires.
        clearSession();
        toast.info("一定時間操作がなかったためログアウトしました");
        router.push("/");
    };

    const resetTimer = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (vendor) {
            timerRef.current = setTimeout(logout, IDLE_TIMEOUT_MS);
        }
    };

    useEffect(() => {
        // Only activate if logged in and NOT on the login page (though vendor check handles login page mostly)
        if (!vendor) {
            if (timerRef.current) clearTimeout(timerRef.current);
            return;
        }

        // Initial timer start
        resetTimer();

        // Event listeners
        const handleActivity = () => resetTimer();

        // We listen to window events to catch clicks, touches, keys anywhere
        const events = ["mousedown", "mousemove", "touchstart", "keydown", "scroll", "click"];

        // Use capture=true to ensure we catch events before propagation stops (though mostly irrelevant for window)
        events.forEach(event => window.addEventListener(event, handleActivity, true));

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            events.forEach(event => window.removeEventListener(event, handleActivity, true));
        };
    }, [vendor, pathname]);

    return null;
}
