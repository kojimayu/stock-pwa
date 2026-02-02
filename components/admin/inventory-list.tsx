"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Plus, HelpCircle, ChevronRight } from "lucide-react";
import { createInventoryCount, getInventoryCounts } from "@/lib/actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface InventoryCount {
    id: number;
    status: string;
    startedAt: Date;
    endedAt: Date | null;
    note: string | null;
    items: any[];
}

export function InventoryList() {
    const [counts, setCounts] = useState<InventoryCount[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        loadCounts();
    }, []);

    const loadCounts = async () => {
        try {
            const data = await getInventoryCounts();
            setCounts(data);
        } catch (error) {
            console.error(error);
            toast.error("棚卸データの取得に失敗しました");
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!confirm("新しい棚卸を開始しますか？")) return;

        try {
            await createInventoryCount();
            toast.success("棚卸を開始しました");
            loadCounts();
        } catch (error) {
            console.error(error);
            toast.error("棚卸の開始に失敗しました");
        }
    };

    if (loading) return <div className="p-4 text-center">読み込み中...</div>;

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-10">
                <div className="p-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold">棚卸管理</h1>
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <HelpCircle className="h-5 w-5 text-muted-foreground" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>棚卸機能について</DialogTitle>
                                    <DialogDescription>
                                        実在庫とシステム在庫の差異を調整します。
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 text-sm">
                                    <div>
                                        <h4 className="font-bold mb-1">ステータスの意味</h4>
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><span className="font-bold text-blue-600">実施中</span>: 棚卸作業中。在庫入力が可能です。</li>
                                            <li><span className="font-bold text-green-600">完了</span>: 差異が確定され、在庫数が更新された状態です。</li>
                                            <li><span className="font-bold text-gray-600">中止</span>: 途中でキャンセルされた棚卸です。</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 className="font-bold mb-1">操作手順</h4>
                                        <ol className="list-decimal pl-5 space-y-1">
                                            <li>「棚卸開始」をタップしてセッションを作成</li>
                                            <li>商品の実在庫数を入力</li>
                                            <li>入力が終わったら「確定」をタップ</li>
                                        </ol>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                    <Button onClick={handleCreate} size="sm" className="h-10">
                        <Plus className="mr-1 h-4 w-4" />
                        棚卸開始
                    </Button>
                </div>
            </div>

            {/* List */}
            <div className="divide-y">
                {counts.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        棚卸履歴がありません
                    </div>
                ) : (
                    counts.map((count) => (
                        <div
                            key={count.id}
                            className="bg-white p-4 flex items-center gap-4 active:bg-slate-50 cursor-pointer"
                            onClick={() => router.push(`/admin/inventory/${count.id}`)}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold text-slate-900">#{count.id}</span>
                                    <Badge
                                        variant={count.status === 'COMPLETED' ? "default" :
                                            count.status === 'IN_PROGRESS' ? "secondary" : "outline"}
                                        className={cn(
                                            "text-xs",
                                            count.status === 'COMPLETED' && "bg-green-100 text-green-800 hover:bg-green-100",
                                            count.status === 'IN_PROGRESS' && "bg-blue-100 text-blue-800 hover:bg-blue-100",
                                            count.status === 'CANCELLED' && "bg-gray-100 text-gray-500 line-through"
                                        )}
                                    >
                                        {count.status === 'IN_PROGRESS' ? '実施中' :
                                            count.status === 'COMPLETED' ? '完了' :
                                                count.status === 'CANCELLED' ? '中止' : count.status}
                                    </Badge>
                                </div>
                                <div className="text-sm text-slate-500">
                                    {format(new Date(count.startedAt), "yyyy/MM/dd HH:mm", { locale: ja })}
                                    {count.endedAt && (
                                        <span className="ml-2">
                                            → {format(new Date(count.endedAt), "HH:mm", { locale: ja })}
                                        </span>
                                    )}
                                </div>
                                {count.note && (
                                    <div className="text-xs text-slate-400 mt-1 truncate">{count.note}</div>
                                )}
                            </div>
                            <ChevronRight className="h-5 w-5 text-slate-400 flex-none" />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
