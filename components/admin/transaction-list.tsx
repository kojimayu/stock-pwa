"use client";

import { useState, useEffect } from "react";
import { ProductDialog } from "./product-dialog";
import { ProductSearchDialog } from "./product-search-dialog";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FilePlus, Link as LinkIcon, Loader2 } from "lucide-react";
import { reconcileTransactionItem, getUniqueProductAttributes } from "@/lib/actions";
import { toast } from "sonner";
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
    hasUnregisteredItems?: boolean;
};

interface TransactionListProps {
    transactions: Transaction[];
}

export function TransactionList({ transactions }: TransactionListProps) {
    const [productDialogOpen, setProductDialogOpen] = useState(false);
    const [searchDialogOpen, setSearchDialogOpen] = useState(false);
    const [initialValues, setInitialValues] = useState<{ name?: string, priceA?: number }>({});
    const [targetManualItem, setTargetManualItem] = useState<{ txId: number, name: string } | null>(null);
    const [loading, setLoading] = useState(false);

    // Attributes for Autocomplete
    const [attributeOptions, setAttributeOptions] = useState<{ categories: string[], subCategories: string[], suppliers: string[] } | undefined>(undefined);

    const router = useRouter();

    // Fetch attributes when dialog opens (or on mount to be ready)
    // Optimization: Only fetch when registering manually
    const fetchAttributes = async () => {
        if (!attributeOptions) {
            const attrs = await getUniqueProductAttributes();
            setAttributeOptions(attrs);
        }
    };

    const handleRegister = async (name: string, price: number) => {
        await fetchAttributes();
        setInitialValues({ name, priceA: price });
        setProductDialogOpen(true);
    };

    const handleLinkClick = (txId: number, name: string) => {
        setTargetManualItem({ txId, name });
        setSearchDialogOpen(true);
    };

    const handleLinkSelect = async (productId: number) => {
        if (!targetManualItem) return;
        setLoading(true);
        try {
            const res = await reconcileTransactionItem(targetManualItem.txId, targetManualItem.name, productId);
            if (res.success) {
                toast.success("紐付けが完了しました");
                router.refresh();
            } else {
                toast.error(res.message);
            }
        } catch (e) {
            toast.error("エラーが発生しました");
        } finally {
            setLoading(false);
            setTargetManualItem(null);
        }
    };

    return (
        <div className="border rounded-lg relative">
            {loading && (
                <div className="absolute inset-0 bg-white/50 z-50 flex items-center justify-center">
                    <Loader2 className="animate-spin text-blue-600 w-8 h-8" />
                </div>
            )}
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
                            parsedItems = Array.isArray(raw) ? raw : [raw];
                        } catch (e) {
                            console.error("Failed to parse items", e);
                        }

                        return (
                            <TableRow key={tx.id} className={tx.hasUnregisteredItems ? "bg-yellow-50 hover:bg-yellow-100" : ""}>
                                <TableCell>
                                    {formatDate(tx.date)}
                                    {tx.hasUnregisteredItems && (
                                        <div className="text-xs text-amber-600 font-bold mt-1">手入力あり</div>
                                    )}
                                </TableCell>
                                <TableCell>{tx.vendor.name}</TableCell>
                                <TableCell>
                                    <div className="space-y-1">
                                        {parsedItems.map((item, idx) => (
                                            <div key={idx} className="flex items-center justify-between text-sm">
                                                <span>
                                                    {item.isManual && <span className="text-xs bg-amber-200 text-amber-800 px-1 rounded mr-1">手入力</span>}
                                                    {item.name || `商品ID:${item.productId}`} × {item.quantity}
                                                    <span className="text-slate-400 text-xs ml-2">
                                                        (@{item.isManual ? "-" : formatCurrency(item.price)})
                                                    </span>
                                                </span>
                                                {item.isManual && (
                                                    <div className="flex gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 text-xs text-blue-600 hover:text-blue-800"
                                                            onClick={() => handleRegister(item.name, item.price)}
                                                        >
                                                            <FilePlus className="w-3 h-3 mr-1" />
                                                            マスタ登録
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 text-xs text-green-600 hover:text-green-800"
                                                            onClick={() => handleLinkClick(tx.id, item.name)}
                                                        >
                                                            <LinkIcon className="w-3 h-3 mr-1" />
                                                            既存紐付
                                                        </Button>
                                                    </div>
                                                )}
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

            <ProductDialog
                open={productDialogOpen}
                onOpenChange={setProductDialogOpen}
                initialValues={initialValues}
                attributeOptions={attributeOptions}
                onSuccess={() => {
                    setProductDialogOpen(false);
                    router.refresh();
                }}
            />

            <ProductSearchDialog
                open={searchDialogOpen}
                onOpenChange={setSearchDialogOpen}
                onSelect={handleLinkSelect}
            />
        </div>
    );
}
