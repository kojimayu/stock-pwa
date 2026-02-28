"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Image as ImageIcon, FileText } from "lucide-react";

type Receipt = {
    id: number;
    type: string;
    orderId: number;
    photoPath: string | null;
    confirmedBy: string | null;
    confirmedAt: string | null;
    deliveryDate: string | null;
    note: string | null;
    createdAt: string;
};

type Props = {
    type: "MATERIAL" | "AIRCON";
    orderId: number;
};

// 写真パスをパース（単独パスまたはJSON配列）
function parsePhotoPaths(photoPath: string | null): string[] {
    if (!photoPath) return [];
    if (photoPath.startsWith("[")) {
        try { return JSON.parse(photoPath); } catch { return [photoPath]; }
    }
    return [photoPath];
}

export function DeliveryReceiptSection({ type, orderId }: Props) {
    const [receipts, setReceipts] = useState<Receipt[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchReceipts = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/delivery-receipt?type=${type}&orderId=${orderId}`);
            if (res.ok) {
                const data = await res.json();
                setReceipts(data);
            }
        } catch (e) {
            console.error("納品記録取得エラー:", e);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchReceipts();
    }, [type, orderId]);

    if (loading) return null;
    if (receipts.length === 0) return null;

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    納品記録 ({receipts.length}件)
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {receipts.map((r) => {
                        const photos = parsePhotoPaths(r.photoPath);
                        return (
                            <div key={r.id} className="border rounded-lg p-3 bg-white">
                                <div className="flex items-start gap-3">
                                    {/* 写真サムネイル（複数対応） */}
                                    {photos.length > 0 ? (
                                        <div className="flex gap-1 flex-shrink-0 flex-wrap">
                                            {photos.map((p, i) => (
                                                <a
                                                    key={i}
                                                    href={p}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    <img
                                                        src={p}
                                                        alt={`納品伝票 ${i + 1}`}
                                                        className="w-16 h-16 object-cover rounded border hover:opacity-80 transition-opacity"
                                                    />
                                                </a>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="w-16 h-16 bg-slate-100 rounded border flex items-center justify-center flex-shrink-0">
                                            <ImageIcon className="h-6 w-6 text-slate-300" />
                                        </div>
                                    )}
                                    {/* 情報 */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="font-medium">{r.confirmedBy || "不明"}</span>
                                            <span className="text-muted-foreground">が確認</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                            {r.deliveryDate && (
                                                <div>📦 納品日: {format(new Date(r.deliveryDate), "yyyy/MM/dd")}</div>
                                            )}
                                            {r.confirmedAt && (
                                                <div>✅ 確認: {format(new Date(r.confirmedAt), "yyyy/MM/dd HH:mm")}</div>
                                            )}
                                            {r.note && (
                                                <div>💬 {r.note}</div>
                                            )}
                                            {photos.length > 0 && (
                                                <div>📷 写真: {photos.length}枚</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
