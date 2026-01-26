"use client";

import { CartList } from "@/components/kiosk/cart-list";
import { CheckoutButton } from "@/components/kiosk/checkout-button";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/store";

export default function CheckoutPage() {
    const router = useRouter();
    const vendor = useCartStore((state) => state.vendor);
    const items = useCartStore((state) => state.items);

    const totalQuantity = items.reduce((acc, item) => acc + item.quantity, 0);

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
                        <span className="text-slate-500">合計点数</span>
                        <span className="font-bold text-lg">{totalQuantity} 点</span>
                    </div>
                </div>

                <CartList />
            </main>

            <footer className="bg-white border-t border-slate-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                <div className="max-w-2xl mx-auto">
                    <CheckoutButton />
                </div>
            </footer>
        </div>
    );
}
