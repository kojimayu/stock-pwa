"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertTriangle, Loader2, Package } from "lucide-react";

interface StockItem {
    productId: number;
    name: string;
    code?: string;
    expectedStock: number;
    unit?: string;
}

interface StockVerificationDialogProps {
    items: StockItem[];
    mode: "checkout" | "return"; // 持出し or 返品
    onConfirm: () => void; // 在庫が合っている場合
    onMismatch: () => void; // 在庫が合っていない場合
}

export function StockVerificationDialog({
    items,
    mode,
    onConfirm,
    onMismatch,
}: StockVerificationDialogProps) {
    const [showMismatchMessage, setShowMismatchMessage] = useState(false);

    const modeLabel = mode === "checkout" ? "持出し" : "返品";
    const modeColor = mode === "checkout" ? "blue" : "orange";

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
                {/* ヘッダー */}
                <div className="p-4 border-b text-center">
                    <div className="flex justify-center mb-2">
                        <div className={`p-3 rounded-full ${mode === "checkout" ? "bg-blue-100" : "bg-orange-100"}`}>
                            <Package className={`w-8 h-8 ${mode === "checkout" ? "text-blue-600" : "text-orange-600"}`} />
                        </div>
                    </div>
                    <h2 className="text-lg font-bold text-slate-900">
                        {modeLabel}後の在庫確認
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        棚の在庫を確認してください
                    </p>
                </div>

                {/* 在庫一覧 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {items.map((item) => (
                        <div
                            key={item.productId}
                            className="flex items-center justify-between bg-slate-50 rounded-xl p-3"
                        >
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-slate-900 text-sm truncate">
                                    {item.name}
                                </p>
                                {item.code && (
                                    <p className="text-xs text-slate-400">{item.code}</p>
                                )}
                            </div>
                            <div className="text-right ml-3">
                                <span className="text-2xl font-bold text-slate-900">
                                    {item.expectedStock}
                                </span>
                                <span className="text-sm text-slate-500 ml-1">
                                    {item.unit || "個"}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* 確認ボタンエリア */}
                <div className="p-4 border-t space-y-3">
                    {!showMismatchMessage ? (
                        <>
                            <Button
                                className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700 text-white"
                                onClick={onConfirm}
                            >
                                <CheckCircle className="w-5 h-5 mr-2" />
                                在庫が合っている
                            </Button>
                            <Button
                                variant="outline"
                                className="w-full h-12 text-red-600 border-red-300 hover:bg-red-50"
                                onClick={() => setShowMismatchMessage(true)}
                            >
                                <AlertTriangle className="w-5 h-5 mr-2" />
                                在庫が合っていない
                            </Button>
                        </>
                    ) : (
                        <div className="space-y-3">
                            {/* 不一致メッセージ */}
                            <div className="p-4 bg-red-50 border-2 border-red-400 rounded-xl text-center">
                                <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                                <p className="font-bold text-red-700">
                                    事務所に報告してください
                                </p>
                                <p className="text-sm text-red-600 mt-1">
                                    在庫の差異を事務所スタッフに<br />
                                    お伝えください。
                                </p>
                            </div>
                            <Button
                                className="w-full h-12 bg-slate-800 hover:bg-slate-900 text-white"
                                onClick={onMismatch}
                            >
                                確認しました
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
