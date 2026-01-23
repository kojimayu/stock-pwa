"use client";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";

// Define Transaction type with vendor
type Transaction = {
    id: number;
    date: Date;
    vendor: { name: string };
    totalAmount: number;
    items: string; // JSON string
};

interface TransactionListProps {
    transactions: Transaction[];
}

export function TransactionList({ transactions }: TransactionListProps) {
    return (
        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[180px]">日時</TableHead>
                        <TableHead>業者名</TableHead>
                        <TableHead>購入内容 (商品名 × 数量 / 単価)</TableHead>
                        <TableHead className="text-right w-[120px]">合計金額</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {transactions.map((tx) => {
                        let parsedItems: any[] = [];
                        try {
                            const raw = JSON.parse(tx.items);
                            // raw might be array or object. Normalize to array.
                            parsedItems = Array.isArray(raw) ? raw : [raw];
                        } catch (e) {
                            console.error("Failed to parse items", e);
                        }

                        // In a real app, we might need to fetch Product Names if not stored in JSON.
                        // Strategy: JSON ideally contains snapshot like { productId, name, price, quantity }.
                        // If only productId, we can't show names easily without pre-fetching products map.
                        // For "Phase 2" MVP, let's assume we show what we have. 
                        // If JSON only has ID, we might display "商品ID: 1".
                        // *Correction*: To make it usable, we shout fetch product names or rely on JSON having them.
                        // Our seed data: { productId: 1, quantity: 2, price: 100 } -> No name.
                        // User will ask for names.
                        // Option A: Fetch all products and map ID to Name in Client Component?
                        // Option B: Store Name in JSON at checkout (Best practice for history).
                        // Since we haven't implemented Checkout yet, we can decide NOW that Checkout WILL save Name.
                        // For Seed Data, we lack names.
                        // For display now, let's show "商品ID: X" and maybe quantity.
                        // Or better, pass a productMap to this component? 
                        // Let's keep it simple: Show formatted JSON content or summary.

                        return (
                            <TableRow key={tx.id}>
                                <TableCell>{formatDate(tx.date)}</TableCell>
                                <TableCell>{tx.vendor.name}</TableCell>
                                <TableCell>
                                    <div className="space-y-1">
                                        {parsedItems.map((item, idx) => (
                                            <div key={idx} className="text-sm">
                                                {item.name || `商品ID:${item.productId}`} × {item.quantity}
                                                <span className="text-slate-400 text-xs ml-2">(@{formatCurrency(item.price)})</span>
                                            </div>
                                        ))}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-medium">{formatCurrency(tx.totalAmount)}</TableCell>
                            </TableRow>
                        );
                    })}
                    {transactions.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center py-10 text-slate-500">
                                取引データがありません
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
