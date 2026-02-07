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
    RotateCcw
} from "lucide-react";
import Link from "next/link";
import { confirmOrder, receiveOrderItem, updateOrderItemQty, searchProducts, addOrderItem, cancelReceipt } from "@/lib/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface OrderDetailProps {
    initialOrder: any;
}

export function OrderDetail({ initialOrder: order }: OrderDetailProps) {
    // const [order] = useState(initialOrder); // Removed to separate state from props
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

    const handleQtyChange = async (itemId: number, newQty: number) => {
        if (newQty < 1) return;
        try {
            await updateOrderItemQty(itemId, newQty);
        } catch (e) {
            toast.error("数量の更新に失敗しました");
        }
    };

    // Product Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearch, setShowSearch] = useState(false);

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        // We need to import searchProducts from actions (add to imports later)
        // For now assuming it is dynamic import or added to props? No, server action.
        // Assuming searchProducts is exported from actions
    };

    // We will implement debounced search in useEffect or simple onchange in the render part



    const handleCopy = () => {
        const text = order.items.map((item: any) =>
            `${item.product.name} × ${item.quantity}${item.product.unit}`
        ).join("\n");

        const content = `【発注依頼】\n${order.supplier} 御中\n\n${text}\n\n宜しくお願い致します。`;

        navigator.clipboard.writeText(content);
        toast.success("注文内容をコピーしました");
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
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/admin/orders">
                        <ArrowLeft className="w-4 h-4" />
                    </Link>
                </Button>
                <div>
                    <h2 className="text-2xl font-bold">発注書 #{order.id}</h2>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-muted-foreground">{order.supplier}</span>
                        {getStatusBadge(order.status)}
                    </div>
                </div>
                <div className="ml-auto flex gap-2">
                    <Button variant="outline" size="icon" onClick={handleCopy} title="注文内容をコピー">
                        <Copy className="h-4 w-4" />
                    </Button>
                    {order.status === 'DRAFT' && (
                        <Button onClick={handleConfirm} disabled={isUpdating}>
                            {isUpdating ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
                            発注を確定する
                        </Button>
                    )}
                </div>
            </div>

            {order.status === 'DRAFT' && (
                <div className="bg-slate-50 p-4 rounded-lg border">
                    <h3 className="text-sm font-semibold mb-2">商品を追加</h3>
                    <div className="relative">
                        <div className="flex gap-2">
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
                        </div>
                        {searchResults.length > 0 && (
                            <div className="absolute top-full left-0 z-10 w-full bg-white border rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
                                {searchResults.map((product) => (
                                    <div
                                        key={product.id}
                                        className="p-2 hover:bg-slate-100 cursor-pointer flex justify-between items-center"
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

            <div className="border rounded-lg bg-white overflow-hidden shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50">
                            <TableHead>商品名</TableHead>
                            <TableHead className="text-right">発注数</TableHead>
                            <TableHead className="text-right">荷済数</TableHead>
                            <TableHead className="text-center w-[200px]">入荷操作</TableHead>
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
                                    {order.status === 'DRAFT' ? (
                                        <div className="flex justify-end gap-2 items-center">
                                            <Input
                                                type="number"
                                                className="w-20 h-8 text-right"
                                                defaultValue={item.quantity}
                                                onBlur={(e) => handleQtyChange(item.id, parseInt(e.target.value))}
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
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
