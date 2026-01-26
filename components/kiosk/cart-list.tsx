"use client";

import { useCartStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2 } from "lucide-react";

export function CartList() {
    const items = useCartStore((state) => state.items);
    const updateQuantity = useCartStore((state) => state.updateQuantity);
    const removeItem = useCartStore((state) => state.removeItem);

    if (items.length === 0) {
        return (
            <div className="text-center py-20 text-slate-500">
                カートは空です
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {items.map((item) => (
                <div
                    key={item.productId}
                    className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200 shadow-sm"
                >
                    <div className="flex-1">
                        <h3 className="font-bold text-slate-900 line-clamp-2">{item.name}</h3>
                    </div>

                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-10 w-10"
                                onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                            >
                                <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-8 text-center font-bold text-lg">{item.quantity}</span>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-10 w-10"
                                onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>

                        <Button
                            variant="destructive"
                            size="icon"
                            className="h-10 w-10"
                            onClick={() => removeItem(item.productId)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );
}
