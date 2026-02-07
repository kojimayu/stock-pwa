"use client";

import { useState, useMemo, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Edit, Plus, Trash2, RotateCcw, Download, Loader2, Search, ChevronDown, ChevronUp, UserPlus, X, User, Info } from "lucide-react";
import { VendorDialog } from "./vendor-dialog";
import { deleteVendor, resetPin, toggleVendorActive, importVendorsFromAccess, deleteVendorUser, createVendorUser } from "@/lib/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";

type VendorUser = {
    id: number;
    name: string;
    pinChanged: boolean;
};

type Vendor = {
    id: number;
    name: string;
    email?: string | null;
    isActive?: boolean;
    users: VendorUser[];
};

interface VendorListProps {
    vendors: Vendor[];
}

export function VendorList({ vendors }: VendorListProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
    const [importing, setImporting] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedVendorId, setExpandedVendorId] = useState<number | null>(null);
    const [newUserName, setNewUserName] = useState("");
    const [isCreatingUser, setIsCreatingUser] = useState(false);
    const router = useRouter();

    // 検索フィルター
    const filteredVendors = useMemo(() => {
        if (!searchQuery.trim()) return vendors;
        const q = searchQuery.toLowerCase();
        return vendors.filter(v =>
            v.name.toLowerCase().includes(q) ||
            (v.email && v.email.toLowerCase().includes(q))
        );
    }, [vendors, searchQuery]);

    const handleCreate = () => {
        setEditingVendor(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (vendor: Vendor, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingVendor(vendor);
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("本当に削除しますか？")) return;
        try {
            await deleteVendor(id);
            toast.success("削除しました");
            router.refresh();
        } catch (error: any) {
            toast.error(error.message || "削除に失敗しました");
        }
    };

    const handleToggleActive = async (vendor: Vendor, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await toggleVendorActive(vendor.id, !vendor.isActive);
            toast.success(`${vendor.name}を${vendor.isActive ? '無効' : '有効'}にしました`);
            router.refresh();
        } catch (error: any) {
            toast.error(error.message || "変更に失敗しました");
        }
    };

    const handleImportFromAccess = async () => {
        if (!confirm("Access DBから業者をインポートしますか？\n\n※新規業者は「無効」状態で登録されます\n※既存の業者はスキップされます")) return;

        setImporting(true);
        try {
            const result = await importVendorsFromAccess();
            if (result.success) {
                toast.success(result.message);
                router.refresh();
            } else {
                toast.error(result.message || "インポートに失敗しました");
            }
        } catch (error: any) {
            toast.error(error.message || "エラーが発生しました");
        } finally {
            setImporting(false);
        }
    };

    const toggleExpand = (vendorId: number) => {
        setExpandedVendorId(expandedVendorId === vendorId ? null : vendorId);
        setNewUserName("");
    };

    // --- VendorUser Actions ---

    const handleCreateUser = async (vendorId: number) => {
        if (!newUserName.trim()) return;
        setIsCreatingUser(true);
        try {
            const res = await createVendorUser(vendorId, newUserName.trim());
            // createVendorUserの戻り値変更に対応
            if ('success' in res && !res.success) {
                toast.error(res.message);
            } else {
                toast.success(`${newUserName}を追加しました`);
                setNewUserName("");
                router.refresh();
            }
        } catch (error: any) {
            toast.error("追加に失敗しました");
        } finally {
            setIsCreatingUser(false);
        }
    };

    const handleDeleteUser = async (userId: number, userName: string) => {
        if (!confirm(`${userName}さんを削除しますか？\n※この操作は取り消せません`)) return;
        try {
            await deleteVendorUser(userId);
            toast.success("削除しました");
            router.refresh();
        } catch (error: any) {
            toast.error("削除に失敗しました");
        }
    };

    const handleResetUserPin = async (user: VendorUser) => {
        if (!confirm(`${user.name}さんのPINを初期化（1234）しますか？`)) return;
        try {
            await resetPin(user.id);
            toast.success("PINをリセットしました");
            router.refresh();
        } catch (error: any) {
            toast.error("リセットに失敗しました");
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-end gap-2">
                <Button
                    variant="outline"
                    onClick={handleImportFromAccess}
                    disabled={importing}
                >
                    {importing ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                        <Download className="w-4 h-4 mr-2" />
                    )}
                    Accessからインポート
                </Button>
                <Button onClick={handleCreate}>
                    <Plus className="w-4 h-4 mr-2" />
                    新規登録
                </Button>
            </div>

            {/* 操作ガイド */}
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-md flex items-start gap-3 text-sm">
                <Info className="w-5 h-5 shrink-0 my-0.5" />
                <div>
                    <p className="font-bold">担当者の追加・PINリセットについて</p>
                    <p>各業者の行をクリックすると詳細画面が展開され、担当者の管理（追加・削除・PINリセット）が行えます。</p>
                </div>
            </div>

            {/* 検索バー */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="業者名で検索..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-10"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <div className="text-sm text-slate-500 flex items-center">
                    {filteredVendors.length} / {vendors.length} 件
                </div>
            </div>

            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[40px]"></TableHead>
                            <TableHead className="w-[60px] text-center">有効</TableHead>
                            <TableHead className="w-[60px]">ID</TableHead>
                            <TableHead>名前</TableHead>
                            <TableHead>担当者数</TableHead>
                            <TableHead>メール</TableHead>
                            <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredVendors.map((vendor) => (
                            <Fragment key={vendor.id}>
                                <TableRow
                                    className={`cursor-pointer hover:bg-slate-50 group ${vendor.isActive === false ? 'opacity-70 bg-slate-50' : ''}`}
                                    onClick={() => toggleExpand(vendor.id)}
                                >
                                    <TableCell>
                                        {expandedVendorId === vendor.id ? (
                                            <ChevronUp className="w-4 h-4 text-slate-400" />
                                        ) : (
                                            <ChevronDown className="w-4 h-4 text-slate-400" />
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={vendor.isActive !== false}
                                            onChange={(e) => handleToggleActive(vendor, e as unknown as React.MouseEvent)}
                                            className="w-4 h-4 cursor-pointer"
                                            title={vendor.isActive !== false ? '無効にする' : '有効にする'}
                                        />
                                    </TableCell>
                                    <TableCell>{vendor.id}</TableCell>
                                    <TableCell className="font-bold">{vendor.name}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="font-normal">
                                                {vendor.users.length} 名
                                            </Badge>
                                            <span className="text-xs text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                                詳細・PIN管理
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{vendor.email || '-'}</TableCell>
                                    <TableCell className="text-right space-x-1">
                                        <Button variant="ghost" size="icon" onClick={(e) => handleEdit(vendor, e)} title="編集">
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={(e) => handleDelete(vendor.id, e)} title="削除">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>

                                {/* 展開行：担当者リスト */}
                                {expandedVendorId === vendor.id && (
                                    <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                                        <TableCell colSpan={7} className="p-0">
                                            <div className="p-4 pl-12 space-y-4">
                                                <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                                    <User className="w-4 h-4" />
                                                    担当者一覧
                                                </div>

                                                <div className="grid gap-2">
                                                    {vendor.users.map(user => (
                                                        <div key={user.id} className="flex items-center justify-between bg-white p-3 rounded border border-slate-200 shadow-sm">
                                                            <div className="flex items-center gap-3">
                                                                <span className="font-medium">{user.name}</span>
                                                                {user.pinChanged ? (
                                                                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">変更済</Badge>
                                                                ) : (
                                                                    <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">初期PIN</Badge>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-8 text-xs"
                                                                    onClick={() => handleResetUserPin(user)}
                                                                >
                                                                    <RotateCcw className="w-3 h-3 mr-1" />
                                                                    PINリセット
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                                                                    onClick={() => handleDeleteUser(user.id, user.name)}
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* 担当者追加フォーム */}
                                                <div className="flex gap-2 items-center max-w-md mt-2">
                                                    <Input
                                                        placeholder="新しい担当者名..."
                                                        value={newUserName}
                                                        onChange={(e) => setNewUserName(e.target.value)}
                                                        className="bg-white"
                                                    />
                                                    <Button
                                                        onClick={() => handleCreateUser(vendor.id)}
                                                        disabled={!newUserName.trim() || isCreatingUser}
                                                    >
                                                        {isCreatingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                                                        追加
                                                    </Button>
                                                </div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </Fragment>
                        ))}
                        {vendors.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-10 text-slate-500">
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
                onSuccess={() => router.refresh()}
            />
        </div>
    );
}
