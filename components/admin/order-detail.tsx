"use client";

import { useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft,
    Check,
    Send,
    Loader2,
    Copy,
    RotateCcw,
    Package,
    Trash2
} from "lucide-react";
import Link from "next/link";
import { confirmOrder, receiveOrderItem, updateOrderItemQty, searchProducts, addOrderItem, deleteOrderItem, cancelReceipt, cancelOrder } from "@/lib/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface OrderDetailProps {
    initialOrder: any;
}

export function OrderDetail({ initialOrder: order }: OrderDetailProps) {
    const [isUpdating, setIsUpdating] = useState(false);
    const [receiveQtys, setReceiveQtys] = useState<Record<number, number>>({});
    const router = useRouter();

    const handleConfirm = async () => {
        setIsUpdating(true);
        try {
            await confirmOrder(order.id);
            toast.success("発注しました");
            router.refresh();
        } catch (e) {
            toast.error("エラーが発生しました");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleReceive = async (item: any) => {
        const qty = receiveQtys[item.id] ?? (item.quantity - item.receivedQuantity);
        if (qty <= 0) {
            toast.error("入荷数を入力してください");
            return;
        }

        setIsUpdating(true);
        try {
            await receiveOrderItem(item.id, qty);
            toast.success(`${item.product.name}を入荷しました`);
            setReceiveQtys(prev => ({ ...prev, [item.id]: 0 }));
            router.refresh();
        } catch (e: any) {
            toast.error(e.message || "エラーが発生しました");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleCancel = async (item: any) => {
        if (!confirm(`${item.product.name}の入荷を取り消しますか？\n在庫数も減算されます。`)) return;

        setIsUpdating(true);
        try {
            await cancelReceipt(item.id);
            toast.success("入荷を取り消しました");
            router.refresh();
        } catch (e: any) {
            toast.error(e.message || "取消に失敗しました");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleCancelOrder = async () => {
        if (!confirm("本当にこの発注を取り消しますか？\nステータスが「キャンセル」に変更されます。")) return;

        setIsUpdating(true);
        try {
            await cancelOrder(order.id);
            toast.success("発注を取り消しました");
            router.refresh();
        } catch (e: any) {
            toast.error(e.message || "取り消しに失敗しました");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleQtyChange = async (item: any, newQty: number) => {
        if (newQty < 1) {
            toast.error("数量は1以上にしてください");
            return;
        }
        if (newQty < item.receivedQuantity) {
            toast.error(`入荷済数(${item.receivedQuantity})未満には変更できません`);
            // UIのリセットが必要だが、router.refreshで戻るか？
            // 簡易的にリロード
            router.refresh();
            return;
        }
        try {
            await updateOrderItemQty(item.id, newQty);
            toast.success("数量を変更しました");
            router.refresh();
        } catch (e) {
            toast.error("数量の更新に失敗しました");
        }
    };

    const handleDeleteItem = async (item: any) => {
        if (!confirm(`「${item.product.name}」を発注リストから削除しますか？`)) return;
        try {
            setIsUpdating(true);
            await deleteOrderItem(item.id);
            toast.success("削除しました");
            router.refresh();
        } catch (e: any) {
            toast.error(e.message || "削除に失敗しました");
        } finally {
            setIsUpdating(false);
        }
    };

    // Product Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);

    const handleCopy = () => {
        const text = order.items.map((item: any) =>
            `${item.product.name} × ${item.quantity}${item.product.unit}`
        ).join("\n");

        const content = `【発注依頼】\n${order.supplier} 御中\n\n${text}\n\n宜しくお願い致します。`;

        // Modern Clipboard API (Only available in Secure Contexts / HTTPS)
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(content).then(() => {
                toast.success("注文内容をコピーしました");
            }).catch(() => {
                fallbackCopy(content);
            });
        } else {
            // Fallback for non-HTTPS
            fallbackCopy(content);
        }
    };

    const fallbackCopy = (text: string) => {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            toast.success("注文内容をコピーしました");
        } catch (err) {
            toast.error("コピーに失敗しました");
        }
        document.body.removeChild(textArea);
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

    return (
        <div className="space-y-4 md:space-y-6">
            {/* ヘッダー - モバイル対応 */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/admin/orders">
                            <ArrowLeft className="w-4 h-4" />
                        </Link>
                    </Button>
                    <div>
                        <h2 className="text-xl md:text-2xl font-bold">発注書 #{order.id}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-muted-foreground text-sm">{order.supplier}</span>
                            {getStatusBadge(order.status)}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 sm:ml-auto">
                    <Button variant="outline" size="icon" onClick={handleCopy} title="注文内容をコピー">
                        <Copy className="h-4 w-4" />
                    </Button>
                    {(order.status === 'ORDERED' || order.status === 'PARTIAL') && (
                        <Button variant="destructive" size="sm" onClick={handleCancelOrder} disabled={isUpdating}>
                            取り消し
                        </Button>
                    )}
                    {order.status === 'DRAFT' && (
                        <Button onClick={handleConfirm} disabled={isUpdating} className="flex-1 sm:flex-none">
                            {isUpdating ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
                            発注を確定
                        </Button>
                    )}
                </div>
            </div>

            {/* 商品追加 (下書き時のみ) */}
            {order.status === 'DRAFT' && (
                <div className="bg-slate-50 p-3 md:p-4 rounded-lg border">
                    <h3 className="text-sm font-semibold mb-2">商品を追加</h3>
                    <div className="relative">
                        <Input
                            placeholder="商品の品番または名前で検索..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                if (e.target.value.length >= 2) {
                                    searchProducts(e.target.value).then(setSearchResults);
                                } else {
                                    setSearchResults([]);
                                }
                            }}
                        />
                        {searchResults.length > 0 && (
                            <div className="absolute top-full left-0 z-10 w-full bg-white border rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
                                {searchResults.map((product) => (
                                    <div
                                        key={product.id}
                                        className="p-3 hover:bg-slate-100 cursor-pointer flex justify-between items-center"
                                        onClick={async () => {
                                            try {
                                                await addOrderItem(order.id, product.id, 1);
                                                toast.success("追加しました");
                                                setSearchQuery("");
                                                setSearchResults([]);
                                                router.refresh();
                                            } catch (e) {
                                                toast.error("追加に失敗しました");
                                            }
                                        }}
                                    >
                                        <div>
                                            <div className="font-medium">{product.name}</div>
                                            <div className="text-xs text-muted-foreground">{product.code}</div>
                                        </div>
                                        <div className="text-sm">在庫: {product.stock}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* PC用テーブル表示 */}
            <div className="hidden md:block border rounded-lg bg-white overflow-hidden shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50">
                            <TableHead>商品名</TableHead>
                            <TableHead className="text-right">発注数</TableHead>
                            <TableHead className="text-right">入荷済数</TableHead>
                            <TableHead className="text-center w-[200px]">入荷操作</TableHead>
                            {order.status === 'DRAFT' && <TableHead className="w-[60px]"></TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {order.items.map((item: any) => (
                            <TableRow key={item.id}>
                                <TableCell>
                                    <div className="font-medium">{item.product.name}</div>
                                    <div className="text-xs text-muted-foreground">{item.product.code}</div>
                                </TableCell>
                                <TableCell className="text-right">
                                    {['DRAFT', 'ORDERED', 'PARTIAL'].includes(order.status) ? (
                                        <div className="flex justify-end gap-2 items-center">
                                            <Input
                                                type="number"
                                                className="w-20 h-8 text-right"
                                                defaultValue={item.quantity}
                                                onBlur={(e) => handleQtyChange(item, parseInt(e.target.value))}
                                            />
                                            <span className="text-xs">{item.product.unit}</span>
                                        </div>
                                    ) : (
                                        <span>{item.quantity} {item.product.unit}</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <span className={item.isReceived ? "text-green-600 font-bold" : ""}>
                                        {item.receivedQuantity} / {item.quantity}
                                    </span>
                                </TableCell>
                                <TableCell className="text-center">
                                    {(order.status === 'ORDERED' || order.status === 'PARTIAL') && !item.isReceived ? (
                                        <div className="flex gap-2 items-center justify-center">
                                            <Input
                                                type="number"
                                                className="w-20 h-8 text-right px-1"
                                                value={receiveQtys[item.id] ?? (item.quantity - item.receivedQuantity)}
                                                onChange={(e) => setReceiveQtys(prev => ({ ...prev, [item.id]: parseInt(e.target.value) }))}
                                            />
                                            <Button size="sm" variant="outline" className="h-8" onClick={() => handleReceive(item)} disabled={isUpdating}>
                                                確定
                                            </Button>
                                        </div>
                                    ) : item.isReceived ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="flex items-center text-green-600 gap-1 text-sm">
                                                <Check className="w-4 h-4" />
                                                入荷完了
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                                title="入荷取り消し"
                                                onClick={() => handleCancel(item)}
                                                disabled={isUpdating}
                                            >
                                                <RotateCcw className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">-</span>
                                    )}
                                </TableCell>
                                {order.status === 'DRAFT' && (
                                    <TableCell className="text-center">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                            onClick={() => handleDeleteItem(item)}
                                            disabled={isUpdating}
                                            title="削除"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* モバイル用カード表示 */}
            <div className="md:hidden space-y-3">
                {order.items.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground bg-white rounded-lg border">
                        <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <p>商品がありません</p>
                    </div>
                ) : (
                    order.items.map((item: any) => (
                        <div key={item.id} className="bg-white rounded-lg border shadow-sm p-4">
                            <div className="mb-3">
                                <div className="font-medium">{item.product.name}</div>
                                <div className="text-xs text-muted-foreground">{item.product.code}</div>
                                {order.status === 'DRAFT' && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive float-right -mt-1"
                                        onClick={() => handleDeleteItem(item)}
                                        disabled={isUpdating}
                                        title="削除"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                                <div>
                                    <span className="text-muted-foreground">発注数:</span>
                                    {['DRAFT', 'ORDERED', 'PARTIAL'].includes(order.status) ? (
                                        <div className="flex items-center gap-1 mt-1">
                                            <Input
                                                type="number"
                                                className="w-20 h-8 text-right"
                                                defaultValue={item.quantity}
                                                onBlur={(e) => handleQtyChange(item, parseInt(e.target.value))}
                                            />
                                            <span className="text-xs">{item.product.unit}</span>
                                        </div>
                                    ) : (
                                        <span className="ml-1 font-medium">{item.quantity} {item.product.unit}</span>
                                    )}
                                </div>
                                <div>
                                    <span className="text-muted-foreground">入荷済:</span>
                                    <span className={`ml-1 font-medium ${item.isReceived ? "text-green-600" : ""}`}>
                                        {item.receivedQuantity} / {item.quantity}
                                    </span>
                                </div>
                            </div>

                            {/* 入荷操作 */}
                            {(order.status === 'ORDERED' || order.status === 'PARTIAL') && !item.isReceived ? (
                                <div className="border-t pt-3">
                                    <div className="flex gap-2 items-center">
                                        <span className="text-sm text-muted-foreground">入荷数:</span>
                                        <Input
                                            type="number"
                                            className="flex-1 h-10 text-right"
                                            value={receiveQtys[item.id] ?? (item.quantity - item.receivedQuantity)}
                                            onChange={(e) => setReceiveQtys(prev => ({ ...prev, [item.id]: parseInt(e.target.value) }))}
                                        />
                                        <Button onClick={() => handleReceive(item)} disabled={isUpdating}>
                                            入荷確定
                                        </Button>
                                    </div>
                                </div>
                            ) : item.isReceived ? (
                                <div className="border-t pt-3 flex items-center justify-between">
                                    <div className="flex items-center text-green-600 gap-1">
                                        <Check className="w-4 h-4" />
                                        <span className="font-medium">入荷完了</span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-muted-foreground hover:text-destructive"
                                        onClick={() => handleCancel(item)}
                                        disabled={isUpdating}
                                    >
                                        <RotateCcw className="w-4 h-4 mr-1" />
                                        取消
                                    </Button>
                                </div>
                            ) : null}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
