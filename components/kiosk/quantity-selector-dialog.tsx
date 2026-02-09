"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Product {
    id: number;
    name: string;
    stock: number;
    priceA: number;
    quantityPerBox?: number;
    pricePerBox?: number;
    unit?: string;
}

interface QuantitySelectorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    product: Product;
    onConfirm: (quantity: number, isBox?: boolean) => void;
}

export function QuantitySelectorDialog({ open, onOpenChange, product, onConfirm }: QuantitySelectorDialogProps) {
    const [quantity, setQuantity] = useState(1);
    const [isBox, setIsBox] = useState(false);

    // Check if box mode is available
    const canBuyBox = (product.quantityPerBox || 0) > 1;

    // Reset state when dialog opens
    useEffect(() => {
        if (open) {
            setQuantity(1);
            setIsBox(false);
        }
    }, [open]);

    // Calculate effective stock based on mode
    const maxQuantity = isBox
        ? Math.floor(product.stock / (product.quantityPerBox || 1))
        : product.stock;

    const currentPrice = isBox
        ? (product.pricePerBox || 0)
        : product.priceA;

    const handleIncrement = () => {
        if (quantity < maxQuantity) {
            setQuantity((prev) => prev + 1);
        }
    };

    const handleDecrement = () => {
        if (quantity > 1) {
            setQuantity((prev) => prev - 1);
        }
    };

    const handleConfirm = () => {
        onConfirm(quantity, isBox);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">{product.name}</DialogTitle>
                </DialogHeader>

                <div className="py-6 flex flex-col items-center justify-center space-y-6">
                    {canBuyBox && (
                        <div className="w-full flex justify-center mb-2">
                            <div className="flex bg-slate-100 p-1 rounded-lg w-full max-w-[260px]">
                                <button
                                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${!isBox ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                                    onClick={() => { setIsBox(false); setQuantity(1); }}
                                >
                                    バラ ({product.unit || '個'})
                                </button>
                                <button
                                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${isBox ? 'bg-white shadow text-slate-900 border-2 border-blue-500' : 'text-slate-500 hover:text-slate-700'}`}
                                    onClick={() => { setIsBox(true); setQuantity(1); }}
                                >
                                    {product.quantityPerBox}{product.unit || '個'}セット
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="text-center">
                        <div className="text-3xl font-bold text-slate-900 flex items-end justify-center">
                            {quantity}
                            <span className="text-lg font-normal text-slate-500 ml-1 mb-1">
                                {isBox ? 'セット' : (product.unit || '個')}
                            </span>
                        </div>
                        {isBox && (
                            <div className="text-blue-600 font-bold mt-1 bg-blue-50 px-3 py-1 rounded-full inline-block">
                                合計: {quantity * (product.quantityPerBox || 1)}{product.unit || '個'}
                            </div>
                        )}
                        <div className="text-sm text-slate-500 mt-2">
                            現在の在庫: {product.stock}{product.unit || '個'}
                        </div>
                    </div>

                    <div className="flex items-center space-x-6">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-16 w-16 rounded-full border-2"
                            onClick={handleDecrement}
                            disabled={quantity <= 1}
                        >
                            <Minus className="h-8 w-8" />
                        </Button>

                        <div className="w-24 text-center">
                            {/* Number displayed above */}
                        </div>

                        <Button
                            variant="outline"
                            size="icon"
                            className="h-16 w-16 rounded-full border-2"
                            onClick={handleIncrement}
                            disabled={quantity >= maxQuantity}
                        >
                            <Plus className="h-8 w-8" />
                        </Button>
                    </div>

                    {/* Quick Select Buttons */}
                    <div className="grid grid-cols-4 gap-2 w-full px-4">
                        {[1, 2, 3, 5, 10].map((num) => {
                            const totalQty = num * (isBox ? (product.quantityPerBox || 1) : 1);
                            if (totalQty > product.stock) return null;

                            return (
                                <Button
                                    key={num}
                                    variant="outline"
                                    size="sm"
                                    className="font-bold"
                                    onClick={() => setQuantity(num)}
                                >
                                    {num}{isBox ? 'セット' : (product.unit || '個')}
                                </Button>
                            );
                        })}
                        <Button
                            variant="destructive"
                            size="sm"
                            className="font-bold"
                            onClick={() => setQuantity(1)}
                        >
                            リセット
                        </Button>
                    </div>
                </div>

                <DialogFooter>
                    <div className="w-full space-y-2">
                        {isBox && (
                            <div className="text-center text-xs text-muted-foreground bg-slate-100 p-2 rounded">
                                ※在庫から <strong>{quantity * (product.quantityPerBox || 1)}{product.unit || '個'}</strong> 減算されます
                            </div>
                        )}
                        <Button
                            size="lg"
                            className="w-full h-14 text-lg font-bold"
                            onClick={handleConfirm}
                        >
                            <ShoppingCart className="w-5 h-5 mr-2" />
                            カートに入れる
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
