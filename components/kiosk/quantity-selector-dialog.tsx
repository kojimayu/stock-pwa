
"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Minus, Plus, ShoppingCart, AlertTriangle } from "lucide-react";
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

    // Check if there is enough stock for at least one box
    const hasBoxStock = canBuyBox && product.stock >= (product.quantityPerBox || 1);

    // Reset state when dialog opens
    useEffect(() => {
        if (open) {
            // Default to Box mode if unit is 'm' (VVF/IV cables) and has stock
            const defaultBoxMode = product.unit === 'm' && canBuyBox && hasBoxStock;
            setIsBox(defaultBoxMode);
            setQuantity(1);
        }
    }, [open, product.unit, canBuyBox, hasBoxStock]);

    // Calculate effective stock based on mode
    const maxQuantity = isBox
        ? Math.floor(product.stock / (product.quantityPerBox || 1))
        : product.stock;

    const handleIncrement = () => {
        if (quantity < maxQuantity) {
            setQuantity((prev) => prev + 1);
        } else {
            toast.error("在庫上限です");
        }
    };

    const handleDecrement = () => {
        if (quantity > 1) {
            setQuantity((prev) => prev - 1);
        }
    };

    const [showOddWarning, setShowOddWarning] = useState(false);

    const handleConfirm = () => {
        // 化粧ブロックなどは2個セットが多いので、奇数の場合に警告
        const isPairItem = product.name.includes("化粧ブロック");
        if (isPairItem && quantity % 2 !== 0 && !showOddWarning) {
            setShowOddWarning(true);
            return;
        }

        onConfirm(quantity, isBox);
        onOpenChange(false);
        setShowOddWarning(false);
    };

    const handleToggleBox = (toBox: boolean) => {
        if (toBox) {
            if (!hasBoxStock) {
                toast.error(`在庫不足のためセット（箱/巻）を選択できません。在庫: ${product.stock}${product.unit || '個'}`);
                return;
            }
            // Check if current quantity in boxes would exceed stock?
            // Reset to 1 for safety to avoid confusion
            setIsBox(true);
            setQuantity(1);
        } else {
            setIsBox(false);
            setQuantity(1);
        }
        setShowOddWarning(false);
    };

    const unitLabel = product.unit || '個';
    const boxLabel = unitLabel === 'm' ? '巻' : 'セット'; // VVF=巻, Others=Set/Box

    return (
        <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setShowOddWarning(false); }}>
            <DialogContent className="sm:max-w-2xl border-none shadow-2xl">
                <DialogHeader className="pb-2 border-b border-slate-100">
                    <DialogTitle className="text-2xl font-bold text-center text-slate-800">{product.name}</DialogTitle>
                </DialogHeader>

                <div className="py-8 flex flex-col items-center justify-center space-y-8">
                    {/* Warning Message for Odd Quantity */}
                    {showOddWarning && (
                        <div className="w-full max-w-md bg-amber-50 border-2 border-amber-200 rounded-xl p-4 text-center animate-in fade-in slide-in-from-top-2">
                            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                            <p className="font-bold text-amber-800 text-lg">数量が奇数ですがよろしいですか？</p>
                            <p className="text-sm text-amber-700 mt-1">
                                この商品は通常2個セットで使用されます。<br />
                                本当に{quantity}{unitLabel}でよろしいですか？
                            </p>
                            <div className="flex gap-2 mt-4">
                                <Button
                                    className="flex-1 bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200"
                                    onClick={() => setShowOddWarning(false)}
                                >
                                    数量を変更する
                                </Button>
                                <Button
                                    className="flex-1 bg-amber-600 text-white hover:bg-amber-700"
                                    onClick={() => {
                                        onConfirm(quantity, isBox);
                                        onOpenChange(false);
                                        setShowOddWarning(false);
                                    }}
                                >
                                    そのまま追加
                                </Button>
                            </div>
                        </div>
                    )}

                    {!showOddWarning && (
                        <>
                            {/* Unit Toggle Switch */}
                            {canBuyBox && (
                                <div className="flex bg-slate-100 p-1.5 rounded-xl w-full max-w-sm shadow-inner">
                                    <button
                                        className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all duration-200 ${!isBox ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                                        onClick={() => handleToggleBox(false)}
                                    >
                                        バラ ({unitLabel})
                                    </button>
                                    <button
                                        className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all duration-200 ${isBox ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'} ${!hasBoxStock ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        onClick={() => handleToggleBox(true)}
                                        disabled={!hasBoxStock}
                                    >
                                        {boxLabel} ({product.quantityPerBox}{unitLabel}入)
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

                                {/* Quantity Display */}
                                <div className="flex flex-col items-center justify-center w-72 h-32 bg-slate-50 rounded-2xl mx-1 shadow-inner ring-1 ring-slate-100 px-4">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-7xl font-black text-slate-800 tracking-tighter tabular-nums leading-none">
                                            {quantity}
                                        </span>
                                        <span className="text-xl font-bold text-slate-500">
                                            {isBox ? boxLabel : unitLabel}
                                        </span>
                                    </div>
                                    {isBox && (
                                        <div className="mt-1 text-blue-600 font-bold bg-blue-50 px-3 py-0.5 rounded-full text-sm">
                                            合計: {quantity * (product.quantityPerBox || 1)}{unitLabel}
                                        </div>
                                    )}
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
                                            // If quantity is 1 (default), set to 10. Otherwise add 10.
                                            const newQty = quantity === 1 ? 10 : Math.min(quantity + 10, maxQuantity);
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
                                        在庫: <span className="text-lg text-slate-700">{product.stock}</span> {unitLabel}
                                    </div>
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
                        </>
                    )}
                </div>

                {!showOddWarning && (
                    <DialogFooter>
                        <div className="w-full space-y-2 flex flex-col items-center">
                            {isBox && (
                                <div className="text-center text-xs text-muted-foreground bg-slate-100 p-2 rounded w-full max-w-md">
                                    ※在庫から <strong>{quantity * (product.quantityPerBox || 1)}{unitLabel}</strong> 減算されます
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
                )}
            </DialogContent>
        </Dialog>
    );
}
