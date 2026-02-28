
"use client";

import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { logOperation } from "@/lib/actions";

export function LogoutButton() {
    const handleLogout = async () => {
        // ログアウトログ記録（セッションID付き）
        const sid = localStorage.getItem('adminSessionId');
        const detail = sid
            ? `管理者ログアウト [Session: ${sid}]`
            : "管理者ログアウト";
        await logOperation("ADMIN_LOGOUT", "Admin", detail).catch(console.error);
        localStorage.removeItem('adminSessionId');
        signOut({ callbackUrl: "/login" });
    };

    return (
        <Button
            variant="ghost"
            className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800"
            onClick={handleLogout}
        >
            <LogOut className="w-5 h-5 mr-3" />
            ログアウト
        </Button>
    );
}
