"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

import { toast } from "sonner";

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
            <DialogContent className="sm:max-w-2xl border-none shadow-2xl">
                <DialogHeader className="pb-2 border-b border-slate-100">
                    <DialogTitle className="text-2xl font-bold text-center text-slate-800">{product.name}</DialogTitle>
                </DialogHeader>

                <div className="py-8 flex flex-col items-center justify-center space-y-8">
                    {/* Unit Toggle Switch (Modernized) */}
                    {canBuyBox && (
                        <div className="flex bg-slate-100 p-1.5 rounded-xl w-full max-w-xs shadow-inner">
                            <button
                                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 ${!isBox ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                                onClick={() => { setIsBox(false); setQuantity(1); }}
                            >
                                バラ ({product.unit || '個'})
                            </button>
                            <button
                                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 ${isBox ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                                onClick={() => { setIsBox(true); setQuantity(1); }}
                            >
                                {product.quantityPerBox}{product.unit || '個'}セット
                            </button>
                        </div>
                    )}

                    {/* Quantity Control Area */}
                    <div className="flex items-center justify-center gap-6 w-full px-2">
                        {/* Decrease Buttons */}
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                className="h-16 w-16 p-0 rounded-2xl border-slate-200 bg-white text-slate-600 font-bold text-lg hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 active:scale-95 transition-all shadow-sm"
                                onClick={() => {
                                    const newQty = Math.max(1, quantity - 10);
                                    setQuantity(newQty);
                                }}
                                disabled={quantity <= 1}
                            >
                                -10
                            </Button>
                            <Button
                                variant="outline"
                                className="h-16 w-16 p-0 rounded-2xl border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 active:scale-95 transition-all shadow-sm"
                                onClick={handleDecrement}
                                disabled={quantity <= 1}
                            >
                                <Minus className="h-8 w-8" />
                            </Button>
                        </div>

                        {/* Quantity Display (Expanded for 4 digits) */}
                        <div className="flex items-baseline justify-center w-64 h-28 bg-slate-50 rounded-2xl mx-1 gap-1 shadow-inner ring-1 ring-slate-100 px-4">
                            <span className="text-7xl font-black text-slate-800 tracking-tighter tabular-nums leading-[112px]">
                                {quantity}
                            </span>
                            <span className="text-xl font-bold text-slate-500 ml-2">
                                {isBox ? 'セット' : (product.unit || '個')}
                            </span>
                        </div>

                        {/* Increase Buttons */}
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                className="h-16 w-16 p-0 rounded-2xl border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:border-blue-200 hover:text-blue-700 active:scale-95 transition-all shadow-sm"
                                onClick={handleIncrement}
                                disabled={quantity >= maxQuantity}
                            >
                                <Plus className="h-8 w-8" />
                            </Button>
                            <Button
                                variant="outline"
                                className="h-16 w-16 p-0 rounded-2xl border-blue-100 bg-blue-50 text-blue-600 font-bold text-lg hover:bg-blue-100 hover:border-blue-200 hover:text-blue-700 active:scale-95 transition-all shadow-sm"
                                onClick={() => {
                                    const newQty = Math.min(quantity + 10, maxQuantity);
                                    setQuantity(newQty);
                                    if (newQty === maxQuantity && quantity !== maxQuantity) toast.error("在庫上限です");
                                }}
                                disabled={quantity >= maxQuantity}
                            >
                                +10
                            </Button>
                        </div>
                    </div>

                    {/* Stock Info & Reset */}
                    <div className="flex flex-col items-center gap-4 w-full px-8">
                        <div className="text-center space-y-1">
                            <div className="text-sm font-bold text-slate-500">
                                在庫: <span className="text-lg text-slate-700">{product.stock}</span> {product.unit || '個'}
                            </div>
                            {isBox && (
                                <div className="text-blue-600 text-sm font-bold bg-blue-50 px-3 py-1 rounded-full">
                                    合計: {quantity * (product.quantityPerBox || 1)}{product.unit || '個'}
                                </div>
                            )}
                        </div>

                        <Button
                            variant="ghost"
                            className="h-12 w-full max-w-xs border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl"
                            onClick={() => setQuantity(1)}
                            disabled={quantity === 1}
                        >
                            数量を1に戻す
                        </Button>
                    </div>
                </div>

                <DialogFooter>
                    <div className="w-full space-y-2 flex flex-col items-center">
                        {isBox && (
                            <div className="text-center text-xs text-muted-foreground bg-slate-100 p-2 rounded w-full max-w-md">
                                ※在庫から <strong>{quantity * (product.quantityPerBox || 1)}{product.unit || '個'}</strong> 減算されます
                            </div>
                        )}
                        <Button
                            size="lg"
                            className="w-full max-w-sm h-14 text-lg font-bold shadow-lg"
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
