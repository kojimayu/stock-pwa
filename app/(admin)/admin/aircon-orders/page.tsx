"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Package, CheckCircle, Clock, Truck } from "lucide-react";
import { toast } from "sonner";
import {
    getAirconProducts,
    getAirconOrders,
    createAirconOrder,
    updateAirconOrderStatus,
    receiveAirconOrderItem,
} from "@/lib/aircon-actions";
import { formatDate } from "@/lib/utils";

type AirconProduct = {
    id: number;
    code: string;
    name: string;
    capacity: string;
    suffix: string;
    stock: number;
};

type OrderItem = {
    id: number;
    productId: number;
    product: AirconProduct;
    quantity: number;
    receivedQuantity: number;
};

type Order = {
    id: number;
    status: string;
    note: string | null;
    createdAt: Date;
    items: OrderItem[];
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    DRAFT: { label: "下書き", color: "bg-slate-200", icon: Clock },
    ORDERED: { label: "発注済", color: "bg-blue-100 text-blue-700", icon: Truck },
    PARTIAL: { label: "一部入荷", color: "bg-amber-100 text-amber-700", icon: Package },
    RECEIVED: { label: "入荷完了", color: "bg-green-100 text-green-700", icon: CheckCircle },
    CANCELLED: { label: "キャンセル", color: "bg-red-100 text-red-700", icon: Clock },
};

export default function AirconOrdersPage() {
    const [products, setProducts] = useState<AirconProduct[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [orderQuantities, setOrderQuantities] = useState<Record<number, number>>({});
    const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [prods, ords] = await Promise.all([
                getAirconProducts(),
                getAirconOrders(),
            ]);
            setProducts(prods);
            setOrders(ords);
        } catch (e) {
            toast.error("データ取得に失敗しました");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateOrder = async () => {
        const items = Object.entries(orderQuantities)
            .filter(([, qty]) => qty > 0)
            .map(([productId, quantity]) => ({
                productId: parseInt(productId),
                quantity,
            }));

        if (items.length === 0) {
            toast.error("発注数量を入力してください");
            return;
        }

        const result = await createAirconOrder(items);
        if (result.success) {
            toast.success("発注を作成しました");
            setCreateDialogOpen(false);
            setOrderQuantities({});
            fetchData();
        }
    };

    const handleStatusChange = async (orderId: number, newStatus: string) => {
        await updateAirconOrderStatus(orderId, newStatus);
        toast.success("ステータスを更新しました");
        fetchData();
    };

    const handleReceive = async (itemId: number, quantity: number) => {
        const result = await receiveAirconOrderItem(itemId, quantity);
        if (result.success) {
            toast.success("入荷を記録しました");
            fetchData();
        } else {
            toast.error(result.message);
        }
    };

    const openReceiveDialog = (order: Order) => {
        setSelectedOrder(order);
        setReceiveDialogOpen(true);
    };

    const pendingOrders = orders.filter((o) => o.status !== "RECEIVED" && o.status !== "CANCELLED");

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">エアコン発注管理</h2>
                    <p className="text-muted-foreground">発注・入荷の管理</p>
                </div>
                <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    新規発注
                </Button>
            </div>

            {/* 未完了発注 */}
            {pendingOrders.length > 0 && (
                <Card className="border-blue-200 bg-blue-50">
                    <CardHeader>
                        <CardTitle className="text-blue-800">処理待ち発注</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {pendingOrders.map((order) => (
                                <div
                                    key={order.id}
                                    className="flex items-center justify-between bg-white p-3 rounded-lg"
                                >
                                    <div>
                                        <span className="font-medium">発注 #{order.id}</span>
                                        <span className="text-sm text-muted-foreground ml-2">
                                            {formatDate(order.createdAt)}
                                        </span>
                                        <Badge className={`ml-2 ${statusConfig[order.status]?.color}`}>
                                            {statusConfig[order.status]?.label}
                                        </Badge>
                                    </div>
                                    <div className="flex gap-2">
                                        {order.status === "DRAFT" && (
                                            <Button
                                                size="sm"
                                                onClick={() => handleStatusChange(order.id, "ORDERED")}
                                            >
                                                発注確定
                                            </Button>
                                        )}
                                        {(order.status === "ORDERED" || order.status === "PARTIAL") && (
                                            <Button size="sm" onClick={() => openReceiveDialog(order)}>
                                                入荷処理
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 発注履歴 */}
            <Card>
                <CardHeader>
                    <CardTitle>発注履歴</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">読み込み中...</div>
                    ) : orders.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">発注データがありません</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>発注ID</TableHead>
                                    <TableHead>日時</TableHead>
                                    <TableHead>ステータス</TableHead>
                                    <TableHead>内容</TableHead>
                                    <TableHead className="text-right">操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orders.map((order) => (
                                    <TableRow key={order.id}>
                                        <TableCell className="font-medium">#{order.id}</TableCell>
                                        <TableCell>{formatDate(order.createdAt)}</TableCell>
                                        <TableCell>
                                            <Badge className={statusConfig[order.status]?.color}>
                                                {statusConfig[order.status]?.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm space-y-1">
                                                {order.items.map((item) => (
                                                    <div key={item.id}>
                                                        {item.product.code}{item.product.suffix} × {item.quantity}台
                                                        {item.receivedQuantity > 0 && (
                                                            <span className="text-green-600 ml-1">
                                                                (入荷: {item.receivedQuantity})
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {(order.status === "ORDERED" || order.status === "PARTIAL") && (
                                                <Button size="sm" variant="outline" onClick={() => openReceiveDialog(order)}>
                                                    入荷
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* 新規発注ダイアログ */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>新規発注作成</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>品番</TableHead>
                                    <TableHead className="text-center">現在庫</TableHead>
                                    <TableHead className="text-center">発注数</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {products.map((product) => (
                                    <TableRow key={product.id}>
                                        <TableCell className="font-mono">
                                            {product.code}{product.suffix}
                                        </TableCell>
                                        <TableCell className="text-center">{product.stock}</TableCell>
                                        <TableCell className="text-center">
                                            <Input
                                                type="number"
                                                min={0}
                                                className="w-20 text-center mx-auto"
                                                value={orderQuantities[product.id] || ""}
                                                onChange={(e) =>
                                                    setOrderQuantities({
                                                        ...orderQuantities,
                                                        [product.id]: parseInt(e.target.value) || 0,
                                                    })
                                                }
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                            キャンセル
                        </Button>
                        <Button onClick={handleCreateOrder}>発注作成</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 入荷処理ダイアログ */}
            <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>入荷処理 - 発注 #{selectedOrder?.id}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        {selectedOrder && (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>品番</TableHead>
                                        <TableHead className="text-center">発注</TableHead>
                                        <TableHead className="text-center">入荷済</TableHead>
                                        <TableHead className="text-center">今回入荷</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedOrder.items.map((item) => {
                                        const remaining = item.quantity - item.receivedQuantity;
                                        return (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-mono">
                                                    {item.product.code}{item.product.suffix}
                                                </TableCell>
                                                <TableCell className="text-center">{item.quantity}</TableCell>
                                                <TableCell className="text-center">{item.receivedQuantity}</TableCell>
                                                <TableCell className="text-center">
                                                    {remaining > 0 ? (
                                                        <Button
                                                            size="sm"
                                                            onClick={() => {
                                                                handleReceive(item.id, remaining);
                                                                setReceiveDialogOpen(false);
                                                            }}
                                                        >
                                                            全数入荷 ({remaining})
                                                        </Button>
                                                    ) : (
                                                        <span className="text-green-600">完了</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setReceiveDialogOpen(false)}>
                            閉じる
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
