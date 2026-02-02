"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/store";
import { getVendorAirconHistory, updateAirconLogInfo } from "@/lib/aircon-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Loader2, Edit2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

type AirconLog = {
    id: number;
    managementNo: string;
    customerName: string | null;
    contractor: string | null;
    modelNumber: string;
    createdAt: Date;
    isReturned: boolean;
    airconProduct?: {
        name: string;
        suffix: string;
    } | null;
};

export default function AirconHistoryPage() {
    const router = useRouter();
    const vendor = useCartStore((state) => state.vendor);
    const [logs, setLogs] = useState<AirconLog[]>([]);
    // ... (state lines omitted for brevity if unchanged, but better to include full block if possible, or use careful splitting)
    const [loading, setLoading] = useState(true);

    // Edit State
    const [editingLog, setEditingLog] = useState<AirconLog | null>(null);
    const [editForm, setEditForm] = useState({
        managementNo: "",
        customerName: "",
        contractor: "",
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!vendor) {
            router.push("/");
            return;
        }

        fetchHistory();
    }, [vendor, router]);

    const fetchHistory = async () => {
        if (!vendor) return;
        setLoading(true);
        try {
            const data = await getVendorAirconHistory(vendor.id);
            // @ts-ignore
            setLogs(data);
        } catch (e) {
            console.error(e);
            toast.error("履歴の取得に失敗しました");
        } finally {
            setLoading(false);
        }
    };

    // ... (handlers)

    const handleEditClick = (log: AirconLog) => {
        setEditingLog(log);
        setEditForm({
            managementNo: log.managementNo,
            customerName: log.customerName || "",
            contractor: log.contractor || "",
        });
    };

    const handleSave = async () => {
        if (!editingLog) return;
        setSaving(true);
        try {
            const res = await updateAirconLogInfo(editingLog.id, editForm);
            if (res.success) {
                toast.success("修正しました");
                setEditingLog(null);
                fetchHistory(); // Refresh
            } else {
                toast.error("修正に失敗しました");
            }
        } catch (e) {
            toast.error("エラーが発生しました");
        } finally {
            setSaving(false);
        }
    };

    if (!vendor) return null;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <header className="bg-slate-900 text-white p-3 flex items-center shadow-md sticky top-0 z-10 h-[60px]">
                <Button variant="ghost" className="mr-2 text-white hover:text-white/80" onClick={() => router.back()}>
                    <ChevronLeft className="w-6 h-6 mr-1" />
                    戻る
                </Button>
                <div>
                    <h1 className="text-lg font-bold">エアコン持出し履歴</h1>
                    <p className="text-[10px] text-slate-300">
                        {vendor.name} 様
                    </p>
                </div>
            </header>

            <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="text-center py-20 text-slate-500">
                        履歴はありません
                    </div>
                ) : (
                    <div className="space-y-3">
                        {logs.map((log) => (
                            <Card key={log.id} className={`relative ${log.isReturned ? 'bg-slate-100 opacity-70' : ''}`}>
                                <CardHeader className="py-3 px-4 pb-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="text-sm text-slate-500 mb-1 flex items-center gap-2">
                                                {format(new Date(log.createdAt), "yyyy/MM/dd HH:mm", { locale: ja })}
                                                {log.isReturned && (
                                                    <span className="bg-slate-500 text-white text-[10px] px-1.5 py-0.5 rounded">戻し済</span>
                                                )}
                                            </div>
                                            <CardTitle className={`text-base font-bold ${log.isReturned ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                                                No. {log.managementNo}
                                            </CardTitle>
                                        </div>
                                        {!log.isReturned && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleEditClick(log)}
                                                className="h-8"
                                            >
                                                <Edit2 className="w-4 h-4 mr-1" />
                                                修正
                                            </Button>
                                        )}
                                    </div>
                                </CardHeader>

                                <CardContent className="px-4 pb-3 pt-0">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 rounded">
                                                {log.customerName || "顧客名なし"}
                                            </span>
                                            {log.contractor && (
                                                <span className="text-xs bg-slate-100 text-slate-600 px-2 rounded">
                                                    {log.contractor}
                                                </span>
                                            )}
                                        </div>
                                        <div className="font-mono text-lg font-medium mt-2">
                                            {log.modelNumber}
                                        </div>
                                        {log.airconProduct && (
                                            <div className="text-xs text-slate-400">
                                                マスタ名称: {log.airconProduct.name}
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </main>

            {/* Edit Dialog */}
            <Dialog open={!!editingLog} onOpenChange={(open) => !open && setEditingLog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>履歴の修正</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="managementNo">管理No</Label>
                            <Input
                                id="managementNo"
                                value={editForm.managementNo}
                                onChange={(e) => setEditForm(prev => ({ ...prev, managementNo: e.target.value }))}
                                placeholder="6桁の番号"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="customerName">顧客名</Label>
                            <Input
                                id="customerName"
                                value={editForm.customerName}
                                onChange={(e) => setEditForm(prev => ({ ...prev, customerName: e.target.value }))}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="contractor">請負業者</Label>
                            <Input
                                id="contractor"
                                value={editForm.contractor}
                                onChange={(e) => setEditForm(prev => ({ ...prev, contractor: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingLog(null)}>キャンセル</Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            保存
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
