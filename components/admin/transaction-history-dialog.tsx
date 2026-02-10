"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { getTransactionLogs } from "@/lib/actions";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface TransactionHistoryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    transactionId: number | null;
}

type LogEntry = {
    id: number;
    action: string;
    details: string | null;
    performedAt: Date;
};

export function TransactionHistoryDialog({
    open,
    onOpenChange,
    transactionId,
}: TransactionHistoryDialogProps) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && transactionId) {
            setLoading(true);
            getTransactionLogs(transactionId)
                .then(setLogs)
                .catch(console.error)
                .finally(() => setLoading(false));
        }
    }, [open, transactionId]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>取引変更履歴 (#{transactionId})</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                            変更履歴はありません
                        </div>
                    ) : (
                        <div className="relative border-l-2 border-slate-200 ml-3 space-y-6 py-2">
                            {logs.map((log) => (
                                <div key={log.id} className="relative pl-6">
                                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-blue-500 border-2 border-white" />
                                    <div className="text-xs text-slate-500 mb-1 font-mono">
                                        {format(new Date(log.performedAt), "yyyy/MM/dd HH:mm", { locale: ja })}
                                    </div>
                                    <div className="font-bold text-sm mb-1">{translateAction(log.action)}</div>
                                    <div className="text-sm bg-slate-50 p-2 rounded text-slate-700 whitespace-pre-wrap">
                                        {formatDetails(log.details)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function translateAction(action: string) {
    if (action === "TRANSACTION_UPDATE") return "取引内容の変更";
    if (action.includes("RETURN")) return "在庫戻し";
    return action;
}

function formatDetails(details: string | null) {
    if (!details) return "-";
    // Clean up [By: ...] suffix if present
    return details.replace(/\s*\[By: .*\]$/, "");
}
