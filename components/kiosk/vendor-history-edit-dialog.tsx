"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Minus, Plus, Loader2 } from "lucide-react";
import { createReturnFromHistory } from "@/lib/actions";
import { useCartStore } from "@/lib/store";
import { toast } from "sonner";

interface TransactionItem {
    productId: number;
    name: string;
    code?: string;
    quantity: number;
    price: number;
    unit?: string;
    isBox?: boolean;
    quantityPerBox?: number;
    isManual?: boolean;
}

interface VendorHistoryEditDialogProps {
    transaction: {
        id: number;
        date: Date;
        totalAmount: number;
        items: string; // JSON文字列
    };
    onClose: () => void;
    onComplete: () => void;
}

// 持出時の数量表示
function formatOriginalQuantity(item: TransactionItem): string {
    if (item.isBox && item.quantityPerBox) {
        const totalUnits = item.quantity * item.quantityPerBox;
        if (item.unit === 'm') {
            return `${item.quantity}巻 (${totalUnits}m)`;
        }
        return `${item.quantity}箱 (${totalUnits}${item.unit || '個'})`;
    }
    return `${item.quantity}${item.unit || '個'}`;
}

// 返品可能な最大個数（個数ベース）を計算
function getMaxReturnUnits(item: TransactionItem): number {
    if (item.isBox && item.quantityPerBox) {
        return item.quantity * item.quantityPerBox;
    }
    return item.quantity;
}

// 返品数の表示単位ラベルを取得
function getReturnUnitLabel(item: TransactionItem): string {
    if (item.isBox) {
        return item.unit || '個';
    }
    return item.unit || '個';
}

