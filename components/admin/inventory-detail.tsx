"use client";

import { useEffect, useState } from "react";
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
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import { getInventoryCount, updateInventoryItem, finalizeInventory, cancelInventory } from "@/lib/actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface InventoryDetailProps {
    id: number;
}

export function InventoryDetail({ id }: InventoryDetailProps) {
    const [inventory, setInventory] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const router = useRouter();

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        try {
            const data = await getInventoryCount(id);
            setInventory(data);
        } catch (error) {
            console.error(error);
            toast.error("データの読み込みに失敗しました");
        } finally {
            setLoading(false);
        }
    };

    const handleStockChange = async (itemId: number, newValue: string) => {
        const val = parseInt(newValue);
        if (isNaN(val)) return;

        // Optimistic update
        setInventory((prev: any) => ({
            ...prev,
            items: prev.items.map((item: any) =>
                item.id === itemId ? { ...item, actualStock: val, adjustment: val - item.expectedStock } : item
            )
        }));

        try {
            await updateInventoryItem(itemId, val);
        } catch (error) {
            console.error("Failed to save", error);
            toast.error("保存に失敗しました");
        }
    };

    const handleFinalize = async () => {
        if (!confirm("棚卸を確定しますか？\n差異分が在庫に反映されます。この操作は取り消せません。")) return;

        setSaving(true);
        try {
            await finalizeInventory(id);
            toast.success("棚卸を確定しました");
            router.push('/admin/inventory');
        } catch (error) {
            console.error(error);
            toast.error("確定処理に失敗しました");
            setSaving(false);
        }
    };

    const handleCancel = async () => {
        if (!confirm("この棚卸を中止しますか？\n入力内容は破棄され、在庫は更新されません。")) return;

        setSaving(true);
        try {
            await cancelInventory(id);
            toast.info("棚卸を中止しました");
            router.push('/admin/inventory');
        } catch (error) {
            console.error(error);
            toast.error("中止処理に失敗しました");
            setSaving(false);
        }
    };

    if (loading) return <div>読み込み中...</div>;
    if (!inventory) return (
        <div>
            <div className="mb-4">
                <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    戻る
                </Button>
            </div>
            <div>データが見つかりません</div>
        </div>
    );

    const isCompleted = inventory.status === 'COMPLETED';
    const isCancelled = inventory.status === 'CANCELLED';

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        戻る
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            棚卸詳細 #{inventory.id}
                            <Badge variant={isCompleted ? "default" : isCancelled ? "outline" : "secondary"}>
                                {isCompleted ? "完了" : isCancelled ? "中止" : "実施中"}
                            </Badge>
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            開始: {format(new Date(inventory.startedAt), "yyyy/MM/dd HH:mm", { locale: ja })}
                        </p>
                    </div>
                </div>
                {!isCompleted && !isCancelled && (
                    <div className="flex gap-2">
                        <Button variant="destructive" onClick={handleCancel} disabled={saving}>
                            <XCircle className="mr-2 h-4 w-4" />
                            中止
                        </Button>
                        <Button onClick={handleFinalize} disabled={saving} className="bg-green-600 hover:bg-green-700">
                            <CheckCircle className="mr-2 h-4 w-4" />
                            確定して在庫反映
                        </Button>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-md border shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>品番</TableHead>
                            <TableHead>商品名</TableHead>
                            <TableHead className="text-right">帳簿在庫</TableHead>
                            <TableHead className="w-[150px] text-right">実在庫 (入力)</TableHead>
                            <TableHead className="text-right">差異</TableHead>
                            <TableHead>単位</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {inventory.items.map((item: any) => (
                            <TableRow key={item.id} className={item.adjustment !== 0 ? "bg-yellow-50" : ""}>
                                <TableCell className="font-mono">{item.product.code}</TableCell>
                                <TableCell>{item.product.name}</TableCell>
                                <TableCell className="text-right">{item.expectedStock}</TableCell>
                                <TableCell className="text-right">
                                    {isCompleted ? (
                                        <span className="font-bold">{item.actualStock}</span>
                                    ) : (
                                        <Input
                                            type="number"
                                            className="text-right"
                                            value={item.actualStock}
                                            onChange={(e) => handleStockChange(item.id, e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            disabled={isCancelled} // Disable input if cancelled (though usually handled by isCompleted check, but adding for safety if we show cancelled state here)
                                        />
                                    )}
                                </TableCell>
                                <TableCell className={`text-right font-bold ${item.adjustment < 0 ? "text-red-500" : item.adjustment > 0 ? "text-blue-500" : "text-gray-400"}`}>
                                    {item.adjustment > 0 ? "+" : ""}{item.adjustment}
                                </TableCell>
                                <TableCell>{item.product.unit}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
