"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { Clock, Pencil } from "lucide-react";
import { VendorHistoryEditDialog } from "./vendor-history-edit-dialog";

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

interface Transaction {
    id: number;
    date: Date;
    totalAmount: number;
    items: string; // JSON文字列
}

interface VendorHistoryListProps {
    transactions: Transaction[];
    onRefresh?: () => void;
}

// 数量表示の統一フォーマット
function formatItemQuantity(item: TransactionItem): string {
    const qty = Math.abs(item.quantity);
    if (item.isBox) {
        if (item.unit === 'm') {
            return `${qty}巻 (${qty * (item.quantityPerBox || 1)}m)`;
        }
        return `${qty}箱 (${qty * (item.quantityPerBox || 1)}${item.unit || '個'})`;
    }
    return `${qty}${item.unit || '個'}`;
}

export function VendorHistoryList({ transactions, onRefresh }: VendorHistoryListProps) {
    const [editingTx, setEditingTx] = useState<Transaction | null>(null);

    if (transactions.length === 0) {
        return (
            <div className="text-center py-20 text-slate-500">
                履歴はありません
            </div>
        );
    }

    const handleEditComplete = () => {
        setEditingTx(null);
        onRefresh?.();
    };

    return (
        <>
            <div className="space-y-4">
                {transactions.map((tx) => {
                    const items: TransactionItem[] = JSON.parse(tx.items);
                    const isReturn = items.some(i => i.quantity < 0);

                    return (
                        <Card key={tx.id} className={`shadow-sm ${isReturn ? 'border-orange-300 bg-orange-50/30' : 'border-slate-200'}`}>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center text-slate-500 text-sm">
                                            <Clock className="w-4 h-4 mr-1" />
                                            {formatDate(tx.date)}
                                        </div>
                                        {isReturn && (
                                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                                                返品
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-700 text-sm">
                                            計 {items.reduce((acc, i) => acc + Math.abs(i.quantity), 0)} 点
                                        </span>
                                        {/* 返品済み取引（マイナス）は編集不可 */}
                                        {!isReturn && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 px-2 text-slate-500 hover:text-orange-600"
                                                onClick={() => setEditingTx(tx)}
                                            >
                                                <Pencil className="w-4 h-4 mr-1" />
                                                修正
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1 bg-slate-50 p-2 rounded text-sm text-slate-800">
                                    {items.map((item, idx) => (
                                        <div key={idx} className="flex justify-between">
                                            <span className={item.quantity < 0 ? 'text-orange-600' : ''}>
                                                {item.quantity < 0 ? '↩ ' : ''}{item.name}
                                            </span>
                                            <span className={`font-medium ${item.quantity < 0 ? 'text-orange-600' : ''}`}>
                                                {item.quantity < 0 ? '-' : ''}{formatItemQuantity(item)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* 履歴編集ダイアログ */}
            {editingTx && (
                <VendorHistoryEditDialog
                    transaction={editingTx}
                    onClose={() => setEditingTx(null)}
                    onComplete={handleEditComplete}
                />
            )}
        </>
    );
}

