"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
import { AlertTriangle, Package, ClipboardCheck, X, History, Truck, Building2, User, Save, WifiOff, Minus, Plus, CircleCheck, Circle } from "lucide-react";
import { toast } from "sonner";
import { useOnlineStatus } from "@/hooks/use-online-status";
import {
    getAirconStockWithVendorBreakdown,
    createAirconInventory,
    getActiveAirconInventory,
    updateAirconInventoryItem,
    completeAirconInventory,
    cancelAirconInventory,
    getAirconInventoryHistory,
    updateAirconProductSuffix,
    checkAirconInventoryItem,
    uncheckAirconInventoryItem,
} from "@/lib/aircon-actions";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
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

type VendorStockBreakdown = {
    id: number;
    name: string;
    count: number;
    set: number;
    indoor: number;
    outdoor: number;
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
    typeBreakdown: { set: number; indoor: number; outdoor: number };
};

// 棚卸アイテムの型
type InventoryItem = {
    id: number;
    inventoryId: number;
    productId: number;
    expectedStock: number;
    actualStock: number;
    adjustment: number;
    reason: string | null;
    checkedBy: string | null;
    checkedAt: string | null;
    product: {
        id: number;
        code: string;
        name: string;
        capacity: string;
    };
};

// オフラインキュー用の型
type PendingUpdate = {
    itemId: number;
    actualStock: number;
    reason?: string | null;
    timestamp: number;
};

