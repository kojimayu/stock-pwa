"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save, Megaphone, Eye, Trash2 } from "lucide-react";
import { getSystemConfig, setSystemConfig } from "@/lib/actions";

export default function SettingsPage() {
    const [announcement, setAnnouncement] = useState("");
    const [originalAnnouncement, setOriginalAnnouncement] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [preview, setPreview] = useState(false);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            const value = await getSystemConfig("kiosk_announcement");
            setAnnouncement(value);
            setOriginalAnnouncement(value);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await setSystemConfig("kiosk_announcement", announcement);
            setOriginalAnnouncement(announcement);
            toast.success("お知らせを保存しました");
        } catch (error) {
            toast.error("保存に失敗しました");
        } finally {
            setSaving(false);
        }
    };

    const handleClear = async () => {
        if (!confirm("お知らせを削除しますか？業者ログイン時にモーダルが表示されなくなります。")) return;
        setAnnouncement("");
        setSaving(true);
        try {
            await setSystemConfig("kiosk_announcement", "");
            setOriginalAnnouncement("");
            toast.success("お知らせを削除しました");
        } catch (error) {
            toast.error("削除に失敗しました");
        } finally {
            setSaving(false);
        }
    };

    const hasChanges = announcement !== originalAnnouncement;

    if (loading) return <div className="p-8 text-center text-slate-500">読み込み中...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">設定</h2>
                <p className="text-muted-foreground">システム全体の設定</p>
            </div>

            {/* お知らせ設定 */}
            <div className="border rounded-lg p-6 bg-white space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <Megaphone className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-bold">業者向けお知らせ</h3>
                </div>
                <p className="text-sm text-slate-500">
                    設定した文面は、業者がKioskにログインするたびに全画面モーダルで表示されます。
                    「確認しました」を押さないと先に進めません。空にすると表示されません。
                </p>

                <Textarea
                    placeholder="お知らせ文を入力してください...&#10;&#10;例: 材料の残数確認にご協力ください。&#10;最近、在庫数のずれが発生しています。"
                    value={announcement}
                    onChange={(e) => setAnnouncement(e.target.value)}
                    className="min-h-[200px] text-base leading-relaxed"
                />

                <div className="flex justify-between items-center gap-2">
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPreview(!preview)}
                        >
                            <Eye className="w-4 h-4 mr-1" />
                            {preview ? "プレビューを閉じる" : "プレビュー"}
                        </Button>
                        {originalAnnouncement && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={handleClear}
                                disabled={saving}
                            >
                                <Trash2 className="w-4 h-4 mr-1" />
                                削除
                            </Button>
                        )}
                    </div>
                    <Button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? "保存中..." : "保存"}
                    </Button>
                </div>

                {/* プレビュー */}
                {preview && announcement && (
                    <div className="border-2 border-dashed border-blue-300 rounded-xl p-6 bg-blue-50/50">
                        <p className="text-xs font-bold text-blue-600 mb-3">📱 業者画面でのプレビュー:</p>
                        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm mx-auto">
                            <div className="text-center mb-4">
                                <div className="bg-blue-100 p-3 rounded-full inline-block mb-2">
                                    <Megaphone className="w-8 h-8 text-blue-600" />
                                </div>
                                <h2 className="text-lg font-bold">📋 お知らせ</h2>
                            </div>
                            <div className="text-base leading-relaxed whitespace-pre-wrap text-slate-700 mb-6">
                                {announcement}
                            </div>
                            <div className="bg-blue-600 text-white text-center py-3 rounded-xl font-bold text-lg">
                                確認しました
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
