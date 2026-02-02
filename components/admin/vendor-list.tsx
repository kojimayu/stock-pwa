"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Edit, Plus, Trash2, RotateCcw } from "lucide-react";
import { VendorDialog } from "./vendor-dialog";
import { deleteVendor, resetPin } from "@/lib/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// Define the type here or import from Prisma types if clear
type Vendor = {
    id: number;
    name: string;
    pinCode: string;
    pinChanged: boolean;
    email?: string | null;
};

interface VendorListProps {
    vendors: Vendor[];
}

export function VendorList({ vendors }: VendorListProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
    const router = useRouter();

    const handleCreate = () => {
        setEditingVendor(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (vendor: Vendor) => {
        setEditingVendor(vendor);
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm("本当に削除しますか？")) return;
        try {
            await deleteVendor(id);
            toast.success("削除しました");
            router.refresh();
        } catch (error: any) {
            toast.error(error.message || "削除に失敗しました");
        }
    };

    const handleResetPin = async (vendor: Vendor) => {
        if (!confirm(`${vendor.name}のPINを初期化（1234）しますか？`)) return;
        try {
            await resetPin(vendor.id);
            toast.success(`${vendor.name}のPINをリセットしました`);
            router.refresh();
        } catch (error: any) {
            toast.error(error.message || "リセットに失敗しました");
        }
    };

    const handleSuccess = () => {
        router.refresh();
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button onClick={handleCreate}>
                    <Plus className="w-4 h-4 mr-2" />
                    新規登録
                </Button>
            </div>

            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[80px]">ID</TableHead>
                            <TableHead>名前</TableHead>
                            <TableHead>PIN</TableHead>
                            <TableHead>状態</TableHead>
                            <TableHead>メール</TableHead>
                            <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {vendors.map((vendor) => (
                            <TableRow key={vendor.id}>
                                <TableCell>{vendor.id}</TableCell>
                                <TableCell className="font-medium">{vendor.name}</TableCell>
                                <TableCell className="font-mono">{vendor.pinCode}</TableCell>
                                <TableCell>
                                    {vendor.pinChanged ? (
                                        <span className="text-green-600 text-xs font-bold">変更済</span>
                                    ) : (
                                        <span className="text-amber-600 text-xs font-bold">初期PIN</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-muted-foreground">{vendor.email || '-'}</TableCell>
                                <TableCell className="text-right space-x-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleResetPin(vendor)}
                                        title="PINリセット"
                                        disabled={!vendor.pinChanged}
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(vendor)} title="編集">
                                        <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(vendor.id)} title="削除">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {vendors.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-10 text-slate-500">
                                    業者が登録されていません
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <VendorDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                vendor={editingVendor}
                onSuccess={handleSuccess}
            />
        </div>
    );
}
