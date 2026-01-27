"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCartStore } from "@/lib/store";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export function ManualProductDialog() {
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
            productId: -Date.now(), // Use negative timestamp as temporary ID
            name: name.trim(),
            price: 0,
            quantity: quantityNum,
            isManual: true,
        });

        toast.success(`「${name}」をカートに追加しました`);

        // Reset and close
        setName("");
        setQuantity("1");
        setOpen(false);
    };

    return (
        <>
            <Button
                variant="outline"
                className="w-full h-full border-dashed border-2 flex flex-col gap-2 hover:bg-slate-50 min-h-[160px]"
                onClick={() => setOpen(true)}
            >
                <div className="rounded-full bg-slate-100 p-3">
                    <Plus className="w-6 h-6 text-slate-500" />
                </div>
                <span className="font-bold text-slate-600">手入力で追加</span>
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>手入力商品の追加</DialogTitle>
                        <DialogDescription>
                            マスタに登録されていない商品を登録します。<br />
                            ※この商品の在庫管理は行われません。
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">商品名</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="エアコン部材の具体的な商品名（例：LD-70-I ※アイボリー）"
                                autoFocus
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="quantity">数量</Label>
                                <Input
                                    id="quantity"
                                    type="number"
                                    min="1"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                キャンセル
                            </Button>
                            <Button type="submit">
                                カートに追加
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
