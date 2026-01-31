"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
    const router = useRouter();
    const clearCart = useCartStore((state) => state.clearCart);
    const vendor = useCartStore((state) => state.vendor);

    const handleLogout = () => {
        if (confirm("ログアウトしますか？")) {
            clearCart();
            router.push("/");
        }
    };

    return (
        <div className="flex items-center gap-4">
            <span className="text-sm text-slate-300 hidden md:inline">
                {vendor ? `${vendor.name} 様` : "未ログイン"}
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
