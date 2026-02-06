"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { correctTransactionPrice } from "@/lib/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface PriceCorrectionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    transactionId: number;
    itemIndex: number;
    itemName: string;
    currentPrice: number;
}

export function PriceCorrectionDialog({
    open,
    onOpenChange,
    transactionId,
    itemIndex,
    itemName,
    currentPrice,
}: PriceCorrectionDialogProps) {
    const [newPrice, setNewPrice] = useState(currentPrice.toString());
    const [reason, setReason] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async () => {
        const priceNum = parseInt(newPrice);
        if (isNaN(priceNum) || priceNum < 0) {
            toast.error("有効な価格を入力してください");
            return;
        }

        if (!reason.trim()) {
            toast.error("修正理由を入力してください");
            return;
        }

        setLoading(true);
        try {
            const result = await correctTransactionPrice(
                transactionId,
                itemIndex,
                priceNum,
                reason.trim()
            );

            if (result.success) {
                toast.success("価格を修正しました");
                onOpenChange(false);
                router.refresh();
            } else {
                toast.error(result.message || "価格修正に失敗しました");
            }
        } catch (error) {
            toast.error("エラーが発生しました");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>価格修正</DialogTitle>
                    <DialogDescription>
                        {itemName} の単価を修正します。修正理由は必須です。
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div>
                        <label className="text-sm font-medium block mb-1">
                            現在の価格
                        </label>
                        <div className="text-lg font-bold text-slate-500">
                            ¥{currentPrice.toLocaleString()}
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium block mb-1">
                            新しい価格 <span className="text-red-500">*</span>
                        </label>
                        <Input
                            type="number"
                            inputMode="numeric"
                            value={newPrice}
                            onChange={(e) => setNewPrice(e.target.value)}
                            placeholder="0"
                            className="text-lg"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium block mb-1">
                            修正理由 <span className="text-red-500">*</span>
                        </label>
                        <Textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="例: 特別価格での納品のため"
                            rows={3}
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            ※全管理者にメールで通知されます
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                    >
                        キャンセル
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="bg-red-600 hover:bg-red-700"
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        価格を修正
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
