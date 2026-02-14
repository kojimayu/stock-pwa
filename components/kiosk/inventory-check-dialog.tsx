"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import { CartItem, useCartStore } from "@/lib/store"; // Import CartItem
import { getLatestStocks, processVerifiedReturn } from "@/lib/return-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface InventoryCheckDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    items: CartItem[];
    vendorId: number;
    vendorUserId: number | null;
}

export function InventoryCheckDialog({ open, onOpenChange, items, vendorId, vendorUserId }: InventoryCheckDialogProps) {
    const [step, setStep] = useState<'loading' | 'input' | 'processing'>('loading');
    const [stockData, setStockData] = useState<{ id: number; stock: number; name: string }[]>([]);
    const [actualCounts, setActualCounts] = useState<Record<number, number>>({});
    const [error, setError] = useState<string | null>(null);

    const clearCart = useCartStore((state) => state.clearCart);
    const router = useRouter();

    // Reset state when opening
    useEffect(() => {
        if (open) {
            setStep('loading');
            setError(null);
            setActualCounts({});

            // Fetch latest stocks
            // Only fetch if we have items
            if (items.length > 0) {
                getLatestStocks(items.map(i => i.productId))
                    .then(data => {
                        setStockData(data);
                        const initialCounts: Record<number, number> = {};
                        data.forEach(p => {
                            const cartItem = items.find(i => i.productId === p.id);
                            if (cartItem) {
                                const returnQty = cartItem.quantity; // Assuming cart quantity is return quantity
                                initialCounts[p.id] = p.stock + returnQty;
                            }
                        });
                        setActualCounts(initialCounts);
                        setStep('input');
                    })
                    .catch(err => {
                        console.error(err);
                        setError("在庫情報の取得に失敗しました");
                    });
            } else {
                setStep('input');
            }
        }
    }, [open]); // Remove items from dependency to avoid re-fetch logic when items change (they shouldn't change while dialog is open)

    const handleConfirm = async () => {
        setStep('processing');
        try {
            const returnItems = items.map(item => {
                const stock = stockData.find(s => s.id === item.productId);
                return {
                    productId: item.productId,
                    returnQuantity: item.quantity,
                    actualStock: actualCounts[item.productId] ?? ((stock?.stock || 0) + item.quantity)
                };
            });

            const res = await processVerifiedReturn(vendorId, vendorUserId, returnItems);

            if (res.success) {
                toast.success("返品・在庫確認が完了しました");
                clearCart();
                onOpenChange(false);
                router.push("/shop/complete"); // Or custom return complete page
            } else {
                toast.error(res.message || "処理に失敗しました");
                setStep('input');
            }
        } catch (e) {
            console.error(e);
            toast.error("予期せぬエラーが発生しました");
            setStep('input');
        }
    };

    if (!open) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CheckCircle className="w-6 h-6 text-orange-600" />
                        在庫確認と返品確定
                    </DialogTitle>
                    <DialogDescription>
                        返品後の【実在庫数】を入力してください。<br />
                        システム上の計算値と異なる場合、入力された数値に合わせて在庫が補正されます。
                    </DialogDescription>
                </DialogHeader>

                {step === 'loading' && (
                    <div className="flex justify-center p-8">
                        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 p-4 rounded text-red-600 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        {error}
                    </div>
                )}

                {step === 'input' && (
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-[1fr_80px_auto_100px] gap-4 font-bold text-sm text-slate-500 border-b pb-2 px-2">
                            <div>商品名</div>
                            <div className="text-center">返品数</div>
                            <div className="text-center">計算上の在庫</div>
                            <div className="text-center">実在庫(入力)</div>
                        </div>

                        {items.map(item => {
                            const stockInfo = stockData.find(s => s.id === item.productId);
                            const currentStock = stockInfo?.stock ?? 0;
                            const expectedStock = currentStock + item.quantity;

                            return (
                                <div key={item.productId} className="grid grid-cols-[1fr_80px_auto_100px] gap-4 items-center px-2 py-2 hover:bg-slate-50 rounded">
                                    <div className="font-bold text-slate-800">
                                        {item.name}
                                        <div className="text-xs text-slate-400 font-mono">{item.code}</div>
                                    </div>
                                    <div className="text-center font-bold text-orange-600">
                                        +{item.quantity}
                                    </div>
                                    <div className="text-center text-slate-500">
                                        {expectedStock}
                                    </div>
                                    <div>
                                        <Input
                                            type="number"
                                            className={`text-center font-bold text-lg h-10 ${actualCounts[item.productId] !== expectedStock ? 'bg-yellow-50 border-yellow-400 text-yellow-700' : ''}`}
                                            value={actualCounts[item.productId] ?? expectedStock}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value);
                                                if (!isNaN(val)) {
                                                    setActualCounts(prev => ({ ...prev, [item.productId]: val }));
                                                }
                                            }}
                                            onFocus={(e) => e.target.select()}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {step === 'processing' && (
                    <div className="flex flex-col items-center justify-center p-8 space-y-4">
                        <Loader2 className="w-10 h-10 animate-spin text-orange-600" />
                        <p className="text-slate-600 font-bold">処理中...</p>
                    </div>
                )}

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={step === 'processing'}>
                        キャンセル
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={step !== 'input'}
                        className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
                    >
                        確定して返品
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
