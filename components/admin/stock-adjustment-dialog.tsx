"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { adjustStock } from "@/lib/actions";
import { getDiscrepancyCandidates, type DiscrepancyCandidate } from "@/lib/discrepancy-detection";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Search, AlertTriangle, CheckCircle, HelpCircle } from "lucide-react";

interface StockAdjustmentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    product: { id: number; name: string; stock: number } | null;
    onSuccess: () => void;
}

const confidenceConfig = {
    high: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50 border-green-200", label: "高" },
    medium: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50 border-amber-200", label: "中" },
    low: { icon: HelpCircle, color: "text-slate-500", bg: "bg-slate-50 border-slate-200", label: "低" },
};

export function StockAdjustmentDialog({ open, onOpenChange, product, onSuccess }: StockAdjustmentDialogProps) {
    const [loading, setLoading] = useState(false);
    const [type, setType] = useState("RESTOCK");
    const [quantity, setQuantity] = useState(0);
    const [candidates, setCandidates] = useState<DiscrepancyCandidate[]>([]);
    const [searching, setSearching] = useState(false);

    // 推測候補を取得（数量変更後500msのデバウンス）
    const fetchCandidates = useCallback(async () => {
        if (!product || quantity === 0) {
            setCandidates([]);
            return;
        }

        // 差異を計算（出庫=マイナス差異、入庫=プラス差異、訂正=そのまま）
        let discrepancy = quantity;
        if (type === "DISPOSAL" || type === "OUT") {
            discrepancy = -Math.abs(quantity);
        }

        setSearching(true);
        try {
            const results = await getDiscrepancyCandidates(product.id, discrepancy);
            setCandidates(results);
        } catch (err) {
            console.error("推測候補の取得に失敗:", err);
            setCandidates([]);
        } finally {
            setSearching(false);
        }
    }, [product, quantity, type]);

    useEffect(() => {
        if (!product || quantity === 0) {
            setCandidates([]);
            return;
        }
        const timer = setTimeout(fetchCandidates, 500);
        return () => clearTimeout(timer);
    }, [quantity, type, fetchCandidates, product]);

    // ダイアログが閉じたらリセット
    useEffect(() => {
        if (!open) {
            setCandidates([]);
            setQuantity(0);
            setType("RESTOCK");
        }
    }, [open]);

    if (!product) return null;

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!product) return;
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const quantityInput = Number(formData.get("quantity"));
        const reason = formData.get("reason") as string;

        let finalQuantity = quantityInput;
        if (type === "DISPOSAL" || type === "OUT") {
            finalQuantity = -Math.abs(quantityInput);
        } else if (type === "CORRECTION") {
            finalQuantity = quantityInput;
        }

        try {
            await adjustStock(product.id, type, finalQuantity, reason);
            toast.success("在庫を調整しました");
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            toast.error("エラーが発生しました");
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                    <DialogTitle>在庫調整: {product.name}</DialogTitle>
                    <DialogDescription>
                        現在在庫: {product.stock}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label className="text-right text-sm font-medium">区分</label>
                            <div className="col-span-3">
                                <Select value={type} onValueChange={setType}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="区分を選択" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="RESTOCK">入庫 (＋)</SelectItem>
                                        <SelectItem value="DISPOSAL">廃棄・出庫 (－)</SelectItem>
                                        <SelectItem value="CORRECTION">在庫訂正 (±)</SelectItem>
                                        <SelectItem value="RETURN">返品戻り (＋)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="quantity" className="text-right text-sm font-medium">
                                数量
                            </label>
                            <Input
                                id="quantity"
                                name="quantity"
                                type="number"
                                defaultValue={0}
                                className="col-span-3"
                                required
                                onChange={(e) => setQuantity(Number(e.target.value))}
                            />
                            <p className="col-start-2 col-span-3 text-xs text-slate-500">
                                ※入庫は正の値、廃棄は負の値が適用されます。<br />
                                修正(±)の場合は増減値を入力してください(例: -5 で5個減)。
                            </p>
                        </div>

                        <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="reason" className="text-right text-sm font-medium">
                                理由/備考
                            </label>
                            <Input
                                id="reason"
                                name="reason"
                                className="col-span-3"
                                placeholder="例: 定期発注分, 破損のため"
                            />
                        </div>

                        {/* 🔍 誤入力推測パネル */}
                        {(candidates.length > 0 || searching) && (
                            <div className="border rounded-lg p-3 bg-blue-50/50">
                                <div className="flex items-center gap-2 mb-2">
                                    <Search className="w-4 h-4 text-blue-600" />
                                    <span className="text-sm font-medium text-blue-800">
                                        🔍 原因候補の推測
                                    </span>
                                    {searching && (
                                        <span className="text-xs text-blue-500 animate-pulse">検索中...</span>
                                    )}
                                </div>

                                {candidates.length > 0 ? (
                                    <div className="space-y-1.5">
                                        {candidates.map((c, i) => {
                                            const conf = confidenceConfig[c.confidence];
                                            const Icon = conf.icon;
                                            const dateStr = new Date(c.date).toLocaleDateString("ja-JP", {
                                                month: "short",
                                                day: "numeric",
                                            });
                                            return (
                                                <div
                                                    key={`${c.transactionId}-${i}`}
                                                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded border text-sm ${conf.bg}`}
                                                >
                                                    <Icon className={`w-3.5 h-3.5 shrink-0 ${conf.color}`} />
                                                    <span className={`text-xs font-bold ${conf.color} min-w-[32px]`}>
                                                        {c.score}%
                                                    </span>
                                                    <span className="text-slate-700 truncate">
                                                        {dateStr} {c.vendorName}
                                                        「{c.productCode || c.productName}」
                                                        {c.quantity}個
                                                    </span>
                                                    <span className="ml-auto text-xs text-slate-500 shrink-0 hidden sm:inline">
                                                        {c.reason}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                        <p className="text-xs text-slate-500 mt-1">
                                            ※ 過去30日の取引から推測しています
                                        </p>
                                    </div>
                                ) : searching ? null : (
                                    <p className="text-xs text-slate-500">候補が見つかりませんでした</p>
                                )}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            キャンセル
                        </Button>
                        <Button type="submit" disabled={loading}>
                            実行
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
