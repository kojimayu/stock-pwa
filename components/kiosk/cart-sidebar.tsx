
"use client";

import { useState } from "react";
import { useCartStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Trash2, ShoppingCart, CheckCircle, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { createTransaction } from "@/lib/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";

import { InventoryCheckDialog } from "./inventory-check-dialog";

interface CartSidebarProps {
    className?: string;
}

export function CartSidebar({ className }: CartSidebarProps) {
    const { items, removeItem, updateQuantity, getTotalPrice, getTotalItems, vendor, vendorUser, isProxyMode, isReturnMode, transactionDate, clearCart } = useCartStore();
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [showInventoryCheckDialog, setShowInventoryCheckDialog] = useState(false);
    const router = useRouter();

    // const totalAmount = getTotalPrice();
    // const totalItems = getTotalItems();

    const handleCheckout = async () => {
        if (!vendor) {
            toast.error("ベンダー情報がありません");
            return;
        }

        setIsCheckingOut(true);
        setShowConfirmDialog(false);

        try {
            const res = await createTransaction(
                vendor.id,
                vendorUser?.id ?? null,
                items,
                undefined,
                isProxyMode,
                transactionDate ?? undefined
            );

            if (res.success) {
                clearCart();
                toast.success("注文を確定しました");
                if (isProxyMode) {
                    router.push("/shop/complete");
                } else {
                    router.push("/shop/complete");
                }
            } else {
                toast.error(res.message || "注文処理に失敗しました");
            }
        } catch (error) {
            toast.error("予期せぬエラーが発生しました");
            console.error(error);
        } finally {
            setIsCheckingOut(false);
        }
    };

    return (
        <div className={cn("flex flex-col h-full bg-slate-50 border-l overflow-hidden overscroll-y-contain", className)}>
            <div className="p-4 border-b bg-white shadow-sm z-10">
                <div className="flex items-center gap-2 text-slate-800">
                    <ShoppingCart className="w-5 h-5 text-blue-600" />
                    <span className="font-bold">カート ({items.length}種類)</span>
                </div>
            </div>

            <ScrollArea className="flex-1 p-3 min-h-0">
                {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm">
                        <ShoppingCart className="w-8 h-8 mb-2 opacity-20" />
                        <p>商品を選択してください</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {items.map((item) => {
                            // Determine container label (Box or Roll)
                            // If unit is 'm', it's likely a coil/roll -> '巻'
                            // Otherwise default to '箱'
                            const containerUnit = item.unit === 'm' ? '巻' : '箱';

                            return (
                                <div key={item.productId} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 shadow-sm gap-3">
                                    {/* Left: Name and Code */}
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-sm text-slate-800 leading-snug break-words">
                                            {item.name}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                                {item.code || "-"}
                                            </span>
                                            <span className="text-xs text-slate-500">
                                                {item.unit || '個'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Right: Quantity Controls and Delete */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <div className="flex items-center bg-slate-100 rounded-lg border border-slate-200 overflow-hidden">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-10 w-10 rounded-none hover:bg-slate-200 active:bg-slate-300"
                                                onClick={() => updateQuantity(item.productId, item.quantity - 1, item.isBox)}
                                            >
                                                <Minus className="w-4 h-4 text-slate-600" />
                                            </Button>
                                            <div className="w-20 text-center flex flex-col justify-center leading-none px-1 py-1 bg-white h-10 border-x border-slate-200">
                                                <span className="font-bold text-base text-slate-900">
                                                    {item.isBox
                                                        ? ((item.quantity) * (item.quantityPerBox || 1)).toLocaleString()
                                                        : item.quantity}
                                                </span>
                                                {item.isBox && (
                                                    <span className="text-xs font-bold text-blue-600 mt-0.5">
                                                        ({item.quantity}{containerUnit})
                                                    </span>
                                                )}
                                            </div>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-10 w-10 rounded-none hover:bg-slate-200 active:bg-slate-300"
                                                onClick={() => updateQuantity(item.productId, item.quantity + 1, item.isBox)}
                                            >
                                                <Plus className="w-4 h-4 text-slate-600" />
                                            </Button>
                                        </div>

                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-10 w-10 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                            onClick={() => removeItem(item.productId, item.isBox)}
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </ScrollArea>

            <div className="p-4 border-t bg-slate-50 space-y-4">
                <div className="flex justify-between items-center text-lg font-bold text-slate-800">
                    <span>商品種類</span>
                    <span>{items.length} 種類</span>
                </div>
                <Button
                    className={cn("w-full h-12 text-lg font-bold shadow-sm", isReturnMode ? "bg-orange-600 hover:bg-orange-700" : "")}
                    size="lg"
                    onClick={() => {
                        if (isReturnMode) {
                            setShowInventoryCheckDialog(true);
                        } else {
                            setShowConfirmDialog(true);
                        }
                    }}
                    disabled={items.length === 0 || isCheckingOut}
                >
                    {isCheckingOut ? (
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                        <CheckCircle className="w-5 h-5 mr-2" />
                    )}
                    {isReturnMode ? "返却確認へ" : "注文確認へ"}
                </Button>
            </div>

            {/* Confirm Dialog */}
            <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>注文を確定しますか？</DialogTitle>
                        <DialogDescription>
                            以下の内容で注文を確定します。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="bg-slate-50 p-4 rounded-md text-sm space-y-2">
                        <div className="flex justify-between">
                            <span className="text-slate-500">商品種類</span>
                            <span className="font-bold">{items.length}種類</span>
                        </div>
                        {/* 合計金額非表示 */}
                        {/* <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
                            <span>合計金額</span>
                            <span>¥{totalAmount.toLocaleString()}</span>
                        </div> */}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                            キャンセル
                        </Button>
                        <Button onClick={handleCheckout} disabled={isCheckingOut}>
                            {isCheckingOut && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            確定する
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Inventory Check Dialog for Returns */}
            <InventoryCheckDialog
                open={showInventoryCheckDialog}
                onOpenChange={setShowInventoryCheckDialog}
                items={items}
                vendorId={vendor?.id || 0}
                vendorUserId={vendorUser?.id || null}
            />
        </div>
    );
}
