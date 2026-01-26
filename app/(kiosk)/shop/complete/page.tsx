"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/store";

export default function CompletePage() {
    const router = useRouter();
    const clearSession = useCartStore((state) => state.clearSession);
    const [countdown, setCountdown] = useState(5);

    // Clear vendor session on mount (log out user)
    useEffect(() => {
        const timer = setTimeout(() => {
            clearSession();
        }, 500); // Small delay to ensure smooth transition
        return () => clearTimeout(timer);
    }, [clearSession]);

    // Auto redirect to home
    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    router.push("/");
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [router]);

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
                </div>

                <div className="text-sm text-slate-400">
                    {countdown}秒後にログイン画面に戻ります
                </div>

                <Button
                    className="w-full text-lg h-12"
                    variant="outline"
                    onClick={() => router.push("/")}
                >
                    すぐに戻る
                </Button>
            </div>
        </div>
    );
}
