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

    return (
        <div className="space-y-4">
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
                                    <span className="font-bold text-lg">#{order.id}</span>
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
