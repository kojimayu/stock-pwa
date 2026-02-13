"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { logLogout } from "@/lib/actions";

export function LogoutButton() {
    const router = useRouter();
    const clearCart = useCartStore((state) => state.clearCart);
    const vendor = useCartStore((state) => state.vendor);
    const vendorUser = useCartStore((state) => state.vendorUser);

    const handleLogout = async () => {
        if (confirm("ログアウトしますか？")) {
            if (vendor) {
                // Fire and forget logging
                logLogout(vendor.id, vendor.name, 'MANUAL', vendorUser?.name, vendorUser?.id).catch(console.error);
            }
            clearCart();
            router.push("/");
        }
    };

    return (
        <div className="flex items-center gap-4">
            <span className="text-sm text-slate-300 hidden md:inline">
                {vendor ? `${vendor.name} ${vendorUser?.name ? vendorUser.name + ' ' : ''}様` : "未ログイン"}
            </span>
            <Button
                variant="ghost"
                className="text-white hover:text-slate-200 hover:bg-slate-800"
                onClick={handleLogout}
            >
                <LogOut className="w-5 h-5 mr-2" />
                ログアウト
            </Button>
        </div>
    );
}
