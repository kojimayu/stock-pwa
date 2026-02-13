"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useCartStore } from "@/lib/store";
import { Loader2 } from "lucide-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const vendor = useCartStore((state) => state.vendor);
    const [isChecking, setIsChecking] = useState(true);

    // Hydration check helper
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        setIsHydrated(true);
    }, []);

    useEffect(() => {
        if (!isHydrated) return;

        // Allow access to login page root
        // If map is different, adjust here. Current root '/' is login.
        if (pathname === "/") {
            setIsChecking(false);
            return;
        }

        // Check if vendor exists
        // Use getState() to check latest state without waiting for React render cycle
        const currentVendor = useCartStore.getState().vendor;

        if (!currentVendor) {
            // Double check after a small delay to handle hydration/race conditions
            const timer = setTimeout(() => {
                const latestVendor = useCartStore.getState().vendor;
                if (!latestVendor) {
                    console.log("AuthGuard: No session found, redirecting to login.");
                    router.replace("/");
                } else {
                    setIsChecking(false);
                }
            }, 100); // 100ms delay
            return () => clearTimeout(timer);
        } else {
            setIsChecking(false);
        }
    }, [vendor, pathname, router, isHydrated]);

    // Show nothing or loader while checking/hydrating
    // To avoid flash of protected content
    if (!isHydrated || isChecking) {
        // Only show loader if we are not on the login page
        if (pathname !== "/") {
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                </div>
            );
        }
        // If on login page, just render null until check completes (instant usually)
        return null;
    }

    return <>{children}</>;
}
