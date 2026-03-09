"use client";

import { useState, useEffect, useMemo } from "react";
import { useCartStore } from "@/lib/store";
import { AlertTriangle, CheckCircle, Package, MessageSquareWarning } from "lucide-react";
import { reportStockDiscrepancy } from "@/lib/actions";
import { toast } from "sonner";

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
    const vendor = useCartStore((state) => state.vendor);
    const vendorUser = useCartStore((state) => state.vendorUser);
    const [productInfo, setProductInfo] = useState<ProductStockInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
    // 不一致申告
    const [reportingId, setReportingId] = useState<number | null>(null);
    const [reportedStock, setReportedStock] = useState("");
    const [reportNote, setReportNote] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [reportedItems, setReportedItems] = useState<Set<number>>(new Set()); // 申告済み

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

    const handleReport = async () => {
        if (reportingId === null || !vendor) return;
        const stock = parseInt(reportedStock, 10);
        if (isNaN(stock) || stock < 0) {
            toast.error("正しい在庫数を入力してください");
            return;
        }
        setSubmitting(true);
        try {
            await reportStockDiscrepancy(
                reportingId,
                vendor.id,
                vendorUser?.id || null,
                stock,
                reportNote || undefined
            );
            toast.success("在庫不一致を報告しました。事務所に通知されます。");
            setReportedItems(prev => new Set(prev).add(reportingId));
            setReportingId(null);
            setReportedStock("");
            setReportNote("");
        } catch (error: any) {
            toast.error(error?.message || "報告に失敗しました");
        } finally {
            setSubmitting(false);
        }
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
                    const isReported = reportedItems.has(item.productId);
                    return (
                        <div key={item.productId} className="space-y-1">
                            <button
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
                            {/* 在庫が合わないボタン */}
                            {!isReported ? (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setReportingId(item.productId);
                                        setReportedStock("");
                                        setReportNote("");
                                    }}
                                    className="w-full text-xs text-orange-600 hover:text-orange-800 hover:underline flex items-center justify-center gap-1 py-1"
                                >
                                    <MessageSquareWarning className="w-3 h-3" />
                                    在庫が合わない場合はこちら
                                </button>
                            ) : (
                                <div className="text-xs text-green-600 text-center py-1">
                                    ✓ 不一致を報告済み
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {!allChecked && (
                <p className="text-xs text-amber-600 text-center">
                    ※ すべての商品を確認してから出庫を確定できます
                </p>
            )}

            {/* 不一致申告ダイアログ */}
            {reportingId !== null && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4">
                        <h3 className="font-bold text-lg text-slate-900">在庫不一致の報告</h3>
                        <p className="text-sm text-slate-600">
                            棚にある実際の数を入力してください。事務所に通知されます。
                        </p>
                        <div>
                            <label className="text-sm font-medium text-slate-700 block mb-1">
                                実際の在庫数
                            </label>
                            <input
                                type="number"
                                min="0"
                                inputMode="numeric"
                                value={reportedStock}
                                onChange={(e) => setReportedStock(e.target.value)}
                                className="w-full h-12 text-2xl font-bold text-center border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700 block mb-1">
                                メモ（任意）
                            </label>
                            <input
                                type="text"
                                value={reportNote}
                                onChange={(e) => setReportNote(e.target.value)}
                                placeholder="例: 棚に3個しかない"
                                className="w-full h-10 text-sm border border-slate-300 rounded-lg px-3 focus:border-blue-500 focus:outline-none"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setReportingId(null)}
                                className="flex-1 h-12 rounded-xl border-2 border-slate-300 text-slate-700 font-bold"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleReport}
                                disabled={submitting || !reportedStock}
                                className="flex-1 h-12 rounded-xl bg-orange-500 text-white font-bold disabled:opacity-50"
                            >
                                {submitting ? "送信中..." : "報告する"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
