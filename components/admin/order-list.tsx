"use client";

import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
    Plus,
    ClipboardList,
    ChevronRight,
    Loader2,
    Trash2
} from "lucide-react";
import Link from "next/link";
import { generateDraftOrders, deleteOrder } from "@/lib/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface OrderListProps {
    initialOrders: any[];
}

export function OrderList({ initialOrders }: OrderListProps) {
    const [orders, setOrders] = useState(initialOrders);
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
            case 'CANCELLED': return <Badge variant="ghost">キャンセル</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button onClick={handleGenerate} disabled={isGenerating}>
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
            </div>

            <div className="border rounded-lg bg-white overflow-hidden shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50">
                            <TableHead className="w-[100px]">ID</TableHead>
                            <TableHead>仕入先</TableHead>
                            <TableHead>作成日</TableHead>
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
                                <TableRow key={order.id} className="cursor-pointer hover:bg-slate-50 transition-colors">
                                    <TableCell className="font-medium">#{order.id}</TableCell>
                                    <TableCell>{order.supplier}</TableCell>
                                    <TableCell>{format(new Date(order.createdAt), "yyyy/MM/dd HH:mm")}</TableCell>
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
        </div>
    );
}
