"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCartStore } from "@/lib/store";
import { toast } from "sonner";
import { Plus } from "lucide-react";

interface ManualProductSheetProps {
    trigger?: React.ReactNode;
}

export function ManualProductSheet({ trigger }: ManualProductSheetProps) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [quantity, setQuantity] = useState("1");

    const addItem = useCartStore((state) => state.addItem);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const quantityNum = parseInt(quantity);

        if (!name.trim()) {
            toast.error("商品名を入力してください");
            return;
        }
        if (isNaN(quantityNum) || quantityNum < 1) {
            toast.error("数量は1以上で入力してください");
            return;
        }

        addItem({
            productId: -Date.now(),
            name: name.trim(),
            price: 0, // Always 0 for manual items
            quantity: quantityNum,
            isManual: true,
        });

        toast.success(`「${name}」をカートに追加しました`);
        setName("");
        setQuantity("1");
        setOpen(false);
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        手入力追加
                    </Button>
                )}
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:w-[540px] pt-12 overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>手入力商品の追加</SheetTitle>
                    <SheetDescription>
                        マスタに登録されていない商品を一時的に追加します。
                    </SheetDescription>
                </SheetHeader>
                <form onSubmit={handleSubmit} className="space-y-6 py-6">
                    <div className="space-y-2">
                        <Label htmlFor="manual-name">商品名</Label>
                        <Input
                            id="manual-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="詳細に記入してください（例：LD-70-I アイボリー、型番・色・サイズなど）"
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="manual-quantity">数量</Label>
                        <Input
                            id="manual-quantity"
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                        />
                    </div>

                    {/* Buttons moved up directly below form */}
                    <div className="flex justify-end gap-2 pt-2">
                        <SheetClose asChild>
                            <Button type="button" variant="outline">キャンセル</Button>
                        </SheetClose>
                        <Button type="submit" className="bg-slate-900 text-white hover:bg-slate-800">
                            カートに追加
                        </Button>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
}
