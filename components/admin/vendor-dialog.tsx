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
import { upsertVendor } from "@/lib/actions";
import { toast } from "sonner";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface VendorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    vendor?: { id: number; name: string; pinCode: string; email?: string | null; accessCompanyName?: string | null; showPriceInEmail?: boolean } | null;
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

    // Combobox state
    const [openCombobox, setOpenCombobox] = useState(false);
    const [selectedAccessVendor, setSelectedAccessVendor] = useState("");

    // Price in email setting
    const [showPriceInEmail, setShowPriceInEmail] = useState(true);

    // Initialize/Update state when vendor prop changes
    useEffect(() => {
        if (vendor?.accessCompanyName) {
            setSelectedAccessVendor(vendor.accessCompanyName);
        } else {
            setSelectedAccessVendor("");
        }
        // Initialize showPriceInEmail (default true for new vendors)
        setShowPriceInEmail(vendor?.showPriceInEmail ?? true);
    }, [vendor, open]);

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
        // accessCompanyName is retrieved from hidden input

        try {
            await upsertVendor({
                id: vendor?.id,
                name,
                pinCode: pin,
                email: formData.get("email") as string || null,
                accessCompanyName: selectedAccessVendor === "_none" || !selectedAccessVendor ? null : selectedAccessVendor,
                showPriceInEmail,
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
                            <div className="col-span-3 flex flex-col gap-2">
                                <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openCombobox}
                                            className="w-full justify-between"
                                        >
                                            {selectedAccessVendor && selectedAccessVendor !== "_none"
                                                ? accessVendors.find((av) => av.name === selectedAccessVendor)?.name || selectedAccessVendor
                                                : "連携するAccess業者を選択..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0">
                                        <Command>
                                            <CommandInput placeholder="業者名を検索..." />
                                            <CommandList>
                                                <CommandEmpty>業者が見つかりません。</CommandEmpty>
                                                <CommandGroup>
                                                    <CommandItem
                                                        value="_none"
                                                        onSelect={() => {
                                                            setSelectedAccessVendor("");
                                                            setOpenCombobox(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                !selectedAccessVendor ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        -- 連携なし --
                                                    </CommandItem>
                                                    {accessVendors.map((av) => (
                                                        <CommandItem
                                                            key={av.id}
                                                            value={av.name}
                                                            onSelect={(currentValue) => {
                                                                // currentValue might be lowercased by cmdk sometimes, but here we expect name
                                                                // cmdk value usually matches text content if not specified, 
                                                                // but we specified value={av.name}
                                                                setSelectedAccessVendor(av.name); // Prefer explicit name from object to avoid case issues
                                                                setOpenCombobox(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    selectedAccessVendor === av.name ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {av.name}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                {/* Hidden input to pass the selected company name */}
                                <input type="hidden" name="accessCompanyName" value={selectedAccessVendor || ""} />

                                <p className="text-xs text-muted-foreground">
                                    Accessデータベース上の業者名と紐付けることで、物件検索が可能になります。<br />
                                    入力して絞り込み検索ができます。
                                </p>
                            </div>
                        </div>

                        {/* メール金額表示設定 */}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <label className="text-right text-sm font-medium">
                                レシートメール
                            </label>
                            <div className="col-span-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={showPriceInEmail}
                                        onChange={(e) => setShowPriceInEmail(e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-300"
                                    />
                                    <span className="text-sm">金額を表示する</span>
                                </label>
                                <p className="text-xs text-muted-foreground mt-1">
                                    材料買取の業者はON、手間請けの業者はOFFにしてください。
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
