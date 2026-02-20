"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Plus,
    Package,
    Truck,
    CheckCircle,
    Clock,
    Mail,
    FileText,
    MapPin,
    Settings,
    Loader2,
    Trash2,
    XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
    getAirconProducts,
    getAirconOrders,
    createAirconOrder,
    updateAirconOrderStatus,
    receiveAirconOrderItem,
    getDeliveryLocations,
    getOrderEmailSettings,
    deleteAirconOrder,
} from "@/lib/aircon-actions";
import { formatDate } from "@/lib/utils";

// 型定義
interface AirconProduct {
    id: number;
    code: string;
    name: string;
    capacity: string;
    suffix: string;
    stock: number;
    orderPrice: number;
}

interface OrderItem {
    id: number;
    productId: number;
    product: AirconProduct;
    quantity: number;
    receivedQuantity: number;
}

interface DeliveryLoc {
    id: number;
    name: string;
    address: string | null;
    isActive: boolean;
}

interface Order {
    id: number;
    orderNumber: string | null;
    status: string;
    note: string | null;
    deliveryLocationId: number | null;
    deliveryLocation: DeliveryLoc | null;
    orderedAt: Date | null;
    orderedBy: string | null;
    emailSentAt: Date | null;
    createdAt: Date;
    items: OrderItem[];
}

// ステータス設定
const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    DRAFT: { label: "下書き", color: "bg-slate-200", icon: Clock },
    ORDERED: { label: "発注済", color: "bg-blue-100 text-blue-700", icon: Truck },
    PARTIAL: { label: "一部入荷", color: "bg-yellow-100 text-yellow-700", icon: Package },
    RECEIVED: { label: "入荷完了", color: "bg-green-100 text-green-700", icon: CheckCircle },
    CANCELLED: { label: "キャンセル", color: "bg-red-100 text-red-700", icon: Clock },
};

