"use client";

import { useState } from "react";
import { QuantitySelectorDialog } from "./quantity-selector-dialog";

import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useCartStore } from "@/lib/store";
import { toast } from "sonner";

interface Product {
    id: number;
    name: string;
    category: string;
    priceA: number;
    priceB: number;
    stock: number;
}

interface ProductCardProps {
    product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
    const addItem = useCartStore((state) => state.addItem);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const handleAddClick = () => {
        if (product.stock <= 0) {
            toast.error("在庫切れです");
            return;
        }
        setIsDialogOpen(true);
    };

    const handleConfirmQuantity = (quantity: number) => {
        addItem({
            productId: product.id,
            name: product.name,
            price: product.priceA,
            quantity: quantity,
        });
        toast.success(`${product.name} を ${quantity}個 カートに追加しました`);
        setIsDialogOpen(false);
    };

    return (
        <>
            <Card className="flex flex-col h-full overflow-hidden shadow-sm border-slate-200 active:scale-95 transition-transform duration-100 touch-manipulation">
                <CardContent className="flex-1 p-4 flex flex-col justify-between">
                    <div className="space-y-2">
                        <div className="flex justify-between items-start">
                            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">{product.category}</span>
                            {product.stock <= 0 && (
                                <Badge variant="destructive">在庫なし</Badge>
                            )}
                            {product.stock > 0 && product.stock <= 5 && (
                                <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">残りわずか</Badge>
                            )}
                        </div>
                        <h3 className="font-bold text-lg leading-tight line-clamp-2 min-h-[3rem] text-slate-900">
                            {product.name}
                        </h3>
                    </div>

                    <div className="mt-4">
                        <div className="text-xs text-slate-400">
                            在庫: {product.stock}
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="p-0">
                    <Button
                        className="w-full h-14 rounded-t-none text-lg font-bold bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400"
                        onClick={handleAddClick}
                        disabled={product.stock <= 0}
                    >
                        <Plus className="w-5 h-5 mr-1" />
                        追加
                    </Button>
                </CardFooter>
            </Card>

            <QuantitySelectorDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                product={product}
                onConfirm={handleConfirmQuantity}
            />
        </>
    );
}
