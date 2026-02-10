"use client";

import { useState, useMemo } from "react";
import { ProductDialog } from "./product-dialog";
import { ProductSearchDialog } from "./product-search-dialog";
import { TransactionReturnDialog } from "./transaction-return-dialog";
import { PriceCorrectionDialog } from "./price-correction-dialog";
import { TransactionEditDialog } from "./transaction-edit-dialog";
import { TransactionHistoryDialog } from "./transaction-history-dialog";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilePlus, Link as LinkIcon, Loader2, Search, X, Download, Undo2, Edit2, History } from "lucide-react";
import { reconcileTransactionItem, getUniqueProductAttributes, returnTransaction } from "@/lib/actions";
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
    vendor: { id: number; name: string };
    vendorUser?: { name: string } | null;
    totalAmount: number;
    items: string; // JSON string
    hasUnregisteredItems?: boolean;
    isReturned?: boolean;
    isProxyInput?: boolean;
    lastModifiedAt?: Date | null;
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

    // Return Dialog
    const [returnDialogOpen, setReturnDialogOpen] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

    // Price Correction Dialog
    const [priceDialogOpen, setPriceDialogOpen] = useState(false);
    const [priceEditTarget, setPriceEditTarget] = useState<{
        txId: number;
        itemIndex: number;
        itemName: string;
        currentPrice: number;
    } | null>(null);

    // Edit Transaction Dialog
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editTargetTx, setEditTargetTx] = useState<Transaction | null>(null);

    // History Dialog
    const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
    const [historyTargetId, setHistoryTargetId] = useState<number | null>(null);

    // 検索フィルター
    const [vendorFilter, setVendorFilter] = useState("");
    const [dateFromFilter, setDateFromFilter] = useState("");
    const [dateToFilter, setDateToFilter] = useState("");
    const [textFilter, setTextFilter] = useState("");

    // Attributes for Autocomplete
    const [attributeOptions, setAttributeOptions] = useState<{ categories: string[], subCategories: string[], suppliers: string[] } | undefined>(undefined);

    const router = useRouter();

    // フィルタリング
    const filteredTransactions = useMemo(() => {
        return transactions.filter((tx) => {
            // 業者名フィルター
            if (vendorFilter && !tx.vendor.name.toLowerCase().includes(vendorFilter.toLowerCase())) {
                return false;
            }

            // 日付フィルター (From)
            if (dateFromFilter) {
                const from = new Date(dateFromFilter);
                if (new Date(tx.date) < from) return false;
            }

            // 日付フィルター (To)
            if (dateToFilter) {
                const to = new Date(dateToFilter);
                to.setHours(23, 59, 59, 999);
                if (new Date(tx.date) > to) return false;
            }

            // テキスト検索（商品名）
            if (textFilter) {
                let items: any[] = [];
                try {
                    items = JSON.parse(tx.items);
                } catch { }
                const hasMatch = items.some((item: any) =>
                    item.name?.toLowerCase().includes(textFilter.toLowerCase())
                );
                if (!hasMatch && !tx.vendor.name.toLowerCase().includes(textFilter.toLowerCase())) {
                    return false;
                }
            }

            return true;
        });
    }, [transactions, vendorFilter, dateFromFilter, dateToFilter, textFilter]);

    const clearFilters = () => {
        setVendorFilter("");
        setDateFromFilter("");
        setDateToFilter("");
        setTextFilter("");
    };

    const hasActiveFilters = vendorFilter || dateFromFilter || dateToFilter || textFilter;

    // CSVエクスポート
    const exportCsv = () => {
        const headers = ["取引ID", "日時", "業者コード", "業者名", "担当者", "商品コード", "商品名", "数量", "単価", "小計", "取引合計", "ステータス", "代理入力"];
        const rows: string[][] = [];

        filteredTransactions.forEach((tx) => {
            let items: any[] = [];
            try {
                items = JSON.parse(tx.items);
            } catch { }

            items.forEach((item, idx) => {
                rows.push([
                    String(tx.id),
                    formatDate(tx.date),
                    String(tx.vendor.id),
                    tx.vendor.name,
                    tx.vendorUser?.name || "",
                    item.code || `ID:${item.productId}`, // add code
                    item.name,
                    String(item.quantity),
                    item.isManual ? "-" : String(item.price),
                    item.isManual ? "0" : String(item.price * item.quantity),
                    idx === 0 ? String(tx.totalAmount) : "", // Total amount only on first line? Or repeat? User asked for 1 record per line, usually total is redundant on line items or repeated. Let's repeat it or keep distinct column. If flat data, maybe we don't need "Total Transaction Amount" on every line if we have subtotal. But let's keep it for reference.
                    tx.isReturned ? "返品済" : "正常",
                    tx.isProxyInput ? "○" : ""
                ]);
            });
        });

        const csvContent = [headers, ...rows]
            .map((row) => row.map((cell) => `"${cell}"`).join(","))
            .join("\n");

        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `transactions_${new Date().toISOString().split("T")[0]}.csv`;
        link.click();
    };

    // Fetch attributes when dialog opens
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

    const handleReturnClick = (tx: Transaction) => {
        setSelectedTransaction(tx);
        setReturnDialogOpen(true);
    };

    const handleEditClick = (tx: Transaction) => {
        setEditTargetTx(tx);
        setEditDialogOpen(true);
    };

    return (
        <div className="space-y-4">
            {/* 検索フィルター */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Search className="w-5 h-5" />
                        検索フィルター
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                        <div>
                            <label className="text-sm font-medium mb-1 block">キーワード</label>
                            <Input
                                placeholder="商品名・業者名..."
                                value={textFilter}
                                onChange={(e) => setTextFilter(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">業者名</label>
                            <Input
                                placeholder="業者名で絞込..."
                                value={vendorFilter}
                                onChange={(e) => setVendorFilter(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">開始日</label>
                            <Input
                                type="date"
                                value={dateFromFilter}
                                onChange={(e) => setDateFromFilter(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">終了日</label>
                            <Input
                                type="date"
                                value={dateToFilter}
                                onChange={(e) => setDateToFilter(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            {hasActiveFilters && (
                                <Button variant="ghost" size="sm" onClick={clearFilters}>
                                    <X className="w-4 h-4 mr-1" />
                                    クリア
                                </Button>
                            )}
                            <Button variant="outline" size="sm" onClick={exportCsv}>
                                <Download className="w-4 h-4 mr-1" />
                                CSV
                            </Button>
                        </div>
                    </div>
                    {hasActiveFilters && (
                        <p className="text-sm text-muted-foreground mt-2">
                            {filteredTransactions.length}件 / 全{transactions.length}件
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* 取引テーブル */}
            <div className="border rounded-lg relative bg-white">
                {loading && (
                    <div className="absolute inset-0 bg-white/50 z-50 flex items-center justify-center">
                        <Loader2 className="animate-spin text-blue-600 w-8 h-8" />
                    </div>
                )}
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[180px]">日時</TableHead>
                            <TableHead className="w-[150px]">業者名</TableHead>
                            <TableHead className="w-[120px]">担当者</TableHead>
                            <TableHead>購入内容 (商品名 × 数量 / 単価)</TableHead>
                            <TableHead className="text-right w-[120px]">合計金額</TableHead>
                            <TableHead className="w-[80px] text-center">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredTransactions.map((tx) => {
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
                                        {tx.isProxyInput && (
                                            <div className="text-xs bg-purple-100 text-purple-700 font-bold mt-1 inline-block px-1.5 rounded mr-1">代理入力</div>
                                        )}
                                        {tx.lastModifiedAt && !tx.isReturned && (
                                            <div className="text-xs bg-blue-100 text-blue-700 font-bold mt-1 inline-block px-1.5 rounded mr-1" title={`修正: ${formatDate(tx.lastModifiedAt)}`}>修正済</div>
                                        )}
                                        {tx.hasUnregisteredItems && (
                                            <div className="text-xs text-amber-600 font-bold mt-1">手入力あり</div>
                                        )}
                                    </TableCell>
                                    <TableCell className="font-medium">{tx.vendor.name}</TableCell>
                                    <TableCell>{tx.vendorUser?.name || "-"}</TableCell>
                                    <TableCell>
                                        <div className="space-y-1">
                                            {parsedItems.map((item, idx) => (
                                                <div key={idx} className="flex items-center justify-between text-sm">
                                                    <span>
                                                        {tx.isProxyInput && <span className="text-xs bg-purple-100 text-purple-700 px-1 rounded mr-1">代</span>}
                                                        {item.isManual && <span className="text-xs bg-amber-200 text-amber-800 px-1 rounded mr-1">手入力</span>}
                                                        {item.code && <span className="font-mono text-xs text-slate-500 mr-1">[{item.code}]</span>}
                                                        {item.name || `商品ID:${item.productId}`} × {item.quantity}
                                                        <span className="text-slate-400 text-xs ml-2">
                                                            (@{item.isManual ? "-" : formatCurrency(item.price)})
                                                        </span>
                                                        {!item.isManual && !tx.isReturned && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-5 w-5 p-0 ml-1 text-slate-400 hover:text-blue-600"
                                                                onClick={() => {
                                                                    setPriceEditTarget({
                                                                        txId: tx.id,
                                                                        itemIndex: idx,
                                                                        itemName: item.name,
                                                                        currentPrice: item.price
                                                                    });
                                                                    setPriceDialogOpen(true);
                                                                }}
                                                                title="価格修正"
                                                            >
                                                                <Edit2 className="w-3 h-3" />
                                                            </Button>
                                                        )}
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
                                    <TableCell className="text-right font-medium">
                                        {formatCurrency(tx.totalAmount)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex justify-center items-center gap-1">
                                            {!tx.isReturned && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                    onClick={() => handleEditClick(tx)}
                                                    title="取引内容を修正"
                                                >
                                                    <Edit2 className="w-4 h-4 text-slate-500 hover:text-blue-600" />
                                                </Button>
                                            )}
                                            {tx.isReturned ? (
                                                <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded font-bold whitespace-nowrap">
                                                    戻し済
                                                </span>
                                            ) : (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                    onClick={() => handleReturnClick(tx)}
                                                    title="在庫に戻す"
                                                >
                                                    <Undo2 className="w-4 h-4 text-slate-500 hover:text-red-600" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {filteredTransactions.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-10 text-slate-500">
                                    {hasActiveFilters ? "検索条件に一致する取引がありません" : "取引データがありません"}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

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

            <TransactionReturnDialog
                open={returnDialogOpen}
                onOpenChange={setReturnDialogOpen}
                transaction={selectedTransaction}
            />

            {priceEditTarget && (
                <PriceCorrectionDialog
                    open={priceDialogOpen}
                    onOpenChange={(open) => {
                        setPriceDialogOpen(open);
                        if (!open) setPriceEditTarget(null);
                    }}
                    transactionId={priceEditTarget.txId}
                    itemIndex={priceEditTarget.itemIndex}
                    itemName={priceEditTarget.itemName}
                    currentPrice={priceEditTarget.currentPrice}
                />
            )}

            <TransactionEditDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                transaction={editTargetTx}
                onSuccess={() => {
                    router.refresh();
                }}
            />

            <TransactionHistoryDialog
                open={historyDialogOpen}
                onOpenChange={setHistoryDialogOpen}
                transactionId={historyTargetId}
            />
        </div>
    );
}
