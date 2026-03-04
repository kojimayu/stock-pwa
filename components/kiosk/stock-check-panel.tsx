"use client";

import { useState, useEffect, useMemo } from "react";
import { useCartStore } from "@/lib/store";
import { AlertTriangle, CheckCircle, Package } from "lucide-react";

interface ProductStockInfo {
    id: number;
    stock: number;
    requireStockCheck: boolean;
    unit: string;
}

interface StockCheckPanelProps {
    onReadyChange: (ready: boolean) => void;
}

export function StockCheckPanel({ onReadyChange }: StockCheckPanelProps) {
    const items = useCartStore((state) => state.items);
    const [productInfo, setProductInfo] = useState<ProductStockInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

    // カート内商品のstock情報をフェッチ
    useEffect(() => {
        const productIds = items.map((i) => i.productId).filter(Boolean);
        if (productIds.length === 0) {
            setLoading(false);
            return;
        }

        fetch(`/api/products/stock-check?ids=${productIds.join(",")}`)
            .then((res) => res.json())
            .then((data) => setProductInfo(data.products || []))
            .catch(() => setProductInfo([]))
            .finally(() => setLoading(false));
    }, [items]);

    // requireStockCheck=trueの商品だけ抽出
    const stockCheckItems = useMemo(() => {
        return items
            .filter((item) => {
                const info = productInfo.find((p) => p.id === item.productId);
                return info?.requireStockCheck;
            })
            .map((item) => {
                const info = productInfo.find((p) => p.id === item.productId)!;
                const quantity = item.isBox && item.quantityPerBox
                    ? item.quantity * item.quantityPerBox
                    : item.quantity;
                return {
                    ...item,
                    currentStock: info.stock,
                    afterStock: info.stock - quantity,
                    unit: info.unit || "個",
                };
            });
    }, [items, productInfo]);

    const allChecked = stockCheckItems.length > 0 &&
        stockCheckItems.every((item) => checkedItems.has(item.productId));

    // 親に状態通知
    useEffect(() => {
        if (stockCheckItems.length === 0) {
            onReadyChange(true); // チェック不要
        } else {
            onReadyChange(allChecked);
        }
    }, [allChecked, stockCheckItems.length, onReadyChange]);

    const toggleCheck = (productId: number) => {
        setCheckedItems((prev) => {
            const next = new Set(prev);
            if (next.has(productId)) next.delete(productId);
            else next.add(productId);
            return next;
        });
    };

    // requireStockCheck商品がない → 何も表示しない
    if (!loading && stockCheckItems.length === 0) return null;

    if (loading) return null;

    return (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-700 font-bold">
                <AlertTriangle className="w-5 h-5" />
                <span className="text-base">在庫残数の確認</span>
            </div>
            <p className="text-sm text-amber-600">
                以下の商品は持出し後の残数確認が必要です。
                棚の在庫を確認して ☑ を押してください。
            </p>

            <div className="space-y-2">
                {stockCheckItems.map((item) => {
                    const isChecked = checkedItems.has(item.productId);
                    return (
                        <button
                            key={item.productId}
                            onClick={() => toggleCheck(item.productId)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${isChecked
                                ? "bg-green-50 border-green-400"
                                : "bg-white border-amber-200 hover:border-amber-400"
                                }`}
                        >
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isChecked ? "bg-green-500 text-white" : "bg-slate-100 text-slate-300"
                                }`}>
                                {isChecked ? (
                                    <CheckCircle className="w-5 h-5" />
                                ) : (
                                    <Package className="w-4 h-4" />
                                )}
                            </div>

                            <div className="flex-1 text-left">
                                <div className="font-medium text-sm text-slate-900 line-clamp-1">
                                    {item.name}
                                </div>
                            </div>

                            <div className="text-right text-sm space-y-0.5">
                                <div className="text-slate-500">
                                    現在 <span className="font-bold text-slate-900">{item.currentStock}</span>{item.unit}
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-slate-400">→</span>
                                    <span className={`font-bold ${item.afterStock < 0 ? "text-red-600" : "text-blue-600"}`}>
                                        {item.afterStock}
                                    </span>
                                    <span className="text-slate-500">{item.unit}</span>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {!allChecked && (
                <p className="text-xs text-amber-600 text-center">
                    ※ すべての商品を確認してから出庫を確定できます
                </p>
            )}
        </div>
    );
}
