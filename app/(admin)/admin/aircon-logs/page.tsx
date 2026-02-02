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
import { Search, X, Download } from "lucide-react";

type LogEntry = {
    id: number;
    createdAt: string;
    managementNo: string;
    customerName: string | null;
    contractor: string | null;
    modelNumber: string;
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

        return matchVendor && matchDate && matchManagementNo;
    });

    const clearFilters = () => {
        setVendorFilter("");
        setDateFilter("");
        setManagementNoFilter("");
    };

    const hasActiveFilters = vendorFilter || dateFilter || managementNoFilter;

    // CSVエクスポート
    const exportCsv = () => {
        const headers = ["日時", "業者名", "管理No", "顧客名", "元請/下請", "品番"];
        const rows = filteredLogs.map((log) => [
            formatDate(new Date(log.createdAt)),
            log.vendor.name,
            log.managementNo,
            log.customerName || "",
            log.contractor || "",
            log.modelNumber,
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

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">エアコン持出し履歴</h2>
                <p className="text-muted-foreground">持出し記録の検索・確認</p>
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
                        {hasActiveFilters && (
                            <p className="text-sm text-muted-foreground mt-2">
                                {filteredLogs.length}件 / 全{logs.length}件
                            </p>
                        )}
                    </div>
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
                                <TableHead className="w-[180px]">日時</TableHead>
                                <TableHead className="w-[150px]">業者名</TableHead>
                                <TableHead>管理No</TableHead>
                                <TableHead>顧客名</TableHead>
                                <TableHead>元請/下請</TableHead>
                                <TableHead>品番</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredLogs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                                        {logs.length === 0 ? "ログがありません" : "該当するログがありません"}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredLogs.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell>{formatDate(new Date(log.createdAt))}</TableCell>
                                        <TableCell className="font-medium">{log.vendor.name}</TableCell>
                                        <TableCell>{log.managementNo}</TableCell>
                                        <TableCell>{log.customerName || "-"}</TableCell>
                                        <TableCell>{log.contractor || "-"}</TableCell>
                                        <TableCell className="font-mono bg-slate-100 rounded px-1">{log.modelNumber}</TableCell>
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