export default function AirconOrdersPage() {
    const [products, setProducts] = useState<AirconProduct[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [locations, setLocations] = useState<DeliveryLoc[]>([]);
    const [loading, setLoading] = useState(true);

    // 発注作成ダイアログ
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [orderQuantities, setOrderQuantities] = useState<Record<number, number>>({});
    const [selectedLocationId, setSelectedLocationId] = useState<string>("");
    const [orderNote, setOrderNote] = useState("");
    const [customDeliveryName, setCustomDeliveryName] = useState(""); // 「その他」自由入力

    // 入荷ダイアログ
    const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [receiveQuantities, setReceiveQuantities] = useState<Record<number, number>>({});

    // メール送信
    const [sendingEmail, setSendingEmail] = useState(false);
    const [confirmEmailDialogOpen, setConfirmEmailDialogOpen] = useState(false);
    const [emailTargetOrder, setEmailTargetOrder] = useState<Order | null>(null);
    const [isTestMode, setIsTestMode] = useState(false);
    const [testEmailOverride, setTestEmailOverride] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [prods, ords, locs] = await Promise.all([
                getAirconProducts(),
                getAirconOrders(),
                getDeliveryLocations(),
            ]);
            setProducts(prods);
            setOrders(ords as unknown as Order[]);
            setLocations(locs);

            // テストモード判定
            try {
                const configRes = await fetch("/api/config");
                const configData = await configRes.json();
                setIsTestMode(configData.isTestMode);
                setTestEmailOverride(configData.testEmailOverride);
            } catch { /* 無視 */ }
        } catch {
            toast.error("データ取得に失敗しました");
        } finally {
            setLoading(false);
        }
    };

    // 発注作成
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

        const result = await createAirconOrder(
            items,
            selectedLocationId === "other" ? undefined : (selectedLocationId ? parseInt(selectedLocationId) : undefined),
            orderNote || undefined,
            selectedLocationId === "other" ? customDeliveryName || undefined : undefined
        );
        if (result.success) {
            toast.success(`発注 ${result.order.orderNumber} を作成しました`);
            setCreateDialogOpen(false);
            setOrderQuantities({});
            setSelectedLocationId("");
            setOrderNote("");
            setCustomDeliveryName("");
            fetchData();
        }
    };

    // ステータス変更
    const handleStatusChange = async (orderId: number, newStatus: string) => {
        await updateAirconOrderStatus(orderId, newStatus);
        toast.success("ステータスを更新しました");
        fetchData();
    };

    // 入荷処理
    const handleReceive = async (itemId: number, quantity: number) => {
        const result = await receiveAirconOrderItem(itemId, quantity);
        if (result.success) {
            toast.success(`${quantity}台の入荷を記録しました`);
            // データを再取得してモーダルの状態も更新
            const [prods, ords] = await Promise.all([
                getAirconProducts(),
                getAirconOrders(),
            ]);
            setProducts(prods as AirconProduct[]);
            setOrders(ords as Order[]);
            // selectedOrderを更新
            if (selectedOrder) {
                const updated = (ords as Order[]).find(o => o.id === selectedOrder.id);
                if (updated && (updated.status === "ORDERED" || updated.status === "PARTIAL")) {
                    setSelectedOrder(updated);
                    // 入荷数量をリセット
                    setReceiveQuantities({});
                } else {
                    // 全入荷完了またはステータス変更済み
                    setReceiveDialogOpen(false);
                    setSelectedOrder(null);
                    setReceiveQuantities({});
                    toast.success("全商品の入荷が完了しました！");
                }
            }
        } else {
            toast.error(result.message);
        }
    };

    // 入荷ダイアログを開く
    const openReceiveDialog = (order: Order) => {
        setSelectedOrder(order);
        setReceiveQuantities({});
        setReceiveDialogOpen(true);
    };

    // PDF生成（サーバーサイド）
    const generateOrderPdf = async (order: Order): Promise<string> => {
        const res = await fetch("/api/aircon/order-pdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: order.id }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        return data.pdfBase64;
    };

    // PDFダウンロード
    const handleDownloadPdf = async (order: Order) => {
        try {
            const pdfBase64 = await generateOrderPdf(order);
            const link = document.createElement("a");
            link.href = `data:application/pdf;base64,${pdfBase64}`;
            link.download = `注文書_${order.orderNumber || order.id}.pdf`;
            link.click();
            toast.success("PDFをダウンロードしました");
        } catch (err) {
            console.error("PDF生成エラー:", err);
            toast.error("PDF生成に失敗しました");
        }
    };

    // メール送信確認
    const handleConfirmEmail = (order: Order) => {
        setEmailTargetOrder(order);
        setConfirmEmailDialogOpen(true);
    };

    // メール送信実行
    const handleSendEmail = async () => {
        if (!emailTargetOrder) return;
        setSendingEmail(true);
        try {
            const pdfBase64 = await generateOrderPdf(emailTargetOrder);

            const res = await fetch("/api/aircon/order-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    orderId: emailTargetOrder.id,
                    pdfBase64,
                    orderedBy: "system", // TODO: 実際の管理者メールを取得
                }),
            });

            const data = await res.json();
            if (data.success) {
                toast.success(`発注メールを送信しました (${data.orderNumber})`);
                if (data.isTestMode) {
                    setIsTestMode(true);
                }
                setConfirmEmailDialogOpen(false);
                setEmailTargetOrder(null);
                fetchData();
            } else {
                toast.error(`送信失敗: ${data.error}`);
            }
        } catch (err) {
            console.error("メール送信エラー:", err);
            toast.error("メール送信に失敗しました");
        } finally {
            setSendingEmail(false);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            {/* ヘッダー */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">エアコン発注管理</h2>
                    <p className="text-muted-foreground">
                        発注書の作成・メール送信・入荷チェックを行います。
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <a href="/admin/aircon-orders/settings">
                            <Settings className="h-4 w-4 mr-1" />
                            メール設定
                        </a>
                    </Button>
                    <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="h-4 w-4 mr-2" />
                                新規発注
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>新規発注作成</DialogTitle>
                                <DialogDescription>商品と数量を選択し、納品先を指定してください。</DialogDescription>
                            </DialogHeader>

                            {/* 納品先選択 */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-1">
                                    <MapPin className="h-4 w-4" /> 納品先拠点
                                </label>
                                <Select value={selectedLocationId} onValueChange={(val) => {
                                    setSelectedLocationId(val);
                                    if (val !== "other") setCustomDeliveryName("");
                                }}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="拠点を選択" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {locations.filter(l => l.isActive).map(loc => (
                                            <SelectItem key={loc.id} value={String(loc.id)}>
                                                {loc.name}
                                            </SelectItem>
                                        ))}
                                        <SelectItem value="other">その他（自由入力）</SelectItem>
                                    </SelectContent>
                                </Select>
                                {selectedLocationId === "other" && (
                                    <Input
                                        value={customDeliveryName}
                                        onChange={e => setCustomDeliveryName(e.target.value)}
                                        placeholder="納品先名を入力（例: ジンコーポレーション）"
                                        className="mt-2"
                                    />
                                )}
                            </div>

                            {/* 商品選択 */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">商品と数量</label>
                                <div className="max-h-64 overflow-y-auto space-y-1">
                                    {products.map(product => (
                                        <div key={product.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">{product.code}{product.suffix}</span>
                                                    <span className="text-sm">{product.name}</span>
                                                    <span className="text-xs text-muted-foreground">({product.capacity})</span>
                                                    {/* 在庫はプラスカンパニー本社の時のみ表示 */}
                                                    {(!selectedLocationId || selectedLocationId === "" || locations.find(l => String(l.id) === selectedLocationId)?.name?.includes("プラス") || locations.find(l => String(l.id) === selectedLocationId)?.name?.includes("本社")) && (
                                                        <span className="text-xs text-slate-500 whitespace-nowrap">在庫: {product.stock}</span>
                                                    )}
                                                    {product.orderPrice > 0 && (
                                                        <span className="text-xs text-blue-500 whitespace-nowrap">¥{product.orderPrice.toLocaleString()}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <Input
                                                type="number"
                                                min={0}
                                                className="w-20 h-8 shrink-0"
                                                value={orderQuantities[product.id] || ""}
                                                onChange={(e) =>
                                                    setOrderQuantities({
                                                        ...orderQuantities,
                                                        [product.id]: parseInt(e.target.value) || 0,
                                                    })
                                                }
                                                placeholder="0"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 備考 */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">備考</label>
                                <Input
                                    value={orderNote}
                                    onChange={e => setOrderNote(e.target.value)}
                                    placeholder="備考（任意）"
                                />
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                                    キャンセル
                                </Button>
                                <Button onClick={handleCreateOrder}>
                                    下書き保存
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* 発注一覧 */}
            {orders.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        発注データがありません。「新規発注」から作成してください。
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {orders.map(order => {
                        const config = statusConfig[order.status] || statusConfig.DRAFT;
                        const StatusIcon = config.icon;
                        return (
                            <Card key={order.id}>
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <span className="font-mono">{order.orderNumber || `#${order.id}`}</span>
                                            <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${config.color}`}>
                                                <StatusIcon className="h-3 w-3" />
                                                {config.label}
                                            </span>
                                            {order.deliveryLocation && (
                                                <span className="text-xs px-2 py-1 rounded-full bg-purple-50 text-purple-700 flex items-center gap-1">
                                                    <MapPin className="h-3 w-3" />
                                                    {order.deliveryLocation.name}
                                                </span>
                                            )}
                                        </CardTitle>
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            {order.emailSentAt && (
                                                <span className="flex items-center gap-1 text-green-600 mr-2">
                                                    <Mail className="h-3 w-3" /> 送信済
                                                </span>
                                            )}
                                            <span>作成: {formatDate(order.createdAt)}</span>
                                            {order.orderedAt && (
                                                <span className="ml-2">発注: {formatDate(order.orderedAt)}</span>
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {/* 商品一覧 */}
                                    <table className="w-full text-sm mb-3">
                                        <thead>
                                            <tr className="border-b text-left text-muted-foreground text-xs">
                                                <th className="pb-2">品番</th>
                                                <th className="pb-2">品名</th>
                                                <th className="pb-2">容量</th>
                                                <th className="pb-2 text-center">発注数</th>
                                                <th className="pb-2 text-center">入荷数</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {order.items.map(item => (
                                                <tr key={item.id} className="border-b last:border-0">
                                                    <td className="py-2 font-mono text-xs">{item.product.code}</td>
                                                    <td className="py-2">{item.product.name}</td>
                                                    <td className="py-2 text-xs">{item.product.capacity}</td>
                                                    <td className="py-2 text-center">{item.quantity}</td>
                                                    <td className="py-2 text-center">
                                                        <span className={item.receivedQuantity >= item.quantity ? "text-green-600 font-medium" : ""}>
                                                            {item.receivedQuantity}
                                                        </span>
                                                        <span className="text-muted-foreground">/{item.quantity}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {order.note && (
                                        <p className="text-xs text-muted-foreground mb-3">📝 {order.note}</p>
                                    )}

                                    {/* アクションボタン */}
                                    <div className="flex gap-2 flex-wrap">
                                        {order.status === "DRAFT" && (
                                            <>
                                                <Button size="sm" variant="outline" onClick={() => handleDownloadPdf(order)}>
                                                    <FileText className="h-3 w-3 mr-1" /> PDF確認
                                                </Button>
                                                <Button size="sm" onClick={() => handleConfirmEmail(order)}>
                                                    <Mail className="h-3 w-3 mr-1" /> 発注メール送信
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={async () => {
                                                        if (!confirm("この下書きを削除しますか？")) return;
                                                        const result = await deleteAirconOrder(order.id);
                                                        if (result.success) {
                                                            toast.success("下書きを削除しました");
                                                            fetchData();
                                                        } else {
                                                            toast.error(result.message || "削除に失敗しました");
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="h-3 w-3 mr-1" /> 削除
                                                </Button>
                                            </>
                                        )}
                                        {(order.status === "ORDERED" || order.status === "PARTIAL") && (
                                            <Button size="sm" variant="outline" onClick={() => openReceiveDialog(order)}>
                                                <Package className="h-3 w-3 mr-1" /> 入荷チェック
                                            </Button>
                                        )}
                                        {order.status === "ORDERED" && (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleDownloadPdf(order)}
                                                >
                                                    <FileText className="h-3 w-3 mr-1" /> PDF再ダウンロード
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => {
                                                        if (!confirm("この発注をキャンセルしますか？\n履歴は保持されます。")) return;
                                                        handleStatusChange(order.id, "CANCELLED");
                                                    }}
                                                >
                                                    <XCircle className="h-3 w-3 mr-1" /> キャンセル
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* メール送信確認ダイアログ */}
            <Dialog open={confirmEmailDialogOpen} onOpenChange={setConfirmEmailDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>発注メール送信の確認</DialogTitle>
                        <DialogDescription>以下の内容で発注メールを送信します。</DialogDescription>
                    </DialogHeader>
                    {emailTargetOrder && (
                        <div className="space-y-3 text-sm">
                            <div>
                                <span className="font-medium">発注番号:</span> {emailTargetOrder.orderNumber}
                            </div>
                            <div>
                                <span className="font-medium">納品先:</span>{" "}
                                {emailTargetOrder.deliveryLocation?.name || "未指定"}
                            </div>
                            <div>
                                <span className="font-medium">商品:</span>
                                <ul className="mt-1 ml-4 list-disc">
                                    {emailTargetOrder.items.map(item => (
                                        <li key={item.id}>
                                            {item.product.code} {item.product.name} × {item.quantity}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            {isTestMode ? (
                                <div className="p-3 bg-green-50 rounded text-green-800 text-xs border border-green-200">
                                    🧪 テストモード: メールは <strong>y.kojima@plus-company.co.jp</strong> のみに送信されます。日立担当者には届きません。
                                </div>
                            ) : (
                                <div className="p-3 bg-yellow-50 rounded text-yellow-800 text-xs">
                                    ⚠️ 送信すると、日立の担当者にメールが届きます。発注内容を確認してから送信してください。
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmEmailDialogOpen(false)} disabled={sendingEmail}>
                            キャンセル
                        </Button>
                        <Button onClick={handleSendEmail} disabled={sendingEmail}>
                            {sendingEmail ? (
                                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> 送信中...</>
                            ) : (
                                <><Mail className="h-4 w-4 mr-1" /> 送信する</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 入荷チェックダイアログ */}
            <Dialog open={receiveDialogOpen} onOpenChange={(open) => {
                setReceiveDialogOpen(open);
                if (!open) {
                    setSelectedOrder(null);
                    setReceiveQuantities({});
                }
            }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>入荷チェック ({selectedOrder?.orderNumber})</DialogTitle>
                        <DialogDescription>入荷した数量を入力してください。</DialogDescription>
                    </DialogHeader>
                    {selectedOrder && (
                        <div className="space-y-3">
                            {selectedOrder.items.map(item => {
                                const remaining = item.quantity - item.receivedQuantity;
                                const inputQty = receiveQuantities[item.id] ?? remaining;
                                return (
                                    <div key={item.id} className="p-3 border rounded space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-medium text-sm">{item.product.name}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {item.product.code} | 発注: {item.quantity} | 入荷済: {item.receivedQuantity}
                                                    {remaining > 0 && <span className="text-orange-600 ml-1">（残: {remaining}）</span>}
                                                </div>
                                                <div className="text-xs text-blue-600 mt-0.5">
                                                    現在在庫: {item.product.stock ?? "—"}台
                                                </div>
                                            </div>
                                            {remaining <= 0 && (
                                                <span className="text-green-600 text-sm font-medium">✓ 完了</span>
                                            )}
                                        </div>
                                        {remaining > 0 && (
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    max={remaining}
                                                    className="w-20 h-8"
                                                    value={inputQty}
                                                    onChange={(e) => setReceiveQuantities({
                                                        ...receiveQuantities,
                                                        [item.id]: Math.min(Math.max(1, parseInt(e.target.value) || 0), remaining),
                                                    })}
                                                />
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setReceiveQuantities({
                                                        ...receiveQuantities,
                                                        [item.id]: remaining,
                                                    })}
                                                >
                                                    全数({remaining})
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleReceive(item.id, inputQty)}
                                                >
                                                    <Package className="h-3 w-3 mr-1" /> 入荷確定
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
