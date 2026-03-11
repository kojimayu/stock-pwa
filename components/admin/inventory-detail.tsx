"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { ArrowLeft, CheckCircle, XCircle, Search, CircleCheck, Circle } from "lucide-react";
import { getInventoryCount, updateInventoryItem, finalizeInventory, cancelInventory, checkInventoryItem, uncheckInventoryItem } from "@/lib/actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn, normalizeForSearch } from "@/lib/utils";

interface InventoryDetailProps {
    id: number;
}

export function InventoryDetail({ id }: InventoryDetailProps) {
    const [inventory, setInventory] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState("すべて");
    const [searchQuery, setSearchQuery] = useState("");
    const [adminName, setAdminName] = useState("管理者");
    const router = useRouter();
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // 管理者名をlocalStorageから取得
    useEffect(() => {
        const name = localStorage.getItem('adminName');
        if (name) setAdminName(name);
        else {
            const email = localStorage.getItem('adminEmail');
            if (email) setAdminName(email);
        }
    }, []);

    const loadData = useCallback(async () => {
        try {
            const data = await getInventoryCount(id);
            setInventory(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // 5秒ポーリング（棚卸進行中のみ）
    useEffect(() => {
        if (inventory?.status === 'IN_PROGRESS') {
            pollingRef.current = setInterval(() => {
                loadData();
            }, 5000);
        }
        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [inventory?.status, loadData]);

    // カテゴリー一覧を取得
    const categories = useMemo(() => {
        if (!inventory?.items) return [];
        const cats = new Set(inventory.items.map((item: any) => item.product.category));
        return Array.from(cats).sort() as string[];
    }, [inventory]);

    // フィルタリングされた商品
    const filteredItems = useMemo(() => {
        if (!inventory?.items) return [];

        let items = inventory.items;

        // 1. Category Filter
        if (selectedCategory !== "すべて") {
            items = items.filter((item: any) => item.product.category === selectedCategory);
        }

        // 2. Search Query
        if (searchQuery) {
            const query = normalizeForSearch(searchQuery);
            items = items.filter((item: any) =>
                normalizeForSearch(item.product.name).includes(query) ||
                (item.product.code && normalizeForSearch(item.product.code).includes(query))
            );
        }

        return items;
    }, [inventory, selectedCategory, searchQuery]);

    // 進捗計算（確認OK済み件数）
    const progress = useMemo(() => {
        if (!inventory?.items) return { checked: 0, total: 0 };
        const total = inventory.items.length;
        const checked = inventory.items.filter((item: any) => item.checkedBy).length;
        return { checked, total };
    }, [inventory]);

    const allChecked = progress.checked === progress.total && progress.total > 0;

    const handleStockChange = async (itemId: number, newValue: string, reason?: string) => {
        // 空文字（クリア）を許容
        if (newValue === "") {
            setInventory((prev: any) => ({
                ...prev,
                items: prev.items.map((item: any) =>
                    item.id === itemId ? { ...item, actualStock: "", reason: null } : item
                )
            }));
            return;
        }
        const num = parseInt(newValue, 10);
        if (isNaN(num) || num < 0) return;

        // Optimistic update
        setInventory((prev: any) => ({
            ...prev,
            items: prev.items.map((item: any) => {
                if (item.id === itemId) {
                    const adjustment = num - item.expectedStock;
                    return {
                        ...item,
                        actualStock: num,
                        adjustment,
                        reason: adjustment !== 0 ? (reason || item.reason) : null
                    };
                }
                return item;
            })
        }));

        try {
            // Find the current item to get the latest reason if not provided
            const currentItem = inventory.items.find((i: any) => i.id === itemId);
            const adjustment = num - currentItem.expectedStock;
            const finalReason = adjustment !== 0 ? (reason || currentItem.reason) : undefined;

            await updateInventoryItem(itemId, num, finalReason);
        } catch (error) {
            console.error(error);
            toast.error("更新に失敗しました");
            loadData();
        }
    };

    const handleCheck = async (itemId: number) => {
        // Optimistic update
        setInventory((prev: any) => ({
            ...prev,
            items: prev.items.map((item: any) =>
                item.id === itemId ? { ...item, checkedBy: adminName, checkedAt: new Date().toISOString() } : item
            )
        }));

        try {
            await checkInventoryItem(itemId, adminName);
        } catch (error) {
            console.error(error);
            toast.error("チェックに失敗しました");
            loadData();
        }
    };

    const handleUncheck = async (itemId: number) => {
        // Optimistic update
        setInventory((prev: any) => ({
            ...prev,
            items: prev.items.map((item: any) =>
                item.id === itemId ? { ...item, checkedBy: null, checkedAt: null } : item
            )
        }));

        try {
            await uncheckInventoryItem(itemId);
        } catch (error) {
            console.error(error);
            toast.error("チェック解除に失敗しました");
            loadData();
        }
    };

    const handleFinalize = async () => {
        if (!allChecked) {
            toast.error(`未確認の商品が ${progress.total - progress.checked} 件あります。全てOKしてから確定してください。`);
            return;
        }
        if (!confirm("棚卸を確定しますか？\n差異のある商品の在庫が更新されます。")) return;

        setSaving(true);
        try {
            const result = await finalizeInventory(id);
            if (result.success) {
                toast.success("棚卸を確定しました");
                router.push('/admin/inventory');
            } else {
                toast.error(result.message || "確定に失敗しました");
                setSaving(false);
            }
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

    if (loading) return <div className="p-4 text-center">読み込み中...</div>;
    if (!inventory) return (
        <div className="p-4">
            <Button variant="ghost" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                戻る
            </Button>
            <div className="text-center py-8">データが見つかりません</div>
        </div>
    );

    const isCompleted = inventory.status === 'COMPLETED';
    const isCancelled = inventory.status === 'CANCELLED';

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Header - Sticky */}
            <header className="bg-slate-900 text-white p-3 sticky top-0 z-40 shadow-md">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="text-white hover:bg-slate-800 p-1" onClick={() => router.back()}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-base font-bold">棚卸 #{inventory.id}</h1>
                            <p className="text-[10px] text-slate-300">
                                {format(new Date(inventory.startedAt), "yyyy/MM/dd HH:mm", { locale: ja })}
                            </p>
                        </div>
                    </div>
                    <Badge variant={isCompleted ? "default" : isCancelled ? "outline" : "secondary"} className="text-xs">
                        {isCompleted ? "完了" : isCancelled ? "中止" : "実施中"}
                    </Badge>
                </div>

                {/* Progress Bar */}
                {!isCompleted && !isCancelled && (
                    <div className="mt-2">
                        <div className="flex justify-between text-xs text-slate-300 mb-1">
                            <span>確認OK</span>
                            <span className={allChecked ? "text-green-400 font-bold" : ""}>{progress.checked} / {progress.total} 件</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2">
                            <div
                                className={cn(
                                    "h-2 rounded-full transition-all",
                                    allChecked ? "bg-green-500" : "bg-blue-500"
                                )}
                                style={{ width: `${progress.total > 0 ? (progress.checked / progress.total) * 100 : 0}%` }}
                            />
                        </div>
                    </div>
                )}
            </header>

            {/* Category & Filter Bar - Sticky */}
            <div className="sticky top-[90px] z-30 bg-white border-b overflow-x-auto">
                <div className="flex gap-1 p-2 px-4">
                    <button
                        onClick={() => setSelectedCategory("すべて")}
                        className={cn(
                            "whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-colors border shadow-sm",
                            selectedCategory === "すべて"
                                ? "bg-slate-800 text-white border-slate-800"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        )}
                    >
                        すべて ({inventory.items.length})
                    </button>
                    {categories.map((cat) => {
                        const count = inventory.items.filter((i: any) => i.product.category === cat).length;
                        const checkedCount = inventory.items.filter((i: any) => i.product.category === cat && i.checkedBy).length;
                        return (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={cn(
                                    "whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-colors border shadow-sm",
                                    selectedCategory === cat
                                        ? "bg-slate-800 text-white border-slate-800"
                                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                )}
                            >
                                {cat} ({checkedCount}/{count})
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Search Bar - Sticky (below category) */}
            <div className="sticky top-[125px] z-20 bg-white border-b px-4 py-2">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                    <Input
                        type="search"
                        placeholder="商品名・品番で検索..."
                        className="pl-9 bg-slate-50"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Item List - Card Based */}
            <div className="flex-1 pb-24">
                {filteredItems.map((item: any) => {
                    const isChecked = !!item.checkedBy;
                    return (
                        <div
                            key={item.id}
                            className={cn(
                                "bg-white border-b p-4",
                                isChecked ? "bg-green-50" : item.adjustment !== 0 ? "bg-yellow-50" : ""
                            )}
                        >
                            {/* Product Info */}
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                            {item.product.category}
                                        </span>
                                        <span className="text-xs text-slate-400 font-mono">{item.product.code}</span>
                                    </div>
                                    <div className="font-bold text-slate-900 leading-snug line-clamp-2">
                                        {item.product.name}
                                    </div>
                                </div>
                                {/* Adjustment Badge */}
                                <div className={cn(
                                    "text-sm font-bold px-2 py-1 rounded min-w-[50px] text-center",
                                    item.adjustment < 0 ? "bg-red-100 text-red-600" :
                                        item.adjustment > 0 ? "bg-blue-100 text-blue-600" :
                                            "bg-gray-100 text-gray-400"
                                )}>
                                    {item.adjustment > 0 ? "+" : ""}{item.adjustment}
                                </div>
                            </div>

                            {/* Stock Input Row + OK Button */}
                            <div className="flex items-center gap-3 mt-3">
                                <div className="text-sm text-slate-500">
                                    帳簿: <span className="font-bold text-slate-700">{item.expectedStock}</span>
                                    {item.product.unit && <span className="text-xs ml-1">{item.product.unit}</span>}
                                </div>
                                <div className="flex-1 flex items-center gap-2">
                                    <span className="text-sm text-slate-500">実在庫:</span>
                                    {isCompleted || isCancelled ? (
                                        <span className="font-bold text-lg">{item.actualStock}</span>
                                    ) : (
                                        <Input
                                            type="number"
                                            inputMode="numeric"
                                            className="w-24 text-center text-lg font-bold h-12"
                                            value={item.actualStock}
                                            onChange={(e) => handleStockChange(item.id, e.target.value)}
                                            onFocus={(e) => {
                                                e.target.select();
                                                setTimeout(() => {
                                                    e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                }, 300);
                                            }}
                                            onBlur={() => {
                                                if (item.actualStock === "") {
                                                    handleStockChange(item.id, "0");
                                                }
                                            }}
                                        />
                                    )}
                                </div>

                                {/* OK Button */}
                                {!isCompleted && !isCancelled && (
                                    <button
                                        onClick={() => isChecked ? handleUncheck(item.id) : handleCheck(item.id)}
                                        className={cn(
                                            "flex items-center gap-1 px-3 py-2 rounded-lg font-bold text-sm transition-all",
                                            isChecked
                                                ? "bg-green-500 text-white hover:bg-green-600 shadow-sm"
                                                : "bg-slate-100 text-slate-400 hover:bg-slate-200 border border-slate-200",
                                            item.adjustment !== 0 && !item.reason ? "opacity-50 cursor-not-allowed" : ""
                                        )}
                                        disabled={item.adjustment !== 0 && !item.reason}
                                    >
                                        {isChecked ? (
                                            <CircleCheck className="h-5 w-5" />
                                        ) : (
                                            <Circle className="h-5 w-5" />
                                        )}
                                        OK
                                    </button>
                                )}
                            </div>

                            {/* 差異がある場合の理由入力 */}
                            {item.adjustment !== 0 && (
                                <div className="mt-3 bg-red-50 p-3 rounded-md border border-red-100">
                                    <label className="block text-xs font-bold text-red-800 mb-1">
                                        ⚠️ 差異理由をご選択ください ({item.adjustment > 0 ? `+${item.adjustment}` : item.adjustment})
                                    </label>
                                    {isCompleted || isCancelled ? (
                                        <div className="text-sm font-medium">{item.reason || "理由未設定"}</div>
                                    ) : (
                                        <select
                                            className={cn(
                                                "w-full text-sm border rounded-md p-2 bg-white",
                                                !item.reason ? "border-red-400 focus:ring-red-400" : "border-slate-300"
                                            )}
                                            value={item.reason || ""}
                                            onChange={(e) => handleStockChange(item.id, String(item.actualStock), e.target.value)}
                                        >
                                            <option value="" disabled>-- 理由を選択してください --</option>
                                            <option value="数え間違い">入力・数え間違い（修正）</option>
                                            <option value="記録漏れ">出庫/入庫の記録漏れ</option>
                                            <option value="破損・劣化">破損・劣化による廃棄</option>
                                            <option value="紛失・不明">紛失・原因不明</option>
                                            {inventory?.type === 'SPOT' && <option value="他案件流用">他案件への流用</option>}
                                            <option value="その他">その他</option>
                                        </select>
                                    )}
                                </div>
                            )}

                            {/* Checked Info */}
                            {isChecked && (
                                <div className="mt-2 text-xs text-green-600">
                                    ✅ {item.checkedBy} が確認 ({format(new Date(item.checkedAt), "HH:mm", { locale: ja })})
                                </div>
                            )}
                        </div>
                    );
                })}

                {filteredItems.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                        該当する商品がありません
                    </div>
                )}
            </div>

            {/* Footer Actions - Fixed */}
            {!isCompleted && !isCancelled && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4 z-50">
                    <div className="flex gap-3 max-w-lg mx-auto">
                        <Button
                            variant="outline"
                            className="flex-1 h-12 text-red-600 border-red-200 hover:bg-red-50"
                            onClick={handleCancel}
                            disabled={saving}
                        >
                            <XCircle className="mr-2 h-5 w-5" />
                            中止
                        </Button>
                        <Button
                            className={cn(
                                "flex-1 h-12 font-bold text-white",
                                allChecked ? "bg-green-600 hover:bg-green-700" : "bg-slate-300 cursor-not-allowed"
                            )}
                            onClick={handleFinalize}
                            disabled={saving || !allChecked}
                        >
                            <CheckCircle className="mr-2 h-5 w-5" />
                            確定 {!allChecked && `(残${progress.total - progress.checked}件)`}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
