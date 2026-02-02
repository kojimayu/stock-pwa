"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { generateQrToken } from "@/lib/actions";
import { toast } from "sonner";
import { QrCode, RefreshCw } from "lucide-react";
import QRCode from "react-qr-code";

interface VendorQrDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    vendor: { id: number; name: string; qrToken?: string | null } | null;
    onSuccess: () => void;
}

export function VendorQrDialog({ open, onOpenChange, vendor, onSuccess }: VendorQrDialogProps) {
    const [loading, setLoading] = useState(false);
    const [qrToken, setQrToken] = useState<string | null>(null);

    // Update local state when vendor prop changes or dialog opens
    useEffect(() => {
        if (open && vendor) {
            setQrToken(vendor.qrToken || null);
        }
    }, [open, vendor]);

    const handleGenerateQr = async () => {
        if (!vendor) return;

        setLoading(true);
        try {
            const res = await generateQrToken(vendor.id);
            if (res.success && res.qrToken) {
                setQrToken(res.qrToken);
                toast.success("QRコードを生成しました");
                onSuccess();
            } else {
                toast.error("QRコードの生成に失敗しました");
            }
        } catch (error) {
            toast.error("エラーが発生しました");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (!vendor) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <QrCode className="w-5 h-5" />
                        {vendor.name} のQRコード
                    </DialogTitle>
                    <DialogDescription>
                        このQRコードをスマホに保存して、タブレットにかざすとログインできます。
                    </DialogDescription>
                </DialogHeader>

                <div className="py-6">
                    {qrToken ? (
                        <div className="flex flex-col items-center gap-4">
                            <div className="p-4 bg-white rounded-lg border shadow-sm">
                                <QRCode
                                    value={qrToken}
                                    size={200}
                                    level="H"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground text-center">
                                スマホで上記QRコードのスクリーンショットを撮るか、<br />
                                「LINE」「メール」で業者に送信してください。
                            </p>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <QrCode className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-500 mb-4">
                                まだQRコードが生成されていません
                            </p>
                            <Button onClick={handleGenerateQr} disabled={loading}>
                                {loading ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                        生成中...
                                    </>
                                ) : (
                                    <>
                                        <QrCode className="w-4 h-4 mr-2" />
                                        QRコードを生成
                                    </>
                                )}
                            </Button>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    {qrToken && (
                        <Button variant="outline" onClick={handleGenerateQr} disabled={loading}>
                            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                            再生成
                        </Button>
                    )}
                    <Button variant="secondary" onClick={() => onOpenChange(false)}>
                        閉じる
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
