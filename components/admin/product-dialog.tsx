"use client";

import { useState, useEffect } from "react";
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
import { Loader2 } from "lucide-react";
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
        code: string;
        name: string;
        category: string;
        subCategory?: string | null;
        productType?: string | null;
        priceA: number;
        priceB: number;
        priceC: number;
        stock: number;
        minStock: number;
        cost: number;
        unit: string;
        orderUnit?: number;
        supplier?: string | null;
        color?: string | null;
        manufacturer?: string | null;
        quantityPerBox?: number;
        pricePerBox?: number;
    } | null;
    initialValues?: {
        name?: string;
        priceA?: number;
    };
    attributeOptions?: {
        categories: string[];
        subCategories: string[];
        productTypes?: string[]; // Add this
        suppliers: string[];
    };
    onSuccess: () => void;
}

export function ProductDialog({ open, onOpenChange, product, initialValues, attributeOptions, onSuccess }: ProductDialogProps) {
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);

        try {
            await upsertProduct({
                id: product?.id,
                code: formData.get("code") as string,
                name: formData.get("name") as string,
                color: formData.get("color") as string || null,
                category: formData.get("category") as string,
                subCategory: formData.get("subCategory") as string || null,
                productType: formData.get("productType") as string || null,
                priceA: Number(formData.get("priceA")),
                priceB: Number(formData.get("priceB")),
                priceC: Number(formData.get("priceC")),
                stock: Number(formData.get("stock")),
                minStock: Number(formData.get("minStock")),
                cost: Number(formData.get("cost")),
                supplier: formData.get("supplier") as string || null,
                unit: formData.get("unit") as string || "個",
                manufacturer: formData.get("manufacturer") as string || null,
                quantityPerBox: Number(formData.get("quantityPerBox")) || 1,
                pricePerBox: Number(formData.get("pricePerBox")) || 0,
            });

            toast.success(product ? "商品を更新しました" : "商品を登録しました");
            onOpenChange(false);
            onSuccess();
        } catch (error: any) {
            toast.error(error.message || "エラーが発生しました");
        } finally {
            setLoading(false);
        }
    }

    // State for reactive UI (Manual Price Indicator)
    const [currentCost, setCurrentCost] = useState(product?.cost || 0);
    const [currentPriceA, setCurrentPriceA] = useState(initialValues?.priceA || product?.priceA || 0);
    const [currentPriceB, setCurrentPriceB] = useState(product?.priceB || 0);

    // 【重要】ダイアログが開かれた時、または商品が変わった時にstateを同期する
    // useStateはマウント時のみ初期化されるため、propが変わっても自動では更新されない
    useEffect(() => {
        if (open) {
            // ダイアログが開かれたタイミングで、productから値を再設定
            setCurrentCost(product?.cost || 0);
            setCurrentPriceA(initialValues?.priceA || product?.priceA || 0);
            setCurrentPriceB(product?.priceB || 0);
        }
    }, [open, product, initialValues?.priceA]);

    const handleCostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        const newCost = Number(val);

        // Update input storage
        // Pre-calculation checks to decide whether to update Price A/B automatically
        // If current Price A matches the "Old Calculated Price A" (based on currentCost), then update it.
        // Otherwise, it's manually set, so leave it alone.

        const oldCalculatedA = Math.ceil(currentCost * 1.20);
        const oldCalculatedB = Math.ceil(currentCost * 1.15);

        // Check if currently auto-calculated (before this change)
        // If product is new (currentCost=0), always auto-calc unless user typed price first
        const isAutoA = currentPriceA === oldCalculatedA || currentCost === 0;
        const isAutoB = currentPriceB === oldCalculatedB || currentCost === 0;

        setCurrentCost(isNaN(newCost) ? 0 : newCost);

        if (!isNaN(newCost) && newCost > 0) {
            // Only update if it was previously auto-calculated
            if (isAutoA) {
                setCurrentPriceA(Math.ceil(newCost * 1.20));
            }
            if (isAutoB) {
                setCurrentPriceB(Math.ceil(newCost * 1.15));
            }
        }
    };

    // Calculate manual status based on CURRENT cost (newCost)
    // If currentPrice doesn't match Math.ceil(currentCost * rate), it's manual.
    const expectedPriceA = Math.ceil(currentCost * 1.20);
    const expectedPriceB = Math.ceil(currentCost * 1.15);

    // Only show "Manual" if cost is > 0
    const isManualPriceA = currentCost > 0 && currentPriceA !== expectedPriceA;
    const isManualPriceB = currentCost > 0 && currentPriceB !== expectedPriceB;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{product ? "商品編集" : "商品登録"}</DialogTitle>
                    <DialogDescription>
                        商品情報の入力を行います。
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid gap-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label htmlFor="code" className="text-right text-sm font-medium">
                                    ID/型番
                                </label>
                                <Input
                                    id="code"
                                    name="code"
                                    defaultValue={product?.code || ""}
                                    className="col-span-3"
                                    placeholder="JANコード等"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label htmlFor="color" className="text-right text-sm font-medium">
                                    色
                                </label>
                                <Input
                                    id="color"
                                    name="color"
                                    defaultValue={product?.color || ""}
                                    placeholder="例: アイボリー"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label htmlFor="unit" className="text-right text-sm font-medium">
                                    単位
                                </label>
                                <Input
                                    id="unit"
                                    name="unit"
                                    defaultValue={product?.unit || "個"}
                                    className="col-span-3"
                                    placeholder="例: 個"
                                    list="unit-options"
                                />
                                <datalist id="unit-options">
                                    <option value="個" />
                                    <option value="本" />
                                    <option value="m" />
                                    <option value="箱" />
                                    <option value="セット" />
                                    <option value="台" />
                                    <option value="枚" />
                                </datalist>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label htmlFor="category" className="text-right text-sm font-medium">
                                    カテゴリ
                                </label>
                                <Input
                                    id="category"
                                    name="category"
                                    defaultValue={product?.category || ""}
                                    className="col-span-3"
                                    placeholder="例: 電動工具"
                                    required
                                    list="category-options"
                                />
                                <datalist id="category-options">
                                    {attributeOptions?.categories.map((c) => (
                                        <option key={c} value={c} />
                                    ))}
                                </datalist>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label htmlFor="subCategory" className="text-right text-sm font-medium">
                                    サブカテゴリ
                                </label>
                                <Input
                                    id="subCategory"
                                    name="subCategory"
                                    defaultValue={product?.subCategory || ""}
                                    className="col-span-3"
                                    placeholder="例: ドリル"
                                    list="subCategory-options"
                                />
                                <datalist id="subCategory-options">
                                    {attributeOptions?.subCategories.map((c) => (
                                        <option key={c} value={c} />
                                    ))}
                                </datalist>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label htmlFor="productType" className="text-right text-sm font-medium">
                                    カテゴリ(小)
                                </label>
                                <Input
                                    id="productType"
                                    name="productType"
                                    defaultValue={product?.productType || ""}
                                    className="col-span-3"
                                    placeholder="例: 直管"
                                    list="productType-options"
                                />
                                <datalist id="productType-options">
                                    {attributeOptions?.productTypes?.map((c) => (
                                        <option key={c} value={c} />
                                    ))}
                                </datalist>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label htmlFor="supplier" className="text-right text-sm font-medium">
                                    仕入先
                                </label>
                                <Input
                                    id="supplier"
                                    name="supplier"
                                    defaultValue={product?.supplier || ""}
                                    className="col-span-3"
                                    placeholder="メーカー名"
                                    list="supplier-options"
                                />
                                <datalist id="supplier-options">
                                    {attributeOptions?.suppliers.map((s) => (
                                        <option key={s} value={s} />
                                    ))}
                                </datalist>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label htmlFor="manufacturer" className="text-right text-sm font-medium">
                                    メーカー
                                </label>
                                <Input
                                    id="manufacturer"
                                    name="manufacturer"
                                    defaultValue={product?.manufacturer || ""}
                                    className="col-span-3"
                                    placeholder="メーカー名"
                                />
                            </div>

                            <div className="col-span-2 border-t my-2"></div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <label htmlFor="name" className="text-right text-sm font-medium">
                                    商品名
                                </label>
                                <Input
                                    id="name"
                                    name="name"
                                    defaultValue={initialValues?.name || product?.name || ""}
                                    className="col-span-3"
                                    required
                                />
                            </div>

                            {/* Cost Input */}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label htmlFor="cost" className="text-right text-sm font-medium">
                                    仕入原価
                                </label>
                                <Input
                                    id="cost"
                                    name="cost"
                                    type="number"
                                    value={currentCost}
                                    className="col-span-3"
                                    required
                                    onChange={handleCostChange}
                                />
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <label htmlFor="priceA" className="text-right text-sm font-medium">
                                    販売単価 A
                                </label>
                                <div className="col-span-3 flex items-center gap-2">
                                    <Input
                                        id="priceA"
                                        name="priceA"
                                        type="number"
                                        value={currentPriceA}
                                        onChange={(e) => setCurrentPriceA(Number(e.target.value))}
                                        className={`flex-1 ${isManualPriceA ? "border-orange-500 bg-orange-50" : ""}`}
                                        required
                                    />
                                    {isManualPriceA ? (
                                        <span className="text-xs text-orange-600 font-bold whitespace-nowrap">手動設定中</span>
                                    ) : (
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">(原価 × 1.20)</span>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label htmlFor="priceB" className="text-right text-sm font-medium">
                                    販売単価 B
                                </label>
                                <div className="col-span-3 flex items-center gap-2">
                                    <Input
                                        id="priceB"
                                        name="priceB"
                                        type="number"
                                        value={currentPriceB}
                                        onChange={(e) => setCurrentPriceB(Number(e.target.value))}
                                        className={`flex-1 ${isManualPriceB ? "border-orange-500 bg-orange-50" : ""}`}
                                        required
                                    />
                                    {isManualPriceB ? (
                                        <span className="text-xs text-orange-600 font-bold whitespace-nowrap">手動設定中</span>
                                    ) : (
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">(原価 × 1.15)</span>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label htmlFor="priceC" className="text-right text-sm font-medium">
                                    販売単価 C
                                </label>
                                <div className="col-span-3 flex items-center gap-2">
                                    <Input
                                        id="priceC"
                                        name="priceC"
                                        type="number"
                                        defaultValue={product?.priceC || 0}
                                        className="flex-1"
                                        required
                                    />
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">(掛率)</span>
                                </div>
                            </div>

                            <div className="col-span-2 border-t my-2"></div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <label htmlFor="stock" className="text-right text-sm font-medium">
                                    現在在庫
                                </label>
                                <Input
                                    id="stock"
                                    name="stock"
                                    type="number"
                                    defaultValue={product?.stock || 0}
                                    className="col-span-3"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label htmlFor="minStock" className="text-right text-sm font-medium">
                                    最低在庫
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
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label htmlFor="orderUnit" className="text-right text-sm font-medium">
                                    発注単位
                                </label>
                                <Input
                                    id="orderUnit"
                                    name="orderUnit"
                                    type="number"
                                    defaultValue={product?.orderUnit ?? 1}
                                    className="col-span-3"
                                    required
                                    min="1"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label htmlFor="quantityPerBox" className="text-right text-sm font-medium">
                                    箱入数
                                </label>
                                <Input
                                    id="quantityPerBox"
                                    name="quantityPerBox"
                                    type="number"
                                    min="1"
                                    defaultValue={product?.quantityPerBox || 1}
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label htmlFor="pricePerBox" className="text-right text-sm font-medium">
                                    箱単価
                                </label>
                                <Input
                                    id="pricePerBox"
                                    name="pricePerBox"
                                    type="number"
                                    min="0"
                                    defaultValue={product?.pricePerBox || 0}
                                    className="col-span-3"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            キャンセル
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            保存
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
