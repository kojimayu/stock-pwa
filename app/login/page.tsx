
"use client";

import { Button } from "@/components/ui/button";
import { signIn } from "next-auth/react";
import { Chrome } from "lucide-react"; // Using Chrome as a placeholder for a generic browser/logo if needed, but simple text is better
import Image from "next/image";

export default function LoginPage() {
    return (
        <div className="min-h-screen grid place-items-center bg-slate-50">
            <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg border border-slate-100 text-center">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">STOCK MGR</h1>
                    <p className="text-sm text-slate-500 mt-2">在庫管理システム 管理者ログイン</p>
                </div>

                <div className="space-y-4">
                    <Button
                        size="lg"
                        className="w-full bg-[#2F2F2F] hover:bg-[#1a1a1a] text-white flex items-center justify-center gap-3 py-6"
                        onClick={() => signIn("azure-ad", { callbackUrl: "/admin" })}
                    >
                        <svg className="w-5 h-5" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg"><path fill="#f35325" d="M1 1h10v10H1z" /><path fill="#81bc06" d="M12 1h10v10H12z" /><path fill="#05a6f0" d="M1 12h10v10H1z" /><path fill="#ffba08" d="M12 12h10v10H12z" /></svg>
                        Microsoftアカウントでログイン
                    </Button>

                    <p className="text-xs text-slate-400 mt-6">
                        ※ 社内のMicrosoft 365アカウントを使用します
                    </p>
                </div>
            </div>

            <div className="absolute bottom-4 text-center w-full">
                <a href="/" className="text-sm text-slate-500 hover:text-slate-800 hover:underline">
                    ← Kiosk画面（現場用）へ戻る
                </a>
            </div>
        </div>
    );
}
