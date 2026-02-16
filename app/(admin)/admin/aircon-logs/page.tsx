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
import { Search, X, Download, RotateCcw, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { returnAircon } from "@/lib/aircon-actions";

type LogEntry = {
    id: number;
    createdAt: string;
    managementNo: string;
    customerName: string | null;
    contractor: string | null;
    modelNumber: string;
    isReturned: boolean;
    returnedAt: string | null;
    vendor: {
        name: string;
    };
};

export default function AirconLogsPage() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [vendorFilter, setVendorFilter] = useState("");
    const [dateFilter, setDateFilter] = useState("");
    const [managementNoFilter, setManagementNoFilter] = useState("");
    const [showReturnedOnly, setShowReturnedOnly] = useState(false);

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
            log.managementNo.includes(managementNoFilter);

        const matchReturned = !showReturnedOnly || log.isReturned;

        return matchVendor && matchDate && matchManagementNo && matchReturned;
    });

    const clearFilters = () => {
        setVendorFilter("");
        setDateFilter("");
        setManagementNoFilter("");
        setShowReturnedOnly(false);
    };

    const hasActiveFilters = vendorFilter || dateFilter || managementNoFilter || showReturnedOnly;

    // CSVエクスポート
    const exportCsv = () => {
        const headers = ["日時", "業者名", "管理No", "顧客名", "元請/下請", "品番", "戻し済", "戻し日時"];
        const rows = filteredLogs.map((log) => [
            formatDate(new Date(log.createdAt)),
            log.vendor.name,
            log.managementNo,
            log.customerName || "",
            log.contractor || "",
            log.modelNumber,
            log.isReturned ? "○" : "",
            log.returnedAt ? formatDate(new Date(log.returnedAt)) : "",
        ]);

        const csvContent = [headers, ...rows]
            .map((row) => row.map((cell) => `"${cell}"`).join(","))
            .join("\n");

        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `aircon_logs_${new Date().toISOString().split("T")[0]}.csv`;
        link.click();
    };

    // 戻し処理
    const handleReturn = async (logId: number) => {
        if (!confirm("このエアコンを戻し済みにしますか？在庫が1台増加します。")) {
            return;
        }

        const result = await returnAircon(logId);
        if (result.success) {
            toast.success("戻し処理が完了しました");
            fetchLogs();
        } else {
            toast.error(result.message);
        }
    };

    const notReturnedCount = logs.filter(l => !l.isReturned).length;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">エアコン持出し履歴</h2>
                <p className="text-muted-foreground">
                    持出し記録の検索・確認・戻し処理
                    <span className="ml-2 text-sm">
                        （未戻し: <strong>{notReturnedCount}</strong>件）
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
                            {filteredLogs.length}件 / 全{logs.length}件
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* ログテーブル */}
            <div className="border rounded-lg bg-white">
                {loading ? (
                    <div className="text-center py-8 text-muted-foreground">読み込み中...</div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[150px]">日時</TableHead>
                                <TableHead className="w-[120px]">業者名</TableHead>
                                <TableHead>管理No</TableHead>
                                <TableHead>顧客名</TableHead>
                                <TableHead>品番</TableHead>
                                <TableHead className="w-[80px] text-center">状態</TableHead>
                                <TableHead className="w-[100px] text-right">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredLogs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                                        {logs.length === 0 ? "ログがありません" : "該当するログがありません"}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredLogs.map((log) => (
                                    <TableRow key={log.id} className={log.isReturned ? "bg-green-50" : ""}>
                                        <TableCell className="text-sm">{formatDate(new Date(log.createdAt))}</TableCell>
                                        <TableCell className="font-medium">{log.vendor.name}</TableCell>
                                        <TableCell>
                                            {log.managementNo === "INTERNAL" ? (
                                                <Badge variant="secondary" className="bg-slate-200 text-slate-700">自社在庫</Badge>
                                            ) : (
                                                log.managementNo
                                            )}
                                        </TableCell>
                                        <TableCell>{log.customerName || "-"}</TableCell>
                                        <TableCell className="font-mono bg-slate-100 rounded px-1">{log.modelNumber}</TableCell>
                                        <TableCell className="text-center">
                                            {log.isReturned ? (
                                                <Badge className="bg-green-100 text-green-700">
                                                    <CheckCircle className="w-3 h-3 mr-1" />
                                                    戻し済
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline">持出中</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {!log.isReturned && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleReturn(log.id)}
                                                >
                                                    <RotateCcw className="w-4 h-4 mr-1" />
                                                    戻す
                                                </Button>
                                            )}
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
