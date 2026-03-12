"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Plus,
    ClipboardList,
    ChevronRight,
    Loader2,
    Trash2,
    Edit,
    Package
} from "lucide-react";
import Link from "next/link";
import { generateDraftOrders, deleteOrder } from "@/lib/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createManualOrder } from "@/lib/actions";
import { isShippingCheckTarget, checkShippingFee, FREE_SHIPPING_THRESHOLD } from "@/lib/shipping-utils";

interface OrderListProps {
    initialOrders: any[];
}

export function OrderList({ initialOrders: orders }: OrderListProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const router = useRouter();

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const result = await generateDraftOrders();
            if (result.success) {
                toast.success(result.message);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        } catch (e) {
            toast.error("エラーが発生しました。");
        } finally {
            setIsGenerating(false);
        }
    };

    const [manualDialogOpen, setManualDialogOpen] = useState(false);
    const [newSupplier, setNewSupplier] = useState("");

    const handleManualCreate = async () => {
        try {
            console.log("Creating manual order for:", newSupplier);
            const result = await createManualOrder(newSupplier);
            console.log("Creation result:", result);
            if (result.success) {
                toast.success("発注書を作成しました");
                setManualDialogOpen(false);
                setNewSupplier("");
                router.refresh();
                router.push(`/admin/orders/${result.id}`);
            }
        } catch (e: any) {
            console.error("Manual create error:", e);
            toast.error(`作成に失敗しました: ${e.message}`);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("この下書きを削除しますか？")) return;
        try {
            await deleteOrder(id);
            toast.success("削除しました");
            router.refresh();
        } catch (e: any) {
            toast.error(e.message || "エラーが発生しました");
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'DRAFT': return <Badge variant="outline">下書き</Badge>;
            case 'ORDERED': return <Badge variant="secondary">発注済</Badge>;
            case 'PARTIAL': return <Badge variant="destructive">一部入荷</Badge>;
            case 'RECEIVED': return <Badge className="bg-green-600">入荷完了</Badge>;
            case 'CANCELLED': return <Badge variant="outline">キャンセル</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    // --- 在庫着地見込みサマリー ---
    const [summaryOpen, setSummaryOpen] = useState(true);

    // 未入荷の注文アイテムを商品別に集計
    const stockProjection = useMemo(() => {
        // DRAFT / ORDERED / PARTIAL のみ対象
        const activeOrders = orders.filter(o =>
            ['DRAFT', 'ORDERED', 'PARTIAL'].includes(o.status)
        );
        if (activeOrders.length === 0) return null;

        // 仕入先 → 商品ID → { name, code, stock, unit, entries: [{orderNum, qty}], totalPending, cost }
        const bySupplier: Record<string, Record<number, {
            name: string;
            code: string;
            stock: number;
            unit: string;
            cost: number;
            entries: { orderLabel: string; qty: number }[];
            totalPending: number;
        }>> = {};

        // 仕入先ごとの合計金額
        const supplierTotals: Record<string, number> = {};

        for (const order of activeOrders) {
            const supplier = order.supplier || '不明';
            if (!bySupplier[supplier]) {
                bySupplier[supplier] = {};
                supplierTotals[supplier] = 0;
            }

            const orderLabel = order.orderNumber ? `#${order.orderNumber}` : '下書き';

            for (const item of (order.items || [])) {
                const pending = item.quantity - (item.receivedQuantity || 0);
                if (pending <= 0) continue;

                const pid = item.productId;
                if (!bySupplier[supplier][pid]) {
                    bySupplier[supplier][pid] = {
                        name: item.product?.name || `商品ID:${pid}`,
                        code: item.product?.code || '',
                        stock: item.product?.stock ?? 0,
                        unit: item.product?.unit || '個',
                        cost: item.cost || 0,
                        entries: [],
                        totalPending: 0,
                    };
                }
                bySupplier[supplier][pid].entries.push({ orderLabel, qty: pending });
                bySupplier[supplier][pid].totalPending += pending;
                supplierTotals[supplier] += pending * (item.cost || 0);
            }
        }

        // 空のサプライヤーを除外
        const suppliers = Object.keys(bySupplier).filter(s =>
            Object.keys(bySupplier[s]).length > 0
        );
        if (suppliers.length === 0) return null;

        return { bySupplier, supplierTotals, suppliers };
    }, [orders]);

    return (
        <div className="space-y-4">
            {/* 📦 在庫着地見込みサマリー */}
            {stockProjection && (
                <Card>
                    <CardHeader className="pb-2 cursor-pointer" onClick={() => setSummaryOpen(!summaryOpen)}>
                        <CardTitle className="text-lg flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Package className="w-5 h-5 text-blue-600" />
                                在庫着地見込み（未入荷分）
                            </div>
                            <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform ${summaryOpen ? 'rotate-90' : ''}`} />
                        </CardTitle>
                    </CardHeader>
                    {summaryOpen && (
                        <CardContent className="pt-0">
                            {stockProjection.suppliers.map((supplier) => {
                                const products = stockProjection.bySupplier[supplier];
                                const totalCost = stockProjection.supplierTotals[supplier];
                                const isTarget = isShippingCheckTarget(supplier);
                                const shipping = isTarget ? checkShippingFee(totalCost) : null;

                                return (
                                    <div key={supplier} className="mb-4 last:mb-0">
                                        <div className="flex flex-wrap items-center justify-between mb-2 pb-1 border-b">
                                            <h4 className="font-bold text-sm text-slate-800">{supplier}</h4>
                                            <div className="flex items-center gap-3 text-xs">
                                                <span className="text-slate-600">
                                                    合計: <span className="font-bold">¥{totalCost.toLocaleString()}</span>
                                                </span>
                                                {shipping && (
                                                    shipping.isFreeShipping
                                                        ? <span className="text-green-600 font-bold">✅ 送料無料</span>
                                                        : <span className="text-amber-600 font-bold">⚠ 送料無料まで あと¥{shipping.shortage.toLocaleString()}</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* PC: テーブル表示 */}
                                        <div className="hidden md:block">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="text-xs text-slate-500 border-b">
                                                        <th className="text-left py-1 font-medium">商品名</th>
                                                        <th className="text-right py-1 font-medium w-[80px]">現在庫</th>
                                                        <th className="text-center py-1 font-medium">発注中（内訳）</th>
                                                        <th className="text-right py-1 font-medium w-[100px]">入荷後見込み</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {Object.values(products).map((p) => (
                                                        <tr key={p.code || p.name} className="border-b border-slate-100 last:border-0">
                                                            <td className="py-1.5">
                                                                {p.code && <span className="font-mono text-xs text-slate-400 mr-1">[{p.code}]</span>}
                                                                {p.name}
                                                            </td>
                                                            <td className="text-right py-1.5 text-slate-600">
                                                                {p.stock}{p.unit}
                                                            </td>
                                                            <td className="text-center py-1.5">
                                                                <span className="text-blue-600">
                                                                    {p.entries.map((e, i) => (
                                                                        <span key={i}>
                                                                            {i > 0 && ' + '}
                                                                            <span className="text-slate-400 text-xs">{e.orderLabel}:</span>{e.qty}
                                                                        </span>
                                                                    ))}
                                                                    {p.entries.length > 1 && (
                                                                        <span className="font-bold ml-1">= {p.totalPending}{p.unit}</span>
                                                                    )}
                                                                </span>
                                                            </td>
                                                            <td className="text-right py-1.5">
                                                                <span className="font-bold text-green-700">
                                                                    {p.stock + p.totalPending}{p.unit}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* モバイル: カード表示 */}
                                        <div className="md:hidden space-y-2">
                                            {Object.values(products).map((p) => (
                                                <div key={p.code || p.name} className="bg-slate-50 rounded-lg p-2.5 text-sm">
                                                    <div className="font-medium text-slate-900 mb-1">
                                                        {p.code && <span className="font-mono text-xs text-slate-400 mr-1">[{p.code}]</span>}
                                                        {p.name}
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-1 text-xs">
                                                        <div>
                                                            <span className="text-slate-500">現在庫</span>
                                                            <div className="font-bold">{p.stock}{p.unit}</div>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-500">発注中</span>
                                                            <div className="font-bold text-blue-600">+{p.totalPending}{p.unit}</div>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-500">見込み</span>
                                                            <div className="font-bold text-green-700">{p.stock + p.totalPending}{p.unit}</div>
                                                        </div>
                                                    </div>
                                                    {p.entries.length > 1 && (
                                                        <div className="text-xs text-slate-400 mt-1">
                                                            内訳: {p.entries.map(e => `${e.orderLabel}:${e.qty}`).join(' + ')}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </CardContent>
                    )}
                </Card>
            )}
            {/* アクションボタン - モバイル対応 */}
            <div className="flex flex-col sm:flex-row justify-end gap-2">
                <Button onClick={handleGenerate} disabled={isGenerating} className="w-full sm:w-auto">
                    {isGenerating ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            作成中...
                        </>
                    ) : (
                        <>
                            <Plus className="mr-2 h-4 w-4" />
                            発注候補を自動生成
                        </>
                    )}
                </Button>
                <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="w-full sm:w-auto">
                            <Edit className="mr-2 h-4 w-4" />
                            手動作成
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>発注書の手動作成</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="supplier">仕入先名</Label>
                                <Input
                                    id="supplier"
                                    value={newSupplier}
                                    onChange={(e) => setNewSupplier(e.target.value)}
                                    placeholder="例: 株式会社◯◯"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleManualCreate} disabled={!newSupplier}>作成</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* PC用テーブル表示 */}
            <div className="hidden md:block border rounded-lg bg-white overflow-hidden shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50">
                            <TableHead className="w-[100px]">番号</TableHead>
                            <TableHead>仕入先</TableHead>
                            <TableHead>作成日</TableHead>
                            <TableHead className="text-right">金額</TableHead>
                            <TableHead>アイテム数</TableHead>
                            <TableHead>ステータス</TableHead>
                            <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                    発注書がありません。
                                </TableCell>
                            </TableRow>
                        ) : (
                            orders.map((order) => (
                                <TableRow key={order.id} className="cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => router.push(`/admin/orders/${order.id}`)}>
                                    <TableCell className="font-medium">
                                        {order.orderNumber ? `#${order.orderNumber}` : <Badge variant="outline" className="text-xs">下書き</Badge>}
                                    </TableCell>
                                    <TableCell>{order.supplier}</TableCell>
                                    <TableCell>{format(new Date(order.createdAt), "yyyy/MM/dd HH:mm")}</TableCell>
                                    <TableCell className="text-right">
                                        {(() => {
                                            const total = order.items?.reduce((s: number, i: any) => s + (i.cost * i.quantity), 0) || 0;
                                            const isTarget = isShippingCheckTarget(order.supplier);
                                            if (!isTarget) return <span className="text-sm text-muted-foreground">¥{total.toLocaleString()}</span>;
                                            const { isFreeShipping, shortage } = checkShippingFee(total);
                                            return (
                                                <div>
                                                    <span className="font-medium">¥{total.toLocaleString()}</span>
                                                    {isFreeShipping ? (
                                                        <span className="text-xs text-green-600 block">送料無料</span>
                                                    ) : (
                                                        <span className="text-xs text-amber-600 block">⚠ あと¥{shortage.toLocaleString()}</span>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </TableCell>
                                    <TableCell>{order.items?.length || 0} 品目</TableCell>
                                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            {order.status === 'DRAFT' && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive hover:bg-red-50"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(order.id);
                                                    }}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="icon" asChild>
                                                <Link href={`/admin/orders/${order.id}`}>
                                                    <ChevronRight className="w-4 h-4" />
                                                </Link>
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* モバイル用カード表示 */}
            <div className="md:hidden space-y-3">
                {orders.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground bg-white rounded-lg border">
                        <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <p>発注書がありません</p>
                    </div>
                ) : (
                    orders.map((order) => (
                        <Link
                            key={order.id}
                            href={`/admin/orders/${order.id}`}
                            className="block bg-white rounded-lg border shadow-sm p-4 hover:bg-slate-50 transition-colors"
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div>
                                    <span className="font-bold text-lg">
                                        {order.orderNumber ? `#${order.orderNumber}` : <Badge variant="outline" className="text-xs">下書き</Badge>}
                                    </span>
                                    <span className="ml-2">{getStatusBadge(order.status)}</span>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-400" />
                            </div>
                            <div className="text-sm text-slate-600 space-y-1">
                                <p className="font-medium text-slate-900">{order.supplier}</p>
                                <div className="flex justify-between">
                                    <span>{format(new Date(order.createdAt), "yyyy/MM/dd HH:mm")}</span>
                                    <span>{order.items?.length || 0} 品目</span>
                                </div>
                                {(() => {
                                    const total = order.items?.reduce((s: number, i: any) => s + (i.cost * i.quantity), 0) || 0;
                                    const isTarget = isShippingCheckTarget(order.supplier);
                                    return (
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium">¥{total.toLocaleString()}</span>
                                            {isTarget && (() => {
                                                const { isFreeShipping, shortage } = checkShippingFee(total);
                                                return isFreeShipping
                                                    ? <span className="text-xs text-green-600">送料無料</span>
                                                    : <span className="text-xs text-amber-600">⚠ あと¥{shortage.toLocaleString()}</span>;
                                            })()}
                                        </div>
                                    );
                                })()}
                            </div>
                            {order.status === 'DRAFT' && (
                                <div className="mt-3 pt-3 border-t">
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        className="w-full"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handleDelete(order.id);
                                        }}
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        削除
                                    </Button>
                                </div>
                            )}
                        </Link>
                    ))
                )}
            </div>
        </div>
    );
}
