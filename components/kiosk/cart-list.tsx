"use client";

import { useCartStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
                    key={`${item.productId}-${item.isBox ? 'box' : 'unit'}`}
                    className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200 shadow-sm"
                >
                    <div className="flex-1">
                        <h3 className="font-bold text-slate-900 line-clamp-2">
                            {item.name}
                            {item.isBox && (
                                <Badge variant="secondary" className="ml-2 bg-slate-800 text-white hover:bg-slate-700">
                                    箱 ({item.quantityPerBox}個入)
                                </Badge>
                            )}
                        </h3>
                        {(item.subCategory || item.category) && (
                            <span className="text-[11px] text-slate-500">
                                {item.subCategory || item.category}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-10 w-10"
                                onClick={() => updateQuantity(item.productId, item.quantity - 1, item.isBox)}
                            >
                                <Minus className="h-4 w-4" />
                            </Button>
                            <div
                                className="w-12 text-center font-bold text-lg cursor-text bg-slate-50 rounded py-1"
                                onClick={(e) => {
                                    const div = e.currentTarget;
                                    const input = document.createElement('input');
                                    input.type = 'number';
                                    input.inputMode = 'numeric';
                                    input.value = String(item.quantity);
                                    input.className = 'w-full text-center font-bold text-lg border-0 outline-none bg-blue-50 rounded';
                                    input.style.cssText = '-moz-appearance: textfield;';
                                    div.innerHTML = '';
                                    div.appendChild(input);
                                    input.focus();
                                    input.select();
                                    const commit = () => {
                                        const val = parseInt(input.value, 10);
                                        if (!isNaN(val) && val >= 0) {
                                            updateQuantity(item.productId, val, item.isBox);
                                        }
                                    };
                                    input.addEventListener('blur', commit);
                                    input.addEventListener('keydown', (ke) => {
                                        if (ke.key === 'Enter') input.blur();
                                        if (ke.key === 'Escape') { input.value = String(item.quantity); input.blur(); }
                                    });
                                }}
                            >
                                {item.quantity}
                            </div>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-10 w-10"
                                onClick={() => updateQuantity(item.productId, item.quantity + 1, item.isBox)}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>

                        <Button
                            variant="destructive"
                            size="icon"
                            className="h-10 w-10"
                            onClick={() => removeItem(item.productId, item.isBox)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );
}
