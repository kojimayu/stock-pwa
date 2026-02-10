"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { updateTransaction, TransactionItem, getProduct } from "@/lib/actions";
import { Loader2, Trash2, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ProductSearchDialog } from "./product-search-dialog";
import { QuantitySelectorDialog } from "@/components/kiosk/quantity-selector-dialog";

type Transaction = {
    id: number;
    items: string;
    totalAmount: number;
    vendor: { name: string };
};

interface TransactionEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    transaction: Transaction | null;
    onSuccess?: () => void;
}

export function TransactionEditDialog({
    open,
    onOpenChange,
    transaction,
    onSuccess,
}: TransactionEditDialogProps) {
    const [items, setItems] = useState<TransactionItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);

    // Quantity Selector State
    const [quantityDialogOpen, setQuantityDialogOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<any>(null);

    useEffect(() => {
        if (transaction) {
            try {
                const parsed = JSON.parse(transaction.items);
                setItems(Array.isArray(parsed) ? parsed : [parsed]);
            } catch (e) {
                toast.error("取引データの読み込みに失敗しました");
                setItems([]);
            }
        }
    }, [transaction]);

    const handleQuantityChange = (index: number, val: string) => {
        const qty = parseInt(val);
        if (isNaN(qty) || qty < 0) return;

        const newItems = [...items];
        newItems[index].quantity = qty;
        setItems(newItems);
    };

    const handleDelete = (index: number) => {
        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);
    };

    const calculateTotal = () => {
        return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    };

    const handleAddProduct = () => {
        setSearchOpen(true);
    };

    const handleProductSelect = async (productId: number) => {
        setLoading(true);
        try {
            const product = await getProduct(productId);
            if (!product) {
                toast.error("商品が見つかりません");
                return;
            }

            const existingIndex = items.findIndex(i => i.productId === product.id && !i.isManual);

            if (existingIndex >= 0) {
                toast.info("既にリストにあるため、数量を増やしました");
                const newItems = [...items];
                newItems[existingIndex].quantity += 1;
                setItems(newItems);
            } else {
                // @ts-ignore
                const boxQty = product.quantityPerBox || 1;
                const newItem: TransactionItem = {
                    productId: product.id,
                    name: product.name,
                    price: product.priceA,
                    quantity: 1,
                    code: product.code,
                    isManual: false,
                    isBox: false,
                    quantityPerBox: boxQty,
                };
                setItems([...items, newItem]);
                toast.success("商品を追加しました");
            }
        } catch (e) {
            toast.error("商品情報の取得に失敗しました");
        } finally {
            setLoading(false);
        }
    };

    const handleQuantityConfirm = (quantity: number, isBox: boolean = false) => {
        if (!selectedProduct) return;

        const product = selectedProduct;
        // Cast to any to avoid strict type checks on quantityPerBox
        const p = product as any;
        const boxQty = p.quantityPerBox || 1;

        const existingIndex = items.findIndex(i => i.productId === p.id && !i.isManual && i.isBox === isBox);

        if (existingIndex >= 0) {
            toast.info("既にリストにあるため、数量を増やしました");
            const newItems = [...items];
            newItems[existingIndex].quantity += quantity;
            setItems(newItems);
        } else {
            const newItem: TransactionItem = {
                productId: p.id,
                name: p.name,
                price: isBox ? (p.pricePerBox || p.priceA * boxQty) : p.priceA,
                quantity: quantity,
                code: p.code,
                isManual: false,
                isBox: isBox,
                quantityPerBox: boxQty,
                unit: p.unit
            };
            setItems([...items, newItem]);
            toast.success("商品を追加しました");
        }
        setQuantityDialogOpen(false);
    };

    const handleSave = async () => {
        if (!transaction) return;

        if (items.length === 0) {
            toast.error("商品が0件です。取引を取り消す場合は「在庫に戻す」機能を使用してください。");
            return;
        }

        setLoading(true);
        try {
            const res = await updateTransaction(transaction.id, items);
            if (res.success) {
                toast.success("取引を修正しました");
                onOpenChange(false);
                if (onSuccess) onSuccess();
            } else {
                toast.error("修正に失敗しました");
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
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <div className="flex justify-between items-center pr-8">
                        <DialogTitle>取引内容の修正 (#{transaction.id})</DialogTitle>
                    </div>
                    <DialogDescription>
                        数量変更・削除、または「商品追加」で正しい商品に入れ替えてください。<br />
                        商品間違いの場合: 正しい商品を追加 → 間違った商品を削除
                    </DialogDescription>
                </DialogHeader>

                <div className="flex justify-end mb-2">
                    <Button variant="outline" size="sm" onClick={handleAddProduct} disabled={loading}>
                        <Plus className="w-4 h-4 mr-2" />
                        商品を追加
                    </Button>
                </div>

                <div className="py-4 space-y-4 max-h-[50vh] overflow-y-auto border rounded-md p-2">
                    {items.map((item, index) => (
                        <div key={index} className="flex items-center gap-4 border-b pb-4 last:border-0 last:pb-0">
                            <div className="flex-1">
                                <div className="font-medium text-sm">
                                    {item.name}
                                    {item.code && <span className="ml-2 text-xs text-slate-500 font-mono">[{item.code}]</span>}
                                    {item.isManual && <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1 rounded">手入力</span>}
                                </div>
                                <div className="text-xs text-slate-500">
                                    単価: {formatCurrency(item.price)}
                                    {item.isBox && item.quantityPerBox && ` / 箱 (${item.quantityPerBox}入)`}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Label htmlFor={`qty-${index}`} className="text-xs">数量</Label>
                                <Input
                                    id={`qty-${index}`}
                                    type="number"
                                    min="1"
                                    className="w-20 text-right"
                                    value={item.quantity}
                                    onChange={(e) => handleQuantityChange(index, e.target.value)}
                                    disabled={loading}
                                />
                                <span className="text-sm w-8">
                                    {item.isBox ? "箱" : item.unit || "個"}
                                </span>
                            </div>

                            <div className="text-right w-24 font-medium text-sm">
                                {formatCurrency(item.price * item.quantity)}
                            </div>

                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-slate-400 hover:text-red-600"
                                onClick={() => handleDelete(index)}
                                disabled={loading}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                </div>

                <div className="flex justify-between items-center bg-slate-50 p-4 rounded-lg mt-4">
                    <div className="text-sm font-medium text-slate-600">
                        修正後合計
                    </div>
                    <div className="text-xl font-bold">
                        {formatCurrency(calculateTotal())}
                    </div>
                </div>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        キャンセル
                    </Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        保存して在庫を調整
                    </Button>
                </DialogFooter>
            </DialogContent>

            <ProductSearchDialog
                open={searchOpen}
                onOpenChange={setSearchOpen}
                onSelect={handleProductSelect}
            />

            {selectedProduct && (
                <QuantitySelectorDialog
                    open={quantityDialogOpen}
                    onOpenChange={setQuantityDialogOpen}
                    product={selectedProduct}
                    onConfirm={handleQuantityConfirm}
                />
            )}
        </Dialog>
    );
}
