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
import { Label } from "@/components/ui/label";
import { upsertVendor } from "@/lib/actions";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
// Simple SWR-like fetch hook or just useEffect for now to avoid adding SWR dep if not present
// Using useEffect for simplicity as SWR might not be configured

interface VendorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    vendor?: { id: number; name: string; pinCode: string; email?: string | null; accessCompanyName?: string | null } | null;
    onSuccess: () => void;
}

interface AccessVendor {
    id: string;
    name: string;
}

export function VendorDialog({ open, onOpenChange, vendor, onSuccess }: VendorDialogProps) {
    const [loading, setLoading] = useState(false);
    const [accessVendors, setAccessVendors] = useState<AccessVendor[]>([]);
    const [loadingAccessVendors, setLoadingAccessVendors] = useState(false);

    // Fetch Access Vendors when dialog opens
    useEffect(() => {
        if (open) {
            setLoadingAccessVendors(true);
            fetch('/api/access/vendors')
                .then(res => res.json())
                .then(data => {
                    if (data.success && Array.isArray(data.data)) {
                        setAccessVendors(data.data);
                    } else {
                        console.error("Failed to fetch access vendors", data);
                        toast.error("Access業者リストの取得に失敗しました");
                    }
                })
                .catch(err => {
                    console.error(err);
                    toast.error("Access業者リストの取得に失敗しました");
                })
                .finally(() => setLoadingAccessVendors(false));
        }
    }, [open]);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const name = formData.get("name") as string;
        const pin = formData.get("pin") as string;
        const accessCompanyName = formData.get("accessCompanyName") as string;

        try {
            await upsertVendor({
                id: vendor?.id,
                name,
                pinCode: pin,
                email: formData.get("email") as string || null,
                accessCompanyName: accessCompanyName === "_none" ? null : (accessCompanyName || null),
            });
            toast.success(vendor ? "業者情報を更新しました" : "業者を追加しました");
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
                    <DialogTitle>{vendor ? "業者情報の編集" : "業者の新規登録"}</DialogTitle>
                    <DialogDescription>
                        {vendor ? "業者情報を修正してください。" : "新しい業者を登録します。"}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="name" className="text-right text-sm font-medium">
                                名前
                            </label>
                            <Input
                                id="name"
                                name="name"
                                defaultValue={vendor?.name || ""}
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="pin" className="text-right text-sm font-medium">
                                PINコード
                            </label>
                            <Input
                                id="pin"
                                name="pin"
                                defaultValue={vendor?.pinCode || ""}
                                className="col-span-3"
                                placeholder="4桁の数字 (例: 1234)"
                                pattern="\d{4}"
                                title="4桁の数字を入力してください"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="email" className="text-right text-sm font-medium">
                                メール (任意)
                            </label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                defaultValue={vendor?.email || ""}
                                className="col-span-3"
                                placeholder="vendor@example.com"
                            />
                        </div>

                        <div className="grid grid-cols-4 items-center gap-4">
                            <label htmlFor="accessCompanyName" className="text-right text-sm font-medium">
                                Access連携
                            </label>
                            <div className="col-span-3">
                                <Select name="accessCompanyName" defaultValue={vendor?.accessCompanyName || "_none"}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="連携するAccess業者を選択" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="_none">-- 連携なし --</SelectItem>
                                        {loadingAccessVendors ? (
                                            <SelectItem value="_loading" disabled>読み込み中...</SelectItem>
                                        ) : (
                                            accessVendors.map((av) => (
                                                <SelectItem key={av.id} value={av.name}>
                                                    {av.name}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Accessデータベース上の業者名と紐付けることで、物件検索が可能になります。
                                </p>
                            </div>
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
