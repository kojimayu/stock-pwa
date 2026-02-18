"use client";

import { useState } from "react";
import { useCartStore } from "@/lib/store";
import { createTransaction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle, WifiOff } from "lucide-react";
import { StockVerificationDialog } from "@/components/kiosk/stock-verification-dialog";

import { useOnlineStatus } from "@/hooks/use-online-status";

interface StockItem {
    productId: number;
    name: string;
    code?: string;
    expectedStock: number;
    unit?: string;
}

export function CheckoutButton() {
    const [loading, setLoading] = useState(false);
    const { items, vendor, vendorUser, isProxyMode, transactionDate, clearCart } = useCartStore();
    const router = useRouter();
    const isOnline = useOnlineStatus();

    // 在庫確認ダイアログの状態
    const [stockInfo, setStockInfo] = useState<StockItem[] | null>(null);

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
                    // 代理入力の場合はトースト表示して同じ画面に留まる
                    toast.success("出庫処理が完了しました");
                } else if (res.stockInfo && res.stockInfo.length > 0) {
                    // Kiosk: 在庫確認ダイアログを表示
                    setStockInfo(res.stockInfo);
                } else {
                    // 在庫情報がない場合はそのまま完了画面へ
                    router.push("/shop/complete");
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

    // 在庫確認後に完了画面へ遷移
    const handleStockVerified = () => {
        setStockInfo(null);
        router.push("/shop/complete");
    };

    return (
        <>
            <Button
                size="lg"
                className={`w-full h-16 text-xl font-bold shadow-lg ${!isOnline ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                onClick={handleCheckout}
                disabled={loading || items.length === 0 || !isOnline}
            >
                {loading ? (
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                ) : (
                    !isOnline ? <WifiOff className="mr-2 h-6 w-6" /> : <CheckCircle className="mr-2 h-6 w-6" />
                )}
                {!isOnline ? "オフライン (送信不可)" : "出庫を確定する"}
            </Button>

            {/* 在庫確認ダイアログ */}
            {stockInfo && (
                <StockVerificationDialog
                    items={stockInfo}
                    mode="checkout"
                    onConfirm={handleStockVerified}
                    onMismatch={handleStockVerified}
                />
            )}
        </>
    );
}
