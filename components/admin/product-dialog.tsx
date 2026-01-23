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
import { upsertProduct } from "@/lib/actions";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface ProductDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    product?: {
        id: number;
        name: string;
        category: string;
        priceA: number;
        priceB: number;
        minStock: number;
    } | null;
    onSuccess: () => void;
}

export function ProductDialog({ open, onOpenChange, product, onSuccess }: ProductDialogProps) {
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);

        try {
            await upsertProduct({
                id: product?.id,
                name: formData.get("name") as string,
                category: formData.get("category") as string,
                priceA: Number(formData.get("priceA")),
                priceB: Number(formData.get("priceB")),
                minStock: Number(formData.get("minStock")),
            });
            toast.success(product ? "商品情報を更新しました" : "商品を追加しました");
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
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{product ? "商品情報の編集" : "商品の新規登録"}</DialogTitle>
                    <DialogDescription>
                        基本情報を入力してください。※在庫数の変更は「在庫調整」から行ってください。
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="name" className="text-right text-sm font-medium">
                                商品名
                            </label>
                            <Input
                                id="name"
                                name="name"
                                defaultValue={product?.name || ""}
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="category" className="text-right text-sm font-medium">
                                カテゴリ
                            </label>
                            {/* 簡易的にテキスト入力、本来はマスタ管理かSelect */}
                            <Input
                                id="category"
                                name="category"
                                defaultValue={product?.category || ""}
                                className="col-span-3"
                                placeholder="例: 電動工具, 消耗品"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="priceA" className="text-right text-sm font-medium">
                                価格A (標準)
                            </label>
                            <Input
                                id="priceA"
                                name="priceA"
                                type="number"
                                defaultValue={product?.priceA || 0}
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="priceB" className="text-right text-sm font-medium">
                                価格B (特価)
                            </label>
                            <Input
                                id="priceB"
                                name="priceB"
                                type="number"
                                defaultValue={product?.priceB || 0}
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="minStock" className="text-right text-sm font-medium">
                                下限在庫
                            </label>
                            <Input
                                id="minStock"
                                name="minStock"
                                type="number"
                                defaultValue={product?.minStock || 0}
                                className="col-span-3"
                                required
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            キャンセル
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "保存中..." : "保存"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
