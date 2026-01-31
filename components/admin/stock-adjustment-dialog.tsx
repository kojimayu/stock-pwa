"use client";

import { useState } from "react";
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
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
// Textarea if available, else Input

// Using standard Input for Textarea as simplicity if component missing, but standard shadcn has Textarea.
// I'll assume standard HTML textArea if shadcn Textarea is not installed, or check later.
// For safety, I'll use standard Input for reason now.

interface StockAdjustmentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    product: { id: number; name: string; stock: number } | null;
    onSuccess: () => void;
}

export function StockAdjustmentDialog({ open, onOpenChange, product, onSuccess }: StockAdjustmentDialogProps) {
    const [loading, setLoading] = useState(false);
    const [type, setType] = useState("RESTOCK"); // RESTOCK, CORRECTION, DISPOSAL, OTHER

    if (!product) return null;

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!product) return;
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const quantityInput = Number(formData.get("quantity"));
        const reason = formData.get("reason") as string;

        // Logic: 
        // If RESTOCK (入庫), quantity added (+).
        // If DISPOSAL (廃棄/出庫), quantity subtracted (-).
        // If CORRECTION (棚卸修正), user inputs difference? Or inputs absolute value?
        // User interface usually prefers "How many to add/remove?"
        // Let's adopt: User inputs positive number, we calculate sign based on Type.

        let finalQuantity = quantityInput;
        if (type === "DISPOSAL" || type === "OUT") {
            finalQuantity = -Math.abs(quantityInput);
        } else if (type === "CORRECTION") {
            // Correction is tricky. Usually "New Total" is easier for Tanaoroshi.
            // Let's keep it simple: "Adjustment Amount" (+/-) for now as per "Serious" but manual log.
            // If user wants "New Total", we need to calculate difference.
            // Let's stick to simple Add/Sub logic for now to avoid confusion, or allow negative input.
            // Let's assume input is "Change Amount".
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
            <DialogContent className="sm:max-w-[425px]">
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
                            />
                            <p className="col-start-2 col-span-3 text-xs text-slate-500">
                                ※入庫は正の値、廃棄は負の値が適用されます(ロジック依存)。<br />
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
