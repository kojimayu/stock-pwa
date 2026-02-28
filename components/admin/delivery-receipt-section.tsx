"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Image as ImageIcon, FileText, X } from "lucide-react";

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
// 旧パス（/uploads/...）もAPI経由に変換
function parsePhotoPaths(photoPath: string | null): string[] {
    if (!photoPath) return [];
    let paths: string[];
    if (photoPath.startsWith("[")) {
        try { paths = JSON.parse(photoPath); } catch { paths = [photoPath]; }
    } else {
        paths = [photoPath];
    }
    // 旧パス形式を新API形式に変換
    return paths.map(p => {
        if (p.startsWith("/uploads/delivery-receipts/")) {
            const filename = p.split("/").pop();
            return `/api/delivery-receipt/image/${filename}`;
        }
        return p;
    });
}

export function DeliveryReceiptSection({ type, orderId }: Props) {
    const [receipts, setReceipts] = useState<Receipt[]>([]);
    const [loading, setLoading] = useState(false);
    const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

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
        <>
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
                                        {/* 写真サムネイル（複数対応・ホバー拡大） */}
                                        {photos.length > 0 ? (
                                            <div className="flex gap-1 flex-shrink-0 flex-wrap">
                                                {photos.map((p, i) => (
                                                    <button
                                                        key={i}
                                                        type="button"
                                                        onClick={() => setLightboxSrc(p)}
                                                        className="relative group cursor-pointer"
                                                    >
                                                        <img
                                                            src={p}
                                                            alt={`納品伝票 ${i + 1}`}
                                                            className="w-16 h-16 object-cover rounded border transition-all group-hover:ring-2 group-hover:ring-blue-400 group-hover:shadow-lg"
                                                        />
                                                        {/* ホバー拡大ヒント */}
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded transition-colors flex items-center justify-center">
                                                            <span className="text-white text-[10px] opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                                                                🔍 拡大
                                                            </span>
                                                        </div>
                                                    </button>
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

            {/* ライトボックス（拡大表示） */}
            {lightboxSrc && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setLightboxSrc(null)}
                >
                    <button
                        type="button"
                        onClick={() => setLightboxSrc(null)}
                        className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white rounded-full p-2 transition-colors z-10"
                    >
                        <X className="h-6 w-6" />
                    </button>
                    <img
                        src={lightboxSrc}
                        alt="納品伝票（拡大）"
                        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </>
    );
}
