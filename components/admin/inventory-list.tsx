"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { Plus, HelpCircle } from "lucide-react";
import { createInventoryCount, getInventoryCounts } from "@/lib/actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

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

    if (loading) return <div>読み込み中...</div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold">棚卸履歴</h2>
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="icon">
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
                                        <li><span className="font-bold text-blue-600">実施中</span>: 棚卸作業中の状態です。在庫入力が可能です。この間も店舗運用（販売）は可能ですが、在庫ズレの原因になるため推奨されません。</li>
                                        <li><span className="font-bold text-green-600">完了</span>: 差異が確定され、在庫数が更新された状態です。</li>
                                        <li><span className="font-bold text-gray-600">中止</span>: 途中でキャンセルされた棚卸です。在庫への反映は行われません。</li>
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="font-bold mb-1">操作手順</h4>
                                    <ol className="list-decimal pl-5 space-y-1">
                                        <li>「棚卸開始」をクリックしてセッションを作成します。</li>
                                        <li>「詳細/入力」から、商品の実在庫数を入力します。</li>
                                        <li>入力が終わったら「確定して在庫反映」をクリックします。</li>
                                        <li>間違えて開始した場合は、詳細画面から「中止」を選択できます。</li>
                                    </ol>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
                <Button onClick={handleCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    棚卸開始
                </Button>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>開始日時</TableHead>
                        <TableHead>ステータス</TableHead>
                        <TableHead>完了日時</TableHead>
                        <TableHead>備考</TableHead>
                        <TableHead>アクション</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {counts.map((count) => (
                        <TableRow key={count.id}>
                            <TableCell>{count.id}</TableCell>
                            <TableCell>{format(new Date(count.startedAt), "yyyy/MM/dd HH:mm", { locale: ja })}</TableCell>
                            <TableCell>
                                <span className={`px-2 py-1 rounded text-xs font-bold ${count.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                    count.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                                        count.status === 'CANCELLED' ? 'bg-gray-100 text-gray-500 line-through' :
                                            'bg-gray-100 text-gray-800'
                                    }`}>
                                    {count.status === 'IN_PROGRESS' ? '実施中' :
                                        count.status === 'COMPLETED' ? '完了' :
                                            count.status === 'CANCELLED' ? '中止' : count.status}
                                </span>
                            </TableCell>
                            <TableCell>{count.endedAt ? format(new Date(count.endedAt), "yyyy/MM/dd HH:mm", { locale: ja }) : "-"}</TableCell>
                            <TableCell>{count.note}</TableCell>
                            <TableCell>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => router.push(`/admin/inventory/${count.id}`)}
                                >
                                    詳細/入力
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
