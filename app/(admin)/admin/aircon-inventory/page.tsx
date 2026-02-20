"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Package, ClipboardCheck, X, History, Truck, Building2, User, Save } from "lucide-react";
import { toast } from "sonner";
import {
    getAirconStockWithVendorBreakdown,
    createAirconInventory,
    getActiveAirconInventory,
    updateAirconInventoryItem,
    completeAirconInventory,
    cancelAirconInventory,
    getAirconInventoryHistory,
    updateAirconProductSuffix,
} from "@/lib/aircon-actions";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

type VendorStockBreakdown = {
    id: number;
    name: string;
    count: number;
};

type AirconProduct = {
    id: number;
    code: string;
    name: string;
    capacity: string;
    suffix: string;
    stock: number;
    vendorStock: number;
    totalStock: number;
    minStock: number;
    vendorBreakdown: VendorStockBreakdown[];
};

// 棚卸アイテムの型
type InventoryItem = {
    id: number;
    inventoryId: number;
    productId: number;
    expectedStock: number;
    actualStock: number;
    adjustment: number;
    product: {
        id: number;
        code: string;
        name: string;
        capacity: string;
    };
};

// 棚卸セッションの型
type InventorySession = {
    id: number;
    status: string;
    startedAt: string;
    endedAt: string | null;
    note: string | null;
    confirmedBy: string | null;
    items: InventoryItem[];
};

