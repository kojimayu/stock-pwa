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
    const canBuyBox = (product.quantityPerBox || 0) > 1 && (product.pricePerBox || 0) > 0;

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
                        <div className="flex bg-slate-100 p-1 rounded-lg w-full max-w-[200px]">
                            <button
                                className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${!isBox ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                                onClick={() => { setIsBox(false); setQuantity(1); }}
                            >
                                バラ
                            </button>
                            <button
                                className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${isBox ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                                onClick={() => { setIsBox(true); setQuantity(1); }}
                            >
                                箱 ({product.quantityPerBox}個)
                            </button>
                        </div>
                    )}

                    <div className="text-center">
                        <div className="text-2xl font-bold text-slate-900">
                            <span className="text-sm font-normal text-slate-500 ml-1">{isBox ? '箱' : '個'}</span>
                        </div>
                        <div className="text-sm text-slate-500 mt-1">
                            現在の在庫: {product.stock}個
                            {isBox && ` (${Math.floor(product.stock / (product.quantityPerBox || 1))}箱)`}
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
                            <span className="text-4xl font-bold text-slate-900">{quantity}</span>
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

                    <div className="grid grid-cols-4 gap-2 w-full px-4">
                        {[5, 10, 20].map((num) => (
                            (!isBox || num * (product.quantityPerBox || 1) <= product.stock) &&
                            // Only show larger numbers if stock allows. For Box, check if we have enough boxes.
                            num <= maxQuantity && (
                                <Button
                                    key={num}
                                    variant="outline"
                                    size="sm"
                                    className="font-bold"
                                    onClick={() => setQuantity(num)}
                                >
                                    {num}個
                                </Button>
                            )
                        ))}
                        <Button
                            variant="destructive"
                            size="sm"
                            className="font-bold"
                            onClick={() => setQuantity(1)}
                        >
                            クリア
                        </Button>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        size="lg"
                        className="w-full h-14 text-lg font-bold"
                        onClick={handleConfirm}
                    >
                        <ShoppingCart className="w-5 h-5 mr-2" />
                        カートに入れる
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
