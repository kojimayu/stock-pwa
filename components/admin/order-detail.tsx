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
    Loader2
} from "lucide-react";
import Link from "next/link";
import { confirmOrder, receiveOrderItem, updateOrderItemQty } from "@/lib/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface OrderDetailProps {
    initialOrder: any;
}

export function OrderDetail({ initialOrder }: OrderDetailProps) {
    const [order] = useState(initialOrder);
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

    const handleQtyChange = async (itemId: number, newQty: number) => {
        if (newQty < 1) return;
        try {
            await updateOrderItemQty(itemId, newQty);
        } catch (e) {
            toast.error("数量の更新に失敗しました");
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'DRAFT': return <Badge variant="outline">下書き</Badge>;
            case 'ORDERED': return <Badge variant="secondary">発注済</Badge>;
            case 'PARTIAL': return <Badge variant="destructive">一部入荷</Badge>;
            case 'RECEIVED': return <Badge className="bg-green-600">入荷完了</Badge>;
            case 'CANCELLED': return <Badge variant="ghost">キャンセル</Badge>;
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
                    {order.status === 'DRAFT' && (
                        <Button onClick={handleConfirm} disabled={isUpdating}>
                            {isUpdating ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
                            発注を確定する
                        </Button>
                    )}
                </div>
            </div>

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
                                        <div className="flex items-center justify-center text-green-600 gap-1 text-sm">
                                            <Check className="w-4 h-4" />
                                            入荷完了
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
