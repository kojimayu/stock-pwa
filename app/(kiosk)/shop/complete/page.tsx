"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, LogOut, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/store";

export default function CompletePage() {
    const router = useRouter();
    const clearSession = useCartStore((state) => state.clearSession);
    const vendor = useCartStore((state) => state.vendor);
    const vendorUser = useCartStore((state) => state.vendorUser);

    const handleLogout = () => {
        clearSession();
        sessionStorage.removeItem('announcement-shown');
        router.push("/");
    };

    const handleContinue = () => {
        // ログアウトせずモード選択画面に戻る（エアコン持出し等の続行用）
        router.push("/mode-select");
    };

    return (
        <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center p-4 text-center">
            <div className="bg-white p-8 rounded-3xl shadow-xl space-y-6 max-w-md w-full animate-in zoom-in-95 duration-300">
                <div className="flex justify-center">
                    <div className="bg-green-100 p-4 rounded-full">
                        <CheckCircle className="w-16 h-16 text-green-600" />
                    </div>
                </div>

                <div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">出庫完了しました</h1>
                    <p className="text-slate-500">ご利用ありがとうございました。</p>
                    {vendor && (
                        <p className="text-sm text-blue-600 font-bold mt-2">
                            {vendor.name} 様{vendorUser ? ` / ${vendorUser.name} 様` : ''}
                        </p>
                    )}
                </div>

                <div className="space-y-3 pt-2">
                    {/* 続けて作業する（エアコン持出し等） */}
                    <Button
                        className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700"
                        onClick={handleContinue}
                    >
                        <ArrowRight className="w-5 h-5 mr-2" />
                        続けて作業する
                    </Button>

                    {/* ログアウト */}
                    <Button
                        className="w-full h-12 text-lg"
                        variant="outline"
                        onClick={handleLogout}
                    >
                        <LogOut className="w-5 h-5 mr-2" />
                        ログアウト
                    </Button>
                </div>
            </div>
        </div>
    );
}
