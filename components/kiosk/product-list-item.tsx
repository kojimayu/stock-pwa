
"use client";

import { useState } from "react";
import { QuantitySelectorDialog } from "./quantity-selector-dialog";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/lib/store";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";
import { Product } from "@/lib/types";

interface ProductListItemProps {
    product: Product;
}

export function ProductListItem({ product }: ProductListItemProps) {
    const addItem = useCartStore((state) => state.addItem);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const handleClick = () => {
        if (product.stock <= 0) {
            toast.error("在庫切れです");
            return;
        }
        setIsDialogOpen(true);
    };

    const handleConfirmQuantity = (quantity: number, isBox: boolean = false) => {
        addItem({
            productId: product.id,
            code: product.code, // Add code
            name: product.name,
            price: isBox ? (product.pricePerBox || product.priceA * (product.quantityPerBox || 1)) : product.priceA,
            quantity: quantity,
            isBox: isBox,
            quantityPerBox: isBox ? product.quantityPerBox : undefined,
            manufacturer: product.manufacturer || undefined,
            unit: product.unit || '個',
        });
        toast.success(`${product.name} を ${quantity}個 カートに追加しました`);
        setIsDialogOpen(false);
    };

    return (
        <>
            <div
                className={`
                    relative flex items-center justify-between p-4 border-b bg-white last:border-0 active:bg-slate-50 transition-colors cursor-pointer touch-manipulation
                    ${product.stock <= 0 ? 'opacity-60 bg-slate-50 pointer-events-none' : ''}
                `}
                onClick={handleClick}
            >
                <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center flex-wrap gap-2 mb-1">
                        {product.subCategory ? (
                            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                {product.subCategory}
                            </span>
                        ) : (
                            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                {product.category}
                            </span>
                        )}

                        {product.stock <= 0 ? (
                            <Badge variant="destructive" className="text-[10px] h-5 px-1.5">在庫なし</Badge>
                        ) : product.stock <= 5 && (
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-amber-100 text-amber-800 hover:bg-amber-100">残りわずか</Badge>
                        )}
                    </div>
                    <div className="font-bold text-lg text-slate-900 leading-snug line-clamp-2">
                        {product.name}
                        {product.code && (
                            <span className="ml-2 text-sm font-normal text-slate-500">{product.code}</span>
                        )}
                    </div>
                    <div className="mt-1.5">
                        <span className="text-slate-400 text-xs">在庫: {product.stock}</span>
                    </div>
                </div>

                <div className="flex-none pl-2">
                    <div className={`
                        w-12 h-12 rounded-full flex items-center justify-center shadow-sm border border-slate-100
                        ${product.stock > 0 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}
                     `}>
                        <ShoppingCart className="w-6 h-6" />
                    </div>
                </div>
            </div>

            <QuantitySelectorDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                product={product}
                onConfirm={handleConfirmQuantity}
            />
        </>
    );
}
