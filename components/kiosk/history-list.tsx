"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Clock } from "lucide-react";

interface Transaction {
    id: number;
    date: Date;
    totalAmount: number;
    items: string; // JSON string
}

interface VendorHistoryListProps {
    transactions: Transaction[];
}

export function VendorHistoryList({ transactions }: VendorHistoryListProps) {
    if (transactions.length === 0) {
        return (
            <div className="text-center py-20 text-slate-500">
                履歴はありません
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {transactions.map((tx) => {
                const items = JSON.parse(tx.items) as { name: string; quantity: number }[];
                return (
                    <Card key={tx.id} className="shadow-sm border-slate-200">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center text-slate-500 text-sm">
                                    <Clock className="w-4 h-4 mr-1" />
                                    {formatDate(tx.date)}
                                </div>
                                {/* 金額は非表示という要件だが、履歴では合計点数を出すのが良さそう */}
                                <div className="font-bold text-slate-700">
                                    計 {items.reduce((acc, i) => acc + i.quantity, 0)} 点
                                </div>
                            </div>

                            <div className="space-y-1 bg-slate-50 p-2 rounded text-sm text-slate-800">
                                {items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between">
                                        <span>{item.name}</span>
                                        <span className="font-medium">x {item.quantity}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
