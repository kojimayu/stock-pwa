"use client";

import { useState } from "react";
import { PickingItem } from "@/lib/store";
import { reportStockDiscrepancy } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Package, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";

interface Props {
    stockCheckItems: PickingItem[];
    onComplete: () => void;
}

export function StockVerificationOverlay({ stockCheckItems, onComplete }: Props) {
    // 各商品の入力値（初期値はexpectedStock）
    const [inputValues, setInputValues] = useState<Record<number, string>>(() => {
        const init: Record<number, string> = {};
        stockCheckItems.forEach(item => {
            init[item.productId] = String(item.expectedStock ?? 0);
        });
        return init;
    });
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [mismatchCount, setMismatchCount] = useState(0);

    const handleConfirm = async () => {
        setSubmitting(true);
        let mismatches = 0;

        try {
            for (const item of stockCheckItems) {
                const actualStock = parseInt(inputValues[item.productId] ?? "0", 10);
                const expected = item.expectedStock ?? 0;

                if (!isNaN(actualStock) && actualStock !== expected && item.vendorId) {
                    // 不一致 → 自動申告（systemStockは持出し後の期待値）
                    await reportStockDiscrepancy(
                        item.productId,
                        item.vendorId,
                        item.vendorUserId ?? null,
                        actualStock,
                        `ピッキング後の在庫確認で不一致（期待: ${expected}, 実数: ${actualStock}）`
                    );
                    mismatches++;
                }
            }

            setMismatchCount(mismatches);
            setDone(true);
        } catch (error) {
            console.error("在庫申告エラー:", error);
            setDone(true);
        } finally {
            setSubmitting(false);
        }
    };

    const handleInputChange = (productId: number, value: string) => {
        setInputValues(prev => ({ ...prev, [productId]: value }));
    };

    // 全商品が期待値と一致しているか
    const allMatch = stockCheckItems.every(item => {
        const val = parseInt(inputValues[item.productId] ?? "0", 10);
        return !isNaN(val) && val === (item.expectedStock ?? 0);
    });

    return (
        <div className="min-h-screen bg-blue-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[95vh] flex flex-col animate-in zoom-in-95 duration-200">
                {/* ヘッダー */}
                <div className="p-4 border-b text-center">
                    <div className="flex justify-center mb-2">
                        <div className="p-3 rounded-full bg-blue-100">
                            <Package className="w-8 h-8 text-blue-600" />
                        </div>
                    </div>
                    <h2 className="text-lg font-bold text-slate-900">
                        持出し後の在庫確認
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        棚に残っている数を確認してください
                    </p>
                </div>

                {!done ? (
                    <>
                        {/* 在庫入力一覧 */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {stockCheckItems.map((item) => {
                                const inputVal = parseInt(inputValues[item.productId] ?? "0", 10);
                                const expected = item.expectedStock ?? 0;
                                const isMismatch = !isNaN(inputVal) && inputVal !== expected;

                                return (
                                    <div
                                        key={item.productId}
                                        className={`rounded-xl p-3 border-2 transition-all ${
                                            isMismatch
                                                ? "bg-red-50 border-red-300"
                                                : "bg-slate-50 border-slate-200"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-slate-900 text-sm truncate">
                                                    {item.name}
                                                </p>
                                                {item.code && (
                                                    <p className="text-xs text-slate-400">{item.code}</p>
                                                )}
                                                <p className="text-xs text-blue-600 mt-1">
                                                    正しければ <span className="font-bold">{expected}</span>{item.unit || "個"}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 ml-3">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    inputMode="numeric"
                                                    value={inputValues[item.productId] ?? ""}
                                                    onChange={(e) => handleInputChange(item.productId, e.target.value)}
                                                    onFocus={(e) => e.target.select()}
                                                    className={`w-20 h-12 text-2xl font-bold text-center border-2 rounded-xl focus:outline-none ${
                                                        isMismatch
                                                            ? "border-red-400 text-red-700 focus:border-red-500"
                                                            : "border-slate-300 text-slate-900 focus:border-blue-500"
                                                    }`}
                                                />
                                                <span className="text-sm text-slate-500">
                                                    {item.unit || "個"}
                                                </span>
                                            </div>
                                        </div>
                                        {isMismatch && (
                                            <div className="mt-2 text-sm font-medium text-red-600 flex items-center gap-1">
                                                <AlertTriangle className="w-4 h-4" />
                                                差異: {inputVal - expected > 0 ? "+" : ""}{inputVal - expected}
                                                （自動で事務所に通知されます）
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* 確認ボタン */}
                        <div className="p-4 border-t">
                            <Button
                                className={`w-full h-14 text-lg font-bold ${
                                    allMatch
                                        ? "bg-green-600 hover:bg-green-700 text-white"
                                        : "bg-orange-500 hover:bg-orange-600 text-white"
                                }`}
                                onClick={handleConfirm}
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                ) : allMatch ? (
                                    <CheckCircle className="w-5 h-5 mr-2" />
                                ) : (
                                    <AlertTriangle className="w-5 h-5 mr-2" />
                                )}
                                {submitting
                                    ? "確認中..."
                                    : allMatch
                                        ? "在庫OK — 完了"
                                        : "不一致を報告して完了"
                                }
                            </Button>
                        </div>
                    </>
                ) : (
                    /* 完了画面 */
                    <div className="p-6 text-center space-y-4">
                        {mismatchCount > 0 ? (
                            <>
                                <div className="p-4 bg-orange-50 border-2 border-orange-300 rounded-xl">
                                    <AlertTriangle className="w-10 h-10 text-orange-500 mx-auto mb-2" />
                                    <p className="font-bold text-orange-700 text-lg">
                                        {mismatchCount}件の不一致を報告しました
                                    </p>
                                    <p className="text-sm text-orange-600 mt-1">
                                        事務所に自動通知されました
                                    </p>
                                </div>
                            </>
                        ) : (
                            <div className="p-4 bg-green-50 border-2 border-green-300 rounded-xl">
                                <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                                <p className="font-bold text-green-700 text-lg">
                                    在庫確認OK
                                </p>
                            </div>
                        )}
                        <Button
                            className="w-full h-12 bg-slate-800 hover:bg-slate-900 text-white font-bold"
                            onClick={onComplete}
                        >
                            完了
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
