"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { returnPartialTransaction } from "@/lib/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// Transaction Typings (Simplified)
type TransactionItem = {
    productId: number;
    name: string;
    quantity: number;
    isManual?: boolean;
    price: number;
};

type Transaction = {
    id: number;
    items: string; // JSON
    totalAmount: number;
    isReturned?: boolean;
};

interface TransactionReturnDialogProps {
    transaction: Transaction | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function TransactionReturnDialog({ transaction, open, onOpenChange }: TransactionReturnDialogProps) {
    const [items, setItems] = useState<TransactionItem[]>([]);
    const [returnQuantities, setReturnQuantities] = useState<Record<number, number>>({});
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        if (transaction && open) {
            try {
                let parsedItems = JSON.parse(transaction.items);
                // Handle different JSON structures if necessary (array or single object)
                if (!Array.isArray(parsedItems)) parsedItems = [parsedItems];

                // Filter out returnable items
                const validItems = (parsedItems as TransactionItem[]).filter(i => !i.isManual && i.quantity > 0);
                setItems(validItems);

                // Initialize return quantities to 0
                const initialQ: Record<number, number> = {};
                validItems.forEach(i => {
                    initialQ[i.productId] = 0;
                });
                setReturnQuantities(initialQ);
            } catch (e) {
                console.error(e);
                setItems([]);
            }
        }
    }, [transaction, open]);

    const handleQuantityChange = (productId: number, val: string) => {
        const num = parseInt(val, 10);
        if (isNaN(num)) return;
        // Clamp between 0 and max
        const item = items.find(i => i.productId === productId);
        if (!item) return;

        const clamped = Math.min(Math.max(0, num), item.quantity);
        setReturnQuantities(prev => ({ ...prev, [productId]: clamped }));
    };

    const handleSubmit = async () => {
        if (!transaction) return;

        // Validation
        const toReturn = Object.entries(returnQuantities).map(([pid, qty]) => ({
            productId: Number(pid),
            returnQuantity: qty
        })).filter(i => i.returnQuantity > 0);

        if (toReturn.length === 0) {
            toast.error("戻す数量を入力してください");
            return;
        }

        if (!confirm("選択した数量を在庫に戻しますか？\n（取引データから数量が減算されます）")) return;

        setLoading(true);
        try {
            const res = await returnPartialTransaction(transaction.id, toReturn);
            if (res.success) {
                toast.success("在庫に戻しました");
                onOpenChange(false);
                router.refresh();
            } else {
                toast.error(res.message);
            }
        } catch (e) {
            toast.error("エラーが発生しました");
        } finally {
            setLoading(false);
        }
    };

    if (!transaction) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>部材の戻し処理（一部対応）</DialogTitle>
                    <DialogDescription>
                        在庫に戻す数量を入力してください。<br />
                        <span className="text-xs text-muted-foreground">※戻した分だけ取引履歴の数量が減り、在庫数が増えます。</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                    {items.length === 0 ? (
                        <p className="text-center text-muted-foreground">戻し可能な商品がありません（手入力商品は対象外）</p>
                    ) : (
                        items.map((item) => (
                            <div key={item.productId} className="flex items-center justify-between gap-4 border-b pb-2 last:border-0">
                                <div className="flex-1">
                                    <div className="font-medium text-sm">{item.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                        持出数: {item.quantity} / 単価: {formatCurrency(item.price)}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Label className="text-xs w-12 text-right">戻す数:</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={item.quantity}
                                        className="w-20 text-right"
                                        value={returnQuantities[item.productId] ?? 0}
                                        onChange={(e) => handleQuantityChange(item.productId, e.target.value)}
                                        onFocus={(e) => e.target.select()}
                                    />
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        キャンセル
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading || items.length === 0} className="bg-red-600 hover:bg-red-700 text-white">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        在庫に戻す
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
