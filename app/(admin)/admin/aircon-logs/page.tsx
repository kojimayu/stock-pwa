"use client";

import { useState, useEffect } from "react";
import { formatDate } from "@/lib/utils";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, Download, RotateCcw, CheckCircle, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { returnAircon, updateAirconLogAssignment } from "@/lib/aircon-actions";

type LogEntry = {
    id: number;
    createdAt: string;
    managementNo: string;
    customerName: string | null;
    contractor: string | null;
    modelNumber: string;
    isReturned: boolean;
    isProxyInput: boolean;
    returnedAt: string | null;
    vendor: {
        name: string;
    };
    vendorUser?: {
        name: string;
    };
    type: string;
    isTemporaryLoan: boolean;
    note: string | null;
};

// グループ化された表示用の型
type GroupedLog = {
    key: string;
    managementNo: string;
    customerName: string | null;
    contractor: string | null;
    vendorName: string;
    vendorUserName?: string;
    isProxyInput: boolean;
    createdAt: string;
    items: {
        model: string;
        type: string;
        total: number;
        returned: number;
        logIds: number[];
        notReturnedIds: number[];
    }[];
    allReturned: boolean;
    someReturned: boolean;
    isTemporaryLoan: boolean;
    note: string | null;
};

export default function AirconLogsPage() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [vendorFilter, setVendorFilter] = useState("");
    const [dateFilter, setDateFilter] = useState("");
    const [managementNoFilter, setManagementNoFilter] = useState("");
    const [showReturnedOnly, setShowReturnedOnly] = useState(false);

    // 管理No編集用
    const [editingGroup, setEditingGroup] = useState<string | null>(null);
    const [editManagementNo, setEditManagementNo] = useState("");
    const [editCustomerName, setEditCustomerName] = useState("");
    const [editContractor, setEditContractor] = useState("");

    // 戻しダイアログ用（グループ全体）
    const [returnGroup, setReturnGroup] = useState<GroupedLog | null>(null);
    const [returnCounts, setReturnCounts] = useState<Record<string, number>>({});

    // 引当変更の管理No検索用
    const [editSearching, setEditSearching] = useState(false);
    const [editJobInfo, setEditJobInfo] = useState<{ managementNo: string; customerName: string; contractor: string } | null>(null);
    const [editTemporaryLoan, setEditTemporaryLoan] = useState(false);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/aircon/logs");
            const data = await res.json();
            setLogs(data.logs || []);
        } catch (e) {
            console.error("Failed to fetch logs", e);
        } finally {
            setLoading(false);
        }
    };

    // フィルタリング
    const filteredLogs = logs.filter((log) => {
        const matchVendor = vendorFilter === "" ||
            log.vendor.name.toLowerCase().includes(vendorFilter.toLowerCase());
        const matchDate = dateFilter === "" ||
            log.createdAt.startsWith(dateFilter);
        const matchManagementNo = managementNoFilter === "" ||
            (log.managementNo || "").includes(managementNoFilter);
        const matchReturned = !showReturnedOnly || log.isReturned;
        return matchVendor && matchDate && matchManagementNo && matchReturned;
    });

    // ログをグループ化（管理No + 日付 + 業者でグループ）
    const groupedLogs: GroupedLog[] = (() => {
        const groups = new Map<string, GroupedLog>();
        filteredLogs.forEach(log => {
            const dateKey = log.createdAt.split("T")[0];
            const key = `${log.managementNo}-${dateKey}-${log.vendor.name}`;
            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    managementNo: log.managementNo,
                    customerName: log.customerName,
                    contractor: log.contractor,
                    vendorName: log.vendor.name,
                    vendorUserName: log.vendorUser?.name,
                    isProxyInput: log.isProxyInput,
                    createdAt: log.createdAt,
                    items: [],
                    allReturned: true,
                    someReturned: false,
                    isTemporaryLoan: log.isTemporaryLoan,
                    note: log.note,
                });
            }
            const group = groups.get(key)!;
            // 同じmodel+typeのアイテムを探す
            const itemKey = `${log.modelNumber}-${log.type}`;
            let item = group.items.find(i => `${i.model}-${i.type}` === itemKey);
            if (!item) {
                item = { model: log.modelNumber, type: log.type, total: 0, returned: 0, logIds: [], notReturnedIds: [] };
                group.items.push(item);
            }
            item.total++;
            item.logIds.push(log.id);
            if (log.isReturned) {
                item.returned++;
                group.someReturned = true;
            } else {
                item.notReturnedIds.push(log.id);
                group.allReturned = false;
            }
        });
        return Array.from(groups.values()).sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    })();

    const clearFilters = () => {
        setVendorFilter("");
        setDateFilter("");
        setManagementNoFilter("");
        setShowReturnedOnly(false);
    };

    const hasActiveFilters = vendorFilter || dateFilter || managementNoFilter || showReturnedOnly;

    const modelToLabel: Record<string, string> = {
        'RAS-AJ2225S': '2.2kw', 'RAS-AJ2525S': '2.5kw',
        'RAS-AJ2825S': '2.8kw', 'RAS-AJ3625S': '3.6kw',
    };

    // CSVエクスポート
    const exportCsv = () => {
        const headers = ["日時", "業者名", "管理No", "顧客名", "元請/下請", "品番", "台数", "戻し済", "戻し日時"];
        const rows = groupedLogs.flatMap(group =>
            group.items.map(item => [
                formatDate(new Date(group.createdAt)),
                group.vendorName,
                group.managementNo,
                group.customerName || "",
                group.contractor || "",
                item.model,
                String(item.total),
                item.returned > 0 ? `${item.returned}台` : "",
                "",
            ])
        );

        const csvContent = [headers, ...rows]
            .map((row) => row.map((cell) => `"${cell}"`).join(","))
            .join("\n");

        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `aircon_logs_${new Date().toISOString().split("T")[0]}.csv`;
        link.click();
    };

    // 戻し処理（複数機種一括）
    const handleReturnAll = async () => {
        const totalCount = Object.values(returnCounts).reduce((a, b) => a + b, 0);
        if (totalCount === 0) { toast.error("戻す台数を指定してください"); return; }
        if (!confirm(`合計${totalCount}台を戻し済みにしますか？在庫が${totalCount}台増加します。`)) return;

        let success = 0;
        for (const item of returnGroup!.items) {
            const key = `${item.model}-${item.type}`;
            const count = returnCounts[key] || 0;
            for (let i = 0; i < count; i++) {
                if (item.notReturnedIds[i]) {
                    const result = await returnAircon(item.notReturnedIds[i]);
                    if (result.success) success++;
                }
            }
        }
        if (success > 0) {
            toast.success(`${success}台の戻し処理が完了しました`);
            fetchLogs();
        }
        setReturnGroup(null);
    };

    // 引当変更: 管理No検索（Server Action経由でDB検索）
    const handleEditSearch = async () => {
        if (!editManagementNo || editManagementNo.length < 6) {
            toast.error("管理Noは6桁以上で入力してください");
            return;
        }
        setEditSearching(true);
        try {
            // Admin用: vendorName不要のため、aircon-actions経由で直接Prismaから検索
            // まずAirConditionerLogから同じ管理Noの既存レコードを探す
            const res = await fetch(`/api/aircon/logs?managementNo=${editManagementNo}`);
            if (res.ok) {
                const data = await res.json();
                const existing = data.logs?.[0];
                if (existing) {
                    setEditJobInfo({
                        managementNo: editManagementNo,
                        customerName: existing.customerName || "",
                        contractor: existing.contractor || "",
                    });
                    setEditCustomerName(existing.customerName || "");
                    setEditContractor(existing.contractor || "");
                    return;
                }
            }
            // 既存ログになければ、手動入力を許可
            setEditJobInfo({
                managementNo: editManagementNo,
                customerName: "",
                contractor: "",
            });
            setEditCustomerName("");
            setEditContractor("");
            toast.info("新しい管理Noです。顧客名を入力してください。");
        } catch {
            toast.error("検索に失敗しました");
        } finally {
            setEditSearching(false);
        }
    };

    // 管理No編集保存
    const handleSaveAssignment = async (group: GroupedLog) => {
        if (!editJobInfo && editManagementNo !== "INTERNAL") {
            toast.error("管理Noを検索して物件を確認してください");
            return;
        }
        const allIds = group.items.flatMap(i => i.logIds);
        const result = await updateAirconLogAssignment(
            allIds,
            editManagementNo,
            editCustomerName,
            editContractor,
            editTemporaryLoan
        );
        if (result.success) {
            toast.success("引当先を更新しました");
            setEditingGroup(null);
            setEditJobInfo(null);
            fetchLogs();
        }
    };

    const notReturnedCount = logs.filter(l => !l.isReturned).length;
    const totalCount = logs.length;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">エアコン持出し履歴</h2>
                <p className="text-muted-foreground">
                    持出し記録の検索・確認・戻し処理
                    <span className="ml-2 text-sm">
                        （引当済: <strong>{notReturnedCount}</strong>件 / 全{totalCount}件）
                    </span>
                </p>
            </div>

            {/* 検索フィルター */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Search className="w-5 h-5" />
                        検索フィルター
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                        <div>
                            <label className="text-sm font-medium mb-1 block">業者名</label>
                            <Input
                                placeholder="業者名で検索..."
                                value={vendorFilter}
                                onChange={(e) => setVendorFilter(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">管理No</label>
                            <Input
                                placeholder="管理No"
                                value={managementNoFilter}
                                onChange={(e) => setManagementNoFilter(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">日付</label>
                            <Input
                                type="date"
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            {hasActiveFilters && (
                                <Button variant="ghost" size="sm" onClick={clearFilters}>
                                    <X className="w-4 h-4 mr-1" />
                                    クリア
                                </Button>
                            )}
                            <Button variant="outline" size="sm" onClick={exportCsv}>
                                <Download className="w-4 h-4 mr-1" />
                                CSV
                            </Button>
                        </div>
                    </div>
                    {hasActiveFilters && (
                        <p className="text-sm text-muted-foreground mt-2">
                            {groupedLogs.length}グループ / 全{filteredLogs.length}件
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* 戻しダイアログ（全機種一括） */}
            {returnGroup && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-96">
                        <CardHeader>
                            <CardTitle className="text-lg">戻し台数を指定</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <p className="text-sm text-slate-500">
                                {returnGroup.managementNo === "INTERNAL" ? "自社在庫" : returnGroup.managementNo} / {returnGroup.customerName || "-"}
                            </p>
                            {returnGroup.items.filter(i => i.notReturnedIds.length > 0).map(item => {
                                const key = `${item.model}-${item.type}`;
                                const count = returnCounts[key] || 0;
                                return (
                                    <div key={key} className="flex items-center justify-between bg-slate-50 p-2 rounded border">
                                        <div className="flex items-center gap-1.5">
                                            <span className={`text-[10px] px-1 rounded border ${item.type === 'SET' ? 'bg-slate-100 text-slate-600 border-slate-300' :
                                                item.type === 'INDOOR' ? 'bg-blue-100 text-blue-600 border-blue-300' :
                                                    item.type === 'PURCHASE' ? 'bg-red-100 text-red-600 border-red-300' :
                                                        'bg-orange-100 text-orange-600 border-orange-300'
                                                }`}>
                                                {item.type === 'SET' ? 'セット' : item.type === 'INDOOR' ? '内機' : item.type === 'PURCHASE' ? '買取' : '外機'}
                                            </span>
                                            <span className="font-bold text-sm">{modelToLabel[item.model] || item.model}</span>
                                            <span className="text-xs text-slate-400">(未戻{item.notReturnedIds.length})</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                                                onClick={() => setReturnCounts(prev => ({ ...prev, [key]: Math.max(0, count - 1) }))}
                                                disabled={count <= 0}
                                            >−</Button>
                                            <span className="w-6 text-center font-bold">{count}</span>
                                            <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                                                onClick={() => setReturnCounts(prev => ({ ...prev, [key]: Math.min(item.notReturnedIds.length, count + 1) }))}
                                                disabled={count >= item.notReturnedIds.length}
                                            >＋</Button>
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="flex gap-2 pt-2">
                                <Button className="flex-1" onClick={handleReturnAll}
                                    disabled={Object.values(returnCounts).reduce((a, b) => a + b, 0) === 0}>
                                    戻し確定（{Object.values(returnCounts).reduce((a, b) => a + b, 0)}台）
                                </Button>
                                <Button variant="outline" onClick={() => setReturnGroup(null)}>
                                    キャンセル
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
            {/* 引当変更ダイアログ */}
            {editingGroup && (() => {
                const group = groupedLogs.find(g => g.key === editingGroup);
                if (!group) return null;
                return (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <Card className="w-96">
                            <CardHeader>
                                <CardTitle className="text-lg">引当先を変更</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <p className="text-sm text-slate-500">
                                    現在: {group.managementNo === "INTERNAL" ? "自社在庫" : group.managementNo} / {group.customerName || "-"}
                                </p>
                                <div>
                                    <label className="text-sm font-medium mb-1 block">管理No</label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={editManagementNo}
                                            onChange={(e) => { setEditManagementNo(e.target.value); setEditJobInfo(null); }}
                                            placeholder="管理No（6桁）"
                                        />
                                        <Button variant="outline" onClick={handleEditSearch} disabled={editSearching}>
                                            {editSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                        </Button>
                                    </div>
                                </div>
                                {editJobInfo && (
                                    <div className="bg-green-50 border border-green-200 rounded p-3 space-y-2">
                                        <div className="font-bold text-green-700 text-sm">✓ 管理No確認済み</div>
                                        <div>
                                            <label className="text-xs text-slate-500">顧客名</label>
                                            <Input
                                                value={editCustomerName}
                                                onChange={(e) => setEditCustomerName(e.target.value)}
                                                placeholder="顧客名"
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500">業者</label>
                                            <Input
                                                value={editContractor}
                                                onChange={(e) => setEditContractor(e.target.value)}
                                                placeholder="業者名"
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                    </div>
                                )}
                                {!editJobInfo && (
                                    <p className="text-xs text-amber-600">※ 管理Noを入力して検索ボタンを押してください</p>
                                )}
                                <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded p-2">
                                    <input
                                        type="checkbox"
                                        id="tempLoan"
                                        checked={editTemporaryLoan}
                                        onChange={(e) => setEditTemporaryLoan(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300"
                                    />
                                    <label htmlFor="tempLoan" className="text-sm font-medium text-yellow-800 cursor-pointer">
                                        一時貸出（倉庫在庫からの貸出し）
                                    </label>
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <Button className="flex-1" onClick={() => handleSaveAssignment(group)}
                                        disabled={!editJobInfo && editManagementNo !== "INTERNAL"}>
                                        保存
                                    </Button>
                                    <Button variant="outline" onClick={() => { setEditingGroup(null); setEditJobInfo(null); }}>
                                        キャンセル
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                );
            })()}

            {/* ログテーブル */}
            <div className="border rounded-lg bg-white">
                {loading ? (
                    <div className="text-center py-8 text-muted-foreground">読み込み中...</div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[130px]">日時</TableHead>
                                <TableHead className="w-[120px]">業者名</TableHead>
                                <TableHead>管理No</TableHead>
                                <TableHead>顧客名</TableHead>
                                <TableHead>機種・台数</TableHead>
                                <TableHead className="w-[100px] text-center">状態</TableHead>
                                <TableHead className="w-[120px] text-right">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {groupedLogs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                                        {logs.length === 0 ? "ログがありません" : "該当するログがありません"}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                groupedLogs.map((group) => (
                                    <TableRow key={group.key} className={group.allReturned ? "bg-green-50" : ""}>
                                        <TableCell className="text-sm">
                                            {formatDate(new Date(group.createdAt))}
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">
                                                {group.isProxyInput && <span className="text-xs bg-purple-100 text-purple-700 px-1 rounded mr-1">代</span>}
                                                {group.vendorName}
                                            </div>
                                            {group.vendorUserName && (
                                                <div className="text-xs text-slate-500">
                                                    (担) {group.vendorUserName}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {group.managementNo === "INTERNAL" ? (
                                                <Badge variant="secondary" className="bg-slate-200 text-slate-700">自社在庫</Badge>
                                            ) : (
                                                group.managementNo
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div>{group.customerName || "-"}</div>
                                            {group.note && (
                                                <div className="text-xs text-amber-600 mt-0.5">📝 {group.note}</div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-0.5">
                                                {group.items.map(item => (
                                                    <div key={`${item.model}-${item.type}`} className="flex items-center gap-1.5 text-sm">
                                                        <span className={`text-[10px] px-1 rounded border ${item.type === 'SET' ? 'bg-slate-100 text-slate-600 border-slate-300' :
                                                            item.type === 'INDOOR' ? 'bg-blue-100 text-blue-600 border-blue-300' :
                                                                item.type === 'PURCHASE' ? 'bg-red-100 text-red-600 border-red-300' :
                                                                    'bg-orange-100 text-orange-600 border-orange-300'
                                                            }`}>
                                                            {item.type === 'SET' ? 'セット' : item.type === 'INDOOR' ? '内機' : item.type === 'PURCHASE' ? '買取' : '外機'}
                                                        </span>
                                                        <span className="font-bold">{modelToLabel[item.model] || item.model}</span>
                                                        <span className="text-blue-700 font-bold">×{item.total}</span>
                                                        {item.returned > 0 && (
                                                            <span className="text-green-600 text-xs">(戻{item.returned})</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {group.allReturned ? (
                                                <Badge className="bg-green-100 text-green-700">
                                                    <CheckCircle className="w-3 h-3 mr-1" />
                                                    戻し済
                                                </Badge>
                                            ) : group.someReturned ? (
                                                <Badge className="bg-amber-100 text-amber-700">
                                                    一部戻し
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline">引当済</Badge>
                                            )}
                                            {group.isTemporaryLoan && (
                                                <Badge className="bg-yellow-100 text-yellow-700 mt-1">
                                                    一時貸出
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex flex-col gap-1 items-end">
                                                {!group.allReturned && group.items.some(i => i.notReturnedIds.length > 0) && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 text-xs"
                                                        onClick={() => {
                                                            const counts: Record<string, number> = {};
                                                            group.items.forEach(i => {
                                                                counts[`${i.model}-${i.type}`] = 0;
                                                            });
                                                            setReturnCounts(counts);
                                                            setReturnGroup(group);
                                                        }}
                                                    >
                                                        <RotateCcw className="w-3 h-3 mr-1" />
                                                        戻す
                                                    </Button>
                                                )}
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 text-xs"
                                                    onClick={() => {
                                                        setEditingGroup(group.key);
                                                        setEditManagementNo(group.managementNo);
                                                        setEditCustomerName(group.customerName || "");
                                                        setEditContractor(group.contractor || "");
                                                        setEditTemporaryLoan(group.isTemporaryLoan);
                                                    }}
                                                >
                                                    <Pencil className="w-3 h-3 mr-1" />
                                                    引当変更
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                )}
            </div>
        </div>
    );
}