export default function AirconInventoryPage() {
    const [products, setProducts] = useState<AirconProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingSuffix, setEditingSuffix] = useState<Record<number, string>>({});

    // 棚卸関連State
    const [activeInventory, setActiveInventory] = useState<InventorySession | null>(null);
    const [inventoryHistory, setInventoryHistory] = useState<InventorySession[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [inventoryNote, setInventoryNote] = useState("");
    const [confirmedBy, setConfirmedBy] = useState("");
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [actualStocks, setActualStocks] = useState<Record<number, number>>({});

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [prods, active, history] = await Promise.all([
                getAirconStockWithVendorBreakdown(),
                getActiveAirconInventory(),
                getAirconInventoryHistory(),
            ]);
            setProducts(prods);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setActiveInventory(active as any);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setInventoryHistory(history as any);

            // 初期サフィックス値をセット
            const suffixMap: Record<number, string> = {};
            prods.forEach((p: AirconProduct) => {
                suffixMap[p.id] = p.suffix || "N";
            });
            setEditingSuffix(suffixMap);

            // 進行中の棚卸がある場合、実数入力値をセット
            if (active) {
                const stocks: Record<number, number> = {};
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (active as any).items.forEach((item: InventoryItem) => {
                    stocks[item.id] = item.actualStock;
                });
                setActualStocks(stocks);
            }
        } catch (e) {
            toast.error("データ取得に失敗しました");
        } finally {
            setLoading(false);
        }
    };

    // 棚卸開始
    const handleStartInventory = async () => {
        const result = await createAirconInventory(inventoryNote || undefined);
        if (result.success) {
            toast.success("棚卸を開始しました");
            setInventoryNote("");
            fetchData();
        } else {
            toast.error(result.message);
        }
    };

    // 実数更新
    const handleUpdateActual = async (itemId: number, actualStock: number) => {
        const result = await updateAirconInventoryItem(itemId, actualStock);
        if (result.success) {
            // ローカルstateも更新
            if (activeInventory) {
                setActiveInventory({
                    ...activeInventory,
                    items: activeInventory.items.map((item) =>
                        item.id === itemId
                            ? { ...item, actualStock, adjustment: actualStock - item.expectedStock }
                            : item
                    ),
                });
            }
        } else {
            toast.error(result.message || "更新に失敗しました");
        }
    };

    // 棚卸確定
    const handleComplete = async () => {
        if (!activeInventory) return;
        if (!confirmedBy.trim()) {
            toast.error("確認者名を入力してください");
            return;
        }
        const result = await completeAirconInventory(activeInventory.id, confirmedBy.trim());
        if (result.success) {
            toast.success("棚卸を確定しました。在庫が更新されました。");
            setConfirmDialogOpen(false);
            setConfirmedBy("");
            fetchData();
        } else {
            toast.error(result.message || "確定に失敗しました");
        }
    };

    // 棚卸中止
    const handleCancel = async () => {
        if (!activeInventory) return;
        if (!confirm("棚卸を中止しますか？\n入力した実数は破棄されます。在庫は変更されません。")) return;
        const result = await cancelAirconInventory(activeInventory.id);
        if (result.success) {
            toast.success("棚卸を中止しました");
            fetchData();
        } else {
            toast.error(result.message || "中止に失敗しました");
        }
    };

    // サフィックス保存
    const handleSaveSuffix = async (productId: number) => {
        const suffix = editingSuffix[productId];
        if (!suffix?.trim()) {
            toast.error("サフィックスを入力してください");
            return;
        }
        const result = await updateAirconProductSuffix(productId, suffix.trim().toUpperCase());
        if (result.success) {
            toast.success("サフィックスを更新しました");
            fetchData();
        } else {
            toast.error("更新に失敗しました");
        }
    };

    // 統計計算
    const totalWarehouseStock = products.reduce((acc, p) => acc + p.stock, 0);
    const totalVendorStock = products.reduce((acc, p) => acc + p.vendorStock, 0);
    const grandTotalStock = totalWarehouseStock + totalVendorStock;
    const lowStockCount = products.filter((p) => p.totalStock <= p.minStock).length;

    // 棚卸差異の集計
    const inventoryDiffs = activeInventory
        ? activeInventory.items.reduce(
            (acc, item) => {
                const adj = (actualStocks[item.id] ?? item.actualStock) - item.expectedStock;
                if (adj > 0) acc.plus += adj;
                if (adj < 0) acc.minus += adj;
                if (adj !== 0) acc.count++;
                return acc;
            },
            { plus: 0, minus: 0, count: 0 }
        )
        : null;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">エアコン在庫管理</h2>
                <p className="text-muted-foreground">
                    ベースコード(RAS-AJ22等)で在庫管理、サフィックスは発注時のみ使用
                </p>
            </div>

            {/* 統計カード */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card className="bg-slate-50 border-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">総資産台数</CardTitle>
                        <Package className="h-4 w-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{grandTotalStock} 台</div>
                        <p className="text-xs text-muted-foreground">倉庫 + 業者持出</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">倉庫在庫</CardTitle>
                        <Building2 className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalWarehouseStock} 台</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">業者持出中</CardTitle>
                        <Truck className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalVendorStock} 台</div>
                    </CardContent>
                </Card>
                {lowStockCount > 0 && (
                    <Card className="border-amber-300 bg-amber-50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-amber-700">
                                在庫アラート
                            </CardTitle>
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-amber-700">
                                {lowStockCount} 機種
                            </div>
                            <p className="text-xs text-amber-600">最低在庫数以下</p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* 棚卸セクション */}
            {activeInventory ? (
                // 棚卸進行中
                <Card className="border-blue-300 bg-blue-50/50">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <ClipboardCheck className="h-6 w-6 text-blue-600" />
                                <div>
                                    <CardTitle className="text-blue-800">棚卸 進行中</CardTitle>
                                    <p className="text-sm text-blue-600 mt-1">
                                        開始: {format(new Date(activeInventory.startedAt), "yyyy/MM/dd HH:mm", { locale: ja })}
                                        {activeInventory.note && ` — ${activeInventory.note}`}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCancel}
                                    className="border-red-300 text-red-600 hover:bg-red-50"
                                >
                                    <X className="h-4 w-4 mr-1" /> 中止
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => setConfirmDialogOpen(true)}
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    <ClipboardCheck className="h-4 w-4 mr-1" /> 確定
                                </Button>
                            </div>
                        </div>
                        {inventoryDiffs && inventoryDiffs.count > 0 && (
                            <div className="flex gap-4 mt-3 text-sm">
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                    差異あり: {inventoryDiffs.count}件
                                </Badge>
                                {inventoryDiffs.plus > 0 && (
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                        過剰: +{inventoryDiffs.plus}
                                    </Badge>
                                )}
                                {inventoryDiffs.minus < 0 && (
                                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                        不足: {inventoryDiffs.minus}
                                    </Badge>
                                )}
                            </div>
                        )}
                    </CardHeader>
                </Card>
            ) : (
                // 棚卸開始ボタン
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <ClipboardCheck className="h-5 w-5" />
                                棚卸
                            </CardTitle>
                            <div className="flex items-center gap-2">
                                <Input
                                    placeholder="メモ（任意）"
                                    value={inventoryNote}
                                    onChange={(e) => setInventoryNote(e.target.value)}
                                    className="w-48"
                                />
                                <Button onClick={handleStartInventory}>
                                    <ClipboardCheck className="h-4 w-4 mr-1" /> 棚卸開始
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setShowHistory(!showHistory)}
                                >
                                    <History className="h-4 w-4 mr-1" /> 履歴
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                </Card>
            )}

            {/* 在庫テーブル */}
            <Card>
                <CardHeader>
                    <CardTitle>在庫一覧</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">読み込み中...</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ベースコード</TableHead>
                                    <TableHead>名称</TableHead>
                                    <TableHead>容量</TableHead>
                                    <TableHead className="text-center bg-blue-50/50">倉庫在庫</TableHead>
                                    <TableHead className="text-center bg-orange-50/50">業者持出</TableHead>
                                    <TableHead className="text-center bg-slate-50/50 font-bold">総在庫</TableHead>
                                    <TableHead className="text-center">発注サフィックス</TableHead>
                                    {activeInventory && (
                                        <>
                                            <TableHead className="text-center bg-green-50/50">実数</TableHead>
                                            <TableHead className="text-center bg-yellow-50/50">差異</TableHead>
                                        </>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {products.map((product) => {
                                    const isLowStock = product.totalStock <= product.minStock;
                                    const currentSuffix = editingSuffix[product.id] || "";
                                    const suffixChanged = currentSuffix !== product.suffix;

                                    // 棚卸アイテムを探す
                                    const invItem = activeInventory?.items.find(
                                        (item) => item.productId === product.id
                                    );
                                    const actualVal = invItem ? (actualStocks[invItem.id] ?? invItem.actualStock) : null;
                                    const diff = invItem ? (actualVal! - invItem.expectedStock) : null;

                                    return (
                                        <TableRow
                                            key={product.id}
                                            className={
                                                activeInventory && diff !== null && diff !== 0
                                                    ? diff > 0
                                                        ? "bg-green-50"
                                                        : "bg-red-50"
                                                    : isLowStock
                                                        ? "bg-amber-50"
                                                        : ""
                                            }
                                        >
                                            <TableCell className="font-mono font-medium">
                                                {product.code}
                                                {isLowStock && (
                                                    <AlertTriangle className="inline w-4 h-4 ml-2 text-amber-500" />
                                                )}
                                            </TableCell>
                                            <TableCell>{product.name}</TableCell>
                                            <TableCell>{product.capacity}</TableCell>
                                            <TableCell className="text-center bg-blue-50/30">
                                                <span className="font-bold text-lg text-blue-700">
                                                    {product.stock}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center bg-orange-50/30">
                                                {product.vendorStock > 0 ? (
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button variant="ghost" className="h-8 hover:bg-orange-100 text-orange-700 font-bold text-lg underline decoration-dashed underline-offset-4">
                                                                {product.vendorStock}
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-64 p-3">
                                                            <div className="space-y-2">
                                                                <h4 className="font-medium text-sm border-b pb-1 mb-2">保有業者内訳</h4>
                                                                {product.vendorBreakdown.map((v) => (
                                                                    <div key={v.id} className="flex justify-between items-center text-sm">
                                                                        <span className="truncate max-w-[150px]">{v.name}</span>
                                                                        <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                                                                            {v.count}台
                                                                        </Badge>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center bg-slate-50/30">
                                                <span className="font-bold text-lg text-slate-900">
                                                    {product.totalStock}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center justify-center gap-1">
                                                    <Input
                                                        value={currentSuffix}
                                                        onChange={(e) =>
                                                            setEditingSuffix({
                                                                ...editingSuffix,
                                                                [product.id]: e.target.value.toUpperCase(),
                                                            })
                                                        }
                                                        className="w-20 text-center font-mono"
                                                        maxLength={5}
                                                    />
                                                    {suffixChanged && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => handleSaveSuffix(product.id)}
                                                        >
                                                            <Save className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                            {activeInventory && invItem && (
                                                <>
                                                    <TableCell className="text-center bg-green-50/30">
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            className="w-20 mx-auto text-center font-bold text-lg"
                                                            value={actualStocks[invItem.id] ?? invItem.actualStock}
                                                            onChange={(e) => {
                                                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                                                setActualStocks({ ...actualStocks, [invItem.id]: val });
                                                            }}
                                                            onBlur={() => {
                                                                const val = actualStocks[invItem.id];
                                                                if (val !== undefined && val !== invItem.actualStock) {
                                                                    handleUpdateActual(invItem.id, val);
                                                                }
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-center bg-yellow-50/30">
                                                        {diff !== null && diff !== 0 ? (
                                                            <span
                                                                className={`font-bold text-lg ${diff > 0 ? "text-green-600" : "text-red-600"
                                                                    }`}
                                                            >
                                                                {diff > 0 ? `+${diff}` : diff}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400">±0</span>
                                                        )}
                                                    </TableCell>
                                                </>
                                            )}
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* 棚卸履歴 */}
            {showHistory && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <History className="h-5 w-5" />
                            棚卸履歴
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {inventoryHistory.length === 0 ? (
                            <p className="text-center py-4 text-muted-foreground">棚卸履歴がありません</p>
                        ) : (
                            <div className="space-y-3">
                                {inventoryHistory.map((inv) => (
                                    <Accordion key={inv.id} type="single" collapsible>
                                        <AccordionItem value={`inv-${inv.id}`} className="border rounded-lg px-4">
                                            <AccordionTrigger className="py-3">
                                                <div className="flex items-center gap-3 text-left">
                                                    <Badge
                                                        variant={inv.status === "COMPLETED" ? "default" : "secondary"}
                                                        className={
                                                            inv.status === "COMPLETED"
                                                                ? "bg-green-100 text-green-800 hover:bg-green-100"
                                                                : inv.status === "CANCELLED"
                                                                    ? "bg-red-100 text-red-800 hover:bg-red-100"
                                                                    : "bg-blue-100 text-blue-800 hover:bg-blue-100"
                                                        }
                                                    >
                                                        {inv.status === "COMPLETED" ? "完了" : inv.status === "CANCELLED" ? "中止" : "進行中"}
                                                    </Badge>
                                                    <span className="text-sm">
                                                        {format(new Date(inv.startedAt), "yyyy/MM/dd HH:mm", { locale: ja })}
                                                        {inv.endedAt && ` → ${format(new Date(inv.endedAt), "HH:mm", { locale: ja })}`}
                                                    </span>
                                                    {inv.confirmedBy && (
                                                        <span className="text-sm text-slate-500 flex items-center gap-1">
                                                            <User className="h-3 w-3" /> {inv.confirmedBy}
                                                        </span>
                                                    )}
                                                    {inv.note && (
                                                        <span className="text-sm text-slate-400">— {inv.note}</span>
                                                    )}
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>コード</TableHead>
                                                            <TableHead>名称</TableHead>
                                                            <TableHead className="text-center">システム</TableHead>
                                                            <TableHead className="text-center">実数</TableHead>
                                                            <TableHead className="text-center">差異</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {inv.items.map((item) => (
                                                            <TableRow
                                                                key={item.id}
                                                                className={
                                                                    item.adjustment !== 0
                                                                        ? item.adjustment > 0
                                                                            ? "bg-green-50"
                                                                            : "bg-red-50"
                                                                        : ""
                                                                }
                                                            >
                                                                <TableCell className="font-mono">{item.product.code}</TableCell>
                                                                <TableCell>{item.product.name}</TableCell>
                                                                <TableCell className="text-center">{item.expectedStock}</TableCell>
                                                                <TableCell className="text-center font-bold">{item.actualStock}</TableCell>
                                                                <TableCell className="text-center">
                                                                    {item.adjustment !== 0 ? (
                                                                        <span className={`font-bold ${item.adjustment > 0 ? "text-green-600" : "text-red-600"}`}>
                                                                            {item.adjustment > 0 ? `+${item.adjustment}` : item.adjustment}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-slate-400">±0</span>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </AccordionContent>
                                        </AccordionItem>
                                    </Accordion>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* 棚卸確定 確認ダイアログ */}
            <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>棚卸の確定</DialogTitle>
                        <DialogDescription>
                            以下の差異でシステム在庫を更新します。この操作は取り消せません。
                        </DialogDescription>
                    </DialogHeader>

                    {/* 差異サマリー */}
                    {activeInventory && (
                        <div className="space-y-3">
                            <div className="bg-slate-50 rounded p-3 space-y-1 max-h-48 overflow-y-auto">
                                {activeInventory.items
                                    .filter((item) => {
                                        const actual = actualStocks[item.id] ?? item.actualStock;
                                        return actual !== item.expectedStock;
                                    })
                                    .map((item) => {
                                        const actual = actualStocks[item.id] ?? item.actualStock;
                                        const adj = actual - item.expectedStock;
                                        return (
                                            <div key={item.id} className="flex justify-between items-center text-sm">
                                                <span className="font-mono">{item.product.code}</span>
                                                <span>
                                                    {item.expectedStock} → {actual}（
                                                    <span className={adj > 0 ? "text-green-600" : "text-red-600"}>
                                                        {adj > 0 ? `+${adj}` : adj}
                                                    </span>
                                                    ）
                                                </span>
                                            </div>
                                        );
                                    })}
                                {activeInventory.items.every((item) => {
                                    const actual = actualStocks[item.id] ?? item.actualStock;
                                    return actual === item.expectedStock;
                                }) && (
                                        <p className="text-center text-slate-500">差異なし</p>
                                    )}
                            </div>

                            {/* 確認者入力 */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-1">
                                    <User className="h-4 w-4" /> 確認者
                                </label>
                                <Input
                                    placeholder="確認者名を入力"
                                    value={confirmedBy}
                                    onChange={(e) => setConfirmedBy(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
                            戻る
                        </Button>
                        <Button
                            onClick={handleComplete}
                            className="bg-blue-600 hover:bg-blue-700"
                            disabled={!confirmedBy.trim()}
                        >
                            <ClipboardCheck className="h-4 w-4 mr-1" /> 確定する
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