const PENDING_QUEUE_KEY = 'aircon_inventory_pending_updates';

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
    const [reasons, setReasons] = useState<Record<number, string>>({});

    // 管理者名
    const [adminName, setAdminName] = useState("管理者");

    // オフラインキュー
    const isOnline = useOnlineStatus();
    const [pendingUpdates, setPendingUpdates] = useState<PendingUpdate[]>([]);
    const retryingRef = useRef(false);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // localStorageからpendingUpdatesを復元
    useEffect(() => {
        try {
            const saved = localStorage.getItem(PENDING_QUEUE_KEY);
            if (saved) {
                setPendingUpdates(JSON.parse(saved));
            }
        } catch { /* ignore */ }
    }, []);

    // pendingUpdatesをlocalStorageに保存
    useEffect(() => {
        if (pendingUpdates.length > 0) {
            localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(pendingUpdates));
        } else {
            localStorage.removeItem(PENDING_QUEUE_KEY);
        }
    }, [pendingUpdates]);

    // オンライン復帰時に自動リトライ
    useEffect(() => {
        if (isOnline && pendingUpdates.length > 0 && !retryingRef.current) {
            retryPendingUpdates();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOnline, pendingUpdates.length]);

    const retryPendingUpdates = useCallback(async () => {
        if (retryingRef.current || pendingUpdates.length === 0) return;
        retryingRef.current = true;
        const queue = [...pendingUpdates];
        const failed: PendingUpdate[] = [];

        for (const update of queue) {
            try {
                const result = await updateAirconInventoryItem(update.itemId, update.actualStock, update.reason);
                if (!result.success) {
                    failed.push(update);
                }
            } catch {
                failed.push(update);
            }
        }

        setPendingUpdates(failed);
        if (failed.length === 0) {
            toast.success('未送信データをすべて送信しました');
        } else {
            toast.warning(`${failed.length}件の送信に失敗しました。再度リトライします。`);
        }
        retryingRef.current = false;
    }, [pendingUpdates]);

    // 管理者名をlocalStorageから取得
    useEffect(() => {
        const name = localStorage.getItem('adminName');
        if (name) setAdminName(name);
        else {
            const email = localStorage.getItem('adminEmail');
            if (email) setAdminName(email);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, []);

    // 5秒ポーリング（棚卸進行中のみ）
    useEffect(() => {
        if (activeInventory?.status === 'IN_PROGRESS') {
            pollingRef.current = setInterval(() => {
                fetchData();
            }, 5000);
        }
        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [activeInventory?.status]);

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

            // 進行中の棚卸がある場合、実数入力値と理由をセット
            if (active) {
                const stocks: Record<number, number> = {};
                const reasonMap: Record<number, string> = {};
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (active as any).items.forEach((item: InventoryItem) => {
                    stocks[item.id] = item.actualStock;
                    if (item.reason) reasonMap[item.id] = item.reason;
                });
                setActualStocks(stocks);
                setReasons(reasonMap);
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

    // 実数更新（オフラインフォールバック付き）
    const handleUpdateActual = async (itemId: number, actualStock: number, reason?: string | null) => {
        // ローカルstateは常に即更新
        if (activeInventory) {
            setActiveInventory({
                ...activeInventory,
                items: activeInventory.items.map((item) =>
                    item.id === itemId
                        ? { ...item, actualStock, adjustment: actualStock - item.expectedStock, reason: reason ?? item.reason }
                        : item
                ),
            });
        }

        try {
            const result = await updateAirconInventoryItem(itemId, actualStock, reason);
            if (!result.success) {
                // サーバーエラー → キューに追加
                setPendingUpdates(prev => [
                    ...prev.filter(u => u.itemId !== itemId),
                    { itemId, actualStock, reason, timestamp: Date.now() },
                ]);
                toast.warning('オフライン保存しました。オンライン復帰時に自動送信します。');
            }
        } catch {
            // ネットワークエラー → キューに追加
            setPendingUpdates(prev => [
                ...prev.filter(u => u.itemId !== itemId),
                { itemId, actualStock, reason, timestamp: Date.now() },
            ]);
            toast.warning('オフライン保存しました。オンライン復帰時に自動送信します。');
        }
    };

    // 差異理由の更新
    const handleReasonChange = (itemId: number, reason: string) => {
        setReasons(prev => ({ ...prev, [itemId]: reason }));
    };

    const handleReasonBlur = (itemId: number) => {
        const reason = reasons[itemId] || '';
        const actualStock = actualStocks[itemId];
        if (actualStock !== undefined) {
            handleUpdateActual(itemId, actualStock, reason || null);
        }
    };

    // OKチェック
    const handleCheck = async (itemId: number) => {
        if (!activeInventory) return;
        // Optimistic update
        setActiveInventory({
            ...activeInventory,
            items: activeInventory.items.map(item =>
                item.id === itemId ? { ...item, checkedBy: adminName, checkedAt: new Date().toISOString() } : item
            ),
        });
        try {
            await checkAirconInventoryItem(itemId, adminName);
        } catch (error) {
            console.error(error);
            toast.error("チェックに失敗しました");
            fetchData();
        }
    };

    const handleUncheck = async (itemId: number) => {
        if (!activeInventory) return;
        setActiveInventory({
            ...activeInventory,
            items: activeInventory.items.map(item =>
                item.id === itemId ? { ...item, checkedBy: null, checkedAt: null } : item
            ),
        });
        try {
            await uncheckAirconInventoryItem(itemId);
        } catch (error) {
            console.error(error);
            toast.error("チェック解除に失敗しました");
            fetchData();
        }
    };

    // 棚卸進捗
    const inventoryProgress = useMemo(() => {
        if (!activeInventory?.items) return { checked: 0, total: 0 };
        const total = activeInventory.items.length;
        const checked = activeInventory.items.filter(item => item.checkedBy).length;
        return { checked, total };
    }, [activeInventory]);
    const allItemsChecked = inventoryProgress.checked === inventoryProgress.total && inventoryProgress.total > 0;

    // 棚卸確定
    const handleComplete = async () => {
        if (!activeInventory) return;
        if (!allItemsChecked) {
            toast.error(`未確認の商品が ${inventoryProgress.total - inventoryProgress.checked} 件あります。全てOKしてから確定してください。`);
            return;
        }
        const result = await completeAirconInventory(activeInventory.id, adminName);
        if (result.success) {
            toast.success("棚卸を確定しました。在庫が更新されました。");
            setConfirmDialogOpen(false);
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
                                    className={allItemsChecked ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-300 cursor-not-allowed"}
                                    disabled={!allItemsChecked}
                                >
                                    <ClipboardCheck className="h-4 w-4 mr-1" /> 確定 {!allItemsChecked && `(残${inventoryProgress.total - inventoryProgress.checked}件)`}
                                </Button>
                            </div>
                        </div>
                        {/* 進捗バー */}
                        <div className="mt-3">
                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                                <span>確認OK</span>
                                <span className={allItemsChecked ? "text-green-600 font-bold" : ""}>{inventoryProgress.checked} / {inventoryProgress.total} 件</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2">
                                <div
                                    className={`h-2 rounded-full transition-all ${allItemsChecked ? 'bg-green-500' : 'bg-blue-500'}`}
                                    style={{ width: `${inventoryProgress.total > 0 ? (inventoryProgress.checked / inventoryProgress.total) * 100 : 0}%` }}
                                />
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
                            <div className="flex flex-wrap items-center gap-2">
                                <Input
                                    placeholder="メモ（任意）"
                                    value={inventoryNote}
                                    onChange={(e) => setInventoryNote(e.target.value)}
                                    className="w-full sm:w-48"
                                />
                                <Button onClick={handleStartInventory} className="flex-1 sm:flex-none">
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

            {/* 未送信バナー */}
            {pendingUpdates.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
                    <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="text-sm text-amber-800 font-medium">
                        未送信 {pendingUpdates.length}件
                    </span>
                    <span className="text-xs text-amber-600">
                        オンライン復帰時に自動送信します
                    </span>
                    {isOnline && (
                        <Button size="sm" variant="outline" className="ml-auto text-xs" onClick={retryPendingUpdates}>
                            今すぐ送信
                        </Button>
                    )}
                </div>
            )}

            {/* 在庫テーブル（PCのみ） */}
            <Card className="hidden md:block">
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
                                    <TableHead className="text-center bg-purple-50/50">持出し内訳</TableHead>
                                    <TableHead className="text-center bg-slate-50/50 font-bold">総在庫</TableHead>
                                    <TableHead className="text-center">発注サフィックス</TableHead>
                                    {activeInventory && (
                                        <>
                                            <TableHead className="text-center bg-green-50/50">実数</TableHead>
                                            <TableHead className="text-center bg-yellow-50/50">差異</TableHead>
                                            <TableHead className="bg-amber-50/50">差異理由</TableHead>
                                            <TableHead className="text-center bg-green-50/50 w-20">OK</TableHead>
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
                                                        <PopoverContent className="w-72 p-3">
                                                            <div className="space-y-2">
                                                                <h4 className="font-medium text-sm border-b pb-1 mb-2">保有業者内訳</h4>
                                                                {product.vendorBreakdown.map((v) => (
                                                                    <div key={v.id} className="flex justify-between items-center text-sm gap-2">
                                                                        <span className="truncate max-w-[120px]">{v.name}</span>
                                                                        <div className="flex gap-1">
                                                                            {v.set > 0 && <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">S{v.set}</Badge>}
                                                                            {v.indoor > 0 && <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">内{v.indoor}</Badge>}
                                                                            {v.outdoor > 0 && <Badge variant="secondary" className="bg-orange-100 text-orange-700 text-xs">外{v.outdoor}</Badge>}
                                                                            <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                                                                                計{v.count}
                                                                            </Badge>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="bg-purple-50/30">
                                                {(() => {
                                                    const { set, indoor, outdoor } = product.typeBreakdown;
                                                    const hasAny = set > 0 || indoor > 0 || outdoor > 0;
                                                    if (!hasAny) return <span className="text-slate-400 text-center block">-</span>;

                                                    // 内機/外機のバラ持出しによる倉庫の余り計算
                                                    // 内機だけ持出し → 外機が倉庫に余る、外機だけ持出し → 内機が倉庫に余る
                                                    const extraIndoor = outdoor > indoor ? outdoor - indoor : 0; // 外機が多く出た→内機余り
                                                    const extraOutdoor = indoor > outdoor ? indoor - outdoor : 0; // 内機が多く出た→外機余り

                                                    return (
                                                        <div className="text-xs space-y-0.5 whitespace-nowrap">
                                                            {set > 0 && (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="inline-block w-8 text-blue-700 font-medium">SET</span>
                                                                    <span className="font-bold text-blue-800">{set}</span>
                                                                </div>
                                                            )}
                                                            {indoor > 0 && (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="inline-block w-8 text-green-700 font-medium">内機</span>
                                                                    <span className="font-bold text-green-800">{indoor}</span>
                                                                </div>
                                                            )}
                                                            {outdoor > 0 && (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="inline-block w-8 text-orange-700 font-medium">外機</span>
                                                                    <span className="font-bold text-orange-800">{outdoor}</span>
                                                                </div>
                                                            )}
                                                            {(extraIndoor > 0 || extraOutdoor > 0) && (
                                                                <div className="mt-1 pt-1 border-t border-purple-200">
                                                                    {extraOutdoor > 0 && (
                                                                        <div className="text-amber-600 font-medium">
                                                                            → 外機 {extraOutdoor}台 倉庫余り
                                                                        </div>
                                                                    )}
                                                                    {extraIndoor > 0 && (
                                                                        <div className="text-amber-600 font-medium">
                                                                            → 内機 {extraIndoor}台 倉庫余り
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </TableCell>
                                            <TableCell className="text-center bg-slate-50/30">
                                                <div>
                                                    {(() => {
                                                        const { set, indoor, outdoor } = product.typeBreakdown;
                                                        // 内機/外機の差分 = 倉庫に余っている端数
                                                        const extraOutdoor = indoor > outdoor ? indoor - outdoor : 0;
                                                        const extraIndoor = outdoor > indoor ? outdoor - indoor : 0;
                                                        const setCount = product.totalStock - extraOutdoor - extraIndoor;

                                                        return (
                                                            <>
                                                                <span className="font-bold text-lg text-slate-900">
                                                                    {setCount}
                                                                </span>
                                                                <span className="text-xs text-slate-500 ml-0.5">セット</span>
                                                                {extraOutdoor > 0 && (
                                                                    <div className="text-xs text-amber-600 mt-0.5">
                                                                        + 外機のみ {extraOutdoor}台
                                                                    </div>
                                                                )}
                                                                {extraIndoor > 0 && (
                                                                    <div className="text-xs text-amber-600 mt-0.5">
                                                                        + 内機のみ {extraIndoor}台
                                                                    </div>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </div>
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
                                                            onFocus={(e) => e.target.select()}
                                                            onChange={(e) => {
                                                                const raw = e.target.value;
                                                                // 空文字は0として扱う（入力中は空を許可）
                                                                if (raw === '') {
                                                                    setActualStocks({ ...actualStocks, [invItem.id]: 0 });
                                                                    return;
                                                                }
                                                                const val = Math.max(0, parseInt(raw, 10) || 0);
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
                                                    <TableCell className="bg-amber-50/30">
                                                        {diff !== null && diff !== 0 && (
                                                            <Input
                                                                placeholder="理由を入力"
                                                                value={reasons[invItem.id] || ''}
                                                                onChange={(e) => handleReasonChange(invItem.id, e.target.value)}
                                                                onBlur={() => handleReasonBlur(invItem.id)}
                                                                className="h-8 text-sm w-36"
                                                            />
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center bg-green-50/30">
                                                        <button
                                                            onClick={() => invItem.checkedBy ? handleUncheck(invItem.id) : handleCheck(invItem.id)}
                                                            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg font-bold text-xs transition-all mx-auto ${invItem.checkedBy
                                                                ? 'bg-green-500 text-white hover:bg-green-600 shadow-sm'
                                                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200 border border-slate-200'
                                                                }`}
                                                        >
                                                            {invItem.checkedBy ? <CircleCheck className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                                                            OK
                                                        </button>
                                                        {invItem.checkedBy && (
                                                            <div className="text-[10px] text-green-600 mt-0.5">{invItem.checkedBy}</div>
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

            {/* スマホ用カードUI */}
            <div className="md:hidden space-y-3">
                <h3 className="font-bold text-lg">在庫一覧</h3>
                {loading ? (
                    <div className="text-center py-8 text-muted-foreground">読み込み中...</div>
                ) : (
                    products.map((product) => {
                        const isLowStock = product.totalStock <= product.minStock;
                        const invItem = activeInventory?.items.find((item) => item.productId === product.id);
                        const actualVal = invItem ? (actualStocks[invItem.id] ?? invItem.actualStock) : null;
                        const diff = invItem ? (actualVal! - invItem.expectedStock) : null;
                        const reason = invItem ? (reasons[invItem.id] || '') : '';

                        return (
                            <Card
                                key={product.id}
                                className={`${activeInventory && diff !== null && diff !== 0
                                    ? diff > 0 ? 'border-green-300 bg-green-50/50' : 'border-red-300 bg-red-50/50'
                                    : isLowStock ? 'border-amber-300 bg-amber-50/50' : ''
                                    }`}
                            >
                                <CardContent className="py-3 px-4 space-y-2">
                                    {/* 品番 + 容量 + アラート */}
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono font-bold text-base">{product.code}</span>
                                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">{product.capacity}</Badge>
                                        {isLowStock && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                                    </div>

                                    {/* 在庫数 */}
                                    <div className="flex items-center gap-3 text-sm">
                                        <span className="text-blue-700">倉庫 <strong>{product.stock}</strong></span>
                                        <span className="text-orange-600">持出 <strong>{product.vendorStock}</strong></span>
                                        <span className="text-slate-700 ml-auto font-bold">
                                            総在庫 {product.totalStock}セット
                                        </span>
                                    </div>

                                    {/* 棚卸入力（棚卸時のみ） */}
                                    {activeInventory && invItem && (
                                        <div className="pt-2 border-t space-y-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-green-700">実数</span>
                                                <Button
                                                    variant="outline" size="sm"
                                                    className="h-8 w-8 p-0"
                                                    onClick={() => {
                                                        const newVal = Math.max(0, (actualVal ?? 0) - 1);
                                                        setActualStocks({ ...actualStocks, [invItem.id]: newVal });
                                                        handleUpdateActual(invItem.id, newVal);
                                                    }}
                                                >
                                                    <Minus className="w-4 h-4" />
                                                </Button>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    className="w-20 text-center font-bold text-lg h-10"
                                                    value={actualVal ?? 0}
                                                    onFocus={(e) => e.target.select()}
                                                    onChange={(e) => {
                                                        const raw = e.target.value;
                                                        const val = raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0);
                                                        setActualStocks({ ...actualStocks, [invItem.id]: val });
                                                    }}
                                                    onBlur={() => {
                                                        const val = actualStocks[invItem.id];
                                                        if (val !== undefined && val !== invItem.actualStock) {
                                                            handleUpdateActual(invItem.id, val);
                                                        }
                                                    }}
                                                />
                                                <Button
                                                    variant="outline" size="sm"
                                                    className="h-8 w-8 p-0"
                                                    onClick={() => {
                                                        const newVal = (actualVal ?? 0) + 1;
                                                        setActualStocks({ ...actualStocks, [invItem.id]: newVal });
                                                        handleUpdateActual(invItem.id, newVal);
                                                    }}
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </Button>
                                                <span className="ml-auto text-sm">
                                                    差異: {diff !== null && diff !== 0 ? (
                                                        <span className={`font-bold ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {diff > 0 ? `+${diff}` : diff}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400">±0</span>
                                                    )}
                                                </span>
                                            </div>
                                            {/* 差異がある場合のみ理由入力 */}
                                            {diff !== null && diff !== 0 && (
                                                <Input
                                                    placeholder="差異理由を入力..."
                                                    value={reason}
                                                    onChange={(e) => handleReasonChange(invItem.id, e.target.value)}
                                                    onBlur={() => handleReasonBlur(invItem.id)}
                                                    className="text-sm h-8"
                                                />
                                            )}
                                            {/* OKボタン（モバイル） */}
                                            <div className="flex items-center justify-between mt-2 pt-2 border-t">
                                                <button
                                                    onClick={() => invItem.checkedBy ? handleUncheck(invItem.id) : handleCheck(invItem.id)}
                                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold text-sm transition-all ${invItem.checkedBy
                                                        ? 'bg-green-500 text-white hover:bg-green-600 shadow-sm'
                                                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200 border border-slate-200'
                                                        }`}
                                                >
                                                    {invItem.checkedBy ? <CircleCheck className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                                                    OK
                                                </button>
                                                {invItem.checkedBy && (
                                                    <span className="text-xs text-green-600">
                                                        ✅ {invItem.checkedBy} ({format(new Date(invItem.checkedAt!), "HH:mm", { locale: ja })})
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>

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

                            {/* 差異理由未入力警告 */}
                            {(() => {
                                const unreasoned = activeInventory.items.filter((item) => {
                                    const actual = actualStocks[item.id] ?? item.actualStock;
                                    const adj = actual - item.expectedStock;
                                    return adj !== 0 && !(reasons[item.id]?.trim());
                                });
                                if (unreasoned.length === 0) return null;
                                return (
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm">
                                        <p className="font-medium text-amber-800 mb-1">
                                            ⚠ 差異理由が未入力のアイテムがあります ({unreasoned.length}件)
                                        </p>
                                        <ul className="text-amber-700 text-xs space-y-0.5">
                                            {unreasoned.map(item => (
                                                <li key={item.id}>• {item.product.code}</li>
                                            ))}
                                        </ul>
                                    </div>
                                );
                            })()}

                            {/* 確認者表示 */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-1">
                                    <User className="h-4 w-4" /> 確認者: {adminName}
                                </label>
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
                            disabled={!allItemsChecked || (activeInventory?.items.some((item) => {
                                const actual = actualStocks[item.id] ?? item.actualStock;
                                const adj = actual - item.expectedStock;
                                return adj !== 0 && !(reasons[item.id]?.trim());
                            }) ?? false)}
                        >
                            <ClipboardCheck className="h-4 w-4 mr-1" /> 確定する
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
