"use client";

import { useState, useEffect } from "react";
import { CartList } from "@/components/kiosk/cart-list";
import { CheckoutButton } from "@/components/kiosk/checkout-button";
import { StockCheckPanel } from "@/components/kiosk/stock-check-panel";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/store";

export default function CheckoutPage() {
    const router = useRouter();
    const vendor = useCartStore((state) => state.vendor);
    const items = useCartStore((state) => state.items);
    const [hydrated, setHydrated] = useState(false);
    const [stockCheckReady, setStockCheckReady] = useState(true); // デフォルトtrue（チェック不要商品のみの場合）

    // Zustand persist のハイドレーション完了を待つ
    useEffect(() => {
        const unsub = useCartStore.persist.onFinishHydration(() => {
            setHydrated(true);
        });
        if (useCartStore.persist.hasHydrated()) {
            setHydrated(true);
        }
        return unsub;
    }, []);

    const totalQuantity = items.reduce((acc, item) => acc + item.quantity, 0);

    if (!hydrated) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span>読み込み中...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <header className="bg-white border-b border-slate-200 p-4 flex items-center shadow-sm sticky top-0 z-10">
                <Button variant="ghost" className="mr-4" onClick={() => router.back()}>
                    <ChevronLeft className="w-6 h-6 mr-1" />
                    戻る
                </Button>
                <h1 className="text-xl font-bold text-slate-900">出庫内容の確認</h1>
            </header>

            <main className="flex-1 p-4 max-w-2xl mx-auto w-full space-y-6">
                <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-slate-500">担当者</span>
                        <span className="font-bold text-lg">{vendor?.name || "未設定"}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-100 pt-2">
                        <span className="text-slate-500">商品種類</span>
                        <span className="font-bold text-lg">{items.length} 種類</span>
                    </div>
                </div>

                <CartList />

                {/* 在庫残数チェックパネル（requireStockCheck商品がある場合のみ表示） */}
                <StockCheckPanel onReadyChange={setStockCheckReady} />
            </main>

            <footer className="bg-white border-t border-slate-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                <div className="max-w-2xl mx-auto">
                    <CheckoutButton stockCheckReady={stockCheckReady} />
                </div>
            </footer>
        </div>
    );
}
