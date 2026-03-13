"use client";

import { useState } from "react";
import { useCartStore, savePickingItems, PickingItem } from "@/lib/store";
import { createTransaction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle, WifiOff } from "lucide-react";

import { useOnlineStatus } from "@/hooks/use-online-status";

interface StockItem {
    productId: number;
    name: string;
    code?: string;
    expectedStock: number;
    unit?: string;
}

export function CheckoutButton({ stockCheckReady = true }: { stockCheckReady?: boolean }) {
    const [loading, setLoading] = useState(false);
    const { items, vendor, vendorUser, isProxyMode, transactionDate, clearCart } = useCartStore();
    const router = useRouter();
    const isOnline = useOnlineStatus();

    // ピッキングリストへ遷移する共通処理
    const navigateToPicking = (pickingItems: PickingItem[]) => {
        savePickingItems(pickingItems);
        router.push("/shop/picking");
    };

    const handleCheckout = async () => {
        if (!isOnline) {
            toast.error("インターネットに接続されていません。接続を確認してください。");
            return;
        }

        if (!vendor) {
            toast.error("ログインセッションが切れました。再度ログインしてください。");
            router.push("/");
            return;
        }
        if (items.length === 0) {
            toast.error("カートが空です");
            return;
        }

        setLoading(true);
        try {
            // 出庫確定前にピッキング用データを準備
            const pickingItems: PickingItem[] = items.map(item => ({
                productId: item.productId,
                code: item.code,
                name: item.name,
                quantity: (item.isBox && item.quantityPerBox) ? item.quantity * item.quantityPerBox : item.quantity,
                unit: item.unit,
                category: item.category,
                subCategory: item.subCategory,
                picked: false,
            }));

            // 代理入力モードの場合、isProxyInput=trueと引取日を渡す
            const res = await createTransaction(
                vendor.id,
                vendorUser?.id ?? null,  // 担当者ID
                items,
                undefined,
                isProxyMode,
                transactionDate ?? undefined  // 引取日（代理入力時のみ使用）
            );

            if (res.success) {
                clearCart();
                if (isProxyMode) {
                    // 代理入力の場合はトースト表示して同じ画面に留まる（ピッキング不要）
                    toast.success("出庫処理が完了しました");
                } else {
                    // stockInfoがあればpickingItemsにexpectedStockをマージ
                    if (res.stockInfo && res.stockInfo.length > 0) {
                        const stockMap = new Map(res.stockInfo.map((s: any) => [s.productId, s.expectedStock]));
                        for (const item of pickingItems) {
                            if (stockMap.has(item.productId)) {
                                item.expectedStock = stockMap.get(item.productId);
                            }
                        }
                    }
                    navigateToPicking(pickingItems);
                }
            } else {
                toast.error(res.message || "出庫処理に失敗しました");
            }
        } catch (e) {
            toast.error("予期せぬエラーが発生しました");
        } finally {
            setLoading(false);
        }
    };


    return (
        <>
            <Button
                size="lg"
                className={`w-full h-16 text-xl font-bold shadow-lg ${!isOnline ? 'bg-slate-400 cursor-not-allowed' : !stockCheckReady ? 'bg-amber-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                onClick={handleCheckout}
                disabled={loading || items.length === 0 || !isOnline || !stockCheckReady}
            >
                {loading ? (
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                ) : (
                    !isOnline ? <WifiOff className="mr-2 h-6 w-6" /> : <CheckCircle className="mr-2 h-6 w-6" />
                )}
                {!isOnline ? "オフライン (送信不可)" : !stockCheckReady ? "残数を確認してください" : "出庫を確定する"}
            </Button>
        </>
    );
}
