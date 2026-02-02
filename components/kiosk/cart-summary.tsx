"use client";

import { useCartStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useRouter } from "next/navigation";

export function CartSummary() {
    const items = useCartStore((state) => state.items);
    const router = useRouter();

    if (items.length === 0) return null;

    const totalQuantity = items.reduce((acc, item) => acc + item.quantity, 0);

    return (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50">
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                <div className="flex flex-col">
                    <span className="text-xl font-bold text-slate-900">合計 {totalQuantity} 点</span>
                </div>
                <Button
                    size="lg"
                    className="flex-1 max-w-xs h-14 text-lg font-bold shadow-lg"
                    onClick={() => router.push("/shop/checkout")}
                >
                    <ShoppingCart className="w-5 h-5 mr-2" />
                    確認へ進む
                </Button>
            </div>
        </div>
    );
}
