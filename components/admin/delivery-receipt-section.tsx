"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Camera, Upload, Check, Image as ImageIcon, Trash2, FileText } from "lucide-react";

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
    confirmedBy: string; // 管理者名（自動入力）
};

export function DeliveryReceiptSection({ type, orderId, confirmedBy }: Props) {
    const [receipts, setReceipts] = useState<Receipt[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [deliveryDate, setDeliveryDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const [note, setNote] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 納品記録取得
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

    // ファイル選択
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            const url = URL.createObjectURL(file);
            setPreview(url);
        }
    };

    // アップロード送信
    const handleSubmit = async () => {
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("type", type);
            formData.append("orderId", String(orderId));
            formData.append("confirmedBy", confirmedBy);
            if (deliveryDate) formData.append("deliveryDate", deliveryDate);
            if (note) formData.append("note", note);
            if (selectedFile) formData.append("photo", selectedFile);

            const res = await fetch("/api/delivery-receipt", {
                method: "POST",
                body: formData,
            });

            if (res.ok) {
                setShowForm(false);
                setSelectedFile(null);
                setPreview(null);
                setNote("");
                setDeliveryDate(format(new Date(), "yyyy-MM-dd"));
                await fetchReceipts();
            } else {
                alert("保存に失敗しました");
            }
        } catch (e) {
            console.error("送信エラー:", e);
            alert("送信エラーが発生しました");
        }
        setUploading(false);
    };

    const label = type === "AIRCON" ? "エアコン" : "材料";

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        納品記録
                    </CardTitle>
                    {!showForm && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowForm(true)}
                            className="gap-1.5"
                        >
                            <Camera className="h-4 w-4" />
                            納品確認を追加
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* 入力フォーム */}
                {showForm && (
                    <div className="border rounded-lg p-4 space-y-3 bg-blue-50/50">
                        <h4 className="font-semibold text-sm text-blue-800">
                            {label}発注 #{orderId} - 納品確認
                        </h4>

                        {/* 写真アップロード */}
                        <div>
                            <label className="text-xs font-medium text-slate-600 block mb-1">
                                納品伝票写真（任意）
                            </label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            {preview ? (
                                <div className="relative">
                                    <img
                                        src={preview}
                                        alt="プレビュー"
                                        className="w-full max-h-48 object-contain rounded border"
                                    />
                                    <button
                                        onClick={() => { setSelectedFile(null); setPreview(null); }}
                                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>
                            ) : (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full h-20 border-dashed gap-2"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload className="h-5 w-5 text-slate-400" />
                                    <span className="text-slate-500">タップして撮影 / 選択</span>
                                </Button>
                            )}
                        </div>

                        {/* 納品日 */}
                        <div>
                            <label className="text-xs font-medium text-slate-600 block mb-1">
                                納品日（実際の到着日）
                            </label>
                            <Input
                                type="date"
                                value={deliveryDate}
                                onChange={(e) => setDeliveryDate(e.target.value)}
                                className="h-9"
                            />
                        </div>

                        {/* 確認者（自動） */}
                        <div>
                            <label className="text-xs font-medium text-slate-600 block mb-1">
                                確認者
                            </label>
                            <Input
                                value={confirmedBy}
                                disabled
                                className="h-9 bg-slate-100"
                            />
                        </div>

                        {/* メモ */}
                        <div>
                            <label className="text-xs font-medium text-slate-600 block mb-1">
                                メモ（任意）
                            </label>
                            <Input
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="納品時の備考..."
                                className="h-9"
                            />
                        </div>

                        {/* ボタン */}
                        <div className="flex gap-2 pt-1">
                            <Button
                                size="sm"
                                onClick={handleSubmit}
                                disabled={uploading}
                                className="gap-1.5"
                            >
                                <Check className="h-4 w-4" />
                                {uploading ? "保存中..." : "納品確認を保存"}
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => { setShowForm(false); setSelectedFile(null); setPreview(null); }}
                            >
                                キャンセル
                            </Button>
                        </div>
                    </div>
                )}

                {/* 既存の納品記録一覧 */}
                {loading ? (
                    <p className="text-sm text-muted-foreground">読み込み中...</p>
                ) : receipts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">納品記録はまだありません</p>
                ) : (
                    <div className="space-y-3">
                        {receipts.map((r) => (
                            <div key={r.id} className="border rounded-lg p-3 bg-white">
                                <div className="flex items-start gap-3">
                                    {/* 写真サムネイル */}
                                    {r.photoPath ? (
                                        <a
                                            href={r.photoPath}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-shrink-0"
                                        >
                                            <img
                                                src={r.photoPath}
                                                alt="納品伝票"
                                                className="w-16 h-16 object-cover rounded border hover:opacity-80 transition-opacity"
                                            />
                                        </a>
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
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