export function VendorHistoryEditDialog({ transaction, onClose, onComplete }: VendorHistoryEditDialogProps) {
    const items: TransactionItem[] = JSON.parse(transaction.items);
    const vendor = useCartStore((state) => state.vendor);
    const vendorUser = useCartStore((state) => state.vendorUser);

    // 返品数量の管理（個数単位、初期値0）
    const [returnQuantities, setReturnQuantities] = useState<Record<number, number>>(
        Object.fromEntries(items.filter(i => i.quantity > 0).map(i => [i.productId, 0]))
    );
    // 変更理由
    const [reason, setReason] = useState<string>("返品");
    const [loading, setLoading] = useState(false);

    // 返品対象は正の数量のアイテムのみ（手動入力品は除外）
    const returnableItems = items.filter(i => i.quantity > 0 && !i.isManual);

    const updateQuantity = (productId: number, delta: number) => {
        setReturnQuantities(prev => {
            const item = items.find(i => i.productId === productId);
            if (!item) return prev;
            const maxUnits = getMaxReturnUnits(item);
            const current = prev[productId] || 0;
            const newVal = Math.max(0, Math.min(maxUnits, current + delta));
            return { ...prev, [productId]: newVal };
        });
    };

    const hasChanges = Object.values(returnQuantities).some(v => v > 0);

    const handleSubmit = async () => {
        if (!vendor || !hasChanges) return;

        setLoading(true);
        try {
            const returnItems = returnableItems
                .filter(item => (returnQuantities[item.productId] || 0) > 0)
                .map(item => {
                    const returnUnits = returnQuantities[item.productId];
                    // 箱の場合: 返品数は個数単位で送信。サーバー側で在庫復元に使う。
                    // returnQuantityは元の取引の「数量」ベースではなく、個数ベースで送る。
                    // サーバー側では isBox=false として扱い、個数で直接在庫復元する。
                    return {
                        productId: item.productId,
                        returnQuantity: returnUnits,
                        name: item.name,
                        code: item.code,
                        price: item.isBox && item.quantityPerBox
                            ? Math.round(item.price / item.quantityPerBox) // 個あたり単価に変換
                            : item.price,
                        unit: item.isBox ? (item.unit || '個') : item.unit,
                        isBox: false, // 返品は常に個数単位
                        quantityPerBox: undefined,
                    };
                });

            const result = await createReturnFromHistory(
                transaction.id,
                vendor.id,
                vendorUser?.id || null,
                returnItems,
                reason
            );

            if (result.success) {
                toast.success("返品処理が完了しました");
                onComplete();
            } else {
                toast.error(result.message || "返品処理に失敗しました");
            }
        } catch (error) {
            toast.error("エラーが発生しました");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
                {/* ヘッダー */}
                <div className="p-4 border-b">
                    <h2 className="text-lg font-bold text-slate-900">返品処理</h2>
                    <p className="text-sm text-slate-500">
                        持出日: {new Date(transaction.date).toLocaleDateString("ja-JP")}
                    </p>
                </div>

                {/* ⚠️ 返品不可警告 */}
                <div className="mx-4 mt-4 p-3 bg-red-50 border-2 border-red-400 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold text-red-700 text-sm">返品できないもの</p>
                        <p className="text-red-600 text-xs mt-1">
                            ・袋から出したもの<br />
                            ・汚れや傷があるもの<br />
                            ・使用済みのもの
                        </p>
                    </div>
                </div>

                {/* 商品リスト */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {returnableItems.length === 0 ? (
                        <p className="text-center text-slate-500 py-8">返品可能な商品がありません</p>
                    ) : (
                        returnableItems.map((item) => {
                            const returnQty = returnQuantities[item.productId] || 0;
                            const maxUnits = getMaxReturnUnits(item);
                            const unitLabel = getReturnUnitLabel(item);

                            return (
                                <div key={item.productId} className="bg-slate-50 rounded-xl p-3">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="font-medium text-slate-900 text-sm">{item.name}</p>
                                            {item.code && (
                                                <p className="text-xs text-slate-500">{item.code}</p>
                                            )}
                                        </div>
                                        <span className="text-xs text-slate-500">
                                            持出: {formatOriginalQuantity(item)}
                                        </span>
                                    </div>

                                    {/* 返品数量コントロール（個数単位） */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-600">
                                            返品数:
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-9 w-9 rounded-full"
                                                onClick={() => updateQuantity(item.productId, -1)}
                                                disabled={returnQty <= 0}
                                            >
                                                <Minus className="w-4 h-4" />
                                            </Button>
                                            <div className="text-center min-w-[60px]">
                                                <span className={`font-bold text-lg ${returnQty > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
                                                    {returnQty}
                                                </span>
                                                <span className="text-xs text-slate-500 ml-0.5">{unitLabel}</span>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-9 w-9 rounded-full"
                                                onClick={() => updateQuantity(item.productId, 1)}
                                                disabled={returnQty >= maxUnits}
                                            >
                                                <Plus className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    {/* 箱入り商品の場合、返品上限の補足 */}
                                    {item.isBox && item.quantityPerBox && (
                                        <p className="text-xs text-slate-400 text-right mt-1">
                                            最大 {maxUnits}{unitLabel} まで返品可能
                                        </p>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* 理由選択 */}
                {hasChanges && (
                    <div className="px-4 pb-2">
                        <label className="text-sm font-medium text-slate-700 block mb-1">理由</label>
                        <div className="flex gap-2">
                            <Button
                                variant={reason === "返品" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setReason("返品")}
                                className="flex-1"
                            >
                                返品
                            </Button>
                            <Button
                                variant={reason === "入力ミス" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setReason("入力ミス")}
                                className="flex-1"
                            >
                                入力ミス
                            </Button>
                        </div>
                    </div>
                )}

                {/* フッター */}
                <div className="p-4 border-t flex gap-3">
                    <Button
                        variant="outline"
                        className="flex-1 h-12"
                        onClick={onClose}
                        disabled={loading}
                    >
                        閉じる
                    </Button>
                    <Button
                        className="flex-1 h-12 bg-orange-600 hover:bg-orange-700 text-white"
                        onClick={handleSubmit}
                        disabled={!hasChanges || loading}
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            "返品を確定する"
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
