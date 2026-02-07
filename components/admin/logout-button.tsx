
"use client";

import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function LogoutButton() {
    return (
        <Button
            variant="ghost"
            className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800"
            onClick={() => signOut({ callbackUrl: "/login" })}
        >
            <LogOut className="w-5 h-5 mr-3" />
            ログアウト
        </Button>
    );
}
