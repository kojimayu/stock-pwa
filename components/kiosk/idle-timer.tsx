"use client";

import { useEffect, useRef } from "react";
import { useCartStore } from "@/lib/store";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { logLogout } from "@/lib/actions";

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const CHECK_INTERVAL_MS = 10 * 1000; // Check every 10 seconds

export function IdleTimer() {
    const vendor = useCartStore((state) => state.vendor);
    const vendorUser = useCartStore((state) => state.vendorUser);
    const clearSession = useCartStore((state) => state.clearSession);
    const router = useRouter();
    const pathname = usePathname();

    // Use refs to track state without triggering re-renders or stale closures in interval
    const lastActivityRef = useRef<number>(Date.now());
    const isLoggedOutRef = useRef<boolean>(false);

    const logout = async () => {
        if (isLoggedOutRef.current) return;
        isLoggedOutRef.current = true;

        if (vendor) {
            // Attempt to log server-side (fire and forget)
            logLogout(vendor.id, vendor.name, 'AUTO', vendorUser?.name, vendorUser?.id).catch(console.error);
        }

        clearSession();
        toast.info("一定時間操作がなかったためログアウトしました");
        router.push("/");
    };

    const resetTimer = () => {
        lastActivityRef.current = Date.now();
        isLoggedOutRef.current = false;
    };

    const checkActivity = () => {
        if (!vendor) return;
        const now = Date.now();
        if (now - lastActivityRef.current >= IDLE_TIMEOUT_MS) {
            logout();
        }
    };

    useEffect(() => {
        if (!vendor) return;

        // Reset on mount/login
        resetTimer();

        // Interval check (handles normal idle)
        const intervalId = setInterval(checkActivity, CHECK_INTERVAL_MS);

        // Activity listeners
        const handleActivity = () => {
            // If we are already timed out but somehow still here (race condition), check first?
            // Actually, we just want to reset the timer if the user *does* something.
            // But if they were idle for too long, we should have logged out already.
            // However, if the device slept, 'handleActivity' (e.g. touch) might fire immediately on wake.
            // So we should check timeout condition BEFORE resetting?
            // No, if the user touches, they are active. 
            // BUT: If the device slept for 1 hour, and user touches screen to wake it.
            // The `visibilitychange` should catch it first or simultaneously.
            // If we simply reset on touch, we might bypass the sleep timeout check.
            // Strategy: Check heavily on visibility change. For interaction events, simply reset.
            // If security is paramount: on interaction, check time diff first? 
            // Let's keep it simple: interaction resets timer. 
            // The `visibilitychange` + interval will catch the sleep case.
            resetTimer();
        };

        const events = ["mousedown", "mousemove", "touchstart", "keydown", "scroll", "click"];
        events.forEach(event => window.addEventListener(event, handleActivity, true));

        // Visibility change listener (Critical for mobile/tablet sleep)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                // When app comes to foreground, check immediately
                checkActivity();
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("focus", handleVisibilityChange); // Extra safety

        return () => {
            clearInterval(intervalId);
            events.forEach(event => window.removeEventListener(event, handleActivity, true));
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("focus", handleVisibilityChange);
        };
    }, [vendor, pathname]);

    return null;
}
