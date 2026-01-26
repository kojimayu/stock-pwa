"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Minus, Plus, ShoppingCart } from "lucide-react";

interface Product {
    id: number;
    name: string;
    stock: number;
}

interface QuantitySelectorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    product: Product;
    onConfirm: (quantity: number) => void;
}

export function QuantitySelectorDialog({ open, onOpenChange, product, onConfirm }: QuantitySelectorDialogProps) {
    const [quantity, setQuantity] = useState(1);

    // Reset quantity when dialog opens
    useEffect(() => {
        if (open) {
            setQuantity(1);
        }
    }, [open]);

    const handleIncrement = () => {
        if (quantity < product.stock) {
            setQuantity((prev) => prev + 1);
        }
    };

    const handleDecrement = () => {
        if (quantity > 1) {
            setQuantity((prev) => prev - 1);
        }
    };

    const handleConfirm = () => {
        onConfirm(quantity);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">{product.name}</DialogTitle>
                </DialogHeader>

                <div className="py-6 flex flex-col items-center justify-center space-y-6">
                    <div className="text-sm text-slate-500">
                        現在の在庫: {product.stock}
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
                            disabled={quantity >= product.stock}
                        >
                            <Plus className="h-8 w-8" />
                        </Button>
                    </div>

                    <div className="grid grid-cols-4 gap-2 w-full px-4">
                        {[10, 20, 30].map((num) => (
                            num <= product.stock && (
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
