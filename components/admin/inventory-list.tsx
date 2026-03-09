"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Plus, HelpCircle, ChevronRight, Search, AlertTriangle, ClipboardCheck } from "lucide-react";
import { createInventoryCount, createSpotInventory, getInventoryCounts, getProducts, getStockDiscrepancies } from "@/lib/actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface InventoryCount {
    id: number;
    status: string;
    type: string;
    startedAt: Date;
    endedAt: Date | null;
    note: string | null;
    items: any[];
}

interface ProductOption {
    id: number;
    code: string;
    name: string;
    stock: number;
    category: string;
    hasDiscrepancy?: boolean; // 不一致申告あり
}

export function InventoryList() {
    const [counts, setCounts] = useState<InventoryCount[]>([]);
    const [loading, setLoading] = useState(true);
    const [discrepancyCount, setDiscrepancyCount] = useState(0);
    const router = useRouter();

    // スポット棚卸ダイアログ
    const [spotDialogOpen, setSpotDialogOpen] = useState(false);
    const [products, setProducts] = useState<ProductOption[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [searchText, setSearchText] = useState("");
    const [spotNote, setSpotNote] = useState("");
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        loadCounts();
    }, []);

    const loadCounts = async () => {
        try {
            const [data, discrepancies] = await Promise.all([
                getInventoryCounts(),
                getStockDiscrepancies('PENDING'),
            ]);
            setCounts(data);
            setDiscrepancyCount(discrepancies.length);
        } catch (error) {
            console.error(error);
            toast.error("棚卸データの取得に失敗しました");
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!confirm("新しい一斉棚卸を開始しますか？（全商品が対象になります）")) return;

        try {
            await createInventoryCount();
            toast.success("一斉棚卸を開始しました");
            loadCounts();
        } catch (error: any) {
            toast.error(error?.message || "棚卸の開始に失敗しました");
        }
    };

    const openSpotDialog = async () => {
        setSpotDialogOpen(true);
        setSearchText("");
        setSpotNote("");
        try {
            const [allProducts, discrepancies] = await Promise.all([
                getProducts(),
                getStockDiscrepancies('PENDING'),
            ]);
            const discrepancyProductIds = new Set(discrepancies.map((d: any) => d.productId));
            const productOptions: ProductOption[] = allProducts.map((p: any) => ({
                id: p.id,
                code: p.code,
                name: p.name,
                stock: p.stock,
                category: p.category,
                hasDiscrepancy: discrepancyProductIds.has(p.id),
            }));
            setProducts(productOptions);
            // 申告済み商品を自動選択
            setSelectedIds(new Set(discrepancyProductIds));
        } catch (error) {
            toast.error("商品データの取得に失敗しました");
        }
    };

    const handleStartSpot = async () => {
        if (selectedIds.size === 0) {
            toast.error("商品を選択してください");
            return;
        }
        setCreating(true);
        try {
            await createSpotInventory(Array.from(selectedIds), spotNote || undefined);
            toast.success(`スポット棚卸を開始しました (${selectedIds.size}商品)`);
            setSpotDialogOpen(false);
            loadCounts();
        } catch (error: any) {
            toast.error(error?.message || "棚卸の開始に失敗しました");
        } finally {
            setCreating(false);
        }
    };

    const toggleProduct = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const filteredProducts = products.filter(p => {
        if (!searchText) return true;
        const q = searchText.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    });

    // 申告ありを先頭、その後カテゴリ順
    const sortedProducts = [...filteredProducts].sort((a, b) => {
        if (a.hasDiscrepancy && !b.hasDiscrepancy) return -1;
        if (!a.hasDiscrepancy && b.hasDiscrepancy) return 1;
        return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
    });

    if (loading) return <div className="p-4 text-center">読み込み中...</div>;

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-10">
                <div className="p-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold">棚卸管理</h1>
                        {discrepancyCount > 0 && (
                            <Badge variant="destructive" className="text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                {discrepancyCount}件の不一致報告
                            </Badge>
                        )}
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
                                        <h4 className="font-bold mb-1">棚卸の種類</h4>
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><span className="font-bold text-indigo-600">一斉棚卸</span>: 全商品を対象にした棚卸</li>
                                            <li><span className="font-bold text-amber-600">スポット棚卸</span>: 選択した商品のみの棚卸（不一致申告の商品を含む）</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 className="font-bold mb-1">操作手順</h4>
                                        <ol className="list-decimal pl-5 space-y-1">
                                            <li>「棚卸開始」または「スポット棚卸」をタップ</li>
                                            <li>商品の実在庫数を入力</li>
                                            <li>入力が終わったら「確定」をタップ</li>
                                        </ol>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={openSpotDialog} size="sm" variant="outline" className="h-10">
                            <ClipboardCheck className="mr-1 h-4 w-4" />
                            スポット棚卸
                            {discrepancyCount > 0 && (
                                <Badge variant="destructive" className="ml-1 text-xs px-1 py-0">
                                    {discrepancyCount}
                                </Badge>
                            )}
                        </Button>
                        <Button onClick={handleCreate} size="sm" className="h-10">
                            <Plus className="mr-1 h-4 w-4" />
                            一斉棚卸
                        </Button>
                    </div>
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
                                        variant="outline"
                                        className={cn(
                                            "text-xs",
                                            count.type === 'SPOT'
                                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                                : "bg-indigo-50 text-indigo-700 border-indigo-200"
                                        )}
                                    >
                                        {count.type === 'SPOT' ? 'スポット' : '一斉'}
                                    </Badge>
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
                                    <span className="text-xs text-slate-400">
                                        {count.items?.length || 0}品目
                                    </span>
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

            {/* スポット棚卸ダイアログ */}
            <Dialog open={spotDialogOpen} onOpenChange={setSpotDialogOpen}>
                <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>スポット棚卸</DialogTitle>
                        <DialogDescription>
                            棚卸する商品を選択してください。不一致申告のある商品は自動選択されています。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 flex-1 min-h-0 flex flex-col">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="商品名・コードで検索..."
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Input
                            placeholder="メモ（任意）"
                            value={spotNote}
                            onChange={(e) => setSpotNote(e.target.value)}
                        />
                        <div className="text-xs text-muted-foreground flex justify-between">
                            <span>{selectedIds.size}件選択中</span>
                            <button
                                className="text-blue-600 hover:underline"
                                onClick={() => setSelectedIds(new Set())}
                            >
                                選択解除
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto border rounded-md divide-y min-h-0">
                            {sortedProducts.map(p => (
                                <label
                                    key={p.id}
                                    className={cn(
                                        "flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50",
                                        p.hasDiscrepancy && "bg-red-50"
                                    )}
                                >
                                    <Checkbox
                                        checked={selectedIds.has(p.id)}
                                        onCheckedChange={() => toggleProduct(p.id)}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium truncate">{p.name}</span>
                                            {p.hasDiscrepancy && (
                                                <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                                    <AlertTriangle className="h-3 w-3 mr-0.5" />
                                                    不一致
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {p.code} · {p.category} · 在庫: {p.stock}
                                        </div>
                                    </div>
                                </label>
                            ))}
                            {sortedProducts.length === 0 && (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                    該当する商品がありません
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSpotDialogOpen(false)}>
                            キャンセル
                        </Button>
                        <Button onClick={handleStartSpot} disabled={creating || selectedIds.size === 0}>
                            {creating ? "開始中..." : `棚卸開始 (${selectedIds.size}品目)`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
